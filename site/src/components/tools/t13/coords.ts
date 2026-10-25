// T13: where the coordinates of a shadow in the simple restricted roots come from (SPEC.md 4 T13 Shadows;
// 7.3 "Components contain no mathematics beyond calling the engine"). Owner P6-A3. The engine helper
// restrictedCoordinates(d, rb, shadow2) of P6-A1 (satake.ts) gives the integer coordinates of a doubled
// shadow in the doubled simple restricted roots, in the order of rb.orbits, exactly, and throws RangeError
// when the vector is not an integer combination of them. Site code never solves for them itself.
//
// Until that helper is exported by the engine this module holds null, and every coordinate the Studio shows
// is absent (the shadow picture, data-out="shadow-coordinates" and the values on the restricted board);
// the unit tests that need the coordinates fail rather than pass on a stand-in (decisions/P6-A3.md).
import type { RestrictedBoard, SatakeDiagram } from '@two-games/engine';

/** The signature of the engine's restrictedCoordinates (P6-A1, satake.ts). */
export type RestrictedCoordinatesFn = (d: SatakeDiagram, rb: RestrictedBoard, shadow2: readonly number[]) => number[];

/** The engine function once it is exported; null before. */
export const restrictedCoordinatesFn: RestrictedCoordinatesFn | null = null;
