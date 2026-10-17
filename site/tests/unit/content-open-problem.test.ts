// The open-problem page (site/src/content/pages/open-problem.mdx), read as source. Adopted from the
// RT-08 reproducers of red-team round 1 for the part of each finding that lies on this page; the
// parts of the same findings that lie in lesson files are checked beside those lessons.
//
// RT-08 (content rules), attack 16: "verified by computation" with a range wider than the check.
// SPEC.md 0.3, [V]: "checked by reference/verify.py ... the range of boards checked is stated with the
// claim or is "every type of rank at most 8"". The check behind the sign statement is run on the
// named types of rank at most 8 (SPEC 2.11: "Checked by the script for every finite type ..."; the
// finite types of the script: rank at most 8).
//
// RT-08 (content rules), attack 3 (c): the fallbacks that a release build (RELEASE=1 npm run build) prints
// in place of an open item must read as prose where they stand. On /open-problem/, E4: the fallback
// ended "the site has also checked it by computation." and the next paragraph begins "The site has
// also checked the statement by computation:", so the release page said the same thing twice in a row.
// SPEC.md 7.3: "A fallback is a weaker sentence that stays true however the item turns out"; the release
// build "renders the fallback text in its place".
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CONTENT = fileURLToPath(new URL('../../src/content/', import.meta.url));
const files = ['modules', 'pages'].flatMap((d) => readdirSync(CONTENT + d).filter((f) => f.endsWith('.mdx')).map((f) => `${d}/${f}`));
const fallbacks = files.flatMap((f) =>
  [...readFileSync(CONTENT + f, 'utf8').matchAll(/<Unverified item="(E\d+)" fallback="([^"]*)"/g)].map((m) => ({ file: f, item: m[1], text: m[2] })),
);

describe('open-problem page', () => {
  // regression: P3-RT-08-01
  it('open-problem: the computed check is not stated for every board of finite type', () => {
    const op = readFileSync(fileURLToPath(new URL('../../src/content/pages/open-problem.mdx', import.meta.url)), 'utf8');
    // SPEC 2.11: "Checked by the script for every finite type, for the first 2500 or so root populations of
    // every untwisted affine board of rank at most 8 ..." (the finite types of the script: rank at most 8).
    expect(op, 'open-problem.mdx').not.toMatch(/checked the statement by computation: on every board of finite type;/);
  });

  // regression: P3-RT-08-09
  it('the E4 fallback of the open-problem page is not repeated by the sentence that follows it', () => {
    const src = readFileSync(CONTENT + 'pages/open-problem.mdx', 'utf8');
    const fb = fallbacks.find((f) => f.file === 'pages/open-problem.mdx' && /also checked it by computation/.test(f.text));
    const after = src.slice(src.indexOf('</Unverified>')).split('\n').find((l) => l.trim() !== '' && !l.startsWith('</Unverified>')) ?? '';
    // Observed at 69546f0: fallback "... the site has also checked it by computation." followed by
    // "The site has also checked the statement by computation: on every board of finite type; ..."
    expect(Boolean(fb) && /^The site has also checked the statement by computation/.test(after)).toBe(false);
  });
});
