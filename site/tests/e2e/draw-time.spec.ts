// P4-A2: the drawing-time test of SPEC.md 7.6 ("The E8 root set, its Coxeter projection and 6720
// edges draw in under 100 ms on the phone; a browser test records the drawing time on the CI runner
// and fails above 100 ms there."), gate G4. It opens the development page dev/draw-time/, whose probe
// (site/src/components/draw/DrawTimeProbe.svelte) draws the T10 showpiece five times on a canvas
// and reports the timings; "the drawing time" is the median of the five (plan), the first is
// reported beside it. The counts drawn are compared with the golden wythoff record of the E8 root
// polytope, read from reference/golden_data.json as data, so that the test cannot pass by drawing
// nothing.
//
// Hooks read (SPEC 4.0): data-tool="geometry" and data-hydrated on the probe's root; data-out names
// drawTime, drawTimes, firstDrawTime, segmentsDrawn, pointsDrawn, dpr, error.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface Golden {
  types: Record<string, { numbers_of_highest_root: number[] }>;
  wythoff: { type: string; rings: number[]; f_vector: number[]; edges_enumerated: boolean }[];
}
const golden = JSON.parse(readFileSync(new URL('../../../reference/golden_data.json', import.meta.url), 'utf8')) as Golden;

/** The budget of SPEC 7.6, in milliseconds. */
const BUDGET_MS = 100;
/** The number of timed draws the probe makes (plan). */
const RUNS = 5;

test('the E8 root set with 6720 edges draws in the Coxeter plane in under 100 ms', async ({ page }, testInfo) => {
  // The showpiece is the root polytope of E8: rings are the numbers of the highest root.
  const rings = golden.types['E8']!.numbers_of_highest_root;
  const record = golden.wythoff.find((w) => w.type === 'E8' && w.rings.join(',') === rings.join(','));
  expect(record, 'the golden wythoff record of the E8 root polytope').toBeDefined();
  expect(record!.edges_enumerated).toBe(true);

  await page.goto('dev/draw-time/');
  const root = page.locator('[data-tool="geometry"]');
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 60_000 });
  const out = async (name: string): Promise<string> => (await root.locator(`[data-out="${name}"]`).innerText()).trim();

  expect(await out('error')).toBe('');
  expect(Number(await out('segmentsDrawn'))).toBe(record!.f_vector[1]);
  expect(Number(await out('pointsDrawn'))).toBe(record!.f_vector[0]);

  const times = (await out('drawTimes')).split(',').map((s) => Number(s.trim()));
  expect(times).toHaveLength(RUNS);
  for (const t of times) expect(Number.isFinite(t) && t >= 0).toBe(true);
  const median = Number(await out('drawTime'));
  const first = Number(await out('firstDrawTime'));
  const dpr = Number(await out('dpr'));
  expect(first).toBe(times[0]);
  // The median of the five values shown (each rounded to one decimal) is the median reported.
  expect(median).toBe([...times].sort((a, b) => a - b)[Math.floor(RUNS / 2)]);
  expect(dpr).toBeGreaterThan(0);

  const summary = `E8 drawing time: median ${median} ms of ${RUNS} (${times.join(', ')} ms), first ${first} ms, dpr ${dpr}`;
  testInfo.annotations.push(
    { type: 'drawTime', description: String(median) },
    { type: 'drawTimes', description: times.join(', ') },
    { type: 'firstDrawTime', description: String(first) },
    { type: 'dpr', description: String(dpr) },
  );
  process.stdout.write(`${summary}\n`);
  expect(median, summary).toBeLessThan(BUDGET_MS);
});
