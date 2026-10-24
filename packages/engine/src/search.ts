// Breadth-first searches (SPEC.md 5.4, 5.5 "Orbits" and "Order and truncation of a search", E-6):
// orbitGraph is the one search routine; orbit, roots and positiveRoots call it. Port of the oracle's
// orbit_graph_capped (lines 1352 to 1370) with the legal_only test of orbit_graph (1328 to 1349),
// word_to (1373 to 1378), roots (186 to 190) and positive_roots (193 to 194). Positions are keyed by
// their entries joined as decimal text; a cap is reported in `truncated`, never thrown (E-10).
import type { Vec } from './arith';
import { Big, SafeInt } from './arith';
import type { Board } from './board';
import { CAPS } from './caps';
import type { Game } from './moves';
import { fire, mutate } from './moves';
import type { Word } from './moves';

export interface Enumeration<X> {
  items: X[];
  truncated: boolean;
}

export interface OrbitGraph<T> {
  items: Vec<T>[];
  truncated: boolean;
  depthReached: number; // the largest depth among items
  completeLayers: number; // every position of depth <= this is in items
  depth: number[]; // the three arrays are indexed like items
  parent: (number | null)[];
  node: (number | null)[];
}

function keyOf<T>(board: Board<T>, v: readonly T[]): string {
  // The entries joined as decimal text (5.5). Both arithmetics' `show` is the number's or the
  // bigint's own text, which Array.prototype.join writes natively; the generic loop over `show`
  // is kept for any other arithmetic (MERGE, stage 3.1, for the benchmark of 7.6).
  const arith = board.arith;
  if (arith === (SafeInt as unknown) || arith === (Big as unknown)) return v.join(',');
  const show = arith.show;
  let key = show(v[0]!);
  for (let j = 1; j < v.length; j++) key += ',' + show(v[j]!);
  return key;
}

/** Number.MAX_SAFE_INTEGER as a bigint. */
const SAFE_MAX = 9007199254740991n;

/** The low 30 bits: the hashes of searchOnNumbers are taken mod 2^30. */
const HASH_MASK = 0x3fffffff;

/** The odd number that marks position k in the hash of a position. */
function hashSeed(k: number): number {
  return Math.imul(k + 1, 0x9e3779b1) | 1;
}

/**
 * The share of the entry x (a safe integer) at the position marked r in the hash of a position: its low
 * 32 bits as a signed integer and the rest, x = rest * 2^32 + low (both exact: x - low is a multiple of
 * 2^32 below 2^54), mixed by multiplications and shifts (the finaliser of MurmurHash3), so that the share
 * is not linear in x. A share linear in x put every position of an orbit inside 2^30 Z^n on one hash, and
 * the search became quadratic in its cap (RT-FIX P4-RT-03-02).
 */
function entryHash(x: number, r: number): number {
  const low = x | 0;
  let h = low ^ r;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ ((x - low) / 4294967296), 0xc2b2ae35);
  return h ^ (h >>> 16);
}

/** The hash searchOnNumbers gives a position of safe integers: the sum of the shares of its entries, mod 2^30 (internal; for the tests). */
export function positionHash(v: readonly number[]): number {
  let hash = 0;
  for (let k = 0; k < v.length; k++) hash = (hash + entryHash(v[k]!, hashSeed(k))) & HASH_MASK;
  return hash;
}

/** The bigints -SMALL..SMALL, built on first use (nothing runs at module load) and shared by every search. */
const SMALL = 256;
let smallBigints: bigint[] | null = null;

/** The bigint of a safe integer; the small ones (most entries of a search) are shared, not allocated each time. */
function toBigint(x: number): bigint {
  if (x >= -SMALL && x <= SMALL) {
    if (smallBigints === null) {
      smallBigints = [];
      for (let k = -SMALL; k <= SMALL; k++) smallBigints.push(BigInt(k));
    }
    return smallBigints[x + SMALL]!;
  }
  return BigInt(x);
}

/** The arrays of a search in progress, as orbitGraph keeps them (the seeds are already in). */
interface SearchState<T> {
  items: T[][];
  depth: number[];
  parent: (number | null)[];
  node: (number | null)[];
  index: Map<string, number>;
}

/** The nonzero entries of each row (mutation) or each column (firing) of C: positions and values. */
function nonzeroLines(C: readonly (readonly number[])[], game: Game): { at: number[]; c: number[] }[] {
  const n = C.length;
  const out: { at: number[]; c: number[] }[] = [];
  for (let i = 0; i < n; i++) {
    const at: number[] = [];
    const c: number[] = [];
    for (let j = 0; j < n; j++) {
      const x = game === 'mutation' ? C[i]![j]! : C[j]![i]!;
      if (x !== 0) {
        at.push(j);
        c.push(x);
      }
    }
    out.push({ at, c });
  }
  return out;
}

