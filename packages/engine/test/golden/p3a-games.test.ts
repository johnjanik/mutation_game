// Counting games and the length distribution (SPEC.md 2.7 F5, F12, 5.4, 5.5 "Counting games", 5.6, 5.7
// phase 3; P3-A1 instruction 5.8, 5.9, 5.11): countCompleteGames against n_reduced_words_w0 and
// legalLayers against length_distribution on the 23 types where the keys are present (rule 7: absent
// above |W| = 60000 and not tested there), null above the caps, the F12 values of 2.7, and legalLayers
// from another start (verify.py lines 260 to 267 and 284 to 288).
import { describe, expect, it } from 'vitest';
import { CAPS } from '../../src/caps';
import { play } from '../../src/play';
import { countCompleteGames, legalLayers, weylOrder } from '../../src/weyl';
import { ones } from '../helpers/p1';
import { TYPE_NAMES, boardOf, covers, golden, intEq } from './_harness';

covers('types[*].n_reduced_words_w0', 'types[*].length_distribution');

const PRESENT = TYPE_NAMES.filter((T) => golden.types[T]!.n_reduced_words_w0 !== undefined);
const ABSENT = TYPE_NAMES.filter((T) => golden.types[T]!.n_reduced_words_w0 === undefined);

describe('countCompleteGames', () => {
  it('the keys are present on 23 types and absent on 9, exactly those with |W| > 60000', () => {
    expect(PRESENT.length).toBe(23);
    expect(ABSENT).toEqual(['A8', 'B7', 'B8', 'C7', 'C8', 'D7', 'D8', 'E7', 'E8']);
    for (const T of PRESENT) {
      expect(golden.types[T]!.weyl_order).toBeLessThanOrEqual(CAPS.countGamesGroup);
      expect(golden.types[T]!.length_distribution).toBeDefined();
    }
    for (const T of ABSENT) {
      expect(golden.types[T]!.weyl_order).toBeGreaterThan(CAPS.countGamesGroup);
      expect(golden.types[T]!.length_distribution).toBeUndefined();
    }
  });
  for (const T of PRESENT) {
    const rec = golden.types[T]!;
    it(`number of complete games on ${T}`, { timeout: 60000 }, () => {
      const b = boardOf(T);
      const count = countCompleteGames(b);
      expect(typeof count).toBe('bigint');
      intEq(count, rec.n_reduced_words_w0!, 'n_reduced_words_w0');
    });
  }
  it('E6 is counted (|W| = 51840 is below 60000): 1266633313578528', { timeout: 60000 }, () => {
    expect(countCompleteGames(boardOf('E6'))).toBe(1266633313578528n);
  });
});

describe('F12 counts', () => {
  const F12: Record<string, bigint> = {
    A2: 2n, A3: 16n, A4: 768n, A5: 292864n,
    B2: 2n, B3: 42n, B4: 24024n, C2: 2n, C3: 42n, C4: 24024n,
    D4: 2316n, D5: 12985968n, F4: 2144892n, G2: 2n, A1: 1n,
  };
  for (const [T, value] of Object.entries(F12)) {
    it(`${T}: ${value} complete games`, () => {
      expect(countCompleteGames(boardOf(T))).toBe(value);
    });
  }
});

describe('null above the cap', () => {
  for (const T of ABSENT) {
    it(`${T} is not offered at the default cap`, () => {
      expect(countCompleteGames(boardOf(T))).toBeNull();
    });
  }
  it('A3 with cap 23 gives null, with cap 24 the count (the cap is on |W|, plan)', () => {
    const b = boardOf('A3');
    expect(countCompleteGames(b, 23)).toBeNull();
    expect(countCompleteGames(b, 24)).toBe(16n);
    expect(countCompleteGames(b, 0)).toBeNull();
  });
  it('a cap equal to |W| still returns the count, one less returns null (D6, |W| = 23040)', { timeout: 120000 }, () => {
    const b = boardOf('D6');
    expect(weylOrder(b)).toBe(23040);
    intEq(countCompleteGames(b, 23040), golden.types['D6']!.n_reduced_words_w0!);
    expect(countCompleteGames(b, 23039)).toBeNull();
  });
  it('a bad cap is a RangeError', () => {
    expect(() => countCompleteGames(boardOf('A2'), -1)).toThrow(RangeError);
    expect(() => countCompleteGames(boardOf('A2'), 1.5)).toThrow(RangeError);
  });
});

describe('legalLayers', () => {
  for (const T of PRESENT) {
    const rec = golden.types[T]!;
    it(`length distribution of ${T}`, { timeout: 60000 }, () => {
      const b = boardOf(T);
      const layers = legalLayers(b);
      expect(layers).not.toBeNull();
      intEq(layers, rec.length_distribution!, 'length_distribution in order');
      const N = play(b, ones(b)).moves;
      expect(layers!.length).toBe(N + 1);
      expect(layers!.reduce((s, x) => s + x, 0)).toBe(weylOrder(b));
      expect([...layers!].reverse()).toEqual(layers);
    });
  }
  it('the widest layer has 46 positions on B4 and C4, 94 on F4, 101 on A5 (verify.py line 307)', () => {
    expect(['B4', 'C4', 'F4', 'A5'].map((T) => Math.max(...legalLayers(boardOf(T))!))).toEqual([46, 46, 94, 101]);
  });
  it('A2 from rho gives [1, 2, 2, 1]; from [1, 0] it gives [1, 1, 1]', () => {
    const b = boardOf('A2');
    expect(legalLayers(b)).toEqual([1, 2, 2, 1]);
    expect(legalLayers(b, [1, 0])).toEqual([1, 1, 1]);
    expect(legalLayers(b, [0, 0])).toEqual([1]);
    expect(legalLayers(b, [-1, -1])).toEqual([1]);
  });
});

describe('legalLayers cap', () => {
  it('A3 with cap 23 gives null (24 positions are found), with cap 24 the layers', () => {
    const b = boardOf('A3');
    expect(legalLayers(b, undefined, 23)).toBeNull();
    expect(legalLayers(b, undefined, 24)).toEqual([1, 3, 5, 6, 5, 3, 1]);
    expect(legalLayers(b, [1, 1, 1], 24)).toEqual([1, 3, 5, 6, 5, 3, 1]);
    expect(legalLayers(b, undefined, 0)).toBeNull();
  });
  it('the default cap is CAPS.legalLayersDefault (100000), which D7 exceeds: null once the search is about to add position 100001', { timeout: 120000 }, () => {
    expect(CAPS.legalLayersDefault).toBe(100000);
    expect(legalLayers(boardOf('D7'))).toBeNull(); // |W| = 322560
  });
  it('a bad cap or a start of the wrong length is a RangeError', () => {
    expect(() => legalLayers(boardOf('A2'), undefined, -1)).toThrow(RangeError);
    expect(() => legalLayers(boardOf('A2'), [1])).toThrow(RangeError);
  });
});
