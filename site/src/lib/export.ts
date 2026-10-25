// Data export from any tool (SPEC.md 6.6 "Data export", 4.0 "Share and export"; CONTRACTS.md 4).
// JSON with the state, the engine version, the site's git commit and the derived tables shown on
// screen, every integer as a JSON number when safe and as decimal text otherwise. SVG and PNG export
// arrive in phase 2 (P2-A6) and LaTeX in phase 6 (P6-A5); they extend this file.
// ToolFrame imports this module with a dynamic import() on the first click of "Download data".
import { version as engineVersion } from '../../../packages/engine/package.json';
import { cloneState, type ToolId, type ToolState } from './state';

/** The site's git commit, set at build time (PUBLIC_GIT_COMMIT); "unknown" when the build did not set it. */
export const GIT_COMMIT: string = (import.meta.env.PUBLIC_GIT_COMMIT as string | undefined) || 'unknown';

export const ENGINE_VERSION: string = engineVersion;

function isRational(x: object): x is { num: bigint; den: bigint } {
  const o = x as Record<string, unknown>;
  return Object.keys(o).length === 2 && typeof o.num === 'bigint' && typeof o.den === 'bigint';
}

/** The integer rule of 6.6 applied through a value: bigint and unsafe integers to decimal text. */
function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isSafeInteger(n) && BigInt(n) === value ? n : value.toString();
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) return BigInt(value).toString();
    return Object.is(value, -0) ? 0 : value; // floats (geometry) stay numbers
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Map) return [...value.entries()].map(([k, v]) => [jsonSafe(k), jsonSafe(v)]);
  // A rational whose denominator is 1 is an integer, so the integer rule applies to it.
  if (isRational(value)) return value.den === 1n ? jsonSafe(value.num) : `${value.num}/${value.den}`;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = jsonSafe(v);
  return out;
}

/**
 * The JSON of "Download data", pretty-printed with two spaces:
 * { schema: 1, tool, state, engineVersion, commit, derived }.
 */
