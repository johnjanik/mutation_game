// P0-A6: the scripts of scripts/ other than size.mjs (SPEC.md 5.7, 7.6, 7.7), the root package.json
// command bodies, and the decisions fragment.
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderReport, scanSource, writeNumbersReport } from '../../../scripts/numbers-in-prose.mjs';
import { checkOpenItemsReport } from '../../../scripts/report.mjs';
import {
  assertOutsideReference,
  compareBytes,
  compareParsed,
  failureLines,
  parseSummary,
  REFERENCE_DIR,
} from '../../../scripts/verify.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const temps: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'scripts-test-'));
  temps.push(d);
  return d;
}
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe('verify.mjs', () => {
  it('verify: summary line is parsed', () => {
    const out = 'progress\n  ok\n\n6649 checks passed, 0 failed, 134.6s; wrote /tmp/x.json\n';
    expect(parseSummary(out)).toEqual({ line: '6649 checks passed, 0 failed, 134.6s; wrote /tmp/x.json', passed: 6649, failed: 0, seconds: 134.6 });
    expect(parseSummary('=== 1. boards ===\n  ok\nTraceback (most recent call last):\n')).toBeNull();
    expect(parseSummary('')).toBeNull();
    const failed = '  FAIL: some check detail\n\n6648 checks passed, 1 failed, 130.0s; wrote /tmp/y.json\nFAILED:\n  - some check\n';
    expect(parseSummary(failed)?.failed).toBe(1);
    expect(failureLines(failed)).toEqual(['  FAIL: some check detail', 'FAILED:', '  - some check']);
  });

  it('verify: equal files compare equal as bytes', () => {
    const d = tempDir();
    writeFileSync(join(d, 'a.json'), '{"a": [1, 2], "b": "9007199254740993"}');
    writeFileSync(join(d, 'b.json'), '{"a": [1, 2], "b": "9007199254740993"}');
    expect(compareBytes(join(d, 'a.json'), join(d, 'b.json'))).toEqual({ equal: true, sizeA: 38, sizeB: 38 });
  });

  it('verify: byte-different but parsed-equal files are reported as such', () => {
    const d = tempDir();
    writeFileSync(join(d, 'a.json'), '{\n "a": [1, 2]\n}');
    writeFileSync(join(d, 'b.json'), '{\n "a": [1, 2]\n}\n');
    const bytes = compareBytes(join(d, 'a.json'), join(d, 'b.json'));
    expect(bytes.equal).toBe(false);
    expect(bytes.sizeB).toBe(bytes.sizeA + 1);
    expect(compareParsed(join(d, 'a.json'), join(d, 'b.json'))).toEqual({ equal: true, paths: [] });
  });

  it('verify: parsed-different files name the differing paths, with exact integers', () => {
    const d = tempDir();
    // 2^53 + 1 and 2^53 are equal after JSON.parse in Node but not in Python
    writeFileSync(join(d, 'a.json'), '{"x": {"n": 9007199254740993, "l": [1, 2, 3]}, "y": 1}');
    writeFileSync(join(d, 'b.json'), '{"x": {"n": 9007199254740992, "l": [1, 2]}, "z": 1}');
    const r = compareParsed(join(d, 'a.json'), join(d, 'b.json'));
    expect(r.equal).toBe(false);
    expect(r.paths).toEqual(['.x.n', '.x.l (length 3 against 2)', '.y', '.z']);
  });

  it('verify: an output path under reference/ is refused', () => {
    expect(REFERENCE_DIR).toBe(join(ROOT, 'reference'));
    expect(() => assertOutsideReference(join(ROOT, 'reference', 'golden_data.json'))).toThrow(/read-only/);
    expect(() => assertOutsideReference(join(ROOT, 'reference', 'sub', '..', 'x.json'))).toThrow(/read-only/);
    expect(() => assertOutsideReference(join(ROOT, 'reference'))).toThrow(/read-only/);
    expect(() => assertOutsideReference(join(tmpdir(), 'golden-verify-x', 'golden_regen.json'))).not.toThrow();
    expect(() => assertOutsideReference(join(ROOT, 'reference-copy', 'x.json'))).not.toThrow();
  });
});

