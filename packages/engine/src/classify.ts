// Form and classification (SPEC.md 2.5, 2.8, 2.12, 5.3, 5.5, 5.6; CONTRACTS.md 2.1, 2.4 phase 2):
// symmetrizer, gram, cartanClass, relabellings, identify, affineCandidates, identifyAffine, classify,
// smallestNonfiniteSubboard, spectralRadius. Ports of the oracle's symmetrizer (lines 106 to 120),
// gram (123 to 126), is_symmetrizable (1033 to 1039), cartan_class (1061 to 1077), relabellings (347 to
// 385), finite_candidates (428 to 441), identify_labelled (444 to 452), affine_candidates (1198 to 1218),
// identify_affine (1221 to 1226), classify (1229 to 1253), smallest_nonfinite_subboard (1256 to 1271)
// and spectral_radius (1761 to 1783). Every function takes positions and returns positions (E-7);
// no candidate table is built at module load (trap 15: this module, affine.ts, form.ts, guards.ts and
// board.ts import one another, and only function declarations may run before every module is loaded).
import { SafeInt } from './arith';
import type { AnyBoard, Board } from './board';
import { adjacency, boardKind, cartan, cartanNumbers, components, subBoard } from './board';
import { CAPS } from './caps';
import { NeedsConnectedBoard, NeedsTwoWayRoads, NotABoard } from './errors';
import { determinant } from './linalg';
import type { Rational } from './rational';
import { rat, ratDiv, ratEq, ratMul, ratSign, ratSub } from './rational';
import { extendMatrix, nullVector, twistedAEven } from './affine';
import { cachedClassify } from './guards';

// Records with the golden field names (SPEC.md 5.2, Appendix G under classification_tests; plan placement).
// An optional field that does not apply is absent, not undefined; keys are in the oracle's order.
export interface ClassifyRecord {
  nodes: number[];
  kind: 'gcm' | 'one-way';
  balanced: boolean;
  class: 'finite' | 'affine' | 'indefinite' | null;
  name: string | null;
  bourbaki_order?: number[];
  marks?: number[];
  comarks?: number[];
}

export interface NonfiniteSubboard {
  nodes: number[];
  class: 'affine' | 'indefinite';
}

// ---------------------------------------------------------------------------------------------
// Internal helpers on integer matrices
// ---------------------------------------------------------------------------------------------

/**
 * A plain SafeInt board on an integer Cartan matrix, for engine-internal calls of components, roots and
 * the form on a matrix that is not yet a board (the standard matrices of the candidates). Not frozen,
 * never returned to a caller.
 */
export function plainBoard(C: number[][]): Board<number> {
  const kind = boardKind(C);
  if (kind === 'not-a-board') throw new NotABoard('the matrix is not a board');
  const labels: number[] = [];
  for (let k = 0; k < C.length; k++) labels.push(k);
  return { n: C.length, cartan: C, labels, kind, arith: SafeInt };
}

function transposed(C: number[][]): number[][] {
  return C.map((_, i) => C.map((row) => row[i]!));
}

/** cartanNumbers for a board of either arithmetic reached through a generic parameter. Internal. */
export function intCartan<T>(board: Board<T>): number[][] {
  return cartanNumbers(board as unknown as AnyBoard);
}

function kindOf<T>(board: Board<T>): 'not-a-board' | 'one-way' | 'gcm' {
  return boardKind(intCartan(board));
}

// ---------------------------------------------------------------------------------------------
// symmetrizer, gram (SPEC.md 2.5, 5.3, 5.6)
// ---------------------------------------------------------------------------------------------

/**
 * The d_i of SPEC.md 2.5 as rationals with least value 1 on each component, or null when the board is
 * not balanced: null at once on a one-way board (the oracle's walk would divide by zero there), else
 * the walk of oracle lines 106 to 120 followed by the pair check of is_symmetrizable (1033 to 1039).
 */
