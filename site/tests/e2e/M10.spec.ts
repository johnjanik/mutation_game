// P6-A8: module M10, "Atlas, sandbox, history and sources", the reference hub of SPEC.md 3 M10, and the
// glossary completed for the terms of M0 to M9 (build-plan/agents/P6-A8-lesson-m10.md, section 6). Run
// after `npm run build` against `astro preview`, one Playwright run at a time. Every path is relative to
// Playwright's baseURL, and every check of an href derives the base from the page's own address, so the
// spec also runs against a build with BASE_PATH=/sub/path/.
//
// Hooks read, and where they come from:
//   this page (m10-atlas.mdx): figure[data-first-figure] with ul[data-figure-boards], li[data-group] and
//     a[data-board-link]; ul[data-hub] with li[data-hub-item] (ids below); p[data-credit-line]
//   lesson anatomy (P1-A4): data-anatomy = title, question, draft, beat, seen, lie-theory, links, sources;
//     data-beat and id="beat-<n>" (Beat.astro); data-link (ModuleLinks); article[data-module] (Lesson.astro)
//   content components (P0-A4): a.cite (Cite), data-unverified and a.unverified-mark (Unverified); KaTeX's
//     .katex with its MathML annotation (A-12)
//   glossary (P1-A4, completed here): dl.glossary > div.entry, dt dfn[id], dd[data-col] (definition,
//     wildberger, numbers-game, lie-theory, first-use); in the first-use line, a[data-first-use] (or a span
//     when the module is not in the build) with data-target "<slug>#beat-<n>" or "<slug>" and data-primary
//   theorem-like statements: [data-claim] (plan, instruction 6)
//   tools and predictions (P1-A2, P1-A5): data-tool, data-prediction, data-challenge, astro-island
//
// The terms list (instruction 5.6): the lessons mark a term at its first use in bold (decisions/P1-A8.md,
// P1-A9.md, P2-A9.md, P5-A3.md: "first uses in bold"), and link later uses to glossary#<anchor> through the
// helper Term. The test reads every <strong> of the built lessons M0 to M9 (and of the reference pages),
// maps its words to a glossary anchor with STRONG_TO_ANCHOR, and fails on a bold word that is neither
// mapped nor listed in NOT_TERMS, so a term added to a lesson must be added here and to the glossary.
// The lessons are found in the built site, so module nine is checked once it is built.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distDir } from './routes';

const ROUTE = 'modules/m10-atlas/';
const GLOSSARY = 'glossary/';
const MDX = fileURLToPath(new URL('../../src/content/modules/m10-atlas.mdx', import.meta.url));
const GLOSSARY_MDX = fileURLToPath(new URL('../../src/content/pages/glossary.mdx', import.meta.url));
const SPEC_FILE = fileURLToPath(import.meta.url);
const FRAGMENT = fileURLToPath(new URL('../../../decisions/P6-A8.md', import.meta.url));
const SPEC_MD = fileURLToPath(new URL('../../../SPEC.md', import.meta.url));
const SOURCES_MD = fileURLToPath(new URL('../../../SOURCES.md', import.meta.url));
const DIST = distDir();

/** The pages of SPEC 3 M10 with their routes, in the order of the instruction's table 5.3. */
const HUB_ITEMS: [string, string][] = [
  ['atlas', 'atlas/'],
  ['sandbox', 'tools/sandbox/'],
  ['history', 'history/'],
  ['sources', 'sources/'],
  ['glossary', 'glossary/'],
  ['credits', 'credits/'],
  ['open-problem', 'open-problem/'],
  ['confusions', 'confusions/'],
];
/** The optional items of the instruction (reference pages, not required by SPEC 3 M10). */
const OPTIONAL_ITEMS: [string, string][] = [
  ['not-quiver-mutation', 'not-quiver-mutation/'],
  ['about', 'about/'],
];
/** Reference pages whose bold words count as defined terms too (the coordinator's note: "and in the reference pages"). */
const REFERENCE_PAGES = ['history/', 'confusions/', 'open-problem/', 'not-quiver-mutation/', 'about/'];

/**
 * Bold words of the lessons and of the reference pages, lower case, with the glossary anchor of the term.
 * The entries for module nine are those of SPEC 3 M9 and 2.15 and of P6-A7's instruction (5.6: "mark each
 * term you define (Satake diagram, black node, white node, arrow, involution, admissible, shadow,
 * multiplicity, real rank, restricted board, composite move)").
 */
