// P1-A7: tool T9, Kostant's Game, against the built site (SPEC.md 4 T9, 4.0, 2.7 F13, 2.12, 2.16,
// 6.6, 7.4, 7.5; Appendix A.4). Cases are opened by bare query parameters on /tools/kostant/ (6.6:
// every state is a link) or through the startCity and picker controls. Tests read only the hooks of
// 4.0 and the live region (and, where a criterion is about the address bar or a download, those).
//
// Hooks read:
//   root:    data-tool="kostant", data-moves, data-hydrated="true"
//   buttons: data-node, data-board ("populations"), data-value, data-can-act; the button's title is
//            the tooltip of a long value (plan: Board.svelte has no <title> or data-exact hook)
//   drawing: data-numeral (the numeral drawn on a city), data-glyph (mood shape on the board),
//            data-mark (the decoration of a marked city)
//   groups:  data-board-group (the group of node buttons, with its accessible name)
//   table:   data-table-node (the A-10 table's buttons), data-row, data-table-value
//   strip:   data-step (a strip button of History.svelte)
//   live:    [data-live] (ToolFrame's polite live region)
// data-out names (every one T9 renders; the registry's `outs`):
//   caption, notice, noscript, moveCounter, historyStrip, historyCounter, mood (data-label, data-shape),
//   goal (data-met), goalMet, bridgeSentence, endPanel, endName, moveCount, hMinus2, finalNumbers,
//   marked, returnCounts, affineCaption, affineBoard (phase 2, P2-A7), limit, predictResult,
//   predictReveal
// data-control names: step, playToEnd, startCity, picker, undo, redo, reset, historySlider,
//   copyLink, downloadData, predictAnswer, predictCheck, predictShow, openLab (phase 2, P2-A7)
//
// Properties of T9 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction, preset, caption, layers):
//   boardChoices: string[]   the boards the picker offers (plan; M1 row 3 passes ['A3', 'D4', 'E8'])
// linkTo and layers are accepted and ignored (T9 follows no tool and grows no set); preset knows only
// 'default'.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { ssrLoader } from '../unit/_svelteSsr';

const ROUTE = 'tools/kostant/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const BRIDGE = 'The number on node i is the amount by which a mutation would lower city i.';

