// P6-size: no default state and no reader action calls the engine by a name its tool did not provide.
// engineCall (site/src/lib/worker.ts) runs on the main thread only the functions a caller handed over
// with provide(); any other name falls back to the whole engine, fetched as _astro/engineAll.<hash>.js
// (correct, but it brings back every engine module and with it the budget of SPEC.md 7.6). Every route
// of the built site is opened at 360 by 800 with JavaScript on and every island is brought to its
// hydrated default state with no click and no key, as worker-on-demand.spec.ts does (hydrate.ts); the
// test fails if the fallback chunk was requested. No default state calls engineCall today, so the
// interactions below drive the engineCalls that do run: one row per tool action (repair after review,
// P6-size-review.json finding 2). The positive control of the fallback itself is in
// site/tests/unit/worker-provide.test.ts.
// Hooks read: data-tool, data-hydrated; Astro's astro-island[ssr]; T10: data-node, data-control
// (drawOrbit), data-out (drawMs, vertexCount, pointsDrawn); T13: data-panel-tab, data-control
// (catalogue-load) with data-name, data-out (real-form with data-name, real-rank).
import { expect, test, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hydrateEveryIsland } from './hydrate';
import { discoverRoutes, distDir } from './routes';

const FALLBACK = /\/engineAll\.[^/]*\.js(\?|$)/;
const WORKER = /engine\.worker/;

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

// ---------------------------------------------------------------------------------------------
// Reader actions. A fallback happens only when an engineCall runs, and every engineCall today runs
// after a reader action. Each row opens a route, drives one action of a tool whose engineCalls E-9
// keeps on the main thread (or sends to the worker), checks that the result is shown, and fails if the
// fallback chunk was requested, or if the action went to the worker when E-9 keeps it on the main
// thread (and the other way round). A tool whose reader action makes an engineCall adds one row here
// (T13's row was added when it merged; T14 next): the route, 'main' or 'worker', and the action.
// ---------------------------------------------------------------------------------------------

interface Interaction {
  /** The tool and what the reader does, for the test title. */
  name: string;
  /** The page, relative to baseURL. */
  path: string;
  /** Where E-9 runs the action's engine calls: 'main' (no worker request at all) or 'worker' (at least one). */
  runs: 'main' | 'worker';
  /** Waits for the tool, drives the action and checks that its result is shown. */
  act: (page: Page) => Promise<void>;
  /** The test's time limit when the action is long (E8 in the worker). */
  timeout?: number;
}

const geometry = (page: Page) => page.locator('[data-tool="geometry"]');
const satake = (page: Page) => page.locator('[data-tool="satake"]');

/** T10 after its first draw. */
async function geometryReady(page: Page): Promise<void> {
  await expect(geometry(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(geometry(page).locator('[data-out="drawMs"]')).not.toHaveText('', { timeout: 15000 });
}

const INTERACTIONS: Interaction[] = [
  {
    name: 'T10 a ring click on A3 (orbitGraph and wythoffEdges on the main thread)',
    path: 'tools/geometry/?g=A3',
    runs: 'main',
    act: async (page) => {
      await geometryReady(page);
      const count = geometry(page).locator('[data-out="vertexCount"]');
      await expect(count).toHaveText('12');
      await geometry(page).locator('button[data-node="2"]').click();
      await expect(count).toHaveText('24', { timeout: 15000 });
    },
  },
  {
    name: 'T10 drawing 1_42 on E8 (in the worker)',
    path: 'tools/geometry/?g=E8&r=0.1.0.0.0.0.0.0',
    runs: 'worker',
    timeout: 180000,
    act: async (page) => {
      await geometryReady(page);
      const vertices = await geometry(page).locator('[data-out="vertexCount"]').innerText();
      expect(Number(vertices)).toBeGreaterThan(0);
      await geometry(page).locator('[data-control="drawOrbit"]').click();
      await expect(geometry(page).locator('[data-out="pointsDrawn"]')).toHaveText(vertices, { timeout: 150000 });
    },
  },
  {
    name: 'T13 loading so(3,5) from the D4 catalogue (satake, restrictedBoard and matchCatalogue on the main thread)',
    path: 'tools/satake/?g=D4',
    runs: 'main',
    act: async (page) => {
      const root = satake(page);
      await expect(root).toHaveAttribute('data-hydrated', 'true');
      await root.locator('[data-panel-tab="catalogue"]').click();
      await root.locator('[data-control="catalogue-load"][data-name="so(3,5)"]').click();
      await root.locator('[data-panel-tab="data"]').click();
      await expect(root.locator('[data-out="real-form"][data-name="so(3,5)"]')).toHaveCount(1, { timeout: 15000 });
      await expect(root.locator('[data-out="real-rank"]')).toHaveText('3');
    },
  },
];

for (const row of INTERACTIONS) {
  test(`a reader action loads no whole engine: ${row.name}`, async ({ page }) => {
    if (row.timeout !== undefined) test.setTimeout(row.timeout);
    const seen = { fallback: [] as string[], worker: [] as string[] };
    page.on('request', (r) => {
      if (FALLBACK.test(r.url())) seen.fallback.push(r.url());
      if (WORKER.test(r.url())) seen.worker.push(r.url());
    });
    page.on('worker', (w) => seen.worker.push(`worker started: ${w.url()}`));
    await page.goto(row.path);
    await row.act(page);
    await page.waitForLoadState('networkidle');
    expect(seen.fallback, `fallback requests after: ${row.name}`).toEqual([]);
    if (row.runs === 'main') expect(seen.worker, `worker requests after: ${row.name}`).toEqual([]);
    else expect(seen.worker.length, `worker requests after: ${row.name}`).toBeGreaterThan(0);
  });
}
