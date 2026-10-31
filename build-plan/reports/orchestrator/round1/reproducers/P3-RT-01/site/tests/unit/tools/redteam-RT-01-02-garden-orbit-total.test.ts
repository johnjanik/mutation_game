// RT-01 round 1 (phase 3), finding P3-RT-01-02. SPEC.md 4 T2 Interactions: "In `orbit` mode the total is known when
// the enumeration completes within the garden's bound; otherwise the counter says "more than 2000", and from phase 3
// on a finite-type board it gives the exact size from `orbitSize`." Phase 3 has merged (gate G3 green at 69546f0), and
// the T2 counter still says "more than 2000" on a finite-type board whose orbit exceeds the garden's bound.
// Expected values from the engine's own orbitSize, which equals the oracle's orbit_size(C, -end) (the oracle gives
// orbit_size(cartan('A', 6), (1,)*6) = 5040, orbit_size(cartan('B', 5), (1,)*5) = 3840,
// orbit_size(cartan('E', 6), (1,)*6) = 51840, and for the A6 population (2, 1, 5, 1, 3, 8), whose numbers are
// (3, -5, 8, -6, -3, 13), orbit_size(C, -end) = 2520; orbitSize gives the same four values).
// Run: npx vitest run --project site-unit site/tests/unit/tools/redteam-RT-01-02-garden-orbit-total.test.ts
import { describe, expect, it } from 'vitest';
import { boardFromName, orbitSize } from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import { totalText, type GardenSpec } from '../../../src/components/tools/t02/garden';
import { gardenLayersBound, gardenTotal } from '../../../src/components/tools/t02/phase2';

const cases: [string, number[], 'firing' | 'mutation', number][] = [
  ['A6', [1, 1, 1, 1, 1, 1], 'firing', 5040], // the orbit of rho: |W(A6)|
  ['B5', [1, 1, 1, 1, 1], 'firing', 3840], // |W(B5)|
  ['E6', [1, 1, 1, 1, 1, 1], 'firing', 51840], // |W(E6)|
  ['A6', [2, 1, 5, 1, 3, 8], 'mutation', 2520], // a population of A6 in the mutation game
];

describe('T2 orbit counter on finite-type boards (phase 3: the exact size from orbitSize)', () => {
  for (const [name, seed, game, oracle] of cases) {
    it(`${name} ${game} from ${JSON.stringify(seed)}`, () => {
      const board = boardFromName(name) as AnyBoard;
      const spec: GardenSpec = { board, grows: 'orbit', seed, game };
      const numbers = game === 'firing' ? seed : (board.cartan as number[][]).map((row) => row.reduce((s, c, j) => s + c * seed[j]!, 0));
      const exact = orbitSize(board as Board<number>, numbers);
      expect(exact).toBe(oracle);
      expect(exact).toBeGreaterThan(2000);
      expect(totalText(gardenTotal(spec, gardenLayersBound(board)))).toBe(String(exact));
    });
  }
});
