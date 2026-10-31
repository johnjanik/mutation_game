// P6-A5: the embed routes (SPEC.md 7.4 "Embedding", 6.6 bare keys and validation, 7.3, 7.7 rows "Without
// JavaScript" and "Accessibility", 7.8 "No third-party script at runtime") and ToolFrame's phase 6
// buttons "Export LaTeX" and "Cite" (CONTRACTS.md 5.1; SPEC 6.7, 7.4 "Citing", 4.0, 7.5 A-1, A-7, A-11).
//
// Routes are discovered from the build, never typed: the tools are the folders of site/dist/tools, the
// embed routes those of site/dist/embed, so tools registered later (T13, T14) are covered without an
// edit. pages/embed/[tool].astro imports the shared table of hydrated tools, src/tools/ToolIsland.astro
// (request R1 of P6-A5, decisions/P6-A5.md), statically and builds every route; the first test pins
// that the embed routes are exactly the tool routes, so a build that drops them fails here. A route
// whose page has no tool frame (T14 may be static pages, CONTRACTS 6) is checked for hydration only
// through its islands.
//
// Hooks read: data-embed (body), data-open-on-site (the link under the tool), data-frame, data-tool,
// data-hydrated, data-moves, data-instance (tool root), data-node, data-value and data-can-act (node
// buttons), data-control="copyLink", "downloadData", "latex", "cite", data-export="png",
// data-out="citeText", "exportNotice", "notice", "caption", "noscript", and the live region [data-live].
// The export module is recognised in the built scripts by its string 'nothing to export as LaTeX'.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distDir } from './routes';

const DIST = distDir();
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

/** A string only the export module holds (export.ts NOTHING_TO_EXPORT_LATEX): the script holding it is that module. */
const EXPORT_MARKER = 'nothing to export as LaTeX';

/** Records the URLs of the scripts a page fetches. */
function recordScripts(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.endsWith('.js')) urls.push(r.url());
  });
  return urls;
}

/** The fetched scripts that hold the export module, read from the build (as npm run size reads them). */
function exportScripts(urls: string[], baseURL: string): string[] {
  const base = new URL(baseURL).pathname;
  return [...new Set(urls)].filter((u) => {
    const path = new URL(u).pathname;
    const file = join(DIST, path.startsWith(base) ? path.slice(base.length) : path);
    return existsSync(file) && readFileSync(file, 'utf8').includes(EXPORT_MARKER);
  });
}

/**
 * In `frame`: press Cite once (so that the export module is loaded), make one move, press Cite at once
 * (inside the half second before the address bar is written, 7.4), then Copy link. Returns the text Cite
 * copied and showed, the link it cites, and the link Copy link gave.
 */
async function citeRightAfterAMove(page: Page, frame: Locator): Promise<{ cite: string; shown: string; cited: string; link: string }> {
  const count = async (): Promise<number> => (await copied(page)).length;
  const n0 = await count();
  await frame.locator('[data-control="cite"]').click();
  await expect.poll(count).toBe(n0 + 1);
  const moves = Number(await frame.getAttribute('data-moves'));
  await frame.locator('button[data-node][data-can-act="true"]:not([disabled])').first().click();
  await frame.locator('[data-control="cite"]').click();
  await expect(frame).toHaveAttribute('data-moves', String(moves + 1));
  await expect.poll(count).toBe(n0 + 2);
  await frame.locator('[data-control="copyLink"]').click();
  await expect.poll(count).toBe(n0 + 3);
  const [cite, link] = (await copied(page)).slice(-2) as [string, string];
  const shown = ((await frame.locator('[data-out="citeText"]').textContent()) ?? '').trim();
  return { cite, shown, cited: cite.slice(cite.lastIndexOf('. ') + 2), link };
}

