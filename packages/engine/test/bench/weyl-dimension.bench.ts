// The E8 timing of the phase-3 roster (P3-A1 instruction, acceptance: "weylDimension of E8 for 3875 computes in
// under a second (measured with performance.now())", gate G3), moved here unchanged in name, body and bound from
// test/golden/p3a-weyl-dimension.test.ts by P4-X2 (P4 wave 4.5). It is a timing check, not a guard against a hang:
// weylDimension plays one complete game of 120 moves on E8 and replays its word, which cannot run on, and a call
// slower than Vitest's own limit of 5 s a test fails as a timeout anyway. So, like the orbit benchmark of SPEC.md 7.6, it runs
// alone through `npm run bench -w packages/engine` (test/bench/vitest.config.ts, one file at a time), out of the
// parallel suite of `npm test`, where a duration measures the load of the suite rather than the engine. The
// 30 records of weyl_dimension, 3875 for E8 among them, stay in p3a-weyl-dimension.test.ts with covers().
import { describe, expect, it } from 'vitest';
import { weylDimension } from '../../src/weyl';
import { boardOf } from '../golden/_harness';

describe('E8 3875 under one second', () => {
  it('weylDimension(E8, [1, 0, 0, 0, 0, 0, 0, 0]) computes in under a second', () => {
    const b = boardOf('E8');
    const t0 = performance.now();
    const dim = weylDimension(b, [1, 0, 0, 0, 0, 0, 0, 0]);
    const ms = performance.now() - t0;
    expect(dim).toBe(3875n);
    expect(ms).toBeLessThan(1000);
  });
});
