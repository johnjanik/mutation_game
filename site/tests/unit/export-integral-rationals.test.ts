// Regression tests of the data export (SPEC 6.6 Data export: "all integers as JSON numbers when safe and
// as decimal strings otherwise"), adopted from RT-04's reproducer: a rational whose denominator is 1 is an
// integer and reaches the export as one. The browser side (T3, T4, T6) is in the tools' spec files.
// Run: npx vitest run --project site-unit site/tests/unit/export-integral-rationals.test.ts
import { describe, expect, it } from 'vitest';
import { exportJSON } from '../../src/lib/export';
import { defaultState } from '../../src/lib/state';

describe('integral rationals in the data export', () => {
  const state = defaultState('board', 'A2');
  // regression: P3-RT-04-02
  it('a rational equal to a safe integer is written as a JSON number', () => {
    const doc = JSON.parse(exportJSON(state, { population: [{ num: 1n, den: 1n }, { num: -4n, den: 1n }] }));
    expect(doc.derived.population).toEqual([1, -4]);
  });
  it('a rational equal to an unsafe integer is written as decimal text, a fraction as p/q', () => {
    const doc = JSON.parse(exportJSON(state, { population: [{ num: 9007199254740993n, den: 1n }, { num: 2n, den: 3n }] }));
    expect(doc.derived.population).toEqual(['9007199254740993', '2/3']);
  });
});
