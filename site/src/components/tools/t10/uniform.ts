// T10, the Geometry Studio: "make uniform" (SPEC.md 4 T10 Make uniform; 2.14 Edge lengths; 2.5). Owner
// P4-A3. A display option computed in floating point [D]: the start is replaced by the real vector with
// a_i = c / sqrt(d_i) on the ringed nodes (d = symmetrizer(board)), and the shortest words that the engine
// keeps for the vertices (orbitGraph's tree, wordTo) are replayed with applyWordFloat. The combinatorics
// do not change, so the edges keep their index pairs.
//
// The constant c is the largest ringed integer (plan, recorded): the picture keeps its size. The base edge
// from lambda to R_i lambda has squared length a_i^2 (alpha_i, alpha_i) = 2 d_i a_i^2; with a_i = c / sqrt(d_i)
// every one of them is 2 c^2, which is what "uniform" means. The lengths shown are measured on the drawn
// coordinates y = E C^-1 a, not taken from the formula, and agree with it (unit test).
import { applyWordFloat, symmetrizer, wordTo } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import { euclideanPoints, labelOf, toPositionVector, treeGraph, type OrbitData } from './scene';

/** d_i as floats, in positions (B3: 2, 2, 1; C3: 1, 1, 2; G2: 1, 3). */
export function symmetrizerFloats(board: Board<number>): number[] {
  const d = symmetrizer(board);
  if (d === null) throw new Error(`${board.name ?? 'the board'} is not balanced`);
  return d.map((r) => Number(r.num) / Number(r.den));
}

/** The constant c of make uniform: the largest ringed integer (plan). 0 when nothing is ringed. */
export function uniformConstant(rings: readonly number[]): number {
  return Math.max(0, ...rings);
}

/** The real start a_i = c / sqrt(d_i) on the ringed nodes, 0 elsewhere, in positions. Rings in label order. */
export function uniformStart(board: Board<number>, rings: readonly number[]): number[] {
  const c = uniformConstant(rings);
  const d = symmetrizerFloats(board);
  return toPositionVector(board, rings).map((r, i) => (r === 0 ? 0 : c / Math.sqrt(d[i]!)));
}

/**
 * False when every ringed node has the same d_i (one ringed node; B3 (1,1,0)): equal numbers are already
 * uniform and the option changes nothing (the tool says so and disables it, plan).
 */
export function uniformMatters(board: Board<number>, rings: readonly number[]): boolean {
  const d = symmetrizerFloats(board);
  const r = toPositionVector(board, rings);
  const ds = new Set<number>();
  r.forEach((x, i) => {
    if (x !== 0) ds.add(d[i]!);
  });
  if (ds.size > 1) return true;
  // The same d_i everywhere: uniform exactly when the ringed integers are equal.
  return new Set(r.filter((x) => x !== 0)).size > 1;
}

/**
 * The vertices replayed in floating point: vertex k is applyWordFloat(board, start, wordTo(tree, k),
 * 'firing'). Computed along the tree, each vertex from its parent's real position by the one move that
 * reached it, which is the same sequence of float operations as replaying its whole word (unit test).
 */
export function replayVertices(board: Board<number>, data: Pick<OrbitData, 'vertices' | 'parent' | 'node'>, start: readonly number[]): number[][] {
  const out: number[][] = new Array(data.vertices.length);
  for (let k = 0; k < data.vertices.length; k++) {
    const p = data.parent[k];
    const i = data.node[k];
    if (p === null || p === undefined || i === null || i === undefined) {
      out[k] = [...start];
      continue;
    }
    const from = out[p];
    if (from === undefined) throw new Error('a vertex comes before its parent in the tree');
    out[k] = applyWordFloat(board, from, [i], 'firing');
  }
  return out;
}

/** The same, replaying every whole word from the start (the plain reading of 4 T10; used by the unit test). */
export function replayWholeWords(board: Board<number>, data: Pick<OrbitData, 'vertices' | 'parent' | 'node'>, start: readonly number[]): number[][] {
  const g = treeGraph(data);
  return data.vertices.map((_, k) => applyWordFloat(board, start, wordTo(g, k), 'firing'));
}

export interface EdgeLength {
  /** The label of the ringed node i. */
  label: number;
  /** |y(lambda) - y(R_i lambda)|^2 on the drawn coordinates. */
  squared: number;
}

/** The squared length of the base edge at each ringed node, measured on y = P a (start in positions). */
export function baseEdgeLengths(board: Board<number>, P: readonly (readonly number[])[], start: readonly number[]): EdgeLength[] {
  const out: EdgeLength[] = [];
  const [y0] = euclideanPoints(P, [start]);
  for (let i = 0; i < board.n; i++) {
    if (start[i] === 0) continue;
    const [y1] = euclideanPoints(P, [applyWordFloat(board, start, [i], 'firing')]);
    let s = 0;
    for (let k = 0; k < y0!.length; k++) s += (y0![k]! - y1![k]!) ** 2;
    out.push({ label: labelOf(board, i), squared: s });
  }
  return out.sort((a, b) => a.label - b.label);
}

/** A squared length as text: rounded to 6 decimals, trailing zeros dropped ("4", "2", "1.333333"). */
export function lengthText(x: number): string {
  const r = Math.round(x * 1e6) / 1e6 + 0;
  return String(r);
}

/** The distinct squared lengths, as text, increasing. */
export function distinctLengths(lengths: readonly EdgeLength[]): string[] {
  return [...new Set(lengths.map((l) => lengthText(l.squared)))].sort((a, b) => Number(a) - Number(b));
}
