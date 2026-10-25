// T10, the Geometry Studio: the data that the registry entry and the component share (SPEC.md 4 T10,
// 2.14, 3 M7, 6.6; CONTRACTS.md 5.2 and 6). Owner P4-A3. This module imports nothing: the registry
// module that reads it is loaded on every tool page (the codec reads the registry), so it stays small.
//
// Board names are the 32 named finite types (SPEC 4 T10 "For the named finite types"; 4.0 Board
// pickers). Rings are in label order (E-7). The configurations are the figure table of M7 (beats 1 to
// 6); captions state the result in words and carry no golden number (COMMON 4.4): the counts appear in
// the tool's own output lines, computed by the engine.

/** The boards T10 offers, grouped by letter in the picker (SPEC 2.8; D19: named as the reader chose them). */
export { T10_BOARDS } from './boards';

export type T10Graph = 'polytope' | 'moves';

/**
 * The default turn of a wireframe, in whole degrees about the horizontal, vertical and viewing axes
 * (6.6 `j`): a fixed angle that is not degenerate, so that the snapshot shows depth (plan, recorded).
 */
export const DEFAULT_TURN: readonly [number, number, number] = [20, 30, 0];

/** The j value of a wireframe on coordinates 1, 2, 3 at the default turn. */
export const WIREFRAME_123 = `xyz:1,2,3@${DEFAULT_TURN.join(',')}`;

/**
 * The default projection of a rank (plan; P4-A2's defaultProjection with T10's turn): the plane itself
 * for rank 1 and 2 (`coxeter`, flat), the wireframe of coordinates 1, 2, 3 at the default turn for rank 3,
 * and the Coxeter plane from rank 4 on.
 */
export function defaultProjectionText(rank: number): string {
  return rank === 3 ? WIREFRAME_123 : 'coxeter';
}

/** The preset ids of CONTRACTS 6 for T10, plus `default` (4.0 and the registry contract). */
export type T10PresetId = 'default' | 'root-polytope' | 'rings' | 'face-table' | 'two-graphs' | 'make-uniform' | 'showpiece' | 'coxeter-plane';

/** The state fields a preset fixes (6.6 names), and its caption (4.0 Configuration). */
export interface T10Preset {
  board: string;
  /** One non-negative integer per node, in label order. */
  rings: number[];
  projection: string;
  graph: T10Graph;
  caption: string;
  /**
   * True for `root-polytope`: placed on another board (M7 beat 1 places it on A2, A3 and D4), the rings
   * are that board's root polytope, toNumbers(board, highestRoot(board)), computed by the tool (plan).
   */
  rootPolytope?: true;
}

export const DEFAULT_CAPTION =
  'The roots of A3 as points in space: the root polytope, a cuboctahedron, drawn as a wireframe that the buttons turn. Ring other nodes, by clicking them, and the orbit, its edges and the table of its faces change with them.';
export const ROOT_POLYTOPE_CAPTION =
  'The roots of the board as points in Euclidean space, joined by the edges of the root polytope: the convex hull of all the roots is the orbit of the highest root.';
export const RINGS_CAPTION =
  'One ring on the first node of A3: the orbit of that position is a tetrahedron. Click the nodes to ring others and watch the polytope change.';
export const FACE_TABLE_CAPTION =
  'The polytope of B3 with rings on its two end nodes. The table counts its faces of every dimension, type by type, from the board alone.';
export const TWO_GRAPHS_CAPTION =
  'The hexagon of A2 carries two graphs on the same points: the polytope graph joins neighbours in space, the move graph joins positions one move apart. Switch between them and compare their edges.';
export const MAKE_UNIFORM_CAPTION =
  'B3 with equal numbers on its last two nodes: the orbit has the shape of a truncated cube, with edges of two lengths. Make uniform replaces the numbers by real ones so that every edge has the same length.';
export const SHOWPIECE_CAPTION =
  'The roots of E8 in its Coxeter plane: concentric rings of points, each root joined to its nearest neighbours by the edges of the root polytope.';
export const COXETER_PLANE_CAPTION =
  'The roots of D4 in its Coxeter plane: different roots land on the same point, and the tool states how many distinct dots remain.';

/**
 * The presets (CONTRACTS 6; SPEC 3 M7 figure table, beats 1 to 6). Rings are the configurations the
 * figure table names; the unit test checks each root polytope against toNumbers(board, highestRoot(board))
 * and the golden numbers_of_highest_root, and every configuration against its preset data file.
 */
export const T10_PRESETS: Readonly<Record<T10PresetId, T10Preset>> = {
  default: { board: 'A3', rings: [1, 0, 1], projection: WIREFRAME_123, graph: 'polytope', caption: DEFAULT_CAPTION },
  'root-polytope': { board: 'D4', rings: [0, 1, 0, 0], projection: WIREFRAME_123, graph: 'polytope', caption: ROOT_POLYTOPE_CAPTION, rootPolytope: true },
  rings: { board: 'A3', rings: [1, 0, 0], projection: WIREFRAME_123, graph: 'polytope', caption: RINGS_CAPTION },
  'face-table': { board: 'B3', rings: [1, 0, 1], projection: WIREFRAME_123, graph: 'polytope', caption: FACE_TABLE_CAPTION },
  'two-graphs': { board: 'A2', rings: [1, 1], projection: 'coxeter', graph: 'polytope', caption: TWO_GRAPHS_CAPTION },
  'make-uniform': { board: 'B3', rings: [0, 1, 1], projection: WIREFRAME_123, graph: 'polytope', caption: MAKE_UNIFORM_CAPTION },
  showpiece: { board: 'E8', rings: [0, 0, 0, 0, 0, 0, 0, 1], projection: 'coxeter', graph: 'polytope', caption: SHOWPIECE_CAPTION },
  'coxeter-plane': { board: 'D4', rings: [0, 1, 0, 0], projection: 'coxeter', graph: 'polytope', caption: COXETER_PLANE_CAPTION },
};

export const T10_PRESET_IDS = Object.keys(T10_PRESETS) as T10PresetId[];

/** Every data-out name T10 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T10.spec.ts). */
export const T10_OUTS = [
  // ToolFrame
  'caption',
  'notice',
  'noscript',
  'exportNotice',
  // rendered after a click on Cite (P6-A5; MERGE, on P6-tikz's request)
  'citeText',
  // T10: the figure
  'snapshot',
  'boardName',
  'polytopeName',
  'summary',
  'vertexCount',
  'edgeCount',
  'pointCount',
  'pointsDrawn',
  'edgesDrawn',
  'fVector',
  'faceTable',
  'ringSizes',
  'distinctDots',
  'sharedEdges',
  'graph',
  'projection',
  'turn',
  'uniform',
  'edgeLengths',
  'shortRoots',
  'limitMessage',
  'refused',
  'busy',
  'source',
  'drawMs',
  'edits',
  'legend',
  // T10: the table view
  'ringLimit',
  // Predict.svelte, with a prediction (lesson instances such as M7 beats 4 and 7)
  'predictResult',
  'predictReveal',
] as const;

export type T10Out = (typeof T10_OUTS)[number];

/**
 * The names of T10_OUTS rendered only when a property asks for them (a prediction), never by the tool's
 * own state; the checks of "every name is rendered" on /tools/geometry/ leave them out (RT-FIX residual of
 * P3-RT-10-06; site/tests/e2e/registry-outs.spec.ts checks them on a lesson instance).
 */
export const T10_PROP_ONLY_OUTS: readonly T10Out[] = ['predictResult', 'predictReveal'];
