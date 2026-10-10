// P1-A2: the tool registry (CONTRACTS.md 5.2 and 6; SPEC.md 4.0 Configuration, 7.3) and the routes
// /tools/<id> generated from it.
import { describe, expect, it } from 'vitest';
import { collectRegistry, registry, toolRoutes, boardsOffered, toolById } from '../../src/tools/index';
import type { ToolRegistryEntry } from '../../src/tools/types';
import { TOOL_IDS } from '../../src/lib/state';

/** CONTRACTS 6: the preset ids of each tool besides `default`, which every tool has (SPEC 4.0). */
const PRESET_IDS: Record<string, readonly string[]> = {
  board: [],
  garden: ['follow', 'explore', 'positive-roots', 'triangle-40'],
  form: ['meter', 'builder', 'small-values'],
  lab: ['default', 'verdict', 'hunter'],
  numbers: ['compared', 'tally', 'wave', 'dimension'],
  mirror: ['default'],
  symbolic: ['default'],
  weyl: ['default', 'counter', 'heap'],
  kostant: ['default'],
  geometry: ['root-polytope', 'rings', 'face-table', 'two-graphs', 'make-uniform', 'showpiece', 'coxeter-plane'],
  fold: ['fold', 'average', 'golden'],
  rep: ['string-viewer', 'default', 'relation-checker', 'signed-move', 'one-zero-weight'],
  satake: ['default', 'play-theta', 'shadows', 'lights', 'data', 'restricted', 'catalogue', 'tau-on-black'],
  atlas: [],
  affine: ['frozen', 'marks-comarks', 'pentagon', 'three-fates'],
  sandbox: ['default'],
};

/** The registry shape, as GATE would check it: throws on the first problem. */
function checkRegistry(entries: readonly ToolRegistryEntry[]): void {
  const sorted = collectRegistry(entries); // ids, duplicates, default preset with a caption
  for (const e of sorted) {
    expect(TOOL_IDS).toContain(e.id);
    expect(Number.isInteger(e.number) && e.number >= 1 && e.number <= 16).toBe(true);
    expect(TOOL_IDS[e.number - 1]).toBe(e.id); // the number of the table at the head of SPEC 4
    expect(typeof e.title).toBe('string');
    expect(e.boards === 'all' || (Array.isArray(e.boards) && e.boards.length > 0)).toBe(true);
    expect(Array.isArray(e.outs)).toBe(true);
    expect(typeof e.component).toBe('function');
    for (const id of Object.keys(e.presets)) {
      if (id === 'default') continue;
      if (!PRESET_IDS[e.id]!.includes(id)) throw new Error(`preset ${id} is not listed for ${e.id} in CONTRACTS 6`);
    }
    for (const preset of Object.values(e.presets)) expect(typeof preset.caption).toBe('string');
  }
}

const T1_EXAMPLE = {
  number: 1, id: 'board', title: 'Game Board', phase: 1,
  boards: 'all' as 'all' | string[],
  presets: { default: { caption: 'Firing 1, 2, 1 on A2 ends the game after three moves.' } },
  outs: ['moveCounter', 'gameOver'],
  component: async () => ({ default: null }),
} satisfies ToolRegistryEntry;

const T2_ENTRY = {
  number: 2, id: 'garden', title: 'Orbit Garden', phase: 1, boards: 'all',
  presets: {
    default: { caption: 'The root populations of A3.' },
    follow: { caption: 'Follow.' },
    explore: { caption: 'Explore.' },
    'positive-roots': { caption: 'Positive roots.' },
    'triangle-40': { caption: 'Forty layers.', board: { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] } },
  },
  outs: [],
  component: async () => ({ default: null }),
} satisfies ToolRegistryEntry;

describe('registry', () => {
  it('registry shape', () => {
    checkRegistry(registry); // the registry on this branch (empty until stage 1.2)
    checkRegistry([T2_ENTRY, T1_EXAMPLE]);
    expect(collectRegistry([T2_ENTRY, T1_EXAMPLE]).map((e) => e.number)).toEqual([1, 2]);
    // An unlisted preset id fails; so does an entry without default; so do duplicates.
    expect(() => checkRegistry([{ ...T1_EXAMPLE, presets: { ...T1_EXAMPLE.presets, follow: { caption: 'x' } } }])).toThrow(/not listed/);
    expect(() => checkRegistry([{ ...T2_ENTRY, presets: { follow: { caption: 'x' } } as never }])).toThrow(/default preset/);
    expect(() => checkRegistry([{ ...T2_ENTRY, presets: { default: { caption: '' } } }])).toThrow(/default preset/);
    expect(() => collectRegistry([T1_EXAMPLE, { ...T1_EXAMPLE, number: 3 }])).toThrow(/duplicate tool id/);
    expect(() => collectRegistry([T1_EXAMPLE, { ...T2_ENTRY, number: 1 }])).toThrow(/duplicate tool number/);
    expect(() => collectRegistry([{ ...T1_EXAMPLE, id: 'game' as never }])).toThrow(/not a tool id/);
    // Lookups.
    expect(toolById('garden', [T1_EXAMPLE, T2_ENTRY])?.title).toBe('Orbit Garden');
    expect(boardsOffered('mirror', [{ ...T1_EXAMPLE, id: 'mirror', number: 6, boards: ['A2', 'B2', 'G2'] }])).toEqual(['A2', 'B2', 'G2']);
    expect(boardsOffered('mirror', [])).toBe('all');
  });

  it('one route per registered tool', () => {
    const routes = toolRoutes([T1_EXAMPLE, T2_ENTRY]);
    expect(routes.map((r) => r.params)).toEqual([{ tool: 'board' }, { tool: 'garden' }]);
    expect(routes.map((r) => r.props.caption)).toEqual([T1_EXAMPLE.presets.default.caption, T2_ENTRY.presets.default.caption]);
    expect(routes[1]!.props.entry).toBe(T2_ENTRY);
    expect(toolRoutes([])).toEqual([]);
    expect(toolRoutes()).toHaveLength(registry.length);
  });
});
