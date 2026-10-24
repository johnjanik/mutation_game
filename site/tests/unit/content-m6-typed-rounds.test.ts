// Lesson M6 reads its round and move counts from the golden file. Adopted from
// site/tests/unit/redteam-RT-08-p4-typed-rounds.test.ts (RT-08, content rules, phase 4 round, attack 12):
// golden numbers typed in M6 where the numbers-in-prose
// scanner does not look (inside <Tex src="...">, as words, in caption and prediction props).
// SPEC.md 7.3: "Every number in a lesson that has a golden value is written this way [<G>], so prose
// cannot drift from the data"; "<Tex> is the only way a golden value enters a formula"; 8.4 "Numbers that
// have a golden value are written with <G>, never typed"; CONTRACTS 7.
// The quantity: the number of rounds after which the pair of moves at two cities returns, a round being
// one mutation at each city. That round is the product of the two colour classes, a Coxeter element, and
// its order is the Coxeter number h: the golden fields types.A2/B2/G2.coxeter_number (3, 4, 6). M5 prints
// the same quantity ("rounds" of the wave) through fmt('types.A3.coxeter_number') and M7 through
// <G k="types.E8.coxeter_number"/> ("h being the number of rounds of the wave"); M6 types it. The number
// of moves is twice that (8 on B2, 12 on G2, each equal to types.<T>.weyl_order of the dihedral group).
// decisions/P4-A5.md ("typed numbers") lists "the round counts 3, 4, 6" among numbers with no golden value.
// Run: npx vitest run --project site-unit site/tests/unit/content-m6-typed-rounds.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyWord, boardFromName, toPositions } from '@two-games/engine';
import { resolveGoldenPath } from '../../src/lib/golden';

const m6 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m6-multiple-edges.mdx', import.meta.url)), 'utf8');

/** Rounds of the alternation 1, 2, 1, 2, ... after which the population p (labels) first returns. */
function roundsToReturn(name: string, start: number[]): number {
  const b = boardFromName(name) as never as { labels: number[]; n: number; arith: { fromInt(x: number): unknown; show(x: unknown): string } };
  const labels = [...b.labels].sort((x, y) => x - y);
  const pos = toPositions(b as never, labels);
  const v0 = new Array(b.n);
  pos.forEach((p: number, k: number) => { v0[p] = b.arith.fromInt(start[k]!); });
  for (let r = 1; r <= 12; r++) {
    const word = Array.from({ length: 2 * r }, (_, k) => labels[k % 2]!);
    const v = applyWord(b as never, v0 as never, toPositions(b as never, word), 'mutation') as unknown[];
    if (pos.every((p: number, k: number) => b.arith.show(v[p]) === String(start[k]))) return r;
  }
  return -1;
}

describe('M6: the round counts of beat 2 are golden values', () => {
  it('the rounds to return on A2, B2 and G2 are types.<T>.coxeter_number (engine and golden agree)', () => {
    expect(roundsToReturn('B2', [2, 1])).toBe(resolveGoldenPath('types.B2.coxeter_number'));
    expect(roundsToReturn('G2', [1, 2])).toBe(resolveGoldenPath('types.G2.coxeter_number'));
    expect(roundsToReturn('A2', [1, 0])).toBe(resolveGoldenPath('types.A2.coxeter_number'));
  });
  // regression: P4-RT-08-02
  it('M6 does not type the Coxeter numbers of A2, B2 and G2 (the round counts 3, 4, 6) or the move counts 8 and 12', () => {
    const typed = [
      '<Tex src="3"/>, <Tex src="4"/> or <Tex src="6"/> rounds', // beat 2 prose (line 88) and the Seen box (line 183)
      'when the round counter reads <Tex src="4"/>', // beat 2 prose (line 90)
      'after eight moves', // beat 2 prose (line 90): 2h on B2
      'the return takes twelve moves', // beat 2 prose (line 90): 2h on G2
      'After 8 moves, 4 rounds', // caption of b3 (line 92)
      'needs 12 moves, 6 rounds', // caption of b4 (line 93)
      'needs 6 rounds, 12 moves', // reveal of the b4 prediction (line 93)
    ].filter((s) => m6.includes(s));
    // Observed at b9b8504: all seven are in the source.
    expect(typed, 'M6 types the Coxeter numbers of A2, B2, G2 (and 2h) instead of reading the golden file').toEqual([]);
  });
  // regression: P4-RT-08-02 (sibling)
  it('the other round and move counts of beat 2 (the two scripts, the G2 prediction) are read from the golden file too', () => {
    // Same cause in the same figures, not in the reproducer's list: the question, the options and the reveal of
    // the b4 prediction ("after 4 rounds", the Coxeter number of B2), and the lengths of the two scripts and of
    // the play behind the reveal (8 and 12 moves, twice the Coxeter numbers of B2 and G2).
    const typed = [
      ...m6.matchAll(/\b(?:after|needs|takes) \d+ (?:rounds|moves)\b/gi),
      ...m6.matchAll(/\b(?:eight|twelve) moves\b/g),
      ...m6.matchAll(/\b(?:scriptOf|alternation)\(\d+\)/g),
    ].map((m) => m[0]);
    expect(typed, 'round and move counts typed in M6').toEqual([]);
    // The move counts are twice the golden Coxeter numbers, and the scripts are that long.
    expect(m6).toMatch(/^export const B2_MOVES = 2 \* gv\('types\.B2\.coxeter_number'\);$/m);
    expect(m6).toMatch(/^export const G2_MOVES = 2 \* gv\('types\.G2\.coxeter_number'\);$/m);
    expect(m6).toMatch(/^export const B2_SCRIPT = scriptOf\(B2_MOVES\);$/m);
    expect(m6).toMatch(/^export const G2_SCRIPT = scriptOf\(G2_MOVES\);$/m);
  });
});
