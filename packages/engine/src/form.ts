// The invariant form, coroots, the invariance test and the exact root test (SPEC.md 2.5, 2.11, 5.4, 5.5,
// 5.6; CONTRACTS.md 2.1, 2.4 phase 2): formValue, formIsInvariant, isRootPopulation, coroot. Ports of the
// oracle's bil (lines 129 to 131), coroot_coords (201 to 207), form_is_invariant (1295 to 1302),
// form_invariance_witness (1730 to 1741) and is_root_population (1274 to 1292). Every move goes through
// mutate and toNumbers (never re-implemented); a cap is reported as null, never thrown (E-10).
import type { Vec } from './arith';
import type { Board } from './board';
import { CAPS } from './caps';
import { mutate, mutationMatrix, toNumbers } from './moves';
import type { Rational } from './rational';
import { rat, ratAdd, ratDiv, ratMul, ratSign } from './rational';
import { gram, symmetrizer } from './classify';
import { requireFinite, requireGcm } from './guards';

/** The result of formIsInvariant (SPEC.md 5.2; plan placement). */
export interface InvarianceResult {
  invariant: boolean;
  witness?: { node: number; population: number[] };
}

function checkLength<T>(board: Board<T>, v: Vec<T>): void {
  if (v.length !== board.n) {
    throw new RangeError(`the vector has ${v.length} entries, but the board has ${board.n} nodes`);
  }
}

/** p^T B q over rationals for a Gram matrix B and integer vectors (the oracle's bil). Internal. */
export function formValueOf(B: Rational[][], p: readonly (number | bigint)[], q: readonly (number | bigint)[]): Rational {
  const n = B.length;
  let s = rat(0);
  for (let i = 0; i < n; i++) {
    const pi = rat(p[i]!);
    if (pi.num === 0n) continue;
    for (let j = 0; j < n; j++) {
      const qj = rat(q[j]!);
      if (qj.num === 0n) continue;
      s = ratAdd(s, ratMul(ratMul(pi, B[i]![j]!), qj));
    }
  }
  return s;
}

/** (p, q) = p^T B q as a rational, q defaulting to p; null when the board is not balanced (one-way boards included). */
export function formValue<T>(board: Board<T>, p: Vec<T>, q?: Vec<T>): Rational | null {
  checkLength(board, p);
  if (q !== undefined) checkLength(board, q);
  const B = gram(board);
  if (B === null) return null;
  const { arith } = board;
  const pp = p.map((x) => arith.toBig(x));
  const qq = q === undefined ? pp : q.map((x) => arith.toBig(x));
  return formValueOf(B, pp, qq);
}

/**
 * The coordinates b_i d_i / (1/2 (beta, beta)) of the coroot in the simple coroots, as plain integers
 * (the oracle's coroot_coords, which asserts integrality). Internal and unguarded; RangeError when the
 * form is missing, (beta, beta) is zero, or a coordinate is not an integer (plan).
 */
export function corootOf<T>(board: Board<T>, root: Vec<T>): number[] {
  const d = symmetrizer(board);
  const B = gram(board);
  if (d === null || B === null) throw new RangeError('coroot needs a balanced board');
  const { arith } = board;
  const r = root.map((x) => arith.toBig(x));
  const dr = ratDiv(formValueOf(B, r, r), rat(2));
  if (ratSign(dr) === 0) throw new RangeError('the root has form value zero: it has no coroot');
  const out: number[] = [];
  for (let i = 0; i < board.n; i++) {
    const x = ratDiv(ratMul(rat(r[i]!), d[i]!), dr);
    if (x.den !== 1n) throw new RangeError('a coroot coordinate is not an integer: not a root of a finite-type board');
    const y = Number(x.num);
    if (!Number.isSafeInteger(y)) throw new RangeError('a coroot coordinate is not a safe integer');
    out.push(y);
  }
  return out;
}

/** beta^vee = 2 beta / (beta, beta) in the simple coroots (SPEC.md 2.5), in the board's arithmetic; finite only (5.6). */
export function coroot<T>(board: Board<T>, root: Vec<T>): T[] {
  checkLength(board, root);
  requireFinite(board);
  return corootOf(board, root).map((x) => board.arith.fromInt(x));
}

// ---------------------------------------------------------------------------------------------
// formIsInvariant (oracle lines 1295 to 1302 and 1730 to 1741)
// ---------------------------------------------------------------------------------------------

function checkSymmetricMatrix<T>(board: Board<T>, M: number[][]): bigint[][] {
  const n = board.n;
  if (!Array.isArray(M) || M.length !== n) throw new RangeError(`the form matrix must have ${n} rows`);
  const out: bigint[][] = [];
  for (let i = 0; i < n; i++) {
    const row = M[i];
    if (!Array.isArray(row) || row.length !== n) throw new RangeError(`row ${i} of the form matrix must have ${n} entries`);
    const big: bigint[] = [];
    for (let j = 0; j < n; j++) {
      const x = row[j];
      if (typeof x !== 'number' || !Number.isSafeInteger(x)) throw new RangeError(`the form entry at (${i}, ${j}) is not an integer`);
      big.push(BigInt(x));
    }
    out.push(big);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (out[i]![j] !== out[j]![i]) throw new RangeError('the form matrix must be symmetric');
    }
  }
  return out;
}

