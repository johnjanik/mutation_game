// P6-A5: the embed routes (SPEC.md 7.4 "Embedding", 6.6 bare keys and validation, 7.3, 7.7 rows "Without
// JavaScript" and "Accessibility", 7.8 "No third-party script at runtime") and ToolFrame's phase 6
// buttons "Export LaTeX" and "Cite" (CONTRACTS.md 5.1; SPEC 6.7, 7.4 "Citing", 4.0, 7.5 A-1, A-7, A-11).
//
// Routes are discovered from the build, never typed: the tools are the folders of site/dist/tools, the
// embed routes those of site/dist/embed, so tools registered later (T13, T14) are covered without an
// edit. pages/embed/[tool].astro renders the shared table of hydrated tools, src/tools/ToolIsland.astro
// (request R1 of P6-A5, decisions/P6-A5.md), and builds no route while that file does not exist; the
// first test pins both states, so the tests generated per embed route run as soon as the routes exist.
// A route whose page has no tool frame (T14 may be static pages, CONTRACTS 6) is checked for hydration
// only through its islands.
//
// Hooks read: data-embed (body), data-open-on-site (the link under the tool), data-frame, data-tool,
// data-hydrated, data-moves (tool root), data-node and data-value (node buttons), data-control="copyLink",
// "downloadData", "latex", "cite", data-export="png", data-out="citeText", "exportNotice", "notice",
// "caption", "noscript", and the live region [data-live].
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distDir } from './routes';

const DIST = distDir();
const SHARED_TABLE = fileURLToPath(new URL('../../src/tools/ToolIsland.astro', import.meta.url));
/** The working title of SPEC 1.7 (D1 default), the site name of the citation. */
const SITE_NAME = 'Two Games on a Dynkin Diagram';
/** The codec's keys (SPEC 6.6 URL form): a link carries these and nothing else. */
const KEYS = new Set(['z', 'g', 'v', 'm', 'c', 's', 'w', 'x', 't', 'r', 'j', 'e', 'y', 'k', 'q', 'd']);
const LINK_NOTICE = 'The link could not be read, so the tool shows its default state.';

/** The route folders of the built site under `dir` that hold a page. */
function routeIds(dir: string): string[] {
  const root = join(DIST, dir);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, 'index.html')))
    .sort();
}

const TOOL_IDS = routeIds('tools');
const EMBED_IDS = routeIds('embed');
const at = (path: string): string => `./${path}`;
/** The <title> of a built page, with the character references Astro writes decoded. */
function titleOf(dir: string, id: string): string {
  const raw = /<title>([^<]*)<\/title>/.exec(readFileSync(join(DIST, dir, id, 'index.html'), 'utf8'))?.[1] ?? '';
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (named[e] ?? m),
  );
}

/** Records what Copy link and Cite write, instead of the system clipboard (which differs by browser). */
async function stubClipboard(page: Page, fails = false): Promise<void> {
  await page.addInitScript((reject: boolean) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (t: string) => {
          if (reject) throw new Error('denied');
          const w = window as unknown as { __copied: string[] };
          (w.__copied ??= []).push(t);
        },
      },
    });
  }, fails);
}

const copied = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __copied?: string[] }).__copied ?? []);

/** Opens a route and waits until every island has hydrated and the share row is enabled. */
async function ready(page: Page, path: string): Promise<void> {
  await page.goto(at(path));
  const tools = page.locator('astro-island [data-tool]');
  const n = await tools.count();
  for (let k = 0; k < n; k++) await expect(tools.nth(k)).toHaveAttribute('data-hydrated', 'true', { timeout: 15000 });
  if (n > 0) await expect(page.locator('[data-control="cite"]').first()).toBeEnabled();
}

const control = (page: Page, name: string) => page.locator(`[data-control="${name}"]`).first();

async function downloadText(page: Page, name: string): Promise<{ text: string; file: string }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), control(page, name).click()]);
  return { text: readFileSync((await dl.path())!, 'utf8'), file: dl.suggestedFilename() };
}

