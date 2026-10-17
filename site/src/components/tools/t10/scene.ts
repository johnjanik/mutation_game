// T10, the Geometry Studio: the scene model (SPEC.md 4 T10; 2.14; 5.4; 5.6; E-7, E-9). Owner P4-A3.
// Pure functions with no DOM: the counts known before any enumeration (orbitSize, wythoffFVector), the
// decision of the caps (vertices drawn, edges drawn), the vertices from orbitGraph with their tree, the
// drawing coordinates y = E C^-1 a, the edges of wythoffEdges as index pairs, the face table of
// wythoffFaceTypes in labels, the engine-call hints of E-9, and the stated limits. Every number comes
// from the engine; nothing here inverts a matrix or enumerates by hand (7.3).
//
// Positions inside, labels outside (E-7): rings and vertices cross this module's boundary in label order
// and are converted with toPositions and toLabels only. On the 32 boards T10 offers the labels are 1..n
// in position order; the conversions are written anyway.
import {
  CAPS,
  boardFromName,
  cartanNumbers,
  euclideanBasis,
  fire,
  highestRoot,
  highestShortRoot,
  inverse,
  orbitGraph,
  orbitSize,
  toLabels,
  toNumbers,
  toPositions,
  wythoffEdges,
  wythoffFVector,
  wythoffFaceTypes,
} from '@two-games/engine';
import type { AnyBoard, Board, Enumeration, OrbitGraph } from '@two-games/engine';
import type { CallHint } from '../../../lib/worker';
import { T10_BOARDS } from './config';

// ---------------------------------------------------------------------------------------------
// Boards and vectors at the boundary
// ---------------------------------------------------------------------------------------------

/** True for one of the 32 names T10 offers (checked before any engine call, 5.2). */
export function isT10Board(name: unknown): name is string {
  return typeof name === 'string' && (T10_BOARDS as readonly string[]).includes(name);
}

/** The named finite board, SafeInt arithmetic (CONTRACTS 2.4 boardFromName). RangeError for any other name. */
export function t10Board(name: string): Board<number> {
  if (!isT10Board(name)) throw new RangeError(`the Geometry Studio does not offer the board ${JSON.stringify(name)}`);
  const board: AnyBoard = boardFromName(name);
  if (typeof board.arith.zero !== 'number') throw new RangeError(`${name} is not a named finite board`);
  return board as Board<number>;
}

/** The labels of a board in increasing order: the order of `rings` and of every vector shown (6.6). */
export function labelOrder(board: AnyBoard): number[] {
  return [...board.labels].sort((a, b) => a - b);
}

/** A vector in label order to positions (toPositions on the labels; nothing else converts). */
export function toPositionVector(board: AnyBoard, v: readonly number[]): number[] {
  const order = labelOrder(board);
  if (v.length !== order.length) throw new RangeError(`the vector has ${v.length} entries, but the board has ${order.length} nodes`);
  const at = toPositions(board, order);
  const out = new Array<number>(v.length);
  at.forEach((p, k) => {
    out[p] = v[k]!;
  });
  return out;
}

/** A vector in positions to label order. */
export function toLabelVector(board: AnyBoard, v: readonly number[]): number[] {
  const at = toPositions(board, labelOrder(board));
  return at.map((p) => v[p]!);
}

/** The label of a position. */
export function labelOf(board: AnyBoard, position: number): number {
  return toLabels(board, [position])[0]!;
}

/** The position of a label. */
export function positionOf(board: AnyBoard, label: number): number {
  return toPositions(board, [label])[0]!;
}

// ---------------------------------------------------------------------------------------------
// Rings: the root polytope shortcut and its second set of points (5.3; 2.14 Root polytopes)
// ---------------------------------------------------------------------------------------------

/** The rings of the root polytope, toNumbers(board, highestRoot(board)), in label order. */
export function rootPolytopeRings(board: Board<number>): number[] {
  return toLabelVector(board, toNumbers(board, highestRoot(board)));
}

/** The numbers of the highest short root in label order, or null on a simply laced board (the option is absent). */
export function shortRootRings(board: Board<number>): number[] | null {
  const short = highestShortRoot(board);
  return short === null ? null : toLabelVector(board, toNumbers(board, short));
}

/**
 * The largest ring the tool takes (plan): six digits, as the entries typed into T3 (CAPS.formFinderDigits).
 * Far below the safe range, so that no orbit of the 32 boards leaves SafeInt (the largest coefficient of a
 * root is 6), and far above any picture worth drawing; the shape depends only on which nodes are ringed.
 */
