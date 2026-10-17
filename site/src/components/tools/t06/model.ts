// T6, the Kaleidoscope: the pure model (SPEC.md 4 T6, 2.4, 2.5, 2.14; build-plan P3-A4 section 4).
// No DOM. From a board and a state it computes everything the component draws: the current position a
// (replayed from the start and the moves), the population p = C^{-1} a as exact rationals, the display
// strings of both readouts, the line a = Cp as data, the picture of each simple root (the COLUMNS of
// choleskyBasis), the point, the two scaled distances, the parallelogram, the mirrors and chambers,
// the roots and the orbit, the lattice dots in the window, and the snapping of a dragged point.
//
// Exact against float: numbers, populations, fractions and every equality shown are exact (bigint and
// Rational from the engine). Floats are used only to place things in the plane (SPEC 2.14: "Floating
// point enters only in these two recipes"), and every plane coordinate written to markup goes through
// fmt() with DECIMALS decimals, so that the server render and the hydrated render agree.
//
// Positions against labels (E-7): engine calls take positions 0 and 1; everything this module returns
// to the component is in label order (the order of `start`), converted with toLabels and toPositions.
import {
  CAPS,
  EngineOverflow,
  boardFromName,
  cartanNumbers,
  choleskyBasis,
  fire,
  orbit,
  positiveRoots,
  ratToString,
  roots,
  symmetrizer,
  toLabels,
  toNumbers,
  toPopulation,
  toPositions,
} from '@two-games/engine';
import type { Board, Rational } from '@two-games/engine';
import { bigBoard, type ToolState } from '../../../lib/state';
import { speak } from '../../../lib/a11y';
import { isLong, shortValue } from '../t01/longNumber';

// ---------------------------------------------------------------------------------------------
// Boards, overlays, formatting
// ---------------------------------------------------------------------------------------------

/** The four boards of SPEC 4 T6, each under its own name (D19: B2 and C2 both offered). */
export const T06_BOARDS = ['A2', 'B2', 'C2', 'G2'] as const;
export type T06Board = (typeof T06_BOARDS)[number];

export function isT06Board(name: unknown): name is T06Board {
  return typeof name === 'string' && (T06_BOARDS as readonly string[]).includes(name);
}

/** The three optional overlays of SPEC 4 T6 (property `overlays`, plan). */
export const OVERLAYS = ['roots', 'orbit', 'lattices'] as const;
export type Overlay = (typeof OVERLAYS)[number];

export const OVERLAY_NAMES: Readonly<Record<Overlay, string>> = {
  roots: 'All roots',
  orbit: 'Orbit of the point',
  lattices: 'Root lattice and weight lattice',
};

/** Decimals of every plane or screen coordinate written to markup (plan). */
export const DECIMALS = 3;

export type Vec2 = readonly [number, number];

/** A float with DECIMALS decimals; never "-0.000" (normalised to "0.000"). */
export function fmt(x: number): string {
  const t = x.toFixed(DECIMALS);
  return /^-0\.0+$/.test(t) ? t.slice(1) : t;
}

// ---------------------------------------------------------------------------------------------
// Geometry of a board (once per board)
// ---------------------------------------------------------------------------------------------

export interface MirrorLine {
  /** 1-based index of its positive root in positiveRoots order. */
  index: number;
  /** The positive root, in label order. */
  root: number[];
  /** The label of the simple root it is perpendicular to, or 0 for the other mirrors. */
  simple: number;
  /** The normal U q of the root. */
  normal: Vec2;
  /** The two ends of the drawn segment (plane coordinates). */
  from: Vec2;
  to: Vec2;
}

export interface Chamber {
  /** Angles of its two walls, from < to, counterclockwise in the plane. */
  from: number;
  to: number;
  dominant: boolean;
  /** Polygon covering the sector inside the window (plane coordinates). */
  polygon: Vec2[];
}

export interface DrawnRoot {
  /** The root population in label order. */
  root: number[];
  positive: boolean;
  /** Its picture U q. */
  y: Vec2;
}

