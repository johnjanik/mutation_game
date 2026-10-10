// Node positions of SPEC.md 6.1, in grid units with y pointing up, indexed by position. Every tool
// draws a board through nodePositions so that a board looks the same everywhere. Pure and
// DOM-free: no random source, no locale, so the server render and the hydrated render agree.
//
// The table of 6.1 speaks of labels (E-7): 1..n on finite, pentagon, square and custom boards;
// 0..n on untwisted affine and twisted boards (node 0 first). Coordinates are looked up by
// board.labels[k], never by position plus one.
//
// Not implemented: the H_n row of the table (phase 7, not this agent's). A board named "H3" is not
// recognised and is laid out as a custom board until then.
import type { AnyBoard } from '@two-games/engine';
import type { GridLayout } from '../board/types';

/** P0-A5's GridLayout plus `circle`: true when the nodes sit on the unit circle (polygon radius applies). */
export interface DrawLayout extends GridLayout {
  circle: boolean;
}

/** What nodePositions reads from a board; a structural Pick so tests can pass plain objects. */
export type LayoutBoard = Pick<AnyBoard, 'n' | 'labels' | 'name' | 'cartan'>;

type Pt = readonly [number, number];
type Coords = Map<number, Pt>;

/** Corner k of m on the unit circle, clockwise from the top with y up (plan). */
function corner(k: number, m: number): Pt {
  const t = (2 * Math.PI * k) / m;
  const clean = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : v);
  return [clean(Math.sin(t)), clean(Math.cos(t))];
}

/** Labels in increasing order on the circle: the smallest at the top, the rest clockwise. */
function circleCoords(labels: readonly number[]): Coords {
  const sorted = [...labels].sort((a, b) => a - b);
  const out: Coords = new Map();
  sorted.forEach((l, k) => out.set(l, corner(k, sorted.length)));
  return out;
}

/** The finite rows of the table, by label. Null when the family does not allow the rank. */
function finiteCoords(letter: string, n: number): Coords | null {
  const out: Coords = new Map();
  switch (letter) {
    case 'A':
    case 'B':
    case 'C':
    case 'F':
    case 'G':
      if ((letter === 'B' || letter === 'C') && n < 2) return null;
      if (letter === 'F' && n !== 4) return null;
      if (letter === 'G' && n !== 2) return null;
      if (n < 1) return null;
      for (let i = 1; i <= n; i++) out.set(i, [i, 0]);
      return out;
    case 'D':
      if (n < 4) return null;
      for (let i = 1; i <= n - 2; i++) out.set(i, [i, 0]);
      out.set(n - 1, [n - 1, 0.6]);
      out.set(n, [n - 1, -0.6]);
      return out;
    case 'E':
      if (n < 6 || n > 8) return null;
      out.set(1, [1, 0]);
      out.set(2, [3, 1]);
      for (let l = 3; l <= n; l++) out.set(l, [l - 1, 0]);
      return out;
    default:
      return null;
  }
}

interface Family {
  coords: Coords;
  kind: 'row' | 'polygon';
  circle: boolean;
}

function num(v: number | bigint | undefined): number {
  return v === undefined ? 0 : Number(v);
}

/**
 * B2~ and C2~ (golden affine.B2 is named C2~ with the B2 numbering): the rule follows the matrix.
 * Node 0 joined to label 2 only: the B~ rule; joined to label 1 only: the C~ rule; else null.
 */
function rank2Rule(board: LayoutBoard): 'B' | 'C' | null {
  const pos = (l: number): number => board.labels.indexOf(l);
  const [p0, p1, p2] = [pos(0), pos(1), pos(2)];
  if (p0 < 0 || p1 < 0 || p2 < 0) return null;
  const C = board.cartan as readonly (readonly (number | bigint)[])[];
  const joined = (a: number, b: number): boolean => num(C[a]?.[b]) !== 0 || num(C[b]?.[a]) !== 0;
  const to1 = joined(p0, p1);
  const to2 = joined(p0, p2);
  if (to2 && !to1) return 'B';
  if (to1 && !to2) return 'C';
  return null;
}

/** The untwisted affine rows of the table: the finite board of rank r plus node 0. */
function affineCoords(letter: string, r: number, board: LayoutBoard): Family | null {
  if (letter === 'A') {
    if (r === 1) return { coords: new Map([[0, [0, 0]], [1, [1, 0]]]), kind: 'row', circle: false };
    if (r < 2) return null;
    return { coords: circleCoords(Array.from({ length: r + 1 }, (_, k) => k)), kind: 'polygon', circle: true };
  }
  let rule = letter;
  if (r === 2 && (letter === 'B' || letter === 'C')) rule = rank2Rule(board) ?? letter;
  const base = finiteCoords(letter, r);
  if (base === null) return null;
  const coords: Coords = new Map(base);
  switch (rule) {
    case 'B':
      coords.set(0, [2, 1]);
      break;
    case 'C':
      coords.set(0, [0, 0]);
      break;
    case 'D':
      coords.set(1, [1, -0.6]);
      coords.set(0, [1, 0.6]);
      break;
    case 'E':
      if (r === 6) coords.set(0, [3, 2]);
      else if (r === 7) coords.set(0, [0, 0]);
      else coords.set(0, [8, 0]);
      break;
    case 'F':
      coords.set(0, [0, 0]);
      break;
    case 'G':
      coords.set(0, [3, 0]);
      break;
    default:
      return null;
  }
  return { coords, kind: 'row', circle: false };
}

