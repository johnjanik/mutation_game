// RT-08 (content rules), attack 27 (credit) with attack 5 ("first"): the "What we have seen" box of M4
// says "Both games were first published by Wildberger ([W03c], section two), who credits the numbers game
// to Mozes." The numbers game was published by Mozes in 1990 ([Moz90]), after Proctor's use of the same
// process in 1984 ([Pro84]); what SOURCES.md 11.1 says of [W03c] is narrower: "Section 2 ... is the first
// published definition of **both** games on directed graphs". SPEC.md 8.4: "Credit accurately: ... the
// numbers game is Mozes', with Proctor's earlier use of the same process and Eriksson's development
// acknowledged". The sentence is read from the MDX source and from SOURCES.md.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const M4 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m4-numbers.mdx', import.meta.url)), 'utf8');
const SOURCES = readFileSync(fileURLToPath(new URL('../../../SOURCES.md', import.meta.url)), 'utf8');

describe('RT-08: credit of the numbers game in M4', () => {
  it('SOURCES.md qualifies [W03c] as the first published definition of both games on directed graphs', () => {
    expect(SOURCES).toContain('is the first published definition of **both** games on directed graphs');
    expect(SOURCES).toMatch(/\*\*\[Moz90\]\*\* S\. Mozes, .*\(1990\)/);
  });
  it('M4 does not say that the numbers game was first published by Wildberger', () => {
    const sentence = M4.split('\n').find((l) => /first published by Wildberger/.test(l)) ?? null;
    // Observed at 69546f0 (Seen box, first statement):
    // "Both games were first published by Wildberger (<Cite k="W03c"/>, section two), who credits the numbers game to Mozes."
    expect(sentence, 'M4 sentence crediting first publication of both games to Wildberger').toBeNull();
  });
});
