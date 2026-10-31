// T12's "Export LaTeX": the orbit of omega_i as drawn in layers, as plain TikZ coordinates (SPEC.md 6.7 "Orbit
// graphs and projections are exported as plain TikZ coordinates"; 4 T12 "the orbit drawn in layers with edges
// coloured by node"; the tikz-graph form of decisions/P6-A5.md, written the way T2 writes its garden,
// t02/latex.ts). Written by RT-FIX-P6-latex (finding P6-RT-10-01) for the owner of T12 (P5-A2). Pure: no DOM,
// no engine, no import at run time (export.ts for its types only). T12RepresentationBuilder.svelte fetches this
// module with import() on the click of Export LaTeX, together with export.ts, so no route fetches it before
// (7.6); the component hands it the orbit, the geometry of the drawing and its label order, so that the work
// is done here, after the click.
//
// What is written (plan, decisions/RT-FIX-P6-latex.md): every vertex of the orbit, in the order of the drawing
// (OrbitLayers.svelte, the order of the data-vertex hooks), at the centre of its box (orbitGeometry) converted
// from CSS pixels, y down, to centimetres with y up, scaled down when wider than 16 cm (the scale of
// t02/latex.ts); each labelled with its position in label order, every digit, ASCII hyphen-minus and commas
// (the drawing's text without the parentheses and the basis index after #); then every edge in the drawn
// order, undirected, as drawn: a line with no arrowhead, layer 0 on top. The edge colours, the node labels on
// the edges and the dash of an edge that is no entry of E or F are not written (decisions/P6-tikz.md, what the
// TikZ form leaves out). The component answers null itself when the orbit is not drawn.
import type { LatexChoice, TikzGraphData } from '../../../lib/export';

/** Centimetres per CSS pixel (96 CSS pixels to the inch), as t02/latex.ts. */
export const CM_PER_PX = 2.54 / 96;
/** The widest picture, in centimetres, as t02/latex.ts (plan: about the text width of an A4 page). */
export const MAX_WIDTH_CM = 16;

/** The scale from CSS pixels to centimetres: natural size, shrunk to MAX_WIDTH_CM when wider. */
export function orbitScale(width: number): number {
  return width * CM_PER_PX > MAX_WIDTH_CM ? MAX_WIDTH_CM / width : CM_PER_PX;
}

/** The part of the drawn orbit (t12/rep.ts OrbitLayers) that the export reads. */
export interface DrawnOrbit {
  /** The vertices in the drawn order, each with its position (numbers by position). */
  vertices: readonly { readonly values: readonly number[] }[];
  /** The edges drawn, in the drawn order, as vertex indices. */
  edges: readonly { readonly from: number; readonly to: number }[];
}

/** The geometry of the drawing (OrbitLayers.svelte orbitGeometry): its width and each box's centre, CSS pixels, y down. */
export interface OrbitGeometry {
  width: number;
  cx: (v: number) => number;
  cy: (v: number) => number;
}

/** The label of a vertex: its entries joined by commas, with the ASCII hyphen-minus (never U+2212). */
export function orbitVertexLabel(entries: readonly (number | string)[]): string {
  return entries.map((e) => String(e).replace(/−/g, '-')).join(',');
}

/**
 * What Export LaTeX writes for the orbit as drawn; `inLabelOrder` gives a position's entries in label order
 * (t12/rep.ts inLabelOrder on the board). Null when nothing is drawn (ToolFrame then shows its notice).
 */
export function orbitLatex(o: DrawnOrbit, g: OrbitGeometry, inLabelOrder: (values: readonly number[]) => readonly number[]): LatexChoice | null {
  if (o.vertices.length === 0) return null;
  const s = orbitScale(g.width);
  const nodes: TikzGraphData['nodes'] = o.vertices.map((v, k) => ({ x: g.cx(k) * s, y: -g.cy(k) * s, label: orbitVertexLabel(inLabelOrder(v.values)) }));
  const edges: TikzGraphData['edges'] = o.edges.map((e) => [e.from, e.to]);
  const data: TikzGraphData = { nodes, edges, directed: false };
  return { kind: 'tikz-graph', data };
}
