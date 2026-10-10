// The tally of T5 (SPEC.md 4 T5 "Tally"; 2.7 F6, F7; Appendix A.2). Pure, no DOM. A bar for each
// value fired, its length the number of times; when the game from all ones has ended the bars are read
// sideways (the conjugate partition) to give the exponents, through the engine's exponentsFromFired,
// and the product of (m_i + 1) is shown beside the order of the group from weylOrder. Values are keyed
// by their decimal text and sorted numerically, never as strings ("10" sorts before "9" as text).
import { exponentsFromFired, weylOrder } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';

export interface TallyBar {
  /** The value fired, as decimal text. */
  value: string;
  /** How often it was fired. */
  count: number;
}

function compareText(a: string, b: string): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** One bar per distinct value of the tape, in increasing numeric order. */
export function tallyOf(fired: readonly string[]): TallyBar[] {
  const counts = new Map<string, number>();
  for (const v of fired) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((p, q) => compareText(p[0], q[0])).map(([value, count]) => ({ value, count }));
}

/** The tally as the golden `fired_tally` has it: the value as decimal text to its count, keys increasing. */
export function tallyRecord(bars: readonly TallyBar[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of bars) out[b.value] = b.count;
  return out;
}

/** The longest bar (the scale of the chart). */
export function longestBar(bars: readonly TallyBar[]): number {
  return bars.reduce((m, b) => Math.max(m, b.count), 0);
}

/**
 * Whether the reading sideways applies: only to the finished game from all ones (F7). Never to a partial
 * tally, never to a game from another start (4.0: "never presents a truncated result as complete").
 */
export function readsSideways(fromOnes: boolean, ended: boolean): boolean {
  return fromOnes && ended;
}

/** The reading sideways of a finished game from all ones: the exponents, the factors m_i + 1 and their product. */
export interface SidewaysReading {
  exponents: number[];
  factors: number[];
  product: number;
}

/** Row r (from 1) of the reading counts the values fired at least r times (the conjugate partition). */
export function sidewaysRows(bars: readonly TallyBar[], n: number): number[] {
  const rows: number[] = [];
  for (let r = 1; r <= n; r++) rows.push(bars.filter((b) => b.count >= r).length);
  return rows;
}

/** The exponents of the finished game from all ones (engine exponentsFromFired) and the product of (m + 1). */
export function sidewaysReading(fired: readonly string[], n: number): SidewaysReading {
  // The values fired from all ones are the heights of the positive coroots, at most h - 1: plain numbers.
  const exponents = exponentsFromFired(
    fired.map((v) => Number(v)),
    n,
  );
  const factors = exponents.map((m) => m + 1);
  const product = factors.reduce((p, f) => p * f, 1);
  return { exponents, factors, product };
}

/** The order of the group shown beside the product (engine weylOrder; a number by E-4). */
export function groupOrder(board: AnyBoard): number {
  return weylOrder(board);
}

/** The line shown while the reading does not apply (plan wording, decisions/P3-A3.md). */
export const TALLY_NOTE = 'The bars are read sideways when the game from all ones has ended.';
