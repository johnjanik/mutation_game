// Orbit polytopes by Wythoff's construction (SPEC.md 2.14 "Orbit polytopes": vertices, edges, faces of every
// dimension; 5.4 "Geometry": wythoffFaceTypes, wythoffFVector, wythoffEdges, "exact"; 5.6; E-4, E-5, E-6,
// E-7; CONTRACTS.md 2.1, 2.2 FaceType, 2.4 phase 4; owner P4-A1). Ports of the oracle's induced_components
// (reference/lie_games.py lines 720 to 731), wythoff_face_types (739 to 754), wythoff_f_vector (757 to
// 761) and wythoff_edges (764 to 785). Integer arithmetic only (E-1): counts are bigint (E-4), edges are in
// the board's arithmetic. Positions in, positions out (E-7): the oracle's wythoff_face_types returns
// [i + 1 for i in K]; this module returns K. A node is ringed when its entry of `rings` is not zero.
// Guards (5.6): NeedsTwoWayRoads on a one-way board, NotFiniteType off the finite types, through guards.ts
// (E-11), after the argument check. The cap of wythoffEdges is a result field, never a throw (E-10).
import { Big, SafeInt } from './arith';
import type { AnyBoard, Board } from './board';
import { cartanNumbers, subBoard } from './board';
import { EngineError } from './errors';
import { requireFinite, requireGcm } from './guards';
import { fire } from './moves';
import type { Enumeration } from './search';
import { weylOrder } from './weyl';

/** One face type of an orbit polytope (CONTRACTS.md 2.2, plan): K as positions, |K|, the number of faces. */
export interface FaceType {
  nodes: number[];
  dimension: number;
  count: bigint;
}

/**
 * RangeError unless `rings` has one entry per position, each a non-negative safe integer (plan: SPEC.md
 * 2.14 takes a dominant position, and T10 offers "a non-negative integer on each node").
 */
function checkRings(n: number, rings: readonly number[]): void {
  if (!Array.isArray(rings) || rings.length !== n) {
    throw new RangeError(`rings needs one entry per node: ${n}, not ${Array.isArray(rings) ? rings.length : 'none'}`);
  }
  for (const x of rings) {
    if (!Number.isSafeInteger(x) || x < 0) throw new RangeError(`the ring entry ${String(x)} is not a non-negative integer`);
  }
}

function guardFinite<T>(board: Board<T>): void {
  requireGcm(board);
  requireFinite(board);
}

/**
 * The connected components of the sub-board induced on K (the oracle's induced_components): K sorted; for
 * each s of K not yet seen, the nodes of K reached from s, joined when C[i][j] != 0 or C[j][i] != 0; each
 * component sorted, components in order of least position.
 */
function inducedComponents(C: readonly (readonly number[])[], K: readonly number[]): number[][] {
  const sorted = [...K].sort((a, b) => a - b);
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const s of sorted) {
    if (seen.has(s)) continue;
    const comp = [s];
    seen.add(s);
    const stack = [s];
    while (stack.length > 0) {
      const i = stack.pop()!;
      for (const j of sorted) {
        if (!seen.has(j) && (C[i]![j] !== 0 || C[j]![i] !== 0)) {
          seen.add(j);
          comp.push(j);
          stack.push(j);
        }
      }
    }
    comp.sort((a, b) => a - b);
    out.push(comp);
  }
  return out;
}

/**
 * |W_K| (plan, equivalent to the oracle's weyl_order(sub_matrix(C, K))): 1 for the empty set, otherwise the
 * product over the connected components of K of weylOrder(subBoard(board, component)), as bigint. The orders
 * of the components are kept in `cache` for the length of one call only (E-5: nothing across calls).
 */
function parabolicOrder<T>(
  board: Board<T>,
  C: readonly (readonly number[])[],
  K: readonly number[],
  cache: Map<string, bigint>,
): bigint {
  let order = 1n;
  for (const comp of inducedComponents(C, K)) {
    const key = comp.join(',');
    let w = cache.get(key);
    if (w === undefined) {
      w = BigInt(weylOrder(subBoard(board, comp)));
      cache.set(key, w);
    }
    order *= w;
  }
  return order;
}

/**
 * The face types of the orbit polytope of the dominant position `rings` (SPEC.md 2.14; oracle
 * wythoff_face_types): for every set K of positions, in bit-mask order (bit i of the mask is position i),
 * such that every connected component of K contains a ringed node, the record { nodes: K ascending,
 * dimension: |K|, count: |W| / (|W_K| |W_K'|) } with K' the unringed nodes neither in K nor joined to K
 * (in either direction). The empty set, the vertices, is always present. Counts are bigint, divided
 * exactly. RangeError on a `rings` of the wrong length or with an entry that is not a non-negative integer
 * (plan); NeedsTwoWayRoads, NotFiniteType (5.6).
 */
