// Vitest global setup for the coverage registry of CONTRACTS.md 3 (owner P0-A2).
// setup() clears the previous run's registrations, so that a removed covers() call is noticed;
// teardown() merges the registrations written by covers() in the test workers into
// test/golden/coverage.json: { keys: [sorted unique spellings], missingByPhase: { "0": [...], ... } }.
// This file runs in the Vitest runner process, not in a test worker, so it must not import 'vitest'.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COVERAGE_DIR, COVERAGE_FILE, GOLDEN_KEYS_BY_PHASE } from './_harness';

const dir = fileURLToPath(COVERAGE_DIR);
const out = fileURLToPath(COVERAGE_FILE);

export function setup(): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

export function teardown(): void {
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
}
