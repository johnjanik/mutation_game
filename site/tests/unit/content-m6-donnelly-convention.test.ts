// Lesson M6 states Donnelly's convention where it quotes his theorem. Adopted from
// site/tests/unit/redteam-RT-09-p4-m6-donnelly-convention.test.ts (lens RT-09, phase 4 round, attack 22).
// As found: M6 quotes Donnelly's theorem on the forms fired, a result in a convention
// whose matrix is the transpose of this site's (SPEC 2.9: "Donnelly [Don08] ... a = lambda, C = M^T"), and the
// paragraph does not say so, although the statement turns on which board is "reversed".
//   Beat 4: "On B_2 the complete symbolic game fires x_1, 2x_1+x_2, x_1+x_2, x_2: the positive roots of the
//   reversed board [Don08] (Theorem 5.2), ..."
//   Seen 3: "Firing is mutation on the reversed board, transposed. Verified by computation; [Don08]."
// SPEC 8.4: "State the convention whenever a result is quoted from a source that uses another one (section 2.9)."
// M5 beat 5, which quotes the same theorem, does state it: "Donnelly fires positive numbers, as this site does;
// his matrix is the transpose of the Cartan matrix used here."
// Run: npx vitest run --project site-unit site/tests/unit/content-m6-donnelly-convention.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The glossary links' markup (<Term a="...">, </Term>; P6-terms) is taken out, so that the sentences read as written.
const read = (f: string): string =>
  readFileSync(fileURLToPath(new URL(`../../src/content/modules/${f}`, import.meta.url)), 'utf8').replace(/<Term a="[^"]*">|<\/Term>/g, '');
const M5 = read('m5-weyl.mdx');
const M6 = read('m6-multiple-edges.mdx');

describe('M6 quotes [Don08] with its convention', () => {
  it('M5 states the convention for the same theorem', () => {
    expect(M5).toContain('his matrix is the transpose of the Cartan matrix used here');
  });

  // regression: P4-RT-09-06
  it("M6 quotes Donnelly's theorem on the forms fired and says that his matrix is the transpose of the site's", () => {
    const beat4 = M6.slice(M6.indexOf('<Beat n={4}>'), M6.indexOf('<Beat n={5}>'));
    expect(beat4).toContain('the positive roots of the reversed board <Cite k="Don08"/>');
    expect(M6).toContain('Firing is mutation on the reversed board, transposed. Verified by computation; <Cite k="Don08"/>.');
    const stated = /Donnelly|his matrix|M\^\{?\\mathsf T\}?|C=M/.test(M6);
    expect(stated, 'M6 quotes [Don08] (Theorem 5.2) for "the positive roots of the reversed board" but nowhere says that Donnelly\'s matrix M is the transpose of C (SPEC 2.9, 8.4)').toBe(true);
    // Added at adoption: the convention is stated in beat 4, beside the quotation (SPEC 2.9: C = M^T).
    expect(beat4).toContain('Donnelly\'s matrix is <Tex src="C^{\\mathsf T}"/>');
  });
});
