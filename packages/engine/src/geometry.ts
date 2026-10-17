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

// =============================================================================================
// Phase 4 (P4-A1): symEig, euclideanBasis, coxeterPlanePoints, coxeterPlaneRings, coxeterWord and
// applyWordFloat, appended after P3-A2's choleskyBasis; nothing above this line is changed. SPEC.md 2.14
// (the four steps of the Euclidean recipe, the Coxeter plane), 5.4 "Geometry", 5.5 "Eigenvectors", 5.6.
// Ports of the oracle's sym_eig (reference/lie_games.py lines 1604 to 1631), euclidean_basis (1634 to
// 1644), coxeter_plane_points (1647 to 1650), coxeter_plane_rings (1653 to 1660) and coxeter_word (1663 to
// 1666), in the oracle's order of operations, so that the floats agree with the oracle's. applyWordFloat
// has no oracle: it is applyWord's formulas on floats. Floating point is allowed here (E-1). Guards (5.6):
// every function that takes a board throws NeedsTwoWayRoads on a one-way board and NotFiniteType off the
// finite types, through guards.ts (E-11); symEig takes a matrix, not a board, and has no guard (plan).
// Eigenvector signs and the bases of repeated eigenvalues are not unique (5.5): callers and tests use
// invariants, never individual coordinates.
// =============================================================================================
import { cartanNumbers } from './board';
import { CAPS } from './caps';
import { symmetrizer } from './classify';
import { EngineError } from './errors';
import { coxeterNumber } from './guards';
import type { Game, Word } from './moves';
import { roots } from './search';
import { bipartition } from './weyl';

/** The result of coxeterPlaneRings (CONTRACTS.md 2.4 phase 4), with the golden field names. */
export interface CoxeterPlaneRings {
  rings: [number, number][];
  distinct_points: number;
  h_points_on_every_ring: boolean;
}

function guardFiniteBoard<T>(board: Board<T>): void {
  requireGcm(board);
  requireFinite(board);
}

/**
 * Eigenvalues (ascending) and eigenvectors (as rows, orthonormal) of a real symmetric matrix by the cyclic
 * Jacobi method with at most 60 sweeps, stopping when the sum of the squares off the diagonal is below
 * 1e-22 (the oracle's sym_eig, operation for operation: columns p, q of A, then rows p, q, then columns
 * p, q of V, each reading the old values first). The sort of the indices by the diagonal is stable.
 * vectors[k] is the k-th column of V, the eigenvector of values[k]. No guard (a matrix, not a board); the
 * caller passes a symmetric matrix (not checked, as in the oracle). RangeError on a matrix that is not
 * square (plan).
 */
export function symEig(M: readonly (readonly number[])[]): { values: number[]; vectors: number[][] } {
  const n = M.length;
  for (const row of M) {
    if (!Array.isArray(row) || row.length !== n) throw new RangeError('symEig needs a square matrix');
  }
  const A: number[][] = M.map((row) => row.map((x) => Number(x)));
  const V: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(i === j ? 1 : 0);
    V.push(row);
  }
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) if (i !== j) off += A[i]![j]! * A[i]![j]!;
    }
    if (off < 1e-22) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p]![q]!) < 1e-300) continue;
        const th = (A[q]![q]! - A[p]![p]!) / (2 * A[p]![q]!);
        const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k]![p]!;
          const akq = A[k]![q]!;
          A[k]![p] = c * akp - s * akq;
          A[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p]![k]!;
          const aqk = A[q]![k]!;
          A[p]![k] = c * apk - s * aqk;
          A[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k]![p]!;
          const vkq = V[k]![q]!;
          V[k]![p] = c * vkp - s * vkq;
          V[k]![q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => A[a]![a]! - A[b]![b]!);
  return {
    values: order.map((i) => A[i]![i]!),
    vectors: order.map((i) => V.map((row) => row[i]!)),
  };
}

