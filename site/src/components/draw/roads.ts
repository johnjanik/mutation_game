// The two road styles of SPEC.md 6.2, as data. roadGlyphs says what to draw between each joined
// pair; roadElements turns that into plain SVG element descriptors whose colours are the tokens
// var(--road), var(--arrow) and var(--text), so the colours are testable without a DOM.
// Roads.svelte renders the descriptors and adds only its aria-hidden wrapper.
//
// Road counts come from the engine: A = adjacency(board), A[i][j] = roads from position i to
// position j = -C[j][i] (SPEC 2.1). Two nodes are joined when A[i][j] > 0 or A[j][i] > 0.
// The package name is imported (it is what the site alias @engine points at) because the unit-test
// project of the root Vitest configuration does not resolve the alias.
import { adjacency } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import type { RoadStyle } from '../board/types';

/** `roads` on a board with a one-way road, whatever was asked (6.2); otherwise the request, default `dynkin`. */
export function effectiveRoadStyle(board: Pick<AnyBoard, 'kind'>, requested?: RoadStyle): RoadStyle {
  if (board.kind === 'one-way') return 'roads';
  return requested ?? 'dynkin';
}

export type RoadGlyph =
  /** One, two or three parallel lines; a chevron pointing at `chevronTowards` when the counts differ. */
  | { kind: 'lines'; from: number; to: number; count: number; chevronTowards: number | null }
  /** A pair with A_ij A_ji >= 4: a thick line, with the roads leaving each end written beside it (plan). */
  | { kind: 'thick'; from: number; to: number; countAtFrom: number; countAtTo: number }
  /** One road from `from` to `to`, the `index`-th of `of` in that direction. */
  | { kind: 'arrow'; from: number; to: number; index: number; of: number };

/**
 * The glyphs of a board in a style, by joined position pair i < j in increasing (i, j) order.
 * `dynkin`: with m = A_ij and m' = A_ji, lines when m m' <= 3 (count max(m, m'), the chevron
 * towards the end that receives the extra roads, from the long node to the short node), a thick
 * line when m m' >= 4. `roads`: one arrow per road, first i to j, then j to i.
 */
export function roadGlyphs(board: AnyBoard, style: RoadStyle): RoadGlyph[] {
  const A = adjacency(board);
  const out: RoadGlyph[] = [];
  for (let i = 0; i < board.n; i++) {
    for (let j = i + 1; j < board.n; j++) {
      const m = A[i]![j]!;
      const mm = A[j]![i]!;
      if (m <= 0 && mm <= 0) continue;
      if (style === 'roads') {
        for (let k = 0; k < m; k++) out.push({ kind: 'arrow', from: i, to: j, index: k, of: m });
        for (let k = 0; k < mm; k++) out.push({ kind: 'arrow', from: j, to: i, index: k, of: mm });
      } else if (m * mm >= 4) {
        out.push({ kind: 'thick', from: i, to: j, countAtFrom: m, countAtTo: mm });
      } else {
        out.push({ kind: 'lines', from: i, to: j, count: Math.max(m, mm), chevronTowards: m === mm ? null : m > mm ? j : i });
      }
    }
  }
  return out;
}

/** A plain SVG element: what Roads.svelte renders, one element per descriptor. */
export interface RoadElement {
  tag: 'line' | 'path' | 'polygon' | 'text';
  attrs: Record<string, string>;
  text?: string;
}

/** Fractions of one grid unit (plan). The inset matches the "may act" ring of Node.svelte (0.32). */
const INSET = 0.32;
const LINE_GAP = 0.07;
const CHEVRON_HALF_LENGTH = 0.08;
const CHEVRON_HALF_WIDTH = 0.12;
const COUNT_ALONG = 0.03;
const COUNT_ACROSS = 0.15;
const COUNT_SIZE = 0.18;
const BEND_STEP = 0.13;
const HEAD_LENGTH = 0.1;
const HEAD_HALF_WIDTH = 0.055;

type V = readonly [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s];
const len = (a: V): number => Math.hypot(a[0], a[1]);
const unitOf = (a: V): V => mul(a, 1 / len(a));
const perp = (a: V): V => [-a[1], a[0]];
/** Fixed precision, so the server render and the hydrated render print the same text. */
const f = (v: number): string => String(Math.round(v * 1e4) / 1e4 + 0);
const pt = (p: V): string => `${f(p[0])},${f(p[1])}`;

