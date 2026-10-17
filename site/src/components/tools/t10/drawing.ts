// T10, the Geometry Studio: the picture, on a canvas and as SVG (SPEC.md 4 T10 Projection, Switch; 6.3;
// 7.1; 7.4; A-5; A-6). Owner P4-A3. Built on P4-A2's projector (frames, projection, scenes, the depth cue),
// canvasScene.ts (drawScene, the caps of 5.6 through selectSegments, the depth levels) and svgScene.ts
// (renderSvg): the polytope graph is drawn by them unchanged. What this module adds, for both renderers
// with the same selection, levels and order:
//   - the move graph: each edge in the colour of its node's label (palette of eight, --edge-k) AND its label
//     as text at the midpoint, a numeral in the text colour on a halo of the page colour (4.5 to 1 for
//     numerals, A-6), on every drawn edge of every graph, with no size threshold (6.3, A-5); the depth cue
//     acts on the width only, so no edge colour falls below its 3 to 1 against the page;
//   - the short roots (a second set of points of a root polytope, 2.14): hollow squares, no edges;
//   - the highlighted point of the page's highlight store (7.4): a ring in the focus colour.
// Nothing here touches the DOM beyond the context passed in, starts motion or schedules a frame (A-9).
import {
  buildScene,
  frameOf,
  parseProjection,
  project,
  rotationInPlane,
  compose,
  apply,
  roundTo,
  type FloatMatrix,
  type Projection,
  type Scene,
} from '../../draw/projector';
import {
  DEPTH_LEVELS,
  drawScene,
  levelOf,
  levelStyles,
  pointPlan,
  segmentRuns,
  selectSegments,
  type Context2DLike,
  type DrawResult,
} from '../../draw/canvasScene';
import { renderSvg } from '../../draw/svgScene';
import { DEFAULT_LINE_WIDTH, DEFAULT_POINT_RADIUS } from '../../draw/projector';
import { moveEdgeColour } from './graphs';

/** What the picture shows: Euclidean points (vertices, then the short roots), edges, the graph kind. */
export interface PictureInput {
  /** The rank n of the board (the length of every y). */
  rank: number;
  /** Euclidean coordinates y of the vertices (unscaled). */
  vertices: readonly (readonly number[])[];
  /** Euclidean coordinates of the short roots, drawn as a second set of points; empty when not shown. */
  shortRoots: readonly (readonly number[])[];
  /** Polytope edges (index pairs) or move edges (index pairs with the label of the node). */
  edges: ReadonlyArray<readonly [number, number] | readonly [number, number, number]>;
  graph: 'polytope' | 'moves';
  projection: Projection;
  /** A rotation in coordinate planes applied to y before the projection (not part of a link); null for none. */
  rotation: FloatMatrix | null;
  /** The index of a highlighted vertex, or null. */
  highlighted: number | null;
}

/** A built picture: the projector's scene (all points; segments of the graph) and what the overlays need. */
export interface Picture {
  scene: Scene;
  vertexCount: number;
  /** The label of each scene segment (moves), in the scene's order; null for the polytope graph. */
  segmentLabels: number[] | null;
  graph: 'polytope' | 'moves';
  highlighted: number | null;
}

/** The box of the picture in CSS pixels. */
export interface Box {
  width: number;
  height: number;
}

/** The depth cue is on unless the picture is a plane seen face on (the Coxeter plane at no turn, rank 2, rank 1). */
export function hasDepthCue(projection: Projection, rotation: FloatMatrix | null, n: number): boolean {
  if (n <= 2) return false;
  if (projection.view.kind === 'xyz') return true;
  const [h, v] = projection.turn;
  return h % 360 !== 0 || v % 360 !== 0 || rotation !== null;
}

