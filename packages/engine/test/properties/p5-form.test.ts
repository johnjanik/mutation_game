// SPEC.md 5.7, property 5 (2.5): formValue is unchanged by mutate. The board is drawn at random from
// the type list; p and q have random integer entries in [-9, 9]; every node i is checked:
// formValue(b, mutate(p, i), mutate(q, i)) = formValue(b, p, q), on the SafeInt board and on a Big copy.
// The form is not the zero form (formValue(e_i, e_i) = 2 d_i > 0), so the property is not vacuous.
// Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cartanNumbers } from '../../src/board';
import { mutate } from '../../src/moves';
import { ratEq, ratSign } from '../../src/rational';
import { formValue } from '../../src/form';
import { TYPE_NAMES, boardOf } from '../golden/_harness';
import { boardFromCartan } from '../helpers/p2';

// fixed seed and run count, recorded in decisions/P2-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 400;

const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
  const n = boardOf(T).n;
  const vec = fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n });
  return fc.tuple(fc.constant(T), vec, vec);
});

describe('property 5', () => {
  it('formValue unchanged by mutate', () => {
    fc.assert(
      fc.property(caseArb, ([T, p, q]) => {
        const b = boardOf(T);
        const before = formValue(b, p, q);
        expect(before).not.toBeNull();
        const pIn = [...p];
        const qIn = [...q];
        for (let i = 0; i < b.n; i++) {
          const after = formValue(b, mutate(b, p, i), mutate(b, q, i));
          expect(after).not.toBeNull();
          expect(ratEq(after!, before!)).toBe(true);
        }
        expect(p).toEqual(pIn);
        expect(q).toEqual(qIn);
        // the Big copy agrees
        const bb = boardFromCartan(cartanNumbers(b));
        const pb = p.map((x) => BigInt(x));
        const qb = q.map((x) => BigInt(x));
        expect(ratEq(formValue(bb, pb, qb)!, before!)).toBe(true);
        for (let i = 0; i < b.n; i++) {
          expect(ratEq(formValue(bb, mutate(bb, pb, i), mutate(bb, qb, i))!, before!)).toBe(true);
        }
        // q defaults to p, and the form is positive definite on a finite board
        expect(ratEq(formValue(b, p)!, formValue(b, p, p)!)).toBe(true);
        if (p.some((x) => x !== 0)) expect(ratSign(formValue(b, p)!)).toBe(1);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
