// A board frozen by a prediction keeps its one tab stop (SPEC 7.5 A-1: "its nodes are real <button>
// elements, one of which is in the tab order (roving tabindex)"; 4.0: "Each board is one tab stop";
// 4.0 Predict: "The board is frozen until the reader has answered or pressed 'show me'"). Frozen means
// that no move acts, not that the nodes leave the focus order: the HTML `disabled` attribute is for the
// time before hydration only (7.4). Adopted from the RT-05 reproducer of round 1.
// Hooks read: data-instance, data-hydrated, data-node, data-control, and the board group of A-1.
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
  // regression: P3-RT-05-02
  test(`one tab stop per frozen board: /${c.route} ${c.id} (${c.what})`, async ({ page }) => {
    await hydrated(page, c.route, c.id);
    const groups = await page.evaluate((id) => {
      const root = document.querySelector(`[data-instance="${id}"]`)!;
      // The node buttons of the instance, grouped by the board group of A-1 that holds them.
      const byGroup = new Map<Element, HTMLButtonElement[]>();
      for (const b of root.querySelectorAll('button[data-node]') as NodeListOf<HTMLButtonElement>) {
        const g = b.closest('[role="group"]');
        if (g === null) continue;
        byGroup.set(g, [...(byGroup.get(g) ?? []), b]);
      }
      return [...byGroup].map(([g, bs]) => ({ name: g.getAttribute('aria-label'), stops: bs.filter((b) => b.tabIndex === 0 && !b.disabled).length, disabled: bs.filter((b) => b.disabled).length, n: bs.length }));
    }, c.id);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.stops, `/${c.route} ${c.id} board "${g.name}" before the prediction is answered: focusable node buttons (disabled: ${g.disabled} of ${g.n})`).toBe(1);
    }
  });
}

// regression: P3-RT-05-02
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

// The freeze itself still holds from the keyboard: Enter on the frozen board's tab stop makes no move,
// and the same key acts once the prediction is resolved (the guard that replaced the attribute).
test('Enter on a frozen node makes no move until the prediction is resolved (/modules/m0-start/ b2)', async ({ page }) => {
  await hydrated(page, 'modules/m0-start/', 'b2');
  const root = page.locator('[data-instance="b2"]');
  const city = root.locator('button[data-node="2"]');
  await city.focus();
  await expect(city).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(root).toHaveAttribute('data-moves', '0');
  await expect(city).toHaveAttribute('data-value', '1');
  await root.locator('[data-control="predictShow"]').click();
  await expect(root.locator('[data-out="predictResult"]')).not.toBeEmpty();
  await city.focus();
  await page.keyboard.press('Enter');
  await expect(root).toHaveAttribute('data-moves', '1');
  await expect(city).toHaveAttribute('data-value', '0');
});
