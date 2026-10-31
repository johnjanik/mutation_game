// RT-FIX-P6-latex (finding P6-RT-10-01): T8's Export LaTeX builder, site/src/components/tools/t08/latex.ts
// (SPEC.md 6.7 "Orbit graphs and projections are exported as plain TikZ coordinates"; 4 T8 "drawn in layers by
// the number of moves"; the tikz-graph form of decisions/P6-A5.md). The scene is built here as
// T08WeylExplorer.svelte builds it (boardView, pathOfMoves, buildScene) and the export is compared with that
// scene: one vertex per dot drawn, in the drawn order, no label; one edge per edge drawn, in the drawn order,
// joining the same two vertices, undirected; finite centimetres, y up, at most 16 cm wide. Group orders are
// read from reference/golden_data.json, never typed.
import { describe, expect, it } from 'vitest';
import { resolveGoldenPath } from '../../../src/lib/golden';
import { exportLaTeX, type TikzGraphData } from '../../../src/lib/export';
import { boardView } from '../../../src/components/tools/t08/cache';
import { pathOfMoves } from '../../../src/components/tools/t08/graph';
import { buildScene, type Scene } from '../../../src/components/tools/t08/layout';
import { CM_PER_PX, MAX_WIDTH_CM, weylLatex, weylScale, type WeylDrawing } from '../../../src/components/tools/t08/latex';

/** The scene and the drawing the component hands the builder at the click. */
function drawnScene(name: string, moves: number[], focus: number | null = null): { scene: Scene; drawing: WeylDrawing; rank: number[] } {
  const { model, layout } = boardView(name);
  const scene = buildScene(model, layout, pathOfMoves(model, moves), model.edgeMode === 'all' ? null : focus);
  const drawing: WeylDrawing = { width: scene.width, dots: scene.dots, edges: scene.edges.map((e) => model.edges[e.k]!) };
  return { scene, drawing, rank: scene.dots.map((d) => model.graph.depth[d.k]!) };
}

function dataOf(d: WeylDrawing): TikzGraphData {
  const choice = weylLatex(d);
  expect(choice).not.toBeNull();
  expect(choice!.kind).toBe('tikz-graph');
  return choice!.data as TikzGraphData;
}

/** The checks every export must pass against the scene it came from. */
function checkAgainstScene(b: ReturnType<typeof drawnScene>): { data: TikzGraphData; text: string } {
  const { scene, drawing, rank } = b;
  const data = dataOf(drawing);
  expect(data.nodes).toHaveLength(scene.dots.length);
  expect(data.edges).toHaveLength(scene.edges.length);
  expect(data.directed).toBe(false);
  // Centimetres, y up, one scale: natural size unless wider than 16 cm.
  const s = weylScale(scene.width);
  expect(s).toBe(scene.width * CM_PER_PX > MAX_WIDTH_CM ? MAX_WIDTH_CM / scene.width : CM_PER_PX);
  data.nodes.forEach((v, i) => {
    expect(v.x).toBeCloseTo(scene.dots[i]!.x * s, 12);
    expect(v.y).toBeCloseTo(-scene.dots[i]!.y * s, 12);
    expect(v.y).toBeLessThan(0);
    // The dots carry no label.
    expect(v.label).toBeUndefined();
  });
  const xs = data.nodes.map((v) => v.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(MAX_WIDTH_CM);
  // Layer 0 on top: one height per layer, a deeper layer lower.
  const yOf = new Map<number, Set<number>>();
  data.nodes.forEach((v, i) => yOf.set(rank[i]!, (yOf.get(rank[i]!) ?? new Set<number>()).add(v.y)));
  const layers = [...yOf.keys()].sort((p, q) => p - q);
  for (const l of layers) expect(yOf.get(l)!.size).toBe(1);
  for (let k = 1; k < layers.length; k++) expect([...yOf.get(layers[k]!)!][0]!).toBeLessThan([...yOf.get(layers[k - 1]!)!][0]!);
  // Each edge joins the dots at the two ends of the edge drawn, in the drawn order.
  data.edges.forEach(([a, b2], k) => {
    const e = scene.edges[k]!;
    expect([data.nodes[a]!.x, data.nodes[a]!.y, data.nodes[b2]!.x, data.nodes[b2]!.y].map((t) => t / s)).toEqual(
      [e.x1, -e.y1, e.x2, -e.y2].map((t) => expect.closeTo(t, 9)),
    );
  });
  const text = exportLaTeX('tikz-graph', data);
  const lines = text.split('\n');
  expect(lines.filter((l) => l.startsWith('  \\node[')).length).toBe(scene.dots.length);
  expect(lines.filter((l) => l.startsWith('  \\draw ')).length).toBe(scene.edges.length);
  expect(text).not.toContain('undefined');
  return { data, text };
}

describe('t08/latex.ts: the graph of positions as drawn, a tikz-graph', () => {
  it('A3: every position and every legal move, natural size', () => {
    const b = drawnScene('A3', [1, 2]);
    expect(b.scene.edgeMode).toBe('all');
    expect(b.scene.dots).toHaveLength(resolveGoldenPath('types.A3.weyl_order') as number);
    expect(b.scene.edges.length).toBeGreaterThan(0);
    checkAgainstScene(b);
    expect(weylScale(b.scene.width)).toBe(CM_PER_PX);
  });

  it('F4 (1152 positions, wider than 16 cm): every dot, scaled to 16 cm, the edges of the game and of the focused vertex', () => {
    const b = drawnScene('F4', [1, 2, 3], 5);
    expect(b.scene.edgeMode).toBe('game-and-focus');
    expect(b.scene.dots).toHaveLength(resolveGoldenPath('types.F4.weyl_order') as number);
    expect(b.scene.width * CM_PER_PX).toBeGreaterThan(MAX_WIDTH_CM);
    expect(b.scene.edges.length).toBeGreaterThan(3);
    const { text } = checkAgainstScene(b);
    expect(weylScale(b.scene.width)).toBe(MAX_WIDTH_CM / b.scene.width);
    expect(text).toContain('\\node[circle,draw,inner sep=1pt] (n0) at (');
  });

  it('nothing drawn gives null (the notice), and an edge to a vertex not drawn is refused, never dropped', () => {
    expect(weylLatex({ width: 100, dots: [], edges: [] })).toBeNull();
    const choice = weylLatex({ width: 100, dots: [{ k: 4, x: 10, y: 10 }], edges: [{ from: 4, to: 7 }] });
    expect(() => exportLaTeX('tikz-graph', choice!.data)).toThrow(RangeError);
  });
});
