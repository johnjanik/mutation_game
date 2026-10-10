// rational.ts and linalg.ts (P1-A1 instruction 5.2, 5.3, 5.12), and toPopulation (5.5): normalisation,
// rule 4 text, the determinants of the table of SPEC.md 2.8, identities, singular matrices, and the
// translator both ways. Registers no golden key (det_cartan belongs to P2-A1's file).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cartan, cartanNumbers } from '../../src/board';
import { determinant, inverse, solve } from '../../src/linalg';
import { toNumbers, toPopulation } from '../../src/moves';
import type { Rational } from '../../src/rational';
import { rat, ratAdd, ratDiv, ratEq, ratMul, ratNeg, ratSign, ratSub, ratToString } from '../../src/rational';
import { bigBoard } from '../helpers/p1';
import { TYPE_NAMES, boardOf, ratText } from '../golden/_harness';

// The column det C of the table of SPEC.md 2.8 for its 19 types (typed from the table, not from det_cartan).
const DET_FROM_TABLE_2_8: [string, number][] = [
  ['A1', 2], ['A2', 3], ['A3', 4], ['A4', 5], ['A5', 6],
  ['B2', 2], ['B3', 2], ['B4', 2], ['C2', 2], ['C3', 2], ['C4', 2],
  ['D4', 4], ['D5', 4], ['D6', 4], ['E6', 3], ['E7', 2], ['E8', 1], ['F4', 1], ['G2', 1],
];

const TRIANGLE = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];
const ONE_WAY = [[2, 0], [-1, 2]];
const THREE_EACH_WAY = [[2, -3], [-3, 2]];

const texts = (v: readonly Rational[]): string[] => v.map(ratToString);

describe('rational', () => {
  it('normalises the sign and the common factor', () => {
    expect(rat(2, -4)).toEqual({ num: -1n, den: 2n });
    expect(rat(0, 5)).toEqual({ num: 0n, den: 1n });
    expect(rat(6, 2)).toEqual({ num: 3n, den: 1n });
    expect(rat(-6n, -4n)).toEqual({ num: 3n, den: 2n });
    expect(ratEq(rat(1, -2), rat(-1, 2))).toBe(true);
    expect(ratEq(rat(1, 2), rat(2, 4))).toBe(true);
    expect(ratEq(rat(1, 2), rat(1, 3))).toBe(false);
  });

  it('prints as rule 4 and agrees with the harness ratText', () => {
    expect(ratToString(rat(-1, 2))).toBe('-1/2');
    expect(ratToString(rat(6, 2))).toBe('3');
    expect(ratToString(rat(0, 5))).toBe('0');
    expect(ratToString(rat(1, -2))).toBe('-1/2');
    fc.assert(
      fc.property(fc.bigInt({ min: -1000n, max: 1000n }), fc.bigInt({ min: 1n, max: 1000n }), (p, q) => {
        const r = rat(p, q);
        expect(ratToString(r)).toBe(ratText(r));
      }),
      { seed: 20261010, numRuns: 200 },
    );
  });

  it('adds, subtracts, multiplies, divides and negates exactly', () => {
    expect(ratAdd(rat(1, 2), rat(1, 3))).toEqual(rat(5, 6));
    expect(ratSub(rat(1, 2), rat(1, 2))).toEqual(rat(0));
    expect(ratMul(rat(2, 3), rat(3, 4))).toEqual(rat(1, 2));
    expect(ratDiv(rat(2, 3), rat(4, 9))).toEqual(rat(3, 2));
    expect(ratNeg(rat(1, 2))).toEqual(rat(-1, 2));
    expect(ratSign(rat(-3, 7))).toBe(-1);
    expect(ratSign(rat(0))).toBe(0);
    expect(ratSign(rat(5))).toBe(1);
  });

  it('throws RangeError on a zero denominator, on division by zero and on a non-integer number', () => {
    expect(() => rat(1, 0)).toThrow(RangeError);
    expect(() => rat(1n, 0n)).toThrow(RangeError);
    expect(() => ratDiv(rat(1), rat(0))).toThrow(RangeError);
    expect(() => rat(0.5)).toThrow(RangeError);
    expect(() => rat(2 ** 53)).toThrow(RangeError);
  });
});

describe('determinant', () => {
  for (const [T, det] of DET_FROM_TABLE_2_8) {
    it(`det C of ${T} is ${det} (SPEC.md 2.8)`, () => {
      const C = cartan(T);
      expect(determinant(C)).toEqual(rat(det));
      expect(determinant(C.map((row) => row.map((x) => BigInt(x))))).toEqual(rat(det));
      expect(determinant(C.map((row) => row.map((x) => rat(x))))).toEqual(rat(det));
    });
  }

  it('is 1 on the identity and on the empty matrix, 0 on a singular matrix', () => {
    expect(determinant([[1, 0, 0], [0, 1, 0], [0, 0, 1]])).toEqual(rat(1));
    expect(determinant([])).toEqual(rat(1));
    expect(determinant([[1, 2], [2, 4]])).toEqual(rat(0));
    expect(determinant(TRIANGLE)).toEqual(rat(0));
    expect(determinant([[0, 1], [1, 0]])).toEqual(rat(-1));
  });

  it('is -5 on the bigint_test board and 4 on the one-way board', () => {
    expect(determinant(THREE_EACH_WAY)).toEqual(rat(-5));
    expect(determinant(ONE_WAY)).toEqual(rat(4));
  });

  it('is exact on rational entries', () => {
    expect(determinant([[rat(1, 2), rat(1, 3)], [rat(1, 4), rat(1, 5)]])).toEqual(rat(1, 60));
  });

  it('throws RangeError on a non-square matrix and on a non-integer number entry', () => {
    expect(() => determinant([[1, 2]])).toThrow(RangeError);
    expect(() => determinant([[0.5]])).toThrow(RangeError);
  });
});