const STRONG_TO_ANCHOR: Record<string, string> = {
  board: 'board', boards: 'board', node: 'node', nodes: 'node', city: 'city', cities: 'city', road: 'roads', roads: 'roads',
  population: 'population', populations: 'population', mutate: 'mutate', mutation: 'mutate', numbers: 'numbers',
  position: 'position', fire: 'fire', firing: 'fire', 'free play': 'free-play', 'legal play': 'legal-play',
  translator: 'the-translator', 'cartan matrix': 'cartan-matrix', martians: 'martians', 'anti-martians': 'anti-martians',
  'mutation game': 'mutation-game', 'numbers game': 'numbers-game',
  'simple root population': 'simple-root-population', 'root population': 'root-population', positive: 'positive-root-population',
  unhappy: 'unhappy', happy: 'happy', manic: 'manic', "kostant's game": 'kostants-game', 'raising move': 'raising-move',
  'highest root': 'highest-root', 'root poset': 'root-poset', 'form value': 'form-value', invariant: 'invariant', witness: 'witness',
  balanced: 'balanced-board', 'closes up': 'closes-up', 'star with four arms': 'star-with-four-arms',
  'positive definite': 'positive-definite', 'spectral radius': 'spectral-radius', affine: 'affine',
  'frozen population': 'frozen-population', 'mutation conjecture': 'mutation-conjecture',
  'fundamental position': 'fundamental-position', minuscule: 'minuscule-node', 'minuscule node': 'minuscule-node',
  comarks: 'comarks', level: 'level', 'weyl group': 'weyl-group', word: 'word', length: 'length', separates: 'separate',
  'longest element': 'longest-element', heap: 'heap', 'reversed board': 'reversed-board', coroots: 'coroot', height: 'height',
  tally: 'tally', exponents: 'exponents', 'colour class': 'colour-class', round: 'round', wave: 'wave',
  representation: 'representation', dimension: 'dimension', 'one-way counts': 'counts', long: 'long', short: 'short',
  symmetry: 'symmetry', orbit: 'orbit', orbits: 'orbit', 'folding the board': 'folded-board', 'symmetric move': 'symmetric-move',
  'restricting the roots': 'restricting-the-roots', ringed: 'ring', vertices: 'vertices', 'face type': 'face-type',
  'move graph': 'move-graph', 'polytope graph': 'polytope-graph', uniform: 'uniform', 'make uniform': 'uniform',
  'coxeter plane': 'coxeter-plane', shells: 'shells', string: 'string', 'single step': 'single-step', relations: 'chevalley-serre-relations',
  'signed move': 'signed-move', quiver: 'quiver',
  // Module nine (SPEC 3 M9, 2.15; P6-A7's instruction 5.6).
  'real form': 'real-form', 'real forms': 'real-form', 'satake diagram': 'satake-diagram', 'satake diagrams': 'satake-diagram',
  black: 'black', 'black node': 'black', 'black nodes': 'black', white: 'white', 'white node': 'white', 'white nodes': 'white',
  arrow: 'arrows', arrows: 'arrows', involution: 'involution', admissible: 'admissible', shadow: 'shadow', shadows: 'shadow',
  'restricted root': 'shadow', 'restricted roots': 'shadow', multiplicity: 'multiplicity', multiplicities: 'multiplicity',
  'real rank': 'real-rank', 'restricted board': 'restricted-board', 'composite move': 'composite-move',
  'composite moves': 'composite-move', 'vogan diagram': 'vogan-diagram', 'vogan diagrams': 'vogan-diagram',
  // Module nine as built (P6-A7): the terms it also sets in bold, with the entries added by P6-terms.
  compact: 'compact', character: 'character', 'split form': 'split-form', 'quasi-split form': 'quasi-split-form',
};
/** Bold words that name no term, with the reason. A bold run that is a whole sentence (it ends with a full stop) is emphasis. */
const NOT_TERMS: Record<string, string> = {
  'classification lab': 'the name of tool T4, introduced in module three',
  kaleidoscope: 'the name of tool T6, introduced in module four',
  'and the quiver': 'the bold cell of the comparison table of SPEC 2.16',
};
/** Words that stand for a term in the module text, where they differ from the glossary's own word (plurals are matched anyway). */
const FORMS: Record<string, string[]> = {
  city: ['city', 'cities'], node: ['node'], roads: ['road'], counts: ['counts'], numbers: ['numbers'], martians: ['martian'],
  'anti-martians': ['anti-martian'], 'bidirected-board': ['both ways', 'bidirected'], 'one-way-board': ['one-way', 'one way'],
  finite: ['finite'], 'balanced-board': ['balanced'], weights: ['weights'], 'minuscule-node': ['minuscule'], ring: ['ring', 'ringed'],
  'the-translator': ['translator'], 'kostants-game': ["kostant's game"], 'positive-root-population': ['positive'],
  coroot: ['coroot'], orbit: ['orbit'], separate: ['separates'], 'chevalley-serre-relations': ['relations'], vertices: ['vertices'],
  multiplicity: ['multiplicity', 'multiplicities'], 'folded-board': ['folded board'], arrows: ['arrow'], 'fundamental-position': ['fundamental position'],
};
/** The list of RT-08 attack 40 (instruction 6): stock contrasts and filler words, case-insensitive; "not only ... but" and "It's not X. It's Y." are tested as shapes. */
const FILLER = ['not just', 'more than just', 'delve', 'journey', 'embark', 'unlock', 'powerful', 'seamless', 'game-changer', 'at its core', 'a testament to', 'in the world of', "let's dive", 'beautiful'];
const NOVELTY = ['first site', 'the first site to', 'no other tool', 'first tool', 'never been done'];
const EM_DASH = String.fromCharCode(0x2014);
/**
 * Quotations that SPEC requires word for word (instruction 5.7): the bridge sentence of 2.4(a) and the credit line
 * of 8.4, as runs of words with the formulas left out (so "node $i$" is "node").
 */
