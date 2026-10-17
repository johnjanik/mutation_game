// The board editor's model (P2-A3; SPEC 4 T4 Editor, 2.1, 5.6, 6.1). Pure functions on an editor board
// `{ cartan, xy }`: the Cartan matrix in the convention of SPEC 2.1 and one whole grid point per node
// (y up, 0 to 11 in each direction, all different). Every cap of SPEC 5.6 that binds the editor is
// enforced here, not only in the buttons, so that no path of the editor can pass it: at most 12 nodes,
// at least 1 (plan), and 0 to 4 roads each way between two nodes. A refused edit returns null.
//
// Roads and the matrix: A[i][j] roads from node i to node j sit at C[j][i] = -A[i][j] (C = 2I - A^T,
// SPEC 2.1). Positions 0..n-1 are the rows of the matrix; the labels of an edited board are 1..n in
// that order (E-7, "in order of creation").
import { CAPS, boardKind, cartanNumbers } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import { nodePositions } from '../../draw/layouts';
import type { BoardSpec } from '../../../lib/state';

export type GridPoint = [number, number];

/** What the editor edits: the Cartan matrix and one grid point per node, both indexed by position. */
export interface EditorBoard {
  cartan: number[][];
  xy: GridPoint[];
}

/** The largest grid coordinate of SPEC 6.1 ("between 0 and 11 in each direction"). */
export const GRID_MAX = 11;

function copy(b: EditorBoard): EditorBoard {
  return { cartan: b.cartan.map((row) => [...row]), xy: b.xy.map((p) => [p[0], p[1]] as GridPoint) };
}

function key(p: readonly [number, number]): string {
  return `${p[0]},${p[1]}`;
}

/** Whole grid points, all different, 0 to 11, one per node (SPEC 6.1 Custom boards). */
export function validGrid(xy: readonly (readonly [number, number])[] | undefined, n: number): boolean {
  if (xy === undefined || xy.length !== n) return false;
  const seen = new Set<string>();
  for (const p of xy) {
    if (!Array.isArray(p) || p.length !== 2) return false;
    const [x, y] = p;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > GRID_MAX || y > GRID_MAX) return false;
    if (seen.has(key(p))) return false;
    seen.add(key(p));
  }
  return true;
}

/** The nearest free grid point to (x, y) in 0..11, by distance, then y, then x; null when the grid is full. */
function nearestFree(x: number, y: number, taken: Set<string>): GridPoint | null {
  let best: GridPoint | null = null;
  let bestD = Infinity;
  for (let gy = 0; gy <= GRID_MAX; gy++) {
    for (let gx = 0; gx <= GRID_MAX; gx++) {
      if (taken.has(`${gx},${gy}`)) continue;
      const d = (gx - x) ** 2 + (gy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = [gx, gy];
      }
    }
  }
  return best;
}

/**
 * Whole grid points for a drawn layout (plan): rows and branches are rounded and shifted so that the
 * least x and the least y are 0 (the D fork at y = 0.6 and -0.6 becomes 1 and -1, then 2 and 0); a
 * circle is scaled to the smallest whole radius at which the rounded corners are all different. A
 * point that would collide or leave the grid goes to the nearest free point.
 */
export function gridOf(xy: readonly (readonly [number, number])[], circle: boolean): GridPoint[] {
  let pts: GridPoint[];
  if (circle) {
    let chosen: GridPoint[] | null = null;
    for (let r = 1; r <= 5 && chosen === null; r++) {
      const cand = xy.map(([x, y]) => [Math.round(r * x) + r, Math.round(r * y) + r] as GridPoint);
      if (new Set(cand.map(key)).size === cand.length) chosen = cand;
    }
    pts = chosen ?? xy.map(([x, y]) => [Math.round(5 * x) + 5, Math.round(5 * y) + 5] as GridPoint);
  } else {
    pts = xy.map(([x, y]) => [Math.round(x), Math.round(y)] as GridPoint);
    const minX = Math.min(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1]));
    pts = pts.map(([x, y]) => [x - minX, y - minY] as GridPoint);
  }
  const taken = new Set<string>();
  const out: GridPoint[] = [];
  for (const [x, y] of pts) {
    const cx = Math.min(GRID_MAX, Math.max(0, x));
    const cy = Math.min(GRID_MAX, Math.max(0, y));
    const p: GridPoint = taken.has(`${cx},${cy}`) ? (nearestFree(cx, cy, taken) as GridPoint) : [cx, cy];
    taken.add(key(p));
    out.push(p);
  }
  return out;
}

/**
 * The editor board of a BoardSpec and its resolved board (CONTRACTS 4 resolveBoard). The matrix is the
 * board's own (`cartanNumbers`). The coordinates are the spec's `xy` when they obey 6.1; otherwise
 * the layout of 6.1 that P1-A3's nodePositions gives (named layouts, or the circle in label order),
 * turned into whole grid points by gridOf (plan).
 */
export function fromSpec(spec: BoardSpec, board: AnyBoard): EditorBoard {
  const cartan = cartanNumbers(board);
  if (typeof spec !== 'string' && validGrid(spec.xy, board.n)) {
    return { cartan, xy: spec.xy!.map((p) => [p[0], p[1]] as GridPoint) };
  }
  const layout = nodePositions(board, typeof spec === 'string' ? undefined : spec.xy);
  return { cartan, xy: gridOf(layout.xy, layout.circle) };
}

/** The BoardSpec of an edited board: `{ cartan, xy }` (SPEC 6.6). */
export function toSpec(b: EditorBoard): { cartan: number[][]; xy: [number, number][] } {
  const c = copy(b);
  return { cartan: c.cartan, xy: c.xy };
}

