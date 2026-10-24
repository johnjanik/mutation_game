// The repository's Playwright configuration refuses a focused test in CI (COMMON.md 4.4 forbids .only;
// SPEC.md 7.7 requires the browser rows on every merge). Adopted from the red team (P3-RT-11-04), whose
// configuration spread this one over a spec holding a test.only and a failing sibling: with CI=1 it
// printed "1 passed" and exited 0, the sibling silenced; with forbidOnly it exited 1.
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('playwright.config.ts', () => {
  // regression: P3-RT-11-04
  it('has forbidOnly set when CI is set, so a test.only fails the CI run', async () => {
    vi.stubEnv('CI', '1');
    vi.resetModules();
    const config = (await import('../../../playwright.config')).default;
    expect(config.forbidOnly).toBe(true);
  });
});
