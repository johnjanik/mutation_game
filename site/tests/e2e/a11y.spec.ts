// P0-A5: automated accessibility scans (SPEC.md 7.7: "axe scan of every page and tool route ... no
// serious or critical violations") and the no-script guard of the two shell pages (7.6, first row).
// Later agents append routes to ROUTES. Paths are relative to baseURL, so the spec also holds
// under a base path. Hooks read: data-tool, data-hydrated.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

interface Route {
  name: string;
  path: string;
  /** True when the page carries a tool whose island must hydrate before the scan. */
  tool: boolean;
}

// MERGE, P1 stage 1.3 (request of P1-A2 and P1-A8): every route of the built site is scanned, discovered
// as nojs.spec.ts does, so that new lessons, tools and pages are covered without editing this list.
// A route carries a tool when its HTML has a data-tool root; such a route is scanned after hydration.
import { readFileSync } from 'node:fs';
import { discoverRoutes } from './routes';

export const ROUTES: Route[] = discoverRoutes()
  .filter((r) => r.path !== '404.html')
  .map((r) => ({ name: r.path === './' ? 'index page' : r.path, path: r.path, tool: /data-tool=/.test(readFileSync(r.file, 'utf8')) }));

/** The pages with no tool (SPEC 7.6, first row): they fetch no script file. */
const SHELL_PAGES = ROUTES.filter((r) => !r.tool);

async function openRoute(page: Page, route: Route): Promise<void> {
  await page.goto(route.path);
  if (route.tool) {
    // Every island on the page hydrates before the scan: client:visible islands below the fold are
    // scrolled into view first (MERGE, P1 stage 1.3). A tool root outside an island (the stand-in of
    // the dev lesson page) never hydrates and is scanned as it stands.
    const tools = page.locator('astro-island [data-tool]');
    const n = await tools.count();
    for (let k = 0; k < n; k++) {
      await tools.nth(k).scrollIntoViewIfNeeded();
      await expect(tools.nth(k)).toHaveAttribute('data-hydrated', 'true');
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
}

for (const route of ROUTES) {
  test(`${route.name} has no serious or critical axe violations`, async ({ page }) => {
    await openRoute(page, route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }));
    expect(serious).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
}

test('about and credits fetch no script and carry no data-tool', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of SHELL_PAGES) {
    const scripts: string[] = [];
    const listener = (request: { resourceType(): string; url(): string }): void => {
      const url = request.url();
      if (request.resourceType() === 'script' || /\.m?js(\?|$)/.test(new URL(url).pathname)) scripts.push(url);
    };
    page.on('request', listener);
    await page.goto(route.path, { waitUntil: 'networkidle' });
    page.off('request', listener);
    expect(scripts, route.name).toEqual([]);
    // MERGE (P1 stage 1.1): the shell's theme switch is one small inline script (P1-A4); no script file is fetched.
    await expect(page.locator('script[src]'), route.name).toHaveCount(0);
    await expect(page.locator('[data-tool]'), route.name).toHaveCount(0);
    await expect(page.locator('main h1'), route.name).toHaveCount(1);
  }
});