/**
 * The untwisted board a twisted name reverses (SPEC 2.12; golden twisted_affine `reverse_of`):
 * A{2n-1}^(2) reverses B_n~, D{n+1}^(2) reverses C_n~, E6^(2) reverses F4~, D4^(3) reverses G2~.
 * A{2n}^(2) reverses nothing and is the row (i, 0) for i = 0..n. Null for any other name.
 */
export function twistedLayoutSource(name: string): { row: number } | { letter: string; rank: number } | null {
  const m = /^([ADE])([1-9][0-9]*)\^\(([23])\)$/.exec(name);
  if (m === null) return null;
  const [, letter, sub, twist] = m as unknown as [string, string, string, string];
  const s = Number(sub);
  if (twist === '3') return letter === 'D' && s === 4 ? { letter: 'G', rank: 2 } : null;
  if (letter === 'A') {
    if (s % 2 === 0) return { row: s / 2 };
    const n = (s + 1) / 2;
    return n >= 3 ? { letter: 'B', rank: n } : null;
  }
  if (letter === 'D') return s >= 3 ? { letter: 'C', rank: s - 1 } : null;
  if (letter === 'E') return s === 6 ? { letter: 'F', rank: 4 } : null;
  return null;
}

/** The layout family a board's name selects, or null for a custom board. */
function familyOf(board: LayoutBoard): Family | null {
  const name = board.name;
  if (name === undefined) return null;
  if ((name === 'pentagon' && board.n === 5) || (name === 'square' && board.n === 4)) {
    return { coords: circleCoords(board.labels), kind: 'polygon', circle: true };
  }
  const finite = /^([A-G])([1-9][0-9]*)$/.exec(name);
  if (finite !== null) {
    const coords = finiteCoords(finite[1]!, Number(finite[2]));
    return coords === null ? null : { coords, kind: 'row', circle: false };
  }
  const affine = /^([A-G])([1-9][0-9]*)~$/.exec(name);
  if (affine !== null) return affineCoords(affine[1]!, Number(affine[2]), board);
  const twisted = twistedLayoutSource(name);
  if (twisted !== null) {
    if ('row' in twisted) {
      const coords: Coords = new Map();
      for (let i = 0; i <= twisted.row; i++) coords.set(i, [i, 0]);
      return { coords, kind: 'row', circle: false };
    }
    return affineCoords(twisted.letter, twisted.rank, board);
  }
  return null;
}

/** Grid coordinates that obey the rule of 6.1 for custom boards, else null. */
function validCustomXy(n: number, xy: readonly (readonly [number, number])[] | undefined): Pt[] | null {
  if (xy === undefined || xy.length !== n) return null;
  const seen = new Set<string>();
  for (const p of xy) {
    if (!Array.isArray(p) || p.length !== 2) return null;
    const [x, y] = p;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    if (x < 0 || x > 11 || y < 0 || y > 11) return null;
    const key = `${x},${y}`;
    if (seen.has(key)) return null;
    seen.add(key);
  }
  return xy.map((p) => [p[0], p[1]] as const);
}

function extent(xy: readonly Pt[]): { columns: number; rows: number } {
  if (xy.length === 0) return { columns: 1, rows: 1 };
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  return { columns: Math.max(...xs) - Math.min(...xs) + 1, rows: Math.max(...ys) - Math.min(...ys) + 1 };
}

function build(xy: Pt[], kind: GridLayout['kind'], circle: boolean): DrawLayout {
  return { xy, ...extent(xy), kind, circle };
}

/**
 * The grid coordinates of every node by the table of SPEC 6.1, indexed by position, with the
 * layout kind (A-1's arrow-key model), the number of columns (k of the size rule) and the rows.
 * Never throws: a board without a recognised name, or whose labels do not fit its name, is a custom
 * board, placed at `xy` when that obeys the rule of 6.1 (whole grid points, all different, 0 to 11
 * in each direction, one per node; y up like the table) and otherwise on the circle in label order.
 * Reads board.cartan only to tell the two numberings of B2~ and C2~ apart.
 */
export function nodePositions(board: LayoutBoard, xy?: readonly (readonly [number, number])[]): DrawLayout {
  const family = familyOf(board);
  if (family !== null && family.coords.size === board.n) {
    const placed = board.labels.map((l) => family.coords.get(l));
    if (placed.every((p) => p !== undefined) && new Set(board.labels).size === board.n) {
      return build(placed as Pt[], family.kind, family.circle);
    }
  }
  const custom = validCustomXy(board.n, xy);
  if (custom !== null) return build(custom, 'custom', false);
  const circle = circleCoords(board.labels);
  return build(
    board.labels.map((l) => circle.get(l)!),
    'custom',
    true,
  );
}
