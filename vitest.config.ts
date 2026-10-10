// The root Vitest configuration (CONTRACTS.md 1). Vitest 5.0.3 reads `test.projects` here;
// workspace files are no longer read, so there is no vitest.workspace.ts. P0-A6 extends this
// file additively.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    projects: [
      'packages/engine',
      {
        // The path aliases of CONTRACTS.md 1 for the site unit tests (request of P1-A3, MERGE P1 stage 1.1).
        resolve: {
          alias: {
            '@engine': here('./packages/engine/src/index.ts'),
            '@components': here('./site/src/components'),
            '@lib': here('./site/src/lib'),
          },
        },
        test: {
          name: 'site-unit',
          include: ['site/tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