/** v with its entry at `at` replaced by `x` equals w. */
function equalsWith(w: readonly number[], v: readonly number[], at: number, x: number): boolean {
  for (let k = 0; k < v.length; k++) if (w[k] !== (k === at ? x : v[k])) return false;
  return true;
}

/** w equals v. */
function equals(w: readonly number[], v: readonly number[]): boolean {
  for (let k = 0; k < v.length; k++) if (w[k] !== v[k]) return false;
  return true;
}

/**
 * The search of orbitGraph on a SafeInt or Big board, run on plain numbers while every value is a safe
 * integer (RT-FIX residual P3-RT-07-02: the main-thread searches of a tool's load, such as T4's root
 * counter on a custom board and the root systems behind classify). The moves are mutate and fire with the
 * same products and sums in the same order (zero entries skipped, as there), and a position is new exactly
 * when no earlier one has the same entries, which is what the decimal key tells in the generic loop; a
 * hash of the entries (a sum of a mixed share of each entry, entryHash, mod 2^30, updated in the entries
 * a move changes) only picks the earlier positions to compare with. Every value is an integer, so a product
 * or a sum is exact exactly when its size is at most Number.MAX_SAFE_INTEGER, which is what is checked
 * (the test of SafeInt, for integers). A move that changes no entry (a node
 * whose number is 0) gives the position itself, and the move that found a position, played again, gives
 * the position it came from (each move is its own inverse, SPEC 2.2 and 2.3): neither is ever new, so
 * neither is looked up (its products and sums are still checked). So the order, the depths, the
 * parents, the nodes, the cap and the layer bound act exactly as in the generic loop, and the items are
 * the same values in the board's arithmetic (bigint on a Big board). When a product, a sum or an entry
 * would leave the safe range, the items found so far are written back in the board's arithmetic, with
 * their keys, and the generic loop continues from that move (`result` null, `h` and `i` the move): on Big
 * it goes on in bigint, on SafeInt it throws EngineOverflow at that move as before. A seed or an entry of
 * C that is not a safe integer hands over at once.
 */
function searchOnNumbers<T>(
  board: Board<T>,
  big: boolean,
  state: SearchState<T>,
  game: Game,
  legal: boolean,
  cap: number,
  maxDepth: number | undefined,
): { result: OrbitGraph<T> | null; h: number; i: number } {
  const { n } = board;
  const { depth, parent, node, index } = state;
  const MAX = Number.MAX_SAFE_INTEGER;
  const safe = big ? (x: unknown): boolean => (x as bigint) <= SAFE_MAX && (x as bigint) >= -SAFE_MAX : (x: unknown): boolean => Number.isSafeInteger(x);
  if (!board.cartan.every((row) => row.every(safe)) || !state.items.every((v) => v.every(safe))) return { result: null, h: 0, i: 0 };
  const lines = nonzeroLines(
    board.cartan.map((row) => row.map((x) => Number(x))),
    game,
  );
  const seeds = state.items.length;
  const items: number[][] = big ? state.items.map((v) => v.map((x) => Number(x))) : (state.items as unknown as number[][]);
  // The hash of a position: the sum of entryHash of entry k with R[k], mod 2^30 (positionHash; kept below
  // 2^30 so that it stays a small integer for the engine's Map). By hash, the last position with it, and
  // for each position the one before it with the same hash.
  const R: number[] = [];
  for (let k = 0; k < n; k++) R.push(hashSeed(k));
  const hashes: number[] = [];
  const last = new Map<number, number>();
  const before: number[] = [];
  const remember = (k: number, hash: number): void => {
    hashes.push(hash);
    before.push(last.get(hash) ?? -1);
    last.set(hash, k);
  };
  for (const v of items) {
    let hash = 0;
    for (let k = 0; k < n; k++) hash = (hash + entryHash(v[k]!, R[k]!)) & HASH_MASK;
    remember(hashes.length, hash);
  }
  const out = (): T[][] => (big ? (items.map((v) => v.map(toBigint)) as unknown as T[][]) : (items as unknown as T[][]));
  const handOver = (h: number, i: number): { result: null; h: number; i: number } => {
    // On SafeInt the items are the state's own arrays already; on Big they are written back as bigint.
    if (big) {
      const back = out();
      state.items.length = 0;
      for (const v of back) state.items.push(v);
    }
    for (let k = seeds; k < items.length; k++) index.set(items[k]!.join(','), k);
    return { result: null, h, i };
  };
  const mutation = game === 'mutation';
  for (let h = 0; h < items.length; h++) {
    const v = items[h]!;
    const d = depth[h]!;
    if (maxDepth !== undefined && d >= maxDepth) continue;
    const hv = hashes[h]!;
    for (let i = 0; i < n; i++) {
      if (legal && !(v[i]! > 0)) continue;
      const { at, c } = lines[i]!;
      let w: number[];
      let hash: number;
      if (mutation) {
        // p_i <- p_i - sum_j C[i][j] p_j over the nonzero entries of row i (moves.ts mutate).
        let drop = 0;
        for (let t = 0; t < at.length; t++) {
          const prod = c[t]! * v[at[t]!]!;
          drop += prod;
          if (prod > MAX || prod < -MAX || drop > MAX || drop < -MAX) return handOver(h, i);
        }
        if (drop === 0) continue; // the position itself
        const x = v[i]! - drop;
        if (x > MAX || x < -MAX) return handOver(h, i);
        if (node[h] === i) continue; // a move is its own inverse: this is the position v came from
        // Most moves give a position already found: it is compared in place, and copied only when new.
        hash = (hv - entryHash(v[i]!, R[i]!) + entryHash(x, R[i]!)) & HASH_MASK;
        let k = last.get(hash) ?? -1;
        while (k >= 0 && !equalsWith(items[k]!, v, i, x)) k = before[k]!;
        if (k >= 0) continue;
        w = v.slice();
        w[i] = x === 0 ? 0 : x;
      } else {
        // a_j <- a_j - C[j][i] a_i over the nonzero entries of column i (moves.ts fire).
        const ai = v[i]!;
        if (ai === 0) continue; // the position itself
        w = v.slice();
        hash = hv;
        for (let t = 0; t < at.length; t++) {
          const j = at[t]!;
          const prod = c[t]! * ai;
          const x = v[j]! - prod;
          if (prod > MAX || prod < -MAX || x > MAX || x < -MAX) return handOver(h, i);
          w[j] = x === 0 ? 0 : x;
          hash = (hash - entryHash(v[j]!, R[j]!) + entryHash(x, R[j]!)) & HASH_MASK;
        }
        if (node[h] === i) continue; // a move is its own inverse: this is the position v came from
        let k = last.get(hash) ?? -1;
        while (k >= 0 && !equals(items[k]!, w)) k = before[k]!;
        if (k >= 0) continue;
      }
      if (items.length === cap) {
        return { result: { items: out(), truncated: true, depthReached: depth[items.length - 1]!, completeLayers: d, depth, parent, node }, h, i };
      }
      remember(items.length, hash);
      items.push(w);
      depth.push(d + 1);
      parent.push(h);
      node.push(i);
    }
  }
  const deepest = depth[items.length - 1]!;
  return { result: { items: out(), truncated: false, depthReached: deepest, completeLayers: deepest, depth, parent, node }, h: items.length, i: 0 };
}