/**
 * Does every mutation preserve the form p^T M q (S_i^T M S_i = M for every i, the oracle's
 * form_is_invariant)? When not, a witness in the oracle's order (form_invariance_witness): node i
 * outside, population inside, the unit vectors then e_a + e_b with a < b; the first pair whose quadratic
 * value changes. M must be a square symmetric integer matrix of the board's size (RangeError otherwise).
 * Works on one-way boards too.
 */
export function formIsInvariant<T>(board: Board<T>, M: number[][]): InvarianceResult {
  const Mb = checkSymmetricMatrix(board, M);
  const n = board.n;
  let invariant = true;
  for (let i = 0; i < n && invariant; i++) {
    const S = mutationMatrix(board, i).map((row) => row.map((x) => BigInt(x)));
    // (S^T M S)[r][c] = sum_{k,l} S[k][r] M[k][l] S[l][c]
    for (let r = 0; r < n && invariant; r++) {
      for (let c = 0; c < n; c++) {
        let s = 0n;
        for (let k = 0; k < n; k++) {
          if (S[k]![r] === 0n) continue;
          for (let l = 0; l < n; l++) s += S[k]![r]! * Mb[k]![l]! * S[l]![c]!;
        }
        if (s !== Mb[r]![c]) {
          invariant = false;
          break;
        }
      }
    }
  }
  if (invariant) return { invariant: true };
  const { arith } = board;
  const q = (p: readonly T[]): bigint => {
    let s = 0n;
    for (let i = 0; i < n; i++) {
      const pi = arith.toBig(p[i]!);
      if (pi === 0n) continue;
      for (let j = 0; j < n; j++) s += pi * Mb[i]![j]! * arith.toBig(p[j]!);
    }
    return s;
  };
  const tests: number[][] = [];
  for (let a = 0; a < n; a++) {
    const e: number[] = [];
    for (let k = 0; k < n; k++) e.push(k === a ? 1 : 0);
    tests.push(e);
  }
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const e: number[] = [];
      for (let k = 0; k < n; k++) e.push(k === a || k === b ? 1 : 0);
      tests.push(e);
    }
  }
  for (let i = 0; i < n; i++) {
    for (const p of tests) {
      const pv = p.map((x) => arith.fromInt(x));
      if (q(mutate(board, pv, i)) !== q(pv)) return { invariant: false, witness: { node: i, population: [...p] } };
    }
  }
  return { invariant: false };
}

// ---------------------------------------------------------------------------------------------
// isRootPopulation (SPEC.md 2.11, 5.4, 5.5 "Root test"; oracle lines 1274 to 1292)
// ---------------------------------------------------------------------------------------------

/**
 * The exact root test on a gcm board: negate a population with a negative entry; false on mixed signs or
 * zero; while the total exceeds 1, mutate the lowest position whose number is positive (false when there is
 * none or the city goes negative); true at a single Martian. Counts mutations against `cap` (default
 * CAPS.rootTestSteps): null when the descent has not returned after `cap` mutations; a descent that reaches
 * the single Martian with its cap-th mutation returns true (plan). NeedsTwoWayRoads on a one-way board.
 */
export function isRootPopulation<T>(board: Board<T>, v: Vec<T>, cap: number = CAPS.rootTestSteps): boolean | null {
  checkLength(board, v);
  if (!Number.isInteger(cap) || cap < 0) throw new RangeError(`the cap ${String(cap)} is not a non-negative integer`);
  requireGcm(board);
  const { arith, n } = board;
  let w: T[] = [...v];
  if (w.some((x) => arith.sign(x) < 0)) w = w.map((x) => arith.neg(x));
  if (w.some((x) => arith.sign(x) < 0) || w.every((x) => arith.sign(x) === 0)) return false;
  const totalAboveOne = (u: readonly T[]): boolean => {
    let s = arith.zero;
    for (const x of u) s = arith.add(s, x);
    return arith.sign(arith.sub(s, arith.one)) > 0;
  };
  let steps = 0;
  while (totalAboveOne(w)) {
    if (steps >= cap) return null;
    const a = toNumbers(board, w);
    let i = -1;
    for (let k = 0; k < n; k++) {
      if (arith.sign(a[k]!) > 0) {
        i = k;
        break;
      }
    }
    if (i < 0) return false;
    w = mutate(board, w, i);
    steps += 1;
    if (arith.sign(w[i]!) < 0) return false;
  }
  return true;
}