export function exportJSON(state: ToolState, derived: Record<string, unknown>): string {
  const doc = {
    schema: 1,
    tool: state.tool,
    state: jsonSafe(cloneState(state)),
    engineVersion: ENGINE_VERSION,
    commit: GIT_COMMIT,
    derived: jsonSafe(derived),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** What "Download data" saves: `<toolId>-<instanceId or toolId>.json` holding exportJSON (plan). */
export function downloadData(
  toolId: ToolId,
  instanceId: string,
  state: ToolState,
  derived: Record<string, unknown>,
): { filename: string; text: string } {
  return { filename: `${toolId}-${instanceId || toolId}.json`, text: exportJSON(state, derived) };
}

// ---------------------------------------------------------------------------------------------
// SVG and PNG export of a tool's figure (phase 2, P2-A6; SPEC.md 4.0 "Share and export", 6.1, 8.3;
// CONTRACTS.md 4). The export is a picture of what is on screen now: it recomputes nothing and
// calls no engine function. Every DOM reference sits inside a function body, so this module loads
// in Node (export.test.ts, the build-time render of every tool).
// ---------------------------------------------------------------------------------------------

/** The footer line of SPEC 8.3 (plan; CONTRACTS 4 names the type without defining it). */
export interface FooterLine {
  /** The name the tool shows for its board (SPEC 6.6 spelling, D19), or `custom board`. */
  boardName: string;
  /** The absolute link "Copy link" copies (history.ts linkFor): the state and the site address. */
  link: string;
}

/** The most characters a footer or note line holds (plan). */
export const FOOTER_LINE_CHARS = 96;
/** The selector of a board node label drawn by Node.svelte (P0-A5's hook `data-label` on the <text>). */
export const LABEL_SELECTOR = 'text[data-label]';

/** The visible text of the footer: board name, a middle dot, the link. */
export function footerText(f: FooterLine): string {
  return `${f.boardName} · ${f.link}`;
}

/**
 * Breaks a text into lines of at most `max` characters, never dropping one (the lines joined again
 * equal the input) and with no cap on the number of lines: before an `&` where possible, else after
 * the last `.`, `/` or `,` of the window, else hard.
 */
export function footerLines(text: string, max: number = FOOTER_LINE_CHARS): string[] {
  const width = Math.max(1, Math.floor(max));
  const lines: string[] = [];
  let rest = text;
  while (rest.length > width) {
    let cut = -1;
    for (let i = width; i >= 1 && cut < 0; i--) if (rest[i] === '&') cut = i;
    for (let i = width - 1; i >= 0 && cut < 0; i--) if ('./,'.includes(rest[i]!)) cut = i + 1;
    if (cut <= 0) cut = width;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  lines.push(rest);
  return lines;
}

/** `${toolId}-${boardName}.${ext}` with every character outside [A-Za-z0-9._-] replaced by `-`. */
export function exportFileName(toolId: string, boardName: string, ext: string): string {
  return `${toolId}-${boardName.replace(/[^A-Za-z0-9._-]/g, '-')}.${ext}`;
}

/** The largest side of an exported PNG (browsers refuse very large canvases). */
export const PNG_MAX_SIDE = 8192;

/** The PNG size for a figure of width by height CSS pixels at `scale`, the larger side capped at 8192. */
export function pngSize(width: number, height: number, scale = 2): [number, number] {
  const larger = Math.max(width, height);
  const s = larger * scale > PNG_MAX_SIDE ? PNG_MAX_SIDE / larger : scale;
  return [Math.round(width * s), Math.round(height * s)];
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
/** The gap between stacked drawings of a composite, in CSS pixels. */
const COMPOSITE_GAP = 16;
/** Footer and note: 12-pixel monospaced text, 16-pixel lines, 8 pixels of margin (plan). */
const FOOTER_FONT_PX = 12;
const FOOTER_LINE_PX = 16;
const FOOTER_PAD_PX = 8;
/** A generous advance of one monospaced character at 12 pixels (0.625 em), to wrap within the figure. */
const FOOTER_CHAR_PX = 7.5;
/** The fewest characters a footer line holds; a narrower figure is widened to fit them. */
const FOOTER_MIN_CHARS = 24;
const MONO_FALLBACK = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** The computed properties written onto every exported element (5.2 step 2); none can hold a url(). */
const STYLE_PROPS = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
  'stroke-linecap', 'stroke-linejoin', 'vector-effect', 'opacity', 'font-family', 'font-size', 'font-weight',
  'font-style', 'font-variant-numeric', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order',
  'visibility', 'color',
] as const;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function needsBrowser(): void {
  if (typeof document === 'undefined') throw new Error('exportSVG needs a browser');
}

/** A custom property of the page resolved to the colour the reader sees (rgb(...)). */
function resolvedColour(name: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  probe.style.display = 'none';
  (document.body ?? document.documentElement).append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

function rootProperty(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v === '' ? fallback : v;
}

function isTransparent(colour: string): boolean {
  return colour === '' || colour === 'transparent' || /^rgba\(.*,\s*0(\.0+)?\)$/.test(colour);
}

/** The two properties of STYLE_PROPS that are not inherited, with their initial values. */
const NOT_INHERITED: Record<string, string> = { opacity: '1', 'vector-effect': 'none' };

/**
 * The `style` text of one element: every property of STYLE_PROPS whose computed value differs from
 * what the element would get anyway (its parent's computed value for an inherited property, the
 * initial value otherwise), or that a presentation attribute of the element sets. `parent` null
 * (the drawing's root) writes them all. This keeps the file small without changing what is drawn.
 */
function styleText(el: Element, cs: CSSStyleDeclaration, parent: CSSStyleDeclaration | null): string {
  const parts: string[] = [];
  for (const p of STYLE_PROPS) {
    const v = cs.getPropertyValue(p);
    if (v === '' || v.includes('url(') || v.includes('var(')) continue;
    const implied = p in NOT_INHERITED ? NOT_INHERITED[p] : parent?.getPropertyValue(p);
    if (parent === null || v !== implied || el.hasAttribute(p)) parts.push(`${p}: ${v}`);
  }
  return parts.join('; ');
}

const asMinus = (value: string): string => value.replace(/^-/, '−');

/**
 * The node buttons that belong to a drawing: those of the box holding both layers (Board.svelte
 * puts the SVG and its group of buttons in one element), else those of the tool root.
 */
function buttonScope(live: SVGSVGElement): Element | null {
  const parent = live.parentElement;
  if (parent?.querySelector('[data-node]')) return parent;
  return live.closest('[data-tool]');
}

/**
 * Values of the drawn nodes (5.2 step 5, 5.7). A drawn numeral (`data-numeral`, its label) is paired
 * with the one node button of the drawing's box whose `data-node` is that label. A fraction is redrawn
 * as one <text> with two <tspan> (numerator, denominator) beside its bar, inside the numeral group,
 * marked data-frac="p/q". A node whose drawn numeral differs from its button's data-value (a shortened
 * long number) gets a <title> with the exact digits and is marked for the note of exact digits.
 */
function rewriteValues(live: SVGSVGElement, liveEls: Element[], cloneEls: Element[]): void {
  const scope = buttonScope(live);
  if (!scope) return;
  liveEls.forEach((liveNum, i) => {
    const label = liveNum.getAttribute('data-numeral');
    if (label === null) return;
    const buttons = [...scope.querySelectorAll('[data-node]')].filter((b) => b.getAttribute('data-node') === label && !live.contains(b));
    if (buttons.length !== 1) return;
    const value = buttons[0]!.getAttribute('data-value');
    if (value === null) return;
    const exact = asMinus(value);
    const cloneNum = cloneEls[i]!;
    let drawn = (liveNum.textContent ?? '').replace(/\s+/g, '');
    if (value.includes('/')) {
      const texts = [...cloneNum.querySelectorAll('text')];
      const bar = cloneNum.querySelector('line');
      if (texts.length >= 2) {
        const num = texts[texts.length - 2]!;
        const den = texts[texts.length - 1]!;
        const sign = exact.startsWith('−') ? '−' : '';
        drawn = `${sign}${num.textContent ?? ''}/${den.textContent ?? ''}`;
        const text = num.cloneNode(false) as SVGTextElement;
        text.removeAttribute('x');
        text.removeAttribute('y');
        const top = svgEl('tspan', { x: num.getAttribute('x') ?? 0, y: num.getAttribute('y') ?? 0 });
        top.textContent = `${sign}${num.textContent ?? ''}`;
        const bottom = svgEl('tspan', { x: den.getAttribute('x') ?? 0, y: den.getAttribute('y') ?? 0 });
        bottom.textContent = den.textContent ?? '';
        text.append(top, bottom);
        cloneNum.replaceChildren(text, ...(bar ? [bar] : []));
        cloneNum.setAttribute('data-frac', value);
      }
    }
    if (drawn !== exact) {
      const group = cloneNum.parentElement ?? cloneNum;
      const title = svgEl('title');
      title.textContent = exact;
      group.prepend(title);
      group.setAttribute('data-exact-label', label);
      group.setAttribute('data-exact-value', exact);
    }
  });
}

/**
 * HTML drawn over an SVG (the vertices of T2's orbit garden are buttons over the SVG of its edges):
 * every button of the drawing's box that shows a border, a background, a dot or text is drawn into
 * the export as a rounded rectangle with its text, in the drawing's own coordinates. The transparent
 * hit areas of Board.svelte show nothing and are skipped.
 */
function drawOverlay(live: SVGSVGElement, clone: SVGSVGElement): void {
  const scope = live.parentElement;
  const ctm = live.getScreenCTM();
  if (!scope || !ctm) return;
  const inv = ctm.inverse();
  const box = live.getBoundingClientRect();
  const layer = svgEl('g', { 'data-overlay': '' });
  for (const b of scope.querySelectorAll('button')) {
    if (live.contains(b)) continue;
    const r = b.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom) continue;
    const cs = getComputedStyle(b);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const text = (b.textContent ?? '').trim();
    const border = parseFloat(cs.borderTopWidth) || 0;
    const showsBorder = border > 0 && !isTransparent(cs.borderTopColor);
    const filled = !isTransparent(cs.backgroundColor);
    const before = getComputedStyle(b, '::before');
    const dot = before.content !== 'none' && before.content !== 'normal' && !isTransparent(before.backgroundColor);
    if (!text && !showsBorder && !filled && !dot) continue;
    const p = new DOMPoint(r.left, r.top).matrixTransform(inv);
    const q = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
    const w = q.x - p.x;
    const h = q.y - p.y;
    const k = w / r.width;
    const g = svgEl('g');
    if (b.title) {
      const t = svgEl('title');
      t.textContent = b.title;
      g.append(t);
    }
    if (showsBorder || filled) {
      const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.height / 2, r.width / 2) * k;
      g.append(
        svgEl('rect', {
          x: p.x + (border * k) / 2,
          y: p.y + (border * k) / 2,
          width: Math.max(0, w - border * k),
          height: Math.max(0, h - border * k),
          rx: radius,
          style: `fill: ${filled ? cs.backgroundColor : 'none'}; stroke: ${showsBorder ? cs.borderTopColor : 'none'}; stroke-width: ${border * k}`,
        }),
      );
    }
    if (dot) {
      const inset = parseFloat(before.top) || 0;
      g.append(svgEl('circle', { cx: p.x + w / 2, cy: p.y + h / 2, r: Math.max(0, (Math.min(r.width, r.height) / 2 - inset) * k), style: `fill: ${before.backgroundColor}` }));
    }
    if (text) {
      const t = svgEl('text', {
        x: p.x + w / 2,
        y: p.y + h / 2,
        style: `fill: ${cs.color}; font-family: ${cs.fontFamily}; font-size: ${(parseFloat(cs.fontSize) || 14) * k}px; font-weight: ${cs.fontWeight}; font-variant-numeric: ${cs.fontVariantNumeric}; text-anchor: middle; dominant-baseline: central; white-space: pre`,
      });
      t.textContent = text;
      g.append(t);
    }
    layer.append(g);
  }
  if (layer.childNodes.length > 0) clone.append(layer);
}

/**
 * A detached copy of a live SVG with the computed styles of the theme in force written as `style`
 * attributes (5.2 step 2): no var(--...) and no colour that depends on a class or a stylesheet is
 * left. Elements not displayed and hint ghosts are dropped; fractions are redrawn as SVG text and
 * long numbers marked (5.2 step 5, 5.7); HTML drawn over the SVG is drawn into it. The label marker
 * (data-label) is kept, so that withoutLabels can find the labels afterwards. The copy's width and
 * height are the live element's size in CSS pixels.
 */
export function inlineStyles(live: SVGSVGElement): SVGSVGElement {
  needsBrowser();
  // A colour transition still running (Node.svelte fades fills) is taken at its end, the state shown.
  try {
    for (const a of live.getAnimations({ subtree: true })) a.finish();
  } catch {
    // An animation that cannot finish (infinite) is taken as it is.
  }
  const clone = live.cloneNode(true) as SVGSVGElement;
  const liveEls = [...live.querySelectorAll('*')];
  const cloneEls = [...clone.querySelectorAll('*')];
  const dropped: Element[] = [];
  const computed = new Map<Element, CSSStyleDeclaration>([[live, getComputedStyle(live)]]);
  clone.setAttribute('style', styleText(live, computed.get(live)!, null));
  liveEls.forEach((el, i) => {
    const copy = cloneEls[i]!;
    const tag = el.tagName.toLowerCase();
    if (tag === 'title' || tag === 'desc' || tag === 'style') return;
    const cs = getComputedStyle(el);
    computed.set(el, cs);
    if (cs.display === 'none' || el.hasAttribute('data-ghost')) {
      dropped.push(copy);
      return;
    }
    const style = styleText(el, cs, (el.parentElement && computed.get(el.parentElement)) ?? null);
    if (style === '') copy.removeAttribute('style');
    else copy.setAttribute('style', style);
  });
  // Hydration markers and other comments carry nothing a reader needs.
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const c of comments) c.parentNode?.removeChild(c);
  rewriteValues(live, liveEls, cloneEls);
  for (const el of dropped) el.remove();
  drawOverlay(live, clone);
  const r = live.getBoundingClientRect();
  clone.setAttribute('width', String(Math.round(r.width)));
  clone.setAttribute('height', String(Math.round(r.height)));
  return clone;
}

/**
 * One detached figure from several live SVGs (T1's linked view; a drawing with an overlay, T9).
 * Each is inlined, then placed as a nested <svg> at its size in CSS pixels. Drawings that overlap on
 * screen keep their relative positions; separate ones are stacked with a 16-pixel gap, in document
 * order. The root's width and height are pixels with a matching viewBox.
 */
export function composeFigure(svgs: SVGSVGElement[]): SVGSVGElement {
  needsBrowser();
  const rects = svgs.map((s) => s.getBoundingClientRect());
  const overlap = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  let clusters: number[][] = [];
  rects.forEach((r, i) => {
    const hit = clusters.filter((c) => c.some((j) => overlap(rects[j]!, r)));
    clusters = clusters.filter((c) => !hit.includes(c));
    clusters.push(hit.flat().concat(i).sort((a, b) => a - b));
  });
  clusters.sort((a, b) => a[0]! - b[0]!);
  const root = svgEl('svg');
  let y = 0;
  let width = 0;
  for (const c of clusters) {
    const left = Math.min(...c.map((j) => rects[j]!.left));
    const top = Math.min(...c.map((j) => rects[j]!.top));
    const right = Math.max(...c.map((j) => rects[j]!.right));
    const bottom = Math.max(...c.map((j) => rects[j]!.bottom));
    for (const j of c) {
      const nested = inlineStyles(svgs[j]!);
      nested.setAttribute('x', String(Math.round(rects[j]!.left - left)));
      nested.setAttribute('y', String(y + Math.round(rects[j]!.top - top)));
      root.append(nested);
    }
    width = Math.max(width, Math.round(right - left));
    y += Math.round(bottom - top) + COMPOSITE_GAP;
  }
  const height = Math.max(0, y - COMPOSITE_GAP);
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  return root;
}

/** Removes the board node labels (LABEL_SELECTOR) from a detached figure and returns it (SPEC 6.1). */
export function withoutLabels(root: SVGSVGElement): SVGSVGElement {
  for (const el of root.querySelectorAll(LABEL_SELECTOR)) el.remove();
  return root;
}

/** Lines of monospaced 12-pixel text from `top`; its height is 8 + 16 per line + 8. */
function textBlock(lines: string[], top: number, fill: string, font: string, hook: string): { g: SVGGElement; height: number } {
  const g = svgEl('g', { [hook]: '' });
  lines.forEach((line, k) => {
    const t = svgEl('text', {
      x: FOOTER_PAD_PX,
      y: top + FOOTER_LINE_PX * (k + 1),
      style: `fill: ${fill}; font-family: ${font}; font-size: ${FOOTER_FONT_PX}px; font-variant-numeric: tabular-nums; white-space: pre`,
    });
    t.textContent = line;
    g.append(t);
  });
  return { g, height: FOOTER_PAD_PX + FOOTER_LINE_PX * lines.length + FOOTER_PAD_PX };
}

/**
 * The figure as a standalone SVG file (CONTRACTS 4). A live SVG is inlined first; a detached one
 * (composeFigure, withoutLabels) already is. The file's root is in CSS pixels: the drawing nested at
 * the top, then the note of exact digits of long numbers, then the footer line when `footer` is
 * given; a background in the page colour covers all of it.
 */
export function exportSVG(svg: SVGSVGElement, footer: FooterLine | null): string {
  needsBrowser();
  let drawing: SVGSVGElement;
  let W: number;
  let H: number;
  if (svg.isConnected) {
    const r = svg.getBoundingClientRect();
    W = Math.round(r.width);
    H = Math.round(r.height);
    drawing = inlineStyles(svg);
  } else {
    drawing = svg.cloneNode(true) as SVGSVGElement;
    W = Math.round(parseFloat(svg.getAttribute('width') ?? '0') || 0);
    H = Math.round(parseFloat(svg.getAttribute('height') ?? '0') || 0);
  }
  drawing.setAttribute('x', '0');
  drawing.setAttribute('y', '0');
  drawing.setAttribute('width', String(W));
  drawing.setAttribute('height', String(H));

  // Nothing of the file depends on a class, a stylesheet, a custom property or a hidden state.
  for (const el of [drawing, ...drawing.querySelectorAll('*')]) {
    if (el.tagName.toLowerCase() === 'style') {
      el.remove();
      continue;
    }
    for (const name of ['class', 'aria-hidden', 'tabindex', 'focusable']) el.removeAttribute(name);
    if (el.hasAttributeNS(XLINK_NS, 'href')) {
      el.setAttribute('href', el.getAttributeNS(XLINK_NS, 'href') ?? '');
      el.removeAttributeNS(XLINK_NS, 'href');
    }
    for (const a of [...el.attributes]) if (a.value.includes('var(')) el.removeAttribute(a.name);
  }

  const marked = [...drawing.querySelectorAll('[data-exact-value]')];
  const minWidth = 2 * FOOTER_PAD_PX + FOOTER_MIN_CHARS * FOOTER_CHAR_PX;
  const width = footer || marked.length > 0 ? Math.max(W, minWidth) : W;
  const chars = Math.max(FOOTER_MIN_CHARS, Math.min(FOOTER_LINE_CHARS, Math.floor((width - 2 * FOOTER_PAD_PX) / FOOTER_CHAR_PX)));
  const ink = resolvedColour('--text');
  const font = rootProperty('--font-numerals', MONO_FALLBACK);

  const root = svgEl('svg', { role: 'img' });
  const title = svgEl('title');
  title.textContent = footer ? footer.boardName : 'exported figure';
  const background = svgEl('rect', { x: 0, y: 0, width, fill: resolvedColour('--page') });
  root.append(title, background, drawing);

  let T = H;
  // The note of exact digits (SPEC 4.0 Long numbers: "in every export"), one entry per shortened node.
  if (marked.length > 0) {
    const lines = marked.flatMap((g) => footerLines(`${g.getAttribute('data-exact-label') ?? ''} = ${g.getAttribute('data-exact-value') ?? ''}`, chars));
    for (const g of marked) {
      g.removeAttribute('data-exact-label');
      g.removeAttribute('data-exact-value');
    }
    const note = textBlock(lines, T, ink, font, 'data-exact');
    root.append(note.g);
    T += note.height;
  }
  // The footer line (SPEC 8.3): board name and link, wrapped without a cap, inside a link.
  if (footer) {
    const block = textBlock(footerLines(footerText(footer), chars), T, ink, font, 'data-footer');
    const a = svgEl('a', { href: footer.link });
    a.append(...block.g.childNodes);
    block.g.append(a);
    root.append(block.g);
    T += block.height;
  }
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(T));
  root.setAttribute('viewBox', `0 0 ${width} ${T}`);
  background.setAttribute('height', String(T));
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(root)}`;
}

/** The figure as a PNG at `scale` (default 2), drawn from exportSVG through an Image and a canvas. */
export async function exportPNG(svg: SVGSVGElement, footer: FooterLine | null, scale = 2): Promise<Blob> {
  const text = exportSVG(svg, footer);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const width = parseFloat(doc.documentElement.getAttribute('width') ?? '0');
  const height = parseFloat(doc.documentElement.getAttribute('height') ?? '0');
  const [w, h] = pngSize(width, height, scale);
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('the figure could not be rendered as an image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('the figure could not be rendered as an image');
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('the figure could not be rendered as an image'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------------------------
// LaTeX export and the citation text (phase 6, P6-A5; SPEC.md 6.7, 2.15, 4.0 "Share and export",
// "Long numbers", 7.4 "Citing"; CONTRACTS.md 4). Pure text: no DOM, no engine call, no KaTeX, so that
// it runs in Node at build time (T14) and loads with the dynamic import() of ToolFrame.
// ---------------------------------------------------------------------------------------------

/** The three kinds of CONTRACTS 4. */
export type LatexKind = 'dynkin' | 'tikz-graph' | 'tikz-points';

/**
 * A Dynkin or Satake diagram (plan). `type` names a finite type ("E6", "A5", "C2"); `black` holds the
 * labels of the black nodes (default none); `tau` the image of every node, as labels in label order
 * (default the identity): the convention of ToolState.black and ToolState.tau (SPEC 6.6) and of the
 * golden fields `black_nodes` and `tau`. On a named finite board label k is Bourbaki node k (E-7).
 */
export interface DynkinExportData {
  type: string;
  black?: readonly number[];
  tau?: readonly number[];
}

/** An orbit graph (plan): coordinates in centimetres, y up; edges join indices of `nodes`. */
export interface TikzGraphData {
  nodes: { x: number; y: number; label?: string }[];
  edges: [number, number][];
  directed?: boolean;
}

/** A projection (plan): points in centimetres, y up; edges join indices of `points`. */
export interface TikzPointsData {
  points: [number, number][];
  edges?: [number, number][];
  labels?: (string | null)[];
}

/** The site's name (SPEC 1.7, D1 default: the working title [D]); the layouts type it as text. */
export const SITE_NAME = 'Two Games on a Dynkin Diagram';

/** What "Export LaTeX" shows in data-out="exportNotice" when the tool has no LaTeX form (plan). */
export const NOTHING_TO_EXPORT_LATEX = 'nothing to export as LaTeX';

/**
 * The finite types the package draws with explicit marks, by family letter: the ranks of the 32 types
 * of the golden file (A1..A8, B2..B8, C2..C8, D4..D8, E6..E8, F4, G2). Affine, twisted, preset and
 * custom boards have no form in SPEC 6.7 and are refused.
 */
const RANKS: Record<string, readonly [number, number]> = { A: [1, 8], B: [2, 8], C: [2, 8], D: [4, 8], E: [6, 8], F: [4, 4], G: [2, 2] };

/** The family letter and rank of a finite type name, or null when the name is not one of the 32. */
function finiteType(name: unknown): { letter: string; rank: number } | null {
  if (typeof name !== 'string') return null;
  const m = /^([A-G])([1-9])$/.exec(name);
  if (!m) return null;
  const letter = m[1]!;
  const rank = Number(m[2]);
  const [lo, hi] = RANKS[letter]!;
  return rank >= lo && rank <= hi ? { letter, rank } : null;
}

/** Whether `name` is one of the 32 finite types that exportLaTeX('dynkin') draws. */
export function isDynkinType(name: unknown): boolean {
  return finiteType(name) !== null;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** A list of node labels, each an integer from 1 to n. */
function labelList(value: unknown, n: number, what: string): number[] {
  if (!Array.isArray(value)) throw new RangeError(`exportLaTeX: ${what} must be a list of node labels`);
  for (const v of value) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > n) throw new RangeError(`exportLaTeX: ${what} holds ${String(v)}, which is not a node label from 1 to ${n}`);
  }
  return value as number[];
}

function dynkin(data: unknown): string {
  if (!isRecord(data)) throw new RangeError('exportLaTeX: dynkin data must be an object { type, black?, tau? }');
  const t = finiteType(data.type);
  if (t === null) throw new RangeError(`exportLaTeX: ${typeof data.type === 'string' ? data.type : 'a board'} is not a finite type the dynkin-diagrams package draws with marks (A1..A8, B2..B8, C2..C8, D4..D8, E6..E8, F4, G2)`);
  const n = t.rank;
  const black = new Set<number>();
  for (const b of data.black === undefined ? [] : labelList(data.black, n, 'black')) {
    if (black.has(b)) throw new RangeError(`exportLaTeX: black names node ${b} twice`);
    black.add(b);
  }
  const identity = Array.from({ length: n }, (_, k) => k + 1);
  const tau = data.tau === undefined ? identity : labelList(data.tau, n, 'tau');
  if (tau.length !== n) throw new RangeError(`exportLaTeX: tau must give the image of each of the ${n} nodes`);
  if (new Set(tau).size !== n) throw new RangeError('exportLaTeX: tau is not a permutation of the nodes');
  for (let i = 1; i <= n; i++) {
    if (tau[tau[i - 1]! - 1] !== i) throw new RangeError(`exportLaTeX: tau squared is not the identity (node ${i})`);
  }
  // One mark per node in Bourbaki order (label k is Bourbaki node k): o white, * black.
  const marks = identity.map((k) => (black.has(k) ? '*' : 'o')).join('');
  // Arrows join white nodes exchanged by tau (2.15, 6.4 "pairs of white nodes"); a tau that moves black
  // nodes contributes nothing. Each pair is its two labels, smaller first, in order of the smaller.
  const pairs: string[] = [];
  for (let i = 1; i <= n; i++) {
    const j = tau[i - 1]!;
    if (i < j && !black.has(i) && !black.has(j)) {
      if (j > 9) throw new RangeError('exportLaTeX: a label above 9 cannot be written in the involutions option');
      pairs.push(`${i}${j}`);
    }
  }
  const option = pairs.length > 0 ? `[involutions={${pairs.join(';')}}]` : '';
  return `\\dynkin${option} ${t.letter}{${marks}}`;
}

/** A coordinate with at most four decimals, trailing zeros removed, minus zero written 0 (plan). */
function coordinate(x: unknown): string {
  if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) >= 1e15) throw new RangeError(`exportLaTeX: ${String(x)} is not a coordinate`);
  const s = x.toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

const TEX_SPECIALS: Record<string, string> = {
  '\\': '\\mbox{\\textbackslash}',
  '#': '\\#',
  $: '\\$',
  '%': '\\%',
  '&': '\\&',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\mbox{\\textasciitilde}',
  '^': '\\mbox{\\textasciicircum}',
};

/** A label in math mode with every TeX special character escaped; written in full, never shortened (4.0). */
function texLabel(label: unknown): string {
  if (typeof label !== 'string') throw new RangeError('exportLaTeX: a label must be text');
  return label === '' ? '' : `$${label.replace(/[\\#$%&_{}~^]/g, (c) => TEX_SPECIALS[c]!)}$`;
}

/** A list of edges, each a pair of integer indices below `count`. */
function edgeList(value: unknown, count: number): [number, number][] {
  if (!Array.isArray(value)) throw new RangeError('exportLaTeX: edges must be a list of pairs of indices');
  for (const e of value) {
    const ok = Array.isArray(e) && e.length === 2 && e.every((k) => typeof k === 'number' && Number.isInteger(k) && k >= 0 && k < count);
    if (!ok) throw new RangeError(`exportLaTeX: the edge ${JSON.stringify(e)} does not join two of the ${count} vertices`);
  }
  return value as [number, number][];
}

const picture = (lines: string[]): string => ['\\begin{tikzpicture}', ...lines.map((l) => `  ${l}`), '\\end{tikzpicture}'].join('\n');

function tikzGraph(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.nodes)) throw new RangeError('exportLaTeX: tikz-graph data must be { nodes, edges, directed? }');
  const nodes = data.nodes as unknown[];
  const lines = nodes.map((v, k) => {
    if (!isRecord(v)) throw new RangeError(`exportLaTeX: vertex ${k} must be { x, y, label? }`);
    const label = v.label === undefined ? '' : texLabel(v.label);
    return `\\node[circle,draw,inner sep=1pt] (n${k}) at (${coordinate(v.x)},${coordinate(v.y)}) {${label}};`;
  });
  // An arrow tip is a TikZ option on the same straight path: \draw[->] (a) -- (b).
  const draw = data.directed === true ? '\\draw[->]' : '\\draw';
  for (const [a, b] of edgeList(data.edges, nodes.length)) lines.push(`${draw} (n${a}) -- (n${b});`);
  return picture(lines);
}