export interface Geometry {
  name: T06Board;
  /** The board as boardFromName builds it (SafeInt, labels 1 and 2). */
  board: Board<number>;
  /** Labels in increasing order (the order of start, readouts and tables). */
  labels: number[];
  /** Positions of the labels in increasing order. */
  order: number[];
  /** C in positions, as integers (cartanNumbers). */
  cartan: number[][];
  /** C in label order (rows and columns), for the line a = Cp. */
  cartanByLabel: number[][];
  /** d (symmetrizer), by position. */
  d: Rational[];
  /** choleskyBasis(board): rows of U. */
  U: number[][];
  /** The picture of each simple root, by position: column j of U. */
  alpha: Vec2[];
  /** |alpha_j| = sqrt(2 d_j), by position. */
  lengths: number[];
  /** U C^{-1} (floats): column j is the picture of the fundamental weight j. */
  W: number[][];
  /** C U^{-1} (floats): the numbers of a point of the plane. */
  Winv: number[][];
  /** Half side of the drawn window (plane units). */
  R: number;
  roots: DrawnRoot[];
  mirrors: MirrorLine[];
  chambers: Chamber[];
}

const cache = new Map<T06Board, Geometry>();

function inv2(M: readonly (readonly number[])[]): number[][] {
  const [a, b] = M[0]!;
  const [c, d] = M[1]!;
  const det = a! * d! - b! * c!;
  return [
    [d! / det, -b! / det],
    [-c! / det, a! / det],
  ];
}

function mul2(A: readonly (readonly number[])[], B: readonly (readonly number[])[]): number[][] {
  return [0, 1].map((i) => [0, 1].map((j) => A[i]![0]! * B[0]![j]! + A[i]![1]! * B[1]![j]!));
}

function apply2(M: readonly (readonly number[])[], v: readonly number[]): [number, number] {
  return [M[0]![0]! * v[0]! + M[0]![1]! * v[1]!, M[1]![0]! * v[0]! + M[1]![1]! * v[1]!];
}

const ratFloat = (r: Rational): number => Number(r.num) / Number(r.den);

/** The picture U q of a vector of the root lattice given by position (integers or rationals as floats). */
export function picture(g: Geometry, q: readonly number[]): Vec2 {
  return apply2(g.U, q);
}

