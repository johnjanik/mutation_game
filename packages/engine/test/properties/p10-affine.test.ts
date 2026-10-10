// SPEC.md 5.7, property 10 (2.12): on the affine board of B, level is unchanged by fire, and mutate
// fixes the marks. The affine board is affineExtension(boardOf(T)).board; plan addition: also the ten
// twisted boards by name. Positions have random integer entries in [-9, 9]. Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { boardFromName } from '../../src/board';
import type { Board } from '../../src/board';
import { affineExtension, level, marks } from '../../src/affine';
import { fire, mutate } from '../../src/moves';
import { TYPE_NAMES, boardOf, golden } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P2-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 300;

const twisted = golden.twisted_affine as { name: string }[];
const TWISTED_NAMES = twisted.map((r) => r.name);

function affineBoardOf(key: string): Board<bigint> {
  return key.startsWith('twisted:') ? (boardFromName(key.slice(8)) as Board<bigint>) : affineExtension(boardOf(key)).board;
}

const KEYS = [...TYPE_NAMES, ...TWISTED_NAMES.map((n) => `twisted:${n}`)];

const caseArb = fc.constantFrom(...KEYS).chain((key) => {
  const n = affineBoardOf(key).n;
  return fc.tuple(
    fc.constant(key),
    fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n }),
    fc.integer({ min: 0, max: n - 1 }),
  );
});

describe('property 10', () => {
  it('level unchanged by fire; mutate fixes the marks', () => {
    let changed = 0;
    fc.assert(
      fc.property(caseArb, ([key, a, i]) => {
        const b = affineBoardOf(key);
        const pos = a.map((x) => BigInt(x));
        const before = level(b, pos);
        const after = fire(b, pos, i);
        expect(level(b, after)).toBe(before);
        if (after.some((x, k) => x !== pos[k])) changed += 1;
        // a whole random word keeps the level too
        let cur = after;
        for (let k = 0; k < b.n; k++) cur = fire(b, cur, (i + k) % b.n);
        expect(level(b, cur)).toBe(before);
        const delta = marks(b).map((x) => BigInt(x));
        expect(mutate(b, delta, i)).toEqual(delta);
        for (let k = 0; k < b.n; k++) expect(mutate(b, delta, k)).toEqual(delta);
        // the marks are not fixed by firing in general, so the two halves test different things
        expect(level(b, delta)).not.toBe(0n);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
    expect(changed).toBeGreaterThan(NUM_RUNS / 2);
  });
});
