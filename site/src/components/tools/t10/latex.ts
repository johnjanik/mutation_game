// T10's "Export LaTeX": the projection as drawn, as plain TikZ coordinates (SPEC.md 6.7 "Orbit graphs and
// projections are exported as plain TikZ coordinates"; 4.0 Share and export; the tikz-points form of
// decisions/P6-A5.md). Written by P6-tikz for the owner of T10 (P4-A3). Pure: no DOM, no engine; export.ts
// is imported for its types only, since ToolFrame fetches that module on the click (7.6).
//
// What is written (plan, decisions/P6-tikz.md): the picture the canvas drew last (t10/drawing.ts
// buildPicture, the scene of P4-A2's projector in CSS pixels, y down), centred on the middle of its box,
// converted to centimetres with y up and scaled down when the box is larger than MAX_ACROSS_CM: every point
// drawn (the vertices, then the short roots when shown), then the edges drawn at rest in the drawn order
// (the scene's far to near order; none above the cap of edges at rest, as canvasScene's selectSegments).
// The studio draws no label on a point, so none is written.
import type { LatexChoice, TikzPointsData } from '../../../lib/export';

/** Centimetres per CSS pixel (96 CSS pixels to the inch). */
export const CM_PER_PX = 2.54 / 96;
/** The largest side of the picture, in centimetres (plan: about the text width of an A4 page). */
export const MAX_ACROSS_CM = 16;

/** The part of a drawn picture (t10/drawing.ts Picture) that the export reads. */
export interface DrawnPicture {
  scene: {
    width: number;
    height: number;
    points: readonly { readonly x: number; readonly y: number }[];
    segments: readonly { readonly a: number; readonly b: number }[];
  };
}

/** The scale from CSS pixels to centimetres: natural size (96 per inch), shrunk to MAX_ACROSS_CM when larger. */
export function projectionScale(width: number, height: number): number {
  const side = Math.max(width, height);
  return side * CM_PER_PX > MAX_ACROSS_CM ? MAX_ACROSS_CM / side : CM_PER_PX;
}

/**
 * What Export LaTeX writes for the picture as drawn; `edgesAtRest` is the cap above which no edge is drawn
 * (CAPS.edgesAtRest). Null when nothing has been drawn (ToolFrame then shows its notice).
 */
export function projectionLatex(p: DrawnPicture | null, edgesAtRest: number): LatexChoice | null {
  if (p === null || p.scene.points.length === 0) return null;
  const { width, height, points, segments } = p.scene;
  const s = projectionScale(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const data: TikzPointsData = {
    points: points.map((q) => [(q.x - cx) * s, -(q.y - cy) * s]),
    edges: segments.length > edgesAtRest ? [] : segments.map((e) => [e.a, e.b]),
  };
  return { kind: 'tikz-points', data };
}