/** Every number of the geometry of a board, computed once from the engine. */
export function geometry(name: T06Board): Geometry {
  const known = cache.get(name);
  if (known !== undefined) return known;
  if (!isT06Board(name)) throw new RangeError(`T6 offers A2, B2, C2 and G2, not ${String(name)}`);
  const board = boardFromName(name) as Board<number>;
  const labels = [...board.labels].sort((x, y) => x - y);
  const order = toPositions(board, labels);
  const cartan = cartanNumbers(board);
  const cartanByLabel = order.map((i) => order.map((j) => cartan[i]![j]!));
  const d = symmetrizer(board);
  if (d === null) throw new Error(`${name} has no symmetrizer`);
  const U = choleskyBasis(board);
  // Column j is the picture of alpha_(j+1) (oracle docstring); never a row (the transposition trap).
  const alpha: Vec2[] = [0, 1].map((j) => [U[0]![j]!, U[1]![j]!] as const);
  const lengths = alpha.map(([x, y]) => Math.hypot(x, y));
  const W = mul2(U, inv2(cartan));
  const Winv = inv2(W);
  const all = roots(board, CAPS.mainThreadItems).items;
  const pos = positiveRoots(board, CAPS.mainThreadItems);
  const posKeys = new Set(pos.map((q) => q.join(',')));
  const drawn: DrawnRoot[] = all.map((q) => ({
    root: order.map((i) => q[i]!),
    positive: posKeys.has(q.join(',')),
    y: picture({ U } as Geometry, q),
  }));
  // The window: a square centred on the origin, twice the larger of the longest root and the default
  // point a = (1, 1), rounded up to a half unit (plan), so that every root, the default point and its
  // orbit fit with a margin. The same scale serves the snapping.
  const longest = Math.max(...drawn.map((r) => Math.hypot(r.y[0], r.y[1])));
  const rho = apply2(W, [1, 1]);
  const R = Math.ceil(2 * Math.max(longest, Math.hypot(rho[0], rho[1])) * 2) / 2;
  const reach = R * Math.SQRT2 * 1.05;
  const mirrors: MirrorLine[] = pos.map((q, k) => {
    const normal = picture({ U } as Geometry, q);
    const len = Math.hypot(normal[0], normal[1]);
    const dir: Vec2 = [-normal[1] / len, normal[0] / len];
    const unit = q.findIndex((x, i) => x === 1 && q.every((y, j) => j === i || y === 0));
    return {
      index: k + 1,
      root: order.map((i) => q[i]!),
      simple: unit >= 0 ? toLabels(board, [unit])[0]! : 0,
      normal,
      from: [-reach * dir[0], -reach * dir[1]],
      to: [reach * dir[0], reach * dir[1]],
    };
  });
  // The chambers: the 2N sectors between consecutive mirror directions (N positive roots). The dominant
  // chamber is the one where every simple root pairs positively with the bisector (2.6: no negative number).
  const angles: number[] = [];
  for (const m of mirrors) {
    const t = Math.atan2(m.to[1], m.to[0]);
    const t0 = ((t % Math.PI) + Math.PI) % Math.PI;
    angles.push(t0, t0 + Math.PI);
  }
  angles.sort((x, y) => x - y);
  const chambers: Chamber[] = angles.map((from, k) => {
    const to = k + 1 < angles.length ? angles[k + 1]! : angles[0]! + 2 * Math.PI;
    const mid = (from + to) / 2;
    const v: Vec2 = [Math.cos(mid), Math.sin(mid)];
    const dominant = alpha.every((u) => u[0] * v[0] + u[1] * v[1] > 0);
    const far = reach / Math.cos((to - from) / 2);
    return {
      from,
      to,
      dominant,
      polygon: [
        [0, 0],
        [reach * Math.cos(from), reach * Math.sin(from)],
        [far * Math.cos(mid), far * Math.sin(mid)],
        [reach * Math.cos(to), reach * Math.sin(to)],
      ],
    };
  });
  const g: Geometry = { name, board, labels, order, cartan, cartanByLabel, d, U, alpha, lengths, W, Winv, R, roots: drawn, mirrors, chambers };
  cache.set(name, g);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Screen coordinates
// ---------------------------------------------------------------------------------------------

/** The SVG box is SIZE by SIZE user units; the window [-R, R] squared fills it. */
export const SIZE = 400;

/**
 * Plane to screen: x right, and y UP in the plane but down in SVG, so the screen y is the negative
 * (plan): alpha_2 then appears above the horizontal axis, counterclockwise from alpha_1 (SPEC 4 T6).
 */
export function toScreen(g: Geometry, y: Vec2): [number, number] {
  const s = SIZE / 2 / g.R;
  return [SIZE / 2 + s * y[0], SIZE / 2 - s * y[1]];
}

export function fromScreen(g: Geometry, p: Vec2): [number, number] {
  const s = SIZE / 2 / g.R;
  return [(p[0] - SIZE / 2) / s, (SIZE / 2 - p[1]) / s];
}

/** A screen point as an SVG coordinate pair "x,y" with fixed decimals. */
export function screenPair(g: Geometry, y: Vec2): string {
  const [x, z] = toScreen(g, y);
  return `${fmt(x)},${fmt(z)}`;
}

// ---------------------------------------------------------------------------------------------
// Positions, populations, readouts
// ---------------------------------------------------------------------------------------------

/** A position by position (bigint entries, exact). */
export type Position = bigint[];

function inArith(board: Board<unknown>, v: readonly bigint[]): unknown[] {
  return typeof board.arith.zero === 'bigint' ? [...v] : v.map((x) => board.arith.fromInt(Number(x)));
}

function fromArith(board: Board<unknown>, v: readonly unknown[]): bigint[] {
  return v.map((x) => board.arith.toBig(x));
}

function safe(v: readonly bigint[]): boolean {
  return v.every((x) => {
    const n = Number(x);
    return Number.isSafeInteger(n) && BigInt(n) === x;
  });
}

/** The board to compute with: the SafeInt board while the values are safe, its Big copy otherwise (E-2, 5.8). */
function arithFor(g: Geometry, v: readonly bigint[]): Board<unknown> {
  return (safe(v) ? g.board : bigBoard(g.board)) as Board<unknown>;
}

/** The population C^{-1} a (exact, by position); never null on these boards (det C is 3, 2, 2, 1). */
export function population(g: Geometry, a: Position): Rational[] {
  const b = arithFor(g, a) as Board<unknown>;
  const p = toPopulation(b, inArith(b, a));
  if (p === null) throw new Error(`${g.name}: C is singular`);
  return p;
}

/** fire(board, a, i) at a position, in SafeInt when it stays safe and in Big otherwise (5.8). */
export function firePosition(g: Geometry, a: Position, i: number): Position {
  let b = arithFor(g, a) as Board<unknown>;
  try {
    return fromArith(b, fire(b, inArith(b, a), i));
  } catch (e) {
    if (!(e instanceof EngineOverflow)) throw e;
  }
  b = bigBoard(g.board) as Board<unknown>;
  return fromArith(b, fire(b, inArith(b, a), i));
}

/** a = C p for an integer population (by position), exact (the codec's c=p links). */
export function numbersOf(g: Geometry, p: Position): Position {
  let b = arithFor(g, p) as Board<unknown>;
  try {
    return fromArith(b, toNumbers(b, inArith(b, p)));
  } catch (e) {
    if (!(e instanceof EngineOverflow)) throw e;
  }
  b = bigBoard(g.board) as Board<unknown>;
  return fromArith(b, toNumbers(b, inArith(b, p)));
}

/** The point y = U C^{-1} a of a position (plane coordinates). */
export function pointOf(g: Geometry, a: Position): Vec2 {
  return picture(g, population(g, a).map(ratFloat));
}

/** Entries of a vector by position, in label order. */
export function byLabel<X>(g: Geometry, v: readonly X[]): X[] {
  return g.order.map((i) => v[i]!);
}

/** A vector given in label order, by position. */
export function byPosition<X>(g: Geometry, v: readonly X[]): X[] {
  const out: X[] = new Array(v.length);
  g.order.forEach((i, k) => {
    out[i] = v[k]!;
  });
  return out;
}

/** A start entry (number or decimal text) as bigint. */
export function entryBig(x: number | string | bigint): bigint {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') {
    if (!Number.isSafeInteger(x)) throw new RangeError(`${String(x)} is not a safe integer`);
    return BigInt(x);
  }
  if (!/^-?\d+$/.test(x)) throw new RangeError(`${JSON.stringify(x)} is not an integer`);
  return BigInt(x);
}

