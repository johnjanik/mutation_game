// P1-A6: T2, the Orbit Garden, at engine level (SPEC.md 4 T2 Acceptance; the plan tests of the
// instruction, section 5.15). Every test exercises the functions under site/src/components/tools/t02/,
// not only the engine. Golden values are read from reference/golden_data.json, never typed; covers()
// is not called, since these keys belong to P1-A1's golden files (CONTRACTS 3).
// Oracle facts named in comments were computed with reference/lie_games.py (dynkin_labels, mutate,
// positive_roots on roots(C)).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CAPS,
  EngineOverflow,
  applyWord,
  boardFromName,
  mutate,
  orbitGraph,
  orbitSize,
  roots,
  subBoard,
  toLabels,
  toPositions,
} from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import golden from '../../../../reference/golden_data.json';
import { resolveGoldenPath } from '../../../src/lib/golden';
import { resolveBoard } from '../../../src/lib/state';
import { whereToRun } from '../../../src/lib/worker';
import {
  MORE_THAN,
  canGrow,
  chartLayers,
  clampLayers,
  entriesInLabelOrder,
  gameOf,
  grow,
  highlightFor,
  isNamedFinite,
  jumpTo,
  keyOf,
  layersBound,
  moveEdges,
  newPerLayer,
  playEdges,
  positionText,
  resetGrowth,
  rootOf,
  startVector,
  totalOf,
  totalText,
  unitSeeds,
  vertexIndex,
  visibleEdges,
  type GardenSpec,
  type Grown,
  type Vector,
} from '../../../src/components/tools/t02/garden';
import { followStopMessage, layersGrownText, stopMessage } from '../../../src/components/tools/t02/limits';
import { gardenLayersBound, gardenTotal } from '../../../src/components/tools/t02/phase2';
import { layeredEntries, positiveView } from '../../../src/components/tools/t02/poset';
import { extendPlay, followStart, followStep, moveMade } from '../../../src/components/tools/t02/follow';
import { exactText, shortNumber, vertexText } from '../../../src/components/tools/t02/numbers';
import { PICKER_TYPES, PRESETS, pickedState, pickerGroups, presetOf } from '../../../src/components/tools/t02/presets';
import { drawGarden, nextVertex } from '../../../src/components/tools/t02/drawing';
import registryEntry from '../../../src/tools/registry/T02';
import { encodeBoard } from '../../../src/lib/urlCodec';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

/** A short key of this checkout, so that concurrent worktrees never share a compile cache (MERGE, P2 stage 2.1). */
function checkoutKey(): string {
  return createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8);
}
import { join } from 'node:path';

interface TypeRecord {
  n_roots: number;
  positive_roots?: number[][];
}
interface LayerGrowth {
  label: string;
  cartan: number[][];
  layers: number;
  root_populations_found: number;
  new_per_layer: number[];
  largest_entry_digits: number;
  stop_at_2000: { positions: number; truncated: boolean; complete_layers: number; positions_in_complete_layers: number };
}
const TYPES = (golden as unknown as { types: Record<string, TypeRecord> }).types;
const GROWTH = (golden as unknown as { layer_growth_examples: LayerGrowth[] }).layer_growth_examples;
const growthOf = (label: string): LayerGrowth => {
  const found = GROWTH.filter((g) => g.label === label);
  expect(found.length).toBe(1);
  return found[0]!;
};

const named = (name: string): AnyBoard => boardFromName(name);
const rootsSpec = (board: AnyBoard): GardenSpec => ({ board, grows: 'roots', game: 'mutation' });

/** Grows a garden in `explore` exactly as the tool does: one layer per press until the button stops. */
function growFully(spec: GardenSpec, bound: number | undefined): Grown {
  let layers = 0;
  let g = grow(spec, layers);
  while (canGrow(g.graph, layers, bound)) {
    layers++;
    g = grow(spec, layers);
  }
  return g;
}

const toNumberEntries = (board: AnyBoard, v: Vector): number[] => entriesInLabelOrder(board, v).map(Number);

