#!/usr/bin/env node
// npm run lab: the lab timings of SPEC.md 7.6 (7.7 Performance row; gates G3, G4 and G6).
//
// For each route of the built site it runs Lighthouse CI (@lhci/cli, the tool 7.6 intends; see
// decisions/P3-A7.md) with the mobile profile of 7.6: a 360 by 800 screen and the processor slowed
// four times through the DevTools Protocol (Lighthouse's devtools throttling, which sends
// Emulation.setCPUThrottlingRate with rate 4 before the page loads). The network is not throttled.
// It takes Largest Contentful Paint, Total Blocking Time and Cumulative Layout Shift, prints them
// per route against the thresholds 2.5 s, 200 ms and 0.1 ("at most": a value equal to its threshold
// passes), and exits non-zero when a route fails.
//
// Usage (GATE reads this header; the defaults below are what the gates measure):
//   npm run lab                          the core path: / and, for k = 0..5, the one lesson
//                                        /modules/m<k>-.../ of the built directory (gate G3).
//                                        A lesson that is not built is a "missing" row and fails.
//   npm run lab -- <route> [<route>...]  exactly these routes, in this order, each a path from
//                                        the site root without the base, beginning with /
//                                        (gate G4: npm run lab -- /modules/m6-.../ /modules/m7-.../)
//   npm run lab -- --all                 every route of the built directory, the list that
//                                        npm run size measures (gate G6, "every page")
// Options:
//   --url <base url>   measure a running server at this URL (which includes the base); starts none
//   --dist <dir>       the built directory (default: site/dist, or OUT_DIR when set)
//   --port <n>         port for astro preview (default 4324)
//   --runs <n>         Lighthouse runs per route, median per metric (default 3)
//   --json <file>      also write every run's numbers, the medians and the checks as JSON
//   --help             print the usage
// No option skips the canary, changes a threshold or changes the profile.
//
// It measures the build that the directory holds (it never builds) through astro preview, never
// a development server. The base is siteAndBase(process.env).base from site/src/lib/siteAndBase.mjs
// (the functions site/astro.config.mjs uses; plain JavaScript, so that plain Node 22.12 to 22.17
// runs this script, RT-FIX P4-RT-12-03), so BASE_PATH, GITHUB_REPOSITORY and OUT_DIR must be the
// ones the build used. Before any route it
// measures a deliberately slow fixture page (the canary), which must fail all three thresholds,
// and it checks in every Lighthouse report that the devtools throttling at 4 and the 360 by 800
// screen were applied. Exit 0: every route ok, canary over on all three, throttling confirmed.
// Exit 1: a route over, missing or in error, no route, no build, a server that did not start, or a
// failed check. Exit 2: a usage error. Progress goes to standard error, the table to standard
// output. Interaction to Next Paint is not measured here: it is the owner's check on one phone
// (SPEC.md 7.6 and 9.1, gates G3 and G6).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, get as httpGet } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { routesOf, routeUrl } from './size.mjs';

export { routeUrl };

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_DIR = join(ROOT, 'site');

/** The thresholds of SPEC.md 7.6: at most 2.5 s, 200 ms and 0.1. */
export const THRESHOLDS = Object.freeze({ lcpMs: 2500, tbtMs: 200, cls: 0.1 });
/** The mobile profile of SPEC.md 7.6: 360 by 800 pixels, processor slowed four times. */
export const PROFILE = Object.freeze({ width: 360, height: 800, cpuSlowdown: 4 });
export const DEFAULT_PORT = 4324;
export const DEFAULT_RUNS = 3;
/** The ceiling of one page load, from navigation (plan); a run that reaches it is an error. */
export const CEILING_MS = 30000;

/**
 * The deliberately slow fixture page. A short first paint; a large block of text about 3.5 s after
 * load (LCP well above 2.5 s); then one task that loops for 600 ms of wall-clock time (TBT about
 * 550 ms whatever the slowdown); then a block of 320 pixels inserted above the large text (CLS well
 * above 0.1). It fetches nothing.
 */
