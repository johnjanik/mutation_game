// RT-09 finding P3-RT-09-02 (attack 1): M5 states two facts of section 2.7 ("Facts about play on a
// finite-type board") for every board.
//   Beat 7: "On a board with at least two nodes every firing of this wave is legal, and the game ends after
//   the same number of rounds whichever colour starts" (F8 holds on boards of finite type of rank >= 2).
//   Beat 5: "On any board the forms fired are the positive root populations of the reversed board" (F6),
//   repeated in the Seen box: "With letters, a complete game fires each positive root of the reversed board once."
// Counterexamples:
//   the square (the affine board A3~, two colour classes {1,3} and {2,4}): the wave from (1,1,1,1) never ends;
//   oracle: wave_play(board_from_name('A3~')[0], (1,1,1,1), 0, cap=500) -> OverflowError (still running);
//   the one-way road of SPEC 2.11 (C = [[2,0],[-1,2]]): the complete game from (1,1) is 1, 2 and fires the
//   forms x1 and x1 + x2 only; the reversed board's positive root populations include (0,1), (2,1), (3,1), ...
//   oracle: play([[2,0],[-1,2]], (1,1)) -> ((-1,-2), [0,1], [1,2]); symbolic_play(..., [0,1]) -> [(1,0),(1,1)];
//   roots(transpose([[2,0],[-1,2]]), max_depth=12) contains (0,1), (2,1), (3,1), ...
// Run: npm test -- --project site-unit site/tests/unit/redteam-RT-09-02-m5-finite-type-dropped.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, fire, fromAdjacency, play, symbolicPlay } from '@engine';
import type { Board } from '@engine';

const M5 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m5-weyl.mdx', import.meta.url)), 'utf8');
const WAVE = 'On a board with at least two nodes every firing of this <Term a="wave">wave</Term>';
const WAVE_TEXT = 'On a board with at least two nodes every firing of this **wave** is legal, and the game ends after the same number of rounds whichever colour starts';
const FORMS = 'On any board the forms fired are the positive root populations of the **reversed board**';

describe('P3-RT-09-02: M5 drops the finite-type hypothesis of F6 and F8', () => {
  it('both sentences are on the page as quoted', () => {
    expect(M5.includes(WAVE_TEXT) || M5.includes(WAVE)).toBe(true);
    expect(M5).toContain(FORMS);
  });

  it('F8 as printed: on the square (two colour classes, four nodes) the wave from all ones never ends', () => {
    const square = boardFromName('square') as Board<unknown>;
    const { arith } = square;
    // Colour classes of the 4-cycle by position: {0, 2} and {1, 3} (joined nodes differ).
    const classes = [[0, 2], [1, 3]];
    let a: unknown[] = [1, 1, 1, 1].map((x) => arith.fromInt(x));
    let rounds = 0;
    let illegal = 0;
    while (a.some((x) => arith.sign(x) > 0) && rounds < 1000) {
      for (const i of classes[rounds % 2]!) {
        if (arith.sign(a[i]) <= 0) illegal += 1;
        a = fire(square, a, i);
      }
      rounds += 1;
    }
    expect(illegal, 'every firing of the wave was legal here').toBe(0);
    expect(
      a.some((x) => arith.sign(x) > 0),
      `"${WAVE_TEXT}" (M5 beat 7) is false on the square: after ${rounds} rounds the wave still has a positive number. F8 is a fact about boards of finite type (SPEC 2.7).`,
    ).toBe(false);
  });

  it('F6 as printed: on the one-way road the forms fired miss positive root populations of the reversed board', () => {
    const oneWay = fromAdjacency([
      [0, 1],
      [0, 0],
    ]) as Board<unknown>; // one road from city 1 to city 2 (C = [[2,0],[-1,2]], SPEC 2.11)
    const g = play(oneWay, [1, 1].map((x) => oneWay.arith.fromInt(x)));
    expect(g.status).toBe('ended');
    expect(g.word).toEqual([0, 1]);
    const forms = symbolicPlay(oneWay, g.word).map((f) => f.join(','));
    expect(forms).toEqual(['1,0', '1,1']);
    // (0, 1), one Martian in city 2, is a simple root population of the reversed board, hence a positive one.
    expect(
      forms,
      `"${FORMS}" (M5 beat 5) is false on the one-way road: the complete game fires ${forms.join(' and ')} only, never the simple root (0,1) of the reversed board (whose positive root populations are infinitely many). F6 is a fact about boards of finite type (SPEC 2.7).`,
    ).toContain('0,1');
  });
});