const root = (page: Page): Locator => page.locator('[data-tool="kostant"]');
const node = (page: Page, label: number): Locator => root(page).locator(`button[data-board="populations"][data-node="${label}"]`);
const nodes = (page: Page): Locator => root(page).locator('button[data-board="populations"][data-node]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

async function values(page: Page): Promise<string[]> {
  const list = nodes(page);
  const n = await list.count();
  const pairs: [number, string][] = [];
  for (let k = 0; k < n; k++) {
    const b = list.nth(k);
    pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  }
  return pairs.sort((x, y) => x[0] - y[0]).map((p) => p[1]);
}

async function moods(page: Page): Promise<{ label: string; word: string; shape: string }[]> {
  return root(page).evaluate((el) =>
    [...el.querySelectorAll('[data-out="mood"]')].map((m) => ({
      label: m.getAttribute('data-label') ?? '',
      word: (m.textContent ?? '').trim(),
      shape: m.getAttribute('data-shape') ?? '',
    })),
  );
}

/** Records every non-empty text written to the live region from now on. */
async function recordLive(page: Page): Promise<() => Promise<string[]>> {
  await root(page).evaluate((el) => {
    const region = el.querySelector('[data-live]')!;
    const w = window as unknown as { __live: string[] };
    w.__live = [];
    new MutationObserver(() => {
      const t = region.textContent ?? '';
      if (t !== '') w.__live.push(t);
    }).observe(region, { childList: true, characterData: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { __live: string[] }).__live);
}

async function expectDefault(page: Page): Promise<void> {
  await expect(nodes(page)).toHaveCount(3);
  expect(await values(page)).toEqual(['1', '0', '0']);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(control(page, 'picker')).toHaveValue('A3');
}

// ---------------------------------------------------------------------------------------------
// The roster's named examples (Appendix A.4, SPEC 3 M1 beat 3)
// ---------------------------------------------------------------------------------------------

test('A3 from city 1 ends at (1,1,1) after 2 moves with final numbers (1,0,1)', async ({ page }) => {
  await open(page, 'g=A3&c=p&s=1,0,0');
  await expect(out(page, 'goal')).toHaveAttribute('data-met', 'false');
  await expect(out(page, 'endPanel')).toHaveCount(0);
  await control(page, 'step').click();
  expect(await values(page)).toEqual(['1', '1', '0']);
  await control(page, 'step').click();
  expect(await values(page)).toEqual(['1', '1', '1']);
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(out(page, 'moveCount')).toHaveText('2');
  await expect(out(page, 'hMinus2')).toContainText('2');
  await expect(out(page, 'hMinus2').locator('math')).toHaveCount(1);
  await expect(out(page, 'finalNumbers')).toHaveText('1, 0, 1');
  await expect(out(page, 'marked')).toHaveText('1, 3');
  await expect(out(page, 'endName')).toContainText('the highest root');
  await expect(out(page, 'goal')).toHaveAttribute('data-met', 'true');
  await expect(out(page, 'goalMet')).toHaveText('Goal reached.');
  await expect(out(page, 'affineCaption')).toContainText('affine board');
  await expect(out(page, 'affineBoard')).toHaveCount(0);
  await expect(control(page, 'openLab')).toHaveCount(0);
  await expect(control(page, 'step')).toBeDisabled();
  await expect(control(page, 'playToEnd')).toBeDisabled();
  // The marked cities carry a decoration on the board (not colour alone).
  expect(await root(page).locator('[data-mark]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mark')))).toEqual(['1', '3']);
});

test('D4 from city 1 ends at (1,2,1,1) after 4 moves with (0,1,0,0) and city 2 marked', async ({ page }) => {
  await open(page, 'g=D4&c=p&s=1,0,0,0');
  await control(page, 'playToEnd').click();
  expect(await values(page)).toEqual(['1', '2', '1', '1']);
  await expect(root(page)).toHaveAttribute('data-moves', '4');
  await expect(out(page, 'moveCount')).toHaveText('4');
  await expect(out(page, 'hMinus2')).toContainText('4');
  await expect(out(page, 'finalNumbers')).toHaveText('0, 1, 0, 0');
  await expect(out(page, 'marked')).toHaveText('2');
  await expect(out(page, 'endName')).toContainText('the highest root');
  await expect(out(page, 'returnCounts')).toHaveText('0, 1, 0, 0');
});

test('B3 from city 1 (long) ends at (1,2,2) after 3 moves; from city 3 (short) at (1,1,1) after 2', async ({ page }) => {
  await open(page, 'g=B3&c=p&s=0,1,0');
  await control(page, 'startCity').selectOption('1');
  expect(await values(page)).toEqual(['1', '0', '0']);
  await control(page, 'playToEnd').click();
  expect(await values(page)).toEqual(['1', '2', '2']);
  await expect(out(page, 'moveCount')).toHaveText('3');
  await expect(out(page, 'endName')).toContainText('the highest root');
  await expect(out(page, 'endName')).not.toContainText('short');
  await expect(out(page, 'hMinus2')).toHaveCount(0);
  await expect(out(page, 'finalNumbers')).toHaveText('0, 1, 0');
  await control(page, 'startCity').selectOption('3');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await control(page, 'playToEnd').click();
  expect(await values(page)).toEqual(['1', '1', '1']);
  await expect(out(page, 'moveCount')).toHaveText('2');
  await expect(out(page, 'endName')).toContainText('the highest short root');
  await expect(out(page, 'hMinus2')).toHaveCount(0);
  await expect(out(page, 'finalNumbers')).toHaveText('1, 0, 0');
  await expect(out(page, 'returnCounts')).toHaveText('2, 0, 0');
});

test('E8 from any city ends at (2,3,4,6,5,4,3,2) after 28 (play to the end)', async ({ page }) => {
  for (const city of [1, 8]) {
    const s = Array.from({ length: 8 }, (_, k) => (k + 1 === city ? 1 : 0)).join(',');
    await open(page, `g=E8&c=p&s=${s}`);
    const said = await recordLive(page);
    await control(page, 'playToEnd').click();
    await expect(root(page)).toHaveAttribute('data-moves', '28');
    expect(await values(page)).toEqual(['2', '3', '4', '6', '5', '4', '3', '2']);
    await expect(out(page, 'endName')).toContainText('the highest root');
    await expect(out(page, 'marked')).toHaveText('8');
    await expect(live(page)).toHaveText(/^Played 28 moves to the end\. Populations now 2, 3, 4, 6, 5, 4, 3, 2\. No city is unhappy\. This is the highest root\.$/);
    await page.waitForTimeout(700);
    expect(await said(), 'one announcement for the whole play').toHaveLength(1);
  }
});

// ---------------------------------------------------------------------------------------------
// Moods, the raising rule, hooks, keyboard, no JavaScript, small screens, links
// ---------------------------------------------------------------------------------------------

test('moods are shown by text and shape as well as colour', async ({ page }) => {
  await open(page);
  const m = await moods(page);
  expect(m.map((x) => x.label)).toEqual(['1', '2', '3']);
  expect(m.map((x) => x.word)).toEqual(['manic', 'unhappy', 'happy']);
  expect(new Set(m.map((x) => x.shape)).size).toBe(3);
  // The same shapes are drawn on the board beside the cities.
  expect(await root(page).locator('[data-glyph]').evaluateAll((els) => els.map((e) => e.getAttribute('data-glyph')))).toEqual(m.map((x) => x.shape));
  await expect(node(page, 2)).toHaveAttribute('aria-label', 'City 2, population 0, mutation would raise it');
  await expect(node(page, 1)).toHaveAttribute('aria-label', 'City 1, population 1, mutation would lower it');
  await expect(node(page, 3)).toHaveAttribute('aria-label', 'City 3, population 0, mutation would change nothing');
});

test('raising mode refuses a city that is not unhappy', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  await expect(live(page)).toHaveText('City 1 cannot be raised: its number is 2.');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await node(page, 3).click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  const m = await moods(page);
  for (const { label, word } of m) {
    await expect(node(page, Number(label))).toHaveAttribute('data-can-act', word === 'unhappy' ? 'true' : 'false');
  }
});

