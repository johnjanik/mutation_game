// SPEC.md 7.2 item 10: "One browser test runs the site built with BASE_PATH=/sub/path/, to catch a
// link that was typed with a leading slash." Run only through npm run e2e:basepath, which builds
// into site/dist-basepath (OUT_DIR) and serves it under /sub/path/ through playwright.config.ts.
// Not a tool test: it reads attributes and network traffic, no data-out hooks.
import { expect, test, type Page } from '@playwright/test';
import { join, resolve } from 'node:path';
import { outDirFrom } from '../../astro.config.mjs';
import { routesOf } from '../../../scripts/size.mjs';

const BASE = '/sub/path/';
const SITE_DIR = resolve(import.meta.dirname, '../..');
const PRECONDITION = 'basepath.spec.ts runs only through npm run e2e:basepath';

/** Attributes that carry a URL, as [selector, attribute]. */
const URL_ATTRIBUTES: [string, string][] = [
  ['a[href]', 'href'],
  ['link[href]', 'href'],
  ['script[src]', 'src'],
  ['img[src]', 'src'],
  ['source[src]', 'src'],
  ['video[src]', 'src'],
  ['iframe[src]', 'src'],
  ['object[data]', 'data'],
  ['use[href]', 'href'],
  ['image[href]', 'href'],
];

function requirePrecondition(baseURL: string | undefined): string {
  expect(process.env.BASE_PATH, PRECONDITION).toBe(BASE);
  expect(baseURL ?? '', PRECONDITION).toMatch(/\/sub\/path\/$/);
  return baseURL as string;
}

/**
 * Opens a route and checks every same-origin request it made, every URL attribute of its DOM, and
 * that each internal URL resolves with 200 under the base. Returns the number of URLs checked.
 */
async function checkRoute(page: Page, url: string, routePath: string): Promise<number> {
  const origin = new URL(url).origin;
  const requests: { url: string; type: string; failed: string | null }[] = [];
  const byUrl = new Map<string, (typeof requests)[number]>();
  page.on('request', (r) => {
    const entry = { url: r.url(), type: r.resourceType(), failed: null as string | null };
    requests.push(entry);
    byUrl.set(r.url(), entry);
  });
  page.on('requestfailed', (r) => {
    const entry = byUrl.get(r.url());
    if (entry) entry.failed = r.failure()?.errorText ?? 'failed';
  });
  const statuses = new Map<string, number>();
  page.on('response', (r) => statuses.set(r.url(), r.status()));

  const response = await page.goto(url, { waitUntil: 'networkidle' });
  const accepted = routePath === '/404' ? [200, 404] : [200];
  expect(accepted, `${url} answered ${response?.status()}`).toContain(response?.status());

  const problems: string[] = [];
  const checked = new Set<string>();
  for (const r of requests) {
    const u = new URL(r.url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    if (u.origin !== origin) {
      problems.push(`request to another origin (${r.type}): ${r.url}`);
      continue;
    }
    checked.add(r.url);
    if (!u.pathname.startsWith(BASE)) problems.push(`request outside ${BASE} (${r.type}): ${r.url}`);
    if (r.failed) problems.push(`request failed (${r.failed}): ${r.url}`);
    const status = statuses.get(r.url);
    const isDocument = r.url === url;
    if (!isDocument && status !== 200 && status !== 304) problems.push(`request answered ${status}: ${r.url}`);
  }

  const attributes = await page.evaluate((pairs) => {
    const found: { element: string; attribute: string; value: string }[] = [];
    for (const [selector, attribute] of pairs) {
      for (const el of Array.from(document.querySelectorAll(selector))) {
        found.push({ element: el.tagName.toLowerCase(), attribute, value: el.getAttribute(attribute) ?? '' });
      }
    }
    return found;
  }, URL_ATTRIBUTES);

  const internal = new Set<string>();
  for (const { element, attribute, value } of attributes) {
    const v = value.trim();
    if (v === '' || v.startsWith('#') || /^(mailto|tel|data|javascript):/i.test(v)) continue;
    const resolved = new URL(v, page.url());
    if (resolved.origin !== origin) {
      if (element === 'script') problems.push(`<script src="${v}"> points at another origin`);
      continue;
    }
    if (!resolved.pathname.startsWith(BASE)) {
      problems.push(`<${element} ${attribute}="${v}"> resolves to ${resolved.pathname}, outside ${BASE} (a link typed with a leading slash?)`);
      continue;
    }
    resolved.hash = '';
    internal.add(resolved.href);
  }
  for (const href of internal) {
    checked.add(href);
    const r = await page.request.get(href);
    if (r.status() !== 200) problems.push(`${href} answered ${r.status()}`);
    const final = new URL(r.url());
    if (!final.pathname.startsWith(BASE)) problems.push(`${href} redirected to ${final.pathname}, outside ${BASE}`);
  }

  expect(problems, `route ${routePath}`).toEqual([]);
  return checked.size;
}

function builtRoutes(): string[] {
  const distDir = resolve(SITE_DIR, outDirFrom(process.env));
  return routesOf(distDir).map((r) => r.route);
}

test('every internal link and asset of the index page lives under /sub/path/ and resolves', async ({ page, baseURL }) => {
  const base = requirePrecondition(baseURL);
  const urls = await checkRoute(page, base, '/');
  test.info().annotations.push({ type: 'urlsChecked', description: String(urls) });
  expect(urls).toBeGreaterThan(0);
});

test('every other route does too', async ({ browser, baseURL }) => {
  const base = requirePrecondition(baseURL);
  const routes = builtRoutes();
  expect(routes, `no index.html in ${join('site', outDirFrom(process.env))}`).toContain('/');
  let urls = 0;
  for (const route of routes.filter((r) => r !== '/')) {
    const page = await browser.newPage();
    try {
      urls += await checkRoute(page, base + route.replace(/^\//, ''), route);
    } finally {
      await page.close();
    }
  }
  test.info().annotations.push({ type: 'routesChecked', description: String(routes.length - 1) }, { type: 'urlsChecked', description: String(urls) });
});