test.describe('the embed routes', () => {
  test('every registered tool has an embed route once the shared table of hydrated tools exists, and none before', () => {
    expect(TOOL_IDS.length).toBeGreaterThan(0);
    // The registry gives /tools/<id> to every registered tool (P1-A2), so its routes are the registry's.
    const registered = readdirSync(fileURLToPath(new URL('../../src/tools/registry/', import.meta.url))).filter((f) => /^T\d+\.ts$/.test(f));
    expect(TOOL_IDS).toHaveLength(registered.length);
    expect(EMBED_IDS).toEqual(existsSync(SHARED_TABLE) ? TOOL_IDS : []);
  });

  for (const id of EMBED_IDS) {
    test(`embed route renders and hydrates: ${id}`, async ({ page, baseURL }) => {
      const requests: string[] = [];
      page.on('request', (r) => requests.push(r.url()));
      await ready(page, `embed/${id}/?z=1`);
      await expect(page.locator('body')).toHaveAttribute('data-embed', id);
      await expect(page).toHaveTitle(titleOf('tools', id));
      // Alone: no site navigation, header, footer or skip link; one main landmark.
      await expect(page.locator('nav, header, footer, .site-header, .site-footer, .skip-link, [data-theme-switch]')).toHaveCount(0);
      await expect(page.locator('main')).toHaveCount(1);
      // A tool frame, when the page has one, is this tool's and has hydrated; no island is left waiting.
      const frames = page.locator('[data-frame]');
      if ((await frames.count()) > 0) {
        await expect(frames.first()).toHaveAttribute('data-tool', id);
        await expect(frames.first()).toHaveAttribute('data-hydrated', 'true');
        await expect(frames.first()).toHaveAttribute('data-instance', '');
      }
      await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
      // Not indexed; the canonical page and the link under the tool are /tools/<id>, from the base path.
      const base = new URL(baseURL!).pathname;
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      expect(new URL((await page.locator('link[rel="canonical"]').getAttribute('href'))!).pathname).toBe(`${base}tools/${id}/`);
      const open = page.locator('[data-open-on-site]');
      await expect(open).toHaveText('Open on the site');
      await expect(open).toHaveAttribute('target', '_blank');
      await expect(open).toHaveAttribute('rel', 'noopener');
      await open.focus();
      const href = new URL((await open.getAttribute('href'))!, page.url());
      expect(href.pathname).toBe(`${base}tools/${id}/`);
      expect(href.search).toBe(new URL(page.url()).search);
      // 7.8: no third-party script, font or request.
      const origin = new URL(baseURL!).origin;
      for (const u of requests) expect(u.startsWith(`${origin}/`) || u.startsWith('data:') || u.startsWith('blob:'), u).toBe(true);
    });

    test(`an embed route makes no external request: ${id}`, async ({ page, baseURL }) => {
      const requests: string[] = [];
      page.on('request', (r) => requests.push(r.url()));
      await ready(page, `embed/${id}/`);
      await page.waitForLoadState('networkidle');
      const origin = new URL(baseURL!).origin;
      expect(requests.length).toBeGreaterThan(0);
      for (const u of requests) expect(u.startsWith(`${origin}/`) || u.startsWith('data:') || u.startsWith('blob:'), u).toBe(true);
    });

    test(`embed routes pass axe: ${id}`, async ({ page }) => {
      test.setTimeout(120_000);
      await ready(page, `embed/${id}/`);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
      expect(serious).toEqual([]);
      expect(results.passes.length).toBeGreaterThan(0);
    });
  }

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    for (const id of EMBED_IDS) {
      test(`embed routes render without JavaScript: ${id}`, async ({ page }) => {
        await page.goto(at(`embed/${id}/`));
        await expect(page.locator('body')).toHaveAttribute('data-embed', id);
        const tool = page.locator('[data-tool]').first();
        await expect(tool).toBeVisible();
        // The default figure, its caption and the noscript line.
        expect(await tool.locator('svg, img').count()).toBeGreaterThan(0);
        const caption = page.locator('[data-out="caption"], figcaption').first();
        await expect(caption).not.toHaveText('');
        await expect(page.locator('[data-out="noscript"]').first()).toBeVisible();
        // Every control is disabled: by its own attribute or inside a disabled fieldset.
        const enabled = await page.evaluate(() =>
          [...document.querySelectorAll('[data-tool] button, [data-tool] input, [data-tool] select, [data-tool] textarea')].filter((el) => !el.matches(':disabled')).map((el) => el.outerHTML.slice(0, 120)),
        );
        expect(enabled).toEqual([]);
        // The table of A-10 (the first <details> of the frame holding a table) with buttons, for a tool frame.
        if ((await page.locator('[data-frame]').count()) > 0) {
          const tableButtons = await page.evaluate(() => {
            const details = [...document.querySelectorAll('[data-frame] details')].find((d) => d.querySelector('table'));
            return details ? details.querySelectorAll('table button').length : -1;
          });
          expect(tableButtons).toBeGreaterThan(0);
          await expect(control(page, 'latex')).toBeDisabled();
          await expect(control(page, 'cite')).toBeDisabled();
        }
      });
    }
  });

  // The two examples of the board's embed route, generated with the routes the build has; the first
  // test of this block pins that set.
  for (const id of EMBED_IDS.filter((x) => x === 'board')) {
    test(`the A2 state loads on the embed route (${id})`, async ({ page }) => {
      const query = '?z=1&g=A2&v=n&m=l&c=n&s=1,1&w=1.2';
      const hooks = async (path: string): Promise<string[]> => {
        await ready(page, path);
        const root = page.locator('[data-tool="board"]').first();
        await expect(root).toHaveAttribute('data-moves', '2');
        await expect(page.locator('[data-out="notice"]')).toHaveCount(0);
        const n1 = page.locator('[data-tool="board"] button[data-node="1"]').first();
        const n2 = page.locator('[data-tool="board"] button[data-node="2"]').first();
        await expect(n1).toHaveAttribute('data-value', '1');
        await expect(n2).toHaveAttribute('data-value', '-2');
        return [await root.getAttribute('data-moves'), await n1.getAttribute('data-value'), await n2.getAttribute('data-value')].map(String);
      };
      const onEmbed = await hooks(`embed/board/${query}`);
      const onTool = await hooks(`tools/board/${query}`);
      expect(onEmbed).toEqual(onTool);
    });

    test(`an unreadable link on an embed route shows the notice and the default state (${id})`, async ({ page }) => {
      await ready(page, 'embed/board/?z=1&g=A2&w=9');
      await expect(page.locator('[data-out="notice"]')).toHaveText(LINK_NOTICE);
      await expect(page.locator('[data-tool="board"]').first()).toHaveAttribute('data-moves', '0');
    });

    test(`Cite on the embed route cites the embed link (${id})`, async ({ page }) => {
      await stubClipboard(page);
      await ready(page, 'embed/board/?z=1&g=A2&v=n&m=l&c=n&s=1,1&w=1.2');
      await control(page, 'copyLink').click();
      await control(page, 'cite').click();
      const text = (await page.locator('[data-out="citeText"]').textContent()) ?? '';
      const [link] = await copied(page);
      expect(link).toContain('/embed/board/');
      expect(text.startsWith(`Game Board. ${SITE_NAME}, site version `)).toBe(true);
      expect(text.endsWith(`. ${link}`)).toBe(true);
    });
  }
});

