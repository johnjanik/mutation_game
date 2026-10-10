// Layouts and the size rule (SPEC.md 6.1, 7.5 A-7). Pure functions. Phase 0 needs only the row
// layout; P1-A3's draw/layouts.ts supplies D, E, affine, twisted, polygon and custom layouts later,
// in the same GridLayout shape.
import type { GridLayout } from './types';

/** The row families A, B, C, F, G: the node with label l at (l, 0) (6.1). */
export function rowLayout(board: { n: number; labels: readonly number[] }): GridLayout {
  const xy = board.labels.map((l) => [l, 0] as const);
  return { xy, columns: board.n, rows: 1, kind: 'row' };
}

/** A layout from explicit grid coordinates; columns and rows are the extent of the drawing. */
export function layoutFrom(xy: readonly (readonly [number, number])[], kind: GridLayout['kind']): GridLayout {
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const columns = Math.max(...xs) - Math.min(...xs) + 1;
  const rows = Math.max(...ys) - Math.min(...ys) + 1;
  return { xy, columns, rows, kind };
}

/** One grid unit in CSS pixels: u = min(64, floor((W - 16) / k)) (6.1). */
export function gridUnit(W: number, k: number): number {
  return Math.min(64, Math.floor((W - 16) / k));
}

/** The side of a node's square hit area: min(44, u) (6.1, A-7). */
export function hitSide(u: number): number {
  return Math.min(44, u);
}

/**
 * Node centres in the drawing's coordinates, one grid unit per unit, half a unit of margin
 * on every side. The flip from y-up (grid) to y-down (SVG) happens here and nowhere else.
 */
export function drawingCentres(layout: GridLayout): [number, number][] {
  const minX = Math.min(...layout.xy.map((p) => p[0]));
  const maxY = Math.max(...layout.xy.map((p) => p[1]));
  return layout.xy.map(([x, y]) => [x - minX + 0.5, maxY - y + 0.5]);
}
