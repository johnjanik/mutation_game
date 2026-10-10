// The exponents and the group order of every type (SPEC.md 2.7 F7; 5.7 phase 3; P3-A1 instruction 5.5,
// 5.11): exponentsFromFired on the tally of the game from rho, weylOrder, and the relations N = sum m_i,
// h = m_n + 1, |W| = prod(m_i + 1), as verify.py lines 174 to 182 checked them. The A3 tally of
// Appendix A.2 and the B3 tally of the instruction are hand cases.
import { describe, expect, it } from 'vitest';
import { coxeterNumber } from '../../src/guards';
import { play } from '../../src/play';
import { exponentsFromFired, weylOrder } from '../../src/weyl';
import { ones } from '../helpers/p1';
import { TYPE_NAMES, boardOf, covers, golden, intEq } from './_harness';

covers('types[*].exponents', 'types[*].weyl_order');

describe('exponents from the tally of the game from rho', () => {
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;
    it(`exponents of ${T}`, () => {
      const b = boardOf(T);
      const game = play(b, ones(b));
      expect(game.status).toBe('ended');
      const exps = exponentsFromFired(game.fired, b.n);
      intEq(exps, rec.exponents, 'exponents');
      // ascending, one per node
      expect(exps.length).toBe(b.n);
      for (let k = 1; k < exps.length; k++) expect(exps[k]!).toBeGreaterThanOrEqual(exps[k - 1]!);
    });
  }
});

describe('weylOrder', () => {
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;
    it(`group order of ${T}`, () => {
      const b = boardOf(T);
      const W = weylOrder(b);
      expect(typeof W).toBe('number');
      intEq(W, rec.weyl_order, 'weyl_order');
    });
  }
  it('E8 has 696729600 elements', () => {
    intEq(weylOrder(boardOf('E8')), golden.types['E8']!.weyl_order);
    expect(weylOrder(boardOf('E8'))).toBe(696729600);
  });
});

describe('F7 relations', () => {
  for (const T of TYPE_NAMES) {
    it(`N = sum m_i, h = m_n + 1, |W| = prod(m_i + 1) on ${T}`, () => {
      const b = boardOf(T);
      const game = play(b, ones(b));
      const exps = exponentsFromFired(game.fired, b.n);
      const N = game.moves;
      expect(exps.reduce((s, m) => s + m, 0)).toBe(N);
      expect(exps[exps.length - 1]! + 1).toBe(coxeterNumber(b));
      expect(exps.reduce((p, m) => p * (m + 1), 1)).toBe(weylOrder(b));
      // the tally is weakly decreasing (F7: k_1 >= k_2 >= ...)
      const tally = new Map<number, number>();
      for (const x of game.fired) tally.set(x, (tally.get(x) ?? 0) + 1);
      const top = Math.max(...tally.keys());
      for (let k = 1; k < top; k++) expect(tally.get(k) ?? 0).toBeGreaterThanOrEqual(tally.get(k + 1) ?? 0);
    });
  }
});

describe('hand cases', () => {
  it('A3 tally of Appendix A.2: (3, 2, 1) read sideways gives 1, 2, 3 and 24', () => {
    const fired = [1, 2, 1, 3, 2, 1];
    expect(exponentsFromFired(fired, 3)).toEqual([1, 2, 3]);
    expect(exponentsFromFired(fired, 3).reduce((p, m) => p * (m + 1), 1)).toBe(24);
    expect(play(boardOf('A3'), [1, 1, 1]).fired).toEqual(fired);
    expect(fired).toEqual([1, 2, 1, 3, 2, 1]); // not changed
  });
  it('B3: fired 1, 2, 1, 5, 4, 3, 3, 2, 1 gives exponents 1, 3, 5', () => {
    expect(exponentsFromFired([1, 2, 1, 5, 4, 3, 3, 2, 1], 3)).toEqual([1, 3, 5]);
  });
  it('the order of the fired values does not matter, and frozen input is accepted', () => {
    const fired = Object.freeze([3, 1, 2, 1, 2, 1]);
    expect(exponentsFromFired(fired, 3)).toEqual([1, 2, 3]);
  });
  it('n = 0 gives []; a bad n is a RangeError', () => {
    expect(exponentsFromFired([], 0)).toEqual([]);
    expect(() => exponentsFromFired([1], -1)).toThrow(RangeError);
    expect(() => exponentsFromFired([1], 1.5)).toThrow(RangeError);
  });
});
