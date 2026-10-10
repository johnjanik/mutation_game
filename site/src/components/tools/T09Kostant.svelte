<script lang="ts">
  // T9, Kostant's Game (SPEC.md 4 T9, 2.7 F13, 2.12, 2.16, 4.0, Appendix A.4). "T1 in the populations
  // view and raising mode, started from one Martian, with the three moods shown." Built on the parts T1
  // composes (P1-A2's ToolFrame, the Board family, History, Predict) and on T1's own model
  // (t01/model.ts T1Game, fixed to view populations and mode raising), because T01GameBoard renders its
  // own ToolFrame with data-tool="board" and reads the URL as tool 'board', which T9 cannot use (no
  // second ToolFrame may be nested; decisions/P1-A7.md, request to MERGE). Every move and every value
  // comes from the engine through T1Game and t09/kostant.ts. The default state, its moods, the goal, the
  // bridge sentence and, when the state is already at the end, the end panel are rendered at build time.
  //
  // Properties (CONTRACTS 5.2; every name is listed in site/tests/e2e/T09.spec.ts): id, board, coords,
  // start, moves, caption, preset (only 'default'), prediction, linkTo (ignored: T9 follows no tool),
  // layers (ignored: T9 grows no set, 4.0 "Growth off the finite types" does not bind it), and the plan
  // property boardChoices (limits the picker; M1 row 3 passes ['A3', 'D4', 'E8']).
  import { untrack } from 'svelte';
  import { CAPS, EngineOverflow } from '@two-games/engine';
  import type { AnyBoard, Board as EngineBoard } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import Predict from '../board/Predict.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { nodePositions } from '../draw/layouts';
  import { MARGIN, toPixels } from '../draw/geometry';
  import { decodeState, encodeState, LINK_NOTICE } from '../../lib/urlCodec';
  import { defaultStart, resolveBoard, type BoardSpec, type ToolState } from '../../lib/state';
  import type { Prediction } from '../../tools/types';
  import { T1Game, inLabelOrder, type T1Config } from './t01/model';
  import { moveSentence, playSentence, refusalSentence, spokenValue, undoSentence } from './t01/announce';
  import { isLong } from './t01/longNumber';
  import {
    MOOD_SHAPE,
    MOOD_STATE,
    affineCaptionParts,
    endAnnouncement,
    endPanel,
    endSentence,
    isNamedFinite,
    moodOfText,
    pickerGroups,
    playControl,
    playOutcome,
    startFromLink,
    stepPosition,
    type EndPanel,
    type Mood,
  } from './t09/kostant';

  interface Props {
    id?: string;
    board?: BoardSpec;
    coords?: 'populations' | 'numbers';
    start?: (number | string)[];
    moves?: number[];
    caption?: string;
    preset?: string;
    prediction?: Prediction;
    linkTo?: string;
    layers?: number;
    /** Plan: the boards the picker offers (default: the 32 named types). */
    boardChoices?: string[];
  }

  let {
    id = '',
    board: boardProp = 'A3',
    coords: coordsProp = 'populations',
    start: startProp,
    moves: movesProp,
    caption = 'Raise whenever a city is unhappy, and see where the game stops.',
    prediction,
    boardChoices,
  }: Props = $props();

  const instanceId = untrack(() => id);
  const choices = untrack(() => boardChoices);

  /** The configuration of a state, fixed to the populations view and raising mode (SPEC 4 T9). */
  function configOf(s: { board: BoardSpec; start?: (number | string)[]; moves?: number[] }): T1Config {
    const c: T1Config = { board: s.board, view: 'populations', mode: 'raising', coords: 'populations' };
    if (s.start !== undefined) c.start = [...s.start];
    if (s.moves !== undefined) c.moves = [...s.moves];
    return c;
  }

  // The author's configuration, read once. A numbers start is converted when C^{-1} a is integral and is
  // an authoring error otherwise (T9 has no linked view to fall back to; plan).
  const authorConfig: T1Config = untrack(() => {
    const b = resolveBoard(boardProp);
    let start = startProp ?? defaultStart(b, 'populations');
    if (coordsProp === 'numbers') {
      const converted = startFromLink(b, 'numbers', start);
      if (converted === null) {
        throw new Error(`T9 instance "${instanceId || 'kostant'}": the numbers start ${start.join(', ')} has no integral population`);
      }
      start = converted;
    }
    return configOf({ board: boardProp, start, moves: movesProp ?? [] });
  });

  const initialGame = new T1Game(authorConfig);
  const toState = (g: T1Game): ToolState => ({ ...g.state(), tool: 'kostant' });
  const defaults: ToolState = toState(initialGame);

  let game = $state.raw(initialGame);
  let version = $state(0);
  let notice = $state<string | null>(null);
  let limit = $state<string | null>(null);
  let predictionResolved = $state(untrack(() => prediction === undefined));

  const touch = (): void => {
    version++;
  };
  function cur(): T1Game {
    void version;
    return game;
  }

  const frozen = $derived(!predictionResolved);
  const shown = $derived(cur().shown);
  const anyBoard: AnyBoard = $derived(cur().board);
  const title = $derived(typeof game.spec === 'string' ? game.spec : 'custom board');
  const toolState = $derived(toState(cur()));
  const pops = $derived(shown.populations ?? []);
  const moodsNow: Mood[] = $derived(shown.numbers.map(moodOfText));
  const canAct = $derived(frozen ? moodsNow.map(() => false) : cur().canAct());
  const goalMet = $derived(moodsNow.every((m) => m !== 'unhappy'));
  const atEnd = $derived(goalMet);
  // The end panel, computed in the script so that the server render writes it (trap 13).
  const panel: EndPanel | null = $derived.by(() => {
    const g = cur();
    if (!goalMet || !isNamedFinite(g.board)) return null;
    return endPanel(g.board as EngineBoard<unknown>, g.current.pop!, g.cursor);
  });
  const caption212 = $derived(panel === null ? null : affineCaptionParts(panel));
  // Phase-2 slots (P2-A7): the name of the affine board (kostant[T].affine_board_from_node) and the
  // button that opens it in T4. Null in phase 1, so neither renders.
  const affineBoardName: string | null = null;
  const states = $derived(moodsNow.map((m) => MOOD_STATE[m]));
  const spoken = $derived(pops.map(spokenValue));
  const labelsInOrder = $derived([...anyBoard.labels].sort((a, b) => a - b));
  const popsInOrder = $derived(inLabelOrder(anyBoard, pops));
  const numsInOrder = $derived(inLabelOrder(anyBoard, shown.numbers));
  const moodsInOrder = $derived(inLabelOrder(anyBoard, moodsNow));
  const groups = $derived(pickerGroups(choices));
  const startCity = $derived.by(() => {
    const s = cur().start.map(String);
    const ones = s.flatMap((t, k) => (t === '1' ? [k] : []));
    return ones.length === 1 && s.every((t, k) => k === ones[0] || t === '0') ? labelsInOrder[ones[0]!]! : null;
  });

  /** Exact digits in the tooltip for long values (4.0 Long numbers). */
  const tooltip = (values: readonly string[]) => (k: number): string | null => (isLong(values[k]!) ? values[k]! : null);

  const figureLabel = $derived(
    `Kostant's Game on ${title}: populations ${popsInOrder.map(spokenValue).join(', ')}; moods ${moodsInOrder.join(', ')}.`,
  );

  // The overlay of moods and marks, drawn in the same box and grid units as Board.svelte (6.1).
  const REF_UNIT = 64;
  const layout = $derived(nodePositions(anyBoard));
  const px = $derived(toPixels(layout, 2 * MARGIN + layout.columns * REF_UNIT));
  const centres = $derived(px.centres.map(([x, y]) => [(x - MARGIN) / REF_UNIT, (y - MARGIN) / REF_UNIT] as [number, number]));
  const markedPositions = $derived(new Set(panel === null ? [] : panel.marked.map((l) => anyBoard.labels.indexOf(l))));

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a picker, the start city)
  // ------------------------------------------------------------------------------------------

  /**
   * T9's own reading of a decoded link (plan, section 5.2): another view or mode, or a numbers start
   * whose population is fractional, is refused (null); a numbers start with an integral population is
   * converted and written back with coords populations.
   */
  function admit(s: ToolState): ToolState | null {
    if ((s.view ?? 'populations') !== 'populations' || (s.mode ?? 'raising') !== 'raising') return null;
    const b = resolveBoard(s.board);
    const start = s.start ?? defaultStart(b, s.coords ?? 'populations');
    const converted = startFromLink(b, s.coords ?? 'populations', start);
    if (converted === null) return null;
    return { ...s, view: 'populations', mode: 'raising', coords: 'populations', start: converted };
  }

  function load(s: { board: BoardSpec; start?: (number | string)[]; moves?: number[] }): void {
    game = new T1Game(configOf(s));
    limit = null;
    touch();
  }

  function loadLink(decoded: ToolState, n: string | null): void {
    let admitted: ToolState | null = null;
    try {
      admitted = admit(decoded);
    } catch {
      admitted = null;
    }
    if (admitted === null) {
      notice = LINK_NOTICE;
      load(defaults);
      return;
    }
    notice = n;
    if (encodeState(admitted) !== encodeState(toState(game))) load(admitted);
  }

  // Hydration: read the URL once with the instance prefix (6.6). Never a move by itself (4.0).
  $effect(() => {
    untrack(() => {
      try {
        const { state: decoded, notice: n } = decodeState(window.location.search, 'kostant', defaults, { prefix: instanceId });
        loadLink(decoded, n);
      } catch {
        // decodeState never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------

  function withEnd(sentence: string, wasMet: boolean): string {
    const g = game;
    const metNow = g.shown.numbers.every((x) => moodOfText(x) !== 'unhappy');
    if (!metNow || wasMet || !isNamedFinite(g.board)) return sentence;
    return `${sentence} ${endAnnouncement(endPanel(g.board as EngineBoard<unknown>, g.current.pop!, g.cursor))}`;
  }

  function act(position: number, announce: (t: string) => void): void {
    if (frozen) return;
    const wasMet = goalMet;
    const before = game.shown;
    const r = game.act(position);
    if (r.kind === 'refused') {
      announce(refusalSentence('raising', r.label, r.number));
      return;
    }
    limit = null;
    touch();
    announce(withEnd(moveSentence('populations', game.labels, r.label, before, game.shown, game.cursor), wasMet));
  }

  function step(announce: (t: string) => void): void {
    if (frozen) return;
    let k: number | null;
    try {
      k = stepPosition(game.board as EngineBoard<unknown>, game.current.pop!);
    } catch (e) {
      if (!(e instanceof EngineOverflow)) throw e;
      k = game.stepPosition();
    }
    if (k !== null) act(k, announce);
  }

  function playToEnd(announce: (t: string) => void): void {
    if (frozen || atEnd) return;
    const wasMet = goalMet;
    // A named finite board: at most N moves (F13; at most 120 on E8), always on the main thread (E-9).
    const outcome = game.playToEnd(CAPS.playMoves);
    limit = playOutcome(outcome, CAPS.playMoves);
    touch();
    announce(withEnd(playSentence('populations', 'raising', game.labels, outcome.moves, outcome.status, game.shown), wasMet));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen) return;
    const from = game.cursor;
    if (!game.scrub(to)) return;
    limit = null;
    touch();
    if (to < from) announce(undoSentence('populations', game.labels, to + 1, game.shownAt(to)));
    else announce(moveSentence('populations', game.labels, game.moves[to - 1]!, game.shownAt(to - 1), game.shownAt(to), to));
  }

  const undo = (announce: (t: string) => void): void => scrub(game.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(game.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    if (frozen) return;
    const from = game.cursor;
    if (!game.reset()) return;
    limit = null;
    touch();
    if (from > 0) announce(undoSentence('populations', game.labels, 1, game.shownAt(0)));
  }

  function onKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo(announce);
    else redo(announce);
  }

  function pickBoard(name: string, announce: (t: string) => void): void {
    const b = resolveBoard(name);
    notice = null;
    load({ board: name, start: defaultStart(b, 'populations'), moves: [] });
    announce(`Board ${name}. One Martian in city ${Math.min(...b.labels)}.`);
  }

  function pickStart(label: number, announce: (t: string) => void): void {
    const b = game.board;
    const order = [...b.labels].sort((x, y) => x - y);
    notice = null;
    load({ board: game.spec, start: order.map((l) => (l === label ? 1 : 0)), moves: [] });
    announce(`One Martian in city ${label}.`);
  }

  const positionNames = $derived.by(() => {
    const g = cur();
    const out: string[] = [];
    for (let k = 0; k <= g.moves.length; k++) {
      const s = g.shownAt(k);
      out.push(`${k === 0 ? 'Start' : `After move ${k}`}: populations ${inLabelOrder(g.board, s.populations ?? []).map(spokenValue).join(', ')}`);
    }
    return out;
  });

  const display = (v: string): string => v.replace(/^-/, '−');

  function exportData(): Record<string, unknown> {
    const base = game.derived();
    const end =
      panel === null
        ? null
        : {
            population: panel.end,
            name: panel.name,
            moves: panel.moves,
            h: panel.h,
            finalNumbers: panel.finalNumbers,
            marked: panel.marked,
            returnCounts: panel.returnCounts,
          };
    return { ...base, moods: moodsInOrder, end };
  }
</script>

{#snippet glyph(shape: string, x: number, y: number, s: number)}
  {#if shape === 'chevron-down'}
    <path d="M {x - s} {y - s / 2} L {x} {y + s / 2} L {x + s} {y - s / 2}" />
  {:else if shape === 'chevron-up'}
    <path d="M {x - s} {y + s / 2} L {x} {y - s / 2} L {x + s} {y + s / 2}" />
  {:else}
    <path d="M {x - s} {y} L {x + s} {y}" />
  {/if}
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t09" data-board-name={title} onkeydown={(e) => onKeydown(e, api.announce)}>
    <p class="line" data-out="goal" data-met={goalMet ? 'true' : 'false'}>Goal: make no city unhappy.</p>
    <p class="line" data-out="goalMet">{goalMet ? 'Goal reached.' : ''}</p>
    {#if prediction}
      <Predict {prediction} hydrated={api.hydrated} labels={labelsInOrder} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    <div class="board-host">
      <Board
        board={anyBoard}
        values={pops}
        game="mutation"
        {canAct}
        name="Kostant's game on {title}"
        {states}
        {spoken}
        disabled={frozen}
        hintFor={tooltip(pops)}
        onAct={(k) => act(k, api.announce)}
      />
      <div class="overlay" style="--k: {layout.columns}; --rows: {layout.rows};" aria-hidden="true">
        <svg viewBox="0 0 {layout.columns} {layout.rows}" focusable="false">
          {#each centres as [x, y], k (k)}
            <g class="mood" data-glyph={MOOD_SHAPE[moodsNow[k]!]}>
              {@render glyph(MOOD_SHAPE[moodsNow[k]!], x + 0.3, y + 0.33, 0.07)}
            </g>
            {#if markedPositions.has(k)}
              <g class="mark" data-mark={anyBoard.labels[k]}>
                <circle cx={x} cy={y} r="0.42" />
                <path d="M {x - 0.4} {y - 0.33} h 0.12 M {x - 0.34} {y - 0.39} v 0.12" />
              </g>
            {/if}
          {/each}
        </svg>
      </div>
    </div>
    <ul class="moods" aria-label="Moods">
      {#each labelsInOrder as l, j (l)}
        <li>
          <span class="city">City {l}</span>
          <svg class="glyph" viewBox="-1 -1 2 2" width="16" height="16" aria-hidden="true" focusable="false">
            {@render glyph(MOOD_SHAPE[moodsInOrder[j]!], 0, 0, 0.7)}
          </svg>
          <span data-out="mood" data-label={l} data-shape={MOOD_SHAPE[moodsInOrder[j]!]}>{moodsInOrder[j]}</span>
        </li>
      {/each}
    </ul>
    <p class="legend">
      Unhappy: a mutation would raise the city. Happy: a mutation would change nothing. Manic: a mutation would lower it.
    </p>
    <!-- SPEC 2.4(a) verbatim [D]; the i as inline MathML (A-12). It follows the outcome of SPEC 7.3's [U]
         check of native MathML in phase 3 (P3-A5): if one engine fails, HTML spans with an aria-label. -->
    <p class="line" data-out="bridgeSentence">The number on node <math><mi>i</mi></math> is the amount by which a mutation would lower city <math><mi>i</mi></math>.</p>
    <p class="line" data-out="limit">{limit ?? ''}</p>
    {#if panel !== null}
      <div class="end" data-out="endPanel">
        <p class="line" data-out="endName">{endSentence(panel)}</p>
        <p class="line">
          Moves: <span class="numeral" data-out="moveCount">{panel.moves}</span>{#if panel.simplyLaced}, beside
            <span data-out="hMinus2"><math><mi>h</mi><mo>−</mo><mn>2</mn></math> = <span class="numeral">{panel.h - 2}</span></span>{/if}.
        </p>
        <p class="line">
          Final numbers: <span class="numeral" data-out="finalNumbers">{panel.finalNumbers.map(display).join(', ')}</span>.
        </p>
        <p class="line">
          Marked cities, whose final number is positive: <span class="numeral" data-out="marked">{panel.marked.join(', ')}</span>.
        </p>
        {#if caption212 !== null && panel.returnCounts !== null}
          <p class="line" data-out="affineCaption">
            Join a new city to city {caption212.cities}. It sends <math><msub><mi>a</mi><mi>j</mi></msub></math> roads to each marked city
            <math><mi>j</mi></math> ({caption212.sends}) and receives <math><msub><mi>b</mi><mi>j</mi></msub></math> roads back ({caption212.receives}).{#if caption212.equal}
              On a simply laced board the two counts are equal.{/if} The board with the new city is an affine board{#if affineBoardName !== null}, <span
                data-out="affineBoard">{affineBoardName}</span
              >{/if}.
          </p>
          <p class="line">
            Roads back from each city to the new city: <span class="numeral" data-out="returnCounts">{panel.returnCounts.join(', ')}</span>.
          </p>
        {/if}
        {#if affineBoardName !== null}
          <!-- Phase 2 (P2-A7): M3's "add the city" opens T4 with the affine board. -->
          <a class="control" data-control="openLab" href="{import.meta.env.BASE_URL}tools/lab/">add the city</a>
        {/if}
      </div>
    {/if}
    <History
      total={cur().moves.length}
      cursor={cur().cursor}
      {positionNames}
      hydrated={api.hydrated}
      {frozen}
      onUndo={() => undo(api.announce)}
      onRedo={() => redo(api.announce)}
      onReset={() => reset(api.announce)}
      onScrub={(to) => scrub(to, api.announce)}
    />
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  <button type="button" class="control" data-control="step" disabled={!api.hydrated || frozen || atEnd} onclick={() => step(api.announce)}>Step</button>
  <button type="button" class="control" data-control="playToEnd" disabled={!api.hydrated || frozen || atEnd} onclick={() => playToEnd(api.announce)}
    >{playControl(anyBoard) === 'play on' ? 'Play on' : 'Play to the end'}</button
  >
  <label class="setting">
    <span>Start city</span>
    <select data-control="startCity" disabled={!api.hydrated || frozen} onchange={(e) => pickStart(Number((e.currentTarget as HTMLSelectElement).value), api.announce)}>
      {#if startCity === null}
        <option value="" selected disabled>other start</option>
      {/if}
      {#each labelsInOrder as l (l)}
        <option value={l} selected={startCity === l}>{l}</option>
      {/each}
    </select>
  </label>
  <label class="setting">
    <span>Board</span>
    <select data-control="picker" disabled={!api.hydrated || frozen} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value, api.announce)}>
      {#if !groups.some((g) => g.names.includes(title))}
        <option value="" selected disabled>{title}</option>
      {/if}
      {#each groups as g (g.letter)}
        <optgroup label="Type {g.letter}" data-letter={g.letter}>
          {#each g.names as name (name)}
            <option value={name} selected={title === name}>{name}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </label>
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values">
    <caption>Cities of {title} after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
    <thead>
      <tr>
        <th scope="col">City</th>
        <th scope="col">Population</th>
        <th scope="col">Number</th>
        <th scope="col">Mood</th>
      </tr>
    </thead>
    <tbody>
      {#each labelsInOrder as l, j (l)}
        <tr data-row={l}>
          <th scope="row">
            <button
              type="button"
              class="cell"
              data-table-node={l}
              disabled={!api.hydrated || frozen}
              aria-label="Mutate city {l}, population {spokenValue(popsInOrder[j]!)}, {MOOD_STATE[moodsInOrder[j]!]}"
              onclick={() => act(anyBoard.labels.indexOf(l), api.announce)}>City {l}</button
            >
          </th>
          <td class="numeral" data-table-value="population">{display(popsInOrder[j]!)}</td>
          <td class="numeral" data-table-value="number">{display(numsInOrder[j]!)}</td>
          <td>{moodsInOrder[j]}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if panel !== null}
    <table class="values">
      <caption>The end of the game</caption>
      <tbody>
        <tr><th scope="row">Population</th><td class="numeral">{panel.end.map(display).join(', ')}</td></tr>
        <tr><th scope="row">Name</th><td>{panel.name ?? 'none'}</td></tr>
        <tr><th scope="row">Moves</th><td class="numeral">{panel.moves}</td></tr>
        <tr><th scope="row">Coxeter number</th><td class="numeral">{panel.h}</td></tr>
        <tr><th scope="row">Final numbers</th><td class="numeral">{panel.finalNumbers.map(display).join(', ')}</td></tr>
        <tr><th scope="row">Marked cities</th><td class="numeral">{panel.marked.join(', ')}</td></tr>
        {#if panel.returnCounts !== null}
          <tr><th scope="row">Roads back to the new city</th><td class="numeral">{panel.returnCounts.join(', ')}</td></tr>
        {/if}
      </tbody>
    </table>
  {/if}
{/snippet}

<ToolFrame
  toolId="kostant"
  {instanceId}
  title="Kostant's Game"
  {caption}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  derivedForExport={exportData}
  onPopState={(s, n) => loadLink(s, n)}
  {figure}
  {controls}
  {table}
/>

<style>
  .t09 {
    display: grid;
    gap: 8px;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .board-host {
    position: relative;
  }
  /* The same box as Board.svelte's .board (SPEC 6.1 size rule), so the glyphs sit on the cities. */
  .overlay {
    --u: min(64px, (100cqw - 16px) / var(--k));
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    box-sizing: content-box;
    width: calc(var(--k) * var(--u));
    height: calc(var(--rows) * var(--u));
    padding: 8px;
    margin-inline: auto;
    pointer-events: none;
  }
  @supports (width: round(down, 10.5px, 1px)) {
    .overlay {
      --u: min(64px, round(down, (100cqw - 16px) / var(--k), 1px));
    }
  }
  .overlay svg {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    overflow: visible;
  }
  .overlay path,
  .glyph path {
    fill: none;
    stroke: var(--text);
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .mark circle {
    fill: none;
    stroke: var(--text);
    stroke-width: 1.5px;
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
  }
  .moods {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0;
    padding: 0 8px;
    list-style: none;
  }
  .moods li {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .legend {
    margin: 0;
    font-size: 0.9em;
  }
  .end {
    display: grid;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--text);
    border-radius: 6px;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
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
    margin-bottom: 8px;
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
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
</style>