export const RING_MAX = 10 ** CAPS.formFinderDigits - 1;

/** True when the rings are one integer from 0 to RING_MAX per node. */
export function validRings(board: AnyBoard, rings: readonly unknown[]): rings is number[] {
  return rings.length === board.n && rings.every((r) => typeof r === 'number' && Number.isSafeInteger(r) && r >= 0 && r <= RING_MAX);
}

// ---------------------------------------------------------------------------------------------
// Counts before enumeration, and the decision of the caps (5.6; SPEC 4 T10 Limits)
// ---------------------------------------------------------------------------------------------

export interface Counts {
  /** orbitSize(board, rings) = |W| / |W_U|, U the unringed nodes. */
  vertices: number;
  /** wythoffFVector(board, rings): n + 1 entries, f[0] vertices ... f[n] the polytope itself. */
  fVector: bigint[];
  /** f[1], the edges of the polytope graph. */
  edges: bigint;
}

/** The exact counts of an orbit polytope, from the engine, before anything is enumerated. Rings in label order. */
export function countsOf(board: Board<number>, rings: readonly number[]): Counts {
  const r = toPositionVector(board, rings);
  const fVector = wythoffFVector(board, r);
  return { vertices: orbitSize(board, r), fVector, edges: fVector[1] ?? 0n };
}

export interface Decision {
  /** More vertices than CAPS.verticesDrawn: the tool refuses, with the orbit size, before any enumeration. */
  refused: boolean;
  /** More polytope edges than CAPS.edgesAtRest: vertices only, with the message; edges are never enumerated. */
  verticesOnly: boolean;
  /** The items of the vertex enumeration (0 when refused). */
  vertexItems: number;
  /** The items of the edge enumeration (0 when refused or vertices only). */
  edgeItems: number;
}

/** The decision of 5.9, from the exact counts only (never from a truncation). */
export function decide(counts: Counts): Decision {
  const refused = counts.vertices > CAPS.verticesDrawn;
  const verticesOnly = !refused && counts.edges > BigInt(CAPS.edgesAtRest);
  return {
    refused,
    verticesOnly,
    vertexItems: refused ? 0 : counts.vertices,
    edgeItems: refused || verticesOnly ? 0 : Number(counts.edges),
  };
}

/** The refusal (plan wording; SPEC fixes the meaning: "tool refuses, with the orbit size"). */
export function refusalText(vertices: number): string {
  return `This orbit has ${vertices} vertices, more than the ${CAPS.verticesDrawn} the studio draws.`;
}

/** The edge limit (plan wording; SPEC: "vertices only above 70000"). */
export function edgeLimitText(edges: bigint | number): string {
  return `${String(edges)} edges are more than the ${CAPS.edgesAtRest} the studio draws: vertices only.`;
}

// ---------------------------------------------------------------------------------------------
// E-9: where an enumeration runs
// ---------------------------------------------------------------------------------------------

/** The hint of an enumeration whose number of items is known in advance (orbitSize, wythoffFVector). */
export function enumerationHint(board: AnyBoard, expectedItems: number): CallHint {
  return { board, kind: 'enumeration', expectedItems, finiteKnown: true };
}

/** True when every enumeration the decision asks for has at most CAPS.mainThreadItems items (E-9). */
export function fitsMainThread(decision: Decision): boolean {
  return !decision.refused && decision.vertexItems <= CAPS.mainThreadItems && decision.edgeItems <= CAPS.mainThreadItems;
}

// ---------------------------------------------------------------------------------------------
// The orbit: vertices with their tree, and the polytope edges as index pairs
// ---------------------------------------------------------------------------------------------

/** What the tool draws: vertices in positions (numbers game), their breadth-first tree, the edges. */
export interface OrbitData {
  board: string;
  /** Label order. */
  rings: number[];
  /** Positions of the numbers game, in positions, in the engine's order (items[0] the start). */
  vertices: number[][];
  /** The tree of orbitGraph: parent index and the node (a position) fired to reach each vertex. */
  parent: (number | null)[];
  node: (number | null)[];
  /** The polytope graph as index pairs [i, j], i < j; null when not enumerated (vertices only, or not yet). */
  polytopeEdges: [number, number][] | null;
  /** The move graph as [i, j, label], i < j; null until derived (graphs.ts) or read from a file. */
  moveEdges: [number, number, number][] | null;
  source: 'preset' | 'computed';
}

/** The hashing rule of SPEC 5.5: the entries as decimal text joined by commas. */
export function keyOf(v: readonly number[]): string {
  return v.join(',');
}

