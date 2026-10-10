// The size rule of SPEC.md 6.1 and the targets of 7.5 A-7: grid units to CSS pixels, hit areas,
// the polygon radius and the box width. Pure; runs in Node and the browser. The flip from the
// table's y-up grid to SVG's y-down happens here, in toPixels, and nowhere else in draw/.
import type { DrawLayout } from './layouts';

/** Pixels of margin on each side of a row or grid layout: the 16 of the size rule, split (plan). */
export const MARGIN = 8;

/** The hit side on a polygon or circle layout (A-7: "Polygon layouts always reach 44"). */
export const POLYGON_HIT = 44;

/** One grid unit in CSS pixels: u = min(64, floor((W - 16) / k)) (6.1). */
export function gridUnit(W: number, k: number): number {
  return Math.min(64, Math.floor((W - 16) / k));
}

/** The side of a node's square hit area on a row or grid layout: min(44, u) (6.1, A-7). */
export function hitSide(u: number): number {
  return Math.min(44, u);
}

/** The radius of the circle a polygon layout is inscribed in: (min(W, 360) - 60) / 2 (6.1). */
export function polygonRadius(W: number): number {
  return (Math.min(W, 360) - 60) / 2;
}

/** W of the size rule: below a viewport of 400 the box runs from edge to edge of the viewport (6.1). */
export function boardBoxWidth(viewport: number, container: number): number {
  return viewport < 400 ? viewport : container;
}

export interface PixelLayout {
  /** Node centres in CSS pixels, y down, indexed by position. */
  centres: [number, number][];
  /** The side of each node's transparent hit square, centred on the node (A-7). */
  hit: number;
  /** The size of the drawing's box, to be reserved in the server HTML (7.6). */
  width: number;
  height: number;
  /** The grid unit used (row and grid layouts), or null on a circle layout. */
  unit: number | null;
}

/**
 * Maps a layout to CSS pixels in a box of width W. Row and grid-placed layouts: one grid unit is
 * gridUnit(W, columns), with MARGIN pixels on each side and half a unit around the outermost
 * centres, so the box is columns * u + 16 wide. Circle layouts: the unit circle is scaled to
 * polygonRadius(W), the hit side is 44 and the box is 2R + 44 + 16 square.
 */
export function toPixels(layout: DrawLayout, W: number): PixelLayout {
  const xs = layout.xy.map((p) => p[0]);
  const ys = layout.xy.map((p) => p[1]);
  if (layout.xy.length === 0) return { centres: [], hit: 0, width: 2 * MARGIN, height: 2 * MARGIN, unit: null };
  if (layout.circle) {
    const R = polygonRadius(W);
    const side = 2 * R + POLYGON_HIT + 2 * MARGIN;
    const c = side / 2;
    return {
      centres: layout.xy.map(([x, y]) => [c + R * x, c - R * y]),
      hit: POLYGON_HIT,
      width: side,
      height: side,
      unit: null,
    };
  }
  const u = gridUnit(W, layout.columns);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  return {
    centres: layout.xy.map(([x, y]) => [MARGIN + (x - minX + 0.5) * u, MARGIN + (maxY - y + 0.5) * u]),
    hit: hitSide(u),
    width: layout.columns * u + 2 * MARGIN,
    height: layout.rows * u + 2 * MARGIN,
    unit: u,
  };
}
