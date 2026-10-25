// The open-items report after a release build that fails in its prebuild (SPEC.md 7.3, <Unverified>:
// a release build "prints a report of the open items and the pages that use them"; 7.7, npm run
// report; DECISIONS.md "RT-FIX-P4-toolchain: the postbuild holds the release report": "a release
// build is prebuild, the Astro build and the postbuild, and a failed release build is never presented
// as the release report"), adopted from the red team (RT-12, phase 5 round, stale-report.sh: a release
// build that finished, then a syntax error in packages/engine/src/rep.ts, which the prebuild loads;
// RELEASE=1 npm run build exited 1 in the prebuild, and npm run report then exited 0 with the report
// of the earlier build). The report was held only from the start of the Astro build on, so a release
// build that stopped before Astro started left the earlier report marked complete. The first command
// of the root prebuild now marks it incomplete before anything of the build can fail.
//
// The earlier release build is the registry's own hooks and scripts/links.mjs on a small built
// directory, as in links-release-report.test.ts. The failing prebuild is the root prebuild, the
// command line of the root package.json run by the shell as npm runs it, in a scratch copy of the
// repository that holds scripts/ and site/src/lib/ but no installed package: there its first command
// fails as soon as it looks for KaTeX, and nothing is written into the checkout (site/public/katex,
// which the fixture builds of other tests copy).
// Run: npx vitest run --project site-unit site/tests/unit/report-prebuild-failure.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { checkOpenItemsReport } from '../../../scripts/report.mjs';
import { holdForReleaseBuild } from '../../src/lib/openItemsReport.mjs';
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

/** A built site at the root base with no dead link: an index page and an about page. */
function builtSite(): string {
  const dist = tempDir('report-prebuild-dist-');
  write(dist, 'index.html', page('<a href="/about/">About</a>'));
  write(dist, 'about/index.html', page('<a href="../">home</a>'));
  return dist;
}

/** The environment of a child process: this one's, without Vitest's and the build's own variables. */
function childEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
  for (const k of ['SITE_URL', 'BASE_PATH', 'GITHUB_REPOSITORY', 'BASE_URL', 'OUT_DIR', 'NODE_PATH', ...NAMES]) delete env[k];
  env.PATH = `${dirname(process.execPath)}${delimiter}${env.PATH ?? ''}`;
  return Object.assign(env, extra);
}

/** Runs scripts/links.mjs as the root postbuild runs it, in a release build. */
function postbuild(dist: string, reportDir: string): { status: number | null; output: string } {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'links.mjs')], { encoding: 'utf8', env: childEnv({ OUT_DIR: dist, OPEN_ITEMS_REPORT_DIR: reportDir, RELEASE: '1' }), cwd: ROOT });
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * Runs the root prebuild, the command line of the root package.json, by the shell as npm runs it,
 * in a scratch copy of the repository with scripts/ and site/src/lib/ but no installed package.
 */
