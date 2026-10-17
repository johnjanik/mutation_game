// P1-A3: the deterministic layered layout of SPEC.md 7.1 (T2's orbit graphs, root posets, T8).
import { describe, expect, it } from 'vitest';
import { layeredLayout, type LayeredInput } from '../../src/components/draw/layeredLayout';

/** A small ranked graph: a diamond with a tail and an edge spanning two ranks. */
const SAMPLE: LayeredInput = {
  keys: ['root', 'b', 'a', 'c', 'top', 'side'],
  rank: [0, 1, 1, 1, 2, 3],
  edges: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [2, 4],
    [4, 5],
    [3, 5],
  ],
};

/** Coordinates by key, for comparing layouts of differently ordered inputs. */
function byKey(input: LayeredInput): Record<string, [number, number]> {
  const out = layeredLayout(input);
  const r: Record<string, [number, number]> = {};
  input.keys.forEach((k, v) => (r[k] = [out.x[v]!, out.y[v]!]));
  return r;
}

/** A deterministic shuffle (a fixed linear congruential sequence), so the test needs no random source. */
function shuffled<T>(xs: readonly T[], seed: number): T[] {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** The same graph with vertices renumbered by the permutation `perm` (new index of old v is perm[v]). */
function renumber(input: LayeredInput, seed: number): LayeredInput {
  const n = input.keys.length;
  const order = shuffled(Array.from({ length: n }, (_, k) => k), seed);
  const perm: number[] = [];
  order.forEach((old, neu) => (perm[old] = neu));
  const keys: string[] = new Array<string>(n);
  const rank: number[] = new Array<number>(n);
  for (let v = 0; v < n; v++) {
    keys[perm[v]!] = input.keys[v]!;
    rank[perm[v]!] = input.rank[v]!;
  }
  const edges = shuffled(input.edges, seed + 1).map(([a, b], k) => (k % 2 === 0 ? [perm[a]!, perm[b]!] : [perm[b]!, perm[a]!]) as [number, number]);
  return { keys, rank, edges };
}

/** A random-looking but fixed graph of `n` vertices on ranks 0..depth with edges between ranks. */
function bigGraph(n: number, depth: number): LayeredInput {
  const keys = Array.from({ length: n }, (_, k) => `v${String(k).padStart(5, '0')}`);
  const rank = keys.map((_, k) => (k === 0 ? 0 : 1 + ((k * 7919) % depth)));
  const edges: [number, number][] = [];
  for (let v = 1; v < n; v++) {
    const below = [];
    for (let w = Math.max(0, v - 40); w < v; w++) if (rank[w]! < rank[v]!) below.push(w);
    if (below.length === 0) below.push(0);
    edges.push([below[(v * 31) % below.length]!, v]);
    if (below.length > 1) edges.push([below[(v * 17) % below.length]!, v]);
  }
  return { keys, rank, edges };
}

describe('layeredLayout', () => {
  it('keeps every vertex on its rank', () => {
    const out = layeredLayout(SAMPLE);
    expect(out.y).toEqual([...SAMPLE.rank]);
    expect(out.rankCount).toBe(4);
    out.order.forEach((members, r) => {
      for (const v of members) expect(SAMPLE.rank[v]).toBe(r);
    });
    expect(out.order.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    // A gap in the ranks is kept, not closed up.
    const gap = layeredLayout({ keys: ['a', 'b'], rank: [0, 3], edges: [[0, 1]] });
    expect(gap.y).toEqual([0, 3]);
    expect(gap.rankCount).toBe(4);
    expect(gap.order).toEqual([[0], [], [], [1]]);
  });

  it('is independent of the input order', () => {
    const expected = byKey(SAMPLE);
    const big = bigGraph(300, 9);
    const expectedBig = byKey(big);
    for (let seed = 1; seed <= 6; seed++) {
      expect(byKey(renumber(SAMPLE, seed)), `seed ${seed}`).toEqual(expected);
      expect(byKey(renumber(big, seed)), `big, seed ${seed}`).toEqual(expectedBig);
    }
    // Repeated edges change nothing.
    expect(byKey({ ...SAMPLE, edges: [...SAMPLE.edges, ...SAMPLE.edges] })).toEqual(expected);
  });

  it('gives distinct integer x within a rank and reports the widest rank', () => {
    const big = bigGraph(2000, 12);
    const out = layeredLayout(big);
    const sizes = out.order.map((r) => r.length);
    expect(out.widestRank).toBe(Math.max(...sizes));
    out.order.forEach((members) => {
      const xs = members.map((v) => out.x[v]!);
      for (const x of xs) expect(Number.isInteger(x)).toBe(true);
      expect(new Set(xs).size).toBe(xs.length);
      // Left to right in the order given, consecutive, and centred in the widest rank.
      xs.forEach((x, k) => expect(x).toBe(xs[0]! + k));
      if (members.length > 0) {
        expect(xs[0]).toBe(Math.floor((out.widestRank - members.length) / 2));
        expect(xs[xs.length - 1]!).toBeLessThan(out.widestRank);
      }
    });
    const small = layeredLayout(SAMPLE);
    expect(small.widestRank).toBe(3);
    // Rank 1 holds a, b, c: x 0, 1, 2. The root alone is centred at x 1.
    expect(small.x[0]).toBe(1);
    expect([small.x[2], small.x[1], small.x[3]]).toEqual([0, 1, 2]);
  });

  it('accepts edges that span several ranks', () => {
    // Rises of 2 and 3 (T2 on B, C, F, G): vertex z at rank 3 hangs from x at rank 0 only.
    const input: LayeredInput = {
      keys: ['p', 'q', 'r', 'x', 'm', 'z'],
      rank: [0, 0, 0, 0, 1, 3],
      edges: [
        [3, 5],
        [0, 4],
      ],
    };
    const out = layeredLayout(input);
    expect(out.y[5]).toBe(3);
    // x is last in rank 0 (keys p, q, r, x) at column 3; z is alone in rank 3 and centred.
    expect(out.x[3]).toBe(3);
    expect(out.order[3]).toEqual([5]);
    expect(out.order[2]).toEqual([]);
    // Two vertices on one rank: the one whose lower neighbours lie further right goes right.
    const two = layeredLayout({ keys: ['p', 'q', 'r', 'x', 'za', 'zz'], rank: [0, 0, 0, 0, 3, 3], edges: [[3, 4], [0, 5]] });
    expect(two.order[3]).toEqual([5, 4]);
  });

  it('places a single child under its parent by the barycenter', () => {
    // Rank 0: a, b, c at x 0, 1, 2. Rank 1: "y" hangs from a, "x" from c: y goes left of x
    // although "x" < "y" by key.
    const out = layeredLayout({ keys: ['a', 'b', 'c', 'x', 'y'], rank: [0, 0, 0, 1, 1], edges: [[0, 4], [2, 3]] });
    expect(out.order[1]).toEqual([4, 3]);
    // A single child of the middle parent sits under it.
    const one = layeredLayout({ keys: ['a', 'b', 'c', 'k'], rank: [0, 0, 0, 1], edges: [[1, 3]] });
    expect(one.x[3]).toBe(one.x[1]);
    // Ties and orphans by key, code-unit order: "B" < "a".
    const ties = layeredLayout({ keys: ['a', 'B', 'r'], rank: [1, 1, 0], edges: [] });
    expect(ties.order[1]).toEqual([1, 0]);
  });

  it('handles an empty graph', () => {
    expect(layeredLayout({ keys: [], rank: [], edges: [] })).toEqual({ x: [], y: [], order: [], widestRank: 0, rankCount: 0 });
  });

  it('rejects a duplicate key, a bad rank and a dangling edge', () => {
    expect(() => layeredLayout({ keys: ['a', 'a'], rank: [0, 1], edges: [] })).toThrow(RangeError);
    expect(() => layeredLayout({ keys: ['a'], rank: [-1], edges: [] })).toThrow(RangeError);
    expect(() => layeredLayout({ keys: ['a'], rank: [0.5], edges: [] })).toThrow(RangeError);
    expect(() => layeredLayout({ keys: ['a'], rank: [0, 1], edges: [] })).toThrow(RangeError);
    expect(() => layeredLayout({ keys: ['a'], rank: [0], edges: [[0, 1]] })).toThrow(RangeError);
  });
});
