// RT-09 finding P3-RT-09-03 (attacks 1, 14 and 21): the Lie theory paragraphs of M1 and M3 state F13's
// facts of simply laced boards for every board.
//   M1: "Arranged by height, the positive roots form the root poset with the highest root \theta at the top,
//        and Kostant's game climbs it by adding one simple root at a time."
//   M3: "Kostant's game ends at the highest root \theta, and the new city carries \alpha_0=\delta-\theta,
//        giving the untwisted affine diagram \tilde X_n"
// SPEC 2.7 F13: "On a simply laced board every such move raises a city by exactly 1 ... On B, C, F, G the play
// ends at the highest root when i is a long node and at the highest short root when i is a short node."
// oracle: kostant_play(cartan('B',2), 0) -> ((1,2), [1]): one move, city 2 rises by 2 (2 alpha_2 added)
// oracle: kostant_play(cartan('B',3), 2) -> ((1,1,1), [0,1]); highest_root(cartan('B',3)) -> (1,2,2);
//         golden kostant.B3.affine_board_from_node[2] is D4^(2), a twisted board, not B3~
// Run: npx vitest run --project site-unit site/tests/unit/redteam-RT-09-03-lie-theory-kostant.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, highestRoot, kostantPlay } from '@engine';
import type { Board } from '@engine';

const read = (f: string): string => readFileSync(fileURLToPath(new URL(`../../src/content/modules/${f}`, import.meta.url)), 'utf8');
const M1 = read('m1-mutation.mdx');
const M3 = read('m3-classification.mdx');
const M1_SENTENCE = "Kostant's game climbs it by adding one simple root at a time";
const M3_SENTENCE = '<Term a="kostants-game">Kostant\'s game</Term> ends at the highest root <Tex src="\\theta"/>';

/** The Lie theory paragraph of a lesson (between <LieTheory> and </LieTheory>). */
function lieTheory(mdx: string): string {
  const m = /<LieTheory>([\s\S]*?)<\/LieTheory>/.exec(mdx);
  return m === null ? '' : m[1]!;
}

describe('P3-RT-09-03: Lie theory paragraphs state F13 for every board', () => {
  it('the two sentences are in the Lie theory paragraphs, with no restriction to simply laced boards', () => {
    expect(lieTheory(M1)).toContain(M1_SENTENCE);
    expect(lieTheory(M3)).toContain(M3_SENTENCE);
    expect(lieTheory(M1)).not.toMatch(/simply laced|single roads/);
    expect(lieTheory(M3)).not.toMatch(/simply laced|single roads/);
  });

  it('M1: on B2 a raising move of Kostant\'s game adds two copies of a simple root', () => {
    const B2 = boardFromName('B2') as Board<unknown>;
    const r = kostantPlay(B2, 0); // from one Martian in city 1
    const end = r.position.map((x) => Number(B2.arith.toBig(x)));
    expect(end).toEqual([1, 2]);
    expect(
      r.moves,
      `M1 Lie theory: "${M1_SENTENCE}". On B2 from city 1 the play reaches (1, 2) in ${r.moves} move: the one raising move adds 2 alpha_2 (SPEC 2.7 F13: exactly 1 only on simply laced boards).`,
    ).toBe(2);
  });

  it('M3: on B3 Kostant\'s game from city 3 ends at the highest short root, not at theta', () => {
    const B3 = boardFromName('B3') as Board<unknown>;
    const r = kostantPlay(B3, 2); // from one Martian in city 3, the short node
    const end = r.position.map((x) => Number(B3.arith.toBig(x)));
    const theta = highestRoot(B3).map((x) => Number(B3.arith.toBig(x)));
    expect(theta).toEqual([1, 2, 2]);
    expect(
      end,
      `M3 Lie theory: "Kostant's game ends at the highest root theta". On B3 from city 3 it ends at (${end.join(', ')}), the highest short root (SPEC 2.7 F13; golden kostant.B3.end_from_node[2]).`,
    ).toEqual(theta);
  });
});
