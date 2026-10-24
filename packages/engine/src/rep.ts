// Representations read off the numbers game (SPEC.md 2.18, 5.2, 5.4 table "Representations", 5.6;
// CONTRACTS.md 2.1, 2.2, 2.4 phase 5; owner P5-A1). Ports of the oracle's sparse helpers sp_mul, sp_add,
// sp_comm and sp_scale (reference/lie_games.py lines 811 to 834, with the comment at line 809), of
// chevalley_serre_ok (837 to 853), minuscule_matrices (856 to 877), string_through (1744 to 1748) and
// signed_moves (1751 to 1758). Phase 7 adds orbitPlusZeroMatrices here, built on the same sparse
// operations and checked by the same chevalleySerre.
//
// Matrices are sparse: a Map from the key "row,column" (spKey) to a nonzero bigint, on every board, SafeInt
// boards included (E-1, E-4). Rows and columns are basis indices from 0; the row of an entry is the image
// and the column the source, so the matrices act on column vectors and spMul(X, Y) is "first Y, then X".
// No stored entry is zero: every operation drops zeros from its result, as the oracle's final
// `{k: v for k, v in out.items() if v != 0}` does, and the empty Map is the zero matrix.
//
// Conventions at this boundary (E-5, E-7): node positions in and out (i, k, RelationCheck.i and .j); pure
// functions that never write into a board, a vector or a Map they are given and always return new arrays
// and new Maps. No label arithmetic, no worker, no cap thrown (E-9, E-10).
//
// Guards (5.6, last row of the second table; E-11): minusculeMatrices, chevalleySerre and stringThrough check
// their arguments first (RangeError), then call requireGcm and requireFinite, as every earlier function of
// the finite theory does; signedMoves takes no board and has no guard. Each function that takes a board has
// the AnyBoard overload of P2-A1's pattern, so that tools can pass the union type.
import type { AnyBoard, Board } from './board';
import { CAPS } from './caps';
import { EngineOverflow } from './errors';
import { requireFinite, requireGcm } from './guards';
import { fire } from './moves';
import { orbit } from './search';

/** A sparse integer matrix: key "row,column" (spKey), nonzero bigint values (SPEC.md 5.2, verbatim). */
export type SparseMatrix = Map<string, bigint>;

/** One instance of one Chevalley-Serre relation with both sides (SPEC.md 5.2, verbatim). */
export interface RelationCheck {
  relation: 'hh' | 'he' | 'hf' | 'ef' | 'serre-e' | 'serre-f';
  i: number;
  j: number;
  holds: boolean;
  left: SparseMatrix;
  right: SparseMatrix;
}

// ---------------------------------------------------------------------------------------------
// The sparse operations (oracle lines 809 to 834)
// ---------------------------------------------------------------------------------------------

/** The key of a matrix entry, without checks (internal; spKey checks). */
function keyOf(row: number, column: number): string {
  return `${row},${column}`;
}

/**
 * The key of the entry in row `row` and column `column`: the two decimal integers joined by one comma, no
 * spaces, no leading zeros ("0,2", "12,3"). Both must be non-negative safe integers (RangeError otherwise).
 */
export function spKey(row: number, column: number): string {
  if (!Number.isSafeInteger(row) || row < 0 || !Number.isSafeInteger(column) || column < 0) {
    throw new RangeError(`a matrix entry needs a non-negative integer row and column, not ${String(row)} and ${String(column)}`);
  }
  return keyOf(row, column);
}

const KEY = /^(0|[1-9][0-9]*),(0|[1-9][0-9]*)$/;

/** Row and column of a key written as spKey writes it; RangeError on any other text. */
function parseKey(key: string): [number, number] {
  const m = KEY.exec(key);
  if (m === null) throw new RangeError(`${JSON.stringify(key)} is not a matrix key "row,column"`);
  const r = Number(m[1]);
  const c = Number(m[2]);
  if (!Number.isSafeInteger(r) || !Number.isSafeInteger(c)) throw new RangeError(`${JSON.stringify(key)} is not a matrix key "row,column"`);
  return [r, c];
}

