// T10, the Geometry Studio: rings and distinct dots of a picture in the Coxeter plane (SPEC.md 2.14 "The
// Coxeter plane"; 4 T10 Showpiece; 5.4 coxeterPlaneRings: radii and coordinates rounded to 6 decimals,
// -0 counted as 0). Owner P4-A3. The counting rules are P4-A2's (projector.ts roundTo, ringsOf,
// countDistinct: the oracle's coxeter_plane_rings), applied here to any set of projected points: the
// vertices of the orbit drawn, with the short roots when they are shown. Radii are those of the unscaled
// Euclidean coordinates y, before any scaling to the box.
import { countDistinct, ringsOf } from '../../draw/projector';

export interface PlaneStats {
  /** [radius rounded to 6 decimals, number of points], innermost first. */
  rings: [number, number][];
  /** The number of distinct points, both coordinates rounded to 6 decimals, -0 counted as 0. */
  distinct: number;
  /** The number of points. */
  points: number;
}

/** The Coxeter plane of y: coordinates 1 and n (rows E[0] and E[n-1]; smallest and largest eigenvalue). */
export function coxeterPlanePointsOf(ys: readonly (readonly number[])[]): { x: number; y: number }[] {
  return ys.map((y) => ({ x: y[0]!, y: y[y.length - 1]! }));
}

/** Rings and distinct dots of points already in a plane. */
export function planeStats(points: ReadonlyArray<{ x: number; y: number }>): PlaneStats {
  return { rings: ringsOf(points, 6), distinct: countDistinct(points, 6), points: points.length };
}

/** Rings and distinct dots of Euclidean points y projected to the Coxeter plane. */
export function coxeterStats(ys: readonly (readonly number[])[]): PlaneStats {
  return planeStats(coxeterPlanePointsOf(ys));
}

/**
 * The sentence of 4 T10 ("the tool states the number of distinct dots when it is smaller than the number
 * of points"; plan wording), or null when every point is its own dot.
 */
export function distinctDotsText(stats: PlaneStats): string | null {
  return stats.distinct < stats.points ? `${stats.distinct} distinct dots for ${stats.points} points` : null;
}

/** The ring sizes, innermost first, as text: "30, 30, 30". */
export function ringSizesText(stats: PlaneStats): string {
  return stats.rings.map(([, c]) => String(c)).join(', ');
}
