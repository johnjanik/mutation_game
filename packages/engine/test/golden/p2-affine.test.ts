// The golden key `affine` (SPEC.md 5.7, phase 2; P2-A1 instruction 5.16): for each of the 32 types,
// affineExtension, boardFromName(constructor_name), marks, comarks, identifyAffine, classify and
// cartanClass against affine[T]. Nodes 0..n in label order, so no node list needs converting.
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import { boardFromName, cartanNumbers } from '../../src/board';
import { affineExtension, comarks, marks } from '../../src/affine';
import { cartanClass, classify, identifyAffine } from '../../src/classify';
import { TYPE_NAMES, boardOf, covers, golden, intEq } from './_harness';

covers('affine');

interface AffineRecord {
  name: string;
  constructor_name: string;
  cartan_node0_first: number[][];
  marks: number[];
  comarks: number[];
}
const affine = golden.affine as Record<string, AffineRecord>;

describe('affine[T] for all 32 types', () => {
  it('has one record per type', () => {
    expect(Object.keys(affine).sort()).toEqual([...TYPE_NAMES].sort());
  });

  for (const T of TYPE_NAMES) {
    const rec = affine[T]!;

    it(`affineExtension of ${T} is ${rec.constructor_name}, recognised as ${rec.name}`, () => {
      const b = boardOf(T);
      const ext = affineExtension(b);
      intEq(cartanNumbers(ext.board), rec.cartan_node0_first, 'cartan_node0_first');
      intEq(ext.marks, rec.marks, 'marks');
      intEq(ext.comarks, rec.comarks, 'comarks');
      expect(ext.board.arith).toBe(Big);
      expect(ext.board.kind).toBe('gcm');
      expect(ext.board.name).toBe(rec.constructor_name);
      expect([...ext.board.labels]).toEqual(rec.marks.map((_, k) => k));
      expect(cartanClass(ext.board)).toBe('affine');
      expect(identifyAffine(ext.board)).toBe(rec.name);
    });

    it(`boardFromName(${rec.constructor_name}) has the golden matrix, marks and comarks`, () => {
      const b = boardFromName(rec.constructor_name);
      intEq(cartanNumbers(b), rec.cartan_node0_first, 'cartan_node0_first');
      expect(b.arith).toBe(Big);
      expect(b.n).toBe(rec.marks.length);
      expect([...b.labels]).toEqual(rec.marks.map((_, k) => k));
      expect(b.name).toBe(rec.constructor_name);
      intEq(marks(b), rec.marks, 'marks');
      intEq(comarks(b), rec.comarks, 'comarks');
      expect(identifyAffine(b)).toBe(rec.name);
      const recs = classify(b);
      expect(recs.length).toBe(1);
      expect(recs[0]!.name).toBe(rec.name);
      expect(recs[0]!.class).toBe('affine');
      intEq(recs[0]!.marks, rec.marks, 'classify marks');
      intEq(recs[0]!.comarks, rec.comarks, 'classify comarks');
    });
  }
});