/** Builds the scene: y rotated, projected on the frame of the projection, placed in the box. */
export function buildPicture(input: PictureInput, box: Box): Picture {
  const n = input.rank;
  const frame = frameOf(n, input.projection);
  const R = input.rotation;
  const place = (y: readonly number[]): ReturnType<typeof project> => project(frame, R === null ? y : apply(R, y));
  const points = [...input.vertices.map(place), ...input.shortRoots.map(place)];
  const pairs = input.edges.map((e) => [e[0], e[1]] as [number, number]);
  const scene = buildScene(points, pairs, box, { depthCue: hasDepthCue(input.projection, R, n) });
  let segmentLabels: number[] | null = null;
  if (input.graph === 'moves') {
    const labels = new Map<string, number>();
    for (const e of input.edges) labels.set(`${e[0]},${e[1]}`, (e as readonly number[])[2] ?? 0);
    segmentLabels = scene.segments.map((s) => labels.get(`${s.a},${s.b}`) ?? labels.get(`${s.b},${s.a}`) ?? 0);
  }
  return { scene, vertexCount: input.vertices.length, segmentLabels, graph: input.graph, highlighted: input.highlighted };
}

/** The scene with the vertices only as points (drawScene and renderSvg draw every point of a scene the same way). */
function vertexScene(p: Picture): Scene {
  return { ...p.scene, points: p.scene.points.slice(0, p.vertexCount) };
}

/** Concrete colours for the canvas (read from the tokens with getComputedStyle). */
export interface PictureColours {
  page: string;
  text: string;
  road: string;
  focus: string;
  /** --edge-1 to --edge-8, in order. */
  edges: string[];
}

/** The colour of a move edge for the canvas: the token of its label, resolved in `colours.edges`. */
function edgeStroke(colours: PictureColours, label: number): string {
  const m = /--edge-(\d+)/.exec(moveEdgeColour(label));
  const k = m === null ? 8 : Number(m[1]);
  return colours.edges[k - 1] ?? colours.text;
}

/** The size of the edge labels and of the short-root markers, CSS pixels (plan). */
export const LABEL_SIZE = 10;
const SQUARE = 3;
const HALO = 3;

export interface PictureDrawResult extends DrawResult {
  labelsDrawn: number;
  shortRootsDrawn: number;
}

