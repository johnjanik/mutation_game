// RT-FIX-P6-latex (finding P6-RT-10-01): T12's Export LaTeX builder, site/src/components/tools/t12/latex.ts
// (SPEC.md 6.7 "Orbit graphs and projections are exported as plain TikZ coordinates"; 4 T12 "the orbit drawn in
// layers with edges coloured by node"; the tikz-graph form of decisions/P6-A5.md). The orbit is built and drawn
// here as T12RepresentationBuilder.svelte builds and draws it (buildRepresentation, orbitLayers, orbitDrawing,
// OrbitLayers.svelte's orbitGeometry and orbitSvg) and the export is compared with the drawing's own markup: one
// vertex per box, at the box's centre, in the drawn order, labelled with its position (ASCII hyphen-minus); one
// edge per edge drawn, in the drawn order, undirected; finite centimetres, y up, at most 16 cm wide. Dimensions
// are read from reference/golden_data.json, never typed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boardFromName, type AnyBoard, type Board } from '@engine';
import { resolveGoldenPath } from '../../../src/lib/golden';
import { exportLaTeX, type TikzGraphData } from '../../../src/lib/export';
import { buildRepresentation, inLabelOrder, orbitDrawing, orbitLayers, positionText, type OrbitDrawing, type OrbitLayers } from '../../../src/components/tools/t12/model';
import { CM_PER_PX, MAX_WIDTH_CM, orbitLatex, orbitScale, type OrbitPicture } from '../../../src/components/tools/t12/latex';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';

const MINUS_SIGN = '−';

type Geometry = { width: number; height: number; boxW: number; cx: (v: number) => number; top: (v: number) => number; cy: (v: number) => number };
type OrbitModule = {
  orbitGeometry: (layers: OrbitLayers, drawing: OrbitDrawing, texts: readonly string[]) => Geometry;
  orbitSvg: (layers: OrbitLayers, drawing: OrbitDrawing, texts: readonly string[], title: string, titleId: string) => { width: number; height: number; edgeLayers: string[]; vertexLayers: string[] };
};

let loader: SsrLoader;
let OL: OrbitModule;

beforeAll(async () => {
  loader = await ssrLoader();
  OL = await loader.load<OrbitModule>('/src/components/tools/t12/OrbitLayers.svelte');
}, 120000);

afterAll(async () => {
  await loader?.close();
});

const named = (name: string): Board<number> => boardFromName(name) as Board<number>;

/** The orbit of omega at a node, drawn as the component draws it, and the picture it hands the builder. */
function drawnOrbit(name: string, node: number): { board: AnyBoard; layers: OrbitLayers; texts: string[]; picture: OrbitPicture; svg: ReturnType<OrbitModule['orbitSvg']> } {
  const board = named(name);
  const layers = orbitLayers(buildRepresentation(board, node, { relations: 'later' }));
  expect(layers.drawn).toBe(true);
  const drawing = orbitDrawing(layers);
  const texts = layers.vertices.map((v) => positionText(inLabelOrder(board, v.values)));
  const g = OL.orbitGeometry(layers, drawing, texts);
  const picture: OrbitPicture = {
    width: g.width,
    cx: layers.vertices.map((_, v) => g.cx(v)),
    cy: layers.vertices.map((_, v) => g.cy(v)),
    entries: layers.vertices.map((v) => inLabelOrder(board, v.values).map(String)),
    edges: layers.edges,
  };
  return { board, layers, texts, picture, svg: OL.orbitSvg(layers, drawing, texts, name, 't') };
}

/** The centre of each vertex box of the drawn markup, in the drawn order. */
function boxCentres(svg: ReturnType<OrbitModule['orbitSvg']>): [number, number][] {
  return [...svg.vertexLayers.join('').matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => [
    Number(m[1]) + Number(m[3]) / 2,
    Number(m[2]) + Number(m[4]) / 2,
  ]);
}

