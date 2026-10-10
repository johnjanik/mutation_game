// The two moves, SPEC.md 2.2 and 2.3, ported from the oracle's mutate and fire and written once,
// generic over the board's arithmetic (E-2). Both take and return positions, never write into their
// arguments or the board, and work as defined on every kind of board (5.6): no guard, no cap.
import type { Matrix, Vec } from './arith';
import type { Board } from './board';
import { determinant, solve } from './linalg';
import type { Rational } from './rational';

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

// =============================================================================================
// Phase 1 (P1-A1): the matrices S_i and R_i, the translator a = C p and its inverse, words, and the
// allowed nodes of the two rule-bound plays. Appended after P0-A2's mutate and fire, which every move
// here goes through; nothing above this line is changed. SPEC.md 2.2 to 2.4, 5.4; oracle mutation_matrix,
// firing_matrix, dynkin_labels, weight_to_root_coords, act_on_roots, act_on_weights, and the lists pos
// and unhappy inside play and raising_play.
// =============================================================================================

function checkPosition<T>(board: Board<T>, i: number): void {
  if (!Number.isInteger(i) || i < 0 || i >= board.n) {
    throw new RangeError(`position ${String(i)} is outside 0..${board.n - 1}`);
  }
}

function checkLength<T>(board: Board<T>, v: Vec<T>): void {
  if (v.length !== board.n) {
    throw new RangeError(`the vector has ${v.length} entries, but the board has ${board.n} nodes`);
  }
}

/**
 * S_i = I - e_i e_i^T C: the identity with row i replaced by e_i^T minus row i of C (SPEC.md 2.2), as plain
 * numbers whatever the arithmetic (road counts are small). S_i v equals mutate(board, v, i).
 */
export function mutationMatrix<T>(board: Board<T>, i: number): number[][] {
  checkPosition(board, i);
  const C = board.cartan as Matrix<number | bigint>;
  const n = board.n;
  const S: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) row.push((r === c ? 1 : 0) - (r === i ? Number(C[i]![c]!) : 0));
    S.push(row);
  }
  return S;
}

/**
 * R_i = I - C e_i e_i^T: the identity with column i replaced by e_i minus column i of C (SPEC.md 2.3), as
 * plain numbers. R_i v equals fire(board, v, i).
 */
export function firingMatrix<T>(board: Board<T>, i: number): number[][] {
  checkPosition(board, i);
  const C = board.cartan as Matrix<number | bigint>;
  const n = board.n;
  const R: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) row.push((r === c ? 1 : 0) - (c === i ? Number(C[r]![i]!) : 0));
    R.push(row);
  }
  return R;
}

/** The translator a = C p (SPEC.md 2.4(a); oracle dynkin_labels): a_i = sum_j C[i][j] p_j in the board's arithmetic. */
export function toNumbers<T>(board: Board<T>, p: Vec<T>): T[] {
  checkLength(board, p);
  const { arith, cartan, n } = board;
  const a: T[] = [];
  for (let i = 0; i < n; i++) {
    const row = cartan[i]!;
    let s = arith.zero;
    for (let j = 0; j < n; j++) s = arith.add(s, arith.mul(row[j]!, p[j]!));
    a.push(s);
  }
  return a;
}

/**
 * The population C^{-1} a as rationals whenever det C != 0, on any kind of board; null when C is singular
 * (SPEC.md 5.4, 5.6; oracle weight_to_root_coords, which tests the determinant and then solves).
 */
export function toPopulation<T>(board: Board<T>, a: Vec<T>): Rational[] | null {
  checkLength(board, a);
  const { arith, cartan } = board;
  const C: bigint[][] = cartan.map((row) => row.map((x) => arith.toBig(x)));
  if (determinant(C).num === 0n) return null;
  return solve(
    C,
    a.map((x) => arith.toBig(x)),
  );
}

/**
 * Plays a word in free play (SPEC.md 5.4; oracle act_on_roots, act_on_weights): for each position of the
 * word in order, mutate for 'mutation' and fire for 'firing', with no legality test. The empty word
 * returns a copy of v.
 */
export function applyWord<T>(board: Board<T>, v: Vec<T>, word: Word, game: Game): T[] {
  checkLength(board, v);
  if (game !== 'mutation' && game !== 'firing') throw new RangeError(`unknown game ${String(game)}`);
  const move = game === 'mutation' ? mutate : fire;
  let current: T[] = [...v];
  for (const i of word) current = move(board, current, i);
  return current;
}

/** The positions whose number is positive, increasing: the legal firings of SPEC.md 2.3 (the oracle's pos). */
export function legalNodes<T>(board: Board<T>, a: Vec<T>): number[] {
  checkLength(board, a);
  const out: number[] = [];
  for (let i = 0; i < board.n; i++) if (board.arith.sign(a[i]!) > 0) out.push(i);
  return out;
}

/**
 * The positions whose number (C p)_i is negative, increasing: the cities a mutation would raise, the
 * moves of Kostant's game (SPEC.md 2.4(a), 2.7 F13; the oracle's unhappy). Zero is neither legal nor raising.
 */
export function raisingNodes<T>(board: Board<T>, p: Vec<T>): number[] {
  const a = toNumbers(board, p);
  const out: number[] = [];
  for (let i = 0; i < board.n; i++) if (board.arith.sign(a[i]!) < 0) out.push(i);
  return out;
}
