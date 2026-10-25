// P6-size: no default state calls the engine by a name its tool did not provide. engineCall
// (site/src/lib/worker.ts) runs on the main thread only the functions a caller handed over with
// provide(); any other name falls back to the whole engine, fetched as _astro/engineAll.<hash>.js
// (correct, but it brings back every engine module and with it the budget of SPEC.md 7.6). Every route
// of the built site is opened at 360 by 800 with JavaScript on and every island is brought to its
// hydrated default state with no click and no key, as worker-on-demand.spec.ts does (hydrate.ts); the
// test fails if the fallback chunk was requested. The positive control of the fallback itself is in
// site/tests/unit/worker-provide.test.ts.
// Hooks read: data-tool, data-hydrated; Astro's astro-island[ssr].
import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hydrateEveryIsland } from './hydrate';
import { discoverRoutes, distDir } from './routes';

const FALLBACK = /\/engineAll\.[^/]*\.js(\?|$)/;

/** The file name of the fallback chunk in the build. */
function fallbackChunk(): string[] {
  return readdirSync(join(distDir(), '_astro')).filter((f) => FALLBACK.test(`/${f}`));
}

test('the build emits the fallback chunk under the name this spec watches', () => {
  expect(fallbackChunk()).toHaveLength(1);
});

test('the watch below sees a fetch of the fallback chunk when one happens', async ({ page, baseURL }) => {
  // Positive control: the same listener, and the chunk loaded the way worker.ts loads it (a dynamic import).
  const requested: string[] = [];
  page.on('request', (r) => {
    if (FALLBACK.test(r.url())) requested.push(r.url());
  });
  await page.goto('tools/board/');
  const url = new URL(`_astro/${fallbackChunk()[0]!}`, baseURL).href;
  const names = await page.evaluate(async (u) => Object.keys(await import(u)), url);
  expect(names).toEqual(expect.arrayContaining(['orbitGraph', 'satake', 'chevalleySerre']));
  expect(requested).toHaveLength(1);
});

for (const route of discoverRoutes()) {
  test(`no default state loads the whole engine by a fallback: ${route.path}`, async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => {
      if (FALLBACK.test(r.url())) requested.push(r.url());
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(route.path);
    await hydrateEveryIsland(page);
    const tools = page.locator('astro-island [data-tool]');
    const n = await tools.count();
    for (let k = 0; k < n; k++) await expect(tools.nth(k)).toHaveAttribute('data-hydrated', 'true');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('astro-island[ssr]'), `islands not hydrated on ${route.path}`).toHaveCount(0);
    expect(requested, `fallback requests on ${route.path}`).toEqual([]);
  });
}