function tikzPoints(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.points)) throw new RangeError('exportLaTeX: tikz-points data must be { points, edges?, labels? }');
  const points = (data.points as unknown[]).map((p, k) => {
    if (!Array.isArray(p) || p.length !== 2) throw new RangeError(`exportLaTeX: point ${k} must be a pair [x, y]`);
    return `(${coordinate(p[0])},${coordinate(p[1])})`;
  });
  let labels: unknown[] = [];
  if (data.labels !== undefined) {
    if (!Array.isArray(data.labels) || data.labels.length !== points.length) throw new RangeError('exportLaTeX: labels must give one label or null per point');
    labels = data.labels;
  }
  const lines: string[] = [];
  points.forEach((at, k) => {
    lines.push(`\\fill ${at} circle (1pt);`);
    const label = labels[k];
    if (label !== undefined && label !== null && label !== '') lines.push(`\\node[anchor=south west,inner sep=1pt] at ${at} {${texLabel(label)}};`);
  });
  for (const [a, b] of data.edges === undefined ? [] : edgeList(data.edges, points.length)) lines.push(`\\draw ${points[a]} -- ${points[b]};`);
  return picture(lines);
}

/**
 * LaTeX for a diagram or a figure (CONTRACTS 4; SPEC 6.7). 'dynkin': one \dynkin line for the package
 * dynkin-diagrams, explicit marks in Bourbaki order and the arrows as the involutions option
 * (DynkinExportData). 'tikz-graph' and 'tikz-points': a tikzpicture of plain coordinates (TikzGraphData,
 * TikzPointsData). No trailing newline. Throws RangeError, naming the fault, on data it cannot write.
 */
