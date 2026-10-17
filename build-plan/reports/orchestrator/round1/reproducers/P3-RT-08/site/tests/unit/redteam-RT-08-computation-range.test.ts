// RT-08 (content rules), attack 16: "verified by computation" with a range wider than the check.
// SPEC.md 0.3, [V]: "checked by reference/verify.py ... the range of boards checked is stated with the
// claim or is "every type of rank at most 8"". The check behind Kostant's game and its affine recipe is
// the golden key `kostant` (the 32 named types, rank at most 8; SPEC 2.12 "[V for every type and every
// starting city; golden key kostant]"). M1 and M3 say the facts are "verified by computation for every
// board of finite type and every starting city", which claims a computation on every board of finite
// type (A_n for every n, and so on): no script checked that.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveGoldenPath } from '../../src/lib/golden';

const read = (f: string) => readFileSync(fileURLToPath(new URL(`../../src/content/modules/${f}`, import.meta.url)), 'utf8');
// "verified by computation" followed, before the end of the phrase, by "every board" or "every such board"
// with no rank, group-size or named-board limit.
const OVERCLAIM = /verified by computation (for|on) every (such )?board(?! of finite type of rank)(?! whose group)(?! of rank)(?! the site offers)[^.;'`]*/g;

describe('RT-08: the range of "verified by computation"', () => {
  it('the kostant check covers the named types of rank at most 8 only', () => {
    const kostant = resolveGoldenPath('kostant') as Record<string, unknown>;
    const types = Object.keys(kostant);
    expect(types.length).toBe(32);
    expect(types).not.toContain('A9');
  });
  for (const file of ['m1-mutation.mdx', 'm3-classification.mdx']) {
    it(`${file}: no "verified by computation" over every board of finite type`, () => {
      const hits = [...read(file).matchAll(OVERCLAIM)].map((m) => m[0]);
      // Observed at 69546f0: m1 "verified by computation for every board of finite type and every starting
      // city" (SEEN_STARTS, Seen box) and "verified by computation for every such board and every starting
      // city" (beat 3); m3 the same phrase (SEEN_KOSTANT, Seen box) and beat 5 "from every board of finite
      // type and every starting city, as verified by computation".
      expect(hits, `${file} claims a computation on every board`).toEqual([]);
    });
  }
  it('m3-classification.mdx beat 5: the recipe sentence does not claim every board of finite type', () => {
    expect(read('m3-classification.mdx')).not.toMatch(/from every board of finite type and every starting city, as verified by computation/);
  });
  it('open-problem and the E4 fallback of M3: the computed check is not stated for every board of finite type', () => {
    const op = readFileSync(fileURLToPath(new URL('../../src/content/pages/open-problem.mdx', import.meta.url)), 'utf8');
    // SPEC 2.11: "Checked by the script for every finite type, for the first 2500 or so root populations of
    // every untwisted affine board of rank at most 8 ..." (the finite types of the script: rank at most 8).
    expect(op, 'open-problem.mdx').not.toMatch(/checked the statement by computation: on every board of finite type;/);
    expect(read('m3-classification.mdx'), 'm3 E4 fallback').not.toMatch(/that the script checking this site has tried, no root population mixes Martians and anti-Martians: every board of finite type,/);
  });
});
