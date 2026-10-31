// RT-03: a copy of the root playwright.config.ts on a port of its own (RT03_PORT, default 5040), so that
// the red-team specs run beside other agents. Build first (npm run build), then for example:
//   PLAYWRIGHT_BROWSERS_PATH=<browsers> npx playwright test -c redteam/RT-03/playwright.config.ts redteam-RT-03-garden
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PORT = Number(process.env.RT03_PORT ?? 5040);

export default defineConfig({
  testDir: `${ROOT}site/tests/e2e`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 360, height: 800 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node ../node_modules/astro/bin/astro.mjs preview --port ${PORT} --ignore-lock`,
    cwd: `${ROOT}site`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
