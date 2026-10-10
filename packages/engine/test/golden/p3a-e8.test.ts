// The E8 facts of SPEC.md 2.14 (5.7 phase 3, the key `e8` without h4_projection, which is P4-A1's;
// P3-A1 instruction 5.11): the fundamental weights as populations through toPopulation (the columns of
// C^{-1}, verify.py line 1298), the 56 neighbours at inner product 1 of every one of the 240 roots through
// formValue (the oracle checks the first ten; all 240 is the plan's), and the norms 2, 4, 6, 8 of
// omega_8, omega_1, omega_7, omega_2 (the table of 2.14, [V]; not a golden key).
import { describe, expect, it } from 'vitest';
import { CAPS } from '../../src/caps';
import { formValue } from '../../src/form';
import { toNumbers, toPopulation } from '../../src/moves';
import { roots } from '../../src/search';
import { unitVectors } from '../helpers/p1';
import { boardOf, covers, golden, intEq, ratText } from './_harness';

covers('e8');

interface GoldenE8 {
  fundamental_weights_in_root_coordinates: number[][];
  neighbours_at_inner_product_1: number;
  h4_projection: unknown;
}

const e8 = golden.e8 as GoldenE8;

describe('fundamental weights', () => {
  it('omega_i as a population is row i of fundamental_weights_in_root_coordinates, with every denominator 1', () => {
    const b = boardOf('E8');
    const es = unitVectors(b);
    expect(e8.fundamental_weights_in_root_coordinates.length).toBe(8);
    for (let i = 0; i < 8; i++) {
      const p = toPopulation(b, es[i]!);
      expect(p).not.toBeNull();
      for (const x of p!) expect(x.den).toBe(1n);
      intEq(p!.map((x) => x.num), e8.fundamental_weights_in_root_coordinates[i]!, `omega_${i + 1}`);
      // and back: the numbers of that population are the unit position (verify.py line 1303)
      intEq(toNumbers(b, p!.map((x) => Number(x.num))), es[i]!);
    }
  });
  it('omega_8 is the highest root (2, 3, 4, 6, 5, 4, 3, 2)', () => {
    intEq(e8.fundamental_weights_in_root_coordinates[7]!, [2, 3, 4, 6, 5, 4, 3, 2]);
  });
});

describe('56 neighbours', () => {
  it('every one of the 240 roots has inner product 1 with exactly neighbours_at_inner_product_1 roots', { timeout: 120000 }, () => {
    const b = boardOf('E8');
    const all = roots(b, CAPS.mainThreadItems);
    expect(all.truncated).toBe(false);
    expect(all.items.length).toBe(240);
    expect(typeof e8.neighbours_at_inner_product_1).toBe('number');
    for (const r of all.items) {
      let count = 0;
      for (const s of all.items) {
        const v = formValue(b, r, s);
        expect(v).not.toBeNull();
        if (ratText(v!) === '1') count += 1;
      }
      intEq(count, e8.neighbours_at_inner_product_1, 'neighbours at inner product 1');
    }
  });
  it('the inner products of one root with the other 239 are -2, -1, 0, 1 with counts 1, 56, 126, 56', () => {
    const b = boardOf('E8');
    const all = roots(b, CAPS.mainThreadItems).items;
    const r = all[0]!;
    const counts = new Map<string, number>();
    for (const s of all) {
      if (s === r) continue;
      const t = ratText(formValue(b, r, s)!);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({ '-2': 1, '-1': 56, '0': 126, '1': 56 });
    expect(ratText(formValue(b, r)!)).toBe('2');
  });
});

describe('fundamental weight norms', () => {
  it('omega_8, omega_1, omega_7, omega_2 have norms 2, 4, 6, 8 (the table of 2.14)', () => {
    const b = boardOf('E8');
    const es = unitVectors(b);
    const norm = (i: number): string => {
      const p = toPopulation(b, es[i]!)!.map((x) => Number(x.num));
      return ratText(formValue(b, p)!);
    };
    expect([norm(7), norm(0), norm(6), norm(1)]).toEqual(['2', '4', '6', '8']);
    // the other four, from the oracle's weight_inner (plan): nodes 1 to 8 give 4, 8, 14, 30, 20, 12, 6, 2
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(norm)).toEqual(['4', '8', '14', '30', '20', '12', '6', '2']);
  });
});
