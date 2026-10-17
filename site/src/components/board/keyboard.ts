// The arrow-key model of SPEC.md 7.5 A-1, as pure functions of the layout and the labels.
// Works in grid coordinates (y up), never in screen coordinates.
import type { ArrowKey, GridLayout } from './types';

const ARROWS: readonly string[] = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

export function isArrowKey(key: string): key is ArrowKey {
  return ARROWS.includes(key);
}

const DIRECTION: Record<Exclude<ArrowKey, 'Home' | 'End'>, readonly [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

const EPS = 1e-9;
const COS_45 = Math.SQRT1_2;

/**
 * The label the focus moves to from the label `from` on `key` (A-1).
 * Rows with branches: the nearest node whose centre lies within 45 degrees of the arrow's
 * direction, the limit included, ties to the smaller label; otherwise Right and Down go to the
 * next label and Left and Up to the previous one, stopping at the ends.
 * Polygon and custom layouts: Right and Down to the next label, Left and Up to the previous one,
 * wrapping round. Home and End: the first and the last label.
 * `labels[k]` is the label of position k, as `layout.xy[k]` is its centre.
 */
export function arrowTarget(layout: GridLayout, labels: readonly number[], from: number, key: ArrowKey): number {
  const sorted = [...labels].sort((a, b) => a - b);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (key === 'Home') return first;
  if (key === 'End') return last;
  const idx = sorted.indexOf(from);
  if (idx < 0) throw new RangeError(`label ${from} is not on the board`);
  const forward = key === 'ArrowRight' || key === 'ArrowDown';

  if (layout.kind !== 'row') {
    const n = sorted.length;
    return sorted[(idx + (forward ? 1 : n - 1)) % n]!;
  }

  const k = labels.indexOf(from);
  const [fx, fy] = layout.xy[k]!;
  const [dx, dy] = DIRECTION[key];
  let best: number | null = null;
  let bestDist = Infinity;
  for (let j = 0; j < labels.length; j++) {
    if (j === k) continue;
    const vx = layout.xy[j]![0] - fx;
    const vy = layout.xy[j]![1] - fy;
    const dist = Math.hypot(vx, vy);
    if (dist < EPS) continue;
    const cos = (vx * dx + vy * dy) / dist;
    if (cos < COS_45 - EPS) continue;
    const label = labels[j]!;
    if (dist < bestDist - EPS || (Math.abs(dist - bestDist) <= EPS && best !== null && label < best)) {
      best = label;
      bestDist = dist;
    }
  }
  if (best !== null) return best;
  if (forward) return idx < sorted.length - 1 ? sorted[idx + 1]! : from;
  return idx > 0 ? sorted[idx - 1]! : from;
}

/**
 * The History shortcut of a key press, or null (A-1): `u` undoes and `r` redoes, only while the
 * focus is inside a board group, and never with a modifier held (plan).
 */
export function shortcutOf(event: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}): 'undo' | 'redo' | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const key = event.key;
  const action = key === 'u' ? 'undo' : key === 'r' ? 'redo' : null;
  if (action === null) return null;
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  if (!target || typeof target.closest !== 'function' || !target.closest('[data-board-group]')) return null;
  return action;
}
