// RT-07 attack 25 (and the main-thread rule of attack 22): the cost of one move in T1 must not grow with
// the length of the play. SPEC 7.4 "Single source of truth": "While a tool runs it keeps the list of
// positions of the current play in memory and extends it by one position per move, so a move costs one
// engine call however long the play is." SPEC 7.6 "Main-thread work": "No engine call on the main
// thread may become a long task (50 ms)".
// T01GameBoard.svelte derives `positionNames`, the spoken text of EVERY position of the play
// (`for (let k = 0; k <= game.moves.length; k++) game.shownAt(k) ...`), and History.svelte reads it on
// every change (above 50 positions only positionNames[cursor] is used), so each move rebuilds L + 1
// strings. A play of 20000 moves is one press of "Play to the end" on a board that is not of finite
// type (the cap of SPEC 5.6, CAPS.playMoves), so no long link is needed.
// Run: npx playwright test site/tests/e2e/redteam-RT-07-t1-move-cost.spec.ts
import { expect, test, type Page } from '@playwright/test';

/** The 12-cycle with the chord joining nodes 1 and 7 (the board of the benchmark of 7.6). */
function ringWithChord(): string {
  const C = Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => (i === j ? 2 : 0)));
  const join = (a: number, b: number): void => { C[a - 1]![b - 1] = -1; C[b - 1]![a - 1] = -1; };
  for (let k = 1; k <= 12; k++) join(k, (k % 12) + 1);
  join(1, 7);
  return `c:${C.map((r) => r.join(',')).join(';')}`;
}
const URL_LEGAL = `tools/board/?z=1&g=${ringWithChord()}&v=n&m=l&c=n&s=${Array(12).fill(1).join(',')}`;
const root = (page: Page) => page.locator('[data-tool="board"]');
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __lt: [number, number][] };
    w.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(URL_LEGAL);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

/** Presses Step once from inside the page and returns the time until the reactive update has run. */
async function timedStep(page: Page): Promise<{ ms: number; longest: number }> {
  return page.evaluate(async () => {
    const w = window as unknown as { __lt: [number, number][] };
    w.__lt = [];
    const button = document.querySelector('[data-tool="board"] [data-control="step"]') as HTMLButtonElement;
    const t = performance.now();
    button.click();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    const ms = performance.now() - t;
    await new Promise((r) => setTimeout(r, 300));
    return { ms, longest: Math.max(0, ...w.__lt.map(([, d]) => d)) };
  });
}

test('a Step press costs the same after 5 moves and after 20000 moves', async ({ page }) => {
  test.setTimeout(180000);
  await open(page);
  for (let i = 0; i < 5; i++) await timedStep(page);
  const short: number[] = [];
  for (let i = 0; i < 7; i++) short.push((await timedStep(page)).ms);
  await page.locator('[data-tool="board"] [data-control="playToEnd"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '20000', { timeout: 120000 });
  const long: number[] = [];
  const longest: number[] = [];
  for (let i = 0; i < 7; i++) { const r = await timedStep(page); long.push(r.ms); longest.push(r.longest); }
  test.info().annotations.push({ type: 'RT-07', description: `step after 12 moves: median ${median(short).toFixed(1)} ms [${short.map((x) => x.toFixed(1)).join(', ')}]; after 20000 moves: median ${median(long).toFixed(1)} ms [${long.map((x) => x.toFixed(1)).join(', ')}]; longest long task per press [${longest.map((x) => x.toFixed(0)).join(', ')}]` });
  console.log(test.info().annotations.at(-1)!.description);
  // one engine call per move however long the play (7.4): allow noise, not a factor that grows with L
  expect(median(long)).toBeLessThanOrEqual(median(short) * 2 + 5);
  // no long task on the main thread for one move (7.6)
  expect(median(longest)).toBeLessThanOrEqual(50);
});
