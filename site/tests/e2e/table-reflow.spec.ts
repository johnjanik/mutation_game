// The table view keeps the page at 320 pixels (SPEC 7.5 A-11 "Prose and controls reflow at 320 CSS pixels. A
// diagram that cannot ... scrolls inside its own box"; A-10 "show as table"; 4.0 "Every tool is usable at a
// width of 320 CSS pixels"). Adopted from the RT-05 phase 4 reproducer (P4-RT-05-02, attacks 33 and 34):
// opening "Show as table" by keyboard on T1, T8 and T9 widened the whole tool frame past the viewport, since
// the table's min-content width set the frame's grid track, so the tool title, the figure, the board and the
// controls ran off-screen and the page scrolled sideways. The default states passed; only the open table view
// broke reflow. Hooks read: data-tool, data-instance, data-hydrated; ToolFrame's summary "Show as table" and
// its <details>, and the tool's <figure> (for the message only).
import { expect, test } from '@playwright/test';
import { hydrateEveryIsland } from './hydrate';

test.use({ viewport: { width: 320, height: 800 } });

const CASES: [string, string, string][] = [
  ['tools/board/?z=1&g=E8&v=l&m=f&c=n&s=1,1,1,1,1,1,1,1', 'board', ''],
  ['tools/kostant/', 'kostant', ''],
  ['tools/weyl/', 'weyl', ''],
  ['modules/m1-mutation/', 'board', 'b4'],
  ['modules/m3-classification/', 'board', 'b6'],
];

for (const [route, tool, inst] of CASES) {
  // regression: P4-RT-05-02
  test(`no page-level horizontal scroll at 320 with the table view of ${tool}${inst ? ` ${inst}` : ''} open on /${route}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(route);
    if (inst) await hydrateEveryIsland(page);
    const frame = page.locator(`[data-tool="${tool}"][data-instance="${inst}"]`);
    await expect(frame).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    const before = await page.evaluate(() => document.scrollingElement!.scrollWidth);
    expect(before, 'default state reflows').toBe(320);
    const summary = frame.locator('summary', { hasText: 'Show as table' });
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(frame.locator('details', { has: page.locator('summary', { hasText: 'Show as table' }) })).toHaveAttribute('open', '');
    const after = await page.evaluate(() => {
      const se = document.scrollingElement!;
      return { scrollWidth: se.scrollWidth, clientWidth: se.clientWidth };
    });
    const frameRight = await frame.evaluate((f) => Math.round(f.querySelector('figure')!.getBoundingClientRect().right));
    expect(after.scrollWidth, `/${route} ${tool} ${inst}: page width with "Show as table" open (figure right edge ${frameRight})`).toBe(after.clientWidth);
  });
}
