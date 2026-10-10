// The golden key `twisted_affine` (SPEC.md 5.7, phase 2; P2-A1 instruction 5.16), ten records matched
// by name (rule 5): boardFromName, marks, comarks, symmetrizer, identifyAffine, the least k with
// e_x + k delta a root population through isRootPopulation (verify.py affine_checks, lines 511 to 514),
// and transposeBoard(boardFromName(reverse_of)) where reverse_of is present (rule 7 where absent).
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import { boardFromName, cartanNumbers, transposeBoard } from '../../src/board';
import { comarks, marks } from '../../src/affine';
import { cartanClass, identifyAffine, symmetrizer } from '../../src/classify';
import { isRootPopulation } from '../../src/form';
import { covers, golden, intEq, matchRecord } from './_harness';
import { unitPlusMultiple } from '../helpers/p2';

covers('twisted_affine');

interface TwistedRecord {
  name: string;
  cartan: number[][];
  marks: number[];
  comarks: number[];
  symmetrizer: number[];
  least_k_with_e_x_plus_k_delta_a_root: number[];
  reverse_of?: string;
}
const twisted = golden.twisted_affine as TwistedRecord[];
const NAMES = ['A2^(2)', 'A4^(2)', 'A6^(2)', 'D3^(2)', 'D4^(2)', 'D5^(2)', 'A5^(2)', 'A7^(2)', 'E6^(2)', 'D4^(3)'];

describe('twisted_affine matched by name', () => {
  it('has the ten records', () => {
    expect(twisted.map((r) => r.name).sort()).toEqual([...NAMES].sort());
  });

  for (const name of NAMES) {
    it(`${name}: matrix, marks, comarks, symmetrizer, name`, () => {
      const rec = matchRecord(twisted, { name });
      const b = boardFromName(name);
      intEq(cartanNumbers(b), rec.cartan, 'cartan');
      expect(b.arith).toBe(Big);
      expect(b.name).toBe(name);
      expect([...b.labels]).toEqual(rec.marks.map((_, k) => k));
      intEq(marks(b), rec.marks, 'marks');
      intEq(comarks(b), rec.comarks, 'comarks');
      const d = symmetrizer(b);
      expect(d).not.toBeNull();
      for (const x of d!) expect(x.den).toBe(1n);
      intEq(d!.map((x) => x.num), rec.symmetrizer, 'symmetrizer');
      expect(cartanClass(b)).toBe('affine');
      expect(identifyAffine(b)).toBe(name);
    });

    it(`${name}: least k with e_x + k delta a root population, by node`, () => {
      const rec = matchRecord(twisted, { name });
      const b = boardFromName(name);
      const found: number[] = [];
      for (let x = 0; x < b.n; x++) {
        let least = 0;
        for (let k = 1; k <= 6 && least === 0; k++) {
          const v = unitPlusMultiple(b.n, x, k, rec.marks).map((y) => BigInt(y));
          if (isRootPopulation(b, v) === true) least = k;
        }
        found.push(least);
      }
      intEq(found, rec.least_k_with_e_x_plus_k_delta_a_root, 'least_k_with_e_x_plus_k_delta_a_root');
    });

    it(`${name}: reverse_of`, () => {
      const rec = matchRecord(twisted, { name });
      if (rec.reverse_of === undefined) {
        expect(name.startsWith('A2^') || name.startsWith('A4^') || name.startsWith('A6^')).toBe(true);
        return;
      }
      const reversed = transposeBoard(boardFromName(rec.reverse_of));
      intEq(cartanNumbers(reversed), rec.cartan, 'reverse_of');
      expect(identifyAffine(reversed)).toBe(name);
      // reversing every road exchanges marks and comarks (2.12)
      intEq(marks(reversed), rec.marks, 'marks of the reversed board');
      intEq(comarks(reversed), rec.comarks, 'comarks of the reversed board');
      intEq(marks(boardFromName(rec.reverse_of)), rec.comarks, 'marks of the untwisted board are the comarks');
      intEq(comarks(boardFromName(rec.reverse_of)), rec.marks, 'comarks of the untwisted board are the marks');
    });
  }
});
