// The projector of SPEC.md 7.1 ("Drawing": rotations in coordinate planes, orthogonal projection,
// depth cue; no library) for T10, the Geometry Studio. Pure and synchronous; runs in Node (the SVG
// snapshot of 7.4 and the preset pipeline) and in the browser. It computes nothing about boards,
// roots, orbits, edges or the form: E comes from the engine's euclideanBasis (or choleskyBasis),
// C^-1 a from toPopulation. What is here is linear algebra on floats in the Euclidean coordinates y,
// where the invariant form is the dot product (2.14 step 3): rotations, frames, projection, scaling
// to a box, the depth cue, and the two counting helpers of the Coxeter plane (5.4).
//
// Nodes are positions inside (E-7). The only text this module reads or writes is the j value of 6.6,
// whose coordinate numbers are counted from 1 and whose angles are whole degrees; parseProjection and
// formatProjection convert, nothing else does.
import { toPopulation } from '@engine';
import type { AnyBoard, Board, Vec } from '@engine';

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

/** A square matrix of floats, as a list of rows. */
export type FloatMatrix = readonly (readonly number[])[];

/**
 * Which coordinates of y make the picture (positions 0..n-1 of y). The Coxeter view is the plane of
 * coordinates 0 and n-1 (2.14: smallest and largest eigenvalue), with coordinate 1 as depth when
 * n >= 3. An xyz view keeps axes[0] and axes[1] as the picture and axes[2] as depth.
 */
export type View = { kind: 'coxeter' } | { kind: 'xyz'; axes: readonly [number, number, number] };

/** A view and the three turning angles of 6.6, in whole degrees: about the horizontal, vertical, viewing axis. */
export interface Projection {
  view: View;
  turn: readonly [number, number, number];
}

/**
 * Orthonormal vectors of y-space: u is drawn to the right, v upwards, w toward the viewer (depth).
 * w is null when there is no depth axis (rank 2, and rank 1, where v is the zero vector: a line).
 */
export interface Frame {
  u: number[];
  v: number[];
  w: number[] | null;
}

/** A projected point: picture coordinates x, y (y up), depth z, and the length of the y vector it came from. */
export interface Point3 {
  x: number;
  y: number;
  z: number;
  /** sqrt(y . y) of the unprojected vector; no rotation or turn changes it (used for the scale of a scene). */
  norm?: number;
}

/** A point of a scene in CSS pixels, y growing downwards, with its depth in [0, 1] (0 far, 1 near). */
export interface ScenePoint {
  x: number;
  y: number;
  z: number;
  depth: number;
}

/** A segment of a scene: indices into the points, and the mean depth of its ends. */
export interface SceneSegment {
  a: number;
  b: number;
  depth: number;
}

/**
 * What both renderers consume, and nothing else (7.4: "the same drawing code"). Pixel coordinates in a
 * box of width by height CSS pixels; segments sorted far to near (the painter's order).
 */
export interface Scene {
  width: number;
  height: number;
  points: ScenePoint[];
  segments: SceneSegment[];
  hasDepth: boolean;
  /** Pixels per unit of y. Informational (pointer mapping in T10); the renderers do not read it. */
  scale: number;
}

/** The style of a mark at a depth: stroke width and point radius in CSS pixels, and opacity. */
export interface DepthStyle {
  width: number;
  radius: number;
  alpha: number;
}

// ---------------------------------------------------------------------------------------------
// From positions to Euclidean points (2.14 steps 3 and 4)
// ---------------------------------------------------------------------------------------------

/** y = E p for a population p (2.14 step 3). E is euclideanBasis(board).E or choleskyBasis(board). */
export function toEuclideanPopulation(E: FloatMatrix, p: readonly number[]): number[] {
  const out: number[] = [];
  for (let k = 0; k < E.length; k++) {
    const row = E[k]!;
    let s = 0;
    for (let j = 0; j < row.length; j++) s += row[j]! * p[j]!;
    out.push(s);
  }
  return out;
}

