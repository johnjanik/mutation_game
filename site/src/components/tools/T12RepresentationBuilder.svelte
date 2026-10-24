<script lang="ts">
  // T12, the Representation Builder (SPEC.md 4 T12, 2.18, 2.7 F11, 4.0, 5.6, 6.6, 7.3 to 7.6). Owner P5-A2.
  // For a node i of a named finite board: the orbit of omega_i in layers with edges coloured and labelled by
  // node; the matrices E_k, F_k, H_k read off the numbers game (grids up to dimension 27, lists above); a
  // relation checker showing both sides of the Chevalley-Serre relation the reader picks; the move matrix
  // beside its signed version; and a string viewer with its own numbers-game board and History. For a node
  // that is not minuscule the matrices are built up to 2000 positions and fail, with the explanation that
  // some number in the orbit is 2 or more; above 2000 the explanation stands alone. Every value comes from
  // the engine through t12/model.ts and t12/rep.ts. The default state renders at build time; the URL is read
  // once on hydration (admitLink: the codec, then T12's own rules).
  //
  // Properties (CONTRACTS 5.2; listed in site/tests/e2e/T12.spec.ts): id, board, node, relation, coords
  // ('numbers' only), start, moves, prediction, preset ('default' | 'string-viewer' | 'relation-checker' |
  // 'signed-move': the state fields and the panel put first), caption; linkTo and layers are accepted and
  // ignored (no set of positions grows off the finite types).
  import { untrack } from 'svelte';
  import type { AnyBoard, RelationCheck } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import { historyNames } from '../board/historyNames';
  import Predict from '../board/Predict.svelte';
  import { shortcutOf } from '../board/keyboard';
  import MatrixView from '../math/MatrixView.svelte';
  import OrbitLayersView from './t12/OrbitLayers.svelte';
  import RelationFormula from './t12/RelationFormula.svelte';
  import { encodeState } from '../../lib/urlCodec';
  import { speak } from '../../lib/a11y';
  import { engineCall } from '../../lib/worker';
  import { resolveBoard, type ToolState } from '../../lib/state';
  import { NUMBERS_ICON } from '../draw/palette';
  import { isLong, shortValue } from './t01/longNumber';
  import type { Prediction } from '../../tools/types';
  import { T12_GROUPS, T12_PANELS, T12_PRESETS, type T12Panel } from './t12/config';
  import {
    DRAW_MAX,
    MINUS,
    RELATIONS,
    RELATION_NAMES,
    T12Tool,
    acceptRelations,
    admitLink,
    basisHeaders,
    captionOf,
    configOf,
    configuredState,
    defaultsFor,
    dimensionOf,
    exportData,
    explanation,
    findRelation,
    inLabelOrder,
    interaction,
    isSerre,
    labelOf,
    labelOrder,
    limitSentence,
    matrixFormat,
    minusculeLabels,
    moveSentence,
    noMinusculeSentence,
    omegaName,
    orbitView,
    parseRelationCode,
    pickSentence,
    positionName,
    positionOf,
    positionText,
    presetIdOf,
    readTypedStart,
    relationParts,
    relationSentence,
    relationSummary,
    relationsHint,
    relationsNow,
    relationsOnMain,
    representationSteps,
    defaultNode,
    startSentence,
    stringNote,
    undoSentence,
    type RelationCode,
    type Representation,
  } from './t12/model';

  interface Props {
    id?: string;
    board?: string;
    node?: number;
    relation?: string;
    coords?: string;
    start?: (number | string)[];
    moves?: number[];
    caption?: string;
    preset?: string;
    prediction?: Prediction;
    linkTo?: string;
    layers?: number;
  }

  let { id = '', board: boardProp, node: nodeProp, relation: relationProp, coords: coordsProp, start: startProp, moves: movesProp, caption, preset, prediction }: Props = $props();

  // The author's configuration is read once (CONTRACTS 5.2): properties over the preset's fields.
  const instanceId = untrack(() => id);
  const presetId = untrack(() => presetIdOf(preset));
  const first: T12Panel | null = T12_PRESETS[presetId].first;
  const configured: ToolState = untrack(() => {
    try {
      return configuredState({ board: boardProp, node: nodeProp, relation: relationProp, coords: coordsProp, start: startProp, moves: movesProp, preset });
    } catch (e) {
      throw new Error(`T12 instance ${instanceId || '(tool route)'}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  const initial = new T12Tool(configOf(configured));
  /** An author's own caption stays; the preset's caption (the tool route passes the registry's) follows the state. */
  const fixedCaption = untrack(() => (caption !== undefined && caption !== captionOf(initial, first) ? caption : null));
  /** The panels in reading order: the one the preset puts first, then the others (plan; not part of a link). */
  const panels: T12Panel[] = first === null ? [...T12_PANELS] : [first, ...T12_PANELS.filter((p) => p !== first)];

  let tool = $state.raw(initial);
  let version = $state(0);
  let notice = $state<string | null>(null);
  let busy = $state(false);
  let matrixNode = $state(initial.node);
  let startFields = $state<string[]>([...initial.start]);
  let startMessage = $state('');
  let predictionResolved = $state(untrack(() => prediction === undefined));
  /** A link or the back button that loads another state before the reader answers withdraws the prediction (as T11). */
  let predictionWithdrawn = $state(false);
  let generation = 0;
  /** The representations whose relation list is being computed in the worker. */
  const inFlight = new WeakSet<object>();
  /** The representation whose relation list the worker could not compute (it is then said so). */
  let relationsLost = $state.raw<Representation | null>(null);

  const touch = (): void => {
    version++;
  };
  /** The tool, read so that a derived value depends on `version` (the model is a mutable class). */
  function cur(): T12Tool {
    void version;
    return tool;
  }

  const rep = $derived(cur().rep);
  const anyBoard = $derived(cur().board as AnyBoard);
  const spec = $derived(cur().spec);
  const nodeLabel = $derived(cur().node);
  const labels = $derived(labelOrder(anyBoard));
  const minusculeSet = $derived(new Set(minusculeLabels(anyBoard)));
  const dim = $derived(dimensionOf(rep));
  const headers = $derived(basisHeaders(rep));
  const format = $derived(matrixFormat(dim));
  /** The position of the node k whose matrices are shown (E-7). */
  const kAt = $derived(positionOf(anyBoard, matrixNode));
  const orbit = $derived(rep.built ? orbitView(rep) : null);
  const checks = $derived.by((): RelationCheck[] | null => {
    void version;
    return rep.checks;
  });
  const relationCode = $derived(cur().relation);
  const relationRef = $derived(parseRelationCode(anyBoard, relationCode));
  const relationKind = $derived<RelationCode>(relationRef?.relation ?? 'ef');
  const relationI = $derived(relationRef === null ? nodeLabel : labels[relationRef.i]!);
  const relationJ = $derived(relationRef === null ? nodeLabel : labels[relationRef.j]!);
  const parts = $derived(relationParts(anyBoard, relationCode));
  const check = $derived(checks === null ? null : findRelation(checks, anyBoard, relationCode));
  const values = $derived(cur().values());
  const view = $derived(cur().string());
  const frozen = $derived(!predictionResolved || busy || cur().pending);
  const toolState = $derived(cur().state());
  const captionText = $derived(fixedCaption ?? captionOf(cur(), encodeState(toolState) === encodeState(configured) ? first : null, matrixNode));
  const sparseDots = $derived(dim > 8);

  /** Exact digits in the tooltip for long values (4.0 Long numbers). */
  const tooltip = (k: number): string | null => (isLong(values[k]!) ? values[k]! : null);
  const shown = (t: string): string => (isLong(t) ? shortValue(t) : t.startsWith('-') ? `${MINUS}${t.slice(1)}` : t);
  const positionShown = (v: readonly string[]): string => `(${v.map(shown).join(', ')})`;

  const figureLabel = $derived(
    `Representation Builder on ${spec}, node ${nodeLabel}: ${rep.minuscule ? 'a minuscule node' : 'a node that is not minuscule'}, the orbit of ${omegaName(nodeLabel)} has ${rep.orbitSize} positions; the line through ${positionText(view.through)} at node ${nodeLabel} has ${view.length} ${view.length === 1n ? 'position' : 'positions'}.`,
  );

  // Only the names History reads: a move names at most 50 positions however long the play (7.4).
  const positionNames = $derived.by(() => {
    const t = cur();
    return historyNames(t.moves.length, t.cursor, (k) => positionName(t, k));
  });

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a picker, a typed start)
  // ------------------------------------------------------------------------------------------

  /**
   * The pieces of the panels. The configured state is drawn whole (it is the server markup). After a load
   * that changes the board or the node, each piece is drawn in a task of its own (plan): first each panel's
   * frame (its title, text and controls), then its heavy parts, the relation list computed in a task of its
   * own before its panel (or in the worker above RELATIONS_MAIN_MAX positions), and the table view last, so
   * that no task of the main thread holds all of it (SPEC 7.6).
   */
  const PIECES = {
    orbit: ['shell-orbit', 'orbit', 'orbit-edges'],
    matrices: ['shell-matrices', 'matrix-e', 'matrix-f', 'matrix-h'],
    relations: ['shell-relations', 'relations', 'relation-left', 'relation-right'],
    signed: ['shell-signed', 'move-matrix', 'signed-move'],
    string: ['shell-string', 'string-history', 'string-line', 'string-entry'],
  } as const satisfies Record<T12Panel, readonly string[]>;
  type Piece = (typeof PIECES)[keyof typeof PIECES][number] | 'table';
  const ALL_PIECES = [...Object.values(PIECES).flat(), 'table'] as Piece[];
  const ready = $state<Record<Piece, boolean>>(Object.fromEntries(ALL_PIECES.map((p) => [p, true])) as Record<Piece, boolean>);
  /** The line shown while a picked board or node is being built, task by task. */
  let building = $state<string | null>(null);

  /**
   * Runs `fn` in a task after the next frame has been drawn, so that the layout of what a step drew is done
   * in that frame and never batched with the next step's (requestAnimationFrame, then a task); in a hidden
   * page, which draws no frame, in the next task.
   */
  function afterFrame(fn: () => void): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(fn, 0));
    } else setTimeout(fn, 0);
  }

  /** Runs the steps one per task, each after a frame, while the generation is unchanged; a step may append steps. */
  function runSteps(g: number, steps: (() => void)[], done?: () => void): void {
    const next = (k: number): void => {
      afterFrame(() => {
        if (g !== generation) return;
        if (k < steps.length) {
          steps[k]!();
          next(k + 1);
        } else done?.();
      });
    };
    next(0);
  }

  function stage(g: number): void {
    for (const p of ALL_PIECES) ready[p] = false;
    const steps: (() => void)[] = [];
    for (const panel of panels) {
      for (const p of PIECES[panel]) {
        if (p === 'orbit') {
          steps.push(() => {
            if (tool.rep.built) orbitView(tool.rep);
          });
        }
        if (p === 'relations') {
          steps.push(() => {
            const r = tool.rep;
            if (r.built && r.checks === null && relationsOnMain(r.orbitSize)) {
              relationsNow(r);
              touch();
            }
          });
        }
        steps.push(() => {
          ready[p] = true;
        });
      }
    }
    steps.push(() => {
      ready.table = true;
    });
    runSteps(g, steps);
  }

  /**
   * A picked board or node: the representation is built one engine call per task (representationSteps),
   * the figure keeping the previous state with a line saying what is being built; then the state loads.
   */
  function build(spec: string, node: number | null, announce: (t: string) => void): void {
    const g = ++generation;
    building = `Building ${spec}${node === null ? '' : `, node ${node}`}.`;
    let label = node ?? 0;
    // The previous state's panels are taken down in a frame of their own, before the new state is drawn.
    const steps: (() => void)[] = [
      () => {
        for (const p of ALL_PIECES) ready[p] = false;
      },
    ];
    if (node === null) {
      steps.push(() => {
        label = defaultNode(resolveBoard(spec));
        steps.push(...representationSteps(spec, label));
      });
    } else steps.push(...representationSteps(spec, node));
    runSteps(g, steps, () => {
      building = null;
      load(defaultsFor(spec, label));
      announce(pickSentence(tool));
    });
  }

  /** Builds the tool of a state; a long list of moves from a link is replayed where E-9 says (rule 2). */
  function load(s: ToolState): void {
    const g = ++generation;
    const t = new T12Tool(configOf(s), { defer: true, relations: 'staged' });
    const nodeChanged = t.spec !== tool.spec || t.node !== tool.node;
    tool = t;
    if (nodeChanged) matrixNode = t.node;
    if (nodeChanged || ALL_PIECES.some((p) => !ready[p])) stage(g);
    startFields = [...t.start];
    startMessage = '';
    touch();
    if (t.pending) void replayInWorker(t, g);
  }

  /** E-9 rule 2, "a long list of moves read from a link": positionsOf in the worker; the start is shown meanwhile. */
  async function replayInWorker(t: T12Tool, g: number): Promise<void> {
    busy = true;
    try {
      const list = await engineCall('positionsOf', [t.workerState()], t.replayHint());
      if (g !== generation) return;
      t.acceptReplay(list);
    } finally {
      if (g === generation) busy = false;
      touch();
    }
  }

  function readLink(): void {
    const { state, notice: n } = admitLink(window.location.search, configured, instanceId);
    notice = n;
    if (encodeState(state) === encodeState(tool.state())) return;
    if (!predictionResolved && encodeState(state) !== encodeState(configured)) {
      predictionWithdrawn = true;
      predictionResolved = true;
    }
    load(state);
  }

  // Hydration: read the URL once with the instance prefix (6.6).
  $effect(() => {
    untrack(() => readLink());
  });

  /**
   * A relation list from the worker: stored with its representation, and, when that is the one shown, its
   * two sides drawn one per task (the reply was read in a task of its own, SPEC 7.6).
   */
  function acceptFromWorker(r: Representation, list: RelationCheck[]): void {
    if (!acceptRelations(r, list) || r !== tool.rep) return;
    ready['relation-left'] = false;
    ready['relation-right'] = false;
    touch();
    runSteps(generation, [
      () => {
        ready['relation-left'] = true;
      },
      () => {
        ready['relation-right'] = true;
      },
    ]);
  }

  // Above RELATIONS_MAIN_MAX positions the relation list is computed in the worker (decisions/P5-A2.md).
  // The call is posted in a task of its own (its arguments are serialized there) and the reply is taken in
  // another, so that neither joins the drawing of the panels.
  $effect(() => {
    const r = rep;
    if (!r.built || r.checks !== null || relationsOnMain(r.orbitSize) || inFlight.has(r)) return;
    inFlight.add(r);
    untrack(() => {
      afterFrame(() => {
        engineCall('chevalleySerre', [r.board, r.E!, r.F!, r.H!], relationsHint(r.board)).then(
          (list) =>
            afterFrame(() => {
              inFlight.delete(r);
              acceptFromWorker(r, list);
            }),
          () => {
            inFlight.delete(r);
            relationsLost = r;
          },
        );
      });
    });
  });

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------

  /** Counts the times the line was turned end over end, to replay its CSS flip (A-9: none under reduced motion). */
  let flips = $state(0);
  const lineKeys = (): string[] => tool.string().shown.map((p) => p.key);
  function flipIfReversed(before: readonly string[]): void {
    const after = lineKeys();
    if (after.length > 1 && after.length === before.length && after.every((k, i) => k === before[before.length - 1 - i])) flips++;
  }

  function act(label: number, announce: (t: string) => void): void {
    if (frozen) return;
    const before = lineKeys();
    const r = tool.act(label);
    if (r === null) return;
    touch();
    flipIfReversed(before);
    announce(moveSentence(tool, r));
  }

  /** The announcement after the cursor moved: an undo reads the position reached, a redo the move made. */
  function arrive(to: number, from: number, announce: (t: string) => void): void {
    const t = tool;
    if (to < from) announce(undoSentence(t, to + 1, to));
    else if (to > from) announce(moveSentence(t, { label: t.moves[to - 1]!, move: to, before: t.values(to - 1), after: t.values(to) }));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen) return;
    const from = tool.cursor;
    const before = lineKeys();
    if (!tool.scrub(to)) return;
    touch();
    flipIfReversed(before);
    arrive(to, from, announce);
  }

  const undo = (announce: (t: string) => void): void => scrub(tool.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(tool.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    if (frozen) return;
    const from = tool.cursor;
    if (!tool.reset()) return;
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

  /** A picker resets the node, the relation, the start and the moves to the tool's defaults for the board (4.0; plan). */
  function pickBoard(name: string, announce: (t: string) => void): void {
    if (frozen) return;
    notice = null;
    build(name, null, announce);
  }

  function pickNode(label: number, announce: (t: string) => void): void {
    if (frozen) return;
    notice = null;
    build(spec, label, announce);
  }

  /** The relation checker's three controls write one code (6.6 `q`); a Serre relation takes two different nodes. */
  function pickRelation(kind: RelationCode, i: number, j: number, changed: 'kind' | 'i' | 'j', announce: (t: string) => void): void {
    if (frozen) return;
    let jj = j;
    let ii = i;
    if (isSerre(kind) && ii === jj) {
      const other = labels.find((l) => l !== (changed === 'j' ? jj : ii));
      if (other === undefined) return;
      if (changed === 'j') ii = other;
      else jj = other;
    }
    const code = `${kind}:${ii},${jj}`;
    if (parseRelationCode(anyBoard, code) === null || code === tool.relation) return;
    tool.relation = code;
    touch();
    announce(relationSentence(tool, checks === null ? null : findRelation(checks, anyBoard, code)));
  }

  function setStart(announce: (t: string) => void): void {
    if (frozen) return;
    const r = readTypedStart(anyBoard, startFields);
    if ('problem' in r) {
      startMessage = r.problem;
      announce(r.problem);
      return;
    }
    notice = null;
    load({ ...tool.state(), start: r.start, moves: [] });
    announce(startSentence(tool));
  }

  const ui = $derived(interaction(anyBoard.n, { hydrated: true, frozen, pending: cur().pending }));
  const uid = $derived(instanceId || 'rep');
</script>

{#snippet matrix(out: Piece, caption: string, sparse: ReadonlyMap<string, bigint>)}
  {#if ready[out]}
    <MatrixView {out} {caption} rowHeaders={headers} colHeaders={headers} {sparse} {format} sparseDisplay={sparseDots} indexHeaders listMax={DRAW_MAX} />
  {:else}
    <p class="line waiting">Drawing {caption}.</p>
  {/if}
{/snippet}

{#snippet orbitPanel()}
  <section class="panel" data-panel="orbit" aria-labelledby="{uid}-orbit-title">
    <p class="panel-title" id="{uid}-orbit-title">The orbit of {omegaName(nodeLabel)} in layers</p>
    {#if !ready.orbit}
      <p class="line waiting">Drawing the orbit.</p>
    {:else if orbit !== null}
      <OrbitLayersView
        layers={orbit.layers}
        drawing={orbit.drawing}
        texts={orbit.layers.vertices.map((v) => positionText(inLabelOrder(anyBoard, v.values)))}
        title="The orbit of {omegaName(nodeLabel)} on {spec}: {rep.orbitSize} positions in {orbit.layers.layerSizes.length} layers, each edge labelled with the node fired."
        omegaText={omegaName(nodeLabel)}
        edges={ready['orbit-edges']}
      />
    {/if}
  </section>
{/snippet}

{#snippet nodeOptions(selected: number, mark: boolean)}
  {#each labels as l (l)}
    <option value={l} selected={l === selected}>{l}{mark && minusculeSet.has(l) ? ' (minuscule)' : ''}</option>
  {/each}
{/snippet}

{#snippet matricesPanel(api: FrameApi)}
  <section class="panel" data-panel="matrices" aria-labelledby="{uid}-matrices-title">
    <p class="panel-title" id="{uid}-matrices-title">The matrices E, F and H of node {matrixNode}</p>
    <label class="setting">
      <span>Node k</span>
      <select data-control="matrix-node" value={matrixNode} disabled={!api.hydrated || !ui.controls} onchange={(e) => (matrixNode = Number((e.currentTarget as HTMLSelectElement).value))}>
        {@render nodeOptions(matrixNode, false)}
      </select>
    </label>
    <p class="line">
      Row and column r belong to the r-th position of the orbit in decreasing order; column c holds the image of position c. F<sub>k</sub> sends a position whose number at node
      k is 1 to the position firing reaches, E<sub>k</sub> does the same where the number is {MINUS}1, and H<sub>k</sub> multiplies by the number at node k.
    </p>
    <div class="matrices">
      {@render matrix('matrix-e', `E${matrixNode}`, rep.E![kAt]!)}
      {@render matrix('matrix-f', `F${matrixNode}`, rep.F![kAt]!)}
      {@render matrix('matrix-h', `H${matrixNode}`, rep.H![kAt]!)}
    </div>
  </section>
{/snippet}

{#snippet relationsPanel(api: FrameApi)}
  <section class="panel" data-panel="relations" aria-labelledby="{uid}-relations-title">
    <p class="panel-title" id="{uid}-relations-title">Relation checker</p>
    <div class="settings">
      <label class="setting">
        <span>Relation</span>
        <select
          data-control="relation"
          value={relationKind}
          disabled={!api.hydrated || !ui.controls}
          onchange={(e) => pickRelation((e.currentTarget as HTMLSelectElement).value as RelationCode, relationI, relationJ, 'kind', api.announce)}
        >
          {#each RELATIONS as r (r)}
            <option value={r} selected={r === relationKind} disabled={isSerre(r) && anyBoard.n < 2}>{RELATION_NAMES[r]}</option>
          {/each}
        </select>
      </label>
      <label class="setting">
        <span>Node i</span>
        <select data-control="relation-i" value={relationI} disabled={!api.hydrated || !ui.controls} onchange={(e) => pickRelation(relationKind, Number((e.currentTarget as HTMLSelectElement).value), relationJ, 'i', api.announce)}>
          {@render nodeOptions(relationI, false)}
        </select>
      </label>
      <label class="setting">
        <span>Node j</span>
        <select data-control="relation-j" value={relationJ} disabled={!api.hydrated || !ui.controls} onchange={(e) => pickRelation(relationKind, relationI, Number((e.currentTarget as HTMLSelectElement).value), 'j', api.announce)}>
          {@render nodeOptions(relationJ, false)}
        </select>
      </label>
    </div>
    <p class="formula-line">
      {#if parts !== null}<span class="formula" data-out="relation-formula"><RelationFormula {parts} /></span>{/if}
      {#if check !== null}
        <span class="verdict" data-out="relation-verdict" data-holds={check.holds ? 'true' : 'false'}>{check.holds ? 'equal' : 'not equal'}</span>
      {:else if relationsLost === rep}
        <span class="verdict" data-out="relation-verdict">not checked</span>
      {:else}
        <span class="verdict" data-out="relation-verdict">checked in the background</span>
      {/if}
    </p>
    {#if check !== null}
      <div class="matrices two">
        {@render matrix('relation-left', 'Left side', check.left)}
        {@render matrix('relation-right', 'Right side', check.right)}
      </div>
      <p class="line" data-out="all-relations">{relationSummary(checks!)}</p>
    {:else if relationsLost === rep}
      <p class="line" data-out="all-relations">The relations of these {dim} by {dim} matrices could not be checked in the background; reloading the page tries again.</p>
    {:else}
      <p class="line" data-out="all-relations">The {6 * anyBoard.n * anyBoard.n - 2 * anyBoard.n} relations of these {dim} by {dim} matrices are being checked in the background.</p>
    {/if}
  </section>
{/snippet}

{#snippet signedPanel()}
  <section class="panel" data-panel="signed" aria-labelledby="{uid}-signed-title">
    <p class="panel-title" id="{uid}-signed-title">The move of node {matrixNode} beside its signed version</p>
    <p class="line">
      Firing node {matrixNode} permutes the positions: its matrix is E<sub>{matrixNode}</sub> + F<sub>{matrixNode}</sub> + P<sub>{matrixNode}</sub>, where P<sub>{matrixNode}</sub> keeps
      the positions whose number at node {matrixNode} is 0. The group element exp(E<sub>{matrixNode}</sub>) exp({MINUS}F<sub>{matrixNode}</sub>) exp(E<sub>{matrixNode}</sub>) is E<sub
        >{matrixNode}</sub
      >
      {MINUS} F<sub>{matrixNode}</sub> + P<sub>{matrixNode}</sub>: the same matrix with one sign changed in each pair.
      {#if rep.minuscule}Its square multiplies each position by {MINUS}1 to the power of its number at node {matrixNode}.{:else}On a node that is not minuscule the moves of numbers 2 or more are missing from E and F, so the signed matrix is no longer the move with signs.{/if}
    </p>
    <div class="matrices two">
      {@render matrix('move-matrix', `Firing node ${matrixNode}`, rep.moves![kAt]!)}
      {@render matrix('signed-move', `Signed: E${matrixNode} ${MINUS} F${matrixNode} + P${matrixNode}`, rep.signed![kAt]!)}
    </div>
  </section>
{/snippet}

{#snippet stringPanel(api: FrameApi)}
  <section class="panel string" data-panel="string" aria-labelledby="{uid}-string-title">
    <p class="panel-title" id="{uid}-string-title">
      <svg class="icon" viewBox={NUMBERS_ICON.viewBox} width="16" height="16" aria-hidden="true" focusable="false"><path d={NUMBERS_ICON.d} stroke={NUMBERS_ICON.stroke} fill={NUMBERS_ICON.fill} /></svg>
      String viewer at node {nodeLabel}
    </p>
    <p class="line">
      The position on this board lies on a line of positions spaced by α<sub>{nodeLabel}</sub>, column {nodeLabel} of the Cartan matrix. Fire any node to move the position (free
      play), or type one below.
    </p>
    <div class="board-host">
      <Board
        board={anyBoard}
        {values}
        game="firing"
        canAct={ui.canAct}
        name="String viewer board {spec}"
        disabled={frozen}
        hintFor={tooltip}
        onAct={(k) => act(labelOf(anyBoard, k), api.announce)}
      />
    </div>
    {#if ready['string-history']}
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
    {/if}
    <p class="line">
      The line through {positionShown(view.through)} has <span class="numeral" data-out="string-length">{view.length}</span>
      {view.length === 1n ? 'position' : 'positions'}:
    </p>
    {#if !ready['string-line']}
      <p class="line waiting">Drawing the line.</p>
    {:else if view.elided === 0n}
      <ol class="string-line" class:flip-a={flips % 2 === 1} class:flip-b={flips > 0 && flips % 2 === 0} data-flips={flips}>
        {#each view.shown as p (p.key)}
          <li data-out="string-position" data-value={p.key} data-in-orbit={p.inOrbit ? 'true' : 'false'} data-step={String(p.step)} title={p.values.some(isLong) ? `(${p.values.join(', ')})` : undefined}>
            <span class="numeral">{positionShown(p.values)}</span>
            <span class="orbit-mark">{p.inOrbit ? 'in the orbit' : 'outside the orbit'}</span>
          </li>
        {/each}
      </ol>
    {:else}
      <ol class="string-line">
        {#each view.shown as p, k (k)}
          <li data-out="string-position" data-value={p.key} data-in-orbit={p.inOrbit ? 'true' : 'false'} data-step={String(p.step)} title={p.values.some(isLong) ? `(${p.values.join(', ')})` : undefined}>
            <span class="numeral">{positionShown(p.values)}</span>
            <span class="orbit-mark">{p.inOrbit ? 'in the orbit' : 'outside the orbit'}</span>
          </li>
          {#if view.gapAfter === k}
            <li class="gap">and {view.elided} more {view.elided === 1n ? 'position' : 'positions'}</li>
          {/if}
        {/each}
      </ol>
    {/if}
    <p class="line" data-out="string-note">{stringNote(view)}</p>
    {#if ready['string-entry']}{@render typedStart(api)}{/if}
  </section>
{/snippet}

{#snippet typedStart(api: FrameApi)}
    <form
      class="typed"
      onsubmit={(e) => {
        e.preventDefault();
        setStart(api.announce);
      }}
    >
      <fieldset class="bare">
        <legend>Type a position</legend>
        {#each labels as l, k (l)}
          <label class="entry">
            <span>Node {l}</span>
            <input type="text" inputmode="numeric" size="6" data-control="start-entry" data-entry={l} disabled={!api.hydrated || !ui.controls} bind:value={startFields[k]} />
          </label>
        {/each}
        <button type="submit" class="control" data-control="set-start" disabled={!api.hydrated || !ui.controls}>Set</button>
      </fieldset>
      {#if startMessage !== ''}<p class="line" data-out="start-message">{startMessage}</p>{/if}
    </form>
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t12" data-node-shown={nodeLabel} onkeydown={(e) => onKeydown(e, api.announce)}>
    {#if prediction && !predictionWithdrawn}
      <Predict {prediction} hydrated={api.hydrated} labels={labels} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    <!-- Each select carries its value (a number for a node, as its options) beside the selected option of the
         server markup: an option's attribute no longer moves a select the reader has used, so a state loaded
         afterwards (a link, the back button, a Serre relation moving j) is shown through the value. -->
    <div class="settings">
      <label class="setting">
        <span>Board</span>
        <select data-control="picker" value={spec} disabled={!api.hydrated || !ui.controls} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value, api.announce)}>
          {#each T12_GROUPS as g (g.letter)}
            <optgroup label="Type {g.letter}" data-letter={g.letter}>
              {#each g.names as name (name)}
                <option value={name} selected={spec === name}>{name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <label class="setting">
        <span>Node i</span>
        <select data-control="node" value={nodeLabel} disabled={!api.hydrated || !ui.controls} onchange={(e) => pickNode(Number((e.currentTarget as HTMLSelectElement).value), api.announce)}>
          {@render nodeOptions(nodeLabel, true)}
        </select>
      </label>
    </div>
    {#if building !== null}<p class="line building">{building}</p>{/if}
    <p class="facts">
      <span>Dimension: <span class="numeral" data-out="dimension">{dim}</span></span>
      <span>Minuscule: <span data-out="minuscule" data-minuscule={rep.minuscule ? 'true' : 'false'}>{rep.minuscule ? 'yes' : 'no'}</span></span>
    </p>
    <p class="line" data-out="explanation">{explanation(rep)}</p>
    {#if noMinusculeSentence(rep) !== null}<p class="line" data-out="no-minuscule">{noMinusculeSentence(rep)}</p>{/if}
    {#if limitSentence(rep) !== null}<p class="line limit" data-out="limit">{limitSentence(rep)}</p>{/if}
    {#each panels as panel (panel)}
      {#if !ready[`shell-${panel}`]}
        {#if panel === 'string' || rep.built}<section class="panel waiting" data-panel={panel} data-waiting="true"><p class="line">Drawing.</p></section>{/if}
      {:else if panel === 'string'}
        {@render stringPanel(api)}
      {:else if panel === 'orbit' && rep.built}
        {@render orbitPanel()}
      {:else if panel === 'matrices' && rep.built}
        {@render matricesPanel(api)}
      {:else if panel === 'relations' && rep.built}
        {@render relationsPanel(api)}
      {:else if panel === 'signed' && rep.built}
        {@render signedPanel()}
      {/if}
    {/each}
  </div>
{/snippet}

{#snippet table(api: FrameApi)}
  {#if !ready.table}
    <p class="line">Drawing the tables.</p>
  {:else if rep.built && !ready.orbit}
    <p class="line">Drawing the table of the orbit.</p>
  {:else if orbit !== null}
    <table class="values" data-table="orbit">
      <caption>The orbit of {omegaName(nodeLabel)} on {spec}: {rep.orbitSize} positions</caption>
      <thead>
        <tr><th scope="col">Row of the matrices</th><th scope="col">Position</th><th scope="col">Layer</th></tr>
      </thead>
      <tbody>
        {#each orbit.byBasis.slice(0, DRAW_MAX) as v (v.key)}
          <tr data-table-row={v.basisIndex + 1}><th scope="row">{v.basisIndex + 1}</th><td class="numeral">{positionText(inLabelOrder(anyBoard, v.values))}</td><td class="numeral">{v.depth}</td></tr>
        {/each}
      </tbody>
    </table>
    {#if rep.orbitSize > DRAW_MAX}<p class="line">The first {DRAW_MAX} of {rep.orbitSize} rows are listed; Download data holds them all.</p>{/if}
  {:else}
    <p class="line">{limitSentence(rep)}</p>
  {/if}
  {#if ready.table}{@render boardTable(api)}{/if}
{/snippet}

{#snippet boardTable(api: FrameApi)}
  <table class="values" data-table="board">
    <caption>The string viewer's board {spec}, after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
    <thead>
      <tr><th scope="col">Node</th><th scope="col">Number</th></tr>
    </thead>
    <tbody>
      {#each labels as l, k (l)}
        <tr>
          <th scope="row">{l}</th>
          <td>
            <button
              type="button"
              class="cell"
              data-table-board="numbers"
              data-table-node={l}
              disabled={!api.hydrated || !ui.controls}
              aria-label="Node {l}, value {speak(cur().values()[k]!)}: fire it"
              onclick={() => act(l, api.announce)}>{cur().values()[k]}</button
            >
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<ToolFrame
  toolId="rep"
  {instanceId}
  title="Representation Builder"
  caption={captionText}
  state={toolState}
  defaults={configured}
  {notice}
  {figureLabel}
  boardName={spec}
  derivedForExport={() => exportData(tool)}
  onPopState={() => {
    readLink();
  }}
  {figure}
  {table}
/>

<style>
  .t12 {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    min-width: 0;
  }
  .line,
  .facts {
    margin: 0;
    min-height: 1.5em;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 24px;
  }
  .limit {
    font-weight: bold;
  }
  .panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 8px;
    container-type: inline-size;
  }
  .panel.string {
    box-shadow: inset 0 0 0 2px var(--accent-numbers);
    border-color: transparent;
  }
  .panel-title {
    margin: 0;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .settings {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
  }
  .setting {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
  }
  select {
    min-height: 44px;
    min-width: 44px;
    max-width: 100%;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
  }
  .matrices {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  @container (min-width: 600px) {
    .matrices {
      grid-template-columns: repeat(3, minmax(0, max-content));
    }
    .matrices.two {
      grid-template-columns: repeat(2, minmax(0, max-content));
    }
  }
  .formula-line {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 16px;
    min-height: 1.5em;
  }
  .verdict {
    font-weight: bold;
  }
  .board-host {
    position: relative;
  }
  .string-line {
    margin: 0;
    padding-inline-start: 1.5em;
    display: grid;
    gap: 4px;
  }
  .string-line li {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    overflow-wrap: anywhere;
  }
  /* Firing node i turns the line end over end: a short half turn about its horizontal axis (two equal
     animations, so that each flip starts one afresh), and none under reduced motion (A-9). */
  .string-line.flip-a {
    animation: flip-a 300ms ease-out;
  }
  .string-line.flip-b {
    animation: flip-b 300ms ease-out;
  }
  @keyframes flip-a {
    from {
      transform: perspective(600px) rotateX(180deg);
    }
  }
  @keyframes flip-b {
    from {
      transform: perspective(600px) rotateX(180deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .string-line.flip-a,
    .string-line.flip-b {
      animation: none;
    }
  }
  .string-line .gap {
    list-style: none;
    font-style: italic;
  }
  .orbit-mark {
    font-style: italic;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
  .typed {
    display: grid;
    gap: 6px;
  }
  .bare {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .bare legend {
    padding: 0;
    margin-bottom: 4px;
  }
  .entry {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .entry input {
    min-height: 44px;
    min-width: 44px;
    width: 6em;
    font: inherit;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 4px;
    padding: 0 6px;
    box-sizing: border-box;
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
  .values {
    border-collapse: collapse;
  }
  .values th,
  .values td {
    padding: 2px 8px;
    text-align: center;
  }
  .values caption {
    text-align: start;
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
  .icon {
    flex: 0 0 auto;
  }
  .cell:focus-visible,
  .control:focus-visible,
  .entry input:focus-visible,
  select:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