const FIXTURE = [
  '---',
  'title: Lesson 3',
  'module: 2',
  'outcomes: ["LO1", "LO2"]',
  '---',
  "import Board from '@components/tools/T01GameBoard.svelte';",
  "import { G, Tex } from '@components/content';",
  'export const start = [1, 0, 2];',
  '',
  '## Playing on {#step-4}',
  '',
  'The board has 3 nodes and the game ends after 6 moves.',
  'The Weyl group of E8 has <G k="types.E8.weyl_order"/> elements, and <Tex src="|W| = {{types.E8.weyl_order}} + 17"/> too.',
  'Run `npm run size 42` or read the [section 7](https://example.org/spec#7.6) and ![fig 9](img/fig99.png).',
  '<Board',
  '  start={[1, 0, 77]}',
  '  moves={[1, 2, 1]}',
  '  caption="after 12 moves"',
  '/>',
  '{(() => 31)()}',
  '```ts',
  'const x = 55;',
  '```',
  'A long number: 696 729 600, a negative one: −2, and a decimal 2.5.',
  'Inline $C_{12} = 2$ and display:',
  '$$',
  'a_{j} - 7',
  '$$',
].join('\n');

describe('numbers-in-prose.mjs', () => {
  it('numbers-in-prose: prose numbers are listed and excluded regions are not', () => {
    const findings = scanSource(FIXTURE, 'site/src/content/modules/m2-x.mdx');
    const prose = findings.filter((f) => f.kind === 'prose');
    expect(prose.map((f) => [f.line, f.number])).toEqual([
      [12, '3'],
      [12, '6'],
      [13, '8'],
      [14, '7'],
      [14, '9'],
      [24, '696 729 600'],
      [24, '−2'],
      [24, '2.5'],
    ]);
    expect(prose[0].file).toBe('site/src/content/modules/m2-x.mdx');
    expect(prose[0].context).toBe('The board has 3 nodes and the game ends after 6 moves.');
    expect(scanSource('', 'empty.mdx')).toEqual([]);
    expect(scanSource('No digits here.\n', 'x.mdx')).toEqual([]);
  });

  it('numbers-in-prose: formula digits go to the second section', () => {
    const formulas = scanSource(FIXTURE, 'f.mdx').filter((f) => f.kind === 'formula');
    expect(formulas.map((f) => [f.line, f.number])).toEqual([
      [25, '12'],
      [25, '2'],
      [27, '7'],
    ]);
    const md = renderReport(scanSource(FIXTURE, 'f.mdx'), 1, '2026-10-10');
    const proseAt = md.indexOf('## Numbers in prose not written with <G>');
    const formulaAt = md.indexOf('## Numbers inside formulas not written with <Tex>');
    expect(proseAt).toBeGreaterThan(0);
    expect(formulaAt).toBeGreaterThan(proseAt);
    expect(md.slice(formulaAt)).toContain('| 27 | 7 | a_{j} - 7 |');
    expect(md.slice(proseAt, formulaAt)).toContain('| 12 | 3 | The board has 3 nodes and the game ends after 6 moves. |');
  });

  it('numbers-in-prose: no lesson files gives the one-line report', () => {
    const d = tempDir();
    const report = join(d, 'reports', 'numbers-in-prose.md');
    const r = writeNumbersReport({ dir: join(d, 'missing'), report, root: d });
    expect(r).toMatchObject({ numbers: 0, files: 0, lessonFiles: 0 });
    expect(readFileSync(report, 'utf8')).toContain('No lesson files found under site/src/content/modules/.');
    mkdirSync(join(d, 'modules'));
    writeFileSync(join(d, 'modules', 'm0-a.mdx'), 'Two 2 here.\n');
    const r2 = writeNumbersReport({ dir: join(d, 'modules'), report, root: d });
    expect(r2).toMatchObject({ numbers: 1, files: 1, lessonFiles: 1 });
    expect(readFileSync(report, 'utf8')).toContain('### modules/m0-a.mdx');
  });

  it('numbers-in-prose: the command exits 0', () => {
    const d = tempDir();
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'numbers-in-prose.mjs')], { encoding: 'utf8', cwd: d });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^numbers-in-prose: .*report written to reports\/numbers-in-prose\.md$/m);
  });
});

