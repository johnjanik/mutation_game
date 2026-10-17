// npm run report and the open-items report of a release build (SPEC.md 7.3, <Unverified>: "it prints
// a report of the open items and the pages that use them"; 7.7, npm run report), adopted from the red
// team (RT-12 attack 6). The registry rewrites reports/open-items-report.json at the start of a
// release build and at each registration, so a release build that stops part way leaves a well-formed
// file that lists only the pages rendered before the failure; report.mjs accepted it and printed it as
// the release report. The build now marks the report complete when it finishes (astro:build:done),
// and report.mjs refuses a report that is not marked complete.
//
// The failing release build is a fixture build of site/tests/fixtures/content/bad-tex (an unresolved
// <Tex> path, the failure of the red team's reproducer), run by the same runner as
// content-components.test.ts.
// Run: npx vitest run --project site-unit site/tests/unit/report-partial-release.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkOpenItemsReport } from '../../../scripts/report.mjs';
import { clearUsage, openItemsReportIntegration, registerUsage, type OpenItemsReport } from '../../src/lib/unverifiedRegistry';

const SITE_DIR = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures/content/', import.meta.url));
const RUNNER = join(FIXTURES, 'build-fixture.mjs');

/** Runs one fixture build with RELEASE=1 and the report written into reportDir; returns the exit status. */
function releaseFixtureBuild(name: string, reportDir: string): { status: number | null; output: string } {
  const outDir = mkdtempSync(join(tmpdir(), `report-partial-out-${name}-`));
  try {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
    for (const k of ['BASE_PATH', 'SITE_URL', 'OUT_DIR', 'OPEN_ITEMS_BUILD_ID', 'GITHUB_REPOSITORY', 'NODE_ENV', 'TEST', 'BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR']) delete env[k];
    Object.assign(env, { RELEASE: '1', OPEN_ITEMS_REPORT_DIR: reportDir });
    const child = spawnSync(process.execPath, [RUNNER, SITE_DIR, join(FIXTURES, name), outDir], {
      cwd: SITE_DIR,
      env,
      encoding: 'utf8',
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: child.status, output: `${child.stdout ?? ''}${child.stderr ?? ''}` };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

const dirs: string[] = [];
function reportDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'report-partial-'));
  dirs.push(d);
  return d;
}

describe('the open-items report of a release build that did not finish', () => {
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  // regression: P3-RT-12-06
  it('npm run report refuses the partial open-items report of a release build that failed', () => {
    const dir = reportDir();
    const build = releaseFixtureBuild('bad-tex', dir);
    expect(build.status, build.output).not.toBe(0);
    expect(build.output).toContain('resolves to 0 values');
    // The failed build left a well-formed release report behind (written when the build started).
    expect(existsSync(join(dir, 'open-items-report.json'))).toBe(true);
    const r = checkOpenItemsReport(dir);
    expect(r.exitCode, r.message).toBe(1);
    expect(r.message).toContain('did not finish');
  }, 300_000);

  it('a release build that finishes marks its report complete, and npm run report accepts it', () => {
    const dir = reportDir();
    const build = releaseFixtureBuild('good', dir);
    expect(build.status, build.output).toBe(0);
    const report = JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
    expect(report.complete).toBe(true);
    expect(report.items.find((i) => i.id === 'E4')?.pages).toEqual(['/']);
    expect(checkOpenItemsReport(dir).exitCode).toBe(0);
  }, 300_000);
});

describe('the build hooks of the open-items report', () => {
  const saved = new Map(['RELEASE', 'OPEN_ITEMS_REPORT_DIR', 'OPEN_ITEMS_BUILD_ID'].map((n) => [n, process.env[n]]));
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'report-hooks-'));
    process.env.RELEASE = '1';
    process.env.OPEN_ITEMS_REPORT_DIR = dir;
    delete process.env.OPEN_ITEMS_BUILD_ID;
    clearUsage();
  });
  afterEach(() => {
    clearUsage();
    for (const [n, v] of saved) {
      if (v === undefined) delete process.env[n];
      else process.env[n] = v;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  const read = (): OpenItemsReport => JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;

  // regression: P3-RT-12-06
  it('the report is incomplete from the start of the build until the build is done', async () => {
    const hooks = openItemsReportIntegration().hooks as unknown as Record<string, () => Promise<void> | void>;
    await hooks['astro:build:start']!();
    expect(read().complete).toBe(false);
    expect(checkOpenItemsReport(dir).exitCode).toBe(1);
    // Another module instance of the same build registers a page.
    registerUsage('E4', '/modules/m1-mutation/', true);
    expect(read().complete).toBe(false);
    expect(checkOpenItemsReport(dir).exitCode).toBe(1);
    clearUsage();
    // The done hook runs in the configuration's instance, which registered nothing: the pages of the
    // file are kept and the report is marked complete.
    await hooks['astro:build:done']!();
    const done = read();
    expect(done.complete).toBe(true);
    expect(done.items.find((i) => i.id === 'E4')).toMatchObject({ pages: ['/modules/m1-mutation/'], fallbackShown: true });
    expect(readFileSync(join(dir, 'open-items-report.md'), 'utf8')).toContain('| E4 | open |');
    expect(checkOpenItemsReport(dir)).toMatchObject({ exitCode: 0 });
  });
});
