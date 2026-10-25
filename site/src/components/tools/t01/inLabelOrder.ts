// inLabelOrder in a module of its own, so that t01/interop.ts, which Predict.svelte imports on every route
// with a tool, does not bring the rest of t01/model.ts (SPEC.md 7.6: /tools/rep/ went over its 90 kB with
// it; RT-FIX phase 5, T12's size). t01/model.ts re-exports it for its users. Positions inside, labels
// outside (E-7).
import { toPositions } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import { labelOrder } from '../../../lib/state';

/** A vector by position as a list in label order (the order of `start`, the table and exports). */
export function inLabelOrder<X>(board: AnyBoard, v: readonly X[]): X[] {
  return toPositions(board, labelOrder(board)).map((p) => v[p]!);
}
