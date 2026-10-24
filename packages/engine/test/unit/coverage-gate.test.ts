// The coverage gate of the engine's Vitest global setup (CONTRACTS.md 3; SPEC.md 7.7, the golden row
// "required for every merge"). After a run of every engine test file, teardown() fails the run when a
// golden key of a phase at or below the phase in force has no test. Adopted from the red team's script
// (P3-RT-11-03), which read coverage.json after p3a-e8.test.ts was deleted and printed
// "phase 3: missing e8" with exit 1 while npm test itself exited 0.
// This file registers no golden key.
import { describe, expect, it } from 'vitest';
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
