// RT-01 phase 4 round, finding P4-RT-01-02 (minor). fromAdjacency accepts a road count that is an integer beyond
// 2^53 (boardKind only asks for integers), and the moves work on the Big board it returns; but symmetrizer turns
// each entry into a rational with rat(), which accepts safe integers only, so symmetrizer, gram, cartanClass on an
// asymmetric board, classify, smallestNonfiniteSubboard and every guarded function (through requireFinite, which
// classifies) throw RangeError "the numerator ... is not a safe integer" where the oracle answers. Since b85ac0f the
// symmetric board with the same entry is classified (the shortcut skips the rationals), the asymmetric one is not.
// Oracle values typed from reference/lie_games.py (python3, run on this machine):
//   C = [[2, -2**53], [-1, 2]]: symmetrizer(C) = [1, 9007199254740992]; cartan_class(C) = 'indefinite';
//   classify(C) = [{'nodes': [1, 2], 'kind': 'gcm', 'balanced': True, 'class': 'indefinite', 'name': None}];
//   smallest_nonfinite_subboard(C) = ([1, 2], 'indefinite');
//   gram(C) = [[2, -9007199254740992], [-9007199254740992, 18014398509481984]].
//   C = [[2, -1, 0], [-2**54, 2, -1], [0, -1, 2]]: cartan_class(C) = 'indefinite'; smallest_nonfinite_subboard(C) = ([1, 2], 'indefinite').
// SPEC 5.6 (second table: classify, cartanClass, smallestNonfiniteSubboard work on every gcm board; a finite-theory
// function on a gcm board that is not of finite type throws NotFiniteType), E-11, E-2 ("every other board uses Big").
// Run: npm test -w packages/engine -- test/unit/classify-entries-beyond-2-53.test.ts
import { describe, expect, it } from 'vitest';
import { cartanClass, classify, coxeterNumber, fromAdjacency, gram, mutate, NotFiniteType, smallestNonfiniteSubboard, symmetrizer } from '../../src/index';
import type { AnyBoard, Board } from '../../src/index';
import { formValue, NeedsTwoWayRoads, weylOrder, wythoffEdges } from '../../src/index';

const P53 = 2 ** 53; // 9007199254740992, an integer, so boardKind and fromAdjacency accept it
const adj = (C: number[][]) => C.map((row, i) => row.map((_, j) => (i === j ? 0 : -C[j]![i]!)));
const text = (r: { num: bigint; den: bigint }) => (r.den === 1n ? String(r.num) : `${r.num}/${r.den}`);

describe('a road count beyond 2^53 (P4-RT-01-02)', () => {
  const C1 = [[2, -P53], [-1, 2]];
  const b1 = fromAdjacency(adj(C1)) as AnyBoard;

  it('the board is accepted and the moves work on it (Big)', () => {
    expect(b1.kind).toBe('gcm');
    expect(mutate(b1 as Board<bigint>, [0n, 1n], 0).map(String)).toEqual(['9007199254740992', '1']);
  });

  // regression: P4-RT-01-02
  it('symmetrizer is the oracle value [1, 9007199254740992]', () => {
    expect(symmetrizer(b1)?.map(text)).toEqual(['1', '9007199254740992']);
  });

  // regression: P4-RT-01-02
  it('gram is the oracle value', () => {
    expect(gram(b1)?.map((row) => row.map(text))).toEqual([['2', '-9007199254740992'], ['-9007199254740992', '18014398509481984']]);
  });

  // regression: P4-RT-01-02
  it('cartanClass is indefinite, as cartan_class', () => {
    expect(cartanClass(b1)).toBe('indefinite');
  });

  // regression: P4-RT-01-02
  it('classify gives the oracle record', () => {
    expect(classify(b1)).toEqual([{ nodes: [0, 1], kind: 'gcm', balanced: true, class: 'indefinite', name: null }]);
  });

  // regression: P4-RT-01-02
  it('smallestNonfiniteSubboard is positions [0, 1], indefinite', () => {
    expect(smallestNonfiniteSubboard(b1)).toEqual({ nodes: [0, 1], class: 'indefinite' });
  });

  // regression: P4-RT-01-02
  it('a finite-theory function refuses with NotFiniteType (SPEC 5.6), not RangeError', () => {
    expect(() => coxeterNumber(b1)).toThrow(NotFiniteType);
  });

  // regression: P4-RT-01-02
  it('three nodes, 2^54 roads into node 2: cartanClass and smallestNonfiniteSubboard as the oracle', () => {
    const C = [[2, -1, 0], [-(2 ** 54), 2, -1], [0, -1, 2]];
    const b = fromAdjacency(adj(C)) as AnyBoard;
    expect(cartanClass(b)).toBe('indefinite');
    expect(smallestNonfiniteSubboard(b)).toEqual({ nodes: [0, 1], class: 'indefinite' });
  });

  it('control: the symmetric board with the same count is already classified (the shortcut of b85ac0f)', () => {
    const b = fromAdjacency(adj([[2, -P53], [-P53, 2]])) as AnyBoard;
    expect(cartanClass(b)).toBe('indefinite');
    expect(classify(b)).toEqual([{ nodes: [0, 1], kind: 'gcm', balanced: true, class: 'indefinite', name: null }]);
  });
});

