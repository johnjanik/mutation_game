// P2-A3: tool T4, the Classification Lab (SPEC 4 T4 Acceptance, 2.5, 2.11, 2.12, 4.0, 5.5, 5.6, 6.6, E-7,
// E-9), through T4's own pure modules (t04/verdict.ts, t04/counter.ts, t04/link.ts) so that a wiring
// error shows, and the server render of T04ClassificationLab.svelte. Golden values are read from
// reference/golden_data.json (the JSON file or resolveGoldenPath), never typed; the numbers in test
// names and comments are for the reader only. No covers() call: the golden keys used here are fixtures;
// P2-A1's and P1-A1's golden tests cover them (CONTRACTS 3). Random renumberings use a fixed seed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CAPS,
  cartanNumbers,
  classify,
  orbitGraph,
  smallestNonfiniteSubboard,
  spectralRadius,
  symmetrizer,
  toPositions,
} from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import golden from '../../../../reference/golden_data.json';
import { resolveGoldenPath } from '../../../src/lib/golden';
import { resolveBoard } from '../../../src/lib/state';
import { whereToRun } from '../../../src/lib/worker';
import { decodeState, encodeState } from '../../../src/lib/urlCodec';
import { ENGINE, ONE_WAY_SENTENCE, buildVerdict, displayNames, displayText, verdictSummary, type VerdictEngine } from '../../../src/components/tools/t04/verdict';
import {
  DEFAULT_LAYERS,
  counterHint,
  counterView,
  findMixed,
  hunterSentence,
  layerCounts,
  rootSearch,
  searchBounds,
  seedsOf,
  stopMessage,
} from '../../../src/components/tools/t04/counter';
import { G_LIMIT, gValue, linkFits } from '../../../src/components/tools/t04/link';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';

/** The fixed seed of the random renumberings (recorded here, COMMON 4.4). */
const SEED = 20261010;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(SEED);

/** A random permutation p of 0..n-1 that is not the identity when n > 1. */
function permutation(n: number): number[] {
  for (;;) {
    const p = Array.from({ length: n }, (_, k) => k);
    for (let k = n - 1; k > 0; k--) {
      const j = Math.floor(random() * (k + 1));
      [p[k], p[j]] = [p[j]!, p[k]!];
    }
    if (n === 1 || p.some((v, k) => v !== k)) return p;
  }
}

/** C'[i][j] = C[p(i)][p(j)]: node i of the new board is node p(i) of the old one. */
function renumber(C: number[][], p: number[]): number[][] {
  return p.map((pi) => p.map((pj) => C[pi]![pj]!));
}

/** Two boards side by side (a board in two pieces). */
function blockDiagonal(A: number[][], B: number[][]): number[][] {
  const n = A.length + B.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i < A.length && j < A.length) return A[i]![j]!;
      if (i >= A.length && j >= A.length) return B[i - A.length]![j - A.length]!;
      return 0;
    }),
  );
}

interface Component {
  nodes: number[];
  kind: string;
  balanced: boolean;
  class: string | null;
  name: string | null;
  bourbaki_order?: number[];
  marks?: number[];
  comarks?: number[];
}
const G = golden as unknown as {
  types: Record<string, { cartan: number[][]; symmetrizer: number[] }>;
  affine: Record<string, { name: string; constructor_name: string; cartan_node0_first: number[][]; marks: number[]; comarks: number[] }>;
  twisted_affine: { name: string; cartan: number[][]; marks: number[]; comarks: number[]; symmetrizer: number[] }[];
  classification_tests: {
    label: string;
    cartan: number[][];
    components: Component[];
    smallest_nonfinite_subboard: { nodes: number[]; class: string } | null;
    spectral_radius_4_decimals: string | null;
  }[];
  layer_growth_examples: { label: string; cartan: number[][]; new_per_layer: number[] }[];
  one_way_counterexample: { cartan: number[][]; start: number[]; moves: number[]; result: number[] };
};
const testCartan = (label: string): number[][] => resolveGoldenPath(`classification_tests[label=${label}].cartan`) as number[][];

