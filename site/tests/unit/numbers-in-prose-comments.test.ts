// scripts/numbers-in-prose.mjs (SPEC.md 7.7, Content row: "lists every number in lesson prose that is
// not written with <G>, for a person to review"), adopted from the red team (RT-10 attack 2). The scanner
// took the apostrophe of an MDX comment ({/* ... the site's own words ... */} on line 26 of
// m0-start.mdx) for the start of a string, so everything after it was hidden from the report.
// Run: npx vitest run --project site-unit site/tests/unit/numbers-in-prose-comments.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { lessonFiles, scanSource } from '../../../scripts/numbers-in-prose.mjs';

const PROBE = 'The answer is 4321.';
const prose = (text: string) => scanSource(text, 'x.mdx').filter((f) => f.kind === 'prose').map((f) => [f.line, f.number]);

describe('numbers-in-prose.mjs and comments inside brace expressions', () => {
  // regression: P3-RT-10-04
  it('a typed number appended to the prose of every lesson is reported', () => {
    const files = lessonFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const found = scanSource(`${text}\n\n${PROBE}\n`, basename(file)).filter((f) => f.number === '4321');
      expect(found, `${basename(file)}: probe at the end`).toHaveLength(1);
    }
  });

  // regression: P3-RT-10-04
  it('an apostrophe inside an MDX comment opens no string', () => {
    const block = ["{/* drafted in the site's own words */}", '', 'The board has 3 nodes.'].join('\n');
    expect(prose(block)).toEqual([[3, '3']]);
    const line = ["{// the site's own words", '}', '', 'The board has 3 nodes.'].join('\n');
    expect(prose(line)).toEqual([[4, '3']]);
    // The comment itself stays out of the report, and a quote inside a string is still a string.
    expect(prose("{/* it's 7 */}\n\nNo digit.")).toEqual([]);
    expect(prose("{'/* 5 */'}\n\nThe board has 3 nodes.")).toEqual([[3, '3']]);
  });

  // regression: P3-RT-10-04
  it('an apostrophe inside a comment in a prop expression opens no string', () => {
    const text = ["<Board start={/* the site's start */ [1, 0, 2]} />", '', 'The board has 3 nodes.'].join('\n');
    expect(prose(text)).toEqual([[3, '3']]);
  });
});
