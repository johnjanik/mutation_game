// The "Show as table" view scrolls from the keyboard while its buttons are disabled (SPEC.md 7.5 A-10 "every
// tool has a 'show as table' view that presents the same state as an HTML table with a button per node"; A-11
// "A diagram that cannot [reflow] scrolls inside its own box"; A-1 "Every tool is fully operable from the
// keyboard"; 4.0 Predict "The board is frozen until the reader has answered or pressed 'show me'"; 7.7 axe "no
// serious or critical violations"). Adopted from the RT-05 phase 6 reproducer of P6-RT-05-02 (attacks 9, 33, 34
// and 39): ToolFrame's table view was a horizontal scroll box (RT-FIX P4-RT-05-02) with no tab stop of its own,
// so a keyboard reader scrolled it only by tabbing to a button inside it. While a prediction is pending, T13
// renders every button of its table view with the HTML disabled attribute, and T9 (Kostant's game) likewise, so
// the box had nothing to focus: at 320 pixels the tables of T13 (370 pixels wide) overflowed the 288-pixel box on
// M9's b6 and b7, and T9's on M1 b5 and M3 b8, and axe reported scrollable-region-focusable (serious). The box is
// now a named tab stop (role group, tabindex 0, data-scroll="table-view"), outside the fieldset that disables the
// buttons until hydration, so it is one before hydration and without JavaScript too.
// Hooks read: data-tool, data-instance, data-hydrated, data-prediction, data-scroll="table-view", ToolFrame's
// summary "Show as table" and its <details>.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 320, height: 800 } });

const CASES: [string, string, string][] = [
  ['modules/m9-real-forms/', 'satake', 'b6'],
  ['modules/m9-real-forms/', 'satake', 'b7'],
  ['modules/m1-mutation/', 'kostant', 'b5'],
];
/** T9 frozen on M3 b8, which the finding's reflow sweep reached too. */
const MORE_CASES: [string, string, string][] = [['modules/m3-classification/', 'kostant', 'b8']];

for (const [route, tool, inst] of [...CASES, ...MORE_CASES]) {
  // regression: P6-RT-05-02
  test(`/${route} ${tool} ${inst} at 320 x 800, prediction pending, "Show as table" open: the table view can be scrolled from the keyboard`, async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(route);
    const root = page.locator(`[data-tool="${tool}"][data-instance="${inst}"]`);
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    await expect(root.locator('[data-prediction]')).toBeVisible();
    // open the table view by keyboard
    await root.locator('summary', { hasText: 'Show as table' }).focus();
    await page.keyboard.press('Enter');
    const box = root.locator('[data-scroll="table-view"]');
    await expect(box).toBeVisible();
    const state = await box.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      tabStop: (el as HTMLElement).tabIndex >= 0,
      focusableInside: el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])').length,
    }));
    expect(state.scrollWidth, 'the table view overflows its box').toBeGreaterThan(state.clientWidth);
    expect.soft(
      state.tabStop || state.focusableInside > 0,
      `/${route} ${tool} ${inst}, 320 x 800, prediction pending, table view open: the box scrolls (${state.scrollWidth} in ${state.clientWidth}) but holds no tab stop (box tabindex ${state.tabStop}, focusable inside ${state.focusableInside})`,
    ).toBe(true);
    const r = await new AxeBuilder({ page }).include(`[data-tool="${tool}"][data-instance="${inst}"]`).withRules(['scrollable-region-focusable']).analyze();
    expect(r.violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

// The same cause before hydration: every button of the table view is disabled until the island hydrates (7.4),
// so without JavaScript the box is reached by Tab from its summary, and scrolls with the arrow keys.
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  // regression: P6-RT-05-02
  test('/modules/m9-real-forms/ satake b6 at 320 x 800 without JavaScript, "Show as table" open: Tab from the summary reaches the box, which scrolls from the keyboard', async ({ page }) => {
    await page.goto('modules/m9-real-forms/');
    const root = page.locator('[data-tool="satake"][data-instance="b6"]');
    const summary = root.locator('summary', { hasText: 'Show as table' });
    await summary.focus();
    await page.keyboard.press('Enter');
    const box = root.locator('[data-scroll="table-view"]');
    await expect(box).toBeVisible();
    const size = await box.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, tabIndex: (el as HTMLElement).tabIndex }));
    expect(size.scrollWidth, 'the table view overflows its box').toBeGreaterThan(size.clientWidth);
    // A tab stop of its own: Chromium also lets the keyboard reach a scroll box with nothing focusable inside,
    // other browsers and axe's scrollable-region-focusable do not.
    expect(size.tabIndex, 'the box is a tab stop of its own').toBe(0);
    await page.keyboard.press('Tab');
    expect(await box.evaluate((el) => el === document.activeElement), 'Tab from the summary reaches the box').toBe(true);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => box.evaluate((el) => el.scrollLeft), { message: 'the arrow key scrolls the box' }).toBeGreaterThan(0);
  });
});
