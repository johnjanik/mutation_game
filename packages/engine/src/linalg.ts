// Exact linear algebra over Rational (SPEC.md 5.3, determinant; CONTRACTS.md 2.1, solve and inverse).
// Entries may be integers (number, which must be an integer, or bigint) or Rational. Ported from the
// oracle's determinant (lines 995 to 1009: elimination over fractions, pivot the first nonzero entry at
// or below the diagonal, negate on a row swap), solve (656 to 669: Gauss-Jordan) and inverse (672 to 675).
// Where the oracle fails on a singular matrix, solve and inverse return null (plan).
import type { Matrix } from './arith';
import type { Rational } from './rational';
import { rat, ratDiv, ratMul, ratNeg, ratSub } from './rational';

export type Scalar = number | bigint | Rational;
export type AnyMatrix = Matrix<number> | Matrix<bigint> | Matrix<Rational>;

function toRat(x: Scalar): Rational {
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) throw new RangeError(`the entry ${String(x)} is not an integer`);
    return rat(x);
  }
  if (typeof x === 'bigint') return rat(x);
  return rat(x.num, x.den);
}

/** A fresh square matrix of normalised rationals; RangeError unless M is square. */
function ratMatrix(M: AnyMatrix): Rational[][] {
  const rows = M as Matrix<Scalar>;
  const n = rows.length;
  const out: Rational[][] = [];
  for (let i = 0; i < n; i++) {
    const row = rows[i]!;
    if (row.length !== n) throw new RangeError(`row ${i} has ${row.length} entries, but the matrix has ${n} rows`);
    out.push(row.map(toRat));
  }
  return out;
}

const ZERO: Rational = { num: 0n, den: 1n };
const ONE: Rational = { num: 1n, den: 1n };
const isZero = (x: Rational): boolean => x.num === 0n;

/** The exact determinant; 1 for the empty matrix, as in the oracle. */
export function determinant(M: AnyMatrix): Rational {
  const A = ratMatrix(M);
  const n = A.length;
  let d = ONE;
  for (let c = 0; c < n; c++) {
    let piv = -1;
    for (let r = c; r < n; r++) {
      if (!isZero(A[r]![c]!)) {
        piv = r;
        break;
      }
    }
    if (piv < 0) return ZERO;
    if (piv !== c) {
      const t = A[c]!;
      A[c] = A[piv]!;
      A[piv] = t;
      d = ratNeg(d);
    }
    const pivot = A[c]![c]!;
    d = ratMul(d, pivot);
    for (let r = c + 1; r < n; r++) {
      const f = ratDiv(A[r]![c]!, pivot);
      if (isZero(f)) continue;
      const row = A[r]!;
      const prow = A[c]!;
      for (let k = c; k < n; k++) row[k] = ratSub(row[k]!, ratMul(f, prow[k]!));
    }
  }
  return d;
}

/**
 * Gauss-Jordan elimination of [M | B] in place; returns false when M is singular (no pivot in a column).
 * On success the left block is the identity and the right block holds M^{-1} B.
 */
function gaussJordan(A: Rational[][], n: number, width: number): boolean {
  for (let c = 0; c < n; c++) {
    let piv = -1;
    for (let r = c; r < n; r++) {
      if (!isZero(A[r]![c]!)) {
        piv = r;
        break;
      }
    }
    if (piv < 0) return false;
    if (piv !== c) {
      const t = A[c]!;
      A[c] = A[piv]!;
      A[piv] = t;
    }
    const prow = A[c]!;
    const pv = prow[c]!;
    for (let k = 0; k < width; k++) prow[k] = ratDiv(prow[k]!, pv);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const row = A[r]!;
      const f = row[c]!;
      if (isZero(f)) continue;
      for (let k = 0; k < width; k++) row[k] = ratSub(row[k]!, ratMul(f, prow[k]!));
    }
  }
  return true;
}

/** The exact solution x of M x = b, or null when M is singular (plan). RangeError on a b of the wrong length. */
export function solve(M: AnyMatrix, b: readonly Scalar[]): Rational[] | null {
  const A = ratMatrix(M);
  const n = A.length;
  if (b.length !== n) throw new RangeError(`the right-hand side has ${b.length} entries, but the matrix has ${n} rows`);
  for (let i = 0; i < n; i++) A[i]!.push(toRat(b[i]!));
  if (!gaussJordan(A, n, n + 1)) return null;
  return A.map((row) => row[n]!);
}

/** The exact inverse, or null when M is singular (plan). Column j solves M x = e_j. */
export function inverse(M: AnyMatrix): Rational[][] | null {
  const A = ratMatrix(M);
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const row = A[i]!;
    for (let j = 0; j < n; j++) row.push(i === j ? ONE : ZERO);
  }
  if (!gaussJordan(A, n, 2 * n)) return null;
  return A.map((row) => row.slice(n));
}
