// SPEC.md 5.7, property 8 (2.7 F4): play from a start with all numbers positive has length N and its word,
// applied to each simple root population, gives the negative of a simple root population. Entries of the
// start in [1, 9] (plan); the lowest-position rule and a seeded order. Plan addition from F4 and verify.py
// line 197: the end is the start negated and permuted by -w0. Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyWord } from '../../src/moves';
import { play } from '../../src/play';
import { positiveRoots } from '../../src/search';
import { minusW0 } from '../../src/finite';
import { seededChoose, unitVectors } from '../helpers/p1';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P1-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 300;

const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
  const n = boardOf(T).n;
  return fc.tuple(
    fc.constant(T),
    fc.array(fc.integer({ min: 1, max: 9 }), { minLength: n, maxLength: n }),
    fc.integer({ min: 1, max: 1 << 30 }),
  );
});

/** The j with v = -e_j, or null. */
function negativeUnit(v: readonly number[]): number | null {
  let j: number | null = null;
  for (let k = 0; k < v.length; k++) {
    if (v[k] === -1) {
      if (j !== null) return null;
      j = k;
    } else if (v[k] !== 0) return null;
  }
  return j;
}

describe('property 8', () => {
  it('N moves; the word sends simple roots to negatives of simple roots', () => {
    fc.assert(
      fc.property(caseArb, ([T, a, s]) => {
        const b = boardOf(T);
        const N = positiveRoots(b).length;
        const input = [...a];
        for (const r of [play(b, a), play(b, a, seededChoose(s))]) {
          expect(r.status).toBe('ended');
          expect(r.moves).toBe(N);
          const images = new Set<number>();
          for (const e of unitVectors(b)) {
            const j = negativeUnit(applyWord(b, e, r.word, 'mutation'));
            expect(j).not.toBeNull();
            images.add(j!);
          }
          expect(images.size).toBe(b.n);
          const w0 = minusW0(b);
          for (let i = 0; i < b.n; i++) expect(r.position[w0[i]!]).toBe(-a[i]!);
        }
        expect(a).toEqual(input);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
