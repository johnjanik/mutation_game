// RT-06, incidental (attack 4 neighbourhood): the T2 counter in the browser, orbit mode on E8 from the
// fundamental weight of node 1. SPEC.md 4 T2 Interactions: "otherwise the counter says "more than 2000",
// and from phase 3 on a finite-type board it gives the exact size from orbitSize" (golden
// types.E8.fundamental_orbit_sizes[0]). The unit form is site/tests/unit/redteam-RT-06-garden-total.test.ts.
// Run: PLAYWRIGHT_BROWSERS_PATH=<browsers> npx playwright test -c redteam/redteam-RT-06-playwright.config.ts \
//        site/tests/e2e/redteam-RT-06-garden-total.spec.ts
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { fundamental_orbit_sizes: number[] }>;
};

test('T2 orbit of omega_1 on E8: the total is the orbit size, not "more than 2000"', async ({ page }) => {
  const expected = golden.types.E8!.fundamental_orbit_sizes[0]!;
  await page.goto('tools/garden/?z=1&g=E8&c=n&s=1,0,0,0,0,0,0,0');
  const root = page.locator('[data-tool="garden"]');
  await expect(root).toHaveAttribute('data-hydrated', 'true');
  await expect(root.locator('[data-out="notice"]')).toHaveCount(0);
  await expect(root.locator('[data-control="grows"]')).toHaveAttribute('aria-pressed', 'true');
  await root.locator('[data-control="showTotal"]').click();
  await expect(root.locator('[data-out="total"]')).not.toHaveText('');
  await expect(root.locator('[data-out="total"]')).toHaveText(String(expected));
});
