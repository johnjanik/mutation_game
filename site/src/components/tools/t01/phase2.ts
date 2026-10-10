// P2-A7: the phase-2 parts of T1, the Game Board (SPEC.md 4 T1 "Shows" and "Coordinates of the
// start", 4.0 "Step and play to the end", 2.5, 2.12, 5.5 "Fates", 5.6). Pure functions with no DOM, in
// a new file beside P1-A5's model (t01/model.ts belongs to its tool agent; P2-A7 instruction 7). The
// panels arrive with their engine functions (formValue, level, symmetrizer); colours stays a phase-3
// panel and is never drawn here. Every value comes from the engine; nothing is computed by hand.
// Positions inside, labels outside (E-7).
import { CAPS, components, formValue, level, ratToString, symmetrizer, toLabels } from '@two-games/engine';
import type { AnyBoard, Board, Rational } from '@two-games/engine';
import { boardVerdict } from '../../../lib/state';
import { shortValue } from './longNumber';
import { inLabelOrder, type Panel } from './model';
import { spokenValue } from './announce';

/** The panels that phase 2 draws (SPEC 4 T1: "form value, level, long and short nodes in phase 2"). */
export const PANELS_PHASE_2: readonly Panel[] = ['form', 'level', 'lengths'];

/**
 * True exactly when `classify` gives the board one component, of class affine (SPEC 5.6: `level`
 * throws NeedsTwoWayRoads on one-way boards and NotAffine on every other board, finite included).
 */
export function isAffineBoard(board: AnyBoard): boolean {
  const records = boardVerdict(board);
  return records.length === 1 && records[0]!.class === 'affine';
}

/**
 * The panels drawn, in the order the page lists them: form and lengths wherever they are listed, the
 * level only on an affine board (elsewhere it is not rendered; plan), colours never (phase 3).
 */
export function phase2Panels(panels: readonly Panel[] | undefined, board: AnyBoard): Panel[] {
  return (panels ?? []).filter((p) => PANELS_PHASE_2.includes(p) && (p !== 'level' || isAffineBoard(board)));
}

/** A signed value as drawn: the true minus sign, and the shortened form above 12 digits (4.0). */
export function signedText(text: string): string {
  return shortValue(text);
}

// ---------------------------------------------------------------------------------------------
// The form value (p, p) (SPEC 2.5; 5.4 formValue; 5.6: null when not balanced and on one-way boards)
// ---------------------------------------------------------------------------------------------

export const FORM_NOT_BALANCED = 'no invariant form: the board is not balanced';
export const FORM_FRACTIONAL = 'the form value is shown for whole populations only';
export const FORM_NO_POPULATION = 'the form value needs a population, and this view shows the numbers only';

export type PanelValue = { kind: 'value'; value: string } | { kind: 'note'; text: string };

/**
 * (p, p) of the population shown: `pop` an integer population by position in the board's arithmetic
 * (coords populations), or `frac` the population C^{-1} a of a numbers start (accepted when every
 * entry is whole, since formValue takes integers; plan, request to P2-A1), or neither when no
 * population is shown. The value is exact (a rational, `p/q` or `p`).
 */
export function formPanel(board: AnyBoard, pop: readonly unknown[] | null, frac: readonly Rational[] | null): PanelValue {
  let p: readonly (number | bigint)[];
  if (pop !== null) p = pop as readonly (number | bigint)[];
  else if (frac !== null) {
    if (frac.some((r) => r.den !== 1n)) return { kind: 'note', text: FORM_FRACTIONAL };
    p = frac.map((r) => r.num);
  } else return { kind: 'note', text: FORM_NO_POPULATION };
  const v = formValue(board, p);
  if (v === null) return { kind: 'note', text: FORM_NOT_BALANCED };
  return { kind: 'value', value: ratToString(v) };
}

// ---------------------------------------------------------------------------------------------
// The level on affine boards (SPEC 2.12: l(a) = sum c_i a_i, unchanged by every firing)
// ---------------------------------------------------------------------------------------------

/** The level of the numbers `a` (by position), as decimal text; call only when isAffineBoard. */
export function levelValue(board: AnyBoard, a: readonly unknown[]): string {
  const v = level(board, a as readonly (number | bigint)[]);
  return String(v);
}

// ---------------------------------------------------------------------------------------------
// Long and short nodes (SPEC 2.5: (alpha_i, alpha_i) = 2 d_i; 5.4 symmetrizer)
// ---------------------------------------------------------------------------------------------

export type NodeLength = 'long' | 'short' | 'equal' | 'value';

export interface LengthPart {
  /** The labels of the component, increasing. */
  labels: number[];
  /** `equal`: one value of d; `two`: long and short; `many`: more than two values (twisted boards). */
  kind: 'equal' | 'two' | 'many';
  /** Per label of the component (same order): its class and, for `many`, the value 2 d_i. */
  nodes: { label: number; length: NodeLength; squared: string }[];
}

