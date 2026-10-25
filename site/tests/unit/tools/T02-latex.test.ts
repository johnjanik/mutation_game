// P6-tikz: T2's Export LaTeX builder, site/src/components/tools/t02/latex.ts (SPEC.md 6.7 "Orbit graphs and
// projections are exported as plain TikZ coordinates"; 4.0 Long numbers; the tikz-graph form of
// decisions/P6-A5.md). The garden is built here as T02OrbitGarden.svelte builds the drawing (grow, moveEdges,
// drawGarden, visibleEdges, positiveView), and the export is compared with that model: one vertex per vertex
// drawn, one edge per edge drawn, finite centimetres, y up, at most 16 cm wide, labels with the ASCII
// hyphen-minus. Golden counts are read from reference/golden_data.json, never typed.
import { describe, expect, it } from 'vitest';
import type { AnyBoard } from '@two-games/engine';
import { resolveGoldenPath } from '../../../src/lib/golden';
import { resolveBoard } from '../../../src/lib/state';
import { exportLaTeX, type TikzGraphData } from '../../../src/lib/export';
import { drawsEverything, entriesInLabelOrder, grow, keyOf, moveEdges, visibleEdges, type GardenEdge, type Vector } from '../../../src/components/tools/t02/garden';
import { drawGarden, type DrawLayout } from '../../../src/components/tools/t02/drawing';
import { vertexText } from '../../../src/components/tools/t02/numbers';
import { positiveView } from '../../../src/components/tools/t02/poset';
import { CM_PER_PX, MAX_WIDTH_CM, gardenLatex, gardenScale, vertexLabel, type GardenDrawing } from '../../../src/components/tools/t02/latex';

const MINUS_SIGN = '−';

interface Built {
  drawing: GardenDrawing;
  layout: DrawLayout;
  /** The layer of each vertex (depth, or total in the positive view). */
  rank: number[];
}

/** The drawing of a garden as the component makes it: entries, layered layout, the edges shown. */
function drawn(board: AnyBoard, items: readonly Vector[], rank: number[], edges: readonly { from: number; to: number }[], shown: readonly number[], labelsOn = true): Built {
  const keys = items.map((v) => keyOf(board, v));
  const entries = items.map((v) => entriesInLabelOrder(board, v));
  const labelled = labelsOn && drawsEverything(items.length);
  const layout = drawGarden({ keys, rank, edges: edges.map((e) => [e.from, e.to] as const), texts: entries.map((e) => vertexText(e)), labelled });
  return { drawing: { cx: layout.cx, cy: layout.cy, width: layout.width, entries, edges: shown.map((k) => edges[k]!), labelled }, layout, rank };
}

/** The roots garden of a board grown to `layers`, drawn as in explore mode with no focus and no play. */
function rootsGarden(spec: string | { cartan: number[][] }, layers: number, focused: number | null = null, labelsOn = true): Built & { edgesAll: GardenEdge[] } {
  const board = resolveBoard(spec);
  const g = grow({ board, grows: 'roots', game: 'mutation' }, layers);
  const edges = moveEdges(g.board, g.graph.items, 'mutation');
  const shown = visibleEdges(edges, g.graph.items.length, focused, []);
  return { ...drawn(g.board, g.graph.items, g.graph.depth, edges, shown, labelsOn), edgesAll: edges };
}

function dataOf(d: GardenDrawing): TikzGraphData {
  const choice = gardenLatex(d);
  expect(choice).not.toBeNull();
  expect(choice!.kind).toBe('tikz-graph');
  return choice!.data as TikzGraphData;
}

