// T12's "Export LaTeX": the orbit of omega_i as drawn in layers, as plain TikZ coordinates (SPEC.md 6.7 "Orbit
// graphs and projections are exported as plain TikZ coordinates"; 4 T12 "the orbit drawn in layers with edges
// coloured by node"; the tikz-graph form of decisions/P6-A5.md, written the way T2 writes its garden,
// t02/latex.ts). Written by RT-FIX-P6-latex (finding P6-RT-10-01) for the owner of T12 (P5-A2). Pure: no DOM,
// no engine, no import at run time (export.ts for its types only). T12RepresentationBuilder.svelte fetches this
// module with import() on the click of Export LaTeX, together with export.ts, so no route fetches it before (7.6).
//
// What is written (plan, decisions/RT-FIX-P6-latex.md): every vertex of the orbit, in the order of the drawing
// (OrbitLayers.svelte, the order of the data-vertex hooks), at the centre of its box (orbitGeometry) converted
// from CSS pixels, y down, to centimetres with y up, scaled down when wider than 16 cm (the scale of
// t02/latex.ts); each labelled with its position in label order, every digit, ASCII hyphen-minus and commas
// (the drawing's text without the basis index after #); then every edge in the drawn order, undirected, as
// drawn: a line with no arrowhead, layer 0 on top. The edge colours, the node labels on the edges and the dash
// of an edge that is no entry of E or F are not written (decisions/P6-tikz.md, what the TikZ form leaves out).
// Null when the orbit is not drawn (more than DRAW_MAX positions, or no matrices built).
import type { LatexChoice, TikzGraphData } from '../../../lib/export';

/** Centimetres per CSS pixel (96 CSS pixels to the inch), as t02/latex.ts. */
export const CM_PER_PX = 2.54 / 96;
/** The widest picture, in centimetres, as t02/latex.ts (plan: about the text width of an A4 page). */
export const MAX_WIDTH_CM = 16;

/** The scale from CSS pixels to centimetres: natural size, shrunk to MAX_WIDTH_CM when wider. */
export function orbitScale(width: number): number {
  return width * CM_PER_PX > MAX_WIDTH_CM ? MAX_WIDTH_CM / width : CM_PER_PX;
}

/** The orbit as drawn: what T12RepresentationBuilder.svelte passes at the click. */
export interface OrbitPicture {
  /** The width of the drawing in CSS pixels (orbitGeometry). */
  width: number;
  /** The centre of each vertex's box in CSS pixels, y down, indexed like OrbitLayers.vertices. */
  cx: readonly number[];
  cy: readonly number[];
  /** The entries of each vertex in label order, decimal text. */
  entries: readonly (readonly string[])[];
  /** The edges drawn, in the drawn order, as vertex indices (OrbitLayers.edges). */
  edges: readonly { readonly from: number; readonly to: number }[];
}

/** The label of a vertex: its entries joined by commas, with the ASCII hyphen-minus (never U+2212). */
export function orbitVertexLabel(entries: readonly string[]): string {
  return entries.map((e) => e.replace(/−/g, '-')).join(',');
}

/** What Export LaTeX writes for the orbit as drawn; null when nothing is drawn (ToolFrame then shows its notice). */
export function orbitLatex(d: OrbitPicture): LatexChoice | null {
  const count = d.entries.length;
  if (count === 0) return null;
  const s = orbitScale(d.width);
  const nodes: TikzGraphData['nodes'] = [];
  for (let k = 0; k < count; k++) nodes.push({ x: d.cx[k]! * s, y: -d.cy[k]! * s, label: orbitVertexLabel(d.entries[k]!) });
  const edges: TikzGraphData['edges'] = d.edges.map((e) => [e.from, e.to]);
  const data: TikzGraphData = { nodes, edges, directed: false };
  return { kind: 'tikz-graph', data };
}
