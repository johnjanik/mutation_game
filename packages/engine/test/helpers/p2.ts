// Shared helpers for the phase-2 tests (P2-A1 instruction section 4, plan addition). Imported by test
// files only; nothing under src/ depends on this file. The random renumbering uses fast-check's
// shuffledSubarray, so every property file keeps its own fixed seed.
import fc from 'fast-check';
import type { Board } from '../../src/board';
import { cartanNumbers } from '../../src/board';
import { bigBoard } from './p1';

/** A Board<bigint> from an integer Cartan matrix, labels 1..n unless given (bigBoard of the phase-1 helpers). */
export function boardFromCartan(C: number[][], labels?: number[]): Board<bigint> {
  return bigBoard(C, labels);
}

/** The matrix with the nodes renumbered: Cp[i][j] = C[perm[i]][perm[j]], so position i of the result is node perm[i] of C. */
export function renumber(C: number[][], perm: readonly number[]): number[][] {
  return perm.map((pi) => perm.map((pj) => C[pi]![pj]!));
}

/** A permutation of 0..n-1 as a fast-check arbitrary. */
export function permutationArb(n: number): fc.Arbitrary<number[]> {
  const ids: number[] = [];
  for (let k = 0; k < n; k++) ids.push(k);
  return fc.shuffledSubarray(ids, { minLength: n, maxLength: n });
}

/** A Board<bigint> with the matrix of `board` renumbered by `perm`, labels 1..n (a custom board, E-7). */
export function renumberedBoard(board: Board<number> | Board<bigint>, perm: readonly number[]): Board<bigint> {
  return bigBoard(renumber(cartanNumbers(board), perm));
}

/** The matrix transposed (a test-side matrix operation; the engine's transposeBoard works on boards). */
export function transposed(C: number[][]): number[][] {
  return C.map((_, i) => C.map((row) => row[i]!));
}

/** e_x + k * delta as plain numbers. */
export function unitPlusMultiple(n: number, x: number, k: number, delta: readonly number[]): number[] {
  const out: number[] = [];
  for (let j = 0; j < n; j++) out.push((j === x ? 1 : 0) + k * delta[j]!);
  return out;
}

/** The star with `arms` arms: node 0 joined to each of the others (the oracle's star boards). */
export function star(arms: number): number[][] {
  const n = arms + 1;
  const C: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(i === j ? 2 : (i === 0 || j === 0) ? -1 : 0);
    C.push(row);
  }
  return C;
}

/** The m-cycle with single roads each way, nodes in order round the cycle. */
export function cycle(m: number): number[][] {
  const C: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      const d = (((i - j) % m) + m) % m;
      row.push(i === j ? 2 : d === 1 || d === m - 1 ? -1 : 0);
    }
    C.push(row);
  }
  return C;
}

// The boards of the 5.6 rows (P2-A1 instruction section 6): the one-way road, the triangle (affine A2~),
// the star with five arms (indefinite), an unbalanced triangle, and a two-component board.
export const ONE_WAY: number[][] = [[2, 0], [-1, 2]];
export const TRIANGLE: number[][] = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];
export const STAR5: number[][] = star(5);
export const UNBALANCED_TRIANGLE: number[][] = [[2, -1, -1], [-2, 2, -1], [-1, -1, 2]];
export const A2_PLUS_TRIANGLE: number[][] = [
  [2, -1, 0, 0, 0],
  [-1, 2, 0, 0, 0],
  [0, 0, 2, -1, -1],
  [0, 0, -1, 2, -1],
  [0, 0, -1, -1, 2],
];