describe('T4 verdict', () => {
  it('buildVerdict recognises every finite type under a random renumbering and names the rank-2 board B2', () => {
    for (const [type, rec] of Object.entries(G.types)) {
      const n = rec.cartan.length;
      const p = permutation(n);
      const board = resolveBoard({ cartan: renumber(rec.cartan, p) });
      const v = buildVerdict(board);
      expect(v.components.length, type).toBe(1);
      const c = v.components[0]!;
      expect(c.record.class, type).toBe('finite');
      expect(c.classText).toBe('finite');
      expect(c.record.balanced).toBe(true);
      expect(c.record.name, type).toBe(type === 'C2' ? 'B2' : type);
      // bourbaki_order (labels) restores the standard matrix: C'[o_k][o_l] = C_std[k][l].
      const std = (G.types[type === 'C2' ? 'B2' : type]!).cartan;
      const o = toPositions(board, c.record.bourbaki_order!);
      const C2 = cartanNumbers(board);
      for (let k = 0; k < n; k++) for (let l = 0; l < n; l++) expect(C2[o[k]!]![o[l]!], `${type} ${k} ${l}`).toBe(std[k]![l]);
      expect(c.matching!.map((m) => m.reader)).toEqual(c.record.bourbaki_order);
      expect(c.matching!.map((m) => m.bourbaki)).toEqual(Array.from({ length: n }, (_, k) => k + 1));
      expect(v.finiteKnown).toBe(true);
      expect(v.nonfinite).toBeNull();
    }
    // D19: the rank-2 board is shown as B2 = C2, whatever the picker said.
    for (const name of ['B2', 'C2']) {
      const v = buildVerdict(resolveBoard(name));
      expect(v.components[0]!.record.name).toBe('B2');
      expect(displayText(v.components[0]!.record.name!)).toBe('B2 = C2');
      expect(displayNames('B2').map((n) => `${n.letter}${n.sub}`)).toEqual(['B2', 'C2']);
    }
    expect(displayNames('E6').length).toBe(1);
  });

  it('buildVerdict recognises every untwisted and twisted affine board under a random renumbering', () => {
    const cases = [
      ...Object.values(G.affine).map((a) => ({ cartan: a.cartan_node0_first, name: a.name, marks: a.marks, comarks: a.comarks })),
      ...G.twisted_affine.map((t) => ({ cartan: t.cartan, name: t.name, marks: t.marks, comarks: t.comarks })),
    ];
    expect(cases.length).toBe(42);
    for (const t of cases) {
      const p = permutation(t.cartan.length);
      const board = resolveBoard({ cartan: renumber(t.cartan, p) });
      const v = buildVerdict(board);
      expect(v.components.length).toBe(1);
      const c = v.components[0]!;
      expect(c.record.class, t.name).toBe('affine');
      expect(c.classText).toBe('affine');
      expect(c.record.name, t.name).toBe(t.name);
      expect(c.record.marks, t.name).toEqual(p.map((pi) => t.marks[pi]));
      expect(c.record.comarks, t.name).toEqual(p.map((pi) => t.comarks[pi]));
      expect(v.spectralRadius).toBe((2).toFixed(4));
      expect(v.finiteKnown).toBe(false);
    }
    // The affine board of B2 is named C2~ (2.8), from either numbering.
    expect(buildVerdict(resolveBoard('B2~')).components[0]!.record.name).toBe('C2~');
    expect(buildVerdict(resolveBoard('C2~')).components[0]!.record.name).toBe('C2~');
  });

  it('buildVerdict reproduces every classification_tests record', () => {
    expect(G.classification_tests.length).toBe(13);
    for (const t of G.classification_tests) {
      const board = resolveBoard({ cartan: t.cartan });
      const v = buildVerdict(board);
      expect(v.components.map((c) => c.record), t.label).toEqual(t.components);
      expect(v.components.map((c) => Object.keys(c.record)), t.label).toEqual(t.components.map((c) => Object.keys(c)));
      expect(v.components.map((c) => c.balancedText), t.label).toEqual(t.components.map((c) => (c.balanced ? 'balanced' : 'not balanced')));
      expect(v.nonfinite, t.label).toEqual(t.smallest_nonfinite_subboard);
      expect(v.spectralRadius, t.label).toBe(t.spectral_radius_4_decimals);
      for (const c of v.components) {
        expect(c.classText).toBe(c.record.kind === 'one-way' ? ONE_WAY_SENTENCE : c.record.class);
      }
    }
  });

  it('labels, not positions, reach the verdict on D4~ and on the two-component test board', () => {
    const d4 = resolveBoard('D4~');
    const v = buildVerdict(d4);
    expect(v.components[0]!.record.nodes).toEqual([0, 1, 2, 3, 4]);
    expect(v.components[0]!.record.marks).toEqual(G.affine.D4!.marks);
    const two = resolveBoard({ cartan: testCartan('two components: A2 and the triangle') });
    const w = buildVerdict(two);
    expect(w.components[1]!.record.nodes).toEqual([3, 4, 5]);
    expect(w.nonfinite!.nodes).toEqual([3, 4, 5]);
    expect(classify(two)[1]!.nodes).toEqual([2, 3, 4]);
    // A renumbered E6 and B3, where bourbaki_order is not its own inverse.
    for (const type of ['E6', 'B3']) {
      const p = [...Array(G.types[type]!.cartan.length).keys()].reverse();
      const b = resolveBoard({ cartan: renumber(G.types[type]!.cartan, p) });
      const order = buildVerdict(b).components[0]!.record.bourbaki_order!;
      const std = G.types[type]!.cartan;
      const C = cartanNumbers(b);
      const pos = toPositions(b, order);
      std.forEach((row, k) => row.forEach((x, l) => expect(C[pos[k]!]![pos[l]!]).toBe(x)));
    }
  });

  it('on a board with a one-way component beside an indefinite bidirected component the sub-board and the spectral radius are absent', () => {
    const C = blockDiagonal(testCartan('one-way road'), testCartan('rank 2 with 3 roads each way'));
    const board = resolveBoard({ cartan: C });
    const records = classify(board);
    expect(records.length).toBe(2);
    expect(records[0]!.kind).toBe('one-way');
    expect(records[1]!.class).toBe('indefinite');
    const v = buildVerdict(board);
    expect(v.components.map((c) => c.classText)).toEqual([ONE_WAY_SENTENCE, 'indefinite']);
    expect(v.nonfinite).toBeNull();
    expect(v.spectralRadius).toBeNull();
    expect(smallestNonfiniteSubboard(board)).toBeNull();
    expect(spectralRadius(board)).toBeNull();
  });

  it('buildVerdict shows the weights d_i on balanced boards, normalised per component, and none on unbalanced or one-way boards', () => {
    for (const [type, rec] of Object.entries(G.types)) {
      const v = buildVerdict(resolveBoard(type));
      expect(v.balanced).toBe(true);
      expect(v.weights!.join(', '), type).toBe(rec.symmetrizer.join(', '));
      expect(v.components[0]!.weights!.join(', ')).toBe(rec.symmetrizer.join(', '));
    }
    for (const t of G.twisted_affine) expect(buildVerdict(resolveBoard(t.name)).weights!.join(', '), t.name).toBe(t.symmetrizer.join(', '));
    // B2 and G2 side by side: each piece has least weight 1.
    const two = buildVerdict(resolveBoard({ cartan: blockDiagonal(G.types.B2!.cartan, G.types.G2!.cartan) }));
    expect(two.components.map((c) => c.weights!.join(', '))).toEqual([G.types.B2!.symmetrizer.join(', '), G.types.G2!.symmetrizer.join(', ')]);
    for (const label of ['triangle with unbalanced road counts all round', 'one-way road']) {
      const v = buildVerdict(resolveBoard({ cartan: testCartan(label) }));
      expect(v.balanced, label).toBe(false);
      expect(v.weights).toBeNull();
      expect(v.components.every((c) => c.weights === null && c.balancedText === 'not balanced')).toBe(true);
    }
  });

  it('buildVerdict calls classify once per board object', () => {
    const counts = { classify: 0, symmetrizer: 0, spectralRadius: 0, smallestNonfiniteSubboard: 0 };
    const counting: VerdictEngine = {
      classify: (b) => (counts.classify++, ENGINE.classify(b)),
      symmetrizer: (b) => (counts.symmetrizer++, ENGINE.symmetrizer(b)),
      spectralRadius: (b) => (counts.spectralRadius++, ENGINE.spectralRadius(b)),
      smallestNonfiniteSubboard: (b) => (counts.smallestNonfiniteSubboard++, ENGINE.smallestNonfiniteSubboard(b)),
    };
    const board = resolveBoard({ cartan: testCartan('star with five arms') });
    buildVerdict(board, counting);
    expect(counts).toEqual({ classify: 1, symmetrizer: 1, spectralRadius: 1, smallestNonfiniteSubboard: 1 });
    // With the real engine the verdict is kept per board object: a second call returns the same verdict.
    const first = buildVerdict(board);
    expect(buildVerdict(board)).toBe(first);
    expect(buildVerdict(resolveBoard({ cartan: testCartan('star with five arms') }))).not.toBe(first);
    expect(verdictSummary(first)).toBe('indefinite');
    expect(verdictSummary(buildVerdict(resolveBoard('A3')))).toBe('finite A3');
  });
});

