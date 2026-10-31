// RT-05 (red team, phase 3, round 1): reproducer for P3-RT-05-11.
// A-11: "Prose and controls reflow at 320 CSS pixels." /dev/math-check/ (a route of site/dist, shipped
// in the release build too) holds KaTeX display formulas with no scroll box of their own (the
// `.katex-display { overflow-x: auto }` rule lives only in Lesson.astro), so a formula wider than the
// column makes the whole page scroll sideways: scrollWidth 374 at 320 and at 360.
// Run: npx playwright test -c redteam/redteam-RT-05-playwright.config.ts redteam-RT-05-devpage-reflow
import { expect, test } from '@playwright/test';

for (const width of [320, 360]) {
  test(`no page-level horizontal scroll on /dev/math-check/ at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('dev/math-check/');
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('.katex-display .base')].filter((e) => e.getBoundingClientRect().right > vw + 0.5).map((e) => `.katex-display .base right ${Math.round(e.getBoundingClientRect().right)}`);
      return { sw: document.scrollingElement!.scrollWidth, vw, wide };
    });
    expect(r.sw, `/dev/math-check/ at ${width}x800: document scrollWidth; past the right edge: ${JSON.stringify(r.wide)}`).toBe(r.vw);
  });
}
