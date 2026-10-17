// The golden key `affine_names` (SPEC.md 5.7, phase 2, "affine_names is compared with the names from
// affineCandidates(m) for m = 2, ..., 9"; P2-A1 instruction 5.16): the names in order, and every
// candidate affine and recognised under its own name (verify.py lines 569 to 577).
import { describe, expect, it } from 'vitest';
import { affineCandidates, cartanClass, identifyAffine } from '../../src/classify';
import { covers, golden } from './_harness';
import { boardFromCartan } from '../helpers/p2';

covers('affine_names');

const names = golden.affine_names as Record<string, string[]>;

describe('affine_names', () => {
  it('is keyed by the node counts 2 to 9', () => {
    expect(Object.keys(names).sort()).toEqual(['2', '3', '4', '5', '6', '7', '8', '9']);
  });

  for (let m = 2; m <= 9; m++) {
    it(`names in order for ${m} nodes`, () => {
      const cands = affineCandidates(m);
      expect(cands.map((c) => c.name)).toEqual(names[String(m)]);
      for (const c of cands) {
        expect(c.cartan.length).toBe(m);
        const b = boardFromCartan(c.cartan);
        expect(cartanClass(b)).toBe('affine');
        expect(identifyAffine(b)).toBe(c.name);
      }
    });
  }

  it('affineCandidates(1) and affineCandidates(0) are empty', () => {
    expect(affineCandidates(1)).toEqual([]);
    expect(affineCandidates(0)).toEqual([]);
  });
});