describe('T4 root counter and hunter', () => {
  const star = () => resolveBoard({ cartan: testCartan('star with five arms') });
  const growth = (label: string, field: string): unknown => resolveGoldenPath(`layer_growth_examples[label=${label}].${field}`);

  it('the counter on the star with five arms stops at 2000 positions with layers 0 to 10 complete (1271) and at 100000 with layers 0 to 17 complete (74311)', () => {
    const board = star();
    const v = buildVerdict(board);
    expect(v.finiteKnown).toBe(false);
    const perLayer = growth('star with five arms', 'new_per_layer') as number[];
    for (const key of ['stop_at_2000', 'stop_at_100000']) {
      const rec = growth('star with five arms', key) as { positions: number; truncated: boolean; complete_layers: number; positions_in_complete_layers: number };
      const cap = rec.positions;
      const { maxDepth } = searchBounds(v.finiteKnown, DEFAULT_LAYERS, cap);
      expect(maxDepth).toBe(DEFAULT_LAYERS);
      const graph = rootSearch(board, v.finiteKnown, DEFAULT_LAYERS, cap);
      const view = counterView(graph, maxDepth, cap);
      expect(view.found).toBe(rec.positions);
      expect(view.truncated).toBe(rec.truncated);
      expect(view.completeLayers).toBe(rec.complete_layers);
      expect(view.inComplete).toBe(rec.positions_in_complete_layers);
      expect(view.layers.slice(0, rec.complete_layers + 1)).toEqual(perLayer.slice(0, rec.complete_layers + 1));
      expect(view.stop).toBe(`stopped after ${rec.positions} positions; layers 0 to ${rec.complete_layers} are complete`);
      expect(view.ended).toBe('cap');
    }
  });

  it('the counter on a finite board is complete and on the triangle stops after 40 layers', () => {
    const a3 = resolveBoard('A3');
    const v = buildVerdict(a3);
    const g = rootSearch(a3, v.finiteKnown, DEFAULT_LAYERS);
    const view = counterView(g, searchBounds(true, DEFAULT_LAYERS).maxDepth, CAPS.mainThreadItems);
    expect(view.found).toBe(resolveGoldenPath('types.A3.n_roots'));
    expect(view.stop).toBeNull();
    expect(view.ended).toBe('complete');
    expect(layerCounts(g)[0]).toBe(3);
    const tri = resolveBoard('A2~');
    const tv = buildVerdict(tri);
    const tg = rootSearch(tri, tv.finiteKnown, DEFAULT_LAYERS);
    const tview = counterView(tg, DEFAULT_LAYERS, CAPS.mainThreadItems);
    expect(tview.found).toBe(growth('triangle', 'root_populations_found'));
    expect(tview.layers).toEqual(growth('triangle', 'new_per_layer'));
    expect(tview.stop).toBe(`stopped after ${DEFAULT_LAYERS} layers`);
    expect(stopMessage(tg, DEFAULT_LAYERS, CAPS.mainThreadItems)).toBe(tview.stop);
  });

  it('seeds are the single Martians in position order in the board arithmetic', () => {
    expect(seedsOf(resolveBoard('A2'))).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(seedsOf(resolveBoard({ cartan: testCartan('one-way road') }))).toEqual([
      [1n, 0n],
      [0n, 1n],
    ]);
  });

  it('the hunter finds (-1, 1) after two moves on the one-way road and the verdict has no class', () => {
    const ce = G.one_way_counterexample;
    const board = resolveBoard({ cartan: testCartan('one-way road') });
    expect(cartanNumbers(board)).toEqual(ce.cartan);
    const v = buildVerdict(board);
    expect(v.components.map((c) => c.classText)).toEqual([ONE_WAY_SENTENCE]);
    expect(v.components[0]!.record.class).toBeNull();
    expect(v.components[0]!.record.name).toBeNull();
    expect(v.spectralRadius).toBeNull();
    expect(v.nonfinite).toBeNull();
    const g = rootSearch(board, v.finiteKnown, DEFAULT_LAYERS);
    const m = findMixed(g, board)!;
    expect(m.population).toEqual(ce.result.map(String));
    expect(m.word).toEqual(ce.moves);
    expect(m.moves).toBe(ce.moves.length);
    expect(ce.start[m.start - 1]).toBe(1);
    const view = counterView(g, DEFAULT_LAYERS, CAPS.mainThreadItems);
    expect(hunterSentence(view, m)).toBe(
      `(${ce.result.map((x) => String(x).replace('-', '−')).join(', ')}) after ${ce.moves.length} moves from one Martian in city ${m.start}: mutate ${ce.moves.join(', then ')}`,
    );
  });

  it('the hunter finds nothing on the 32 types, the 42 affine boards and the bidirected test boards', () => {
    const boards: AnyBoard[] = [
      ...Object.keys(G.types).map((t) => resolveBoard(t)),
      ...Object.values(G.affine).map((a) => resolveBoard(a.constructor_name)),
      ...G.twisted_affine.map((t) => resolveBoard(t.name)),
      ...G.classification_tests.filter((t) => t.components.every((c) => c.kind === 'gcm')).map((t) => resolveBoard({ cartan: t.cartan })),
    ];
    expect(boards.length).toBe(32 + 32 + 10 + 12);
    for (const b of boards) {
      const v = buildVerdict(b);
      const g = rootSearch(b, v.finiteKnown, DEFAULT_LAYERS);
      if (v.finiteKnown) expect(g.truncated).toBe(false);
      expect(findMixed(g, b), b.name ?? 'custom').toBeNull();
    }
    // The check is not vacuous: a board with a one-way road does give a mixed population.
    const ow = resolveBoard({ cartan: testCartan('one-way road') });
    expect(findMixed(rootSearch(ow, false, DEFAULT_LAYERS), ow)).not.toBeNull();
  });

  it("the hunter's none-found sentence names k and the layer bound, and the plan variants for a cap-cut and a complete search", () => {
    const tri = resolveBoard('A2~');
    const tview = counterView(rootSearch(tri, false, DEFAULT_LAYERS), DEFAULT_LAYERS, CAPS.mainThreadItems);
    const k = growth('triangle', 'root_populations_found');
    expect(hunterSentence(tview, null)).toBe(`none among the ${k} root populations of the first ${DEFAULT_LAYERS} layers`);
    const s = star();
    const sview = counterView(rootSearch(s, false, DEFAULT_LAYERS), DEFAULT_LAYERS, CAPS.mainThreadItems);
    const rec = growth('star with five arms', 'stop_at_2000') as { positions: number; complete_layers: number };
    expect(hunterSentence(sview, null)).toBe(`none among the ${rec.positions} root populations found; layers 0 to ${rec.complete_layers} are complete`);
    const a3 = resolveBoard('A3');
    const aview = counterView(rootSearch(a3, true, DEFAULT_LAYERS), undefined, CAPS.mainThreadItems);
    expect(hunterSentence(aview, null)).toBe(`none among the ${resolveGoldenPath('types.A3.n_roots')} root populations`);
  });

  it('the counter hint routes the capped call to the main thread and the 100000 call to the worker', () => {
    const s = star();
    const v = buildVerdict(s);
    expect(whereToRun(counterHint(s, CAPS.mainThreadItems, v.finiteKnown))).toBe('main');
    expect(whereToRun(counterHint(s, CAPS.workerPositions, false))).toBe('worker');
    const a3 = resolveBoard('E8');
    expect(whereToRun(counterHint(a3, CAPS.mainThreadItems, buildVerdict(a3).finiteKnown))).toBe('main');
    expect(counterHint(s, CAPS.workerPositions, false)).toEqual({ board: s, kind: 'enumeration', expectedItems: CAPS.workerPositions, finiteKnown: false });
  });
});

