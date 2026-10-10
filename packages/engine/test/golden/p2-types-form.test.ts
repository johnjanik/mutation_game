// The six form keys of types[*] (SPEC.md 5.7, phase 2; P2-A1 instruction 5.16): symmetrizer, gram,
// formValue and determinant on all 32 types, as verify.py lines 111 to 153 computed them. Rule 7: the
// three short-root counts are present only on the 16 types with two root lengths.
import { describe, expect, it } from 'vitest';
import { symmetrizer, gram } from '../../src/classify';
import { formValue } from '../../src/form';
import { determinant } from '../../src/linalg';
import { positiveRoots } from '../../src/search';
import type { Rational } from '../../src/rational';
import { ratEq, ratSign, ratSub, ratDiv } from '../../src/rational';
import { TYPE_NAMES, boardOf, covers, golden, intEq, ratText } from './_harness';

covers(
  'types[*].symmetrizer',
  'types[*].simply_laced',
  'types[*].n_short_positive',
  'types[*].n_long_positive',
  'types[*].long_to_short_ratio',
  'types[*].det_cartan',
);

/** The distinct values of a list of rationals, ascending. */
function distinctSorted(values: Rational[]): Rational[] {
  const out: Rational[] = [];
  for (const v of values) if (!out.some((w) => ratEq(v, w))) out.push(v);
  out.sort((a, b) => ratSign(ratSub(a, b)));
  return out;
}

describe('types[*] form fields, all 32 types', () => {
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;

    it(`symmetrizer and det_cartan of ${T}`, () => {
      const b = boardOf(T);
      const d = symmetrizer(b);
      expect(d).not.toBeNull();
      for (const x of d!) expect(x.den).toBe(1n);
      intEq(d!.map((x) => x.num), rec.symmetrizer, 'symmetrizer');
      expect(ratText(determinant(b.cartan))).toBe(String(rec.det_cartan));
      // the Gram matrix is d_i C_ij and is symmetric (2.5)
      const B = gram(b);
      expect(B).not.toBeNull();
      for (let i = 0; i < b.n; i++) {
        for (let j = 0; j < b.n; j++) {
          expect(ratEq(B![i]![j]!, B![j]![i]!)).toBe(true);
          expect(ratText(B![i]![j]!)).toBe(String(rec.symmetrizer[i]! * b.cartan[i]![j]!));
        }
      }
    });

    it(`root lengths of ${T}`, () => {
      const b = boardOf(T);
      const pos = positiveRoots(b);
      const values = pos.map((r) => {
        const v = formValue(b, r);
        expect(v).not.toBeNull();
        return v!;
      });
      const norms = distinctSorted(values);
      expect(norms.length === 1).toBe(rec.simply_laced);
      if (norms.length === 2) {
        const shortCount = values.filter((v) => ratEq(v, norms[0]!)).length;
        const longCount = values.filter((v) => ratEq(v, norms[1]!)).length;
        intEq(shortCount, rec.n_short_positive, 'n_short_positive');
        intEq(longCount, rec.n_long_positive, 'n_long_positive');
        const ratio = ratDiv(norms[1]!, norms[0]!);
        expect(ratio.den).toBe(1n);
        intEq(ratio.num, rec.long_to_short_ratio, 'long_to_short_ratio');
        // short roots have form value 2 (2.5, with min d = 1)
        expect(ratText(norms[0]!)).toBe('2');
      } else {
        expect(norms.length).toBe(1);
        expect(ratText(norms[0]!)).toBe('2');
        // rule 7: the three short-root fields are absent on simply laced types
        expect(rec).not.toHaveProperty('n_short_positive');
        expect(rec).not.toHaveProperty('n_long_positive');
        expect(rec).not.toHaveProperty('long_to_short_ratio');
      }
    });
  }
});
