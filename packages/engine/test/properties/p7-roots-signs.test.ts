// SPEC.md 5.7, property 7, first half (2.7 F1): every element of roots(B) has entries of one sign. The
// second half (isRootPopulation accepts it and rejects its double) is P2-A1's, appended to this file in
// phase 2 as a second describe block. Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CAPS } from '../../src/caps';
import { roots } from '../../src/search';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P1-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 200;

describe('property 7, first half', () => {
  it('every root has entries of one sign', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TYPE_NAMES), (T) => {
        const b = boardOf(T);
        const r = roots(b, CAPS.mainThreadItems);
        expect(r.truncated).toBe(false);
        let negatives = 0;
        for (const v of r.items) {
          expect(v.some((x) => x !== 0)).toBe(true);
          const nonNeg = v.every((x) => x >= 0);
          const nonPos = v.every((x) => x <= 0);
          expect(nonNeg || nonPos).toBe(true);
          if (nonPos) negatives += 1;
        }
        // half of the roots are negative (F1: 2N roots, N of each sign), so the test sees both signs
        expect(2 * negatives).toBe(r.items.length);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
