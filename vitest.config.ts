// The root Vitest configuration (CONTRACTS.md 1). Vitest 5.0.3 reads `test.projects` here;
// workspace files are no longer read, so there is no vitest.workspace.ts. P0-A6 extends this
// file additively.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/engine',
      {
        // The path aliases of CONTRACTS.md 1 for the site unit tests (request of P1-A3, MERGE P1 stage
        // 1.1), read from the paths of site/tsconfig.json, the one declaration that the build and the
        // type check read too (RT-FIX P3-RT-12-05).
        resolve: { tsconfigPaths: true },
        test: {
          name: 'site-unit',
          include: ['site/tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