function failingPrebuild(reportDir: string, release: boolean): { status: number | null; output: string; command: string } {
  const command: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts.prebuild;
  const copy = tempDir('report-prebuild-repo-');
  copyFileSync(join(ROOT, 'package.json'), join(copy, 'package.json'));
  cpSync(join(ROOT, 'scripts'), join(copy, 'scripts'), { recursive: true });
  mkdirSync(join(copy, 'site', 'src'), { recursive: true });
  copyFileSync(join(ROOT, 'site', 'package.json'), join(copy, 'site', 'package.json'));
  cpSync(join(ROOT, 'site', 'src', 'lib'), join(copy, 'site', 'src', 'lib'), { recursive: true });
  const r = spawnSync('sh', ['-c', command], { encoding: 'utf8', env: childEnv({ OPEN_ITEMS_REPORT_DIR: reportDir, ...(release ? { RELEASE: '1' } : {}) }), cwd: copy, timeout: 60_000 });
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}`, command };
}

describe('the open-items report of a release build that fails in its prebuild', () => {
  const saved = new Map(NAMES.map((n) => [n, process.env[n]]));
  let dir: string;
  let exitListeners: Set<(code: number) => void>;
  const hooks = openItemsReportIntegration().hooks as unknown as Record<string, () => Promise<void> | void>;
  const read = (): OpenItemsReport => JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
  const markdown = (): string => readFileSync(join(dir, 'open-items-report.md'), 'utf8');

  /** The Astro part of a release build that finished, with the pages that use E4. */
  async function astroReleaseBuild(pagesOfE4: string[]): Promise<void> {
    await hooks['astro:build:start']!();
    for (const p of pagesOfE4) registerUsage('E4', p, true);
    clearUsage();
    await hooks['astro:build:done']!();
  }

  /** A release build that finished: its Astro part and a postbuild that passed. */
  async function finishedReleaseBuild(pagesOfE4: string[]): Promise<void> {
    await astroReleaseBuild(pagesOfE4);
    const build = postbuild(builtSite(), dir);
    expect(build.status, build.output).toBe(0);
  }

  beforeEach(() => {
    dir = tempDir('report-prebuild-');
    process.env.RELEASE = '1';
    process.env.OPEN_ITEMS_REPORT_DIR = dir;
    delete process.env.OPEN_ITEMS_BUILD_ID;
    clearUsage();
    exitListeners = new Set(process.listeners('exit'));
  });
  afterEach(() => {
    for (const l of process.listeners('exit')) if (!exitListeners.has(l)) process.removeListener('exit', l);
    clearUsage();
    for (const [n, v] of saved) {
      if (v === undefined) delete process.env[n];
      else process.env[n] = v;
    }
    for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  // regression: P5-RT-12-01
  it('npm run report refuses the report of an earlier release build when the latest release build failed in the prebuild', async () => {
    await finishedReleaseBuild(['/modules/m1-mutation/']);
    const earlier = read();
    expect(earlier).toMatchObject({ complete: true, linkCheck: 'passed' });
    expect(checkOpenItemsReport(dir).exitCode).toBe(0);

    const prebuild = failingPrebuild(dir, true);
    expect(prebuild.status, prebuild.output).not.toBe(0);
    // The first command of the prebuild failed: the earliest point at which a release build can fail.
    expect(prebuild.output, `${prebuild.command}\n${prebuild.output}`).toContain('katex-assets:');

    const r = checkOpenItemsReport(dir);
    expect(r.exitCode, r.message).toBe(1);
    expect(r.message).toContain('did not finish');
    expect(read().complete).toBe(false);
    expect(read().generatedAt).toBe(earlier.generatedAt);
    expect(read().items.find((i) => i.id === 'E4')?.pages).toEqual(['/modules/m1-mutation/']);
    expect(markdown()).toContain('**Incomplete:**');
  });

  // regression: P5-RT-12-01
  it('a link check run by hand after a release build that failed in the prebuild does not complete the earlier report', async () => {
    // The earlier release build stopped in its postbuild, before its check ended.
    await astroReleaseBuild(['/modules/m1-mutation/']);
    const stopped = postbuild(join(dir, 'no-such-build'), dir);
    expect(stopped.status, stopped.output).toBe(1);
    expect(read()).toMatchObject({ complete: false, linkCheck: 'running' });

    const prebuild = failingPrebuild(dir, true);
    expect(prebuild.status, prebuild.output).not.toBe(0);

    const byHand = postbuild(builtSite(), dir);
    expect(byHand.status, byHand.output).toBe(0);
    expect(read().complete).toBe(false);
    expect(checkOpenItemsReport(dir).exitCode).toBe(1);
  });

  it('the prebuild of a preview build leaves the release report untouched', async () => {
    await finishedReleaseBuild(['/modules/m1-mutation/']);
    const before = readFileSync(join(dir, 'open-items-report.json'), 'utf8');
    const prebuild = failingPrebuild(dir, false);
    expect(prebuild.status, prebuild.output).not.toBe(0);
    expect(readFileSync(join(dir, 'open-items-report.json'), 'utf8')).toBe(before);
    expect(checkOpenItemsReport(dir).exitCode).toBe(0);
  });

  it('the prebuild of a release build writes no report when there is none', () => {
    const prebuild = failingPrebuild(dir, true);
    expect(prebuild.status, prebuild.output).not.toBe(0);
    expect(existsSync(join(dir, 'open-items-report.json'))).toBe(false);
    expect(existsSync(join(dir, 'open-items-report.md'))).toBe(false);
    expect(checkOpenItemsReport(dir).message).toContain('no release build report found');
  });

  it('the next release build that finishes leaves a complete report of its own pages', async () => {
    await finishedReleaseBuild(['/modules/m1-mutation/']);
    expect(failingPrebuild(dir, true).status).not.toBe(0);
    expect(checkOpenItemsReport(dir).exitCode).toBe(1);
    // The next release build: the first step of its prebuild, then its Astro build and postbuild.
    expect(holdForReleaseBuild()).toBe(true);
    expect(checkOpenItemsReport(dir).exitCode).toBe(1);
    await finishedReleaseBuild(['/modules/m1-mutation/', '/modules/m8-lie-algebras/']);
    expect(read()).toMatchObject({ complete: true, linkCheck: 'passed' });
    expect(read().items.find((i) => i.id === 'E4')?.pages).toEqual(['/modules/m1-mutation/', '/modules/m8-lie-algebras/']);
    expect(markdown()).not.toContain('Incomplete');
    expect(checkOpenItemsReport(dir).exitCode).toBe(0);
  });
});
