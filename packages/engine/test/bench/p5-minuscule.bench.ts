// The E7 timing of the phase-5 roster (P5-A1 instruction, acceptance: "the 56 of E7 builds in under two
// seconds", wall time of minusculeMatrices(E7, 6) measured with performance.now(), gate G5). It is a timing
// check, so it runs alone through `npm run bench -w packages/engine` (test/bench/vitest.config.ts, one file
// at a time), out of the parallel suite of `npm test`, where a duration measures the load of the suite rather
// than the engine (P4-X2, P4 wave 4.5; site/tests/unit/scripts.test.ts "timing checks run alone"). The 18
// records of minuscule_representations, the 56 of E7 among them, stay in test/golden/p5-minuscule.test.ts
// with covers(). The time of chevalleySerre on the same matrices (280 records) is written out, not asserted.
import { describe, expect, it } from 'vitest';
import { chevalleySerre, minusculeMatrices } from '../../src/rep';
import { boardOf, golden, intEq, matchRecord } from '../golden/_harness';

describe('E7 56 under two seconds', () => {
  it('minusculeMatrices(E7, 6) builds the 56 in under two seconds', { timeout: 60000 }, () => {
    const b = boardOf('E7');
    const rec = matchRecord(golden.minuscule_representations as { type: string; node: number; dimension: number }[], { type: 'E7', node: 7 });
    const t0 = performance.now();
    const m = minusculeMatrices(b, 6);
    const ms = performance.now() - t0;
    expect(m).not.toBeNull();
    intEq(m!.basis.length, rec.dimension);
    const t1 = performance.now();
    const records = chevalleySerre(b, m!.E, m!.F, m!.H);
    const serreMs = performance.now() - t1;
    expect(records.length).toBe(6 * b.n * b.n - 2 * b.n);
    expect(records.every((r) => r.holds)).toBe(true);
    process.stdout.write(`E7 node 7: minusculeMatrices ${ms.toFixed(2)} ms, chevalleySerre ${serreMs.toFixed(2)} ms\n`);
    expect(ms).toBeLessThan(2000);
  });
});
