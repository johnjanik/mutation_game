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
  // basepath.spec.ts runs only through npm run e2e:basepath, against the BASE_PATH=/sub/path/ build.
  testIgnore: process.env.BASE_PATH ? [] : ['**/basepath.spec.ts'],
  fullyParallel: false,
  // A test.only left in a spec fails the run in CI instead of silencing the rest (RT-FIX P3-RT-11-04).
  forbidOnly: !!process.env.CI,
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
    // P0-A6: `-w site --` so that npm hands --port to astro (the root script swallowed it), and
    // --ignore-lock so that Astro 7 keeps the server in the foreground when it detects a coding
    // agent instead of detaching it (Playwright then reported "exited early").
    command: `npm run preview -w site -- --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
