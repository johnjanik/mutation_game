// T10, the Geometry Studio: the view model that the component and the build-time snapshot share (SPEC.md
// 4 T10; 2.14; 6.6; 7.4; 7.5). Owner P4-A3. Pure, no DOM. From a state (board, rings, projection, graph)
// it gives what is cheap and exact (counts, decision, face table, names, projection) and, once the orbit
// is known, what is drawn (coordinates, edges of the graph shown, the Coxeter-plane statistics, the
// picture). The snapshot of 7.4 is the same picture rendered as SVG by the same code, in Node.
import { CAPS, orbitGraph, toPositions } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import type { ToolState } from '../../../lib/state';
import { whereToRun, type CallHint } from '../../../lib/worker';
import { formatProjection, type FloatMatrix, type Projection } from '../../draw/projector';
import { presetFor, type PresetManifest } from '../../draw/presetsT10';
import { defaultProjectionText, type T10Graph } from './config';
import { coxeterStats, distinctDotsText, ringSizesText, type PlaneStats } from './coxeter';
import { buildPicture, pictureSvg, projectionOf, type Box, type Picture } from './drawing';
import { moveEdges, sharedEdgeCount, type MoveEdge } from './graphs';
import { polytopeName, polytopeNamePlain } from './names';
import { presetOf } from './presets';
import {
  computeOrbit,
  countsOf,
  decide,
  drawingMatrixOf,
  edgeLimitText,
  enumerationHint,
  euclideanPoints,
  faceTable,
  isT10Board,
  plural,
  refusalText,
  shortRootRings,
  t10Board,
  toPositionVector,
  validRings,
  rootPolytopeRings,
  type Counts,
  type Decision,
  type FaceTable,
  type OrbitData,
} from './scene';
import { replayVertices, uniformMatters, uniformStart } from './uniform';

/** The state fields T10 reads (6.6), normalised: a board it offers, valid rings and projection, a graph. */
export interface StudioConfig {
  board: string;
  rings: number[];
  projection: string;
  graph: T10Graph;
}

/** The ToolState of a configuration. */
export function stateOf(c: StudioConfig): ToolState {
  return { schema: 1, tool: 'geometry', board: c.board, rings: [...c.rings], projection: c.projection, graph: c.graph };
}

/**
 * Checks a state against the rules of the tool before any engine call (5.1, 5.2): a board of the 32, one
 * non-negative integer per node, a projection that applies to the rank. Answers the normalised
 * configuration, or null when the state is not one the tool can show (a link: the default with the
 * notice). A missing field takes the fallback: rings the root polytope, projection the default for the
 * rank, graph the polytope graph.
 */
export function admit(state: Pick<ToolState, 'board' | 'rings' | 'projection' | 'graph'>, strict: boolean): StudioConfig | null {
  if (!isT10Board(state.board)) return null;
  const board = t10Board(state.board);
  let rings: number[];
  if (state.rings === undefined) rings = rootPolytopeRings(board);
  else if (validRings(board, state.rings)) rings = [...state.rings];
  else return null;
  let projection = state.projection ?? defaultProjectionText(board.n);
  const parsed = projectionOf(projection, board.n);
  if (parsed === null) {
    if (strict) return null;
    projection = defaultProjectionText(board.n);
  } else {
    projection = formatProjection(parsed);
  }
  return { board: state.board, rings, projection, graph: state.graph ?? 'polytope' };
}

/** The properties that configure an instance (4.0 Configuration; CONTRACTS 5.2; listed in the test files). */
export interface ConfigProps {
  board?: string;
  preset?: string;
  rings?: number[];
  projection?: string;
  graph?: T10Graph;
  caption?: string;
}

/**
 * The configured state of an instance: the preset (default `default`), with the page author's board,
 * rings, projection and graph over it. A board other than the preset's takes its own root polytope as
 * rings (the picker's rule, 5.2; M7 beat 1 places `root-polytope` on A2, A3 and D4) unless rings are
 * given; a projection that does not apply to the rank becomes the default of the rank. A board T10 does
 * not offer, or rings that are not one non-negative integer per node, are an authoring error: thrown at
 * build time with the instance id.
 */
