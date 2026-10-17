// RT-07 attack 24: the engine work of loading one board in a tool, on the largest boards the editor
// allows (12 nodes). SPEC 5.6: "A tool decides whether a board is of finite type by calling classify
// once when the board is loaded"; SPEC 7.6 "Main-thread work": "No engine call on the main thread may
// become a long task (50 ms) on that phone"; E-9: "The limit of 2000 ... keeps a main-thread call near
// 10 ms on a desktop processor."
// The engine is one chunk (_astro/src.*.js, see redteam/redteam-RT-07-engine-weight.mjs), so the time
// the main thread spends in engine code is the self time of the profile samples whose innermost frame
// lies in that chunk. Loading the 12-cycle (affine A11~) by link into T4 or T16 spends far more than
// 50 ms there on this machine without any slowdown, in one task; on the default board (A3) a few ms.
// (redteam/redteam-RT-07-classify-count.mjs, on a source-map build, counts the classify computations:
// the 12-node board's verdict is computed 4 times when T4 loads it and 5 times when T16 does.) The
// cause read in the code: resolveBoard (site/src/lib/state.ts) builds a new board object on every call
// and classifies it at once (verdictOf), and both verdict caches (state.ts and the engine's E-11
// WeakMap) are keyed by the board object, so every resolveBoard of the same spec during one load
// computes classify again; on the 12-cycle one computation takes about 10 ms in Node here.
// Run: npx playwright test site/tests/e2e/redteam-RT-07-board-load.spec.ts
import { expect, test, type Page } from '@playwright/test';

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
  profile.samples.forEach((id, i) => { if (/\/_astro\/src\.[^/]+\.js$/.test(urlOf.get(id) ?? '')) us += profile.timeDeltas[i] ?? 0; });
  const longTasks = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt);
  await cdp.detach();
  return { engineMs: us / 1000, longTasks };
}

for (const [tool, route] of [['lab', 'tools/lab/'], ['sandbox', 'tools/sandbox/']] as const) {
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
    console.log(note);
    expect(median(ring)).toBeLessThanOrEqual(50);
  });
}
