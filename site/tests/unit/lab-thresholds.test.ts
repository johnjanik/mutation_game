// P3-A7: the pure parts of scripts/lab.mjs (SPEC.md 7.6 "Lab timings"; 7.7 Performance row).
// No browser here: CI runs npm test before it installs one, so this file only imports the pure
// functions and checks them on fixture reports, fixture directories and the script's text.
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  CANARY_HTML,
  CEILING_MS,
  DEFAULT_PORT,
  DEFAULT_RUNS,
  PROFILE,
  THRESHOLDS,
  TIMEOUT_WARNING,
  allRoutes,
  canaryVerdict,
  clsFrom,
  defaultRoutes,
  evaluate,
  exitCode,
  explicitRoutes,
  formatTable,
  lcpFrom,
  lighthouseSettings,
  longTasksFrom,
  median,
  parseArgs,
  processorVerdict,
  routeUrl,
  runFromReport,
  settled,
  tbtFrom,
  usage,
} from '../../../scripts/lab.mjs';
import { routesOf } from '../../../scripts/size.mjs';
import { siteAndBase } from '../../astro.config.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
/** U+2014, written by its code so that this file holds none. */
const EM_DASH = String.fromCharCode(0x2014);
const temps: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'lab-test-'));
  temps.push(d);
  return d;
}
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

function writeHtml(dir: string, rel: string): void {
  const p = join(dir, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, '<!doctype html><title>t</title>');
}

/** A built directory with the index, the module index, M0 to M5, M10, about and 404.html. */
function builtSite(lessons = ['m0-start', 'm1-mutation', 'm2-form', 'm3-classification', 'm4-numbers', 'm5-weyl']): string {
  const d = tempDir();
  writeHtml(d, 'index.html');
  writeHtml(d, 'modules/index.html');
  for (const l of [...lessons, 'm10-atlas']) writeHtml(d, `modules/${l}/index.html`);
  writeHtml(d, 'about/index.html');
  writeHtml(d, '404.html');
  return d;
}

type Settings = { throttlingMethod?: string; cpuSlowdownMultiplier?: number; width?: number; height?: number };
/** A Lighthouse report as lhci writes it, reduced to the fields lab.mjs reads. */
function report(lcp: number | undefined, tbt: number | undefined, cls: number | undefined, s: Settings = {}, extra: object = {}) {
  const audit = (v: number | undefined) => (v === undefined ? { scoreDisplayMode: 'error', errorMessage: 'NO_LCP' } : { scoreDisplayMode: 'numeric', numericValue: v });
  return {
    configSettings: {
      throttlingMethod: s.throttlingMethod ?? 'devtools',
      throttling: { cpuSlowdownMultiplier: s.cpuSlowdownMultiplier ?? 4 },
      screenEmulation: { mobile: true, width: s.width ?? 360, height: s.height ?? 800, deviceScaleFactor: 1, disabled: false },
    },
    audits: {
      'largest-contentful-paint': audit(lcp),
      'total-blocking-time': audit(tbt),
      'cumulative-layout-shift': audit(cls),
    },
    runWarnings: [],
    ...extra,
  };
}
const run = (lcp: number, tbt: number, cls: number) => runFromReport(report(lcp, tbt, cls));
const fast = () => [run(800, 20, 0), run(820, 30, 0.001), run(790, 10, 0)];
const slow = () => [run(3500, 550, 0.3), run(3550, 560, 0.31), run(3450, 540, 0.29)];
const okCanary = () => canaryVerdict(slow());
const okProcessor = { ok: true, found: '' };

