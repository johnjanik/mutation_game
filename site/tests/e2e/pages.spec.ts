// P1-A4: the pages of phase 1 other than lessons and tools (SPEC.md 7.3), the navigation and footer,
// the released flag, the lesson layout on the development page dev/lesson-check (released: false),
// and the theme switch. Runs against astro preview of the built site (playwright.config.ts).
// Hooks read: data-anatomy, data-challenge, data-met, data-challenge-result, data-tool,
// data-instance, data-moves, data-node, data-board, data-value (the stand-in tool of the dev page),
// data-item, data-field, data-theme-switch, data-versions; ids of glossary terms, source keys and
// open items. Paths are relative to baseURL, so the spec also holds under a base path.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { outDirFrom } from '../../astro.config.mjs';
import { routesOf } from '../../../scripts/size.mjs';

const SITE_DIR = resolve(import.meta.dirname, '../..');
const ROOT = resolve(SITE_DIR, '..');
const DIST = resolve(SITE_DIR, outDirFrom(process.env));

const PAGES = [
  { name: 'about', path: 'about/', h1: 'About' },
  { name: 'credits', path: 'credits/', h1: 'Credits' },
  { name: 'glossary', path: 'glossary/', h1: 'Glossary' },
  { name: 'sources', path: 'sources/', h1: 'Sources' },
  { name: 'module index', path: 'modules/', h1: 'Modules' },
  { name: 'open-items', path: 'open-items/', h1: 'Open items' },
];

/** The citation keys of SOURCES.md, as **[KEY]** markers (status labels are not keys). */
function sourceKeys(): string[] {
  const text = readFileSync(join(ROOT, 'SOURCES.md'), 'utf8');
  const found = [...text.matchAll(/\*\*\[([A-Za-z][A-Za-z0-9+-]*)\]\*\*/g)].map((m) => m[1]!);
  return [...new Set(found)].filter((k) => !['S', 'S2', 'V', 'U', 'D'].includes(k));
}

/** The ids of Appendix E, from unverified.json. */
function itemIds(): string[] {
  return (JSON.parse(readFileSync(join(SITE_DIR, 'src', 'content', 'unverified.json'), 'utf8')) as { id: string }[]).map((i) => i.id);
}

