// RT-11: the repository's playwright.config.ts for this container's red-team runs: the same tests and
// options, but `astro preview` on port 5200 started in site/ (ports 5200 to 5203 are RT-11's; 4321 is not
// used), and never an existing server. OUT_DIR and BASE_PATH pass through to the preview as in the original.
// Run: PLAYWRIGHT_BROWSERS_PATH=<browsers> npx playwright test -c redteam/rt11-playwright.config.ts <spec>
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { siteAndBase } from '../site/astro.config.mjs';

const PORT = Number(process.env.RT11_PORT ?? 5200);
const { base } = siteAndBase(process.env);
const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  testDir: here('../site/tests/e2e'),
  testIgnore: process.env.BASE_PATH ? [] : ['**/basepath.spec.ts'],
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}${base}`,
    viewport: { width: 360, height: 800 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node ../node_modules/astro/bin/astro.mjs preview --port ${PORT} --ignore-lock`,
    cwd: here('../site'),
    url: `http://localhost:${PORT}${base}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