export function wythoffFaceTypes<T>(board: Board<T>, rings: readonly number[]): FaceType[];
export function wythoffFaceTypes(board: AnyBoard, rings: readonly number[]): FaceType[];
export function wythoffFaceTypes<T>(board: Board<T>, rings: readonly number[]): FaceType[] {
  const n = board.n;
  checkRings(n, rings);
  guardFinite(board);
  const C = cartanNumbers(board as unknown as AnyBoard);
  const ringed: boolean[] = rings.map((x) => x !== 0);
  const W = BigInt(weylOrder(board));
  const cache = new Map<string, bigint>();
  const out: FaceType[] = [];
  const masks = 2 ** n;
  for (let mask = 0; mask < masks; mask++) {
    const K: number[] = [];
    for (let i = 0; i < n; i++) if (Math.floor(mask / 2 ** i) % 2 === 1) K.push(i);
    if (inducedComponents(C, K).some((comp) => !comp.some((i) => ringed[i]))) continue;
    const Kp: number[] = [];
    for (let j = 0; j < n; j++) {
      if (K.includes(j) || ringed[j]) continue;
      if (K.every((k) => C[j]![k] === 0 && C[k]![j] === 0)) Kp.push(j);
    }
    const denominator = parabolicOrder(board, C, K, cache) * parabolicOrder(board, C, Kp, cache);
    if (W % denominator !== 0n) {
      throw new EngineError(`|W| = ${W} is not a multiple of |W_K| |W_K'| = ${denominator} for K = [${K.join(', ')}]`);
    }
    out.push({ nodes: K, dimension: K.length, count: W / denominator });
  }
  return out;
}

/**
 * The numbers of faces of every dimension (oracle wythoff_f_vector): f[d] is the sum of the counts of the
 * face types of dimension d, for d = 0..n, so n + 1 entries as in the oracle: f[0] the vertices, f[1] the
 * edges, ..., f[n] = 1 when some node is ringed (the polytope itself) and 0 when none is. With no ring the
 * result is [1, 0, ..., 0]. Arguments and guards as wythoffFaceTypes.
 */
export function wythoffFVector<T>(board: Board<T>, rings: readonly number[]): bigint[];
export function wythoffFVector(board: AnyBoard, rings: readonly number[]): bigint[];
export function wythoffFVector<T>(board: Board<T>, rings: readonly number[]): bigint[] {
  const faces = wythoffFaceTypes(board, rings);
  const f: bigint[] = [];
  for (let d = 0; d <= board.n; d++) f.push(0n);
  for (const ft of faces) f[ft.dimension] = f[ft.dimension]! + ft.count;
  return f;
}

/**
 * The edges of the orbit polytope (oracle wythoff_edges; SPEC.md 2.14 "Edges"): the images under the group
 * of the base edges {lambda, R_i lambda}, i ringed, with lambda = rings as a position of the numbers game.
 * Seeds for i from 0 to n - 1 with lambda_i != 0, then breadth first over the pairs in the order found,
 * firing both ends at each node in increasing position. Each item is [u, v] with u before v in the
 * lexicographic order of their entries compared as integers, entries as numbers; items are in discovery
 * order and distinct (keyed by the decimal text of both ends). The cap acts when the search is about to add
 * item number cap + 1: it stops at once with exactly `cap` items and truncated true (E-6; the oracle raises
 * OverflowError there); otherwise every edge, truncated false. No ringed node: no edge. RangeError on a bad
 * `rings` (as wythoffFaceTypes) or a cap that is not a non-negative integer (plan); NeedsTwoWayRoads,
 * NotFiniteType (5.6).
 */
export function wythoffEdges<T>(board: Board<T>, rings: readonly number[], cap: number): Enumeration<[number[], number[]]>;
export function wythoffEdges(board: AnyBoard, rings: readonly number[], cap: number): Enumeration<[number[], number[]]>;
export function wythoffEdges<T>(board: Board<T>, rings: readonly number[], cap: number): Enumeration<[number[], number[]]> {
  const n = board.n;
  checkRings(n, rings);
  if (!Number.isInteger(cap) || cap < 0) throw new RangeError(`the cap ${String(cap)} is not a non-negative integer`);
  guardFinite(board);
  const arith = board.arith;
  const native = arith === (SafeInt as unknown) || arith === (Big as unknown);
  const textOf = (v: readonly T[]): string => (native ? v.join(',') : v.map((x) => arith.show(x)).join(','));
  const toNumber = (x: T): number => (arith === (SafeInt as unknown) ? (x as unknown as number) : Number(arith.toBig(x)));
  const compare = (u: readonly T[], v: readonly T[]): number => {
    for (let k = 0; k < n; k++) {
      const s = arith.sign(arith.sub(u[k]!, v[k]!));
      if (s !== 0) return s;
    }
    return 0;
  };

  const seen = new Set<string>();
  const queue: [T[], T[]][] = [];
  const items: [number[], number[]][] = [];
  // records the pair (u, v) in canonical order unless it is known; false when the cap stops the search
  const record = (u: T[], v: T[]): boolean => {
    const [a, b] = compare(u, v) <= 0 ? [u, v] : [v, u];
    const key = `${textOf(a)}|${textOf(b)}`;
    if (seen.has(key)) return true;
    if (items.length === cap) return false;
    seen.add(key);
    queue.push([a, b]);
    items.push([a.map(toNumber), b.map(toNumber)]);
    return true;
  };

  const lam: T[] = rings.map((x) => arith.fromInt(x));
  for (let i = 0; i < n; i++) {
    if (arith.sign(lam[i]!) === 0) continue;
    if (!record(lam, fire(board, lam, i))) return { items, truncated: true };
  }
  for (let head = 0; head < queue.length; head++) {
    const [u, v] = queue[head]!;
    for (let i = 0; i < n; i++) {
      if (!record(fire(board, u, i), fire(board, v, i))) return { items, truncated: true };
    }
  }
  return { items, truncated: false };
}
