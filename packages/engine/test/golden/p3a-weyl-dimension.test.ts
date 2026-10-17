// Weyl's dimension formula as two games (SPEC.md 2.7 F9, 5.4 weylDimension, 5.7 phase 3, Appendix A.3;
// P3-A1 instruction 5.7, 5.11): the 30 records of weyl_dimension, identified by type and highest_weight
// (rule 5, never by index), the three hand examples of A.3 with their products, and the RangeError cases of
// the plan. The E8 timing of the roster ("E8 3875 under one second") runs alone in the bench run, in
// test/bench/weyl-dimension.bench.ts (P4-X2, P4 wave 4.5): a duration is not asserted in npm test.
import { describe, expect, it } from 'vitest';
import { applyWord } from '../../src/moves';
import { play } from '../../src/play';
import { weylDimension } from '../../src/weyl';
import { ones } from '../helpers/p1';
import { boardOf, covers, golden, intEq, matchRecord } from './_harness';

covers('weyl_dimension');

interface GoldenDimension {
  type: string;
  highest_weight: number[];
  dimension: number;
}

const records = golden.weyl_dimension as GoldenDimension[];

describe('thirty records', () => {
  it('the list has 30 records', () => {
    expect(records.length).toBe(30);
  });
  for (const rec of records) {
    it(`${rec.type} dim V(${rec.highest_weight.join(',')}) = ${rec.dimension}`, () => {
      const b = boardOf(rec.type);
      // highest_weight is in label order, which is position order on the named finite boards
      const lambda = Object.freeze([...rec.highest_weight]);
      const dim = weylDimension(b, lambda);
      expect(typeof dim).toBe('bigint');
      intEq(dim, rec.dimension, 'dimension');
      expect(lambda).toEqual(rec.highest_weight);
    });
  }
  it('the records are looked up by type and highest_weight (rule 5), including 3875 for E8', () => {
    const e8 = matchRecord(records, { type: 'E8', highest_weight: [1, 0, 0, 0, 0, 0, 0, 0] });
    expect(weylDimension(boardOf('E8'), e8.highest_weight)).toBe(3875n);
    const adjoint = matchRecord(records, { type: 'E8', highest_weight: [0, 0, 0, 0, 0, 0, 0, 1] });
    expect(weylDimension(boardOf('E8'), adjoint.highest_weight)).toBe(248n);
    const a2 = matchRecord(records, { type: 'A2', highest_weight: [1, 1] });
    intEq(weylDimension(boardOf('A2'), a2.highest_weight), a2.dimension);
  });
});

/** The products of F9 along the word of the game from rho, replayed from lambda + rho (a test-side replay). */
function products(type: string, lambda: number[]): { word: number[]; firedRho: number[]; firedLambda: number[]; D: bigint; M: bigint } {
  const b = boardOf(type);
  const game = play(b, ones(b));
  const word = [...game.word];
  const firedRho = [...game.fired];
  const firedLambda: number[] = [];
  let a = lambda.map((x) => x + 1);
  for (const i of word) {
    firedLambda.push(a[i]!);
    a = applyWord(b, a, [i], 'firing');
  }
  const D = firedRho.reduce((p, x) => p * BigInt(x), 1n);
  const M = firedLambda.reduce((p, x) => p * BigInt(x), 1n);
  return { word, firedRho, firedLambda, D, M };
}

describe('Appendix A.3', () => {
  it('A2, lambda = (1, 1): word 1, 2, 1; fired 1, 2, 1 (2) and 2, 4, 2 (16); quotient 8', () => {
    const p = products('A2', [1, 1]);
    expect(p.word).toEqual([0, 1, 0]);
    expect(p.firedRho).toEqual([1, 2, 1]);
    expect(p.D).toBe(2n);
    expect(p.firedLambda).toEqual([2, 4, 2]);
    expect(p.M).toBe(16n);
    expect(weylDimension(boardOf('A2'), [1, 1])).toBe(8n);
    expect(p.M / p.D).toBe(8n);
  });
  it('G2, lambda = (1, 0): word 1, 2, 1, 2, 1, 2; fired 1, 2, 5, 3, 4, 1 (120) and 2, 3, 7, 4, 5, 1 (840); quotient 7', () => {
    const p = products('G2', [1, 0]);
    expect(p.word).toEqual([0, 1, 0, 1, 0, 1]);
    expect(p.firedRho).toEqual([1, 2, 5, 3, 4, 1]);
    expect(p.D).toBe(120n);
    expect(p.firedLambda).toEqual([2, 3, 7, 4, 5, 1]);
    expect(p.M).toBe(840n);
    expect(weylDimension(boardOf('G2'), [1, 0])).toBe(7n);
  });
  it('B2, lambda = (0, 1): word 1, 2, 1, 2; fired 1, 3, 2, 1 (6) and 1, 4, 3, 2 (24); quotient 4', () => {
    const p = products('B2', [0, 1]);
    expect(p.word).toEqual([0, 1, 0, 1]);
    expect(p.firedRho).toEqual([1, 3, 2, 1]);
    expect(p.D).toBe(6n);
    expect(p.firedLambda).toEqual([1, 4, 3, 2]);
    expect(p.M).toBe(24n);
    expect(weylDimension(boardOf('B2'), [0, 1])).toBe(4n);
  });
  it('lambda = 0 is the trivial representation; rho itself on A2 is dim 8', () => {
    expect(weylDimension(boardOf('E8'), [0, 0, 0, 0, 0, 0, 0, 0])).toBe(1n);
    expect(weylDimension(boardOf('A1'), [0])).toBe(1n);
    expect(weylDimension(boardOf('A1'), [3])).toBe(4n);
  });
});

// The timing test that stood first in this block moved to test/bench/weyl-dimension.bench.ts.
describe('E8 3875 needs bigint', () => {
  it('the E8 product from rho exceeds 2^53 (verify.py line 340), so the quotient needs bigint', () => {
    const p = products('E8', [0, 0, 0, 0, 0, 0, 0, 0]);
    expect(p.D).toBeGreaterThan(2n ** 53n);
  });
});

describe('bad lambda (plan)', () => {
  it('wrong length, a negative entry, a non-integer are RangeErrors', () => {
    const b = boardOf('A2');
    expect(() => weylDimension(b, [1])).toThrow(RangeError);
    expect(() => weylDimension(b, [1, 1, 1])).toThrow(RangeError);
    expect(() => weylDimension(b, [1, -1])).toThrow(RangeError);
    expect(() => weylDimension(b, [1, 0.5])).toThrow(RangeError);
  });
});
