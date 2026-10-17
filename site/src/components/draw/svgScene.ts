// The SVG snapshot of a projector Scene (SPEC.md 7.4: "Tools that draw on a canvas (T10 ...) ship an
// SVG snapshot of their default view, produced at build time by the same drawing code running in
// Node"). renderSvg consumes the same Scene as drawScene, makes the same selection at rest, uses the
// same depth levels, styles and painter's order, and returns one <svg> element as a string with no
// DOM API, so that T10 can call it during Astro's server rendering and embed it as markup (where the
// colour tokens apply) or write it to a file (with concrete colours).
import { DEFAULT_LINE_WIDTH, DEFAULT_POINT_RADIUS, roundTo, type Scene } from './projector';
import { LIMITS, levelStyles, pointPlan, segmentRuns, selectSegments, type SceneColours } from './canvasScene';

export interface SvgOptions {
  /**
   * 'tokens' (default): stroke var(--road), fill var(--text), background var(--page), the token names of
   * CONTRACTS.md 8 (which token serves which mark is the plan's choice). Or concrete colours, for an
   * <img> file or an export, where custom properties do not resolve.
   */
  colours?: 'tokens' | SceneColours;
  /** The text alternative (A-10): emitted as <title> and <desc>, the first children, and named by aria-labelledby. */
  title?: string;
  desc?: string;
  /** Prefix of every element id, so that two snapshots on one page do not clash (default "projection"). */
  id?: string;
  /** Decimals of the coordinates (default 1, at most 6). */
  decimals?: number;
  /** As drawScene's options. */
  pointRadius?: number;
  lineWidth?: number;
}

const TOKENS: SceneColours = { point: 'var(--text)', segment: 'var(--road)', page: 'var(--page)' };

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** The SVG of a scene at rest, as one string. */
export function renderSvg(scene: Scene, options: SvgOptions = {}): string {
  const colours = options.colours === undefined || options.colours === 'tokens' ? TOKENS : options.colours;
  const decimals = Math.min(6, Math.max(0, Math.floor(options.decimals ?? 1)));
  const id = escapeXml(options.id ?? 'projection');
  const f = (x: number): string => String(roundTo(x, decimals));
  const styles = levelStyles(scene, {
    lineWidth: options.lineWidth ?? DEFAULT_LINE_WIDTH,
    pointRadius: options.pointRadius ?? DEFAULT_POINT_RADIUS,
  });
  const { points, segments, width, height } = scene;
  const out: string[] = [];

  const labelled: string[] = [];
  if (options.title !== undefined) labelled.push(`${id}-title`);
  if (options.desc !== undefined) labelled.push(`${id}-desc`);
  const naming = options.title !== undefined ? ` role="img" aria-labelledby="${labelled.join(' ')}"` : '';
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"${naming}>`);
  if (options.title !== undefined) out.push(`<title id="${id}-title">${escapeXml(options.title)}</title>`);
  if (options.desc !== undefined) out.push(`<desc id="${id}-desc">${escapeXml(options.desc)}</desc>`);
  out.push(`<rect id="${id}-page" width="${width}" height="${height}" fill="${escapeXml(colours.page)}"/>`);

  const selection = selectSegments(scene, false);
  const idx = selection.indices;
  out.push(`<g id="${id}-segments" fill="none" stroke="${escapeXml(colours.segment)}" stroke-linecap="round">`);
  for (const run of segmentRuns(scene, idx)) {
    const style = styles[run.level]!;
    const d: string[] = [];
    for (let k = run.start; k < run.end; k++) {
      const s = segments[idx[k]!]!;
      const a = points[s.a]!;
      const b = points[s.b]!;
      d.push(`M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`);
    }
    out.push(`<path stroke-width="${style.width}" stroke-opacity="${style.alpha}" d="${d.join('')}"/>`);
  }
  out.push('</g>');

  const plan = pointPlan(scene, Math.min(points.length, LIMITS.verticesDrawn));
  out.push(`<g id="${id}-points" fill="${escapeXml(colours.point)}">`);
  for (const run of plan.runs) {
    const style = styles[run.level]!;
    out.push(`<g fill-opacity="${style.alpha}">`);
    for (let k = run.start; k < run.end; k++) {
      const p = points[plan.order[k]!]!;
      out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${style.radius}"/>`);
    }
    out.push('</g>');
  }
  out.push('</g>');
  out.push('</svg>');
  return out.join('');
}
