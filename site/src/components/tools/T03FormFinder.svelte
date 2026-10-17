<script lang="ts">
  // T3, the Form Finder (SPEC.md 4 T3, 2.5, 2.7 F2, 2.11, 4.0, 5.4 to 5.6; P2-A2 instruction). Three parts,
  // all rendered and open (plan; P2: nothing the lesson needs sits behind a tab), the preset deciding
  // which comes first: the meter (the form value of the current population, beside a populations board
  // in free play, or of a linked T1's population), the builder (weights, "Test", verdict and witness from
  // formIsInvariant) and small values (typed populations, their form value and the root test). Built on
  // P1-A2's ToolFrame, the Board family, History and Predict, and on T1's model (t01/model.ts T1Game,
  // fixed to the populations view in free play), as T9 is. Every number comes from the engine through
  // t03/model.ts and t03/weights.ts; the component evaluates no form (7.3).
  //
  // Properties (CONTRACTS 5.2; every name is listed in site/tests/e2e/T03.spec.ts): id, board, coords
  // (populations only), start, moves, linkTo, prediction, preset (default, meter, builder,
  // small-values), caption, layers (accepted, no effect: T3 grows no set), and the plan properties
  // cityWeights: number[] (label order), roadWeights: { pair: [number, number]; weight: number }[]
  // (labels), populations: (number | string)[][] (rows of small values, label order).
  import { untrack } from 'svelte';
  import { formIsInvariant } from '@two-games/engine';
  import type { AnyBoard } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import { historyNames } from '../board/historyNames';
  import Predict from '../board/Predict.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { decodeState, encodeState, LINK_NOTICE } from '../../lib/urlCodec';
  import { defaultStart, followToolState, publishToolState, resolveBoard, type BoardSpec, type ToolState } from '../../lib/state';
  import type { Prediction } from '../../tools/types';
  import { PICKER_GROUPS, T1Game, exportValue, inLabelOrder, type T1Config } from './t01/model';
  import { moveSentence, spokenValue, undoSentence } from './t01/announce';
  import { isLong } from './t01/longNumber';
  import Meter from './t03/Meter.svelte';
  import Builder from './t03/Builder.svelte';
  import SmallValues from './t03/SmallValues.svelte';
  import { BUILDER_TEXT, defaultWeights, initialWeights, joinedPairs, matrixOf, witnessView, type RoadWeightProp, type WeightKind, type WitnessView } from './t03/weights';
  import { entryAllowed } from './t03/digits';
  import { FORM_TEXT, defaultRows, judgeRow, meterModel } from './t03/model';
  import { FORM_PRESETS, isPresetId, partsInOrder } from './t03/presets';

  interface Props {
    id?: string;
    board?: BoardSpec;
    coords?: 'populations' | 'numbers';
    start?: (number | string)[];
    moves?: number[];
    linkTo?: string;
    prediction?: Prediction;
    preset?: string;
    caption?: string;
    layers?: number;
    /** Plan: initial city weights of the builder, in label order. */
    cityWeights?: number[];
    /** Plan: initial road weights of the builder, by pairs of labels. */
    roadWeights?: RoadWeightProp[];
    /** Plan: initial rows of small values, each in label order. */
    populations?: (number | string)[][];
  }

  let {
    id = '',
    board: boardProp,
    coords: coordsProp,
    start: startProp,
    moves: movesProp,
    linkTo,
    prediction,
    preset,
    caption: captionProp,
    cityWeights,
    roadWeights,
    populations,
  }: Props = $props();

  const instanceId = untrack(() => id);
  const follow = untrack(() => linkTo);
  const presetDef = untrack(() => FORM_PRESETS[isPresetId(preset) ? preset : 'default']);
  const parts = partsInOrder(presetDef.front);
  const caption = $derived(captionProp ?? presetDef.caption);

  function configOf(s: { board: BoardSpec; start?: (number | string)[]; moves?: number[] }): T1Config {
    const c: T1Config = { board: s.board, view: 'populations', mode: 'free', coords: 'populations' };
    if (s.start !== undefined) c.start = [...s.start];
    if (s.moves !== undefined) c.moves = [...s.moves];
    return c;
  }

  // The author's configuration, read once: the preset's state, with the page's properties over it.
  const authorConfig: T1Config = untrack(() => {
    if (coordsProp === 'numbers') throw new Error(`T3 instance "${instanceId || 'form'}": the Form Finder reads populations only (coords: populations)`);
    const spec = boardProp ?? presetDef.state.board;
    const start = startProp ?? (boardProp === undefined ? presetDef.state.start : defaultStart(resolveBoard(spec), 'populations'));
    return configOf({ board: spec, start, moves: movesProp ?? [] });
  });

  const initialGame = new T1Game(authorConfig);
  const toState = (g: T1Game): ToolState => {
    const s = g.state();
    return { schema: 1, tool: 'form', board: s.board, coords: 'populations', start: s.start!, moves: s.moves! };
  };
  const defaults: ToolState = toState(initialGame);

  /** The rows of small values a page passes, checked as the fields would check them (an authoring error throws). */
  function authorRows(board: AnyBoard): string[][] {
    if (populations === undefined) return defaultRows(board);
    return populations.map((row, r) => {
      if (row.length !== board.n) throw new Error(`T3 instance "${instanceId || 'form'}": row ${r + 1} of populations has ${row.length} entries, not ${board.n}`);
      const texts = row.map(String);
      for (const t of texts) if (!entryAllowed(t)) throw new Error(`T3 instance "${instanceId || 'form'}": the entry ${t} of row ${r + 1} is not a whole number of at most six digits`);
      return texts;
    });
  }

  let game = $state.raw(initialGame);
  let version = $state(0);
  let notice = $state<string | null>(null);
  let predictionResolved = $state(untrack(() => prediction === undefined));
  let weights = $state(untrack(() => initialWeights(initialGame.board, cityWeights, roadWeights, instanceId)));
  let verdict = $state<{ invariant: boolean; witness: WitnessView | null } | null>(null);
  let rows = $state<string[][]>(untrack(() => authorRows(initialGame.board)));
  let followed = $state<ToolState | null>(null);

  const touch = (): void => {
    version++;
  };
  function cur(): T1Game {
    void version;
    return game;
  }

  const frozen = $derived(!predictionResolved);
  const anyBoard: AnyBoard = $derived(cur().board);
  const shown = $derived(cur().shown);
  const pops = $derived(shown.populations ?? []);
  const labelsInOrder = $derived([...anyBoard.labels].sort((a, b) => a - b));
  const popsInOrder = $derived(inLabelOrder(anyBoard, pops));
  const title = $derived(typeof game.spec === 'string' ? game.spec : 'custom board');
  const toolState = $derived(toState(cur()));
  const meter = $derived(meterModel(follow, followed, { board: anyBoard, population: popsInOrder }));
  const pairs = $derived(joinedPairs(anyBoard));
  const judged = $derived(rows.map((r) => judgeRow(anyBoard, r)));
  const canAct = $derived(anyBoard.labels.map(() => !frozen));
  const spoken = $derived(pops.map(spokenValue));
  const tooltip = (values: readonly string[]) => (k: number): string | null => (isLong(values[k]!) ? values[k]! : null);
  const meterSpoken = $derived(meter.message ?? (meter.value === null ? FORM_TEXT.noForm : `form value ${spokenValue(meter.value)}`));
  const figureLabel = $derived(
    meter.ownBoard
      ? `Form Finder on ${title}: populations ${popsInOrder.map(spokenValue).join(', ')}; ${meterSpoken}.`
      : `Form Finder following a linked board: ${meterSpoken}.`,
  );

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a picker)
  // ------------------------------------------------------------------------------------------

  /** T3 reads populations in free play; another view, mode or coords in a link is unreadable (plan). */
  function admit(s: ToolState): ToolState | null {
    if ((s.coords ?? 'populations') !== 'populations') return null;
    if ((s.view ?? 'populations') !== 'populations' || (s.mode ?? 'free') !== 'free') return null;
    return { schema: 1, tool: 'form', board: s.board, coords: 'populations', start: s.start ?? defaultStart(resolveBoard(s.board), 'populations'), moves: s.moves ?? [] };
  }

  function load(s: { board: BoardSpec; start?: (number | string)[]; moves?: number[] }): void {
    const before = JSON.stringify(game.spec);
    game = new T1Game(configOf(s));
    if (JSON.stringify(game.spec) !== before) {
      // A new board: the weights, the rows and the verdict go back to their defaults for it (plan).
      weights = defaultWeights(game.board);
      rows = defaultRows(game.board);
      verdict = null;
    }
    touch();
  }

  function loadLink(decoded: ToolState, n: string | null): void {
    let admitted: ToolState | null = null;
    try {
      admitted = admit(decoded);
      if (admitted !== null) new T1Game(configOf(admitted));
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
        const { state: decoded, notice: n } = decodeState(window.location.search, 'form', defaults, { prefix: instanceId });
        loadLink(decoded, n);
      } catch {
        // decodeState never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  // linkTo (7.4): follow the T1 the page names, through P1-A2's link store (as T2 does).
  $effect(() => {
    if (follow === undefined) return;
    return followToolState(follow, (s) => {
      followed = s;
    });
  });

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------

  function act(position: number, announce: (t: string) => void): void {
    if (frozen) return;
    const before = game.shown;
    const r = game.act(position);
    if (r.kind !== 'moved') return;
    touch();
    announce(moveSentence('populations', game.labels, r.label, before, game.shown, game.cursor));
  }

  /** A row of the table view when linked: drives the followed T1 by publishing under its id (P1-A6's protocol). */
  function actLinked(label: number): void {
    if (follow === undefined || followed === null || frozen) return;
    publishToolState(follow, { ...followed, moves: [...(followed.moves ?? []), label] });
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen) return;
    const from = game.cursor;
    if (!game.scrub(to)) return;
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

  function setWeight(kind: WeightKind, index: number, w: number): void {
    if (kind === 'city') weights.city[index] = w;
    else weights.road[index] = w;
    verdict = null; // the last verdict was about other weights
  }

  function test(announce: (t: string) => void): void {
    const b = game.board;
    const r = formIsInvariant(b, matrixOf(b, weights.city, weights.road));
    const w = witnessView(b, r);
    verdict = { invariant: r.invariant, witness: w };
    announce(r.invariant ? BUILDER_TEXT.pass : `${BUILDER_TEXT.fail} The witness is city ${w?.city ?? ''}, population ${(w?.before ?? []).map(spokenValue).join(', ')}.`);
  }

  function setEntry(row: number, column: number, text: string): void {
    rows[row]![column] = text;
  }

  function addRow(): void {
    rows.push(labelsInOrder.map(() => ''));
  }

  // Only the names History reads: a move names at most 50 positions however long the play (7.4).
  const positionNames = $derived.by(() => {
    const g = cur();
    return historyNames(g.moves.length, g.cursor, (k) => {
      const s = g.shownAt(k);
      return `${k === 0 ? 'Start' : `After move ${k}`}: populations ${inLabelOrder(g.board, s.populations ?? []).map(spokenValue).join(', ')}`;
    });
  });

  const display = (v: string): string => v.replace(/^-/, '−');

  function exportData(): Record<string, unknown> {
    const order = [...game.board.labels].sort((a, b) => a - b);
    const byLabel = (v: readonly number[]): number[] => order.map((l) => v[game.board.labels.indexOf(l)]!);
    return {
      ...game.derived(),
      meter: { population: meter.population.map(exportValue), formValue: meter.value, linkedTo: follow ?? null },
      builder: {
        convention: 'the matrix handed to formIsInvariant is 2M: diagonal 2 w_i, off the diagonal -w_ij',
        cityWeights: byLabel(weights.city),
        roadWeights: pairs.map((p, k) => ({ pair: p.labels, weight: weights.road[k]! })),
        lastTest: verdict === null ? null : { invariant: verdict.invariant, witness: verdict.witness },
      },
      smallValues: rows.map((r, k) => ({ population: r, formValue: judged[k]!.value, verdict: judged[k]!.verdict })),
    };
  }
</script>

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t03" data-board-name={title} onkeydown={(e) => onKeydown(e, api.announce)}>
    {#if prediction}
      <Predict {prediction} hydrated={api.hydrated} labels={labelsInOrder} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    {#each parts as part (part)}
      {#if part === 'meter'}
        <div class="part" role="group" data-part="meter" aria-label="Meter">
          {#if meter.ownBoard}
            <div class="play">
              <div class="board-host">
                <Board
                  board={anyBoard}
                  values={pops}
                  game="mutation"
                  {canAct}
                  name="Populations board on {title}"
                  {spoken}
                  disabled={frozen}
                  hintFor={tooltip(pops)}
                  onAct={(k) => act(k, api.announce)}
                />
              </div>
              <Meter value={meter.value} message={meter.message} labelId="{instanceId || 'form'}-meter" />
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
          {:else}
            <Meter value={meter.value} message={meter.message} labelId="{instanceId || 'form'}-meter" />
            <p class="meter-note" data-out="meterNote">The meter reads the population of the linked board above.</p>
          {/if}
        </div>
      {:else if part === 'builder'}
        <div class="part" role="group" data-part="builder" aria-labelledby="{instanceId || 'form'}-builder">
          <Builder
            labels={anyBoard.labels}
            {pairs}
            city={weights.city}
            road={weights.road}
            {verdict}
            hydrated={api.hydrated}
            labelId="{instanceId || 'form'}-builder"
            onWeight={setWeight}
            onTest={() => test(api.announce)}
          />
        </div>
      {:else}
        <div class="part" role="group" data-part="small-values" aria-labelledby="{instanceId || 'form'}-small">
          <SmallValues labels={labelsInOrder} {rows} {judged} hydrated={api.hydrated} labelId="{instanceId || 'form'}-small" onEntry={setEntry} onAddRow={addRow} />
        </div>
      {/if}
    {/each}
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  {#if meter.ownBoard}
    <label class="setting">
      <span>Board</span>
      <select data-control="picker" disabled={!api.hydrated || frozen} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value, api.announce)}>
        {#if !PICKER_GROUPS.some((g) => g.names.includes(title))}
          <option value="" selected disabled>{title}</option>
        {/if}
        {#each PICKER_GROUPS as g (g.letter)}
          <optgroup label="Type {g.letter}" data-letter={g.letter}>
            {#each g.names as name (name)}
              <option value={name} selected={title === name}>{name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
  {:else}
    <span class="setting">Follows the board {follow}.</span>
  {/if}
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values">
    <caption>{meter.ownBoard ? `Cities of ${title} after ${cur().cursor} ${cur().cursor === 1 ? 'move' : 'moves'}` : 'Cities of the linked board'}</caption>
    <thead>
      <tr>
        <th scope="col">City</th>
        <th scope="col">Population</th>
      </tr>
    </thead>
    <tbody>
      {#each meter.ownBoard ? labelsInOrder : [...meter.board.labels].sort((a, b) => a - b) as l, j (l)}
        <tr data-row={l}>
          <th scope="row">
            <button
              type="button"
              class="cell"
              data-table-node={l}
              disabled={!api.hydrated || frozen || (!meter.ownBoard && followed === null)}
              aria-label="Mutate city {l}, population {spokenValue(meter.population[j] ?? '0')}"
              onclick={() => (meter.ownBoard ? act(anyBoard.labels.indexOf(l), api.announce) : actLinked(l))}>City {l}</button
            >
          </th>
          <td class="numeral" data-table-value="population">{display(meter.population[j] ?? '')}</td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <th scope="row">Form value</th>
        <td class="numeral" data-table-value="formValue">{meter.message ?? (meter.value === null ? FORM_TEXT.noForm : display(meter.value))}</td>
      </tr>
    </tfoot>
  </table>
{/snippet}

<ToolFrame
  toolId="form"
  {instanceId}
  title="Form Finder"
  {caption}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  boardName={meter.ownBoard ? title : undefined}
  derivedForExport={exportData}
  onPopState={(s, n) => loadLink(s, n)}
  {figure}
  {controls}
  {table}
/>

<style>
  .t03 {
    display: grid;
    gap: 16px;
  }
  .part {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .play {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 12px;
  }
  .board-host {
    flex: 1 1 240px;
    min-width: 0;
    container-type: inline-size;
  }
  .meter-note {
    margin: 0;
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
  select:focus-visible,
  .cell:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
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
  .numeral {
    font-variant-numeric: tabular-nums;
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
