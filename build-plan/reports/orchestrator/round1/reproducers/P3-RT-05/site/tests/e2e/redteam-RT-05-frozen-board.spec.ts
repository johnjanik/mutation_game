// RT-05 (red team, phase 3, round 1): reproducer for P3-RT-05-02.
// A board frozen by a prediction (SPEC 4.0 Predict) renders every node button with the HTML
// `disabled` attribute (Board.svelte: disabled={!hydrated || disabled}, the tools passing
// disabled={frozen}), so after hydration the board has no tab stop at all: the reader who uses a
// keyboard cannot reach the nodes, their names (A-3) or their values while answering the question
// about them. A-1: "its nodes are real <button> elements, one of which is in the tab order (roving
// tabindex)"; 4.0: "Each board is one tab stop".
// Run: npx playwright test -c redteam/redteam-RT-05-playwright.config.ts redteam-RT-05-frozen-board
import { expect, test, type Page } from '@playwright/test';

async function hydrated(page: Page, route: string, id: string): Promise<void> {
  await page.goto(route);
  await page.locator(`[data-instance="${id}"]`).scrollIntoViewIfNeeded();
  await page.locator(`[data-instance="${id}"][data-hydrated="true"]`).waitFor();
  await page.waitForTimeout(200);
}

const CASES = [
  { route: 'modules/m0-start/', id: 'b2', what: 'T1 populations view, number prediction' },
  { route: 'modules/m4-numbers/', id: 'b6', what: 'T1 linked view, number prediction (two boards)' },
  { route: 'modules/m5-weyl/', id: 'b9', what: 'T5 wave, number prediction' },
  { route: 'modules/m3-classification/', id: 'b8', what: 'T9 Kostant, choice prediction' },
];

for (const c of CASES) {
  test(`one tab stop per frozen board: /${c.route} ${c.id} (${c.what})`, async ({ page }) => {
    await hydrated(page, c.route, c.id);
    const groups = await page.evaluate((id) => {
      const root = document.querySelector(`[data-instance="${id}"]`)!;
      return [...root.querySelectorAll('[role="group"]')].filter((g) => g.querySelector(':scope > button[data-node]')).map((g) => {
        const bs = [...g.querySelectorAll(':scope > button[data-node]')] as HTMLButtonElement[];
        return { name: g.getAttribute('aria-label'), stops: bs.filter((b) => b.tabIndex === 0 && !b.disabled).length, disabled: bs.filter((b) => b.disabled).length, n: bs.length };
      });
    }, c.id);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.stops, `/${c.route} ${c.id} board "${g.name}" before the prediction is answered: focusable node buttons (disabled: ${g.disabled} of ${g.n})`).toBe(1);
    }
  });
}

test('Tab from the prediction reaches the frozen board of /modules/m0-start/ b2', async ({ page }) => {
  await hydrated(page, 'modules/m0-start/', 'b2');
  await page.locator('[data-instance="b2"] [data-control="predictShow"]').focus();
  const seen: string[] = [];
  for (let k = 0; k < 8; k++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement;
      return `${e.tagName}${e.dataset.node ? ' node ' + e.dataset.node : ''}${e.dataset.control ? ' ' + e.dataset.control : ''}`;
    });
    seen.push(f);
    if (f.includes('node') || f.includes('copyLink')) break;
  }
  expect(seen.some((s) => s.includes('node')), `focus order after "Show me" in b2: ${seen.join(' > ')}`).toBe(true);
});
