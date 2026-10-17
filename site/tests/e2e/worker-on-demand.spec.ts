// P1-A2: no route fetches the engine worker's script before the first interaction (SPEC.md 5.1 E-9
// "No tool may need the worker for its default state"; 7.6 "The worker's script (E-9) is fetched when
// a tool first needs it"). Every route of the built site is opened at 360 by 800 with JavaScript on,
// every island is scrolled into view in turn until it has hydrated (hydrate.ts; no click, no key),
// every tool is waited for until it has hydrated and the network is idle, and the test fails if an
// island is left unhydrated or the worker's script was requested. Vite 8 emits the worker as
// _astro/engine.worker-<hash>.js; the pattern below matches that name. The positive control (the
// worker is made at the first call routed to it) is in site/tests/unit/worker-routing.test.ts > the
// worker is lazy.
// Hooks read: data-tool, data-hydrated; Astro's astro-island[ssr].
import { expect, test } from '@playwright/test';
import { hydrateEveryIsland } from './hydrate';
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
    // Every island is scrolled into view and hydrates with its default state (hydrate.ts); a scroll
    // is not the first interaction. Then every tool of an island must say it has hydrated (a root of
    // static markup, such as the stand-in of dev/lesson-check, has nothing to hydrate).
    await hydrateEveryIsland(page);
    const tools = page.locator('astro-island [data-tool]');
    const n = await tools.count();
    for (let k = 0; k < n; k++) await expect(tools.nth(k)).toHaveAttribute('data-hydrated', 'true');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('astro-island[ssr]'), `islands not hydrated on ${route.path}`).toHaveCount(0);
    expect(requested, `worker requests on ${route.path}`).toEqual([]);
  });
}

for (const route of routes.filter((r) => r.path.startsWith('modules/m'))) {
  // regression: P3-RT-06-02
  test(`worker-on-demand.spec.ts observes every island's hydration: ${route.path}`, async ({ page }) => {
    // The procedure of the test above, through the same helper.
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(route.path);
    await hydrateEveryIsland(page);
    await page.waitForLoadState('networkidle');
    // What it leaves unobserved: Astro keeps the attribute ssr on an island until it has hydrated it.
    const waiting = await page.$$eval('astro-island[ssr]', (is) =>
      is.map((i) => `${(i.getAttribute('component-url') ?? '').split('/').pop()?.split('.')[0]} ${i.querySelector('[data-tool]')?.getAttribute('data-instance') ?? ''}`),
    );
    const all = await page.locator('astro-island').count();
    expect(waiting, `${route.path}: ${waiting.length} of ${all} islands never hydrated during the gate's worker check: ${waiting.join(', ')}`).toEqual([]);
  });
}
