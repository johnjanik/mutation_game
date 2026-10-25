<script lang="ts">
  // T4, the Classification Lab (P2-A3; SPEC 4 T4, 2.5, 2.11, 2.12, 4.0, 5.5, 5.6, 6.6, 7.4 to 7.6, E-7,
  // E-9). "A graph editor with a live verdict": the shared BoardEditor, the verdict of classify for every
  // component, balance and weights, the spectral radius, a smallest non-finite sub-board, the root
  // counter (main thread, then "keep counting" in the worker) and the conjecture hunter. Built on P1-A2's
  // ToolFrame. The default state and every preset render at build time; nothing here needs the worker
  // until "keep counting" is pressed (E-9, 7.6).
  //
  // State: ToolState with tool 'lab' and `board` (a name or { cartan, xy }). T4 plays no game, so start
  // and moves are not part of its state. One board object per edit state (`theBoard`), passed to every
  // engine call, so that classify runs once per board (5.6, E-11).
  //
  // Properties (CONTRACTS 5.2; every name is listed in site/tests/e2e/T04.spec.ts): id, board, coords,
  // start, moves, linkTo, prediction (accepted, unused: T4 holds no guided step), preset ('default',
  // 'verdict', 'hunter'), caption, layers (default 40), and the plan properties boardPresets (the test
  // boards, read from the golden file at build time by components/board/editor/presets.ts) and hunter.
  import { untrack } from 'svelte';
  import { CAPS, orbitGraph } from '@two-games/engine';
  import type { AnyBoard, OrbitGraph } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import BoardEditor from '../board/BoardEditor.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { EditHistory } from '../board/editor/history';
  import { namedPresets } from '../board/editor/namedPresets';
  import type { EditorChange, EditorPreset } from '../board/editor/types';
  import { decodeState, LINK_NOTICE } from '../../lib/urlCodec';
  import { exampleLoaded } from '../../lib/history';
  import { engineCall, provide } from '../../lib/worker';
  import { integerOut, resolveBoard, type BoardSpec, type ToolState } from '../../lib/state';
  import type { Prediction } from '../../tools/types';
  import VerdictPanel from './t04/VerdictPanel.svelte';
  import { buildVerdict, displayText, verdictSummary } from './t04/verdict';
  import { DEFAULT_LAYERS, counterHint, counterView, findMixed, hunterSentence, rootSearch, searchBounds, seedsOf } from './t04/counter';
  import { LAB_PRESETS, isLabPreset } from './t04/toolPresets';
  import { TOO_LONG_NOTICE, linkFits } from './t04/link';

  // The engine function this tool calls by name through engineCall.
  provide({ orbitGraph });

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
    /** Plan: extra picker entries, the test boards of classification_tests (testBoardPresets()). */
    boardPresets?: EditorPreset[];
    /** Plan: the conjecture hunter switched on (default: the preset's; off for default and verdict). */
    hunter?: boolean;
  }

  let { id = '', board: boardProp, preset = 'default', caption, layers = DEFAULT_LAYERS, boardPresets = [], hunter: hunterProp }: Props = $props();

  const instanceId = untrack(() => id);
  const presetId = untrack(() => (isLabPreset(preset) ? preset : 'default'));
  const P = LAB_PRESETS[presetId];
  const layersBound = untrack(() => (Number.isInteger(layers) && layers > 0 ? layers : DEFAULT_LAYERS));
  const verdictFirst = P.verdictFirst;
  const authorBoard: BoardSpec = untrack(() => boardProp ?? P.board);
  const shownCaption = untrack(() => caption ?? P.caption);
  const pickerEntries: EditorPreset[] = untrack(() => [...namedPresets(), ...boardPresets.filter((p) => p.group === 'test')]);

  const toState = (spec: BoardSpec): ToolState => ({ schema: 1, tool: 'lab', board: spec });
  const defaults: ToolState = toState(authorBoard);

  const history = new EditHistory(authorBoard);
  let spec = $state.raw<BoardSpec>(authorBoard);
  let notice = $state<string | null>(null);
  let hunterOn = $state(untrack(() => hunterProp ?? P.hunter));
  let version = $state(0);
  const touch = (): void => {
    version++;
  };

  // One board object per edit state (E-11).
  const theBoard: AnyBoard = $derived(resolveBoard(spec));
  const verdict = $derived(buildVerdict(theBoard));
  const toolState = $derived(toState(spec));
  const title = $derived(typeof spec === 'string' ? spec : 'custom board');

  // The root counter: the bounded main-thread search, replaced by the worker's when "keep counting" ran.
  const bounds = $derived(searchBounds(verdict.finiteKnown, layersBound));
  const mainGraph = $derived(rootSearch(theBoard, verdict.finiteKnown, layersBound, bounds.cap));
  let worker = $state.raw<{ board: AnyBoard; graph: OrbitGraph<unknown> } | null>(null);
  let counting = $state(false);
  let counterNotice = $state<string | null>(null);
  const fromWorker = $derived(worker !== null && worker.board === theBoard);
  const graph = $derived(fromWorker ? worker!.graph : mainGraph);
  const cap = $derived(fromWorker ? CAPS.workerPositions : bounds.cap);
  const view = $derived(counterView(graph, bounds.maxDepth, cap));
  const canKeepCounting = $derived(!fromWorker && view.truncated && !verdict.finiteKnown);
  const mixed = $derived(hunterOn ? findMixed(graph, theBoard) : null);
  const hunterText = $derived(hunterSentence(view, mixed));
  const linkTooLong = $derived(!linkFits(spec));
  const marked = $derived(verdict.nonfinite?.nodes ?? []);
  const completeCounts = $derived(view.layers.slice(0, view.completeLayers + 1));
  const figureLabel = $derived(`Classification Lab: ${verdict.n} ${verdict.n === 1 ? 'node' : 'nodes'}; verdict ${verdictSummary(verdict)}.`);

  // ------------------------------------------------------------------------------------------
  // Loading and editing
  // ------------------------------------------------------------------------------------------

  function show(next: BoardSpec): void {
    spec = next;
    worker = null;
    counterNotice = null;
    touch();
  }

  function sameSpec(a: BoardSpec, b: BoardSpec): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function loadLink(decoded: ToolState, n: string | null): void {
    let ok = true;
    try {
      resolveBoard(decoded.board);
    } catch {
      ok = false;
    }
    if (!ok) {
      notice = LINK_NOTICE;
      history.load(authorBoard);
      show(authorBoard);
      return;
    }
    notice = n;
    if (!sameSpec(decoded.board, spec)) {
      history.load(decoded.board);
      show(decoded.board);
    }
  }

  // Hydration: read the URL once with the instance prefix (6.6).
  $effect(() => {
    untrack(() => {
      try {
        const { state: decoded, notice: n } = decodeState(window.location.search, 'lab', defaults, { prefix: instanceId });
        loadLink(decoded, n);
      } catch {
        // decodeState never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  function labelsStartAtZero(s: BoardSpec): boolean {
    try {
      return Math.min(...resolveBoard(s).labels) === 0;
    } catch {
      return false;
    }
  }

  function editSentence(change: EditorChange, before: BoardSpec, next: BoardSpec): string {
    const b = resolveBoard(next);
    const n = b.n;
    let what: string;
    switch (change.kind) {
      case 'add-node':
        what = `Added node ${n}.`;
        break;
      case 'remove-node':
        what = `Removed a node; the nodes are now 1 to ${n}.`;
        break;
      case 'roads':
        what = 'Roads changed.';
        break;
      case 'move':
        what = 'Node moved.';
        break;
      case 'preset':
        what = `Loaded ${typeof next === 'string' ? displayText(next) : 'a test board'}.`;
        break;
    }
    if (change.kind !== 'preset' && change.kind !== 'remove-node' && labelsStartAtZero(before) && !labelsStartAtZero(next)) {
      what += ` The nodes are now numbered 1 to ${n}.`;
    }
    return `${what} Verdict: ${verdictSummary(buildVerdict(b))}.`;
  }

  function onEdit(next: BoardSpec, change: EditorChange, announce: (t: string) => void): void {
    const before = spec;
    notice = null;
    if (change.kind === 'preset') {
      history.load(next);
      show(next);
      exampleLoaded(instanceId, toState(next));
    } else {
      history.push(next);
      show(next);
    }
    announce(editSentence(change, before, next));
  }

  let frameApi: FrameApi | null = null;
  function keep(api: FrameApi): undefined {
    frameApi = api;
    return undefined;
  }
  const say = (t: string): void => frameApi?.announce(t);

  function undo(): void {
    const s = history.undo();
    if (s === null) return;
    show(s);
    say(`Undid an edit. Verdict: ${verdictSummary(buildVerdict(resolveBoard(s)))}.`);
  }
  function redo(): void {
    const s = history.redo();
    if (s === null) return;
    show(s);
    say(`Redid an edit. Verdict: ${verdictSummary(buildVerdict(resolveBoard(s)))}.`);
  }
  function reset(): void {
    const s = history.reset();
    if (s === null) return;
    show(s);
    say(`Back to the board that was loaded. Verdict: ${verdictSummary(buildVerdict(resolveBoard(s)))}.`);
  }

  function onKeydown(event: KeyboardEvent): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo();
    else redo();
  }

  // ------------------------------------------------------------------------------------------
  // Keep counting (E-9 rule 1): a new search in the worker, never a continuation of the main one.
  // ------------------------------------------------------------------------------------------

  /** The "keep counting" button and the counter around it, for the focus (A-1, WCAG 2.4.3). */
  let keepButton: HTMLButtonElement | null = $state(null);
  let counterSection: HTMLElement | null = $state(null);

  function keepCounting(announce: (t: string) => void): void {
    if (!canKeepCounting || counting) return;
    const b = theBoard;
    const maxDepth = bounds.maxDepth;
    counting = true;
    counterNotice = null;
    announce('Counting in the background.');
    // A new search with the 100000 cap and the same layer bound; whereToRun sends it to the worker.
    engineCall('orbitGraph', [b, seedsOf(b), 'mutation', CAPS.workerPositions, maxDepth] as never, counterHint(b, CAPS.workerPositions, false))
      .then((g) => {
        if (b !== theBoard) return;
        // The button goes once the count is in; a focus left on it moves to the counter, never to the page.
        if (keepButton !== null && document.activeElement === keepButton) counterSection?.focus();
        worker = { board: b, graph: g as OrbitGraph<unknown> };
        const v = counterView(g as OrbitGraph<unknown>, maxDepth, CAPS.workerPositions);
        announce(`Found ${v.found} root populations. ${v.stop ?? ''}`.trim());
      })
      .catch((e: unknown) => {
        if (b !== theBoard) return;
        counterNotice = `The count could not be continued: ${e instanceof Error ? e.message : String(e)}`;
        // A-4: each result is announced in the tool's one polite live region, this one too.
        announce(counterNotice);
      })
      .finally(() => {
        counting = false;
      });
  }

  // ------------------------------------------------------------------------------------------
  // Export (6.6 Data export): the derived tables shown on screen, in labels.
  // ------------------------------------------------------------------------------------------

  /** The weights d_i as exported (6.6): an integer by the integer rule, a fraction as its "p/q" text. */
  const weightsOut = (w: string[] | null): (number | string)[] | null => (w === null ? null : w.map((t) => (t.includes('/') ? t : integerOut(t))));

  function exportData(): Record<string, unknown> {
    void version;
    const v = verdict;
    return {
      verdict: v.components.map((c) => ({ ...c.record, verdict: c.classText, weights: weightsOut(c.weights) })),
      balanced: v.balanced,
      weights: weightsOut(v.weights),
      spectralRadius: v.spectralRadius,
      nonfiniteSubboard: v.nonfinite,
      rootCounter: {
        found: view.found,
        layerCounts: view.layers,
        completeLayers: view.completeLayers,
        positionsInCompleteLayers: view.inComplete,
        truncated: view.truncated,
        cap,
        layers: bounds.maxDepth ?? null,
        stopMessage: view.stop,
        inWorker: fromWorker,
      },
      hunter: hunterOn
        ? {
            result: hunterText,
            population: mixed === null ? null : mixed.population.map((x) => integerOut(x)),
            start: mixed?.start ?? null,
            word: mixed?.word ?? null,
            moves: mixed?.moves ?? null,
          }
        : null,
    };
  }

  function selectFromTable(label: number, root: HTMLElement | null): void {
    const button = root?.querySelector<HTMLButtonElement>(`[data-board-group] [data-node="${label}"]`);
    button?.click();
    button?.focus();
  }

  const labelsInOrder = $derived([...theBoard.labels].sort((a, b) => a - b));
  const roadTable = $derived.by(() => {
    const C = (theBoard.cartan as readonly (readonly (number | bigint)[])[]).map((row) => row.map((x) => Number(x)));
    const pos = labelsInOrder.map((l) => theBoard.labels.indexOf(l));
    // Roads from the row's node to the column's node: A[i][j] = -C[j][i] (SPEC 2.1).
    return pos.map((i) => pos.map((j) => (i === j ? 0 : -C[j]![i]! || 0)));
  });
  let tableRoot: HTMLElement | null = $state(null);
</script>

{#snippet editor(api: FrameApi)}
  <BoardEditor
    value={spec}
    onChange={(next, change) => onEdit(next, change, api.announce)}
    name="Board editor"
    disabled={!api.hydrated}
    presets={pickerEntries}
    {marked}
  />
{/snippet}

{#snippet counter(api: FrameApi)}
  <section class="counter" aria-label="Root counter" tabindex="-1" bind:this={counterSection}>
    <p class="line">
      Root populations found: <span class="numeral" data-out="rootCount">{view.found}</span>{view.ended === 'complete' ? ', all of them' : ''}.
    </p>
    <p class="line">
      New in each layer from layer 0: <span
        class="numeral"
        data-out="layerCounts"
        data-counts={completeCounts.join(',')}
        data-complete-layers={view.completeLayers}>{completeCounts.join(', ')}</span
      >{#if view.truncated && view.layers.length > completeCounts.length}; then {view.layers[view.layers.length - 1]} in layer {view.layers.length - 1}, which is
        incomplete{/if}.
    </p>
    {#if view.truncated}
      <p class="line">
        Layers 0 to {view.completeLayers} are complete and hold <span class="numeral" data-out="completeCount">{view.inComplete}</span> of them.
      </p>
    {/if}
    {#if view.stop !== null}
      <p class="line" data-out="stopMessage">{view.stop}</p>
    {/if}
    {#if canKeepCounting}
      <!-- While the count runs the button is done but keeps the focus (aria-disabled; disabled only before
           hydration, 7.4); keepCounting() ignores a second press. -->
      <button
        type="button"
        class="control"
        data-control="keepCounting"
        disabled={!api.hydrated}
        aria-disabled={counting ? 'true' : undefined}
        bind:this={keepButton}
        onclick={() => keepCounting(api.announce)}>keep counting</button
      >
    {/if}
    {#if counting}
      <!-- Ordinary text: the frame's one polite live region (A-4) already says "Counting in the background." -->
      <p class="line" data-out="counterStatus">Counting in the background, up to {CAPS.workerPositions} positions.</p>
    {/if}
    {#if counterNotice !== null}
      <p class="line" data-out="counterNotice">{counterNotice}</p>
    {/if}
  </section>
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t04" data-board-name={title} data-hydrated-api={keep(api)} onkeydown={onKeydown} bind:this={tableRoot}>
    {#if verdictFirst}
      <VerdictPanel {verdict} />
      {@render editor(api)}
    {:else}
      {@render editor(api)}
      <VerdictPanel {verdict} />
    {/if}
    {@render counter(api)}
    {#if hunterOn}
      <section class="hunter" aria-label="Conjecture hunter">
        <p class="line">
          Conjecture hunter, a root population with both signs among those found: <span
            data-out="hunterResult"
            data-population={mixed === null ? undefined : mixed.population.join(',')}
            data-word={mixed === null ? undefined : mixed.word.join(',')}
            data-moves={mixed === null ? undefined : mixed.moves}
            data-start={mixed === null ? undefined : mixed.start}>{hunterText}</span
          >.
        </p>
      </section>
    {/if}
    {#if linkTooLong}
      <p class="line" data-out="linkNotice">{TOO_LONG_NOTICE}</p>
    {/if}
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  <label class="switch">
    <input type="checkbox" data-control="hunter" disabled={!api.hydrated} bind:checked={hunterOn} />
    <span>Conjecture hunter</span>
  </label>
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values">
    <caption>Roads from the node of each row to the node of each column</caption>
    <thead>
      <tr>
        <th scope="col">From</th>
        {#each labelsInOrder as l (l)}<th scope="col">to {l}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each labelsInOrder as l, i (l)}
        <tr data-row={l}>
          <th scope="row">
            <button type="button" class="cell" data-table-node={l} disabled={!api.hydrated} onclick={() => selectFromTable(l, tableRoot)}>Node {l}</button>
          </th>
          {#each roadTable[i]! as count, j (j)}<td class="numeral">{i === j ? '' : count}</td>{/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <table class="values">
    <caption>Verdict</caption>
    <tbody>
      {#each verdict.components as c, i (i)}
        <tr>
          <th scope="row">Nodes {c.record.nodes.join(', ')}</th>
          <td>
            {c.classText}{c.record.name !== null ? ` ${displayText(c.record.name)}` : ''}{c.weights !== null ? `; weights ${c.weights.join(', ')}` : ''}{c
              .record.marks
              ? `; marks ${c.record.marks.join(', ')}; comarks ${c.record.comarks?.join(', ')}`
              : ''}
          </td>
        </tr>
      {/each}
      <tr><th scope="row">Balanced</th><td>{verdict.balanced ? 'yes' : 'no'}</td></tr>
      {#if verdict.spectralRadius !== null}<tr><th scope="row">Spectral radius</th><td class="numeral">{verdict.spectralRadius}</td></tr>{/if}
      <tr><th scope="row">Root populations by layer</th><td class="numeral">{view.layers.join(', ')}</td></tr>
      {#if hunterOn && mixed !== null}<tr><th scope="row">Mixed population, exact</th><td class="numeral">{mixed.population.join(', ')}</td></tr>{/if}
    </tbody>
  </table>
{/snippet}

<ToolFrame
  toolId="lab"
  {instanceId}
  title="Classification Lab"
  caption={shownCaption}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  boardName={typeof spec === 'string' ? spec : 'custom board'}
  derivedForExport={exportData}
  onUndo={undo}
  onRedo={redo}
  onReset={reset}
  onPopState={(s, n) => loadLink(s, n)}
  {figure}
  {controls}
  {table}
/>

<style>
  .t04 {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    min-width: 0;
  }
  .line {
    margin: 0;
  }
  .counter,
  .hunter {
    display: grid;
    gap: 4px;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .control {
    justify-self: start;
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
  .counter:focus-visible,
  .switch input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    cursor: pointer;
  }
  .switch input {
    width: 24px;
    height: 24px;
    margin: 0;
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
