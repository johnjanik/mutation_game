// RT-08 (content rules, phase 5 round), attack 30 (b): a term of the first column of Appendix C used in a
// lesson, neither defined there nor linked to its glossary entry. SPEC.md 8.4: "Define every term on first
// use and link later uses to a glossary entry (Appendix C is its seed)". The glossary has the entries
// #fire, #population and #mutate (Appendix C rows "fire", "population", "mutate"). M8 is a lesson in the
// Numbers view whose working verb is "fire": its prose uses fire, fires, fired or firing eight times outside the tools, defines it
// nowhere (M4 does) and links it nowhere; its sidebars use "population" four times and "mutates" once with no link either,
// while M8 links the other site terms it uses (decision P5-A3 "words, terms and glossary links": numbers,
// node, position, fundamental position, minuscule node, board, city, root populations, roads, heap). M0 and
// M4 link #fire (decision P1-A8 lists `fire` among the anchors that later uses link to); M5, M6 and M7 use
// the verb (26, 7 and 6 times in their prose, outside tool props) with no link, the same gap.
// Adopted by RT-FIX-P5 lessons from the lens branch (finding P5-RT-08-04).
// Run: npx vitest run --project site-unit site/tests/unit/content-glossary-fire.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(fileURLToPath(new URL(`../../src/content/${f}`, import.meta.url)), 'utf8');
const glossary = read('pages/glossary.mdx');
/** The prose of a lesson without its frontmatter, imports, exports and comments. */
const prose = (src: string) => src.replace(/^---[\s\S]*?---/, '').split('\n').filter((l) => !/^(import|export) /.test(l)).join('\n').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const uses = (src: string, re: RegExp) => (prose(src).replace(/<[^>]*>/g, ' ').match(re) ?? []).length;
const links = (src: string, anchor: string) => (src.match(new RegExp(`Term a="${anchor}"`, 'g')) ?? []).length;

describe('RT-08 P5: Appendix C terms used in M8 and never linked', () => {
  it('the glossary has the entries', () => {
    for (const id of ['fire', 'population', 'mutate']) expect(glossary).toMatch(new RegExp(`id="${id}"`));
  });
  const m8 = read('modules/m8-lie-algebras.mdx');
  for (const [term, re] of [['fire', /\b[Ff]ir(?:e|es|ed|ing)\b/g], ['population', /\bpopulations?\b/g], ['mutate', /\bmutat(?:e|es|ed|ing)\b/g]] as const) {
    // regression: P5-RT-08-04
    it(`m8-lie-algebras.mdx: "${term}" is used, so at least one use links to glossary#${term}`, () => {
      const n = uses(m8, re);
      expect(n, `uses of ${term} in M8`).toBeGreaterThan(0);
      // Observed at 006f50d: fire 7 uses in the source prose (8 in the built text), population 4, mutates 1; no Term a="fire", "population" or "mutate".
      expect(links(m8, term), `M8 uses "${term}" ${n} times and never links glossary#${term}`).toBeGreaterThan(0);
    });
  }
  // regression: P5-RT-08-04
  it('siblings: M5, M6 and M7 use "fire" and never link it', () => {
    const report = ['m5-weyl', 'm6-multiple-edges', 'm7-geometry'].map((m) => {
      const s = read(`modules/${m}.mdx`);
      return { m, uses: uses(s, /\b[Ff]ir(?:e|es|ed|ing)\b/g), links: links(s, 'fire') };
    });
    expect(report.filter((r) => r.uses > 0 && r.links === 0), JSON.stringify(report)).toEqual([]);
  });
});
