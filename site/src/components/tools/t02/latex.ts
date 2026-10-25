// T2's "Export LaTeX": the orbit garden as drawn, as plain TikZ coordinates (SPEC.md 6.7 "Orbit graphs and
// projections are exported as plain TikZ coordinates"; 4.0 Share and export, Long numbers; the tikz-graph
// form of decisions/P6-A5.md). Written by P6-tikz for the owner of T2 (P1-A6). Pure: no DOM, no engine;
// export.ts is imported for its types only, since ToolFrame fetches that module on the click (7.6).
//
// What is written (plan, decisions/P6-tikz.md): the vertices drawn, in the order of the drawing, at the
// centres of the layered layout (t02/drawing.ts) converted from SVG units (CSS pixels, y down) to
// centimetres with y up, scaled down when wider than MAX_WIDTH_CM; each vertex labelled, when the drawing
// labels it, with its population or numbers in label order, every digit, ASCII hyphen-minus and commas;
// then the edges drawn, in the drawn order, undirected (the drawing shows each move once, as a line with
// no arrowhead: a move is an involution).
import type { LatexChoice, TikzGraphData } from '../../../lib/export';

/** Centimetres per CSS pixel (96 CSS pixels to the inch). */
export const CM_PER_PX = 2.54 / 96;
/** The widest picture, in centimetres (plan: about the text width of an A4 page). */
export const MAX_WIDTH_CM = 16;

/** The garden as drawn: what T02OrbitGarden.svelte passes at the click. */
export interface GardenDrawing {
  /** Centre of each vertex in SVG units (CSS pixels, y down): drawGarden's cx and cy. */
  cx: readonly number[];
  cy: readonly number[];
  /** The width of the drawing in SVG units: drawGarden's width. */
  width: number;
  /** The entries of each vertex in label order, decimal text (arith.show). */
  entries: readonly (readonly string[])[];
  /** The edges drawn, in the drawn order, as vertex indices. */
  edges: readonly { readonly from: number; readonly to: number }[];
  /** Whether the drawing labels its vertices (at most 300 positions and the labels toggle on). */
  labelled: boolean;
}

/** The scale from SVG units to centimetres: natural size (96 per inch), shrunk to MAX_WIDTH_CM when wider. */
export function gardenScale(width: number): number {
  return width * CM_PER_PX > MAX_WIDTH_CM ? MAX_WIDTH_CM / width : CM_PER_PX;
}

/** The label of a vertex: its entries joined by commas, with the ASCII hyphen-minus (never U+2212). */
export function vertexLabel(entries: readonly string[]): string {
  return entries.map((e) => e.replace(/−/g, '-')).join(',');
}

/** What Export LaTeX writes for the garden as drawn; null when nothing is drawn (ToolFrame then shows its notice). */
export function gardenLatex(d: GardenDrawing): LatexChoice | null {
  const count = d.entries.length;
  if (count === 0) return null;
  const s = gardenScale(d.width);
  const nodes: TikzGraphData['nodes'] = [];
  for (let k = 0; k < count; k++) {
    const x = d.cx[k]! * s;
    const y = -d.cy[k]! * s;
    nodes.push(d.labelled ? { x, y, label: vertexLabel(d.entries[k]!) } : { x, y });
  }
  const edges: TikzGraphData['edges'] = d.edges.map((e) => [e.from, e.to]);
  const data: TikzGraphData = { nodes, edges, directed: false };
  return { kind: 'tikz-graph', data };
}