/**
 * The SVG elements of the glyphs, given node centres in the drawing's coordinates (y down) and the
 * size of one grid unit there. Lines and arrows are stroked in var(--road); chevrons and arrowheads
 * in var(--arrow); the counts of a thick line are text filled with var(--text). No hex literal.
 * A pair whose centres are closer than two insets is skipped (nothing to draw between them).
 */
export function roadElements(glyphs: readonly RoadGlyph[], centres: readonly (readonly [number, number])[], unit = 1): RoadElement[] {
  const out: RoadElement[] = [];
  const inset = INSET * unit;
  for (const g of glyphs) {
    const p = centres[g.from];
    const q = centres[g.to];
    if (p === undefined || q === undefined) continue;
    const d = sub(q, p);
    if (len(d) <= 2 * inset) continue;
    const u = unitOf(d);
    const n = perp(u);
    const a = add(p, mul(u, inset));
    const b = sub(q, mul(u, inset));
    if (g.kind === 'lines') {
      for (let k = 0; k < g.count; k++) {
        const off = mul(n, (k - (g.count - 1) / 2) * LINE_GAP * unit);
        const s = add(a, off);
        const e = add(b, off);
        out.push({ tag: 'line', attrs: { class: 'road', x1: f(s[0]), y1: f(s[1]), x2: f(e[0]), y2: f(e[1]), stroke: 'var(--road)' } });
      }
      if (g.chevronTowards !== null) {
        const dir = g.chevronTowards === g.to ? u : mul(u, -1);
        const mid = mul(add(p, q), 0.5);
        const tip = add(mid, mul(dir, CHEVRON_HALF_LENGTH * unit));
        const back = sub(mid, mul(dir, CHEVRON_HALF_LENGTH * unit));
        const w = mul(n, CHEVRON_HALF_WIDTH * unit);
        out.push({
          tag: 'path',
          attrs: { class: 'chevron', d: `M${pt(add(back, w))}L${pt(tip)}L${pt(sub(back, w))}`, stroke: 'var(--arrow)', fill: 'none' },
        });
      }
    } else if (g.kind === 'thick') {
      out.push({ tag: 'line', attrs: { class: 'road thick', x1: f(a[0]), y1: f(a[1]), x2: f(b[0]), y2: f(b[1]), stroke: 'var(--road)' } });
      const across = mul(n, COUNT_ACROSS * unit);
      const atFrom = add(add(a, mul(u, COUNT_ALONG * unit)), across);
      const atTo = add(sub(b, mul(u, COUNT_ALONG * unit)), across);
      const text = (at: V, count: number): RoadElement => ({
        tag: 'text',
        attrs: {
          class: 'road-count',
          x: f(at[0]),
          y: f(at[1]),
          'font-size': f(COUNT_SIZE * unit),
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          fill: 'var(--text)',
        },
        text: String(count),
      });
      out.push(text(atFrom, g.countAtFrom), text(atTo, g.countAtTo));
    } else {
      // Each road its own quadratic curve, bent to the left of its direction by (index + 1) steps:
      // the roads of one direction never coincide, and the two directions bend to opposite sides.
      const mid = mul(add(p, q), 0.5);
      const control = add(mid, mul(n, 2 * BEND_STEP * unit * (g.index + 1)));
      const s = add(p, mul(unitOf(sub(control, p)), inset));
      const e = add(q, mul(unitOf(sub(control, q)), inset));
      out.push({ tag: 'path', attrs: { class: 'road arrow', d: `M${pt(s)}Q${pt(control)} ${pt(e)}`, stroke: 'var(--road)', fill: 'none' } });
      const t = unitOf(sub(e, control));
      const base = sub(e, mul(t, HEAD_LENGTH * unit));
      const hw = mul(perp(t), HEAD_HALF_WIDTH * unit);
      out.push({ tag: 'polygon', attrs: { class: 'arrowhead', points: `${pt(e)} ${pt(add(base, hw))} ${pt(sub(base, hw))}`, fill: 'var(--arrow)' } });
    }
  }
  return out;
}