/** The entries of `out` that are not zero, in the order of `out` (the oracle's final filter). */
function zeroFree(out: Map<string, bigint>): SparseMatrix {
  const res: SparseMatrix = new Map();
  for (const [k, v] of out) if (v !== 0n) res.set(k, v);
  return res;
}

/**
 * The product XY: (XY)[r][c] = sum_k X[r][k] Y[k][c] (oracle sp_mul): the entries of Y grouped by row k,
 * then for each entry (r, k) of X and each (c, w) in row k of Y, v * w added to (r, c); zeros dropped.
 * Each key is parsed once (RangeError on a key that spKey would not write).
 */
export function spMul(X: SparseMatrix, Y: SparseMatrix): SparseMatrix {
  const byRow = new Map<number, [number, bigint][]>();
  for (const [key, w] of Y) {
    const [k, c] = parseKey(key);
    let row = byRow.get(k);
    if (row === undefined) {
      row = [];
      byRow.set(k, row);
    }
    row.push([c, w]);
  }
  const out = new Map<string, bigint>();
  for (const [key, v] of X) {
    const [r, k] = parseKey(key);
    const row = byRow.get(k);
    if (row === undefined) continue;
    for (const [c, w] of row) {
      const at = keyOf(r, c);
      out.set(at, (out.get(at) ?? 0n) + v * w);
    }
  }
  return zeroFree(out);
}

/** X + cy Y, cy defaulting to 1n (oracle sp_add): a copy of X, then cy * v added for each entry of Y; zeros dropped. */
export function spAdd(X: SparseMatrix, Y: SparseMatrix, cy: bigint = 1n): SparseMatrix {
  const out = new Map<string, bigint>(X);
  for (const [k, v] of Y) out.set(k, (out.get(k) ?? 0n) + cy * v);
  return zeroFree(out);
}

/** The commutator [X, Y] = XY - YX (oracle sp_comm). */
export function spComm(X: SparseMatrix, Y: SparseMatrix): SparseMatrix {
  return spAdd(spMul(X, Y), spMul(Y, X), -1n);
}

/** cX (oracle sp_scale); the empty Map when c is 0n. */
export function spScale(X: SparseMatrix, c: bigint): SparseMatrix {
  const out: SparseMatrix = new Map();
  for (const [k, v] of X) {
    const x = c * v;
    if (x !== 0n) out.set(k, x);
  }
  return out;
}

/**
 * Whether X and Y have the same nonzero entries: Python's `==` on zero-free dictionaries, independent of
 * insertion order. An explicit 0n entry in either counts as absent (plan), so that a Map built without the
 * invariant still compares correctly.
 */
export function spEq(X: SparseMatrix, Y: SparseMatrix): boolean {
  let nx = 0;
  for (const [k, v] of X) {
    if (v === 0n) continue;
    nx += 1;
    if (Y.get(k) !== v) return false;
  }
  let ny = 0;
  for (const v of Y.values()) if (v !== 0n) ny += 1;
  return nx === ny;
}

// ---------------------------------------------------------------------------------------------
// Shared argument checks
// ---------------------------------------------------------------------------------------------

/** RangeError unless i is a node position of the board. */
function checkNode<T>(board: Board<T>, i: number): void {
  if (!Number.isInteger(i) || i < 0 || i >= board.n) {
    throw new RangeError(`node position ${String(i)} is outside 0..${board.n - 1}`);
  }
}

const SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);

/** An entry of either arithmetic as a safe integer number (-0 written as 0); EngineOverflow when it is not one. */
function safeNumber(x: unknown): number {
  if (typeof x === 'bigint') {
    if (x > SAFE_MAX || x < -SAFE_MAX) throw new EngineOverflow(`the entry ${x.toString()} is not a safe integer`);
    return Number(x);
  }
  if (typeof x !== 'number' || !Number.isSafeInteger(x)) throw new EngineOverflow(`the entry ${String(x)} is not a safe integer`);
  return x === 0 ? 0 : x;
}

