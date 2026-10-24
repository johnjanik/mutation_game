#!/usr/bin/env node
// npm run size (SPEC.md 7.6 "Measured by npm run size"; 7.7 Performance row).
// Opens each route of the built site at 360 by 800 pixels, waits until the network is idle without
// touching the page, collects the URL of every script the browser fetched, compresses those files
// from the built directory with zlib (gzip, level 9), and fails when a route's sum exceeds its limit.
// No dependency beyond Playwright; everything else is a Node built-in.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer, get as httpGet } from 'node:http';
import { dirname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_DIR = join(ROOT, 'site');
export const DEFAULT_PORT = 4323;
/** kB means 1000 bytes (plan; the stricter reading). */
export const KB = 1000;
/** Quiet time after network idle, for client:idle and client:visible islands (plan). */
export const SETTLE_MS = 1000;
/** The viewport of SPEC.md 7.6. */
export const VIEWPORT = { width: 360, height: 800 };

export const USAGE = `usage: node scripts/size.mjs [options]

Measures the JavaScript each route of the built site fetches before the first interaction
(SPEC.md 7.6) and fails when a route exceeds its limit. kB means 1000 bytes.

  --dist <dir>            the built directory (default: site/dist, or OUT_DIR when set)
  --url <base url>        measure a running server instead of starting astro preview
  --base <path>           override the base taken from siteAndBase(process.env)
  --port <n>              port for astro preview (default ${DEFAULT_PORT})
  --json <file>           also write the rows as JSON
  --limit-override <kB>   replace every limit by one number; for the unit test only,
                          never in a script body, in CI, in a gate run or by hand
  --help                  print this text`;

/**
 * @typedef {{ dist?: string; url?: string; base?: string; port: number; json?: string;
 *   limitOverrideKb?: number; help: boolean }} SizeOptions
 */

/**
 * Parses the command line. Throws on an unknown option or a missing or bad value.
 * @param {string[]} argv the arguments after the script name
 * @returns {SizeOptions}
 */
export function parseArgs(argv) {
  /** @type {SizeOptions} */
  const opts = { port: DEFAULT_PORT, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`option ${arg} needs a value`);
      return v;
    };
    switch (arg) {
      case '--dist': opts.dist = value(); break;
      case '--url': opts.url = value(); break;
      case '--base': opts.base = value(); break;
      case '--json': opts.json = value(); break;
      case '--port': {
        const n = Number(value());
        if (!Number.isInteger(n) || n <= 0 || n > 65535) throw new Error(`bad port ${argv[i]}`);
        opts.port = n;
        break;
      }
      case '--limit-override': {
        const n = Number(value());
        if (!Number.isFinite(n) || n < 0) throw new Error(`bad limit ${argv[i]}`);
        opts.limitOverrideKb = n;
        break;
      }
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`unknown option ${arg}`);
    }
  }
  return opts;
}

/**
 * Every .html file under the built directory, as a route path: index.html is /, about/index.html
 * is /about/, name.html is /name. Sorted.
 * @param {string} distDir
 * @returns {{ route: string; file: string }[]}
 */
export function routesOf(distDir) {
  /** @type {{ route: string; file: string }[]} */
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.html')) {
        const rel = relative(distDir, p).split(sep).join('/');
        let route;
        if (rel === 'index.html') route = '/';
        else if (rel.endsWith('/index.html')) route = '/' + rel.slice(0, -'index.html'.length);
        else route = '/' + rel.slice(0, -'.html'.length);
        out.push({ route, file: p });
      }
    }
  };
  walk(distDir);
  return out.sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));
}

/**
 * The values of every data-tool attribute on an element of the HTML, found by scanning tags.
 * The contents of script and style elements and of comments are not markup and are skipped,
 * so the string data-tool inside a script, a serialized prop or text does not count.
 * @param {string} html
 * @returns {string[]}
 */
