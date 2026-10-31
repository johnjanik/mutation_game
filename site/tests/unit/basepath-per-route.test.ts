// npm run e2e:basepath (SPEC.md 7.2 item 10: "One browser test runs the site built with
// BASE_PATH=/sub/path/"; a ci.yml step), adopted from the red team (RT-12 attacks 2 and 16,
// redteam/rt12/basepath-timing.sh). basepath.spec.ts visited every built route inside one test, whose
// duration grew by about a second per route against the fixed 30 s test timeout: at 26 routes it took
// 29 to 34 s and timed out from a clean clone under load. The spec now has one test per route.
// This test lists the tests of basepath.spec.ts (playwright test --list, which loads the spec without
// starting a server or a browser) against a scratch build of forty routes, and checks that every
// route other than the index has a test of its own.
// Run: npx vitest run --project site-unit site/tests/unit/basepath-per-route.test.ts
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

/** A scratch BASE_PATH build: the index, 404.html and `n` other routes. */
function scratchBuild(n: number): { dist: string; routes: string[] } {
  const dist = mkdtempSync(join(tmpdir(), 'basepath-per-route-'));
  temps.push(dist);
  const routes: string[] = [];
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>i</title>');
  writeFileSync(join(dist, '404.html'), '<!doctype html><title>404</title>');
  routes.push('/404');
  for (let i = 1; i <= n; i++) {
    const name = `r${String(i).padStart(2, '0')}`;
    mkdirSync(join(dist, name));
    writeFileSync(join(dist, name, 'index.html'), '<!doctype html><title>r</title>');
    routes.push(`/${name}/`);
  }
  return { dist, routes };
}

describe('the BASE_PATH=/sub/path/ browser test', () => {
  // regression: P3-RT-12-04
  it('every route other than the index is checked in a test of its own, not all routes in one test', () => {
    const { dist, routes } = scratchBuild(39);
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
    for (const k of ['CI', 'SITE_URL', 'GITHUB_REPOSITORY', 'BASE_URL']) delete env[k];
    Object.assign(env, { BASE_PATH: '/sub/path/', OUT_DIR: dist });
    const cli = join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
    const r = spawnSync(process.execPath, [cli, 'test', '--list', '--reporter=list', 'site/tests/e2e/basepath.spec.ts'], { cwd: ROOT, env, encoding: 'utf8', timeout: 120_000 });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const titles = r.stdout.split('\n').filter((l) => l.includes('basepath.spec.ts:')).map((l) => l.split(' › ').at(-1)!.trim());
    expect(titles.length, r.stdout).toBeGreaterThanOrEqual(routes.length + 1);
    for (const route of routes) {
      expect(titles.filter((t) => t.endsWith(`: ${route}`)), `a test of its own for ${route}`).toHaveLength(1);
    }
  }, 180_000);
});