/**
 * The positions reachable from the seeds, in breadth-first order (the seeds in the order given, then for
 * each position in the order found the nodes in increasing position), remembering for each position its
 * depth and the first move that reached it. A position at depth maxDepth is not expanded (truncated stays
 * false). The cap acts when the search is about to add position number cap + 1: it stops at once with
 * truncated true, exactly cap items, and completeLayers the depth of the position being expanded; when
 * the search is not cut, completeLayers is the largest depth present. legalOnly ('firing' only) follows
 * only nodes with a positive number.
 * Arguments (plan): seeds non-empty, each of length n; cap an integer at least the number of distinct
 * seeds; maxDepth, when given, a non-negative integer; legalOnly with 'mutation' is a RangeError.
 */
export function orbitGraph<T>(
  board: Board<T>,
  seeds: readonly Vec<T>[],
  game: Game,
  cap: number,
  maxDepth?: number,
  legalOnly?: boolean,
): OrbitGraph<T> {
  const { n, arith } = board;
  if (game !== 'mutation' && game !== 'firing') throw new RangeError(`unknown game ${String(game)}`);
  if (legalOnly === true && game !== 'firing') {
    throw new RangeError("legalOnly is defined for 'firing' only (raising play is raisingPlay)");
  }
  if (seeds.length === 0) throw new RangeError('a search needs at least one seed');
  if (!Number.isInteger(cap) || cap < 0) throw new RangeError(`the cap ${String(cap)} is not a non-negative integer`);
  if (maxDepth !== undefined && (!Number.isInteger(maxDepth) || maxDepth < 0)) {
    throw new RangeError(`maxDepth ${String(maxDepth)} is not a non-negative integer`);
  }
  const move = game === 'mutation' ? mutate : fire;
  const legal = legalOnly === true;

  const items: T[][] = [];
  const depth: number[] = [];
  const parent: (number | null)[] = [];
  const node: (number | null)[] = [];
  const index = new Map<string, number>();

  for (const seed of seeds) {
    if (seed.length !== n) {
      throw new RangeError(`a seed has ${seed.length} entries, but the board has ${n} nodes`);
    }
    const key = keyOf(board, seed);
    if (index.has(key)) continue; // a repeated seed is kept once, at its first occurrence
    index.set(key, items.length);
    items.push([...seed]);
    depth.push(0);
    parent.push(null);
    node.push(null);
  }
  if (items.length > cap) {
    throw new RangeError(`${items.length} distinct seeds exceed the cap of ${cap}`);
  }

  let h0 = 0;
  let i0 = 0;
  if (arith === (Big as unknown) || arith === (SafeInt as unknown)) {
    const fast = searchOnNumbers(board, arith === (Big as unknown), { items, depth, parent, node, index }, game, legal, cap, maxDepth);
    if (fast.result !== null) return fast.result;
    // A value left the safe range: the loop below goes on from the move the search stopped at (in bigint
    // on Big; on SafeInt that move throws EngineOverflow, as it always did).
    h0 = fast.h;
    i0 = fast.i;
  }

  for (let h = h0; h < items.length; h++) {
    const v = items[h]!;
    const d = depth[h]!;
    if (maxDepth !== undefined && d >= maxDepth) continue;
    for (let i = h === h0 ? i0 : 0; i < n; i++) {
      if (legal && arith.sign(v[i]!) <= 0) continue;
      const w = move(board, v, i);
      const key = keyOf(board, w);
      if (index.has(key)) continue;
      if (items.length === cap) {
        return { items, truncated: true, depthReached: depth[items.length - 1]!, completeLayers: d, depth, parent, node };
      }
      index.set(key, items.length);
      items.push(w);
      depth.push(d + 1);
      parent.push(h);
      node.push(i);
    }
  }
  const last = depth[items.length - 1]!;
  return { items, truncated: false, depthReached: last, completeLayers: last, depth, parent, node };
}

