// Geometry (SPEC.md 2.14, 5.4 "Geometry", E-1: floating point is allowed here and nowhere else among
// the phase-3B functions). Phase 3 (P3-A2): choleskyBasis, ported from the oracle's cholesky_basis
// (lines 1669 to 1682). P4-A1 appends symEig, euclideanBasis, coxeterPlanePoints, coxeterPlaneRings,
// coxeterWord and applyWordFloat in phase 4. The geometry functions throw NeedsTwoWayRoads on a one-way
// board and NotFiniteType off the finite types (5.6), through guards.ts, before any arithmetic.
import type { AnyBoard, Board } from './board';
import { gram } from './classify';
import { NotFiniteType } from './errors';
import { requireFinite, requireGcm } from './guards';

/**
 * The triangular Euclidean basis: the upper triangular matrix U (rows of floats) with U^T U = B = DC and a
 * positive diagonal. Column j is the picture of the simple root alpha_(j+1): alpha_1 lies along the first
 * axis with length sqrt(2 d_1), alpha_2 in the plane of the first two axes at the angle pi - pi/m to
 * alpha_1 (m = 3, 4, 6 for A_12 A_21 = 1, 2, 3; a right angle when nodes 1 and 2 are not joined), and so on.
 * B is gram(board) converted to floats as Number(num) / Number(den) (plan); entries below the diagonal
 * are exactly 0. Positive definiteness, which the square roots need, holds on finite types only.
 */
export function choleskyBasis<T>(board: Board<T>): number[][];
export function choleskyBasis(board: AnyBoard): number[][];
export function choleskyBasis<T>(board: Board<T>): number[][] {
  requireGcm(board);
  requireFinite(board);
  const B = gram(board);
  if (B === null) throw new NotFiniteType('this function needs a board of finite type; this board is not balanced');
  const n = board.n;
  const Bm: number[][] = B.map((row) => row.map((r) => Number(r.num) / Number(r.den)));
  const U: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(0);
    U.push(row);
  }
  for (let j = 0; j < n; j++) {
    let s = Bm[j]![j]!;
    for (let k = 0; k < j; k++) s -= U[k]![j]! * U[k]![j]!;
    U[j]![j] = Math.sqrt(s);
    for (let i = j + 1; i < n; i++) {
      let t = Bm[j]![i]!;
      for (let k = 0; k < j; k++) t -= U[k]![j]! * U[k]![i]!;
      U[j]![i] = t / U[j]![j]!;
    }
  }
  return U;
}
