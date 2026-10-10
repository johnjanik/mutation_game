// P2-A7: the phase-2 parts of T2, the Orbit Garden (SPEC.md 4 T2 last paragraph and acceptance, 4.0
// "Stated limits" and "Growth off the finite types has two bounds", 5.6). Pure functions in a new file
// beside P1-A6's model: t02/garden.ts belongs to its tool agent, and its own `isNamedFinite` is called
// inside that file (layersBound, totalOf), so the component calls these instead (P2-A7 instruction
// 5.9, cases 2 and 3; the one-line switch inside garden.ts is requested of MERGE).
import { CAPS, roots } from '@two-games/engine';
import type { AnyBoard, Board, ClassifyRecord } from '@two-games/engine';
import { isFiniteType } from '../../../lib/state';
import { MORE_THAN, totalOf, type GardenSpec, type Total } from './garden';

/** The wording of SPEC 4 T4 for a component with a one-way road. */
export const ONE_WAY_TEXT = 'has a one-way road: the theory does not apply';

/**
 * The verdict shown beside the stop message (plan wording): one text per component, in the order of
 * the records `classify` returns, separated by "; ". A component of class finite, affine or
 * indefinite contributes its class word only (never a name); a one-way component the T4 sentence.
 * Only `classify` says this (4.0: never inferred from a cap).
 */
export function verdictText(records: readonly ClassifyRecord[]): string {
  return records.map((r) => (r.kind === 'one-way' || r.class === null ? ONE_WAY_TEXT : r.class)).join('; ');
}

/**
 * The layers bound of 4.0 from the verdict: the `layers` property when the page gives one, otherwise
 * 40 on any board that `classify` does not call finite and no bound on a board it calls finite (a
 * custom board in any numbering included).
 */
export function gardenLayersBound(board: AnyBoard, layers?: number): number | undefined {
  if (layers !== undefined) return layers;
  return isFiniteType(board) ? undefined : CAPS.layersOffFinite;
}

/**
 * The total of the counter: in `roots` mode on a board that `classify` calls finite, the number of
 * roots from the completed enumeration (E-9 rule 1: at most 288 on twelve nodes; plan for custom
 * boards); every other case as garden.ts's totalOf.
 */
export function gardenTotal(spec: GardenSpec, bound: number | undefined): Total {
  if (spec.grows === 'roots' && isFiniteType(spec.board)) {
    const r = roots(spec.board as Board<unknown>, CAPS.gardenPositions);
    return r.truncated ? { kind: 'more', text: MORE_THAN } : { kind: 'number', value: r.items.length };
  }
  return totalOf(spec, bound);
}
