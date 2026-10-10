// The golden key `pentagon_example.complete_games` (SPEC.md 5.7, phase 3; A.6; verify.py lines 590 to
// 597; P3-A2 instruction 5.11): allCompleteGames on boardFromName('pentagon') from the stored `start`
// (this specification's convention, never start_olympiad_convention) finds 1230 games, each of 14 moves,
// each ending at `end` and firing the multiset `fired`; the first item is the lowest-node word.
// P2-A1 covers the rest of `pentagon_example` in p2-pentagon.test.ts; this file registers only this key.
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import { boardFromName, cartanNumbers } from '../../src/board';
import type { Board } from '../../src/board';
import { fire } from '../../src/moves';
import { allCompleteGames } from '../../src/heaps';
import { covers, golden, intEq, wordLabels } from './_harness';

covers('pentagon_example.complete_games');

interface PentagonRecord {
  cartan: number[][];
  start: number[];
  word_lowest_node_rule: number[];
  fired: number[];
  end: number[];
  moves: number;
  complete_games: number;
}
const rec = golden.pentagon_example as PentagonRecord;

describe('pentagon_example.complete_games', () => {
  it('1230 complete games from the stored start', () => {
    const any = boardFromName('pentagon');
    expect(any.arith).toBe(Big);
    const b = any as Board<bigint>;
    intEq(cartanNumbers(b), rec.cartan, 'cartan');
    const start = rec.start.map((x) => BigInt(x));
    const all = allCompleteGames(b, start, 100000);
    expect(all.truncated).toBe(false);
    intEq(all.items.length, rec.complete_games, 'complete_games');
    const sortedFired = [...rec.fired].sort((x, y) => x - y);
    for (const w of all.items) {
      intEq(w.length, rec.moves, 'moves');
      let a: bigint[] = start;
      const fired: bigint[] = [];
      for (const i of w) {
        fired.push(a[i]!);
        a = fire(b, a, i);
      }
      intEq(a, rec.end, 'end');
      intEq(fired.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)), sortedFired, 'fired multiset');
    }
    intEq(wordLabels(b, all.items[0]!), rec.word_lowest_node_rule, 'first item is the lowest-node word');
  });
});
