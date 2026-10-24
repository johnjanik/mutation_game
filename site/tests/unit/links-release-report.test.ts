// The open-items report of a release build that fails in its postbuild (SPEC.md 7.3, <Unverified>:
// a release build "prints a report of the open items and the pages that use them"; 7.7, npm run
// report), adopted from the red team (RT-12, phase 4 round, the deadlink mutation of
// run-mutations.sh: RELEASE=1 npm run build exited 1 in postbuild with "links: ... 1 problems", and
// npm run report then exited 0 and printed the report). The Astro build marks the report complete
// when it is done (astro:build:done), and the postbuild link check (scripts/links.mjs) ran after it
// without touching the report. The check now holds the report as incomplete while it runs and marks
// it complete again only when it passes; the build-done hook marks it incomplete again when the
// build process exits with a failure after it.
// The release build here is the registry's own hooks (the report as the Astro build leaves it) and
// links.mjs run on a small built directory, as the root postbuild runs it.
// Run: npx vitest run --project site-unit site/tests/unit/links-release-report.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { checkOpenItemsReport } from '../../../scripts/report.mjs';
import { clearUsage, openItemsReportIntegration, registerUsage, type OpenItemsReport } from '../../src/lib/unverifiedRegistry';

const ROOT = resolve(import.meta.dirname, '../../..');
const NAMES = ['RELEASE', 'OPEN_ITEMS_REPORT_DIR', 'OPEN_ITEMS_BUILD_ID'];

const temps: string[] = [];
function tempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}
function write(dir: string, rel: string, text: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}
const page = (body: string): string => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;

/** A built site at the root base: an index page and an about page, and a dead link when asked. */
function builtSite(deadLink: boolean): string {
  const dist = tempDir('links-release-dist-');
  write(dist, 'index.html', page(`<a href="/about/">About</a>${deadLink ? ' <a href="/redteam-rt12-missing/">x</a>' : ''}`));
  write(dist, 'about/index.html', page('<a href="../">home</a>'));
  return dist;
}

/** Runs scripts/links.mjs as the root postbuild runs it, with RELEASE as given. */
function postbuild(dist: string, reportDir: string, release: boolean): { status: number | null; output: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
  for (const k of ['SITE_URL', 'BASE_PATH', 'GITHUB_REPOSITORY', 'BASE_URL', 'RELEASE', 'OPEN_ITEMS_BUILD_ID']) delete env[k];
  Object.assign(env, { OUT_DIR: dist, OPEN_ITEMS_REPORT_DIR: reportDir }, release ? { RELEASE: '1' } : {});
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'links.mjs')], { encoding: 'utf8', env, cwd: ROOT });
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

