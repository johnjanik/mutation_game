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

// The round 1 confirmers (pages cluster) found, after the fix above, entries of the lessons' Sources lists
// and <Cite> titles that do not read as a bibliographic line: the [W-MS] research note with raw Markdown
// backticks ("Project file `MutationGameCoxeterGraphs.pdf`; also at (link not re-checked)."), the
// fragments that removed autolinks leave ("Free: .", "Preprint: .", "Official sheet: . Solutions: , .",
// "course page .", [BrH] ending in ":"), and notes kept after the citation for [Bjo88], [Car14], [Bou68]
// and [Cox73]. SOURCES.md 11.0: an entry gives the citation, where a copy can be read, a status and its
// role; the lessons print the citation only. A title is a function of the key alone (Cite.astro puts
// citeTitle(k) in the title of every <Cite> on every route, and Sources.astro prints it, with its $...$
// typeset, after the key in every Sources list), so checking every key of SOURCES.md checks every
// rendered entry and title on every route.
/** What must not reach a printed entry or a title, outside its $...$ mathematics. */
const DEBRIS: [string, RegExp][] = [
  ['a backtick', /`/],
  ['raw Markdown', /\*\*|\]\(|<https?:|https?:\/\//],
  ['a label or colon followed by nothing', /:\s*(?:[.,;)]|$)/],
  ['a space before punctuation (a removed link)', /\s[.,;:]/],
  ['a lead-in left with no link', /\b(?:at|page|Free|Preprint|Solutions|sheet|record)\s*[.:]?$/],
  ['"link not re-checked"', /link not re-checked/i],
  ['"Project file"', /Project file/i],
];
const outsideMath = (t: string): string => t.split('$').filter((_, i) => i % 2 === 0).join(' MATH ');
const debris = (t: string): string[] => DEBRIS.filter(([, re]) => re.test(outsideMath(t))).map(([name]) => name);

/** The keys of the <Sources> lists and <Cite> tags of every MDX file of the site (lessons and pages). */
const CONTENT = fileURLToPath(new URL('../../src/content/', import.meta.url));
const routedFiles = ['modules', 'pages'].flatMap((d) => readdirSync(CONTENT + d).filter((f) => f.endsWith('.mdx')).map((f) => `${d}/${f}`));
const keysIn = (src: string): string[] => [
  ...[...(src.match(/<Sources keys=\{\[([^\]]*)\]\}/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]!),
  ...[...src.matchAll(/<Cite k="([^"]+)"/g)].map((x) => x[1]!),
];

describe('printed entries and <Cite> titles read as plain bibliographic lines', () => {
  // regression: P3-RT-08-03 (sibling, red-team round 1 confirmers)
  it('no entry and no title on any route carries Markdown, a dangling label or a research note', () => {
    const bad = keys().map((k) => ({ k, t: citeTitle(k), why: debris(citeTitle(k)) })).filter((x) => x.why.length > 0);
    expect(bad.map(({ k, t, why }) => `[${k}] ${t} (${why.join(', ')})`)).toEqual([]);
  });

  for (const file of routedFiles) {
    // regression: P3-RT-08-03 (sibling, red-team round 1 confirmers)
    it(`${file}: every printed entry and title reads as a plain bibliographic line`, () => {
      const used = [...new Set(keysIn(readFileSync(CONTENT + file, 'utf8')))];
      const bad = used.map((k) => ({ k, t: citeTitle(k), why: debris(citeTitle(k)) })).filter((x) => x.why.length > 0);
      expect(bad.map(({ k, t, why }) => `[${k}] ${t} (${why.join(', ')})`), `${file} prints these entries`).toEqual([]);
    });
  }

  // regression: P3-RT-08-03 (sibling, red-team round 1 confirmers)
  it('the entries the confirmers quoted now end with the citation', () => {
    expect(citeTitle('W-MS')).toBe('N. J. Wildberger, "The Mutation Game, Coxeter Graphs, and Partially Ordered Multisets", unpublished manuscript, 79 pp., undated.');
    expect(citeTitle('IMO86')).toBe('27th International Mathematical Olympiad (Warsaw, 1986), Problem 3.');
    expect(citeTitle('W03a')).toMatch(/385-396\. DOI 10\.1016\/S0196-8858\(02\)00541-9\.$/);
    expect(citeTitle('Che17')).toBe('E. Chen, notes of A. Postnikov\'s MIT course 18.218 (Spring 2017), Lecture 1 "Bert Kostant\'s game"');
    expect(citeTitle('BrH')).toBe('A. E. Brouwer, W. H. Haemers, Spectra of Graphs, section 3.1.1 "Graphs with largest eigenvalue at most 2"');
    expect(citeTitle('BL92')).toBe('A. Björner, L. Lovász, "Chip-firing games on directed graphs", J. Algebraic Combin. 1 (1992), 305-328');
    // The notes after the citation stay on the sources page.
    expect(citeTitle('Bjo88')).toBe('A. Björner, "On a combinatorial game of S. Mozes", preprint, 1988.');
    expect(citeTitle('Car14')).toBe('É. Cartan, "Les groupes réels simples, finis et continus", Ann. Sci. École Norm. Sup. (3) 31 (1914), 263-355.');
    expect(citeTitle('Bou68')).toBe('N. Bourbaki, Groupes et algèbres de Lie, chapitres 4 à 6, Hermann, 1968 (English: Lie Groups and Lie Algebras, Chapters 4-6, Springer, 2002).');
    expect(citeTitle('Cox73')).toBe('H. S. M. Coxeter, Regular Polytopes, 3rd ed., Dover, 1973');
    // Identifiers after the first sentence are part of the citation and stay.
    expect(citeTitle('W20')).toMatch(/DOI 10\.1142\/S1005386720000061\. MSC 05C20, 20F55, 17B22\.$/);
  });
});
