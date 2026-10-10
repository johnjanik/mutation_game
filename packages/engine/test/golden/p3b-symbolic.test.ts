// symbolicPlay (plan; SPEC.md 2.4(b), 2.7 F6, 4 T7 acceptance at engine level, Appendix A.1, verify.py
// lines 217 to 221 and 1589 to 1591; P3-A2 instruction 5.12): the forms fired by a complete game from rho
// are the positive root populations of the REVERSED board, each exactly once. The expected list is golden
// (types[U].positive_roots where types[U].cartan is the transpose: U = T on A, D, E; B and C exchange; for
// F4 and G2 the transpose is the stored matrix with the nodes in reverse order, so the stored vectors are
// reversed, after asserting that correspondence). No golden key is registered here: positive_roots is
// P1-A1's.
import { describe, expect, it } from 'vitest';
import { cartanNumbers, toPositions, transposeBoard } from '../../src/board';
import { symbolicPlay } from '../../src/heaps';
import { play } from '../../src/play';
import { positiveRoots } from '../../src/search';
import { TYPE_NAMES, boardOf, golden, intEq, sortedPositiveRoots } from './_harness';
import { ones } from '../helpers/p1';

const SMALL_TYPES = ['A1', 'A2', 'A3', 'A4', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'D4', 'F4', 'G2', 'E6'] as const;

const sameMatrix = (M: number[][], N: number[][]): boolean => JSON.stringify(M) === JSON.stringify(N);

function reversedOrder(M: number[][]): number[][] {
  const n = M.length;
  return M.map((_, i) => M.map((__, j) => M[n - 1 - i]![n - 1 - j]!));
}

/** The golden positive roots of the transposed Cartan matrix of T, sorted (rule 5). */
function expectedReversedRoots(T: string): number[][] {
  const b = boardOf(T);
  const CT = cartanNumbers(transposeBoard(b));
  const U = TYPE_NAMES.find((name) => sameMatrix(golden.types[name]!.cartan, CT));
  if (U !== undefined) {
    const list = golden.types[U]!.positive_roots;
    expect(list).toBeDefined();
    return sortedPositiveRoots(list!);
  }
  // F4 and G2: no stored matrix equals the transpose; it is the same type with the node order reversed
  expect(['F4', 'G2']).toContain(T);
  expect(sameMatrix(reversedOrder(golden.types[T]!.cartan), CT)).toBe(true);
  const list = golden.types[T]!.positive_roots;
  expect(list).toBeDefined();
  return sortedPositiveRoots(list!.map((v) => [...v].reverse()));
}

describe('symbolicPlay', () => {
  it('forms are the reversed board\'s positive roots', () => {
    for (const T of SMALL_TYPES) {
      const b = boardOf(T);
      const word = toPositions(b, golden.types[T]!.longest_word);
      const forms = symbolicPlay(b, word);
      intEq(forms.length, golden.types[T]!.n_positive_roots, `${T}: N forms`);
      const distinct = new Set(forms.map((f) => JSON.stringify(f)));
      expect(distinct.size).toBe(forms.length);
      intEq(sortedPositiveRoots(forms), expectedReversedRoots(T), `${T}: forms against the reversed board`);
    }
  });

  it('B3 differs from its own roots', () => {
    const b = boardOf('B3');
    const forms = sortedPositiveRoots(symbolicPlay(b, toPositions(b, golden.types.B3!.longest_word)));
    const own = sortedPositiveRoots(golden.types.B3!.positive_roots!);
    expect(forms).not.toEqual(own);
    expect(forms).toContainEqual([1, 2, 1]);
    expect(own).not.toContainEqual([1, 2, 1]);
    expect(golden.types.C3!.positive_roots).toContainEqual([1, 2, 1]);
  });

  it('B2 symbolic game of Appendix A.1', () => {
    const b = boardOf('B2');
    const r = play(b, [1, 1]);
    expect(r.word).toEqual([0, 1, 0, 1]);
    expect(symbolicPlay(b, r.word)).toEqual([[1, 0], [2, 1], [1, 1], [0, 1]]);
    expect(golden.types.B2!.positive_roots).toContainEqual([1, 2]);
    expect(golden.types.B2!.positive_roots).not.toContainEqual([2, 1]);
    expect(golden.types.C2!.positive_roots).toContainEqual([2, 1]);
  });

  it('every type against positiveRoots of the transpose', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const r = play(b, ones(b));
      expect(r.status).toBe('ended');
      const forms = symbolicPlay(b, r.word);
      const posT = positiveRoots(transposeBoard(b));
      intEq(forms.length, posT.length, `${T}: N forms`);
      expect(new Set(forms.map((f) => JSON.stringify(f))).size).toBe(forms.length);
      intEq(sortedPositiveRoots(forms), posT, `${T}: sorted forms`);
    }
  });

  it('records the form before the move, plays any word, and handles the empty word', () => {
    const b = boardOf('A2');
    expect(symbolicPlay(b, [])).toEqual([]);
    expect(symbolicPlay(b, [0, 0])).toEqual([[1, 0], [-1, 0]]);
    const word = [1, 1, 0];
    const frozen = Object.freeze([...word]);
    expect(symbolicPlay(b, frozen)).toEqual([[0, 1], [0, -1], [1, 0]]);
    expect(frozen).toEqual(word);
    expect(() => symbolicPlay(b, [2])).toThrow(RangeError);
  });
});