/** A bigint as a state entry: a JSON number when safe, decimal text otherwise (6.6). */
export function entryOut(x: bigint): number | string {
  const n = Number(x);
  return Number.isSafeInteger(n) && BigInt(n) === x ? n : x.toString();
}

/** What a position shows: exact texts in label order, the drawing in plane coordinates. */
export interface Readout {
  /** The numbers, label order, ASCII decimal text. */
  numbers: string[];
  /** The population, label order, "p/q" or "p" (ratToString). */
  population: string[];
  /** The point in the plane. */
  y: Vec2;
  /** Signed distance to mirror i, by label order: a_i |alpha_i| / 2 (2.4(d)). */
  distances: number[];
  /** Foot of the perpendicular from the point to mirror i, label order. */
  feet: Vec2[];
  /** Corners 0, p_1 alpha_1, p_1 alpha_1 + p_2 alpha_2, p_2 alpha_2 (the far corner is the point). */
  parallelogram: [Vec2, Vec2, Vec2, Vec2];
  /** The point lies outside the drawn window. */
  offView: boolean;
}

export function readout(g: Geometry, a: Position): Readout {
  const p = population(g, a);
  const pf = p.map(ratFloat);
  const y = picture(g, pf);
  const feet: Vec2[] = [];
  const distances: number[] = [];
  for (const i of g.order) {
    const u = g.alpha[i]!;
    const len = g.lengths[i]!;
    const t = (y[0] * u[0] + y[1] * u[1]) / len;
    distances.push(t);
    feet.push([y[0] - (t * u[0]) / len, y[1] - (t * u[1]) / len]);
  }
  const [i1, i2] = g.order as [number, number];
  const c1: Vec2 = [pf[i1]! * g.alpha[i1]![0], pf[i1]! * g.alpha[i1]![1]];
  const c2: Vec2 = [pf[i2]! * g.alpha[i2]![0], pf[i2]! * g.alpha[i2]![1]];
  const offView = !(Math.abs(y[0]) <= g.R && Math.abs(y[1]) <= g.R);
  return {
    numbers: byLabel(g, a).map((x) => x.toString()),
    population: byLabel(g, p).map(ratToString),
    y,
    distances,
    feet,
    parallelogram: [[0, 0], c1, [c1[0] + c2[0], c1[1] + c2[1]], c2],
    offView,
  };
}

