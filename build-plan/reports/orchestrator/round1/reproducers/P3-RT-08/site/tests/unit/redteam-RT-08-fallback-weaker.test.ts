// RT-08 (content rules), attack 15: a fallback must be "a weaker sentence that stays true however the item
// turns out" (SPEC.md 7.3). In M3 beat 7 the sentence "the theorem behind that list is due to J. H. Smith
// (1970)" is wrapped under E10 (Smith's theorem), and its fallback, printed in every release build, says
// "their book names the original source of that list, which this site has not yet checked." What the
// research read of that book is only its section title and page: SOURCES.md 11.5, [BrH], "[S, section title
// and page]. The underlying theorem is due to J. H. Smith (1970); that citation is [U]." So the fallback
// states, as fact, something about the content of a text that was not read, and it does not stay true
// however the item turns out (it depends on the book, not on E10).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const M3 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m3-classification.mdx', import.meta.url)), 'utf8');
const SOURCES = readFileSync(fileURLToPath(new URL('../../../SOURCES.md', import.meta.url)), 'utf8');

describe('RT-08: the E10 fallback of M3', () => {
  it('SOURCES.md records only the section title and page of [BrH] as read', () => {
    expect(SOURCES).toMatch(/\*\*\[BrH\]\*\*[^\n]*\[S, section title and page\]\. The underlying theorem is due to J\. H\. Smith \(1970\); that citation is \[U\]\./);
  });
  it('the fallback does not assert what the unread book contains', () => {
    const fb = (M3.match(/<Unverified item="E10" fallback="([^"]*)"/) ?? [])[1] ?? '';
    // Observed at 69546f0: "their book names the original source of that list, which this site has not yet checked."
    expect(fb).not.toMatch(/book names the original source/);
  });
});
