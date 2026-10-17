// RT-10 (spec-compliance), phase 3 round 1, attack 32: SPEC 4 T2 Interactions, "In `orbit` mode the total
// is known when the enumeration completes within the garden's bound; otherwise the counter says "more than
// 2000", and from phase 3 on a finite-type board it gives the exact size from `orbitSize`."
// The counter's total is computed by gardenTotal (t02/phase2.ts), which T02OrbitGarden.svelte shows in
// data-out="total" after "Show total". Expected on E6 and E8 from the numbers all ones: weyl_order (all
// ones lies on no mirror, so the orbit has |W| positions, far above the garden's bound of 2000).
// Run: npx vitest run site/tests/unit/redteam-RT-10-garden-total.test.ts
import { describe, expect, it } from 'vitest';
import { orbitSize } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import golden from '../../../reference/golden_data.json';
import { resolveBoard } from '../../src/lib/state';
import { gameOf, startVector, totalText, type GardenSpec } from '../../src/components/tools/t02/garden';
import { gardenTotal } from '../../src/components/tools/t02/phase2';

const orbitSpec = (name: string, start: number[]): GardenSpec => {
  const s = startVector(resolveBoard(name), start);
  return { board: s.board, grows: 'orbit', seed: s.v, game: gameOf('orbit', 'numbers') };
};

describe('RT-10: T2 total from orbitSize on a finite-type board (phase 3)', () => {
  it('E6, numbers all ones: the total shown after asking is weyl_order, not "more than 2000"', () => {
    const spec = orbitSpec('E6', [1, 1, 1, 1, 1, 1]);
    const expected = (golden as any).types.E6.weyl_order as number;
    expect(orbitSize(spec.board as Board<number>, spec.seed as number[])).toBe(expected);
    const t = gardenTotal(spec, undefined);
    expect(totalText(t)).toBe(String(expected));
  });
  it('E8, numbers all ones: the total is weyl_order 696729600', () => {
    const spec = orbitSpec('E8', [1, 1, 1, 1, 1, 1, 1, 1]);
    expect(totalText(gardenTotal(spec, undefined))).toBe(String((golden as any).types.E8.weyl_order));
  });
});
