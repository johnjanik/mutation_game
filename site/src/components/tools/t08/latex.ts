// T8's "Export LaTeX": the graph of positions as drawn, as plain TikZ coordinates (SPEC.md 6.7 "Orbit graphs
// and projections are exported as plain TikZ coordinates"; 4 T8 "drawn in layers by the number of moves"; the
// tikz-graph form of decisions/P6-A5.md, written the way T2 writes its garden, t02/latex.ts). Written by
// RT-FIX-P6-latex (finding P6-RT-10-01) for the owner of T8 (P3-A6). Pure: no DOM, no engine, no import at run
// time (export.ts for its types only). T08WeylExplorer.svelte fetches this module with import() on the click
// of Export LaTeX, together with export.ts, so no route fetches it before (7.6).
//
// What is written (plan, decisions/RT-FIX-P6-latex.md): the dots of the scene (layout.ts buildScene), in its
// order (model.drawn, the order of the data-out="vertex" hooks), at their centres converted from CSS pixels,
// y down, to centimetres with y up, scaled down when wider than 16 cm (the scale of t02/latex.ts); no label,
// since the dots carry none; then the edges of the scene in its order (every legal move up to 192 elements,
// else the moves along the game and at the focused vertex), undirected, as drawn: a line with no arrowhead,
// the layers showing the direction. The edge colours and the node labels on the edges are not written
// (decisions/P6-tikz.md, what the TikZ form leaves out).
import type { LatexChoice, TikzGraphData } from '../../../lib/export';

/** Centimetres per CSS pixel (96 CSS pixels to the inch), as t02/latex.ts. */
export const CM_PER_PX = 2.54 / 96;
/** The widest picture, in centimetres, as t02/latex.ts (plan: about the text width of an A4 page). */
export const MAX_WIDTH_CM = 16;

/** The scale from CSS pixels to centimetres: natural size, shrunk to MAX_WIDTH_CM when wider. */
export function weylScale(width: number): number {
  return width * CM_PER_PX > MAX_WIDTH_CM ? MAX_WIDTH_CM / width : CM_PER_PX;
}

/** The part of the scene (layout.ts Scene) that the export reads. */
export interface WeylDrawing {
  /** The width of the drawing in CSS pixels. */
  width: number;
  /** The dots drawn, in the drawn order: the vertex (item index) and its centre in CSS pixels, y down. */
  dots: readonly { readonly k: number; readonly x: number; readonly y: number }[];
  /** The edges drawn, in the drawn order, each by its index into the model's edges. */
  edges: readonly { readonly k: number }[];
}

/**
 * What Export LaTeX writes for the graph as drawn; `modelEdges` is the model's list of edges (graph.ts
 * WeylModel.edges, item indices) that the scene's edges index. Null when nothing is drawn (ToolFrame then
 * shows its notice).
 */
export function weylLatex(d: WeylDrawing, modelEdges: readonly { readonly from: number; readonly to: number }[]): LatexChoice | null {
  if (d.dots.length === 0) return null;
  const s = weylScale(d.width);
  const at = new Map<number, number>();
  const nodes: TikzGraphData['nodes'] = d.dots.map((dot, i) => {
    at.set(dot.k, i);
    return { x: dot.x * s, y: -dot.y * s };
  });
  // An end that is not a dot drawn stays -1, which exportLaTeX refuses (RangeError) rather than drop the edge.
  const edges: TikzGraphData['edges'] = d.edges.map((e) => {
    const m = modelEdges[e.k];
    return [m === undefined ? -1 : (at.get(m.from) ?? -1), m === undefined ? -1 : (at.get(m.to) ?? -1)];
  });
  const data: TikzGraphData = { nodes, edges, directed: false };
  return { kind: 'tikz-graph', data };
}
