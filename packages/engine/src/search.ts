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

  for (let h = 0; h < items.length; h++) {
    const v = items[h]!;
    const d = depth[h]!;
    if (maxDepth !== undefined && d >= maxDepth) continue;
    for (let i = 0; i < n; i++) {
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
