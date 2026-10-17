// RT-12: the repository's playwright.config.ts with only the port (5220, this lens's port), the
// server command (astro preview through Astro's own binary, --ignore-lock) and absolute paths
// changed, so that a clean clone can be tested without touching port 4321. Everything else
// (testIgnore, reporter, forbidOnly, projects, viewport, retries) is read from the repository's file.
// Copy this file into the root of the checkout under test and run, from anywhere:
//   RT12_REPO=<checkout> PLAYWRIGHT_BROWSERS_PATH=... npx --prefix <checkout> playwright test -c <checkout>/rt12.playwright.config.ts [spec]
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const REPO = resolve(process.env.RT12_REPO ?? fileURLToPath(new URL('./', import.meta.url)));
const repoConfig = (await import(join(REPO, 'playwright.config.ts'))).default;
const { siteAndBase } = await import(join(REPO, 'site', 'astro.config.mjs'));
const PORT = Number(process.env.RT12_PORT ?? 5220);
const { base } = siteAndBase(process.env);

export default defineConfig({
  ...repoConfig,
  testDir: join(REPO, repoConfig.testDir ?? 'site/tests/e2e'),
  outputDir: join(REPO, 'test-results'),
  use: { ...repoConfig.use, baseURL: `http://localhost:${PORT}${base}` },
  webServer: {
    command: `node ../node_modules/astro/bin/astro.mjs preview --port ${PORT} --ignore-lock`,
    cwd: join(REPO, 'site'),
    url: `http://localhost:${PORT}${base}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
