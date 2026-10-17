// The presets of T2 (SPEC.md 4.0 Configuration; CONTRACTS.md 6: follow, explore, positive-roots,
// triangle-40, plus default) and the board picker (4.0 Board pickers). Each preset is a state object
// (the link part) plus the options that 6.6 keeps out of a schema-1 link (growth mode, what grows,
// grown, layers, positive roots only, vertex labels, board choices). Numbers in captions are computed
// by the engine when the module loads, never typed (COMMON 4.4).
import { CAPS, boardFromName, orbitGraph, positiveRoots, roots } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import { resolveBoard, type BoardSpec, type ToolState } from '../../../lib/state';
import type { Grows, Growth } from './garden';
import { newPerLayer, unitSeeds } from './garden';

export interface GardenOptions {
  grows: Grows;
  growth: Growth;
  /** Layers grown when the page loads (SPEC 4 T2; default 0), computed at build time. */
  grown: number;
  /** The layers bound (4.0); undefined: 40 off the finite types, none on a named finite board. */
  layers?: number;
  positiveOnly: boolean;
  vertexLabels: boolean;
  /** Limits the picker (M1 row 4); undefined: the 32 types grouped by letter. */
  boardChoices?: string[];
}

export type GardenPresetId = 'default' | 'follow' | 'explore' | 'positive-roots' | 'triangle-40';

export interface GardenPreset {
  state: ToolState;
  options: GardenOptions;
  caption: string;
}

/** The triangle of M1 beat 5 and layer_growth_examples, as a custom board (labels 1, 2, 3). */
export const TRIANGLE: { cartan: number[][] } = { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] };

const BASE_OPTIONS: GardenOptions = { grows: 'roots', growth: 'explore', grown: 0, positiveOnly: false, vertexLabels: true };

function gardenState(board: BoardSpec, start: number[]): ToolState {
  return { schema: 1, tool: 'garden', board, coords: 'populations', start, moves: [] };
}

function rootCount(name: string): number {
  return roots(boardFromName(name) as Board<unknown>, CAPS.gardenPositions).items.length;
}

const A3_ROOTS = rootCount('A3');
const A2_ROOTS = rootCount('A2');
const A3_POSITIVE = positiveRoots(boardFromName('A3') as Board<unknown>, CAPS.gardenPositions).length;
const TRIANGLE_GROWTH = (() => {
  const tri = resolveBoard(TRIANGLE);
  const g = orbitGraph(tri as Board<unknown>, unitSeeds(tri), 'mutation', CAPS.gardenPositions, CAPS.layersOffFinite);
  const perLayer = newPerLayer(g.depth);
  return { found: g.items.length, lastNew: perLayer[perLayer.length - 1]! };
})();

const L = CAPS.layersOffFinite;

export const PRESETS: Record<GardenPresetId, GardenPreset> = {
  default: {
    state: gardenState('A3', [1, 0, 0]),
    options: { ...BASE_OPTIONS },
    caption: `Grown layer by layer from the single Martians, the garden of A3 reaches all ${A3_ROOTS} root populations and then stops growing.`,
  },
  explore: {
    state: gardenState('A3', [1, 0, 0]),
    options: { ...BASE_OPTIONS },
    caption: `Press Grow one layer until the garden stops: on A3 it holds all ${A3_ROOTS} root populations.`,
  },
  'positive-roots': {
    state: gardenState('A3', [1, 0, 0]),
    options: { ...BASE_OPTIONS, grown: L, positiveOnly: true },
    caption: `The ${A3_POSITIVE} positive root populations of A3, arranged by total population, with an edge for every mutation that raises a city: the root poset.`,
  },
  follow: {
    state: gardenState('A2', [1, 0]),
    options: { ...BASE_OPTIONS, growth: 'follow' },
    caption: `Every population the board visits from (1, 0) appears here; on A2 there are ${A2_ROOTS} of them, the root populations.`,
  },
  'triangle-40': {
    state: gardenState(TRIANGLE, [1, 0, 0]),
    options: { ...BASE_OPTIONS, grown: L, layers: L },
    caption: `On the triangle, ${L} layers hold ${TRIANGLE_GROWTH.found} root populations, ${TRIANGLE_GROWTH.lastNew} new ones in each layer after the first, and the garden is still growing.`,
  },
};

export function presetOf(id: string | undefined): GardenPreset {
  return id !== undefined && id in PRESETS ? PRESETS[id as GardenPresetId] : PRESETS.default;
}

// ---------------------------------------------------------------------------------------------
// The picker (4.0: "A tool whose description names no particular boards offers the 32 named types,
// grouped by letter"). The 32 names of golden_data.json `types`, in its order; a unit test compares.
// ---------------------------------------------------------------------------------------------

function range(letter: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, k) => `${letter}${from + k}`);
}

export const PICKER_TYPES: readonly string[] = [
  ...range('A', 1, 8),
  ...range('B', 2, 8),
  ...range('C', 2, 8),
  ...range('D', 4, 8),
  'E6', 'E7', 'E8', 'F4', 'G2',
];

/** A picker change (4.0): the new board, with `start` and `moves` reset to the defaults for it. */
export function pickedState(state: ToolState, name: string): ToolState {
  const board = resolveBoard(name);
  const coords = state.coords ?? 'populations';
  const start = coords === 'numbers' ? Array.from({ length: board.n }, () => 1) : Array.from({ length: board.n }, (_, k) => (k === 0 ? 1 : 0));
  return { schema: 1, tool: 'garden', board: name, coords, start, moves: [] };
}

/** The picker's groups: the 32 types by letter, or exactly `boardChoices` when the page limits it. */
export function pickerGroups(boardChoices?: readonly string[]): { letter: string; names: string[] }[] {
  const names = boardChoices ?? PICKER_TYPES;
  const groups: { letter: string; names: string[] }[] = [];
  for (const name of names) {
    const letter = name.charAt(0);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.letter === letter) last.names.push(name);
    else groups.push({ letter, names: [name] });
  }
  return groups;
}
