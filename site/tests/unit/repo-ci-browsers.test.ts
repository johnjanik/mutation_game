// ci.yml and the MathML check of SPEC.md 7.3 (LinearForm's MathML is rendered natively by "the three
// browser engines [U: ... check in phase 3 ...]"; 7.8: ci.yml runs the tests of 7.7), adopted from
// the red team (RT-12 attack 36, redteam/rt12/workflows.mjs). site/tests/e2e/mathml.spec.ts has one
// test per engine and skips an engine that is not installed on the machine; ci.yml installed only
// Chromium, so in CI the WebKit and Firefox tests were always skipped and the check never ran there.
// Run: npx vitest run --project site-unit site/tests/unit/repo-ci-browsers.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');

describe('the browsers ci.yml installs', () => {
  // regression: P3-RT-12-03
  it('ci.yml installs WebKit and Firefox beside Chromium, before the browser tests', () => {
    const install = ci.split('\n').find((line) => /npx playwright install\b/.test(line)) ?? '';
    for (const engine of ['chromium', 'webkit', 'firefox']) expect(install, `ci.yml installs ${engine}: ${install}`).toMatch(new RegExp(`\\b${engine}\\b`));
    expect(ci.indexOf(install)).toBeLessThan(ci.indexOf('run: npm run e2e\n'));
    // The engines installed are the engines mathml.spec.ts launches.
    const spec = readFileSync(join(ROOT, 'site', 'tests', 'e2e', 'mathml.spec.ts'), 'utf8');
    for (const [name, launcher] of [['Chromium', 'chromium'], ['WebKit', 'webkit'], ['Firefox', 'firefox']]) {
      expect(spec).toContain(`['${name}', ${launcher}]`);
    }
  });
});