export function exportLaTeX(kind: 'dynkin' | 'tikz-graph' | 'tikz-points', data: unknown): string {
  switch (kind) {
    case 'dynkin':
      return dynkin(data);
    case 'tikz-graph':
      return tikzGraph(data);
    case 'tikz-points':
      return tikzPoints(data);
    default:
      throw new RangeError(`exportLaTeX: unknown kind ${String(kind)}`);
  }
}

/**
 * The text of the .tex file "Export LaTeX" downloads (plan): a comment with the link, a comment naming
 * the package the snippet needs, the body, a final newline. A snippet to \input, not a document.
 */
export function latexFile(kind: LatexKind, body: string, link: string): string {
  if (/[\r\n]/.test(link)) throw new RangeError('latexFile: the link must be one line');
  const needs = kind === 'dynkin' ? 'dynkin-diagrams' : 'tikz';
  return `% ${link}\n% needs \\usepackage{${needs}}\n${body}\n`;
}

/**
 * The default LaTeX export of a tool (plan): the diagram of its board when `state.board` names one of the
 * 32 finite types, with the state's black nodes and tau (T13) or none; otherwise null.
 */
export function defaultLatexExport(state: ToolState): { kind: 'dynkin'; data: DynkinExportData } | null {
  const t = finiteType(state.board);
  if (t === null) return null;
  const tau = state.tau ?? Array.from({ length: t.rank }, (_, k) => k + 1);
  return { kind: 'dynkin', data: { type: state.board as string, black: [...(state.black ?? [])], tau: [...tau] } };
}

/** The parts of a citation (SPEC 7.4 "Cite": page title, site version, date, link). */
export interface CiteParts {
  title: string;
  siteName: string;
  commit: string;
  date: string;
  link: string;
}

/** One line (plan): `<title>. <siteName>, site version <commit>, <date>. <link>`. */
export function citeText(parts: CiteParts): string {
  const title = parts.title.trim();
  const stop = /[.?!]$/.test(title) ? '' : '.';
  return `${title}${stop} ${parts.siteName}, site version ${parts.commit}, ${parts.date}. ${parts.link}`;
}

/** The page title for a citation: the document title without the layouts' suffix `: <site name>`. */
export function citationTitle(documentTitle: string, siteName: string = SITE_NAME): string {
  const t = documentTitle.trim();
  const suffix = `: ${siteName}`;
  return t.endsWith(suffix) && t.length > suffix.length ? t.slice(0, -suffix.length).trim() : t;
}

/** The reader's local date as ISO 8601 YYYY-MM-DD (the access date of a web citation; plan). */
export function localIsoDate(d: Date): string {
  const pad = (k: number): string => String(k).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
