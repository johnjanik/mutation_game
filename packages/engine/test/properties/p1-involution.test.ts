// SPEC.md 5.7, property 1: mutate(B, mutate(B, p, i), i) = p and fire(B, fire(B, a, i), i) = a.
// The board is drawn at random from the type list; vectors have random integer entries in [-9, 9].
// Both arithmetics are exercised: boardOf(T) (SafeInt) and a hand-built Board<bigint> with the same matrix.
// Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import type { Board } from '../../src/board';
import { cartanNumbers } from '../../src/board';
import { fire, mutate } from '../../src/moves';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

// fixed seed and run count, recorded here (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 1000;

function bigCopy(board: Board<number>): Board<bigint> {
  return {
    n: board.n,
    cartan: cartanNumbers(board).map((row) => row.map((x) => BigInt(x))),
    labels: board.labels,
    kind: board.kind,
    arith: Big,
  };
}

/** A type name, a vector of its rank with entries in [-9, 9], and a position. */
const caseArb = fc
  .constantFrom(...TYPE_NAMES)
  .chain((T) => {
    const n = boardOf(T).n;
    return fc.tuple(
      fc.constant(T),
      fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n }),
      fc.integer({ min: 0, max: n - 1 }),
    );
  });

describe('property 1', () => {
  it('mutate is an involution', () => {
    fc.assert(
      fc.property(caseArb, ([T, v, i]) => {
        const board = boardOf(T);
        const input = [...v];
        expect(mutate(board, mutate(board, v, i), i)).toEqual(v);
        expect(v).toEqual(input);
        const bb = bigCopy(board);
        const w = v.map((x) => BigInt(x));
        const wInput = [...w];
        expect(mutate(bb, mutate(bb, w, i), i)).toEqual(w);
        expect(w).toEqual(wInput);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('fire is an involution', () => {
    fc.assert(
      fc.property(caseArb, ([T, v, i]) => {
        const board = boardOf(T);
        const input = [...v];
        expect(fire(board, fire(board, v, i), i)).toEqual(v);
        expect(v).toEqual(input);
        const bb = bigCopy(board);
        const w = v.map((x) => BigInt(x));
        const wInput = [...w];
        expect(fire(bb, fire(bb, w, i), i)).toEqual(w);
        expect(w).toEqual(wInput);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('a single move is not the identity on a vector with a nonzero number at i', () => {
    // guards against an implementation that returns its input unchanged (which is trivially an involution)
    fc.assert(
      fc.property(caseArb, ([T, v, i]) => {
        const board = boardOf(T);
        const a = [...v];
        a[i] = a[i] === 0 ? 1 : a[i]!;
        expect(fire(board, a, i)[i]).toBe(-a[i]!);
        const total = (x: readonly number[]) => x.reduce((s, y) => s + y, 0);
        const C = cartanNumbers(board);
        const drop = C[i]!.reduce((s, c, j) => s + c * a[j]!, 0);
        expect(total(mutate(board, a, i))).toBe(total(a) - drop);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