export const CANARY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lab canary</title>
<style>
body { margin: 0; font: 16px/1.4 sans-serif; }
#big { font-size: 28px; line-height: 1.3; padding: 8px; }
#spacer { height: 320px; background: #ccc; }
</style>
</head>
<body>
<p>lab canary: a deliberately slow page</p>
<div id="slot"></div>
<script>
addEventListener('load', function () {
  setTimeout(function () {
    var big = document.createElement('div');
    big.id = 'big';
    big.textContent = 'This large block of text is the largest paint of the canary. '.repeat(40);
    document.body.appendChild(big);
    setTimeout(function () {
      var end = Date.now() + 600;
      while (Date.now() < end) { /* one long task of 600 ms */ }
      setTimeout(function () {
        var spacer = document.createElement('div');
        spacer.id = 'spacer';
        document.getElementById('slot').appendChild(spacer);
      }, 300);
    }, 500);
  }, 3500);
});
</script>
</body>
</html>
`;

/**
 * The Lighthouse settings of every run: the profile of SPEC.md 7.6 and nothing else throttled.
 * Under devtools throttling Lighthouse raises its own quiet windows (network and processor) and
 * its pauses after FCP and load to at least 5250 ms; maxWaitForLoad is the ceiling.
 * @param {{ ignoreStatusCode?: boolean }} [options] ignoreStatusCode only for /404 answering 404
 */
export function lighthouseSettings(options = {}) {
  return {
    onlyCategories: ['performance'],
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: PROFILE.width, height: PROFILE.height, deviceScaleFactor: 1, disabled: false },
    throttlingMethod: 'devtools',
    throttling: {
      cpuSlowdownMultiplier: PROFILE.cpuSlowdown,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
      rttMs: 0,
      throughputKbps: 0,
    },
    maxWaitForLoad: CEILING_MS,
    locale: 'en-US',
    chromeFlags: '--no-sandbox',
    ...(options.ignoreStatusCode ? { ignoreStatusCode: true } : {}),
  };
}

export class UsageError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.exitCode = 2;
  }
}

/** The usage text (also the header of this file). */
export function usage() {
  return `usage: npm run lab [-- [<route> ...] | --all] [options]

Lab timings of SPEC.md 7.6 on the built site, with Lighthouse CI: a 360 by 800 screen, the
processor slowed 4 times through the DevTools Protocol, network not throttled. Prints LCP, TBT
and CLS per route against LCP <= 2.5 s, TBT <= 200 ms, CLS <= 0.1 and exits 1 when a route fails.

  npm run lab                          the default list, the core path: / and, for k = 0 to 5,
                                       the one lesson /modules/m<k>-.../ that was built (G3);
                                       a lesson that is not built is reported missing and fails
  npm run lab -- <route> [<route>...]  explicit routes, in this order, paths from the site root
                                       without the base, beginning with / (G4)
  npm run lab -- --all                 every route of the built directory, as npm run size (G6)

  --url <base url>   measure a running server at this URL (including the base); start none
  --dist <dir>       the built directory (default: site/dist, or OUT_DIR when set)
  --port <n>         port for astro preview (default ${DEFAULT_PORT})
  --runs <n>         runs per route, median per metric (default ${DEFAULT_RUNS})
  --json <file>      also write every run, the medians and the checks as JSON
  --help             print this text

A slow fixture page (the canary) is measured first and must fail all three thresholds, and every
report must show the devtools throttling at 4 and the 360 by 800 screen. Interaction to Next
Paint is not measured (the owner's check on one phone). Exit 0 all ok, 1 failure, 2 usage.`;
}

/**
 * @typedef {{ routes: string[]; all: boolean; url?: string; dist?: string; port: number;
 *   runs: number; json?: string; help: boolean }} LabOptions
 */

/**
 * Parses the arguments after `--`. Throws a UsageError (exit code 2) on an unknown option, a
 * missing or bad value, a route that does not begin with /, or --all together with routes.
 * @param {string[]} argv
 * @returns {LabOptions}
 */
export function parseArgs(argv) {
  /** @type {LabOptions} */
  const opts = { routes: [], all: false, port: DEFAULT_PORT, runs: DEFAULT_RUNS, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`option ${arg} needs a value`);
      return v;
    };
    const positiveInt = (/** @type {string} */ v, /** @type {number} */ max) => {
      const n = Number(v);
      if (!/^\d+$/.test(v) || !Number.isInteger(n) || n < 1 || n > max) throw new UsageError(`bad value for ${arg}: ${v}`);
      return n;
    };
    switch (arg) {
      case '--all': opts.all = true; break;
      case '--url': {
        const v = value();
        let u;
        try { u = new URL(v); } catch { throw new UsageError(`bad URL for --url: ${v}`); }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UsageError(`bad URL for --url: ${v}`);
        opts.url = v;
        break;
      }
      case '--dist': opts.dist = value(); break;
      case '--json': opts.json = value(); break;
      case '--port': opts.port = positiveInt(value(), 65535); break;
      case '--runs': opts.runs = positiveInt(value(), 99); break;
      case '--help': case '-h': opts.help = true; break;
      default:
        if (arg.startsWith('-')) throw new UsageError(`unknown option ${arg}`);
        if (!arg.startsWith('/')) throw new UsageError(`a route begins with /: ${arg}`);
        opts.routes.push(arg);
    }
  }
  if (opts.all && opts.routes.length > 0) throw new UsageError('--all cannot be combined with routes');
  return opts;
}

/** @param {string} p */
function isFile(p) {
  return existsSync(p) && statSync(p).isFile();
}

/**
 * @typedef {{ route: string; problem?: 'missing' | 'error'; reason?: string }} RouteEntry
 */

