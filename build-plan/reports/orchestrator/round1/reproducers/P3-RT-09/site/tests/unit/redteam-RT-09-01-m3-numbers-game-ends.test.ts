// RT-09 finding P3-RT-09-01 (attack 1 and 22): M3 beat 7 quotes [DE08] Theorem 2.1 without its hypothesis.
// The page says: "a connected board has a numbers game that ends, from a suitable start, exactly when it is
// of finite type". SOURCES.md (entry [DE08]) records the theorem as "a connected integer-weighted graph has a
// terminating game from some NONZERO DOMINANT start exactly when it is a Dynkin diagram of finite type".
// Without "nonzero dominant" the sentence is false, and the site's own M4 shows it: the pentagon, an affine
// board, has a numbers game that ends (beat 6, 14 moves from (1, -2, 3, -4, 1)).
// oracle: classify(board_from_name('A4~')[0]) -> affine; play_fate(..., (1,-2,3,-4,1)) -> ended after 14 moves
// oracle: play(board_from_name('A2~')[0], (-1,-1,-1)) -> ended after 0 moves (any start with no positive number)
// Run: npm test -- --project site-unit site/tests/unit/redteam-RT-09-01-m3-numbers-game-ends.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, classify, play } from '@engine';
import type { Board } from '@engine';

const M3 = fileURLToPath(new URL('../../src/content/modules/m3-classification.mdx', import.meta.url));
const SENTENCE = 'a connected board has a numbers game that ends, from a suitable start, exactly when it is of finite type';

describe('P3-RT-09-01: M3 beat 7, the numbers-game characterisation of finite type', () => {
  it('the sentence is on the page as quoted', () => {
    expect(readFileSync(M3, 'utf8')).toContain(SENTENCE);
  });

  it('the pentagon is connected and affine, yet its numbers game from the example start of M4 ends', () => {
    const pentagon = boardFromName('pentagon') as Board<unknown>;
    const record = classify(pentagon);
    expect(record.length, 'the pentagon is one connected component').toBe(1);
    expect(record[0]!.class).toBe('affine');
    const start = [1, -2, 3, -4, 1].map((x) => pentagon.arith.fromInt(x));
    const r = play(pentagon, start);
    // As printed, the sentence says: a board that is not of finite type has no numbers game that ends.
    expect(
      r.status,
      `"${SENTENCE}" (M3 beat 7) is false as printed: the affine pentagon's game from (1, -2, 3, -4, 1) ${r.status} after ${r.moves} moves (M4 beat 6 says so too). [DE08] Theorem 2.1 needs a nonzero dominant start (SOURCES.md, [DE08]).`,
    ).not.toBe('ended');
  });
});
