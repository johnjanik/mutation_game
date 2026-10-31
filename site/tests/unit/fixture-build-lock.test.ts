// The lock that keeps the Astro fixture builds of the unit tests one at a time per checkout
// (site/tests/fixtures/content/build-lock.mjs, used by build-fixture.mjs). Every fixture build writes the
// site's .astro/.prerender directory, so two builds at once delete each other's chunks and one fails with
// ERR_MODULE_NOT_FOUND (SPEC.md 7.7: npm test is required for every merge). content-components.test.ts
// and released.test.ts run in parallel Vitest workers and spell the site directory differently (with
// and without a trailing slash); the lock was keyed by the spelling, so their builds still ran at once.
// The tests below use a temporary directory as the site directory, never the real site, so that they do
// not wait for or block a fixture build of another test file.
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lockPathOf, withBuildLock } from '../fixtures/content/build-lock.mjs';

const dir = mkdtempSync(join(tmpdir(), 'fixture-build-lock-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('fixture builds take one lock per checkout', () => {
  // regression: P3-RT-12-02
  it('every spelling of the site directory names the same lock', () => {
    expect(lockPathOf(`${dir}/`)).toBe(lockPathOf(dir));
    expect(lockPathOf(`${dir}/./`)).toBe(lockPathOf(dir));
  });

  // regression: P3-RT-12-02
  it('a build holding the lock under one spelling keeps out a build under the other', async () => {
    const events: string[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = withBuildLock(dir, async () => {
      events.push('first in');
      await held;
      events.push('first out');
    });
    // The first holder has taken the lock before the second asks (mkdir is synchronous in withBuildLock).
    const second = withBuildLock(`${dir}/`, async () => {
      events.push('second in');
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(events).toEqual(['first in']);
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(['first in', 'first out', 'second in']);
  });
});
