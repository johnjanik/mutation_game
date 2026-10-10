// The geometry of T8's graph and its scene (SPEC.md 4 T8 Size; 6.1; 6.3; 7.1; 7.4; 7.5 A-1, A-5,
// A-7, A-11). Pure and deterministic: the server render, the hydrated render, the SVG snapshot and the
// canvas all start from the same `Scene`. Coordinates come from P1-A3's layeredLayout (rank = number of
// moves, a deterministic order within a rank, the width of the widest rank). Vertices are dots without
// labels; every dot has a square hit area of `hit` pixels (44 where the widest layer fits a 320-pixel
// box at that spacing, 24 otherwise), and neighbouring hit areas never overlap; the box scrolls (A-11).
import { layeredLayout } from '../../draw/layeredLayout';
import { edgeColour } from '../../draw/palette';
import { edgesToDraw, inLabelOrder, pathSteps, type WeylModel } from './graph';

export interface GraphLayout {
  /** Centre of each item in pixels (NaN for an item that is not drawn). */
  cx: number[];
  cy: number[];
  /** Side of the square hit area of a vertex (A-7). */
  hit: number;
  colW: number;
  rowH: number;
  width: number;
  height: number;
  /** order[r]: the drawn items of layer r, left to right. */
  order: number[][];
  /** The layer of each item. */
  rank: number[];
  widest: number;
  layers: number;
}

const PAD = 16;
/** Widest layer that still fits 320 CSS pixels at the 44-pixel spacing (6 x 48 + 2 x 16 = 320). */
const WIDE_AT_44 = 6;

/** Lays out the drawn vertices of the model by layer (number of moves). */
export function layoutGraph(model: WeylModel): GraphLayout {
  const drawn = model.drawn;
  const local = new Map<number, number>();
  drawn.forEach((k, i) => local.set(k, i));
  const edges: [number, number][] = [];
  for (const e of model.edges) {
    const a = local.get(e.from);
    const b = local.get(e.to);
    if (a !== undefined && b !== undefined) edges.push([a, b]);
  }
  const lay = layeredLayout({
    keys: drawn.map((k) => model.keys[k]!),
    rank: drawn.map((k) => model.graph.depth[k]!),
    edges,
  });
  const hit = lay.widestRank <= WIDE_AT_44 ? 44 : 24;
  const colW = hit + 4;
  const rowH = model.edgeMode === 'all' ? 72 : 44;
  const n = model.graph.items.length;
  const cx = Array.from({ length: n }, () => Number.NaN);
  const cy = Array.from({ length: n }, () => Number.NaN);
  drawn.forEach((k, i) => {
    cx[k] = PAD + lay.x[i]! * colW + colW / 2;
    cy[k] = PAD + lay.y[i]! * rowH + rowH / 2;
  });
  return {
    cx,
    cy,
    hit,
    colW,
    rowH,
    width: 2 * PAD + Math.max(1, lay.widestRank) * colW,
    height: 2 * PAD + Math.max(1, lay.rankCount) * rowH,
    order: lay.order.map((row) => row.map((i) => drawn[i]!)),
    rank: model.graph.depth.slice(),
    widest: lay.widestRank,
    layers: lay.rankCount,
  };
}

export type VertexKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export const VERTEX_KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

/**
 * The keyboard model of the graph (plan reading of A-1): Left and Right move within a layer in drawn
 * order, stopping at the ends; Up and Down move to the vertex of the previous or next layer whose
 * centre is nearest in x (ties to the left); Home and End go to the top and the bottom vertex.
 */
export function nextVertex(layout: GraphLayout, from: number, key: VertexKey): number {
  const first = layout.order[0]?.[0];
  if (first === undefined) return from;
  if (key === 'Home') return first;
  if (key === 'End') {
    const last = layout.order[layout.order.length - 1]!;
    return last[0] ?? from;
  }
  const r = layout.rank[from]!;
  const row = layout.order[r] ?? [];
  const at = row.indexOf(from);
  if (key === 'ArrowLeft') return at > 0 ? row[at - 1]! : from;
  if (key === 'ArrowRight') return at >= 0 && at < row.length - 1 ? row[at + 1]! : from;
  const q = r + (key === 'ArrowUp' ? -1 : 1);
  const other = layout.order[q];
  if (other === undefined || other.length === 0) return from;
  let best = other[0]!;
  for (const v of other) if (Math.abs(layout.cx[v]! - layout.cx[from]!) < Math.abs(layout.cx[best]! - layout.cx[from]!)) best = v;
  return best;
}