describe('T2 acceptance (SPEC 4 T2)', () => {
  it('roots mode finds 12, 24, 72, 126, 240 root populations on A3, D4, E6, E7, E8', () => {
    for (const name of ['A3', 'D4', 'E6', 'E7', 'E8']) {
      const board = named(name);
      const g = growFully(rootsSpec(board), layersBound(board));
      expect(g.graph.items.length, name).toBe(TYPES[name]!.n_roots);
      expect(g.graph.truncated).toBe(false);
    }
  });

  it('roots mode finds n_roots on every other type', () => {
    expect(Object.keys(TYPES)).toHaveLength(32);
    for (const name of Object.keys(TYPES)) {
      const board = named(name);
      const g = growFully(rootsSpec(board), layersBound(board));
      expect(g.graph.items.length, name).toBe(TYPES[name]!.n_roots);
      // Same items in the same order as the engine's roots (seed order, E-5).
      const r = roots(board as Board<unknown>, CAPS.gardenPositions);
      expect(g.graph.items.map((v) => keyOf(board, v))).toEqual(r.items.map((v) => keyOf(board, v)));
    }
  });

  it('the layered positive roots of A4, B3, G2 equal positive_roots', () => {
    for (const name of ['A4', 'B3', 'G2']) {
      const board = named(name);
      const g = growFully(rootsSpec(board), layersBound(board));
      const view = positiveView(board, g.maxDepth);
      const layered = layeredEntries(board, view);
      const flat = layered.flat().map((v) => v.map(Number));
      expect(flat, name).toEqual(TYPES[name]!.positive_roots);
      // Each layer index is the total: layer k holds the roots of total k + 1.
      layered.forEach((layer, k) => {
        expect(view.layers[k]!.total).toBe(BigInt(k + 1));
        for (const v of layer) expect(v.map(Number).reduce((s, x) => s + x, 0)).toBe(k + 1);
      });
    }
  });

  it('the triangle grows 243 root populations in 40 layers, 6 new per layer, stopped after 40 layers', () => {
    const t = growthOf('triangle');
    const preset = PRESETS['triangle-40'];
    const board = resolveBoard(preset.state.board);
    expect(preset.state.board).toEqual({ cartan: t.cartan });
    const bound = layersBound(board, preset.options.layers);
    const g = grow(rootsSpec(board), clampLayers(preset.options.grown, bound));
    expect(g.graph.items.length).toBe(t.root_populations_found);
    expect(newPerLayer(g.graph.depth)).toEqual(t.new_per_layer);
    expect(g.graph.truncated).toBe(false);
    expect(g.graph.depthReached).toBe(t.layers);
    expect(stopMessage(g.graph, g.maxDepth, bound, CAPS.gardenPositions)).toBe('stopped after 40 layers');
    expect(canGrow(g.graph, g.maxDepth, bound)).toBe(false);
  });

  it('the star with five arms stops at 2000 positions with layers 0 to 10 complete holding 1271', () => {
    const s = growthOf('star with five arms');
    const board = resolveBoard({ cartan: s.cartan });
    const bound = layersBound(board); // 40, the default off the finite types
    expect(bound).toBe(CAPS.layersOffFinite);
    const g = growFully(rootsSpec(board), bound);
    expect(g.graph.truncated).toBe(true);
    expect(g.graph.items.length).toBe(s.stop_at_2000.positions);
    expect(g.graph.completeLayers).toBe(s.stop_at_2000.complete_layers);
    expect(g.graph.depth.filter((d) => d <= s.stop_at_2000.complete_layers).length).toBe(s.stop_at_2000.positions_in_complete_layers);
    expect(stopMessage(g.graph, g.maxDepth, bound, CAPS.gardenPositions)).toBe('stopped after 2000 positions; layers 0 to 10 are complete');
    const chart = chartLayers(g.graph);
    expect(chart.find((c) => c.layer === 11)?.complete).toBe(false);
    expect(chart.filter((c) => c.layer <= 10).every((c) => c.complete)).toBe(true);
    expect(canGrow(g.graph, g.maxDepth, bound)).toBe(false);
  });
});

