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

/** C[i][j] = C[j][i] for every pair: then d_i = 1 on every node balances the board (the walk below gives 1 everywhere). */
function isSymmetric(C: readonly (readonly number[])[]): boolean {
  const n = C.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) if (C[i]![j] !== C[j]![i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// symmetrizer, gram (SPEC.md 2.5, 5.3, 5.6)
// ---------------------------------------------------------------------------------------------

/**
 * The d_i of SPEC.md 2.5 as rationals with least value 1 on each component, or null when the board is
 * not balanced: null at once on a one-way board (the oracle's walk would divide by zero there), else
 * the walk of oracle lines 106 to 120 followed by the pair check of is_symmetrizable (1033 to 1039).
 */
export function symmetrizer<T>(board: Board<T>): Rational[] | null;
export function symmetrizer(board: AnyBoard): Rational[] | null;
export function symmetrizer<T>(board: Board<T>): Rational[] | null {
  const C = intCartan(board);
  if (boardKind(C) !== 'gcm') return null;
  const n = board.n;
  // On a symmetric matrix the walk sets every d_j to d_i = 1, the least value is 1 and every pair
  // check holds, so the result is all ones; it is written at once (RT-FIX residual P3-RT-07-02).
  if (isSymmetric(C)) return C.map(() => rat(1));
  // The entries as rationals through bigint: a road count may be any integer (5.6, first table), also one
  // beyond 2^53, which rat would refuse as a number (RT-FIX P4-RT-01-02).
  const R: Rational[][] = C.map((row) => row.map((x) => rat(BigInt(x))));
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
          d[j] = ratDiv(ratMul(d[i]!, R[i]![j]!), R[j]![i]!);
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
      if (!ratEq(ratMul(out[i]!, R[i]![j]!), ratMul(out[j]!, R[j]![i]!))) return null;
    }
  }
  return out;
}

/** B = DC, B_ij = d_i C_ij, as rationals (oracle lines 123 to 126); null exactly when symmetrizer is null. */
export function gram<T>(board: Board<T>): Rational[][] | null;
export function gram(board: AnyBoard): Rational[][] | null;
export function gram<T>(board: Board<T>): Rational[][] | null {
  const d = symmetrizer(board);
  if (d === null) return null;
  const C = intCartan(board);
  return C.map((row, i) => row.map((x) => ratMul(d[i]!, rat(BigInt(x))))); // through bigint, as in symmetrizer
}

// ---------------------------------------------------------------------------------------------
// cartanClass (SPEC.md 2.12, 5.5 "Finite, affine or neither")
// ---------------------------------------------------------------------------------------------

/**
 * 'finite', 'affine' or 'indefinite' for a connected gcm board (oracle lines 1061 to 1077): a board that
 * is not balanced is indefinite; otherwise the leading principal minors of B = DC, exactly. Throws
 * NeedsTwoWayRoads on a one-way board, then NeedsConnectedBoard on a board in several pieces.
 */
export function cartanClass<T>(board: Board<T>): 'finite' | 'affine' | 'indefinite';
export function cartanClass(board: AnyBoard): 'finite' | 'affine' | 'indefinite';
export function cartanClass<T>(board: Board<T>): 'finite' | 'affine' | 'indefinite' {
  if (kindOf(board) !== 'gcm') throw new NeedsTwoWayRoads('cartanClass needs a board on which every road has a road back');
  if (components(board).length !== 1) throw new NeedsConnectedBoard('cartanClass needs a connected board');
  return classOfConnected(intCartan(board));
}

/**
 * The rule of cartanClass on the integer matrix of a connected gcm board (unguarded; internal). A board
 * that is not balanced is indefinite. On a balanced board B = DC with D the diagonal matrix of the d_i,
 * which are all positive, so the k-th leading principal minor of B is d_1...d_k times that of C and has
 * its sign: the minors of C decide, exactly as those of B. They are the pivots of a fraction-free
 * elimination of C without row swaps (Bareiss: the k-th pivot is the k-th leading principal minor while
 * the earlier ones are not zero), so the first pivot that is not positive decides: zero on the last row
 * is affine, anything else indefinite. The elimination runs on numbers while every product stays a safe
 * integer, and on bigint otherwise (RT-FIX residual P3-RT-07-02: the same rule as the elimination of B in
 * rationals that it replaces, without a rational in the loop).
 */
function classOfConnected(C: readonly (readonly number[])[]): 'finite' | 'affine' | 'indefinite' {
  if (!isSymmetric(C) && symmetrizer(plainBoard(C.map((row) => [...row]))) === null) return 'indefinite';
  return classByMinors(C) ?? classByMinorsBig(C);
}

