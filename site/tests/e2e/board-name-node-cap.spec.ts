// RT-04 finding P3-RT-04-01 in the browser: a board name with more than 12 nodes is drawn instead of
// giving the notice (SPEC 6.6 Validation, "a board that ... has more than 12 nodes").
// Run (after npm run build): npx playwright test site/tests/e2e/board-name-node-cap.spec.ts
// data-out names read: notice, importStatus.
import { expect, test } from '@playwright/test';

const NOTICE = 'The link could not be read, so the tool shows its default state.';

for (const [tool, g] of [['board', 'A13'], ['board', 'A12~'], ['garden', 'A13'], ['form', 'A13'], ['lab', 'A13'], ['sandbox', 'A13'], ['sandbox', 'A12~']] as const) {
  // regression: P3-RT-04-01
  test(`/tools/${tool}/?g=${g} shows the notice and the default board, not ${g}`, async ({ page }) => {
    await page.goto(`tools/${tool}/?g=${g}`);
    const root = page.locator('[data-tool]').first();
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    await page.waitForTimeout(300);
    const seen = await root.evaluate((r) => ({
      labels: [...new Set([...r.querySelectorAll('button[data-node]')].map((e) => e.getAttribute('data-node')))],
      notice: (r.querySelector('[data-out="notice"]')?.textContent ?? '').trim(),
    }));
    console.log(`${tool} ${g}: ${seen.labels.length} node labels drawn (${seen.labels.join(',')}); notice ${JSON.stringify(seen.notice)}`);
    expect(seen.notice).toBe(NOTICE);
    expect(seen.labels.length).toBeLessThanOrEqual(12);
  });
}

// regression: P3-RT-04-01
test('T16 "Import board" of the JSON text "A13" (a board name) is refused like a 13-node matrix', async ({ page }) => {
  await page.goto('tools/sandbox/');
  const root = page.locator('[data-tool]').first();
  await expect(root).toHaveAttribute('data-hydrated', 'true');
  await root.locator('[data-control="importText"]').fill('"A13"');
  await root.locator('[data-control="importBoard"]').click();
  await page.waitForTimeout(300);
  const status = (await root.locator('[data-out="importStatus"]').textContent())?.trim();
  const labels = await root.locator('button[data-node]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-node')))]);
  console.log(`import "A13": status ${JSON.stringify(status)}; ${labels.length} node labels`);
  expect(status).toMatch(/^The board could not be read/);
  expect(labels.length).toBeLessThanOrEqual(12);
});

// regression: P3-RT-04-01
test('time from navigation to hydration for g=A100 and g=A200 on /tools/board/ (observation, no assertion on time)', async ({ page }) => {
  test.setTimeout(300000);
  for (const g of ['A2', 'A100', 'A200']) {
    const t0 = Date.now();
    await page.goto(`tools/board/?g=${g}`);
    await expect(page.locator('[data-tool]').first()).toHaveAttribute('data-hydrated', 'true', { timeout: 280000 });
    await expect(page.locator('[data-tool] button[data-node][data-board="populations"]').first()).toBeVisible();
    const nodes = await page.locator('[data-tool] button[data-node][data-board="populations"]').count();
    console.log(`g=${g}: drawn after ${Date.now() - t0} ms with ${nodes} population nodes`);
  }
});
