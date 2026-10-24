// Opening a valid link writes nothing to the address bar before the reader acts (plan, P1-A2 instruction
// 5.6: "Nothing is written on load or hydration; the address bar changes only after the reader acts";
// SPEC.md 7.4 History API: replaceState "after a move"; SPEC.md 6.6: "only instances the reader has
// changed are written"). Adopted from the RT-04 lens reproducer (phase 4 round, finding 3 of
// redteam-RT-04-p4-findings.spec.ts). The cause was in site/src/lib/history.ts: a tool applies its
// link after ToolFrame has registered the instance, and the link's state reached stateChanged as if
// the reader had changed it, so the bar was rewritten about half a second after load.
// Needs the built site (npm run build). Reads no class name; data-tool and data-hydrated only.
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, path: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[]; __hist: [string, number, string][] };
    w.__copied = [];
    w.__hist = [];
    for (const k of ['replaceState', 'pushState'] as const) {
      const orig = history[k].bind(history);
      history[k] = (...a: Parameters<History['pushState']>) => {
        w.__hist.push([k, performance.now(), String(a[2] ?? '')]);
        return orig(...a);
      };
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copied.push(t); } } });
  });
  await page.goto(path);
  const t = page.locator('[data-tool]').first();
  await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  await page.waitForTimeout(1500);
  return t;
}

test.describe('the address bar is not rewritten on load', () => {
  for (const path of [
    'tools/geometry/?r=1.0.0',
    'tools/fold/?g=A5',
    'tools/geometry/?j=xyz:1,2,3@370,0,0',
    'tools/board/?g=A3&v=p&m=f&c=p&s=1,0,0&w=1',
    'tools/lab/?g=A4',
    'tools/affine/?g=A3~',
    'tools/sandbox/?g=A3',
    'tools/numbers/?g=A3&c=n&s=1,1,1&w=1',
    'tools/mirror/?g=B2',
    'modules/m7-geometry/?b1.r=0.1',
  ]) {
    // regression: P4-RT-04-03
    test(`${path}: no replaceState or pushState before the reader acts`, async ({ page }) => {
      const before = path.slice(path.indexOf('?'));
      await open(page, path);
      await page.waitForTimeout(1000);
      const h = await page.evaluate(() => (window as unknown as { __hist: [string, number, string][] }).__hist);
      const after = await page.evaluate(() => location.search);
      expect(h).toEqual([]);
      expect(after).toBe(before);
    });
  }
});

test('after the reader acts on a tool opened from a link, the bar is written', async ({ page }) => {
  await open(page, 'tools/board/?g=A3&v=p&m=f&c=p&s=1,0,0&w=1');
  await page.locator('[data-tool] button[data-board="populations"][data-node="2"]').first().click();
  await page.waitForTimeout(1500);
  const h = await page.evaluate(() => (window as unknown as { __hist: [string, number, string][] }).__hist);
  expect(h.map(([k]) => k)).toEqual(['replaceState']);
  expect(await page.evaluate(() => location.search)).toBe('?z=1&g=A3&v=p&m=f&c=p&s=1,0,0&w=1.2');
});
