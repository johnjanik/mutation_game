// allCompleteGames beyond the golden keys (plan; SPEC.md 5.4, 5.5, 2.7 F12, E-6, E-10; P3-A2 instruction
// 5.5 and 5.8): the depth-first order with nodes in increasing position (lexicographic order of words,
// play's word first), the cap (exactly cap items, truncated true, never thrown), the 20000-move bound on
// a board where the plays do not end, and the one-way board. No golden key is registered here.
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import { CAPS } from '../../src/caps';
import { boardFromName } from '../../src/board';
import type { Board } from '../../src/board';
import { allCompleteGames } from '../../src/heaps';
import { play } from '../../src/play';
import { boardOf } from './_harness';
import { ones } from '../helpers/p1';
import { ONE_WAY, boardFromCartan } from '../helpers/p2';

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let k = 0; k < Math.min(a.length, b.length); k++) {
    if (a[k] !== b[k]) return a[k]! < b[k]!;
  }
  return a.length < b.length;
}

describe('allCompleteGames', () => {
  it('order', () => {
    for (const T of ['A3', 'B3', 'D4']) {
      const b = boardOf(T);
      const all = allCompleteGames(b, ones(b), CAPS.legalLayersDefault);
      expect(all.truncated).toBe(false);
      expect(all.items.length).toBeGreaterThan(1);
      expect(all.items[0]).toEqual(play(b, ones(b)).word);
      for (let k = 1; k < all.items.length; k++) {
        expect(lexLess(all.items[k - 1]!, all.items[k]!)).toBe(true);
      }
      // every item is a legal complete play of the same length (F4)
      const N = play(b, ones(b)).word.length;
      for (const w of all.items) expect(w.length).toBe(N);
    }
  });

  it('cap on A5', () => {
    const b = boardOf('A5');
    const cut = allCompleteGames(b, ones(b), 100000);
    expect(cut.truncated).toBe(true);
    expect(cut.items.length).toBe(100000);
    expect(cut.items[0]).toEqual(play(b, ones(b)).word);
    for (const w of cut.items) expect(w.length).toBe(15);
  });

  it('cap at, below and above the number of games', () => {
    const b = boardOf('A3');
    const full = allCompleteGames(b, ones(b), CAPS.legalLayersDefault);
    const count = full.items.length;
    const exact = allCompleteGames(b, ones(b), count);
    expect(exact.truncated).toBe(false);
    expect(exact.items).toEqual(full.items);
    const short = allCompleteGames(b, ones(b), count - 1);
    expect(short.truncated).toBe(true);
    expect(short.items.length).toBe(count - 1);
    expect(short.items).toEqual(full.items.slice(0, count - 1));
    const none = allCompleteGames(b, ones(b), 0);
    expect(none.truncated).toBe(true);
    expect(none.items).toEqual([]);
    const ended = allCompleteGames(b, [-1, 0, -2], 0);
    expect(ended.truncated).toBe(true);
    const endedOne = allCompleteGames(b, [-1, 0, -2], 1);
    expect(endedOne).toEqual({ items: [[]], truncated: false });
  });

  it('plays that do not end', () => {
    const any = boardFromName('A2~');
    expect(any.arith).toBe(Big);
    const b = any as Board<bigint>;
    const start = ones(b);
    const t0 = performance.now();
    const r = allCompleteGames(b, start, CAPS.legalLayersDefault);
    const elapsed = performance.now() - t0;
    expect(r.truncated).toBe(true);
    expect(r.items).toEqual([]);
    expect(elapsed).toBeLessThan(60000);
    expect(play(b, start, undefined, CAPS.playMoves).status).toBe('cap');
  });

  it('one-way board', () => {
    const b = boardFromCartan(ONE_WAY);
    expect(allCompleteGames(b, [1n, 0n], 10)).toEqual({ items: [[0, 1]], truncated: false });
    // from (1, 1) the two orders give two games with different ends (no F3 on a one-way board)
    expect(allCompleteGames(b, [1n, 1n], 10)).toEqual({ items: [[0, 1], [1, 0]], truncated: false });
  });

  it('argument errors are RangeError', () => {
    const b = boardOf('A2');
    expect(() => allCompleteGames(b, [1], 10)).toThrow(RangeError);
    expect(() => allCompleteGames(b, [1, 1], -1)).toThrow(RangeError);
    expect(() => allCompleteGames(b, [1, 1], 1.5)).toThrow(RangeError);
  });
});
