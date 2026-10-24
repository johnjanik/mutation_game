// The phase-5 engine by hand (SPEC.md 2.18, 5.2, 5.4, 5.6, E-5; P5-A1 instruction 5.2 to 5.6, section 6).
// No covers(): the golden key of phase 5, minuscule_representations, is covered in p5-minuscule.test.ts
// (a key is tested in exactly one file, CONTRACTS.md 3); this file holds the plan's unit tests: the sparse
// operations against hand values, the matrices of A1 and A2 by hand, the relation records of A2, the
// examples and the property of stringThrough, the cap of minusculeMatrices, and purity.
import { describe, expect, it } from 'vitest';
import type { SparseMatrix } from '../../src/rep';
import { spAdd, spComm, spEq, spKey, spMul, spScale } from '../../src/rep';

/** A sparse matrix from [key, value] pairs, in the order given (insertion order is not meaningful). */
function sp(entries: [string, number][]): SparseMatrix {
  return new Map(entries.map(([k, v]) => [k, BigInt(v)] as [string, bigint]));
}

/** The entries as sorted [key, decimal text] pairs: a readable, order-free picture for failure messages (plan). */
function dump(M: SparseMatrix): [string, string][] {
  return [...M.entries()].map(([k, v]) => [k, String(v)] as [string, string]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** True when no stored entry is zero (the oracle's invariant). */
function zeroFree(M: SparseMatrix): boolean {
  for (const v of M.values()) if (v === 0n) return false;
  return true;
}

describe('sparse operations', () => {
  // X = [[1, 2], [3, 0]] and Y = [[0, 4], [-1, 5]] as dense matrices, rows are images, columns sources.
  const X = (): SparseMatrix => sp([['0,0', 1], ['0,1', 2], ['1,0', 3]]);
  const Y = (): SparseMatrix => sp([['0,1', 4], ['1,1', 5], ['1,0', -1]]);

  it('spKey joins row and column with one comma', () => {
    expect(spKey(0, 2)).toBe('0,2');
    expect(spKey(12, 3)).toBe('12,3');
    expect(spKey(0, 0)).toBe('0,0');
    for (const [r, c] of [[-1, 0], [0, -1], [1.5, 0], [0, Number.NaN], [Number.POSITIVE_INFINITY, 0]] as [number, number][]) {
      expect(() => spKey(r, c), `${r},${c}`).toThrow(RangeError);
    }
  });

  it('spMul: (XY)[r][c] = sum_k X[r][k] Y[k][c], zeros dropped', () => {
    const x = X();
    const y = Y();
    // XY = [[-2, 14], [0, 12]]; YX = [[12, 0], [14, -2]]
    expect(dump(spMul(x, y))).toEqual(dump(sp([['0,0', -2], ['0,1', 14], ['1,1', 12]])));
    expect(dump(spMul(y, x))).toEqual(dump(sp([['0,0', 12], ['1,0', 14], ['1,1', -2]])));
    // a sum that cancels: (1, 1) times the column (1, -1)
    const cancel = spMul(sp([['0,0', 1], ['0,1', 1]]), sp([['0,0', 1], ['1,0', -1]]));
    expect(cancel.size).toBe(0);
    // keys with more than one digit, and a rectangular product
    expect(dump(spMul(sp([['12,3', 2]]), sp([['3,10', 5]])))).toEqual([['12,10', '10']]);
    // (1, 2, 3) times the 3 x 2 matrix with rows (0, 1), (0, 1), (-1, -1) is (-3, 0)
    expect(dump(spMul(sp([['0,0', 1], ['0,1', 2], ['0,2', 3]]), sp([['0,1', 1], ['1,1', 1], ['2,0', -1], ['2,1', -1]])))).toEqual([
      ['0,0', '-3'],
    ]);
    // the empty Map is the zero matrix
    expect(spMul(new Map(), x).size).toBe(0);
    expect(spMul(x, new Map()).size).toBe(0);
    for (const M of [spMul(x, y), spMul(y, x), cancel]) expect(zeroFree(M)).toBe(true);
  });

  it('spMul refuses a key that is not two decimal integers joined by one comma', () => {
    for (const bad of ['0, 1', '0;1', 'a,1', '01,1', '1', '1,2,3', '-1,0', '']) {
      expect(() => spMul(sp([[bad, 1]]), sp([['0,0', 1]])), bad).toThrow(RangeError);
      expect(() => spMul(sp([['0,0', 1]]), sp([[bad, 1]])), bad).toThrow(RangeError);
    }
  });

  it('spAdd: X + cy Y with cy defaulting to 1, zeros dropped', () => {
    const x = X();
    const y = Y();
    expect(dump(spAdd(x, y))).toEqual(dump(sp([['0,0', 1], ['0,1', 6], ['1,0', 2], ['1,1', 5]])));
    expect(dump(spAdd(x, y, -1n))).toEqual(dump(sp([['0,0', 1], ['0,1', -2], ['1,0', 4], ['1,1', -5]])));
    // X + 3Y: the entry (1, 0) is 3 - 3 = 0 and is dropped
    expect(dump(spAdd(x, y, 3n))).toEqual(dump(sp([['0,0', 1], ['0,1', 14], ['1,1', 15]])));
    expect(spAdd(x, x, -1n).size).toBe(0);
    const same = spAdd(x, y, 0n);
    expect(dump(same)).toEqual(dump(x));
    expect(same).not.toBe(x);
    // an explicit zero in an input is dropped
    expect(dump(spAdd(sp([['0,0', 0], ['1,1', 2]]), new Map()))).toEqual([['1,1', '2']]);
    for (const M of [spAdd(x, y), spAdd(x, y, -1n), spAdd(x, y, 3n), same]) expect(zeroFree(M)).toBe(true);
  });

  it('spComm: XY - YX', () => {
    // [X, Y] = [[-14, 14], [-14, 14]]
    expect(dump(spComm(X(), Y()))).toEqual(dump(sp([['0,0', -14], ['0,1', 14], ['1,0', -14], ['1,1', 14]])));
    expect(dump(spComm(Y(), X()))).toEqual(dump(sp([['0,0', 14], ['0,1', -14], ['1,0', 14], ['1,1', -14]])));
    expect(spComm(X(), X()).size).toBe(0);
    // diagonal matrices commute
    expect(spComm(sp([['0,0', 2], ['1,1', -1]]), sp([['0,0', 5], ['1,1', 7]])).size).toBe(0);
  });

  it('spScale: cX, the empty Map when c is 0', () => {
    expect(dump(spScale(X(), 3n))).toEqual(dump(sp([['0,0', 3], ['0,1', 6], ['1,0', 9]])));
    expect(dump(spScale(X(), -1n))).toEqual(dump(sp([['0,0', -1], ['0,1', -2], ['1,0', -3]])));
    expect(spScale(X(), 0n).size).toBe(0);
    const one = spScale(X(), 1n);
    expect(one).not.toBe(X());
    expect(dump(one)).toEqual(dump(X()));
    expect(zeroFree(spScale(sp([['0,0', 0], ['1,1', 2]]), 5n))).toBe(true);
  });

  it('spEq: the same nonzero entries, independent of insertion order, explicit zeros ignored', () => {
    expect(spEq(X(), X())).toBe(true);
    expect(spEq(sp([['0,0', 1], ['1,0', 3], ['0,1', 2]]), X())).toBe(true);
    expect(spEq(sp([['0,0', 1], ['5,5', 0]]), sp([['0,0', 1]]))).toBe(true);
    expect(spEq(sp([['0,0', 1]]), sp([['0,0', 1], ['5,5', 0]]))).toBe(true);
    expect(spEq(sp([['3,3', 0]]), new Map())).toBe(true);
    expect(spEq(new Map(), new Map())).toBe(true);
    expect(spEq(X(), Y())).toBe(false);
    expect(spEq(sp([['0,0', 1]]), sp([['0,0', 2]]))).toBe(false);
    expect(spEq(sp([['0,0', 1]]), sp([['0,0', 1], ['0,1', 1]]))).toBe(false);
    expect(spEq(sp([['0,0', 1], ['0,1', 1]]), sp([['0,0', 1]]))).toBe(false);
    expect(spEq(sp([['0,0', 1]]), sp([['1,1', 1]]))).toBe(false);
    expect(spEq(sp([['0,0', 1]]), new Map())).toBe(false);
  });

  it('inputs are unchanged by every operation', () => {
    const x = X();
    const y = Y();
    const zx = sp([['0,0', 0], ['1,1', 2]]);
    const before = [dump(x), dump(y), dump(zx)];
    spMul(x, y);
    spMul(zx, x);
    spAdd(x, y, -1n);
    spAdd(zx, y);
    spComm(x, y);
    spScale(x, 0n);
    spScale(zx, 2n);
    spEq(zx, y);
    expect([dump(x), dump(y), dump(zx)]).toEqual(before);
    expect(zx.get('0,0')).toBe(0n);
  });
});