/** Index of every vertex by its key. */
export function vertexIndex(vertices: readonly (readonly number[])[]): Map<string, number> {
  const index = new Map<string, number>();
  vertices.forEach((v, i) => index.set(keyOf(v), i));
  return index;
}

/** The arguments of the vertex enumeration: orbitGraph(board, [rings], 'firing', CAPS.verticesDrawn). */
export function vertexArgs(board: Board<number>, rings: readonly number[]): [Board<number>, number[][], 'firing', number] {
  return [board, [toPositionVector(board, rings)], 'firing', CAPS.verticesDrawn];
}

/** The arguments of the edge enumeration: wythoffEdges(board, rings, CAPS.edgesAtRest). */
export function edgeArgs(board: Board<number>, rings: readonly number[]): [Board<number>, number[], number] {
  return [board, toPositionVector(board, rings), CAPS.edgesAtRest];
}

/** OrbitData from an orbitGraph result; edges come later (edgesToIndices). Truncation is a bug of the decision. */
export function fromGraph(board: Board<number>, rings: readonly number[], graph: OrbitGraph<number>): OrbitData {
  if (graph.truncated) throw new Error(`the orbit of ${keyOf(rings)} on ${board.name ?? ''} was cut at ${graph.items.length} vertices`);
  return {
    board: board.name ?? '',
    rings: [...rings],
    vertices: graph.items.map((v) => [...v]),
    parent: [...graph.parent],
    node: [...graph.node],
    polytopeEdges: null,
    moveEdges: null,
    source: 'computed',
  };
}

/**
 * The edges of wythoffEdges as sorted index pairs. A truncated enumeration is never drawn (5.9: "never
 * present a partial edge set"): null. An end that is not a vertex is a bug and throws.
 */
export function edgesToIndices(vertices: readonly (readonly number[])[], edges: Enumeration<[number[], number[]]>): [number, number][] | null {
  if (edges.truncated) return null;
  const index = vertexIndex(vertices);
  const out: [number, number][] = [];
  for (const [u, v] of edges.items) {
    const i = index.get(keyOf(u));
    const j = index.get(keyOf(v));
    if (i === undefined || j === undefined) throw new Error(`the edge ${keyOf(u)} | ${keyOf(v)} has an end that is not a vertex`);
    out.push(i < j ? [i, j] : [j, i]);
  }
  return out;
}

/**
 * The whole orbit on the main thread or at build time: vertices, tree and polytope edges (when the
 * decision allows them). Callers in the browser use it only when fitsMainThread(decision) holds (E-9);
 * at build time every call runs in-process (E-9) and any size up to the caps is allowed.
 */
export function computeOrbit(board: Board<number>, rings: readonly number[], decision: Decision): OrbitData | null {
  if (decision.refused) return null;
  const data = fromGraph(board, rings, orbitGraph(...vertexArgs(board, rings)));
  if (!decision.verticesOnly) data.polytopeEdges = edgesToIndices(data.vertices, wythoffEdges(...edgeArgs(board, rings)));
  return data;
}

/** A shortest word (positions) from the start to vertex k, through the engine's wordTo on the tree. */
export function treeGraph(data: Pick<OrbitData, 'vertices' | 'parent' | 'node'>): OrbitGraph<number> {
  const depth = new Array<number>(data.vertices.length).fill(0);
  return { items: data.vertices, truncated: false, depthReached: 0, completeLayers: 0, depth, parent: data.parent, node: data.node };
}

// ---------------------------------------------------------------------------------------------
// The preset data files (P4-A2's format: site/src/components/draw/presetsT10.ts)
// ---------------------------------------------------------------------------------------------

/** The fields of a data file T10 reads. Vectors and node labels as the file holds them (label order). */
export interface PresetFile {
  board: string;
  rings: number[];
  vertices: number[][];
  adjacency: number[][];
  moveAdjacency: number[][];
  tree: { parent: (number | null)[]; node: (number | null)[] };
}

/** OrbitData from a preset file: vectors and tree nodes converted from labels to positions (E-7). */
export function fromPresetFile(board: Board<number>, file: PresetFile): OrbitData {
  if (file.board !== board.name) throw new Error(`the data file is for ${file.board}, not ${board.name ?? ''}`);
  const pairs = (lists: number[][]): [number, number][] => {
    const out: [number, number][] = [];
    lists.forEach((list, i) => {
      for (const j of list) out.push(i < j ? [i, j] : [j, i]);
    });
    return out;
  };
  const vertices = file.vertices.map((v) => toPositionVector(board, v));
  const moves: [number, number, number][] = [];
  for (const [i, j] of pairs(file.moveAdjacency)) moves.push([i, j, moveLabel(board, vertices[i]!, vertices[j]!)]);
  return {
    board: file.board,
    rings: [...file.rings],
    vertices,
    parent: [...file.tree.parent],
    node: file.tree.node.map((l) => (l === null ? null : positionOf(board, l))),
    polytopeEdges: pairs(file.adjacency),
    moveEdges: moves,
    source: 'preset',
  };
}

