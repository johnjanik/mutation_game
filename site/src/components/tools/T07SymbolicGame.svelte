<script module lang="ts">
  // T7, the Symbolic Game (SPEC.md 4 T7; 2.7 F4 to F6; 2.4 (b); 4.0; 6.6; 7.3 to 7.6; Appendix A.1, A.2).
  // Two boards side by side: on the left the numbers game in legal play from an all-positive start (all
  // ones by default); on the right the same moves played from the letters x_1, ..., x_n, every entry a
  // linear form. Each form fired is matched in a side table with a positive root of the REVERSED board
  // (the transposed Cartan matrix, 2.4 (b)), and a complete game uses every row once (F6).
  //
  // The left board is T1's model (t01/model.ts, T1Game in the numbers view, legal mode, numbers
  // coordinates): one list of positions extended by one engine call per move (7.4), lowest position
  // first for step and play to the end (E-5), and the silent switch to Big when a start or a play leaves
  // the safe range (SPEC 4 T1). The right board and the table are recomputed from the move list after
  // every change by the engine alone (symbolicPlay, applyWord on unit starts, positiveRoots of
  // transposeBoard); nothing here does arithmetic on a form. Positions inside, labels outside (E-7).
  //
  // The pure helpers of this block are exported for site/tests/unit/tools/T07.test.ts.
  import { applyWord, positiveRoots, symbolicPlay, toPositions, transposeBoard } from '@two-games/engine';
  import type { AnyBoard, Board as EngineBoard, Word } from '@two-games/engine';
  import { cloneState, firstForbiddenMove, resolveBoard, type BoardSpec, type ToolState } from '../../lib/state';
  import { LINK_NOTICE, decodeState } from '../../lib/urlCodec';
  import { PICKER_NAMES, T1Game, exportValue, inLabelOrder } from './t01/model';

  /** The boards T7 offers: the 32 named types (4.0 Board pickers), grouped by letter in the picker. */
  export const T07_BOARDS: readonly string[] = PICKER_NAMES;

  /** The default board (plan): A3, the board of M5 beat 5, the first use of the tool. */
  export const T07_DEFAULT_BOARD = 'A3';

  /** The default caption (P1, 4.0 Starts meaningful): it states the result the figure shows. */
  export const T07_CAPTION =
    'Play the numbers game on the left. The right board makes the same moves with letters in place of numbers, so every number fired is a linear form. Over a complete game each positive root of the reversed board is fired exactly once.';

  /** The heading of the side table (plan wording). */
  export const ROOT_TABLE_HEADING = 'Positive roots of the reversed board';

  /** The marker of a row not fired yet (A-5: by text as well as by style). */
  export const NOT_FIRED = 'not yet fired';

  /** The start of SPEC 4 T7 by default: all ones, in label order. */
  export function onesStart(board: AnyBoard): number[] {
    return Array.from({ length: board.n }, () => 1);
  }

  /** The state of T7 (6.6): coords is always numbers; view and mode are fixed by the tool and never written. */
  export function t07State(board: BoardSpec, start: readonly (number | string)[], moves: readonly number[]): ToolState {
    return { schema: 1, tool: 'symbolic', board: typeof board === 'string' ? board : { cartan: board.cartan.map((r) => [...r]) }, coords: 'numbers', start: [...start], moves: [...moves] };
  }

  /** The left board's game for a state: T1's model in the numbers view and legal mode. */
  export function leftGame(state: ToolState): T1Game {
    const config: ConstructorParameters<typeof T1Game>[0] = { board: state.board, view: 'numbers', mode: 'legal', coords: 'numbers' };
    if (state.start !== undefined) config.start = state.start;
    if (state.moves !== undefined) config.moves = state.moves;
    return new T1Game(config);
  }

  function positiveInteger(x: number | string): boolean {
    const t = String(x);
    return /^\d+$/.test(t) && /[1-9]/.test(t);
  }

  /**
   * Why a state is not a state of T7, or null when it is (6.6 plus the plan's two rules): a board the
   * tool does not offer; coords other than numbers; a start of the wrong length or with an entry that is
   * not a positive integer (T7 starts "with all numbers positive"); a move that legal play forbids.
   */
  export function stateProblem(state: ToolState): string | null {
    if (typeof state.board !== 'string' || !T07_BOARDS.includes(state.board)) return 'the tool does not offer this board';
    if (state.coords !== 'numbers') return 'the start must be numbers';
    const board = resolveBoard(state.board);
    const start = state.start ?? onesStart(board);
    if (start.length !== board.n) return 'the start has the wrong length';
    if (!start.every(positiveInteger)) return 'every number of the start must be positive';
    if (firstForbiddenMove(board, { ...state, start, mode: 'legal' }) !== null) return 'a move that legal play forbids';
    return null;
  }

  /**
   * Reads one instance's state from a query string: decodeState with the instance prefix (CONTRACTS 5.2),
   * then the rules of stateProblem; any failure gives the defaults and the codec's notice.
   */
  export function readLink(search: string, defaults: ToolState, prefix: string): { state: ToolState; notice: string | null } {
    const r = decodeState(search, 'symbolic', defaults, { prefix });
    if (r.notice !== null) return r;
    if (stateProblem(r.state) !== null) return { state: cloneState(defaults), notice: LINK_NOTICE };
    return r;
  }

  /** The unit start e_k of the numbers game, in the board's arithmetic. */
  function unit<T>(board: EngineBoard<T>, k: number): T[] {
    return Array.from({ length: board.n }, (_, j) => (j === k ? board.arith.one : board.arith.zero));
  }

  /**
   * The current entries of the right board after `word` (positions): entry j is the vector of the j-th
   * entries of applyWord(board, e_k, word, 'firing') for k = 0..n-1, the numbers game played from each
   * unit start by the engine (linearity of firing; no arithmetic here). Indexed [node][variable], both
   * by position.
   */
  export function symbolicEntries(board: AnyBoard, word: Word): number[][] {
    const b = board as EngineBoard<unknown>;
    const columns = Array.from({ length: b.n }, (_, k) => applyWord(b, unit(b, k), word, 'firing'));
    return Array.from({ length: b.n }, (_, j) => columns.map((col) => Number(b.arith.toBig(col[j]))));
  }

  /** 1 when every coefficient is at least 0 and one is positive, -1 for the mirror case, 0 otherwise. */
  export function entrySign(coeffs: readonly number[]): -1 | 0 | 1 {
    const pos = coeffs.some((c) => c > 0);
    const neg = coeffs.some((c) => c < 0);
    if (pos && !neg) return 1;
    if (neg && !pos) return -1;
    return 0;
  }

  /** The rows of the side table: positiveRoots(transposeBoard(board)), in the engine's order, by position. */
  export function reversedRoots(board: AnyBoard): number[][] {
    const t = transposeBoard(board) as EngineBoard<unknown>;
    return positiveRoots(t).map((r) => r.map((x) => Number(t.arith.toBig(x))));
  }

  export interface RootRow {
    /** The population, by position. */
    root: number[];
    /** The index of the move that fired it (0-based), or null. */
    move: number | null;
  }

  /** Matches each fired form (by position) with the row holding the same vector; a row is used at most once. */
  export function matchRows(roots: readonly (readonly number[])[], fired: readonly (readonly number[])[]): RootRow[] {
    const key = (v: readonly number[]): string => v.join(',');
    const index = new Map(roots.map((r, k) => [key(r), k]));
    const rows: RootRow[] = roots.map((r) => ({ root: [...r], move: null }));
    fired.forEach((f, m) => {
      const k = index.get(key(f));
      if (k !== undefined && rows[k]!.move === null) rows[k]!.move = m;
    });
    return rows;
  }

  export interface SymbolicView {
    word: number[];
    fired: number[][];
    entries: number[][];
    rows: RootRow[];
  }

  /**
   * Everything T7 recomputes after a change of the move list (labels): the fired forms (symbolicPlay),
   * the current entries (n unit-start plays), and the table (positiveRoots of the transposed board,
   * matched). `roots` may be passed when already known for the board.
   */
  export function symbolicView(board: AnyBoard, moves: readonly number[], roots?: readonly (readonly number[])[]): SymbolicView {
    const word = toPositions(board, moves);
    const fired = symbolicPlay(board, word);
    const entries = symbolicEntries(board, word);
    const rows = matchRows(roots ?? reversedRoots(board), fired);
    return { word, fired, entries, rows };
  }

  /** A vector by position as integers in label order, joined by commas (the hooks data-root, data-form, data-value). */
  export function labelText(board: AnyBoard, v: readonly number[]): string {
    return inLabelOrder(board, v).join(',');
  }

  /** The derived tables of "Download data" (6.6): integers as JSON numbers when safe, else decimal strings. */
  export function t07Derived(game: T1Game, view: SymbolicView): Record<string, unknown> {
    const board = game.board;
    const positions = [];
    for (let k = 0; k <= game.cursor; k++) positions.push({ move: k, numbers: inLabelOrder(board, game.shownAt(k).numbers).map(exportValue) });
    const labels = [...board.labels].sort((a, b) => a - b);
    const fired = view.fired.map((f, k) => {
      const node = board.labels[view.word[k]!]!;
      return { move: k + 1, node, number: exportValue(game.shownAt(k).numbers[view.word[k]!]!), form: inLabelOrder(board, f) };
    });
    const rows = view.rows.map((r) => ({ root: inLabelOrder(board, r.root), used: r.move !== null, move: r.move === null ? null : r.move + 1 }));
    return { view: 'numbers', mode: 'legal', labels, positions, fired, roots: rows };
  }
