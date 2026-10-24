// RT-11 phase 4 round (red team, not a builder's test): the two search loops of orbitGraph must agree at
// the cap (SPEC.md 5.5 "Order and truncation of a search": "The cap acts when the search is about to add
// one position more than the cap: it stops at once with truncated true and exactly cap items"; a search
// that ends with exactly cap items is not truncated). Since RT-FIX residual P3-RT-07-02, orbitGraph on a
// SafeInt or Big board runs a search on numbers and hands over to the generic loop when a value leaves the
// safe range; a seed beyond 2^53 hands over at once. The moves are linear, so the orbit of 2^60 v is 2^60
// times the orbit of v, in the same order with the same depths, parents and nodes: the generic loop's
// result on the scaled seed must equal the fast path's on v, scaled, for every cap and layer bound.
// Mutant F3 (redteam/rt11-p4/mutants/F3-generic-M14.patch on the lens branch worktree-agent-a19febfb0f4c5a241: the generic loop reports truncated when it ends
// with exactly cap items) passes every builder's test; this file fails under it.
import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/moves';
import { orbitGraph } from '../../src/search';
import { bigBoard } from '../helpers/p1';

const K = 2n ** 60n;

/** The fast path (small seed) and the generic loop (the same seed times 2^60) on one Big board. */
function both(C: number[][], seed: number[], game: Game, cap: number, maxDepth?: number) {
  const b = bigBoard(C);
  const small = orbitGraph(b, [seed.map((x) => BigInt(x))], game, cap, maxDepth);
  const big = orbitGraph(b, [seed.map((x) => BigInt(x) * K)], game, cap, maxDepth);
  return { small, big };
}

function agree(C: number[][], seed: number[], game: Game, cap: number, maxDepth?: number): void {
  const { small, big } = both(C, seed, game, cap, maxDepth);
  const what = `${JSON.stringify(C)} ${game} from ${seed.join(',')} cap ${cap} maxDepth ${maxDepth}`;
  expect(big.items.some((v) => v.some((x) => x > 2n ** 53n || x < -(2n ** 53n))), what).toBe(true);
  expect(big.truncated, what).toBe(small.truncated);
  expect(big.completeLayers, what).toBe(small.completeLayers);
  expect(big.depthReached, what).toBe(small.depthReached);
  expect(big.depth, what).toEqual(small.depth);
  expect(big.parent, what).toEqual(small.parent);
  expect(big.node, what).toEqual(small.node);
  expect(big.items, what).toEqual(small.items.map((v) => v.map((x) => x * K)));
}

describe('orbitGraph: the generic loop (values beyond 2^53) and the search on numbers agree at the cap', () => {
  // regression: P4-RT-11-01
  it('a finite orbit of exactly cap positions is not truncated on either path (A2, B2, G2, A3)', () => {
    const cases: [number[][], number[], Game][] = [
      [[[2, -1], [-1, 2]], [3, 1], 'mutation'],
      [[[2, -2], [-1, 2]], [3, 1], 'firing'],
      [[[2, -1], [-3, 2]], [5, 2], 'mutation'],
      [[[2, -1, 0], [-1, 2, -1], [0, -1, 2]], [1, 2, 3], 'firing'],
    ];
    for (const [C, seed, game] of cases) {
      const whole = both(C, seed, game, 1000).small;
      expect(whole.truncated).toBe(false);
      const n = whole.items.length;
      // the cap equal to the orbit, one below and one above
      for (const cap of [n - 1, n, n + 1]) agree(C, seed, game, cap);
      const exact = both(C, seed, game, n);
      expect(exact.small.truncated).toBe(false);
      expect(exact.big.truncated).toBe(false);
      expect(exact.big.items).toHaveLength(n);
    }
  });

  // regression: P4-RT-11-01
  it('a layer bound that stops the search with exactly cap positions is not truncated (triangle, mutation)', () => {
    const tri = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];
    for (const maxDepth of [3, 6, 10]) {
      const n = both(tri, [1, 0, 0], 'mutation', 100000, maxDepth).small.items.length;
      for (const cap of [n - 1, n, n + 1]) agree(tri, [1, 0, 0], 'mutation', cap, maxDepth);
      expect(both(tri, [1, 0, 0], 'mutation', n, maxDepth).big.truncated).toBe(false);
    }
  });
});
