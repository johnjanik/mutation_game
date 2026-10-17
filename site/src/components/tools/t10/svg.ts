// T10, the Geometry Studio: the picture as SVG (SPEC.md 7.4 snapshot; 4.0 Share and export; 6.3; A-5). Owner
// P4-A3. The same scene, selection, depth levels and order as the canvas of drawing.ts: the polytope graph
// through P4-A2's renderSvg, the move graph with every edge in its node's colour and labelled with the
// node, the short roots and the highlight as overlays. A module of its own so that the browser fetches it
// only when it first rewrites the SVG of the view after a change (it is not needed before the first
// interaction: the server's snapshot stands until then); the build-time snapshot imports it statically.
import { DEFAULT_LINE_WIDTH, DEFAULT_POINT_RADIUS, roundTo } from '../../draw/projector';
import { levelStyles, pointPlan, segmentRuns, selectSegments } from '../../draw/canvasScene';
import { renderSvg } from '../../draw/svgScene';
import { HALO, LABEL_SIZE, SQUARE, edgeStroke, vertexScene, type Picture, type PictureColours } from './drawing';
import { moveEdgeColour } from './graphs';

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
