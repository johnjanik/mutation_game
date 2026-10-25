// Copy link after the skip link on a page opened from a link (T12). Adopted from the RT-04 lens of the
// phase 5 round; the finding is P5-RT-04-01.
//
// SPEC 7.4: '"Copy link" always encodes the current state, whatever the address bar holds at that moment.'
// The history rule of RT-FIX-P4-shared (site/src/lib/history.ts head comment): Copy link encodes the state
// shown.
//
// Every page has the skip link `#main`. A keyboard reader who follows it makes a same-document navigation,
// and Chromium fires popstate (counted below). history.ts onPopState_ used to set each instance's recorded
// state from the plain codec, decodeState(location.search, tool, defaults), and call the tool's handler.
// T12 reads its links with rules of its own (t12/model.ts admitLink: a `g` or `k` takes that board's and
// node's defaults for what the link does not name, `c` without `s` keeps the tool's start); its handler
// (readLink) finds the state on screen unchanged and reports nothing, so the recorded state stayed the
// codec's reading, which is not the state on screen. Copy link (history.ts linkFor) encoded it, and the
// copied link reopened to another start and another relation. The screen itself does not change.
//
// Hooks read: data-tool, data-instance, data-hydrated, data-moves on the root; data-control="copyLink";
// data-table="board"; data-piece-waiting and data-waiting (a piece or a panel not drawn yet); data-drawn
// on the figure (data-node-shown); data-panel="string" with data-node, data-value and data-can-act;
// data-out "state-board", "state-node", "relation-formula"; data-export="svg" and
// data-export-option="footer" (ToolFrame), and data-footer in the exported SVG. The page's skip link
// a[href="#main"].
//
// Run (after npm run build): npx playwright test site/tests/e2e/history-popstate.spec.ts
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function capture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[]; __pops: number };
    w.__copied = [];
    w.__pops = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copied.push(t); } } });
    window.addEventListener('popstate', () => { w.__pops += 1; });
  });
}

const rootOf = (page: Page, instance: string): Locator =>
  instance === '' ? page.locator('[data-tool="rep"]').first() : page.locator(`[data-tool="rep"][data-instance="${instance}"]`);

async function copy(page: Page, instance: string): Promise<string> {
  const n = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length);
  await rootOf(page, instance).locator('[data-control="copyLink"]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length)).toBe(n + 1);
  const text = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1) ?? '');
  return new URL(text).search;
}

async function settled(page: Page, instance: string): Promise<void> {
  const root = rootOf(page, instance);
  await root.scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  await expect(root.locator('[data-table="board"]')).toBeAttached({ timeout: 20000 });
  await expect(root.locator('[data-piece-waiting], [data-waiting="true"]')).toHaveCount(0, { timeout: 20000 });
  await expect(root.locator('[data-node-shown]')).toHaveAttribute('data-drawn', 'true', { timeout: 20000 });
}

/** What T12 shows: board, node, the string viewer's values in label order, the relation, the moves. */
async function shown(page: Page, instance: string): Promise<Record<string, unknown>> {
  const root = rootOf(page, instance);
  const values = await root.locator('[data-panel="string"] button[data-node]').evaluateAll((els) =>
    els.map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value')] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v),
  );
  return {
    board: (await root.locator('[data-out="state-board"]').first().textContent())?.trim(),
    node: (await root.locator('[data-out="state-node"]').first().textContent())?.trim(),
    values,
    relation: await root.locator('[data-out="relation-formula"]').first().getAttribute('aria-label'),
    moves: await root.getAttribute('data-moves'),
  };
}

const CASES: { route: string; instance: string; query: string }[] = [
  { route: 'tools/rep/', instance: '', query: 'g=E7' },
  { route: 'tools/rep/', instance: '', query: 'k=2' },
  { route: 'tools/rep/', instance: '', query: 'g=D4&k=2' },
  { route: 'tools/rep/', instance: '', query: 'g=A3&c=n' },
  { route: 'modules/m8-lie-algebras/', instance: 'b12', query: 'b12.k=2' },
];