/**
 * The node of a move edge {mu, nu} of a file, as a label: the position k with fire(board, mu, k) = nu (the
 * move graph of the file was built that way; at most one k does it, since R_k mu - mu is a multiple of
 * alpha_k). A pair that no single firing joins is a bug of the file and throws.
 */
function moveLabel(board: Board<number>, mu: readonly number[], nu: readonly number[]): number {
  const target = keyOf(nu);
  for (let k = 0; k < mu.length; k++) {
    if (mu[k] !== 0 && keyOf(fire(board, mu, k)) === target) return labelOf(board, k);
  }
  throw new Error('a move edge of the data file joins two positions that no single firing joins');
}

// ---------------------------------------------------------------------------------------------
// Coordinates: y = E C^-1 a (2.14 item 4)
// ---------------------------------------------------------------------------------------------

/** P = E C^-1 as floats, built from euclideanBasis(board).E and the engine's exact inverse of C. Never E alone. */
export function drawingMatrix(board: Board<number>): number[][] {
  const { E } = euclideanBasis(board);
  const inv = inverse(cartanNumbers(board));
  if (inv === null) throw new Error(`${board.name ?? 'the board'} has det C = 0`);
  const C = inv.map((row) => row.map((r) => Number(r.num) / Number(r.den)));
  const n = board.n;
  const P: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += E[i]![k]! * C[k]![j]!;
      row.push(s);
    }
    P.push(row);
  }
  return P;
}

const matrices = new Map<string, number[][]>();

/** drawingMatrix, once per board name (the 32 boards are fixed objects; the cache changes no result). */
export function drawingMatrixOf(board: Board<number>): number[][] {
  const key = board.name ?? '';
  let P = matrices.get(key);
  if (P === undefined) {
    P = drawingMatrix(board);
    if (key !== '') matrices.set(key, P);
  }
  return P;
}

/** y = P a for every position a (positions; integers or the floats of make uniform). */
export function euclideanPoints(P: readonly (readonly number[])[], positions: readonly (readonly number[])[]): number[][] {
  const n = P.length;
  return positions.map((a) => {
    const y = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const row = P[i]!;
      let s = 0;
      for (let j = 0; j < n; j++) s += row[j]! * a[j]!;
      y[i] = s;
    }
    return y;
  });
}

// ---------------------------------------------------------------------------------------------
// The face table (2.14 "Faces of every dimension"; wythoffFaceTypes)
// ---------------------------------------------------------------------------------------------

export interface FaceRow {
  /** The face type K, as labels, increasing. */
  nodes: number[];
  dimension: number;
  count: bigint;
}

export interface FaceTable {
  /** Rows of dimension 0 to n - 1, grouped by dimension (the engine's mask order within a dimension). */
  rows: FaceRow[];
  /** Per-dimension totals for dimensions 0 to n - 1 (the golden f_vector has these n entries). */
  totals: bigint[];
}

/**
 * The face table of the rings (label order): one row per face type K with every component of K holding
 * a ringed node, K in labels, its dimension |K| and its count as the engine's bigint. The full node set
 * (dimension n, count 1, the polytope itself) is not a row, consistently, so the totals are the n
 * entries of the golden f_vector (plan reading of 5.4).
 */
export function faceTable(board: Board<number>, rings: readonly number[]): FaceTable {
  const types = wythoffFaceTypes(board, toPositionVector(board, rings));
  const n = board.n;
  const rows: FaceRow[] = [];
  const totals: bigint[] = new Array<bigint>(n).fill(0n);
  for (let d = 0; d < n; d++) {
    for (const t of types) {
      if (t.dimension !== d) continue;
      rows.push({ nodes: [...toLabels(board, t.nodes)].sort((a, b) => a - b), dimension: d, count: t.count });
      totals[d] = totals[d]! + t.count;
    }
  }
  return { rows, totals };
}

// ---------------------------------------------------------------------------------------------
// Words of the summary
// ---------------------------------------------------------------------------------------------

/** "1 vertex", "12 vertices". */
export function plural(count: number | bigint, one: string, many: string): string {
  return `${String(count)} ${String(count) === '1' ? one : many}`;
}