describe('T2 plan tests', () => {
  it('the stop message follows SPEC 5.5', () => {
    const tri = resolveBoard({ cartan: growthOf('triangle').cartan }) as Board<unknown>;
    // The cap-9 case of verify.py line 975.
    const g9 = orbitGraph(tri, unitSeeds(tri as AnyBoard), 'mutation', 9, 40);
    expect(g9.items.length).toBe(9);
    expect(stopMessage(g9, 40, 40, 9)).toBe('stopped after 9 positions; layers 0 to 1 are complete');
    // Layer 333 of 4.0: the triangle with layers 600 at a cap of 2000.
    const g600 = orbitGraph(tri, unitSeeds(tri as AnyBoard), 'mutation', CAPS.gardenPositions, 600);
    expect(stopMessage(g600, 600, 600, CAPS.gardenPositions)).toBe('stopped after 2000 positions; layers 0 to 332 are complete');
    // A complete search says nothing.
    const a3 = growFully(rootsSpec(named('A3')), undefined);
    expect(stopMessage(a3.graph, a3.maxDepth, undefined, CAPS.gardenPositions)).toBeNull();
    // A pause in explore below the bound says nothing; the layers grown are shown instead.
    const pause = grow(rootsSpec(tri as AnyBoard), 3);
    expect(stopMessage(pause.graph, 3, 40, CAPS.gardenPositions)).toBeNull();
    expect(layersGrownText(3)).toBe('3 layers grown');
    // E8 numbers from all ones at a cap of 2000 is cut with 2000 positions.
    const e8 = named('E8');
    const ones = startVector(e8, Array.from({ length: 8 }, () => 1));
    const ge8 = grow({ board: ones.board, grows: 'orbit', seed: ones.v, game: 'firing' }, undefined);
    expect(ge8.graph.truncated).toBe(true);
    expect(ge8.graph.items.length).toBe(CAPS.gardenPositions);
    expect(stopMessage(ge8.graph, undefined, undefined, CAPS.gardenPositions)).toMatch(/^stopped after 2000 positions; layers 0 to \d+ are complete$/);
    // follow at the bound.
    expect(followStopMessage(CAPS.gardenPositions, CAPS.gardenPositions)).toBe('stopped after 2000 positions');
    expect(followStopMessage(5, CAPS.gardenPositions)).toBeNull();
    // Never "not of finite type" from a cap.
    for (const m of [stopMessage(g9, 40, 40, 9), stopMessage(g600, 600, 600, 2000)]) expect(m).not.toMatch(/finite|affine|indefinite|infinite/);
  });

  it("the counter's total", () => {
    const a3 = named('A3');
    expect(totalOf(rootsSpec(a3), undefined)).toEqual({ kind: 'number', value: resolveGoldenPath('types.A3.n_roots') });
    const orbitSpec = (board: AnyBoard, start: number[], coords: 'populations' | 'numbers'): GardenSpec => {
      const s = startVector(board, start);
      return { board: s.board, grows: 'orbit', seed: s.v, game: gameOf('orbit', coords) };
    };
    // M4: the orbit of (1, 0) in the numbers game of A2 has 3 positions.
    expect(totalOf(orbitSpec(named('A2'), [1, 0], 'numbers'), undefined)).toEqual({ kind: 'number', value: 3 });
    // M6: the orbit of (1, 0) in the populations of B2 is 4, while roots mode gives 8.
    expect(totalOf(orbitSpec(named('B2'), [1, 0], 'populations'), undefined)).toEqual({ kind: 'number', value: 4 });
    expect(totalOf(rootsSpec(named('B2')), undefined)).toEqual({ kind: 'number', value: resolveGoldenPath('types.B2.n_roots') });
    // A3 numbers from (1, 1, 1): 24 positions.
    expect(totalOf(orbitSpec(a3, [1, 1, 1], 'numbers'), undefined)).toEqual({ kind: 'number', value: 24 });
    // E8 numbers from all ones: exactly "more than 2000".
    const e8 = totalOf(orbitSpec(named('E8'), Array.from({ length: 8 }, () => 1), 'numbers'), undefined);
    expect(e8).toEqual({ kind: 'more', text: 'more than 2000' });
    expect(totalText(e8)).toBe('more than 2000');
    expect(MORE_THAN).toBe(`more than ${CAPS.gardenPositions}`);
    // Roots mode on the triangle: no total.
    const tri = resolveBoard({ cartan: growthOf('triangle').cartan });
    expect(totalOf(rootsSpec(tri), layersBound(tri))).toEqual({ kind: 'none' });
    // The orbit of (1, 0, 0) in the populations of the triangle stops at 40 layers below 2000: no total.
    const triOrbit = totalOf(orbitSpec(tri, [1, 0, 0], 'populations'), layersBound(tri));
    expect(triOrbit).toEqual({ kind: 'none' });
    expect(totalText(triOrbit)).not.toContain('more than');
  });

  it('40 layers complete the root set of every type', () => {
    const preset = PRESETS['positive-roots'];
    expect(preset.options.grown).toBe(CAPS.layersOffFinite);
    expect(preset.options.positiveOnly).toBe(true);
    for (const name of Object.keys(TYPES)) {
      const board = named(name);
      const g = grow(rootsSpec(board), clampLayers(preset.options.grown, layersBound(board)));
      expect(g.graph.items.length, name).toBe(TYPES[name]!.n_roots);
      expect(g.graph.depthReached).toBeLessThan(CAPS.layersOffFinite);
      if (TYPES[name]!.positive_roots) {
        expect(positiveView(board, g.maxDepth).vertices.map((v) => toNumberEntries(board, v))).toEqual(TYPES[name]!.positive_roots);
      }
    }
  });

  it('the poset edges', () => {
    // Simply laced: every rise is 1 and the edges are exactly the pairs p, p + e_i of positive roots.
    for (const name of ['A3', 'A4', 'D4', 'E6', 'E7', 'E8']) {
      const board = named(name);
      const view = positiveView(board, undefined);
      expect(view.edges.length, name).toBeGreaterThan(0);
      expect(view.edges.every((e) => e.rise === 1n)).toBe(true);
      const keys = new Set(view.vertices.map((v) => keyOf(board, v)));
      const pairs: string[] = [];
      view.vertices.forEach((p, k) => {
        for (let i = 0; i < board.n; i++) {
          const q = p.map((x, j) => (j === i ? (x as number) + 1 : (x as number)));
          if (keys.has(keyOf(board, q))) pairs.push(`${k}>${keyOf(board, q)}`);
        }
      });
      expect(view.edges.map((e) => `${e.from}>${keyOf(board, view.vertices[e.to]!)}`).sort()).toEqual(pairs.sort());
      for (const e of view.edges) expect(keys.has(keyOf(board, view.vertices[e.to]!))).toBe(true);
    }
    // B3: exactly two rises of 2, both at city 3, from (0, 1, 0) and (1, 1, 0) (oracle).
    const b3 = named('B3');
    const vb3 = positiveView(b3, undefined);
    const twos = vb3.edges.filter((e) => e.rise !== 1n);
    expect(twos.map((e) => [e.rise, e.label, toNumberEntries(b3, vb3.vertices[e.from]!)])).toEqual([
      [2n, 3, [0, 1, 0]],
      [2n, 3, [1, 1, 0]],
    ]);
    expect(vb3.riseStyle).toBe('lines');
    // G2: exactly one rise of 3, from (0, 1) to (3, 1) at city 1.
    const g2 = named('G2');
    const vg2 = positiveView(g2, undefined);
    const big = vg2.edges.filter((e) => e.rise !== 1n);
    expect(big).toHaveLength(1);
    expect([big[0]!.rise, big[0]!.label, toNumberEntries(g2, vg2.vertices[big[0]!.from]!), toNumberEntries(g2, vg2.vertices[big[0]!.to]!)]).toEqual([3n, 1, [0, 1], [3, 1]]);
    expect(vg2.edges).toHaveLength(4);
  });

  it('every move is applied once more', () => {
    const board = named('A3');
    const g = growFully(rootsSpec(board), undefined);
    const items = g.graph.items;
    const edges = moveEdges(board, items, 'mutation');
    const expected = new Set<string>();
    items.forEach((v, h) => {
      for (let i = 0; i < board.n; i++) {
        const w = mutate(board as Board<unknown>, v, i);
        const kw = keyOf(board, w);
        if (kw === keyOf(board, v)) continue;
        const k = items.findIndex((x) => keyOf(board, x) === kw);
        if (k < 0) continue;
        expected.add(`${Math.min(h, k)}-${Math.max(h, k)}-${toLabels(board, [i])[0]}`);
      }
    });
    expect(new Set(edges.map((e) => `${e.from}-${e.to}-${e.label}`))).toEqual(expected);
    expect(edges.length).toBe(expected.size);
    // More edges than the tree that parent alone gives.
    expect(edges.length).toBeGreaterThan(items.length - board.n);
    // No self-loop is drawn.
    expect(edges.every((e) => e.from !== e.to)).toBe(true);
    // Two nodes joining the same two positions give two edges (numbers game on the board with two roads each way).
    const a1t = resolveBoard({ cartan: [[2, -2], [-2, 2]] });
    const s = startVector(a1t, [1, -1]);
    const ga = grow({ board: s.board, grows: 'orbit', seed: s.v, game: 'firing' }, 1);
    const ea = moveEdges(s.board, ga.graph.items, 'firing');
    expect(ea.filter((e) => e.from === 0 && e.to === 1).map((e) => e.label)).toEqual([1, 2]);
  });

  it('a jump replays to the vertex', () => {
    const cases: [AnyBoard, number | undefined][] = [
      [named('A3'), undefined],
      [named('B3'), undefined],
      [named('G2'), undefined],
      [resolveBoard({ cartan: growthOf('triangle').cartan }), 40],
    ];
    for (const [board, bound] of cases) {
      const g = bound === undefined ? growFully(rootsSpec(board), undefined) : grow(rootsSpec(board), bound);
      for (let k = 0; k < g.graph.items.length; k++) {
        const j = jumpTo(board, g.graph, k);
        const seed = startVector(board, j.start).v;
        expect(keyOf(board, seed)).toBe(keyOf(board, g.graph.items[rootOf(g.graph, k)]!));
        const reached = applyWord(board as Board<unknown>, seed, toPositions(board, j.moves), 'mutation');
        expect(keyOf(board, reached)).toBe(keyOf(board, g.graph.items[k]!));
        expect(j.moves.length).toBe(g.graph.depth[k]);
      }
    }
  });

  it('labels are not positions plus one', () => {
    const board = subBoard(named('A3') as Board<number>, [1, 2]) as AnyBoard;
    expect([...board.labels]).toEqual([2, 3]);
    const g = growFully(rootsSpec(board), layersBound(board, 10));
    const edges = moveEdges(board, g.graph.items, 'mutation');
    expect(new Set(edges.map((e) => e.label))).toEqual(new Set([2, 3]));
    for (let k = 0; k < g.graph.items.length; k++) {
      for (const label of jumpTo(board, g.graph, k).moves) expect([2, 3]).toContain(label);
    }
    const view = positiveView(board, g.maxDepth);
    expect(new Set(view.edges.map((e) => e.label))).toEqual(new Set([2, 3]));
  });

  it('long entries are shortened', () => {
    const t = growthOf('three roads each way');
    const board = resolveBoard({ cartan: t.cartan });
    const g = grow(rootsSpec(board), layersBound(board));
    const texts = g.graph.items.map((v) => entriesInLabelOrder(board, v));
    const digits = Math.max(...texts.flat().map((x) => x.replace(/^-/, '').length));
    expect(digits).toBe(t.largest_entry_digits);
    const longest = texts.find((v) => v.some((x) => x.replace(/^-/, '').length === digits))!;
    const entry = longest.find((x) => x.replace(/^-/, '').length === digits)!;
    const shown = vertexText(longest);
    const plain = entry.replace(/^-/, '');
    const expectedShort = `${entry.startsWith('-') ? '−' : ''}${plain[0]}.${plain.slice(1, 5)}... x 10^${digits - 1} (${digits} digits)`;
    expect(shown).toContain(expectedShort);
    expect(shown).not.toContain(plain);
    expect(exactText(longest)).toContain(plain);
    expect(shortNumber('123456789012')).toBe('123456789012');
    expect(shortNumber('-1234567890123')).toBe('−1.2345... x 10^12 (13 digits)');
    expect(shortNumber('-5')).toBe('−5');
  });

  it('follow adds a vertex per new position', () => {
    const board = named('A2');
    const start = startVector(board, [1, 0]).v;
    let m = followStart(board, start, 'mutation', undefined);
    expect(m.items).toHaveLength(1);
    const p1 = mutate(board as Board<unknown>, start, 1); // city 2
    m = followStep(m, board, start, p1, 1);
    expect(m.items).toHaveLength(2);
    expect(m.edges.map((e) => e.label)).toEqual([2]);
    // A revisit (mutating city 2 again) adds no vertex and no second edge.
    const back = mutate(board as Board<unknown>, p1, 1);
    const same = followStep(m, board, p1, back, 1);
    expect(same.items).toHaveLength(2);
    expect(same.edges).toHaveLength(1);
    // Undo, redo and scrubs (no move) add nothing.
    expect(followStep(m, board, p1, start, null)).toBe(m);
    // Visit all six root populations of A2.
    let v = start;
    let model = followStart(board, start, 'mutation', undefined);
    for (const i of [1, 0, 1, 0, 1, 0]) {
      const w = mutate(board as Board<unknown>, v, i);
      model = followStep(model, board, v, w, i);
      v = w;
    }
    expect(model.items).toHaveLength(resolveGoldenPath('types.A2.n_roots') as number);
    // moveMade tells a move from an undo.
    expect(moveMade([2, 1], [2, 1, 2])).toBe(2);
    expect(moveMade([2, 1], [2])).toBeNull();
    expect(moveMade([2, 1], [2, 2])).toBe(2);
    expect(moveMade([2, 1], [])).toBeNull();
  });

  it('every call stays on the main thread', () => {
    for (const board of [named('E8'), resolveBoard({ cartan: growthOf('star with five arms').cartan })]) {
      expect(whereToRun({ board, kind: 'enumeration', expectedItems: CAPS.gardenPositions })).toBe('main');
    }
    // A search past the garden's cap would not be; the garden never makes one.
    expect(whereToRun({ board: named('E8'), kind: 'enumeration', expectedItems: CAPS.gardenPositions + 1 })).toBe('worker');
  });

  it('the default states are deterministic', () => {
    for (const id of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
      const once = (): unknown => {
        const p = PRESETS[id];
        const board = resolveBoard(p.state.board);
        const bound = layersBound(board, p.options.layers);
        const g = grow(rootsSpec(board), clampLayers(p.options.grown, bound));
        const keys = g.graph.items.map((v) => keyOf(board, v));
        const edges = moveEdges(board, g.graph.items, 'mutation');
        const layout = drawGarden({
          keys,
          rank: g.graph.depth,
          edges: edges.map((e) => [e.from, e.to] as const),
          texts: g.graph.items.map((v) => vertexText(entriesInLabelOrder(board, v))),
          labelled: true,
        });
        return { keys, edges, layout };
      };
      expect(once()).toEqual(once());
    }
  });

  it('the M6 configuration shows 8 on B2', () => {
    const b2 = named('B2');
    const g = grow(rootsSpec(b2), clampLayers(2, layersBound(b2)));
    expect(g.graph.items.length).toBe(8);
    expect(g.graph.truncated).toBe(false);
    expect(stopMessage(g.graph, g.maxDepth, layersBound(b2), CAPS.gardenPositions)).toBeNull();
    // follow from (1, 0), fed every state reachable from it, holds only the 4 positions of its orbit.
    const start = startVector(b2, [1, 0]).v;
    let model = followStart(b2, start, 'mutation', undefined);
    const orbit = orbitGraph(b2 as Board<unknown>, [start], 'mutation', CAPS.gardenPositions);
    for (let k = 1; k < orbit.items.length; k++) {
      model = followStep(model, b2, orbit.items[orbit.parent[k]!]!, orbit.items[k]!, orbit.node[k]!);
    }
    for (const v of orbit.items) for (let i = 0; i < 2; i++) model = followStep(model, b2, v, mutate(b2 as Board<unknown>, v, i), i);
    expect(model.items).toHaveLength(4);
  });

  it('reset regrows the garden', () => {
    const a3 = named('A3');
    const r0 = resetGrowth('explore', PRESETS.default.options.grown, layersBound(a3));
    expect(r0.moves).toEqual([]);
    expect(grow(rootsSpec(a3), r0.layers).graph.items).toHaveLength(3);
    const tri = resolveBoard(PRESETS['triangle-40'].state.board);
    const bound = layersBound(tri, PRESETS['triangle-40'].options.layers);
    const r40 = resetGrowth('explore', PRESETS['triangle-40'].options.grown, bound);
    expect(grow(rootsSpec(tri), r40.layers).graph.items).toHaveLength(growthOf('triangle').root_populations_found);
    expect(resetGrowth('follow', 40, bound)).toEqual({ layers: 0, moves: [] });
    // grown above the bound is clamped.
    expect(clampLayers(100, 40)).toBe(40);
  });

  it('the highlight follows hover and focus', () => {
    const a3 = named('A3');
    const v = startVector(a3, [1, -1, 0]).v;
    expect(highlightFor(a3, 'A3', 'roots', v)).toEqual({ kind: 'root', board: 'A3', value: [1, -1, 0] });
    expect(highlightFor(a3, 'A3', 'orbit', v)).toEqual({ kind: 'position', board: 'A3', value: [1, -1, 0] });
    expect(highlightFor(a3, 'A3', 'roots', null)).toBeNull();
    const spec = { cartan: growthOf('triangle').cartan };
    const tri = resolveBoard(spec);
    expect(highlightFor(tri, encodeBoard(spec), 'roots', startVector(tri, [0, 1, 0]).v)).toEqual({ kind: 'root', board: 'c:2,-1,-1;-1,2,-1;-1,-1,2', value: [0, 1, 0] });
    const huge = startVector(tri, ['90071992547409930', '0', '0']).v;
    expect(highlightFor(tri, 'c:...', 'roots', huge)).toBeNull();
  });

  it('the picker offers 32 types or boardChoices', () => {
    expect([...PICKER_TYPES]).toEqual(Object.keys(TYPES));
    const groups = pickerGroups();
    expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(groups.flatMap((g) => g.names)).toEqual(Object.keys(TYPES));
    expect(pickerGroups(['A3', 'D4', 'E8']).flatMap((g) => g.names)).toEqual(['A3', 'D4', 'E8']);
    const changed = pickedState({ ...PRESETS.default.state, moves: [1, 2] }, 'D4');
    expect(changed).toEqual({ schema: 1, tool: 'garden', board: 'D4', coords: 'populations', start: [1, 0, 0, 0], moves: [] });
    const d4 = resolveBoard(changed.board);
    expect(grow(rootsSpec(d4), clampLayers(PRESETS.default.options.grown, layersBound(d4))).graph.items).toHaveLength(4);
  });

  it('the rise is written on edges off the finite types', () => {
    const custom = resolveBoard({ cartan: [[2, -1], [-2, 2]] });
    expect(isNamedFinite(custom)).toBe(false);
    const g = growFully(rootsSpec(custom), layersBound(custom));
    const view = positiveView(custom, g.maxDepth);
    expect(view.vertices.map((v) => toNumberEntries(custom, v))).toEqual([[0, 1], [1, 0], [1, 1], [1, 2]]);
    expect(view.riseStyle).toBe('numeral');
    expect(view.edges.map((e) => [toNumberEntries(custom, view.vertices[e.from]!), toNumberEntries(custom, view.vertices[e.to]!), e.label, e.rise])).toEqual([
      [[0, 1], [1, 1], 1, 1n],
      [[1, 0], [1, 2], 2, 2n],
    ]);
    const b2 = named('B2');
    const vb = positiveView(b2, undefined);
    expect(vb.riseStyle).toBe('lines');
    expect(vb.edges.map((e) => e.rise)).toEqual([1n, 2n]);
  });

  it('above 300 only the focused and played edges are drawn', () => {
    const board = resolveBoard({ cartan: growthOf('star with five arms').cartan });
    const g = growFully(rootsSpec(board), layersBound(board));
    const items = g.graph.items;
    expect(items.length).toBeGreaterThan(CAPS.gardenDrawEverything);
    const index = vertexIndex(board, items);
    const edges = moveEdges(board, items, 'mutation', index);
    expect(visibleEdges(edges, items.length, null, [])).toEqual([]);
    const focused = 7;
    const atFocus = visibleEdges(edges, items.length, focused, []);
    expect(atFocus.length).toBeGreaterThan(0);
    expect(atFocus.map((k) => edges[k]!)).toEqual(edges.filter((e) => e.from === focused || e.to === focused));
    // A play of two moves from the first seed.
    const p0 = items[0]!;
    const p1 = mutate(board as Board<unknown>, p0, 1);
    const p2 = mutate(board as Board<unknown>, p1, 0);
    const along = playEdges(edges, index, [p0, p1, p2].map((v) => keyOf(board, v)), toLabels(board, [1, 0]));
    expect(along).toHaveLength(2);
    expect(visibleEdges(edges, items.length, null, along)).toEqual(along);
    // Up to 300 positions every edge is drawn.
    const a3 = named('A3');
    const ga = growFully(rootsSpec(a3), undefined);
    const ea = moveEdges(a3, ga.graph.items, 'mutation');
    expect(visibleEdges(ea, ga.graph.items.length, null, [])).toHaveLength(ea.length);
  });

  it('the registry entry carries the presets of CONTRACTS 6 and the vertex keyboard model reaches every vertex', () => {
    expect(registryEntry.id).toBe('garden');
    expect(registryEntry.number).toBe(2);
    expect(Object.keys(registryEntry.presets).sort()).toEqual(['default', 'explore', 'follow', 'positive-roots', 'triangle-40']);
    expect(registryEntry.presets.default.caption).toContain(String(resolveGoldenPath('types.A3.n_roots')));
    expect(registryEntry.presets['triangle-40']!.caption).toContain(String(growthOf('triangle').root_populations_found));
    expect(presetOf('nonsense')).toBe(PRESETS.default);
    // Keyboard: from vertex 0, arrows reach every vertex of the A3 garden.
    const a3 = named('A3');
    const g = growFully(rootsSpec(a3), undefined);
    const layout = drawGarden({
      keys: g.graph.items.map((v) => keyOf(a3, v)),
      rank: g.graph.depth,
      edges: [],
      texts: g.graph.items.map((v) => positionText(a3, v)),
      labelled: true,
    });
    const seen = new Set<number>([0]);
    const queue = [0];
    while (queue.length) {
      const v = queue.shift()!;
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'] as const) {
        const w = nextVertex(layout, v, key, g.graph.items.length);
        if (!seen.has(w)) {
          seen.add(w);
          queue.push(w);
        }
      }
    }
    expect(seen.size).toBe(g.graph.items.length);
    // Targets: at least 44 by 44 with labels, 24 by 24 as dots, and no two overlap.
    expect(layout.w).toBeGreaterThanOrEqual(44);
    expect(layout.h).toBeGreaterThanOrEqual(44);
    for (let a = 0; a < layout.cx.length; a++) {
      for (let b = a + 1; b < layout.cx.length; b++) {
        const apart = Math.abs(layout.cx[a]! - layout.cx[b]!) >= layout.w || Math.abs(layout.cy[a]! - layout.cy[b]!) >= layout.h;
        expect(apart).toBe(true);
      }
    }
  });
});