test.describe('the embed routes', () => {
  test('every registered tool has an embed route', () => {
    expect(TOOL_IDS.length).toBeGreaterThan(0);
    // The registry gives /tools/<id> to every registered tool (P1-A2), so its routes are the registry's.
    const registered = readdirSync(fileURLToPath(new URL('../../src/tools/registry/', import.meta.url))).filter((f) => /^T\d+\.ts$/.test(f));
    expect(TOOL_IDS).toHaveLength(registered.length);
    expect(EMBED_IDS).toEqual(TOOL_IDS);
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

    // SPEC 7.6: the export module (Download data, the figure exports, Export LaTeX, Cite) is fetched on
    // the first click that needs it, never with the route.
    test(`the export module is not fetched before the first interaction: ${id}`, async ({ page, baseURL }) => {
      const scripts = recordScripts(page);
      await ready(page, `embed/${id}/`);
      await page.waitForLoadState('networkidle');
      expect(scripts.length).toBeGreaterThan(0);
      expect(exportScripts(scripts, baseURL!)).toEqual([]);
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

    test(`the export module is fetched at the first click of Export LaTeX (${id})`, async ({ page, baseURL }) => {
      const scripts = recordScripts(page);
      await ready(page, 'embed/board/');
      await page.waitForLoadState('networkidle');
      expect(exportScripts(scripts, baseURL!)).toEqual([]);
      await downloadText(page, 'latex');
      expect(exportScripts(scripts, baseURL!)).toHaveLength(1);
    });

    test(`Cite right after a move cites the new state, as Copy link does (${id})`, async ({ page }) => {
      await stubClipboard(page);
      await ready(page, 'embed/board/');
      const { cite, shown, cited, link } = await citeRightAfterAMove(page, page.locator('[data-frame]').first());
      expect(cited).toBe(link);
      expect(shown).toBe(cite);
      expect(new URL(cited).pathname).toMatch(/\/embed\/board\/$/);
      expect(new URL(cited).searchParams.get('w')).not.toBeNull();
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
    // The download is announced, as Download data's is (SPEC 7.5, 4.1.3).
    await expect(page.locator('[data-live]').first()).toHaveText('Downloaded board-E6.tex.');
    // On C2 the letter is the name the reader chose (D19).
    await ready(page, 'tools/board/?z=1&g=C2');
    expect((await downloadText(page, 'latex')).text).toContain('\n\\dynkin C{oo}\n');
  });

  test('Export LaTeX on a board with no form of SPEC 6.7 shows the notice and announces it', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => downloads++);
    await stubClipboard(page);
    for (const path of ['tools/affine/', 'embed/sandbox/']) {
      await ready(page, path);
      // Cite first, so that the live region holds another message before the click (SPEC 7.5, 4.1.3).
      await control(page, 'cite').click();
      await expect(page.locator('[data-live]').first()).toHaveText('Citation copied.');
      await control(page, 'latex').click();
      await expect(page.locator('[data-out="exportNotice"]')).toHaveText('nothing to export as LaTeX');
      await expect(page.locator('[data-live]').first()).toHaveText('nothing to export as LaTeX');
    }
    expect(downloads).toBe(0);
  });

  // The date is the reader's local date (decisions/P6-A5.md), read in a time zone far from UTC: at this
  // instant the date is 2 November in UTC and already 3 November at UTC+14.
  test.describe('in a time zone far from UTC', () => {
    test.use({ timezoneId: 'Pacific/Kiritimati' });
    test('Cite gives the page title, the commit, the date and the link', async ({ page }) => {
      const instant = new Date('2026-11-02T12:30:00Z');
      expect(instant.toISOString().slice(0, 10)).toBe('2026-11-02');
      await page.clock.setFixedTime(instant);
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
      expect(await page.evaluate(() => new Date().getDate())).toBe(3);
      expect(await cite.textContent()).toBe(`${title}. ${SITE_NAME}, site version ${commit}, 2026-11-03. ${link}`);
      // The text shown is the text copied, and the copy is announced.
      expect(cited).toBe(await cite.textContent());
      await expect(page.locator('[data-live]').first()).toHaveText('Citation copied.');
      });
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

  // SPEC 7.4 "Citing": the link cited is the one Copy link gives, built from the instance's state, not
  // read from the address bar, which is written half a second after a burst of moves and holds the
  // keys of other instances. Two instances of one lesson, each cited right after a move.
  test('Cite right after a move on a lesson instance cites the link Copy link gives', async ({ page }) => {
    await stubClipboard(page);
    await page.goto(at('modules/m0-start/'));
    const frames = page.locator('[data-frame]');
    const n = await frames.count();
    let checked = 0;
    for (let k = 0; k < n && checked < 2; k++) {
      const frame = frames.nth(k);
      await frame.scrollIntoViewIfNeeded();
      await expect(frame).toHaveAttribute('data-hydrated', 'true', { timeout: 15000 });
      if ((await frame.locator('button[data-node][data-can-act="true"]:not([disabled])').count()) === 0) continue;
      const inst = (await frame.getAttribute('data-instance')) ?? '';
      expect(inst.length).toBeGreaterThan(0);
      const { cite, shown, cited, link } = await citeRightAfterAMove(page, frame);
      expect(cited).toBe(link);
      expect(shown).toBe(cite);
      expect(new URL(cited).pathname).toMatch(/\/modules\/m0-start\/$/);
      expect(new URL(cited).searchParams.get(`${inst}.w`), cited).not.toBeNull();
      checked++;
      // Let the address bar take this instance's keys before the next instance moves.
      await expect.poll(() => page.evaluate(() => location.search)).toContain(`${inst}.w=`);
    }
    expect(checked).toBe(2);
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

// Adopted from the RT-05 phase 6 reproducer of P6-RT-05-01 (attacks 29 and 45; SPEC.md 7.5 A-6 "Text and numerals
// at least 4.5 to 1 ... in light and dark themes", A-2; 7.4 "Embedding"; CONTRACTS 8). The site gave every link
// its text colour, and links and buttons the focus ring, through one global rule of the layout Base.astro, which
// pages/embed/[tool].astro does not use: a link that a tool draws kept the browser's default link colours on
// /embed/<id>, #0000EE (about 2 to 1 on the dark page #121212), and a button without a focus rule of its own kept
// the browser's ring. Two such links reached by ordinary use: the Atlas picker's "Open the Atlas page of E8" on
// /embed/atlas/?g=E8, and T15's "Source of this row: [GSS12] ..." on /embed/affine/ after the pentagon puzzle is
// played on (by keys). The rules now live in styles/base.css, which both load. Hooks read: data-tool,
// data-hydrated, data-out="chosen" and "provenance", data-tab, data-control="playOn".
test.describe('the dark theme on the embed routes', () => {
  test.use({ colorScheme: 'dark' });

  function lum(rgb: string): number {
    const m = /rgba?\((\d+), (\d+), (\d+)/.exec(rgb);
    if (!m) throw new Error(`not a colour: ${rgb}`);
    const ch = [m[1], m[2], m[3]].map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  }
  const ratio = (a: string, b: string): number => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };

  async function linkContrasts(page: Page): Promise<{ text: string; color: string; page: string; ratio: number }[]> {
    const rows = await page.locator('[data-tool] a[href]').evaluateAll((as) =>
      as.map((a) => ({ text: (a.textContent ?? '').trim().slice(0, 40), color: getComputedStyle(a).color, page: getComputedStyle(document.body).backgroundColor })),
    );
    return rows.map((r) => ({ ...r, ratio: Math.round(ratio(r.color, r.page) * 100) / 100 }));
  }

  // regression: P6-RT-05-01
  test('dark theme, /embed/atlas/?g=E8: every link inside the tool is at least 4.5 to 1 against the page (A-6)', async ({ page }) => {
    await page.goto('embed/atlas/?g=E8');
    const root = page.locator('[data-tool="atlas"]');
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    await expect(root.locator('[data-out="chosen"] a')).toBeVisible();
    const rows = await linkContrasts(page);
    const bad = rows.filter((r) => r.ratio < 4.5);
    expect(bad, `/embed/atlas/?g=E8, dark theme, 360 x 800: links below 4.5 to 1 against the page: ${JSON.stringify(bad)}`).toEqual([]);
  });

  // regression: P6-RT-05-01
  test('dark theme, /embed/affine/ after Play on of the pentagon puzzle: every link inside the tool is at least 4.5 to 1 (A-6)', async ({ page }) => {
    await page.goto('embed/affine/');
    const root = page.locator('[data-tool="affine"]');
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    await root.locator('button[data-tab="pentagon"]').focus();
    await page.keyboard.press('Enter');
    await root.locator('[data-control="playOn"]').focus();
    await page.keyboard.press('Enter');
    await expect(root.locator('[data-out="provenance"] a')).toBeVisible();
    const rows = await linkContrasts(page);
    const bad = rows.filter((r) => r.ratio < 4.5);
    expect(bad, `/embed/affine/ (pentagon, Play on), dark theme, 360 x 800: links below 4.5 to 1 against the page: ${JSON.stringify(bad)}`).toEqual([]);
  });

  // regression: P6-RT-05-01
  test('control: the same link on /tools/atlas/?g=E8 in the dark theme is drawn in the text colour', async ({ page }) => {
    await page.goto('tools/atlas/?g=E8');
    const root = page.locator('[data-tool="atlas"]');
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    const rows = await linkContrasts(page);
    expect(rows.filter((r) => r.ratio < 4.5)).toEqual([]);
  });

  /**
   * The tab stops inside the tool, its "Show as table" view open (by keys), each with the outline it shows when
   * focused from the keyboard: the walk enters the tool with Tab from the element before it.
   */
  async function focusRings(page: Page, path: string): Promise<string[]> {
    await ready(page, path);
    await page.locator('[data-tool] summary', { hasText: 'Show as table' }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-tool] details', { has: page.locator('summary', { hasText: 'Show as table' }) }).first()).toHaveAttribute('open', '');
    await page.locator('[data-tool] :is(button, a[href], input, select):not([disabled])').first().focus();
    await page.keyboard.press('Shift+Tab');
    const stops: string[] = [];
    for (let k = 0; k < 120; k++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || !el.closest('[data-tool]')) return null;
        const hooks = [...el.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-href').map((a) => `${a.name}=${a.value}`);
        const s = getComputedStyle(el);
        return `${el.tagName.toLowerCase()} ${hooks.join(' ')} (${(el.textContent ?? '').trim().slice(0, 24)}): ${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
      });
      if (stop === null) break;
      stops.push(stop);
    }
    return stops;
  }

  // regression: P6-RT-05-01
  test('dark theme, /embed/garden/: every tab stop of the tool shows the focus ring it shows on /tools/garden/ (A-2)', async ({ page }) => {
    const onEmbed = await focusRings(page, 'embed/garden/');
    const onTool = await focusRings(page, 'tools/garden/');
    expect(onTool.length, 'tab stops of the tool on /tools/garden/').toBeGreaterThan(1);
    expect(onEmbed.filter((s) => s.startsWith('button data-control=jumpRow')).length, 'the jump buttons of the table view are reached').toBeGreaterThan(0);
    const browserRings = onEmbed.filter((s) => /^(button|a) /.test(s) && / auto /.test(s));
    expect(browserRings, '/embed/garden/, dark theme: buttons and links with the browser focus ring instead of the ring of A-2').toEqual([]);
    expect(onEmbed, '/embed/garden/ against /tools/garden/, dark theme: each tab stop and its focus ring').toEqual(onTool);
  });
});
