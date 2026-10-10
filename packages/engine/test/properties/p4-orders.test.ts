// SPEC.md 5.7, property 4: moves at unjoined nodes commute; (S_i S_j)^m = 1 with m = 3, 4, 6 for
// A_ij A_ji = 1, 2, 3 (section 2.2). Exhaustive over all 32 types and every pair i < j (plan); the seed
// governs the random vectors. Plan addition from 2.2 and verify.py lines 934 to 938: on four boards with
// A_ij A_ji >= 4 or one-way roads no power of S_1 S_2 up to 200 is the identity. Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cartanNumbers } from '../../src/board';
import { fire, mutate, mutationMatrix } from '../../src/moves';
import { bigBoard } from '../helpers/p1';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P1-A1.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 200;

function matmul(X: number[][], Y: number[][]): number[][] {
  return X.map((row) => Y[0]!.map((_, j) => row.reduce((s, x, k) => s + x * Y[k]![j]!, 0)));
}

function isIdentity(M: number[][]): boolean {
  return M.every((row, i) => row.every((x, j) => x === (i === j ? 1 : 0)));
}

/** The least m >= 1 with M^m = I, or null when none up to `limit`. */
function orderOf(M: number[][], limit: number): number | null {
  let P = M;
  for (let m = 1; m <= limit; m++) {
    if (isIdentity(P)) return m;
    P = matmul(P, M);
  }
  return null;
}

function bigMatmul(X: bigint[][], Y: bigint[][]): bigint[][] {
  return X.map((row) => Y[0]!.map((_, j) => row.reduce((s, x, k) => s + x * Y[k]![j]!, 0n)));
}

function pairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

describe('property 4', () => {
  it('unjoined moves commute', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const C = cartanNumbers(b);
      const unjoined = pairs(b.n).filter(([i, j]) => C[i]![j] === 0);
      if (unjoined.length === 0) continue;
      for (const [i, j] of unjoined) {
        expect(matmul(mutationMatrix(b, i), mutationMatrix(b, j))).toEqual(
          matmul(mutationMatrix(b, j), mutationMatrix(b, i)),
        );
      }
      const vec = fc.array(fc.integer({ min: -9, max: 9 }), { minLength: b.n, maxLength: b.n });
      fc.assert(
        fc.property(fc.constantFrom(...unjoined), vec, vec, ([i, j], p, a) => {
          expect(mutate(b, mutate(b, p, i), j)).toEqual(mutate(b, mutate(b, p, j), i));
          expect(fire(b, fire(b, a, i), j)).toEqual(fire(b, fire(b, a, j), i));
        }),
        { seed: SEED, numRuns: NUM_RUNS },
      );
    }
  });

  it('orders 3, 4, 6', () => {
    const expected: Record<number, number> = { 0: 2, 1: 3, 2: 4, 3: 6 };
    let joinedPairs = 0;
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const C = cartanNumbers(b);
      for (const [i, j] of pairs(b.n)) {
        const product = C[i]![j]! * C[j]![i]!;
        if (product > 0) joinedPairs += 1;
        const M = matmul(mutationMatrix(b, i), mutationMatrix(b, j));
        expect(orderOf(M, 13)).toBe(expected[product]);
      }
    }
    expect(joinedPairs).toBeGreaterThan(0);
  });

  it('a joined pair does not commute, so the commuting check is not vacuous', () => {
    const b = boardOf('A2');
    expect(matmul(mutationMatrix(b, 0), mutationMatrix(b, 1))).not.toEqual(
      matmul(mutationMatrix(b, 1), mutationMatrix(b, 0)),
    );
  });

  it('S_1 S_2 has infinite order on four boards with A_12 A_21 >= 4 or a one-way road', () => {
    for (const M of [[[2, -2], [-2, 2]], [[2, -4], [-1, 2]], [[2, -3], [-3, 2]], [[2, -3], [-2, 2]]]) {
      const b = bigBoard(M);
      const S = bigMatmul(
        mutationMatrix(b, 0).map((r) => r.map(BigInt)),
        mutationMatrix(b, 1).map((r) => r.map(BigInt)),
      );
      expect(S[0]![0]! + S[1]![1]!).toBe(BigInt(M[0]![1]! * M[1]![0]! - 2));
      expect(S[0]![0]! + S[1]![1]!).toBeGreaterThanOrEqual(2n);
      let P = S;
      for (let k = 0; k < 200; k++) {
        expect(P[0]![0] === 1n && P[1]![1] === 1n && P[0]![1] === 0n && P[1]![0] === 0n).toBe(false);
        P = bigMatmul(P, S);
      }
    }
  });
});