/**
 * The picture of a position a of the numbers game: y = E C^-1 a (2.14 step 4). C^-1 a comes from the
 * engine's toPopulation as rationals, converted as Number(num) / Number(den). Never E a: that is a
 * picture of the dual object. A board with det C = 0 (never a finite one) has no population: Error.
 */
export function toEuclidean<T>(board: Board<T>, E: FloatMatrix, a: Vec<T>): number[];
export function toEuclidean(board: AnyBoard, E: FloatMatrix, a: Vec<number | bigint>): number[];
export function toEuclidean(board: AnyBoard, E: FloatMatrix, a: Vec<number | bigint>): number[] {
  const p = toPopulation(board as Board<number | bigint>, a);
  if (p === null) {
    throw new Error(`the board ${board.name ?? 'drawn by the reader'} has det C = 0, so a position has no population to draw`);
  }
  return toEuclideanPopulation(
    E,
    p.map((r) => Number(r.num) / Number(r.den)),
  );
}

// ---------------------------------------------------------------------------------------------
// Rotations in coordinate planes (act on y, before the frame)
// ---------------------------------------------------------------------------------------------

/** The n x n Givens rotation of the plane of coordinates a and b (positions) by theta radians: e_a turns toward e_b. */
export function rotationInPlane(n: number, a: number, b: number, theta: number): number[][] {
  if (!Number.isInteger(n) || n < 2) throw new RangeError(`a rotation needs at least two coordinates, not ${n}`);
  for (const k of [a, b]) {
    if (!Number.isInteger(k) || k < 0 || k >= n) throw new RangeError(`coordinate ${k} is not one of 0..${n - 1}`);
  }
  if (a === b) throw new RangeError('a rotation needs two different coordinates');
  const R = identity(n);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  R[a]![a] = c;
  R[b]![b] = c;
  R[b]![a] = s;
  R[a]![b] = -s;
  return R;
}

/** The product of the matrices in the order given: apply(compose(A, B), y) = A (B y). */
export function compose(first: FloatMatrix, ...rest: FloatMatrix[]): number[][] {
  let M = first.map((row) => [...row]);
  for (const R of rest) {
    const n = M.length;
    const out: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += M[i]![k]! * R[k]![j]!;
        row.push(s);
      }
      out.push(row);
    }
    M = out;
  }
  return M;
}

/** R y. */
export function apply(R: FloatMatrix, y: readonly number[]): number[] {
  return toEuclideanPopulation(R, y);
}

function identity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

