// The scripts that plain Node runs, on every Node the repository admits (SPEC.md 7.1, Node "22.12 or
// later"; 7.2 item 1; 7.7 commands; CONTRACTS.md 1, engines ">=22.12"), adopted from the red team
// (RT-12, phase 4 round, attack 23, node-minimum.sh on the official Node 22.12.0). Node strips
// TypeScript types by default only from 22.18. scripts/links.mjs (the postbuild of every npm run
// build), scripts/size.mjs and scripts/lab.mjs imported site/astro.config.mjs, which imports
// ./src/lib/unverifiedRegistry.ts, so on Node 22.12 to 22.17 npm run build built every page and
// then exited 1 with 'links: Unknown file extension ".ts"', and size and lab exited 1 the same way.
// They now import plain JavaScript only (site/src/lib/siteAndBase.mjs, and for links.mjs
// site/src/lib/openItemsReport.mjs). The behaviour of Node 22.12 to 22.17 is had on the current
// Node with --no-experimental-strip-types, the switch decisions/P4-A2.md used for scripts/presets.mjs.
// Run: npx vitest run --project site-unit site/tests/unit/scripts-plain-node.test.ts
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const temps: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'scripts-plain-node-'));
  temps.push(d);
  return d;
}
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

/** Runs a script of scripts/ with Node's type stripping switched off, at the root base. */
function withoutTypeStripping(script: string, args: string[], outDir: string): { status: number | null; stdout: string; stderr: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
  for (const k of ['SITE_URL', 'BASE_PATH', 'GITHUB_REPOSITORY', 'BASE_URL', 'RELEASE', 'NODE_OPTIONS']) delete env[k];
  env.OUT_DIR = outDir;
  const r = spawnSync(process.execPath, ['--no-experimental-strip-types', join(ROOT, 'scripts', script), ...args], { encoding: 'utf8', env, cwd: ROOT, timeout: 60_000 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('the scripts of npm run build, size and lab on Node without type stripping', () => {
  it('this Node refuses a .ts module when type stripping is off', () => {
    const r = spawnSync(process.execPath, ['--no-experimental-strip-types', '--input-type=module', '-e', `await import(${JSON.stringify(join(ROOT, 'site', 'astro.config.mjs'))})`], { encoding: 'utf8', cwd: ROOT });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Unknown file extension ".ts"');
  });

  // regression: P4-RT-12-03
  it('links.mjs, the postbuild of npm run build, checks a build', () => {
    const dist = tempDir();
    mkdirSync(join(dist, 'about'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>t</title></head><body><a href="/about/">About</a></body></html>');
    writeFileSync(join(dist, 'about', 'index.html'), '<!doctype html><html><head><title>t</title></head><body><a href="../">home</a></body></html>');
    const r = withoutTypeStripping('links.mjs', [], dist);
    expect(r.stderr).not.toContain('Unknown file extension');
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain('links: 2 internal links on 2 pages');
  });

  // regression: P4-RT-12-03
  it('size.mjs reads the base and the built directory', () => {
    const missing = join(tempDir(), 'no-build');
    const r = withoutTypeStripping('size.mjs', ['--port', '7663'], missing);
    expect(r.stderr).not.toContain('Unknown file extension');
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stderr).toContain(`size: no built directory at ${missing}`);
  });

  // regression: P4-RT-12-03
  it('lab.mjs reads the base and the built directory', () => {
    const missing = join(tempDir(), 'no-build');
    const r = withoutTypeStripping('lab.mjs', ['--port', '7663'], missing);
    expect(r.stderr).not.toContain('Unknown file extension');
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stderr).toContain(`lab: no build found at ${missing}`);
  });
});