test('keyboard, hooks, no JavaScript, 320 pixels, link round trip', async ({ page, browser, baseURL }) => {
  await open(page);
  // Hooks on every node button.
  for (const b of await nodes(page).all()) {
    for (const a of ['data-node', 'data-board', 'data-value', 'data-can-act']) expect(await b.getAttribute(a), a).not.toBeNull();
  }
  await expect(out(page, 'bridgeSentence')).toHaveText(BRIDGE);
  // Keyboard: the board is one tab stop; the arrows move; Enter acts.
  await node(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(node(page, 2)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(live(page)).toHaveText('Mutated city 2. Populations now 1, 1, 0. Move 1.');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press(' ');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  // u and r while focus is inside the board.
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await page.keyboard.press('r');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  // Link round trip: half a second later the bar holds the link; a reload shows the same play.
  await expect.poll(() => new URL(page.url()).searchParams.get('w')).toBe('2.3');
  await page.reload();
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page)).toEqual(['1', '1', '1']);
  await expect(out(page, 'notice')).toHaveCount(0);
  // Undo, redo and reset restore positions exactly.
  await control(page, 'undo').click();
  expect(await values(page)).toEqual(['1', '1', '0']);
  await control(page, 'undo').click();
  expect(await values(page)).toEqual(['1', '0', '0']);
  await control(page, 'redo').click();
  expect(await values(page)).toEqual(['1', '1', '0']);
  await control(page, 'redo').click();
  expect(await values(page)).toEqual(['1', '1', '1']);
  await control(page, 'reset').click();
  expect(await values(page)).toEqual(['1', '0', '0']);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  // The table view acts too (A-10).
  await root(page).locator('summary').click();
  await root(page).locator('[data-table-node="2"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');

  // 320 pixels: no sideways scroll.
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, 'g=E8&c=p&s=1,0,0,0,0,0,0,0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // No JavaScript: the board, moods, caption, bridge sentence and table, every control disabled.
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto(ROUTE);
  await expect(nodes(nojs)).toHaveCount(3);
  expect((await moods(nojs)).map((x) => x.word)).toEqual(['manic', 'unhappy', 'happy']);
  await expect(out(nojs, 'caption')).toContainText('A3');
  await expect(out(nojs, 'bridgeSentence')).toHaveText(BRIDGE);
  await expect(out(nojs, 'goal')).toHaveAttribute('data-met', 'false');
  await expect(root(nojs).locator('details table')).toHaveCount(1);
  for (const el of await root(nojs).locator('button, select, input').all()) await expect(el).toBeDisabled();
  await context.close();
});