test.describe('Export LaTeX and Cite', () => {
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('Export LaTeX and Cite are disabled without JavaScript', async ({ page }) => {
      for (const path of ['tools/board/', 'tools/garden/', 'tools/affine/']) {
        await page.goto(at(path));
        await expect(control(page, 'latex')).toHaveText('Export LaTeX');
        await expect(control(page, 'cite')).toHaveText('Cite');
        await expect(control(page, 'latex')).toHaveAttribute('disabled', '');
        await expect(control(page, 'cite')).toHaveAttribute('disabled', '');
        await expect(page.locator('[data-out="citeText"]')).toHaveCount(0);
      }
    });
  });

  test('Export LaTeX and Cite are disabled without JavaScript and enabled after hydration', async ({ page }) => {
    for (const path of ['tools/board/', 'tools/garden/', 'tools/affine/']) {
      let downloads = 0;
      page.on('download', () => downloads++);
      await ready(page, path);
      await expect(control(page, 'latex')).toBeEnabled();
      await expect(control(page, 'cite')).toBeEnabled();
      // Nothing acts by itself on load (4.0, A-9).
      await page.waitForTimeout(600);
      expect(downloads).toBe(0);
      await expect(page.locator('[data-out="citeText"]')).toHaveCount(0);
      await expect(page.locator('[data-live]').first()).toHaveText('');
    }
  });

  test('Export LaTeX downloads the diagram of the board', async ({ page }) => {
    await stubClipboard(page);
    await ready(page, 'tools/board/?z=1&g=E6');
    await control(page, 'copyLink').click();
    const { text, file } = await downloadText(page, 'latex');
    const [link] = await copied(page);
    expect(file).toBe('board-E6.tex');
    expect(text).toBe(`% ${link}\n% needs \\usepackage{dynkin-diagrams}\n\\dynkin E{oooooo}\n`);
    await expect(page.locator('[data-out="exportNotice"]')).toHaveText('');
    // On C2 the letter is the name the reader chose (D19).
    await ready(page, 'tools/board/?z=1&g=C2');
    expect((await downloadText(page, 'latex')).text).toContain('\n\\dynkin C{oo}\n');
  });

  test('Export LaTeX on a board with no form of SPEC 6.7 shows the notice', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => downloads++);
    await ready(page, 'tools/affine/');
    await control(page, 'latex').click();
    await expect(page.locator('[data-out="exportNotice"]')).toHaveText('nothing to export as LaTeX');
    expect(downloads).toBe(0);
  });

  test('Cite gives the page title, the commit, the date and the link', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 2, 10, 30));
    await stubClipboard(page);
    await ready(page, 'tools/board/?z=1&g=A2&v=n&m=l&c=n&s=1,1&w=1.2');
    const { text: json } = await downloadText(page, 'downloadData');
    const commit = (JSON.parse(json) as { commit: string }).commit;
    expect(commit.length).toBeGreaterThan(0);
    await control(page, 'copyLink').click();
    await control(page, 'cite').click();
    const cite = page.locator('[data-out="citeText"]');
    await expect(cite).toBeVisible();
    const [link, cited] = await copied(page);
    const title = await page.title();
    expect(title).toBe('Game Board');
    expect(await cite.textContent()).toBe(`${title}. ${SITE_NAME}, site version ${commit}, 2026-11-02. ${link}`);
    // The text shown is the text copied, and the copy is announced.
    expect(cited).toBe(await cite.textContent());
    await expect(page.locator('[data-live]').first()).toHaveText('Citation copied.');
  });

  test('the cited link carries no site version', async ({ page }) => {
    await stubClipboard(page);
    await ready(page, 'tools/board/?z=1&g=A2&v=n&m=l&c=n&s=1,1&w=1.2');
    await control(page, 'copyLink').click();
    await control(page, 'cite').click();
    const text = (await page.locator('[data-out="citeText"]').textContent()) ?? '';
    const [link] = await copied(page);
    const commit = /site version ([^,]+),/.exec(text)?.[1] ?? '';
    expect(commit.length).toBeGreaterThan(0);
    const cited = text.slice(text.lastIndexOf('. ') + 2);
    expect(cited).toBe(link);
    expect(cited).not.toContain(commit);
    const url = new URL(cited);
    expect([...url.searchParams.keys()].length).toBeGreaterThan(0);
    for (const key of url.searchParams.keys()) expect(KEYS.has(key), key).toBe(true);
  });

  test('Cite on a lesson gives the lesson title and the instance link', async ({ page }) => {
    await stubClipboard(page);
    await page.goto(at('modules/m0-start/'));
    const tool = page.locator('[data-frame]').first();
    await expect(tool).toHaveAttribute('data-hydrated', 'true', { timeout: 15000 });
    const heading = ((await page.locator('h1').first().textContent()) ?? '').trim();
    await tool.locator('[data-control="cite"]').click();
    const text = (await tool.locator('[data-out="citeText"]').textContent()) ?? '';
    expect(heading.length).toBeGreaterThan(0);
    expect(text.startsWith(`${heading}${/[.?!]$/.test(heading) ? '' : '.'} ${SITE_NAME}, site version `)).toBe(true);
    expect(text).not.toContain(`: ${SITE_NAME}`);
    expect(new URL(text.slice(text.lastIndexOf('. ') + 2)).pathname).toMatch(/\/modules\/m0-start\/$/);
  });

  test('Cite without a clipboard shows the text and says so', async ({ page }) => {
    await stubClipboard(page, true);
    await ready(page, 'tools/board/');
    await control(page, 'cite').click();
    await expect(page.locator('[data-out="citeText"]')).toContainText(`${SITE_NAME}, site version `);
    await expect(page.locator('[data-live]').first()).toHaveText('Citation shown below the tool.');
  });

  test('Export LaTeX and Cite work from the keyboard', async ({ page }) => {
    await stubClipboard(page);
    await ready(page, 'tools/board/?z=1&g=G2');
    await page.locator('[data-export="png"]').first().focus();
    await page.keyboard.press('Tab');
    await expect(control(page, 'latex')).toBeFocused();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    expect(dl.suggestedFilename()).toBe('board-G2.tex');
    expect(readFileSync((await dl.path())!, 'utf8')).toContain('\n\\dynkin G{oo}\n');
    await page.keyboard.press('Tab');
    await expect(control(page, 'cite')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('[data-out="citeText"]')).toContainText(`Game Board. ${SITE_NAME}`);
  });

  test('Export LaTeX and Cite fit at 320 pixels', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await ready(page, 'tools/board/');
    for (const name of ['latex', 'cite']) {
      const b = (await control(page, name).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(320);
    }
    await control(page, 'cite').click();
    const c = (await page.locator('[data-out="citeText"]').boundingBox())!;
    expect(c.x + c.width).toBeLessThanOrEqual(320);
    const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});
