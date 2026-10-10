// P0-A5: the three phase-0 pages with JavaScript disabled (SPEC.md 7.4, 4.0 "Works before and
// without JavaScript", 7.6, 7.3, 7.9, A-12). Gate G0: "the page shows mathematics and the board
// with JavaScript disabled".
// Hooks read: data-tool, data-node, data-numeral and data-label (drawing, plan), data-package and
// data-licence (credits table, plan); the <noscript> line; the <math> element of the formula.
import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

const root = '[data-tool="board"]';

test('the board SVG with values renders without JavaScript', async ({ page }) => {
  await page.goto('./');
  const svg = page.locator(`${root} svg`);
  await expect(svg).toHaveCount(1);
  await expect(svg).toBeVisible();
  await expect(page.locator(`${root} svg [data-numeral="1"]`)).toHaveText('1');
  await expect(page.locator(`${root} svg [data-numeral="2"]`)).toHaveText('0');
  await expect(page.locator(`${root} svg [data-label="1"]`)).toHaveText('1');
  await expect(page.locator(`${root} svg [data-label="2"]`)).toHaveText('2');
  await expect(page.locator(`${root} svg line`)).toHaveCount(1); // the one road of A2
  await expect(page.locator(`${root} button[data-node]`)).toHaveCount(2);
});

test("the caption and the formula's MathML are present", async ({ page }) => {
  await page.goto('./');
  const caption = page.locator('figure figcaption');
  await expect(caption).toContainText('starting from (1, 0)');
  await expect(caption).toContainText('Mutating city 1 gives (−1, 0)');
  await expect(page.locator('main math')).toHaveCount(1);
  await expect(page.locator('main math annotation[encoding="application/x-tex"]')).toContainText('\\longmapsto');
  await expect(page.locator('h1')).toHaveText('Two Games on a Dynkin Diagram');
});

test('controls are disabled and the noscript line is present', async ({ page }) => {
  await page.goto('./');
  const buttons = page.locator(`${root} button`);
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(6); // two nodes, Undo, Redo, Reset, one strip position
  for (let k = 0; k < count; k++) await expect(buttons.nth(k)).toBeDisabled();
  for (const name of ['Undo', 'Redo', 'Reset']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  const noscript = page.locator(`${root} noscript`);
  await expect(noscript).toHaveCount(1);
  const html = await (await page.request.get('./')).text();
  expect(html).toMatch(/<noscript>[^<]*scripts are allowed[^<]*<\/noscript>/);
  await expect(page.locator(`${root} .nojs`)).toBeVisible();
  // Playwright's text matchers skip <noscript>, so read its text from the DOM.
  expect(await noscript.evaluate((el) => el.textContent)).toContain('scripts are allowed');
});

test('the island is hydrated with client:idle', async ({ page }) => {
  const html = await (await page.request.get('./')).text();
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  expect(islands).toHaveLength(1);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  await page.goto('./');
  await expect(page.locator('astro-island')).toHaveCount(1);
  await expect(page.locator('astro-island')).toHaveAttribute('client', 'idle');
});

test('about and credits render their text without JavaScript', async ({ page }) => {
  await page.goto('about/');
  const about = page.locator('main');
  await expect(about).toContainText('Two Games on a Dynkin Diagram');
  await expect(about).toContainText('connects two elementary games to Lie theory');
  await expect(about).toContainText('integer addition');
  await expect(about).toContainText('Wildberger');
  await expect(about).toContainText('Mozes');

  await page.goto('credits/');
  const credits = page.locator('main');
  for (const pkg of ['astro', 'svelte', 'katex']) {
    const row = page.locator(`tr[data-package="${pkg}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-licence]')).toHaveText(/\S/);
    await expect(row.locator('[data-licence]')).not.toHaveText('licence not stated in the package');
  }
  await expect(page.locator('tr[data-package="katex"] [data-licence]')).toHaveText('MIT');
  await expect(credits).toContainText('CC BY-SA 4.0');
  await expect(credits).toContainText('CC-BY-SA-4.0');
  await expect(credits).toContainText('Creative Commons Attribution-ShareAlike 4.0');
  await expect(credits).toContainText('MIT');
  for (const name of ['Wildberger', 'Mozes', 'Proctor', 'Eriksson']) await expect(credits).toContainText(name);
  await expect(credits).toContainText('[W20]');
  await expect(credits).toContainText('[W-MS]');
});
