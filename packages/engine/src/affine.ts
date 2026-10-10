// Affine boards (SPEC.md 2.12, 5.3, 5.4, 5.6, E-7; CONTRACTS.md 2.1, 2.4 phase 2): affineExtension,
// nullVector, marks, comarks, level, and the twisted table twistedAEven (the oracle's twisted_a_even).
// Ports of the oracle's affine_extension (lines 1127 to 1147), null_vector (1080 to 1110), marks (1113),
// comarks (1118) and twisted_a_even (1186 to 1195). Every board built here is a frozen Board<bigint>
// with Big (E-2), labels 0..n (E-7). Nothing runs at module load (trap 15).
import type { Vec } from './arith';
import { Big } from './arith';
import type { Board } from './board';
import { CAPS } from './caps';
import { NotAffine, NotFiniteType } from './errors';
import type { Rational } from './rational';
import { rat, ratDiv, ratMul, ratSign, ratSub } from './rational';
import { roots, positiveRootsFrom } from './search';
import { gram, intCartan, plainBoard } from './classify';
import { corootOf, formValueOf } from './form';
import { requireAffine, requireConnected, requireFinite, requireGcm } from './guards';

/** The result of affineExtension (plan type, CONTRACTS.md 2.2): the board with node 0 first, its marks and comarks. */
export interface AffineExtension {
  board: Board<bigint>;
  marks: number[];
  comarks: number[];
}

/** A frozen Board<bigint> on an integer matrix, kind 'gcm', with the given labels and name (plan; the engine's own makeBoard is private to board.ts). */
function bigBoardOf(rows: number[][], labels: number[], name?: string): Board<bigint> {
  const cartan = Object.freeze(rows.map((row) => Object.freeze(row.map((x) => BigInt(x)))));
  const board: Board<bigint> = { n: rows.length, cartan, labels: Object.freeze([...labels]), kind: 'gcm', arith: Big };
  if (name !== undefined) board.name = name;
  return Object.freeze(board);
}

// ---------------------------------------------------------------------------------------------
// The twisted family A_{2n}^(2) (oracle lines 1186 to 1195)
// ---------------------------------------------------------------------------------------------

/**
 * The affine board A_{2n}^(2), n >= 1: for n = 1 the board with four roads one way and one back,
 * [[2, -4], [-1, 2]]; otherwise the path on n + 1 nodes with C[0][1] = -2 and C[n-1][n] = -2.
 */
export function twistedAEven(n: number): number[][] {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`A_{2n}^(2) needs n >= 1, not ${String(n)}`);
  if (n === 1) return [[2, -4], [-1, 2]];
  const C: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= n; j++) row.push(i === j ? 2 : 0);
    C.push(row);
  }
  for (let i = 0; i < n; i++) {
    C[i]![i + 1] = -1;
    C[i + 1]![i] = -1;
  }
  C[0]![1] = -2;
  C[n - 1]![n] = -2;
  return C;
}

// ---------------------------------------------------------------------------------------------
// The extension itself (oracle lines 1127 to 1147), unguarded on an integer matrix of finite type
// ---------------------------------------------------------------------------------------------

/**
 * Node 0 with alpha_0 = delta - theta added first: Ca[0][j+1] = -<theta^vee, alpha_j>, Ca[j+1][0] =
 * -<alpha_j^vee, theta>. theta is the first positive root of largest total (short false) or, among the
 * positive roots of least form value, the first of largest total (short true). marks = (1, theta),
 * comarks = (1, theta^vee). Internal: the public affineExtension guards and builds the board.
 */
export function extendMatrix(C: number[][], short: boolean): { cartan: number[][]; marks: number[]; comarks: number[] } {
  const n = C.length;
  const b = plainBoard(C);
  const all = roots(b, CAPS.workerPositions);
  if (all.truncated) throw new NotFiniteType(`more than ${CAPS.workerPositions} root populations: this board is not of finite type`);
  const pos = positiveRootsFrom(b, all.items);
  const total = (r: readonly number[]): number => r.reduce((s, x) => s + x, 0);
  let candidates = pos;
  if (short) {
    const B = gram(b);
    if (B === null) throw new NotFiniteType('the board has no invariant form: not of finite type');
    const values = pos.map((r) => formValueOf(B, r, r));
    let m: Rational | null = null;
    for (const v of values) if (m === null || ratSign(ratSub(v, m)) < 0) m = v;
    candidates = pos.filter((_, k) => ratSign(ratSub(values[k]!, m!)) === 0);
  }
  let th = candidates[0];
  if (th === undefined) throw new NotFiniteType('a board with no positive root');
  for (const r of candidates) if (total(r) > total(th)) th = r;
  const thv = corootOf(b, th);
  const Ca: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= n; j++) row.push(0);
    Ca.push(row);
  }
  Ca[0]![0] = 2;
  for (let j = 0; j < n; j++) {
    let a = 0;
    let c = 0;
    for (let i = 0; i < n; i++) {
      a += thv[i]! * C[i]![j]!;
      c += C[j]![i]! * th[i]!;
    }
    Ca[0]![j + 1] = -a;
    Ca[j + 1]![0] = -c;
    for (let k = 0; k < n; k++) Ca[j + 1]![k + 1] = C[j]![k]!;
  }
  return { cartan: Ca, marks: [1, ...th], comarks: [1, ...thv] };
}

