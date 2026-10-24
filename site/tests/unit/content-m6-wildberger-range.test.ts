// Lesson M6: the range of the computation behind the translation of Wildberger's names (SPEC 2.10).
// Two adopted reproducers of one cause, each above its own regression comment:
//   site/tests/unit/redteam-RT-09-p4-m6-wildberger-range.test.ts (lens RT-09, phase 4 round, attack 29) and
//   site/tests/unit/redteam-RT-08-p4-wildberger-range.test.ts (lens RT-08, phase 4 round, attack 16).
// As found: Seen 5 "For rank at least 3, Wildberger's B and C are Bourbaki's C and B. Verified by computation.";
// the beat 7 box, last line: "Verified by computation, except the E6 diagram (page image) and the package
// statement (its documentation)." under the rows "“B_n”, n >= 3 ... C_n with the node order reversed" and
// "“C_n”, n >= 3 ... B_n with the node order reversed" (the column "Lists compared" of SPEC 2.10 is dropped).
// SPEC 2.10: the translations "were obtained by typing the printed lists of positive roots into verify.py and
// comparing them with the lists the oracle generates [V for every row; golden key wildberger_lists]"; the column
// "Lists compared" gives n = 3, 4 for the B and C rows and n = 4, 5 for D. Golden wildberger_lists.names holds
// B3, B4, C3, C4, D4, D5 and nothing of rank 5 or more for B and C. SPEC 0.3: "the range of boards checked is
// stated with the claim"; the exchange for every n >= 3 follows from his definitions of the graphs, not from a
// computation.
// The RT-09 reproducer asserted that the golden file holds lists of rank 9 or more, which can never pass; as in
// the round 1 adoption of P3-RT-09-02 (decisions/RT-FIX-P3-lesson-m5.md), its test keeps the computation with
// the value the reproducer observed and asserts the finding's expected instead: the ranks compared are named
// with every claim of computation. The RT-08 reproducer is adopted as it was.
// Run: npx vitest run --project site-unit site/tests/unit/content-m6-wildberger-range.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveGoldenPath } from '../../src/lib/golden';

const M6 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m6-multiple-edges.mdx', import.meta.url)), 'utf8');
const m6 = M6;
const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  wildberger_lists: { names: Record<string, string> };
};
const SEEN = "For rank at least {'3'}, Wildberger's B and C are Bourbaki's C and B. Verified by computation.";
const BOX = 'Verified by computation, except the <Tex src="E_6"/> diagram (page image) and the package statement (its documentation).';

/** The ranks of the lists of the given letters that the golden file compares, from rank `from` up. */
function ranksCompared(letters: string, from: number): number[] {
  return [...new Set(Object.keys(GOLDEN.wildberger_lists.names)
    .filter((k) => new RegExp(`^[${letters}]\\d+$`).test(k))
    .map((k) => Number(k.slice(1)))
    .filter((n) => n >= from))].sort((a, b) => a - b);
}

describe('M6: the range of the check behind Wildberger\'s names', () => {
  // regression: P4-RT-09-05
  it("M6 states Wildberger's B/C translation as 'verified by computation' for every rank of at least 3; the lists were compared for ranks 3 and 4 only", () => {
    // The computation compared B and C for ranks 3 and 4 only, and D for ranks 4 and 5 (golden wildberger_lists.names).
    expect(ranksCompared('BC', 3)).toEqual([3, 4]);
    expect(ranksCompared('D', 0)).toEqual([4, 5]);
    // The sentences as found are gone.
    expect(M6).not.toContain(SEEN);
    expect(M6).not.toContain(BOX);
    // Every Seen statement on Wildberger's B and C that claims a computation names the ranks compared.
    const seen = M6.split('<li data-seen-statement>').slice(1).map((x) => x.slice(0, x.indexOf('</li>'))).filter((x) => /Wildberger's B and C/.test(x));
    expect(seen, 'a Seen statement on Wildberger\'s B and C').toHaveLength(1);
    for (const s of seen) {
      // The statement for every rank from 3 rests on his graphs (a citation of the texts that draw them), and
      // a claim of computation in it names the ranks compared.
      expect(s, 'the source of the statement for every rank').toContain('<Cite k="W20"/>');
      if (/verified by computation/i.test(s)) {
        expect(s, `M6 Seen: "${s}"; the lists compared for B and C of rank at least 3 have ranks ${ranksCompared('BC', 3).join(', ')} only (SPEC 2.10, "Lists compared: n = 3, 4")`).toMatch(/ranks \{'3'\} and \{'4'\}/);
      }
    }
    // The box's line of provenance names the ranks compared for the B and C rows of every rank: n = 3, 4
    // (SPEC 2.10, column "Lists compared").
    const prov = /<p data-warning-line="provenance">([\s\S]*?)<\/p>/.exec(M6)?.[1] ?? '';
    expect(prov).toContain('Verified by computation');
    expect(prov, 'the ranks compared for B and C').toContain('B and C for <Tex src="n=3,4"/>');
  });

  // regression: P4-RT-09-05 (sibling)
  it("the box's row for Wildberger's D_n of every rank names its ranks compared too (n = 4, 5)", () => {
    // Same cause in the same line of provenance: the row "D_n" is verified by computation for D4 and D5 only.
    expect(ranksCompared('D', 0)).toEqual([4, 5]);
    expect(M6).toContain('<tr data-name-row="Dn">');
    const prov = /<p data-warning-line="provenance">([\s\S]*?)<\/p>/.exec(M6)?.[1] ?? '';
    expect(prov, 'the ranks compared for D').toContain('D for <Tex src="n=4,5"/>');
  });

  it('the golden lists compared are B3, B4, C3, C4 only', () => {
    const names = resolveGoldenPath('wildberger_lists.names') as Record<string, string>;
    const swapped = Object.keys(names).filter((k) => /^[BC]\d$/.test(k) && /reversed/.test(names[k]!));
    expect(swapped.sort()).toEqual(['B3', 'B4', 'C3', 'C4']);
  });

  // regression: P4-RT-08-03
  it("m6-multiple-edges.mdx: the Seen box does not claim the computation for every rank from 3 up", () => {
    const seen = m6.split('\n').filter((l) => l.includes('data-seen-statement') && /rank at least/.test(l) && /Verified by computation/.test(l));
    // Observed at b9b8504 (line 187): <li data-seen-statement>For rank at least {'3'}, Wildberger's B and C
    // are Bourbaki's C and B. Verified by computation.</li>
    expect(seen, 'M6 Seen box: "verified by computation" for every rank at least 3').toEqual([]);
  });
});