/** Routes of the built site relative to the base ('' for the index). */
function builtRoutes(): string[] {
  return routesOf(DIST).map((r: { route: string }) => r.route.replace(/^\//, ''));
}

test.describe('pages', () => {
  test('pages render', async ({ page }) => {
    for (const p of PAGES) {
      const response = await page.goto(p.path);
      expect(response?.status(), p.name).toBe(200);
      await expect(page.locator('main h1'), p.name).toHaveText(p.h1);
      await expect(page.locator('nav[aria-label="Site"]'), p.name).toHaveCount(1);
      await expect(page.locator('footer nav[aria-label="Footer"]'), p.name).toHaveCount(1);
      await expect(page.locator('footer'), p.name).toContainText('CC-BY-SA-4.0');
      await expect(page.locator('footer'), p.name).toContainText('AGPL-3.0-only');
      await expect(page.locator('footer [data-versions]'), p.name).toHaveCount(1);
      await expect(page.locator('main footer'), p.name).toHaveCount(0);
    }
    await page.goto('modules/');
    // MERGE, G1: the index lists the released modules, or says that none is published yet (true before M0).
    await expect(page.locator('main')).toContainText(/No module is published yet\.|Start here: two games, one board/);
    await page.goto('credits/');
    await expect(page.locator('tr[data-package="katex"] [data-licence]')).toHaveText('MIT');
    await expect(page.locator('main')).toContainText('used only as a black-box source of test data');
  });

  test('sources: every key of SOURCES.md has an anchor', async ({ page }) => {
    await page.goto('sources/');
    const keys = sourceKeys();
    expect(keys.length).toBeGreaterThan(80);
    for (const k of keys) await expect(page.locator(`[id="${k}"]`), k).toHaveCount(1);
    // A <Cite> link from another page lands on its entry.
    await page.goto('about/');
    const cite = page.locator('a[data-cite="W20"]').first();
    const href = await cite.getAttribute('href');
    expect(href).toMatch(/sources#W20$/);
    await cite.click();
    await expect(page.locator('[id="W20"]')).toBeVisible();
  });

  test('sources: unpublished sections absent', async ({ page }) => {
    await page.goto('sources/');
    const main = page.locator('main');
    for (const absent of ['How to read this section', 'Related interactive work surveyed', 'Technology and standards', 'Corrections to citations']) {
      await expect(main).not.toContainText(absent);
    }
    for (const h of ['11.1 ', '11.2 ', '11.3 ', '11.4 ', '11.5 ', '11.6 ']) await expect(page.locator('main h2', { hasText: h })).toHaveCount(1);
    await expect(main).not.toContainText('[S]');
    await expect(main).not.toContainText('[U]');
    await expect(main).toContainText('(read in the source');
  });

  test('sources: MathML present', async ({ page }) => {
    await page.goto('sources/');
    expect(await page.locator('main math').count()).toBeGreaterThan(150);
    await expect(page.locator('main math annotation[encoding="application/x-tex"]').first()).not.toBeEmpty();
    const html = await (await page.request.get('sources/')).text();
    expect(html).not.toMatch(/\$[^$<]+\$/);
  });

  test('glossary: one anchor per term', async ({ page }) => {
    await page.goto('glossary/');
    await expect(page.locator('dl.glossary > div.entry')).toHaveCount(26);
    for (const id of ['board', 'node', 'city', 'the-translator', 'kostants-game', 'folded-board']) await expect(page.locator(`dfn[id="${id}"]`)).toHaveCount(1);
    expect(await page.locator('dl.glossary math').count()).toBeGreaterThan(20);
  });

  test('no link anywhere targets dev/math-check', async ({ page, baseURL }) => {
    const routes = builtRoutes();
    // The test visits every built route, so its time limit grows with them (MERGE's ruling after the Atlas
    // took the routes from 51 to 88; P6-A4's repair): one second per route, never less than the default 30 s.
    test.setTimeout(Math.max(30_000, routes.length * 1_000));
    expect(routes).toContain('dev/math-check/');
    expect(routes).toContain('dev/lesson-check/');
    for (const route of routes) {
      await page.goto(route);
      const here = page.url().replace(/#.*$/, '');
      const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
      for (const h of hrefs) {
        if (h.replace(/#.*$/, '') === here) continue; // a fragment of the page itself (the skip link)
        expect(h, `link on /${route}`).not.toContain(`${new URL(baseURL!).pathname}dev/`);
      }
    }
  });

  test('internal links resolve', async ({ page, baseURL }) => {
    const base = new URL(baseURL!);
    const seen = new Set<string>();
    for (const route of [...PAGES.map((p) => p.path), '', 'dev/lesson-check/']) {
      await page.goto(route);
      const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
      for (const raw of hrefs) {
        if (raw.startsWith('#')) continue;
        if (/^[a-z]+:/i.test(raw)) continue; // an absolute URL to another site
        // An internal link begins with the configured base, never with a bare slash.
        expect(raw.startsWith(base.pathname), `${raw} on /${route}`).toBe(true);
        const url = new URL(raw, base).toString().replace(/#.*$/, '');
        if (seen.has(url)) continue;
        seen.add(url);
        const response = await page.request.get(url);
        expect(response.status(), `${url} from /${route}`).toBe(200);
      }
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  test('nav by keyboard', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('about/');
    const names = await page.locator('nav[aria-label="Site"] a').allTextContents();
    // The Atlas index is in the navigation exactly when the Atlas pages exist (P6-A4's repair, on MERGE's behalf).
    const atlas = builtRoutes().includes('atlas/');
    expect(names).toEqual(['Home', 'Modules', ...(atlas ? ['Atlas'] : []), 'Glossary', 'Sources', 'About', 'Credits']);
    await page.keyboard.press('Tab'); // the skip link
    await expect(page.locator('.skip-link')).toBeFocused();
    for (const name of names) {
      await page.keyboard.press('Tab');
      const focused = page.locator('nav[aria-label="Site"] a:focus');
      await expect(focused).toHaveText(name);
      const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline, `focus ring on ${name}`).not.toBe('none');
    }
    // Back to Glossary and follow it with Enter.
    await page.goto('about/');
    await page.keyboard.press('Tab');
    for (let k = 0; k <= names.indexOf('Glossary'); k++) await page.keyboard.press('Tab');
    await expect(page.locator('nav[aria-label="Site"] a:focus')).toHaveText('Glossary');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new URL('glossary/', baseURL!).toString());
    await expect(page.locator('main h1')).toHaveText('Glossary');
    await expect(page.locator('nav[aria-label="Site"] a[aria-current="page"]')).toHaveText('Glossary');
  });

  test('theme switch by keyboard', async ({ page }) => {
    await page.goto('about/');
    const button = page.locator('[data-theme-switch]');
    await expect(button).toBeEnabled();
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(before).toBeNull();
    const pressedBefore = await button.getAttribute('aria-pressed');
    await button.focus();
    await page.keyboard.press('Enter');
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(after).toBe(pressedBefore === 'true' ? 'light' : 'dark');
    await expect(button).toHaveAttribute('aria-pressed', after === 'dark' ? 'true' : 'false');
    await page.reload();
    await expect(page.locator('[data-theme-switch]')).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(after);
    expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe(after);
  });

  test('open-items lists every item with its anchor', async ({ page }) => {
    await page.goto('open-items/');
    const ids = itemIds();
    expect(ids.length).toBeGreaterThanOrEqual(17);
    for (const id of ids) {
      const item = page.locator(`li[id="${id}"]`);
      await expect(item, id).toHaveCount(1);
      await expect(item.locator('[data-field="status"]'), id).toHaveText(/open|closed on/);
      await expect(item.locator('[data-field="statement"]'), id).not.toBeEmpty();
      await expect(item.locator('[data-field="where"]'), id).not.toBeEmpty();
      await expect(item.locator('[data-field="gate"]'), id).toHaveText(/^G\d$/);
      await expect(item.locator('[data-field="pages"]'), id).not.toBeEmpty();
    }
    await expect(page.locator('main h2', { hasText: 'What a person still has to check' })).toHaveCount(1);
    // In a preview build the footer links here.
    await expect(page.locator('footer a', { hasText: 'Open items' })).toHaveCount(1);
  });

  test('open-items absent in a release build', () => {
    test.setTimeout(300_000);
    const out = mkdtempSync(join(tmpdir(), 'p1a4-release-'));
    const reports = mkdtempSync(join(tmpdir(), 'p1a4-reports-'));
    try {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
      Object.assign(env, { RELEASE: '1', OUT_DIR: out, OPEN_ITEMS_REPORT_DIR: reports });
      const child = spawnSync(process.execPath, [join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], { cwd: SITE_DIR, env, encoding: 'utf8', timeout: 240_000 });
      expect(child.status, `${child.stdout}${child.stderr}`).toBe(0);
      expect(existsSync(join(out, 'about', 'index.html'))).toBe(true);
      expect(existsSync(join(out, 'open-items'))).toBe(false);
      for (const { file } of routesOf(out)) {
        expect(readFileSync(file, 'utf8'), file).not.toMatch(/href="[^"]*open-items/);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
      rmSync(reports, { recursive: true, force: true });
    }
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript', async ({ page }) => {
    await page.goto('about/');
    await expect(page.locator('main')).toContainText('connects two elementary games to Lie theory');
    await expect(page.locator('main ol li')).toHaveCount(7);
    await page.goto('credits/');
    await expect(page.locator('tr[data-package="astro"]')).toHaveCount(1);
    await page.goto('glossary/');
    await expect(page.locator('dl.glossary dfn[id="board"]')).toBeVisible();
    expect(await page.locator('main math').count()).toBeGreaterThan(20);
    await page.goto('sources/');
    await expect(page.locator('[id="W20"]')).toBeVisible();
    expect(await page.locator('main math').count()).toBeGreaterThan(150);
    await page.goto('modules/');
    // MERGE, G1: the index lists the released modules, or says that none is published yet (true before M0).
    await expect(page.locator('main')).toContainText(/No module is published yet\.|Start here: two games, one board/);
    await page.goto('open-items/');
    await expect(page.locator('li[id="E1"] [data-field="statement"]')).toBeVisible();
    // The theme switch is present and disabled until its script runs.
    await expect(page.locator('[data-theme-switch]')).toBeDisabled();
    // The lesson layout reads completely: the challenge's goal and its <details> explanation.
    await page.goto('dev/lesson-check/');
    await expect(page.locator('[data-anatomy="title"]')).toBeVisible();
    await expect(page.locator('[data-challenge]').first()).toContainText('Reach the population (1, 1, 0).');
    await expect(page.locator('[data-challenge] details').first()).toHaveCount(1);
    await expect(page.locator('[data-challenge-result]')).toHaveCount(0);
  });

  // regression: RT-FIX residual (round 1 confirmer of the pages cluster)
  test('credits: no cell of the table shows raw Markdown', async ({ page }) => {
    // Observed at 51a7e26: svelte's "Author and source" cell printed
    // "Copyright (c) 2016-2025 [Svelte Contributors](https://github.com/sveltejs/svelte/graphs/contributors)".
    await page.goto('credits/');
    const cells = await page.locator('[data-out="creditsTable"] :is(th, td)').allTextContents();
    expect(cells.length).toBeGreaterThan(25);
    const raw = cells.map((c) => c.replace(/\s+/g, ' ').trim()).filter((c) => /\[[^\]]*\]\([^)]*\)|\]\(|<https?:|\*\*/.test(c));
    expect(raw).toEqual([]);
    await expect(page.locator('tr[data-package="svelte"] td').nth(2)).toContainText(/Copyright \(c\) \d{4}-\d{4} Svelte Contributors/);
  });

  // regression: P3-RT-08-03 (sibling, red-team round 1 confirmers)
  test('every <Cite> title and Sources entry on every route reads as a plain bibliographic line', async ({ page }) => {
    test.setTimeout(180_000);
    // What must not reach a printed entry or a title, outside its mathematics (the patterns of
    // site/tests/unit/sources-cite-title-labels.test.ts, read here from the built pages).
    const DEBRIS: [string, RegExp][] = [
      ['a backtick', /`/],
      ['raw Markdown', /\*\*|\]\(|<https?:|https?:\/\//],
      ['a label or colon followed by nothing', /:\s*(?:[.,;)]|$)/],
      ['a space before punctuation (a removed link)', /\s[.,;:]/],
      ['a lead-in left with no link', /\b(?:at|page|Free|Preprint|Solutions|sheet|record)\s*[.:]?$/],
      ['"link not re-checked"', /link not re-checked/i],
      ['"Project file"', /Project file/i],
    ];
    const debris = (t: string): string[] => DEBRIS.filter(([, re]) => re.test(t)).map(([name]) => name);
    const cited = routesOf(DIST).filter((r: { file: string }) => /class="cite"/.test(readFileSync(r.file, 'utf8')));
    expect(cited.length, 'routes with a citation').toBeGreaterThan(8);
    const bad: string[] = [];
    let entries = 0;
    for (const { route } of cited as { route: string }[]) {
      await page.goto(route.replace(/^\//, ''));
      const titles = await page.locator('a.cite').evaluateAll((as) => as.map((a) => `[${a.getAttribute('data-cite')}] ${a.getAttribute('title') ?? ''}`));
      const listed = await page.locator('[data-anatomy="sources"] li[data-source]').evaluateAll((lis) =>
        lis.map((li) => {
          const copy = li.cloneNode(true) as HTMLElement;
          for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode('MATH'));
          for (const a of copy.querySelectorAll('a.cite')) a.remove();
          return `[${li.getAttribute('data-source')}] ${(copy.textContent ?? '').replace(/\s+/g, ' ').trim()}`;
        }),
      );
      entries += listed.length;
      for (const t of titles) {
        const why = debris(t.split('$').filter((_, i) => i % 2 === 0).join(' MATH '));
        if (why.length > 0) bad.push(`${route} title ${t} (${why.join(', ')})`);
      }
      for (const t of listed) {
        const why = debris(t);
        if (why.length > 0) bad.push(`${route} entry ${t} (${why.join(', ')})`);
      }
    }
    expect(entries, 'entries of Sources lists read').toBeGreaterThan(40);
    expect(bad).toEqual([]);
  });
});

async function axe(page: Page): Promise<{ id: string; nodes: string[] }[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
}

test.describe('accessibility', () => {
  test('axe on every page', async ({ page }) => {
    test.setTimeout(180_000);
    for (const p of [...PAGES, { name: 'lesson layout', path: 'dev/lesson-check/', h1: '' }]) {
      for (const theme of ['light', 'dark'] as const) {
        await page.goto(p.path);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        expect(await axe(page), `${p.name}, ${theme} theme`).toEqual([]);
      }
    }
  });
});

test.describe('lesson layout', () => {
  test('lesson column measure', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('dev/lesson-check/');
    const ratio = await page.locator('[data-beat="1"] > p').first().evaluate((p) => {
      // Characters of ordinary prose that fit on one line of the column.
      const probe = document.createElement('span');
      probe.textContent = 'the quick brown fox jumps over the lazy dog and the cat ';
      probe.style.whiteSpace = 'nowrap';
      p.appendChild(probe);
      const perChar = probe.getBoundingClientRect().width / (probe.textContent ?? '').length;
      probe.remove();
      return p.getBoundingClientRect().width / perChar;
    });
    expect(ratio).toBeGreaterThan(56);
    expect(ratio).toBeLessThan(76);
    // Figures sit in a wider column than the prose on desktop.
    const prose = await page.locator('[data-beat="1"] > p').first().boundingBox();
    const figure = await page.locator('[data-beat="1"] [data-anatomy="figure"]').boundingBox();
    expect(figure!.width).toBeGreaterThan(prose!.width);
  });

  test('reflow at 320', async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [...PAGES.map((p) => p.path), 'dev/lesson-check/']) {
        await page.goto(path);
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(scroll, `horizontal scroll on ${path} at ${width}`).toBeLessThanOrEqual(0);
      }
      // Below 400 pixels the figure box runs from edge to edge of the viewport.
      await page.goto('dev/lesson-check/');
      const box = await page.locator('[data-beat="1"] [data-anatomy="figure"]').boundingBox();
      expect(Math.round(box!.x)).toBe(0);
      expect(Math.round(box!.width)).toBe(width);
    }
  });

  test('challenge reports success only when its check is met', async ({ page }) => {
    await page.goto('dev/lesson-check/');
    const challenge = page.locator('[data-challenge][data-kind="reach"]');
    await challenge.scrollIntoViewIfNeeded();
    await expect(challenge.locator('details')).toHaveCount(1);
    // Hydrated (client:visible): wait for the island to drop its ssr attribute.
    await expect(page.locator('astro-island[component-export="Challenge"]').first()).not.toHaveAttribute('ssr', '');
    await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await expect(challenge).not.toHaveAttribute('data-met', 'true');
    // Drive the stand-in tool through its hooks: a wrong position first, then the target.
    const tool = '[data-tool][data-instance="b1"]';
    await page.evaluate((sel) => {
      const root = document.querySelector(sel)!;
      root.querySelector('[data-node="3"]')!.setAttribute('data-value', '−1');
      root.setAttribute('data-moves', '1');
    }, tool);
    await page.waitForTimeout(200);
    await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await page.evaluate((sel) => {
      const root = document.querySelector(sel)!;
      root.querySelector('[data-node="1"]')!.setAttribute('data-value', '1');
      root.querySelector('[data-node="3"]')!.setAttribute('data-value', '0');
      root.setAttribute('data-moves', '2');
    }, tool);
    await expect(challenge).toHaveAttribute('data-met', 'true');
    await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
    await expect(challenge.locator('[role="status"]')).toHaveText('Goal reached.');
    // The explain challenge never reports success.
    await expect(page.locator('[data-challenge][data-kind="explain"] [data-challenge-result]')).toHaveCount(0);
  });
});