/** Draws the picture on a canvas (at rest or while turning). */
export function drawPicture(ctx: Context2DLike & CanvasTextLike, p: Picture, colours: PictureColours, options: { turning: boolean; dpr: number }): PictureDrawResult {
  let result: DrawResult;
  let labelsDrawn = 0;
  if (p.graph === 'polytope') {
    result = drawScene(ctx, vertexScene(p), { point: colours.text, segment: colours.road, page: colours.page }, options);
  } else {
    const r = drawMoves(ctx, p, colours, options);
    result = r;
    labelsDrawn = r.labelsDrawn;
  }
  // Overlays: the short roots, then the highlight.
  const { points } = p.scene;
  ctx.save();
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colours.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = p.vertexCount; k < points.length; k++) {
    const q = points[k]!;
    ctx.moveTo(q.x - SQUARE, q.y - SQUARE);
    ctx.lineTo(q.x + SQUARE, q.y - SQUARE);
    ctx.lineTo(q.x + SQUARE, q.y + SQUARE);
    ctx.lineTo(q.x - SQUARE, q.y + SQUARE);
    ctx.lineTo(q.x - SQUARE, q.y - SQUARE);
  }
  ctx.stroke();
  if (p.highlighted !== null && p.highlighted < p.vertexCount) {
    const q = points[p.highlighted]!;
    ctx.strokeStyle = colours.focus;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(q.x + 7, q.y);
    ctx.arc(q.x, q.y, 7, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  return { ...result, labelsDrawn, shortRootsDrawn: points.length - p.vertexCount };
}

/** The text calls of CanvasRenderingContext2D the labels use (a recording stand-in drives the unit tests). */
export interface CanvasTextLike {
  font: string;
  textAlign: string;
  textBaseline: string;
  lineJoin: string;
  strokeText(text: string, x: number, y: number): void;
  fillText(text: string, x: number, y: number): void;
}

function drawMoves(ctx: Context2DLike & CanvasTextLike, p: Picture, colours: PictureColours, options: { turning: boolean; dpr: number }): PictureDrawResult {
  const scene = vertexScene(p);
  const labels = p.segmentLabels ?? [];
  const selection = selectSegments(scene, options.turning);
  const styles = levelStyles(scene, { lineWidth: DEFAULT_LINE_WIDTH * 1.5, pointRadius: DEFAULT_POINT_RADIUS });
  const { points, segments } = scene;
  const idx = selection.indices;
  ctx.save();
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colours.page;
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.lineCap = 'round';
  // Edges: far to near (the scene's order); the depth cue acts on the width only (alpha 1).
  for (const k of idx) {
    const s = segments[k]!;
    const a = points[s.a]!;
    const b = points[s.b]!;
    ctx.strokeStyle = edgeStroke(colours, labels[k]!);
    ctx.lineWidth = styles[levelOf(s.depth)]!.width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Points, one fill per level, far first.
  ctx.fillStyle = colours.text;
  const plan = pointPlan(scene, points.length);
  for (const run of plan.runs) {
    const st = styles[run.level]!;
    ctx.globalAlpha = st.alpha;
    ctx.beginPath();
    for (let k = run.start; k < run.end; k++) {
      const q = points[plan.order[k]!]!;
      ctx.moveTo(q.x + st.radius, q.y);
      ctx.arc(q.x, q.y, st.radius, 0, 2 * Math.PI);
    }
    ctx.fill();
  }
  // Labels on every drawn edge, last, so that no edge covers a numeral.
  ctx.globalAlpha = 1;
  ctx.font = `${LABEL_SIZE}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = HALO;
  ctx.strokeStyle = colours.page;
  ctx.fillStyle = colours.text;
  for (const k of idx) {
    const s = segments[k]!;
    const a = points[s.a]!;
    const b = points[s.b]!;
    const text = String(labels[k]!);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }
  ctx.restore();
  return {
    pointsDrawn: points.length,
    segmentsDrawn: idx.length,
    segmentsTotal: segments.length,
    verticesOnly: selection.verticesOnly,
    sampled: selection.sampled,
    labelsDrawn: idx.length,
    shortRootsDrawn: 0,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface PictureSvgOptions {
  title: string;
  desc: string;
  id: string;
  /** 'tokens' (custom properties, for the page) or concrete colours (a file). */
  colours?: 'tokens' | PictureColours;
}

/** The SVG of the picture at rest (the snapshot of 7.4 and the figure Export SVG and PNG take). */
export function pictureSvg(p: Picture, options: PictureSvgOptions): string {
  const tokens = options.colours === undefined || options.colours === 'tokens';
  const c = (token: string, concrete: string | undefined): string => (tokens || concrete === undefined ? `var(${token})` : concrete);
  const concrete = tokens ? undefined : (options.colours as PictureColours);
  const scene = vertexScene(p);
  let svg: string;
  if (p.graph === 'polytope') {
    svg = renderSvg(scene, {
      title: options.title,
      desc: options.desc,
      id: options.id,
      colours: tokens ? 'tokens' : { point: concrete!.text, segment: concrete!.road, page: concrete!.page },
    });
  } else {
    svg = movesSvg(p, options, c, concrete);
  }
  const f = (x: number): string => String(roundTo(x, 1));
  const extra: string[] = [];
  const { points } = p.scene;
  if (points.length > p.vertexCount) {
    const d: string[] = [];
    for (let k = p.vertexCount; k < points.length; k++) {
      const q = points[k]!;
      d.push(`M${f(q.x - SQUARE)} ${f(q.y - SQUARE)}h${2 * SQUARE}v${2 * SQUARE}h${-2 * SQUARE}Z`);
    }
    extra.push(`<path data-short-roots="${points.length - p.vertexCount}" fill="none" stroke="${c('--text', concrete?.text)}" stroke-width="1.5" d="${d.join('')}"/>`);
  }
  if (p.highlighted !== null && p.highlighted < p.vertexCount) {
    const q = points[p.highlighted]!;
    extra.push(`<circle data-highlighted="true" cx="${f(q.x)}" cy="${f(q.y)}" r="7" fill="none" stroke="${c('--focus-ring', concrete?.focus)}" stroke-width="2"/>`);
  }
  return extra.length === 0 ? svg : svg.replace(/<\/svg>$/, `${extra.join('')}</svg>`);
}

function movesSvg(p: Picture, options: PictureSvgOptions, c: (token: string, concrete: string | undefined) => string, concrete: PictureColours | undefined): string {
  const scene = vertexScene(p);
  const labels = p.segmentLabels ?? [];
  const f = (x: number): string => String(roundTo(x, 1));
  const styles = levelStyles(scene, { lineWidth: DEFAULT_LINE_WIDTH * 1.5, pointRadius: DEFAULT_POINT_RADIUS });
  const { points, segments, width, height } = scene;
  const id = esc(options.id);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${id}-title ${id}-desc">`);
  out.push(`<title id="${id}-title">${esc(options.title)}</title><desc id="${id}-desc">${esc(options.desc)}</desc>`);
  out.push(`<rect id="${id}-page" width="${width}" height="${height}" fill="${c('--page', concrete?.page)}"/>`);
  const idx = selectSegments(scene, false).indices;
  // Edges grouped by label and depth level, far levels first (the canvas order up to ties).
  out.push(`<g id="${id}-segments" fill="none" stroke-linecap="round">`);
  for (const run of segmentRuns(scene, idx)) {
    const byLabel = new Map<number, string[]>();
    for (let k = run.start; k < run.end; k++) {
      const s = segments[idx[k]!]!;
      const a = points[s.a]!;
      const b = points[s.b]!;
      const label = labels[idx[k]!]!;
      const list = byLabel.get(label) ?? [];
      list.push(`M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`);
      byLabel.set(label, list);
    }
    for (const [label, d] of [...byLabel.entries()].sort((x, y) => x[0] - y[0])) {
      const stroke = concrete === undefined ? moveEdgeColour(label) : edgeStroke(concrete, label);
      out.push(`<path data-edge-label="${label}" stroke="${stroke}" stroke-width="${styles[run.level]!.width}" d="${d.join('')}"/>`);
    }
  }
  out.push('</g>');
  const plan = pointPlan(scene, points.length);
  out.push(`<g id="${id}-points" fill="${c('--text', concrete?.text)}">`);
  for (const run of plan.runs) {
    const st = styles[run.level]!;
    out.push(`<g fill-opacity="${st.alpha}">`);
    for (let k = run.start; k < run.end; k++) {
      const q = points[plan.order[k]!]!;
      out.push(`<circle cx="${f(q.x)}" cy="${f(q.y)}" r="${st.radius}"/>`);
    }
    out.push('</g>');
  }
  out.push('</g>');
  out.push(
    `<g id="${id}-labels" font-size="${LABEL_SIZE}" font-family="ui-monospace, monospace" text-anchor="middle" dominant-baseline="central" fill="${c('--text', concrete?.text)}" stroke="${c('--page', concrete?.page)}" stroke-width="${HALO}" stroke-linejoin="round" paint-order="stroke">`,
  );
  for (const k of idx) {
    const s = segments[k]!;
    const a = points[s.a]!;
    const b = points[s.b]!;
    out.push(`<text data-edge-label="${labels[k]!}" x="${f((a.x + b.x) / 2)}" y="${f((a.y + b.y) / 2)}">${labels[k]!}</text>`);
  }
  out.push('</g>');
  out.push('</svg>');
  return out.join('');
}

/** The number of depth levels (re-exported for the tests). */
export const LEVELS = DEPTH_LEVELS;

/** A rotation in the coordinate plane (i, j) by deg degrees composed after R (null is the identity). */
export function rotateInPlane(R: FloatMatrix | null, n: number, i: number, j: number, deg: number): number[][] {
  const step = rotationInPlane(n, i, j, (deg * Math.PI) / 180);
  return R === null ? step : compose(step, R);
}

/** The projection of a j value on a board of rank n, or null when it does not apply there. */
export function projectionOf(text: string, n: number): Projection | null {
  return parseProjection(text, n);
}