test('download data exports the state and the end', async ({ page }) => {
  await open(page, 'g=D4&c=p&s=1,0,0,0');
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', '4');
  const [download] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  expect(download.suggestedFilename()).toBe('kostant-kostant.json');
  const doc = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(doc.tool).toBe('kostant');
  expect(doc.state.tool).toBe('kostant');
  expect(doc.state.board).toBe('D4');
  expect(doc.state.view).toBe('populations');
  expect(doc.state.mode).toBe('raising');
  expect(doc.state.moves).toEqual([2, 3, 4, 2]);
  expect(doc.derived.positions).toHaveLength(5);
  expect(doc.derived.moods).toEqual(['happy', 'manic', 'happy', 'happy']);
  expect(doc.derived.end).toEqual({
    population: [1, 2, 1, 1],
    name: 'highest root',
    moves: 4,
    h: 6,
    finalNumbers: [0, 1, 0, 0],
    marked: [2],
    returnCounts: [0, 1, 0, 0],
  });
});

test('a numbers link is converted or refused', async ({ page }) => {
  await open(page, 'g=A3&c=n&s=2,-1,0');
  expect(await values(page)).toEqual(['1', '0', '0']);
  await expect(out(page, 'notice')).toHaveCount(0);
  await node(page, 2).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('c')).toBe('p');
  expect(new URL(page.url()).searchParams.get('s')).toBe('1,0,0');
  await open(page, 'g=A3&c=n&s=1,0,0');
  await expectDefault(page);
  await expect(out(page, 'notice')).toHaveText(NOTICE);
});

test('the history strip scrubs, and acting from an earlier position discards the later moves', async ({ page }) => {
  await open(page, 'g=D4&c=p&s=1,0,0,0');
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', '4');
  await root(page).locator('[data-step="1"]').click();
  expect(await values(page)).toEqual(['1', '1', '0', '0']);
  await expect(node(page, 3)).toHaveAttribute('data-can-act', 'true');
  await expect(node(page, 4)).toHaveAttribute('data-can-act', 'true');
  await node(page, 4).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect.poll(() => new URL(page.url()).searchParams.get('w')).toBe('2.4');
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page)).toEqual(['1', '1', '0', '1']);
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', '4');
  expect(await values(page)).toEqual(['1', '2', '1', '1']);
  await expect(out(page, 'endName')).toContainText('the highest root');
});

