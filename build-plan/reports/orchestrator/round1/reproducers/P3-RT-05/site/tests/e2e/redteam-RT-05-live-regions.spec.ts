// RT-05 (red team, phase 3, round 1): reproducer for P3-RT-05-07.
// A-4: "Each move is announced through one polite live region per tool". ToolFrame renders that
// region ([data-live]); T16's import panel adds a second one (T16BoardIO.svelte: <p data-out="importStatus"
// role="status">, role status being an implicit polite live region), and T4 inserts a third kind while
// it counts in the worker (T04ClassificationLab.svelte: <p data-out="counterStatus" role="status">),
// at the same moment as it announces "Counting in the background." through the frame's region.
// Run: npx playwright test -c redteam/redteam-RT-05-playwright.config.ts redteam-RT-05-live-regions
import { expect, test } from '@playwright/test';

const LIVE = '[aria-live]:not([aria-live="off"]), [role="status"], [role="log"], [role="alert"]';

test('one live region in the Sandbox tool (/tools/sandbox/)', async ({ page }) => {
  await page.goto('tools/sandbox/');
  await page.locator('[data-tool][data-hydrated="true"]').waitFor();
  const regions = await page.evaluate((sel) => [...document.querySelector('[data-tool]')!.querySelectorAll(sel)].map((e) => `${e.tagName} role=${e.getAttribute('role')} aria-live=${e.getAttribute('aria-live')} data-out=${e.getAttribute('data-out')} data-live=${e.hasAttribute('data-live')}`), LIVE);
  expect(regions, '/tools/sandbox/ after hydration: live regions inside [data-tool]').toHaveLength(1);
});

test('one live region in the Classification Lab while it keeps counting (/tools/lab/, star with five arms)', async ({ page }) => {
  // The star with five arms: centre 1 joined to 2..6 (custom Cartan matrix, SPEC 6.6 `c:`).
  const C = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => (i === j ? 2 : i === 0 || j === 0 ? -1 : 0)));
  await page.goto(`tools/lab/?z=1&g=c:${C.map((r) => r.join(',')).join(';')}`);
  await page.locator('[data-tool][data-hydrated="true"]').waitFor();
  await page.locator('[data-control="keepCounting"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-out="counterStatus"]').waitFor({ timeout: 10000 });
  const regions = await page.evaluate((sel) => [...document.querySelector('[data-tool]')!.querySelectorAll(sel)].map((e) => `${e.tagName} role=${e.getAttribute('role')} data-out=${e.getAttribute('data-out')} text="${(e.textContent ?? '').trim()}"`), LIVE);
  expect(regions, '/tools/lab/ star with five arms, after "keep counting": live regions inside [data-tool]').toHaveLength(1);
});