/**
 * The built form of a route: /x/ when x/index.html exists, /x when x.html exists, / for
 * index.html; a missing trailing slash is normalised. Null when no HTML file serves it.
 * @param {string} distDir
 * @param {string} route
 * @returns {string | null}
 */
export function resolveRoute(distDir, route) {
  if (!route.startsWith('/')) return null;
  const rel = route.replace(/^\/+/, '').replace(/\/+$/, '');
  if (rel.split('/').some((s) => s === '..' || s === '.')) return null;
  if (rel === '') return isFile(join(distDir, 'index.html')) ? '/' : null;
  if (isFile(join(distDir, rel, 'index.html'))) return `/${rel}/`;
  if (isFile(join(distDir, `${rel}.html`))) return `/${rel}`;
  return null;
}

/**
 * Explicit routes, in the order given, each in its built form or marked missing.
 * @param {string} distDir
 * @param {string[]} routes
 * @returns {RouteEntry[]}
 */
export function explicitRoutes(distDir, routes) {
  return routes.map((r) => {
    const built = resolveRoute(distDir, r);
    return built ? { route: built } : { route: r, problem: 'missing', reason: 'no HTML file in the built directory' };
  });
}

/**
 * The default list, the core path: / and, for each k from 0 to 5 in order, the one lesson of
 * the built directory whose slug begins with m<k>- (so m1- never matches m10-). None is a
 * missing row; two or more an error row. /modules/ itself is not a lesson.
 * @param {string} distDir
 * @returns {RouteEntry[]}
 */
export function defaultRoutes(distDir) {
  /** @type {RouteEntry[]} */
  const out = [isFile(join(distDir, 'index.html')) ? { route: '/' } : { route: '/', problem: 'missing', reason: 'no index.html' }];
  const modulesDir = join(distDir, 'modules');
  /** @type {{ slug: string; route: string }[]} */
  const lessons = [];
  if (existsSync(modulesDir)) {
    for (const name of readdirSync(modulesDir).sort()) {
      const p = join(modulesDir, name);
      if (statSync(p).isDirectory() && isFile(join(p, 'index.html'))) lessons.push({ slug: name, route: `/modules/${name}/` });
      else if (name.endsWith('.html') && name !== 'index.html' && isFile(p)) lessons.push({ slug: name.slice(0, -5), route: `/modules/${name.slice(0, -5)}` });
    }
  }
  for (let k = 0; k <= 5; k++) {
    const prefix = `m${k}-`;
    const found = lessons.filter((l) => l.slug.startsWith(prefix));
    if (found.length === 1) out.push({ route: found[0].route });
    else if (found.length === 0) out.push({ route: `/modules/${prefix}*/`, problem: 'missing', reason: `no lesson whose slug begins with ${prefix}` });
    else out.push({ route: `/modules/${prefix}*/`, problem: 'error', reason: `several lessons begin with ${prefix}: ${found.map((l) => l.slug).join(', ')}` });
  }
  return out;
}

/**
 * Every route of the built directory, the list npm run size measures.
 * @param {string} distDir
 * @returns {RouteEntry[]}
 */
export function allRoutes(distDir) {
  return routesOf(distDir).map(({ route }) => ({ route }));
}

// ---------------------------------------------------------------------------------------------
// Reading a Lighthouse report.

/**
 * @typedef {{ configSettings?: any; audits?: Record<string, any>; runtimeError?: { code?: string; message?: string };
 *   runWarnings?: string[]; requestedUrl?: string; finalDisplayedUrl?: string; fetchTime?: string;
 *   lighthouseVersion?: string; environment?: any }} Report
 *   (any: the Lighthouse report is JSON written by another program and is checked field by field.)
 * @typedef {{ value: number; error?: undefined } | { value?: undefined; error: string }} Reading
 */

/**
 * @param {Report} lhr
 * @param {string} id
 * @param {string} name
 * @returns {Reading}
 */
function readAudit(lhr, id, name) {
  const a = lhr.audits ? lhr.audits[id] : undefined;
  if (!a || a.scoreDisplayMode === 'error' || typeof a.numericValue !== 'number' || !Number.isFinite(a.numericValue)) {
    const why = a && a.errorMessage ? `: ${a.errorMessage}` : '';
    return { error: `no ${name} value${why}` };
  }
  return { value: a.numericValue };
}

/** Largest Contentful Paint in ms, from the audit largest-contentful-paint; never zero by default. @param {Report} lhr */
export function lcpFrom(lhr) {
  return readAudit(lhr, 'largest-contentful-paint', 'LCP');
}
/** Total Blocking Time in ms, from the audit total-blocking-time. @param {Report} lhr */
export function tbtFrom(lhr) {
  return readAudit(lhr, 'total-blocking-time', 'TBT');
}
/** Cumulative Layout Shift, from the audit cumulative-layout-shift. @param {Report} lhr */
export function clsFrom(lhr) {
  return readAudit(lhr, 'cumulative-layout-shift', 'CLS');
}

