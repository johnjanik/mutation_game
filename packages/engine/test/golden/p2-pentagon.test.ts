// The golden key `pentagon_example` without complete_games, which is phase 3 (SPEC.md 5.7, 2.12, A.6;
// P2-A1 instruction 5.16): boardFromName('pentagon'), the start as the negation of the Olympiad's,
// level, and playFate under the lowest-node rule: word (converted with wordLabels, rule 2), fired, end,
// moves. The random orders of verify.py lines 586 to 589 are replayed with seeded choices.
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import { boardFromName, cartanNumbers } from '../../src/board';
import { level, marks, comarks } from '../../src/affine';
import { identifyAffine } from '../../src/classify';
import { playFate } from '../../src/play';
import { covers, golden, intEq, wordLabels } from './_harness';
import { seededChoose } from '../helpers/p1';

covers('pentagon_example');

interface PentagonRecord {
  cartan: number[][];
  start_olympiad_convention: number[];
  start: number[];
  level: number;
  word_lowest_node_rule: number[];
  fired: number[];
  end: number[];
  moves: number;
}
const rec = golden.pentagon_example as PentagonRecord;

describe('pentagon example', () => {
  it('boardFromName("pentagon") is the 5-cycle, affine A4~ with all marks and comarks 1', () => {
    const b = boardFromName('pentagon');
    intEq(cartanNumbers(b), rec.cartan, 'cartan');
    expect(b.arith).toBe(Big);
    expect([...b.labels]).toEqual([1, 2, 3, 4, 5]);
    expect(b.name).toBe('pentagon');
    expect(identifyAffine(b)).toBe('A4~');
    intEq(marks(b), [1, 1, 1, 1, 1], 'marks');
    intEq(comarks(b), [1, 1, 1, 1, 1], 'comarks');
  });

  it('the start is the negation of the Olympiad start and has the golden level', () => {
    const b = boardFromName('pentagon');
    intEq(rec.start, rec.start_olympiad_convention.map((x) => -x), 'start');
    const start = rec.start.map((x) => BigInt(x));
    intEq(level(b, start), rec.level, 'level');
  });

  it('playFate under the lowest-node rule: word, fired, end, moves', () => {
    const b = boardFromName('pentagon');
    const start = rec.start.map((x) => BigInt(x));
    const r = playFate(b, start);
    expect(r.status).toBe('ended');
    intEq(wordLabels(b, r.word), rec.word_lowest_node_rule, 'word_lowest_node_rule');
    intEq(r.fired, rec.fired, 'fired');
    intEq(r.position, rec.end, 'end');
    intEq(r.moves, rec.moves, 'moves');
    expect(r).not.toHaveProperty('firstVisit');
  });

  it('every other order of play takes 14 moves, fires the same numbers and reaches the same end', () => {
    const b = boardFromName('pentagon');
    const start = rec.start.map((x) => BigInt(x));
    const sortedFired = [...rec.fired].sort((x, y) => x - y);
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
      const r = playFate(b, start, seededChoose(seed));
      expect(r.status).toBe('ended');
      intEq(r.moves, rec.moves, `moves with seed ${seed}`);
      intEq(r.position, rec.end, `end with seed ${seed}`);
      intEq([...r.fired].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)), sortedFired, `fired with seed ${seed}`);
    }
  });
});
