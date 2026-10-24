// One fixture build at a time per checkout (MERGE, P4 wave 4.2): every build shares the site's
// .astro/.prerender directory, and two test files (content-components and released) build fixtures
// in parallel Vitest workers, which made one build read chunks the other had just replaced
// (ERR_MODULE_NOT_FOUND). A directory created with mkdir is the lock; a lock older than ten
// minutes is taken as left behind by a killed run. Used by build-fixture.mjs.
import { createHash } from 'node:crypto';
import { mkdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The lock of a site directory. The two test files spell the directory differently (released.test.ts
 * without a trailing slash, content-components.test.ts with one), so the key is the directory's real
 * path: every spelling of one checkout's site gets one lock.
 */
export function lockPathOf(siteDir) {
  return join(tmpdir(), `two-games-fixture-build-${createHash('sha256').update(realpathSync(siteDir)).digest('hex').slice(0, 12)}`);
}

export async function withBuildLock(siteDir, fn) {
  const lock = lockPathOf(siteDir);
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (!(error && error.code === 'EEXIST')) throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 10 * 60 * 1000) rmSync(lock, { recursive: true, force: true });
      } catch {
        // the other build released the lock between the two calls
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
