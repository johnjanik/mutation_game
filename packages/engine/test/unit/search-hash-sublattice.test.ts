// RT-03, phase 4 round: the hash of orbitGraph's fast path (RT-FIX residual P3-RT-07-02, search.ts
// searchOnNumbers) is the sum of entry k times a fixed odd number R[k], mod 2^30. It is linear, so every
// position of an orbit whose entries are all multiples of 2^30 (the orbit of a seed that is such a multiple:
// every move is an integer combination) has the same hash, and each lookup walks every earlier position:
// the search becomes quadratic in its cap. The generic loop (a Map keyed by the decimal text, which the
// fast path replaced) stays linear. Measured here on named E8 (SafeInt), firing, from 2^30 (1, ..., 1),
// against the generic loop on the same board with a copy of its arithmetic (which the fast path does not
// recognise), and against the fast path from (1, ..., 1). Same items in both; the fast path must not be
// more than 5 times slower than the generic loop on the same input.
import { describe, expect, it } from 'vitest';
import * as E from '../../src/index';
import type { Arith, Board } from '../../src/index';
import { positionHash } from '../../src/search';

function generic<T>(b: Board<T>): Board<T> {
  return { ...b, arith: { ...(b.arith as Arith<T>) } };
}
function time(f: () => unknown): number {
  const t0 = performance.now();
  f();
  return performance.now() - t0;
}

describe('RT-03 P4: orbitGraph fast path on a seed that is a multiple of 2^30', () => {
  // regression: P4-RT-03-02
  it('E8, firing, from 2^30 (1,...,1), cap 40000: same items as the generic loop, and not 5 times slower', () => {
    const e8 = E.boardFromName('E8') as Board<number>;
    const k = 2 ** 30;
    const seed = [[k, k, k, k, k, k, k, k]];
    const CAP = 40000;
    let fast: E.OrbitGraph<number> | null = null;
    let slow: E.OrbitGraph<number> | null = null;
    const tFast = time(() => (fast = E.orbitGraph(e8, seed, 'firing', CAP)));
    const tSlow = time(() => (slow = E.orbitGraph(generic(e8), seed, 'firing', CAP)));
    const tPlain = time(() => E.orbitGraph(e8, [[1, 1, 1, 1, 1, 1, 1, 1]], 'firing', CAP));
    expect(fast!.items.length).toBe(CAP);
    expect(fast!.items.map(String)).toEqual(slow!.items.map(String));
    const times = `cap ${CAP}: fast path from 2^30 rho ${tFast.toFixed(0)} ms; generic loop, same seed ${tSlow.toFixed(0)} ms; fast path from rho ${tPlain.toFixed(0)} ms`;
    expect(tFast, times).toBeLessThan(5 * tSlow);
  }, 900_000);
});

// RT-FIX P4: the same cause measured without a clock, and the fast path checked against the generic loop
// on the seeds that collided. A lookup walks the earlier positions with the same hash, so the comparisons
// of a search are counted here as, for each item in order, the number of earlier items with its hash
// (positionHash is the hash searchOnNumbers keeps). The linear hash put all 40000 items of the orbit of
// 2^30 (1, ..., 1) in one bucket: 799980000 comparisons. Every result, order and cap stays the generic
// loop's (decisions/RT-FIX-P3-residual-perf.md): items, depths, parents, nodes and the three fields.
function comparisons(items: readonly (readonly (number | bigint)[])[]): { buckets: number; largest: number; steps: number } {
  const count = new Map<number, number>();
  let steps = 0;
  let largest = 0;
  for (const v of items) {
    const h = positionHash(v.map((x) => Number(x)));
    const c = count.get(h) ?? 0;
    steps += c;
    count.set(h, c + 1);
    largest = Math.max(largest, c + 1);
  }
  return { buckets: count.size, largest, steps };
}

function sameGraph<T>(a: E.OrbitGraph<T>, b: E.OrbitGraph<T>): void {
  expect(a.items.map(String)).toEqual(b.items.map(String));
  expect(a.depth).toEqual(b.depth);
  expect(a.parent).toEqual(b.parent);
  expect(a.node).toEqual(b.node);
  expect([a.truncated, a.depthReached, a.completeLayers]).toEqual([b.truncated, b.depthReached, b.completeLayers]);
}

describe('orbitGraph fast path: positions in a sublattice spread over the hashes', () => {
  // regression: P4-RT-03-02
  it('E8, firing, from multiples of (1,...,1) by 2^29, 2^30, 3 * 2^30 and 2^32: at most a few comparisons in 40000 items', () => {
    const e8 = E.boardFromName('E8') as Board<number>;
    for (const k of [2 ** 29, 2 ** 30, 3 * 2 ** 30, 2 ** 32]) {
      const g = E.orbitGraph(e8, [[k, k, k, k, k, k, k, k]], 'firing', 40000);
      expect(g.items.length).toBe(40000);
      const c = comparisons(g.items);
      expect(c.steps, `k = ${k}: ${c.buckets} hashes, largest bucket ${c.largest}`).toBeLessThan(400);
      expect(c.largest).toBeLessThan(8);
    }
  }, 120_000);

  // regression: P4-RT-03-02
  it('the triangle (A2~, Big), mutation, from (2^30, 0, 0): at most a few comparisons in 100000 items', () => {
    const tri = E.boardFromName('A2~') as Board<bigint>;
    const g = E.orbitGraph(tri, [[2n ** 30n, 0n, 0n]], 'mutation', 100000);
    expect([g.items.length, g.truncated]).toEqual([100000, true]);
    const c = comparisons(g.items);
    expect(c.steps, `${c.buckets} hashes, largest bucket ${c.largest}`).toBeLessThan(1000);
    expect(c.largest).toBeLessThan(8);
  }, 120_000);

  // regression: P4-RT-03-02
  it('the fast path and the generic loop give the same graph on the colliding seeds, both games, both arithmetics', () => {
    const e8 = E.boardFromName('E8') as Board<number>;
    for (const k of [2 ** 29, 2 ** 30, 3 * 2 ** 30, 2 ** 32]) {
      const seed = [[k, k, k, k, k, k, k, k]];
      sameGraph(E.orbitGraph(e8, seed, 'firing', 20000), E.orbitGraph(generic(e8), seed, 'firing', 20000));
      sameGraph(E.orbitGraph(e8, seed, 'firing', 20000, 6, true), E.orbitGraph(generic(e8), seed, 'firing', 20000, 6, true));
      const root = [[k, 0, 0, 0, 0, 0, 0, 0]];
      sameGraph(E.orbitGraph(e8, root, 'mutation', 2000), E.orbitGraph(generic(e8), root, 'mutation', 2000));
    }
    const tri = E.boardFromName('A2~') as Board<bigint>;
    for (const k of [2n ** 30n, 3n * 2n ** 30n, 2n ** 32n]) {
      for (const game of ['mutation', 'firing'] as const) {
        const seed = [[k, 0n, 0n]];
        sameGraph(E.orbitGraph(tri, seed, game, 20000, 40), E.orbitGraph(generic(tri), seed, game, 20000, 40));
      }
    }
    // A seed of 2^52 on the triangle: the entries leave the safe range and the search hands over to bigint.
    const near = [[2n ** 52n, 0n, 0n]];
    const handed = E.orbitGraph(tri, near, 'mutation', 2000);
    expect(handed.items.some((v) => v.some((x) => x > 9007199254740991n))).toBe(true);
    sameGraph(handed, E.orbitGraph(generic(tri), near, 'mutation', 2000));
  }, 120_000);
});
