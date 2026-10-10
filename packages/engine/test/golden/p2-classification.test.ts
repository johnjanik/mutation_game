// The golden key `classification_tests` (SPEC.md 5.7, phase 2; P2-A1 instruction 5.16): thirteen boards
// matched by label (rule 5); classify compared record by record and field by field after converting
// nodes and bourbaki_order with labels (rule 2); smallestNonfiniteSubboard with nodes converted, or null;
// spectralRadius formatted to four decimals as text (rule 3).
import { describe, expect, it } from 'vitest';
import { classify, smallestNonfiniteSubboard, spectralRadius } from '../../src/classify';
import type { ClassifyRecord } from '../../src/classify';
import { covers, golden, intEq, labels, matchRecord } from './_harness';
import { boardFromCartan } from '../helpers/p2';

covers('classification_tests');

const tests = golden.classification_tests;
const LABELS = tests.map((t) => t.label);

describe('classification_tests matched by label', () => {
  it('has thirteen boards', () => {
    expect(tests.length).toBe(13);
  });

  for (const label of LABELS) {
    it(`classify: ${label}`, () => {
      const rec = matchRecord(tests, { label });
      const b = boardFromCartan(rec.cartan);
      const recs = classify(b);
      expect(recs.length).toBe(rec.components.length);
      for (let k = 0; k < recs.length; k++) {
        const got = recs[k]!;
        const want = rec.components[k]!;
        intEq(labels(b, got.nodes), want.nodes, 'nodes');
        expect(got.kind).toBe(want.kind);
        expect(got.balanced).toBe(want.balanced);
        expect(got.class).toBe(want.class);
        expect(got.name).toBe(want.name);
        if (want.bourbaki_order !== undefined) {
          intEq(labels(b, got.bourbaki_order!), want.bourbaki_order, 'bourbaki_order');
        } else {
          expect(got).not.toHaveProperty('bourbaki_order');
        }
        if (want.marks !== undefined) {
          intEq(got.marks, want.marks, 'marks');
          intEq(got.comarks, want.comarks, 'comarks');
        } else {
          expect(got).not.toHaveProperty('marks');
          expect(got).not.toHaveProperty('comarks');
        }
        // the record has exactly the golden keys, in the oracle's order
        expect(Object.keys(got)).toEqual(Object.keys(want));
        // a deep equality after converting the node lists (the plan's absent-not-undefined rule)
        const converted: ClassifyRecord = { ...got, nodes: labels(b, got.nodes) };
        if (got.bourbaki_order !== undefined) converted.bourbaki_order = labels(b, got.bourbaki_order);
        expect(converted).toEqual(want);
      }
    });

    it(`smallest non-finite sub-board: ${label}`, () => {
      const rec = matchRecord(tests, { label });
      const b = boardFromCartan(rec.cartan);
      const sub = smallestNonfiniteSubboard(b);
      if (rec.smallest_nonfinite_subboard === null) {
        expect(sub).toBeNull();
      } else {
        expect(sub).not.toBeNull();
        intEq(labels(b, sub!.nodes), rec.smallest_nonfinite_subboard.nodes, 'nodes');
        expect(sub!.class).toBe(rec.smallest_nonfinite_subboard.class);
      }
    });

    it(`spectral radius: ${label}`, () => {
      const rec = matchRecord(tests, { label });
      const b = boardFromCartan(rec.cartan);
      const sr = spectralRadius(b);
      const text = sr === null ? null : sr.toFixed(4);
      expect(text).toBe(rec.spectral_radius_4_decimals);
    });
  }
});
