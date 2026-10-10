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

// ---------------------------------------------------------------------------------------------
// Phase 2 (P2-A1): the second half of property 7, appended as a separate describe block; the block
// above is P1-A1's and is untouched. "isRootPopulation accepts it and rejects its double" for every
// element of roots(B), on the SafeInt board and on a Big copy; the test is not vacuous because every
// root is accepted and every double rejected, and a mixed vector is rejected too.
// ---------------------------------------------------------------------------------------------
import { isRootPopulation } from '../../src/form';
import { boardFromCartan } from '../helpers/p2';
import { cartanNumbers } from '../../src/board';

describe('property 7, second half', () => {
  it('isRootPopulation accepts every root and rejects its double', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TYPE_NAMES), (T) => {
        const b = boardOf(T);
        const r = roots(b, CAPS.mainThreadItems);
        expect(r.truncated).toBe(false);
        const bb = boardFromCartan(cartanNumbers(b));
        for (const v of r.items) {
          expect(isRootPopulation(b, v)).toBe(true);
          expect(isRootPopulation(b, v.map((x) => 2 * x))).toBe(false);
          const w = v.map((x) => BigInt(x));
          expect(isRootPopulation(bb, w)).toBe(true);
          expect(isRootPopulation(bb, w.map((x) => 2n * x))).toBe(false);
          // the vector is not changed
          expect(v.every((x) => Number.isInteger(x))).toBe(true);
        }
        // a vector of mixed signs is never a root population (2.11, bidirected boards)
        if (b.n >= 2) {
          const mixed = [...r.items[0]!];
          mixed[0] = 1;
          mixed[1] = -1;
          expect(isRootPopulation(b, mixed)).toBe(false);
        }
        expect(isRootPopulation(b, r.items[0]!.map(() => 0))).toBe(false);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
