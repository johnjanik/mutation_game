// P6-A6: the pages of phase 6 that belong to module M10 (history, common confusions, credits and
// licences) and the version footer of every page (SPEC.md 3 M10, 7.2 closing rule, 7.3, 7.4, 7.5, 7.6,
// 7.8, 7.9, 8.4, Appendix D, E items 2, 5, 11, 13 and 17, F; build-plan/agents/P6-A6-pages-phase-6.md
// section 6). Run after `npm run build` against `astro preview`, one Playwright run at a time.
//
// Hooks read, and where they come from:
//   the footer (Footer.astro, P6-A6): data-site-footer; data-licence="content" | "code" with the SPDX
//     identifier as text; data-commit; data-dep with data-dep-version on each version; data-versions
//     (P1-A4's slot, which holds the <details> list)
//   /history/ (history.mdx): ol data-timeline with li data-year and data-entry; data-source="W-MS" on the
//     paragraph of the manuscript; aside data-sidebar="history" with section data-beside ("kostant",
//     "satake"); section data-lectures
//   /confusions/ (confusions.mdx): section data-confusion (thirteen ids of the plan, 5.7 and 5.8)
//   /credits/ (credits.mdx): section data-credit ("wildberger", "games", "own-words", "assets",
//     "licences", "bundled", "build", "prior-art", "oracle", "statistics"); li data-bundled, data-build,
//     data-prior-art, data-asset; span data-oracle ("sagemath", "satake-catalogue"); the generated table
//     of P1-A4 (tr data-package, td data-licence)
//   the tools (ToolFrame, P6-A5): data-control="latex", the button Export LaTeX
//   content components (P0-A4): data-unverified (Unverified), data-golden (G), a.cite with data-cite (Cite);
//     KaTeX's annotation element (the TeX source of a formula)
//
// Every expected version, licence and golden number is read here from the installed packages, the licence
// files and reference/golden_data.json; none is typed. The repair after review (P6-A6, 2026-10-25) made the
// tests fail on the reviewer's surviving mutants MU1 to MU5 and MU7 and on a licence typed in a source file
// (decisions/P6-A6.md).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readShippedPackages, shippedPackagesFile } from '../../src/lib/pages/shippedPackages';
import { discoverRoutes, distDir } from './routes';

const SITE_DIR = resolve(import.meta.dirname, '../..');
const ROOT = resolve(SITE_DIR, '..');
const DIST = distDir();

const HISTORY = 'history/';
const CONFUSIONS = 'confusions/';
const CREDITS = 'credits/';
const THREE = [HISTORY, CONFUSIONS, CREDITS];