/** The value drawn on screen: a true minus sign, shortened above 12 digits (4.0 Long numbers). */
export function shownValue(text: string): string {
  const neg = text.startsWith('-');
  const body = text.replace(/^-/, '');
  const shown = body
    .split('/')
    .map((part) => (isLong(part) ? shortValue(part) : part))
    .join('/');
  return `${neg ? '−' : ''}${shown}`;
}

/** A value read aloud: "minus 2", "2 over 3", "minus 1 over 3". */
export function spoken(text: string): string {
  if (!text.includes('/')) return speak(text);
  const [num, den] = text.split('/') as [string, string];
  return `${speak(num)} over ${den}`;
}

/** The line a = Cp as data: C in label order and both vectors as exact text. */
export interface Equation {
  cartan: number[][];
  numbers: string[];
  population: string[];
  /** The whole line in words, for its accessible name (plan). */
  words: string;
}

export function equation(g: Geometry, r: Readout): Equation {
  const rows = g.cartanByLabel.map((row) => row.map((x) => speak(x)).join(', ')).join('; ');
  return {
    cartan: g.cartanByLabel.map((row) => [...row]),
    numbers: [...r.numbers],
    population: [...r.population],
    words: `a equals C times p: numbers ${r.numbers.map(spoken).join(', ')} equal the matrix C with rows ${rows} times the population ${r.population.map(spoken).join(', ')}.`,
  };
}

// ---------------------------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------------------------

export interface OrbitPoint {
  numbers: string[];
  y: Vec2;
}

/** The orbit of the point under firing (at most |W| positions), each drawn at U C^{-1} a'. */
export function orbitPoints(g: Geometry, a: Position): OrbitPoint[] {
  let b = arithFor(g, a) as Board<unknown>;
  let items: unknown[][];
  try {
    items = orbit(b, [inArith(b, a)], 'firing', CAPS.mainThreadItems).items;
  } catch (e) {
    if (!(e instanceof EngineOverflow)) throw e;
    b = bigBoard(g.board) as Board<unknown>;
    items = orbit(b, [inArith(b, a)], 'firing', CAPS.mainThreadItems).items;
  }
  return items.map((v) => {
    const big = fromArith(b, v);
    return { numbers: byLabel(g, big).map((x) => x.toString()), y: pointOf(g, big) };
  });
}

export interface LatticeDot {
  /** 'root': q integral, drawn at U q; 'weight': a integral, drawn at U C^{-1} a. */
  lattice: 'root' | 'weight';
  /** The integer vector, label order (q for the root lattice, a for the weight lattice). */
  v: number[];
  y: Vec2;
}

