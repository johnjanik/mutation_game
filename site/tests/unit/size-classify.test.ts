// P0-A6: the pure parts of scripts/size.mjs (SPEC.md 7.6, the budget table and "Measured by
// npm run size"), including the artificial excess of the roster's acceptance 1.
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  classifyRoute,
  evaluate,
  fileForScript,
  formatTable,
  gzipSize,
  measureRoute,
  parseArgs,
  routeUrl,
  routesOf,
} from '../../../scripts/size.mjs';
import { siteAndBase } from '../../astro.config.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const ORIGIN = 'http://localhost:4323';
const temps: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'size-test-'));
  temps.push(d);
  return d;
}
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

const page = (body: string) => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
const board = page('<div class="tool" data-tool="board" data-moves="0"><svg></svg></div>');

type Row = { route: string; label: string; limitKb: number; status: number; scripts: number; gzipBytes: number; errors: string[] };
const row = (over: Partial<Row>): Row => ({ route: '/', label: 'one-board', limitKb: 60, status: 200, scripts: 0, gzipBytes: 0, errors: [], ...over });

describe('size.mjs', () => {
  it('classifyRoute follows the table of 7.6', () => {
    expect(classifyRoute('/', board)).toEqual({ label: 'one-board', limitKb: 60 });
    expect(classifyRoute('/about/', page('<p>About</p>')).limitKb).toBe(15);
    expect(classifyRoute('/credits/', page('<p>Credits</p>')).limitKb).toBe(15);
    expect(classifyRoute('/dev/math-check/', page('<p>math</p>')).limitKb).toBe(15);
    expect(classifyRoute('/open-items/', page('<ul></ul>')).limitKb).toBe(15);
    expect(classifyRoute('/tools/garden/', page('')).limitKb).toBe(90);
    expect(classifyRoute('/tools/garden/', page('<div data-tool="garden"></div><div data-tool="board"></div>')).limitKb).toBe(90);
    expect(classifyRoute('/modules/m0-start/', page('')).limitKb).toBe(120);
    expect(classifyRoute('/modules/m0-start/', board)).toEqual({ label: 'lesson', limitKb: 120 });
    expect(classifyRoute('/embed/board/', board)).toEqual({ label: 'tool', limitKb: 90 });
    expect(classifyRoute('/two/', page('<div data-tool="board"></div><section data-tool="garden"></section>'))).toEqual({ label: 'several-tools', limitKb: 120 });
    expect(classifyRoute('/one/', page("<div data-tool='garden'></div>"))).toEqual({ label: 'tool', limitKb: 90 });
    // data-tool inside a script, a serialized prop, a comment or text does not count
    const hidden = page(
      '<script type="module">const s = \'<div data-tool="board">\';</script>' +
        '<astro-island props="{&quot;html&quot;:&quot;data-tool=board&quot;}"></astro-island>' +
        '<!-- <div data-tool="board"></div> -->' +
        '<p>The attribute data-tool="board" marks a tool.</p>',
    );
    expect(classifyRoute('/', hidden)).toEqual({ label: 'no-tool', limitKb: 15 });
    // a value containing > does not end the tag early
    expect(classifyRoute('/', page('<div title="a > b" data-tool="board"></div>')).limitKb).toBe(60);
  });

  it('routesOf maps html files to routes', () => {
    const d = tempDir();
    writeFileSync(join(d, 'index.html'), board);
    mkdirSync(join(d, 'about'));
    writeFileSync(join(d, 'about', 'index.html'), page(''));
    writeFileSync(join(d, '404.html'), page(''));
    mkdirSync(join(d, '_astro'));
    writeFileSync(join(d, '_astro', 'x.js'), 'x');
    expect(routesOf(d).map((r) => r.route)).toEqual(['/', '/404', '/about/']);
  });

  it('fileForScript maps a URL under base to the built file and rejects the rest', () => {
    const d = tempDir();
    mkdirSync(join(d, '_astro'));
    writeFileSync(join(d, '_astro', 'a.js'), 'export {}');
    expect(fileForScript(`${ORIGIN}/sub/path/_astro/a.js`, ORIGIN, '/sub/path/', d)).toBe(join(d, '_astro', 'a.js'));
    expect(() => fileForScript(`${ORIGIN}/sub/path/_astro/missing.js`, ORIGIN, '/sub/path/', d)).toThrow(/no file/);
    expect(() => fileForScript(`${ORIGIN}/sub/path/%2e%2e/escape.js`, ORIGIN, '/sub/path/', d)).toThrow();
    expect(() => fileForScript(`${ORIGIN}/sub/path/_astro/..%2f..%2fescape.js`, ORIGIN, '/sub/path/', d)).toThrow(/escapes/);
    expect(() => fileForScript(`${ORIGIN}/other/_astro/a.js`, ORIGIN, '/sub/path/', d)).toThrow(/outside base/);
    expect(() => fileForScript('https://cdn.example.org/sub/path/_astro/a.js', ORIGIN, '/sub/path/', d)).toThrow(/external script/);
  });

  it('gzipSize is zlib level 9', () => {
    const bytes = Buffer.from('const x = 1;\n'.repeat(500));
    expect(gzipSize(bytes)).toBe(gzipSync(bytes, { level: 9 }).length);
    const text = readFileSync(join(ROOT, 'SPEC.md'));
    expect(gzipSize(text)).toBe(gzipSync(text, { level: 9 }).length);
    expect(gzipSize(text)).toBeLessThan(gzipSync(text, { level: 1 }).length);
  });

  it('measureRoute maps URLs to files under base and sums them', () => {
    const d = tempDir();
    mkdirSync(join(d, '_astro'));
    const a = randomBytes(3000);
    const b = Buffer.from('let y = 2;\n'.repeat(100));
    writeFileSync(join(d, '_astro', 'a.js'), a);
    writeFileSync(join(d, '_astro', 'b.mjs'), b);
    const base = '/repo/';
    const urls = [`${ORIGIN}/repo/_astro/a.js`, `${ORIGIN}/repo/_astro/b.mjs`, `${ORIGIN}/repo/_astro/a.js`];
    const m = measureRoute(urls, ORIGIN, base, d);
    expect(m.errors).toEqual([]);
    expect(m.scripts.length).toBe(2);
    expect(m.gzipBytes).toBe(gzipSync(a, { level: 9 }).length + gzipSync(b, { level: 9 }).length);
    const bad = measureRoute([`${ORIGIN}/repo/_astro/gone.js`, 'https://cdn.example.org/x.js'], ORIGIN, base, d);
    expect(bad.gzipBytes).toBe(0);
    expect(bad.errors.length).toBe(2);
    expect(bad.errors[1]).toMatch(/external script/);
  });

  it('a route over its limit fails and one at the limit passes', () => {
    const d = tempDir();
    writeFileSync(join(d, 'index.html'), board);
    mkdirSync(join(d, '_astro'));
    writeFileSync(join(d, '_astro', 'big.js'), randomBytes(70000));
    writeFileSync(join(d, '_astro', 'small.js'), 'export const s = 1;\n');
    const [{ route, file }] = routesOf(d);
    const { label, limitKb } = classifyRoute(route, readFileSync(file, 'utf8'));
    expect(limitKb).toBe(60);
    const urls = [`${ORIGIN}/_astro/big.js`, `${ORIGIN}/_astro/small.js`];
    const m = measureRoute(urls, ORIGIN, '/', d);
    expect(m.gzipBytes).toBe(gzipSize(readFileSync(join(d, '_astro', 'big.js'))) + gzipSize(readFileSync(join(d, '_astro', 'small.js'))));
    expect(m.gzipBytes).toBeGreaterThan(60000);
    const over = evaluate([row({ route, label, limitKb, scripts: 2, gzipBytes: m.gzipBytes })]);
    expect(over.rows[0].verdict).toBe('OVER');
    expect(over.over).toBe(1);
    expect(over.exitCode).toBe(1);

    writeFileSync(join(d, '_astro', 'big.js'), randomBytes(1000));
    const small = measureRoute(urls, ORIGIN, '/', d);
    const fine = evaluate([row({ route, label, limitKb, scripts: 2, gzipBytes: small.gzipBytes })]);
    expect(fine.rows[0].verdict).toBe('ok');
    expect(fine.exitCode).toBe(0);

    expect(evaluate([row({ gzipBytes: 60000 })]).exitCode).toBe(0);
    expect(evaluate([row({ gzipBytes: 60001 })]).exitCode).toBe(1);
    expect(evaluate([row({ label: 'no-tool', limitKb: 15, gzipBytes: 15000 })]).exitCode).toBe(0);
    expect(evaluate([row({ label: 'no-tool', limitKb: 15, gzipBytes: 15001 })]).rows[0].verdict).toBe('OVER');
  });

  it('the limit override applies to every route', () => {
    const rows = [
      row({ route: '/', gzipBytes: 1001 }),
      row({ route: '/about/', label: 'no-tool', limitKb: 15, gzipBytes: 1001 }),
      row({ route: '/x/', label: 'no-tool', limitKb: 15, gzipBytes: 1000 }),
    ];
    const r = evaluate(rows, 1);
    expect(r.rows.map((x) => x.verdict)).toEqual(['OVER', 'OVER', 'ok']);
    expect(r.rows.map((x) => x.limitKb)).toEqual([1, 1, 1]);
    expect(r.exitCode).toBe(1);
    expect(evaluate(rows).exitCode).toBe(0);
  });

  it('a route that did not answer 200 fails', () => {
    const notFound = evaluate([row({ route: '/about/', status: 404 })]);
    expect(notFound.rows[0].verdict).toBe('ERROR');
    expect(notFound.rows[0].errors[0]).toBe('route answered 404');
    expect(notFound.exitCode).toBe(1);
    expect(evaluate([row({ route: '/about/', status: 200 })]).exitCode).toBe(0);
    expect(evaluate([row({ route: '/404', status: 404 })]).exitCode).toBe(0);
    expect(evaluate([row({ route: '/404', status: 500 })]).exitCode).toBe(1);
    expect(evaluate([row({ errors: ['external script https://cdn.example.org/x.js'] })]).rows[0].verdict).toBe('ERROR');
  });

  it('route URLs carry the base from siteAndBase', () => {
    expect(routeUrl(ORIGIN, siteAndBase({ GITHUB_REPOSITORY: 'owner/repo' }).base, '/about/')).toBe('http://localhost:4323/repo/about/');
    expect(routeUrl(ORIGIN, siteAndBase({ BASE_PATH: '/sub/path/' }).base, '/about/')).toBe('http://localhost:4323/sub/path/about/');
    expect(routeUrl(ORIGIN, siteAndBase({}).base, '/')).toBe('http://localhost:4323/');
  });

  it('formatTable prints one line per route and the summary line', () => {
    const r = evaluate([row({ route: '/', gzipBytes: 12345, scripts: 3 }), row({ route: '/about/', label: 'no-tool', limitKb: 15, gzipBytes: 16000 })]);
    const lines = formatTable(r).split('\n');
    expect(lines[0]).toContain('1 kB = 1000 bytes');
    expect(lines[1]).toMatch(/^\/\s+one-board\s+60\s+200\s+3\s+12\.3\s+ok$/);
    expect(lines[2]).toMatch(/^\/about\/\s+no-tool\s+15\s+200\s+0\s+16\.0\s+OVER$/);
    expect(lines.at(-1)).toBe('size: 2 routes measured, 1 over budget');
  });

  it('parseArgs understands the options and rejects an unknown one', () => {
    expect(parseArgs([])).toEqual({ port: 4323, help: false });
    expect(parseArgs(['--dist', 'site/dist-basepath', '--url', 'http://localhost:9999/', '--base', '/sub/path/', '--port', '5000', '--json', 'reports/size.json', '--limit-override', '1'])).toEqual({
      dist: 'site/dist-basepath', url: 'http://localhost:9999/', base: '/sub/path/', port: 5000, json: 'reports/size.json', limitOverrideKb: 1, help: false,
    });
    expect(() => parseArgs(['--fast'])).toThrow(/unknown option --fast/);
    expect(() => parseArgs(['--port'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--port', 'x'])).toThrow(/bad port/);
  });

  it('size.mjs never touches the page and opens 360 by 800', () => {
    const src = readFileSync(join(ROOT, 'scripts/size.mjs'), 'utf8');
    for (const forbidden of ['.click(', '.dblclick(', '.hover(', '.focus(', '.tap(', '.press(', '.type(', '.fill(', 'mouse.', 'keyboard.', 'touchscreen.', 'dispatchEvent', 'scrollIntoView', 'emulateMedia']) {
      expect(src, forbidden).not.toContain(forbidden);
    }
    expect(src).toMatch(/newContext\(\{ viewport: \{ width: 360, height: 800 \}/);
    // a foreground preview server that the finally block can stop (Astro 7 backgrounds it otherwise)
    expect(src).toContain("'preview', '--port', String(opts.port), '--ignore-lock'");
    expect(src).toContain('process.kill(-server.pid');
    expect(src).not.toContain('content-length');
    expect(src).not.toContain('sizes()');
  });

  it('no script body or ci.yml line passes --limit-override', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    for (const [name, body] of Object.entries<string>(pkg.scripts)) expect(body, name).not.toContain('--limit-override');
    for (const line of readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8').split('\n')) expect(line).not.toContain('--limit-override');
  });
});