/** The pivot rule of classOfConnected on numbers; null as soon as an intermediate value is not a safe integer. */
function classByMinors(C: readonly (readonly number[])[]): 'finite' | 'affine' | 'indefinite' | null {
  const n = C.length;
  const M = C.map((row) => [...row]);
  let prev = 1;
  for (let k = 0; k < n; k++) {
    const pivot = M[k]![k]!; // the leading principal minor of order k + 1
    if (pivot <= 0) return pivot === 0 && k === n - 1 ? 'affine' : 'indefinite';
    const rowK = M[k]!;
    for (let i = k + 1; i < n; i++) {
      const rowI = M[i]!;
      const f = rowI[k]!;
      for (let j = k + 1; j < n; j++) {
        const a = rowI[j]! * pivot;
        const b = f * rowK[j]!;
        const x = a - b;
        // A product or a difference outside the safe range is not exact: start again on bigint.
        if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(x)) return null;
        rowI[j] = x / prev; // exact: Bareiss's division leaves no remainder
      }
    }
    prev = pivot;
  }
  return 'finite';
}

/** The pivot rule of classOfConnected on bigint, for matrices whose minors leave the safe range. */
function classByMinorsBig(C: readonly (readonly number[])[]): 'finite' | 'affine' | 'indefinite' {
  const n = C.length;
  const M = C.map((row) => row.map((x) => BigInt(x)));
  let prev = 1n;
  for (let k = 0; k < n; k++) {
    const pivot = M[k]![k]!;
    if (pivot <= 0n) return pivot === 0n && k === n - 1 ? 'affine' : 'indefinite';
    const rowK = M[k]!;
    for (let i = k + 1; i < n; i++) {
      const rowI = M[i]!;
      const f = rowI[k]!;
      for (let j = k + 1; j < n; j++) rowI[j] = (rowI[j]! * pivot - f * rowK[j]!) / prev;
    }
    prev = pivot;
  }
  return 'finite';
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
export function identify<T>(board: Board<T>): { name: string; order: number[] } | null;
export function identify(board: AnyBoard): { name: string; order: number[] } | null;
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
  return [...eachAffineCandidate(m)];
}

/**
 * The candidates of affineCandidates in the same order, each matrix built only when it is reached, so
 * that identifyAffine, which stops at the first match, does not enumerate the root systems of the
 * candidates after it (each extension enumerates the roots of a finite type of rank m - 1).
 */
function* eachAffineCandidate(m: number): Generator<{ name: string; cartan: number[][] }> {
  const n = m - 1;
  if (n < 1) return;
  for (const X of finiteCandidates(n)) {
    if (X === 'B2') continue;
    yield { name: `${X}~`, cartan: extendMatrix(cartan(X), false).cartan };
  }
  yield { name: `A${2 * n}^(2)`, cartan: twistedAEven(n) };
  if (n >= 3) yield { name: `A${2 * n - 1}^(2)`, cartan: transposed(extendMatrix(cartan(`B${n}`), false).cartan) };
  if (n >= 2) yield { name: `D${n + 1}^(2)`, cartan: transposed(extendMatrix(cartan(`C${n}`), false).cartan) };
  if (n === 4) yield { name: 'E6^(2)', cartan: transposed(extendMatrix(cartan('F4'), false).cartan) };
  if (n === 2) yield { name: 'D4^(3)', cartan: transposed(extendMatrix(cartan('G2'), false).cartan) };
}

