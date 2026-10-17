// RT-04 finding P3-RT-04-02: "Download data" writes integers as strings when they reach exportJSON as
// rationals with denominator 1. SPEC 6.6 Data export: "all integers as JSON numbers when safe and as
// decimal strings otherwise". export.ts jsonSafe(): `if (isRational(value)) return value.den === 1n ?
// value.num.toString() : ...` gives the text "1" for the integer 1. Seen in the browser on
// /tools/mirror/ (derived.population = ["1","1"]), /tools/form/ (derived.meter.formValue = "2",
// derived.smallValues[*].population) and /tools/lab/ (derived.weights = ["1","1","1"]); see
// site/tests/e2e/redteam-RT-04-export.spec.ts.
// Run: npx vitest run --project site-unit site/tests/unit/redteam-RT-04-export-integers.test.ts
import { describe, expect, it } from 'vitest';
import { exportJSON } from '../../src/lib/export';
import { defaultState } from '../../src/lib/state';

describe('P3-RT-04-02: integral rationals in the data export', () => {
  const state = defaultState('board', 'A2');
  it('a rational equal to a safe integer is written as a JSON number', () => {
    const doc = JSON.parse(exportJSON(state, { population: [{ num: 1n, den: 1n }, { num: -4n, den: 1n }] }));
    expect(doc.derived.population).toEqual([1, -4]);
  });
  it('a rational equal to an unsafe integer is written as decimal text, a fraction as p/q', () => {
    const doc = JSON.parse(exportJSON(state, { population: [{ num: 9007199254740993n, den: 1n }, { num: 2n, den: 3n }] }));
    expect(doc.derived.population).toEqual(['9007199254740993', '2/3']);
  });
});
