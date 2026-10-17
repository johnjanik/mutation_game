import { defineConfig } from 'vitest/config';

// P0-A1's project configuration, extended by P0-A2 with the include patterns of the three test
// directories and the global setup that collects the covers() registrations of the golden harness
// into test/golden/coverage.json after every run (CONTRACTS.md 3).
export default defineConfig({
  test: {
    name: 'engine',
    include: ['test/golden/**/*.test.ts', 'test/properties/**/*.test.ts', 'test/unit/**/*.test.ts'],
    globalSetup: ['test/golden/_coverage.setup.ts'],
  },
});
