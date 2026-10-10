// The E-7 unit test: on a board whose labels start at 0 (what an affine board will have in phase 2),
// no golden test would notice a stray + 1, so toLabels, toPositions, mutate and fire are checked here
// by hand, and the finite counterpart (labels 1..n) beside it. Registers no golden key.
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import type { Board } from '../../src/board';
import { toLabels, toPositions } from '../../src/board';
import { fire, mutate } from '../../src/moves';
import { boardOf } from '../golden/_harness';

// the matrix of the square (the 4-cycle), SPEC.md 2.12 and board_from_name('square')
const square: Board<bigint> = {
  n: 4,
  cartan: [
    [2n, -1n, 0n, -1n],
    [-1n, 2n, -1n, 0n],
    [0n, -1n, 2n, -1n],
    [-1n, 0n, -1n, 2n],
  ],
  labels: [0, 1, 2, 3],
  kind: 'gcm',
  arith: Big,
};

describe('affine-style labels round-trip', () => {
  it('toLabels is the identity on labels 0..3, and [0] stays [0]', () => {
    expect(toLabels(square, [0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
    expect(toLabels(square, [0])).toEqual([0]);
    expect(toLabels(square, [0])).not.toEqual([1]);
  });

  it('toPositions is the identity on [0, 3]', () => {
    expect(toPositions(square, [0, 3])).toEqual([0, 3]);
  });

  it('a word round-trips through toLabels then toPositions, and the converters copy', () => {
    const word = [2, 0, 3, 1];
    const labels = toLabels(square, word);
    expect(labels).toEqual([2, 0, 3, 1]);
    expect(labels).not.toBe(word);
    expect(toPositions(square, labels)).toEqual(word);
    expect(toPositions(square, labels)).not.toBe(labels);
    expect(toLabels(square, [])).toEqual([]);
    expect(toPositions(square, [])).toEqual([]);
  });
});

describe('unknown label throws RangeError', () => {
  it('toPositions on 4 and on -1', () => {
    expect(() => toPositions(square, [4])).toThrow(RangeError);
    expect(() => toPositions(square, [-1])).toThrow(RangeError);
    expect(() => toPositions(square, [0, 4])).toThrow(RangeError);
  });

  it('toLabels on position 4', () => {
    expect(() => toLabels(square, [4])).toThrow(RangeError);
    expect(() => toLabels(square, [-1])).toThrow(RangeError);
  });
});

describe('mutate at position 0 changes node 0', () => {
  it('mutate(square, e_0, 0) negates the entry the reader calls node 0', () => {
    expect(mutate(square, [1n, 0n, 0n, 0n], 0)).toEqual([-1n, 0n, 0n, 0n]);
  });

  it('mutate(square, [0, 1, 0, 1], 0) raises node 0 by its two neighbours', () => {
    expect(mutate(square, [0n, 1n, 0n, 1n], 0)).toEqual([2n, 1n, 0n, 1n]);
  });

  it('fire(square, e_0, 0) negates node 0 and feeds nodes 1 and 3', () => {
    expect(fire(square, [1n, 0n, 0n, 0n], 0)).toEqual([-1n, 1n, 0n, 1n]);
  });
});

describe('finite labels are 1-based', () => {
  const a3 = boardOf('A3');

  it('toPositions([1, 2, 3]) is [0, 1, 2] and toLabels([0]) is [1]', () => {
    expect(toPositions(a3, [1, 2, 3])).toEqual([0, 1, 2]);
    expect(toLabels(a3, [0])).toEqual([1]);
    expect(toLabels(a3, [2, 0, 1])).toEqual([3, 1, 2]);
  });

  it('label 0 is unknown on a finite board', () => {
    expect(() => toPositions(a3, [0])).toThrow(RangeError);
    expect(() => toPositions(a3, [4])).toThrow(RangeError);
    expect(() => toLabels(a3, [3])).toThrow(RangeError);
  });
});