interface PackageJson {
  name?: string;
  version?: string;
  license?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
const readJson = (file: string): PackageJson => JSON.parse(readFileSync(file, 'utf8')) as PackageJson;
const ROOT_PKG = readJson(join(ROOT, 'package.json'));
const SITE_PKG = readJson(join(SITE_DIR, 'package.json'));
const ENGINE_PKG = readJson(join(ROOT, 'packages', 'engine', 'package.json'));

/** The installed package.json of a package, looked up from the site as Node resolves it. */
function installed(name: string): PackageJson {
  for (const dir of [join(SITE_DIR, 'node_modules'), join(ROOT, 'node_modules')]) {
    const file = join(dir, name, 'package.json');
    if (existsSync(file)) return readJson(file);
  }
  throw new Error(`${name} is not installed`);
}

/** The SPDX identifier on the line "SPDX-License-Identifier: <id>" of LICENSE-content. */
const CONTENT_SPDX = /^SPDX-License-Identifier:[ \t]*(\S+)[ \t]*$/m.exec(readFileSync(join(ROOT, 'LICENSE-content'), 'utf8'))?.[1] ?? '';
/** The code licence: the license field of the root package.json. */
const CODE_SPDX = typeof ROOT_PKG.license === 'string' ? ROOT_PKG.license : '';

/** The short name LICENSE-content gives its licence: the words in brackets after "licensed under the <full name>". */
const CONTENT_SHORT_NAME = /\blicensed under (?:the )?[^()]+? \(([^()]+)\)/.exec(readFileSync(join(ROOT, 'LICENSE-content'), 'utf8').replace(/\s+/g, ' '))?.[1]?.trim() ?? null;

/** Whether the repository is a git checkout (a clone has a .git directory, a worktree a .git file). */
const GIT = existsSync(join(ROOT, '.git'));

const GOLDEN = JSON.parse(readFileSync(join(ROOT, 'reference', 'golden_data.json'), 'utf8')) as { types: Record<string, { weyl_order: number }> };

/** The packages of the table of SPEC.md 7.1 that the footer records when a package.json pins them. */
const TABLE_7_1 = ['astro', '@astrojs/mdx', 'svelte', '@astrojs/svelte', 'typescript', 'nanostores', 'vitest', 'fast-check', '@playwright/test', '@axe-core/playwright'];

const BRIDGE = 'The number on node i is the amount by which a mutation would lower city i.';

/** The routes of the built site, relative to the base. */
const ROUTES = discoverRoutes().map((r) => r.path);

/** One route of each kind the footer must appear on (plan 6: index, a lesson, a tool, history, credits, an Atlas page). */
function footerRoutes(): string[] {
  const lesson = ROUTES.find((r) => /^modules\/m\d+-/.test(r));
  const atlas = ROUTES.find((r) => r.startsWith('atlas/'));
  return ['./', ...(lesson ? [lesson] : []), 'tools/board/', HISTORY, CONFUSIONS, CREDITS, ...(atlas ? [atlas] : [])];
}

/**
 * The text of an element as a reader meets it: each KaTeX formula replaced by `$<its TeX>$` (or by the TeX
 * alone with bare: true), the elements matching `drop` removed, a space after each block (the built HTML
 * puts none between two paragraphs, which would join their sentences), typographic quotes made plain,
 * white space collapsed. Runs in the page.
 */
async function textOf(page: Page, selector: string, opts: { drop?: string; bare?: boolean } = {}): Promise<string> {
  return page.locator(selector).first().evaluate((el, o) => {
    const copy = el.cloneNode(true) as HTMLElement;
    if (o.drop) for (const d of copy.querySelectorAll(o.drop)) d.remove();
    for (const k of copy.querySelectorAll('.katex')) {
      const tex = k.querySelector('annotation')?.textContent ?? '';
      k.replaceWith(document.createTextNode(o.bare ? tex : `$${tex}$`));
    }
    for (const b of copy.querySelectorAll('p, li, h1, h2, h3, h4, section, aside, div, td, th, summary')) b.after(document.createTextNode(' '));
    return (copy.textContent ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  }, opts);
}

/** The sentences of a text (split after a full stop, a semicolon or a colon followed by a space). */
const sentences = (t: string): string[] => t.split(/(?<=[.;:])\s+/).filter((s) => s !== '');

/**
 * The sentences of a text, split only where a sentence ends: after a full stop, a semicolon, a colon or a
 * question mark that follows a small letter, a digit, a quote or a closing bracket, and before a capital,
 * a quote, a bracket or a formula. Initials ("S. Mozes") and "c. 2001" stay inside their sentence.
 */
const sentencesOf = (t: string): string[] => t.split(/(?<=[a-z0-9'")\]][.;:?])\s+(?=[A-Z"'([$])/).filter((s) => s !== '');

/** The HTML of a built route ('history/', 'sources/'). */
function builtHtml(route: string): string {
  const r = discoverRoutes().find((x) => x.path === route);
  if (r === undefined) throw new Error(`${route} is not in the build`);
  return readFileSync(r.file, 'utf8');
}

/** A link to a video platform in built HTML. */
const VIDEO_LINK = /href="https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^"]*"/g;

/**
 * A licence typed into a source file: an SPDX identifier, or the name of a licence the site may carry.
 * Footer.astro must contain none of these anywhere, its frontmatter and comments included.
 */
const LICENCE_TYPED = /CC[ -]BY|CC0|Creative Commons|Affero|AGPL|LGPL|\bGPL\b|\bMIT\b|Apache|\bBSD\b|\bISC\b|\bMPL\b|Unlicense/;
/**
 * In credits.mdx, which names the licences of other works in its prose (GPL, LGPL, LPPL, MIT): an SPDX
 * identifier with a version, a bare identifier in quotes, between tags or as an object key, or the name
 * of a licence the site may carry.
 */
const LICENCE_TYPED_IN_CREDITS = [
  /\b(?:CC-BY(?:-[A-Z]{2})*|A?GPL|LGPL|Apache|MPL|EPL|EUPL|LPPL)-\d/,
  /['"`>]\s*(?:MIT|ISC|0BSD|Unlicense)\s*['"`<]|^\s*(?:MIT|ISC)\s*:/m,
  /CC[ -]BY|Creative Commons|Affero/,
];

test.describe('the version footer', () => {
  test('footer shows the versions and the commit', async ({ page }) => {
    const head = GIT ? execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() : null;
    const expected: [string, string][] = [];
    for (const name of TABLE_7_1) {
      const pinned = [ROOT_PKG, SITE_PKG, ENGINE_PKG].some((p) => p.dependencies?.[name] ?? p.devDependencies?.[name]);
      if (pinned) expected.push([name, installed(name).version!]);
    }
    expected.push(['katex', installed('katex').version!]);
    expected.push([ENGINE_PKG.name!, installed(ENGINE_PKG.name!).version!]);
    // Read, never typed: the footer's source holds no version number (licences: the test below).
    const source = readFileSync(join(SITE_DIR, 'src', 'components', 'Footer.astro'), 'utf8');
    expect(source, 'a version typed in Footer.astro').not.toMatch(/['"`>]\s*v?\d+\.\d+\.\d+/);
    for (const route of footerRoutes()) {
      await page.goto(route);
      const footer = page.locator('footer[data-site-footer]');
      await expect(footer, route).toHaveCount(1);
      const deps = await footer.locator('[data-versions] details li[data-dep]').evaluateAll((lis) =>
        lis.map((li) => [li.getAttribute('data-dep') ?? '', li.getAttribute('data-dep-version') ?? '', (li.textContent ?? '').replace(/\s+/g, ' ').trim()]),
      );
      expect(deps.map(([n, v]) => [n, v]), route).toEqual(expected);
      for (const [n, v, text] of deps) expect(text, `${route} ${n}`).toBe(`${n} ${v}`);
      await expect(footer.locator('[data-versions] details > summary'), route).toHaveText('Versions');
      // The commit the build recorded. In a git checkout the build reads it, so data-commit is HEAD of the
      // built tree or a prefix of it (the build's own constant is the short form), or an earlier commit of
      // this branch when the build was made before the last commit; "unknown" there means the footer lost
      // the commit (review of P6-A6, mutant MU3). Only outside a git checkout may it be "unknown".
      const commit = (await footer.locator('[data-commit]').getAttribute('data-commit')) ?? '';
      if (head !== null) {
        expect(commit, `${route}: data-commit in a git checkout`).toMatch(/^[0-9a-f]{7,40}$/);
        const isHead = head.startsWith(commit);
        let ancestor = false;
        if (!isHead) {
          try {
            execFileSync('git', ['-C', ROOT, 'merge-base', '--is-ancestor', commit, 'HEAD']);
            ancestor = true;
          } catch {
            ancestor = false;
          }
        }
        expect(isHead || ancestor, `${route}: data-commit ${commit} is neither HEAD (${head}) nor an ancestor of it`).toBe(true);
      } else {
        expect(commit, route).toMatch(/^(unknown|[0-9a-f]{7,40})$/);
      }
      await expect(footer.locator('[data-commit]'), route).toHaveText(commit.slice(0, 12));
      await expect(footer.locator('script'), route).toHaveCount(0);
    }
  });

  test('footer states both licences', async ({ page }) => {
    expect(CONTENT_SPDX).not.toBe('');
    expect(CODE_SPDX).not.toBe('');
    for (const route of footerRoutes()) {
      await page.goto(route);
      const footer = page.locator('footer[data-site-footer]');
      await expect(footer.locator('[data-licence="content"]'), route).toHaveText(CONTENT_SPDX);
      await expect(footer.locator('[data-licence="code"]'), route).toHaveText(CODE_SPDX);
      await expect(footer, route).toContainText('Code samples shown in the text fall under the code licence.');
      // The name beside the content licence is the one its file gives.
      if (CONTENT_SHORT_NAME !== null) await expect(footer, route).toContainText(`Text and figures: ${CONTENT_SHORT_NAME} (SPDX: ${CONTENT_SPDX})`);
      // The footer keeps P1-A4's footer links, the link to the credits among them.
      await expect(footer.locator('nav[aria-label="Footer"] a', { hasText: 'Credits' }), route).toHaveCount(1);
    }
  });

  test('licences are read, not typed', () => {
    // SPEC.md 7.9 and the plan's trap "Licences are read, not typed": if the owner changes a licence (D4),
    // the footer and the credits page follow without an edit. The rendered identifiers are compared with
    // the files above; a value typed into the source would render the same today, so the sources are read
    // whole, frontmatter and comments included (review of P6-A6: a typed `const code = '...'`).
    const footer = readFileSync(join(SITE_DIR, 'src', 'components', 'Footer.astro'), 'utf8');
    expect(footer, 'a licence typed in Footer.astro').not.toMatch(LICENCE_TYPED);
    const credits = readFileSync(join(SITE_DIR, 'src', 'content', 'pages', 'credits.mdx'), 'utf8');
    for (const typed of LICENCE_TYPED_IN_CREDITS) expect(credits, 'a licence typed in credits.mdx').not.toMatch(typed);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });

  test('the footer works without JavaScript and reflows at 320 pixels', async ({ page }) => {
    for (const route of ['./', HISTORY, 'tools/board/']) {
      await page.goto(route);
      const footer = page.locator('footer[data-site-footer]');
      await expect(footer.locator('li[data-dep="katex"]'), route).toBeHidden();
      await footer.locator('summary').click();
      await expect(footer.locator('li[data-dep="katex"]'), route).toBeVisible();
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(scroll, `horizontal scroll on ${route} at 320`).toBeLessThanOrEqual(0);
    }
  });

  test('the three pages render without JavaScript', async ({ page }) => {
    await page.goto(HISTORY);
    await expect(page.locator('main h1')).toHaveText('History');
    await expect(page.locator('ol[data-timeline] > li[data-year]')).toHaveCount(9);
    await expect(page.locator('aside[data-sidebar="history"] h2')).toBeVisible();
    await expect(page.locator('aside[data-sidebar="history"] [data-beside]')).toHaveCount(2);
    await expect(page.locator('main [data-anatomy="sources"] li[data-source]').first()).toBeVisible();
    await page.goto(CONFUSIONS);
    await expect(page.locator('main h1')).toHaveText('Common confusions');
    await expect(page.locator('main section[data-confusion]')).toHaveCount(13);
    for (const s of await page.locator('main section[data-confusion]').all()) await expect(s.locator('h2')).toBeVisible();
    await page.goto(CREDITS);
    await expect(page.locator('main h1')).toHaveText('Credits');
    for (const id of ['wildberger', 'games', 'licences', 'bundled', 'build', 'prior-art', 'oracle']) {
      await expect(page.locator(`main section[data-credit="${id}"] h2`), id).toBeVisible();
    }
    await expect(page.locator('main [data-credit="bundled"] li[data-bundled]').first()).toBeVisible();
  });
});

test.describe('history, confusions and credits', () => {
  test('the three pages pass axe', async ({ page }) => {
    test.setTimeout(120_000);
    for (const route of THREE) {
      for (const theme of ['light', 'dark'] as const) {
        await page.goto(route);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
        const serious = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
        expect(serious, `${route}, ${theme} theme`).toEqual([]);
      }
    }
  });

  test('the three pages load no tool script', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const route of THREE) {
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
      await expect(page.locator('[data-tool]'), route).toHaveCount(0);
    }
    // The footer of every built page carries no script of its own. Every page renders it, except 404.html
    // and the /embed/<tool>/ routes of P6-A5, which render a tool alone for an iframe and need no site
    // footer (plan 5.10; review of P6-A6, blocker); where one of those has a footer, it is checked too.
    let footers = 0;
    for (const r of discoverRoutes()) {
      const html = readFileSync(r.file, 'utf8');
      const footer = /<footer[^>]*data-site-footer[\s\S]*?<\/footer>/.exec(html)?.[0];
      const optional = r.path === '404.html' || r.path.startsWith('embed/');
      if (optional && footer === undefined) continue;
      expect(footer, `${r.path} renders the footer`).toBeDefined();
      expect(footer!, r.path).not.toMatch(/<script/i);
      footers += 1;
    }
    expect(footers, 'pages with the footer').toBeGreaterThan(THREE.length);
  });

  test('no em-dash', async ({ page }) => {
    for (const route of THREE) {
      await page.goto(route);
      const body = (await page.locator('body').textContent()) ?? '';
      expect(body.includes('\u2014'), `an em-dash on ${route}`).toBe(false);
      const titles = await page.locator('main [title]').evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''));
      expect(titles.filter((t) => t.includes('\u2014')), route).toEqual([]);
    }
    for (const r of discoverRoutes()) {
      const footer = /<footer[^>]*data-site-footer[\s\S]*?<\/footer>/.exec(readFileSync(r.file, 'utf8'))?.[0] ?? '';
      expect(footer.includes('\u2014') || footer.includes('&mdash;'), `an em-dash in the footer of ${r.path}`).toBe(false);
    }
  });

  test('links resolve', async ({ page, baseURL }) => {
    const base = new URL(baseURL!);
    const seen = new Set<string>();
    for (const route of THREE) {
      await page.goto(route);
      const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
      for (const raw of hrefs) {
        if (raw.startsWith('#')) {
          await expect(page.locator(`[id="${decodeURIComponent(raw.slice(1))}"]`), `${raw} on /${route}`).toHaveCount(1);
          continue;
        }
        if (/^[a-z]+:/i.test(raw)) continue; // an address on another site
        expect(raw.startsWith(base.pathname), `${raw} on /${route} begins with the base`).toBe(true);
        const url = new URL(raw, base);
        const key = url.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        const response = await page.request.get(url.toString().replace(/#.*$/, ''));
        expect(response.status(), `${raw} from /${route}`).toBe(200);
        if (url.hash !== '') {
          const html = await response.text();
          expect(html.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `the anchor of ${raw} from /${route}`).toBe(true);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

test.describe('history', () => {
  test('history timeline is complete and in order of date', async ({ page }) => {
    await page.goto(HISTORY);
    const items = page.locator('ol[data-timeline] > li[data-year]');
    await expect(items).toHaveCount(9);
    // SPEC.md 3 M10, in its order; each entry cites at least one of its keys.
    const keys: string[][] = [
      ['Pro84'],
      ['IMO86'],
      ['Bjo88'],
      ['Moz90'],
      ['Eri92', 'Eri93', 'Eri94a', 'Eri94b', 'Eri95a', 'Eri95b', 'Eri96a', 'Eri96b'],
      ['W-MS'],
      ['Don08'],
      ['GSS12'],
      ['W20'],
    ];
    const visible = ['1984', '1986', '1988', '1990', '1992 to 1996', '2001 to 2003', '2008', '2012', '2020'];
    let last = 0;
    for (let k = 0; k < 9; k++) {
      const item = items.nth(k);
      const year = Number(await item.getAttribute('data-year'));
      expect(year, `entry ${k + 1}`).toBeGreaterThanOrEqual(last);
      last = year;
      await expect(item.locator('h3'), `entry ${k + 1}`).toContainText(visible[k]!);
      expect(visible[k]!.startsWith(String(year)), `data-year of entry ${k + 1}`).toBe(true);
      const cited = await item.locator('a.cite').evaluateAll((as) => as.map((a) => a.getAttribute('data-cite') ?? ''));
      expect(cited.some((c) => keys[k]!.includes(c)), `entry ${k + 1} cites one of ${keys[k]!.join(', ')}`).toBe(true);
    }
    // Wildberger's entry: the manuscript and a first published paper.
    const wildberger = await items.nth(5).locator('a.cite').evaluateAll((as) => as.map((a) => a.getAttribute('data-cite') ?? ''));
    expect(wildberger).toContain('W-MS');
    expect(wildberger.includes('W03a') || wildberger.includes('W03c')).toBe(true);
    // Every key cited on the page is in its list of sources, which links to the sources page.
    const all = await page.locator('main a.cite').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('data-cite') ?? ''))]);
    const listed = await page.locator('main [data-anatomy="sources"] li[data-source]').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-source') ?? ''));
    expect([...listed].sort()).toEqual([...all].sort());
    await expect(page.locator('main a[href$="sources/"]').first()).toBeVisible();
  });

  test('history sidebar', async ({ page }) => {
    await page.goto(HISTORY);
    const aside = page.locator('aside[data-sidebar="history"]');
    await expect(aside).toHaveCount(1);
    await expect(aside.locator('h2')).toHaveCount(1);
    const kostant = await textOf(page, 'aside[data-sidebar="history"] [data-beside="kostant"]', { drop: '[data-unverified]' });
    expect(kostant).toContain('attributed to Kostant');
    const satake = aside.locator('[data-beside="satake"]');
    await expect(satake.locator('h3')).toContainText('1960');
    await expect(satake.locator('h3')).toContainText('1962');
    await expect(satake.locator('a.cite[data-cite="Sat60"]')).toHaveCount(1);
    await expect(satake.locator('a.cite[data-cite="Ara62"]')).toHaveCount(1);
    // Beside the list on a wide screen; after it on a phone; no horizontal scroll at 320 pixels.
    await page.setViewportSize({ width: 1280, height: 900 });
    const ol = page.locator('ol[data-timeline]');
    let a = (await aside.boundingBox())!;
    let o = (await ol.boundingBox())!;
    expect(a.x, 'the sidebar is to the right of the list').toBeGreaterThanOrEqual(o.x + o.width - 1);
    expect(a.y, 'the sidebar starts beside the list').toBeLessThan(o.y + o.height);
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      a = (await aside.boundingBox())!;
      o = (await ol.boundingBox())!;
      expect(a.y, `the sidebar follows the list at ${width}`).toBeGreaterThanOrEqual(o.y + o.height - 1);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(scroll, `horizontal scroll at ${width}`).toBeLessThanOrEqual(0);
    }
  });

  test('credit lines on history and credits', async ({ page }) => {
    const clauses = [/mutation game is (N\. J\. )?Wildberger's/, /numbers game is Mozes'/, /Proctor's earlier use of the same process/, /Eriksson's development/, /attributed to Kostant/];
    for (const route of [HISTORY, CREDITS]) {
      await page.goto(route);
      // The credit is printed as fact: outside every wrapper of an open item.
      const text = await textOf(page, 'main', { drop: '[data-unverified], [data-anatomy="sources"]' });
      for (const c of clauses) expect(text, `${route}: ${c}`).toMatch(c);
      // No other credit of the numbers game or of Kostant's game.
      expect(text, route).not.toMatch(/numbers game is (Eriksson|Proctor)/);
      for (const s of sentences(text).filter((x) => /Kostant/.test(x))) {
        expect(s, `${route}: a sentence that credits Kostant without "attributed to"`).not.toMatch(
          /(game|it) (is|was) (Kostant's|by Kostant|due to Kostant)|Kostant (introduced|invented|published|devised|created) |by Bertram Kostant/,
        );
      }
    }
    await page.goto(HISTORY);
    const signs = await textOf(page, 'main [data-signs]');
    expect(signs).toMatch(/Proctor, Donnelly and Wildberger/);
    expect(signs).toMatch(/Eriksson, the 1986 Olympiad problem, and Gashi, Schedler and Speyer fire negative numbers/);
  });

  test('the manuscript is undated', async ({ page }) => {
    await page.goto(HISTORY);
    const ms = page.locator('ol[data-timeline] [data-source="W-MS"]');
    await expect(ms).toHaveCount(1);
    const text = await textOf(page, 'ol[data-timeline] [data-source="W-MS"]');
    expect(text).toContain('unpublished manuscript, undated (circulated c. 2001 to 2004)');
    expect(text).not.toContain('2003');
    await expect(ms.locator('a.cite[data-cite="W-MS"]')).toHaveCount(1);
    // Nowhere else on the page either (review of P6-A6, mutant MU2): no sentence that speaks of the
    // manuscript holds "2003". The heading of the entry gives the range of SPEC 3 M10, "2001 to 2003", and
    // is checked by the timeline test; the list of sources gives [W03a] and [W03c], papers of 2003.
    const whole = await textOf(page, 'main', { drop: 'ol[data-timeline] > li > h3, [data-anatomy="sources"]' });
    const aboutManuscript = sentencesOf(whole).filter((s) => /manuscript/i.test(s));
    expect(aboutManuscript.length).toBeGreaterThan(1);
    for (const s of aboutManuscript) expect(s, 'a sentence dating the manuscript 2003').not.toMatch(/2003/);
    // The confusions page corrects the date and points here.
    await page.goto(CONFUSIONS);
    const section = await textOf(page, 'section[data-confusion="manuscript-date"]');
    expect(section).toContain('undated');
    await expect(page.locator('section[data-confusion="manuscript-date"] a[href$="history/"]')).toHaveCount(1);
  });

  test('open items are wrapped on history', async ({ page }) => {
    await page.goto(HISTORY);
    for (const item of ['E2', 'E5', 'E13']) await expect(page.locator(`main [data-unverified="${item}"]`), item).not.toHaveCount(0);
    // The proposer of the 1986 problem is not named, so E11 is not used.
    await expect(page.locator('main [data-unverified="E11"]')).toHaveCount(0);
    await expect(page.locator('li[data-entry="Moz90"] [data-unverified="E2"]')).toHaveCount(1);
    // Every sentence that says something about the content of Mozes' paper sits inside an E2 wrapper:
    // outside the wrappers (and outside titles and the list of sources), no sentence naming Mozes speaks
    // of what the paper does, proves, fires or introduces.
    const outside = await textOf(page, 'main', { drop: '[data-unverified="E2"], cite, [data-anatomy="sources"]' });
    const CONTENT = /generalis|pentagon|Olympiad|negative|positive|theorem|prove|Cartan|Kac-Moody|terminat|stops|order of|length|introduc|matrix|convention/i;
    const named = sentences(outside).filter((s) => /Mozes/.test(s));
    expect(named.length).toBeGreaterThan(2);
    for (const s of named) expect(s, 'a sentence about Mozes outside an E2 wrapper').not.toMatch(CONTENT);
    // In the entry of 1990 every sentence outside the E2 wrapper is one of these four: the bibliographic
    // data, the credit, the licence of the publisher's copy and the link (review of P6-A6, mutant MU1: a
    // sentence on the paper's content moved out of the wrapper need not name Mozes). A sentence added to
    // the entry goes inside the wrapper, or is added here on purpose.
    const ALLOWED_1990 = [
      /^S\. Mozes, Reflection processes on graphs and Weyl groups, Journal of Combinatorial Theory, Series A, volume \d+, pages \d+ to \d+ \[Moz90\]\.$/,
      /^The numbers game is Mozes'\.$/,
      /^The paper is free to read in the publisher's open archive, under the publisher's own user licence, which is not a Creative Commons licence\.$/,
      /^This site links to Mozes' paper at the publisher and keeps no copy\.$/,
    ];
    const entry1990 = sentencesOf(await textOf(page, 'li[data-entry="Moz90"]', { drop: 'h3, [data-unverified="E2"]' }));
    expect(entry1990.length).toBe(ALLOWED_1990.length);
    for (const s of entry1990) expect(ALLOWED_1990.some((a) => a.test(s)), `a sentence of the entry of 1990 outside the E2 wrapper: "${s}"`).toBe(true);
    await expect(page.locator('li[data-entry="Moz90"] [data-unverified="E2"]')).toHaveText(/\S/);
    // Every video is linked inside an E5 wrapper, and never embedded.
    const videos = page.locator('main a[href*="youtube."], main a[href*="youtu.be"], main a[href*="vimeo."]');
    expect(await videos.count()).toBeGreaterThan(0);
    for (const v of await videos.all()) expect(await v.evaluate((a) => a.closest('[data-unverified="E5"]') !== null)).toBe(true);
    await expect(page.locator('main iframe, main video')).toHaveCount(0);
    // The fuller attribution of Kostant's game is inside an E13 wrapper.
    const kostant = await textOf(page, 'main', { drop: '[data-unverified="E13"], [data-anatomy="sources"]' });
    expect(kostant).not.toMatch(/Knutson|Postnikov|Bertram/);
    const wrapped = await textOf(page, 'main [data-unverified="E13"]');
    expect(wrapped).toMatch(/Knutson/);
  });

  test('each entry says which sign its source fires', async ({ page }) => {
    // SPEC.md 2.3 and 2.9: Proctor, Donnelly and Wildberger fire positive numbers; the 1986 Olympiad problem,
    // Eriksson, and Gashi, Schedler and Speyer fire negative numbers. Mozes' convention rests on open item
    // E2 and is not checked here. (Review of P6-A6, mutant MU7: Proctor's own entry made to fire negative.)
    await page.goto(HISTORY);
    const SIGN: Record<string, 'positive' | 'negative'> = {
      Pro84: 'positive',
      IMO86: 'negative',
      Eri: 'negative',
      'W-MS W03a W03c': 'positive',
      Don08: 'positive',
      GSS12: 'negative',
    };
    for (const [entry, sign] of Object.entries(SIGN)) {
      const text = await textOf(page, `ol[data-timeline] > li[data-entry="${entry}"]`, { drop: '[data-unverified]' });
      const said = [...text.matchAll(/\bfir(?:e|es|ed|ing) (positive|negative) numbers|\bonly (positive|negative) firings/g)].map((m) => m[1] ?? m[2]);
      expect(said.length, `the entry ${entry} says which sign its source fires`).toBeGreaterThan(0);
      expect(said.filter((s) => s !== sign), `the entry ${entry}: its source fires ${sign} numbers`).toEqual([]);
    }
  });

  test('history reports its sources as SOURCES.md does', async ({ page }) => {
    await page.goto(HISTORY);
    // [W20] states the Mutation Conjecture in its section 2, on page 57 of pages 55 to 78 (SOURCES.md 11.1;
    // SPEC.md 2.11). Review of P6-A6: "near its end" was false.
    const w20 = sentencesOf(await textOf(page, 'li[data-entry="W20"]', { drop: 'h3' })).filter((s) => /Mutation Conjecture/.test(s));
    expect(w20.length).toBeGreaterThan(0);
    for (const s of w20) {
      expect(s).toMatch(/\bsection 2\b/);
      expect(s).toMatch(/\b(?:page|p\.) 57\b/);
      expect(s).not.toMatch(/\b(?:end|last|close|closing|final)\b/i);
    }
    // [Don08] states strong convergence as its Theorem 2.1; it does not prove it there, and the theorem is
    // attributed to Mozes and Eriksson (SPEC.md 2.7 F3, [S2]), the attribution to Mozes inside open item E2.
    const don = await textOf(page, 'li[data-entry="Don08"]', { drop: 'h3' });
    expect(don).toMatch(/\bstates strong convergence[^.]*Theorem 2\.1/);
    expect(don).not.toMatch(/\bprov(?:es|ed|ing|e) strong convergence/);
    await expect(page.locator('li[data-entry="Don08"] [data-unverified="E2"]')).toHaveCount(1);
    expect(await textOf(page, 'li[data-entry="Don08"]', { drop: '[data-unverified="E2"]' })).not.toMatch(/Mozes/);
    // [Sat60] and [Ara62] were not read: what each contains is reported by later papers (SOURCES.md 11.4,
    // [S2]). Review of P6-A6: Araki's table was stated as fact.
    const beside = sentencesOf(await textOf(page, 'aside [data-beside="satake"]', { drop: 'h3' })).filter((s) => /Satake's paper|Araki/.test(s));
    expect(beside.length).toBeGreaterThanOrEqual(2);
    for (const s of beside) expect(s, 'a sentence on an unread paper that is not reported').toMatch(/\breported\b/);
  });
});

test.describe('confusions', () => {
  const IDS = [
    'board-fixed',
    'mutation-rule',
    'not-the-same-game',
    'no-sign-condition',
    'weyl-group-positions',
    'lattices',
    'weight-lattice-formula',
    'b-c-naming',
    'one-way-not-finite',
    'roots-positive-or-negative',
    'positive-definite',
    'e8-orthogonal-group',
    'manuscript-date',
  ];

  test('confusions covers Appendix D and F', async ({ page }) => {
    await page.goto(CONFUSIONS);
    const ids = await page.locator('main section[data-confusion]').evaluateAll((ss) => ss.map((s) => s.getAttribute('data-confusion') ?? ''));
    expect(ids).toEqual(IDS);
    for (const id of IDS) {
      const text = await textOf(page, `section[data-confusion="${id}"]`);
      expect(text, id).toMatch(/It is sometimes said that/);
      expect(text, id).toMatch(/In fact/);
    }
    // The first correction links to the comparison of the two operations rather than repeating it.
    await expect(page.locator('section[data-confusion="board-fixed"] a[href$="not-quiver-mutation/"]')).toHaveCount(1);
    await expect(page.locator('section[data-confusion="board-fixed"] a.cite[data-cite="W20"]')).toHaveCount(1);
    await expect(page.locator('main table')).toHaveCount(0);
    const rule = await textOf(page, 'section[data-confusion="mutation-rule"]', { bare: true });
    expect(rule).toContain('x\\mapsto x-x_iC^{\\mathsf T}e_i');
    expect(rule).toContain('x_i\\mapsto x_i-\\sum_jC_{ij}x_j');
    // Positions of the numbers game: the Weyl group; roots: the mutation game.
    expect(await textOf(page, 'section[data-confusion="weyl-group-positions"]')).toMatch(/Weyl group/);
    expect(await textOf(page, 'section[data-confusion="lattices"]')).toMatch(/root lattice[\s\S]*weight lattice/);
    // Wildberger's B3 through the golden data, and the site's names are Bourbaki's.
    await expect(page.locator('section[data-confusion="b-c-naming"] [data-golden="wildberger_lists.names.B3"]')).toHaveCount(1);
    expect(await textOf(page, 'section[data-confusion="b-c-naming"]')).toMatch(/Bourbaki's names and numbering/);
    // The one-way board through the golden data.
    for (const k of ['one_way_counterexample.start', 'one_way_counterexample.result']) {
      await expect(page.locator(`section[data-confusion="one-way-not-finite"] [data-golden="${k}"]`), k).toHaveCount(1);
    }
    expect(await textOf(page, 'section[data-confusion="positive-definite"]')).toMatch(/\$B_n\$, \$C_n\$[\s\S]*\$F_4\$, \$G_2\$/);
  });

  test('confusions makes no reference to the note', async ({ page }) => {
    await page.goto(CONFUSIONS);
    const text = (await textOf(page, 'main')).toLowerCase();
    // D16 is about wording: no word that points at a particular document, earlier write-up or source of the
    // statements (review of P6-A6, mutant MU4: "An earlier write-up prepared for this site ..."). RT-08
    // reads the rest.
    const POINTERS = [
      'algebraic data', 'the note', 'a note', 'project note', 'project', 'mutation-game', 'mutation_game', 'cortis', 'package', 'python',
      'write-up', 'writeup', 'written up', 'earlier', 'previous', 'document', 'draft', 'memo', 'handout', 'specification', 'prepared for', 'written for this site', 'made for this site',
    ];
    for (const s of POINTERS) expect(text.includes(s), `"${s}" on the confusions page`).toBe(false);
    const hrefs = await page.locator('main a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.filter((h) => /pypi|readthedocs|andreacortis|mutation_game|mutation-game/.test(h))).toEqual([]);
  });

  test('golden number and E17 on confusions', async ({ page }) => {
    await page.goto(CONFUSIONS);
    const section = page.locator('section[data-confusion="e8-orthogonal-group"]');
    const order = section.locator('[data-golden="types.E8.weyl_order"]');
    expect(await order.count()).toBeGreaterThan(0);
    for (const g of await order.all()) {
      expect(await g.evaluate((el) => el.closest('[data-unverified]') === null), 'the order lies outside every wrapper').toBe(true);
      expect(((await g.textContent()) ?? '').replace(/\D/g, '')).toBe(String(GOLDEN.types.E8!.weyl_order));
    }
    await expect(section.locator('[data-unverified="E17"]')).toHaveCount(1);
    const outside = await textOf(page, 'section[data-confusion="e8-orthogonal-group"]', { drop: '[data-unverified="E17"]' });
    expect(outside).not.toMatch(/orthogonal|factor of|isomorphic/i);
    const inside = await textOf(page, 'section[data-confusion="e8-orthogonal-group"] [data-unverified="E17"]');
    expect(inside).toMatch(/orthogonal group over the field of two elements/);
  });

  test('confusions bridge sentence', async ({ page }) => {
    await page.goto(CONFUSIONS);
    const text = await textOf(page, 'section[data-confusion="not-the-same-game"]', { bare: true });
    expect(text).toContain('CS_i=R_iC');
    expect(text).toContain('R_i(C)=S_i(C^{\\mathsf T})^{\\mathsf T}');
    expect(text).toMatch(/translate a population p into the position a=Cp/i);
    expect(text).toContain(BRIDGE);
    // Every section that shows a population beside its numbers (a=Cp) carries the bridge sentence.
    for (const id of IDS) {
      const t = await textOf(page, `section[data-confusion="${id}"]`, { bare: true });
      if (t.includes('a=Cp')) expect(t, id).toContain(BRIDGE);
    }
  });
});

test.describe('credits', () => {
  test('credits acknowledges Wildberger first and states the licences', async ({ page }) => {
    await page.goto(CREDITS);
    const order = await page.locator('main [data-credit]').evaluateAll((els) => els.map((e) => e.getAttribute('data-credit') ?? ''));
    expect(order[0]).toBe('wildberger');
    // The first section under the title.
    const first = await page.locator('main h1 ~ *').first().getAttribute('data-credit');
    expect(first).toBe('wildberger');
    const story = await textOf(page, 'main [data-credit="wildberger"]');
    for (const w of ['mutation game', 'Martians', 'anti-Martians', 'Mars', 'Venus', 'city', 'population', 'dual game']) expect(story, w).toContain(w);
    for (const k of ['W20', 'W-MS']) await expect(page.locator(`main [data-credit="wildberger"] a.cite[data-cite="${k}"]`), k).not.toHaveCount(0);
    const licences = page.locator('main [data-credit="licences"]');
    await expect(licences.locator('[data-licence="content"]')).toHaveText(CONTENT_SPDX);
    await expect(licences.locator('[data-licence="code"]')).toHaveText(CODE_SPDX);
    await expect(licences).toContainText('Code samples shown in the text fall under the code licence.');
    await expect(licences.locator('a[href$="/LICENSE"]')).toHaveCount(1);
    await expect(licences.locator('a[href$="/LICENSE-content"]')).toHaveCount(1);
  });

  test('credits lists bundled libraries with title, author, source, licence', async ({ page }) => {
    await page.goto(CREDITS);
    const shipped = readShippedPackages(shippedPackagesFile(SITE_DIR, DIST));
    expect(shipped, 'the build writes the list of bundled packages').not.toBeNull();
    // Every package whose code the build ships, the island loader of astro and KaTeX's stylesheet and fonts.
    const bundled = [...new Set([...shipped!.map((p) => p.name), 'astro', 'katex'])];
    for (const name of bundled) {
      const item = page.locator(`main [data-credit="bundled"] li[data-bundled="${name}"]`);
      await expect(item, name).toHaveCount(1);
      const pkg = installed(name);
      await expect(item.locator('[data-field="title"]'), name).toHaveText(name);
      await expect(item.locator('[data-field="version"]'), name).toHaveText(pkg.version!);
      await expect(item.locator('[data-field="author"]'), name).toHaveText(/\S/);
      await expect(item.locator('[data-field="source"]'), name).toHaveText(/\S/);
      await expect(item.locator('[data-field="licence"]'), name).toHaveText(String(pkg.license));
    }
    // The fonts: KaTeX's, with the licence read from the installed package.
    const fonts = await textOf(page, 'main [data-credit="bundled"] [data-fonts]');
    expect(fonts).toContain('KaTeX');
    expect(fonts).toContain(String(installed('katex').license));
    // The pinned build and test packages of 7.1 and the mathematics route, each with its licence as read
    // (they are not all MIT). Astro and KaTeX are listed among the bundled packages above.
    const BUILD = ['@astrojs/mdx', '@astrojs/svelte', 'typescript', 'vitest', 'fast-check', '@playwright/test', '@axe-core/playwright', '@astrojs/markdown-remark', 'remark-math', 'rehype-katex'];
    const licencesSeen = new Set<string>();
    for (const name of BUILD) {
      const pkg = installed(name);
      const where = (await page.locator(`main [data-credit="bundled"] li[data-bundled="${name}"]`).count()) > 0 ? 'bundled' : 'build';
      const item = page.locator(`main [data-credit="${where}"] li[data-${where}="${name}"]`);
      await expect(item, name).toHaveCount(1);
      await expect(item.locator('[data-field="version"]'), name).toHaveText(pkg.version!);
      await expect(item.locator('[data-field="licence"]'), name).toHaveText(String(pkg.license));
      licencesSeen.add(String(pkg.license));
      // The generated table of P1-A4 says the same.
      await expect(page.locator(`tr[data-package="${name}"] [data-licence]`), name).toHaveText(String(pkg.license));
    }
    expect(licencesSeen.size, 'licences read, not assumed to be MIT').toBeGreaterThan(1);
    // No author string printed with an em-dash.
    const authors = await page.locator('main [data-field="author"]').allTextContents();
    expect(authors.filter((a) => a.includes('\u2014'))).toEqual([]);
  });

  test('credits states the oracle rule', async ({ page }) => {
    await page.goto(CREDITS);
    const oracle = await textOf(page, 'main [data-credit="oracle"]');
    expect(oracle).toMatch(/Reference software, such as SageMath, CoReLG, [^;]*Group Explorer, is used only as a black-box source of test data; its source code is not translated\./);
    expect(oracle).toMatch(/software under the GPL or LGPL/);
    expect(oracle).toMatch(/reference\/lie_games\.py/);
    expect(oracle).toMatch(/reference\/verify\.py/);
    // The licence of CoReLG is [U] (SPEC.md Appendix F; Appendix E item 17): no sentence that names CoReLG
    // names a licence outside an E17 wrapper (review of P6-A6).
    const outsideE17 = await textOf(page, 'main', { drop: '[data-unverified="E17"]' });
    for (const s of sentencesOf(outsideE17).filter((x) => /CoReLG/.test(x))) {
      expect(s, 'a licence stated for CoReLG').not.toMatch(/\b(?:A?GPL|LGPL|GNU|MIT|LPPL|licen[cs]ed?|free software)\b/i);
    }
    // The outside checks of the reference data, as SOURCES.md 11.4 and 11.5 give them (review of P6-A6):
    // SageMath on the four reference Cartan matrices and the numbering of the nodes; the black nodes and
    // arrows of the Satake catalogue against [DM22] and the codes of dynkin-diagrams; other sources.
    const sage = await textOf(page, 'main [data-credit="oracle"] [data-oracle="sagemath"]');
    expect(sage).toMatch(/SageMath was run/);
    expect(sage).toMatch(/\$B_2\$, \$C_2\$, \$G_2\$ and \$F_4\$/);
    expect(sage).toMatch(/numbering of the nodes/);
    expect(sage).not.toMatch(/boards of finite type/);
    const satake = page.locator('main [data-credit="oracle"] [data-oracle="satake-catalogue"]');
    await expect(satake.locator('a.cite[data-cite="DM22"]')).toHaveCount(1);
    await expect(satake).toContainText('dynkin-diagrams');
    await expect(satake.locator('a[href$="sources/"]')).toHaveCount(1);
    expect(oracle).not.toMatch(/\bTwo outside works\b/);
  });

  test('credits lists borrowed prior art', async ({ page }) => {
    // The rows of SPEC.md Appendix F whose "Borrow" cell is not empty, by the plan's slugs, with their titles
    // and authors as Appendix F writes them (checked against SPEC.md below).
    const ROWS: Record<string, string[]> = {
      'ade-concurrent-game': ['"ADE Concurrent Game"', "on Wildberger's UNSW pages under the name of T. S. Hoang"],
      'mutation-explorer': ['GEOMETOR "Mutation Explorer" (2021)'],
      'mutation-game': ['`mutation-game`, A. Cortis (April 2026)'],
      'cut-the-knot': ['cut-the-knot page for the pentagon problem'],
      keller: ['B. Keller, quiver mutation applet'],
      langlands: ['Langlands Programs preview, Coxeter apps'],
      'group-explorer': ['Group Explorer 3'],
      simplie: ['SimpLie (T. Nutma)'],
      'stembridge-vogan': ["Stembridge's Coxeter plane pictures; Vogan's explanation of the $E_8$ picture"],
      'polytope-viewers': ['Stella4D; Jenn3d; Polyhedra Viewer; vZome'],
      corelg: ['CoReLG (GAP)'],
      'dynkin-diagrams': ['`dynkin-diagrams` (LaTeX)'],
      sagemath: ['SageMath root systems and crystals'],
    };
    const spec = readFileSync(join(ROOT, 'SPEC.md'), 'utf8');
    const appendixF = spec.slice(spec.indexOf('## Appendix F. Prior art'), spec.indexOf('## Appendix G.'));
    for (const strings of Object.values(ROWS)) for (const s of strings) expect(appendixF, s).toContain(s);
    const fragment = readFileSync(join(ROOT, 'decisions', 'P6-A6.md'), 'utf8');
    for (const slug of Object.keys(ROWS)) expect(fragment, `decisions/P6-A6.md records the row ${slug}`).toContain(`\`${slug}\``);
    await page.goto(CREDITS);
    const items = page.locator('main [data-credit="prior-art"] li[data-prior-art]');
    expect(await items.count()).toBeGreaterThan(0);
    for (const item of await items.all()) {
      const slug = (await item.getAttribute('data-prior-art')) ?? '';
      expect(Object.keys(ROWS), slug).toContain(slug);
      const text = await item.evaluate((el) => {
        const copy = el.cloneNode(true) as HTMLElement;
        for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(`$${k.querySelector('annotation')?.textContent ?? ''}$`));
        for (const c of copy.querySelectorAll('code')) c.replaceWith(document.createTextNode(`\`${c.textContent ?? ''}\``));
        return (copy.textContent ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
      });
      for (const s of ROWS[slug]!) expect(text, slug).toContain(s);
      expect(fragment).toMatch(new RegExp(`\`${slug}\`[^\\n]*credited`));
    }
    const ade = await textOf(page, 'main [data-credit="prior-art"] li[data-prior-art="ade-concurrent-game"]');
    expect(ade).not.toMatch(/\bby T\. S\. Hoang/);
    // The statements of Appendix F marked [U] (the applets do not run in current browsers; nothing was
    // found) are not printed outside an E17 wrapper, in any wording (review of P6-A6, mutant MU5: "Its
    // applets no longer work in current browsers."): no such phrase, and no sentence on an applet that
    // speaks of running, working, loading or browsers.
    const outside = await textOf(page, 'main', { drop: '[data-unverified="E17"]' });
    expect(outside).not.toMatch(
      /no longer (?:run|work|load)|(?:do|does|did|will|would) not (?:run|work|load)|n't (?:run|work|load)|cannot (?:run|work|load)|fails? to (?:run|work|load)|(?:current|modern|today's) browsers|obsolete|nothing like|nothing similar|first of its kind|(?:was|were) found|not found/i,
    );
    for (const s of sentencesOf(outside).filter((x) => /applet/i.test(x))) {
      expect(s, 'a sentence on the state of an applet outside E17').not.toMatch(/\b(?:run|runs|ran|running|work|works|worked|working|load|loads|loaded|browser|browsers|plug-?ins?)\b/i);
    }
    // The tools offer Export LaTeX (P6-A5, SPEC.md 6.7): the idea is SimpLie's and its target is the package
    // dynkin-diagrams, both "Borrow" cells of Appendix F, so both are credited (review of P6-A6).
    if (discoverRoutes().some((r) => /data-control="latex"/.test(readFileSync(r.file, 'utf8')))) {
      expect(await textOf(page, 'main li[data-prior-art="simplie"]')).toMatch(/LaTeX[\s\S]*Export LaTeX/);
      await expect(page.locator('main li[data-prior-art="dynkin-diagrams"]')).toHaveCount(1);
      expect(await textOf(page, 'main li[data-prior-art="dynkin-diagrams"]')).toMatch(/target of the button Export LaTeX/);
    }
  });

  test('the credits page says truly which pages link the videos', async ({ page }) => {
    // SPEC.md 7.3 (a fallback stays true) and 7.9: the sentence of the section on linked videos names a page
    // exactly when that page links a video in this build. In a release build the history page drops its
    // video links (open item E5), so the sentence must not name it there (review of P6-A6).
    await page.goto(CREDITS);
    const note = await textOf(page, 'main [data-credit="assets"]', { drop: 'h2, ul' });
    for (const [name, route] of [['history', HISTORY], ['sources', 'sources/']] as const) {
      const named = new RegExp(`\\b${name} page\\b`).test(note);
      const links = builtHtml(route).match(VIDEO_LINK) ?? [];
      expect(named, `the credits page names the ${name} page as linking videos, and it links ${links.length}`).toBe(links.length > 0);
    }
  });

  test('third-party assets are credited and no video is re-hosted', async ({ page }) => {
    // Every page of the built site, and every content source, for embedded players, videos, video links
    // and images other than the site's own icons.
    const found = new Map<string, string>();
    for (const r of discoverRoutes()) {
      const html = readFileSync(r.file, 'utf8');
      if (/<iframe\b|<video\b/i.test(html)) found.set(`embed on ${r.path}`, r.path);
      for (const m of html.matchAll(/href="(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^"]*)"/g)) found.set(m[1]!.replace(/&amp;/g, '&'), r.path);
      // An image from another site; the site's own drawings are written at build time.
      for (const m of html.matchAll(/<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/g)) found.set(m[1]!, r.path);
    }
    const embeds = [...found.keys()].filter((k) => k.startsWith('embed on '));
    expect(embeds, 'no page embeds a player or a video').toEqual([]);
    await page.goto(CREDITS);
    for (const [asset, where] of found) {
      const item = page.locator(`main [data-credit="assets"] [data-asset="${asset}"]`);
      await expect(item, `${asset} (on ${where}) is credited`).toHaveCount(1);
      for (const field of ['title', 'author', 'source', 'licence']) await expect(item.locator(`[data-field="${field}"]`), `${asset}: ${field}`).toHaveText(/\S/);
    }
    // No video file in the public directory or the build.
    const walk = (dir: string): string[] =>
      existsSync(dir) ? readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)])) : [];
    const videos = [...walk(join(SITE_DIR, 'public')), ...walk(DIST)].filter((f) => /\.(mp4|webm|mov)$/i.test(f));
    expect(videos).toEqual([]);
  });
});
