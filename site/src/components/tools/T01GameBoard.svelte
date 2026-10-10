<script lang="ts">
  // T1, the Game Board (SPEC.md 4 T1, 4.0, 2.2 to 2.4, 6.6, 7.4, 7.5). The board on which the mutation
  // game, the numbers game, or both linked by a = Cp are played, in the views populations, numbers,
  // linked and the modes free, legal, raising. Drawn inside P1-A2's ToolFrame; every move goes through
  // the model (t01/model.ts), which calls the engine. The default state renders at build time; the
  // URL is read once on hydration through decodeState with the instance prefix.
  //
  // Properties (CONTRACTS 5.2 and SPEC 4 T1; every name is listed in site/tests/e2e/T01.spec.ts):
  //   id, board, view, mode, coords, start, moves, caption, preset (ignored: T1 has no presets),
  //   linkTo (ignored: T1 is the tool others follow), layers (ignored: T1 never grows a set),
  //   script, goal, prediction, hints, panels, roadStyle, rounds, settings, onChange.
  import { untrack } from 'svelte';
  import { CAPS } from '@engine';
  import type { AnyBoard } from '@engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import Predict from '../board/Predict.svelte';
  import Frac from '../math/Frac.svelte';
  import Bridge from './t01/Bridge.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { decodeState, encodeState } from '@lib/urlCodec';
  import { defaultStart, firstForbiddenMove, isNamedFinite, publishToolState, resolveBoard, type BoardSpec, type ToolState } from '@lib/state';
  import { engineCall, whereToRun } from '@lib/worker';
  import { highlight } from '@lib/highlight';
  import { POPULATIONS_ICON, NUMBERS_ICON } from '../draw/palette';
  import type { NodeState } from '@lib/a11y';
  import type { Prediction } from '../../tools/types';
  import type { RoadStyle } from '../board/types';
  import {
    MODES_OF_VIEW,
    MODE_TEXT,
    PICKER_GROUPS,
    T1Game,
    GOAL_MET_TEXT,
    configOf,
    defaultGoalText,
    goalMet,
    goalNote,
    inLabelOrder,
    limitText,
    panelsToDraw,
    requirePair,
    requireScript,
    roundCount,
    scriptCaption,
    scriptProgress,
    boardTitle,
    type Coords,
    type Goal,
    type Mode,
    type Panel,
    type Script,
    type Shown,
    type T1Config,
    type View,
  } from './t01/model';
  import { gameOverSentence, moveSentence, playSentence, refusalSentence, spokenValue, undoSentence } from './t01/announce';
  import { followJumps, highlightBoardName, highlightMatches } from './t01/interop';
  import { isLong } from './t01/longNumber';

  interface Props {
    id?: string;
    board?: BoardSpec;
    view?: View;
    mode?: Mode;
    coords?: Coords;
    start?: (number | string)[];
    moves?: number[];
    caption?: string;
    preset?: string;
    linkTo?: string;
    layers?: number;
    script?: Script;
    goal?: Goal;
    prediction?: Prediction;
    hints?: boolean;
    panels?: Panel[];
    roadStyle?: RoadStyle;
    rounds?: number;
    /** Show the board picker and the view and mode choosers (default: on the tool's own route). */
    settings?: boolean;
    /** Called after every change with the state and the current position (T9, plan). */
    onChange?: (info: { state: ToolState; populations: string[] | null; numbers: string[] }) => void;
  }

  let {
    id = '',
    board: boardProp = 'A2',
    view: viewProp,
    mode: modeProp,
    coords: coordsProp,
    start: startProp,
    moves: movesProp,
    caption = 'Each number is the amount by which a mutation would lower its city: one move, two records.',
    script,
    goal,
    prediction,
    hints = false,
    panels,
    roadStyle,
    rounds,
    settings,
    onChange,
  }: Props = $props();

  // The author's configuration is read once: props configure the instance, the reader's moves and the
  // URL change it afterwards (CONTRACTS 5.2).
  const instanceId = untrack(() => id);
  const authorConfig: T1Config = untrack(() => {
    const c: T1Config = { board: boardProp, view: viewProp ?? 'linked', mode: modeProp ?? 'free', coords: coordsProp ?? 'populations' };
    if (startProp !== undefined) c.start = startProp;
    if (movesProp !== undefined) c.moves = movesProp;
    return c;
  });
  // Authoring errors fail the build with a message naming the instance (plan).
  requirePair(authorConfig.view!, authorConfig.mode!, instanceId);
  untrack(() => requireScript(authorConfig, script, instanceId));

  const initialGame = new T1Game(authorConfig);
  const defaults: ToolState = initialGame.state();
  const showSettings = untrack(() => settings ?? instanceId === '');

  let game = $state.raw(initialGame);
  let version = $state(0);
  let notice = $state<string | null>(null);
  let limit = $state<string | null>(null);
  let busy = $state(false);
  let scriptBase = $state(initialGame.cursor);
  let predictionResolved = $state(untrack(() => prediction === undefined));
  let goalWasMet = $state(false);

  const touch = (): void => {
    version++;
  };
  /** The game, read so that a derived value depends on `version` (the model is a mutable class). */
  function cur(): T1Game {
    void version;
    return game;
  }

  const view$ = $derived((cur().view));
  const shown: Shown = $derived((cur().shown));
  const frozen = $derived(!predictionResolved);
  const canAct = $derived((frozen ? cur().labels.map(() => false) : cur().canAct()));
  const toolState = $derived((cur().state()));
  const title = $derived(boardTitle(game.spec));
  const boardName = $derived(highlightBoardName(game.spec));
  const xy = $derived(typeof game.spec === 'string' ? undefined : game.spec.xy);
  const anyBoard: AnyBoard = $derived((cur().board));
  const spokenPops = $derived(shown.populations?.map(spokenValue));
  const spokenNums = $derived(shown.numbers.map(spokenValue));
  // A-3 on the populations board: from the sign of the number, what a mutation would do (2.4(a)).
  const popStates = $derived(
    shown.numbers.map((a): NodeState => (a.startsWith('-') ? 'mutation would raise it' : /^0+$/.test(a) ? 'mutation would change nothing' : 'mutation would lower it')),
  );
  const numStates = $derived(canAct.map((c): NodeState => (c ? 'can be fired' : 'cannot be fired')));
  const ghosts = $derived((hints && !frozen ? cur().ghosts() : null));
  const gameOverText = $derived((cur().gameOver ? `Game over after ${game.cursor} ${game.cursor === 1 ? 'move' : 'moves'}.` : ''));
  const progress = $derived(script ? scriptProgress(script, scriptBase, (cur().applied)) : 0);
  const goalNow = $derived(goal ? goalMet(goal, anyBoard, shown, game.coords) : false);
  const goalNoteText = $derived(goal ? goalNote(goal, goalNow, (cur().cursor)) : null);
  const drawnPanels = $derived(panelsToDraw(panels));
  const lit = $derived(highlightMatches($highlight, boardName, anyBoard, shown));
  const stepOffered = $derived(game.mode !== 'free');
  const atEnd = $derived((cur().stepPosition() === null));

  /** Exact digits in the tooltip for long values (4.0 Long numbers). */
  const tooltip = (values: readonly string[]) => (k: number): string | null => (values[k]!.split('/').some(isLong) ? values[k]! : null);

  const figureLabel = $derived.by(() => {
    const parts: string[] = [];
    const inOrder = (v: readonly string[]): string => inLabelOrder(anyBoard, v).map(spokenValue).join(', ');
    if (shown.populations !== null) parts.push(`populations ${inOrder(shown.populations)}`);
    if (view$ !== 'populations') parts.push(`numbers ${inOrder(shown.numbers)}`);
    return `Game Board on ${title}, ${view$} view, ${MODE_TEXT[game.mode]}: ${parts.join('; ')}.`;
  });

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a jump, a picker)
  // ------------------------------------------------------------------------------------------

  function load(s: ToolState): void {
    game = new T1Game(configOf(s));
    scriptBase = 0;
    limit = null;
    goalWasMet = false;
    touch();
  }

  // Hydration: read the URL once with the instance prefix (6.6); follow jumps published under this id.
  $effect(() => {
    return untrack(() => {
      try {
        const { state: decoded, notice: n } = decodeState(window.location.search, 'board', defaults, { prefix: instanceId });
        if (n !== null) notice = n;
        if (encodeState(decoded) !== encodeState(defaults)) load(decoded);
      } catch {
        // decodeState never throws on a bad link; a failure here leaves the default state.
      }
      return followJumps(instanceId, () => game.state(), (moves) => {
        try {
          load({ ...game.state(), moves });
        } catch {
          // a jump that is not a play of this board is ignored
        }
      });
    });
  });

  // Every change: publish the state (never positions) for linked tools, and tell the parent (T9).
  $effect(() => {
    const s = toolState;
    const pops = shown.populations;
    const nums = shown.numbers;
    untrack(() => {
      publishToolState(instanceId, s);
      onChange?.({ state: s, populations: pops === null ? null : inLabelOrder(game.board, pops), numbers: inLabelOrder(game.board, nums) });
    });
  });

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------

  function afterMove(announce: (t: string) => void, sentence: string, withGameOver = true): void {
    let text = sentence;
    // A single move that ends a legal game says so (A-4); a play to the end is one sentence (4.0).
    if (withGameOver && game.gameOver) text += ` ${gameOverSentence(game.cursor)}`;
    if (goal) {
      const met = goalMet(goal, game.board, game.shown, game.coords);
      if (met && !goalWasMet) text += ` ${GOAL_MET_TEXT}`;
      goalWasMet = met;
    }
    announce(text);
  }

  function act(position: number, announce: (t: string) => void): void {
    if (frozen || busy) return;
    const before = game.shown;
    const r = game.act(position);
    if (r.kind === 'refused') {
      announce(refusalSentence(game.mode, r.label, r.number));
      return;
    }
    limit = null;
    touch();
    afterMove(announce, moveSentence(game.view, game.labels, r.label, before, game.shown, game.cursor));
  }

  function step(announce: (t: string) => void): void {
    const k = game.stepPosition();
    if (k !== null) act(k, announce);
  }

  function next(announce: (t: string) => void): void {
    if (!script || progress < 0 || progress >= script.length) return;
    const label = script[progress]!.move;
    act(game.labels.indexOf(label), announce);
  }

  async function playToEnd(announce: (t: string) => void): Promise<void> {
    if (frozen || busy || game.stepPosition() === null) return;
    const call = game.playCall();
    const hint = { board: game.board, kind: 'play' as const, finiteKnown: isNamedFinite(game.board) };
    let outcome;
    if (whereToRun(hint) === 'main') {
      outcome = game.playToEnd();
    } else {
      busy = true;
      try {
        const current = game;
        const result = await engineCall(call.fn, [current.board, call.vector, undefined, CAPS.playMoves] as never, hint);
        if (current !== game) return; // the reader loaded another state meanwhile
        outcome = game.applyPlay(result);
      } finally {
        busy = false;
      }
    }
    limit = limitText(outcome);
    touch();
    afterMove(announce, playSentence(game.view, game.mode, game.labels, outcome.moves, outcome.status, game.shown), false);
  }

  function arrive(to: number, from: number, announce: (t: string) => void): void {
    if (to < from) announce(undoSentence(game.view, game.labels, to + 1, game.shownAt(to)));
    else if (to > from) announce(moveSentence(game.view, game.labels, game.moves[to - 1]!, game.shownAt(to - 1), game.shownAt(to), to));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen || busy) return;
    const from = game.cursor;
    if (!game.scrub(to)) return;
    limit = null;
    touch();
    arrive(to, from, announce);
  }

  const undo = (announce: (t: string) => void): void => scrub(game.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(game.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    if (frozen || busy) return;
    const from = game.cursor;
    if (!game.reset()) return;
    limit = null;
    scriptBase = 0;
    touch();
    arrive(0, from, announce);
  }

  function onKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo(announce);
    else redo(announce);
  }

  function pickBoard(name: string): void {
    const s = game.state();
    const board = resolveBoard(name);
    notice = null;
    load({ ...s, board: name, start: defaultStart(board, game.coords), moves: [] });
  }

  function pickView(v: View): void {
    const s = game.state();
    const mode = MODES_OF_VIEW[v].includes(game.requestedMode) ? game.requestedMode : 'free';
    load({ ...s, view: v, mode });
  }

  function pickMode(m: Mode): void {
    const s: ToolState = { ...game.state(), mode: m };
    // Moves the new mode forbids are dropped (plan): the play restarts from the start.
    if (firstForbiddenMove(game.board, s) !== null) s.moves = [];
    load(s);
  }

  function setHighlight(position: number | null): void {
    if (position === null) {
      const h = highlight.get();
      if (h !== null && h.kind === 'node' && h.board === boardName) highlight.set(null);
      return;
    }
    highlight.set({ kind: 'node', board: boardName, value: game.labels[position]! });
  }

  const positionNames = $derived.by(() => {
    const game = cur();
    const out: string[] = [];
    for (let k = 0; k <= game.moves.length; k++) {
      const s = game.shownAt(k);
      const v = s.populations !== null && game.view === 'populations' ? s.populations : s.numbers;
      const noun = s.populations !== null && game.view === 'populations' ? 'populations' : 'numbers';
      out.push(`${k === 0 ? 'Start' : `After move ${k}`}: ${noun} ${inLabelOrder(game.board, v).map(spokenValue).join(', ')}`);
    }
    return out;
  });

  const labelsInOrder = $derived([...game.labels].sort((a, b) => a - b));
  const tableRows = $derived.by(() => {
    const rows: { board: 'populations' | 'numbers'; heading: string; values: string[] }[] = [];
    if (shown.populations !== null) rows.push({ board: 'populations', heading: 'Populations', values: inLabelOrder(anyBoard, shown.populations) });
    if (view$ !== 'populations') rows.push({ board: 'numbers', heading: 'Numbers', values: inLabelOrder(anyBoard, shown.numbers) });
    return rows;
  });
