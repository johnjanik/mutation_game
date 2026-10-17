// The serial timing run of the site (P4-X2 for MERGE, P4 wave 4.4). The site unit tests that assert on a
// duration measured with performance.now() live here, not in site/tests/unit: the root vitest.config.ts runs
// its projects' files in parallel, and there the medians grew past their bounds (T10 measured 31.6 and
// 36.9 ms against 25, and 17.8 and 19.4 ms alone). `npm run bench` runs this configuration after the
// engine's orbit benchmark of SPEC 7.6 (packages/engine/test/bench/vitest.config.ts), one file at a time.
// `npm test` never collects these files: the root configuration's site-unit project includes only
// site/tests/unit. The aliases are read from that project, so both runs resolve imports the same way.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import rootConfig from '../../../vitest.config.ts';

type InlineProject = { test?: { name?: string }; resolve?: { alias?: Record<string, string> } };

const siteUnit = (rootConfig.test?.projects ?? []).find(
  (p): p is InlineProject => typeof p === 'object' && p !== null && 'test' in p && (p as InlineProject).test?.name === 'site-unit',
);
const alias = siteUnit?.resolve?.alias;
if (alias === undefined) throw new Error('site/tests/timing/vitest.config.ts: the root vitest.config.ts has no site-unit project with aliases');

export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  resolve: { alias },
  test: {
    name: 'site-timing',
    include: ['site/tests/timing/**/*.timing.test.ts'],
    environment: 'node',
    fileParallelism: false,
  },
});