/** The drawn vertex whose hit area contains the point (x, y) in the drawing's pixels, or null. */
export function hitTest(layout: GraphLayout, x: number, y: number): number | null {
  const r = Math.floor((y - PAD) / layout.rowH);
  const row = layout.order[r];
  if (row === undefined) return null;
  const half = layout.hit / 2;
  for (const v of row) {
    if (Math.abs(layout.cx[v]! - x) <= half && Math.abs(layout.cy[v]! - y) <= half) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The scene: what is drawn, once, for the SVG and the canvas alike
// ---------------------------------------------------------------------------------------------

export interface SceneDot {
  k: number;
  x: number;
  y: number;
  onPath: boolean;
  focus: boolean;
}

export interface SceneEdge {
  /** Index into model.edges. */
  k: number;
  label: number;
  /** The colour token of the label (var(--edge-k)); a canvas resolves it (6.3). */
  colour: string;
  /** Token number 1..8 of the colour. */
  token: number;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Where the label text goes. */
  lx: number;
  ly: number;
  onPath: boolean;
}

export interface Scene {
  width: number;
  height: number;
  name: string;
  /** The text alternative (A-10): board, number of positions, number of layers. */
  label: string;
  dots: SceneDot[];
  edges: SceneEdge[];
  edgeMode: 'all' | 'game-and-focus';
  hit: number;
}

/** "Weyl group of A3: 24 positions in 7 layers ..." (A-10), with the stated limit when cut off. */
export function sceneLabel(model: WeylModel, layout: GraphLayout): string {
  const base = `Graph of the positions reached from all ones on ${model.name} by legal play: ${model.found} positions in ${layout.layers} layers`;
  return model.limit === null ? `${base}.` : `${base}, ${model.limit}.`;
}

function tokenOf(label: number): number {
  const m = /--edge-(\d+)/.exec(edgeColour(label));
  return m ? Number(m[1]) : 8;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** The scene for a path (vertex indices) and a focused vertex. */
export function buildScene(model: WeylModel, layout: GraphLayout, path: readonly (number | null)[], focus: number | null): Scene {
  const onPath = new Set<number>();
  for (const k of path) if (k !== null && k !== undefined) onPath.add(k);
  const steps = pathSteps(path);
  const text = new Map<number, string>();
  const textOf = (k: number): string => {
    let t = text.get(k);
    if (t === undefined) {
      t = inLabelOrder(model.board, model.graph.items[k]!).join(',');
      text.set(k, t);
    }
    return t;
  };
  const dots: SceneDot[] = model.drawn.map((k) => ({ k, x: layout.cx[k]!, y: layout.cy[k]!, onPath: onPath.has(k), focus: k === focus }));
  const edges: SceneEdge[] = edgesToDraw(model, path, focus).map((k) => {
    const e = model.edges[k]!;
    const x1 = layout.cx[e.from]!;
    const y1 = layout.cy[e.from]!;
    const x2 = layout.cx[e.to]!;
    const y2 = layout.cy[e.to]!;
    // The label sits 40 percent of the way down, 7 pixels to the side of the line.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const t = 0.4;
    return {
      k,
      label: e.label,
      colour: edgeColour(e.label),
      token: tokenOf(e.label),
      from: textOf(e.from),
      to: textOf(e.to),
      x1,
      y1,
      x2,
      y2,
      lx: r2(x1 + dx * t + (-dy / len) * 7),
      ly: r2(y1 + dy * t + (dx / len) * 7),
      onPath: steps.has(`${e.from},${e.to}`),
    };
  });
  return {
    width: layout.width,
    height: layout.height,
    name: model.name,
    label: sceneLabel(model, layout),
    dots,
    edges,
    edgeMode: model.edgeMode,
    hit: layout.hit,
  };
}
