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

// What can reflow, reflows, inside the table view too (SPEC 7.5 A-11). Found by the confirmation of
// RT-FIX P6-RT-05-02: the table view's scroll box (data-scroll="table-view") holds a <fieldset> that disables
// the buttons until hydration, and a fieldset keeps the browser's min-inline-size: min-content, so it grew as
// wide as the widest table of the view and every narrower table was laid out at that width. On M9 b10 (D5,
// two tables) "The three conditions" was laid out 316 pixels wide in the 288-pixel box at 320, and its last
// column was cut at the box edge, although its narrowest layout is 231 pixels. A table that can be laid out
// within the box is laid out within the box; the box still scrolls as far as its widest table needs, and no
// further. T4's "Verdict" on /tools/lab/ is a table of another tool with two tables, for contrast.
// Hooks read: data-tool, data-instance, data-hydrated, data-scroll="table-view", ToolFrame's summary "Show as
// table", and each table by its caption (role table, accessible name).
const NARROW_CASES: [string, string, string, string][] = [
  ['modules/m9-real-forms/', 'satake', 'b10', 'The three conditions'],
  ['tools/lab/', 'lab', '', 'Verdict'],
];

for (const [route, tool, inst, name] of NARROW_CASES) {
  // regression: P6-MERGE-TV-01
  test(`at 320 the table "${name}" of ${tool}${inst ? ` ${inst}` : ''} on /${route} is laid out within the width of its table view`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(route);
    const frame = page.locator(`[data-tool="${tool}"][data-instance="${inst}"]`);
    await frame.scrollIntoViewIfNeeded();
    await expect(frame).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    await frame.locator('summary', { hasText: 'Show as table' }).focus();
    await page.keyboard.press('Enter');
    const box = frame.locator('[data-scroll="table-view"]');
    await expect(box).toBeVisible();
    const table = box.getByRole('table', { name, exact: true });
    await expect(table).toBeVisible();
    // The laid-out width first; then, by a style set and removed in the same task (no frame is drawn in
    // between), the narrowest and the widest layout of the table, and the narrowest of each table of the view.
    const m = await table.evaluate((target: HTMLElement) => {
      const view = target.closest('[data-scroll="table-view"]') as HTMLElement;
      const width = target.getBoundingClientRect().width;
      const sized = (t: HTMLElement, size: string): number => {
        const style = t.getAttribute('style');
        t.style.width = size;
        t.style.maxWidth = 'none';
        const w = t.getBoundingClientRect().width;
        if (style === null) t.removeAttribute('style');
        else t.setAttribute('style', style);
        return w;
      };
      const widest = Math.max(...[...view.querySelectorAll<HTMLElement>('table')].map((t) => sized(t, 'min-content')));
      return { width, min: sized(target, 'min-content'), max: sized(target, 'max-content'), boxWidth: view.clientWidth, scrollWidth: view.scrollWidth, widest };
    });
    const at = `/${route} ${tool} ${inst}, 320 x 800, "Show as table" open, table "${name}"`;
    expect(m.min, `${at}: its narrowest layout (${m.min}) fits the box (${m.boxWidth})`).toBeLessThanOrEqual(m.boxWidth);
    expect(m.max, `${at}: at its widest (${m.max}) it does not fit the box (${m.boxWidth}), so it wraps`).toBeGreaterThan(m.boxWidth);
    expect(m.width, `${at}: laid out ${m.width} pixels wide in a box ${m.boxWidth} wide (its narrowest layout is ${m.min}, the widest table of the view needs ${m.widest})`).toBeLessThanOrEqual(m.boxWidth);
    // The box scrolls as far as its widest table needs, and no further.
    const needed = Math.max(m.widest, m.boxWidth);
    expect(m.scrollWidth, `${at}: the box scrolls to ${m.scrollWidth}, its widest table needs ${m.widest}`).toBeGreaterThanOrEqual(Math.floor(needed));
    expect(m.scrollWidth, `${at}: the box scrolls to ${m.scrollWidth}, its widest table needs ${m.widest}`).toBeLessThanOrEqual(Math.ceil(needed));
  });
}