describe('lab.mjs', () => {
  it('thresholds are exactly 2.5 s, 200 ms and 0.1', () => {
    expect(THRESHOLDS).toEqual({ lcpMs: 2500, tbtMs: 200, cls: 0.1 });
    expect(Object.isFrozen(THRESHOLDS)).toBe(true);
  });

  it('the profile is 360 by 800 with a fourfold processor slowdown', () => {
    expect(PROFILE).toEqual({ width: 360, height: 800, cpuSlowdown: 4 });
    const s = lighthouseSettings();
    // devtools throttling is the method that sends Emulation.setCPUThrottlingRate; never simulate.
    expect(s.throttlingMethod).toBe('devtools');
    expect(s.throttling.cpuSlowdownMultiplier).toBe(4);
    expect(s.screenEmulation).toEqual({ mobile: true, width: 360, height: 800, deviceScaleFactor: 1, disabled: false });
    expect(s.formFactor).toBe('mobile');
    // The network is not throttled: 7.6 names only the screen and the processor.
    expect(s.throttling.requestLatencyMs).toBe(0);
    expect(s.throttling.downloadThroughputKbps).toBe(0);
    expect(s.throttling.uploadThroughputKbps).toBe(0);
    expect(s.maxWaitForLoad).toBe(CEILING_MS);
    expect(CEILING_MS).toBe(30000);
    expect('ignoreStatusCode' in s).toBe(false);
    expect(lighthouseSettings({ ignoreStatusCode: true }).ignoreStatusCode).toBe(true);
  });

  it('a value equal to its threshold passes and one just above fails', () => {
    const one = (lcp: number, tbt: number, cls: number) =>
      evaluate([{ route: '/', status: 200, runs: [run(lcp, tbt, cls)] }]).rows[0];
    expect(one(2500, 0, 0).verdict).toBe('ok');
    expect(one(2501, 0, 0)).toMatchObject({ verdict: 'OVER', over: ['LCP'] });
    expect(one(0, 200, 0).verdict).toBe('ok');
    expect(one(0, 200.1, 0)).toMatchObject({ verdict: 'OVER', over: ['TBT'] });
    expect(one(0, 0, 0.1).verdict).toBe('ok');
    expect(one(0, 0, 0.1001)).toMatchObject({ verdict: 'OVER', over: ['CLS'] });
  });

  it('a deliberately slow route fails all three thresholds', () => {
    const r = evaluate([{ route: '/slow/', status: 200, runs: slow() }]);
    expect(r.rows[0]).toMatchObject({ verdict: 'OVER', over: ['LCP', 'TBT', 'CLS'] });
    expect(r.over).toBe(1);
    expect(exitCode({ evaluation: r, canary: okCanary(), processor: okProcessor })).toBe(1);
    // The canary page is built to do exactly this: a large paint about 3.5 s after load, a
    // 600 ms task, then a 320 pixel block inserted above the large text; it fetches nothing.
    expect(CANARY_HTML).toContain('}, 3500);');
    expect(CANARY_HTML).toContain('Date.now() + 600');
    expect(CANARY_HTML).toMatch(/#spacer \{ height: 320px/);
    expect(CANARY_HTML).not.toMatch(/\bsrc=|\bhref=|fetch\(|XMLHttpRequest|import\(/);
  });

  it('a fast route passes', () => {
    const r = evaluate([{ route: '/', status: 200, runs: fast() }]);
    expect(r.rows[0]).toMatchObject({ verdict: 'ok', over: [] });
    expect(exitCode({ evaluation: r, canary: okCanary(), processor: okProcessor })).toBe(0);
  });

  it("TBT and CLS are Lighthouse's audits and zero is a legitimate value", () => {
    const lhr = report(1234.5, 0, 0);
    expect(tbtFrom(lhr)).toEqual({ value: 0 });
    expect(clsFrom(lhr)).toEqual({ value: 0 });
    expect(lcpFrom(lhr)).toEqual({ value: 1234.5 });
    expect(tbtFrom(report(1, 230, 0))).toEqual({ value: 230 });
    expect(clsFrom(report(1, 0, 0.25))).toEqual({ value: 0.25 });
    // The long tasks behind a TBT are kept as evidence for the owner of an OVER route.
    const withTasks = report(1, 230, 0, {}, {});
    (withTasks.audits as Record<string, unknown>)['long-tasks'] = { details: { items: [{ url: 'http://x/_astro/a.js', startTime: 812.4, duration: 280.6 }, { url: 'Unattributable', startTime: 'n/a', duration: 60 }] } };
    expect(longTasksFrom(withTasks)).toEqual([{ url: 'http://x/_astro/a.js', startTime: 812, duration: 281 }]);
    expect(runFromReport(withTasks).longTasks).toHaveLength(1);
    expect(longTasksFrom(report(1, 0, 0))).toEqual([]);
  });

  it('LCP is the largest-contentful-paint audit; no value is an error, never zero', () => {
    const none = report(undefined, 0, 0);
    expect(lcpFrom(none).error).toMatch(/no LCP value/);
    expect(lcpFrom(none).value).toBeUndefined();
    expect(lcpFrom({ audits: {} }).error).toMatch(/no LCP value/);
    expect(tbtFrom({ audits: {} }).error).toMatch(/no TBT value/);
    expect(clsFrom({ audits: {} }).error).toMatch(/no CLS value/);
    const r = runFromReport(none);
    expect(r.error).toMatch(/no LCP value/);
    expect(evaluate([{ route: '/', status: 200, runs: [run(900, 0, 0), r, run(900, 0, 0)] }]).rows[0]).toMatchObject({ verdict: 'error', reason: expect.stringMatching(/^run 2: no LCP value/) });
  });

  it('the run ends only after the quiet window; a run that never settles is an error', () => {
    expect(settled(report(900, 0, 0))).toEqual({ ok: true });
    const timedOut = report(900, 0, 0, {}, { runWarnings: [`${TIMEOUT_WARNING}. Results may be incomplete.`] });
    expect(settled(timedOut)).toEqual({ ok: false, error: 'did not settle within 30 s' });
    expect(runFromReport(timedOut).error).toBe('did not settle within 30 s');
    const crashed = report(undefined, undefined, undefined, {}, { runtimeError: { code: 'NO_FCP', message: 'The page did not paint any content.' } });
    expect(settled(crashed)).toMatchObject({ ok: false, error: expect.stringMatching(/NO_FCP/) });
    expect(evaluate([{ route: '/', status: 200, runs: [runFromReport(timedOut)] }]).rows[0].verdict).toBe('error');
  });

  it('the median of three runs is taken per metric', () => {
    // No single run is the median of all three metrics.
    const r = evaluate([{ route: '/', status: 200, runs: [run(1000, 300, 0.01), run(3000, 100, 0.02), run(2000, 200, 0.5)] }]).rows[0];
    expect(r.medians).toEqual({ lcpMs: 2000, tbtMs: 200, cls: 0.02 });
    expect(r.verdict).toBe('ok');
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
    expect(DEFAULT_RUNS).toBe(3);
  });

  it('the default route list is the index and M0 to M5', () => {
    const d = builtSite();
    expect(defaultRoutes(d)).toEqual([
      { route: '/' },
      { route: '/modules/m0-start/' },
      { route: '/modules/m1-mutation/' },
      { route: '/modules/m2-form/' },
      { route: '/modules/m3-classification/' },
      { route: '/modules/m4-numbers/' },
      { route: '/modules/m5-weyl/' },
    ]);
    const twice = builtSite();
    writeHtml(twice, 'modules/m2-other/index.html');
    expect(defaultRoutes(twice)[3]).toMatchObject({ route: '/modules/m2-*/', problem: 'error' });
  });

  it('a missing core-path lesson is reported and fails the run', () => {
    const d = builtSite(['m0-start', 'm1-mutation', 'm2-form', 'm3-classification']);
    const list = defaultRoutes(d);
    expect(list.map((e) => e.route)).toEqual(['/', '/modules/m0-start/', '/modules/m1-mutation/', '/modules/m2-form/', '/modules/m3-classification/', '/modules/m4-*/', '/modules/m5-*/']);
    expect(list.slice(5).every((e) => e.problem === 'missing')).toBe(true);
    const rows = list.map((e) => (e.problem ? e : { ...e, status: 200, runs: fast() }));
    const ev = evaluate(rows);
    expect(ev.rows.slice(5).map((r) => r.verdict)).toEqual(['missing', 'missing']);
    expect(ev.failed).toBe(2);
    expect(exitCode({ evaluation: ev, canary: okCanary(), processor: okProcessor })).toBe(1);
  });

  it('--all lists every built route', () => {
    const d = builtSite();
    const all = allRoutes(d).map((e) => e.route);
    expect(all).toEqual(routesOf(d).map((r) => r.route));
    expect(all).toContain('/404');
    expect(all).toContain('/modules/');
    expect(all).toContain('/about/');
    expect(all).toContain('/modules/m10-atlas/');
  });

  it('explicit routes keep their order and take the built form', () => {
    const d = builtSite();
    expect(explicitRoutes(d, ['/modules/m5-weyl', '/about/', '/404/', '/nowhere/', '/'])).toEqual([
      { route: '/modules/m5-weyl/' },
      { route: '/about/' },
      { route: '/404' },
      { route: '/nowhere/', problem: 'missing', reason: 'no HTML file in the built directory' },
      { route: '/' },
    ]);
  });

  it('a route that did not answer 200 is an error, except /404 answering 404', () => {
    const notFound = evaluate([{ route: '/about/', status: 404, runs: fast() }]);
    expect(notFound.rows[0]).toMatchObject({ verdict: 'error', reason: 'route answered 404' });
    expect(exitCode({ evaluation: notFound, canary: okCanary(), processor: okProcessor })).toBe(1);
    expect(evaluate([{ route: '/about/', status: 200, runs: fast() }]).rows[0].verdict).toBe('ok');
    expect(evaluate([{ route: '/404', status: 404, runs: fast() }]).rows[0].verdict).toBe('ok');
    expect(evaluate([{ route: '/about/', status: undefined, runs: [] }]).rows[0]).toMatchObject({ verdict: 'error', reason: 'route answered nothing' });
  });

  it('route URLs carry the base from siteAndBase', () => {
    const origin = `http://localhost:${DEFAULT_PORT}`;
    expect(DEFAULT_PORT).toBe(4324);
    expect(routeUrl(origin, siteAndBase({ GITHUB_REPOSITORY: 'owner/repo' }).base, '/about/')).toBe('http://localhost:4324/repo/about/');
    expect(routeUrl(origin, siteAndBase({ BASE_PATH: '/sub/path/' }).base, '/about/')).toBe('http://localhost:4324/sub/path/about/');
    expect(routeUrl(origin, siteAndBase({ BASE_PATH: '/' }).base, '/about/')).toBe('http://localhost:4324/about/');
    const src = readFileSync(join(ROOT, 'scripts', 'lab.mjs'), 'utf8');
    expect(src).toContain('config.siteAndBase(process.env).base');
  });

  it('parseArgs understands routes, --all, --url, --dist, --port, --runs, --json and rejects the rest', () => {
    expect(parseArgs([])).toEqual({ routes: [], all: false, port: 4324, runs: 3, help: false });
    expect(parseArgs(['/modules/m6-x/', '/modules/m7-y/'])).toMatchObject({ routes: ['/modules/m6-x/', '/modules/m7-y/'], all: false });
    expect(parseArgs(['--all'])).toMatchObject({ all: true, routes: [] });
    expect(parseArgs(['--url', 'http://localhost:9000/repo/', '--dist', 'x/dist', '--port', '5000', '--runs', '5', '--json', 'reports/lab.json', '/']))
      .toEqual({ routes: ['/'], all: false, url: 'http://localhost:9000/repo/', dist: 'x/dist', port: 5000, runs: 5, json: 'reports/lab.json', help: false });
    expect(parseArgs(['--help']).help).toBe(true);
    const code = (argv: string[]) => {
      try { parseArgs(argv); } catch (e) { return (e as { exitCode?: number }).exitCode; }
      return 0;
    };
    expect(code(['--fast'])).toBe(2);
    expect(code(['--all', '/'])).toBe(2);
    expect(code(['/', '--all'])).toBe(2);
    expect(code(['about/'])).toBe(2);
    expect(code(['--runs', '0'])).toBe(2);
    expect(code(['--runs', '2.5'])).toBe(2);
    expect(code(['--port', '70000'])).toBe(2);
    expect(code(['--port'])).toBe(2);
    expect(code(['--url', 'not a url'])).toBe(2);
    expect(code(['--threshold', '3'])).toBe(2);
  });

  it('the usage text documents the default list, explicit routes and --all', () => {
    const u = usage();
    expect(u).toContain('npm run lab ');
    expect(u).toMatch(/core path/);
    expect(u).toMatch(/m<k>-/);
    expect(u).toContain('npm run lab -- <route>');
    expect(u).toContain('npm run lab -- --all');
    for (const o of ['--url', '--dist', '--port', '--runs', '--json', '--help']) expect(u).toContain(o);
    expect(u).toMatch(/Interaction to Next\s+Paint is not measured/);
    const header = readFileSync(join(ROOT, 'scripts', 'lab.mjs'), 'utf8').split('\nimport ')[0];
    expect(header).toContain('npm run lab -- --all');
    expect(header).toContain('Interaction to Next Paint is not measured');
  });

  it('a canary that passes any threshold fails the run', () => {
    expect(okCanary()).toMatchObject({ ok: true, passed: [] });
    expect(canaryVerdict([run(3500, 550, 0.05)])).toMatchObject({ ok: false, passed: ['CLS'] });
    expect(canaryVerdict([run(2500, 550, 0.3)])).toMatchObject({ ok: false, passed: ['LCP'] });
    expect(canaryVerdict([run(3500, 0, 0.3)])).toMatchObject({ ok: false, passed: ['TBT'] });
    expect(canaryVerdict([runFromReport(report(undefined, 550, 0.3))]).ok).toBe(false);
    expect(canaryVerdict([]).ok).toBe(false);
    const ev = evaluate([{ route: '/', status: 200, runs: fast() }]);
    expect(exitCode({ evaluation: ev, canary: canaryVerdict([run(3500, 0, 0.3)]), processor: okProcessor })).toBe(1);
  });

  it('the processor check fails unless every report shows devtools throttling at 4 on a 360 by 800 screen', () => {
    expect(processorVerdict([report(1, 0, 0), report(1, 0, 0)]).ok).toBe(true);
    // A simulated run never slows the processor, even when its multiplier reads 4.
    expect(processorVerdict([report(1, 0, 0), report(1, 0, 0, { throttlingMethod: 'simulate' })])).toMatchObject({ ok: false, found: expect.stringMatching(/throttlingMethod simulate/) });
    expect(processorVerdict([report(1, 0, 0, { cpuSlowdownMultiplier: 1 })]).ok).toBe(false);
    expect(processorVerdict([report(1, 0, 0, { width: 412, height: 823 })]).ok).toBe(false);
    expect(processorVerdict([]).ok).toBe(false);
    const ev = evaluate([{ route: '/', status: 200, runs: fast() }]);
    expect(exitCode({ evaluation: ev, canary: okCanary(), processor: { ok: false } })).toBe(1);
  });

  it('exit code is 1 when a route is over, missing or in error, and 0 otherwise', () => {
    const ok = { route: '/', status: 200, runs: fast() };
    const code = (rows: Parameters<typeof evaluate>[0]) => exitCode({ evaluation: evaluate(rows), canary: okCanary(), processor: okProcessor });
    expect(code([ok, { ...ok, route: '/about/' }])).toBe(0);
    expect(code([ok, { route: '/x/', status: 200, runs: slow() }])).toBe(1);
    expect(code([ok, { route: '/modules/m4-*/', problem: 'missing', reason: 'r' }])).toBe(1);
    expect(code([ok, { route: '/y/', status: 200, runs: [{ error: 'Lighthouse CI exited with 1' }] }])).toBe(1);
    expect(code([])).toBe(1);
  });

  it('the table prints LCP, TBT and CLS for every route with the thresholds and a summary line', () => {
    const ev = evaluate([
      { route: '/', status: 200, runs: [run(1234.5678, 12.34, 0.00123)] },
      { route: '/modules/m0-start/', status: 200, runs: [run(2600, 250, 0.2)] },
      { route: '/modules/m4-*/', problem: 'missing', reason: 'no lesson whose slug begins with m4-' },
    ]);
    const text = formatTable(ev, okCanary());
    const lines = text.split('\n');
    expect(lines[0]).toMatch(/^route\s+LCP \(<= 2\.5 s\)\s+TBT \(<= 200 ms\)\s+CLS \(<= 0\.1\)\s+status$/);
    expect(lines[1]).toMatch(/^\/\s+1\.235\s+12\.3\s+0\.0012\s+ok$/);
    expect(lines[2]).toMatch(/^\/modules\/m0-start\/\s+2\.600\s+250\.0\s+0\.2000\s+OVER \(LCP, TBT, CLS\)$/);
    expect(lines[3]).toMatch(/^\/modules\/m4-\*\/\s+-\s+-\s+-\s+missing \(no lesson whose slug begins with m4-\)$/);
    expect(lines[4]).toMatch(/^canary \(slow fixture, not a route\)\s+3\.500\s+550\.0\s+0\.3000\s+over on LCP, TBT, CLS/);
    expect(lines[5]).toBe('lab: 3 routes measured, 1 over threshold, 1 missing or in error');
    expect(text).not.toContain(EM_DASH);
  });

  it('the script measures astro preview through Lighthouse CI collect and never uploads', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'lab.mjs'), 'utf8');
    expect(src).not.toMatch(new RegExp(['astro', 'dev'].join(' ') + "|'dev'")); // the forbidden command of 7.2 item 9, spelled apart so that scaffold.test.ts does not read it here
    expect(src).toContain("'preview'");
    expect(src).toContain("throttlingMethod: 'devtools'");
    expect(src).not.toMatch(/'simulate'|'upload'|temporary-public-storage/);
    expect(src).toContain("'collect'");
    expect(src).not.toContain(EM_DASH);
  });
});
