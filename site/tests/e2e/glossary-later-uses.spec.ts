// P6-terms: SPEC.md 8.4, "Define every term on first use and link later uses to a glossary entry", on every
// lesson M0 to M9, on the M10 hub (RT-FIX P6-RT-10-03) and on the reference pages history, confusions,
// open-problem, not-quiver-mutation and about.
// The rule is that of M8.spec.ts > "later uses of a term link to the glossary" (P5-A3), applied to every page:
// for every term of the glossary (each dfn[id] of glossary/, its formula left out) used at least twice in the
// prose of a page, some use after the first is a link to that term's own entry (glossary/#<anchor>).
//
// The prose of a page is its article with the tools ([data-tool]), the tables, the list of sources, the module
// links, the challenges, the headings (h1 to h3), the scripts and every formula (.katex) left out: the scope of
// M8's test. A use of a term is the term as a whole word, any case, singular as the glossary writes it (so
// "nodes" is not a use of "node"), as M8's test reads it, with two refinements that M8's test does not need:
// a hyphen joins a word on either side (M8's test stops a term at a following hyphen only, so there
// "anti-Martians" holds a use of "Martians"; here it does not), and a use that lies inside a use of a longer
// term is a use of the longer term only (so "restricted board" is a use of "restricted board", not of "board").
// The text of a link that is not a glossary link (a module title, a statement linked to its module, a source)
// is not a use: links do not nest, and that text names the link's target. A use inside a phrase of
// OTHER_SENSE, where the word means something else than the glossary entry, is not counted; every phrase of
// the table must be met on some page, so that the table cannot grow stale. A link to the glossary page
// without a fragment is navigation, not a link of a term. A pair of a page and a term whose link another spec
// forbids is listed in BLOCKED with its reason; it fails here as soon as it is linked or used less than
// twice, so the table holds only what is still blocked. Run after `npm run build` against
// `astro preview`; the paths are relative to Playwright's baseURL, so the spec also runs against a build with
// BASE_PATH=/sub/path/.
//
// Hooks read: the glossary's dl.glossary dfn[id] (P1-A4, P6-A8); article[data-module], data-anatomy="sources"
// and "links" (P1-A4); data-tool (P1-A2); data-challenge (P1-A5); the Term helper of each page renders
// <a href="<base>glossary/#<anchor>"> around words of the text.
import { expect, test, type Page } from '@playwright/test';

/**
 * The lessons M0 to M9, module M10 itself (the hub, SPEC 3 M10; 9.2 binds it to the writing rules of 8.4), and the
 * reference pages named by SPEC 3 M10 and the M10 hub (P6-A8).
 */
const ROUTES = [
  'modules/m0-start/',
  'modules/m1-mutation/',
  'modules/m2-form/',
  'modules/m3-classification/',
  'modules/m4-numbers/',
  'modules/m5-weyl/',
  'modules/m6-multiple-edges/',
  'modules/m7-geometry/',
  'modules/m8-lie-algebras/',
  'modules/m9-real-forms/',
  // regression: P6-RT-10-03
  'modules/m10-atlas/',
  'history/',
  'confusions/',
  'open-problem/',
  'not-quiver-mutation/',
  'about/',
];

/**
 * Pairs of a page and a term whose link another spec forbids today, with the reason and the request that would
 * lift it. Each pair must still be used twice or more on its page and still lack its link: once the link is
 * allowed and added, the pair fails here until it is taken out of this table.
 */
const BLOCKED: Record<string, Record<string, string>> = {};

/**
 * Phrases in which the word of a glossary term means something else, keyed by the term's anchor, with the
 * reason. A use of the term that lies inside a match of one of its phrases is not counted. Shared by every
 * page; a phrase is added only where the word is not the glossary's term, never to excuse a missing link.
 */