</script>

<script lang="ts">
  // Properties (CONTRACTS 5.2; the list is repeated in site/tests/e2e/T07.spec.ts):
  //   id, board, coords (numbers only), start, moves, caption, preset ('default' only), prediction,
  //   linkTo and layers (accepted and ignored: no figure links T7, and T7 grows no set).
  import { untrack } from 'svelte';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import Predict from '../board/Predict.svelte';
  import LinearForm, { formSpoken } from '../math/LinearForm.svelte';
  import T07SymbolicBoard from './T07SymbolicBoard.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { PICKER_GROUPS } from './t01/model';
  import { gameOverSentence, moveSentence, playSentence, refusalSentence, spokenValue, undoSentence } from './t01/announce';
  import { isLong, shortValue } from './t01/longNumber';
  import { POPULATIONS_ICON, NUMBERS_ICON } from '../draw/palette';
  import type { NodeState } from '../../lib/a11y';
  import type { Prediction } from '../../tools/types';

  interface Props {
    id?: string;
    board?: BoardSpec;
    coords?: 'populations' | 'numbers';
    start?: (number | string)[];
    moves?: number[];
    caption?: string;
    preset?: string;
    linkTo?: string;
    layers?: number;
    prediction?: Prediction;
  }

  let { id = '', board: boardProp = T07_DEFAULT_BOARD, coords: coordsProp, start: startProp, moves: movesProp, caption = T07_CAPTION, prediction }: Props = $props();

  const instanceId = untrack(() => id);
  const defaults: ToolState = untrack(() => {
    const b = resolveBoard(boardProp);
    return t07State(boardProp, startProp ?? onesStart(b), movesProp ?? []);
  });
  // Authoring errors fail the build with a message naming the instance (as T1 does).
  untrack(() => {
    if (coordsProp !== undefined && coordsProp !== 'numbers') throw new Error(`T7 instance "${instanceId || 'symbolic'}": coords must be numbers`);
    const problem = stateProblem(defaults);
    if (problem !== null) throw new Error(`T7 instance "${instanceId || 'symbolic'}": ${problem}`);
  });

  let game = $state.raw(leftGame(defaults));
  let version = $state(0);
  let notice = $state<string | null>(null);
  let predictionResolved = $state(untrack(() => prediction === undefined));

  const touch = (): void => {
    version++;
  };
  function cur(): T1Game {
    void version;
    return game;
  }

  /** The named board of the symbolic side: SafeInt, whatever the left board's arithmetic (forms do not depend on the start). */
  const symBoard = $derived(resolveBoard(game.spec));
  const roots = $derived(reversedRoots(symBoard));
  const sym = $derived(symbolicView(symBoard, cur().applied, roots));
  const frozen = $derived(!predictionResolved);
  const title = $derived(typeof game.spec === 'string' ? game.spec : 'custom board');
  const shownNumbers = $derived(cur().shown.numbers);
  const canAct = $derived(frozen ? cur().labels.map(() => false) : cur().canAct());
  const numStates = $derived(canAct.map((c): NodeState => (c ? 'can be fired' : 'cannot be fired')));
  const spokenNums = $derived(shownNumbers.map(spokenValue));
  const signs = $derived(sym.entries.map(entrySign));
  const toolState = $derived.by(() => {
    const g = cur();
    return t07State(g.spec, g.start, g.applied);
  });
  const gameOver = $derived(cur().gameOver);
  const gameOverText = $derived(gameOver ? `Game over after ${cur().cursor} ${cur().cursor === 1 ? 'move' : 'moves'}.` : '');
  const atEnd = $derived(cur().stepPosition() === null);
  const labelsInOrder = $derived([...game.labels].sort((a, b) => a - b));
  const byLabel = $derived(toPositions(game.board, labelsInOrder));
  /** The number fired on the left at move k (0-based), read from the left board's play, never from the form. */
  const firedNumbers = $derived.by(() => {
    const g = cur();
    return sym.word.map((p, k) => g.shownAt(k).numbers[p]!);
  });

  const tooltip = (values: readonly string[]) => (k: number): string | null => (isLong(values[k]!) ? values[k]! : null);

  const figureLabel = $derived(
    `Symbolic Game on ${title}: numbers ${inLabelOrder(game.board, shownNumbers).map(spokenValue).join(', ')}; forms ${byLabel
      .map((p) => formSpoken(sym.entries[p]!, symBoard.labels))
      .join(', ')}.`,
  );

  function load(s: ToolState): void {
    game = leftGame(s);
    touch();
  }

  // Hydration: read the URL once with the instance prefix (6.6, CONTRACTS 5.2); a notice is shown.
  $effect(() => {
    untrack(() => {
      try {
        const { state: decoded, notice: n } = readLink(window.location.search, defaults, instanceId);
        if (n !== null) notice = n;
        if (n === null && JSON.stringify(decoded) !== JSON.stringify(defaults)) load(decoded);
      } catch {
        // readLink never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  function afterMove(announce: (t: string) => void, sentence: string, withGameOver = true): void {
    announce(withGameOver && game.gameOver ? `${sentence} ${gameOverSentence(game.cursor)}` : sentence);
  }

  function act(position: number, announce: (t: string) => void): void {
    if (frozen) return;
    const before = game.shown;
    const r = game.act(position);
    if (r.kind === 'refused') {
      announce(refusalSentence('legal', r.label, r.number));
      return;
    }
    touch();
    afterMove(announce, moveSentence('numbers', game.labels, r.label, before, game.shown, game.cursor));
  }

  function step(announce: (t: string) => void): void {
    if (frozen) return;
    const k = game.stepPosition();
    if (k === null) {
      if (game.gameOver) announce(gameOverSentence(game.cursor));
      return;
    }
    act(k, announce);
  }

  function playToEnd(announce: (t: string) => void): void {
    if (frozen || game.stepPosition() === null) return;
    // Every offered board is finite: at most N <= 120 moves, on the main thread (E-9).
    const outcome = game.playToEnd();
    touch();
    afterMove(announce, playSentence('numbers', 'legal', game.labels, outcome.moves, outcome.status, game.shown), false);
  }

  function arrive(to: number, from: number, announce: (t: string) => void): void {
    if (to < from) announce(undoSentence('numbers', game.labels, to + 1, game.shownAt(to)));
    else if (to > from) announce(moveSentence('numbers', game.labels, game.moves[to - 1]!, game.shownAt(to - 1), game.shownAt(to), to));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen) return;
    const from = game.cursor;
    if (!game.scrub(to)) return;
    touch();
    arrive(to, from, announce);
  }

  const undo = (announce: (t: string) => void): void => scrub(game.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(game.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    if (frozen) return;
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

  function pickBoard(name: string): void {
    if (!T07_BOARDS.includes(name)) return;
    notice = null;
    load(t07State(name, onesStart(resolveBoard(name)), []));
  }

  const positionNames = $derived.by(() => {
    const g = cur();
    const out: string[] = [];
    for (let k = 0; k <= g.moves.length; k++) {
      out.push(`${k === 0 ? 'Start' : `After move ${k}`}: numbers ${inLabelOrder(g.board, g.shownAt(k).numbers).map(spokenValue).join(', ')}`);
    }
    return out;
  });

  /** A signed value as text with the true minus sign, shortened above 12 digits (4.0 Long numbers). */
  const shown = (text: string): string => shortValue(text);
  const rootText = (v: readonly number[]): string => `(${inLabelOrder(symBoard, v).join(', ')})`;
</script>

{#snippet icon(i: typeof POPULATIONS_ICON)}
  <svg class="icon" viewBox={i.viewBox} width="16" height="16" aria-hidden="true" focusable="false"><path d={i.d} stroke={i.stroke} fill={i.fill} /></svg>
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t07" onkeydown={(e) => onKeydown(e, api.announce)}>
    <p class="line mode" data-out="mode">legal play</p>
    {#if prediction}
      <Predict {prediction} hydrated={api.hydrated} labels={labelsInOrder} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    <div class="boards">
      <section class="panel numbers" data-out="numbersBoard" aria-label="Numbers">
        <p class="panel-title">{@render icon(NUMBERS_ICON)} Numbers</p>
        <Board
          board={game.board}
          values={shownNumbers}
          game="firing"
          {canAct}
          name="Numbers board on {title}"
          states={numStates}
          spoken={spokenNums}
          disabled={frozen}
          hintFor={tooltip(shownNumbers)}
          onAct={(k: number) => act(k, api.announce)}
        />
      </section>
      <section class="panel symbolic" data-out="symbolicBoard" aria-label="Letters">
        <p class="panel-title">{@render icon(POPULATIONS_ICON)} Letters</p>
        <T07SymbolicBoard board={symBoard} entries={sym.entries} {signs} name="Symbolic board on {title}, following the numbers board" />
      </section>
    </div>
    <p class="line" data-out="gameOver">{gameOverText}</p>
    <div class="fired">
      <p class="panel-title">Forms fired, in the order of the moves</p>
      <!-- A scroll box is a keyboard stop so that its content can be scrolled without a pointer (axe scrollable-region-focusable). -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="fired-box" role="region" aria-label="Forms fired" tabindex="0">
        <ol data-out="firedForms">
          {#each sym.fired as f, k (k)}
            <li data-move={k + 1} data-form={labelText(symBoard, f)}>
              Move {k + 1}, node {symBoard.labels[sym.word[k]!]}: <LinearForm coeffs={f} labels={symBoard.labels} />; number fired
              <span class="numeral" title={isLong(firedNumbers[k]!) ? firedNumbers[k] : null}>{shown(firedNumbers[k]!)}</span>
            </li>
          {:else}
            <li class="empty">No move yet.</li>
          {/each}
        </ol>
      </div>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="roots" role="region" aria-label="{ROOT_TABLE_HEADING}" tabindex="0">
      <table class="root-table" data-out="rootTable">
        <caption>{ROOT_TABLE_HEADING}</caption>
        <thead>
          <tr>
            <th scope="col">Root</th>
            <th scope="col">Move</th>
            <th scope="col">Form fired</th>
            <th scope="col">Number fired</th>
          </tr>
        </thead>
        <tbody>
          {#each sym.rows as r (r.root.join(','))}
            <tr
              class:used={r.move !== null}
              data-out="rootRow"
              data-root={labelText(symBoard, r.root)}
              data-used={r.move !== null ? 'true' : 'false'}
              data-move={r.move !== null ? r.move + 1 : undefined}
            >
              <th scope="row" class="numeral">{rootText(r.root)}</th>
              {#if r.move !== null}
                <td class="numeral">move {r.move + 1}</td>
                <td><LinearForm coeffs={sym.fired[r.move]!} labels={symBoard.labels} /></td>
                <td class="numeral" title={isLong(firedNumbers[r.move]!) ? firedNumbers[r.move] : null}>{shown(firedNumbers[r.move]!)}</td>
              {:else}
                <td colspan="3" class="unused">{NOT_FIRED}</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
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
  <!-- At the end of the game the two controls are done but keep the focus: aria-disabled; disabled only
       before hydration (7.4) and while a prediction freezes the board (A-1, WCAG 2.4.3). -->
  <button
    type="button"
    class="control"
    data-control="step"
    disabled={!api.hydrated || frozen}
    aria-disabled={!frozen && atEnd ? 'true' : undefined}
    onclick={() => step(api.announce)}>Step</button
  >
  <button
    type="button"
    class="control"
    data-control="playToEnd"
    disabled={!api.hydrated || frozen}
    aria-disabled={!frozen && atEnd ? 'true' : undefined}
    onclick={() => playToEnd(api.announce)}>Play to the end</button
  >
  <label class="setting">
    <span>Board</span>
    <select data-control="picker" disabled={!api.hydrated} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value)}>
      {#each PICKER_GROUPS as g (g.letter)}
        <optgroup label="Type {g.letter}" data-letter={g.letter}>
          {#each g.names as name (name)}
            <option value={name} selected={game.spec === name}>{name}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </label>
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values" data-out="valuesTable">
    <caption>Both boards on {title}, after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
    <thead>
      <tr>
        <th scope="col">Node</th>
        <th scope="col">Number</th>
        <th scope="col">Form</th>
        <th scope="col">Fire</th>
      </tr>
    </thead>
    <tbody>
      {#each byLabel as p (p)}
        <tr data-table-row={game.labels[p]}>
          <th scope="row">Node {game.labels[p]}</th>
          <td class="numeral exact" data-table-value={shownNumbers[p]}>{shownNumbers[p]!.replace(/^-/, '−')}</td>
          <td data-form={labelText(symBoard, sym.entries[p]!)}><LinearForm coeffs={sym.entries[p]!} labels={symBoard.labels} /></td>
          <td>
            <button
              type="button"
              class="cell"
              data-table-node={game.labels[p]}
              disabled={!api.hydrated || frozen || !canAct[p]}
              onclick={() => act(p, api.announce)}>Fire node {game.labels[p]}</button
            >
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<ToolFrame
  toolId="symbolic"
  {instanceId}
  title="Symbolic Game"
  {caption}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  derivedForExport={() => t07Derived(game, sym)}
  onPopState={(s, n) => {
    if (n === null && stateProblem(s) === null) load(s);
    else load(defaults);
    notice = n;
  }}
  {figure}
  {controls}
  {table}
/>

<style>
  .t07 {
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
  /* Two boards side by side where the figure is at least 600 pixels wide, stacked (left board first)
     below (plan; A-11, 4.0 Small screens). Each panel is its own size container, so the size rule of
     6.1 measures the panel. */
  .boards {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  @container (min-width: 600px) {
    .boards {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .panel {
    container-type: inline-size;
    min-width: 0;
    border-radius: 8px;
    padding: 4px 0;
  }
  .panel.numbers {
    box-shadow: inset 0 0 0 2px var(--accent-numbers);
  }
  .panel.symbolic {
    box-shadow: inset 0 0 0 2px var(--accent-populations);
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
  /* The fired list keeps one height from the server render on (7.6): it scrolls inside its own box. */
  .fired-box {
    height: 8em;
    overflow: auto;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    padding: 4px 8px;
  }
  .fired-box ol {
    margin: 0;
    padding-inline-start: 0;
    list-style: none;
  }
  .fired-box li {
    min-height: 1.6em;
  }
  .roots {
    max-height: 24em;
    overflow: auto;
  }
  .root-table,
  .values {
    border-collapse: collapse;
  }
  .root-table caption,
  .values caption {
    text-align: start;
    font-weight: bold;
  }
  .root-table th,
  .root-table td,
  .values th,
  .values td {
    padding: 2px 8px;
    text-align: start;
    border-bottom: 1px solid var(--sign-zero-outline);
  }
  .root-table tr.used th {
    font-weight: bold;
  }
  .unused {
    font-style: italic;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
  .exact {
    overflow-wrap: anywhere;
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
  .control:disabled,
  .control[aria-disabled='true'] {
    cursor: default;
  }
  .control:focus-visible,
  .cell:focus-visible,
  .fired-box:focus-visible,
  .roots:focus-visible,
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