export function dataToolValues(html) {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '<script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '<style>');
  const tag = /<([a-zA-Z][\w:.-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
  const attr = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  /** @type {string[]} */
  const values = [];
  for (const m of stripped.matchAll(tag)) {
    for (const a of (m[2] ?? '').matchAll(attr)) {
      if (a[1].toLowerCase() === 'data-tool') values.push(a[2] ?? a[3] ?? a[4] ?? '');
    }
  }
  return values;
}

/**
 * The row of the table of SPEC.md 7.6 that applies to a route.
 * @param {string} routePath a route path such as /, /about/, /tools/garden/
 * @param {string} html the built HTML of the route
 * @returns {{ label: 'lesson' | 'tool' | 'no-tool' | 'one-board' | 'several-tools'; limitKb: number }}
 */
export function classifyRoute(routePath, html) {
  // A lesson is a page below /modules/ (/modules/<slug>/); the module index /modules/ itself is not a
  // lesson and is classified by its tools like any other page.
  if (/^\/modules\/[^/]/.test(routePath)) return { label: 'lesson', limitKb: 120 };
  if (routePath.startsWith('/tools/') || routePath.startsWith('/embed/')) return { label: 'tool', limitKb: 90 };
  const tools = dataToolValues(html);
  if (tools.length === 0) return { label: 'no-tool', limitKb: 15 };
  if (tools.length === 1) return tools[0] === 'board' ? { label: 'one-board', limitKb: 60 } : { label: 'tool', limitKb: 90 };
  return { label: 'several-tools', limitKb: 120 };
}

/**
 * The URL of a route: origin, then base (which begins and ends with /), then the route path
 * without its leading slash.
 * @param {string} origin e.g. http://localhost:4323
 * @param {string} base e.g. /repo/
 * @param {string} routePath e.g. /about/
 */
export function routeUrl(origin, base, routePath) {
  return origin.replace(/\/+$/, '') + base + routePath.replace(/^\//, '');
}

function isInside(path, dir) {
  const rel = relative(resolve(dir), resolve(path));
  return rel !== '' && !rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel);
}

/**
 * The file in the built directory that a script URL names. Throws when the URL is on another
 * origin, lies outside base, escapes the directory, or names no file.
 * @param {string} url
 * @param {string} origin
 * @param {string} base
 * @param {string} distDir
 * @returns {string}
 */
export function fileForScript(url, origin, base, distDir) {
  const u = new URL(url);
  if (u.origin !== new URL(origin).origin) throw new Error(`external script ${url}`);
  const pathname = decodeURIComponent(u.pathname);
  if (!pathname.startsWith(base)) throw new Error(`script outside base ${base}: ${url}`);
  const file = resolve(distDir, pathname.slice(base.length));
  if (!isInside(file, distDir)) throw new Error(`script escapes the built directory: ${url}`);
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`script has no file in the built directory: ${url}`);
  return file;
}

/**
 * gzip level 9 size of the bytes (SPEC.md 7.6; never the transfer size).
 * @param {Uint8Array} bytes
 */
export function gzipSize(bytes) {
  return gzipSync(bytes, { level: 9 }).length;
}

/**
 * Sums the gzip sizes of the deduplicated scripts of a route.
 * @param {string[]} scriptUrls
 * @param {string} origin
 * @param {string} base
 * @param {string} distDir
 * @returns {{ scripts: { url: string; file: string; gzipBytes: number }[]; gzipBytes: number; errors: string[] }}
 */
export function measureRoute(scriptUrls, origin, base, distDir) {
  const scripts = [];
  const errors = [];
  let total = 0;
  for (const url of [...new Set(scriptUrls)]) {
    try {
      const file = fileForScript(url, origin, base, distDir);
      const size = gzipSize(readFileSync(file));
      scripts.push({ url, file, gzipBytes: size });
      total += size;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { scripts, gzipBytes: total, errors };
}

/**
 * @typedef {{ route: string; label: string; limitKb: number; status: number; scripts: number;
 *   gzipBytes: number; errors: string[] }} SizeRow
 * @typedef {SizeRow & { verdict: 'ok' | 'OVER' | 'ERROR' }} EvaluatedRow
 */

/**
 * Decides each row: ERROR when the route did not answer 200 (404 is accepted for /404 only) or a
 * script could not be measured; OVER when the sum is strictly greater than the limit; else ok.
 * @param {SizeRow[]} rows
 * @param {number} [limitOverrideKb] for the unit test only
 * @returns {{ rows: EvaluatedRow[]; over: number; errors: number; exitCode: 0 | 1 }}
 */
export function evaluate(rows, limitOverrideKb) {
  let over = 0;
  let errors = 0;
  const out = rows.map((row) => {
    const limitKb = limitOverrideKb ?? row.limitKb;
    const accepted = row.status === 200 || (row.route === '/404' && row.status === 404);
    const rowErrors = accepted ? [...row.errors] : [`route answered ${row.status}`, ...row.errors];
    /** @type {'ok' | 'OVER' | 'ERROR'} */
    let verdict = 'ok';
    if (rowErrors.length > 0) { verdict = 'ERROR'; errors++; }
    else if (row.gzipBytes > limitKb * KB) { verdict = 'OVER'; over++; }
    return { ...row, limitKb, errors: rowErrors, verdict };
  });
  return { rows: out, over, errors, exitCode: over === 0 && errors === 0 ? 0 : 1 };
}

/**
 * The table of sums, one line per route, and the summary line.
 * @param {{ rows: EvaluatedRow[]; over: number; errors: number }} result
 */
export function formatTable(result) {
  const head = ['route', 'label', 'limit (kB, 1 kB = 1000 bytes)', 'status', 'scripts', 'gzip (kB)', 'result'];
  const body = result.rows.map((r) => [r.route, r.label, String(r.limitKb), String(r.status), String(r.scripts), (r.gzipBytes / KB).toFixed(1), r.verdict]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  const lines = [line(head), ...body.map(line)];
  for (const r of result.rows) for (const e of r.errors) lines.push(`  ${r.route}: ${e}`);
  let summary = `size: ${result.rows.length} routes measured, ${result.over} over budget`;
  if (result.errors > 0) summary += `, ${result.errors} with errors`;
  lines.push(summary);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// The browser part. It opens pages and listens to the network; it never interacts with a page.

/**
 * Collects the script URLs a route fetches before any interaction, and its HTTP status.
 * @param {import('@playwright/test').Browser} browser
 * @param {string} url
 * @returns {Promise<{ status: number; scriptUrls: string[] }>}
 */
async function collectScripts(browser, url) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, javaScriptEnabled: true });
  try {
    /** @type {Set<string>} */
    const scriptUrls = new Set();
    let lastRequest = Date.now();
    context.on('request', (request) => {
      lastRequest = Date.now();
      const u = new URL(request.url());
      if (request.resourceType() === 'script' || /\.(m?js)$/.test(u.pathname)) scriptUrls.add(request.url());
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    const status = response ? response.status() : 0;
    const deadline = Date.now() + 15000;
    while (Date.now() - lastRequest < SETTLE_MS && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return { status, scriptUrls: [...scriptUrls] };
  } finally {
    await context.close();
  }
}

/** Resolves when the URL answers with any HTTP status, or rejects after the timeout. */
function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolvePromise, reject) => {
    const attempt = () => {
      const req = httpGet(url, (res) => { res.resume(); resolvePromise(undefined); });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`astro preview did not answer at ${url}`));
        else setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

/**
 * Rejects when something already listens on the port, so that the measurement never runs
 * against another server (another worktree's build, or a lingering preview).
 */
function assertPortFree(port) {
  return new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`port ${port} is in use; stop the server there or pass --port`)));
    probe.listen(port, () => probe.close(() => resolvePromise(undefined)));
  });
}