/** Lighthouse's run warning when the load did not finish before maxWaitForLoad. */
export const TIMEOUT_WARNING = 'The page loaded too slowly to finish within the time limit';

/**
 * Whether the run ended normally: no runtime error, and the page settled (network and processor
 * quiet) before the ceiling. Reaching the ceiling is an error, never a pass.
 * @param {Report} lhr
 * @returns {{ ok: true } | { ok: false; error: string }}
 */
export function settled(lhr) {
  if (lhr.runtimeError && lhr.runtimeError.code) {
    return { ok: false, error: `Lighthouse runtime error ${lhr.runtimeError.code}${lhr.runtimeError.message ? `: ${lhr.runtimeError.message}` : ''}` };
  }
  const warnings = Array.isArray(lhr.runWarnings) ? lhr.runWarnings : [];
  if (warnings.some((w) => String(w).startsWith(TIMEOUT_WARNING))) {
    return { ok: false, error: `did not settle within ${CEILING_MS / 1000} s` };
  }
  return { ok: true };
}

/**
 * @typedef {{ lcpMs?: number; tbtMs?: number; cls?: number; error?: string;
 *   longTasks?: { url: string; startTime: number; duration: number }[] }} Run
 */

/**
 * The long tasks Lighthouse lists (audit long-tasks), for the evidence of an OVER on TBT.
 * @param {Report} lhr
 * @returns {{ url: string; startTime: number; duration: number }[]}
 */
export function longTasksFrom(lhr) {
  const items = lhr.audits?.['long-tasks']?.details?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((t) => typeof t.startTime === 'number' && typeof t.duration === 'number')
    .map((t) => ({ url: String(t.url ?? ''), startTime: Math.round(t.startTime), duration: Math.round(t.duration) }));
}

/**
 * One run's numbers from its report; any missing number or an unsettled run makes it an error.
 * @param {Report} lhr
 * @returns {Run}
 */
export function runFromReport(lhr) {
  const s = settled(lhr);
  const lcp = lcpFrom(lhr);
  const tbt = tbtFrom(lhr);
  const cls = clsFrom(lhr);
  /** @type {Run} */
  const run = { lcpMs: lcp.value, tbtMs: tbt.value, cls: cls.value };
  const errors = [s.ok ? undefined : s.error, lcp.error, tbt.error, cls.error].filter(Boolean);
  if (errors.length > 0) run.error = errors.join('; ');
  const tasks = longTasksFrom(lhr);
  if (tasks.length > 0) run.longTasks = tasks;
  return run;
}

/**
 * The processor check: every report, the canary's included, must show the devtools throttling
 * (the method that sends Emulation.setCPUThrottlingRate) at the slowdown of the profile and the
 * 360 by 800 screen. The simulated method never slows the processor and fails.
 * @param {Report[]} reports
 * @returns {{ ok: boolean; found: string }}
 */
export function processorVerdict(reports) {
  if (reports.length === 0) return { ok: false, found: 'no report' };
  for (const lhr of reports) {
    const s = lhr.configSettings || {};
    const t = s.throttling || {};
    const e = s.screenEmulation || {};
    const found = `throttlingMethod ${s.throttlingMethod}, cpuSlowdownMultiplier ${t.cpuSlowdownMultiplier}, screen ${e.width}x${e.height}${e.disabled ? ' disabled' : ''}`;
    if (s.throttlingMethod !== 'devtools' || t.cpuSlowdownMultiplier !== PROFILE.cpuSlowdown
      || e.width !== PROFILE.width || e.height !== PROFILE.height || e.disabled) {
      return { ok: false, found };
    }
  }
  return { ok: true, found: `throttlingMethod devtools, cpuSlowdownMultiplier ${PROFILE.cpuSlowdown}, screen ${PROFILE.width}x${PROFILE.height} in all ${reports.length} reports` };
}

// ---------------------------------------------------------------------------------------------
// Medians, verdicts, exit code, table.

/**
 * The median; for an even count, the mean of the two middle values. NaN for none.
 * @param {number[]} values
 */
