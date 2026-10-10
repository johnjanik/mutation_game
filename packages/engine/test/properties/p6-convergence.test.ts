// SPEC.md 5.7, property 6: strong convergence (2.7 F3). Two random legal plays from one start give the same
// end, the same length and the same sorted list of fired numbers. A random type, a random start with
// entries in [-9, 9], and two seeds for the orders of play. Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { play } from '../../src/play';
import { seededChoose } from '../helpers/p1';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P1-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 300;

const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
  const n = boardOf(T).n;
  return fc.tuple(
    fc.constant(T),
    fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n }),
    fc.integer({ min: 1, max: 1 << 30 }),
    fc.integer({ min: 1, max: 1 << 30 }),
  );
});

const sorted = (v: readonly number[]): number[] => [...v].sort((a, b) => a - b);

describe('property 6', () => {
  it('two random legal plays agree', () => {
    let differentWords = 0;
    fc.assert(
      fc.property(caseArb, ([T, a, s1, s2]) => {
        const b = boardOf(T);
        const input = [...a];
        const r1 = play(b, a, seededChoose(s1));
        const r2 = play(b, a, seededChoose(s2));
        expect(a).toEqual(input);
        expect(r1.status).toBe('ended');
        expect(r2.status).toBe('ended');
        expect(r1.position).toEqual(r2.position);
        expect(r1.moves).toBe(r2.moves);
        expect(sorted(r1.fired)).toEqual(sorted(r2.fired));
        expect(r1.position.every((x) => x <= 0)).toBe(true);
        if (r1.word.join(',') !== r2.word.join(',')) differentWords += 1;
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
    // the two orders really differ in many runs, so the agreement is not trivial
    expect(differentWords).toBeGreaterThan(NUM_RUNS / 10);
  });

  it('a random order agrees with the lowest-position rule', () => {
    fc.assert(
      fc.property(caseArb, ([T, a, s1]) => {
        const b = boardOf(T);
        const r0 = play(b, a);
        const r1 = play(b, a, seededChoose(s1));
        expect(r0.position).toEqual(r1.position);
        expect(r0.moves).toBe(r1.moves);
        expect(sorted(r0.fired)).toEqual(sorted(r1.fired));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
