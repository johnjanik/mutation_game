// Astro configuration for the site. SPEC.md 7.2 item 10: `site` and `base` come from the
// environment, so nothing has to be decided before the repository exists. CONTRACTS.md 1:
// `siteAndBase` is exported as a pure function so that the rule is unit-testable, and an
// optional OUT_DIR variable sets the output directory (used by the BASE_PATH=/sub/path/ build).
// The three functions live in ./src/lib/siteAndBase.mjs, plain JavaScript that the scripts of
// scripts/ import on every admitted Node; this file imports a .ts module, which plain Node 22.12 to
// 22.17 does not load (RT-FIX P4-RT-12-03).
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { openItemsReportIntegration } from './src/lib/unverifiedRegistry.ts';
import { shippedPackagesIntegration } from './src/lib/pages/shippedPackages.ts';
import { given, normaliseBase, outDirFrom, siteAndBase } from './src/lib/siteAndBase.mjs';
import { execSync } from 'node:child_process';

export { normaliseBase, outDirFrom, siteAndBase };

/** The git commit of the build, for exportJSON and the Cite text (request of P1-A2; MERGE P1 stage 1.1). */
function gitCommit() {
  if (given(process.env.PUBLIC_GIT_COMMIT)) return process.env.PUBLIC_GIT_COMMIT;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown';
  } catch {
    return 'unknown';
  }
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
