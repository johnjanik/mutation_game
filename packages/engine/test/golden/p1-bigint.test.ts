// bigint_test (SPEC.md E-2, 5.7 phase 1; P1-A1 instruction 5.10): 200 alternating moves of each game on the
// board with three roads each way, replayed with applyWord on a Big board and compared by decimal text
// (rule 1); the first move after which an entry exceeds 2^53; and EngineOverflow passing unchanged through
// applyWord on a SafeInt copy (E-10; the move itself is pinned by P0-A2's unit/overflow.test.ts).
import { describe, expect, it } from 'vitest';
import { EngineOverflow, SafeInt } from '../../src/arith';
import type { Board } from '../../src/board';
import { toPositions } from '../../src/board';
import { applyWord, mutate } from '../../src/moves';
import { bigBoard } from '../helpers/p1';
import { covers, golden, intEq } from './_harness';

covers('bigint_test');

const rec = golden.bigint_test;
const big = (v: readonly number[]): bigint[] => v.map((x) => BigInt(x));

function safeCopy(b: Board<bigint>): Board<number> {
  return {
    n: b.n,
    cartan: b.cartan.map((row) => row.map((x) => Number(x))),
    labels: b.labels,
    kind: b.kind,
    arith: SafeInt,
  };
}

describe('bigint_test', () => {
  it('mutation replay', () => {
    const b = bigBoard(rec.cartan);
    const word = toPositions(b, rec.mutation_nodes);
    expect(word.length).toBe(200);
    const end = applyWord(b, big(rec.population_start), word, 'mutation');
    intEq(end, rec.population_end, 'population_end');
    expect(end.some((x) => (x < 0n ? -x : x) > 2n ** 53n)).toBe(true);
  });

  it('firing replay', () => {
    expect(rec.firing_mode).toBe('free play');
    const b = bigBoard(rec.cartan);
    const word = toPositions(b, rec.firing_nodes);
    expect(word.length).toBe(200);
    const end = applyWord(b, big(rec.numbers_start), word, 'firing');
    intEq(end, rec.numbers_end, 'numbers_end');
    expect(end.some((x) => x < 0n)).toBe(true);
  });

  it('first move beyond 2^53', () => {
    const b = bigBoard(rec.cartan);
    const word = toPositions(b, rec.mutation_nodes);
    let p: bigint[] = big(rec.population_start);
    let first: number | null = null;
    for (let k = 0; k < word.length && first === null; k++) {
      p = mutate(b, p, word[k]!);
      if (p.some((x) => (x < 0n ? -x : x) > 2n ** 53n)) first = k + 1;
    }
    intEq(first, rec.first_move_after_which_an_entry_exceeds_2_to_53, 'first move beyond 2^53');
  });

  it('EngineOverflow passes unchanged through applyWord on a SafeInt copy', () => {
    const b = bigBoard(rec.cartan);
    const s = safeCopy(b);
    const word = toPositions(s, rec.mutation_nodes);
    expect(() => applyWord(s, [...rec.population_start], word, 'mutation')).toThrow(EngineOverflow);
    expect(() => applyWord(s, [...rec.numbers_start], toPositions(s, rec.firing_nodes), 'firing')).toThrow(
      EngineOverflow,
    );
  });
});
