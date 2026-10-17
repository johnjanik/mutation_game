// boardKind and fromAdjacency on the boards of the golden file and on hand-written matrices.
// This file calls no covers(): it reads classification_tests (covered in phase 2), one_way_counterexample
// and bigint_test (covered in phase 1) as inputs only; those keys are registered by the files of those
// phases, and a key is tested in exactly one file (CONTRACTS.md 3).
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import { NotABoard } from '../../src/errors';
import { boardKind, cartanNumbers, fromAdjacency } from '../../src/board';
import { golden, intEq } from './_harness';

/** A_ij = -C_ji for i != j and A_ii = 0 (SPEC.md 2.1), computed in the test, independent of the engine. */
function adjacencyByHand(C: number[][]): number[][] {
  return C.map((row, i) => row.map((_, j) => (i === j ? 0 : -C[j]![i]!)));
}

describe('classification_tests kinds', () => {
  for (const record of golden.classification_tests) {
    const expected = record.components.some((c) => c.kind === 'one-way') ? 'one-way' : 'gcm';
    it(`${record.label}: ${expected}`, () => {
      expect(boardKind(record.cartan)).toBe(expected);
    });
  }

  it('has twelve gcm boards and one one-way board', () => {
    const kinds = golden.classification_tests.map((r) => boardKind(r.cartan));
    expect(kinds.filter((k) => k === 'gcm').length).toBe(12);
    expect(kinds.filter((k) => k === 'one-way').length).toBe(1);
  });
});

describe('one-way counterexample', () => {
  it('one_way_counterexample.cartan is one-way', () => {
    expect(boardKind(golden.one_way_counterexample.cartan)).toBe('one-way');
  });

  it('bigint_test.cartan is gcm', () => {
    expect(boardKind(golden.bigint_test.cartan)).toBe('gcm');
  });
});

describe('not-a-board matrices', () => {
  const cases: [string, number[][]][] = [
    // the oracle's own two examples, verify.py line 1534
    ['positive off-diagonal', [[2, 1], [1, 2]]],
    ['diagonal not 2', [[1, -1], [-1, 2]]],
    ['one positive entry beside a valid one', [[2, 1], [-1, 2]]],
    ['a 1 by 1 matrix with 3', [[3]]],
    ['a non-integer entry', [[2, -0.5], [-1, 2]]],
    ['not square (plan)', [[2, -1]]],
    ['ragged (plan)', [[2, -1], [-1, 2, 0]]],
  ];
  for (const [label, M] of cases) {
    it(label, () => {
      expect(boardKind(M)).toBe('not-a-board');
    });
  }

  it('[[2]] is gcm, and -1.0 counts as an integer', () => {
    expect(boardKind([[2]])).toBe('gcm');
    expect(boardKind([[2, -1.0], [-1, 2]])).toBe('gcm');
  });

  it('a row that is not an array of numbers is not a board (plan)', () => {
    // deliberately ill-typed input, as a tool could receive from a parsed link
    const bad = [[2, '-1'], [-1, 2]] as unknown as number[][];
    expect(boardKind(bad)).toBe('not-a-board');
    const notRows = [2, 2] as unknown as number[][];
    expect(boardKind(notRows)).toBe('not-a-board');
  });
});

describe('fromAdjacency one-way', () => {
  it('[[0, 1], [0, 0]] is a one-way Big board with C = [[2, 0], [-1, 2]]', () => {
    // one road from city 1 to city 2; C = 2I - A^T by hand
    const board = fromAdjacency([[0, 1], [0, 0]]);
    expect(cartanNumbers(board)).toEqual([[2, 0], [-1, 2]]);
    expect(board.kind).toBe('one-way');
    expect(board.arith).toBe(Big);
    expect([...board.labels]).toEqual([1, 2]);
    expect(board.name).toBeUndefined();
    expect(board.n).toBe(2);
    expect(board.cartan[0]![0]).toBe(2n);
    expect(board.cartan[1]![0]).toBe(-1n);
  });

  it('equals the board of one_way_counterexample', () => {
    const board = fromAdjacency(adjacencyByHand(golden.one_way_counterexample.cartan));
    intEq(cartanNumbers(board), golden.one_way_counterexample.cartan);
    expect(board.kind).toBe('one-way');
  });
});

describe('fromAdjacency B2 is asymmetric the right way', () => {
  // the reference matrices of SPEC.md 2.8
  const B2 = [[2, -1], [-2, 2]];
  const G2 = [[2, -3], [-1, 2]];

  it('the golden adjacency of B2 is A_ij = -C_ji of the 2.8 literal', () => {
    expect(golden.types['B2']!.adjacency).toEqual(adjacencyByHand(B2));
    expect(golden.types['G2']!.adjacency).toEqual(adjacencyByHand(G2));
  });

  it('fromAdjacency(types.B2.adjacency) gives the B2 matrix, named B2', () => {
    const board = fromAdjacency(golden.types['B2']!.adjacency);
    expect(cartanNumbers(board)).toEqual(B2);
    expect(board.name).toBe('B2');
  });

  it('fromAdjacency(types.G2.adjacency) gives the G2 matrix, named G2', () => {
    const board = fromAdjacency(golden.types['G2']!.adjacency);
    expect(cartanNumbers(board)).toEqual(G2);
    expect(board.name).toBe('G2');
  });

  it('the transposed adjacency gives the transposed matrix', () => {
    const transposed = golden.types['B2']!.adjacency.map((row, i) => row.map((_, j) => golden.types['B2']!.adjacency[j]![i]!));
    const board = fromAdjacency(transposed);
    expect(cartanNumbers(board)).toEqual([[2, -2], [-1, 2]]);
  });

  it('the bigint_test board is a Big board without a name', () => {
    const board = fromAdjacency(adjacencyByHand(golden.bigint_test.cartan));
    intEq(cartanNumbers(board), golden.bigint_test.cartan);
    expect(board.arith).toBe(Big);
    expect(board.name).toBeUndefined();
    expect(board.kind).toBe('gcm');
  });
});

describe('fromAdjacency rejects', () => {
  const cases: [string, number[][]][] = [
    ['a negative road count', [[0, -1], [1, 0]]],
    ['a loop', [[1, 1], [1, 0]]],
    ['a matrix that is not square', [[0, 1]]],
    ['a fractional road count', [[0, 0.5], [1, 0]]],
    ['the empty matrix (plan)', []],
  ];
  for (const [label, A] of cases) {
    it(label, () => {
      expect(() => fromAdjacency(A)).toThrow(NotABoard);
    });
  }
});
