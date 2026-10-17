// Display formulas that scroll are keyboard reachable at 320 (adopted from the red team's RT-05
// reproducer, phase 3, round 1).
// A-11: what cannot reflow at 320 "scrolls inside its own box"; a scroll box must then be operable
// from the keyboard (WCAG 2.1.1). Lesson.astro gave every display formula of a lesson
// `overflow-x: auto` but no tab stop, so a display formula wider than the column at 320 pixels
// (M2 beat 2) was a scroll box that a keyboard user could not scroll: axe reported the serious
// violation scrollable-region-focusable at 320 pixels, a width the a11y sweep (360) never used.
// SPEC 7.7: "axe scan of every page and tool route ... no serious or critical violations".
// Formulas are found by KaTeX's outer class `katex-display` (unchanged across KaTeX releases,
// decisions/P0-A3.md); tools by data-tool and data-hydrated.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 320, height: 800 } });

const PAGES = ['modules/m0-start/', 'modules/m1-mutation/', 'modules/m2-form/', 'modules/m3-classification/', 'modules/m4-numbers/', 'modules/m5-weyl/', 'glossary/', 'sources/'];

for (const route of PAGES) {
  // regression: P3-RT-05-04
  test(`every scrolling display formula is keyboard reachable at 320 on /${route}`, async ({ page }) => {
    await page.goto(route);
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('.katex-display')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1)
        .filter((e) => (e as HTMLElement).tabIndex < 0 && !e.querySelector('a[href], button, input, [tabindex]:not([tabindex="-1"])'))
        .map((e) => `${e.parentElement?.id ? '#' + e.parentElement.id + ' > ' : ''}.katex-display (scrollWidth ${e.scrollWidth}, clientWidth ${e.clientWidth})`),
    );
    expect(bad, `/${route} at 320x800: display formulas that scroll but cannot be focused`).toEqual([]);
  });
}

// regression: P3-RT-05-04
test('axe: no serious scrollable-region-focusable on /modules/m2-form/ at 320', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('modules/m2-form/');
  // Every island hydrated first, as the a11y.spec.ts sweep does; then the whole page is scanned.
  const tools = page.locator('astro-island [data-tool]');
  const n = await tools.count();
  for (let k = 0; k < n; k++) {
    await tools.nth(k).scrollIntoViewIfNeeded();
    await expect(tools.nth(k)).toHaveAttribute('data-hydrated', 'true');
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  // The tag set of a11y.spec.ts (SPEC 7.7); serious and critical results only.
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}(${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), '/modules/m2-form/ at 320x800, after hydration').toEqual([]);
});