/** Numeric lexicographic order, largest first: Python's sorted(..., reverse=True) on tuples of integers. */
function decreasing(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) return a[k]! > b[k]! ? -1 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------
// minusculeMatrices (oracle minuscule_matrices, lines 856 to 877)
// ---------------------------------------------------------------------------------------------

/**
 * The operators on the orbit of the fundamental weight omega_i (i a node position) read off the numbers game
 * (SPEC.md 2.18): one basis vector per position of the orbit, and for a basis vector a and a node k, with
 * b = fire(a, k), the entry (index of b, index of a) is 1 in moves[k] for every a (the firing move as a
 * permutation matrix, a diagonal entry when a_k = 0), in F[k] when a_k = 1, in E[k] when a_k = -1; H[k] holds
 * a_k on the diagonal where a_k is not 0. On a minuscule node these satisfy the Chevalley-Serre relations and
 * moves[k] = E[k] + F[k] + P_k^0; on any other node the matrices are still built (entries 2 or -2 reach H and
 * moves only), so that T12 can show the failure.
 *
 * The basis is the orbit sorted by numeric lexicographic order, largest first (E-5; the oracle's
 * sorted(orbit, reverse=True)), so its first vector is not omega_i in general. Basis vectors are numbers;
 * on a Board<bigint> each entry is converted after a check (EngineOverflow otherwise, which a finite orbit
 * within the cap never meets). The matrices are bigint on every board.
 *
 * Cap (5.4, 5.6 "Orbit for which T12 builds matrices"; default CAPS.repOrbit): null exactly when the orbit
 * of omega_i has more than `cap` positions, decided by the search of orbit(board, [omega_i], 'firing', cap)
 * and its `truncated` (5.5: an orbit of exactly `cap` positions is not truncated, so it is built). The oracle
 * has no cap. RangeError when i is not a node position or cap is not a positive integer; then requireGcm
 * and requireFinite.
 */
export function minusculeMatrices<T>(
  board: Board<T>,
  i: number,
  cap?: number,
): { basis: number[][]; E: SparseMatrix[]; F: SparseMatrix[]; H: SparseMatrix[]; moves: SparseMatrix[] } | null;
export function minusculeMatrices(
  board: AnyBoard,
  i: number,
  cap?: number,
): { basis: number[][]; E: SparseMatrix[]; F: SparseMatrix[]; H: SparseMatrix[]; moves: SparseMatrix[] } | null;
export function minusculeMatrices<T>(
  board: Board<T>,
  i: number,
  cap: number = CAPS.repOrbit,
): { basis: number[][]; E: SparseMatrix[]; F: SparseMatrix[]; H: SparseMatrix[]; moves: SparseMatrix[] } | null {
  checkNode(board, i);
  if (!Number.isSafeInteger(cap) || cap < 1) throw new RangeError(`the cap ${String(cap)} is not a positive integer`);
  requireGcm(board);
  requireFinite(board);
  const { n, arith } = board;
  const omega: T[] = [];
  for (let k = 0; k < n; k++) omega.push(k === i ? arith.one : arith.zero);
  const found = orbit(board, [omega], 'firing', cap);
  if (found.truncated) return null;

  const numbers = found.items.map((v) => v.map(safeNumber));
  const order = numbers.map((_, k) => k).sort((p, q) => decreasing(numbers[p]!, numbers[q]!));
  const basis = order.map((k) => numbers[k]!);
  const items = order.map((k) => found.items[k]!);
  const index = new Map<string, number>();
  basis.forEach((a, r) => index.set(a.join(','), r));

  const E: SparseMatrix[] = [];
  const F: SparseMatrix[] = [];
  const H: SparseMatrix[] = [];
  const moves: SparseMatrix[] = [];
  for (let k = 0; k < n; k++) {
    E.push(new Map());
    F.push(new Map());
    H.push(new Map());
    moves.push(new Map());
  }
  for (let r = 0; r < basis.length; r++) {
    const a = basis[r]!;
    for (let k = 0; k < n; k++) {
      // join writes a number and a bigint with the same decimal text, and -0 as 0, as the basis keys are written
      const c = index.get(fire(board, items[r]!, k).join(','));
      if (c === undefined) throw new Error(`firing node position ${k} left the orbit of omega_${i}, which cannot happen on a finite board`);
      const at = keyOf(c, r);
      moves[k]!.set(at, 1n);
      if (a[k] === 1) F[k]!.set(at, 1n);
      else if (a[k] === -1) E[k]!.set(at, 1n);
      if (a[k] !== 0) H[k]!.set(keyOf(r, r), BigInt(a[k]!));
    }
  }
  return { basis, E, F, H, moves };
}

