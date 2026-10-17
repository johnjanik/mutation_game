// Lesson reflow below 400 pixels (adopted from the red team's RT-05 reproducer, phase 3, round 1).
// On a lesson page below 400 pixels a tool figure must be moved to the viewport edges once. It was
// moved twice: once by Lesson.astro ([data-anatomy='figure'] { inline-size: 100vw; margin-inline:
// calc(50% - 50vw) }) and again by ToolFrame.svelte (.tool-figure { margin-inline: -16px } under
// max-width 399.98px). The figure was then 16 pixels wider than the viewport on each side: the page
// scrolled sideways (A-11), the board's box W was the viewport plus 32 (SPEC 6.1 wants W = the
// viewport width), and the left 16 pixels of every figure, including part of a node's hit area,
// could not be reached.
// Hooks read: data-instance, data-hydrated, data-node; the tool's <figure>.
import { expect, test } from '@playwright/test';

const LESSONS = ['modules/m0-start/', 'modules/m1-mutation/', 'modules/m2-form/', 'modules/m3-classification/', 'modules/m4-numbers/', 'modules/m5-weyl/'];

test.use({ viewport: { width: 320, height: 800 } });

for (const width of [320, 360]) {
  for (const route of LESSONS) {
    // regression: P3-RT-05-01
    test(`A-11: no page-level horizontal scroll at ${width} on /${route}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route);
      const [scrollWidth, clientWidth] = await page.evaluate(() => [document.scrollingElement!.scrollWidth, document.scrollingElement!.clientWidth]);
      expect(scrollWidth, `/${route} at ${width}x800: document scrollWidth (clientWidth ${clientWidth})`).toBe(clientWidth);
    });
  }
}

// regression: P3-RT-05-01
test('6.1: the E8 board of M5 (instance b8) at 320 has W = 320, u = 43 and lies inside the viewport', async ({ page }) => {
  await page.goto('modules/m5-weyl/');
  await page.locator('[data-instance="b8"]').scrollIntoViewIfNeeded();
  await page.locator('[data-instance="b8"][data-hydrated="true"]').waitFor();
  const m = await page.evaluate(() => {
    const t = document.querySelector('[data-instance="b8"]')!;
    const fig = t.querySelector('figure')!.getBoundingClientRect();
    const c = (l: string) => {
      const r = t.querySelector(`button[data-node="${l}"]`)!.getBoundingClientRect();
      return { cx: r.left + r.width / 2, left: r.left, right: r.right, w: r.width };
    };
    return { fig: [fig.left, fig.right], u: c('3').cx - c('1').cx, n1: c('1'), n8: c('8') };
  });
  // SPEC 6.1: below 400 pixels the box runs from edge to edge of the viewport, so W = 320 and
  // u = min(64, floor((320 - 16) / 7)) = 43 on E8 (A-7: "43 for seven (E8)").
  expect(m.fig, 'figure box [left, right] of /modules/m5-weyl/ b8 at 320').toEqual([0, 320]);
  expect(m.u, 'grid unit u (centre of node 3 minus centre of node 1) on E8, /modules/m5-weyl/ b8 at 320').toBe(43);
  expect(m.n1.w, 'hit side of node 1, E8 at 320').toBe(43);
  expect(m.n1.left, 'left edge of node 1 hit area (negative: off screen, unreachable)').toBeGreaterThanOrEqual(0);
  expect(m.n8.right, 'right edge of node 8 hit area').toBeLessThanOrEqual(320);
});