describe('the open-items report of a release build that fails in postbuild', () => {
  const saved = new Map(NAMES.map((n) => [n, process.env[n]]));
  let dir: string;
  let exitListeners: Set<(code: number) => void>;
  /** The exit listeners added since the test began (the build-done hook adds one). */
  const addedExitListeners = (): ((code: number) => void)[] => process.listeners('exit').filter((l) => !exitListeners.has(l));
  const hooks = openItemsReportIntegration().hooks as unknown as Record<string, () => Promise<void> | void>;
  const read = (): OpenItemsReport => JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
  const markdown = (): string => readFileSync(join(dir, 'open-items-report.md'), 'utf8');

  /** The Astro part of a release build that finished: start, one page using E4, done. */
  async function astroReleaseBuild(): Promise<void> {
    await hooks['astro:build:start']!();
    registerUsage('E4', '/modules/m1-mutation/', true);
    clearUsage();
    await hooks['astro:build:done']!();
  }

  beforeEach(() => {
    dir = tempDir('links-release-report-');
    process.env.RELEASE = '1';
    process.env.OPEN_ITEMS_REPORT_DIR = dir;
    delete process.env.OPEN_ITEMS_BUILD_ID;
    clearUsage();
    exitListeners = new Set(process.listeners('exit'));
  });
  afterEach(() => {
    for (const l of addedExitListeners()) process.removeListener('exit', l);
    clearUsage();
    for (const [n, v] of saved) {
      if (v === undefined) delete process.env[n];
      else process.env[n] = v;
    }
    for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  // regression: P4-RT-12-04
  it('npm run report refuses the report of a release build that failed in postbuild', async () => {
    await astroReleaseBuild();
    expect(read().complete).toBe(true);
    const build = postbuild(builtSite(true), dir, true);
    expect(build.status, build.output).toBe(1);
    expect(build.output).toContain('/redteam-rt12-missing/: no such page or file in the build');
    expect(build.output).toMatch(/links: \d+ internal links on 2 pages of .* checked, 1 problems/);
    const r = checkOpenItemsReport(dir);
    expect(r.exitCode, r.message).toBe(1);
    expect(r.message).toContain('did not finish');
    expect(read()).toMatchObject({ complete: false, linkCheck: 'failed' });
    expect(read().items.find((i) => i.id === 'E4')?.pages).toEqual(['/modules/m1-mutation/']);
    expect(markdown()).toContain('**Incomplete:**');
  });

  // regression: P4-RT-12-04
  it('a postbuild that stops before its check ends leaves the report refused', async () => {
    await astroReleaseBuild();
    const build = postbuild(join(dir, 'no-such-build'), dir, true);
    expect(build.status, build.output).toBe(1);
    expect(build.output).toContain('no built directory');
    expect(checkOpenItemsReport(dir).exitCode).toBe(1);
    expect(read()).toMatchObject({ complete: false, linkCheck: 'running' });
    expect(markdown()).toContain('**Incomplete:**');
  });

  // regression: P4-RT-12-04
  it('a release build whose postbuild passes leaves the report complete, and npm run report accepts it', async () => {
    await astroReleaseBuild();
    const build = postbuild(builtSite(false), dir, true);
    expect(build.status, build.output).toBe(0);
    expect(read()).toMatchObject({ complete: true, linkCheck: 'passed' });
    expect(markdown()).not.toContain('Incomplete');
    expect(checkOpenItemsReport(dir)).toMatchObject({ exitCode: 0 });
  });

  // regression: P4-RT-12-04
  it('a link check never completes a report whose Astro build did not finish', async () => {
    await hooks['astro:build:start']!();
    registerUsage('E4', '/modules/m1-mutation/', true);
    const before = readFileSync(join(dir, 'open-items-report.json'), 'utf8');
    const build = postbuild(builtSite(false), dir, true);
    expect(build.status, build.output).toBe(0);
    expect(readFileSync(join(dir, 'open-items-report.json'), 'utf8')).toBe(before);
    expect(checkOpenItemsReport(dir).exitCode).toBe(1);
  });

  // regression: P4-RT-12-04
  it('the link check of a preview build leaves the release report untouched', async () => {
    await astroReleaseBuild();
    const before = readFileSync(join(dir, 'open-items-report.json'), 'utf8');
    const build = postbuild(builtSite(true), dir, false);
    expect(build.status, build.output).toBe(1);
    expect(readFileSync(join(dir, 'open-items-report.json'), 'utf8')).toBe(before);
    expect(checkOpenItemsReport(dir).exitCode).toBe(0);
  });

  // regression: P4-RT-12-04
  it('a build process that fails after the build-done hook leaves the report refused', async () => {
    await astroReleaseBuild();
    expect(checkOpenItemsReport(dir).exitCode).toBe(0);
    const added = addedExitListeners();
    expect(added).toHaveLength(1);
    added[0]!(1);
    expect(read().complete).toBe(false);
    expect(markdown()).toContain('**Incomplete:**');
    expect(checkOpenItemsReport(dir).exitCode).toBe(1);
  });

  it('a build process that exits with 0 after the build-done hook leaves the report complete', async () => {
    await astroReleaseBuild();
    const added = addedExitListeners();
    expect(added).toHaveLength(1);
    added[0]!(0);
    expect(read().complete).toBe(true);
    expect(existsSync(join(dir, 'open-items-report.md'))).toBe(true);
    expect(checkOpenItemsReport(dir).exitCode).toBe(0);
  });
});