function checkAgainstDrawing(o: ReturnType<typeof drawnOrbit>): { data: TikzGraphData; text: string } {
  const choice = orbitLatex(o.picture);
  expect(choice).not.toBeNull();
  expect(choice!.kind).toBe('tikz-graph');
  const data = choice!.data as TikzGraphData;
  expect(data.directed).toBe(false);
  expect(data.nodes).toHaveLength(o.layers.vertices.length);
  expect(data.edges).toEqual(o.layers.edges.map((e) => [e.from, e.to]));
  // The geometry is the drawing's: its width, and every vertex at the centre of its box.
  expect(o.picture.width).toBe(o.svg.width);
  const centres = boxCentres(o.svg);
  expect(centres).toHaveLength(data.nodes.length);
  const s = orbitScale(o.svg.width);
  expect(s).toBe(o.svg.width * CM_PER_PX > MAX_WIDTH_CM ? MAX_WIDTH_CM / o.svg.width : CM_PER_PX);
  data.nodes.forEach((v, k) => {
    expect(v.x).toBeCloseTo(centres[k]![0] * s, 9);
    expect(v.y).toBeCloseTo(-centres[k]![1] * s, 9);
    expect(v.y).toBeLessThan(0);
    // The position in label order, ASCII hyphen-minus and commas (the screen shows U+2212 and parentheses).
    expect(v.label).toBe(inLabelOrder(o.board, o.layers.vertices[k]!.values).join(','));
  });
  const xs = data.nodes.map((v) => v.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(MAX_WIDTH_CM);
  // Layer 0 on top: one height per layer, a deeper layer lower.
  const yOf = new Map<number, Set<number>>();
  data.nodes.forEach((v, k) => {
    const d = o.layers.vertices[k]!.depth;
    yOf.set(d, (yOf.get(d) ?? new Set<number>()).add(v.y));
  });
  const depths = [...yOf.keys()].sort((p, q) => p - q);
  for (const d of depths) expect(yOf.get(d)!.size).toBe(1);
  for (let k = 1; k < depths.length; k++) expect([...yOf.get(depths[k]!)!][0]!).toBeLessThan([...yOf.get(depths[k - 1]!)!][0]!);
  const text = exportLaTeX('tikz-graph', data);
  expect(text).not.toContain(MINUS_SIGN);
  expect(text).not.toContain('undefined');
  const lines = text.split('\n');
  expect(lines.filter((l) => l.startsWith('  \\node[')).length).toBe(o.layers.vertices.length);
  expect(lines.filter((l) => l.startsWith('  \\draw ')).length).toBe(o.layers.edges.length);
  return { data, text };
}

const dimension = (type: string, node: number): number => {
  const recs = resolveGoldenPath('minuscule_representations') as { type: string; node: number; dimension: number }[];
  return recs.find((r) => r.type === type && r.node === node)!.dimension;
};

describe('t12/latex.ts: the orbit as drawn, a tikz-graph', () => {
  it('A2 node 1: three positions, two edges, natural size', () => {
    const o = drawnOrbit('A2', 1);
    expect(o.layers.vertices).toHaveLength(dimension('A2', 1));
    const { data } = checkAgainstDrawing(o);
    expect(orbitScale(o.svg.width)).toBe(CM_PER_PX);
    expect(data.nodes.map((v) => v.label)).toEqual(['1,0', '-1,1', '0,-1']);
  });

  it('E6 node 1: 27 positions, wider than 16 cm at natural size, scaled to 16 cm, negatives in hyphen-minus', () => {
    const o = drawnOrbit('E6', 1);
    expect(o.layers.vertices).toHaveLength(dimension('E6', 1));
    expect(o.svg.width * CM_PER_PX).toBeGreaterThan(MAX_WIDTH_CM);
    const { text } = checkAgainstDrawing(o);
    expect(orbitScale(o.svg.width)).toBe(MAX_WIDTH_CM / o.svg.width);
    expect(o.texts.some((t) => t.includes(MINUS_SIGN))).toBe(true);
    expect(text).toMatch(/\{\$[^$]*-\d[^$]*\$\}/);
  });

  it('D4 node 2 (not minuscule): the dashed edges are written as edges too', () => {
    const o = drawnOrbit('D4', 2);
    expect(o.layers.edges.some((e) => !e.step)).toBe(true);
    checkAgainstDrawing(o);
  });

  it('nothing drawn gives null (the notice)', () => {
    expect(orbitLatex({ width: 100, cx: [], cy: [], entries: [], edges: [] })).toBeNull();
  });
});
