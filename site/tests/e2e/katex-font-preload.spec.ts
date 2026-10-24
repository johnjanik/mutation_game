// RT-FIX P4-RT-07-03 (from the RT-07 lens scripts redteam-RT-07-font-swap-shift.mjs, rt07-variant.mjs
// and rt07-load-profile.mjs, phase 4 round): the KaTeX fonts (katex.min.css, font-display: block) were
// requested only when the first layout met text set in them, arrived after the first paint, and made
// the browser lay out and paint the whole lesson again (M7: Total Blocking Time 423 ms as built against
// 196 ms with the three fonts preloaded, at four times slowdown; SPEC.md 7.6 allows 200 ms). The lens
// measured the cost with a counterfactual copy of the page that preloads M7's fonts; this test checks
// the cause on the built site: every KaTeX font a page fetches is preloaded from its head, every preload
// is used, and a page without KaTeX markup preloads and fetches none. The timing itself is npm run lab.
// Needs the built site (npm run build).
import { expect, test, type Page } from '@playwright/test';

const FONT = /\/katex\/[^/]+\/fonts\//;

/** Loads a route and returns the KaTeX font requests, the font preloads of the head, and unused-preload warnings. */
async function fontsOf(page: Page, route: string) {
  const requested: string[] = [];
  const warnings: string[] = [];
  page.on('request', (r) => {
    if (FONT.test(r.url())) requested.push(new URL(r.url()).pathname);
  });
  page.on('console', (m) => {
    if (/preload/i.test(m.text()) && /\/katex\//.test(m.text())) warnings.push(m.text());
  });
  await page.goto(route, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Chromium reports a preload that nothing used a few seconds after the load event.
  await page.waitForTimeout(4000);
  const preloads = await page.locator('head link[rel="preload"][as="font"]').evaluateAll((ls) =>
    ls.map((l) => ({ path: new URL((l as HTMLLinkElement).href).pathname, crossorigin: l.getAttribute('crossorigin'), type: l.getAttribute('type') })),
  );
  const beforeStylesheet = await page.evaluate(() => {
    const head = [...document.head.querySelectorAll('link')];
    const css = head.findIndex((l) => l.rel === 'stylesheet' && /katex\.min\.css$/.test(l.href));
    return head.every((l, k) => !(l.rel === 'preload' && l.as === 'font') || k < css);
  });
  return { requested, preloads, warnings, beforeStylesheet };
}

// regression: P4-RT-07-03
test('M7: every KaTeX font the page fetches is preloaded from its head, and every preload is used', async ({ page }) => {
  const { requested, preloads, warnings, beforeStylesheet } = await fontsOf(page, 'modules/m7-geometry/');
  // Observed at b9b8504: no preload; the page fetched Main-Regular, Math-Italic and SansSerif-Regular late.
  expect(preloads.length, 'font preloads in the head of M7').toBeGreaterThan(0);
  expect(new Set(requested), 'fonts fetched are exactly the fonts preloaded').toEqual(new Set(preloads.map((p) => p.path)));
  // One request per font: the stylesheet's request reused the preload (same URL, same CORS mode).
  expect(requested.length, requested.join(', ')).toBe(new Set(requested).size);
  for (const p of preloads) {
    expect(p.crossorigin, p.path).toBe('');
    expect(p.type, p.path).toBe('font/woff2');
  }
  expect(beforeStylesheet, 'the preloads come before the KaTeX stylesheet').toBe(true);
  expect(warnings).toEqual([]);
});

test('a lesson with KaTeX preloads its fonts; pages without KaTeX markup preload and fetch none', async ({ page }) => {
  const m0 = await fontsOf(page, 'modules/m0-start/');
  expect(m0.preloads.length).toBeGreaterThan(0);
  expect(new Set(m0.requested)).toEqual(new Set(m0.preloads.map((p) => p.path)));
  for (const route of ['tools/board/', 'about/']) {
    const other = await page.context().newPage();
    const r = await fontsOf(other, route);
    expect(r.preloads, route).toEqual([]);
    expect(r.requested, route).toEqual([]);
    await other.close();
  }
});
