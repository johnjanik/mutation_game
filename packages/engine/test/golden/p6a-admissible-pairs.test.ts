// The golden key `admissible_pairs` (SPEC.md 2.15 "Which pairs are real forms", 4 T13 first acceptance criterion
// at engine level, 5.7 phase 6 and rules 2 and 5, Appendix G; P6-A1 instruction 5.10). For every one of the 32
// types: every subset X of the positions (bit masks in increasing order, as reference/verify.py) and every
// symmetry of the board that is an involution, the identity included (verify.py filters automorphisms to
// t[t[i]] == i); the pairs that admissibility accepts, converted to labels as [labels(sorted X), labels(tau)],
// equal admissible_pairs[T] as a set (rule 5: "admissible_pairs[T] is sorted and compares as a set").
import { describe, expect, it } from 'vitest';
import { symmetries } from '../../src/fold';
import { admissibility } from '../../src/satake';
import { TYPE_NAMES, boardOf, covers, golden, labels } from './_harness';

covers('admissible_pairs');

const PAIRS = golden.admissible_pairs as Record<string, [number[], number[]][]>;

/** The symmetries of order at most 2 (trap 18: D4 has 4, A2..A8, D5..D8 and E6 have 2, the rest 1). */
function involutions(T: string): number[][] {
  return symmetries(boardOf(T)).filter((t) => t.every((x, i) => t[x] === i)).map((t) => [...t]);
}

function expectedInvolutions(T: string): number {
  if (T === 'D4') return 4;
  if (/^A[2-8]$/.test(T) || /^D[5-8]$/.test(T) || T === 'E6') return 2;
  return 1;
}

const key = (pair: readonly (readonly number[])[]): string => JSON.stringify(pair);

describe('admissible_pairs', () => {
  it('has the 32 types', () => {
    expect(Object.keys(PAIRS).sort()).toEqual([...TYPE_NAMES].sort());
  });

  it('the involutive symmetries of each type, identity first', () => {
    for (const T of TYPE_NAMES) {
      const inv = involutions(T);
      expect(inv.length, T).toBe(expectedInvolutions(T));
      expect(inv[0], T).toEqual(boardOf(T).labels.map((_, i) => i));
    }
  });

  for (const T of TYPE_NAMES) {
    it(`admissible pairs of every type equal the golden set: ${T}`, () => {
      const board = boardOf(T);
      const n = board.n;
      const found: string[] = [];
      for (let mask = 0; mask < 1 << n; mask++) {
        const X: number[] = [];
        for (let i = 0; i < n; i++) if ((mask >> i) & 1) X.push(i);
        for (const tau of involutions(T)) {
          if (admissibility({ board, black: X, tau }).admissible) found.push(key([labels(board, X), labels(board, tau)]));
        }
      }
      const expected = PAIRS[T]!.map(key);
      // as a set: no pair is found twice, and the two sets are equal
      expect(new Set(found).size).toBe(found.length);
      expect([...found].sort()).toEqual([...expected].sort());
    });
  }
});