describe('root package.json', () => {
  it('root package.json has every command of 7.7 and no stub', () => {
    const scripts: Record<string, string> = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;
    const names = ['test', 'build', 'build:release', 'preview', 'e2e', 'size', 'lab', 'report', 'verify', 'typecheck', 'check', 'prebuild', 'e2e:basepath'];
    for (const n of names) {
      expect(scripts[n], n).toBeTypeOf('string');
      expect(scripts[n].trim(), n).not.toBe('');
    }
    const devServer = ['astro', 'dev'].join(' ');
    for (const [n, body] of Object.entries(scripts)) {
      expect(body, n).not.toContain('not yet implemented');
      expect(body, n).not.toContain(devServer);
    }
    expect(scripts.prebuild).toBe('node scripts/katex-assets.mjs && node scripts/names.mjs');
    expect(scripts.build).toBe('npm run build -w site');
    expect(scripts['build:release']).toBe('RELEASE=1 npm run build');
    expect(scripts.size).toBe('node scripts/size.mjs');
    expect(scripts.verify).toBe('node scripts/verify.mjs');
    expect(scripts.lab).toBe('node scripts/lab.mjs');
    expect(scripts.report).toBe('node scripts/report.mjs');
    expect(scripts.e2e).toBe('playwright test');
    expect(scripts['e2e:basepath']).toContain('BASE_PATH=/sub/path/ OUT_DIR=dist-basepath npm run build');
    expect(scripts['e2e:basepath']).toContain('playwright test site/tests/e2e/basepath.spec.ts');
  });
});

describe('decisions/P0-A6.md', () => {
  it('decisions fragment covers 5.11', () => {
    const text = readFileSync(join(ROOT, 'decisions', 'P0-A6.md'), 'utf8');
    const entries = text.match(/^## \d{4}-\d{2}-\d{2} P0-A6: .+$/gm) ?? [];
    expect(entries.length).toBeGreaterThan(0);
    for (const term of ['1000 bytes', '--limit-override', 'PYTHON', 'numbers-in-prose', 'P3-A7', 'open-items-report.json', 'prebuild', 'dist-basepath', 'testIgnore', '4323', 'siteAndBase', '/404', 'Links', 'D18']) {
      expect(text, term).toContain(term);
    }
    expect(text).toContain('Decision:');
    expect(text).not.toContain(String.fromCharCode(0x2014)); // no em-dash (COMMON.md 4.4)
  });
});

// The phase-0 stub test of lab.mjs was deleted at the stage 3.1 merge (request of P3-A7);
// site/tests/unit/lab-thresholds.test.ts covers scripts/lab.mjs from phase 3 on.

describe('report.mjs', () => {
  const openItems = (mode: string) => ({
    mode,
    generatedAt: '2026-10-10T12:00:00.000Z',
    items: [
      { id: 'E1', status: 'open', gate: 'G6', pages: ['/modules/m1-x/', '/modules/m2-y/'], fallbackShown: true },
      { id: 'E2', status: 'open', gate: 'G3', pages: ['/modules/m1-x/'], fallbackShown: false },
      { id: 'E3', status: 'open', gate: 'G3', pages: [], fallbackShown: false },
      { id: 'E4', status: 'closed', gate: 'G6', pages: ['/modules/m3-z/'], fallbackShown: false },
    ],
    unknownItems: [{ item: 'E99', pages: ['/modules/m1-x/'] }],
  });

  it('report summarises a fixture open-items report', () => {
    const d = tempDir();
    writeFileSync(join(d, 'open-items-report.json'), JSON.stringify(openItems('release')));
    writeFileSync(join(d, 'open-items-report.md'), '# Open items\n');
    expect(checkOpenItemsReport(d)).toEqual({
      exitCode: 0,
      message: 'report: open items report of 2026-10-10T12:00:00.000Z: 2 open items used on 2 pages, 1 unknown items; see reports/open-items-report.md',
    });
  });

  it('report without a release report exits 1', () => {
    const missing = 'report: no release build report found at reports/open-items-report.json; run RELEASE=1 npm run build first';
    expect(checkOpenItemsReport(tempDir())).toEqual({ exitCode: 1, message: missing });
    const preview = tempDir();
    writeFileSync(join(preview, 'open-items-report.json'), JSON.stringify(openItems('preview')));
    writeFileSync(join(preview, 'open-items-report.md'), '# Open items\n');
    expect(checkOpenItemsReport(preview)).toEqual({ exitCode: 1, message: missing });
    const noMarkdown = tempDir();
    writeFileSync(join(noMarkdown, 'open-items-report.json'), JSON.stringify(openItems('release')));
    const r = checkOpenItemsReport(noMarkdown);
    expect(r.exitCode).toBe(1);
    expect(r.message).toContain('open-items-report.md is missing');
  });
});
