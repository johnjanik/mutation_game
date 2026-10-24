<script lang="ts">
  // T10, the Geometry Studio (SPEC.md 4 T10; 2.14; 3 M7; 4.0; 5.6; 6.3; 6.6; 7.4 to 7.6; E-7, E-9). Owner
  // P4-A3. The reader picks one of the 32 named finite types and rings its nodes (a non-negative integer on
  // each, by clicking, by the two ring buttons, or in the table view), or presses "root polytope"; the tool
  // draws the orbit of that position of the numbers game as points in Euclidean coordinates y = E C^-1 a,
  // with the edges of the polytope graph (wythoffEdges) or of the move graph, and the table of face counts
  // by type (wythoffFaceTypes). Rank 2 is flat; rank 3 a wireframe turned by buttons, keys or a drag, with
  // a Coxeter plane view beside it; rank 4 and above the Coxeter plane or three chosen coordinates, the
  // three turning angles of the link, and rotation in any coordinate plane. Make uniform and the short
  // roots are display options outside the link. Every number comes from the engine; the mathematics is in
  // t10/*.ts, which call it. Positions inside, labels outside (E-7).
  //
  // Without JavaScript the configured state is an SVG snapshot made at build time by the same drawing code
  // (7.4): computed in-process during server rendering only (import.meta.env.SSR), and kept by hydration
  // (the client's first value of the {@html} block is a placeholder, so Svelte adopts the server's nodes).
  // After hydration a Canvas 2D drawing replaces it in the same reserved box (7.6); the SVG stays under the
  // canvas and is rewritten after the reader's changes, so that Export SVG and PNG take the current view.
  // The drawing time (data-out="drawMs") carries data-measured: a time measured on the reader's machine,
  // which no server markup can show and which is not part of the default state (RT-FIX P4-MERGE-04).
  //
  // Properties (CONTRACTS 5.2; listed in site/tests/e2e/T10.spec.ts): id, board, preset ('default' |
  // 'root-polytope' | 'rings' | 'face-table' | 'two-graphs' | 'make-uniform' | 'showpiece' |
  // 'coxeter-plane'), caption, prediction, and T10's rings, projection (the j value of 6.6), graph
  // ('polytope' | 'moves'). linkTo, coords, start, moves and layers are accepted and ignored.
  import { untrack } from 'svelte';
  import { CAPS, orbitGraph, toNumbers } from '@two-games/engine';
  import type { OrbitGraph } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import type PredictType from '../board/Predict.svelte';
  import { predictionAnswerText } from './t01/interop';
  import { isLong, shortValue } from './t01/longNumber';
  import { decodeState } from '../../lib/urlCodec';
  import { engineCall, whereToRun } from '../../lib/worker';
  import { highlight } from '../../lib/highlight';
  import type { ToolState } from '../../lib/state';
  import type { Prediction } from '../../tools/types';
  import { formatProjection, type FloatMatrix, type Projection } from '../draw/projector';
  import type { PresetManifest } from '../draw/presetsT10';
  import { T10_BOARDS, defaultProjectionText, DEFAULT_TURN, type T10Graph } from './t10/config';
  import { MANIFEST_FILE, PRESET_DIR } from './t10/presets';
  import {
    admit,
    configure,
    coreFacts,
    enumerateInTasks,
    figureText,
    fVectorText,
    isPlanePicture,
    linkNotice,
    loadPlan,
    nextTask,
    orbitKey,
    prepareInTasks,
    shortRootPositions,
    stateOf,
    viewWords,
    type CoreFacts,
    type StudioConfig,
    type StudioFacts,
  } from './t10/studio';
  import {
    clampRing,
    drawingMatrixOf,
    edgeLimitText,
    enumerationHint,
    euclideanPoints,
    fromGraph,
    fromPresetFile,
    keyOf,
    labelOf,
    labelOrder,
    plural,
    positionOf,
    RING_CAP_TEXT,
    RING_MAX,
    refusalText,
    rootPolytopeRings,
    t10Board,
    toLabelVector,
    toPositionVector,
    vertexArgs,
    type OrbitData,
    type PresetFile,
  } from './t10/scene';
  import { labelsOf, moveEdgeColour, moveGraphFitsOneTask, sharedEdgeCount, type MoveEdge } from './t10/graphs';
  import { coxeterStats, distinctDotsText, ringSizesText } from './t10/coxeter';
  import { distinctLengths, lengthText, replayVertices, shownEdgeLengths, uniformStart } from './t10/uniform';
  import { buildPicture, drawPicture, projectionOf, rotateInPlane, type Picture, type PictureColours } from './t10/drawing';
  import { snapshotOf, ssrNames } from './t10/snapshot';
  import { boardNameHtml, polytopeNameHtml, type NameLookup } from './t10/names';

  interface Props {
    id?: string;
    board?: string;
    preset?: string;
    caption?: string;
    prediction?: Prediction;
    rings?: number[];
    projection?: string;
    graph?: T10Graph;
    /** Accepted and ignored (CONTRACTS 5.2 common props that T10 has no use for). */
    linkTo?: string;
    coords?: 'populations' | 'numbers';
    start?: (number | string)[];
    moves?: number[];
    layers?: number;
  }

  let props: Props = $props();
  const uid = $props.id();
  const instanceId = untrack(() => props.id ?? '');
  const svgId = `t10-${uid}`;

  // ------------------------------------------------------------------------------------------
  // Configuration (read once: a page does not change its properties)
  // ------------------------------------------------------------------------------------------

  const configured = untrack(() => configure(props, instanceId));
  const configuredState: ToolState = stateOf(configured.config);
  const prediction = untrack(() => props.prediction);

  /** The turn step of a button or key, degrees (plan, recorded). */
  const TURN_STEP = 10;
  /** The step of a rotation in a coordinate plane, degrees (plan). */
  const PLANE_STEP = 10;
  /** Rows of the vertex table and the largest edge table (plan, A-10). */
  const VERTEX_ROWS = 200;
  const EDGE_ROWS = 300;
  /** The client's first value of the snapshot block: any non-empty text keeps the server's SVG (Svelte's {@html} hydration). */
  const KEEP_SERVER_SNAPSHOT = '<!--kept-->';
  /** Empty lists that keep their identity, so that a derived value that is empty stays unchanged. */
  const NO_EDGES: ReadonlyArray<readonly [number, number] | MoveEdge> = [];
  const NO_POINTS: number[][] = [];

  // ------------------------------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------------------------------

  // `current` is the configuration shown (figure, counts, face table); `target` the latest one asked for, which
  // the ring board, the picker and the ring table show at once. A change becomes `current` once its facts have
  // been computed in tasks of their own (t10/studio.ts prepareInTasks; 7.6: no long task on the main thread).
  let current = $state.raw<StudioConfig>(configured.config);
  let target = $state.raw<StudioConfig>(configured.config);
  let notice = $state<string | null>(null);
  let past = $state.raw<StudioConfig[]>([]);
  let future = $state.raw<StudioConfig[]>([]);
  let uniform = $state(false);
  let showShort = $state(false);
  let rotation = $state.raw<FloatMatrix | null>(null);
  let turning = $state(false);
  let predictionResolved = $state(prediction === undefined);
  /**
   * The prediction is a question about the configured state (SPEC 4.0 Predict). A link or the back button
   * that loads another state before the reader has answered withdraws it (as T1 does), so that no question
   * stands over a figure it does not describe.
   */
  let predictionWithdrawn = $state(false);
  // Predict.svelte is fetched only where a prediction is configured (lesson pages), so that the tool's own
  // route does not carry it (7.6: 90 kB); until it arrives the static question and its <details> stand.
  let PredictComponent = $state.raw<typeof PredictType | null>(null);
  $effect(() => {
    if (prediction === undefined) return;
    void import('../board/Predict.svelte').then((m) => {
      PredictComponent = m.default;
    });
  });
  let ringFocus = $state(0);
  /** The sentence of the last ring held to 0..RING_MAX (clampRing), beside the ring fields; '' after any other change. */
  let ringHeld = $state('');
  let planeA = $state(1);
  let planeB = $state(2);

  type Orbit =
    | { kind: 'refused'; key: string }
    | { kind: 'pending'; key: string; partial: OrbitData | null }
    | { kind: 'wait'; key: string; partial: OrbitData | null }
    | { kind: 'busy'; key: string; partial: OrbitData | null }
    | { kind: 'ready'; key: string; data: OrbitData }
    | { kind: 'error'; key: string; message: string; partial: OrbitData | null };

  // The orbit of the configured state: at build time the whole of it (the snapshot); in the browser the
  // vertices at once when there are at most 2000 of them (E-9: known in advance, main thread), the rest
  // from the data file or the enumerations after hydration.
  const initialFacts = coreFacts(configured.config.board, configured.config.rings);
  const ssr = import.meta.env.SSR ? snapshotOf({ ...initialFacts, config: configured.config, projection: projectionOf(configured.config.projection, initialFacts.board.n)! }, svgId) : null;
  let snapshotHtml = $state(ssr !== null ? ssr.svg : KEEP_SERVER_SNAPSHOT);
  let orbit = $state.raw<Orbit>(initialOrbit());
  // The typeset board names of names.json (7.3): in-process at build time; in the browser fetched when the
  // reader first leaves the configured board (until then the server's markup stays; t10/names.ts).
  let katex = $state.raw<NameLookup>(import.meta.env.SSR ? ssrNames() : null);
  function loadNames(): void {
    if (katex !== null) return;
    void import('./t10/typesetNames').then((m) => {
      katex = m.KATEX_NAMES;
    });
  }
  $effect(() => {
    if (current.board !== configured.config.board) untrack(loadNames);
  });

  function initialOrbit(): Orbit {
    const key = orbitKey(configured.config.board, configured.config.rings);
    if (initialFacts.decision.refused) return { kind: 'refused', key };
    // At build time, the orbit as the browser's own load on hydration leaves it (RT-FIX P4-MERGE-03): ready
    // (from the data file or the main thread), or waiting for "Draw the orbit" with its vertices when known.
    if (ssr !== null && ssr.data !== null) return ssr.ready ? { kind: 'ready', key, data: ssr.data } : { kind: 'wait', key, partial: verticesOnMain(initialFacts, configured.config) };
    return { kind: 'pending', key, partial: verticesOnMain(initialFacts, configured.config) };
  }

  /** The vertices on the main thread when the count says at most 2000 (E-9 rule 1), else null. */
  function verticesOnMain(core: Pick<StudioFacts, 'board' | 'decision'>, c: StudioConfig): OrbitData | null {
    if (core.decision.refused || whereToRun(enumerationHint(core.board, core.decision.vertexItems)) !== 'main') return null;
    return fromGraph(core.board, c.rings, orbitGraph(...vertexArgs(core.board, c.rings)) as OrbitGraph<number>);
  }

  // ------------------------------------------------------------------------------------------
  // Derived
  // ------------------------------------------------------------------------------------------

  const core = $derived(coreFacts(current.board, current.rings));
  const board = $derived(core.board);
  const n = $derived(board.n);
  const projection = $derived(projectionOf(current.projection, n) ?? projectionOf(defaultProjectionText(n), n)!);
  const facts = $derived<StudioFacts>({ ...core, config: current, projection });
  const toolState = $derived(stateOf(current));
  const key = $derived(orbitKey(current.board, current.rings));
  const P = $derived(drawingMatrixOf(board));
  const frozen = $derived(!predictionResolved);
  // The ring board shows the configuration asked for (`target`) at once; everything else shows `current`.
  const ringBoard = $derived(t10Board(target.board));
  const labels = $derived(labelOrder(ringBoard));
  const coordinates = $derived(Array.from({ length: n }, (_, k) => k + 1));
  const focusLabel = $derived(labelOf(ringBoard, Math.min(ringFocus, ringBoard.n - 1)));

  /** The orbit data that belongs to the current board and rings (complete or partial). */
  const data = $derived.by((): OrbitData | null => {
    const o = orbit;
    if (o.key !== key) return null;
    if (o.kind === 'ready') return o.data;
    if (o.kind === 'refused') return null;
    return o.partial;
  });
  const complete = $derived(orbit.kind === 'ready' && orbit.key === key);
  const orbitKind = $derived(orbit.kind);
  const uniformOn = $derived(uniform && core.uniformMatters);
  // The vertices and their tree by reference, so that adding the move graph to the data (a new object with
  // the same arrays) recomputes no coordinate and redraws nothing while the polytope graph is shown (7.6).
  const vertexList = $derived(data?.vertices ?? null);
  const treeParent = $derived(data?.parent ?? null);
  const treeNode = $derived(data?.node ?? null);
  const ys = $derived.by(() => {
    const v = vertexList;
    if (v === null) return null;
    const positions = uniformOn && treeParent !== null && treeNode !== null ? replayVertices(board, { vertices: v, parent: treeParent, node: treeNode }, uniformStart(board, current.rings)) : v;
    return euclideanPoints(P, positions);
  });
  const shortPositions = $derived(showShort && core.shortRings !== null ? shortRootPositions(board, core.shortRings) : null);
  const shortYs = $derived(shortPositions === null ? NO_POINTS : euclideanPoints(P, shortPositions));
  const edgesShown = $derived.by((): ReadonlyArray<readonly [number, number] | MoveEdge> => {
    const d = data;
    if (d === null) return NO_EDGES;
    return (current.graph === 'moves' ? d.moveEdges : d.polytopeEdges) ?? NO_EDGES;
  });
  const movesReady = $derived(data !== null && data.moveEdges !== null);
  const pictureReady = $derived(complete && (current.graph === 'polytope' || movesReady));
  const plane = $derived(isPlanePicture(projection, n, rotation));
  const stats = $derived(plane && ys !== null ? coxeterStats([...ys, ...shortYs]) : null);
  const shared = $derived(data !== null && data.polytopeEdges !== null && data.moveEdges !== null ? sharedEdgeCount(data.polytopeEdges, data.moveEdges) : null);
  const moveCount = $derived(data?.moveEdges?.length ?? null);
  const edgeCountText = $derived(current.graph === 'moves' ? (moveCount === null ? '' : String(moveCount)) : String(core.counts.edges));
  const moveLimit = $derived(current.graph === 'moves' && moveCount !== null && moveCount > CAPS.edgesAtRest ? edgeLimitText(moveCount) : '');
  const limitMessage = $derived(core.decision.verticesOnly && current.graph === 'polytope' ? edgeLimitText(core.counts.edges) : moveLimit);
  const refused = $derived(core.decision.refused ? refusalText(core.counts.vertices) : '');
  const pointCount = $derived(core.decision.refused ? 0 : core.counts.vertices + shortYs.length);
  // The squared lengths are integers, exact (2.14; RT-FIX P4-RT-04-04); above 12 digits one is shown shortened,
  // with its exact digits in the tooltip and in the export (4.0 Long numbers).
  const lengths = $derived(core.decision.refused ? [] : shownEdgeLengths(board, current.rings, uniformOn));
  const lengthValues = $derived(distinctLengths(lengths));
  const lengthShown = (text: string): string => (isLong(text) ? shortValue(text) : text);
  const lengthsTitle = $derived(lengthValues.some(isLong) ? lengthValues.join(', ') : undefined);
  const canTurn = $derived(n >= 4 || (n === 3 && projection.view.kind === 'xyz'));
  const turnText = $derived(projection.turn.map((t) => ((t % 360) + 360) % 360).join(', '));
  const figureLabel = $derived(figureText(facts, current.graph));
  const values = $derived(toPositionVector(ringBoard, target.rings));
  const spoken = $derived(values.map((v) => `${v}, ${v === 0 ? 'not ringed' : 'ringed'}`));
  const canActAll = $derived(values.map(() => true));
  const states = $derived(values.map(() => null));
  const groups = $derived.by(() => {
    const out: { letter: string; names: string[] }[] = [];
    for (const name of T10_BOARDS) {
      const letter = name[0]!;
      const g = out.find((x) => x.letter === letter);
      if (g) g.names.push(name);
      else out.push({ letter, names: [name] });
    }
    return out;
  });
  const legendLabels = $derived(current.graph === 'moves' && data?.moveEdges ? labelsOf(data.moveEdges) : []);

  // The page's highlight (7.4): a position or root of this board that another tool points at.
  const highlighted = $derived.by((): number | null => {
    const h = $highlight;
    const d = data;
    if (h === null || d === null || h.board !== current.board || !Array.isArray(h.value) || h.value.length !== n) return null;
    let a = toPositionVector(board, h.value);
    if (h.kind === 'root') a = toNumbers(board, a);
    else if (h.kind !== 'position') return null;
    const k = keyOf(a);
    const i = d.vertices.findIndex((v) => keyOf(v) === k);
    return i < 0 ? null : i;
  });

  // ------------------------------------------------------------------------------------------
  // Loading the orbit (4 T10 Presets; E-9)
  // ------------------------------------------------------------------------------------------

  let manifestPromise: Promise<PresetManifest | null> | null = null;
  async function fetchJson<T>(file: string): Promise<T> {
    const url = import.meta.env.BASE_URL + PRESET_DIR + file;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return (await response.json()) as T;
  }
  function manifest(): Promise<PresetManifest | null> {
    manifestPromise ??= fetchJson<PresetManifest>(MANIFEST_FILE).catch(() => null);
    return manifestPromise;
  }

  let loadToken = 0;
  let busyText = $state('');

  function countsSentence(f: Pick<StudioFacts, 'counts' | 'decision' | 'faces'>): string {
    if (f.decision.refused) return refusalText(f.counts.vertices);
    const faces = f.faces.totals.map(String).join(', ');
    const base = `${plural(f.counts.vertices, 'vertex', 'vertices')}, ${plural(f.counts.edges, 'edge', 'edges')}; faces by dimension ${faces}.`;
    return f.decision.verticesOnly ? `${base} ${edgeLimitText(f.counts.edges)}` : base;
  }

  /**
   * Loads the orbit of the current board and rings. `origin` 'load' (hydration, a link, the back button)
   * never starts the worker: an enumeration above 2000 items waits for "Draw the orbit"; 'reader' (a change
   * the reader made, or that button) sends it to the worker through engineCall (E-9). Every piece of
   * main-thread work runs in a task of its own (7.6): the data file is read in one task and drawn in the
   * next; the enumerations follow t10/studio.ts enumerateInTasks (the vertices, the edges, their index
   * pairs and the drawing, one task each).
   */
  async function startLoad(origin: 'load' | 'reader', announce?: (text: string) => void): Promise<void> {
    const my = ++loadToken;
    const live = (): boolean => my === loadToken;
    const c = current;
    const k = orbitKey(c.board, c.rings);
    const cf = coreFacts(c.board, c.rings);
    const f: StudioFacts = { ...cf, config: c, projection: projectionOf(c.projection, cf.board.n) ?? projectionOf(defaultProjectionText(cf.board.n), cf.board.n)! };
    busyText = '';
    if (f.decision.refused) {
      orbit = { kind: 'refused', key: k };
      return;
    }
    const keep = orbit.key === k && orbit.kind === 'ready' ? orbit.data : null;
    if (keep !== null && origin === 'load') return;
    const partial = keep ?? (orbit.key === k && orbit.kind !== 'refused' && 'partial' in orbit ? orbit.partial : null);
    orbit = { kind: 'pending', key: k, partial };
    const m = await manifest();
    if (!live()) return;
    const plan = loadPlan(f, m, origin);
    try {
      if (plan.kind === 'file') {
        const file = await fetchJson<PresetFile>(plan.file);
        if (!live()) return;
        await nextTask();
        if (!live()) return;
        const fromFile = fromPresetFile(f.board, file);
        await nextTask();
        if (!live()) return;
        orbit = { kind: 'ready', key: k, data: fromFile };
        return;
      }
      if (plan.kind === 'wait') {
        orbit = { kind: 'wait', key: k, partial };
        return;
      }
      if (plan.kind === 'refused') {
        orbit = { kind: 'refused', key: k };
        return;
      }
      if (plan.worker) {
        orbit = { kind: 'busy', key: k, partial };
        busyText = `Computing ${plural(f.counts.vertices, 'vertex', 'vertices')}${plan.edgeHint === null ? '' : ` and ${plural(f.counts.edges, 'edge', 'edges')}`} in the background.`;
        announce?.(busyText);
      }
      const result = await enumerateInTasks(f, plan, partial, {
        nextTask,
        live,
        orbitGraph: (args, hint) => engineCall('orbitGraph', args, hint) as Promise<OrbitGraph<number>>,
        wythoffEdges: (args, hint) => engineCall('wythoffEdges', args, hint),
        onVertices: (d) => {
          if (live() && orbit.key === k && orbit.kind !== 'ready') orbit = plan.worker ? { kind: 'busy', key: k, partial: d } : { kind: 'pending', key: k, partial: d };
        },
      });
      if (result === null || !live()) return;
      busyText = '';
      orbit = { kind: 'ready', key: k, data: result };
      if (plan.worker) announce?.(`Drawn: ${countsSentence(f)}`);
    } catch (err) {
      if (!live()) return;
      busyText = '';
      orbit = { kind: 'error', key: k, message: err instanceof Error ? err.message : String(err), partial };
    }
  }

  // ------------------------------------------------------------------------------------------
  // A change: its facts in tasks of their own, then shown (7.6)
  // ------------------------------------------------------------------------------------------

  let commitToken = 0;

  /** The orbit data already known for a board and rings (complete or vertices only), or null. */
  function knownData(k: string): OrbitData | null {
    const o = orbit;
    if (o.key !== k) return null;
    if (o.kind === 'ready') return o.data;
    return o.kind !== 'refused' && 'partial' in o ? o.partial : null;
  }

  /**
   * Asks for a configuration: the ring board shows it at once (`target`); its counts, face table and other
   * facts, and its vertices when they belong on the main thread, are computed in tasks of their own
   * (prepareInTasks); then it becomes `current` (figure, counts, face table), its orbit loads (startLoad),
   * and `committed` runs (the announcement with the counts). A newer request supersedes an older one.
   */
  function request(next: StudioConfig, origin: 'load' | 'reader', announce: ((t: string) => void) | undefined, committed?: (f: CoreFacts) => void): void {
    target = next;
    ringHeld = '';
    const my = ++commitToken;
    loadToken++; // the load of the configuration shown is no longer wanted
    busyText = '';
    const live = (): boolean => my === commitToken;
    const k = orbitKey(next.board, next.rings);
    void prepareInTasks(next, knownData(k), { nextTask, live })
      .then((p) => {
        if (p === null || !live()) return;
        if (target.board !== current.board) {
          rotation = null;
          showShort = false;
          planeA = 1;
          planeB = 2;
        }
        const known = orbit.key === k && (orbit.kind === 'ready' || orbit.kind === 'refused');
        if (!known) orbit = p.core.decision.refused ? { kind: 'refused', key: k } : { kind: 'pending', key: k, partial: p.vertices };
        current = target; // the board and rings asked for, with any view changed since
        void startLoad(origin, announce);
        committed?.(p.core);
      })
      .catch((err: unknown) => {
        if (!live()) return;
        current = target;
        orbit = { kind: 'error', key: k, message: err instanceof Error ? err.message : String(err), partial: null };
      });
  }

  // The move graph, derived from the vertex list once more (5.4) when it is shown, or when it is small
  // enough to give the shared count at once; in slices of at most 2000 moves, each in a task of its own,
  // the first after the task that completed the orbit (7.6; t10/moves.ts deriveInTasks).
  // The move graph's module (t10/moves.ts) is fetched when the move graph is first needed (7.6).
  let movesModule = $state.raw<typeof import('./t10/moves') | null>(null);
  let movesLoading = false;
  function loadMoves(): void {
    if (movesModule !== null || movesLoading) return;
    movesLoading = true;
    void import('./t10/moves').then((m) => {
      movesModule = m;
    });
  }

  $effect(() => {
    const o = orbit;
    const g = current.graph;
    const mod = movesModule;
    if (o.kind !== 'ready' || o.data.moveEdges !== null) return;
    const b = coreFacts(o.data.board, o.data.rings).board;
    if (g !== 'moves' && !moveGraphFitsOneTask(b.n, o.data.vertices.length)) return;
    if (mod === null) {
      untrack(loadMoves);
      return;
    }
    const builder = new mod.MoveGraphBuilder(b, o.data.vertices);
    let cancelled = false;
    void mod.deriveInTasks((budget) => builder.step(budget), { nextTask, live: () => !cancelled && orbit === o }).then((done) => {
      if (done && !cancelled && orbit === o) orbit = { ...o, data: { ...o.data, moveEdges: builder.edges } };
    });
    return () => {
      cancelled = true;
    };
  });

  // ------------------------------------------------------------------------------------------
  // Hydration: read the URL once (6.6), then load the orbit. Never a change by itself (4.0, A-9).
  // ------------------------------------------------------------------------------------------

  /**
   * Shows the state of a link (hydration, the back button): the configured state with the notice when the
   * link cannot be read; otherwise the admitted state, whose facts are computed in tasks of their own before
   * it is shown (request), so that hydration does none of a link's work (7.6). The configured state itself
   * needs nothing but its load.
   */
  function applyLink(decoded: ToolState, n0: string | null): void {
    let next: StudioConfig;
    if (n0 !== null) {
      notice = n0;
      next = configured.config;
    } else {
      const admitted = admit(decoded, false);
      notice = admitted === null ? linkNotice(decoded) : null;
      next = admitted ?? configured.config;
    }
    if (!predictionResolved && !sameConfig(next, configured.config)) {
      predictionWithdrawn = true;
      predictionResolved = true;
    }
    if (orbitKey(next.board, next.rings) !== orbitKey(target.board, target.rings)) {
      rotation = null;
      uniform = false;
      showShort = false;
    }
    if (target === current && sameConfig(next, current)) {
      void startLoad('load');
      return;
    }
    request(next, 'load', undefined);
  }

  function sameConfig(a: StudioConfig, b: StudioConfig): boolean {
    return a.board === b.board && a.rings.join('.') === b.rings.join('.') && a.projection === b.projection && a.graph === b.graph;
  }

  // The link is read in a task of its own after hydration (7.6: hydration does none of a link's work; reading
  // it resolves and classifies its board). The colours of the drawing are read first, while the page's layout
  // is still the one hydration found, so that the first drawing forces no style and layout of its own.
  $effect(() => {
    untrack(() => {
      void manifest(); // fetched while the link's facts are computed
      void nextTask().then(() => {
        colours();
        let decoded: ToolState = configuredState;
        let n0: string | null = null;
        try {
          ({ state: decoded, notice: n0 } = decodeState(window.location.search, 'geometry', configuredState, { prefix: instanceId }));
        } catch {
          // decodeState never throws on a bad link; a failure here leaves the configured state.
        }
        applyLink(decoded, n0);
      });
    });
  });

  function onPopState(state: ToolState, n0: string | null): void {
    past = [];
    future = [];
    applyLink(state, n0);
  }

  // ------------------------------------------------------------------------------------------
  // The reader's changes (rings and board go into the history; views do not)
  // ------------------------------------------------------------------------------------------

  /** A change of rings or board: into the history at once, shown once its facts are computed (request). */
  function edit(next: StudioConfig, announce: (t: string) => void, sentence: string): void {
    if (frozen) return;
    past = [...past, target];
    future = [];
    if (next.board !== target.board) ringFocus = 0;
    notice = null;
    request(next, 'reader', announce, (f) => announce(`${sentence} ${countsSentence(f)}`));
  }

  /** The live region's announcer, remembered when the figure renders (for ToolFrame's undo, redo, reset). */
  let announceFn: (text: string) => void = () => {};
  function remember(api: FrameApi): string {
    announceFn = api.announce;
    return '';
  }

  // The ring board's edits read the configuration asked for (`target`, on `ringBoard`), so that two quick
  // edits both count even when the first is not shown yet. A ring asked for outside 0..RING_MAX is held to
  // it, and that is said beside the ring fields and in the live region (4.0 Stated limits; clampRing).
  function setRing(position: number, asked: number, announce: (t: string) => void): void {
    if (frozen || !Number.isFinite(asked)) return;
    const b = ringBoard;
    const label = labelOf(b, position);
    const { value: v, held } = clampRing(label, asked);
    const rings = toPositionVector(b, target.rings);
    if (rings[position] !== v) {
      rings[position] = v;
      edit({ ...target, rings: toLabelVector(b, rings) }, announce, held ?? (v === 0 ? `Node ${label} not ringed.` : `Node ${label} ring ${v}.`));
    } else if (held !== null) announce(held);
    if (held !== null) ringHeld = held;
  }

  function toggleRing(position: number, announce: (t: string) => void): void {
    ringFocus = position;
    const v = toPositionVector(ringBoard, target.rings)[position]!;
    setRing(position, v === 0 ? 1 : 0, announce);
  }

  /** Focus entered a node button of the ring board: its label (the data-node hook) names the node the ring buttons act on. */
  function onRingFocus(event: FocusEvent): void {
    const label = Number((event.target as HTMLElement | null)?.dataset?.node);
    if (Number.isInteger(label) && ringBoard.labels.includes(label)) ringFocus = positionOf(ringBoard, label);
  }

  function stepRing(delta: number, announce: (t: string) => void): void {
    const v = toPositionVector(ringBoard, target.rings)[ringFocus] ?? 0;
    setRing(ringFocus, v + delta, announce);
  }

  function rootPolytope(announce: (t: string) => void): void {
    const rings = rootPolytopeRings(ringBoard);
    if (rings.join('.') === target.rings.join('.')) {
      announce(`The rings are already the root polytope of ${target.board}.${target === current ? ` ${countsSentence(core)}` : ''}`);
      return;
    }
    edit({ ...target, rings }, announce, `Root polytope of ${target.board}: rings ${rings.join(', ')}.`);
  }

  function pickBoard(name: string, announce: (t: string) => void): void {
    if (!(T10_BOARDS as readonly string[]).includes(name) || name === target.board) return;
    const next = admit({ board: name, rings: undefined, projection: undefined, graph: 'polytope' }, false)!;
    uniform = false;
    edit(next, announce, `Board ${name}: rings ${next.rings.join(', ')}.`);
  }

  function undo(announce: (t: string) => void): void {
    if (frozen) return;
    const prev = past[past.length - 1];
    if (prev === undefined) {
      announce('Nothing to undo.');
      return;
    }
    future = [target, ...future];
    past = past.slice(0, -1);
    request(prev, 'reader', announce, (f) => announce(`Undid an edit. Board ${prev.board}, rings ${prev.rings.join(', ')}. ${countsSentence(f)}`));
  }

  function redo(announce: (t: string) => void): void {
    if (frozen) return;
    const next = future[0];
    if (next === undefined) {
      announce('Nothing to redo.');
      return;
    }
    past = [...past, target];
    future = future.slice(1);
    request(next, 'reader', announce, (f) => announce(`Redid an edit. Board ${next.board}, rings ${next.rings.join(', ')}. ${countsSentence(f)}`));
  }

  function reset(announce: (t: string) => void): void {
    if (frozen) return;
    past = [];
    future = [];
    rotation = null;
    uniform = false;
    showShort = false;
    notice = null;
    const c = configured.config;
    request(c, 'reader', announce, (f) => announce(`Reset. Board ${c.board}, rings ${c.rings.join(', ')}. ${countsSentence(f)}`));
  }

  // Views: projection, turning, rotation in a plane, graph, options (not in the history). A view applies to
  // the configuration shown and to the one asked for, so that a change being prepared keeps it.
  function setView(fields: Pick<StudioConfig, 'projection'> | Pick<StudioConfig, 'graph'>): void {
    const settled = target === current;
    current = { ...current, ...fields };
    target = settled ? current : { ...target, ...fields };
  }

  function setProjection(next: Projection, announce: ((t: string) => void) | null): void {
    const text = formatProjection(next);
    if (text === current.projection) return;
    setView({ projection: text });
    announce?.(`${viewWords(next, n)[0]!.toUpperCase()}${viewWords(next, n).slice(1)}.`);
  }

  let turnRemainder: [number, number, number] = [0, 0, 0];
  function turnBy(d: readonly [number, number, number], announce: ((t: string) => void) | null): void {
    if (!canTurn) return;
    const acc = turnRemainder.map((r, k) => r + d[k]!) as [number, number, number];
    const whole = acc.map((x) => Math.trunc(x)) as [number, number, number];
    turnRemainder = acc.map((x, k) => x - whole[k]!) as [number, number, number];
    if (whole.every((x) => x === 0)) return;
    const turn = projection.turn.map((t, k) => (((t + whole[k]!) % 360) + 360) % 360) as [number, number, number];
    setProjection({ view: projection.view, turn }, null);
    announce?.(`Turn now ${turn.join(', ')} degrees.`);
  }

  function showCoxeter(announce: (t: string) => void): void {
    rotation = null;
    setProjection({ view: { kind: 'coxeter' }, turn: [0, 0, 0] }, announce);
  }

  function showXyz(announce: (t: string) => void): void {
    setProjection({ view: { kind: 'xyz', axes: [0, 1, 2] }, turn: [...DEFAULT_TURN] }, announce);
  }

  function setAxis(slot: number, value: number, announce: (t: string) => void): void {
    if (projection.view.kind !== 'xyz') return;
    const axes = [...projection.view.axes] as [number, number, number];
    const other = axes.indexOf(value);
    if (other >= 0 && other !== slot) axes[other] = axes[slot]!;
    axes[slot] = value;
    setProjection({ view: { kind: 'xyz', axes }, turn: [...projection.turn] }, announce);
  }

  function rotatePlane(sign: 1 | -1, announce: (t: string) => void): void {
    if (n < 4 || planeA === planeB) return;
    rotation = rotateInPlane(rotation, n, planeA - 1, planeB - 1, sign * PLANE_STEP);
    announce(`Rotated ${sign * PLANE_STEP} degrees in the plane of coordinates ${planeA} and ${planeB}.`);
  }

  function resetRotation(announce: (t: string) => void): void {
    rotation = null;
    announce('Rotation in coordinate planes undone.');
  }

  function setGraph(g: T10Graph, announce: (t: string) => void): void {
    if (g === current.graph) return;
    setView({ graph: g });
    if (g === 'moves') {
      const m = data?.moveEdges ?? null;
      announce(m === null ? 'Move graph.' : `Move graph: ${plural(m.length, 'edge', 'edges')}${shared === null ? '' : `, ${shared} shared with the polytope graph`}.`);
    } else announce(`Polytope graph: ${plural(core.counts.edges, 'edge', 'edges')}.`);
  }

  function setUniform(on: boolean, announce: (t: string) => void): void {
    uniform = on;
    announce(on ? 'Make uniform on: every base edge has the same length.' : 'Make uniform off: the integer orbit.');
  }

  function setShort(on: boolean, announce: (t: string) => void): void {
    showShort = on;
    announce(on ? `Short roots shown: ${plural(core.counts.vertices + (core.shortRings === null ? 0 : shortRootPositions(board, core.shortRings).length), 'point', 'points')}.` : 'Short roots hidden.');
  }

  function onTurnKey(event: KeyboardEvent, announce: (t: string) => void): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let d: [number, number, number] | null = null;
    if (event.key === 'ArrowUp' && !event.shiftKey) d = [TURN_STEP, 0, 0];
    else if (event.key === 'ArrowDown' && !event.shiftKey) d = [-TURN_STEP, 0, 0];
    else if (event.key === 'ArrowRight') d = event.shiftKey ? [0, 0, -TURN_STEP] : [0, TURN_STEP, 0];
    else if (event.key === 'ArrowLeft') d = event.shiftKey ? [0, 0, TURN_STEP] : [0, -TURN_STEP, 0];
    if (d === null) return;
    event.preventDefault();
    if (event.repeat) turning = true;
    turnBy(d, announce);
  }

  function onPlaneKey(event: KeyboardEvent, announce: (t: string) => void): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      rotatePlane(1, announce);
    } else if (event.key === '-') {
      event.preventDefault();
      rotatePlane(-1, announce);
    }
  }

  function endTurning(): void {
    if (turning && drag === null) turning = false;
  }

  // ------------------------------------------------------------------------------------------
  // The canvas (after hydration only)
  // ------------------------------------------------------------------------------------------

  let canvas: HTMLCanvasElement | undefined = $state();
  let boxW = $state(0);
  let drawnOnce = $state(false);
  let drawMs = $state<number | null>(null);
  let pointsDrawn = $state<number | null>(null);
  let edgesDrawn = $state<number | null>(null);
  let themeVersion = $state(0);
  let lastPicture: Picture | null = null;
  const initialKey = orbitKey(configured.config.board, configured.config.rings);
  let snapshotKey = orbitKey(configured.config.board, configured.config.rings) + `|${configured.config.projection}|${configured.config.graph}|u0|s0|r0`;

  const viewKey = $derived(`${key}|${current.projection}|${current.graph}|u${uniformOn ? 1 : 0}|s${showShort ? 1 : 0}|r${rotation === null ? 0 : 1}`);

  let colourCache: { key: string; value: PictureColours } | null = null;
  function colours(): PictureColours {
    const root = document.documentElement;
    const k = `${root.dataset.theme ?? ''}|${window.matchMedia('(prefers-color-scheme: dark)').matches}|${themeVersion}`;
    if (colourCache !== null && colourCache.key === k) return colourCache.value;
    const cs = getComputedStyle(root);
    const v = (name: string): string => cs.getPropertyValue(name).trim();
    const value: PictureColours = {
      page: v('--page'),
      text: v('--text'),
      road: v('--road'),
      focus: v('--focus-ring'),
      edges: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--edge-${i}`)),
    };
    colourCache = { key: k, value };
    return value;
  }

  // Redraw on a theme change (the manual switch sets data-theme; the system setting fires a media event).
  $effect(() => {
    const bump = (): void => {
      themeVersion++;
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => {
      mq.removeEventListener('change', bump);
      mo.disconnect();
    };
  });

  let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSnapshot(k: string): void {
    if (snapshotTimer !== null) clearTimeout(snapshotTimer);
    if (k === snapshotKey) return;
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      // The SVG writer is fetched on the first rewrite only (after a change of the reader's; 7.6).
      void import('./t10/svg').then(({ pictureSvg }) => {
        if (turning || lastPicture === null || snapshotTimer !== null) return;
        snapshotHtml = pictureSvg(lastPicture, { title: figureLabel, desc: 'The current view, drawn as SVG for export.', id: svgId });
        snapshotKey = k;
      });
    }, 400);
  }

  // Draw whenever what is shown changes, once the orbit is complete; the build of the scene and the
  // drawing are timed together (7.6), the canvas forced to rasterise by a one-pixel read-back (as the
  // drawing-time probe does).
  $effect(() => {
    const c = canvas;
    const w = boxW;
    const isTurning = turning;
    const y = ys;
    const sy = shortYs;
    const edges = edgesShown;
    const ready = pictureReady;
    const proj = projection;
    const rot = rotation;
    const hl = highlighted;
    const g = current.graph;
    const k = viewKey;
    const kind = orbitKind;
    const mod = movesModule;
    void themeVersion;
    if (c === undefined || w <= 0) return;
    if (g === 'moves' && mod === null) {
      untrack(loadMoves);
      return;
    }
    // The snapshot stays until the configured orbit is complete; after any change the canvas shows what
    // is known at once (vertices without edges while they come, an empty box for a refused orbit), so
    // that a picture of another state never stands in for the current one.
    if (!ready && key === initialKey && !untrack(() => drawnOnce) && (kind === 'pending' || kind === 'ready')) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = Math.round(w * dpr);
    if (c.width !== size) c.width = size;
    if (c.height !== size) c.height = size;
    const ctx = c.getContext('2d');
    if (ctx === null) return;
    const t0 = performance.now();
    const refusedNow = kind === 'refused';
    const picture = buildPicture(
      { rank: n, vertices: refusedNow ? [] : (y ?? []), shortRoots: refusedNow ? [] : sy, edges: y === null ? [] : edges, graph: g, projection: proj, rotation: rot, highlighted: hl },
      { width: w, height: w },
    );
    const result = drawPicture(ctx, picture, colours(), { turning: isTurning, dpr }, mod?.drawMoves);
    ctx.getImageData(0, 0, 1, 1);
    drawMs = performance.now() - t0;
    pointsDrawn = result.pointsDrawn + result.shortRootsDrawn;
    edgesDrawn = result.segmentsDrawn;
    lastPicture = picture;
    drawnOnce = true;
    if (!isTurning) scheduleSnapshot(k);
  });

  // Drag on the canvas: a convenience; every turn has buttons and keys (A-8).
  let drag: { x: number; y: number; id: number } | null = null;
  function onPointerDown(event: PointerEvent): void {
    if (!canTurn || frozen) return;
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
    canvas?.setPointerCapture?.(event.pointerId);
    turning = true;
  }
  function onPointerMove(event: PointerEvent): void {
    if (drag !== null && event.pointerId === drag.id) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      turnBy([-dy * 0.5, dx * 0.5, 0], null);
      return;
    }
    hover(event);
  }
  function onPointerUp(event: PointerEvent, announce: (t: string) => void): void {
    if (drag === null || event.pointerId !== drag.id) return;
    drag = null;
    turning = false;
    announce(`Turn now ${turnText} degrees.`);
  }

  // Hover on a small picture sets the page's highlight (7.4, plan): at most 300 points.
  let hovered: number | null = null;
  function hover(event: PointerEvent): void {
    const p = lastPicture;
    const d = data;
    if (p === null || d === null || p.vertexCount > 300 || canvas === undefined) return;
    const r = canvas.getBoundingClientRect();
    const x = event.clientX - r.left;
    const yy = event.clientY - r.top;
    let best: number | null = null;
    let dist = 10;
    for (let i = 0; i < p.vertexCount; i++) {
      const q = p.scene.points[i]!;
      const e = Math.hypot(q.x - x, q.y - yy);
      if (e < dist) {
        dist = e;
        best = i;
      }
    }
    if (best === hovered) return;
    hovered = best;
    highlight.set(best === null ? null : { kind: 'position', board: current.board, value: toLabelVector(board, d.vertices[best]!) });
  }
  function onPointerLeave(): void {
    if (hovered === null) return;
    hovered = null;
    highlight.set(null);
  }

  // ------------------------------------------------------------------------------------------
  // Export data (6.6 Data export: the derived tables shown on screen)
  // ------------------------------------------------------------------------------------------

  function exportData(): Record<string, unknown> {
    const d = data;
    const num = (x: bigint): number | string => (x <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(x) : x.toString());
    return {
      counts: { vertices: core.counts.vertices, edges: num(core.counts.edges), fVector: core.counts.fVector.slice(0, n).map(num) },
      limits: { refused: refused || null, limitMessage: limitMessage || null },
      faceTable: core.faces.rows.map((r) => ({ nodes: r.nodes, dimension: r.dimension, count: num(r.count) })),
      vertices: d === null || ys === null ? null : d.vertices.map((v, i) => ({ position: toLabelVector(board, v), y: ys![i] })),
      edges: d === null ? null : edgesShown.map((e) => (e.length === 3 ? { a: e[0], b: e[1], node: e[2] } : { a: e[0], b: e[1] })),
      graph: current.graph,
      sharedEdges: shared,
      ringSizes: stats === null ? null : stats.rings,
      distinctDots: stats === null ? null : stats.distinct,
      shortRoots: shortPositions === null ? null : shortPositions.map((v) => toLabelVector(board, v)),
      uniform: uniformOn,
      edgeLengthsSquared: lengths.map((l) => ({ node: l.label, squared: lengthText(l.squared) })),
      rotationInPlanes: rotation,
    };
  }
</script>

{#snippet figure(api: FrameApi)}
  {remember(api)}
  <div class="t10" data-board-name={current.board}>
    <p class="names">
      <span class="board-name" data-out="boardName" data-name={current.board}>{@html boardNameHtml(current.board, katex)}</span>{#if core.name !== null}<span class="sep">{': '}</span><span class="polytope-name" data-out="polytopeName">{@html polytopeNameHtml(core.name, katex)}</span>{:else}<span data-out="polytopeName"></span>{/if}
    </p>
    <div class="stage" bind:clientWidth={boxW}>
      <div class="snapshot" data-out="snapshot" aria-hidden={drawnOnce ? 'true' : undefined}>{@html snapshotHtml}<span class="anchor"></span></div>
      <!-- The text alternative sits on the canvas's box (A-10); the canvas is not a focus sink (A-1). -->
      <div class="drawing" role="img" aria-label={figureLabel} hidden={!drawnOnce} data-figure="canvas">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <canvas
          bind:this={canvas}
          class:can-turn={canTurn}
          onpointerdown={onPointerDown}
          onpointermove={onPointerMove}
          onpointerup={(e) => onPointerUp(e, api.announce)}
          onpointercancel={(e) => onPointerUp(e, api.announce)}
          onpointerleave={onPointerLeave}
        ></canvas>
      </div>
    </div>
    <div class="lines">
      <p class="line summary" data-out="summary">
        <span data-out="vertexCount">{core.counts.vertices}</span>
        {core.counts.vertices === 1 ? 'vertex' : 'vertices'},
        <span data-out="edgeCount">{edgeCountText}</span>
        {current.graph === 'moves' ? 'edges of the move graph' : 'edges of the polytope'}; points shown:
        <span data-out="pointCount">{pointCount}</span>{core.counts.vertices === 1 ? '; the orbit is one point, with nothing ringed' : ''}.
      </p>
      <p class="line">Faces by dimension: <span class="numeral" data-out="fVector">{fVectorText(facts)}</span>.</p>
      <p class="line limit" data-out="refused">{refused}</p>
      <p class="line limit" data-out="limitMessage">{limitMessage}</p>
      <p class="line" data-out="busy">{busyText}</p>
      {#if orbit.kind === 'wait' && orbit.key === key}
        <p class="line">
          This orbit needs more than {CAPS.mainThreadItems} items computed in the background.
          <button type="button" class="control" data-control="drawOrbit" disabled={!api.hydrated || frozen} onclick={() => void startLoad('reader', api.announce)}
            >Draw the orbit</button
          >
        </p>
      {/if}
      {#if orbit.kind === 'error' && orbit.key === key}
        <p class="line limit" data-error="">The orbit could not be computed: {orbit.message}</p>
      {/if}
      <p class="line">
        View: <span data-out="projection">{current.projection}</span>; turn <span data-out="turn">{turnText}</span> degrees; graph
        <span data-out="graph">{current.graph}</span>; drawn from
        <span data-out="source">{complete && data !== null ? data.source : ''}</span>.
      </p>
      <p class="line">
        Ring sizes in this plane, innermost first: <span class="numeral" data-out="ringSizes" data-radii={stats === null ? '' : stats.rings.map(([r]) => r).join(',')}
          >{stats === null ? '' : ringSizesText(stats)}</span
        >. <span data-out="distinctDots">{stats === null ? '' : (distinctDotsText(stats) ?? '')}</span>
      </p>
      <p class="line">
        Shared with the other graph: <span data-out="sharedEdges">{shared ?? ''}</span>; squared lengths of the edges at the start:
        <span class="numeral" data-out="edgeLengths" data-count={lengthValues.length} title={lengthsTitle}>{lengthValues.map(lengthShown).join(', ')}</span>
        ({lengths.map((l) => `node ${l.label}: ${lengthShown(lengthText(l.squared))}`).join('; ')}); make uniform:
        <span data-out="uniform">{core.uniformMatters ? (uniformOn ? 'on' : 'off') : 'not needed'}</span>; short roots:
        <span data-out="shortRoots">{core.shortRings === null ? 'none on this board' : showShort ? `shown, ${shortYs.length}` : 'hidden'}</span>.
      </p>
      <p class="line small">
        Drawn: <span data-out="pointsDrawn">{pointsDrawn ?? (ssr !== null ? ssr.points : '')}</span> points,
        <span data-out="edgesDrawn">{edgesDrawn ?? (ssr !== null ? ssr.segments : '')}</span> edges, in
        <span data-out="drawMs" data-measured="">{drawMs === null ? '' : (Math.round(drawMs * 10) / 10).toFixed(1)}</span> ms; edits:
        <span data-out="edits">{past.length}</span>.
      </p>
    </div>
    <div class="legend" data-out="legend">
      {#if current.graph === 'moves'}
        <span class="legend-title">Move graph, each edge in the colour of its node and labelled with it:</span>
        {#each legendLabels as l (l)}
          <span class="legend-item" data-legend-label={l}
            ><svg viewBox="0 0 24 8" width="24" height="8" aria-hidden="true" focusable="false"><line x1="1" y1="4" x2="23" y2="4" stroke={moveEdgeColour(l)} stroke-width="3" /></svg
            > node {l}</span
          >
        {/each}
      {:else}
        <span class="legend-item">Lines: edges of the polytope; dots: its vertices.</span>
      {/if}
      {#if showShort && core.shortRings !== null}
        <span class="legend-item"
          ><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false"><rect x="2" y="2" width="6" height="6" fill="none" stroke="var(--text)" stroke-width="1.5" /></svg
          > short roots, inside the hull</span
        >
      {/if}
    </div>
    {#if prediction && !predictionWithdrawn}
      {#if PredictComponent}
        <PredictComponent {prediction} hydrated={api.hydrated} {labels} announce={api.announce} onResolved={() => (predictionResolved = true)} />
      {:else}
        <!-- Before Predict.svelte arrives, and without JavaScript (4.0 Predict): the question, then a <details> with the answer
             and the reveal, in Predict.svelte's markup (the answer in .answer-text, the empty result line; RT-FIX P4-MERGE-02). -->
        <div class="predict" data-prediction="">
          <p class="question">{prediction.question}</p>
          <p class="line" data-out="predictResult"></p>
          <details class="nojs-answer">
            <summary>Answer</summary>
            <p><span class="answer-text">{predictionAnswerText(prediction)}</span></p>
            <p>{prediction.reveal}</p>
          </details>
        </div>
      {/if}
    {/if}
    <!-- The node the ring buttons act on is the last one focused (keyboard or click), never one merely hovered. -->
    <div class="rings" onfocusin={onRingFocus}>
      <Board
        board={ringBoard}
        {values}
        game="firing"
        canAct={canActAll}
        {states}
        {spoken}
        name="Rings on {target.board}"
        disabled={frozen}
        onAct={(k) => toggleRing(k, api.announce)}
      />
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="faces" data-out="faceTable" role="region" aria-label="Faces by type" tabindex="0">
      <table>
        <caption>Faces of the orbit polytope by type: a set of nodes each of whose pieces holds a ringed node, its dimension, and the number of its faces.</caption>
        <thead>
          <tr><th scope="col">Dimension</th><th scope="col">Face type (nodes)</th><th scope="col">Faces</th></tr>
        </thead>
        <tbody>
          {#each core.faces.totals as total, d (d)}
            <tr class="total" data-dimension={d}><th scope="row">{d}</th><td>all types</td><td class="numeral" data-total={d}>{String(total)}</td></tr>
            {#each core.faces.rows.filter((r) => r.dimension === d) as row (row.nodes.join('.'))}
              <tr data-face-type={row.nodes.join('.')}><td></td><td>{row.nodes.length === 0 ? 'none (vertices)' : `nodes ${row.nodes.join(', ')}`}</td><td class="numeral">{String(row.count)}</td></tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  <div class="group" role="group" aria-label="Board and rings">
    <label class="setting">
      <span>Board</span>
      <select data-control="picker" disabled={!api.hydrated || frozen} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value, api.announce)}>
        {#each groups as g (g.letter)}
          <optgroup label="Type {g.letter}" data-letter={g.letter}>
            {#each g.names as name (name)}
              <option value={name} selected={target.board === name}>{name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
    <button type="button" class="control" data-control="rootPolytope" disabled={!api.hydrated || frozen} onclick={() => rootPolytope(api.announce)}>Root polytope</button>
    <button type="button" class="control" data-control="ringUp" disabled={!api.hydrated || frozen} aria-label="Raise the ring of node {focusLabel}" onclick={() => stepRing(1, api.announce)}
      >Ring {focusLabel} up</button
    >
    <button type="button" class="control" data-control="ringDown" disabled={!api.hydrated || frozen} aria-label="Lower the ring of node {focusLabel}" onclick={() => stepRing(-1, api.announce)}
      >Ring {focusLabel} down</button
    >
    {#if core.shortRings !== null}
      <label class="check"
        ><input type="checkbox" data-control="shortRoots" disabled={!api.hydrated} checked={showShort} onchange={(e) => setShort((e.currentTarget as HTMLInputElement).checked, api.announce)} /> Short roots</label
      >
    {/if}
    <label class="check"
      ><input
        type="checkbox"
        data-control="uniform"
        disabled={!api.hydrated || !core.uniformMatters}
        checked={uniformOn}
        onchange={(e) => setUniform((e.currentTarget as HTMLInputElement).checked, api.announce)}
      /> Make uniform</label
    >
    {#if !core.uniformMatters && !core.decision.refused}<span class="note">Equal numbers on nodes of one length are uniform already.</span>{/if}
  </div>
  <div class="group" role="group" aria-label="Graph">
    <button type="button" class="control" data-control="graphPolytope" aria-pressed={current.graph === 'polytope'} disabled={!api.hydrated} onclick={() => setGraph('polytope', api.announce)}
      >Polytope graph</button
    >
    <button type="button" class="control" data-control="graphMoves" aria-pressed={current.graph === 'moves'} disabled={!api.hydrated} onclick={() => setGraph('moves', api.announce)}
      >Move graph</button
    >
  </div>
  {#if n >= 3}
    <div class="group" role="group" aria-label="View">
      <button type="button" class="control" data-control="viewCoxeter" aria-pressed={projection.view.kind === 'coxeter'} disabled={!api.hydrated} onclick={() => showCoxeter(api.announce)}
        >Coxeter plane</button
      >
      <button type="button" class="control" data-control="viewXyz" aria-pressed={projection.view.kind === 'xyz'} disabled={!api.hydrated} onclick={() => showXyz(api.announce)}
        >Three coordinates</button
      >
      {#if projection.view.kind === 'xyz'}
        {#each [0, 1, 2] as slot (slot)}
          <label class="setting"
            ><span>{['Right', 'Up', 'Depth'][slot]}</span>
            <select data-control="axis{slot + 1}" disabled={!api.hydrated} onchange={(e) => setAxis(slot, Number((e.currentTarget as HTMLSelectElement).value) - 1, api.announce)}>
              {#each coordinates as c (c)}
                <option value={c} selected={projection.view.axes[slot] === c - 1}>coordinate {c}</option>
              {/each}
            </select></label
          >
        {/each}
      {/if}
    </div>
  {/if}
  {#if canTurn}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="group turn" role="group" aria-label="Turn the picture: arrow keys, Shift with Left and Right" data-control="turnGroup" onkeydown={(e) => onTurnKey(e, api.announce)} onkeyup={endTurning}>
      <button type="button" class="control" data-control="turnUp" aria-label="Turn about the horizontal axis, the top toward you" disabled={!api.hydrated} onclick={() => turnBy([TURN_STEP, 0, 0], api.announce)}>Up</button>
      <button type="button" class="control" data-control="turnDown" aria-label="Turn about the horizontal axis, the top away from you" disabled={!api.hydrated} onclick={() => turnBy([-TURN_STEP, 0, 0], api.announce)}>Down</button>
      <button type="button" class="control" data-control="turnLeft" aria-label="Turn about the vertical axis, to the left" disabled={!api.hydrated} onclick={() => turnBy([0, -TURN_STEP, 0], api.announce)}>Left</button>
      <button type="button" class="control" data-control="turnRight" aria-label="Turn about the vertical axis, to the right" disabled={!api.hydrated} onclick={() => turnBy([0, TURN_STEP, 0], api.announce)}>Right</button>
      <button type="button" class="control" data-control="turnCounter" aria-label="Turn about the viewing axis, counterclockwise" disabled={!api.hydrated} onclick={() => turnBy([0, 0, TURN_STEP], api.announce)}
        >Counterclockwise</button
      >
      <button type="button" class="control" data-control="turnClock" aria-label="Turn about the viewing axis, clockwise" disabled={!api.hydrated} onclick={() => turnBy([0, 0, -TURN_STEP], api.announce)}>Clockwise</button>
    </div>
  {/if}
  {#if n >= 4}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="group" role="group" aria-label="Rotate in a coordinate plane: plus and minus keys" data-control="planeGroup" onkeydown={(e) => onPlaneKey(e, api.announce)}>
      <label class="setting"
        ><span>Plane of coordinates</span>
        <select data-control="planeA" disabled={!api.hydrated} onchange={(e) => (planeA = Number((e.currentTarget as HTMLSelectElement).value))}>
          {#each coordinates as c (c)}<option value={c} selected={planeA === c}>{c}</option>{/each}
        </select></label
      >
      <label class="setting"
        ><span>and</span>
        <select data-control="planeB" disabled={!api.hydrated} onchange={(e) => (planeB = Number((e.currentTarget as HTMLSelectElement).value))}>
          {#each coordinates as c (c)}<option value={c} selected={planeB === c}>{c}</option>{/each}
        </select></label
      >
      <button type="button" class="control" data-control="rotatePlus" disabled={!api.hydrated || planeA === planeB} onclick={() => rotatePlane(1, api.announce)}>Rotate +{PLANE_STEP}</button>
      <button type="button" class="control" data-control="rotateMinus" disabled={!api.hydrated || planeA === planeB} onclick={() => rotatePlane(-1, api.announce)}>Rotate −{PLANE_STEP}</button>
      <button type="button" class="control" data-control="rotateReset" disabled={!api.hydrated || rotation === null} onclick={() => resetRotation(api.announce)}>No rotation</button>
    </div>
  {/if}
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values" data-table="rings">
    <caption>Rings on {target.board}: one non-negative integer per node</caption>
    <thead><tr><th scope="col">Node</th><th scope="col">Ring</th></tr></thead>
    <tbody>
      {#each labels as l, j (l)}
        <tr data-row={l}>
          <th scope="row">
            <button
              type="button"
              class="cell"
              data-table-node={l}
              disabled={!api.hydrated || frozen}
              aria-label="Node {l}, value {target.rings[j]}, {target.rings[j] === 0 ? 'not ringed' : 'ringed'}"
              onclick={() => toggleRing(positionOf(ringBoard, l), api.announce)}>Node {l}</button
            >
          </th>
          <td
            ><input
              type="number"
              min="0"
              max={RING_MAX}
              step="1"
              class="ring-input"
              data-table-ring={l}
              aria-label="Ring of node {l}"
              aria-describedby="{svgId}-cap"
              value={target.rings[j]}
              disabled={!api.hydrated || frozen}
              onchange={(e) => {
                const field = e.currentTarget as HTMLInputElement;
                setRing(positionOf(ringBoard, l), Number(field.value), api.announce);
                field.value = String(target.rings[j]); // the ring itself, also when a typed value was held and nothing changed
              }}
            /></td
          >
        </tr>
      {/each}
    </tbody>
  </table>
  <!-- The cap of the rings beside their fields, and the sentence when a ring asked for is held to it (4.0 Stated limits). -->
  <p class="ring-cap" id="{svgId}-cap" data-out="ringLimit">{RING_CAP_TEXT}{ringHeld ? ` ${ringHeld}` : ''}</p>
  {#if data !== null && ys !== null}
    <table class="values" data-table="vertices">
      <caption>Vertices: {data.vertices.length}{data.vertices.length > VERTEX_ROWS ? ` (the first ${VERTEX_ROWS} listed)` : ''}. Position in the numbers game and Euclidean coordinates to three decimals.</caption>
      <thead><tr><th scope="col">Vertex</th><th scope="col">Numbers</th><th scope="col">Coordinates</th></tr></thead>
      <tbody>
        {#each data.vertices.slice(0, VERTEX_ROWS) as v, i (i)}
          <tr data-table-vertex={i}><td class="numeral">{i + 1}</td><td class="numeral">({toLabelVector(board, v).join(', ')})</td><td class="numeral">({ys[i]!.map((x) => (Math.round(x * 1000) / 1000 + 0).toFixed(3)).join(', ')})</td></tr>
        {/each}
      </tbody>
    </table>
    {#if edgesShown.length > 0 && edgesShown.length <= EDGE_ROWS}
      <table class="values" data-table="edges">
        <caption>Edges of the {current.graph === 'moves' ? 'move graph, with the node of each' : 'polytope'}: {edgesShown.length}</caption>
        <thead><tr><th scope="col">From vertex</th><th scope="col">To vertex</th>{#if current.graph === 'moves'}<th scope="col">Node</th>{/if}</tr></thead>
        <tbody>
          {#each edgesShown as e, i (i)}
            <tr><td class="numeral">{e[0] + 1}</td><td class="numeral">{e[1] + 1}</td>{#if current.graph === 'moves'}<td class="numeral">{(e as readonly number[])[2]}</td>{/if}</tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
{/snippet}

<ToolFrame
  toolId="geometry"
  {instanceId}
  title="Geometry Studio"
  caption={configured.caption}
  state={toolState}
  defaults={configuredState}
  {notice}
  boardName={current.board}
  derivedForExport={exportData}
  onUndo={() => undo(announceFn)}
  onRedo={() => redo(announceFn)}
  onReset={() => reset(announceFn)}
  {onPopState}
  {figure}
  {controls}
  {table}
/>

<style>
  .t10 {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .names {
    margin: 0;
    min-height: 1.5em;
  }
  .stage {
    position: relative;
    width: 100%;
    max-width: 480px;
    aspect-ratio: 1 / 1;
    margin-inline: auto;
    overflow: hidden;
  }
  .snapshot,
  .drawing {
    position: absolute;
    inset: 0;
  }
  .snapshot :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .anchor {
    display: none;
  }
  .drawing[hidden] {
    display: none;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: pinch-zoom;
  }
  canvas.can-turn {
    cursor: grab;
    touch-action: none;
  }
  .lines {
    display: grid;
    gap: 2px;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .line:empty {
    min-height: 0;
  }
  .small {
    font-size: 14px;
  }
  .limit {
    font-weight: bold;
  }
  .numeral,
  .summary {
    font-variant-numeric: tabular-nums;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    align-items: center;
    font-size: 14px;
  }
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .faces {
    max-height: 320px;
    overflow: auto;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
  .faces:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .faces table {
    border-collapse: collapse;
    width: 100%;
  }
  .faces caption {
    text-align: start;
    padding: 4px 8px;
  }
  .faces th,
  .faces td {
    padding: 2px 8px;
    text-align: start;
  }
  .faces .total {
    border-top: 1px solid var(--sign-zero-outline);
    font-weight: bold;
  }
  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
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
  .control[aria-pressed='true'] {
    border-width: 3px;
    font-weight: bold;
  }
  .control:disabled {
    cursor: default;
  }
  .control:focus-visible,
  .cell:focus-visible,
  select:focus-visible,
  input:focus-visible {
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
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .check input {
    width: 24px;
    height: 24px;
    margin: 0;
  }
  .note {
    font-size: 14px;
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
  .ring-input {
    width: 4em;
    min-height: 44px;
    font: inherit;
  }
</style>