export function configure(props: ConfigProps, instance: string): { config: StudioConfig; caption: string } {
  const { preset } = presetOf(props.preset);
  const board = props.board ?? preset.board;
  const where = `T10 instance "${instance || 'geometry'}"`;
  if (!isT10Board(board)) throw new Error(`${where}: the Geometry Studio does not offer the board ${JSON.stringify(board)} (SPEC 4 T10: the 32 named finite types)`);
  const rings = props.rings ?? (board === preset.board ? preset.rings : rootPolytopeRings(t10Board(board)));
  const config = admit({ board, rings, projection: props.projection ?? preset.projection, graph: props.graph ?? preset.graph }, false);
  if (config === null) throw new Error(`${where}: rings ${JSON.stringify(props.rings)} are not one non-negative integer per node of ${board}`);
  return { config, caption: props.caption ?? preset.caption };
}

/** The key of a board and rings (the orbit drawn depends on nothing else). */
export function orbitKey(board: string, rings: readonly number[]): string {
  return `${board}:${rings.join('.')}`;
}

// ---------------------------------------------------------------------------------------------
// The cheap, exact part (computed at once on every load and every change)
// ---------------------------------------------------------------------------------------------

export interface StudioFacts {
  board: Board<number>;
  config: StudioConfig;
  projection: Projection;
  counts: Counts;
  decision: Decision;
  faces: FaceTable;
  /** The golden polytope name of the configuration, or null (5.15). */
  name: string | null;
  /** The rings of the highest short root, or null on a simply laced board (the option is absent). */
  shortRings: number[] | null;
  /** Whether make uniform changes the picture (5.7). */
  uniformMatters: boolean;
}

/** What depends on the board and the rings only (the expensive part: counts and face table). */
export type CoreFacts = Omit<StudioFacts, 'config' | 'projection'>;

const coreCache = new Map<string, CoreFacts>();
const CORE_CACHE_SIZE = 24;

/**
 * The core facts of a board and rings (label order), computed once and kept for the last few
 * configurations (plan: undo, redo and turning never recompute the face table; the same object is
 * returned, so a derived value that reads it does not change). Pure: the cache changes no result.
 */
export function coreFacts(boardName: string, rings: readonly number[]): CoreFacts {
  const key = `${boardName}:${rings.join('.')}`;
  const hit = coreCache.get(key);
  if (hit !== undefined) {
    coreCache.delete(key);
    coreCache.set(key, hit);
    return hit;
  }
  const board = t10Board(boardName);
  const counts = countsOf(board, rings);
  const core: CoreFacts = {
    board,
    counts,
    decision: decide(counts),
    faces: faceTable(board, rings),
    name: polytopeName(boardName, rings),
    shortRings: shortRootRings(board),
    uniformMatters: uniformMatters(board, rings),
  };
  coreCache.set(key, core);
  if (coreCache.size > CORE_CACHE_SIZE) coreCache.delete(coreCache.keys().next().value!);
  return core;
}

export function factsOf(config: StudioConfig): StudioFacts {
  const core = coreFacts(config.board, config.rings);
  const projection = projectionOf(config.projection, core.board.n);
  if (projection === null) throw new RangeError(`the projection ${config.projection} does not apply to ${config.board}`);
  return { ...core, config, projection };
}

/** Uncached, for the timing test of the main-thread work (7.6). */
export function uncachedCore(boardName: string, rings: readonly number[]): CoreFacts {
  coreCache.delete(`${boardName}:${rings.join('.')}`);
  return coreFacts(boardName, rings);
}

/** The f-vector the tool shows: the n entries of dimensions 0 to n - 1, as the golden f_vector. */
export function fVectorText(facts: StudioFacts): string {
  return facts.counts.fVector.slice(0, facts.board.n).map(String).join(', ');
}

/** The limit sentences of a configuration (5.9), or empty strings. */
export function limitTexts(facts: StudioFacts): { refused: string; limit: string } {
  return {
    refused: facts.decision.refused ? refusalText(facts.counts.vertices) : '',
    limit: facts.decision.verticesOnly ? edgeLimitText(facts.counts.edges) : '',
  };
}

/** The view in words, for the summary and the text alternative. */
export function viewWords(projection: Projection, n: number): string {
  if (n === 1) return 'on a line';
  if (n === 2) return 'in the plane';
  const [h, v, w] = projection.turn.map((t) => ((t % 360) + 360) % 360);
  const turned = h === 0 && v === 0 && w === 0 ? '' : `, turned ${h}, ${v} and ${w} degrees`;
  if (projection.view.kind === 'coxeter') return `in the Coxeter plane${turned}`;
  return `on coordinates ${projection.view.axes.map((k) => k + 1).join(', ')}${turned}`;
}

