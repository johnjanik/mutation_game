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
import { citeTitle } from '../../src/lib/sources';

const DIR = fileURLToPath(new URL('../../src/content/modules/', import.meta.url));
const LABEL = /\[(S|S2|V|U|D)(\]|,|;|:)/;
const RECORD = /Appendix E|section 2\.\d+\b|this specification|oracle function|verify\.py/;

const lessons = readdirSync(DIR).filter((f) => f.endsWith('.mdx')).sort();

describe('RT-08: lesson Sources lists print the research record of SOURCES.md', () => {
  for (const file of lessons) {
    const src = readFileSync(DIR + file, 'utf8');
    const m = src.match(/<Sources keys=\{\[([^\]]*)\]\}/);
    const keys = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
    it(`${file}: no provenance label or research note in the printed entries`, () => {
      const bad = keys.map((k) => ({ k, t: citeTitle(k) })).filter(({ t }) => LABEL.test(t) || RECORD.test(t));
      expect(bad.map(({ k, t }) => `[${k}] ${t}`), `${file} prints these entries`).toEqual([]);
    });
  }
});