// The server render through Vite with the Svelte plugin, as P1-A2's _svelteSsr.ts does, plus the
// path aliases of CONTRACTS 1 that Board.svelte imports by (tsconfigPaths does not reach .svelte files).
const SITE = fileURLToPath(new URL('../../../', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
interface Loader {
  render(component: unknown, props: Record<string, unknown>): string;
  close(): Promise<void>;
}
async function gardenLoader(): Promise<{ loader: Loader; Garden: unknown }> {
  const server: ViteDevServer = await createServer({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-ssr-t02-cache-' + checkoutKey()),
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [svelte({ configFile: false })],
    resolve: {
      alias: {
        '@engine': join(ROOT, 'packages/engine/src/index.ts'),
        '@components': join(SITE, 'src/components'),
        '@lib': join(SITE, 'src/lib'),
      },
    },
  });
  const sv = (await server.ssrLoadModule('svelte/server')) as { render: (c: unknown, o: { props: unknown }) => { body: string } };
  const mod = (await server.ssrLoadModule('/src/components/tools/T02OrbitGarden.svelte')) as { default: unknown };
  return {
    loader: { render: (c, props) => sv.render(c, { props }).body, close: () => server.close() },
    Garden: mod.default,
  };
}

describe('T2 server render', () => {
  let loader: Loader;
  let Garden: unknown;
  beforeAll(async () => {
    ({ loader, Garden } = await gardenLoader());
  }, 120000);
  afterAll(async () => {
    await loader?.close();
  });
  const outText = (html: string, name: string): string | null => {
    const m = new RegExp(`data-out="${name}"[^>]*>([^<]*)<`).exec(html);
    return m === null ? null : m[1]!;
  };

  it('the triangle-40 preset renders 243 and its message on the server', () => {
    const html = loader.render(Garden, { id: 'b1', preset: 'triangle-40', caption: PRESETS['triangle-40'].caption });
    expect(outText(html, 'found')).toBe(String(growthOf('triangle').root_populations_found));
    expect(outText(html, 'stopMessage')).toBe('stopped after 40 layers');
    expect((html.match(/data-out="vertex"/g) ?? []).length).toBe(growthOf('triangle').root_populations_found);
    expect(html).not.toMatch(/not of finite type/);
  });

  it('the default renders the three seeds, found 3 and the chart, with every control disabled', () => {
    const html = loader.render(Garden, { id: '', preset: 'default', caption: PRESETS.default.caption });
    expect(outText(html, 'found')).toBe('3');
    expect((html.match(/data-out="vertex"/g) ?? []).length).toBe(3);
    expect(html).toContain('data-out="layerChart"');
    expect(outText(html, 'total')).toBe('');
    const grow_ = /<button[^>]*data-control="grow"[^>]*>/.exec(html)?.[0] ?? '';
    expect(grow_).not.toBe('');
  });
});

describe('regressions', () => {
  // SPEC.md 4 T2 Interactions: "In `orbit` mode the total is known when the enumeration completes within
  // the garden's bound; otherwise the counter says "more than 2000", and from phase 3 on a finite-type
  // board it gives the exact size from `orbitSize`." Expected values from the engine's own orbitSize,
  // which equals the oracle's orbit_size(C, -end) (the oracle gives orbit_size(cartan('A', 6), (1,)*6) =
  // 5040, orbit_size(cartan('B', 5), (1,)*5) = 3840, orbit_size(cartan('E', 6), (1,)*6) = 51840, and for
  // the A6 population (2, 1, 5, 1, 3, 8), whose numbers are (3, -5, 8, -6, -3, 13), orbit_size(C, -end) =
  // 2520; orbitSize gives the same four values).
  describe('T2 orbit counter on finite-type boards (phase 3: the exact size from orbitSize)', () => {
    const cases: [string, number[], 'firing' | 'mutation', number][] = [
      ['A6', [1, 1, 1, 1, 1, 1], 'firing', 5040], // the orbit of rho: |W(A6)|
      ['B5', [1, 1, 1, 1, 1], 'firing', 3840], // |W(B5)|
      ['E6', [1, 1, 1, 1, 1, 1], 'firing', 51840], // |W(E6)|
      ['A6', [2, 1, 5, 1, 3, 8], 'mutation', 2520], // a population of A6 in the mutation game
    ];
    for (const [name, seed, game, oracle] of cases) {
      // regression: P3-RT-01-02
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

  // The same rule on the fundamental weights (golden types.E8.fundamental_orbit_sizes and
  // types.E7.fundamental_orbit_sizes). The component computes the total with gardenTotal
  // (T02OrbitGarden.svelte, the `total` derived value and revealTotal).
  describe('T2 orbit total on a finite-type board above the garden bound (phase 3: orbitSize)', () => {
    const goldenTypes = (golden as unknown as { types: Record<string, { fundamental_orbit_sizes: number[] }> }).types;
    /** The fundamental weight of the node with Bourbaki label k (positions follow Bourbaki on named boards). */
    function omega(board: AnyBoard, k: number): number[] {
      return Array.from({ length: board.n }, (_, i) => (i === k - 1 ? 1 : 0));
    }
    for (const [name, node] of [['E8', 1], ['E7', 3], ['E7', 5]] as const) {
      // regression: P3-RT-06-01
      it(`${name}, orbit of the fundamental weight of node ${node}`, () => {
        const board = boardFromName(name);
        const expected = goldenTypes[name]!.fundamental_orbit_sizes[node - 1]!;
        expect(expected).toBeGreaterThan(2000);
        expect(orbitSize(board, omega(board, node))).toBe(expected);
        const spec = { board, grows: 'orbit' as const, seed: omega(board, node), game: 'firing' as const };
        const total = gardenTotal(spec, gardenLayersBound(board));
        expect(total, `${name} node ${node}: the counter's total`).toEqual({ kind: 'number', value: expected });
      });
    }
  });

  // The same fix, where orbitSize cannot answer: on A20 (a named board a link may give) the order of the
  // group, 21!, is beyond the safe integers, so orbitSize throws EngineOverflow and the counter says what
  // the bounded search says (decisions/RT-FIX-P3-garden-follow.md).
  it('the orbit total falls back to the bounded search when orbitSize overflows', () => {
    const board = boardFromName('A20');
    const ones = Array.from({ length: 20 }, () => 1);
    expect(() => orbitSize(board, ones)).toThrow(EngineOverflow);
    expect(gardenTotal({ board, grows: 'orbit', seed: ones, game: 'firing' }, gardenLayersBound(board))).toEqual({ kind: 'more', text: MORE_THAN });
    // The orbit of the fundamental weight of node 1 has 21 positions, which the bounded search completes.
    const omega1 = Array.from({ length: 20 }, (_, k) => (k === 0 ? 1 : 0));
    expect(gardenTotal({ board, grows: 'orbit', seed: omega1, game: 'firing' }, gardenLayersBound(board))).toEqual({ kind: 'number', value: 21 });
  });

  // SPEC 7.4: "While a tool runs it keeps the list of positions of the current play in memory and
  // extends it by one position per move, so a move costs one engine call however long the play is."
  // The garden following a T1 replayed the whole play from the start on every state the T1 published;
  // it now extends the positions it holds (extendPlay, called from the followToolState callback).
  // regression: P3-RT-04-04
  it('a follower extends the play it holds: one engine call per new move, none for an undo', () => {
    const board = named('A2');
    const start = startVector(board, [1, 0]).v;
    let calls = 0;
    const apply = (v: Vector, label: number): Vector => {
      calls++;
      return mutate(board as Board<unknown>, v, toPositions(board, [label])[0]!);
    };
    const long = Array.from({ length: 20000 }, (_, k) => (k % 2) + 1);
    const held = extendPlay([start], [], long, apply);
    expect(calls).toBe(long.length);
    expect(held).toHaveLength(long.length + 1);
    expect(keyOf(board, held[long.length]!)).toBe(keyOf(board, applyWord(board as Board<unknown>, start, toPositions(board, long), 'mutation')));
    // One more move: one engine call, every position held kept.
    calls = 0;
    const next = extendPlay(held, long, [...long, 1], apply);
    expect(calls).toBe(1);
    expect(next).toHaveLength(long.length + 2);
    for (const k of [0, 1, 9999, long.length]) expect(next[k]).toBe(held[k]);
    expect(keyOf(board, next[long.length + 1]!)).toBe(keyOf(board, mutate(board as Board<unknown>, held[long.length]!, 0)));
    // An undo: no engine call.
    calls = 0;
    const undo = extendPlay(next, [...long, 1], long, apply);
    expect(calls).toBe(0);
    expect(undo).toHaveLength(long.length + 1);
    // A different last move: the shared moves are kept and only the moves after them are applied.
    calls = 0;
    const changed = extendPlay(next, [...long, 1], [...long.slice(0, -1), 1, 2], apply);
    expect(calls).toBe(2);
    expect(changed[long.length - 1]).toBe(held[long.length - 1]);
    // The held list is not changed.
    expect(held).toHaveLength(long.length + 1);
  });
});
