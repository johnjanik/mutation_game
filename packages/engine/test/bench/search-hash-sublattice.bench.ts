// The timed half of the regression test of P4-RT-03-02 (RT-FIX-P4-engine; moved here by MERGE so that no
// assertion of the parallel suite rests on a clock reading, site/tests/unit/scripts.test.ts): orbitGraph's
// fast path once hashed positions linearly mod 2^30, so every position of the orbit of 2^30 (1, ..., 1) on
// E8 had one hash and the search became quadratic in its cap (16.9 s against 0.66 s for the generic loop at
// cap 40000). Measured on named E8 (SafeInt), firing, against the generic loop on the same board with a
// copy of its arithmetic (which the fast path does not recognise), and against the fast path from
// (1, ..., 1). Same items in both; the fast path must not be more than 5 times slower than the generic loop
// on the same input. The counting tests in test/unit/search-hash-sublattice.test.ts guard the same cause
// without a clock. Runs alone through `npm run bench -w packages/engine`.
import { describe, expect, it } from 'vitest';
import * as E from '../../src/index';
import type { Arith, Board } from '../../src/index';

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