/** The checks every export must pass against the drawing it came from. */
function checkAgainstDrawing(b: Built): { data: TikzGraphData; text: string } {
  const { drawing, layout } = b;
  const data = dataOf(drawing);
  // One vertex per vertex drawn, one edge per edge drawn, in the drawn order, undirected.
  expect(data.nodes).toHaveLength(drawing.entries.length);
  expect(data.edges).toEqual(drawing.edges.map((e) => [e.from, e.to]));
  expect(data.directed).toBe(false);
  // Centimetres, y up: x = cx s, y = -cy s with one scale, natural size unless wider than 16 cm.
  const s = gardenScale(layout.width);
  expect(s).toBe(layout.width * CM_PER_PX > MAX_WIDTH_CM ? MAX_WIDTH_CM / layout.width : CM_PER_PX);
  data.nodes.forEach((v, k) => {
    expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
    expect(v.x).toBeCloseTo(layout.cx[k]! * s, 12);
    expect(v.y).toBeCloseTo(-layout.cy[k]! * s, 12);
    expect(v.y).toBeLessThan(0);
  });
  const xs = data.nodes.map((v) => v.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(MAX_WIDTH_CM);
  expect(layout.width * s).toBeLessThanOrEqual(MAX_WIDTH_CM + 1e-9);
  // Layer 0 is drawn on top: one height per layer, and a deeper layer has a smaller y.
  const yOf = new Map<number, Set<number>>();
  data.nodes.forEach((v, k) => yOf.set(b.rank[k]!, (yOf.get(b.rank[k]!) ?? new Set<number>()).add(v.y)));
  const layers = [...yOf.keys()].sort((p, q) => p - q);
  for (const l of layers) expect(yOf.get(l)!.size).toBe(1);
  for (let k = 1; k < layers.length; k++) expect([...yOf.get(layers[k]!)!][0]!).toBeLessThan([...yOf.get(layers[k - 1]!)!][0]!);
  // Labels: the entries in label order, ASCII hyphen-minus and commas, exactly when the drawing labels.
  data.nodes.forEach((v, k) => {
    if (drawing.labelled) expect(v.label).toBe(drawing.entries[k]!.join(','));
    else expect(v.label).toBeUndefined();
  });
  // The form export.ts writes: one \node per vertex, one \draw per edge, no U+2212 anywhere.
  const text = exportLaTeX('tikz-graph', data);
  expect(text).not.toContain(MINUS_SIGN);
  const lines = text.split('\n');
  expect(lines.filter((l) => l.startsWith('  \\node[')).length).toBe(drawing.entries.length);
  expect(lines.filter((l) => l.startsWith('  \\draw ')).length).toBe(drawing.edges.length);
  return { data, text };
}

describe('t02/latex.ts: the garden as drawn, a tikz-graph', () => {
  it('A3 grown to the end: every root population, every edge, labelled, natural size', () => {
    const b = rootsGarden('A3', 40);
    expect(b.drawing.entries).toHaveLength(resolveGoldenPath('types.A3.n_roots') as number);
    expect(b.drawing.edges.length).toBe(b.edgesAll.length);
    expect(b.drawing.edges.length).toBeGreaterThan(0);
    expect(b.drawing.labelled).toBe(true);
    const { data } = checkAgainstDrawing(b);
    expect(gardenScale(b.layout.width)).toBe(CM_PER_PX);
    // Negative root populations are written with the ASCII hyphen-minus (the screen shows U+2212).
    const negative = data.nodes.flatMap((v, k) => (v.label!.includes('-') ? [k] : []));
    expect(negative.length).toBe(data.nodes.length / 2);
    for (const k of negative) expect(vertexText(b.drawing.entries[k]!)).toContain(MINUS_SIGN);
  });

  it('the triangle grown 40 layers (a custom board, Big): 243 labelled vertices, every edge', () => {
    const tri = resolveGoldenPath('layer_growth_examples[label=triangle]') as { cartan: number[][]; layers: number; root_populations_found: number };
    const b = rootsGarden({ cartan: tri.cartan }, tri.layers);
    expect(b.drawing.entries).toHaveLength(tri.root_populations_found);
    expect(b.drawing.labelled).toBe(true);
    expect(b.drawing.edges.length).toBe(b.edgesAll.length);
    const { text } = checkAgainstDrawing(b);
    expect(text).toMatch(/\{\$-\d+,/);
  });

  it('E8 grown to the end: 240 labelled vertices, wider than 16 cm at natural size, scaled to 16 cm', () => {
    const b = rootsGarden('E8', 40);
    expect(b.drawing.entries).toHaveLength(resolveGoldenPath('types.E8.n_roots') as number);
    expect(b.layout.width * CM_PER_PX).toBeGreaterThan(MAX_WIDTH_CM);
    checkAgainstDrawing(b);
    expect(gardenScale(b.layout.width)).toBe(MAX_WIDTH_CM / b.layout.width);
  });

  it('the star with five arms at 2000 positions: dots without labels, the edges at the focused vertex only', () => {
    const star = resolveGoldenPath('layer_growth_examples[label=star with five arms]') as { cartan: number[][]; layers: number; stop_at_2000: { positions: number } };
    const b = rootsGarden({ cartan: star.cartan }, star.layers, 0);
    expect(b.drawing.entries).toHaveLength(star.stop_at_2000.positions);
    expect(b.drawing.labelled).toBe(false);
    expect(b.drawing.edges.length).toBeGreaterThan(0);
    expect(b.drawing.edges.length).toBeLessThan(b.edgesAll.length);
    for (const e of b.drawing.edges) expect(e.from === 0 || e.to === 0).toBe(true);
    const { text } = checkAgainstDrawing(b);
    // Plain dots: an empty node text; the whole file stays small (decisions/P6-tikz.md).
    expect(text).toContain('\\node[circle,draw,inner sep=1pt] (n0) at (');
    expect(text.length).toBeLessThan(200_000);
  });

  it('the labels toggle off: no label, the same vertices and edges', () => {
    const on = rootsGarden('A3', 40);
    const off = rootsGarden('A3', 40, null, false);
    expect(off.drawing.labelled).toBe(false);
    const d = checkAgainstDrawing(off).data;
    expect(d.nodes).toHaveLength(on.drawing.entries.length);
    expect(d.edges).toHaveLength(on.drawing.edges.length);
  });

  it('positive roots only on G2: the layered view by total, one line per raising edge whatever its rise', () => {
    const board = resolveBoard('G2');
    const pv = positiveView(board, 40);
    expect(pv.vertices).toHaveLength((resolveGoldenPath('types.G2.positive_roots') as number[][]).length);
    const min = pv.totals[0]!;
    const rank = pv.totals.map((t) => Number(t - min));
    const edges = pv.edges.map((e) => ({ from: e.from, to: e.to }));
    expect(pv.edges.some((e) => e.rise > 1n)).toBe(true);
    const b = drawn(board, pv.vertices, rank, edges, edges.map((_, k) => k));
    checkAgainstDrawing(b);
  });

  it('nothing drawn gives null (ToolFrame shows its notice)', () => {
    expect(gardenLatex({ cx: [], cy: [], width: 24, entries: [], edges: [], labelled: true })).toBeNull();
  });

  it('a label never carries U+2212, even when given one', () => {
    expect(vertexLabel(['1', '-2', `${MINUS_SIGN}3`])).toBe('1,-2,-3');
    const d = dataOf({ cx: [30], cy: [30], width: 60, entries: [[`${MINUS_SIGN}1`, '0']], edges: [], labelled: true });
    expect(d.nodes[0]!.label).toBe('-1,0');
  });
});