// ---------------------------------------------------------------------------------------------
// signedMoves (oracle signed_moves, lines 1751 to 1758)
// ---------------------------------------------------------------------------------------------

/**
 * For the matrices of minusculeMatrices: E[k] - F[k] + P_k^0 for each k from 0 to E.length - 1, where P_k^0
 * projects onto the basis vectors whose number at node position k is 0 (SPEC.md 2.18: on a minuscule node this
 * is exp(E_k) exp(-F_k) exp(E_k), the game move with signs, and its square is (-1)^{H_k}). Computed as
 * spAdd(spAdd(E[k], F[k], -1n), P0), the oracle's order. No board, so no guard (plan reading of 5.6);
 * RangeError when E and F differ in length or a basis vector is shorter than E.
 */
export function signedMoves(
  basis: readonly (readonly number[])[],
  E: readonly SparseMatrix[],
  F: readonly SparseMatrix[],
): SparseMatrix[] {
  if (E.length !== F.length) throw new RangeError(`E has ${E.length} matrices and F has ${F.length}`);
  for (const a of basis) {
    if (a.length < E.length) throw new RangeError(`a basis vector has ${a.length} entries, fewer than the ${E.length} matrices of E`);
  }
  const out: SparseMatrix[] = [];
  for (let k = 0; k < E.length; k++) {
    const P0: SparseMatrix = new Map();
    for (let r = 0; r < basis.length; r++) if (basis[r]![k] === 0) P0.set(keyOf(r, r), 1n);
    out.push(spAdd(spAdd(E[k]!, F[k]!, -1n), P0));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// chevalleySerre (oracle chevalley_serre_ok, lines 837 to 853)
// ---------------------------------------------------------------------------------------------

/**
 * One RelationCheck for every instance of the Chevalley-Serre relations of SPEC.md 2.18, with both sides,
 * where the oracle returns one boolean (true exactly when every record holds). With C the board's Cartan
 * matrix in node positions, as bigint:
 *   hh  [H_i, H_j]        = 0
 *   he  [H_i, E_j]        = C[i][j] E_j
 *   hf  [H_i, F_j]        = -C[i][j] F_j
 *   ef  [E_i, F_j]        = H_i when i = j (a copy), else 0
 *   serre-e  ad(E_i)^(1 - C[i][j]) E_j = 0, for i != j: x = E[j], then 1 - C[i][j] times x = [E_i, x]
 *   serre-f  the same with F
 * Order (plan; the oracle's loop): i from 0 to n-1, then j from 0 to n-1, and within each pair hh, he, hf,
 * ef, then serre-e and serre-f when i != j; 6n^2 - 2n records. The oracle's one Serre boolean is split into
 * two records. holds is spEq(left, right); a failing relation is returned, never thrown, and every side is a
 * new Map. General: nothing assumes entries in {0, 1} or a particular basis (phase 7 checks matrices with
 * entries 2 here). RangeError unless E, F and H have one matrix per node; then requireGcm and requireFinite.
 */
export function chevalleySerre<T>(
  board: Board<T>,
  E: readonly SparseMatrix[],
  F: readonly SparseMatrix[],
  H: readonly SparseMatrix[],
): RelationCheck[];
export function chevalleySerre(
  board: AnyBoard,
  E: readonly SparseMatrix[],
  F: readonly SparseMatrix[],
  H: readonly SparseMatrix[],
): RelationCheck[];
export function chevalleySerre<T>(
  board: Board<T>,
  E: readonly SparseMatrix[],
  F: readonly SparseMatrix[],
  H: readonly SparseMatrix[],
): RelationCheck[] {
  const { n } = board;
  for (const [name, list] of [['E', E], ['F', F], ['H', H]] as const) {
    if (list.length !== n) throw new RangeError(`${name} has ${list.length} matrices, but the board has ${n} nodes`);
  }
  requireGcm(board);
  requireFinite(board);
  const C: bigint[][] = board.cartan.map((row) => row.map((x) => board.arith.toBig(x)));
  const out: RelationCheck[] = [];
  const record = (relation: RelationCheck['relation'], i: number, j: number, left: SparseMatrix, right: SparseMatrix): void => {
    out.push({ relation, i, j, holds: spEq(left, right), left, right });
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cij = C[i]![j]!;
      record('hh', i, j, spComm(H[i]!, H[j]!), new Map());
      record('he', i, j, spComm(H[i]!, E[j]!), spScale(E[j]!, cij));
      record('hf', i, j, spComm(H[i]!, F[j]!), spScale(F[j]!, -cij));
      record('ef', i, j, spComm(E[i]!, F[j]!), i === j ? spScale(H[i]!, 1n) : new Map());
      if (i !== j) {
        // ad(E_i) applied 1 - C[i][j] times to E_j (at least once: C[i][j] <= 0 off the diagonal of a gcm)
        let x = spScale(E[j]!, 1n);
        let y = spScale(F[j]!, 1n);
        for (let t = 0n; t < 1n - cij; t++) {
          x = spComm(E[i]!, x);
          y = spComm(F[i]!, y);
        }
        record('serre-e', i, j, x, new Map());
        record('serre-f', i, j, y, new Map());
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// stringThrough (oracle string_through, lines 1744 to 1748)
// ---------------------------------------------------------------------------------------------

/**
 * The string through mu at node position i: mu, mu - alpha_i, ..., mu - mu_i alpha_i, mu_i + 1 positions,
 * where subtracting alpha_i subtracts column i of C (C[j][i] for each j; SPEC.md 2.18 "Strings", 4 T12). The
 * first element is a copy of mu and the last is fire(mu, i); firing node i turns the string end over end.
 * mu need not lie in any orbit nor be dominant; only mu_i >= 0 is required (the oracle asserts it). No cap on
 * the length (the specification gives none). Numbers, each entry checked to be a safe integer as it is
 * computed (EngineOverflow otherwise, the SafeInt rule of E-2). RangeError when i is not a node position, mu
 * has not one entry per node, an entry is not a safe integer, or mu_i < 0; then requireGcm and requireFinite.
 */
export function stringThrough<T>(board: Board<T>, mu: readonly number[], i: number): number[][];
export function stringThrough(board: AnyBoard, mu: readonly number[], i: number): number[][];
export function stringThrough<T>(board: Board<T>, mu: readonly number[], i: number): number[][] {
  const { n } = board;
  checkNode(board, i);
  if (mu.length !== n) throw new RangeError(`mu has ${mu.length} entries, but the board has ${n} nodes`);
  for (const x of mu) {
    if (typeof x !== 'number' || !Number.isSafeInteger(x)) throw new RangeError(`the entry ${String(x)} of mu is not a safe integer`);
  }
  const top = mu[i]!;
  if (top < 0) {
    throw new RangeError(`the string through mu at node position ${i} needs mu_${i} >= 0, but mu_${i} is ${top}`);
  }
  requireGcm(board);
  requireFinite(board);
  const column: number[] = [];
  for (let j = 0; j < n; j++) column.push(safeNumber(board.cartan[j]![i]));
  let current = mu.map((x) => (x === 0 ? 0 : x));
  const out: number[][] = [current];
  for (let k = 1; k <= top; k++) {
    const next: number[] = [];
    for (let j = 0; j < n; j++) {
      const x = current[j]! - column[j]!;
      if (!Number.isSafeInteger(x)) {
        throw new EngineOverflow(`element ${k} of the string at node position ${i} has the entry ${String(x)}, which is not a safe integer`);
      }
      next.push(x === 0 ? 0 : x);
    }
    out.push(next);
    current = next;
  }
  return out;
}
