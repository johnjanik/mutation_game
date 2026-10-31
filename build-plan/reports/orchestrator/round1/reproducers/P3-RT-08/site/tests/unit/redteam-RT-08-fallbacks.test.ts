// RT-08 (content rules), attack 3 (c): the fallbacks that a release build (RELEASE=1 npm run build) prints
// in place of an open item must read as prose where they stand. Unverified.astro prints `fallback` as
// plain text: nothing typesets it, so TeX notation in a fallback reaches the reader raw.
// (1) M5, E16: the fallback says "each count on A_n equals ..." (preview: the sentence beside it typesets
//     $A_n$ and $B_n$; release: the reader sees "A_n" with an underscore).
// (2) /open-problem/, E4: the fallback ends "the site has also checked it by computation." and the next
//     paragraph begins "The site has also checked the statement by computation:", so the release page
//     says the same thing twice in a row.
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

describe('RT-08: release-build fallbacks read as prose in place', () => {
  it('no fallback carries TeX notation that a release build prints raw', () => {
    const raw = fallbacks.filter((f) => /[_^\\$]/.test(f.text)).map((f) => `${f.file} ${f.item}: ${f.text}`);
    // Observed at 69546f0: modules/m5-weyl.mdx E16 "... each count on A_n equals ...".
    expect(raw).toEqual([]);
  });
  it('the E4 fallback of the open-problem page is not repeated by the sentence that follows it', () => {
    const src = readFileSync(CONTENT + 'pages/open-problem.mdx', 'utf8');
    const fb = fallbacks.find((f) => f.file === 'pages/open-problem.mdx' && /also checked it by computation/.test(f.text));
    const after = src.slice(src.indexOf('</Unverified>')).split('\n').find((l) => l.trim() !== '' && !l.startsWith('</Unverified>')) ?? '';
    // Observed at 69546f0: fallback "... the site has also checked it by computation." followed by
    // "The site has also checked the statement by computation: on every board of finite type; ..."
    expect(Boolean(fb) && /^The site has also checked the statement by computation/.test(after)).toBe(false);
  });
});