/**
 * The Euclidean basis of SPEC.md 2.14 (oracle euclidean_basis): G = D^(1/2) C D^(-1/2) with d the
 * symmetrizer as floats, its eigenvalues ascending and eigenvectors from symEig, and
 * E[k][j] = sqrt(max(lambda_k, 0)) v_k[j] sqrt(d_j), that is E = Lambda^(1/2) V^T D^(1/2), so that
 * E^T E = B = DC and y = E p are coordinates in which the form is the dot product. Rows 0 and n - 1 span the
 * Coxeter plane (exponents 1 and h - 1). A position a is drawn at E C^(-1) a (step 4, the caller's job with
 * toPopulation). The factor Lambda^(1/2) is not optional (2.14). Finite only (5.6).
 */
export function euclideanBasis<T>(board: Board<T>): { E: number[][]; eigenvalues: number[] };
export function euclideanBasis(board: AnyBoard): { E: number[][]; eigenvalues: number[] };
export function euclideanBasis<T>(board: Board<T>): { E: number[][]; eigenvalues: number[] } {
  guardFiniteBoard(board);
  const sym = symmetrizer(board);
  if (sym === null) throw new NotFiniteType('this function needs a board of finite type; this board is not balanced');
  const d = sym.map((r) => Number(r.num) / Number(r.den));
  const C = cartanNumbers(board as unknown as AnyBoard);
  const n = board.n;
  const G: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push((Math.sqrt(d[i]!) * C[i]![j]!) / Math.sqrt(d[j]!));
    G.push(row);
  }
  const { values, vectors } = symEig(G);
  const E: number[][] = [];
  for (let k = 0; k < n; k++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(Math.sqrt(Math.max(values[k]!, 0)) * vectors[k]![j]! * Math.sqrt(d[j]!));
    E.push(row);
  }
  return { E, eigenvalues: values };
}

/** Numeric lexicographic order of integer vectors (the oracle's sorted on tuples of ints). */
function lexCompare(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < a.length && k < b.length; k++) if (a[k] !== b[k]) return a[k]! - b[k]!;
  return a.length - b.length;
}

/**
 * The roots projected to the Coxeter plane (oracle coxeter_plane_points): the roots of the board, all of
 * them, sorted lexicographically by their entries as integers, and for root r the point
 * (sum_j E[0][j] r_j, sum_j E[n-1][j] r_j). One point per root, the k-th point belonging to the k-th
 * sorted root (plan: the order is fixed). Finite only (5.6).
 */
export function coxeterPlanePoints<T>(board: Board<T>): [number, number][];
export function coxeterPlanePoints(board: AnyBoard): [number, number][];
export function coxeterPlanePoints<T>(board: Board<T>): [number, number][] {
  const { E } = euclideanBasis(board);
  const n = board.n;
  const R = roots(board, CAPS.workerPositions);
  if (R.truncated) throw new EngineError('the roots of a finite board exceed the search cap');
  const toBig = board.arith.toBig;
  const sorted = R.items.map((r) => r.map((x) => Number(toBig(x)))).sort(lexCompare);
  const top = E[0]!;
  const bottom = E[n - 1]!;
  return sorted.map((r) => {
    let x = 0;
    let y = 0;
    for (let j = 0; j < n; j++) x += top[j]! * r[j]!;
    for (let j = 0; j < n; j++) y += bottom[j]! * r[j]!;
    return [x, y];
  });
}

/**
 * x rounded to 6 decimals as Math.round(x * 1e6) / 1e6, with a negative zero normalised to 0 (SPEC.md 5.4:
 * "-0 counted as 0"; Math.round of a small negative number is -0). Internal to the engine (exported for
 * the unit test of the rule; not part of the public API).
 */
