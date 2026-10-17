// Draws a Scene of the projector on a Canvas 2D context (SPEC.md 7.1: Canvas 2D for projections with
// many edges). Pure apart from the context passed in: it starts no motion and schedules no frame
// (A-9); the caller sets `turning` while a drag, a key press or an animation of its own is in
// progress and redraws at rest afterwards. Colours arrive as strings that the caller read from the
// tokens of CONTRACTS.md 8 (segments --road, points --text, background --page); no colour is
// written here (6.3). The caps of 5.6 come from the engine's CAPS and are never typed again.
//
// Performance (7.6: the E8 root polytope with its edges in under 100 ms on a phone): the depth cue
// is quantised into DEPTH_LEVELS levels; each level is one path and one stroke(), far levels first,
// and the points likewise one path and one fill() per level. No save or restore per segment, no
// string built inside the loops. svgScene.ts uses the same selection, levels and order.
import { CAPS } from '@engine';
import { DEFAULT_LINE_WIDTH, DEFAULT_POINT_RADIUS, depthStyle, roundTo, type DepthStyle, type Scene } from './projector';

/** The caps of T10 "Limits" (SPEC 5.6), as the engine states them. */
export const LIMITS = {
  edgesAtRest: CAPS.edgesAtRest,
  edgesTurning: CAPS.edgesTurning,
  verticesDrawn: CAPS.verticesDrawn,
} as const;

/** The number of depth levels a scene is drawn in (plan). */
export const DEPTH_LEVELS = 8;

/** The part of CanvasRenderingContext2D that drawScene uses; a recording stand-in drives the unit tests. */
export interface Context2DLike {
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
  stroke(): void;
  lineWidth: number;
  // Written as strings here; typed unknown so that CanvasRenderingContext2D (gradients, patterns) fits.
  strokeStyle: unknown;
  fillStyle: unknown;
  globalAlpha: number;
  lineCap: string;
}

/** Concrete colours (for example from getComputedStyle): points, segments, background. */
export interface SceneColours {
  point: string;
  segment: string;
  page: string;
}

export interface DrawOptions {
  /** True while the picture is being turned: at most LIMITS.edgesTurning segments are drawn. */
  turning: boolean;
  /** The device pixel ratio; the caller sizes the backing store to width * dpr by height * dpr. */
  dpr: number;
  /** Radius of a point at middle depth, CSS pixels. */
  pointRadius?: number;
  /** Stroke width of a segment at middle depth, CSS pixels. */
  lineWidth?: number;
}

export interface DrawResult {
  pointsDrawn: number;
  segmentsDrawn: number;
  segmentsTotal: number;
  verticesOnly: boolean;
  sampled: boolean;
}

export interface SegmentSelection {
  /** Indices into scene.segments, increasing (so in the scene's far to near order). */
  indices: number[];
  /** True above LIMITS.edgesAtRest segments: only the vertices are drawn (T10 says so in a message). */
  verticesOnly: boolean;
  /** True while turning with more than LIMITS.edgesTurning segments: a fixed sample is drawn. */
  sampled: boolean;
}

/**
 * Which segments are drawn (SPEC 4 T10 "Limits"; 5.6): above LIMITS.edgesAtRest none, at rest or while
 * turning, since the edges are then not enumerated; at rest all of them; while turning all when there
 * are at most LIMITS.edgesTurning, otherwise exactly LIMITS.edgesTurning chosen by the fixed stride
 * floor(k m / cap) through the far to near order, the same every frame (plan).
 */
export function selectSegments(scene: Pick<Scene, 'segments'>, turning: boolean): SegmentSelection {
  const m = scene.segments.length;
  if (m > LIMITS.edgesAtRest) return { indices: [], verticesOnly: true, sampled: false };
  if (!turning || m <= LIMITS.edgesTurning) {
    const all = new Array<number>(m);
    for (let i = 0; i < m; i++) all[i] = i;
    return { indices: all, verticesOnly: false, sampled: false };
  }
  const k = LIMITS.edgesTurning;
  const sample = new Array<number>(k);
  for (let i = 0; i < k; i++) sample[i] = Math.floor((i * m) / k);
  return { indices: sample, verticesOnly: false, sampled: true };
}

/** The level of a depth in [0, 1]: 0 (far) to DEPTH_LEVELS - 1 (near). */
export function levelOf(depth: number): number {
  return Math.min(DEPTH_LEVELS - 1, Math.max(0, Math.floor(depth * DEPTH_LEVELS)));
}