const VERBATIM = [
  'the number on node is the amount by which a mutation would lower city',
  "the mutation game is wildberger's the numbers game is mozes' with proctor's earlier use of the same process and eriksson's development acknowledged kostant's game is attributed to kostant",
];
/** Items of Appendix E wrapped on each page (none: the hub and the glossary state nothing that rests on an open item). */
const UNVERIFIED_EXPECTED: Record<string, string[]> = { [ROUTE]: [], [GLOSSARY]: [] };

const norm = (s: string | null | undefined): string => (s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sentences = (t: string): string[] => norm(t).split(/(?<=[.!?])\s+(?=[A-Z"(])/).filter((s) => s !== '');
const words = (t: string): string[] =>
  t
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w !== '' && w !== "'");

/** The base path of the site, read from the address of a page whose route is known. */
function baseOf(page: Page, route: string): string {
  const path = new URL(page.url()).pathname;
  expect(path.endsWith(route), `${path} ends with ${route}`).toBe(true);
  return path.slice(0, path.length - route.length);
}

/** The text of an element with each KaTeX formula replaced by its TeX source; runs in the page. */
function texText(el: Element): string {
  const copy = el.cloneNode(true) as HTMLElement;
  for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(` ${k.querySelector('annotation')?.textContent ?? ''} `));
  for (const s of copy.querySelectorAll('script, style, svg')) s.remove();
  for (const b of copy.querySelectorAll('p, li, dd, dt, h1, h2, h3, figcaption, td, th')) b.append(document.createTextNode(' '));
  return copy.textContent ?? '';
}

interface Beat {
  id: string;
  beat: number;
  text: string;
}
interface LessonScan {
  route: string;
  slug: string;
  module: number;
  beats: Beat[];
  /** Every bold run of the article outside tools, challenges and the draft mark: its text and its beat (0 outside a beat). */
  strongs: { text: string; beat: number }[];
  /** Fragments of every glossary link of the article. */
  glossaryAnchors: string[];
  articleText: string;
}

/** The built lessons, in module order, read from the built site (so module nine counts once it is built). */
function builtLessons(): { route: string; slug: string; module: number }[] {
  const dir = join(DIST, 'modules');
  const out: { route: string; slug: string; module: number }[] = [];
  for (const slug of readdirSync(dir)) {
    const file = join(dir, slug, 'index.html');
    if (!existsSync(file)) continue;
    const m = /<article class="lesson[^"]*"[^>]*data-module="(\d+)"/.exec(readFileSync(file, 'utf8'));
    if (m) out.push({ route: `modules/${slug}/`, slug, module: Number(m[1]) });
  }
  return out.sort((a, b) => a.module - b.module);
}

/** The texts (formulas as TeX) of every element a locator finds, in order. */
async function texTexts(list: Locator): Promise<string[]> {
  const out: string[] = [];
  for (let k = 0; k < (await list.count()); k++) out.push(await list.nth(k).evaluate(texText));
  return out;
}

async function scan(page: Page, route: string): Promise<Omit<LessonScan, 'slug' | 'module'>> {
  const response = await page.goto(route);
  expect(response?.status(), route).toBe(200);
  const article = page.locator('main article').first();
  const beatList = article.locator('[data-beat]');
  const beatTexts = await texTexts(beatList);
  const beatIds = await beatList.evaluateAll((els) => els.map((b) => ({ id: b.id, beat: Number(b.getAttribute('data-beat')) })));
  const strongs = await article.locator('strong').evaluateAll((els) =>
    els
      .filter((s) => s.closest('[data-tool], [data-challenge], [data-anatomy="draft"], [data-anatomy="sources"]') === null)
      .map((s) => {
        const copy = s.cloneNode(true) as HTMLElement;
        for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(k.querySelector('annotation')?.textContent ?? ''));
        return { text: copy.textContent ?? '', beat: Number(s.closest('[data-beat]')?.getAttribute('data-beat') ?? 0) };
      }),
  );
  const glossaryAnchors = await article.locator('a[href*="glossary"]').evaluateAll((els) =>
    els
      .map((a) => a.getAttribute('href') ?? '')
      .filter((h) => h.includes('#'))
      .map((h) => decodeURIComponent(h.slice(h.indexOf('#') + 1))),
  );
  return {
    route,
    beats: beatIds.map((b, k) => ({ ...b, text: beatTexts[k]! })),
    strongs,
    glossaryAnchors,
    articleText: await article.evaluate(texText),
  };
}

/** The anchor of a bold run, null when it names no term (NOT_TERMS, or a whole sentence), undefined when unknown. */
function anchorOf(raw: string): string | null | undefined {
  const t = norm(raw).toLowerCase();
  if (/\.$/.test(t) && t.split(' ').length >= 4) return null;
  const key = t.replace(/[.,;:]+$/, '');
  if (NOT_TERMS[key] !== undefined) return null;
  return STRONG_TO_ANCHOR[key];
}

/** True when the text holds one of the words of a term, as a whole word, singular or plural. */
function holdsTerm(text: string, forms: string[]): boolean {
  const t = norm(text).toLowerCase();
  return forms.some((f) => new RegExp(`(?<![\\w-])${esc(norm(f).toLowerCase()).replace(/ /g, '\\s+')}(?:s|es)?(?![\\w-])`).test(t));
}