for (const { route, instance, query } of CASES) {
  // regression: P5-RT-04-01
  test(`${route}?${query}: after the skip link, Copy link still encodes the state shown`, async ({ page, context }) => {
    await capture(page);
    await page.goto(`${route}?${query}`);
    await settled(page, instance);
    const before = await shown(page, instance);
    const copiedBefore = await copy(page, instance);
    // A keyboard reader follows the skip link (one key press).
    await page.locator('a[href="#main"]').first().focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#main');
    await page.waitForTimeout(800);
    const pops = await page.evaluate(() => (window as unknown as { __pops: number }).__pops);
    await settled(page, instance);
    expect(await shown(page, instance), 'the screen is unchanged by the skip link').toEqual(before);
    const copiedAfter = await copy(page, instance);
    console.info(`?${query}: popstate events ${pops}; Copy link before ${copiedBefore}; after ${copiedAfter}`);
    // The link copied after the skip link reopens to the state that was on screen.
    const other = await context.newPage();
    await other.goto(`${route}${copiedAfter}`);
    await settled(other, instance);
    const reopened = await shown(other, instance);
    await other.close();
    expect(reopened, `the copied link ${copiedAfter} reopens to the state shown`).toEqual(before);
    expect(copiedAfter).toBe(copiedBefore);
  });
}

// The footer line of an exported figure carries the same link as Copy link (history.ts linkFor; SPEC 8.3).
const FOOTER_CASES: [string, string][] = [
  ['tools/rep/', 'g=E7'],
  ['tools/fold/', 'g=D4&y=3.2.4.1&c=p'],
  ['tools/geometry/', 'g=E8'],
];

for (const [route, query] of FOOTER_CASES) {
  // regression: P5-RT-04-01
  test(`${route}?${query}: after the skip link, the export footer links to the state shown`, async ({ page }) => {
    await capture(page);
    await page.goto(`${route}?${query}`);
    const root = page.locator('[data-tool]').first();
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    await page.waitForTimeout(2500);
    const n = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length);
    await root.locator('[data-control="copyLink"]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length)).toBe(n + 1);
    const before = new URL(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1) ?? '')).search;
    await page.locator('a[href="#main"]').first().focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#main');
    await page.waitForTimeout(1500);
    await expect(root.locator('[data-export-option="footer"]')).toBeChecked();
    const [download] = await Promise.all([page.waitForEvent('download'), root.locator('[data-export="svg"]').click()]);
    const svg = readFileSync((await download.path())!, 'utf8');
    const href = await page.evaluate((text) => new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('[data-footer] a')?.getAttribute('href') ?? '', svg);
    expect(href, 'the footer holds a link').not.toBe('');
    expect(new URL(href).search).toBe(before);
  });
}

// regression: P5-RT-04-01
test('tools/rep/?k=2: back to the link after a move writes nothing, and Copy link encodes the state shown', async ({ page }) => {
  await capture(page);
  await page.goto('tools/rep/?k=2');
  await settled(page, '');
  const linked = await shown(page, '');
  const copiedAtLoad = await copy(page, '');
  // The skip link adds an entry with the same query; a move on the string viewer is then written to it.
  await page.locator('a[href="#main"]').first().focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#main');
  await rootOf(page, '').locator('[data-panel="string"] button[data-node][data-can-act="true"]').first().click();
  await expect(rootOf(page, '')).toHaveAttribute('data-moves', '1');
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 5000 }).not.toBe('?k=2');
  // Back to the entry of the link: T12 shows the linked state again, and the bar is left as it was.
  await page.goBack();
  await expect(rootOf(page, '')).toHaveAttribute('data-moves', '0');
  await settled(page, '');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => `${location.search}${location.hash}`), 'the back button writes nothing').toBe('?k=2');
  expect(await shown(page, '')).toEqual(linked);
  expect(await copy(page, '')).toBe(copiedAtLoad);
});
