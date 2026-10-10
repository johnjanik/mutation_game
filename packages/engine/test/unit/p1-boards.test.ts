// components, transposeBoard, subBoard (P1-A1 instruction 5.4, 5.12): the examples of 5.4, the naming
// rule of the transpose (B2 and C2 never pinned, COMMON.md 2), the involution, the labels of E-7, the
// RangeError cases, and SPEC.md 5.6 second row (all three work on the one-way board). No golden key.
import { describe, expect, it } from 'vitest';
import { Big, SafeInt } from '../../src/arith';
import { cartan, cartanNumbers, components, subBoard, transposeBoard } from '../../src/board';
import { bigBoard } from '../helpers/p1';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

const ONE_WAY = [[2, 0], [-1, 2]];

describe('components', () => {
  it('joins by a road in either direction', () => {
    expect(components(bigBoard(ONE_WAY))).toEqual([[0, 1]]);
    expect(components(bigBoard([[2, 0, -1], [0, 2, 0], [-1, 0, 2]]))).toEqual([[0, 2], [1]]);
    expect(components(bigBoard([[2, 0, 0], [0, 2, -1], [0, -1, 2]]))).toEqual([[0], [1, 2]]);
  });

  it('is one component on each of the 32 types', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      expect(components(b)).toEqual([b.labels.map((_, i) => i)]);
    }
  });

  it('splits a sub-board of E8 without its middle node', () => {
    // E8 minus node 4 (position 3) falls into A1 (node 2), A2 (nodes 1, 3) and A4 (nodes 5 to 8)
    const sub = subBoard(boardOf('E8'), [0, 1, 2, 4, 5, 6, 7]);
    expect(components(sub)).toEqual([[0, 2], [1], [3, 4, 5, 6]]);
  });
});

describe('transposeBoard names', () => {
  it('exchanges B3 and C3 and keeps simply laced names', () => {
    expect(transposeBoard(boardOf('B3')).name).toBe('C3');
    expect(transposeBoard(boardOf('C3')).name).toBe('B3');
    expect(transposeBoard(boardOf('B5')).name).toBe('C5');
    for (const T of ['A1', 'A4', 'D5', 'E6', 'E7', 'E8']) expect(transposeBoard(boardOf(T)).name).toBe(T);
  });

  it('leaves the transposes of F4 and G2 unnamed', () => {
    expect(transposeBoard(boardOf('F4')).name).toBeUndefined();
    expect(transposeBoard(boardOf('G2')).name).toBeUndefined();
  });

  it('gives the transpose of B2 the matrix of C2 and the transpose of C2 the matrix of B2', () => {
    // the names of these two are settled by identify in phase 2 and are not pinned here
    expect(cartanNumbers(transposeBoard(boardOf('B2')))).toEqual(cartan('C2'));
    expect(cartanNumbers(transposeBoard(boardOf('C2')))).toEqual(cartan('B2'));
    expect(transposeBoard(boardOf('B2')).name).not.toBe('C2');
  });

  it('keeps the labels, the arithmetic and the kind', () => {
    const b = subBoard(boardOf('B3'), [1, 2]);
    const t = transposeBoard(b);
    expect([...t.labels]).toEqual([2, 3]);
    expect(t.arith).toBe(SafeInt);
    expect(t.kind).toBe('gcm');
    expect(cartanNumbers(t)).toEqual(cartan('C2'));
    const o = transposeBoard(bigBoard(ONE_WAY));
    expect(o.kind).toBe('one-way');
    expect(o.arith).toBe(Big);
    expect(cartanNumbers(o)).toEqual([[2, -1], [0, 2]]);
    expect(o.name).toBeUndefined();
  });
});

