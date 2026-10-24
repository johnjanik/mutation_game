// RT-08 (content rules), attacks 16 and 3: the "Sources" list at the end of every lesson (Sources.astro)
// prints, for each key, `citeTitle(k)` verbatim, and <Cite> puts the same string in its link title.
// citeTitle is the entry's first line of SOURCES.md; for the many entries written on one line, that line
// is the research record: provenance labels as bracket codes ([S], [S2], [V], [U]), notes such as
// "the item was not located in the text read [U]", "(Appendix E item 16)", "F14 of section 2.7",
// "this specification", "the oracle function `commutation_class_size`".
// SPEC.md 8.4: "Verified by computation ..." must not be dressed up as a citation; the labels of 0.3 are
// labels of the specification. SPEC.md 7.3: even the sources page, which publishes 11.1 to 11.6,
// prints the status labels "spelled out in words". The lessons print them as codes.
// The keys are read from each lesson's <Sources keys={[...]}> in site/src/content/modules/*.mdx.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { citeTitle, entry, keys } from '../../src/lib/sources';

const DIR = fileURLToPath(new URL('../../src/content/modules/', import.meta.url));
const LABEL = /\[(S|S2|V|U|D)(\]|,|;|:)/;
const RECORD = /Appendix E|section 2\.\d+\b|this specification|oracle function|verify\.py/;

const lessons = readdirSync(DIR).filter((f) => f.endsWith('.mdx')).sort();

describe('lesson Sources lists do not print the research record of SOURCES.md', () => {
  for (const file of lessons) {
    const src = readFileSync(DIR + file, 'utf8');
    const m = src.match(/<Sources keys=\{\[([^\]]*)\]\}/);
    const keys = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
    // regression: P3-RT-08-03
    it(`${file}: no provenance label or research note in the printed entries`, () => {
      const bad = keys.map((k) => ({ k, t: citeTitle(k) })).filter(({ t }) => LABEL.test(t) || RECORD.test(t));
      expect(bad.map(({ k, t }) => `[${k}] ${t}`), `${file} prints these entries`).toEqual([]);
    });
  }

  // regression: P3-RT-08-03
  it('every <Cite> title keeps the citation and drops the research record, for every key of SOURCES.md', () => {
    for (const k of keys()) {
      const t = citeTitle(k);
      expect(LABEL.test(t) || RECORD.test(t), `[${k}] ${t}`).toBe(false);
      // The citation itself is kept: the title begins as the entry does, after its key marker.
      const head = entry(k).firstLine.replace(/^\*\*\[[^\]]*\]\*\*\s*/, '').slice(0, 8);
      expect(t.startsWith(head), `[${k}] ${t}`).toBe(true);
    }
    // Cut after the DOI, before the sentence that holds the first label.
    expect(citeTitle('Pro84')).toBe('R. A. Proctor, "Bruhat lattices, plane partition generating functions, and minuscule representations", European J. Combin. 5 (1984), no. 4, 331-350. DOI 10.1016/S0195-6698(84)80037-2.');
    // A sentence that gives the reading status in words ("Not read.") is research record too.
    expect(citeTitle('Kos59')).toBe('B. Kostant, "The principal three-dimensional subgroup and the Betti numbers of a complex simple Lie group", Amer. J. Math. 81 (1959), 973-1032.');
    // A label in the first sentence: the cut falls before the bracket it would leave open.
    expect(citeTitle('Oni04')).toBe('A. L. Onishchik, Lectures on Real Semisimple Lie Algebras and Their Representations, EMS, 2004');
    // Abbreviations and initials do not end the sentence: the journal stays whole.
    expect(citeTitle('BL92')).toContain('J. Algebraic Combin. 1 (1992), 305-328');
    expect(citeTitle('BrH')).toContain('Spectra of Graphs, section 3.1.1 "Graphs with largest eigenvalue at most 2"');
  });
});