export type LengthsReport = { kind: 'unbalanced' } | { kind: 'parts'; parts: LengthPart[] };

export const LENGTHS_NOT_BALANCED = 'the board is not balanced, so its nodes have no lengths';

/**
 * The lengths of the nodes from symmetrizer (least value 1 on each component): per component, one
 * value (all of the same length), two (long the larger, short the smaller), or more (the values 2 d_i
 * are listed). Null from symmetrizer (not balanced, one-way): `unbalanced`.
 */
export function lengthsReport(board: AnyBoard): LengthsReport {
  const d = symmetrizer(board);
  if (d === null) return { kind: 'unbalanced' };
  const parts: LengthPart[] = [];
  for (const comp of components(board as Board<unknown>)) {
    const key = (r: Rational): string => ratToString(r);
    const distinct = [...new Set(comp.map((i) => key(d[i]!)))];
    const order = (r: Rational): number => Number(r.num) / Number(r.den);
    const values = comp.map((i) => d[i]!);
    const max = Math.max(...values.map(order));
    const kind: LengthPart['kind'] = distinct.length === 1 ? 'equal' : distinct.length === 2 ? 'two' : 'many';
    const nodes = comp
      .map((i) => {
        const r = d[i]!;
        const squared = ratToString({ num: 2n * r.num, den: r.den });
        let length: NodeLength = 'value';
        if (kind === 'equal') length = 'equal';
        else if (kind === 'two') length = order(r) === max ? 'long' : 'short';
        return { label: toLabels(board, [i])[0]!, length, squared };
      })
      .sort((x, y) => x.label - y.label);
    parts.push({ labels: nodes.map((x) => x.label), kind, nodes });
  }
  return { kind: 'parts', parts };
}

/** "1, 2 and 3". */
function list(labels: readonly number[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** The sentence of one component (plan wording; marked by word as well as by any style, A-5). */
export function lengthSentence(part: LengthPart, several: boolean): string {
  const say = (body: string): string => (several ? `Nodes ${list(part.labels)}: ${body}` : body.charAt(0).toUpperCase() + body.slice(1));
  if (part.kind === 'equal') return say('all nodes have the same length.');
  if (part.kind === 'two') {
    const long = part.nodes.filter((x) => x.length === 'long').map((x) => x.label);
    const short = part.nodes.filter((x) => x.length === 'short').map((x) => x.label);
    const word = (k: number): string => (k === 1 ? 'node' : 'nodes');
    return say(`long ${word(long.length)} ${list(long)}; short ${word(short.length)} ${list(short)}.`);
  }
  return say(`more than two lengths; the squared lengths 2d are ${part.nodes.map((x) => `${x.squared} at node ${x.label}`).join(', ')}.`);
}

// ---------------------------------------------------------------------------------------------
// "play on" off the finite types (4.0; 5.5 Fates; 5.6; SPEC 4 T15's report strings)
// ---------------------------------------------------------------------------------------------

/** The words of the looped fate (SPEC 4 T15): "returned to an earlier position after k moves". */
export function fateText(outcome: { status: 'ended' | 'looped' | 'cap'; moves: number }): string | null {
  return outcome.status === 'looped' ? `returned to an earlier position after ${outcome.moves} moves` : null;
}

/** The one announcement of a play that came back to an earlier position (plan; A-4 has no template). */
export function loopedSentence(board: AnyBoard, moves: number, numbers: readonly string[]): string {
  const values = inLabelOrder(board, numbers).map(spokenValue).join(', ');
  return `Returned to an earlier position after ${moves} moves. Numbers now ${values}.`;
}

/**
 * The cap of one "play on" from move `cursor`: 20000 (5.6), and never more than the link maximum of
 * 20000 moves in all (6.6), so "Copy link" never writes a list the codec refuses. 0 means the control
 * is disabled (plan).
 */
export function playOnCap(cursor: number): number {
  return Math.max(0, Math.min(CAPS.playMoves, CAPS.linkMoves - cursor));
}

/** The visible label and the plan attribute `data-play` of the play control (`playToEnd` hook kept). */
export function playLabel(finite: boolean): { text: string; play: 'end' | 'on' } {
  return finite ? { text: 'Play to the end', play: 'end' } : { text: 'Play on', play: 'on' };
}

/**
 * Whether the play control is disabled (4.0 Predict: the board is frozen until the reader has
 * answered; a play in progress; the end of the play; no room left under the link maximum).
 */
export function playControlDisabled(s: { hydrated: boolean; frozen: boolean; busy: boolean; atEnd: boolean; finite: boolean; cursor: number }): boolean {
  return !s.hydrated || s.frozen || s.busy || s.atEnd || (!s.finite && playOnCap(s.cursor) === 0);
}