/** The name of a connected affine board in any numbering (oracle lines 1221 to 1226); null on a one-way board and when no candidate matches. */
export function identifyAffine<T>(board: Board<T>): string | null;
export function identifyAffine(board: AnyBoard): string | null;
export function identifyAffine<T>(board: Board<T>): string | null {
  const C = intCartan(board);
  if (boardKind(C) !== 'gcm') return null;
  if (components(board).length !== 1) throw new NeedsConnectedBoard('identifyAffine needs a connected board');
  for (const cand of eachAffineCandidate(board.n)) {
    if (relabellingsOf(C, cand.cartan, 1).length > 0) return cand.name;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// classify (SPEC.md 5.2 "Five functions return records", 5.3, 5.6; oracle lines 1229 to 1253)
// ---------------------------------------------------------------------------------------------

/** The verdict computed afresh (the cache of E-11 lives in guards.ts). */
export function classifyUncached<T>(board: Board<T>): ClassifyRecord[];
export function classifyUncached(board: AnyBoard): ClassifyRecord[];
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
export function classify<T>(board: Board<T>): ClassifyRecord[];
export function classify(board: AnyBoard): ClassifyRecord[];
export function classify<T>(board: Board<T>): ClassifyRecord[] {
  return cachedClassify(board).map(copyRecord);
}

// ---------------------------------------------------------------------------------------------
// smallestNonfiniteSubboard (SPEC.md 5.5; oracle lines 1256 to 1271)
// ---------------------------------------------------------------------------------------------

/**
 * Calls f on each k-subset of 0..n-1 in lexicographic order (as itertools.combinations) until f returns
 * true. f sees one array that changes between calls, so it copies what it keeps.
 */
function eachCombination(n: number, k: number, f: (K: readonly number[]) => boolean): boolean {
  const K: number[] = [];
  for (let i = 0; i < k; i++) K.push(i);
  for (;;) {
    if (f(K)) return true;
    let i = k - 1;
    while (i >= 0 && K[i] === i + n - k) i -= 1;
    if (i < 0) return false;
    K[i] = K[i]! + 1;
    for (let j = i + 1; j < k; j++) K[j] = K[j - 1]! + 1;
  }
}

/** Whether the positions K form one piece, two positions joined when C[i][j] or C[j][i] is nonzero (as components). */
function connectedSet(C: number[][], K: readonly number[]): boolean {
  const reached: boolean[] = K.map((_, k) => k === 0);
  const stack: number[] = [0];
  let count = 1;
  while (stack.length > 0) {
    const i = K[stack.pop()!]!;
    for (let t = 0; t < K.length; t++) {
      const j = K[t]!;
      if (reached[t] || (C[i]![j] === 0 && C[j]![i] === 0)) continue;
      reached[t] = true;
      count += 1;
      stack.push(t);
    }
  }
  return count === K.length;
}

/** For each position, the positions joined to it (C[i][j] or C[j][i] nonzero) as bits of one integer; n <= 30. */
function neighbourMasks(C: readonly (readonly number[])[]): number[] {
  const n = C.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = 0; j < n; j++) if (j !== i && (C[i]![j] !== 0 || C[j]![i] !== 0)) m |= 1 << j;
    out.push(m);
  }
  return out;
}

/** connectedSet on the set of positions whose bits are in S (not empty), from the masks of neighbourMasks. */
function connectedMask(adj: readonly number[], S: number): boolean {
  let reached = S & -S;
  let open = reached;
  while (open !== 0) {
    const bit = open & -open;
    open ^= bit;
    const fresh = adj[31 - Math.clz32(bit)]! & S & ~reached;
    reached |= fresh;
    open |= fresh;
  }
  return reached === S;
}

/**
 * The first connected subset of positions, by increasing size and lexicographic within a size, whose
 * induced board is affine or indefinite, with its class; null when every connected subset is finite and
 * null on a board with a one-way road (the notion needs two-way roads). At most 2^n - 1 subsets.
 */
export function smallestNonfiniteSubboard<T>(board: Board<T>): NonfiniteSubboard | null;
export function smallestNonfiniteSubboard(board: AnyBoard): NonfiniteSubboard | null;
export function smallestNonfiniteSubboard<T>(board: Board<T>): NonfiniteSubboard | null {
  const C = intCartan(board);
  if (boardKind(C) !== 'gcm') return null;
  const n = board.n;
  // Connectedness of the 2^n - 1 subsets is tested on bit masks (n <= 30), which is most of the work on a
  // large board in few pieces; a larger board walks the matrix (RT-FIX residual P3-RT-07-02).
  const adj = n <= 30 ? neighbourMasks(C) : null;
  let found: NonfiniteSubboard | null = null;
  for (let size = 1; size <= n && found === null; size++) {
    eachCombination(n, size, (K) => {
      // The induced board is connected exactly when K is connected through the roads of the board, so
      // only a connected K is classified (most subsets of a large board are not). K is increasing, so its
      // rows and columns of C are the matrix of subBoard(board, K), which is a connected gcm board: the
      // rule of cartanClass is applied to that matrix without building the board.
      if (adj !== null) {
        let S = 0;
        for (let t = 0; t < K.length; t++) S |= 1 << K[t]!;
        if (!connectedMask(adj, S)) return false;
      } else if (!connectedSet(C, K)) return false;
      const cls = classOfConnected(K.map((i) => K.map((j) => C[i]![j]!)));
      if (cls === 'finite') return false;
      found = { nodes: [...K], class: cls };
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
export function spectralRadius<T>(board: Board<T>): number | null;
export function spectralRadius(board: AnyBoard): number | null;
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
