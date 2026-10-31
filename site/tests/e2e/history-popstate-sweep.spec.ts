// The popstate path of history.ts on every tool route (companion of history-popstate.spec.ts). Adopted
// from the RT-04 lens of the phase 5 round; the finding is P5-RT-04-01. A page is opened from a link
// that names some keys only; Copy link is read, the reader follows the skip link `#main` (one key press;
// Chromium fires popstate on that same-document navigation), and Copy link is read again. The board's
// values, data-moves and every data-out text are compared before and after, so a difference in the
// copied link is not a change of the screen.
// SPEC 7.4: '"Copy link" always encodes the current state, whatever the address bar holds at that moment.'
//
// Hooks read: data-tool, data-hydrated, data-moves on the root; data-control="copyLink"; data-node,
// data-value, data-board; every data-out but "notice" and "exportNotice" (compared), and data-out="notice"
// on the reopened page (printed). The page's skip link a[href="#main"].
//
// Run (after npm run build): npx playwright test site/tests/e2e/history-popstate-sweep.spec.ts
import { expect, test, type Page } from '@playwright/test';

const CASES: [string, string][] = [
  ['tools/rep/', 'g=E7'],
  ['tools/fold/', 'g=D4'],
  ['tools/fold/', 'g=D4&y=3.2.4.1&c=p'],
  ['tools/rep/', 'k=2&m=l&w=1.1'],
  ['tools/geometry/', 'g=E8'],
  ['tools/board/', 'g=E8'],
  ['tools/garden/', 'g=A4'],
  ['tools/form/', 'g=A4'],
  ['tools/lab/', 'g=A4'],
  ['tools/numbers/', 'g=A4'],
  ['tools/mirror/', 'g=G2'],
  ['tools/symbolic/', 'g=A4'],
  ['tools/weyl/', 'g=A4'],
  ['tools/kostant/', 'g=A4'],
  ['tools/affine/', 'g=A2~'],
  ['tools/sandbox/', 'g=A3'],
];

async function capture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[]; __pops: number };
    w.__copied = [];
    w.__pops = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copied.push(t); } } });
    window.addEventListener('popstate', () => { w.__pops += 1; });
  });
}

async function copy(page: Page): Promise<string> {
  const n = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length);
  await page.locator('[data-tool]').first().locator('[data-control="copyLink"]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length)).toBe(n + 1);
  const text = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1) ?? '');
  return new URL(text).search;
}

async function snapshot(page: Page): Promise<string> {
  return page.locator('[data-tool]').first().evaluate((root) => {
    const parts: string[] = [`moves=${root.getAttribute('data-moves')}`];
    for (const e of root.querySelectorAll('[data-node][data-value]')) parts.push(`${e.getAttribute('data-board') ?? ''}:${e.getAttribute('data-node')}=${e.getAttribute('data-value')}`);
    for (const e of root.querySelectorAll('[data-out]')) {
      const name = e.getAttribute('data-out');
      if (name === 'notice' || name === 'exportNotice') continue;
      parts.push(`${name}:${(e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    }
    return parts.join('\n');
  });
}

for (const [route, query] of CASES) {
  // regression: P5-RT-04-01
  test(`${route}?${query}: Copy link is the same before and after the skip link`, async ({ page }) => {
    await capture(page);
    await page.goto(`${route}?${query}`);
    await expect(page.locator('[data-tool]').first()).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    await page.waitForTimeout(2500);
    const shown = await snapshot(page);
    const before = await copy(page);
    await page.locator('a[href="#main"]').first().focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#main');
    await page.waitForTimeout(1500);
    const pops = await page.evaluate(() => (window as unknown as { __pops: number }).__pops);
    expect(await snapshot(page), 'the screen is unchanged').toBe(shown);
    const after = await copy(page);
    console.info(`${route}?${query}: popstate ${pops}; before ${before}; after ${after}`);
    // The link copied after the skip link, reopened, against the screen it was copied from.
    const other = await page.context().newPage();
    await other.goto(`${route}${after}`);
    await expect(other.locator('[data-tool]').first()).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    await other.waitForTimeout(2500);
    const reopened = await snapshot(other);
    const notice = other.locator('[data-tool] [data-out="notice"]');
    const noticeText = (await notice.count()) ? ((await notice.first().textContent()) ?? '').trim() : '';
    await other.close();
    const differ = shown.split('\n').filter((l, k) => reopened.split('\n')[k] !== l);
    console.info(`${route}${after} reopened: notice "${noticeText}"; ${differ.length} lines differ${differ.length ? `, first: ${differ.slice(0, 3).join(' | ')}` : ''}`);
    expect(after).toBe(before);
  });
}
