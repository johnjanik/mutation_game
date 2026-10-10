// The geometry of the garden drawing and its keyboard model (SPEC.md 4 T2 "Size"; 6.3; 7.5 A-1, A-5,
// A-7, A-11; 7.6). Pure and deterministic, so the server render and the hydrated render agree. The
// layout is P1-A3's layeredLayout (no graph library, 7.1); this module turns its integer grid into
// pixels, sized so that every vertex is a target of at least 24 by 24 pixels (44 by 44 when labels are
// shown) with no overlap, and the box scrolls instead of shrinking the targets (A-11).
import { layeredLayout } from '../../draw/layeredLayout';

export interface DrawInput {
  /** One distinct key per vertex (the entries joined by commas). */
  keys: readonly string[];
  /** The layer of each vertex: its depth, or its total in the positive view. */
  rank: readonly number[];
  /** Vertex index pairs, for the ordering within layers. */
  edges: readonly (readonly [number, number])[];
  /** The text of each vertex when labels are drawn; ignored for dots. */
  texts: readonly string[];
  /** Labels drawn (at most CAPS.gardenDrawEverything positions and the toggle on) or dots. */
  labelled: boolean;
}

export interface DrawLayout {
  /** Centre of each vertex in pixels. */
  cx: number[];
  cy: number[];
  /** Size of a vertex's button in pixels. */
  w: number;
  h: number;
  width: number;
  height: number;
  /** order[r]: vertices of layer r from left to right (empty for an unoccupied rank). */
  order: number[][];
  rank: number[];
}

/** Width of a numeral character of the monospaced stack at 14 pixels, rounded up (plan). */
const CHAR_PX = 8.5;
const PAD = 12;

/** The pixel geometry of the garden. */
export function drawGarden(input: DrawInput): DrawLayout {
  const lay = layeredLayout({ keys: input.keys, rank: input.rank, edges: input.edges });
  let w: number;
  let h: number;
  let cw: number;
  let rh: number;
  if (input.labelled) {
    const longest = input.texts.reduce((m, t) => Math.max(m, t.length), 1);
    w = Math.max(44, Math.ceil(longest * CHAR_PX) + 16);
    h = 44;
    cw = w + 12;
    rh = 92;
  } else {
    w = 24;
    h = 24;
    cw = 30;
    rh = 64;
  }
  const cx = lay.x.map((x) => PAD + x * cw + cw / 2);
  const cy = lay.y.map((y) => PAD + y * rh + rh / 2);
  const width = 2 * PAD + Math.max(1, lay.widestRank) * cw;
  const height = 2 * PAD + Math.max(1, lay.rankCount) * rh;
  return { cx, cy, w, h, width, height, order: lay.order, rank: lay.y };
}

/** The offsets of the parallel lines of an edge with 1, 2 or 3 lines (the rise in the positive view). */
export function lineOffsets(lines: number): number[] {
  if (lines <= 1) return [0];
  if (lines === 2) return [-2.5, 2.5];
  return [-4, 0, 4];
}

/**
 * A line from (x1, y1) to (x2, y2) shifted sideways by `offset` pixels (for double and triple lines,
 * and for two parallel edges between the same two positions).
 */
export function shifted(x1: number, y1: number, x2: number, y2: number, offset: number): [number, number, number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * offset;
  const oy = (dx / len) * offset;
  const r = (v: number): number => Math.round(v * 100) / 100;
  return [r(x1 + ox), r(y1 + oy), r(x2 + ox), r(y2 + oy)];
}

export type VertexKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/**
 * The keyboard model of the garden (plan reading of A-1): Left and Right move within a layer in
 * drawn order, stopping at the ends; Up and Down move to the vertex of the nearest occupied layer above
 * or below whose centre is nearest in x (ties to the left); Home and End go to the first and the last
 * vertex in the order of `items`. Returns the vertex to focus, or `from` when there is none.
 */
export function nextVertex(layout: DrawLayout, from: number, key: VertexKey, count: number): number {
  if (count === 0) return from;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const r = layout.rank[from]!;
  const row = layout.order[r]!;
  const at = row.indexOf(from);
  if (key === 'ArrowLeft') return at > 0 ? row[at - 1]! : from;
  if (key === 'ArrowRight') return at < row.length - 1 ? row[at + 1]! : from;
  const step = key === 'ArrowUp' ? -1 : 1;
  for (let q = r + step; q >= 0 && q < layout.order.length; q += step) {
    const other = layout.order[q]!;
    if (other.length === 0) continue;
    let best = other[0]!;
    for (const v of other) if (Math.abs(layout.cx[v]! - layout.cx[from]!) < Math.abs(layout.cx[best]! - layout.cx[from]!)) best = v;
    return best;
  }
  return from;
}
