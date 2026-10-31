// RT-04 (codec-attacker), attack 32 on linked tools: SPEC 7.4 "While a tool runs it keeps the list of
// positions of the current play in memory and extends it by one position per move, so a move costs
// one engine call however long the play is." The followers of a Game Board (T2 on M1 b2, T3 on M2 b2,
// both with linkTo="b1") recompute the whole play from the start on every move of the leader (T2:
// safeReplay(allMoves) in its followToolState callback; T3: meterModel -> positionsOf(followed)).
// After a link of 20000 moves on the leader, one move costs a replay of 20000 moves on the main thread.
// The control is /tools/board/ with the same link (no follower). The page document is served from
// site/dist through page.route, because astro preview refuses request lines above 16 KB (HTTP 431).
// Run (after npm run build): PLAYWRIGHT_BROWSERS_PATH=<browsers> npx playwright test
//   -c redteam/RT-04/playwright.config.ts redteam-RT-04-follower.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

async function gotoLong(page: Page, path: string, query: string): Promise<void> {
  await page.unrouteAll();
  await page.route((url) => url.pathname === `/${path}`, (route) =>
    route.request().resourceType() === 'document' ? route.fulfill({ path: `${DIST}${path}index.html`, contentType: 'text/html' }) : route.continue(),
  );
  await page.goto(`${path}?${query}`);
}

/** Time of one click on a node of the leader, until the effects it triggers have run (median of 5). */
async function moveCost(page: Page, path: string, leader: string | null, query: string, followerId: string | null): Promise<number> {
  await gotoLong(page, path, query);
  const root = page.locator(leader ? `[data-tool][data-instance="${leader}"]` : '[data-tool]').first();
  await root.scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  if (followerId) {
    const f = page.locator(`[data-tool][data-instance="${followerId}"]`);
    await f.scrollIntoViewIfNeeded();
    await expect(f).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    await root.scrollIntoViewIfNeeded();
  }
  const show = root.locator('[data-control="predictShow"]');
  if (await show.count()) await show.click();
  await page.waitForTimeout(300);
  const times: number[] = [];
  for (let k = 0; k < 5; k++) {
    const sel = leader ? `[data-tool][data-instance="${leader}"]` : '[data-tool]';
    times.push(await page.evaluate(async (s) => {
      const btn = document.querySelector(`${s} button[data-board="populations"][data-node="1"]`) as HTMLButtonElement;
      const t0 = performance.now();
      btn.click();
      await new Promise((r) => setTimeout(r, 0));
      return performance.now() - t0;
    }, sel));
    await page.waitForTimeout(100);
  }
  times.sort((a, b) => a - b);
  return times[2]!;
}

const w = (n: number, labels: number[]) => Array.from({ length: n }, (_, k) => labels[k % labels.length]).join('.');

test.setTimeout(300000);

test('one move of the leader after a long link: follower pages against the plain tool', async ({ page }) => {
  const r: Record<string, number> = {};
  r['tools/board A3, 1 move'] = await moveCost(page, 'tools/board/', null, 'g=A3&v=p&m=f&c=p&s=1,0,0&w=1', null);
  r['tools/board A3, 20000 moves'] = await moveCost(page, 'tools/board/', null, `g=A3&v=p&m=f&c=p&s=1,0,0&w=${w(20000, [1, 2, 3])}`, null);
  r['tools/board A2, 20000 moves'] = await moveCost(page, 'tools/board/', null, `g=A2&v=p&m=f&c=p&s=1,0&w=${w(20000, [1, 2])}`, null);
  r['M2 b1 (T3 meter b2 follows), 1 move'] = await moveCost(page, 'modules/m2-form/', 'b1', 'b1.w=1', 'b2');
  r['M2 b1 (T3 meter b2 follows), 20000 moves'] = await moveCost(page, 'modules/m2-form/', 'b1', `b1.w=${w(20000, [1, 2, 3])}`, 'b2');
  r['M1 b1 (T2 garden b2 follows), 1 move'] = await moveCost(page, 'modules/m1-mutation/', 'b1', 'b1.w=1', 'b2');
  for (const n of [2000, 5000, 20000]) r[`M1 b1 (T2 garden b2 follows), ${n} moves`] = await moveCost(page, 'modules/m1-mutation/', 'b1', `b1.w=${w(n, [1, 2])}`, 'b2');
  for (const [k, v] of Object.entries(r)) console.log(`${k}: ${v.toFixed(1)} ms`);
  const plain = r['tools/board A2, 20000 moves']!;
  const t2 = r['M1 b1 (T2 garden b2 follows), 20000 moves']!;
  // The same leader (a T1 on A2, populations, free) with the same 20000-move play; the only difference
  // is the following garden. The lens's margin for a replay is a ratio of 10 (plan).
  expect(t2 / plain, `T2 follower page ${t2.toFixed(1)} ms against the plain tool ${plain.toFixed(1)} ms`).toBeLessThan(10);
});
