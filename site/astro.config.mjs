// Astro configuration for the site. SPEC.md 7.2 item 10: `site` and `base` come from the
// environment, so nothing has to be decided before the repository exists. CONTRACTS.md 1:
// `siteAndBase` is exported as a pure function so that the rule is unit-testable, and an
// optional OUT_DIR variable sets the output directory (used by the BASE_PATH=/sub/path/ build).
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { openItemsReportIntegration } from './src/lib/unverifiedRegistry.ts';
import { shippedPackagesIntegration } from './src/lib/pages/shippedPackages.ts';
import { execSync } from 'node:child_process';

/** The git commit of the build, for exportJSON and the Cite text (request of P1-A2; MERGE P1 stage 1.1). */
function gitCommit() {
  if (given(process.env.PUBLIC_GIT_COMMIT)) return process.env.PUBLIC_GIT_COMMIT;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** An environment value counts as set only when it is a non-empty string. */
function given(value) {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Normalise a base path so that it begins and ends with exactly one `/`. */
export function normaliseBase(base) {
  let b = base.trim();
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b = b + '/';
  return b.replace(/\/{2,}/g, '/');
}

/**
 * The rule of SPEC.md 7.2 item 10, with SITE_URL and BASE_PATH treated independently:
 * each variable when it is set; otherwise the values that follow from GITHUB_REPOSITORY
 * (`owner/repo` gives `https://owner.github.io` and `/repo/`); otherwise `http://localhost` and `/`.
 * @param {Record<string, string | undefined>} env
 * @returns {{ site: string; base: string }}
 */
export function siteAndBase(env) {
  const siteUrl = given(env.SITE_URL);
  const basePath = given(env.BASE_PATH);
  const repository = given(env.GITHUB_REPOSITORY);
  const parts = repository && repository.includes('/') ? repository.split('/') : null;
  const owner = parts && parts[0] ? parts[0] : undefined;
  const repo = parts && parts[1] ? parts[1] : undefined;

  const site = siteUrl ?? (owner ? `https://${owner}.github.io` : 'http://localhost');
  const base = normaliseBase(basePath ?? (repo ? `/${repo}/` : '/'));
  return { site, base };
}

/**
 * The output directory: OUT_DIR when set (absolute, or relative to the site directory),
 * otherwise Astro's default `./dist`.
 * @param {Record<string, string | undefined>} env
 */
export function outDirFrom(env) {
  return given(env.OUT_DIR) ?? './dist';
}

const { site, base } = siteAndBase(process.env);

export default defineConfig({
  site,
  base,
  outDir: outDirFrom(process.env),
  output: 'static',
  // shippedPackagesIntegration: the packages whose code the client build bundles, for the credits page (SPEC.md 7.9).
  integrations: [mdx(), svelte(), openItemsReportIntegration(), shippedPackagesIntegration()],
  vite: { define: { 'import.meta.env.PUBLIC_GIT_COMMIT': JSON.stringify(gitCommit()) } },
  markdown: { processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { output: 'htmlAndMathml' }]] }) },
});