test('a start beyond SafeInt reloads with Big and long values are shortened', async ({ page }) => {
  const E20 = '100000000000000000000';
  await open(page, `g=A3&c=p&s=${E20},0,0`);
  await expect(out(page, 'notice')).toHaveCount(0);
  await expect(node(page, 1)).toHaveAttribute('data-value', E20);
  const numeral = root(page).locator('[data-numeral="1"]');
  await expect(numeral).not.toHaveText(E20);
  await expect(numeral).toHaveText(/^1\.0000\.\.\. x 10\^20/);
  // The tooltip of city 1 (the button's title) and the table view hold the exact digits.
  await expect(node(page, 1)).toHaveAttribute('title', E20);
  await expect(root(page).locator('[data-row="1"] [data-table-value="population"]')).toHaveText(E20);
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page)).toEqual([E20, E20, E20]);
  await expect(out(page, 'endName')).not.toContainText('highest');
  const [download] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const doc = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(doc.state.start).toEqual([E20, 0, 0]);
  expect(doc.derived.end.population).toEqual([E20, E20, E20]);
  expect(doc.derived.end.name).toBeNull();
});

test('the board has a text alternative', async ({ page, browser, baseURL }) => {
  const check = async (p: Page): Promise<void> => {
    const group = root(p).locator('[data-board-group]');
    await expect(group).toHaveAttribute('role', 'group');
    expect(await group.getAttribute('aria-label')).toMatch(/A3/);
    for (const svg of await root(p).locator('svg.drawing').all()) await expect(svg).toHaveAttribute('aria-hidden', 'true');
    for (const b of await nodes(p).all()) expect((await b.getAttribute('aria-label')) ?? '').not.toBe('');
  };
  await open(page);
  await check(page);
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto(ROUTE);
  await check(nojs);
  await context.close();
});

test('the board picker groups the 32 types by letter and resets start and moves', async ({ page }) => {
  await open(page);
  const groups = await control(page, 'picker').evaluate((el) =>
    [...el.querySelectorAll('optgroup')].map((g) => ({ letter: g.getAttribute('data-letter'), names: [...g.querySelectorAll('option')].map((o) => o.value) })),
  );
  expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  const names = groups.flatMap((g) => g.names);
  expect(names).toHaveLength(32);
  expect(names).toContain('B2');
  expect(names).toContain('C2');
  expect(names.some((n) => /[~^]/.test(n))).toBe(false);
  await control(page, 'step').click();
  await control(page, 'step').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await control(page, 'picker').selectOption('D4');
  await expect(nodes(page)).toHaveCount(4);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page)).toEqual(['1', '0', '0', '0']);
  await expect.poll(() => new URL(page.url()).searchParams.get('g')).toBe('D4');
  expect(new URL(page.url()).searchParams.get('w') ?? '').toBe('');
});

test('the codec refuses boards, views and modes T9 does not offer', async ({ page }) => {
  for (const query of [
    'g=B3~&c=p&s=1,0,0,0',
    'g=c:2,-1;-1,2&c=p&s=1,0',
    'g=A3&v=n&c=p&s=1,0,0',
    'g=A3&v=l&c=p&s=1,0,0',
    'g=A3&m=l&c=p&s=1,0,0',
    'g=A3&m=f&c=p&s=1,0,0',
    'g=A3&c=p&s=1,0,0&w=1',
  ]) {
    await open(page, query);
    await expectDefault(page);
    await expect(out(page, 'notice'), query).toHaveText(NOTICE);
  }
});

// ---------------------------------------------------------------------------------------------
// Predict (SPEC 4.0): T9 mounted with a prediction, bundled here and served from a stub origin as
// toolframe-hydration.spec.ts does, because no page of phase 1 places T9 with a prediction.
// ---------------------------------------------------------------------------------------------