export function median(values) {
  if (values.length === 0) return NaN;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * @typedef {{ lcpMs: number; tbtMs: number; cls: number }} Medians
 */

/**
 * Medians per metric of runs without error.
 * @param {Run[]} runs
 * @returns {Medians}
 */
export function mediansOf(runs) {
  return {
    lcpMs: median(runs.map((r) => /** @type {number} */ (r.lcpMs))),
    tbtMs: median(runs.map((r) => /** @type {number} */ (r.tbtMs))),
    cls: median(runs.map((r) => /** @type {number} */ (r.cls))),
  };
}

/**
 * The metrics whose value is above its threshold (compared unrounded; equal passes).
 * @param {Medians} m
 * @returns {('LCP' | 'TBT' | 'CLS')[]}
 */
export function overThresholds(m) {
  /** @type {('LCP' | 'TBT' | 'CLS')[]} */
  const over = [];
  if (!(m.lcpMs <= THRESHOLDS.lcpMs)) over.push('LCP');
  if (!(m.tbtMs <= THRESHOLDS.tbtMs)) over.push('TBT');
  if (!(m.cls <= THRESHOLDS.cls)) over.push('CLS');
  return over;
}

/** 200 (or 304) for every route; 404 is accepted only for the route /404 built from 404.html. */
export function statusAccepted(/** @type {string} */ route, /** @type {number | undefined} */ status) {
  return status === 200 || status === 304 || (route === '/404' && status === 404);
}

/**
 * @typedef {RouteEntry & { status?: number; runs?: Run[]; url?: string }} MeasuredRow
 * @typedef {MeasuredRow & { verdict: 'ok' | 'OVER' | 'missing' | 'error'; over: string[];
 *   medians?: Medians; reason?: string }} EvaluatedRow
 * @typedef {{ rows: EvaluatedRow[]; over: number; failed: number }} Evaluation
 */

/**
 * Decides each route: missing, error (a problem of the route list, an HTTP status not accepted,
 * no run, or any run in error: a run is never dropped), OVER naming each failing metric, or ok.
 * @param {MeasuredRow[]} rows
 * @returns {Evaluation}
 */
export function evaluate(rows) {
  let over = 0;
  let failed = 0;
  const out = rows.map((row) => {
    /** @type {EvaluatedRow} */
    let r;
    const runs = row.runs ?? [];
    if (row.problem === 'missing') r = { ...row, verdict: 'missing', over: [] };
    else if (row.problem === 'error') r = { ...row, verdict: 'error', over: [] };
    else if (!statusAccepted(row.route, row.status)) r = { ...row, verdict: 'error', over: [], reason: `route answered ${row.status ?? 'nothing'}` };
    else if (runs.length === 0) r = { ...row, verdict: 'error', over: [], reason: 'no run' };
    else {
      const bad = runs.findIndex((x) => x.error);
      if (bad >= 0) r = { ...row, verdict: 'error', over: [], reason: `run ${bad + 1}: ${runs[bad].error}` };
      else {
        const medians = mediansOf(runs);
        const o = overThresholds(medians);
        r = { ...row, medians, over: o, verdict: o.length > 0 ? 'OVER' : 'ok' };
      }
    }
    if (r.verdict === 'OVER') over++;
    else if (r.verdict !== 'ok') failed++;
    return r;
  });
  return { rows: out, over, failed };
}

/**
 * The canary must fail every threshold. ok is false when it passed any, or could not be measured.
 * @param {Run[]} runs the canary's runs
 * @returns {{ ok: boolean; medians?: Medians; passed: string[]; error?: string }}
 */
export function canaryVerdict(runs) {
  const bad = runs.find((r) => r.error);
  if (runs.length === 0 || bad) return { ok: false, passed: [], error: bad ? bad.error : 'no run' };
  const medians = mediansOf(runs);
  const over = overThresholds(medians);
  const passed = ['LCP', 'TBT', 'CLS'].filter((m) => !over.includes(/** @type {'LCP'} */ (m)));
  return { ok: passed.length === 0, medians, passed };
}

/**
 * 0 when every route is ok, there is at least one route, the canary failed all three thresholds
 * and the processor check passed; otherwise 1.
 * @param {{ evaluation: Evaluation; canary: { ok: boolean }; processor: { ok: boolean } }} r
 * @returns {0 | 1}
 */
export function exitCode({ evaluation, canary, processor }) {
  if (!canary.ok || !processor.ok) return 1;
  if (evaluation.rows.length === 0) return 1;
  return evaluation.rows.every((r) => r.verdict === 'ok') ? 0 : 1;
}

const fmt = {
  lcp: (/** @type {number | undefined} */ ms) => (typeof ms === 'number' && Number.isFinite(ms) ? (ms / 1000).toFixed(3) : '-'),
  tbt: (/** @type {number | undefined} */ ms) => (typeof ms === 'number' && Number.isFinite(ms) ? ms.toFixed(1) : '-'),
  cls: (/** @type {number | undefined} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(4) : '-'),
};

/**
 * The table: one line per route with LCP in seconds, TBT in ms, CLS, and the status; the canary
 * line (not a route); the summary line.
 * @param {Evaluation} evaluation
 * @param {{ ok: boolean; medians?: Medians; passed: string[]; error?: string }} canary
 */
export function formatTable(evaluation, canary) {
  const head = ['route', 'LCP (<= 2.5 s)', 'TBT (<= 200 ms)', 'CLS (<= 0.1)', 'status'];
  const statusOf = (/** @type {EvaluatedRow} */ r) => {
    if (r.verdict === 'OVER') return `OVER (${r.over.join(', ')})`;
    if (r.verdict === 'ok') return 'ok';
    return `${r.verdict} (${r.reason ?? ''})`;
  };
  const body = evaluation.rows.map((r) => [r.route, fmt.lcp(r.medians?.lcpMs), fmt.tbt(r.medians?.tbtMs), fmt.cls(r.medians?.cls), statusOf(r)]);
  const canaryStatus = canary.error
    ? `measurement check failed (${canary.error})`
    : canary.ok ? 'over on LCP, TBT, CLS (as it must be)' : `measurement check failed: passed ${canary.passed.join(', ')}`;
  const canaryRow = ['canary (slow fixture, not a route)', fmt.lcp(canary.medians?.lcpMs), fmt.tbt(canary.medians?.tbtMs), fmt.cls(canary.medians?.cls), canaryStatus];
  const all = [head, ...body, canaryRow];
  const widths = head.map((_, i) => Math.max(...all.map((b) => b[i].length)));
  const line = (/** @type {string[]} */ cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [
    line(head),
    ...body.map(line),
    line(canaryRow),
    `lab: ${evaluation.rows.length} routes measured, ${evaluation.over} over threshold, ${evaluation.failed} missing or in error`,
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// The measuring part: servers, Lighthouse CI, output. Nothing here runs under Vitest.

/** @param {number} port */
function assertPortFree(port) {
  return new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`port ${port} is in use; stop the server there or pass --port`)));
    probe.listen(port, () => probe.close(() => resolvePromise(undefined)));
  });
}

/**
 * The HTTP status of a GET of the URL (redirects are not followed).
 * @param {string} url
 * @returns {Promise<number>}
 */
function httpStatus(url) {
  return new Promise((resolvePromise, reject) => {
    const req = httpGet(url, (res) => { res.resume(); resolvePromise(res.statusCode ?? 0); });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error(`no answer from ${url}`)));
  });
}

