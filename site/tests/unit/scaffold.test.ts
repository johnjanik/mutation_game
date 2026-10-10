// The scaffold invariants of build-plan/agents/P0-A1-repo-scaffold.md section 6.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const json = (p: string) => JSON.parse(read(p));

const PINS: Record<string, string> = {
  astro: '7.3.8',
  '@astrojs/mdx': '8.0.3',
  svelte: '5.57.2',
  '@astrojs/svelte': '9.0.1',
  typescript: '6.0.3',
  nanostores: '1.5.5',
  vitest: '5.0.3',
  'fast-check': '4.10.2',
  '@playwright/test': '1.64.0',
  '@axe-core/playwright': '4.13.0',
};

const SCRIPTS = ['test', 'build', 'build:release', 'preview', 'e2e', 'size', 'lab', 'report', 'verify', 'typecheck', 'check'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === '.astro' || name === 'build-plan' || name === 'reference') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('scaffold', () => {
  it('node version and .nvmrc', () => {
    const [major, minor] = process.versions.node.split('.').map(Number);
    expect(major > 22 || (major === 22 && minor >= 12)).toBe(true);
    expect(read('.nvmrc').trim()).toBe('22');
  });

  it('installed versions equal the pins', () => {
    for (const [pkg, version] of Object.entries(PINS)) {
      const installed = json(`node_modules/${pkg}/package.json`).version;
      expect(installed, pkg).toBe(version);
    }
  });

  it('root package.json shape', () => {
    const pkg = json('package.json');
    expect(pkg.private).toBe(true);
    expect(pkg.workspaces).toEqual(['packages/*', 'site']);
    expect(pkg.engines.node).toBe('>=22.12');
    expect(pkg.license).toBe('AGPL-3.0-only');
    expect(Object.keys(pkg.scripts).sort()).toEqual([...SCRIPTS, 'e2e:basepath', 'prebuild'].filter((s) => s in pkg.scripts).sort());
    for (const s of SCRIPTS) expect(pkg.scripts[s], s).toBeTypeOf('string');
    // A stub exits 2 with the exact text; once P0-A6 fills the bodies this assertion is dropped by MERGE.
    const stubs = SCRIPTS.filter((s) => pkg.scripts[s].includes('not yet implemented: P0-A6'));
    for (const s of stubs) {
      const r = spawnSync('npm', ['run', '--silent', s], { cwd: ROOT, encoding: 'utf8' });
      expect(r.status, s).toBe(2);
      expect(r.stderr, s).toContain('not yet implemented: P0-A6');
    }
  });

  it('exact pins and lockfile', () => {
    for (const file of ['package.json', 'packages/engine/package.json', 'site/package.json']) {
      const pkg = json(file);
      for (const field of ['dependencies', 'devDependencies']) {
        for (const [name, version] of Object.entries<string>(pkg[field] ?? {})) {
          expect(version, `${file} ${name}`).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
        }
      }
    }
    expect(existsSync(join(ROOT, 'package-lock.json'))).toBe(true);
    expect(execFileSync('git', ['ls-files', 'package-lock.json'], { cwd: ROOT, encoding: 'utf8' }).trim()).toBe('package-lock.json');
  });

  it('engine package has no dependencies', () => {
    const pkg = json('packages/engine/package.json');
    expect(pkg.name).toBe('@two-games/engine');
    expect(pkg.dependencies).toEqual({});
    expect(Object.keys(pkg.devDependencies).sort()).toEqual(['fast-check', 'typescript', 'vitest']);
  });

  it('engine index is re-exports only', () => {
    // CONTRACTS 2.1: index.ts re-exports the public API and nothing else. P0-A1 shipped `export {};`;
    // P0-A2 replaced it in stage 0.2 and MERGE updated this assertion: every statement is an export from a sibling module.
    const src = read('packages/engine/src/index.ts');
    const statements = src
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    expect(statements.length).toBeGreaterThan(0);
    for (const s of statements) {
      expect(s, s).toMatch(/^export (type )?\{[\s\S]*\} from '\.\/[a-zA-Z]+'$/);
    }
  });

  it('gitignore patterns', () => {
    const lines = read('.gitignore').split('\n').map((l) => l.trim());
    for (const p of ['node_modules/', 'dist/', '.astro/', 'site/src/generated/', 'reports/*', '!reports/gate-*.md', 'playwright-report/', 'test-results/', 'coverage/', '.DS_Store', '*.zip', 'SPEC-draft.pdf', '.claude/settings.local.json']) {
      expect(lines, p).toContain(p);
    }
    const ignored = spawnSync('git', ['check-ignore', '.claude/settings.local.json'], { cwd: ROOT, encoding: 'utf8' });
    expect(ignored.stdout.trim()).toBe('.claude/settings.local.json');
    const gate = spawnSync('git', ['check-ignore', 'reports/gate-G0.md'], { cwd: ROOT, encoding: 'utf8' });
    expect(gate.status).toBe(1);
  });

  it('tsconfig base and aliases', () => {
    const base = json('tsconfig.base.json');
    expect(base.compilerOptions.strict).toBe(true);
    expect(base.compilerOptions.moduleResolution).toBe('bundler');
    const site = json('site/tsconfig.json');
    expect(Object.keys(site.compilerOptions.paths)).toEqual(['@engine', '@components/*', '@lib/*']);
  });

  it('base.css tokens', () => {
    const css = read('site/src/styles/base.css');
    const names = ['--page', '--text', '--sign-pos-fill', '--sign-pos-numeral', '--sign-neg-outline', '--sign-zero-outline', '--edge-1', '--edge-2', '--edge-3', '--edge-4', '--edge-5', '--edge-6', '--edge-7', '--edge-8', '--accent-populations', '--accent-numbers', '--focus-ring', '--road', '--arrow'];
    for (const n of names) expect(css, n).toContain(`${n}:`);
    const light: Record<string, string> = { '--page': '#FFFFFF', '--text': '#1A1A1A', '--sign-pos-fill': '#0072B2', '--sign-pos-numeral': '#FFFFFF', '--sign-neg-outline': '#D55E00', '--sign-zero-outline': '#767676', '--edge-1': '#0072B2', '--edge-2': '#D55E00', '--edge-3': '#009E73', '--edge-4': '#CC79A7', '--edge-5': '#B26F00', '--edge-6': '#3A8FCB', '--edge-7': '#807500', '--edge-8': '#1A1A1A', '--accent-populations': '#009E73', '--accent-numbers': '#CC79A7' };
    const dark: Record<string, string> = { '--page': '#121212', '--text': '#E8E8E8', '--sign-pos-fill': '#56B4E9', '--sign-pos-numeral': '#121212', '--sign-neg-outline': '#E69F00', '--sign-zero-outline': '#8A8A8A', '--edge-1': '#56B4E9', '--edge-2': '#FF8A4C', '--edge-3': '#2DBE95', '--edge-4': '#CC79A7', '--edge-5': '#E69F00', '--edge-6': '#6FA8FF', '--edge-7': '#F0E442', '--edge-8': '#E8E8E8', '--accent-populations': '#009E73', '--accent-numbers': '#CC79A7' };
    const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
    const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf(':root[data-theme="dark"]'));
    const switchBlock = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('body {'));
    for (const [n, v] of Object.entries(light)) expect(rootBlock, `light ${n}`).toContain(`${n}: ${v};`);
    for (const [n, v] of Object.entries(dark)) {
      expect(darkBlock, `dark ${n}`).toContain(`${n}: ${v};`);
      expect(switchBlock, `switch ${n}`).toContain(`${n}: ${v};`);
    }
    expect(css).toContain(':root:not([data-theme="light"])');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('licences and SPDX', () => {
    expect(read('LICENSE')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
    const content = read('LICENSE-content');
    expect(content).toContain('CC BY-SA 4.0');
    expect(content).toContain('SPDX-License-Identifier: CC-BY-SA-4.0');
    expect(content).toContain('https://creativecommons.org/licenses/by-sa/4.0/');
    for (const file of ['package.json', 'packages/engine/package.json', 'site/package.json']) {
      expect(json(file).license, file).toBe('AGPL-3.0-only');
    }
  });

  it('CLAUDE.md is Appendix H plus one paragraph', () => {
    const spec = read('SPEC.md').split('\n');
    const heading = spec.findIndex((l) => l.startsWith('## Appendix H. Starter `CLAUDE.md`'));
    expect(heading).toBeGreaterThan(0);
    const open = spec.findIndex((l, i) => i > heading && l.startsWith('```'));
    const close = spec.findIndex((l, i) => i > open && l.startsWith('```'));
    const block = spec.slice(open + 1, close);
    const claude = read('CLAUDE.md').split('\n');
    expect(claude.slice(0, block.length)).toEqual(block);
    const rest = claude.slice(block.length).join('\n').trim();
    expect(rest).toContain('build-plan/');
    expect(rest.split(/\n\s*\n/).length).toBe(1);
    expect(read('CLAUDE.md')).not.toContain('—');
  });

  it('DECISIONS.md header and P0-A1 fragment', () => {
    const decisions = read('DECISIONS.md');
    expect(decisions).toContain('decisions/');
    expect(decisions).toContain('MERGE');
    expect(decisions).toContain('GATE');
    const fragment = read('decisions/P0-A1.md');
    for (const d of ['D1', 'D3', 'D4', 'D18']) expect(fragment).toContain(d);
    for (const pkg of Object.keys(PINS)) expect(fragment, pkg).toContain(pkg);
  });

  it('workflows match SPEC 7.8', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/pull_request/);
    expect(ci).toMatch(/push:\s*\n\s*branches:\s*\[?\s*main/);
    const order = ['npm ci', 'npm run check', 'npm run build:release', 'npm run build\n', 'upload-artifact'].map((s) => ci.indexOf(s));
    for (let i = 1; i < order.length; i++) expect(order[i], `step order ${i}`).toBeGreaterThan(order[i - 1]);
    expect(ci).toContain('site/dist');
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toContain("vars.DEPLOY_PAGES == 'true'");
    expect(deploy).toMatch(/tags:\s*\n?\s*-?\s*\[?\s*['"]?v\*/);
    expect(deploy).toContain('workflow_dispatch');
    expect(deploy).toContain('RELEASE');
    const links = read('.github/workflows/links.yml');
    expect(links).toContain('schedule');
    expect(links).toContain('cron');
  });

  it('astro dev appears nowhere', () => {
    for (const file of walk(ROOT)) {
      if (!/\.(json|yml|yaml|mjs|ts|cjs|js|toml)$/.test(file)) continue;
      if (file.endsWith('scaffold.test.ts')) continue;
      expect(readFileSync(file, 'utf8'), file).not.toContain('astro dev');
    }
  });

  it('reference hashes equal CONTRACTS 9', () => {
    const expected: Record<string, string> = {
      'reference/golden_data.json': 'c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f',
      'reference/lie_games.py': '485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad',
      'reference/verify.py': '1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d',
    };
    for (const [file, hash] of Object.entries(expected)) {
      const actual = createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex');
      expect(actual, file).toBe(hash);
    }
  });
});