describe('transposeBoard twice is the identity', () => {
  it('on the matrix and labels of every type, and on the name of every type but B2 and C2', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const tt = transposeBoard(transposeBoard(b));
      expect(cartanNumbers(tt)).toEqual(cartanNumbers(b));
      expect([...tt.labels]).toEqual([...b.labels]);
      if (T !== 'B2' && T !== 'C2') expect(tt.name).toBe(T);
    }
  });

  it('transposes the matrix (B2: C[1][0] moves to C[0][1])', () => {
    const t = transposeBoard(boardOf('B2'));
    expect(cartanNumbers(t)).toEqual([[2, -2], [-1, 2]]);
    expect(cartanNumbers(boardOf('B2'))).toEqual([[2, -1], [-2, 2]]);
  });
});

describe('subBoard', () => {
  it('gives the examples of P1-A1 instruction 5.4', () => {
    const a = subBoard(boardOf('A3'), [2, 1]);
    expect(cartanNumbers(a)).toEqual([[2, -1], [-1, 2]]);
    expect([...a.labels]).toEqual([2, 3]);
    const b = subBoard(boardOf('B3'), [1, 2]);
    expect(cartanNumbers(b)).toEqual(cartan('B2'));
    expect([...b.labels]).toEqual([2, 3]);
    const e = subBoard(boardOf('E8'), [0, 1, 2, 3, 4, 5, 6]);
    expect(cartanNumbers(e)).toEqual(cartan('E7'));
    expect([...e.labels]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('sorts the chosen positions, keeps the arithmetic and has no name', () => {
    const s = subBoard(boardOf('D4'), [3, 0, 1]);
    expect([...s.labels]).toEqual([1, 2, 4]);
    expect(s.n).toBe(3);
    expect(s.arith).toBe(SafeInt);
    expect(s.name).toBeUndefined();
    expect(s.kind).toBe('gcm');
    // D4: node 4 is joined to node 2 (SPEC.md 2.8), so nodes 1, 2, 4 form a path
    expect(cartanNumbers(s)).toEqual([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]);
    const t = subBoard(boardOf('D4'), [0, 2, 3]);
    expect([...t.labels]).toEqual([1, 3, 4]);
    expect(cartanNumbers(t)).toEqual([[2, 0, 0], [0, 2, 0], [0, 0, 2]]);
  });

  it('keeps labels other than 1..n through a second sub-board', () => {
    const s = subBoard(subBoard(boardOf('A5'), [1, 2, 3, 4]), [1, 3]);
    expect([...s.labels]).toEqual([3, 5]);
    expect(cartanNumbers(s)).toEqual([[2, 0], [0, 2]]);
  });

  it('works on the one-way board, and a sub-board of it can be gcm', () => {
    const o = bigBoard(ONE_WAY);
    const s = subBoard(o, [0, 1]);
    expect(s.kind).toBe('one-way');
    expect(s.arith).toBe(Big);
    expect(cartanNumbers(s)).toEqual(ONE_WAY);
    expect(subBoard(o, [1]).kind).toBe('gcm');
    expect([...subBoard(o, [1]).labels]).toEqual([2]);
    const three = bigBoard([[2, 0, -1], [-1, 2, 0], [-1, 0, 2]]);
    expect(three.kind).toBe('one-way');
    expect(subBoard(three, [0, 2]).kind).toBe('gcm');
  });

  it('throws RangeError on an empty list, a repeated position or a position out of range', () => {
    const b = boardOf('A3');
    expect(() => subBoard(b, [])).toThrow(RangeError);
    expect(() => subBoard(b, [1, 1])).toThrow(RangeError);
    expect(() => subBoard(b, [3])).toThrow(RangeError);
    expect(() => subBoard(b, [-1])).toThrow(RangeError);
    expect(() => subBoard(b, [0.5])).toThrow(RangeError);
  });

  it('does not change the board it was taken from', () => {
    const b = boardOf('B3');
    subBoard(b, [2, 0]);
    expect(cartanNumbers(b)).toEqual(cartan('B3'));
    expect([...b.labels]).toEqual([1, 2, 3]);
  });
});
