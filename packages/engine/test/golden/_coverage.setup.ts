// Vitest global setup for the coverage registry of CONTRACTS.md 3 (owner P0-A2).
// setup() clears the previous run's registrations, so that a removed covers() call is noticed;
// teardown() merges the registrations written by covers() in the test workers into
// test/golden/coverage.json: { keys: [sorted unique spellings], missingByPhase: { "0": [...], ... } }.
// After a run of every test file of the project, teardown() then fails the run when a golden key of a
// phase at or below the phase in force has no test (SPEC.md 7.7: the golden tests of the phases built so
// far are "required for every merge"; RT-FIX P3-RT-11-03). A run of some files only writes the file and
// does not judge it.
// This file runs in the Vitest runner process, not in a test worker, so it must not import 'vitest'
// (the TestProject import below is a type and is erased).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { COVERAGE_DIR, COVERAGE_FILE, GOLDEN_KEYS_BY_PHASE } from './_harness';

const dir = fileURLToPath(COVERAGE_DIR);
const out = fileURLToPath(COVERAGE_FILE);
const REGISTRY_DIR = new URL('../../../../site/src/tools/registry/', import.meta.url);

let project: TestProject | undefined;

/**
 * The phase in force: the highest `phase` of a tool in the site's registry (site/src/tools/registry/T*.ts).
 * A phase's engine work, with its golden tests, is merged before its tools, so every golden key of a
 * phase at or below this one has a test.
 */
export function phaseInForce(registry: URL = REGISTRY_DIR): number {
  const where = fileURLToPath(registry);
  let phase = -1;
  for (const file of readdirSync(where)) {
    if (!/^T\d+\.ts$/.test(file)) continue;
    const m = readFileSync(`${where}/${file}`, 'utf8').match(/^\s*phase:\s*(\d+),/m);
    if (m) phase = Math.max(phase, Number(m[1]));
  }
  if (phase < 0) throw new Error(`no tool in ${where} names its phase, so the phase in force is unknown`);
  return phase;
}

/** The keys of GOLDEN_KEYS_BY_PHASE[0..through] absent from `keys`, by phase (phases with none left out). */
export function missingThrough(keys: ReadonlySet<string>, through: number): Record<string, string[]> {
  const missing: Record<string, string[]> = {};
  for (const phase of Object.keys(GOLDEN_KEYS_BY_PHASE) as unknown as (keyof typeof GOLDEN_KEYS_BY_PHASE)[]) {
    if (Number(phase) > through) continue;
    const absent = GOLDEN_KEYS_BY_PHASE[phase].filter((k) => !keys.has(k));
    if (absent.length > 0) missing[String(phase)] = absent;
  }
  return missing;
}

/** Throws, naming each key, when a golden key of phases 0 to `through` is not among `keys`. */
export function coverageGate(keys: ReadonlySet<string>, through: number): void {
  const missing = missingThrough(keys, through);
  const lines = Object.entries(missing).map(([phase, absent]) => `phase ${phase}: missing ${absent.join(', ')}`);
  if (lines.length > 0) {
    throw new Error(`golden coverage through phase ${through}: no test registers these keys (covers()):\n${lines.join('\n')}`);
  }
}

/** Whether this run ran every test file of the project (no file filter), so that coverage can be judged. */
async function ranEveryTestFile(p: TestProject): Promise<boolean> {
  const { testFiles } = await p.globTestFiles();
  const ran = new Set(
    p.vitest.state
      .getTestModules()
      .filter((m) => m.project.name === p.name)
      .map((m) => m.moduleId),
  );
  return testFiles.length > 0 && testFiles.every((f) => ran.has(f));
}

export function setup(p?: TestProject): void {
  project = p;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

export async function teardown(): Promise<void> {
  const keys = new Set<string>();
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const parsed = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as { keys?: unknown };
      if (Array.isArray(parsed.keys)) {
        for (const k of parsed.keys) if (typeof k === 'string') keys.add(k);
      }
    }
  }
  const sorted = [...keys].sort();
  const missingByPhase: Record<string, string[]> = {};
  for (const phase of Object.keys(GOLDEN_KEYS_BY_PHASE) as unknown as (keyof typeof GOLDEN_KEYS_BY_PHASE)[]) {
    missingByPhase[String(phase)] = GOLDEN_KEYS_BY_PHASE[phase].filter((k) => !keys.has(k));
  }
  writeFileSync(out, JSON.stringify({ keys: sorted, missingByPhase }, null, 2) + '\n');
  if (project !== undefined && (await ranEveryTestFile(project))) coverageGate(keys, phaseInForce());
}