// RT-FIX P4: the same cause on other boards with a road count of 2^53, in the shapes of SPEC 5.6 (a
// balanced board with a symmetrizer that is not an integer, a board in two pieces with one finite, a
// board that is not balanced, a one-way board), and the form built on gram. Values from the oracle:
// python3 with sys.path.insert(0, 'reference'); import lie_games as L; P = 2**53; then
//   L.bil(L.gram([[2, -P], [-1, 2]]), [1, 1], [1, 1]) = 2 and ..., [1, 0], [0, 1]) = -9007199254740992;
//   C3 = [[2, -P, 0], [-1, 2, -1], [0, -1, 2]]: L.symmetrizer(C3) = [1, 9007199254740992, 9007199254740992],
//     L.classify(C3) = [{nodes [1, 2, 3], gcm, balanced, indefinite, name None}], L.smallest_nonfinite_subboard(C3) = ([1, 2], 'indefinite');
//   C4 = [[2, -1, 0, 0], [-1, 2, 0, 0], [0, 0, 2, -P], [0, 0, -3, 2]]: L.symmetrizer(C4) = [1, 1, 1, 9007199254740992/3],
//     L.classify(C4) = [{nodes [1, 2], A2, bourbaki_order [1, 2]}, {nodes [3, 4], indefinite}], smallest ([3, 4], 'indefinite');
//   C5 = [[2, -P, -1], [-1, 2, -1], [-1, -1, 2]]: L.is_symmetrizable(C5) = False,
//     L.classify(C5) = [{nodes [1, 2, 3], gcm, balanced False, indefinite}], smallest ([1, 2], 'indefinite');
//   C6 = [[2, -P], [0, 2]]: L.board_kind(C6) = 'one-way', L.classify(C6) = [{one-way, balanced False, class None}].
describe('road counts beyond 2^53 on boards of every kind (P4-RT-01-02)', () => {
  // regression: P4-RT-01-02
  it('formValue on gram: (1,1) has value 2, and (e1, e2) is minus 2^53', () => {
    const b = fromAdjacency(adj([[2, -P53], [-1, 2]])) as Board<bigint>;
    expect(text(formValue(b, [1n, 1n])!)).toBe('2');
    expect(text(formValue(b, [1n, 0n], [0n, 1n])!)).toBe('-9007199254740992');
  });

  // regression: P4-RT-01-02
  it('a balanced chain of three nodes: symmetrizer, classify and smallestNonfiniteSubboard as the oracle', () => {
    const b = fromAdjacency(adj([[2, -P53, 0], [-1, 2, -1], [0, -1, 2]])) as AnyBoard;
    expect(symmetrizer(b)?.map(text)).toEqual(['1', '9007199254740992', '9007199254740992']);
    expect(classify(b)).toEqual([{ nodes: [0, 1, 2], kind: 'gcm', balanced: true, class: 'indefinite', name: null }]);
    expect(smallestNonfiniteSubboard(b)).toEqual({ nodes: [0, 1], class: 'indefinite' });
  });

  // regression: P4-RT-01-02
  it('two pieces, A2 and a pair with 2^53 roads: a symmetrizer entry 2^53/3, one finite record, NotFiniteType', () => {
    const b = fromAdjacency(adj([[2, -1, 0, 0], [-1, 2, 0, 0], [0, 0, 2, -P53], [0, 0, -3, 2]])) as AnyBoard;
    expect(symmetrizer(b)?.map(text)).toEqual(['1', '1', '1', '9007199254740992/3']);
    expect(classify(b)).toEqual([
      { nodes: [0, 1], kind: 'gcm', balanced: true, class: 'finite', name: 'A2', bourbaki_order: [0, 1] },
      { nodes: [2, 3], kind: 'gcm', balanced: true, class: 'indefinite', name: null },
    ]);
    expect(smallestNonfiniteSubboard(b)).toEqual({ nodes: [2, 3], class: 'indefinite' });
    expect(() => weylOrder(b)).toThrow(NotFiniteType);
    expect(() => wythoffEdges(b, [1, 0, 0, 0], 10)).toThrow(NotFiniteType);
  });

  // regression: P4-RT-01-02
  it('a board that is not balanced: symmetrizer and gram null, classify indefinite, as the oracle', () => {
    const b = fromAdjacency(adj([[2, -P53, -1], [-1, 2, -1], [-1, -1, 2]])) as AnyBoard;
    expect(symmetrizer(b)).toBeNull();
    expect(gram(b)).toBeNull();
    expect(classify(b)).toEqual([{ nodes: [0, 1, 2], kind: 'gcm', balanced: false, class: 'indefinite', name: null }]);
    expect(smallestNonfiniteSubboard(b)).toEqual({ nodes: [0, 1], class: 'indefinite' });
    expect(() => coxeterNumber(b)).toThrow(NotFiniteType);
  });

  it('a one-way board with 2^53 roads: null, the one-way record and NeedsTwoWayRoads (5.6), as before', () => {
    const b = fromAdjacency(adj([[2, -P53], [0, 2]])) as AnyBoard;
    expect(b.kind).toBe('one-way');
    expect(symmetrizer(b)).toBeNull();
    expect(classify(b)).toEqual([{ nodes: [0, 1], kind: 'one-way', balanced: false, class: null, name: null }]);
    expect(smallestNonfiniteSubboard(b)).toBeNull();
    expect(() => coxeterNumber(b)).toThrow(NeedsTwoWayRoads);
  });
});
