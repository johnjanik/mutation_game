// The path aliases of CONTRACTS.md 1 (@engine, @components/*, @lib/*), adopted from the red team
// (RT-12 attack 44, redteam/rt12/run-typecheck-mutations.sh case a-lib and
// site/tests/unit/redteam-RT-12-aliases.test.ts). They were declared twice: in site/tsconfig.json
// (read by the build and the type check) and as resolve.alias of the site-unit project in
// vitest.config.ts (read by npm test). With the @lib/* target of site/tsconfig.json broken, the build
// and the type check failed but the alias tests passed, so the next edit to one declaration could
// split them unnoticed. The site-unit project now reads the paths of site/tsconfig.json.
//
// The check runs Vitest in a child process on a scratch tree: copies of vitest.config.ts,
// tsconfig.base.json and site/tsconfig.json beside links to node_modules, packages/ and site/src/, and
// the red team's alias test as the probe. With site/tsconfig.json as committed the probe passes; with
// its @lib/* target broken (the red team's mutation) the probe must fail.
// The second check (the residual of P3-RT-12-05): eight tool unit tests kept their own copy of the three
// aliases in the resolve.alias of the Vite server they load .svelte files with. They read site/tsconfig.json
// now (resolve.tsconfigPaths), and every test file and test configuration is scanned so that a new copy,
// in any form Vite or a tsconfig takes, fails here.
// Run: npx vitest run --project site-unit site/tests/unit/aliases-one-source.test.ts
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '../../..');
const PROBE = join(import.meta.dirname, 'fixtures', 'aliases-probe.ts');
const BROKEN = '"@lib/*": ["./src/rt12-no-such-dir/*"]';

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

/** A scratch tree whose site/tsconfig.json is the committed one, or the one with @lib/* broken. */
function scratchTree(breakLib: boolean): string {
  const t = mkdtempSync(join(tmpdir(), 'aliases-one-source-'));
  temps.push(t);
  copyFileSync(join(ROOT, 'vitest.config.ts'), join(t, 'vitest.config.ts'));
  copyFileSync(join(ROOT, 'tsconfig.base.json'), join(t, 'tsconfig.base.json'));
  writeFileSync(join(t, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  symlinkSync(join(ROOT, 'node_modules'), join(t, 'node_modules'), 'dir');
  symlinkSync(join(ROOT, 'packages'), join(t, 'packages'), 'dir');
  mkdirSync(join(t, 'site', 'tests', 'unit', 'fixtures'), { recursive: true });
  symlinkSync(join(ROOT, 'site', 'src'), join(t, 'site', 'src'), 'dir');
  const tsconfig = readFileSync(join(ROOT, 'site', 'tsconfig.json'), 'utf8');
  const committed = '"@lib/*": ["./src/lib/*"]';
  expect(tsconfig).toContain(committed);
  writeFileSync(join(t, 'site', 'tsconfig.json'), breakLib ? tsconfig.replace(committed, BROKEN) : tsconfig);
  copyFileSync(PROBE, join(t, 'site', 'tests', 'unit', 'fixtures', 'aliases-probe.test.ts'));
  return t;
}

/** Runs the probe with Vitest in the scratch tree, as npm test runs the site unit tests. */
function runProbe(tree: string): { status: number | null; output: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
  const vitest = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
  const r = spawnSync(process.execPath, [vitest, 'run', '--root', tree, '--project', 'site-unit', 'site/tests/unit/fixtures/aliases-probe.test.ts'], {
    cwd: tree,
    env,
    encoding: 'utf8',
    timeout: 180_000,
  });
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

describe('one declaration of the path aliases', () => {
  // regression: P3-RT-12-05
  it('npm test reads the aliases from site/tsconfig.json: with @lib/* broken there, the alias test fails', () => {
    const control = runProbe(scratchTree(false));
    expect(control.status, control.output).toBe(0);
    expect(control.output).toMatch(/Tests\s+3 passed/);
    const broken = runProbe(scratchTree(true));
    expect(broken.status, broken.output).not.toBe(0);
    expect(broken.output).toContain('@lib/katex');
  }, 300_000);
});

// ---------------------------------------------------------------------------------------------
// No copy of the aliases in a test or a test configuration
// ---------------------------------------------------------------------------------------------

const ALIAS = String.raw`@(?:engine|components|lib)`;
/** The ways a copy is written: an object key ('@lib': ..., "@lib/*": [...]), a find entry of a Vite alias list, or an alias block naming one. */
const COPY_FORMS: RegExp[] = [
  new RegExp(String.raw`['"\x60]${ALIAS}(?:\/\*)?['"\x60]\s*:`),
  new RegExp(String.raw`\bfind\s*:\s*(?:['"\x60]|\/\^?)${ALIAS}`),
  new RegExp(String.raw`\balias\s*:[\s\S]{0,400}?${ALIAS}\b`),
];

/** The copies of the aliases in a source text, as "line: text" (comments included: a commented copy is still a copy to remove). */
function copiesIn(text: string): string[] {
  const found: string[] = [];
  for (const form of COPY_FORMS) {
    const m = form.exec(text);
    if (m) found.push(`${text.slice(0, m.index).split('\n').length}: ${m[0].split('\n')[0]!.trim()}`);
  }
  return found;
}

/** Every source file below a directory (scripts, configurations, tests and their fixtures). */
function sourcesBelow(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sourcesBelow(p));
    else if (/\.(?:[cm]?[jt]s|svelte)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('no second declaration of the path aliases', () => {
  // regression: residual of P3-RT-12-05 (eight tool unit tests declared their own resolve.alias)
  it('the scan finds each form of a copy, and not the one declaration read through tsconfigPaths', () => {
    // The block as T01.test.ts (and seven others) had it.
    const was = [
      '    resolve: {',
      '      alias: {',
      "        '@engine': join(SITE, '../packages/engine/src/index.ts'),",
      "        '@components': join(SITE, 'src/components'),",
      "        '@lib': join(SITE, 'src/lib'),",
      '      },',
      '    },',
    ].join('\n');
    expect(copiesIn(was).length).toBeGreaterThan(0);
    expect(copiesIn("resolve: { alias: [{ find: '@lib', replacement: '/x/src/lib' }] }").length).toBeGreaterThan(0);
    expect(copiesIn('resolve: { alias: [{ find: /^@engine$/, replacement: e }] }').length).toBeGreaterThan(0);
    expect(copiesIn('const paths = { "@components/*": ["./src/components/*"] };').length).toBeGreaterThan(0);
    expect(copiesIn('    resolve: { tsconfigPaths: true },')).toEqual([]);
    expect(copiesIn("import { speak } from '@lib/a11y';\nimport { boardFromName } from '@engine';")).toEqual([]);
  });

  // regression: residual of P3-RT-12-05
  it('no test file or test configuration declares the aliases again', () => {
    const self = fileURLToPath(import.meta.url);
    const files = [
      ...sourcesBelow(join(ROOT, 'site', 'tests')).filter((f) => f !== self),
      join(ROOT, 'vitest.config.ts'),
      join(ROOT, 'playwright.config.ts'),
      join(ROOT, 'packages', 'engine', 'vitest.config.ts'),
      join(ROOT, 'site', 'astro.config.mjs'),
    ];
    expect(files.some((f) => f.endsWith(join('unit', 'tools', 'T01.test.ts')))).toBe(true);
    const copies = files.flatMap((f) => copiesIn(readFileSync(f, 'utf8')).map((c) => `${relative(ROOT, f)}:${c}`));
    expect(copies, 'declare the aliases only in site/tsconfig.json (read with resolve.tsconfigPaths)').toEqual([]);
  });
});