const OTHER_SENSE: Record<string, { phrase: RegExp; why: string }[]> = {
  board: [{ phrase: /\bGame Board\b/, why: 'the name of tool T1' }],
  orbit: [{ phrase: /\bOrbit Garden\b/, why: 'the name of tool T2' }],
  population: [{ phrase: /\bdual\s+population\b/i, why: "Wildberger's dual population, which is a position of the numbers game" }],
  counts: [
    {
      phrase: /(?<!\b(?:road|one-way)\s)\bcounts\b/i,
      why: 'the verb ("a positive population counts Martians") and counts of other things (positions, faces); the glossary\'s counts are the road counts of two nodes, written "road counts" or "one-way counts" on these pages',
    },
  ],
  numbers: [
    { phrase: /\bnumbers\s+of\s+(?:roads|vertices)\b|\bwhole\s+numbers\b|\breal\s+numbers\b/i, why: 'how many, whole numbers in general, and the real numbers; not the numbers on the nodes' },
    { phrase: /\bnumbers\s+D\s+and\s+E\s+graphs\b/, why: 'the verb "to number"' },
    { phrase: /\bNumbers\s+view\b/, why: 'the name of the Numbers view' },
  ],
  weights: [
    {
      phrase: /\bfundamental\s+weights\b|\b(?:are|is)\s+(?:the\s+)?weights\b|\broot\s+system,\s+the\s+weights\b|\broots,\s+weights\b|\b(?:on|of|about)\s+weights\b|\bweights\s+and\s+quarks\b/i,
      why: 'the weights of Lie theory, which the positions of the numbers game are; not the weights d_i of a balanced board',
    },
    { phrase: /\breal\s+weights\b|\bpositive\s+weights\s+with\b/i, why: 'numbers carried by roads, or the comarks as weights of a sum; not the weights d_i of a balanced board' },
  ],
  arrows: [
    { phrase: /\bvertices\s+and\s+arrows\b|\barrows\s+at\s+(?:the\s+)?vertex\b|\barrows\s+from\s|\b(?:turn|remove)\s+arrows\b/i, why: 'the arrows of a quiver, not the arrows of a Satake diagram' },
    { phrase: /\barrows\s+of\s+(?:that\s+same\s+)?length\b/i, why: 'populations drawn as arrows in the plane' },
  ],
  word: [{ phrase: /\bword\s+for\s+word\b/i, why: 'the idiom "word for word"' }],
  length: [
    {
      phrase: /\bsquared\s+length\b|\bsquare\s+of\s+the\s+length\b|\bsame\s+length\b|\barrows\s+of\s+length\b|\bdiffer\s+in\s+length\b|\bof\s+one\s+length\b|\blength\s+of\s+the\s+shadow\b/i,
      why: 'the Euclidean length of a vector, not the number of moves of a shortest play',
    },
    { phrase: /\bat\s+length\b/i, why: 'the idiom "at length"' },
  ],
  round: [{ phrase: /\bturn(?:s|ed|ing)?\b(?:\s+\S+){0,6}?\s+round\b/i, why: 'turned round: reversed in direction, not a round of the wave' }],
  short: [{ phrase: /\bfor\s+short\b/i, why: 'the idiom "for short"' }],
  representation: [{ phrase: /\brepresentations?\s+of\s+(?:a|the)\s+quiver\b|\bindecomposable\s+representations?\b/i, why: 'a representation of a quiver, not of the Lie algebra of a board' }],
  dimension: [{ phrase: /\bdimension\s+(?:one\s+)?there\b/i, why: 'the dimension at one vertex of a representation of a quiver' }],
  compact: [{ phrase: /\bmaximally\s+compact\b|\bcompact\s+simple\s+roots?\b/i, why: 'a maximally compact Cartan subalgebra and compact roots, not a compact real form' }],
};

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Term {
  id: string;
  term: string;
}

/**
 * The glossary's terms: every dfn with an id, its formula left out (as M8.spec.ts reads them), with its curly
 * apostrophes made straight, as the prose is read in markedProse (RT-FIX P6-MERGE-C-02: the built glossary prints
 * "Kostant’s game", so a term read as printed met no use in the straightened prose).
 */