</script>

{#snippet icon(i: typeof POPULATIONS_ICON)}
  <svg class="icon" viewBox={i.viewBox} width="16" height="16" aria-hidden="true" focusable="false"><path d={i.d} stroke={i.stroke} fill={i.fill} /></svg>
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t01" data-view={view$} data-mode={game.mode} onkeydown={(e) => onKeydown(e, api.announce)}>
    <p class="line mode" data-out="mode">{MODE_TEXT[game.mode]}</p>
    {#if goal}
      <p class="line" data-out="goal">{defaultGoalText(goal)}</p>
      <p class="line" data-out="goalMet">{goalNow ? GOAL_MET_TEXT : ''}</p>
      <p class="line" data-out="goalNote">{goalNoteText ?? ''}</p>
    {/if}
    {#if prediction}
      <Predict {prediction} hydrated={api.hydrated} labels={labelsInOrder} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    {#if shown.populations !== null}
      <div class="panel populations" data-panel-board="populations">
        <p class="panel-title">{@render icon(POPULATIONS_ICON)} Populations</p>
        <Board
          board={anyBoard}
          {xy}
          values={shown.populations}
          game="mutation"
          {canAct}
          {roadStyle}
          name="Populations board on {title}"
          states={popStates}
          spoken={spokenPops}
          ghosts={ghosts?.populations ?? undefined}
          disabled={frozen || busy}
          highlighted={lit.populations}
          hintFor={tooltip(shown.populations)}
          onAct={(k) => act(k, api.announce)}
          onFocusNode={setHighlight}
        />
      </div>
    {/if}
    {#if view$ === 'linked' && shown.populations !== null}
      <Bridge />
    {/if}
    {#if view$ !== 'populations'}
      <div class="panel numbers" data-panel-board="numbers">
        <p class="panel-title">{@render icon(NUMBERS_ICON)} Numbers</p>
        <Board
          board={anyBoard}
          {xy}
          values={shown.numbers}
          game="firing"
          {canAct}
          {roadStyle}
          name="Numbers board on {title}"
          states={numStates}
          spoken={spokenNums}
          ghosts={ghosts?.numbers ?? undefined}
          disabled={frozen || busy}
          highlighted={lit.numbers}
          hintFor={tooltip(shown.numbers)}
          onAct={(k) => act(k, api.announce)}
          onFocusNode={setHighlight}
        />
      </div>
    {/if}
    {#each drawnPanels as p (p)}
      <div class="panel extra" data-panel={p}></div>
    {/each}
    {#if game.mode === 'legal'}
      <p class="line" data-out="gameOver">{gameOverText}</p>
    {/if}
    {#if game.mode !== 'free'}
      <p class="line" data-out="limit">{limit ?? ''}</p>
    {/if}
    {#if rounds !== undefined}
      <p class="line" data-out="roundCounter">Round {roundCount((cur().cursor), rounds)}</p>
    {/if}
    <History
      total={(cur().moves.length)}
      cursor={(cur().cursor)}
      {positionNames}
      hydrated={api.hydrated}
      frozen={frozen || busy}
      onUndo={() => undo(api.announce)}
      onRedo={() => redo(api.announce)}
      onReset={() => reset(api.announce)}
      onScrub={(to) => scrub(to, api.announce)}
    />
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  {#if stepOffered}
    <button type="button" class="control" data-control="step" disabled={!api.hydrated || frozen || busy || atEnd} onclick={() => step(api.announce)}>Step</button>
    <button type="button" class="control" data-control="playToEnd" disabled={!api.hydrated || frozen || busy || atEnd} onclick={() => playToEnd(api.announce)}
      >Play to the end</button
    >
  {/if}
  {#if script}
    <button type="button" class="control" data-control="next" disabled={!api.hydrated || frozen || busy || progress < 0 || progress >= script.length} onclick={() => next(api.announce)}
      >Next</button
    >
    <p class="line script" data-out="scriptCaption">{scriptCaption(script, progress)}</p>
  {/if}
  {#if showSettings}
    <label class="setting">
      <span>Board</span>
      <select data-control="picker" disabled={!api.hydrated} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value)}>
        {#if typeof game.spec !== 'string' || !PICKER_GROUPS.some((g) => g.names.includes(game.spec as string))}
          <option value="" selected disabled>{title}</option>
        {/if}
        {#each PICKER_GROUPS as g (g.letter)}
          <optgroup label="Type {g.letter}" data-letter={g.letter}>
            {#each g.names as name (name)}
              <option value={name} selected={game.spec === name}>{name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
    <label class="setting">
      <span>View</span>
      <select data-control="view" disabled={!api.hydrated} onchange={(e) => pickView((e.currentTarget as HTMLSelectElement).value as View)}>
        {#each ['populations', 'numbers', 'linked'] as v (v)}
          <option value={v} selected={game.requestedView === v}>{v}</option>
        {/each}
      </select>
    </label>
    <label class="setting">
      <span>Mode</span>
      <select data-control="mode" disabled={!api.hydrated} onchange={(e) => pickMode((e.currentTarget as HTMLSelectElement).value as Mode)}>
        {#each MODES_OF_VIEW[game.requestedView] as m (m)}
          <option value={m} selected={game.requestedMode === m}>{MODE_TEXT[m]}</option>
        {/each}
      </select>
    </label>
  {/if}
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values">
    <caption>Values on {title}, after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
    <thead>
      <tr>
        <th scope="col">Board</th>
        {#each labelsInOrder as l (l)}
          <th scope="col">Node {l}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each tableRows as row (row.board)}
        <tr>
          <th scope="row">{row.heading}</th>
          {#each labelsInOrder as l, k (l)}
            <td>
              <button
                type="button"
                class="cell"
                data-table-board={row.board}
                data-table-node={l}
                disabled={!api.hydrated || frozen || busy}
                aria-label="{row.board === 'populations' ? 'City' : 'Node'} {l}, {row.board === 'populations' ? 'population' : 'value'} {spokenValue(row.values[k]!)}"
                onclick={() => act(game.labels.indexOf(l), api.announce)}><Frac value={row.values[k]!} /></button
              >
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<ToolFrame
    toolId="board"
    {instanceId}
    title="Game Board"
    {caption}
    state={toolState}
    {defaults}
    {notice}
    {figureLabel}
    derivedForExport={() => game.derived()}
    onPopState={(s, n) => {
      load(s);
      notice = n;
    }}
    {figure}
    {controls}
    {table}
  />

<style>
  .t01 {
    display: grid;
    gap: 8px;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .mode {
    font-style: italic;
  }
  /* The accents mark the panels' borders and icons, never text or a node's fill (8.3). The border is
     an inset shadow so that the board keeps the full width W of the size rule (6.1). */
  .panel {
    border-radius: 8px;
    padding: 4px 0;
    min-width: 0;
  }
  .panel.populations {
    box-shadow: inset 0 0 0 2px var(--accent-populations);
  }
  .panel.numbers {
    box-shadow: inset 0 0 0 2px var(--accent-numbers);
  }
  .panel-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 8px;
    font-weight: bold;
  }
  .icon {
    flex: 0 0 auto;
  }
  .control {
    min-width: 44px;
    height: 44px;
    padding: 0 12px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
    cursor: pointer;
  }
  .control:disabled {
    cursor: default;
  }
  .control:focus-visible,
  .cell:focus-visible,
  select:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .script {
    flex: 1 1 100%;
  }
  .setting {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  select {
    min-height: 44px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
  }
  .values {
    border-collapse: collapse;
  }
  .values th,
  .values td {
    padding: 2px 6px;
    text-align: center;
  }
  .cell {
    min-width: 44px;
    min-height: 44px;
    font: inherit;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    overflow-wrap: anywhere;
  }
</style>
