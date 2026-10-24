// After the reader acts on a page opened from a link, the address bar and "Copy link" give the current
// state of every instance, leaders and followers included (SPEC.md 7.4 History API: "Copy link" always
// encodes the current state; 7.4 "Tools on one page": a tool with linkTo shares the state of another;
// 6.6: instances, and only instances the reader has changed are written). These tests guard the fix of
// P4-RT-04-03 against its own regression, found by the confirmer of the phase 4 round: the first fix
// (commit 91c3fae) held an instance opened from a link back until the reader acted inside its own
// frame, so a leader moved from its follower's frame, a follower that came with its own link keys, and
// a follower changed while another instance's link was still held were never written. The cause is in
// site/src/lib/history.ts. Needs the built site (npm run build). Hooks read: data-frame, data-instance,
// data-hydrated, data-moves, data-node, data-board, data-value, data-control (jumpRow, copyLink,
// predictShow), and the summary "Show as table" of ToolFrame.
import { expect, test, type Browser, type Page } from '@playwright/test';

const frame = (id: string) => `[data-frame][data-instance="${id}"]`;

/** Captures what "Copy link" writes to the clipboard. */
async function captureClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copied.push(t); } } });
  });
}

async function hydrate(page: Page, ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    const f = page.locator(frame(id));
    await f.scrollIntoViewIfNeeded();
    await expect(f).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  }
  // A link may be applied a task after hydration; let every tool settle.
  await page.waitForTimeout(1500);
}

/** What an instance shows: its number of moves and the value of every node. */
function shown(page: Page, id: string): Promise<string> {
  return page.locator(frame(id)).first().evaluate((root) => {
    const nodes = [...root.querySelectorAll('[data-node][data-value]')].map((e) => `${e.getAttribute('data-board') ?? ''}:${e.getAttribute('data-node')}=${e.getAttribute('data-value')}`);
    return `${root.getAttribute('data-moves')}|${nodes.join(' ')}`;
  });
}

async function shownAll(page: Page, ids: readonly string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of ids) out[id] = await shown(page, id);
  return out;
}

/** Opens `route` with `search` in a new page and reads what the instances show there. */
async function reopen(browser: Browser, baseURL: string, route: string, search: string, ids: readonly string[]): Promise<Record<string, string>> {
  const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${route}${search}`);
  await hydrate(page, ids);
  const out = await shownAll(page, ids);
  await context.close();
  return out;
}

/** A press on the jump button of row `row` of the table of instance `id`. */
async function jump(page: Page, id: string, row: number): Promise<void> {
  const f = page.locator(frame(id));
  await f.locator('summary', { hasText: 'Show as table' }).first().click();
  const button = f.locator('[data-control="jumpRow"]').nth(row);
  await expect(button).toBeEnabled();
  await button.click();
  await page.waitForTimeout(1500);
}

async function copyLink(page: Page, id: string): Promise<string> {
  await page.locator(`${frame(id)} [data-control="copyLink"]`).first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length)).toBeGreaterThan(0);
  const link = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.pop() ?? '');
  return new URL(link).search;
}

const bar = (page: Page) => page.evaluate(() => location.search);

test.describe('the bar and Copy link after the reader acts on a page opened from a link', () => {
  // regression: P4-RT-04-03 (guards the fix's own regression: a follower that drives its leader)
  test('M5 ?b1.w=1: a jump in the table of the follower b2 moves b1, and the bar reopens to what both show', async ({ page, browser, baseURL }) => {
    test.setTimeout(120000);
    const route = 'modules/m5-weyl/';
    await page.goto(`${route}?b1.w=1`);
    await hydrate(page, ['b1', 'b2']);
    await jump(page, 'b2', 10);
    const now = await shownAll(page, ['b1', 'b2']);
    expect(now.b1!.startsWith('1|'), 'the jump moved b1 away from the link').toBe(false);
    expect(await reopen(browser, baseURL!, route, await bar(page), ['b1', 'b2'])).toEqual(now);
  });

  // regression: P4-RT-04-03 (guards the fix's own regression: a leader moved to its start from its follower)
  test('M1 ?b1.w=2.1: a jump to the start in the garden b2 takes b1 to no moves, and the bar reopens to that', async ({ page, browser, baseURL }) => {
    test.setTimeout(120000);
    const route = 'modules/m1-mutation/';
    await page.goto(`${route}?b1.w=2.1`);
    await hydrate(page, ['b1', 'b2']);
    await jump(page, 'b2', 0);
    const now = await shownAll(page, ['b1', 'b2']);
    expect(now.b1!.startsWith('0|'), 'b1 is back at the start').toBe(true);
    expect(new URLSearchParams(await bar(page)).get('b1.w')).not.toBe('2.1');
    expect(await reopen(browser, baseURL!, route, await bar(page), ['b1', 'b2'])).toEqual(now);
  });

  for (const [query, untouched] of [
    // The follower came with its own link keys.
    ['?b1.w=2&b2.z=1&b2.g=A2&b2.c=p&b2.s=1,0&b2.w=2', null],
    // Another instance came with a link and the reader never touches it.
    ['?b1.w=2&b3.w=1', 'b3'],
  ] as const) {
    // regression: P4-RT-04-03 (guards the fix's own regression: a follower's change was not written)
    test(`M1 ${query}: after a move on b1, the bar holds the follower b2 at the state it shows`, async ({ page, browser, baseURL }) => {
      test.setTimeout(120000);
      const route = 'modules/m1-mutation/';
      const ids = untouched === null ? ['b1', 'b2'] : ['b1', 'b2', untouched];
      await page.goto(`${route}${query}`);
      await hydrate(page, ids);
      const show = page.locator(`${frame('b1')} [data-control="predictShow"]`);
      if ((await show.count()) > 0 && (await show.first().isEnabled())) await show.first().click();
      await page.locator(`${frame('b1')} button[data-node="1"]`).first().click();
      await page.waitForTimeout(1500);
      const p = new URLSearchParams(await bar(page));
      expect(p.get('b1.w')).toBe('2.1');
      expect(p.get('b2.w')).toBe('2.1');
      if (untouched !== null) expect(p.get(`${untouched}.w`)).toBe('1');
      const now = await shownAll(page, ids);
      expect(await reopen(browser, baseURL!, route, await bar(page), ids)).toEqual(now);
    });
  }

  // regression: P4-RT-04-03 (guards the fix's own regression: Copy link after a follower drove its leader)
  test('M5 ?b1.w=1: Copy link before and after a jump in b2 reopens to the state shown', async ({ page, browser, baseURL }) => {
    test.setTimeout(180000);
    const route = 'modules/m5-weyl/';
    const ids = ['b1', 'b2'];
    await captureClipboard(page);
    await page.goto(`${route}?b1.w=1`);
    await hydrate(page, ids);
    const before = await shownAll(page, ids);
    expect(await reopen(browser, baseURL!, route, await copyLink(page, 'b2'), ids)).toEqual(before);
    await jump(page, 'b2', 10);
    const after = await shownAll(page, ids);
    expect(after).not.toEqual(before);
    expect(await reopen(browser, baseURL!, route, await copyLink(page, 'b2'), ids)).toEqual(after);
    expect(await reopen(browser, baseURL!, route, await copyLink(page, 'b1'), ids)).toEqual(after);
  });
});
