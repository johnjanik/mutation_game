// The scene of T8 written as SVG markup (SPEC.md 7.1, 7.4, 6.3, 7.5 A-5, A-10). Pure string code that
// runs in Node: it is the inline graph at most 192 elements, the SVG snapshot of the default view above
// 192 elements ("produced at build time by the same drawing code running in Node", 7.4), and the copy
// that SVG and PNG export take. Colours are the tokens --edge-1 to --edge-8 through `style` (a CSS
// variable does not resolve in a presentation attribute); every edge also carries its node label as
// text (A-5). Hooks: data-out="edge" with data-from, data-to (positions in label order), data-label
// and data-on-path; the root carries role="img" and an aria-label naming the board, the number of
// positions and of layers (A-10), and data-out="snapshot" when it stands for a canvas.
import type { Scene } from './layout';

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Dot radius, path marker radius and ring radius in pixels. */
export const DOT_R = 4;
export const PATH_R = 6;
export const RING_R = 10;

export interface SvgOptions {
  /** The root stands for the canvas (above 192 elements): data-out="snapshot". */
  snapshot?: boolean;
}

/** The SVG markup of a scene. */
export function sceneToSvg(scene: Scene, opts: SvgOptions = {}): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" class="weyl-svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="img" aria-label="${esc(scene.label)}" data-edge-mode="${scene.edgeMode}"${opts.snapshot ? ' data-out="snapshot"' : ''}>`,
  );
  parts.push(`<title>${esc(scene.label)}</title>`);
  parts.push('<g class="weyl-edges" fill="none">');
  for (const e of scene.edges) {
    const w = e.onPath ? 4 : 1.5;
    parts.push(
      `<g data-out="edge" data-from="${e.from}" data-to="${e.to}" data-label="${e.label}" data-on-path="${e.onPath ? 'true' : 'false'}" style="stroke: var(--edge-${e.token}); color: var(--edge-${e.token});">` +
        `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke-width="${w}" stroke-linecap="round"/>` +
        `<text x="${e.lx}" y="${e.ly}" text-anchor="middle" dominant-baseline="central" font-size="11" style="fill: var(--text); stroke: var(--page); stroke-width: 3px; paint-order: stroke;"${e.onPath ? ' font-weight="bold"' : ''}>${e.label}</text>` +
        '</g>',
    );
  }
  parts.push('</g>');
  parts.push('<g class="weyl-dots">');
  for (const d of scene.dots) {
    if (d.onPath) {
      // The path is marked by size and a ring as well as by weight of the edges (A-5).
      parts.push(`<circle cx="${d.x}" cy="${d.y}" r="${RING_R}" fill="none" style="stroke: var(--text);" stroke-width="2" data-path-mark="true"/>`);
      parts.push(`<circle cx="${d.x}" cy="${d.y}" r="${PATH_R}" style="fill: var(--text);"/>`);
    } else {
      parts.push(`<circle cx="${d.x}" cy="${d.y}" r="${DOT_R}" style="fill: var(--text);"/>`);
    }
    if (d.focus) {
      parts.push(`<rect x="${d.x - scene.hit / 2}" y="${d.y - scene.hit / 2}" width="${scene.hit}" height="${scene.hit}" rx="4" fill="none" style="stroke: var(--focus-ring);" stroke-width="2" stroke-dasharray="4 3" data-focus-mark="true"/>`);
    }
  }
  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('');
}

/** The number of dots in a scene's markup (tests). */
export function countDots(svg: string): number {
  return (svg.match(/<circle [^>]*r="(4|6)"/g) ?? []).length;
}