function unit(n: number, k: number): number[] {
  return Array.from({ length: n }, (_, j) => (j === k ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------
// Views, frames and the turning angles (T10 "Projection"; 6.6)
// ---------------------------------------------------------------------------------------------

/**
 * The unit coordinate vectors of a view. Coxeter: u = e_0, v = e_(n-1), w = e_1 for n >= 3 and null for
 * n = 2 (plan). Rank 1 is a line: u = e_0, v the zero vector, w null. xyz: e_axes[0], e_axes[1], e_axes[2].
 */
export function frameFor(n: number, view: View): Frame {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`a board has at least one node, not ${n}`);
  if (view.kind === 'coxeter') {
    if (n === 1) return { u: [1], v: [0], w: null };
    return { u: unit(n, 0), v: unit(n, n - 1), w: n >= 3 ? unit(n, 1) : null };
  }
  const [a, b, c] = view.axes;
  for (const k of view.axes) {
    if (!Number.isInteger(k) || k < 0 || k >= n) throw new RangeError(`coordinate ${k} is not one of 0..${n - 1}`);
  }
  if (a === b || b === c || a === c) throw new RangeError('an xyz view needs three different coordinates');
  return { u: unit(n, a), v: unit(n, b), w: unit(n, c) };
}

/** Turns the pair (p, q) by deg degrees so that what lay along p moves toward q. */
function turnPair(p: readonly number[], q: readonly number[], deg: number): [number[], number[]] {
  const t = (((deg % 360) + 360) % 360) * (Math.PI / 180);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [p.map((x, i) => c * x - s * q[i]!), p.map((x, i) => s * x + c * q[i]!)];
}

/**
 * Turns the picture about its horizontal axis u by turn[0] (the top comes toward the viewer), then about
 * its vertical axis v by turn[1] (what faced the viewer goes to the right), then about the viewing axis w
 * by turn[2] (counterclockwise on the screen), each about the axes as they stand after the previous turn
 * (plan). Each step turns two orthonormal vectors in their own plane, so the frame stays orthonormal.
 * With no depth axis only turn[2] acts; rank 1 is a line and does not turn.
 */
export function turnFrame(frame: Frame, turn: readonly [number, number, number]): Frame {
  let { u, v, w } = frame;
  if (u.length === 1) return frame;
  if (w !== null) {
    if (turn[0] % 360 !== 0) [v, w] = turnPair(v, w, turn[0]);
    if (turn[1] % 360 !== 0) [w, u] = turnPair(w, u, turn[1]);
  }
  if (turn[2] % 360 !== 0) [u, v] = turnPair(u, v, turn[2]);
  return { u, v, w };
}

/** The frame of a projection: frameFor, then turnFrame. */
export function frameOf(n: number, projection: Projection): Frame {
  return turnFrame(frameFor(n, projection.view), projection.turn);
}

/** Orthogonal projection of y onto the frame: x = y.u, y = y.v, z = y.w (0 without a depth axis). */
export function project(frame: Frame, y: readonly number[]): Point3 {
  let x = 0;
  let yy = 0;
  let z = 0;
  let nn = 0;
  const { u, v, w } = frame;
  for (let i = 0; i < y.length; i++) {
    const c = y[i]!;
    x += c * u[i]!;
    yy += c * v[i]!;
    if (w !== null) z += c * w[i]!;
    nn += c * c;
  }
  // + 0 turns a -0 into 0.
  return { x: x + 0, y: yy + 0, z: z + 0, norm: Math.sqrt(nn) };
}

// The grammar of the j value (6.6), the same expression as site/src/lib/urlCodec.ts reads.
const J_VALUE = /^(coxeter|xyz:(\d+),(\d+),(\d+))(@(-?\d+),(-?\d+),(-?\d+))?$/;

/**
 * Reads a j value for a board with n nodes: "coxeter" (any rank), or "xyz:" and three different
 * coordinate numbers in 1..n (so never on rank 1 or 2), either optionally followed by "@" and three
 * whole numbers of degrees (negative allowed). Returns null for anything else.
 */
export function parseProjection(text: string, n: number): Projection | null {
  const m = J_VALUE.exec(text);
  if (m === null) return null;
  const turn: [number, number, number] =
    m[5] === undefined ? [0, 0, 0] : [Number(m[6]) + 0, Number(m[7]) + 0, Number(m[8]) + 0];
  if (m[2] === undefined) return { view: { kind: 'coxeter' }, turn };
  const axes = [Number(m[2]), Number(m[3]), Number(m[4])];
  if (axes.some((k) => k < 1 || k > n) || new Set(axes).size !== 3) return null;
  return { view: { kind: 'xyz', axes: [axes[0]! - 1, axes[1]! - 1, axes[2]! - 1] }, turn };
}

/** Writes a j value: angles reduced to 0..359, and "@0,0,0" left out. */
export function formatProjection(p: Projection): string {
  const head = p.view.kind === 'coxeter' ? 'coxeter' : `xyz:${p.view.axes.map((k) => k + 1).join(',')}`;
  const turn = p.turn.map((t) => ((t % 360) + 360) % 360);
  return turn.every((t) => t === 0) ? head : `${head}@${turn.join(',')}`;
}

/** The default view by rank (plan): the Coxeter plane for n <= 2 and n >= 4, xyz:1,2,3 for n = 3. */
export function defaultProjection(n: number): Projection {
  if (n === 3) return { view: { kind: 'xyz', axes: [0, 1, 2] }, turn: [0, 0, 0] };
  return { view: { kind: 'coxeter' }, turn: [0, 0, 0] };
}