export function symmetrizer<T>(board: Board<T>): Rational[] | null {
  const C = intCartan(board);
  if (boardKind(C) !== 'gcm') return null;
  const n = board.n;
  const d: (Rational | null)[] = [];
  for (let i = 0; i < n; i++) d.push(null);
  for (const comp of components(board)) {
    const s = comp[0]!;
    d[s] = rat(1);
    const stack: number[] = [s];
    while (stack.length > 0) {
      const i = stack.pop()!;
      for (const j of comp) {
        if (j !== i && C[i]![j] !== 0 && d[j] === null) {
          d[j] = ratDiv(ratMul(d[i]!, rat(C[i]![j]!)), rat(C[j]![i]!));
          stack.push(j);
        }
      }
    }
    let m = d[s]!;
    for (const i of comp) if (ratSign(ratSub(d[i]!, m)) < 0) m = d[i]!;
    for (const i of comp) d[i] = ratDiv(d[i]!, m);
  }
  const out = d as Rational[];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!ratEq(ratMul(out[i]!, rat(C[i]![j]!)), ratMul(out[j]!, rat(C[j]![i]!)))) return null;
    }
  }
  return out;
}

/** B = DC, B_ij = d_i C_ij, as rationals (oracle lines 123 to 126); null exactly when symmetrizer is null. */
export function gram<T>(board: Board<T>): Rational[][] | null {
  const d = symmetrizer(board);
  if (d === null) return null;
  const C = intCartan(board);
  return C.map((row, i) => row.map((x) => ratMul(d[i]!, rat(x))));
}

// ---------------------------------------------------------------------------------------------
// cartanClass (SPEC.md 2.12, 5.5 "Finite, affine or neither")
// ---------------------------------------------------------------------------------------------

/**
 * 'finite', 'affine' or 'indefinite' for a connected gcm board (oracle lines 1061 to 1077): a board that
 * is not balanced is indefinite; otherwise the leading principal minors of B = DC, exactly. Throws
 * NeedsTwoWayRoads on a one-way board, then NeedsConnectedBoard on a board in several pieces.
 */
export function cartanClass<T>(board: Board<T>): 'finite' | 'affine' | 'indefinite' {
  if (kindOf(board) !== 'gcm') throw new NeedsTwoWayRoads('cartanClass needs a board on which every road has a road back');
  if (components(board).length !== 1) throw new NeedsConnectedBoard('cartanClass needs a connected board');
  const B = gram(board);
  if (B === null) return 'indefinite';
  const n = board.n;
  const minors: Rational[] = [];
  for (let k = 1; k <= n; k++) minors.push(determinant(B.slice(0, k).map((row) => row.slice(0, k))));
  if (minors.every((m) => ratSign(m) > 0)) return 'finite';
  if (minors.slice(0, -1).every((m) => ratSign(m) > 0) && ratSign(minors[n - 1]!) === 0) return 'affine';
  return 'indefinite';
}

// ---------------------------------------------------------------------------------------------
// relabellings (SPEC.md 5.5 "Matching two boards"; oracle lines 347 to 385)
// ---------------------------------------------------------------------------------------------

function checkLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`the limit ${String(limit)} is not a positive integer`);
}

function signatureOf(C: number[][], i: number): string {
  const n = C.length;
  const row: number[] = [];
  const col: number[] = [];
  for (let j = 0; j < n; j++) {
    if (j === i) continue;
    row.push(C[i]![j]!);
    col.push(C[j]![i]!);
  }
  row.sort((a, b) => a - b);
  col.sort((a, b) => a - b);
  return `${C[i]![i]!}|${row.join(',')}|${col.join(',')}`;
}

function lexCompare(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < a.length && k < b.length; k++) {
    if (a[k] !== b[k]) return a[k]! - b[k]!;
  }
  return a.length - b.length;
}

