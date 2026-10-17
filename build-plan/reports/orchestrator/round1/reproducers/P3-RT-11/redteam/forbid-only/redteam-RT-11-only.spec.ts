// RT-11 attack 3 fixture: a focused test, as a builder might leave by mistake. Run only through
// redteam/forbid-only/redteam-RT-11-forbid-only.config.ts, which is the repository's playwright.config.ts with this
// directory as testDir. With forbidOnly set for CI, `CI=1 npx playwright test --list` must refuse it.
import { expect, test } from '@playwright/test';

test.only('a focused test left in by mistake', () => {
  expect(1).toBe(1);
});

test('a test that a focused sibling silences', () => {
  expect(1).toBe(2);
});