/** The items of orbitGraph with the same arguments, in the same order, with its truncation (plan). */
export function orbit<T>(board: Board<T>, seeds: readonly Vec<T>[], game: Game, cap: number, maxDepth?: number): Enumeration<T[]> {
  const g = orbitGraph(board, seeds, game, cap, maxDepth);
  return { items: g.items as T[][], truncated: g.truncated };
}

/** A shortest word from the seed of its tree to items[index]: follow parent back and reverse. A seed gives []. */
export function wordTo(graph: OrbitGraph<unknown>, index: number): Word {
  if (!Number.isInteger(index) || index < 0 || index >= graph.items.length) {
    throw new RangeError(`index ${String(index)} is outside the ${graph.items.length} items of the graph`);
  }
  const word: number[] = [];
  let k = index;
  for (;;) {
    const p = graph.parent[k];
    if (p === null || p === undefined) break;
    word.push(graph.node[k]!);
    k = p;
  }
  word.reverse();
  return word;
}

function unitVectors<T>(board: Board<T>): T[][] {
  const { n, arith } = board;
  const out: T[][] = [];
  for (let i = 0; i < n; i++) {
    const e: T[] = [];
    for (let j = 0; j < n; j++) e.push(j === i ? arith.one : arith.zero);
    out.push(e);
  }
  return out;
}

/** The root populations: the orbit of e_0, ..., e_{n-1}, in that order, under mutations (SPEC.md 2.2). */
export function roots<T>(board: Board<T>, cap: number, maxDepth?: number): Enumeration<T[]> {
  return orbit(board, unitVectors(board), 'mutation', cap, maxDepth);
}

/**
 * The positive ones among a list of root populations, sorted by total then lexicographically, ascending
 * (the oracle's key (sum(r), r)). Internal to the engine (finite.ts shares it); not part of the public API.
 */
export function positiveRootsFrom<T>(board: Board<T>, items: readonly Vec<T>[]): T[][] {
  const { arith } = board;
  const positive: { v: T[]; total: T }[] = [];
  for (const v of items) {
    let ok = true;
    let total = arith.zero;
    for (const x of v) {
      if (arith.sign(x) < 0) {
        ok = false;
        break;
      }
      total = arith.add(total, x);
    }
    if (ok) positive.push({ v: v as T[], total });
  }
  positive.sort((a, b) => {
    const dt = arith.sign(arith.sub(a.total, b.total));
    if (dt !== 0) return dt;
    for (let k = 0; k < a.v.length; k++) {
      const dk = arith.sign(arith.sub(a.v[k]!, b.v[k]!));
      if (dk !== 0) return dk;
    }
    return 0;
  });
  return positive.map((r) => r.v);
}

/**
 * The positive root populations sorted by total, then lexicographically (SPEC.md 5.4). The default cap is
 * CAPS.mainThreadItems (plan); a truncated search cannot be reported here, so callers off the finite
 * types use roots with maxDepth.
 */
export function positiveRoots<T>(board: Board<T>, cap: number = CAPS.mainThreadItems, maxDepth?: number): T[][] {
  return positiveRootsFrom(board, roots(board, cap, maxDepth).items);
}
