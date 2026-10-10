// P0-A3: the kept dev page shows build-time mathematics with no JavaScript (SPEC.md 7.2 items 2,
// 3 and 10, 7.5 A-12, 7.6). Hooks used: data-out="tex-frac" (the \frac{1}{2} fixture that passes
// through an MDX attribute). Formulas are found by the math element and by a class attribute that
// contains "katex", never by an exact KaTeX class selector.
import { expect, test, type Request } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// The installed KaTeX, resolved from site/ as src/lib/katex.ts and the scripts resolve it.
const requireFromSite = createRequire(new URL('../../package.json', import.meta.url));
const KATEX_VERSION: string = JSON.parse(readFileSync(requireFromSite.resolve('katex/package.json'), 'utf8')).version;

const PAGE = 'dev/math-check/';
const stylesheetPath = `katex/${KATEX_VERSION}/katex.min.css`;

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the dev page shows mathematics without JavaScript', async ({ page }) => {
    await page.goto(PAGE);
    expect(await page.locator('math').count()).toBeGreaterThan(0);
    expect(await page.locator('math[display="block"]').count()).toBeGreaterThan(0);
    expect(await page.locator('[class*="katex"]').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-out="tex-frac"] mfrac')).toHaveCount(1);
    await expect(page.locator('[data-out="tex-frac"] annotation[encoding="application/x-tex"]')).toHaveText('\\frac{1}{2}');
  });
});

test.describe('with JavaScript', () => {
  test('no KaTeX script is referenced or fetched', async ({ page }) => {
    const requests: Request[] = [];
    page.on('request', (request) => requests.push(request));
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.locator('script[src*="katex"]')).toHaveCount(0);
    const urls = requests.map((r) => new URL(r.url()).pathname);
    expect(urls.filter((u) => /katex.*\.m?js/i.test(u))).toEqual([]);
    const katexUrls = urls.filter((u) => u.includes('katex'));
    expect(katexUrls.length).toBeGreaterThan(0);
    for (const u of katexUrls) {
      const allowed = u.endsWith(`/${stylesheetPath}`) || u.includes(`/katex/${KATEX_VERSION}/fonts/`);
      expect(allowed, u).toBe(true);
    }
  });

  test('the dev page fetches no script', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await expect(page.locator('script[src]')).toHaveCount(0);
    await expect(page.locator('astro-island')).toHaveCount(0);
    expect(scripts).toEqual([]);
  });

  test('the KaTeX stylesheet resolves under the base path', async ({ page, baseURL }) => {
    await page.goto(PAGE);
    const links = page.locator('link[rel="stylesheet"][href*="katex"]');
    await expect(links).toHaveCount(1);
    const href = (await links.getAttribute('href')) as string;
    const basePath = new URL(baseURL as string).pathname;
    expect(href.startsWith(basePath)).toBe(true);
    expect(href).toContain(stylesheetPath);
    const response = await page.request.get(new URL(href, page.url()).toString());
    expect(response.status()).toBe(200);
  });

  test('the index page links the same stylesheet', async ({ page, baseURL }) => {
    await page.goto('./');
    const links = page.locator('link[rel="stylesheet"][href*="katex"]');
    await expect(links).toHaveCount(1);
    const href = (await links.getAttribute('href')) as string;
    expect(href).toBe(`${new URL(baseURL as string).pathname}${stylesheetPath}`);
    const response = await page.request.get(new URL(href, page.url()).toString());
    expect(response.status()).toBe(200);
  });
});
