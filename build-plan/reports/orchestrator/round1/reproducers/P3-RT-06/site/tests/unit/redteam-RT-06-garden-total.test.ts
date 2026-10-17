// RT-06, incidental (found while checking attack 4, "T2 orbit mode on a finite board in phase 3, where
// orbitSize makes the orbit known"): the T2 counter's total in orbit mode on a finite-type board.
// SPEC.md 4 T2 Interactions: "In orbit mode the total is known when the enumeration completes within the
// garden's bound; otherwise the counter says "more than 2000", and from phase 3 on a finite-type board it
// gives the exact size from orbitSize." The component computes the total with gardenTotal (t02/phase2.ts,
// called at T02OrbitGarden.svelte lines 302 and 389), which falls through to garden.ts totalOf; no file of
// site/src calls orbitSize (garden.ts line 238 announces the phase-3 rule in a comment only).
// Run: npx vitest run --root . site/tests/unit/redteam-RT-06-garden-total.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boardFromName, orbitSize } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import { gardenTotal, gardenLayersBound } from '../../src/components/tools/t02/phase2';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { fundamental_orbit_sizes: number[] }>;
};

/** The fundamental weight of the node with Bourbaki label k (positions follow Bourbaki on named boards). */
function omega(board: AnyBoard, k: number): number[] {
  return Array.from({ length: board.n }, (_, i) => (i === k - 1 ? 1 : 0));
}

describe('T2 orbit total on a finite-type board above the garden bound (phase 3: orbitSize)', () => {
  for (const [name, node] of [['E8', 1], ['E7', 3], ['E7', 5]] as const) {
    it(`${name}, orbit of the fundamental weight of node ${node}`, () => {
      const board = boardFromName(name);
      const expected = golden.types[name]!.fundamental_orbit_sizes[node - 1]!;
      expect(expected).toBeGreaterThan(2000);
      expect(orbitSize(board, omega(board, node))).toBe(expected);
      const spec = { board, grows: 'orbit' as const, seed: omega(board, node), game: 'firing' as const };
      const total = gardenTotal(spec, gardenLayersBound(board));
      expect(total, `${name} node ${node}: the counter's total`).toEqual({ kind: 'number', value: expected });
    });
  }
});