/**
 * Resolves when the URL answers 200, or rejects after the timeout.
 * @param {string} url
 * @param {number} timeoutMs
 */
async function waitFor200(url, timeoutMs) {
  const start = Date.now();
  let last = 'no answer';
  while (Date.now() - start < timeoutMs) {
    try {
      const s = await httpStatus(url);
      if (s === 200) return;
      last = `status ${s}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`astro preview did not answer 200 at ${url} within ${timeoutMs / 1000} s (${last})`);
}

function astroBin() {
  for (const dir of [join(SITE_DIR, 'node_modules', 'astro'), join(ROOT, 'node_modules', 'astro')]) {
    const bin = join(dir, 'bin', 'astro.mjs');
    if (existsSync(bin)) return bin;
  }
  throw new Error('astro is not installed; run npm ci');
}

/** The installed Lighthouse CI and Lighthouse: the CLI path and the versions. */
function lighthouseCi() {
  const require = createRequire(join(ROOT, 'package.json'));
  const lhciPkgPath = require.resolve('@lhci/cli/package.json');
  const lhciPkg = JSON.parse(readFileSync(lhciPkgPath, 'utf8'));
  const lhRequire = createRequire(lhciPkgPath);
  const lhPkg = JSON.parse(readFileSync(lhRequire.resolve('lighthouse/package.json'), 'utf8'));
  return { cli: join(dirname(lhciPkgPath), lhciPkg.bin.lhci), lhci: String(lhciPkg.version), lighthouse: String(lhPkg.version) };
}

/** @param {string} chromePath */
function chromiumVersion(chromePath) {
  try {
    return execFileSync(chromePath, ['--version'], { encoding: 'utf8', timeout: 20000 }).trim();
  } catch {
    return 'version unknown';
  }
}

/** @type {Set<import('node:child_process').ChildProcess>} */
const children = new Set();

/** @param {import('node:child_process').ChildProcess} child */
function killGroup(child) {
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  }
}

function killAll() {
  for (const c of children) killGroup(c);
  children.clear();
}

/**
 * Runs `lhci collect` on one URL with `runs` runs in the scratch directory and returns the
 * reports in the order they were taken. Nothing is uploaded.
 * @param {{ cli: string }} lhci
 * @param {string} url
 * @param {number} runs
 * @param {object} settings
 * @param {string} chromePath
 * @param {string} workDir
 * @returns {Promise<Report[]>}
 */
async function collect(lhci, url, runs, settings, chromePath, workDir) {
  const rc = join(workDir, 'lab-lhcirc.json');
  writeFileSync(rc, JSON.stringify({ ci: { collect: { url: [url], numberOfRuns: runs, chromePath, settings } } }, null, 1));
  const lhciDir = join(workDir, '.lighthouseci');
  rmSync(lhciDir, { recursive: true, force: true });
  const child = spawn(process.execPath, [lhci.cli, 'collect', `--config=${rc}`], {
    cwd: workDir,
    env: { ...process.env, CHROME_PATH: chromePath },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  children.add(child);
  /** @type {string[]} */
  const tail = [];
  let atLineStart = true;
  const forward = (/** @type {Buffer} */ chunk) => {
    const text = chunk.toString();
    process.stderr.write(text.replace(/(^|\n)(?=.)/g, (m, nl, offset) => (offset === 0 && !atLineStart ? m : `${nl}  lhci: `)));
    atLineStart = text.endsWith('\n');
    tail.push(...text.split('\n').filter((l) => l.trim() !== ''));
    if (tail.length > 20) tail.splice(0, tail.length - 20);
  };
  child.stdout?.on('data', forward);
  child.stderr?.on('data', forward);
  const code = await new Promise((resolvePromise) => child.on('close', (c) => resolvePromise(c)));
  children.delete(child);
  if (code !== 0) throw new Error(`Lighthouse CI exited with ${code}: ${tail.slice(-3).join(' | ')}`);
  const files = existsSync(lhciDir) ? readdirSync(lhciDir).filter((f) => /^lhr-\d+\.json$/.test(f)) : [];
  /** @type {Report[]} */
  const reports = files.map((f) => JSON.parse(readFileSync(join(lhciDir, f), 'utf8')));
  rmSync(lhciDir, { recursive: true, force: true });
  reports.sort((a, b) => String(a.fetchTime).localeCompare(String(b.fetchTime)));
  if (reports.length !== runs) throw new Error(`Lighthouse CI wrote ${reports.length} reports for ${runs} runs`);
  return reports;
}

/** Serves CANARY_HTML on a free port of 127.0.0.1. */
function startCanaryServer() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(CANARY_HTML);
      } else {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
      }
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') resolvePromise({ server, url: `http://127.0.0.1:${addr.port}/` });
      else reject(new Error('the canary server has no port'));
    });
  });
}

