// The engine work of loading one board in a tool, on the largest boards the editor allows (12 nodes),
// adopted from the RT-07 lens (attack 24). SPEC 5.6: "A tool decides whether a board is of finite type
// by calling classify once when the board is loaded"; SPEC 7.6 "Main-thread work": "No engine call on
// the main thread may become a long task (50 ms) on that phone"; E-9: "The limit of 2000 ... keeps a
// main-thread call near 10 ms on a desktop processor."
// The time the main thread spends in engine code is the self time of the profile samples whose
// innermost frame lies in a chunk of engine code. The engine was one chunk (_astro/src.*.js); since
// P6-size each route's chunks hold the engine modules it uses, found by content (engineChunks.ts). Loading the 12-cycle
// (affine A11~) by link into T4 or T16 spent far more than 50 ms there without any slowdown, in one
// task: the board's verdict was computed 4 times when T4 loaded it and 5 times when T16 did (resolveBoard
// built a new board object on every call, and the verdict caches are keyed by the object), and the
// engine's classify and smallestNonfiniteSubboard did work whose result was never used (the affine
// candidates after the first match, a sub-board for every disconnected subset of nodes).
// After that fix T4 still spent 58 to 77 ms here (RT-FIX residual of P3-RT-07-02): its root counter's
// orbitGraph worked in bigint with decimal keys, smallestNonfiniteSubboard classified each connected
// subset in rationals, and T16 ran smallestNonfiniteSubboard for a sub-board it never shows. The sum of
// the engine's self time over the whole load is kept as the measure: at most 50 ms in all means that no
// engine call, and no task's share of engine work, reaches a long task (decisions/RT-FIX-P3-residual-perf.md).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { engineChunks } from './engineChunks';
import { distDir } from './routes';

/** The chunks of engine code; the one with classify's check of the board must be among them. */
const ENGINE = engineChunks();
const inEngine = (url: string): boolean => ENGINE.has(url.match(/\/_astro\/([^/?#]+\.js)(?:[?#].*)?$/)?.[1] ?? '');

const RING12 = `c:${Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => (i === j ? 2 : j === (i + 1) % 12 || i === (j + 1) % 12 ? -1 : 0)).join(',')).join(';')}`;
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;

/** Engine self time (ms) and long tasks while one route loads, without any slowdown. */
async function engineTimeOfLoad(page: Page, url: string, tool: string): Promise<{ engineMs: number; longTasks: number[] }> {
  await page.addInitScript(() => {
    const w = window as unknown as { __lt: number[] };
    w.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await page.goto(url);
  await expect(page.locator(`[data-tool="${tool}"]`)).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(1500);
  const { profile } = (await cdp.send('Profiler.stop')) as { profile: { nodes: { id: number; callFrame: { url: string } }[]; samples: number[]; timeDeltas: number[] } };
  const urlOf = new Map(profile.nodes.map((n) => [n.id, n.callFrame.url]));
  let us = 0;
  profile.samples.forEach((id, i) => { if (inEngine(urlOf.get(id) ?? '')) us += profile.timeDeltas[i] ?? 0; });
  const longTasks = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt);
  await cdp.detach();
  return { engineMs: us / 1000, longTasks };
}

for (const [tool, route] of [['lab', 'tools/lab/'], ['sandbox', 'tools/sandbox/']] as const) {
  // regression: P3-RT-07-02
  test(`${tool}: loading the 12-cycle by link keeps engine work under one long task`, async ({ browser }) => {
    test.setTimeout(240000);
    const ring: number[] = [];
    const def: number[] = [];
    const tasks: string[] = [];
    for (let r = 0; r < 5; r++) {
      for (const [url, into] of [[`${route}?z=1&g=${RING12}`, ring], [route, def]] as const) {
        const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, baseURL: test.info().project.use.baseURL });
        const page = await ctx.newPage();
        const m = await engineTimeOfLoad(page, url, tool);
        into.push(m.engineMs);
        if (into === ring) tasks.push(JSON.stringify(m.longTasks));
        await ctx.close();
      }
    }
    const note = `${tool}: engine self time on load, 12-cycle link median ${median(ring).toFixed(1)} ms [${ring.map((x) => x.toFixed(1)).join(', ')}], default board median ${median(def).toFixed(1)} ms; long tasks of the 12-cycle loads ${tasks.join(' ')}`;
    test.info().annotations.push({ type: 'RT-07', description: note });
    process.stdout.write(`${note}\n`);
    expect(median(ring)).toBeLessThanOrEqual(50);
    // P6-size: the measure finds engine code (a load of the 12-cycle classifies it), so the bound is not met by a measure of nothing.
    expect(median(ring)).toBeGreaterThan(0);
  });
}

// P6-size: the engine's chunks are found by content; the one with classify's check of the board is among them.
test('board-load.spec.ts finds the engine chunk that holds classify', () => {
  const astro = join(distDir(), '_astro');
  const withClassify = [...ENGINE].filter((f) => readFileSync(join(astro, f), 'utf8').includes('not a board: the diagonal must be 2'));
  expect(withClassify.length).toBeGreaterThan(0);
});