/** `boardKind` of the matrix: 'gcm', 'one-way' or 'not-a-board' (the editor never produces the last). */
export function kindOf(b: EditorBoard): 'gcm' | 'one-way' | 'not-a-board' {
  return boardKind(b.cartan);
}

/** The roads between positions i and j: `out` from i to j (A[i][j] = -C[j][i]) and `back` from j to i. */
export function roadsBetween(b: EditorBoard, i: number, j: number): { out: number; back: number } {
  const out = -b.cartan[j]![i]!;
  const back = -b.cartan[i]![j]!;
  return { out: out === 0 ? 0 : out, back: back === 0 ? 0 : back };
}

/** Where a new node goes (plan): right of the last node on its row, else the first free point. */
function newPoint(b: EditorBoard): GridPoint | null {
  const taken = new Set(b.xy.map(key));
  if (b.xy.length > 0) {
    const last = b.xy[b.xy.length - 1]!;
    const maxX = Math.max(...b.xy.filter((p) => p[1] === last[1]).map((p) => p[0]));
    if (maxX + 1 <= GRID_MAX && !taken.has(`${maxX + 1},${last[1]}`)) return [maxX + 1, last[1]];
  }
  for (let y = 0; y <= GRID_MAX; y++) for (let x = 0; x <= GRID_MAX; x++) if (!taken.has(`${x},${y}`)) return [x, y];
  return null;
}

/** Adds a node with no roads (label n + 1), or null at the cap of 12 nodes (5.6: "editor refuses a 13th"). */
export function addNode(b: EditorBoard, maxNodes: number = CAPS.customNodes): EditorBoard | null {
  const cap = Math.min(maxNodes, CAPS.customNodes);
  const n = b.cartan.length;
  if (n >= cap) return null;
  const p = newPoint(b);
  if (p === null) return null;
  const out = copy(b);
  out.cartan = out.cartan.map((row) => [...row, 0]);
  out.cartan.push([...Array.from({ length: n }, () => 0), 2]);
  out.xy.push(p);
  return out;
}

/**
 * Removes the node at position i: its row, its column and its grid point. The labels of the board that
 * remains are 1..n - 1 in the old order (SPEC 4 T4). Null for the last node (plan: the minimum is 1)
 * and for a position that is not on the board.
 */
export function removeNode(b: EditorBoard, i: number): EditorBoard | null {
  const n = b.cartan.length;
  if (n <= 1 || !Number.isInteger(i) || i < 0 || i >= n) return null;
  return {
    cartan: b.cartan.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== i)),
    xy: b.xy.filter((_, k) => k !== i).map((p) => [p[0], p[1]] as GridPoint),
  };
}

/**
 * Sets the roads between positions i and j: `out` roads from i to j and `back` roads from j to i, each a
 * whole number from 0 to 4 (5.6: "editor refuses more"). Writes C[j][i] = -out and C[i][j] = -back
 * (C = 2I - A^T, SPEC 2.1). Null when a count is out of range or i and j are not two nodes.
 */
export function setRoads(b: EditorBoard, i: number, j: number, out: number, back: number, maxRoads: number = CAPS.roadsEachWay): EditorBoard | null {
  const n = b.cartan.length;
  const cap = Math.min(maxRoads, CAPS.roadsEachWay);
  const ok = (v: number): boolean => Number.isInteger(v) && v >= 0 && v <= cap;
  if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= n || j >= n || i === j) return null;
  if (!ok(out) || !ok(back)) return null;
  const c = copy(b);
  c.cartan[j]![i] = out === 0 ? 0 : -out;
  c.cartan[i]![j] = back === 0 ? 0 : -back;
  return c;
}

/**
 * Moves the node at position i to the grid point nearest (x, y): snapped to whole numbers and clamped to
 * 0..11 (6.1). Null when that point holds another node (plan: a taken point is refused, never swapped)
 * or i is not a node. Moving a node onto its own point returns the board unchanged.
 */
export function moveNode(b: EditorBoard, i: number, x: number, y: number): EditorBoard | null {
  const n = b.cartan.length;
  if (!Number.isInteger(i) || i < 0 || i >= n || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const gx = Math.min(GRID_MAX, Math.max(0, Math.round(x)));
  const gy = Math.min(GRID_MAX, Math.max(0, Math.round(y)));
  for (let k = 0; k < n; k++) if (k !== i && b.xy[k]![0] === gx && b.xy[k]![1] === gy) return null;
  const c = copy(b);
  c.xy[i] = [gx, gy];
  return c;
}

/**
 * Whether an edit asks the host to reset `start` and `moves` (SPEC 4 T4: deleting a node does; 4.0 Board
 * pickers: a preset does; plan: adding a node does, since the start has one entry per node; changing
 * roads or moving a node keeps the node count and does not).
 */
export const RESETS_PLAY: Readonly<Record<'add-node' | 'remove-node' | 'roads' | 'move' | 'preset', boolean>> = {
  'add-node': true,
  'remove-node': true,
  roads: false,
  move: false,
  preset: true,
};

/** True when the two editor boards are equal entry by entry. */
export function sameBoard(a: EditorBoard, b: EditorBoard): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** An editor board with n nodes and no roads, in a row (plan; T4's hunter preset builds on it). */
export function emptyBoard(n: number): EditorBoard {
  const cartan = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)));
  return { cartan, xy: Array.from({ length: n }, (_, k) => [k, 0] as GridPoint) };
}