test.describe('M10', () => {
  test('every link on the hub resolves', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(ROUTE);
    const base = baseOf(page, ROUTE);
    const hrefs = await page.locator('main a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs.length, 'links on the hub').toBeGreaterThan(40);
    const origin = new URL(page.url()).origin;
    const texts = new Map<string, string>();
    for (const href of new Set(hrefs)) {
      const url = new URL(href);
      expect(url.origin, `${href} is internal`).toBe(origin);
      expect(url.pathname.startsWith(base), `${href} lies under the base ${base}`).toBe(true);
      const key = url.pathname + url.search;
      if (!texts.has(key)) {
        const response = await page.request.get(url.origin + key);
        expect(response.status(), href).toBe(200);
        texts.set(key, await response.text());
      }
      if (url.hash !== '') {
        const id = decodeURIComponent(url.hash.slice(1));
        expect(texts.get(key), `${href}: the fragment exists on its page`).toMatch(new RegExp(`id="${esc(id)}"`));
      }
    }
  });

  test('the hub links every reference page with one sentence each', async ({ page }) => {
    await page.goto(ROUTE);
    const base = baseOf(page, ROUTE);
    const items = page.locator('ul[data-hub] > li[data-hub-item]');
    const ids = await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-hub-item')));
    // The required items, in the order of the instruction's table 5.3, then the optional ones.
    expect(ids.slice(0, HUB_ITEMS.length)).toEqual(HUB_ITEMS.map(([id]) => id));
    for (const id of ids.slice(HUB_ITEMS.length)) expect(OPTIONAL_ITEMS.map(([x]) => x), `optional item ${id}`).toContain(id);
    for (const [id, route] of [...HUB_ITEMS, ...OPTIONAL_ITEMS]) {
      const item = page.locator(`[data-hub-item="${id}"]`);
      if (OPTIONAL_ITEMS.some(([x]) => x === id) && (await item.count()) === 0) continue;
      await expect(item, id).toHaveCount(1);
      const links = await item.locator('a[href]').evaluateAll((as) => as.map((a) => ({ path: new URL((a as HTMLAnchorElement).href).pathname, text: (a.textContent ?? '').trim(), label: a.getAttribute('aria-label') })));
      const own = links.find((l) => l.path === `${base}${route}`);
      expect(own, `${id}: a link to ${base}${route} (found ${JSON.stringify(links)})`).toBeDefined();
      // The link text names the target: never "here", "this page" or "link".
      expect(own!.text.toLowerCase(), `${id}: link text`).not.toMatch(/^(here|this page|link|click here)$/);
      const text = norm(await item.evaluate(texText));
      const list = sentences(text);
      expect(list, `${id}: one sentence`).toHaveLength(1);
      expect(text, `${id}: a declarative sentence`).toMatch(/[^?!]\.$/);
    }
    // The Atlas item names one board's sheet as its example (instruction 5.3).
    const atlasLinks = await page.locator('[data-hub-item="atlas"] a[href]').evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    expect(atlasLinks.some((p) => new RegExp(`^${esc(base)}atlas/[A-G]\\d/$`).test(p)), JSON.stringify(atlasLinks)).toBe(true);
  });

  test('no link to preview-only pages', async ({ page }) => {
    await page.goto(ROUTE);
    const hrefs = await page.locator('main a[href]').evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    expect(hrefs.filter((h) => /\/open-items(\/|$)|\/dev\//.test(h))).toEqual([]);
  });

  test('the glossary covers every term defined in M0 to M9', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(GLOSSARY);
    const ids = await page.locator('dl.glossary dfn[id]').evaluateAll((els) => els.map((e) => e.id));
    expect(new Set(ids).size, 'anchors are unique').toBe(ids.length);
    const anchors = new Set(ids);
    const lessons = builtLessons().filter((l) => l.module <= 9);
    expect(lessons.map((l) => l.module).slice(0, 9), 'M0 to M8 are built').toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const unmapped: string[] = [];
    const missing: string[] = [];
    const brokenLinks: string[] = [];
    const covered = new Set<string>();
    for (const route of [...lessons.map((l) => l.route), ...REFERENCE_PAGES]) {
      const s = await scan(page, route);
      for (const { text } of s.strongs) {
        const a = anchorOf(text);
        if (a === undefined) unmapped.push(`${route}: "${norm(text)}"`);
        else if (a !== null) {
          covered.add(a);
          if (!anchors.has(a)) missing.push(`${route}: "${norm(text)}" has no glossary entry #${a}`);
        }
      }
      for (const a of s.glossaryAnchors) if (!anchors.has(a)) brokenLinks.push(`${route}: glossary#${a}`);
    }
    expect(unmapped, 'bold words of the lessons that are neither a term of the glossary nor listed in NOT_TERMS').toEqual([]);
    expect(missing, 'terms defined in the lessons with no glossary entry').toEqual([]);
    expect(brokenLinks, 'glossary links of the lessons and pages whose anchor does not exist').toEqual([]);
    // Not vacuous: the lessons define this many distinct terms, and every one has its entry.
    expect(covered.size).toBeGreaterThan(70);
  });

  test('glossary back-links resolve', async ({ page }) => {
    test.setTimeout(240_000);
    const lessons = builtLessons();
    const order = new Map(lessons.map((l) => [l.slug, l.module]));
    // The earliest bold use of each term, by module and beat, from the built lessons.
    const scans = new Map<string, Awaited<ReturnType<typeof scan>>>();
    const earliest = new Map<string, [number, number]>();
    for (const l of lessons) {
      const s = await scan(page, l.route);
      scans.set(l.slug, s);
      for (const { text, beat } of s.strongs) {
        const a = anchorOf(text);
        if (!a || beat === 0) continue;
        const at: [number, number] = [l.module, beat];
        const was = earliest.get(a);
        if (!was || at[0] < was[0] || (at[0] === was[0] && at[1] < was[1])) earliest.set(a, at);
      }
    }
    await page.goto(GLOSSARY);
    const base = baseOf(page, GLOSSARY);
    const origin = new URL(page.url()).origin;
    const entries = await page.locator('dl.glossary > div.entry').evaluateAll((els) =>
      els.map((e) => ({
        terms: [...e.querySelectorAll('dt dfn[id]')].map((d) => {
          const copy = d.cloneNode(true) as HTMLElement;
          for (const k of copy.querySelectorAll('.katex')) k.remove();
          return { id: d.id, word: (copy.textContent ?? '').trim() };
        }),
        definition: (e.querySelector('dd[data-col="definition"]')?.textContent ?? '').trim(),
        uses: [...e.querySelectorAll('dd[data-col="first-use"] [data-first-use]')].map((u) => ({
          term: u.getAttribute('data-first-use') ?? '',
          target: u.getAttribute('data-target') ?? '',
          primary: u.getAttribute('data-primary') === 'true',
          tag: u.tagName,
          href: u.getAttribute('href'),
          text: (u.textContent ?? '').trim(),
        })),
      })),
    );
    expect(entries.length).toBeGreaterThan(80);
    // The status and the title of every module page, fetched once.
    const pages = new Map<string, { status: number; title: string }>();
    for (const l of lessons) {
      const r = await page.request.get(`${origin}${base}modules/${l.slug}/`);
      const h1 = /<h1 data-anatomy="title"[^>]*>([^<]*)<\/h1>/.exec(await r.text())?.[1] ?? '';
      const title = h1.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      pages.set(l.slug, { status: r.status(), title: norm(title) });
    }
    const problems: string[] = [];
    const unpublished: string[] = [];
    for (const e of entries) {
      if (e.definition === '') problems.push(`${e.terms.map((t) => t.id).join(', ')}: no definition`);
      for (const { id, word } of e.terms) {
        const uses = e.uses.filter((u) => u.term === id);
        if (uses.filter((u) => u.primary).length !== 1) {
          problems.push(`${id}: ${uses.length} first-use links, ${uses.filter((u) => u.primary).length} marked primary`);
          continue;
        }
        for (const u of uses) {
          const [slug, frag = ''] = u.target.split('#');
          const built = order.has(slug!);
          if (!built) {
            // The module is not in this build (module nine before P6-A7 merges): the entry names it without a link.
            if (u.tag !== 'SPAN' || u.href !== null) problems.push(`${id}: links ${u.target}, which is not built`);
            unpublished.push(`${id} -> ${u.target}`);
            continue;
          }
          const want = `${base}modules/${slug}/${frag ? `#${frag}` : ''}`;
          if (u.tag !== 'A' || u.href !== want) {
            problems.push(`${id}: first-use link ${u.tag} ${u.href} where ${want} was expected`);
            continue;
          }
          const s = scans.get(slug!)!;
          const target = pages.get(slug!)!;
          if (target.status !== 200) problems.push(`${id}: ${want} answers ${target.status}`);
          const beat = frag ? s.beats.find((b) => b.id === frag) : undefined;
          if (frag && !beat) {
            problems.push(`${id}: ${want}: no element with id ${frag}`);
            continue;
          }
          const forms = [word, ...(FORMS[id] ?? [])];
          if (!holdsTerm(beat ? beat.text : s.articleText, forms)) problems.push(`${id}: ${want} does not use the word (${forms.join(' | ')})`);
          if (u.primary) {
            const first = earliest.get(id);
            const here: [number, number] = [order.get(slug!)!, beat ? beat.beat : 0];
            if (first && (first[0] < here[0] || (beat && first[0] === here[0] && first[1] < here[1]))) {
              problems.push(`${id}: links module ${here[0]} beat ${here[1]}, but the term is set in bold earlier, in module ${first[0]} beat ${first[1]}`);
            }
          }
          // The link text names the module by its title.
          if (target.title === '' || !norm(u.text).startsWith(target.title)) problems.push(`${id}: link text "${u.text}" does not start with the module title "${target.title}"`);
        }
      }
    }
    expect(problems).toEqual([]);
    // Module nine is built (P6-A7): every module a first-use line names is in the build, and every first-use
    // link, those of module nine included, points to the beat of the first use (P6-terms).
    expect(unpublished, 'first uses in a module this build does not contain').toEqual([]);
    const noBeat = entries.flatMap((e) => e.uses.filter((u) => !/#beat-\d+$/.test(u.target)).map((u) => `${u.term} -> ${u.target}`));
    expect(noBeat, 'first-use links without the beat of the first use').toEqual([]);
    expect(entries.flatMap((e) => e.uses).filter((u) => u.target.startsWith('m9-real-forms#beat-')).length, 'first uses in module nine').toBeGreaterThan(15);
  });

  test('reference page: no prediction, no challenge, no tool', async ({ page }) => {
    for (const route of [ROUTE, GLOSSARY]) {
      await page.goto(route);
      for (const sel of ['[data-tool]', '[data-prediction]', '[data-challenge]', 'astro-island', '[data-anatomy="beat"]', '[data-anatomy="seen"]', '[data-anatomy="lie-theory"]']) {
        await expect(page.locator(sel), `${route} ${sel}`).toHaveCount(0);
      }
    }
  });

  test('anatomy of a reference page', async ({ page }) => {
    const frontmatter = readFileSync(MDX, 'utf8').split(/^---\s*$/m)[1] ?? '';
    const field = (k: string): string => JSON.parse(new RegExp(`^${k}:\\s*(".*")\\s*$`, 'm').exec(frontmatter)?.[1] ?? '""') as string;
    expect(field('title')).toBe('Atlas, sandbox, history and sources');
    expect(frontmatter).toMatch(/^module: 10$/m);
    expect(frontmatter).toMatch(/^draft: true$/m);
    expect(frontmatter).toMatch(/^released: true$/m);
    expect(frontmatter).toMatch(/^outcomes: \["LO10"\]$/m);
    await page.goto(ROUTE);
    const base = baseOf(page, ROUTE);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('[data-anatomy="title"]')).toHaveText(field('title'));
    await expect(page.locator('[data-anatomy="question"]')).toHaveText(field('question'));
    await expect(page.locator('[data-anatomy="draft"]')).toHaveCount(1);
    // The first figure comes before the hub list, with a caption of one sentence.
    const figure = page.locator('figure[data-first-figure]');
    await expect(figure).toHaveCount(1);
    const order = await page.locator('article').evaluate((a) => {
      const f = a.querySelector('figure[data-first-figure]')!;
      const hub = a.querySelector('ul[data-hub]')!;
      return Boolean(f.compareDocumentPosition(hub) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order, 'the figure precedes the hub').toBe(true);
    const caption = norm(await figure.locator('figcaption').textContent());
    expect(sentences(caption)).toHaveLength(1);
    expect(await figure.getAttribute('aria-labelledby')).toBe(await figure.locator('figcaption').getAttribute('id'));
    // One link for every board that has an Atlas page in this build, named by the board for assistive technology.
    const sheets = readdirSync(join(DIST, 'atlas')).filter((n) => existsSync(join(DIST, 'atlas', n, 'index.html'))).sort();
    expect(sheets.length).toBeGreaterThan(20);
    const links = await figure.locator('a[data-board-link]').evaluateAll((as) => as.map((a) => ({ name: a.getAttribute('data-board-link'), label: a.getAttribute('aria-label'), path: new URL((a as HTMLAnchorElement).href).pathname })));
    expect(links.map((l) => l.name).sort()).toEqual(sheets);
    for (const l of links) {
      expect(l.label).toBe(l.name);
      expect(l.path).toBe(`${base}atlas/${l.name}/`);
    }
    // Grouped by letter, in the order of the Atlas index.
    const groups = await figure.locator('li[data-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')));
    expect(groups).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    // The hub is a real list.
    expect(await page.locator('ul[data-hub]').evaluate((u) => [...u.children].every((c) => c.tagName === 'LI'))).toBe(true);
    // Links of 8.2 item 7: no next module after the last one, and the sandbox closes the module (SPEC 4 T16, 8.1 P6).
    const kinds = await page.locator('[data-anatomy="links"] a[data-link]').evaluateAll((as) => as.map((a) => a.getAttribute('data-link')));
    expect(kinds).not.toContain('next');
    expect(kinds[kinds.length - 1]).toBe('sandbox');
    // The last link of the article is the sandbox.
    const last = await page.locator('article a[href]').evaluateAll((as) => as.at(-1)?.getAttribute('data-link') ?? null);
    expect(last).toBe('sandbox');
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('hub and glossary render without JavaScript', async ({ page }) => {
      for (const route of [ROUTE, GLOSSARY]) {
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);
        expect(norm(await page.locator('main').innerText()).length, route).toBeGreaterThan(1000);
        const katex = await page.locator('main .katex').count();
        expect(katex, `${route}: formulas`).toBeGreaterThan(0);
        await expect(page.locator('main .katex:has(math)')).toHaveCount(katex);
        const html = readFileSync(join(DIST, route, 'index.html'), 'utf8');
        const linksInHtml = (html.match(/<a\b/g) ?? []).length;
        await expect(page.locator('a')).toHaveCount(linksInHtml);
      }
      await page.goto(ROUTE);
      await expect(page.locator('figure[data-first-figure]')).toBeVisible();
      for (const [id] of HUB_ITEMS) await expect(page.locator(`[data-hub-item="${id}"] a`).first(), id).toBeVisible();
      await expect(page.locator('figure[data-first-figure] a[data-board-link]').last()).toBeVisible();
      await page.goto(GLOSSARY);
      await expect(page.locator('dl.glossary dfn[id="board"]')).toBeVisible();
      await expect(page.locator('dl.glossary > div.entry').last().locator('dd[data-col="definition"]')).toBeVisible();
    });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`hub and glossary pass axe (${theme} theme)`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ colorScheme: theme });
      for (const route of [ROUTE, GLOSSARY]) {
        await page.goto(route);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
        const serious = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }));
        expect(serious, `${route} in the ${theme} theme`).toEqual([]);
        expect(results.passes.length).toBeGreaterThan(0);
      }
    });
  }

  test('hub and glossary load no tool script', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const route of [ROUTE, GLOSSARY]) {
      const scripts: string[] = [];
      const listener = (request: { resourceType(): string; url(): string }): void => {
        if (request.resourceType() === 'script' || /\.m?js(\?|$)/.test(new URL(request.url()).pathname)) scripts.push(request.url());
      };
      page.on('request', listener);
      await page.goto(route, { waitUntil: 'networkidle' });
      page.off('request', listener);
      expect(scripts, route).toEqual([]);
      await expect(page.locator('script[src]'), route).toHaveCount(0);
      await expect(page.locator('astro-island'), route).toHaveCount(0);
    }
  });

  test('no em-dash', () => {
    for (const route of [ROUTE, GLOSSARY]) {
      const html = readFileSync(join(DIST, route, 'index.html'), 'utf8');
      expect(html.includes(EM_DASH), `${route}: U+2014 in the built page`).toBe(false);
      expect(html, `${route}: an entity for the em-dash`).not.toMatch(/&mdash;|&#8212;|&#x2014;/i);
    }
    for (const file of [MDX, GLOSSARY_MDX, SPEC_FILE, ...(existsSync(FRAGMENT) ? [FRAGMENT] : [])]) {
      expect(readFileSync(file, 'utf8').includes(EM_DASH), file).toBe(false);
    }
  });

  test('credit wording', async ({ page }) => {
    await page.goto(ROUTE);
    const hub = norm(await page.locator('article').evaluate(texText));
    expect(hub).toContain('attributed to Kostant');
    for (const s of sentences(hub).filter((x) => /Kostant/.test(x.replace(/Kostant's game/g, '')) || /Kostant's game/.test(x))) expect(s, s).toMatch(/attributed to Kostant/);
    if (/numbers game/i.test(hub)) for (const name of ['Mozes', 'Proctor', 'Eriksson']) expect(hub, `hub: ${name}`).toContain(name);
    expect(hub).toMatch(/the mutation game is Wildberger's/);
    await page.goto(GLOSSARY);
    const page_ = norm(await page.locator('article').evaluate(texText));
    if (/numbers game/i.test(page_)) for (const name of ['Mozes', 'Proctor', 'Eriksson']) expect(page_, `glossary: ${name}`).toContain(name);
    const entries = await texTexts(page.locator('dl.glossary > div.entry'));
    for (const e of entries.map(norm)) {
      if (/Kostant/.test(e)) expect(e, e).toMatch(/attributed to Kostant/);
      if (/Mozes/.test(e)) for (const name of ['Proctor', 'Eriksson']) expect(e, e).toContain(name);
    }
  });

  test('no novelty claim', async ({ page }) => {
    for (const route of [ROUTE, GLOSSARY]) {
      await page.goto(route);
      const text = norm(await page.locator('main').innerText()).toLowerCase();
      for (const phrase of NOVELTY) expect(text, `${route}: "${phrase}"`).not.toContain(phrase);
    }
  });

  test("site's words", async ({ page }) => {
    await page.goto(ROUTE);
    // P8 and 8.4: node i is "node i" or "city i", never both in one sentence; the hub's prose outside the links block.
    const blocks = await texTexts(page.locator('article > p:not([data-anatomy]), article figcaption, article [data-hub-item]'));
    expect(blocks.length).toBeGreaterThan(10);
    for (const s of blocks.flatMap(sentences)) expect(/\bnodes?\b/i.test(s) && /\bcit(?:y|ies)\b/i.test(s), s).toBe(false);
  });

  test('conventions stated', async ({ page }) => {
    // 8.4 "State the convention whenever a result is quoted from a source that uses another one" (2.9). A hub item
    // or glossary entry that names one of these authors states the translation. The symbol tau counts where it is
    // Wildberger's map, in the Wildberger column; elsewhere on these pages tau is the symmetry of a Satake
    // diagram, which has no convention to translate (decisions/P6-A8.md).
    const NAMES = /Bourbaki|Humphreys|\bKac\b|Mozes|Eriksson|Olympiad|Gashi|Benkart|Donnelly/;
    const STATED = /transpose|opposite sign|fires? negative|numbering|a=-x|a=-v|a=-u|q=-Cp/;
    await page.goto(ROUTE);
    const items = await texTexts(page.locator('[data-hub-item]'));
    const named: string[] = [];
    for (const t of items.map(norm)) {
      if (!NAMES.test(t)) continue;
      named.push(t);
      expect(t, t).toMatch(STATED);
    }
    await page.goto(GLOSSARY);
    const alls = await texTexts(page.locator('dl.glossary > div.entry'));
    const wildbergers = await texTexts(page.locator('dl.glossary > div.entry > dd[data-col="wildberger"]'));
    expect(wildbergers).toHaveLength(alls.length);
    const entries = alls.map((all, k) => ({ all, wildberger: wildbergers[k]! }));
    for (const e of entries) {
      const all = norm(e.all).replace(/\s+/g, ' ');
      const compact = all.replace(/\s/g, '');
      if (NAMES.test(all) || /\\tau/.test(e.wildberger)) {
        named.push(all);
        expect(STATED.test(all) || STATED.test(compact), all).toBe(true);
      }
    }
    expect(named.length, 'places that name another convention').toBeGreaterThan(2);
  });

  test('no stock contrasts or filler', async ({ page }) => {
    for (const route of [ROUTE, GLOSSARY]) {
      await page.goto(route);
      const text = norm(await page.locator('main').innerText());
      const lower = text.toLowerCase();
      for (const f of FILLER) expect(lower, `${route}: "${f}"`).not.toContain(f);
      expect(lower, `${route}: "not only ... but"`).not.toMatch(/\bnot only\b[^.]*\bbut\b/);
      const list = sentences(text);
      for (let k = 0; k + 1 < list.length; k++) {
        const pair = `${list[k]} ${list[k + 1]}`;
        expect(/^It(?:'s| is) not\b/.test(list[k]!) && /^It(?:'s| is)\b/.test(list[k + 1]!), pair).toBe(false);
      }
    }
  });

  test('no copied sentence', async ({ page }) => {
    const reference = ` ${[readFileSync(SPEC_MD, 'utf8'), readFileSync(SOURCES_MD, 'utf8')].map((t) => words(t.replace(/\[[A-Za-z0-9-]+\]/g, ' ')).join(' ')).join(' ')} `;
    const checked: string[] = [];
    const copied: string[] = [];
    const check = (text: string): void => {
      for (const s of sentences(norm(text)).map((x) => x.toLowerCase().replace(/"/g, ''))) {
        const ws = words(s.replace(/\[[A-Za-z0-9-]+\]/g, ' '));
        if (VERBATIM.some((v) => ` ${ws.join(' ')} `.includes(` ${v} `))) continue;
        if (ws.length < 8) continue;
        checked.push(s);
        if (reference.includes(` ${ws.join(' ')} `)) copied.push(s);
      }
    };
    await page.goto(ROUTE);
    check(await page.locator('article').evaluate((a) => {
      const copy = a.cloneNode(true) as HTMLElement;
      for (const el of copy.querySelectorAll('.katex, [data-anatomy="links"], [data-anatomy="draft"], [data-anatomy="question"], h1')) el.remove();
      for (const el of copy.querySelectorAll('p, li, figcaption')) el.append(document.createTextNode(' '));
      return copy.textContent ?? '';
    }));
    await page.goto(GLOSSARY);
    // The definitions of every entry and every line of the entries added after Appendix C (rows 27 on); the
    // three columns of rows 1 to 26 are Appendix C's own cells, kept as written there by P1-A4.
    const added = await page.locator('dl.glossary > div.entry').evaluateAll((els) =>
      els.map((e, k) => {
        const parts = k < 26 ? [...e.querySelectorAll('dd[data-col="definition"]')] : [...e.querySelectorAll('dd')];
        return parts
          .map((p) => {
            const copy = p.cloneNode(true) as HTMLElement;
            for (const el of copy.querySelectorAll('.katex, .col')) el.remove();
            return `${copy.textContent ?? ''} .`;
          })
          .join(' ');
      }),
    );
    for (const t of added) check(t);
    expect(checked.length, 'sentences of eight words or more that were checked').toBeGreaterThan(60);
    expect(copied, 'sentences found word for word in SPEC.md or SOURCES.md').toEqual([]);
  });

  test('open items are wrapped', async ({ page }) => {
    for (const route of [ROUTE, GLOSSARY]) {
      await page.goto(route);
      const items = await page.locator('main [data-unverified]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-unverified') ?? ''))].sort());
      expect(items, route).toEqual(UNVERIFIED_EXPECTED[route]);
      // In a preview build every wrapped sentence carries its mark (none expected on these pages).
      await expect(page.locator('main span.unverified:not(:has(a.unverified-mark))')).toHaveCount(0);
    }
  });

  test('theorem-like statements carry provenance', async ({ page }) => {
    let claims = 0;
    for (const route of [ROUTE, GLOSSARY]) {
      await page.goto(route);
      const origin = new URL(page.url()).origin;
      const found = await page.locator('main [data-claim]').evaluateAll(
        (els, o) =>
          els.map((e) => ({
            text: (e.textContent ?? '').replace(/\s+/g, ' ').trim(),
            cite: e.querySelector('a.cite') !== null,
            computed: /verified by computation/i.test(e.textContent ?? ''),
            unverified: e.querySelector('[data-unverified]') !== null,
            internal: [...e.querySelectorAll('a[href]')].some((a) => {
              const u = new URL((a as HTMLAnchorElement).href);
              return u.origin === o && !a.classList.contains('cite') && !a.classList.contains('unverified-mark');
            }),
          })),
        origin,
      );
      claims += found.length;
      for (const c of found) expect(c.cite || c.computed || c.unverified || c.internal, `${route}: ${c.text}`).toBe(true);
    }
    expect(claims, 'theorem-like statements marked on the two pages').toBeGreaterThan(4);
  });
});