/**
 * The style of each level: depthStyle at the centre of the level, rounded to two decimals so that the
 * canvas and the SVG carry the same numbers. A scene with no depth axis has one style, the middle one.
 */
export function levelStyles(scene: Pick<Scene, 'hasDepth'>, base: { lineWidth: number; pointRadius: number }): DepthStyle[] {
  const r = (s: DepthStyle): DepthStyle => ({ width: roundTo(s.width, 2), radius: roundTo(s.radius, 2), alpha: roundTo(s.alpha, 2) });
  const out: DepthStyle[] = [];
  for (let k = 0; k < DEPTH_LEVELS; k++) out.push(r(depthStyle(scene.hasDepth ? (k + 0.5) / DEPTH_LEVELS : null, base)));
  return out;
}

/** A stretch [start, end) of an index array whose entries share a level. */
export interface Run {
  level: number;
  start: number;
  end: number;
}

/** The runs of equal level along the selected segments, in the order given (one run per level for a built scene). */
export function segmentRuns(scene: Pick<Scene, 'segments'>, indices: readonly number[]): Run[] {
  const runs: Run[] = [];
  for (let k = 0; k < indices.length; k++) {
    const level = levelOf(scene.segments[indices[k]!]!.depth);
    const last = runs[runs.length - 1];
    if (last !== undefined && last.level === level) last.end = k + 1;
    else runs.push({ level, start: k, end: k + 1 });
  }
  return runs;
}

/** The first `count` points grouped by level, far first, in the order of the scene within a level. */
export function pointPlan(scene: Pick<Scene, 'points'>, count: number): { order: number[]; runs: Run[] } {
  const levels = new Array<number>(count);
  const sizes = new Array<number>(DEPTH_LEVELS).fill(0);
  for (let i = 0; i < count; i++) {
    const l = levelOf(scene.points[i]!.depth);
    levels[i] = l;
    sizes[l]!++;
  }
  const next = new Array<number>(DEPTH_LEVELS).fill(0);
  const runs: Run[] = [];
  let at = 0;
  for (let l = 0; l < DEPTH_LEVELS; l++) {
    next[l] = at;
    if (sizes[l]! > 0) runs.push({ level: l, start: at, end: at + sizes[l]! });
    at += sizes[l]!;
  }
  const order = new Array<number>(count);
  for (let i = 0; i < count; i++) order[next[levels[i]!]!++] = i;
  return { order, runs };
}

/**
 * Draws the scene: the background in the page colour, the selected segments one stroke per level far
 * to near, then the first LIMITS.verticesDrawn points one fill per level far to near. The device pixel
 * ratio is applied once with setTransform; the scene stays in CSS pixels.
 */
export function drawScene(ctx: Context2DLike, scene: Scene, colours: SceneColours, options: DrawOptions): DrawResult {
  const selection = selectSegments(scene, options.turning);
  const styles = levelStyles(scene, {
    lineWidth: options.lineWidth ?? DEFAULT_LINE_WIDTH,
    pointRadius: options.pointRadius ?? DEFAULT_POINT_RADIUS,
  });
  const pointCount = Math.min(scene.points.length, LIMITS.verticesDrawn);
  const { points, segments } = scene;
  const idx = selection.indices;

  ctx.save();
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colours.page;
  ctx.fillRect(0, 0, scene.width, scene.height);

  ctx.strokeStyle = colours.segment;
  ctx.lineCap = 'round';
  for (const run of segmentRuns(scene, idx)) {
    const style = styles[run.level]!;
    ctx.lineWidth = style.width;
    ctx.globalAlpha = style.alpha;
    ctx.beginPath();
    for (let k = run.start; k < run.end; k++) {
      const s = segments[idx[k]!]!;
      const a = points[s.a]!;
      const b = points[s.b]!;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = colours.point;
  const plan = pointPlan(scene, pointCount);
  const full = 2 * Math.PI;
  for (const run of plan.runs) {
    const style = styles[run.level]!;
    const r = style.radius;
    ctx.globalAlpha = style.alpha;
    ctx.beginPath();
    for (let k = run.start; k < run.end; k++) {
      const p = points[plan.order[k]!]!;
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, full);
    }
    ctx.fill();
  }
  ctx.restore();

  return {
    pointsDrawn: pointCount,
    segmentsDrawn: idx.length,
    segmentsTotal: segments.length,
    verticesOnly: selection.verticesOnly,
    sampled: selection.sampled,
  };
}