/**
 * All p with C1[p[i]][p[j]] = C2[i][j] (node i of C2 is node p[i] of C1), the oracle's backtracking: the
 * nodes of C2 in a breadth-first order that puts each next to an earlier one, candidates in increasing
 * position with the same signature and matching entries against every node already placed. The search
 * stops once `limit` assignments are found; the result is sorted lexicographically (plan: equal to the
 * oracle's list whenever the total is at most the limit).
 */
export function relabellingsOf(C1: number[][], C2: number[][], limit: number): number[][] {
  const n = C1.length;
  if (C2.length !== n) return [];
  const s1: string[] = [];
  const s2: string[] = [];
  for (let i = 0; i < n; i++) {
    s1.push(signatureOf(C1, i));
    s2.push(signatureOf(C2, i));
  }
  if ([...s1].sort().join(';') !== [...s2].sort().join(';')) return [];
  const order: number[] = [];
  const seen: boolean[] = [];
  for (let i = 0; i < n; i++) seen.push(false);
  for (const comp of components(plainBoard(C2))) {
    const queue: number[] = [comp[0]!];
    seen[comp[0]!] = true;
    let head = 0;
    while (head < queue.length) {
      const i = queue[head]!;
      head += 1;
      order.push(i);
      for (const j of comp) {
        if (!seen[j] && (C2[i]![j] !== 0 || C2[j]![i] !== 0)) {
          seen[j] = true;
          queue.push(j);
        }
      }
    }
  }
  const out: number[][] = [];
  const p: number[] = [];
  const used: boolean[] = [];
  for (let i = 0; i < n; i++) {
    p.push(-1);
    used.push(false);
  }
  const go = (k: number): boolean => {
    if (k === n) {
      out.push([...p]);
      return out.length >= limit;
    }
    const i = order[k]!;
    for (let c = 0; c < n; c++) {
      if (used[c] || s1[c] !== s2[i]) continue;
      let ok = true;
      for (let t = 0; t < k; t++) {
        const j = order[t]!;
        if (C1[c]![p[j]!] !== C2[i]![j] || C1[p[j]!]![c] !== C2[j]![i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      p[i] = c;
      used[c] = true;
      if (go(k + 1)) return true;
      used[c] = false;
      p[i] = -1;
    }
    return false;
  };
  go(0);
  out.sort(lexCompare);
  return out;
}

/** All ways to match two boards (any kind); p[i] = node of b1 playing node i of b2; lexicographic; at most `limit` (default CAPS.relabellingsDefault). */
export function relabellings(b1: AnyBoard, b2: AnyBoard, limit: number = CAPS.relabellingsDefault): number[][] {
  checkLimit(limit);
  return relabellingsOf(cartanNumbers(b1), cartanNumbers(b2), limit);
}

// ---------------------------------------------------------------------------------------------
// Naming (SPEC.md 5.5 "Naming", 2.8 "Names in rank 2", 2.12 "Names")
// ---------------------------------------------------------------------------------------------

/** The finite types of rank n in the order A, B, C, D, E, F, G (oracle lines 428 to 441), so the rank 2 board is named B2. */
function finiteCandidates(n: number): string[] {
  const out = [`A${n}`];
  if (n >= 2) out.push(`B${n}`, `C${n}`);
  if (n >= 4) out.push(`D${n}`);
  if (n === 6 || n === 7 || n === 8) out.push(`E${n}`);
  if (n === 4) out.push('F4');
  if (n === 2) out.push('G2');
  return out;
}

/**
 * The name and Bourbaki order of a connected finite-type board in any numbering: order[k] is the position
 * playing Bourbaki node k + 1, the lexicographically smallest when the board has symmetries (E-5). null
 * on a one-way board and on a connected gcm board that is not of finite type; NeedsConnectedBoard on
 * several pieces.
 */
export function identify<T>(board: Board<T>): { name: string; order: number[] } | null {
  const C = intCartan(board);
  if (boardKind(C) !== 'gcm') return null;
  if (components(board).length !== 1) throw new NeedsConnectedBoard('identify needs a connected board');
  for (const name of finiteCandidates(board.n)) {
    const ps = relabellingsOf(C, cartan(name), CAPS.relabellingsDefault);
    if (ps.length > 0) return { name, order: ps[0]! };
  }
  return null;
}

/**
 * (name, Cartan matrix) for every affine board with m nodes in the oracle's order (lines 1198 to 1218):
 * the untwisted boards of the finite candidates of rank m - 1 except B2 (its board is C2~), then
 * A_{2n}^(2), A_{2n-1}^(2) (n >= 3), D_{n+1}^(2) (n >= 2), E6^(2) (n = 4), D4^(3) (n = 2). Nothing when m < 2.
 */
export function affineCandidates(m: number): { name: string; cartan: number[][] }[] {
  if (!Number.isInteger(m)) throw new RangeError(`the node count ${String(m)} is not an integer`);
  const n = m - 1;
  const out: { name: string; cartan: number[][] }[] = [];
  if (n < 1) return out;
  for (const X of finiteCandidates(n)) {
    if (X === 'B2') continue;
    out.push({ name: `${X}~`, cartan: extendMatrix(cartan(X), false).cartan });
  }
  out.push({ name: `A${2 * n}^(2)`, cartan: twistedAEven(n) });
  if (n >= 3) out.push({ name: `A${2 * n - 1}^(2)`, cartan: transposed(extendMatrix(cartan(`B${n}`), false).cartan) });
  if (n >= 2) out.push({ name: `D${n + 1}^(2)`, cartan: transposed(extendMatrix(cartan(`C${n}`), false).cartan) });
  if (n === 4) out.push({ name: 'E6^(2)', cartan: transposed(extendMatrix(cartan('F4'), false).cartan) });
  if (n === 2) out.push({ name: 'D4^(3)', cartan: transposed(extendMatrix(cartan('G2'), false).cartan) });
  return out;
}

/** The name of a connected affine board in any numbering (oracle lines 1221 to 1226); null on a one-way board and when no candidate matches. */
export function identifyAffine<T>(board: Board<T>): string | null {
  const C = intCartan(board);
  if (boardKind(C) !== 'gcm') return null;
  if (components(board).length !== 1) throw new NeedsConnectedBoard('identifyAffine needs a connected board');
  for (const cand of affineCandidates(board.n)) {
    if (relabellingsOf(C, cand.cartan, 1).length > 0) return cand.name;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// classify (SPEC.md 5.2 "Five functions return records", 5.3, 5.6; oracle lines 1229 to 1253)
// ---------------------------------------------------------------------------------------------

/** The verdict computed afresh (the cache of E-11 lives in guards.ts). */
export function classifyUncached<T>(board: Board<T>): ClassifyRecord[] {
  const C = intCartan(board);
  if (boardKind(C) === 'not-a-board') {
    throw new NotABoard('not a board: the diagonal must be 2 and the other entries must be integers <= 0');
  }
  const out: ClassifyRecord[] = [];
  for (const comp of components(board)) {
    const sub = subBoard(board, comp);
    const rec: ClassifyRecord = { nodes: [...comp], kind: sub.kind, balanced: false, class: null, name: null };
    if (rec.kind === 'gcm') {
      rec.balanced = symmetrizer(sub) !== null;
      rec.class = cartanClass(sub);
      if (rec.class === 'finite') {
        const id = identify(sub);
        if (id !== null) {
          rec.name = id.name;
          rec.bourbaki_order = id.order.map((k) => comp[k]!);
        }
      } else if (rec.class === 'affine') {
        rec.name = identifyAffine(sub);
        const subC = intCartan(sub);
        const mk = nullVector(subC);
        const cmk = nullVector(transposed(subC));
        if (mk !== null) rec.marks = mk;
        if (cmk !== null) rec.comarks = cmk;
      }
    }
    out.push(rec);
  }
  return out;
}

function copyRecord(rec: ClassifyRecord): ClassifyRecord {
  const out: ClassifyRecord = { nodes: [...rec.nodes], kind: rec.kind, balanced: rec.balanced, class: rec.class, name: rec.name };
  if (rec.bourbaki_order !== undefined) out.bourbaki_order = [...rec.bourbaki_order];
  if (rec.marks !== undefined) out.marks = [...rec.marks];
  if (rec.comarks !== undefined) out.comarks = [...rec.comarks];
  return out;
}

/**
 * The full verdict, one record per component in order of least position, nodes as positions; a one-way
 * component gets kind 'one-way', balanced false, class null, name null. Throws NotABoard. The verdict is
 * cached per board object (E-11); every call returns a fresh copy.
 */
export function classify<T>(board: Board<T>): ClassifyRecord[] {
  return cachedClassify(board).map(copyRecord);
}

// ---------------------------------------------------------------------------------------------
// smallestNonfiniteSubboard (SPEC.md 5.5; oracle lines 1256 to 1271)
// ---------------------------------------------------------------------------------------------

/** Calls f on each k-subset of 0..n-1 in lexicographic order (as itertools.combinations) until f returns true. */
function eachCombination(n: number, k: number, f: (K: number[]) => boolean): boolean {
  const K: number[] = [];
  for (let i = 0; i < k; i++) K.push(i);
  for (;;) {
    if (f([...K])) return true;
    let i = k - 1;
    while (i >= 0 && K[i] === i + n - k) i -= 1;
    if (i < 0) return false;
    K[i] = K[i]! + 1;
    for (let j = i + 1; j < k; j++) K[j] = K[j - 1]! + 1;
  }
}

/**
 * The first connected subset of positions, by increasing size and lexicographic within a size, whose
 * induced board is affine or indefinite, with its class; null when every connected subset is finite and
 * null on a board with a one-way road (the notion needs two-way roads). At most 2^n - 1 subsets.
 */
export function smallestNonfiniteSubboard<T>(board: Board<T>): NonfiniteSubboard | null {
  if (kindOf(board) !== 'gcm') return null;
  const n = board.n;
  let found: NonfiniteSubboard | null = null;
  for (let size = 1; size <= n && found === null; size++) {
    eachCombination(n, size, (K) => {
      const sub = subBoard(board, K);
      if (components(sub).length !== 1) return false;
      const cls = cartanClass(sub);
      if (cls === 'finite') return false;
      found = { nodes: K, class: cls };
      return true;
    });
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// spectralRadius (SPEC.md 5.5; oracle lines 1761 to 1783): the one floating-point function of phase 2
// ---------------------------------------------------------------------------------------------

/**
 * The largest eigenvalue of the adjacency matrix, by power iteration on M = A + I from the all-ones vector
 * scaled to length 1: y = Mx, estimate x.y, x = y/|y|; stop when two successive estimates differ by less
 * than 1e-13 or after 5000 steps; minus 1. null on a board with a one-way road.
 */
export function spectralRadius<T>(board: Board<T>): number | null {
  if (kindOf(board) !== 'gcm') return null;
  const n = board.n;
  const A = adjacency(board as unknown as AnyBoard);
  const M: number[][] = A.map((row, i) => row.map((x, j) => x + (i === j ? 1.0 : 0.0)));
  let x: number[] = [];
  for (let i = 0; i < n; i++) x.push(1.0 / Math.sqrt(n));
  let last: number | null = null;
  let est = 0;
  for (let step = 0; step < 5000; step++) {
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += M[i]![j]! * x[j]!;
      y.push(s);
    }
    est = 0;
    for (let i = 0; i < n; i++) est += x[i]! * y[i]!;
    let norm = 0;
    for (const v of y) norm += v * v;
    norm = Math.sqrt(norm);
    x = y.map((v) => v / norm);
    if (last !== null && Math.abs(est - last) < 1e-13) break;
    last = est;
  }
  return est - 1.0;
}