/** @param {string} msg */
function progress(msg) {
  process.stderr.write(`lab: ${msg}\n`);
}

async function main() {
  /** @type {LabOptions} */
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`lab: ${err instanceof Error ? err.message : err}`);
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  if (opts.help) { console.log(usage()); return; }

  const config = await import(pathToFileURL(join(SITE_DIR, 'src', 'lib', 'siteAndBase.mjs')).href);
  const distDir = opts.dist ? resolve(process.cwd(), opts.dist) : resolve(SITE_DIR, config.outDirFrom(process.env));
  if (!isFile(join(distDir, 'index.html'))) {
    console.error(`lab: no build found at ${distDir}; run npm run build first`);
    process.exitCode = 1;
    return;
  }
  /** @type {RouteEntry[]} */
  const routeList = opts.all ? allRoutes(distDir) : opts.routes.length > 0 ? explicitRoutes(distDir, opts.routes) : defaultRoutes(distDir);
  if (routeList.length === 0) {
    console.error('lab: no route to measure');
    process.exitCode = 1;
    return;
  }

  const lhci = lighthouseCi();
  const { chromium } = await import('@playwright/test');
  const chromePath = chromium.executablePath();
  if (!isFile(chromePath)) {
    console.error(`lab: Playwright's Chromium is not installed at ${chromePath}; run npx playwright install chromium`);
    process.exitCode = 1;
    return;
  }
  const chromeVersion = chromiumVersion(chromePath);

  /** @type {import('node:child_process').ChildProcess | null} */
  let server = null;
  /** @type {import('node:http').Server | null} */
  let canaryServer = null;
  const workDir = mkdtempSync(join(tmpdir(), 'lab-lhci-'));
  const onSignal = (/** @type {number} */ code) => () => {
    killAll();
    rmSync(workDir, { recursive: true, force: true });
    process.exit(code);
  };
  process.on('SIGINT', onSignal(130));
  process.on('SIGTERM', onSignal(143));

  const started = Date.now();
  try {
    let origin;
    let base;
    if (opts.url) {
      const u = new URL(opts.url);
      origin = u.origin;
      base = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
    } else {
      base = config.siteAndBase(process.env).base;
      origin = `http://localhost:${opts.port}`;
      await assertPortFree(opts.port);
      // --ignore-lock keeps the server in the foreground (Astro 7 otherwise detaches it when it
      // detects a coding agent); detached: true gives it its own process group to kill.
      const srv = spawn(process.execPath, [astroBin(), 'preview', '--port', String(opts.port), '--ignore-lock'], {
        cwd: SITE_DIR,
        env: { ...process.env, OUT_DIR: distDir },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });
      server = srv;
      children.add(srv);
      let serverOutput = '';
      const keep = (/** @type {Buffer} */ c) => { serverOutput = (serverOutput + c.toString()).slice(-4000); };
      srv.stdout?.on('data', keep);
      srv.stderr?.on('data', keep);
      try {
        await waitFor200(origin + base, 60000);
      } catch (err) {
        console.error(`lab: ${err instanceof Error ? err.message : err}`);
        console.error(serverOutput);
        process.exitCode = 1;
        return;
      }
      const ports = [...serverOutput.matchAll(/localhost:(\d+)/g)].map((m) => Number(m[1]));
      if (ports.some((p) => p !== opts.port)) {
        console.error(`lab: astro preview bound another port than ${opts.port}:\n${serverOutput}`);
        process.exitCode = 1;
        return;
      }
    }

    // The canary first, with the same profile and the same code.
    const canaryStart = /** @type {{ server: import('node:http').Server; url: string }} */ (await startCanaryServer());
    canaryServer = canaryStart.server;
    progress(`canary (slow fixture) at ${canaryStart.url}, 1 run`);
    /** @type {Report[]} */
    let canaryReports = [];
    /** @type {Run[]} */
    let canaryRuns;
    try {
      canaryReports = await collect(lhci, canaryStart.url, 1, lighthouseSettings(), chromePath, workDir);
      canaryRuns = canaryReports.map(runFromReport);
    } catch (err) {
      canaryRuns = [{ error: err instanceof Error ? err.message : String(err) }];
    }
    const canary = canaryVerdict(canaryRuns);
    const canaryProcessor = processorVerdict(canaryReports);
    if (canaryReports.length > 0 && !canaryProcessor.ok) {
      console.error(`lab: the processor slowdown did not take effect (${canaryProcessor.found})`);
      process.exitCode = 1;
      return;
    }
    if (!canary.ok) {
      console.error(canary.error
        ? `lab: measurement check failed: the slow fixture could not be measured (${canary.error})`
        : `lab: measurement check failed: the slow fixture passed ${canary.passed.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    /** @type {Report[]} */
    const allReports = [...canaryReports];
    /** @type {(MeasuredRow & { url?: string })[]} */
    const measured = [];
    for (const [i, entry] of routeList.entries()) {
      if (entry.problem) {
        progress(`${entry.route}: ${entry.problem} (${entry.reason})`);
        measured.push(entry);
        continue;
      }
      const url = routeUrl(origin, base, entry.route);
      progress(`route ${i + 1}/${routeList.length} ${entry.route} (${url}), runs: ${opts.runs}`);
      /** @type {number | undefined} */
      let status;
      try { status = await httpStatus(url); } catch (err) { status = undefined; }
      if (!statusAccepted(entry.route, status)) {
        measured.push({ ...entry, url, status, runs: [] });
        continue;
      }
      try {
        const reports = await collect(lhci, url, opts.runs, lighthouseSettings({ ignoreStatusCode: entry.route === '/404' }), chromePath, workDir);
        allReports.push(...reports);
        measured.push({ ...entry, url, status, runs: reports.map(runFromReport) });
      } catch (err) {
        measured.push({ ...entry, url, status, runs: [{ error: err instanceof Error ? err.message : String(err) }] });
      }
    }

    const processor = processorVerdict(allReports);
    const evaluation = evaluate(measured);
    const code = exitCode({ evaluation, canary, processor });
    const seconds = Math.round((Date.now() - started) / 1000);
    const relDist = relative(ROOT, distDir);
    const distShown = relDist === '' ? '.' : relDist.startsWith('..') ? distDir : relDist;
    console.log(`lab: Lighthouse CI (@lhci/cli ${lhci.lhci}, Lighthouse ${lhci.lighthouse}) on ${chromeVersion}; profile ${PROFILE.width}x${PROFILE.height}, CPU slowdown ${PROFILE.cpuSlowdown}x, network not throttled; runs per route: ${opts.runs}, median per metric; dist ${distShown}; base ${base}; processor check: ${processor.ok ? 'ok' : 'FAILED'}, ${processor.found}`);
    console.log(formatTable(evaluation, canary));
    if (!processor.ok) console.error(`lab: the processor slowdown did not take effect (${processor.found})`);
    progress(`finished in ${seconds} s`);
    if (opts.json) {
      const jsonPath = resolve(process.cwd(), opts.json);
      mkdirSync(dirname(jsonPath), { recursive: true });
      const settingsOf = (/** @type {Report} */ r) => ({
        throttlingMethod: r.configSettings?.throttlingMethod,
        cpuSlowdownMultiplier: r.configSettings?.throttling?.cpuSlowdownMultiplier,
        screen: r.configSettings?.screenEmulation,
        requestedUrl: r.requestedUrl,
      });
      writeFileSync(jsonPath, JSON.stringify({
        tool: { name: 'Lighthouse CI', lhci: lhci.lhci, lighthouse: lhci.lighthouse, chromium: chromeVersion, chromePath },
        profile: PROFILE,
        thresholds: THRESHOLDS,
        settings: lighthouseSettings(),
        runs: opts.runs,
        dist: distShown,
        base,
        seconds,
        canary: { runs: canaryRuns, ...canary },
        processor: { ...processor, reports: allReports.map(settingsOf) },
        rows: evaluation.rows,
        exitCode: code,
      }, null, 1) + '\n');
    }
    process.exitCode = code;
  } finally {
    killAll();
    if (server) killGroup(server);
    if (canaryServer) canaryServer.close();
    rmSync(workDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    killAll();
    console.error(`lab: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  });
}
