// The one-way road of SPEC.md 2.11 (5.7 phase 1; P1-A1 instruction 5.10): one_way_counterexample through
// mutate, applyWord and toPositions on a Big board, with the plan's additions from verify.py section 10
// (the root populations do not close up; legal play still ends, SPEC.md 5.6 first row).
import { describe, expect, it } from 'vitest';
import { toPositions } from '../../src/board';
import { applyWord, mutate } from '../../src/moves';
import { roots } from '../../src/search';
import { play } from '../../src/play';
import { bigBoard } from '../helpers/p1';
import { covers, golden, intEq } from './_harness';

covers('one_way_counterexample');

const rec = golden.one_way_counterexample;
const big = (v: readonly number[]): bigint[] => v.map((x) => BigInt(x));

describe('one_way_counterexample', () => {
  it('one-way road reaches a mixed population', () => {
    const b = bigBoard(rec.cartan);
    expect(b.kind).toBe('one-way');
    const moves = toPositions(b, rec.moves);
    expect(moves).toEqual([1, 0]);
    const start = big(rec.start);
    intEq(mutate(b, start, moves[0]!), [1, 1], 'after mutating city 2');
    const result = applyWord(b, start, moves, 'mutation');
    intEq(result, rec.result, 'the mixed population');
    expect(result.some((x) => x < 0n) && result.some((x) => x > 0n)).toBe(true);
  });

  it('the root populations of the one-way road do not close up', () => {
    const b = bigBoard(rec.cartan);
    const r = roots(b, 2000);
    expect(r.truncated).toBe(true);
    expect(r.items.length).toBe(2000);
  });

  it('legal play works as defined on the one-way road', () => {
    const b = bigBoard(rec.cartan);
    const r = play(b, [1n, 1n]);
    expect(r.status).toBe('ended');
    expect(r.moves).toBe(2);
    expect(r.position).toEqual([-1n, -2n]);
  });
});
