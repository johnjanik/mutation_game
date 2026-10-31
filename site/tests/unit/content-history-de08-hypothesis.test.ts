// The theorem of Donnelly and Eriksson [DE08] on /history/ (site/src/content/pages/history.mdx, read as source),
// held against the engine. Adopted from the RT-09 reproducer of the phase 6 round (attack 1: a fact of bidirected
// boards stated for every board), its describe block for P6-RT-09-02; the other blocks of that reproducer are
// findings on the glossary and on M10, which are not this file's.
//
// The entry of 2008 said: "Donnelly and Eriksson use the game to prove that a connected graph with whole-number road
// counts is a Dynkin diagram of finite type exactly when some start that has no negative number and is not all zeros
// gives a game that ends." SOURCES.md [DE08] (Theorem 2.1, "a connected integer-weighted graph") and M3 beat 7 state
// it for boards whose roads run both ways, and SPEC 2.1 says that none of the theory applies to a one-way board. On
// the one-way board (one road from 1 to 2, none back), which is connected, has whole-number road counts and is not of
// finite type, the game from (1,0) ends after 2 moves.
//
// Adoption: the reproducer asserted that the sentence, word for word, is on the page, and then that the
// counterexample is absent, which no rewording of the sentence could satisfy. The sentence is found here by its
// opening words, which survive a rewording of its hypothesis; the counterexample is asserted to stand on the engine,
// as the reproducer asserts it; and the reproducer's last assertion is kept for as long as the sentence covers the
// one-way board (no "roads ... both ways" in it). This is the form of content-m7-finite-type.test.ts (RT-FIX-P4).
// Run: npx vitest run --project site-unit site/tests/unit/content-history-de08-hypothesis.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classify, fromAdjacency, play } from '@engine';

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const HISTORY = read('../../src/content/pages/history.mdx');

const n = (v: readonly unknown[]): number[] => v.map((x) => Number(x));

/** The opening words of the sentence that states the theorem of [DE08]. */
const STEM = 'Donnelly and Eriksson use the game to prove that';
/** The hypothesis of [DE08] Theorem 2.1 in the site's words (M3 beat 7: "a connected board with roads both ways"). */
const BOTH_WAYS = /\broads\b[^.]*\bboth ways\b/;

/** The sentence of history.mdx that holds the stem, read within its line, with the tags of the source removed. */
function sentenceWith(stem: string): string {
  const line = HISTORY.split('\n').find((l) => l.includes(stem));
  expect(line, `the history page still states "${stem} ..."`).toBeDefined();
  const s = line!.split(/(?<=\.)\s+(?=[A-Z<])/).find((x) => x.includes(stem)) ?? '';
  return s.replace(/<[^>]+>/g, '');
}

describe('the history page states Donnelly and Eriksson\'s finite-type theorem without the hypothesis that roads run both ways', () => {
  // regression: P6-RT-09-02
  it('the one-way board is connected, not of finite type, and the game from (1,0) ends', () => {
    const sentence = sentenceWith(STEM);
    // oracle: play([[2,0],[-1,2]], [1,0]) -> end (-1,-1), word [1,2], fired [1,1]; classify -> kind 'one-way', class None
    const oneWay = fromAdjacency([
      [0, 1],
      [0, 0],
    ]);
    const kinds = classify(oneWay).map((r) => r.kind);
    expect(kinds).toEqual(['one-way']);
    const start = [1, 0].map((x) => oneWay.arith.fromInt(x));
    const game = play(oneWay as never, start as never);
    expect({ status: game.status, moves: game.moves, end: n(game.position as unknown[]) }).toEqual({ status: 'ended', moves: 2, end: [-1, -1] });
    const coversOneWay = !BOTH_WAYS.test(sentence);
    expect(
      coversOneWay && kinds.includes('one-way') && game.status === 'ended',
      `history (2008): "${sentence}". The one-way board (one road from 1 to 2, none back) is connected, has whole-number road counts and is not of finite type, yet the game from (1,0), no negative number and not all zeros, ends after 2 moves. [DE08] (SOURCES.md) and M3 beat 7 state the theorem for boards whose roads run both ways.`,
    ).toBe(false);
  });
});
