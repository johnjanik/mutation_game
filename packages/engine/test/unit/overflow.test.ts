// SafeInt overflow on the bigint_test board, the exact move at which it throws, the Big replay to
// population_end and numbers_end, and the small Arith instance checks (E-2).
// The golden key bigint_test itself is covered in phase 1, so this file calls no covers().
//
// Index semantics, from verify.py lines 1421 to 1425: the oracle applies move k + 1 (one-based) and
// records first_unsafe = k + 1 the first time max(abs(x)) > 2 ** 53 afterwards. So
// first_move_after_which_an_entry_exceeds_2_to_53 = 39 means that the stored entries are at most 2^53
// after 38 moves and exceed it after 39. A per-operation SafeInt throws one move earlier: after 37
// moves the entries are 1304969544928657 and 3416454622906707 (every second Fibonacci number: F_74 and
// F_76); move 38 forms the product 3 * 3416454622906707 = 10249363868720121, which exceeds
// Number.MAX_SAFE_INTEGER = 9007199254740991, although the result of move 38, 8944394323791464, would
// be safe. The firing replay throws during move 38 for the same reason: before move 38 the numbers are
// -1304969544928657 and 3416454622906707, move 38 fires position 1 (label 2), and the product
// C[0][1] * a[1] = -3 * 3416454622906707 is unsafe although both results would be safe.
// The roster's wording "at the move after first_move_after_which_an_entry_exceeds_2_to_53" (move 40,
// read literally) is superseded by these semantics; recorded in decisions/P0-A2.md and in the report.
import { describe, expect, it } from 'vitest';
import { Big, EngineOverflow, SafeInt } from '../../src/arith';
import type { Board } from '../../src/board';
import { adjacency, fromAdjacency, toPositions } from '../../src/board';
import { EngineError } from '../../src/errors';
import { fire, mutate } from '../../src/moves';
import { golden, intEq } from '../golden/_harness';

const data = golden.bigint_test;

/** The hand-built SafeInt board of bigint_test (no finite type has this matrix, so fromAdjacency gives Big). */
const safe: Board<number> = { n: 2, cartan: data.cartan, labels: [1, 2], kind: 'gcm', arith: SafeInt };
const big = fromAdjacency(adjacency(safe)) as Board<bigint>;

const mutationPositions = toPositions(big, data.mutation_nodes);
const firingPositions = toPositions(big, data.firing_nodes);

const OVERFLOW_MOVE = 38;

/** Replays moves with `step`; returns every position after the start, or the one-based move that threw. */
function replay<T>(
  board: Board<T>,
  start: readonly T[],
  nodes: number[],
  step: (b: Board<T>, v: readonly T[], i: number) => T[],
): { positions: T[][]; threw: { move: number; error: unknown } | null } {
  const positions: T[][] = [];
  let v: readonly T[] = start;
  for (let k = 0; k < nodes.length; k++) {
    try {
      v = step(board, v, nodes[k]!);
    } catch (error) {
      return { positions, threw: { move: k + 1, error } };
    }
    positions.push([...v]);
  }
  return { positions, threw: null };
}

describe('the bigint_test board', () => {
  it('is a Big board built from its adjacency, with 200 moves of each kind', () => {
    expect(big.arith).toBe(Big);
    expect(big.name).toBeUndefined();
    expect(data.mutation_nodes.length).toBe(200);
    expect(data.firing_nodes.length).toBe(200);
    // mutation_nodes begins 2, 1, 2, 1 (labels), so positions 1, 0, 1, 0
    expect(mutationPositions.slice(0, 4)).toEqual([1, 0, 1, 0]);
    expect(firingPositions.slice(0, 4)).toEqual([0, 1, 0, 1]);
  });
});

describe('Big replay reaches population_end', () => {
  it('200 mutations from population_start', () => {
    const start = data.population_start.map((x) => BigInt(x));
    const { positions, threw } = replay(big, start, mutationPositions, mutate);
    expect(threw).toBeNull();
    intEq(positions[positions.length - 1], data.population_end);
  });
});

describe('Big firing replay reaches numbers_end', () => {
  it('200 firings from numbers_start, and Big.show prints every entry as the stored string', () => {
    const start = data.numbers_start.map((x) => BigInt(x));
    const { positions, threw } = replay(big, start, firingPositions, fire);
    expect(threw).toBeNull();
    const end = positions[positions.length - 1]!;
    intEq(end, data.numbers_end);
    for (let k = 0; k < end.length; k++) expect(Big.show(end[k]!)).toBe(data.numbers_end[k]);
    expect(Big.show(BigInt(data.numbers_end[1]!))).toBe(data.numbers_end[1]);
  });
});

