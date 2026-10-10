// The model of T8, the Weyl Explorer (SPEC.md 4 T8; 2.6; 2.7 F5, F12; 5.4; 5.5; 5.6; E-5, E-6, E-7).
// Pure functions, no DOM. The graph is ONE orbitGraph call from all ones with legal moves only, capped
// at CAPS.weylExplorerGroup (which equals F4's order, so F4 completes: 5.5, the cap acts only "when the
// search is about to add one position more"). Its edges are the legal moves applied once more to every
// item (5.4: "The edges of a move graph are not stored by orbitGraph ... A tool that draws all of them
// applies every move to every position of items once more"); each goes one layer down (F5). Vertices
// are keyed by arith.show of the entries joined by commas (5.5). Positions inside, labels outside (E-7):
// everything returned for display is in label order, words in labels, through toLabels and toPositions.
import {
  CAPS,
  boardFromName,
  countCompleteGames,
  fire,
  orbitGraph,
  separatingRoots,
  toLabels,
  toPositions,
  weylOrder,
  wordTo,
} from '@two-games/engine';
import type { AnyBoard, Board, OrbitGraph, Word } from '@two-games/engine';

/** The 32 named types of golden_data.json, grouped by letter (the candidates of offeredBoards). */
const NAMED_TYPES: readonly string[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8',
  'F4',
  'G2',
];

let offeredCache: string[] | null = null;

/**
 * The boards T8 offers (SPEC 4 T8; 5.6 "Group order for the Weyl Explorer | 1152 | tool not
 * offered"): the named types whose group order is at most CAPS.weylExplorerGroup, in picker order.
 * Computed once (weylOrder plays one game from rho per type).
 */
export function offeredBoards(): string[] {
  if (offeredCache === null) {
    offeredCache = NAMED_TYPES.filter((name) => weylOrder(boardFromName(name)) <= CAPS.weylExplorerGroup);
  }
  return [...offeredCache];
}

/** "Above 192 group elements, edges are drawn only along the current game and around the focused vertex" (strict). */
export const ALL_EDGES_MAX = 192;

/** One legal move of the graph: from a vertex to the vertex one layer down, by the node at `node`. */
export interface WeylEdge {
  from: number;
  to: number;
  /** The node fired, as a position. */
  node: number;
  /** Its label (E-7), for the colour and the text of the edge. */
  label: number;
}

export interface WeylModel {
  board: Board<number>;
  /** The board's name as the reader chose it (D19: C2 stays C2). */
  name: string;
  graph: OrbitGraph<number>;
  /** keys[k]: the entries of item k (engine order) joined by commas, arith.show. */
  keys: string[];
  index: Map<string, number>;
  /** Every legal edge between two items (an edge to a position outside a truncated search is left out). */
  edges: WeylEdge[];
  /** The vertices drawn: all items, or, when the search was cut, the items of the complete layers. */
  drawn: number[];
  /**
   * Layer sizes, one per complete layer (0 to completeLayers). When the search was cut the sizes of
   * the incomplete layers are not given (4.0 Stated limits).
   */
  layerSizes: number[];
  /** The stated-limit sentence of SPEC 5.5, or null when nothing was cut off. */
  limit: string | null;
  /** The number of positions found (the group order when the search completed). */
  found: number;
  /** "all" at most 192 elements, "game-and-focus" above (SPEC 4 T8 Size, strict). */
  edgeMode: 'all' | 'game-and-focus';
}

/** The text key of a vector (5.5: "a hash set keyed by the entries joined as decimal text"). */
export function keyOf(board: AnyBoard, v: readonly unknown[]): string {
  const show = (board as Board<unknown>).arith.show;
  return v.map((x) => show(x)).join(',');
}

/** All ones in the board's arithmetic: rho, the start of every game T8 shows. */
export function onesOf(board: Board<number>): number[] {
  return Array.from({ length: board.n }, () => board.arith.one);
}

