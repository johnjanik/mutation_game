// The root Vitest configuration (CONTRACTS.md 1). Vitest 5.0.3 reads `test.projects` here;
// workspace files are no longer read, so there is no vitest.workspace.ts. P0-A6 extends this
// file additively.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/engine',
      {
        test: {
          name: 'site-unit',
          include: ['site/tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
