// Playwright configuration (SPEC.md 7.7). The browser suite runs against `astro preview` of the
// built site (SPEC.md 7.2 item 9). The base URL carries the base of site/astro.config.mjs so that
// the GITHUB_REPOSITORY rule and the BASE_PATH=/sub/path/ test work without editing this file.
// P0-A6 extends this file additively; WebKit is added in phase 3.
import { defineConfig } from '@playwright/test';
import { siteAndBase } from './site/astro.config.mjs';

const PORT = 4321;
const { base } = siteAndBase(process.env);

export default defineConfig({
  testDir: 'site/tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${base}`,
    viewport: { width: 360, height: 800 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