function astroBin() {
  for (const dir of [join(SITE_DIR, 'node_modules', 'astro'), join(ROOT, 'node_modules', 'astro')]) {
    const bin = join(dir, 'bin', 'astro.mjs');
    if (existsSync(bin)) return bin;
  }
  throw new Error('astro is not installed; run npm ci');
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`size: ${err instanceof Error ? err.message : err}`);
    console.error(USAGE);
    process.exit(2);
  }
  if (opts.help) { console.log(USAGE); process.exit(0); }

  // The functions of site/astro.config.mjs from their plain module, which plain Node 22.12 to 22.17
  // loads (astro.config.mjs imports a .ts module; RT-FIX P4-RT-12-03).
  const config = await import(pathToFileURL(join(SITE_DIR, 'src', 'lib', 'siteAndBase.mjs')).href);
  const base = opts.base ? config.normaliseBase(opts.base) : config.siteAndBase(process.env).base;
  const distDir = opts.dist ? resolve(process.cwd(), opts.dist) : resolve(SITE_DIR, config.outDirFrom(process.env));
  if (!existsSync(distDir)) {
    console.error(`size: no built directory at ${distDir}; run npm run build first`);
    process.exit(1);
  }
  const routes = routesOf(distDir);

  /** @type {import('node:child_process').ChildProcess | null} */
  let server = null;
  const stopServer = () => {
    if (server && server.pid && server.exitCode === null) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ }
    }
    server = null;
  };
  process.on('SIGINT', () => { stopServer(); process.exit(130); });
  process.on('SIGTERM', () => { stopServer(); process.exit(143); });

  let origin;
  let browser = null;
  try {
    if (opts.url) {
      origin = new URL(opts.url).origin;
    } else {
      origin = `http://localhost:${opts.port}`;
      await assertPortFree(opts.port);
      // --ignore-lock keeps the server in the foreground: Astro 7 otherwise moves `astro preview`
      // into a detached background process when it detects a coding agent, which this script
      // could not stop, and refuses a second server per site root through its lock file.
      server = spawn(process.execPath, [astroBin(), 'preview', '--port', String(opts.port), '--ignore-lock'], {
        cwd: SITE_DIR,
        env: { ...process.env, OUT_DIR: distDir },
        stdio: ['ignore', 'ignore', 'inherit'],
        detached: true,
      });
      await waitForServer(origin + base);
    }
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch();
    /** @type {SizeRow[]} */
    const rows = [];
    for (const { route, file } of routes) {
      const { label, limitKb } = classifyRoute(route, readFileSync(file, 'utf8'));
      const { status, scriptUrls } = await collectScripts(browser, routeUrl(origin, base, route));
      const measured = measureRoute(scriptUrls, origin, base, distDir);
      rows.push({ route, label, limitKb, status, scripts: measured.scripts.length + measured.errors.length, gzipBytes: measured.gzipBytes, errors: measured.errors });
    }
    const result = evaluate(rows, opts.limitOverrideKb);
    console.log(formatTable(result));
    if (opts.json) {
      const jsonPath = resolve(process.cwd(), opts.json);
      mkdirSync(dirname(jsonPath), { recursive: true });
      writeFileSync(jsonPath, JSON.stringify({ dist: relative(ROOT, distDir), base, kB: KB, rows: result.rows }, null, 1) + '\n');
    }
    process.exitCode = result.exitCode;
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`size: ${err instanceof Error ? err.message : err}`); process.exit(1); });
}