async function glossaryTerms(page: Page): Promise<Term[]> {
  await page.goto('glossary/');
  return page.locator('article dfn[id]').evaluateAll((els) =>
    els.map((e) => {
      const copy = e.cloneNode(true) as HTMLElement;
      for (const k of copy.querySelectorAll('.katex')) k.remove();
      return { id: e.id, term: (copy.textContent ?? '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim() };
    }),
  );
}

/**
 * The prose of a page as text, with each glossary link marked \u0001<k>\u0002 text \u0003, k the index of its
 * anchor in the list returned beside it (so that no anchor's letters enter the text searched).
 */
async function markedProse(page: Page): Promise<{ marked: string; links: string[] }> {
  return page.locator('main article').first().evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('.katex, [data-tool], table, [data-anatomy="sources"], [data-anatomy="links"], [data-challenge], h1, h2, h3, script, style')) el.remove();
    for (const el of copy.querySelectorAll('p, li, dd, dt, figcaption, caption, blockquote')) el.append(document.createTextNode(' '));
    // The text of any other link (a module, a source, a tool) cannot hold a glossary link, and it names its target.
    for (const a of copy.querySelectorAll('a:not([href*="glossary"][href*="#"])')) a.replaceWith(document.createTextNode(' '));
    const found: string[] = [];
    for (const a of copy.querySelectorAll('a[href*="glossary"][href*="#"]')) {
      const href = a.getAttribute('href') ?? '';
      found.push(decodeURIComponent(href.slice(href.indexOf('#') + 1)));
      a.replaceWith(document.createTextNode(`\u0001${found.length - 1}\u0002${a.textContent ?? ''}\u0003`));
    }
    return { marked: (copy.textContent ?? '').replace(/[‘’]/g, "'").replace(/\s+/g, ' '), links: found };
  });
}

/** The glossary link (its anchor) that encloses the character at `at`, or null. */
function linkAt(marked: string, links: string[], at: number): string | null {
  const open = marked.lastIndexOf('\u0001', at);
  const close = marked.lastIndexOf('\u0003', at);
  if (open <= close) return null;
  return links[Number(marked.slice(open + 1, marked.indexOf('\u0002', open)))] ?? null;
}

interface Hit {
  id: string;
  start: number;
  end: number;
}

/**
 * The uses of every term in the marked prose of a page: whole words, any case, hyphenated compounds left
 * out, nested uses given to the longer term, the phrases of OTHER_SENSE left out. `used` counts the matches
 * of each phrase.
 */
function usesOf(marked: string, terms: Term[], used: Map<RegExp, number>): Hit[] {
  // The phrases of OTHER_SENSE are matched in the text with the link markers taken out, then mapped back.
  const map: number[] = [];
  let squeezed = '';
  let inMarker = false;
  for (let k = 0; k < marked.length; k++) {
    const c = marked[k]!;
    if (c === '\u0001') inMarker = true;
    if (!inMarker && c !== '\u0003') {
      map.push(k);
      squeezed += c;
    }
    if (c === '\u0002') inMarker = false;
  }
  const all: Hit[] = [];
  for (const { id, term } of terms) {
    const excused: [number, number][] = [];
    for (const sense of OTHER_SENSE[id] ?? []) {
      for (const m of squeezed.matchAll(new RegExp(sense.phrase.source, `${sense.phrase.flags.replace('g', '')}g`))) {
        excused.push([map[m.index!]!, map[m.index! + m[0].length - 1]!]);
        used.set(sense.phrase, (used.get(sense.phrase) ?? 0) + 1);
      }
    }
    const re = new RegExp(`(?<![\\w'-])${escape(term).replace(/ /g, '\\s+')}(?![\\w-])`, 'gi');
    for (const m of marked.matchAll(re)) {
      const start = m.index!;
      if (excused.some(([a, b]) => start >= a && start <= b)) continue;
      all.push({ id, start, end: start + m[0].length });
    }
  }
  // A use inside the use of a longer term belongs to the longer term.
  return all.filter((h) => !all.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start));
}

