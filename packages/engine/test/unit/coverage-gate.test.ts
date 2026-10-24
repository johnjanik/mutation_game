// The coverage gate of the engine's Vitest global setup (CONTRACTS.md 3; SPEC.md 7.7, the golden row
// "required for every merge"). After a run of every engine test file, teardown() fails the run when a
// golden key of a phase at or below the phase in force has no test. Adopted from the red team's script
// (P3-RT-11-03), which read coverage.json after p3a-e8.test.ts was deleted and printed
// "phase 3: missing e8" with exit 1 while npm test itself exited 0.
// This file registers no golden key.
//
// The last test checks the wiring itself (the confirmers' gap of P3-RT-11-03): the functions below can be
// right while the teardown no longer calls them, or the project no longer names the global setup, and a
// deleted golden test file then passes unnoticed. It runs Vitest in a child process on a scratch copy of
// the engine project: the project's own vitest.config.ts, _harness.ts and _coverage.setup.ts, copied
// beside links to src/, reference/ and the site registry (so the registrations go to the scratch tree, not
// to this run's), and one stand-in test file per golden test file of this project that registers the same
// keys with the same covers(...) call. With every stand-in the run passes; without the stand-in of
// p3a-e8.test.ts it must fail and name the missing key.
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { GOLDEN_KEYS_BY_PHASE } from '../golden/_harness';
import { coverageGate, missingThrough, phaseInForce } from '../golden/_coverage.setup';

const through = (k: number): Set<string> => {
  const keys = new Set<string>();
  for (let p = 0; p <= k; p++) for (const key of GOLDEN_KEYS_BY_PHASE[p as keyof typeof GOLDEN_KEYS_BY_PHASE]) keys.add(key);
  return keys;
};

describe('the golden coverage gate', () => {
  // regression: P3-RT-11-03
  it('a golden key of a built phase without a test fails the run: phase 3 without e8', () => {
    const keys = through(3);
    keys.delete('e8');
    expect(missingThrough(keys, 3)).toEqual({ '3': ['e8'] });
    expect(() => coverageGate(keys, 3)).toThrow(/phase 3: missing e8/);
  });

  // regression: P3-RT-11-03
  it('every key of phases 0 to k covered passes; keys of later phases are not asked for', () => {
    expect(() => coverageGate(through(3), 3)).not.toThrow();
    expect(missingThrough(through(3), 3)).toEqual({});
    expect(Object.keys(missingThrough(through(3), 4))).toEqual(['4']);
    expect(() => coverageGate(through(3), 4)).toThrow(/phase 4: missing folding, wythoff/);
  });

  // regression: P3-RT-11-03
  it('a missing key of an early phase is named with its phase, beside a later one', () => {
    const keys = through(4);
    keys.delete('types[*].cartan');
    keys.delete('e8.h4_projection');
    expect(() => coverageGate(keys, 4)).toThrow(/phase 0: missing types\[\*\]\.cartan\nphase 4: missing e8\.h4_projection/);
  });

  // regression: P3-RT-11-03
  it('the phase in force is read from the site registry, and phase 4 is built', () => {
    const k = phaseInForce();
    expect(Number.isInteger(k)).toBe(true);
    expect(k).toBeGreaterThanOrEqual(4);
    expect(k).toBeLessThanOrEqual(7);
  });
});

// ---------------------------------------------------------------------------------------------
// The wiring: npm test fails when a golden test file is gone (a child Vitest on a scratch project)
// ---------------------------------------------------------------------------------------------

const ENGINE = resolve(import.meta.dirname, '../..');
const ROOT = resolve(ENGINE, '../..');
const GOLDEN_DIR = join(ENGINE, 'test', 'golden');
/** The golden test file left out of the second run, and the key only it registers. */
const LEFT_OUT = 'p3a-e8.test.ts';

const temps: string[] = [];
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

/** The covers(...) call of each golden test file that has one, by file name (the call copied as written). */
function coversCalls(): Map<string, string> {
  const calls = new Map<string, string>();
  for (const file of readdirSync(GOLDEN_DIR).sort()) {
    if (!file.endsWith('.test.ts')) continue;
    const m = readFileSync(join(GOLDEN_DIR, file), 'utf8').match(/^covers\([\s\S]*?\);$/m);
    if (m) calls.set(file, m[0]);
  }
  return calls;
}

/** A scratch copy of the engine project whose golden test files are stand-ins, all but `omit`. */
function scratchProject(omit: string | null): string {
  const t = mkdtempSync(join(tmpdir(), 'coverage-gate-wiring-'));
  temps.push(t);
  writeFileSync(join(t, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  symlinkSync(join(ROOT, 'node_modules'), join(t, 'node_modules'), 'dir');
  symlinkSync(join(ROOT, 'reference'), join(t, 'reference'), 'dir');
  mkdirSync(join(t, 'site', 'src', 'tools'), { recursive: true });
  symlinkSync(join(ROOT, 'site', 'src', 'tools', 'registry'), join(t, 'site', 'src', 'tools', 'registry'), 'dir');
  const engine = join(t, 'packages', 'engine');
  const golden = join(engine, 'test', 'golden');
  mkdirSync(golden, { recursive: true });
  symlinkSync(join(ENGINE, 'src'), join(engine, 'src'), 'dir');
  copyFileSync(join(ENGINE, 'vitest.config.ts'), join(engine, 'vitest.config.ts'));
  for (const f of ['_harness.ts', '_coverage.setup.ts']) copyFileSync(join(GOLDEN_DIR, f), join(golden, f));
  for (const [file, call] of coversCalls()) {
    if (file === omit) continue;
    const body = [
      `// Stand-in for test/golden/${file}: the same registration, no comparison.`,
      `import { it } from 'vitest';`,
      `import { covers } from './_harness';`,
      call,
      `it('registers the keys of ${file}', () => {});`,
      '',
    ].join('\n');
    writeFileSync(join(golden, file), body);
  }
  return engine;
}

/** Runs the scratch project with Vitest, as npm test -w packages/engine runs this one (no file filter). */
function runProject(engine: string): { status: number | null; output: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
  const vitest = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
  const r = spawnSync(process.execPath, [vitest, 'run', '--root', engine], { cwd: engine, env, encoding: 'utf8', timeout: 240_000 });
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

describe('the coverage gate is wired into the engine project', () => {
  // regression: P3-RT-11-03
  it('with every golden test file the run passes; with p3a-e8.test.ts gone it fails, naming e8', () => {
    const calls = coversCalls();
    expect(calls.get(LEFT_OUT)).toBe("covers('e8');");
    expect(calls.size).toBeGreaterThan(20);
    const control = runProject(scratchProject(null));
    expect(control.status, control.output).toBe(0);
    expect(control.output).toMatch(new RegExp(`Tests\\s+${calls.size} passed`));
    const missing = runProject(scratchProject(LEFT_OUT));
    expect(missing.status, missing.output).not.toBe(0);
    expect(missing.output).toMatch(new RegExp(`Tests\\s+${calls.size - 1} passed`));
    expect(missing.output).toContain('phase 3: missing e8');
  }, 480_000);
});
