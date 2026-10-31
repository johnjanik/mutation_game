// RT-13 (red team, reader-playtest), attacks 5, 29, 30, 15 and 36: answers typed the way the site
// prints them, the wrong-answer and "show me" paths, a shared position, nothing moving by itself,
// and the whole history. SPEC 4.0 Predict, History, Step and play to the end; 7.4; 8.1 P5, P9.
import { expect, test, type Locator, type Page } from '@playwright/test';

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
async function open(page: Page, route: string, id: string): Promise<Locator> {
  await page.goto(route);
  const t = tool(page, id);
  await t.scrollIntoViewIfNeeded();
  await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
  return t;
}
async function values(t: Locator, board: string): Promise<string[]> {
  return t.locator(`button[data-board="${board}"][data-node]`).evaluateAll((els) =>
    (els as HTMLElement[]).sort((a, b) => Number(a.dataset.node) - Number(b.dataset.node)).map((e) => e.dataset.value ?? ''));
}

// attack 5: M0 b4 asks a number whose answer is -1; the site prints negative numbers with U+2212.
const VARIANTS: [string, 'right' | 'wrong' | 'ungraded'][] = [
  ['-1', 'right'], ['−1', 'right'], [' -1 ', 'right'], ['1', 'wrong'], ['', 'ungraded'], ['-01', 'right'],
];
for (const [typed, expected] of VARIANTS) {
  test(`attack 5: M0 b4 answer typed as "${typed}" is ${expected}`, async ({ page }) => {
    const t = await open(page, 'modules/m0-start/', 'b4');
    await t.locator('[data-control="predictAnswer"]').fill(typed);
    await t.locator('[data-control="predictCheck"]').click();
    const result = t.locator('[data-out="predictResult"]');
    if (expected === 'right') await expect(result).toHaveText(/^Right/);
    if (expected === 'wrong') await expect(result).toHaveText(/^Not quite/);
    if (expected === 'ungraded') { await page.waitForTimeout(300); await expect(result).toHaveText(''); }
  });
}

test('attack 29: a wrong answer on M0 b2 reveals 0, unfreezes the board, and the move shows 0', async ({ page }) => {
  const t = await open(page, 'modules/m0-start/', 'b2');
  await t.locator('[data-control="predictAnswer"]').fill('2');
  await t.locator('[data-control="predictCheck"]').click();
  await expect(t.locator('[data-out="predictResult"]')).toContainText('0');
  await expect(t.locator('[data-out="predictReveal"]')).toContainText('0');
  await t.locator('button[data-board="populations"][data-node="2"]').click();
  expect(await values(t, 'populations')).toEqual(['1', '0', '0']);
});

test('attack 29: "show me" on M5 b9 reveals 4 and the wave can be played', async ({ page }) => {
  const t = await open(page, 'modules/m5-weyl/', 'b9');
  await t.locator('[data-control="predictShow"]').click();
  await expect(t.locator('[data-out="predictResult"]')).toContainText('4');
  await t.locator('[data-control="playToEnd"]').click();
  await expect(t.locator('[data-out="waveRounds"]')).toContainText('4');
});

test('attack 30: "Copy link" on M0 b3 after three moves opens b3 at that position and b1 at its default', async ({ page, context, browser, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const t = await open(page, 'modules/m0-start/', 'b3');
  for (const l of [2, 1, 3]) await t.locator(`button[data-board="numbers"][data-node="${l}"]`).click();
  const here = await values(t, 'numbers');
  await t.locator('[data-control="copyLink"]').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const fresh = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  const p2 = await fresh.newPage();
  const t2 = await open(p2, link, 'b3');
  await expect(t2).toHaveAttribute('data-moves', '3');
  expect(await values(t2, 'numbers')).toEqual(here);
  const b1 = await open(p2, link, 'b1');
  await expect(b1).toHaveAttribute('data-moves', '0');
  expect(await values(b1, 'populations')).toEqual(['0', '1', '0']);
  await fresh.close();
});

test('attack 15: no lesson instance moves by itself in five seconds after hydration', async ({ page }) => {
  test.setTimeout(120000);
  for (const m of ['m0-start', 'm1-mutation', 'm2-form', 'm3-classification', 'm4-numbers', 'm5-weyl']) {
    await page.goto(`modules/${m}/`);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-tool]')].every((t) => t.getAttribute('data-hydrated') === 'true'), null, { timeout: 60000 });
    const snap = () => page.locator('[data-tool]').evaluateAll((ts) => ts.map((t) => `${(t as HTMLElement).dataset.instance}:${(t as HTMLElement).dataset.moves}:${[...t.querySelectorAll('[data-node]')].map((n) => (n as HTMLElement).dataset.value).join(',')}:${t.querySelector('[data-out="found"]')?.textContent ?? ''}`).join(' '));
    const before = await snap();
    await page.waitForTimeout(5000);
    expect(await snap(), m).toEqual(before);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && !(a instanceof CSSTransition)).length);
    expect(running, `${m}: running animations`).toBe(0);
  }
});

test('attack 36: on A2 the strip shows every position up to 50, then a slider with a counter; acting from an earlier position discards the rest', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('tools/board/?z=1&g=A2&v=p&m=f&c=p&s=1,0&w=');
  const t = page.locator('[data-tool="board"]').first();
  await expect(t).toHaveAttribute('data-hydrated', 'true');
  for (let k = 0; k < 49; k += 1) await t.locator(`button[data-board="populations"][data-node="${(k % 2) + 1}"]`).click();
  await expect(t).toHaveAttribute('data-moves', '49');
  await expect(t.locator('[data-out="historyStrip"] [data-step]')).toHaveCount(50);
  await t.locator('button[data-board="populations"][data-node="2"]').click();
  await expect(t).toHaveAttribute('data-moves', '50');
  await expect(t.locator('[data-control="historySlider"]')).toBeVisible();
  await expect(t.locator('[data-out="historyCounter"]')).toContainText('50'); // observed "50 of 50": positions 0 to 50
  await t.locator('[data-control="historySlider"]').fill('3'); // positions from (1, 0): (1,0) (-1,0) (-1,-1) (0,-1)
  expect(await values(t, 'populations')).toEqual(['0', '-1']);
  await t.locator('button[data-board="populations"][data-node="2"]').click();
  await expect(t).toHaveAttribute('data-moves', '4');
});

// attack 4 and 29 (minor): the result line repeats a choice that already ends with a full stop.
for (const [route, id, option] of [['modules/m1-mutation/', 'b5', 'No, every start ends at the same population.'], ['modules/m2-form/', 'b5', 'No, it is not a root population.']] as const) {
  test(`${route} ${id}: the result line of a right choice reads as one sentence`, async ({ page }) => {
    const t = await open(page, route, id);
    await t.getByLabel(option, { exact: true }).check();
    await t.locator('[data-control="predictCheck"]').click();
    await expect(t.locator('[data-out="predictResult"]')).toHaveText(`Right: ${option}`);
  });
}