/**
 * The sentence of SPEC 5.5 "Order and truncation of a search" for a search cut by its cap: "stopped
 * after N positions; layers 0 to L are complete", N the number of items, L completeLayers. Null when
 * the search was not cut. T8 passes no maxDepth, so the form "stopped after L layers" never arises.
 */
export function limitSentence(graph: OrbitGraph<unknown>): string | null {
  if (!graph.truncated) return null;
  return `stopped after ${graph.items.length} positions; layers 0 to ${graph.completeLayers} are complete`;
}

/**
 * The graph of all positions reachable from all ones by legal play (SPEC 4 T8): one orbitGraph call
 * from rho, firing, legal moves only, no maxDepth, capped at `cap` (default CAPS.weylExplorerGroup;
 * the parameter lets a test force a truncation). The board must be a named finite type (SafeInt).
 */
export function buildGraph(board: AnyBoard, cap: number = CAPS.weylExplorerGroup, name?: string): WeylModel {
  const b = board as Board<number>;
  const graph = orbitGraph(b, [onesOf(b)], 'firing', cap, undefined, true);
  const keys = graph.items.map((v) => keyOf(b, v));
  const index = new Map<string, number>();
  keys.forEach((k, i) => index.set(k, i));
  const edges: WeylEdge[] = [];
  const labels = b.labels;
  for (let h = 0; h < graph.items.length; h++) {
    const v = graph.items[h]!;
    for (let i = 0; i < b.n; i++) {
      if (b.arith.sign(v[i]!) <= 0) continue;
      const to = index.get(keyOf(b, fire(b, v, i)));
      if (to === undefined) continue; // outside a truncated search
      edges.push({ from: h, to, node: i, label: labels[i]! });
    }
  }
  const complete = graph.truncated ? graph.completeLayers : graph.depthReached;
  const drawn: number[] = [];
  const layerSizes: number[] = Array.from({ length: complete + 1 }, () => 0);
  graph.depth.forEach((d, k) => {
    if (d <= complete) {
      drawn.push(k);
      layerSizes[d] = layerSizes[d]! + 1;
    }
  });
  return {
    board: b,
    name: name ?? b.name ?? 'board',
    graph,
    keys,
    index,
    edges,
    drawn,
    layerSizes,
    limit: limitSentence(graph),
    found: graph.items.length,
    edgeMode: graph.items.length > ALL_EDGES_MAX ? 'game-and-focus' : 'all',
  };
}

/** The vertex indices of the positions of a play (engine vectors), or null for one outside the graph. */
export function pathOf(model: WeylModel, positions: readonly (readonly unknown[])[]): (number | null)[] {
  return positions.map((v) => model.index.get(keyOf(model.board, v)) ?? null);
}

/** The path as vertex indices from a list of moves (labels) played from all ones; null where it leaves the graph. */
export function pathOfMoves(model: WeylModel, moves: readonly number[]): (number | null)[] {
  const b = model.board;
  let v: number[] = onesOf(b);
  const out: (number[])[] = [v];
  for (const i of toPositions(b, moves)) {
    v = fire(b, v, i);
    out.push(v);
  }
  return pathOf(model, out);
}

/**
 * The edges to draw (SPEC 4 T8 Size): every edge at most 192 elements; above, only the edges along
 * the current game and the edges at the focused vertex, both directions (into it from the layer above
 * and out of it to the layer below; plan reading of "around"). Returns edge indices, in edge order.
 */
export function edgesToDraw(model: WeylModel, path: readonly (number | null)[], focus: number | null): number[] {
  const drawnSet = new Set(model.drawn);
  const visible = (e: WeylEdge): boolean => drawnSet.has(e.from) && drawnSet.has(e.to);
  if (model.edgeMode === 'all') {
    const out: number[] = [];
    model.edges.forEach((e, k) => {
      if (visible(e)) out.push(k);
    });
    return out;
  }
  const steps = pathSteps(path);
  const out: number[] = [];
  model.edges.forEach((e, k) => {
    if (!visible(e)) return;
    if (steps.has(`${e.from},${e.to}`) || (focus !== null && (e.from === focus || e.to === focus))) out.push(k);
  });
  return out;
}

