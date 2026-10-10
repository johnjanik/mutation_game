// SPEC.md 5.7, property 2: toNumbers(B, mutate(B, p, i)) = fire(B, toNumbers(B, p), i) (section 2.4(a)).
// A random type, a random population with entries in [-9, 9] and a random position; also on a Big copy
// of the board (plan). Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cartanNumbers } from '../../src/board';
import { fire, mutate, toNumbers } from '../../src/moves';
import { bigBoard } from '../helpers/p1';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P1-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 500;

const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
  const n = boardOf(T).n;
  return fc.tuple(
    fc.constant(T),
    fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n }),
    fc.integer({ min: 0, max: n - 1 }),
  );
});

describe('property 2', () => {
  it('toNumbers of mutate is fire of toNumbers', () => {
    fc.assert(
      fc.property(caseArb, ([T, p, i]) => {
        const b = boardOf(T);
        const input = [...p];
        expect(toNumbers(b, mutate(b, p, i))).toEqual(fire(b, toNumbers(b, p), i));
        expect(p).toEqual(input);
        const bb = bigBoard(cartanNumbers(b), [...b.labels]);
        const q = p.map((x) => BigInt(x));
        const qInput = [...q];
        expect(toNumbers(bb, mutate(bb, q, i))).toEqual(fire(bb, toNumbers(bb, q), i));
        expect(q).toEqual(qInput);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('the translator is not the identity: a = C p differs from p on a unit vector of a connected board', () => {
    // guards against toNumbers returning its input (which would make the property trivial on symmetric boards)
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const e = b.labels.map((_, k) => (k === 0 ? 1 : 0));
      const a = toNumbers(b, e);
      expect(a[0]).toBe(2);
      expect(a).toEqual(cartanNumbers(b).map((row) => row[0]!));
    }
  });
});