test.describe('prediction', () => {
  const SITE = fileURLToPath(new URL('../../', import.meta.url));
  const ORIGIN = 'http://localhost:5988';
  const PAGE_PATH = '/kostant-prediction/';
  const props = {
    id: 'b1',
    caption: 'A3 from city 1.',
    board: 'A3',
    start: [1, 0, 0],
    prediction: { question: 'How many moves will the play take?', answer: { type: 'number', value: 2 }, reveal: 'Two raising moves reach the highest root.' },
  };
  let files = new Map<string, string>();
  let entry = '';
  let serverHtml = '';

  test.beforeAll(async () => {
    const component = join(SITE, 'src/components/tools/T09Kostant.svelte');
    const virtual: Plugin = {
      name: 'kostant-entry',
      resolveId: (id) => (id === 'virtual:kostant-entry' ? '\0kostant-entry' : null),
      load: (id) =>
        id === '\0kostant-entry'
          ? `import { hydrate } from 'svelte'; import T from ${JSON.stringify(component)};
             const target = document.getElementById('app');
             hydrate(T, { target, props: JSON.parse(target.dataset.props) });`
          : null,
    };
    const result = await build({
      configFile: false,
      root: SITE,
      logLevel: 'silent',
      cacheDir: join(tmpdir(), 'two-games-kostant-prediction-cache'),
      plugins: [virtual, svelte({ configFile: false })],
      resolve: { tsconfigPaths: true },
      build: { write: false, minify: false, modulePreload: false, rollupOptions: { input: { entry: 'virtual:kostant-entry' } } },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((o) => ('output' in o ? o.output : []));
    files = new Map();
    for (const o of outputs) {
      const text = o.type === 'chunk' ? o.code : typeof o.source === 'string' ? o.source : Buffer.from(o.source).toString('utf8');
      files.set(o.fileName, text);
      if (o.type === 'chunk' && o.isEntry) entry = o.fileName;
    }
    const loader = await ssrLoader();
    try {
      const { default: T } = await loader.load<{ default: unknown }>('/src/components/tools/T09Kostant.svelte');
      serverHtml = loader.render(T, props);
    } finally {
      await loader.close();
    }
  });

  test.beforeEach(async ({ context }) => {
    await context.route(`${ORIGIN}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === PAGE_PATH) {
        const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>T9 prediction</title></head><body><main><div id="app" data-props='${JSON.stringify(props)}'>${serverHtml}</div></main><script type="module" src="/${entry}"></script></body></html>`;
        await route.fulfill({ status: 200, contentType: 'text/html', body });
        return;
      }
      const file = files.get(url.pathname.slice(1));
      if (file === undefined) await route.fulfill({ status: 404, body: '' });
      else await route.fulfill({ status: 200, contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: file });
    });
  });

  test('a prediction freezes the board until it is answered', async ({ page }) => {
    await page.goto(`${ORIGIN}${PAGE_PATH}`);
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    for (const b of await nodes(page).all()) await expect(b).toBeDisabled();
    await expect(control(page, 'step')).toBeDisabled();
    await expect(control(page, 'playToEnd')).toBeDisabled();
    await control(page, 'predictAnswer').fill('2');
    await control(page, 'predictCheck').click();
    await expect(out(page, 'predictResult')).toContainText('2');
    await expect(node(page, 2)).toBeEnabled();
    await expect(control(page, 'step')).toBeEnabled();
    await expect(control(page, 'playToEnd')).toBeEnabled();
    await control(page, 'playToEnd').click();
    await expect(root(page)).toHaveAttribute('data-moves', '2');
  });

  test('without JavaScript the question is followed by details with the answer and the reveal', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html lang="en"><body><div id="app">${serverHtml}</div></body></html>` }),
    );
    const page = await context.newPage();
    await page.goto(`${ORIGIN}${PAGE_PATH}`);
    const details = root(page).locator('[data-prediction] details');
    await expect(details).toHaveCount(1);
    await expect(details).toContainText('Two raising moves reach the highest root.');
    await expect(details).toContainText('2');
    await context.close();
  });
});
