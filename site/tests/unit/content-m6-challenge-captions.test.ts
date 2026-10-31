// Lesson M6: the captions of the challenge tools b11 and b13 state the point of their tool.
// Adopted from redteam/redteam-RT-08-p4-captions.mjs (lens RT-08, phase 4 round, attack 21, second part,
// sibling of P3-RT-08-08), a script that printed the captions of b11, b13, b12 and b14 for a reader. SPEC 8.1 P1:
// "Each tool has a meaningful starting state and a caption that states its point"; CONTRACTS 7: "Every tool has
// a `caption` prop stating the result it demonstrates (P1)". The round 1 resolution for challenge tools
// (DECISIONS.md, RT-FIX-P3-lesson-m5, "captions that state a result without the answer"): the caption states
// the point of its tool and leaves the answer of the challenge on the same tool unsaid. This test reads the
// captions as the script did and asserts that each differs from the caption found, states a result, and does
// not give the answer.
// Run: npx vitest run --project site-unit site/tests/unit/content-m6-challenge-captions.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(fileURLToPath(new URL('../../src/content/modules/m6-multiple-edges.mdx', import.meta.url)), 'utf8');

/** The caption property of a tool instance, as the script read it (the text after caption= up to the closing tag). */
function caption(id: string): string {
  const lines = src.split('\n');
  const line = lines.findIndex((l) => new RegExp(`<T\\d\\d[A-Za-z]+ [^\\n]*id="${id}"`).test(l));
  expect(line, `the tool ${id}`).toBeGreaterThanOrEqual(0);
  return (lines[line]!.match(/caption=(.*?)\s*\/>\s*$/) ?? [])[1] ?? '';
}

describe('M6: the captions of the challenge tools', () => {
  // regression: P4-RT-08-05
  it('the two M6 challenge tools b11 and b13 have captions that state a result, not only a setting and an instruction', () => {
    const OBSERVED: Record<string, string> = {
      b11: '"One Martian in city 2 of G2, the long city; the challenge above names the population to reach."',
      b13: '"The builder on G2, with every weight 1, its meter reading the G2 board of the first challenge: set the weights and press Test."',
    };
    // The result each caption states.
    const RESULT: Record<string, RegExp[]> = {
      b11: [/every population it reaches is a long root population/, /form value \$\{G2_LENGTHS\[1\]\}/],
      b13: [/passes on A2 and fails here/, /the city weights must differ/, /meter reads the G2 board of the first challenge/],
    };
    // The answer of each challenge stays unsaid: the moves to the highest root of G2 (b11); the weights the
    // builder accepts, their ratio or the golden weights (b13).
    const ANSWER: Record<string, RegExp> = {
      b11: /\bmutate\b|highest_root|positive_roots|then city/i,
      b13: /symmetrizer|long_to_short_ratio|G2_LENGTHS|G2D|\bthree times\b|\bratio\b|\b[1-9], [1-9] and [1-9]\b/,
    };
    for (const id of ['b11', 'b13']) {
      const cap = caption(id);
      expect(cap, `${id} caption`).not.toBe(OBSERVED[id]);
      for (const re of RESULT[id]!) expect(cap, `${id} caption states its result`).toMatch(re);
      expect(cap, `${id} caption leaves the answer unsaid`).not.toMatch(ANSWER[id]!);
    }
  });
});