describe('T4 link', () => {
  it('the densest twelve-node board encodes to a g of at most 512 characters and round-trips, and the guard flags a longer value', () => {
    const n = CAPS.customNodes;
    const cartan = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : -CAPS.roadsEachWay)));
    // Twelve distinct points, as many with two-digit coordinates as the grid allows.
    const xy: [number, number][] = [
      [10, 10], [10, 11], [11, 10], [11, 11],
      [10, 9], [11, 9], [9, 10], [9, 11], [10, 8], [11, 8], [8, 10], [8, 11],
    ];
    const spec = { cartan, xy };
    const g = gValue(spec);
    expect(g.length).toBeLessThanOrEqual(493);
    expect(g.length).toBeLessThanOrEqual(G_LIMIT);
    expect(linkFits(spec)).toBe(true);
    expect(linkFits('A3')).toBe(true);
    expect(linkFits('x'.repeat(G_LIMIT + 1))).toBe(false);
    expect(linkFits('x'.repeat(G_LIMIT))).toBe(true);
    const defaults = { schema: 1 as const, tool: 'lab' as const, board: 'A3' };
    const { state, notice } = decodeState(encodeState({ ...defaults, board: spec }), 'lab', defaults);
    expect(notice).toBeNull();
    expect(state.board).toEqual(spec);
    // A named board stays a name.
    expect(encodeState(defaults)).toBe('z=1&g=A3');
  });
});