describe('solve and inverse', () => {
  function product(A: Rational[][], B: number[][]): Rational[][] {
    const n = A.length;
    const out: Rational[][] = [];
    for (let i = 0; i < n; i++) {
      const row: Rational[] = [];
      for (let j = 0; j < n; j++) {
        let s = rat(0);
        for (let k = 0; k < n; k++) s = ratAdd(s, ratMul(A[i]![k]!, rat(B[k]![j]!)));
        row.push(s);
      }
      out.push(row);
    }
    return out;
  }

  it('inverse(C) times C is the identity on the 32 types', () => {
    for (const T of TYPE_NAMES) {
      const C = cartanNumbers(boardOf(T));
      const inv = inverse(C);
      expect(inv).not.toBeNull();
      const P = product(inv!, C);
      for (let i = 0; i < C.length; i++) {
        for (let j = 0; j < C.length; j++) expect(ratEq(P[i]![j]!, rat(i === j ? 1 : 0))).toBe(true);
      }
    }
  });

  it('denominators of the inverse divide det C, and are 1 on E8, F4, G2', () => {
    for (const [T, det] of DET_FROM_TABLE_2_8) {
      const inv = inverse(cartan(T))!;
      for (const row of inv) for (const x of row) expect(BigInt(det) % x.den).toBe(0n);
      if (det === 1) for (const row of inv) for (const x of row) expect(x.den).toBe(1n);
    }
  });

  it('solves a small system exactly', () => {
    expect(texts(solve([[2, -1], [-1, 2]], [1, 0])!)).toEqual(['2/3', '1/3']);
    expect(texts(solve([[2n, -1n], [-1n, 2n]], [0n, 1n])!)).toEqual(['1/3', '2/3']);
    expect(texts(solve([[rat(1, 2)]], [rat(1)])!)).toEqual(['2']);
  });

  it('gives null on the triangle and on any singular matrix', () => {
    expect(solve(TRIANGLE, [1, 0, 0])).toBeNull();
    expect(inverse(TRIANGLE)).toBeNull();
    expect(inverse([[1, 2], [2, 4]])).toBeNull();
  });

  it('throws RangeError on a right-hand side of the wrong length', () => {
    expect(() => solve([[2, -1], [-1, 2]], [1])).toThrow(RangeError);
  });
});

describe('toPopulation', () => {
  it('gives the values of P1-A1 instruction 5.5', () => {
    expect(texts(toPopulation(boardOf('A2'), [1, 0])!)).toEqual(['2/3', '1/3']);
    expect(texts(toPopulation(boardOf('B2'), [1, 0])!)).toEqual(['1', '1']);
    expect(texts(toPopulation(boardOf('B2'), [0, 1])!)).toEqual(['1/2', '1']);
    expect(texts(toPopulation(bigBoard(ONE_WAY), [1n, 0n])!)).toEqual(['1/2', '1/4']);
    expect(texts(toPopulation(bigBoard(THREE_EACH_WAY), [1n, 0n])!)).toEqual(['-2/5', '-3/5']);
    expect(toPopulation(bigBoard(TRIANGLE), [1n, 0n, 0n])).toBeNull();
  });

  it('inverts toNumbers on the 32 types for random populations, with denominators dividing det C', () => {
    const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
      const n = boardOf(T).n;
      return fc.tuple(fc.constant(T), fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n }));
    });
    fc.assert(
      fc.property(caseArb, ([T, p]) => {
        const b = boardOf(T);
        const a = toNumbers(b, p);
        const q = toPopulation(b, a);
        expect(q).not.toBeNull();
        expect(q!.map((x) => x.den)).toEqual(p.map(() => 1n));
        expect(q!.map((x) => Number(x.num))).toEqual(p);
        const det = determinant(cartanNumbers(b)).num;
        const r = toPopulation(b, p)!;
        for (const x of r) expect(det % x.den).toBe(0n);
      }),
      { seed: 20261010, numRuns: 300 },
    );
  });

  it('on E8, F4 and G2 every integer position is the numbers of an integer population', () => {
    for (const T of ['E8', 'F4', 'G2']) {
      const b = boardOf(T);
      const a = b.labels.map((_, i) => (i % 3) - 1);
      const p = toPopulation(b, a)!;
      for (const x of p) expect(x.den).toBe(1n);
      expect(toNumbers(b, p.map((x) => Number(x.num)))).toEqual(a);
    }
  });

  it('throws RangeError on a vector of the wrong length', () => {
    expect(() => toPopulation(boardOf('A2'), [1])).toThrow(RangeError);
  });
});