/** The text alternative of the figure (A-10): board, rings, counts, name, view; plain words (no markup). */
export function figureText(facts: StudioFacts, graph: T10Graph): string {
  const { config, counts, decision } = facts;
  const parts = [`Geometry Studio on ${config.board}, rings ${config.rings.join(', ')}`];
  if (decision.refused) parts.push(refusalText(counts.vertices));
  else {
    parts.push(`${plural(counts.vertices, 'vertex', 'vertices')} and ${plural(counts.edges, 'edge', 'edges')} ${viewWords(facts.projection, facts.board.n)}`);
    if (decision.verticesOnly) parts.push('vertices only');
    else if (graph === 'moves') parts.push('the move graph is shown');
  }
  if (facts.name !== null) parts.push(polytopeNamePlain(facts.name));
  return `${parts.join('; ')}.`;
}

// ---------------------------------------------------------------------------------------------
// Where the orbit comes from (4 T10 Presets; E-9; 7.6)
// ---------------------------------------------------------------------------------------------

/** How a configuration gets its vertices and edges. */
export type LoadPlan =
  | { kind: 'refused' }
  /** A build-time data file of the manifest (bare file name): fetched, no engine enumeration, no worker. */
  | { kind: 'file'; file: string }
  /** The enumerations through engineCall with their hints (whereToRun sends each where E-9 says). */
  | { kind: 'enumerate'; vertexHint: CallHint; edgeHint: CallHint | null; worker: boolean }
  /**
   * An enumeration of more than 2000 items at load time (a link or a placed figure that is not
   * precomputed): nothing is enumerated until the reader presses "Draw the orbit" (E-9: no tool needs
   * the worker for its default state; worker-on-demand.spec.ts).
   */
  | { kind: 'wait'; vertexHint: CallHint; edgeHint: CallHint | null };

/**
 * The plan of a load (`origin` 'load': hydration, a link, the back button) or of a change the reader made
 * ('reader': a ring, the picker, the shortcut, undo). A precomputed configuration always opens from its
 * file; otherwise the two enumerations carry hints with the exact counts; at load, one that whereToRun
 * would send to the worker waits for the reader's button.
 */
export function loadPlan(facts: StudioFacts, manifest: PresetManifest | null, origin: 'load' | 'reader'): LoadPlan {
  if (facts.decision.refused) return { kind: 'refused' };
  const entry = manifest === null ? null : presetFor(manifest, facts.config.board, facts.config.rings);
  if (entry !== null) return { kind: 'file', file: entry.file };
  const vertexHint = enumerationHint(facts.board, facts.decision.vertexItems);
  const edgeHint = facts.decision.verticesOnly ? null : enumerationHint(facts.board, facts.decision.edgeItems);
  const worker = whereToRun(vertexHint) === 'worker' || (edgeHint !== null && whereToRun(edgeHint) === 'worker');
  if (worker && origin === 'load') return { kind: 'wait', vertexHint, edgeHint };
  return { kind: 'enumerate', vertexHint, edgeHint, worker };
}

// ---------------------------------------------------------------------------------------------
// The drawn part (once the orbit is known)
// ---------------------------------------------------------------------------------------------

export interface DrawOptions {
  uniform: boolean;
  shortRoots: boolean;
  rotation: FloatMatrix | null;
  highlighted: number | null;
}

export interface Drawn {
  /** Euclidean coordinates of the vertices (integer orbit, or the uniform replay). */
  ys: number[][];
  /** Euclidean coordinates of the short roots shown (empty when off or absent). */
  shortYs: number[][];
  /** The edges of the graph shown (index pairs; move edges with their labels). */
  edges: ReadonlyArray<readonly [number, number] | MoveEdge>;
  /** Rings and distinct dots when the picture is the Coxeter plane (or the plane itself), else null. */
  stats: PlaneStats | null;
  /** The number of edges both graphs share, when both are known. */
  shared: number | null;
}

/** The short roots: the orbit of the numbers of the highest short root (at most 288 points, E-9 known size). */
export function shortRootPositions(board: Board<number>, shortRings: readonly number[]): number[][] {
  const g = orbitGraph(board, [toPositionVector(board, shortRings)], 'firing', CAPS.mainThreadItems);
  return g.items.map((v) => [...v]);
}

/** True when the picture is a plane seen face on: the Coxeter view at no tilt (and no plane rotation), any rank 1 or 2 view. */
export function isPlanePicture(projection: Projection, n: number, rotation: FloatMatrix | null): boolean {
  if (n === 1) return false;
  if (n === 2) return true;
  return projection.view.kind === 'coxeter' && projection.turn[0] % 360 === 0 && projection.turn[1] % 360 === 0 && rotation === null;
}

