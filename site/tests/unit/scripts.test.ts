// P0-A6: the scripts of scripts/ other than size.mjs (SPEC.md 5.7, 7.6, 7.7), the root package.json
// command bodies, and the decisions fragment.
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
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
    // MERGE, P4 wave 4.2: P4-A2's preset pipeline joins the prebuild chain (pre-approved by the orchestrator).
    expect(scripts.prebuild).toBe('node scripts/katex-assets.mjs && node scripts/names.mjs && node scripts/presets.mjs');
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

// P4-X2 (for MERGE, P4 wave 4.4, polished in wave 4.5): the timing assertions run alone through `npm run bench`,
// the engine's (packages/engine/test/bench) first, then the site's (site/tests/timing). The parallel suite of
// `npm test` holds no assertion on a duration, whatever clock it is read from, except the one limit of the runner
// listed below, and every clock reading left in it is listed with its reason.
describe('timing checks run alone', () => {
  const TIMING_CONFIG = 'site/tests/timing/vitest.config.ts';
  const SITE_UNIT = join(ROOT, 'site/tests/unit');
  const ENGINE_TEST = join(ROOT, 'packages/engine/test');
  /**
   * The clocks of Node a duration can be read from: the performance timer, the Date clock (its now, and a Date
   * made with no argument) and the high-resolution timer of the process under any spelling (a call, its bigint
   * form, or the name imported from node:process). Written as patterns, so that this file does not read as using one.
   */
  const CLOCK_SOURCE = [
    String.raw`\bperformance\s*\.\s*now\b`,
    String.raw`\bDate\s*\.\s*now\b`,
    String.raw`\bnew\s+Date\s*\(\s*\)`,
    String.raw`\bhrtime\b`,
  ].join('|');
  const clockReadings = (src: string): number => src.match(new RegExp(CLOCK_SOURCE, 'g'))?.length ?? 0;
  const IDENT = String.raw`[A-Za-z_$][\w$]*`;

  /** The index of the bracket that closes the one at `open` (round, curly or square); brackets in strings count too. */
  function closing(src: string, open: number): number {
    const o = src[open]!;
    const c = o === '(' ? ')' : o === '{' ? '}' : ']';
    let depth = 0;
    for (let k = open; k < src.length; k++) {
      if (src[k] === o) depth += 1;
      else if (src[k] === c && --depth === 0) return k;
    }
    return src.length;
  }

  /**
   * `src` with the text of its comments, strings, regular expressions and template literals (but not their ${}
   * parts) blanked to spaces, newlines and length kept, so that a name is followed only where it is code.
   */
  function codeOnly(src: string): string {
    const out = src.split('');
    const blank = (from: number, to: number): void => {
      for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
    };
    const open: number[] = []; // for each ${ still open, the depth of braces at which its template resumes
    let depth = 0;
    let prev = ''; // the last character of code, to tell a regular expression from a division
    let i = 0;
    const template = (from: number): void => {
      let j = from;
      for (; j < src.length; j++) {
        if (src[j] === '\\') j += 1;
        else if (src[j] === '`') {
          blank(from, j);
          i = j + 1;
          prev = ')';
          return;
        } else if (src[j] === '$' && src[j + 1] === '{') {
          blank(from, j);
          open.push(depth);
          depth += 1;
          i = j + 2;
          prev = '{';
          return;
        }
      }
      blank(from, j);
      i = j;
    };
    while (i < src.length) {
      const c = src[i]!;
      const d = src[i + 1];
      if (c === '/' && (d === '/' || d === '*')) {
        const e = d === '/' ? src.indexOf('\n', i) : src.indexOf('*/', i + 2);
        const end = e === -1 ? src.length : d === '/' ? e : e + 2;
        blank(i, end);
        i = end;
      } else if (c === "'" || c === '"') {
        let j = i + 1;
        while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
        blank(i + 1, j);
        i = j + 1;
        prev = ')';
      } else if (c === '`') {
        template(i + 1);
      } else if (c === '/' && (prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || /\b(?:return|typeof|case|of|in)$/.test(src.slice(Math.max(0, i - 8), i).trimEnd()))) {
        let j = i + 1;
        let inClass = false;
        for (; j < src.length && src[j] !== '\n'; j++) {
          if (src[j] === '\\') j += 1;
          else if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          else if (src[j] === '/' && !inClass) break;
        }
        blank(i + 1, j);
        i = j + 1;
        prev = ')';
      } else {
        if (c === '{') depth += 1;
        else if (c === '}') {
          depth -= 1;
          if (open.length > 0 && open[open.length - 1] === depth) {
            open.pop();
            template(i + 1);
            continue;
          }
        }
        if (!/\s/.test(c)) prev = c;
        i += 1;
      }
    }
    return out.join('');
  }

  /**
   * Every assertion in `source` whose subject rests on a clock reading: an expect or assert call whose argument
   * reads a clock, or a name that holds a reading or a duration in the block where the call stands. A name holds
   * one, in the block where it is declared, when it is assigned from such an expression (`const t0 = ...`,
   * `total += ...`, `timings[key] = ...`, a destructuring, a for-of over it), when such an expression is pushed
   * or added into it, or, for a function, when it returns one (`return median(times)`); repeated until no name is
   * added. A property that receives one (`{ ms: ... }`, `build.ms = ...`, or `{ ms }` while `ms` holds one) holds
   * it wherever it is read as `.ms`, so a stored build time rests on the clock in every test that reads it. Only
   * code counts (codeOnly). The one subject left out is a list's length (`toHaveLength`): the number of runs, not
   * their time.
   */
  function durationAssertions(source: string): { line: number; text: string }[] {
    const src = codeOnly(source);
    const esc = (name: string): string => name.replace(/\$/g, '\\$');
    // The blocks of the code: a name lives in the innermost block around its declaration.
    const blocks: [number, number][] = [];
    const stack: number[] = [];
    for (let k = 0; k < src.length; k++) {
      if (src[k] === '{') stack.push(k);
      else if (src[k] === '}' && stack.length > 0) blocks.push([stack.pop()!, k + 1]);
    }
    const blockAt = (at: number): [number, number] => {
      let best: [number, number] = [0, src.length];
      for (const [from, to] of blocks) if (from < at && at < to && from > best[0]) best = [from, to];
      return best;
    };
    const declarations = [...src.matchAll(new RegExp(String.raw`\b(?:const|let|var)\s+(${IDENT})`, 'g'))].map((m) => ({ name: m[1]!, at: m.index! }));
    const declaredBlock = (name: string, at: number): [number, number] => {
      const decl = declarations.filter((d) => d.name === name && d.at < at).pop();
      return decl === undefined ? [0, src.length] : blockAt(decl.at);
    };
    type Binding = { name: string; value: string; at: number; block: [number, number]; field: boolean; done?: boolean };
    const bindings: Binding[] = [];
    const held: { name: string; block: [number, number] }[] = [];
    const fields = new Set<string>();
    const reads = (text: string, at: number): boolean =>
      new RegExp(CLOCK_SOURCE).test(text) ||
      held.some((h) => h.block[0] <= at && at < h.block[1] && new RegExp(String.raw`(?<![\w$])(?<!(?:^|[^.])\.)${esc(h.name)}(?![\w$])`).test(text)) ||
      [...fields].some((f) => new RegExp(String.raw`\.\s*${esc(f)}(?![\w$])`).test(text));
    const bind = (pattern: string, each: (m: RegExpMatchArray, at: number) => void): void => {
      for (const m of src.matchAll(new RegExp(pattern, 'g'))) each(m, m.index!);
    };
    const bindEach = (targets: string, value: string, at: number, block: [number, number]): void => {
      for (const name of targets.match(new RegExp(IDENT, 'g')) ?? []) bindings.push({ name, value, at, block, field: false });
    };
    // Each value is read up to the end of its statement, inside a lookahead so that bindings inside it are found
    // too. An assignment to a property (`build.ms = ...`) makes the property hold the value.
    bind(String.raw`(\b(?:const|let|var)\s+)?(${IDENT})\s*(?::\s*[^=;\n]+?)?(?:\[[^\]\n]*\]\s*)?[-+*/]?=(?![=>])(?=([^;]*))`, (m, at) => {
      let before = at - 1;
      while (before >= 0 && /\s/.test(src[before]!)) before -= 1;
      const field = !m[1] && src[before] === '.';
      bindings.push({ name: m[2]!, value: m[3]!, at, block: field ? [0, src.length] : m[1] ? blockAt(at) : declaredBlock(m[2]!, at), field });
    });
    bind(String.raw`(${IDENT})\s*\.\s*(?:push|unshift|add|set)\s*\((?=([^;]*))`, (m, at) =>
      bindings.push({ name: m[1]!, value: m[2]!, at, block: declaredBlock(m[1]!, at), field: false }),
    );
    bind(String.raw`\b(?:const|let|var)\s*([{[][^=;]*?[}\]])\s*(?::[^=;]*)?=(?![=>])(?=([^;]*))`, (m, at) => bindEach(m[1]!, m[2]!, at, blockAt(at)));
    bind(String.raw`\bfor\s*\(\s*(?:const|let|var)\s+([^;\n]*?)\s+of\s+(?=([^\n]*))`, (m, at) => bindEach(m[1]!, m[2]!, at, blockAt(at)));
    bind(String.raw`\bfunction\s+(${IDENT})\s*\(|(${IDENT})\s*=\s*(?:async\s*)?\(`, (m, at) => {
      const afterParams = closing(src, at + m[0].length - 1) + 1;
      const head = /^\s*(?::[^{=;]*)?(?:=>\s*)?\{/.exec(src.slice(afterParams));
      if (head === null) return;
      const open = afterParams + head[0].length - 1;
      for (const r of src.slice(open, closing(src, open)).matchAll(/\breturn\s+(?!\{)(?=([^;]*))/g)) {
        bindings.push({ name: (m[1] ?? m[2])!, value: r[1]!, at: open + r.index!, block: blockAt(at), field: false });
      }
    });
    // Properties: `ms: <value>`, and the shorthand `{ ..., ms }` of a name that holds a reading there.
    bind(String.raw`(${IDENT})\s*:(?=([^,;\n}]*))`, (m, at) => bindings.push({ name: m[1]!, value: m[2]!, at, block: [0, src.length], field: true }));
    bind(String.raw`(?<=[{,]\s*)(${IDENT})(?=\s*[,}])`, (m, at) => bindings.push({ name: m[1]!, value: m[1]!, at, block: [0, src.length], field: true }));
    // A keyword is never a name (`const [s, ns] = ...` would otherwise bind `const`).
    const KEYWORDS = new Set(['as', 'await', 'case', 'const', 'delete', 'in', 'let', 'new', 'of', 'return', 'typeof', 'var', 'void', 'yield']);
    for (let grew = true; grew; ) {
      grew = false;
      for (const b of bindings) {
        if (b.done === true || KEYWORDS.has(b.name) || !reads(b.value, b.at)) continue;
        b.done = true;
        grew = true;
        if (b.field) fields.add(b.name);
        else held.push({ name: b.name, block: b.block });
      }
    }
    const found: { line: number; text: string }[] = [];
    for (const m of src.matchAll(new RegExp(String.raw`\b(?:expect|assert)(?:\s*\.\s*${IDENT})?\s*\(`, 'g'))) {
      const open = m.index! + m[0].length - 1;
      const close = closing(src, open);
      if (!reads(src.slice(open + 1, close), m.index!)) continue;
      if (/^\s*\.\s*toHaveLength\s*\(/.test(src.slice(close + 1))) continue;
      const end = source.indexOf('\n', close);
      found.push({ line: source.slice(0, m.index).split('\n').length, text: source.slice(m.index, end === -1 ? undefined : end).trim() });
    }
    return found;
  }

  /** Every test source under `dir` (relative path with forward slashes, text), leaving out the paths `skip` rejects. */
  function sources(dir: string, skip: (path: string) => boolean = () => false): [string, string][] {
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .map((f) => f.split(sep).join('/'))
      .filter((f) => /\.(?:[cm]?[jt]s|svelte)$/.test(f) && !skip(f))
      .sort()
      .map((f) => [f, readFileSync(join(dir, f), 'utf8')]);
  }
  /** The engine's parallel suite: every file under packages/engine/test except the bench run. */
  const engineParallel = (): [string, string][] => sources(ENGINE_TEST, (f) => f.startsWith('bench/'));

  /** Each moved test: its file in the serial run, its old file in the parallel suite, and its name (unchanged). */
  const MOVED = [
    { timing: 'T07.timing.test.ts', unit: 'tools/T07.test.ts', name: 'recomputation after a move stays under the long-task budget' },
    { timing: 'T10.timing.test.ts', unit: 'tools/T10.test.ts', name: 'main-thread work stays under the long-task budget' },
  ];
  /** The E8 timing of the phase-3 roster (P3-A1 instruction, acceptance), moved from the engine's parallel suite. */
  const E8_TIMING = {
    bench: 'bench/weyl-dimension.bench.ts',
    old: 'golden/p3a-weyl-dimension.test.ts',
    describe: 'E8 3875 under one second',
    name: 'weylDimension(E8, [1, 0, 0, 0, 0, 0, 0, 0]) computes in under a second',
    bound: 'expect(ms).toBeLessThan(1000);',
  };
  /** The one assertion on a duration left in the engine's parallel suite: a limit of the runner that guards a hang. */
  const RUNNER_LIMIT = { file: 'golden/p3b-complete-games.test.ts', text: 'expect(elapsed).toBeLessThan(60000);' };

  it('npm run bench runs the engine benchmark, then the timing files; CI runs it right after npm run check', () => {
    const scripts: Record<string, string> = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;
    expect(scripts.bench).toBe(`npm run bench -w packages/engine && vitest run --config ${TIMING_CONFIG}`);
    expect(scripts.test).toBe('vitest run');
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const check = ci.indexOf('run: npm run check\n');
    const bench = ci.indexOf('run: npm run bench\n');
    expect(check).toBeGreaterThan(-1);
    expect(bench).toBeGreaterThan(check);
    // The next step after the check is the bench: exactly one step heading lies between the two commands.
    expect(ci.slice(check, bench).match(/^\s*- name:/gm)).toHaveLength(1);
  });

  it('the timing configuration takes only the timing files, one file at a time, with the aliases of site-unit', async () => {
    type Project = { test?: { name?: string; include?: string[] }; resolve?: { alias?: unknown; tsconfigPaths?: boolean } };
    const timing = (await import('../timing/vitest.config')).default as Project & { test?: { fileParallelism?: boolean; environment?: string } };
    const rootConfig = (await import('../../../vitest.config')).default as { test?: { projects?: unknown[] } };
    const siteUnit = (rootConfig.test?.projects ?? []).find((p): p is Project => typeof p === 'object' && p !== null && (p as Project).test?.name === 'site-unit');
    expect(siteUnit).toBeDefined();
    expect(timing.test?.include).toEqual(['site/tests/timing/**/*.timing.test.ts']);
    expect(timing.test?.fileParallelism).toBe(false);
    expect(timing.test?.environment).toBe('node');
    expect(timing.resolve?.alias).toEqual(siteUnit!.resolve?.alias);
    expect(timing.resolve).toEqual(siteUnit!.resolve);
    // The aliases the timing run resolves: listed in resolve.alias, or, since RT-FIX P3-RT-12-05, read by both
    // runs from the paths of site/tsconfig.json (resolve.tsconfigPaths); either way exactly the three of CONTRACTS 1.
    const aliasNames =
      timing.resolve?.alias !== undefined
        ? Object.keys(timing.resolve.alias as Record<string, string>)
        : timing.resolve?.tsconfigPaths === true
          ? Object.keys((JSON.parse(readFileSync(join(ROOT, 'site/tsconfig.json'), 'utf8')) as { compilerOptions: { paths: Record<string, string[]> } }).compilerOptions.paths).map((k) => k.replace(/\/\*$/, ''))
          : [];
    expect(aliasNames.sort()).toEqual(['@components', '@engine', '@lib']);
    // npm test never collects a timing file: the site-unit project includes site/tests/unit only, and the
    // engine project lives under packages/engine.
    for (const pattern of siteUnit!.test?.include ?? []) expect(pattern.startsWith('site/tests/unit/'), pattern).toBe(true);
    expect((rootConfig.test?.projects ?? []).filter((p) => typeof p === 'string')).toEqual(['packages/engine']);
  });

  it('each moved test lives in its timing file and no longer in the parallel suite', () => {
    const timingDir = join(ROOT, 'site/tests/timing');
    // Every test file of the timing directory is one the configuration's pattern collects.
    const timingFiles = readdirSync(timingDir).filter((f) => f.endsWith('.ts') && f !== 'vitest.config.ts');
    expect(timingFiles.sort()).toEqual(MOVED.map((m) => m.timing).sort());
    for (const m of MOVED) {
      const moved = readFileSync(join(timingDir, m.timing), 'utf8');
      expect(moved, m.timing).toContain(`it('${m.name}'`);
      expect(clockReadings(moved), m.timing).toBeGreaterThan(0);
      expect(readFileSync(join(SITE_UNIT, m.unit), 'utf8'), m.unit).not.toContain(`it('${m.name}'`);
    }
  });

  it('the E8 timing of the roster runs in the engine bench run, unchanged in name and bound, and no longer in npm test', async () => {
    const bench = readFileSync(join(ENGINE_TEST, E8_TIMING.bench), 'utf8');
    expect(bench).toContain(`describe('${E8_TIMING.describe}'`);
    expect(bench).toContain(`it('${E8_TIMING.name}'`);
    expect(bench).toContain(E8_TIMING.bound);
    expect(clockReadings(bench)).toBeGreaterThan(0);
    const old = readFileSync(join(ENGINE_TEST, E8_TIMING.old), 'utf8');
    expect(old).not.toContain(`it('${E8_TIMING.name}'`);
    expect(old).not.toContain(`describe('${E8_TIMING.describe}'`);
    expect(old).not.toContain(E8_TIMING.bound);
    // The bench configuration collects every *.bench.ts of test/bench, one file at a time; the engine project
    // of npm test collects nothing there.
    const benchConfig = (await import('../../../packages/engine/test/bench/vitest.config')).default as { test: { include: string[]; fileParallelism: boolean } };
    expect(benchConfig.test.include).toEqual(['test/bench/**/*.bench.ts']);
    expect(benchConfig.test.fileParallelism).toBe(false);
    const engineConfig = (await import('../../../packages/engine/vitest.config')).default as { test?: { include?: string[] } };
    expect(engineConfig.test?.include?.length).toBeGreaterThan(0);
    for (const pattern of engineConfig.test?.include ?? []) expect(pattern.startsWith('test/bench/'), pattern).toBe(false);
    const enginePackage = JSON.parse(readFileSync(join(ROOT, 'packages/engine/package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(enginePackage.scripts.bench).toBe('vitest run --config test/bench/vitest.config.ts');
  });

  it('every clock reading left in the parallel suite is listed, with its reason', () => {
    const readings = (files: [string, string][]): Record<string, number> =>
      Object.fromEntries(files.map(([f, text]) => [f, clockReadings(text)] as const).filter(([, n]) => n > 0));
    // A new reading of any clock in either project fails here: a duration assertion belongs under
    // site/tests/timing or packages/engine/test/bench, and a reading that is printed and not asserted is listed.
    expect(readings(sources(SITE_UNIT))).toEqual({
      'content-components.test.ts': 2, // the fixture build's time, kept in its result and never asserted (P0-A4)
      'lab-thresholds.test.ts': 1, // the text of the canary page, compared as a string; no clock is read (P3-A7)
      'tools/T03.test.ts': 2, // the capped root test, printed and not asserted (P2-A2 instruction 5.10)
      'tools/T15.test.ts': 2, // the positive-level sweep, printed (decisions/P2-A4.md)
    });
    expect(readings(engineParallel())).toEqual({
      [RUNNER_LIMIT.file]: 2, // plays that do not end: the limit of the runner below
      'golden/p4-wythoff.test.ts': 2, // the largest edge enumerations, printed and not asserted (P4-A1)
    });
  });

  it('no assertion of the parallel suite rests on a clock reading, but the one limit of the runner that guards a hang', () => {
    const found = (files: [string, string][]): { file: string; line: number; text: string }[] =>
      files.flatMap(([file, text]) => durationAssertions(text).map((a) => ({ file, ...a })));
    expect(found(sources(SITE_UNIT))).toEqual([]);
    const engine = found(engineParallel());
    expect(engine.map(({ file, text }) => ({ file, text }))).toEqual([RUNNER_LIMIT]);
    // The limit says what it is, in the comment right above it.
    const lines = readFileSync(join(ENGINE_TEST, RUNNER_LIMIT.file), 'utf8').split('\n');
    let k = engine[0]!.line - 2;
    const comment: string[] = [];
    while (k >= 0 && lines[k]!.trim().startsWith('//')) comment.unshift(lines[k--]!.trim().replace(/^\/\/\s?/, ''));
    expect(comment.join(' ')).toContain('a limit of the runner that guards a hang, not a timing check');
  });

  it('the search for assertions on a clock finds the bound of every timing file', () => {
    const timing = (path: string): string[] => durationAssertions(readFileSync(join(ROOT, path), 'utf8')).map((a) => a.text);
    expect(timing('site/tests/timing/T07.timing.test.ts')).toContain('expect(median).toBeLessThan(25);');
    expect(timing('site/tests/timing/T10.timing.test.ts')).toContain('expect(ms, w).toBeLessThan(BUDGET);');
    expect(timing('packages/engine/test/bench/orbit.bench.ts')).toContain('expect(median).toBeLessThanOrEqual(THRESHOLD_MS);');
    expect(timing(`packages/engine/test/${E8_TIMING.bench}`)).toContain(E8_TIMING.bound);
    // Each binding the search follows, on a fragment written here (the clock spelled apart, as above).
    const now = ['Date', 'now()'].join('.');
    const cases: [string, number][] = [
      [`const t0 = ${now}; work(); expect(${now} - t0).toBeLessThan(25);`, 1],
      [`const t0 = ${now}; work(); const ms = ${now} - t0;\nexpect(ms < 25).toBe(true);`, 1],
      [`const runs = [];\nruns.push(${now});\nexpect(runs).toHaveLength(1);\nexpect(runs[0]).toBeGreaterThan(0);`, 1],
      [`function took(f) {\n  const t0 = ${now};\n  f();\n  return ${now} - t0;\n}\nconst t = {};\nt['a'] = took(work);\nfor (const [k, v] of Object.entries(t)) expect(v, k).toBeLessThan(25);`, 1],
      [`function build() {\n  const t0 = ${now};\n  const ms = ${now} - t0;\n  return { status: 0, ms };\n}\nconst r = build();\nexpect(r.status).toBe(0);\nexpect(r.ms).toBeLessThan(9);`, 1],
      [`const { ms } = { ms: ${now} };\nassert.ok(ms < 25);`, 1],
      [`it('a', () => {\n  const [s, ns] = [1, ${now}];\n  expect(s + ns).toBeLessThan(25);\n});\nit('b', () => {\n  const x = [1] as const;\n  expect(x).toEqual([1]);\n});`, 1],
      [`const t0 = ${now};\nprint(${now} - t0);\nexpect(work()).toBe(3);`, 0],
      [`const build = { ms: 0 };\nbuild.ms = ${now};\nexpect(build.ms).toBeLessThan(9);`, 1],
      // a name holds a reading only in the block of its declaration
      [`it('a', () => {\n  const start = ${now};\n  print(${now} - start);\n});\nit('b', () => {\n  const start = 3;\n  expect(start).toBe(3);\n});`, 0],
      // only code counts: a clock in a string or a comment is not a reading, a ${} part of a template is code
      [`expect(page).toContain('${now} + 600'); // expect(${now} - t0).toBeLessThan(1)`, 0],
      [`const k = 'x = ${now}';\nexpect(k).toBe('x');`, 0],
      ['const t0 = ' + now + ';\nexpect(`took ${' + now + ' - t0} ms`).toMatch(/took/);', 1],
    ];
    for (const [src, n] of cases) expect(durationAssertions(src), src).toHaveLength(n);
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
    // Written by the build-done hook of a release build that finished (RT-FIX P3-RT-12-06).
    complete: true,
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