/** The dots of both lattices inside the square [-r, r] squared (default: the window). */
export function latticeDots(g: Geometry, r: number = g.R): LatticeDot[] {
  const out: LatticeDot[] = [];
  const inside = (y: Vec2): boolean => Math.abs(y[0]) <= r + 1e-9 && Math.abs(y[1]) <= r + 1e-9;
  const corners: Vec2[] = [
    [r, r],
    [r, -r],
    [-r, r],
    [-r, -r],
  ];
  const ranges = (M: readonly (readonly number[])[]): [number, number][] =>
    [0, 1].map((i) => {
      const vals = corners.map((c) => M[i]![0]! * c[0] + M[i]![1]! * c[1]);
      return [Math.floor(Math.min(...vals)) - 1, Math.ceil(Math.max(...vals)) + 1] as [number, number];
    });
  const Uinv = inv2(g.U);
  for (const [kind, M, draw] of [
    ['root', Uinv, g.U],
    ['weight', g.Winv, g.W],
  ] as const) {
    const [r0, r1] = ranges(M);
    for (let x0 = r0![0]; x0 <= r0![1]; x0++) {
      for (let x1 = r1![0]; x1 <= r1![1]; x1++) {
        const v = [x0, x1];
        const y = apply2(draw, v);
        if (inside(y)) out.push({ lattice: kind, v: byLabel(g, v), y });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Snapping (the drag)
// ---------------------------------------------------------------------------------------------

/**
 * The nearest point of the weight lattice to a plane point: the real numbers a = C U^{-1} y, rounded,
 * then the 3 by 3 neighbourhood of the rounded pair searched, because the lattice is skew and rounding
 * each entry alone can miss the nearest point. Ties go to the smaller a_1, then the smaller a_2 (labels;
 * plan). Returns the numbers in label order.
 */
export function snap(g: Geometry, y: Vec2): number[] {
  const real = apply2(g.Winv, y);
  const base = real.map(Math.round);
  let best: { v: number[]; d: number } | null = null;
  const cands: number[][] = [];
  for (let d0 = -1; d0 <= 1; d0++) for (let d1 = -1; d1 <= 1; d1++) cands.push([base[0]! + d0, base[1]! + d1]);
  const lab = (v: number[]): number[] => byLabel(g, v);
  for (const v of cands) {
    const z = apply2(g.W, v);
    const d = Math.hypot(z[0] - y[0], z[1] - y[1]);
    if (best === null || d < best.d - 1e-12) best = { v, d };
    else if (Math.abs(d - best.d) <= 1e-12) {
      const a = lab(v);
      const b = lab(best.v);
      if (a[0]! < b[0]! || (a[0] === b[0] && a[1]! < b[1]!)) best = { v, d };
    }
  }
  return lab(best!.v).map((x) => (x === 0 ? 0 : x));
}

// ---------------------------------------------------------------------------------------------
// The game: start, moves, history (SPEC 4.0 One state, History; 7.4)
// ---------------------------------------------------------------------------------------------

export interface MirrorConfig {
  board: T06Board;
  /** In label order; numbers (coords 'numbers'). */
  start: readonly (number | string)[];
  /** Labels of the nodes fired. */
  moves?: readonly number[];
}

export class MirrorGame {
  readonly geo: Geometry;
  /** The start, label order, as the state holds it (JSON numbers when safe, decimal text otherwise). */
  readonly start: (number | string)[];
  /** Every move of the list (labels); the ones after the cursor can be redone. */
  moves: number[];
  cursor: number;
  /** positions[k] is the position after k moves (by position). Extended by one per move (7.4). */
  positions: Position[];

  constructor(config: MirrorConfig) {
    this.geo = geometry(config.board);
    if (config.start.length !== 2) throw new RangeError(`the start has ${config.start.length} entries, but the board has 2 nodes`);
    const a = byPosition(this.geo, config.start.map(entryBig));
    this.start = byLabel(this.geo, a).map(entryOut);
    this.positions = [a];
    this.moves = [];
    this.cursor = 0;
    for (const l of config.moves ?? []) this.fire(l);
  }

  get name(): T06Board {
    return this.geo.name;
  }

  get current(): Position {
    return this.positions[this.cursor]!;
  }

  /** Fires the node with this label at the cursor, discarding the moves after it. Free play: always allowed. */
  fire(label: number): number {
    const i = toPositions(this.geo.board, [label])[0]!;
    this.moves = this.moves.slice(0, this.cursor);
    this.positions = this.positions.slice(0, this.cursor + 1);
    this.positions.push(firePosition(this.geo, this.current, i));
    this.moves.push(label);
    this.cursor = this.moves.length;
    return this.cursor;
  }

  undo(): boolean {
    if (this.cursor === 0) return false;
    this.cursor--;
    return true;
  }

  redo(): boolean {
    if (this.cursor >= this.moves.length) return false;
    this.cursor++;
    return true;
  }

  /** Reset empties the list and returns to the current start, the last placement (plan). */
  reset(): boolean {
    if (this.moves.length === 0) return false;
    this.moves = [];
    this.positions = [this.positions[0]!];
    this.cursor = 0;
    return true;
  }

  scrub(to: number): boolean {
    if (!Number.isInteger(to) || to < 0 || to > this.moves.length || to === this.cursor) return false;
    this.cursor = to;
    return true;
  }

  /** The moves made up to the cursor (labels). */
  get applied(): number[] {
    return this.moves.slice(0, this.cursor);
  }

  readoutAt(k: number): Readout {
    return readout(this.geo, this.positions[k]!);
  }

  get readout(): Readout {
    return this.readoutAt(this.cursor);
  }

  /** The ToolState of the current point of the play (6.6): never positions. */
  state(): ToolState {
    return { schema: 1, tool: 'mirror', board: this.name, coords: 'numbers', start: [...this.start], moves: this.applied };
  }
}

/** Placing the point sets the start and empties the moves (plan; placement is not a move). */
export function placed(name: T06Board, numbersByLabel: readonly (number | string | bigint)[]): MirrorConfig {
  return { board: name, start: numbersByLabel.map((x) => entryOut(entryBig(x))), moves: [] };
}

/** One step of placement: a_k changes by delta (a step of plus or minus one fundamental weight). */
export function stepped(game: MirrorGame, labelIndex: number, delta: 1 | -1): MirrorConfig {
  const now = byLabel(game.geo, game.current);
  const next = now.map((x, k) => (k === labelIndex ? x + BigInt(delta) : x));
  return placed(game.name, next);
}

/**
 * T6's reading of a decoded link (plan): coords 'populations' (c=p) gives the population p, placed at
 * a = Cp (always integral) and written back with coords 'numbers'; view and mode are dropped (T6 uses
 * neither). Returns null for a board T6 does not offer (the codec already refuses it, rule 8).
 */
export function admitLink(s: ToolState): MirrorConfig | null {
  if (!isT06Board(s.board)) return null;
  const g = geometry(s.board);
  const raw = s.start ?? [1, 1];
  if (raw.length !== 2) return null;
  let start = raw.map(entryBig);
  if (s.coords === 'populations') start = byLabel(g, numbersOf(g, byPosition(g, start)));
  return { board: s.board, start: start.map(entryOut), moves: [...(s.moves ?? [])] };
}

// ---------------------------------------------------------------------------------------------
// Words: text alternative, announcements, prediction gate, export
// ---------------------------------------------------------------------------------------------

export function altText(name: T06Board, r: Readout, overlays: readonly Overlay[]): string {
  const shown = overlays.length === 0 ? 'none' : OVERLAYS.filter((o) => overlays.includes(o)).map((o) => OVERLAY_NAMES[o].toLowerCase()).join(', ');
  const where = r.offView ? ' The point lies outside the drawn window.' : '';
  return `Kaleidoscope on ${name}: two mirrors and a point. Numbers ${r.numbers.map(spoken).join(', ')}. Population ${r.population.map(spoken).join(', ')}. Overlays shown: ${shown}.${where}`;
}

/** Composed sentence for a placement (A-4 has no template; plan). */
export function placementSentence(r: Readout): string {
  return `Point placed at numbers ${r.numbers.map(spoken).join(', ')}.`;
}

/** Composed sentence for an overlay switch (plan). */
export function overlaySentence(o: Overlay, on: boolean): string {
  return `${OVERLAY_NAMES[o]} ${on ? 'shown' : 'hidden'}.`;
}

/** Composed sentence for a board picked (plan). */
export function boardSentence(name: T06Board, r: Readout): string {
  return `Board ${name}. Point placed at numbers ${r.numbers.map(spoken).join(', ')}.`;
}

/**
 * Whether firing, placement and the drag act (4.0 Predict: "The board is frozen until the reader has
 * answered or pressed show me"; 7.4: controls disabled until hydration).
 */
export function interactive(o: { hydrated: boolean; prediction: boolean; resolved: boolean }): boolean {
  return o.hydrated && (!o.prediction || o.resolved);
}

const exportValue = (text: string): number | string => {
  if (text.includes('/')) return text;
  return entryOut(BigInt(text));
};

/** The derived tables of "Download data" (6.6, 5.11): exact digits, fractions as "p/q". */
export function exportDerived(game: MirrorGame, overlays: readonly Overlay[]): Record<string, unknown> {
  const g = game.geo;
  const r = game.readout;
  const history = [];
  for (let k = 0; k <= game.cursor; k++) {
    const s = game.readoutAt(k);
    history.push({ move: k, numbers: s.numbers.map(exportValue), population: [...s.population] });
  }
  const out: Record<string, unknown> = {
    labels: [...g.labels],
    position: r.numbers.map(exportValue),
    population: [...r.population],
    cartan: g.cartanByLabel.map((row) => [...row]),
    history,
  };
  if (overlays.includes('orbit')) out.orbit = orbitPoints(g, game.current).map((o) => o.numbers.map(exportValue));
  if (overlays.includes('roots')) out.roots = g.roots.map((q) => q.root);
  return out;
}