export function round6(x: number): number {
  const r = Math.round(x * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}

/**
 * Ring sizes and distinct points of a list of points (the body of coxeterPlaneRings, plan helper):
 * radii round6(hypot(x, y)) grouped and sorted ascending, innermost first; distinct points counted on the
 * pairs (round6(x), round6(y)) keyed as text after the minus-zero normalisation; every ring holding
 * exactly h points. Internal to the engine (exported for the unit test of the minus-zero rule).
 */
export function ringsOfPoints(points: readonly (readonly [number, number])[], h: number): CoxeterPlaneRings {
  const counts = new Map<number, number>();
  const distinct = new Set<string>();
  for (const [x, y] of points) {
    const radius = round6(Math.hypot(x, y));
    counts.set(radius, (counts.get(radius) ?? 0) + 1);
    distinct.add(`${round6(x)},${round6(y)}`);
  }
  const rings: [number, number][] = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  return { rings, distinct_points: distinct.size, h_points_on_every_ring: rings.every(([, c]) => c === h) };
}

/**
 * The rings of the roots in the Coxeter plane (oracle coxeter_plane_rings with 6 digits, and the field
 * h_points_on_every_ring that verify.py line 1203 adds): rings as [radius, number of roots], radii rounded
 * to 6 decimals, innermost first; the number of distinct rounded points with -0 counted as 0; whether every
 * ring holds exactly h = coxeterNumber(board) roots. Finite only (5.6).
 */
export function coxeterPlaneRings<T>(board: Board<T>): CoxeterPlaneRings;
export function coxeterPlaneRings(board: AnyBoard): CoxeterPlaneRings;
export function coxeterPlaneRings<T>(board: Board<T>): CoxeterPlaneRings {
  const points = coxeterPlanePoints(board);
  return ringsOfPoints(points, coxeterNumber(board));
}

/**
 * The bipartite Coxeter element as a word (oracle coxeter_word): every node of the colour class of
 * position 0 in increasing order, then every node of the other class in increasing order, with the classes
 * of bipartition (the least position of each component has colour 0). Its mutations rotate the Coxeter
 * plane by exactly 2 pi / h (2.14 [V]). Finite only (5.6); a finite board is a forest, so bipartition never
 * returns null after the guard (EngineError if it does, plan).
 */
export function coxeterWord<T>(board: Board<T>): Word;
export function coxeterWord(board: AnyBoard): Word;
export function coxeterWord<T>(board: Board<T>): Word {
  guardFiniteBoard(board);
  const parts = bipartition(board);
  if (parts === null) throw new EngineError('a board of finite type has no odd cycle, but this one has');
  const [c0, c1] = parts;
  const [first, second] = c0.includes(0) ? [c0, c1] : [c1, c0];
  return [...[...first].sort((a, b) => a - b), ...[...second].sort((a, b) => a - b)];
}

/**
 * applyWord on a vector of floats (SPEC.md 5.4, for the "make uniform" display): for each position i of
 * the word in order, a mutation replaces v_i by v_i - sum_j C[i][j] v_j and nothing else; a firing replaces
 * v_j by v_j - C[j][i] v_i for every j, so v_i becomes -v_i. Returns a new array; the argument is unchanged
 * (E-5). RangeError on a vector of the wrong length, an unknown game or a position outside 0..n-1 (plan);
 * then NeedsTwoWayRoads, NotFiniteType (plan reading of 5.6, which groups the geometry functions).
 */
export function applyWordFloat<T>(board: Board<T>, v: readonly number[], word: Word, game: Game): number[];
export function applyWordFloat(board: AnyBoard, v: readonly number[], word: Word, game: Game): number[];
export function applyWordFloat<T>(board: Board<T>, v: readonly number[], word: Word, game: Game): number[] {
  const n = board.n;
  if (v.length !== n) throw new RangeError(`the vector has ${v.length} entries, but the board has ${n} nodes`);
  if (game !== 'mutation' && game !== 'firing') throw new RangeError(`unknown game ${String(game)}`);
  for (const i of word) {
    if (!Number.isInteger(i) || i < 0 || i >= n) throw new RangeError(`position ${String(i)} is outside 0..${n - 1}`);
  }
  guardFiniteBoard(board);
  const C = cartanNumbers(board as unknown as AnyBoard);
  const current = [...v];
  for (const i of word) {
    if (game === 'mutation') {
      let drop = 0;
      for (let j = 0; j < n; j++) if (C[i]![j] !== 0) drop += C[i]![j]! * current[j]!;
      current[i] = current[i]! - drop;
    } else {
      const ai = current[i]!;
      for (let j = 0; j < n; j++) if (C[j]![i] !== 0) current[j] = current[j]! - C[j]![i]! * ai;
    }
  }
  return current;
}
