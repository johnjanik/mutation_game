// P1-A2: no route fetches the engine worker's script before the first interaction (SPEC.md 5.1 E-9
// "No tool may need the worker for its default state"; 7.6 "The worker's script (E-9) is fetched when
// a tool first needs it"). Every route of the built site is opened at 360 by 800 with JavaScript on,
// left alone until every tool has hydrated (or the network is idle), and fails if the worker's
// script was requested. Vite 8 emits the worker as _astro/engine.worker-<hash>.js; the pattern below
// matches that name. The positive control (the worker is made at the first call routed to it) is in
// site/tests/unit/worker-routing.test.ts > the worker is lazy.
// Hooks read: data-tool, data-hydrated.
import { expect, test } from '@playwright/test';
import { discoverRoutes } from './routes';

const WORKER_SCRIPT = /engine\.worker/;

const routes = discoverRoutes();

for (const route of routes) {
  test(`no route fetches the worker before the first interaction: ${route.path}`, async ({ page, context }) => {
    const requested: string[] = [];
    await context.route(WORKER_SCRIPT, async (r) => {
      requested.push(r.request().url());
      await r.abort();
    });
    page.on('request', (r) => {
      if (WORKER_SCRIPT.test(r.url())) requested.push(r.url());
    });
    page.on('worker', (w) => requested.push(`worker started: ${w.url()}`));
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(route.path);
    const tools = page.locator('[data-tool]');
    const n = await tools.count();
    // Tools in view when the page opens hydrate (client:idle, or client:visible in view); the others
    // wait for a scroll, which would be touching the page, so only the network is waited for there.
    for (let k = 0; k < n; k++) {
      const box = await tools.nth(k).boundingBox();
      if (box !== null && box.y < 800 && box.y + box.height > 0) await expect(tools.nth(k)).toHaveAttribute('data-hydrated', 'true');
    }
    await page.waitForLoadState('networkidle');
    expect(requested, `worker requests on ${route.path}`).toEqual([]);
  });
}