/**
 * The affine extension of a finite-type board (SPEC.md 2.12 "Building affine boards from finite ones"):
 * untwisted with the highest root, twisted with the highest short root (short true). Guards (5.6):
 * NeedsTwoWayRoads, NeedsConnectedBoard, NotFiniteType. The board is a Board<bigint> with labels 0..n
 * and, for an untwisted extension of a named board, the name "X~" (plan).
 */
export function affineExtension<T>(board: Board<T>, short = false): AffineExtension {
  if (typeof short !== 'boolean') throw new RangeError('short must be a boolean');
  requireGcm(board);
  requireConnected(board);
  requireFinite(board);
  const ext = extendMatrix(intCartan(board), short);
  const labels: number[] = [];
  for (let k = 0; k <= board.n; k++) labels.push(k);
  const name = !short && board.name !== undefined ? `${board.name}~` : undefined;
  return { board: bigBoardOf(ext.cartan, labels, name), marks: ext.marks, comarks: ext.comarks };
}

// ---------------------------------------------------------------------------------------------
// nullVector, marks, comarks, level (oracle lines 1080 to 1120; SPEC.md 2.12 Marks, Comarks, level)
// ---------------------------------------------------------------------------------------------

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

/**
 * The primitive integer vector v with M v = 0 and positive entries, for a square matrix of corank 1;
 * null otherwise (plan signature). Gauss-Jordan over rationals, pivot the first nonzero entry at or
 * below the current row; exactly one free column; the free variable 1; denominators cleared by their
 * least common multiple; divided by the gcd; negated when every entry is negative; positive or null.
 */
export function nullVector(M: readonly (readonly (number | bigint)[])[]): number[] | null {
  const n = M.length;
  const A: Rational[][] = M.map((row) => {
    if (row.length !== n) throw new RangeError('nullVector needs a square matrix');
    return row.map((x) => rat(x));
  });
  const pivCols: number[] = [];
  let r = 0;
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let k = r; k < n; k++) {
      if (A[k]![c]!.num !== 0n) {
        p = k;
        break;
      }
    }
    if (p < 0) continue;
    const t = A[r]!;
    A[r] = A[p]!;
    A[p] = t;
    const pv = A[r]![c]!;
    A[r] = A[r]!.map((x) => ratDiv(x, pv));
    for (let k = 0; k < n; k++) {
      if (k === r || A[k]![c]!.num === 0n) continue;
      const f = A[k]![c]!;
      const prow = A[r]!;
      A[k] = A[k]!.map((x, tcol) => ratSub(x, ratMul(f, prow[tcol]!)));
    }
    pivCols.push(c);
    r += 1;
  }
  const free: number[] = [];
  for (let c = 0; c < n; c++) if (!pivCols.includes(c)) free.push(c);
  if (free.length !== 1) return null;
  const f = free[0]!;
  const v: Rational[] = [];
  for (let c = 0; c < n; c++) v.push(rat(0));
  v[f] = rat(1);
  pivCols.forEach((c, row) => {
    const x = A[row]![f]!;
    v[c] = rat(-x.num, x.den);
  });
  let den = 1n;
  for (const x of v) den = (den * x.den) / gcd(den, x.den);
  const w: bigint[] = v.map((x) => (x.num * den) / x.den);
  let g = 0n;
  for (const x of w) g = gcd(g, x < 0n ? -x : x);
  const scaled = w.map((x) => x / g);
  const out = scaled.every((x) => x < 0n) ? scaled.map((x) => -x) : scaled;
  if (!out.every((x) => x > 0n)) return null;
  return out.map((x) => {
    const y = Number(x);
    if (!Number.isSafeInteger(y)) throw new RangeError('an entry of the null vector is not a safe integer');
    return y;
  });
}

/** The frozen population delta with C delta = 0 (SPEC.md 2.12 Marks); affine boards only (NotAffine otherwise, NeedsTwoWayRoads on a one-way board). */
export function marks<T>(board: Board<T>): number[] {
  requireAffine(board);
  const v = nullVector(intCartan(board));
  if (v === null) throw new NotAffine('indefinite');
  return v;
}

/** The weights c of the conserved level with c^T C = 0 (SPEC.md 2.12 Comarks); affine boards only. */
export function comarks<T>(board: Board<T>): number[] {
  requireAffine(board);
  const C = intCartan(board);
  const v = nullVector(C.map((_, i) => C.map((row) => row[i]!)));
  if (v === null) throw new NotAffine('indefinite');
  return v;
}

/** The level sum_i c_i a_i of a position in the board's arithmetic (SPEC.md 2.12, 5.4); affine boards only. */
export function level<T>(board: Board<T>, a: Vec<T>): T {
  if (a.length !== board.n) throw new RangeError(`the vector has ${a.length} entries, but the board has ${board.n} nodes`);
  const c = comarks(board);
  const { arith } = board;
  let s = arith.zero;
  for (let i = 0; i < board.n; i++) s = arith.add(s, arith.mul(arith.fromInt(c[i]!), a[i]!));
  return s;
}