describe('SafeInt throws at move 38', () => {
  it('the mutation replay throws EngineOverflow during move 38, no later than the golden 39', () => {
    const bigRun = replay(big, data.population_start.map((x) => BigInt(x)), mutationPositions, mutate);
    const safeRun = replay(safe, [...data.population_start], mutationPositions, mutate);
    expect(safeRun.threw).not.toBeNull();
    expect(safeRun.threw!.error).toBeInstanceOf(EngineOverflow);
    expect(safeRun.threw!.error).toBeInstanceOf(EngineError);
    expect(safeRun.threw!.move).toBe(OVERFLOW_MOVE);
    expect(safeRun.threw!.move).toBeLessThanOrEqual(data.first_move_after_which_an_entry_exceeds_2_to_53);
    expect(data.first_move_after_which_an_entry_exceeds_2_to_53).toBe(39);
    // moves 1 to 37 succeed and give the same entries as the Big replay
    expect(safeRun.positions.length).toBe(OVERFLOW_MOVE - 1);
    for (let k = 0; k < safeRun.positions.length; k++) {
      expect(safeRun.positions[k]!.map(SafeInt.show)).toEqual(bigRun.positions[k]!.map(Big.show));
    }
    // the entries after 37 moves are below 2^53 and the next product is not
    const last = safeRun.positions[OVERFLOW_MOVE - 2]!;
    expect(last.every((x) => Number.isSafeInteger(x))).toBe(true);
    expect(Number.isSafeInteger(3 * Math.max(...last.map(Math.abs)))).toBe(false);
  });

  it('the firing replay throws EngineOverflow during move 38 as well', () => {
    const bigRun = replay(big, data.numbers_start.map((x) => BigInt(x)), firingPositions, fire);
    const safeRun = replay(safe, [...data.numbers_start], firingPositions, fire);
    expect(safeRun.threw).not.toBeNull();
    expect(safeRun.threw!.error).toBeInstanceOf(EngineOverflow);
    expect(safeRun.threw!.move).toBe(OVERFLOW_MOVE);
    expect(safeRun.threw!.move).toBeLessThanOrEqual(data.first_move_after_which_an_entry_exceeds_2_to_53);
    for (let k = 0; k < safeRun.positions.length; k++) {
      expect(safeRun.positions[k]!.map(SafeInt.show)).toEqual(bigRun.positions[k]!.map(Big.show));
    }
    expect(firingPositions[OVERFLOW_MOVE - 1]).toBe(1);
  });
});

describe('SafeInt arithmetic checks', () => {
  it('throws EngineOverflow on unsafe sums, products and conversions', () => {
    expect(() => SafeInt.add(9007199254740991, 1)).toThrow(EngineOverflow);
    expect(() => SafeInt.sub(-9007199254740991, 1)).toThrow(EngineOverflow);
    expect(() => SafeInt.mul(2 ** 27, 2 ** 27)).toThrow(EngineOverflow);
    expect(() => SafeInt.fromInt(2 ** 53)).toThrow(EngineOverflow);
    expect(() => SafeInt.fromInt(0.5)).toThrow(EngineOverflow);
    expect(() => SafeInt.fromInt(Number.NaN)).toThrow(EngineOverflow);
    expect(() => SafeInt.fromInt(Number.POSITIVE_INFINITY)).toThrow(EngineOverflow);
    expect(SafeInt.add(9007199254740990, 1)).toBe(9007199254740991);
    expect(SafeInt.mul(2 ** 26, 2 ** 26)).toBe(2 ** 52);
  });

  it('normalises -0 and signs exactly', () => {
    expect(SafeInt.show(SafeInt.mul(-1, 0))).toBe('0');
    expect(SafeInt.sign(SafeInt.mul(-1, 0))).toBe(0);
    expect(Object.is(SafeInt.mul(-1, 0), 0)).toBe(true);
    expect(Object.is(SafeInt.neg(0), 0)).toBe(true);
    expect(Object.is(SafeInt.fromInt(-0), 0)).toBe(true);
    expect(SafeInt.sign(-0)).toBe(0);
    expect(SafeInt.sign(-5)).toBe(-1);
    expect(SafeInt.sign(5)).toBe(1);
    expect(SafeInt.eq(SafeInt.mul(-1, 0), 0)).toBe(true);
  });

  it('show, toBig, zero, one, neg, sub, eq', () => {
    expect(SafeInt.toBig(-3)).toBe(-3n);
    expect(SafeInt.show(-12)).toBe('-12');
    expect(SafeInt.zero).toBe(0);
    expect(SafeInt.one).toBe(1);
    expect(SafeInt.neg(7)).toBe(-7);
    expect(SafeInt.sub(3, 5)).toBe(-2);
    expect(SafeInt.eq(2, 2)).toBe(true);
    expect(SafeInt.eq(2, 3)).toBe(false);
    expect(SafeInt.fromInt(-4)).toBe(-4);
  });

  it('Big behaves', () => {
    expect(Big.sign(-2n)).toBe(-1);
    expect(Big.sign(0n)).toBe(0);
    expect(Big.sign(9n)).toBe(1);
    expect(Big.eq(3n, 3n)).toBe(true);
    expect(Big.eq(3n, -3n)).toBe(false);
    expect(Big.fromInt(7)).toBe(7n);
    expect(Big.zero).toBe(0n);
    expect(Big.one).toBe(1n);
    expect(Big.add(2n ** 60n, 1n)).toBe(2n ** 60n + 1n);
    expect(Big.mul(-3n, 4n)).toBe(-12n);
    expect(Big.neg(-5n)).toBe(5n);
    expect(Big.sub(1n, 2n)).toBe(-1n);
    expect(Big.toBig(8n)).toBe(8n);
    expect(Big.show(-(2n ** 70n))).toBe('-1180591620717411303424');
  });
});
