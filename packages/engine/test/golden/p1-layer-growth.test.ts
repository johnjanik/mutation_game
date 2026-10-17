// layer_growth_examples (SPEC.md 4.0, 5.5, 5.7 phase 1; P1-A1 instruction 5.10): the four boards whose
// searches verify.py section 10 recorded, through orbitGraph with maxDepth and with a cap, and roots with
// maxDepth, on Big boards (the board with three roads each way reaches 17 digits within 40 layers).
// The full search of each board runs once and is shared by the three tests of that board.
import { describe, expect, it } from 'vitest';
import type { Vec } from '../../src/arith';
import type { OrbitGraph } from '../../src/search';
import { orbitGraph, roots } from '../../src/search';
import { bigBoard, digits, unitVectors } from '../helpers/p1';
import { covers, golden, intEq, matchRecord } from './_harness';

covers('layer_growth_examples');

interface StopRecord {
  positions: number;
  truncated: boolean;
  complete_layers: number;
  positions_in_complete_layers: number;
}

interface LayerGrowthRecord {
  label: string;
  cartan: number[][];
  layers: number;
  root_populations_found: number;
  new_per_layer: number[];
  largest_entry_digits: number;
  stop_at_2000: StopRecord;
  stop_at_100000: StopRecord;
}

const examples = golden.layer_growth_examples as LayerGrowthRecord[];
const LABELS = ['triangle', 'three roads each way', 'star with four arms', 'star with five arms'];
const FULL_CAP = 150000;
const TIMEOUT = { timeout: 60000 };

const fullSearches = new Map<string, OrbitGraph<bigint>>();
function fullSearch(rec: LayerGrowthRecord): OrbitGraph<bigint> {
  let g = fullSearches.get(rec.label);
  if (g === undefined) {
    const b = bigBoard(rec.cartan);
    g = orbitGraph(b, unitVectors(b), 'mutation', FULL_CAP, rec.layers);
    fullSearches.set(rec.label, g);
  }
  return g;
}

/** Fails with the first index at which two lists of bigint vectors differ. */
function expectSameItems(actual: readonly Vec<bigint>[], expected: readonly Vec<bigint>[]): void {
  expect(actual.length).toBe(expected.length);
  for (let k = 0; k < expected.length; k++) {
    const a = actual[k]!;
    const e = expected[k]!;
    if (a.length !== e.length || a.some((x, j) => x !== e[j])) {
      throw new Error(`item ${k} is ${a.join(',')}, expected ${e.join(',')}`);
    }
  }
}

function countByDepth(g: OrbitGraph<bigint>, layers: number): number[] {
  const per: number[] = [];
  for (let d = 0; d <= layers; d++) per.push(0);
  for (const d of g.depth) per[d]! += 1;
  return per;
}

describe('layer_growth_examples', () => {
  for (const label of LABELS) {
    const rec = matchRecord(examples, { label });

    it(`${label}: full search`, TIMEOUT, () => {
      const full = fullSearch(rec);
      expect(full.truncated).toBe(false);
      intEq(full.depthReached, rec.layers, 'depthReached');
      intEq(full.completeLayers, rec.layers, 'completeLayers');
      intEq(full.items.length, rec.root_populations_found, 'root_populations_found');
      intEq(countByDepth(full, rec.layers), rec.new_per_layer, 'new_per_layer');
      let largest = 0;
      for (const v of full.items) for (const x of v) largest = Math.max(largest, digits(x));
      intEq(largest, rec.largest_entry_digits, 'largest_entry_digits');
      const b = bigBoard(rec.cartan);
      const r = roots(b, FULL_CAP, rec.layers);
      expect(r.truncated).toBe(false);
      expectSameItems(r.items, full.items);
    });

    for (const cap of [2000, 100000] as const) {
      it(`${label}: stop at ${cap}`, TIMEOUT, () => {
        const stop = cap === 2000 ? rec.stop_at_2000 : rec.stop_at_100000;
        const b = bigBoard(rec.cartan);
        const g = orbitGraph(b, unitVectors(b), 'mutation', cap, rec.layers);
        intEq(g.items.length, stop.positions, 'positions');
        expect(g.truncated).toBe(stop.truncated);
        intEq(g.completeLayers, stop.complete_layers, 'complete_layers');
        const inside = g.depth.filter((d) => d <= g.completeLayers).length;
        intEq(inside, stop.positions_in_complete_layers, 'positions_in_complete_layers');
        const full = fullSearch(rec);
        expectSameItems(g.items, full.items.slice(0, g.items.length));
      });
    }
  }
});
