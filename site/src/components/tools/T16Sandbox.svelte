<script module lang="ts">
  // T16, the Sandbox (P2-A5; SPEC 4 T16, 4.0, 4 T1, 4 T4, 5.1 E-2, E-7, E-9, E-11, 5.6, 6.6, 7.4 to 7.6).
  // "The editor of T4 with both games in free play and integers of any size. No verdicts beyond those
  // of T4. Import and export of boards as JSON." The island owns the state object of 6.6 for tool
  // 'sandbox' and composes, inside one ToolFrame: T1's game (t01/model.ts T1Game, drawn with Board,
  // Bridge and History exactly as T01GameBoard draws them, in free play only), the shared BoardEditor
  // (P2-A3's contract, editor/types.ts), the verdict of T4 (t04/verdict.ts buildVerdict, T16Verdict),
  // and the JSON import and export of boards (T16BoardIO). T01GameBoard itself is not nested: it
  // renders its own ToolFrame with data-tool="board" and reads links as tool 'board', and two frames
  // in one tool would double the root, the live region and the noscript line (T9 and T15 made the
  // same choice; recorded as a deviation in decisions/P2-A5.md).
  //
  // Arithmetic (E-2): every board the editor, an import or a custom link gives is resolved by
  // resolveBoard with Big; a named finite board (g=A3 from a module link) is SafeInt and T1Game moves
  // it to Big, silently, when a start or a move leaves the safe range (SPEC 4 T1).
  //
  // Properties (SPEC 4.0 Configuration; CONTRACTS 5.2), listed again at the top of
  // site/tests/unit/tools/T16.test.ts: id, board, coords, start, moves, linkTo (accepted, unused),
  // preset (only 'default'), caption, and T1's view and mode (mode may only be 'free'); the plan
  // property boardPresets (the test boards of classification_tests for the editor's picker, read
  // from the golden file at build time by components/board/editor/presets.ts). `prediction` and
  // `layers` do not apply to free play on a sandbox and are not accepted.
  import { toPopulation } from '@two-games/engine';
  import type { Board as EngineBoard } from '@two-games/engine';
  import { decodeState, LINK_NOTICE } from '../../lib/urlCodec';
  import { cloneState, defaultStart, resolveBoard, type BoardSpec, type ToolState } from '../../lib/state';
  import { exportJSON } from '../../lib/export';
  import { T1Game, boardForStart, effectiveView, startVector, type Coords, type View } from './t01/model';
  import { buildVerdict, type ComponentView } from './t04/verdict';

  /** The default board (plan): two cities joined by three roads each way, the board of bigint_test. */
  export const DEFAULT_BOARD: { cartan: number[][]; xy: [number, number][] } = {
    cartan: [
      [2, -3],
      [-3, 2],
    ],
    xy: [
      [0, 0],
      [1, 0],
    ],
  };

  export const DEFAULT_VIEW: View = 'populations';
  export const DEFAULT_COORDS: Coords = 'populations';

  /** The page-author properties that make the defaults of an instance (SPEC 6.6, CONTRACTS 5.2). */
  export interface SandboxConfig {
    board?: BoardSpec;
    view?: View;
    mode?: 'free' | 'legal' | 'raising';
    coords?: Coords;
    start?: (number | string)[];
    moves?: number[];
  }

  function copySpec(spec: BoardSpec): BoardSpec {
    if (typeof spec === 'string') return spec;
    const out: { cartan: number[][]; xy?: [number, number][] } = { cartan: spec.cartan.map((r) => [...r]) };
    if (spec.xy) out.xy = spec.xy.map((p) => [p[0], p[1]] as [number, number]);
    return out;
  }

  /**
   * The view drawn for a state (SPEC 4 T1): with a numbers start, the populations view needs an
   * integral C^{-1} a and falls back to linked; on a singular board only the numbers view is offered.
   * The state then reads the view drawn (plan), so a link written back says what is shown. Mode: free.
   */
  export function normaliseView(state: ToolState): ToolState {
    const out = cloneState(state);
    out.mode = 'free';
    const coords = out.coords ?? DEFAULT_COORDS;
    const view = out.view ?? DEFAULT_VIEW;
    if (coords !== 'numbers') {
      out.view = view;
      return out;
    }
    const board = resolveBoard(out.board);
    const start = out.start ?? defaultStart(board, coords);
    const b = boardForStart(board, start);
    const population = toPopulation(b as EngineBoard<unknown>, startVector(b, start));
    out.view = effectiveView(view, coords, population);
    return out;
  }

  /**
   * The defaults of an instance: the author's properties over the sandbox's default state (6.6: "A key
   * that is absent keeps the value the page author configured for that instance (on a tool's own
   * route: the tool's default)"). Throws, naming the instance, on a mode other than free.
   */
  export function sandboxDefaults(config: SandboxConfig = {}, instanceId = ''): ToolState {
    if (config.mode !== undefined && config.mode !== 'free') {
      throw new Error(`T16 instance "${instanceId || 'sandbox'}": the sandbox offers free play only, not ${config.mode} (SPEC 4 T16)`);
    }
    const board = copySpec(config.board ?? DEFAULT_BOARD);
    const coords = config.coords ?? DEFAULT_COORDS;
    const state: ToolState = {
      schema: 1,
      tool: 'sandbox',
      board,
      view: config.view ?? DEFAULT_VIEW,
      mode: 'free',
      coords,
      start: config.start ? [...config.start] : defaultStart(resolveBoard(board), coords),
      moves: config.moves ? [...config.moves] : [],
    };
    return normaliseView(state);
  }

  /**
   * Reads a link (SPEC 6.6) over the defaults through the codec. Every failure of the codec gives the
   * defaults with its notice. The sandbox offers free play only (SPEC 4 T16), so a link that names
   * another mode is a state the tool does not offer: the defaults, with the codec's sentence
   * LINK_NOTICE (case (b) of the plan, 5.2). The view is then normalised (normaliseView).
   */
  export function readLink(search: string, defaults: ToolState, prefix = ''): { state: ToolState; notice: string | null } {
    const r = decodeState(search, 'sandbox', defaults, { prefix });
    if (r.notice !== null) return { state: normaliseView(r.state), notice: r.notice };
    if ((r.state.mode ?? 'free') !== 'free') return { state: normaliseView(defaults), notice: LINK_NOTICE };
    try {
      return { state: normaliseView(r.state), notice: null };
    } catch {
      return { state: normaliseView(defaults), notice: LINK_NOTICE };
    }
  }

  /**
   * A new board (a preset, an edit that changes the matrix, an import, SPEC 4.0 Board pickers): the
   * start goes back to the default of 6.6 for the current coords on the new board and the moves are
   * emptied; the view is normalised for the new board.
   */
  export function withBoard(state: ToolState, spec: BoardSpec): ToolState {
    const board = resolveBoard(spec);
    const coords = state.coords ?? DEFAULT_COORDS;
    return normaliseView({ ...cloneState(state), board: copySpec(spec), coords, start: defaultStart(board, coords), moves: [] });
  }

  /** Which views the view control offers for a state (the rules of SPEC 4 T1, through normaliseView). */
  export function viewChoices(state: ToolState): Record<View, boolean> {
    const offered = (v: View): boolean => normaliseView({ ...state, view: v }).view === v;
    return { populations: offered('populations'), numbers: offered('numbers'), linked: offered('linked') };
  }

  /** The game of a state: T1's model in free play. */
  export function gameOf(state: ToolState): T1Game {
    return new T1Game({
      board: state.board,
      view: state.view ?? DEFAULT_VIEW,
      mode: 'free',
      coords: state.coords ?? DEFAULT_COORDS,
      start: state.start,
      moves: state.moves ?? [],
    });
  }

  /** The ToolState of the current point of a game, as the sandbox's (tool 'sandbox', mode free). */
  export function stateOf(game: T1Game): ToolState {
    return { ...game.state(), tool: 'sandbox', mode: 'free' };
  }

  /**
   * The derived tables of "Download data" (6.6): every position of the current play in label order
   * (T1's derived(): safe integers as numbers, longer ones as exact decimal text, fractions as p/q),
   * and the verdict records with nodes and bourbaki_order as labels.
   */
  export function derivedOf(game: T1Game, components: readonly ComponentView[]): Record<string, unknown> {
    return { ...game.derived(), verdict: components.map((c) => ({ ...c.record, verdict: c.classText })) };
  }

  /** The text "Download data" saves for a state (used by the tests; the island calls the same parts). */
  export function exportOf(state: ToolState): string {
    const game = gameOf(state);
    return exportJSON(stateOf(game), derivedOf(game, buildVerdict(resolveBoard(state.board)).components));
  }

  /** True when two specs have the same Cartan matrix (a move of a node changes only `xy`). */
  export function sameMatrix(a: BoardSpec, b: BoardSpec): boolean {
    if (typeof a === 'string' || typeof b === 'string') return a === b;
    return JSON.stringify(a.cartan) === JSON.stringify(b.cartan);
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import type { AnyBoard } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import { historyNames } from '../board/historyNames';
  import BoardEditor from '../board/BoardEditor.svelte';
  import Frac from '../math/Frac.svelte';
  import Bridge from './t01/Bridge.svelte';
  import T16Verdict from './T16Verdict.svelte';
  import T16BoardIO from './T16BoardIO.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { namedPresets } from '../board/editor/namedPresets';
  import type { EditorChange, EditorPreset } from '../board/editor/types';
  import { exampleLoaded } from '../../lib/history';
  import { POPULATIONS_ICON, NUMBERS_ICON } from '../draw/palette';
  import type { NodeState } from '../../lib/a11y';
  import { MODE_TEXT, inLabelOrder, type Shown } from './t01/model';
  import { moveSentence, spokenValue, undoSentence } from './t01/announce';
  import { isLong } from './t01/longNumber';

  interface Props {
    id?: string;
    board?: BoardSpec;
    view?: View;
    mode?: 'free' | 'legal' | 'raising';
    coords?: Coords;
    start?: (number | string)[];
    moves?: number[];
    linkTo?: string;
    preset?: string;
    caption?: string;
    /** Plan: the test boards of classification_tests for the editor's picker (testBoardPresets()). */
    boardPresets?: EditorPreset[];
  }

  let {
    id = '',
    board: boardProp,
    view: viewProp,
    mode: modeProp,
    coords: coordsProp,
    start: startProp,
    moves: movesProp,
    caption = 'Two cities joined by three roads each way: both games in free play, with exact integers of any size.',
    boardPresets = [],
  }: Props = $props();

  // The author's configuration is read once; the reader's moves, edits and the URL change it afterwards.
  const instanceId = untrack(() => id);
  const defaults: ToolState = untrack(() => {
    const c: SandboxConfig = {};
    if (boardProp !== undefined) c.board = boardProp;
    if (viewProp !== undefined) c.view = viewProp;
    if (modeProp !== undefined) c.mode = modeProp;
    if (coordsProp !== undefined) c.coords = coordsProp;
    if (startProp !== undefined) c.start = startProp;
    if (movesProp !== undefined) c.moves = movesProp;
    return sandboxDefaults(c, instanceId);
  });
  const pickerEntries: EditorPreset[] = untrack(() => [...namedPresets(), ...boardPresets.filter((p) => p.group === 'test')]);

  let game = $state.raw(gameOf(defaults));
  // The board spec in force, replaced only when the board changes, so that the verdict (one classify
  // call per board object, 5.6, E-11) is computed once per board load and never on a move.
  let spec = $state.raw<BoardSpec>(defaults.board);
  let version = $state(0);
  let notice = $state<string | null>(null);

  const touch = (): void => {
    version++;
  };
  /** The game, read so that a derived value depends on `version` (the model is a mutable class). */
  function cur(): T1Game {
    void version;
    return game;
  }

  const verdictBoard: AnyBoard = $derived(resolveBoard(spec));
  const verdict = $derived(buildVerdict(verdictBoard));
  const view$ = $derived(cur().view);
  const shown: Shown = $derived(cur().shown);
  const canAct = $derived(cur().canAct());
  const toolState = $derived(stateOf(cur()));
  const choices = $derived(viewChoices(toolState));
  const anyBoard: AnyBoard = $derived(cur().board);
  const title = $derived(typeof spec === 'string' ? spec : `custom board with ${verdictBoard.n} ${verdictBoard.n === 1 ? 'node' : 'nodes'}`);
  const xy = $derived(typeof spec === 'string' ? undefined : spec.xy);
  const spokenPops = $derived(shown.populations?.map(spokenValue));
  const spokenNums = $derived(shown.numbers.map(spokenValue));
  // A-3 on the populations board: from the sign of the number, what a mutation would do (2.4(a)).
  const popStates = $derived(
    shown.numbers.map((a): NodeState => (a.startsWith('-') ? 'mutation would raise it' : /^0+$/.test(a) ? 'mutation would change nothing' : 'mutation would lower it')),
  );
  const numStates = $derived(canAct.map((c): NodeState => (c ? 'can be fired' : 'cannot be fired')));

  /** Exact digits in the tooltip for long values (4.0 Long numbers). */
  const tooltip = (values: readonly string[]) => (k: number): string | null => (values[k]!.split('/').some(isLong) ? values[k]! : null);

  const figureLabel = $derived.by(() => {
    const parts: string[] = [];
    const inOrder = (v: readonly string[]): string => inLabelOrder(anyBoard, v).map(spokenValue).join(', ');
    if (shown.populations !== null) parts.push(`populations ${inOrder(shown.populations)}`);
    if (view$ !== 'populations') parts.push(`numbers ${inOrder(shown.numbers)}`);
    return `Sandbox on ${title}, ${view$} view, ${MODE_TEXT.free}: ${parts.join('; ')}.`;
  });

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a preset, an edit, an import, a view change)
  // ------------------------------------------------------------------------------------------

  function load(s: ToolState): void {
    const next = gameOf(s);
    game = next;
    if (JSON.stringify(s.board) !== JSON.stringify(spec)) spec = s.board;
    touch();
  }

  // Hydration: read the URL once with the instance prefix (6.6).
  $effect(() => {
    untrack(() => {
      try {
        const { state: decoded, notice: n } = readLink(window.location.search, defaults, instanceId);
        notice = n;
        if (JSON.stringify(decoded) !== JSON.stringify(stateOf(game))) load(decoded);
      } catch {
        // readLink never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  function changeBoard(next: BoardSpec, resetsPlay: boolean): void {
    notice = null;
    const s = stateOf(game);
    if (!resetsPlay && sameMatrix(next, s.board)) {
      // Only the layout changed (a node moved): the board is the same, the play stays.
      load({ ...s, board: next });
      return;
    }
    load(withBoard(s, next));
  }

  function onEdit(next: BoardSpec, change: EditorChange): void {
    // A preset, an added or removed node, and a change of roads change the board: start and moves go
    // back to the defaults (4.0 Board pickers); moving a node changes only the layout.
    changeBoard(next, change.resetsPlay || !sameMatrix(next, spec));
    if (change.kind === 'preset') exampleLoaded(instanceId, stateOf(game));
  }

  function onImport(next: BoardSpec): void {
    changeBoard(next, true);
  }

  function pickView(v: View): void {
    if (!choices[v]) return;
    load(normaliseView({ ...stateOf(game), view: v }));
  }

  /** Plan: start one of the two games again from its default start of 6.6 on the current board. */
  function restart(coords: Coords): void {
    const s = stateOf(game);
    const b = resolveBoard(s.board);
    const view: View = coords === 'numbers' ? (s.view === 'populations' ? 'numbers' : s.view ?? 'numbers') : s.view === 'numbers' ? 'populations' : s.view ?? 'populations';
    notice = null;
    load(normaliseView({ ...s, coords, start: defaultStart(b, coords), moves: [], view }));
  }

  // ------------------------------------------------------------------------------------------
  // Moves (free play: every node can be acted on, SPEC 2.3, A-3)
  // ------------------------------------------------------------------------------------------

  function act(position: number, announce: (t: string) => void): void {
    const before = game.shown;
    const r = game.act(position);
    if (r.kind === 'refused') return;
    touch();
    announce(moveSentence(game.view, game.labels, r.label, before, game.shown, game.cursor));
  }

  function arrive(to: number, from: number, announce: (t: string) => void): void {
    if (to < from) announce(undoSentence(game.view, game.labels, to + 1, game.shownAt(to)));
    else if (to > from) announce(moveSentence(game.view, game.labels, game.moves[to - 1]!, game.shownAt(to - 1), game.shownAt(to), to));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    const from = game.cursor;
    if (!game.scrub(to)) return;
    touch();
    arrive(to, from, announce);
  }

  const undo = (announce: (t: string) => void): void => scrub(game.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(game.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    const from = game.cursor;
    if (!game.reset()) return;
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

  // Only the names History reads: a move names at most 50 positions however long the play (7.4).
  const positionNames = $derived.by(() => {
    const g = cur();
    return historyNames(g.moves.length, g.cursor, (k) => {
      const s = g.shownAt(k);
      const pops = s.populations !== null && g.view === 'populations';
      const v = pops ? s.populations! : s.numbers;
      return `${k === 0 ? 'Start' : `After move ${k}`}: ${pops ? 'populations' : 'numbers'} ${inLabelOrder(g.board, v).map(spokenValue).join(', ')}`;
    });
  });

  const labelsInOrder = $derived([...cur().labels].sort((a, b) => a - b));
  const tableRows = $derived.by(() => {
    const rows: { board: 'populations' | 'numbers'; heading: string; values: string[] }[] = [];
    if (shown.populations !== null) rows.push({ board: 'populations', heading: 'Populations', values: inLabelOrder(anyBoard, shown.populations) });
    if (view$ !== 'populations') rows.push({ board: 'numbers', heading: 'Numbers', values: inLabelOrder(anyBoard, shown.numbers) });
    return rows;
  });

  const VIEWS: readonly View[] = ['populations', 'numbers', 'linked'];
  const VIEW_TEXT: Record<View, string> = { populations: 'Populations', numbers: 'Numbers', linked: 'Linked' };
</script>

{#snippet icon(i: typeof POPULATIONS_ICON)}
  <svg class="icon" viewBox={i.viewBox} width="16" height="16" aria-hidden="true" focusable="false"><path d={i.d} stroke={i.stroke} fill={i.fill} /></svg>
{/snippet}

{#snippet figure(api: FrameApi)}
  <div class="t16" data-view={view$} data-mode="free">
    <T16Verdict {spec} components={verdict.components} />
    <p class="line mode" data-out="mode">{MODE_TEXT.free}</p>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="game" data-game="" onkeydown={(e) => onKeydown(e, api.announce)}>
      {#if shown.populations !== null}
        <div class="panel populations" data-panel-board="populations">
          <p class="panel-title">{@render icon(POPULATIONS_ICON)} Populations</p>
          <Board
            board={anyBoard}
            {xy}
            values={shown.populations}
            game="mutation"
            {canAct}
            name="Populations board on {title}"
            states={popStates}
            spoken={spokenPops}
            hintFor={tooltip(shown.populations)}
            onAct={(k) => act(k, api.announce)}
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
            name="Numbers board on {title}"
            states={numStates}
            spoken={spokenNums}
            hintFor={tooltip(shown.numbers)}
            onAct={(k) => act(k, api.announce)}
          />
        </div>
      {/if}
      <History
        total={cur().moves.length}
        cursor={cur().cursor}
        {positionNames}
        hydrated={api.hydrated}
        onUndo={() => undo(api.announce)}
        onRedo={() => redo(api.announce)}
        onReset={() => reset(api.announce)}
        onScrub={(to) => scrub(to, api.announce)}
      />
    </div>
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  <fieldset class="views" data-control-group="view">
    <legend>View</legend>
    {#each VIEWS as v (v)}
      <label class="choice">
        <input
          type="radio"
          name="{instanceId || 'sandbox'}-view"
          value={v}
          data-control="view"
          checked={view$ === v}
          disabled={!api.hydrated || !choices[v]}
          onchange={() => pickView(v)}
        />
        <span>{VIEW_TEXT[v]}</span>
      </label>
    {/each}
  </fieldset>
  <div class="restart">
    <button type="button" class="control" data-control="restartPopulations" disabled={!api.hydrated} onclick={() => restart('populations')}
      >Mutation game from one Martian</button
    >
    <button type="button" class="control" data-control="restartNumbers" disabled={!api.hydrated} onclick={() => restart('numbers')}
      >Numbers game from all ones</button
    >
  </div>
  <section class="wide" aria-label="Board editor" data-sandbox-editor="">
    <p class="section-title">Edit the board</p>
    <BoardEditor value={spec} onChange={onEdit} name="Board editor" disabled={!api.hydrated} presets={pickerEntries} />
  </section>
  <div class="wide">
    <T16BoardIO {spec} disabled={!api.hydrated} {onImport} />
  </div>
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values">
    <caption>Values on {title}, after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}, exact</caption>
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
                data-value={row.values[k]}
                disabled={!api.hydrated}
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
  toolId="sandbox"
  {instanceId}
  title="Sandbox"
  {caption}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  boardName={typeof spec === 'string' ? spec : 'custom board'}
  derivedForExport={() => derivedOf(game, verdict.components)}
  onPopState={(s, n) => {
    const r = n === null && (s.mode ?? 'free') !== 'free' ? { state: normaliseView(defaults), notice: LINK_NOTICE } : { state: normaliseView(s), notice: n };
    load(r.state);
    notice = r.notice;
  }}
  {figure}
  {controls}
  {table}
/>

<style>
  .t16,
  .game {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .mode {
    font-style: italic;
  }
  /* The accents mark the panels' borders and icons, never text or a node's fill (8.3), as T1 draws them. */
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
  .views {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .views legend {
    float: left;
    margin-inline-end: 8px;
    padding: 0;
  }
  .choice {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    cursor: pointer;
  }
  .choice input {
    width: 24px;
    height: 24px;
    margin: 0;
  }
  .restart {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .wide {
    flex: 1 1 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--sign-zero-outline);
  }
  .section-title {
    margin: 0;
    font-weight: bold;
  }
  .control {
    min-width: 44px;
    min-height: 44px;
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
  .choice input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
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
    max-width: 22em;
    font: inherit;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    overflow-wrap: anywhere;
  }
</style>
