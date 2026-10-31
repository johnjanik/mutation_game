// RT-08 (content rules), attacks 9 and 11, phase 3: the Orbit Garden's counter on a finite-type board
// in `orbit` mode. SPEC.md 4 T2 Interactions: "In `orbit` mode the total is known when the enumeration
// completes within the garden's bound; otherwise the counter says "more than 2000", and from phase 3 on a
// finite-type board it gives the exact size from `orbitSize`." The component shows
// totalText(gardenTotal(spec, bound)) (T02OrbitGarden.svelte), so this test reads that function.
// Expected values come from reference/golden_data.json (types.E8.weyl_order: the orbit of all ones is
// regular, so its size is the order of the group), never typed.
import { describe, expect, it } from 'vitest';
import { boardFromName, orbitSize } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import { resolveGoldenPath } from '../../src/lib/golden';
import { gameOf, startVector, totalText, type GardenSpec } from '../../src/components/tools/t02/garden';
import { gardenLayersBound, gardenTotal } from '../../src/components/tools/t02/phase2';

function orbitSpec(name: string, start: number[]): { spec: GardenSpec; board: AnyBoard } {
  const board = boardFromName(name);
  const s = startVector(board, start);
  return { spec: { board: s.board, grows: 'orbit', seed: s.v, game: gameOf('orbit', 'numbers') }, board: s.board };
}

describe('RT-08: T2 counter total in orbit mode on a finite-type board (phase 3)', () => {
  it('E8, the numbers game from all ones: the exact size from orbitSize, not "more than 2000"', () => {
    const { spec, board } = orbitSpec('E8', [1, 1, 1, 1, 1, 1, 1, 1]);
    const expected = resolveGoldenPath('types.E8.weyl_order') as number;
    // The engine function the specification names agrees with the golden value.
    expect(orbitSize(board as never, spec.seed as never)).toBe(expected);
    const shown = totalText(gardenTotal(spec, gardenLayersBound(spec.board)));
    // Observed at 69546f0: "more than 2000".
    expect(shown, 'counter total of T2 on E8 from all ones').not.toBe('more than 2000');
    expect(shown.replace(/[\s ,]/g, '')).toBe(String(expected));
  });
});
