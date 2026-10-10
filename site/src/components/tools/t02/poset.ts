// "Positive roots only" (SPEC.md 4 T2; 2.2; 2.4(a); 2.7 F1, F13; D7). The positive root populations
// among the garden's positions, in layers by total population, with an edge from p to S_i p whenever
// that mutation raises city i. The rise is -a_i with a = C p (the number on node i is the drop a
// mutation would cause there, 2.4(a); D7's default), never Wildberger's gain -Cp.
import { CAPS, mutate, positiveRoots, raisingNodes, toNumbers } from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import { isNamedFinite, keyOf, type Vector } from './garden';

export interface PosetEdge {
  from: number; // index into vertices
  to: number;
  node: number; // position of the raised city
  label: number; // its label (E-7)
  rise: bigint; // -a_i, positive
}

export interface PositiveView {
  /** The positive roots sorted by total, then lexicographically (5.4), as positiveRoots gives them. */
  vertices: Vector[];
  /** The total of each vertex (the layer it is drawn in). */
  totals: bigint[];
  /** layers[k]: the vertices of the k-th total present, in the order of `vertices`. */
  layers: { total: bigint; members: number[] }[];
  edges: PosetEdge[];
  /** 'lines' on a named finite-type board (1, 2, 3 lines); 'numeral' on every other board. */
  riseStyle: 'lines' | 'numeral';
}

function bigOf(board: AnyBoard, x: unknown): bigint {
  return (board.arith as Board<unknown>['arith']).toBig(x);
}

/**
 * The view for the garden grown to `maxDepth`: positiveRoots(board, CAPS.gardenPositions, maxDepth)
 * runs the same search as the garden and returns its positive items sorted by total, then
 * lexicographically. Edges: for each p, each city of raisingNodes(board, p) whose mutation lands in
 * the view.
 */
export function positiveView(board: AnyBoard, maxDepth: number | undefined): PositiveView {
  const b = board as Board<unknown>;
  const vertices: Vector[] = positiveRoots(b, CAPS.gardenPositions, maxDepth);
  const totals = vertices.map((v) => v.reduce<bigint>((s, x) => s + bigOf(board, x), 0n));
  const index = new Map<string, number>();
  vertices.forEach((v, k) => index.set(keyOf(board, v), k));
  const layers: { total: bigint; members: number[] }[] = [];
  totals.forEach((t, k) => {
    const last = layers[layers.length - 1];
    if (last !== undefined && last.total === t) last.members.push(k);
    else layers.push({ total: t, members: [k] });
  });
  const edges: PosetEdge[] = [];
  vertices.forEach((p, k) => {
    const a = toNumbers(b, p);
    for (const i of raisingNodes(b, p)) {
      const q = mutate(b, p, i);
      const t = index.get(keyOf(board, q));
      if (t === undefined) continue;
      edges.push({ from: k, to: t, node: i, label: board.labels[i]!, rise: -bigOf(board, a[i]) });
    }
  });
  return { vertices, totals, layers, edges, riseStyle: isNamedFinite(board) ? 'lines' : 'numeral' };
}

/** The view as lists of entries layer by layer (what the acceptance compares with positive_roots). */
export function layeredEntries(board: AnyBoard, view: PositiveView): string[][][] {
  const show = (board.arith as Board<unknown>['arith']).show;
  return view.layers.map((l) => l.members.map((k) => view.vertices[k]!.map((x) => show(x))));
}
