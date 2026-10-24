// RT-08 (content rules, phase 4 round), attack 16, sibling of P3-RT-08-01: "verified by computation"
// with a range wider than the check. SPEC.md 0.3 [V]: "the range of boards checked is stated with the
// claim or is "every type of rank at most 8""; SPEC 2.14: "[V for every type of rank 2 to 8; oracle
// function euclidean_basis]" and "[V for every type of rank 2 to 8]" for the Coxeter plane. A "type" is a
// board of finite type (the 32 named types of golden `types`). M7 says "every board of rank two to
// eight", which takes in every affine and indefinite board of those ranks, where neither statement can
// hold: on the two-node board with three roads each way (golden layer_growth_examples) B = DC has a
// negative eigenvalue, so no real E has E^T E = B, and there is no Coxeter number h.
// Adopted by RT-FIX-P4 lesson M7 (P4-RT-08-01, the same cause as P4-RT-09-01 in content-m7-finite-type.test.ts).
// Run: npx vitest run --project site-unit site/tests/unit/content-m7-rank-range.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveGoldenPath } from '../../src/lib/golden';

const m7 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m7-geometry.mdx', import.meta.url)), 'utf8');

describe('RT-08 P4: the range of "verified by computation" in M7', () => {
  it('the check behind 2.14 covers the named finite types only', () => {
    const types = Object.keys(resolveGoldenPath('types') as Record<string, unknown>);
    expect(types.length).toBe(32);
    // A board of rank 2 that is not of finite type: B = DC (D = I, symmetric) has determinant 4 - 9 < 0,
    // so one eigenvalue is negative and B has no real factorisation E^T E.
    const growth = resolveGoldenPath('layer_growth_examples') as { label: string; cartan: number[][] }[];
    const c = growth.find((g) => g.label === 'three roads each way')!.cartan;
    expect(c.length).toBe(2);
    expect(c[0]![0]! * c[1]![1]! - c[0]![1]! * c[1]![0]!).toBeLessThan(0);
  });
  // regression: P4-RT-08-01
  it('m7-geometry.mdx never claims a computation on "every board of rank two to eight"', () => {
    const hits = m7.split('\n').map((l, i) => [i + 1, l] as const).filter(([, l]) => /every board of rank two to eight/.test(l)).map(([n, l]) => `line ${n}: ${(l.match(/[^.>]*every board of rank two to eight[^.<]*/) ?? [''])[0].trim()}`);
    // Observed at b9b8504: line 114 (beat 6) "verified by computation on every board of rank two to eight";
    // line 156 (Seen box, the coordinates y = Ep) and line 159 (Seen box, the Coxeter plane)
    // "verified by computation, every board of rank two to eight".
    expect(hits, 'M7 states the check of SPEC 2.14 for every board of rank 2 to 8, not every finite type').toEqual([]);
  });
});
