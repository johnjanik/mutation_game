// The two moves, SPEC.md 2.2 and 2.3, ported from the oracle's mutate and fire and written once,
// generic over the board's arithmetic (E-2). Both take and return positions, never write into their
// arguments or the board, and work as defined on every kind of board (5.6): no guard, no cap.
import type { Vec } from './arith';
import type { Board } from './board';

export type Word = readonly number[]; // positions, in the order played
export type Game = 'mutation' | 'firing';
export type Choose<T> = (allowed: readonly number[], v: Vec<T>) => number; // picks a position among allowed

function checkMove<T>(board: Board<T>, v: Vec<T>, i: number): void {
  if (!Number.isInteger(i) || i < 0 || i >= board.n) {
    throw new RangeError(`position ${String(i)} is outside 0..${board.n - 1}`);
  }
  if (v.length !== board.n) {
    throw new RangeError(`the vector has ${v.length} entries, but the board has ${board.n} nodes`);
  }
}

/**
 * A mutation at i changes only the entry p_i: p_i <- p_i - sum_j C[i][j] p_j (row i of C).
 * The board is never changed by a mutation.
 */
export function mutate<T>(board: Board<T>, p: Vec<T>, i: number): T[] {
  checkMove(board, p, i);
  const { arith, cartan } = board;
  const row = cartan[i]!;
  let drop = arith.zero;
  for (let j = 0; j < board.n; j++) drop = arith.add(drop, arith.mul(row[j]!, p[j]!));
  const q = [...p];
  q[i] = arith.sub(p[i]!, drop);
  return q;
}

/**
 * Firing node i: a_j <- a_j - C[j][i] a_i for every j (column i of C), so a_i <- -a_i.
 * Node i sends its number down every road that leaves it, then changes sign.
 */
export function fire<T>(board: Board<T>, a: Vec<T>, i: number): T[] {
  checkMove(board, a, i);
  const { arith, cartan } = board;
  const ai = a[i]!;
  const b: T[] = [];
  for (let j = 0; j < board.n; j++) b.push(arith.sub(a[j]!, arith.mul(cartan[j]![i]!, ai)));
  return b;
}
