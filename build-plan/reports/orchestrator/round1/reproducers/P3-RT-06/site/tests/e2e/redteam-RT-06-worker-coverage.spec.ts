// RT-06 attack 3 (red team, no-js-and-no-worker): what worker-on-demand.spec.ts actually observes. That spec
// opens each route at 360 by 800, waits only for the tools in the first screen to hydrate and for the
// network to be idle, and never scrolls, so every client:visible island below the first screen is never
// hydrated while it watches: their hydration (SPEC.md 7.6 "the others when scrolled into view
// (client:visible)"; E-9 "No tool may need the worker for its default state") is outside the gate's
// worker check. This test repeats the gate spec's procedure step by step and then counts the islands
// still waiting to hydrate (Astro keeps the attribute ssr until it hydrates an island); it fails when
// the gate's procedure leaves any island unobserved, and prints how many.
// Run: PLAYWRIGHT_BROWSERS_PATH=<browsers> npx playwright test -c redteam/redteam-RT-06-playwright.config.ts \
//        site/tests/e2e/redteam-RT-06-worker-coverage.spec.ts
import { expect, test } from '@playwright/test';
import { discoverRoutes } from './routes';
import { DIR } from './redteam-RT-06-helpers';

const routes = discoverRoutes(DIR).filter((r) => r.path.startsWith('modules/m'));

for (const route of routes) {
  test(`worker-on-demand.spec.ts observes every island's hydration: ${route.path}`, async ({ page }) => {
    // The procedure of worker-on-demand.spec.ts, unchanged.
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(route.path);
    const tools = page.locator('[data-tool]');
    const n = await tools.count();
    for (let k = 0; k < n; k++) {
      const box = await tools.nth(k).boundingBox();
      if (box !== null && box.y < 800 && box.y + box.height > 0) await expect(tools.nth(k)).toHaveAttribute('data-hydrated', 'true');
    }
    await page.waitForLoadState('networkidle');
    // What it leaves unobserved.
    const waiting = await page.$$eval('astro-island[ssr]', (is) =>
      is.map((i) => `${(i.getAttribute('component-url') ?? '').split('/').pop()?.split('.')[0]} ${i.querySelector('[data-tool]')?.getAttribute('data-instance') ?? ''}`),
    );
    const all = await page.locator('astro-island').count();
    expect(waiting, `${route.path}: ${waiting.length} of ${all} islands never hydrated during the gate's worker check: ${waiting.join(', ')}`).toEqual([]);
  });
}