test('later uses of a glossary term link to the glossary on every lesson and reference page', async ({ page }) => {
  test.setTimeout(240_000);
  const terms = await glossaryTerms(page);
  expect(terms.length, 'the glossary has its 83 entries and more anchors').toBeGreaterThan(80);
  const anchors = new Set(terms.map((t) => t.id));
  for (const id of Object.keys(OTHER_SENSE)) expect(anchors.has(id), `OTHER_SENSE key ${id} is a glossary anchor`).toBe(true);
  for (const [route, pairs] of Object.entries(BLOCKED)) {
    expect(ROUTES, `BLOCKED route ${route}`).toContain(route);
    for (const id of Object.keys(pairs)) expect(anchors.has(id), `BLOCKED anchor ${id}`).toBe(true);
  }
  const used = new Map<RegExp, number>();
  const problems: Record<string, string[]> = {};
  const stillBlocked: string[] = [];
  let satisfied = 0;
  for (const route of ROUTES) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    const { marked, links } = await markedProse(page);
    expect(marked.length, `${route}: prose found`).toBeGreaterThan(1000);
    const found: string[] = [];
    // Every link of a term resolves to an entry.
    for (const anchor of links) if (!anchors.has(anchor)) found.push(`a glossary link to #${anchor}, which is not an entry`);
    const hits = usesOf(marked, terms, used);
    for (const { id, term } of terms) {
      const mine = hits.filter((h) => h.id === id).sort((a, b) => a.start - b.start);
      const blocked = BLOCKED[route]?.[id] !== undefined;
      if (mine.length < 2) {
        if (blocked) found.push(`BLOCKED ${term} -> #${id}: used ${mine.length} times, so the entry is no longer needed`);
        continue;
      }
      if (mine.slice(1).some((h) => linkAt(marked, links, h.start) === id)) {
        if (blocked) found.push(`BLOCKED ${term} -> #${id}: now linked, so the entry is no longer needed`);
        satisfied += 1;
        continue;
      }
      if (blocked) {
        stillBlocked.push(`${route} ${id}`);
        continue;
      }
      const show = (h: Hit): string => `"...${marked.slice(Math.max(0, h.start - 30), h.end + 12).replace(/\u0001\d+\u0002/g, '[').replace(/\u0003/g, ']')}..."`;
      found.push(`${term} -> #${id} (${mine.length} uses: ${mine.map(show).join(', ')})`);
    }
    if (found.length > 0) problems[route] = found;
  }
  expect(problems, 'terms used twice or more on a page with no later use linked to their glossary entry').toEqual({});
  expect(stillBlocked.sort(), 'the BLOCKED pairs, each still used twice and unlinked').toEqual(Object.entries(BLOCKED).flatMap(([r, p]) => Object.keys(p).map((id) => `${r} ${id}`)).sort());
  // Every phrase of OTHER_SENSE is met somewhere, so the table holds no excuse that nothing needs.
  const unused = Object.entries(OTHER_SENSE).flatMap(([id, senses]) => senses.filter((s) => !used.has(s.phrase)).map((s) => `${id}: ${s.phrase}`));
  expect(unused, 'OTHER_SENSE phrases met on no page').toEqual([]);
  // Not vacuous: many terms are used twice or more, and linked, on these pages.
  expect(satisfied).toBeGreaterThan(150);
});

// regression: P6-MERGE-C-02
test('a term with an apostrophe is read alike in the glossary and in the prose, so an unlinked later use of it is found', async ({ page }) => {
  const terms = await glossaryTerms(page);
  const ids = terms.filter((t) => t.term.includes("'")).map((t) => t.id);
  expect(ids, 'the glossary terms written with an apostrophe').toEqual(expect.arrayContaining(['kostants-game', 'wythoffs-construction']));
  expect(terms.filter((t) => /[‘’]/.test(t.term)).map((t) => t.term), 'terms left with a curly apostrophe').toEqual([]);
  // A page that uses Kostant's game twice, as the built pages print it (curly apostrophe), the second use linked
  // or not. The rule of the test above: some use after the first is a link to the term's own entry.
  for (const linked of [false, true]) {
    const later = linked ? '<a href="glossary/#kostants-game">Kostant’s game</a>' : 'Kostant’s game';
    await page.setContent(`<main><article><p>Kostant’s game starts from a simple root population. Later ${later} ends at the highest root.</p></article></main>`);
    const { marked, links } = await markedProse(page);
    const mine = usesOf(marked, terms, new Map()).filter((h) => h.id === 'kostants-game');
    expect(mine.length, `uses of Kostant's game in "${marked}"`).toBe(2);
    expect(mine.slice(1).some((h) => linkAt(marked, links, h.start) === 'kostants-game'), `linked: ${String(linked)}`).toBe(linked);
  }
});