/** Whether an edge is a step of the path (from path[k] to path[k+1]). */
export function pathSteps(path: readonly (number | null)[]): Set<string> {
  const steps = new Set<string>();
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k];
    const c = path[k + 1];
    if (a !== null && a !== undefined && c !== null && c !== undefined) steps.add(`${a},${c}`);
  }
  return steps;
}

/**
 * The number of top-to-bottom paths over the tool's own edge list, by a dynamic programme over the
 * layers in bigint (independent of countCompleteGames). Null when the search was cut off (a truncated
 * graph has no bottom, and no count is presented as complete).
 */
export function countPaths(model: WeylModel): bigint | null {
  if (model.graph.truncated) return null;
  const n = model.graph.items.length;
  const ways: bigint[] = Array.from({ length: n }, () => 0n);
  ways[0] = 1n;
  // Items are in breadth-first order and every edge goes one layer down, so one pass in item order
  // over edges sorted by their source suffices.
  const out: number[][] = Array.from({ length: n }, () => []);
  for (const e of model.edges) out[e.from]!.push(e.to);
  for (let k = 0; k < n; k++) {
    const w = ways[k]!;
    if (w === 0n) continue;
    for (const t of out[k]!) ways[t] = ways[t]! + w;
  }
  const bottomDepth = model.graph.depthReached;
  let total = 0n;
  model.graph.depth.forEach((d, k) => {
    if (d === bottomDepth) total += ways[k]!;
  });
  return total;
}

/** The counter (SPEC 4 T8 bullet 2): countCompleteGames, or null above CAPS.countGamesGroup. */
export function gameCount(model: WeylModel): bigint | null {
  return countCompleteGames(model.board);
}

/** The counter's text: the decimal digits (bigint toString, never Number), or "count not offered" for null (5.6; plan wording). */
export const COUNT_NOT_OFFERED = 'count not offered';

export function countText(count: bigint | null): string {
  if (count === null) return COUNT_NOT_OFFERED;
  // No count T8 shows has more than 12 digits (F4's has 7), so 4.0 "Long numbers" never shortens one.
  return count.toString();
}

/** A vector in engine order as entries in label order (E-7), as decimal text. */
export function inLabelOrder(board: AnyBoard, v: readonly unknown[]): string[] {
  const order = [...board.labels].sort((a, b) => a - b);
  const show = (board as Board<unknown>).arith.show;
  return toPositions(board, order).map((p) => show(v[p]));
}

/** Decimal text with a true minus sign (U+2212, 6.3) for the screen. */
export function minus(text: string): string {
  return text.replace(/^-/, '−');
}

export interface VertexDetails {
  index: number;
  layer: number;
  /** The position in label order, decimal text (ASCII hyphen, as the hooks carry it). */
  position: string[];
  /** A shortest word (wordTo on the legal-only graph from all ones), in labels. */
  word: number[];
  /** The separating roots (separatingRoots), each a population in label order, in positiveRoots order. */
  roots: string[][];
}

/** What the details panel shows for vertex k (SPEC 4 T8 bullet 1). */
export function vertexDetails(model: WeylModel, k: number): VertexDetails {
  const b = model.board;
  const v = model.graph.items[k]!;
  const word: Word = wordTo(model.graph, k);
  return {
    index: k,
    layer: model.graph.depth[k]!,
    position: inLabelOrder(b, v),
    word: toLabels(b, word),
    roots: separatingRoots(b, v).map((r) => inLabelOrder(b, r)),
  };
}

/** The shortest word of vertex k in labels (the jump). */
export function wordOfVertex(model: WeylModel, k: number): number[] {
  return toLabels(model.board, wordTo(model.graph, k));
}

/** The bottom vertex (all minus ones after a complete game), or null when the search was cut. */
export function bottomVertex(model: WeylModel): number | null {
  if (model.graph.truncated) return null;
  const d = model.graph.depthReached;
  const k = model.graph.depth.lastIndexOf(d);
  return k < 0 ? null : k;
}