export function drawnOf(facts: StudioFacts, data: OrbitData, options: DrawOptions, P: readonly (readonly number[])[], shortPositions: number[][] | null): Drawn {
  const { board, config } = facts;
  const positions = options.uniform && facts.uniformMatters ? replayVertices(board, data, uniformStart(board, config.rings)) : data.vertices;
  const ys = euclideanPoints(P, positions);
  const shortYs = options.shortRoots && shortPositions !== null ? euclideanPoints(P, shortPositions) : [];
  const edges = config.graph === 'moves' ? (data.moveEdges ?? []) : (data.polytopeEdges ?? []);
  let stats: PlaneStats | null = null;
  if (isPlanePicture(facts.projection, board.n, options.rotation)) {
    // The picture's own plane: coordinates 1 and n of y, turned in the plane by the third angle (a
    // rotation, which changes neither radius nor coincidence).
    stats = coxeterStats([...ys, ...shortYs]);
  }
  const shared = data.polytopeEdges !== null && data.moveEdges !== null ? sharedEdgeCount(data.polytopeEdges, data.moveEdges) : null;
  return { ys, shortYs, edges, stats, shared };
}

export function pictureOf(facts: StudioFacts, drawn: Drawn, options: DrawOptions, box: Box): Picture {
  return buildPicture(
    {
      rank: facts.board.n,
      vertices: drawn.ys,
      shortRoots: drawn.shortYs,
      edges: drawn.edges,
      graph: facts.config.graph,
      projection: facts.projection,
      rotation: options.rotation,
      highlighted: options.highlighted,
    },
    box,
  );
}

/** The distinct-dot sentence and the ring sizes of a drawn picture ('' when they do not apply). */
export function planeTexts(drawn: Drawn | null): { distinct: string; rings: string; radii: string } {
  if (drawn === null || drawn.stats === null) return { distinct: '', rings: '', radii: '' };
  return {
    distinct: distinctDotsText(drawn.stats) ?? '',
    rings: ringSizesText(drawn.stats),
    radii: drawn.stats.rings.map(([r]) => String(r)).join(', '),
  };
}

// ---------------------------------------------------------------------------------------------
// The snapshot of 7.4 (build time, in Node: every engine call in-process, E-9)
// ---------------------------------------------------------------------------------------------

/** The box of the snapshot, in CSS pixels; the SVG scales to the figure's width (plan, as the drawing-time probe). */
export const SNAPSHOT_BOX: Box = { width: 360, height: 360 };

export interface Snapshot {
  svg: string;
  data: OrbitData | null;
  drawn: Drawn | null;
  points: number;
  segments: number;
  labels: number;
}

/**
 * The SVG of a configuration at rest with the integer orbit, as the tool first shows it: computed in-process
 * (orbitGraph, wythoffEdges, the move graph when it is the graph shown), projected with the configured
 * projection, rendered by renderSvg (polytope graph) or pictureSvg (move graph), with the colour tokens.
 * A refused orbit gives the empty box with its text alternative; a vertices-only orbit, the points alone.
 */
export function snapshotOf(facts: StudioFacts, id: string): Snapshot {
  const data = computeOrbit(facts.board, facts.config.rings, facts.decision);
  const options: DrawOptions = { uniform: false, shortRoots: false, rotation: null, highlighted: null };
  let drawn: Drawn | null = null;
  if (data !== null) {
    if (facts.config.graph === 'moves') data.moveEdges = moveEdges(facts.board, data.vertices);
    drawn = drawnOf(facts, data, options, drawingMatrixOf(facts.board), null);
  }
  const empty: Drawn = { ys: [], shortYs: [], edges: [], stats: null, shared: null };
  const picture = pictureOf(facts, drawn ?? empty, options, SNAPSHOT_BOX);
  const svg = pictureSvg(picture, { title: figureText(facts, facts.config.graph), desc: 'A snapshot made at build time.', id });
  const segments = facts.decision.verticesOnly || drawn === null ? 0 : drawn.edges.length;
  return {
    svg,
    data,
    drawn,
    points: drawn?.ys.length ?? 0,
    segments: Math.min(segments, segments > CAPS.edgesAtRest ? 0 : segments),
    labels: facts.config.graph === 'moves' ? segments : 0,
  };
}

export { shortRootRings, rootPolytopeRings, refusalText, edgeLimitText };
