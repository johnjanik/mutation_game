// SPEC.md 5.7, property 3: firingMatrix(B, i) equals the transpose of mutationMatrix(transposeBoard(B), i)
// (section 2.4(b)). Plan additions from verify.py lines 209 to 216: C S_i = R_i C and S_i^2 = I, and the
// matrices act as the moves. Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cartanNumbers, transposeBoard } from '../../src/board';
import { fire, firingMatrix, mutate, mutationMatrix } from '../../src/moves';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P1-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 500;

function matmul(X: number[][], Y: number[][]): number[][] {
  return X.map((row) => Y[0]!.map((_, j) => row.reduce((s, x, k) => s + x * Y[k]![j]!, 0)));
}

function transposed(M: number[][]): number[][] {
  return M[0]!.map((_, j) => M.map((row) => row[j]!));
}

function identity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

function apply(M: number[][], v: readonly number[]): number[] {
  return M.map((row) => row.reduce((s, x, k) => s + x * v[k]!, 0));
}

const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
  const n = boardOf(T).n;
  return fc.tuple(
    fc.constant(T),
    fc.integer({ min: 0, max: n - 1 }),
    fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n }),
  );
});

describe('property 3', () => {
  it('firingMatrix is the transpose of mutationMatrix of the reversed board', () => {
    fc.assert(
      fc.property(caseArb, ([T, i]) => {
        const b = boardOf(T);
        expect(firingMatrix(b, i)).toEqual(transposed(mutationMatrix(transposeBoard(b), i)));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('C S_i = R_i C and S_i^2 = I', () => {
    fc.assert(
      fc.property(caseArb, ([T, i]) => {
        const b = boardOf(T);
        const C = cartanNumbers(b);
        const S = mutationMatrix(b, i);
        const R = firingMatrix(b, i);
        expect(matmul(C, S)).toEqual(matmul(R, C));
        expect(matmul(S, S)).toEqual(identity(b.n));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('S_i v is mutate(v, i) and R_i v is fire(v, i)', () => {
    fc.assert(
      fc.property(caseArb, ([T, i, v]) => {
        const b = boardOf(T);
        expect(apply(mutationMatrix(b, i), v)).toEqual(mutate(b, v, i));
        expect(apply(firingMatrix(b, i), v)).toEqual(fire(b, v, i));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('on B2 at position 1, S is [[1, 0], [2, -1]] and R is [[1, 1], [0, -1]]', () => {
    expect(mutationMatrix(boardOf('B2'), 1)).toEqual([[1, 0], [2, -1]]);
    expect(firingMatrix(boardOf('B2'), 1)).toEqual([[1, 1], [0, -1]]);
    expect(() => mutationMatrix(boardOf('B2'), 2)).toThrow(RangeError);
    expect(() => firingMatrix(boardOf('B2'), -1)).toThrow(RangeError);
  });
});
