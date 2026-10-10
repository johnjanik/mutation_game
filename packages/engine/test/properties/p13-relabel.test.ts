// SPEC.md 5.7, property 13: classify of a randomly renumbered finite or affine board returns the same
// name, and bourbaki_order restores the standard matrix. Finite: the type name (B2 for C2); affine:
// affine[T].name, and the ten twisted names. Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { boardFromName, cartan, cartanNumbers } from '../../src/board';
import { classify } from '../../src/classify';
import { TYPE_NAMES, boardOf, golden } from '../golden/_harness';
import { permutationArb, renumber, renumberedBoard } from '../helpers/p2';

// fixed seed and run count, recorded in decisions/P2-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 300;

interface AffineRecord {
  name: string;
  constructor_name: string;
  cartan_node0_first: number[][];
  marks: number[];
  comarks: number[];
}
const affine = golden.affine as Record<string, AffineRecord>;
const twisted = golden.twisted_affine as { name: string }[];
const TWISTED_NAMES = twisted.map((r) => r.name);

const finiteCase = fc.constantFrom(...TYPE_NAMES).chain((T) => fc.tuple(fc.constant(T), permutationArb(boardOf(T).n)));
const affineCase = fc.constantFrom(...TYPE_NAMES).chain((T) => fc.tuple(fc.constant(T), permutationArb(boardOf(T).n + 1)));
const twistedCase = fc.constantFrom(...TWISTED_NAMES).chain((name) => fc.tuple(fc.constant(name), permutationArb(boardFromName(name).n)));

describe('property 13: classify of a renumbered board', () => {
  it('a renumbered finite board keeps its name, and bourbaki_order restores the standard matrix', () => {
    let nontrivial = 0;
    fc.assert(
      fc.property(finiteCase, ([T, perm]) => {
        const b = renumberedBoard(boardOf(T), perm);
        const recs = classify(b);
        expect(recs.length).toBe(1);
        const rec = recs[0]!;
        const expected = T === 'C2' ? 'B2' : T;
        expect(rec.class).toBe('finite');
        expect(rec.balanced).toBe(true);
        expect(rec.name).toBe(expected);
        expect(rec.bourbaki_order).toBeDefined();
        const order = rec.bourbaki_order!;
        // positions, a permutation of the nodes of the component
        expect([...order].sort((x, y) => x - y)).toEqual(rec.nodes);
        expect(renumber(cartanNumbers(b), order)).toEqual(cartan(expected));
        if (perm.some((x, k) => x !== k)) nontrivial += 1;
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
    expect(nontrivial).toBeGreaterThan(NUM_RUNS / 4);
  });

  it('a renumbered untwisted affine board keeps affine[T].name, with marks and comarks permuted', () => {
    fc.assert(
      fc.property(affineCase, ([T, perm]) => {
        const golden0 = affine[T]!;
        const b = renumberedBoard(boardFromName(golden0.constructor_name), perm);
        const recs = classify(b);
        expect(recs.length).toBe(1);
        const rec = recs[0]!;
        expect(rec.class).toBe('affine');
        expect(rec.name).toBe(golden0.name);
        expect(rec.marks).toEqual(perm.map((k) => golden0.marks[k]!));
        expect(rec.comarks).toEqual(perm.map((k) => golden0.comarks[k]!));
        expect(rec).not.toHaveProperty('bourbaki_order');
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('a renumbered twisted affine board keeps its Kac name', () => {
    fc.assert(
      fc.property(twistedCase, ([name, perm]) => {
        const b = renumberedBoard(boardFromName(name), perm);
        const recs = classify(b);
        expect(recs.length).toBe(1);
        expect(recs[0]!.class).toBe('affine');
        expect(recs[0]!.name).toBe(name);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