describe('T4 server render', () => {
  let ssr: SsrLoader;
  beforeAll(async () => {
    ssr = await ssrLoader();
  }, 60000);
  afterAll(async () => {
    await ssr?.close();
  });

  it('renders the default A3 state with the verdict, the weights, the radius, the complete count, disabled controls and no worker', async () => {
    const mod = await ssr.load<{ default: unknown }>('/src/components/tools/T04ClassificationLab.svelte');
    const html = ssr.render(mod.default, { id: '', caption: 'The path A3.', preset: 'default' });
    expect(html).toContain('data-tool="lab"');
    expect(html).toMatch(/data-out="verdictClass"[^>]*>finite</);
    expect(html).toMatch(/data-out="verdictName"[^>]*data-name="A3"/);
    expect(html).toMatch(/data-out="weights"[^>]*>1, 1, 1</);
    expect(html).toMatch(/data-out="balanced"[^>]*>balanced</);
    const rho = spectralRadius(resolveBoard('A3'))!.toFixed(4);
    expect(html).toMatch(new RegExp(`data-out="spectralRadius"[^>]*>${rho.replace('.', '\\.')}<`));
    expect(html).toMatch(new RegExp(`data-out="rootCount"[^>]*>${String(resolveGoldenPath('types.A3.n_roots'))}<`));
    expect(html).not.toContain('data-out="stopMessage"');
    expect(html).not.toContain('data-out="nonfiniteSubboard"');
    expect(html).toContain('data-road-style="dynkin"');
    expect(html).toContain('data-nodes="3"');
    expect(html).not.toMatch(/engine\.worker/);
    // Every button, select and input is disabled until hydration.
    const controls = html.match(/<(button|select|input)\b[^>]*>/g) ?? [];
    expect(controls.length).toBeGreaterThan(10);
    for (const c of controls) expect(c, c).toMatch(/\sdisabled(=|\s|>)/);
  });

  it('renders the hunter preset with the one-way sentence, the roads style and the mixed population', async () => {
    const mod = await ssr.load<{ default: unknown }>('/src/components/tools/T04ClassificationLab.svelte');
    const html = ssr.render(mod.default, { id: '', caption: 'The one-way road.', preset: 'hunter' });
    expect(html).toContain(ONE_WAY_SENTENCE);
    expect(html).toContain('data-road-style="roads"');
    expect(html).not.toContain('data-out="spectralRadius"');
    expect(html).toMatch(/data-out="hunterResult"[^>]*data-population="-1,1"/);
    // The count on this board is cut by the layer bound, never presented as complete.
    expect(html).toContain(`stopped after ${DEFAULT_LAYERS} layers`);
    // orbitGraph is what the counter runs (a wiring check).
    expect(orbitGraph).toBeTypeOf('function');
    expect(symmetrizer(resolveBoard('A3'))).not.toBeNull();
  });
});
