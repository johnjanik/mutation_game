// Symmetries and the two foldings (SPEC.md 2.13, 5.2 Symmetry and FoldResult, 5.3 symmetries, 5.4 fold,
// averagedRootsType, averagedSimpleCartan, 5.6, E-5, E-7; CONTRACTS.md 2.1, 2.4 phase 4; owner P4-A1).
// Ports of the oracle's automorphisms (reference/lie_games.py lines 388 to 390), tau_orbits (393 to 402),
// fold (405 to 421), averaged_roots_type (1437 to 1456) and averaged_simple_cartan (1720 to 1727).
//
// Two constructions, dual answers (2.13): fold is construction (a), orbit sums, in which larger orbits
// become longer roots; averagedRootsType and averagedSimpleCartan are construction (b), orbit averages, in
// which larger orbits give shorter roots and the Cartan matrix is the transpose of (a)'s. Neither is
// "corrected" to agree with the other.
//
// Positions in, positions out (E-7): a Symmetry is the image of each position, orbits are positions of the
// big board, and position t of the folded board is orbits[t]. Exact arithmetic only (E-1): integers and
// rationals. Guards (5.6): symmetries works on every board; the other three throw NeedsTwoWayRoads on a
// one-way board and NotFiniteType off the finite types, through guards.ts (E-11), after the argument check.
import { SafeInt } from './arith';
import type { AnyBoard, Board } from './board';
import { adjacency, boardKind, components } from './board';
import { CAPS } from './caps';
import { gram, identify, relabellings } from './classify';
import { EngineError, NotFiniteType } from './errors';
import { requireFinite, requireGcm } from './guards';
import type { Rational } from './rational';
import { rat, ratAdd, ratDiv, ratMul, ratToString } from './rational';
import type { RestrictedType } from './restrictedType';
import { classifyRestricted } from './restrictedType';
import { roots } from './search';

/** The image of each position under a permutation of the nodes (SPEC.md 5.2). */
export type Symmetry = readonly number[];

/** The result of fold (SPEC.md 5.2): the folded board, or null with the reason; orbits in positions. */
export interface FoldResult {
  folded: Board | null;
  orbits: number[][];
  reason: string | null;
}

/** The reason fold gives when some orbit contains an edge (plan; the text of the golden row of A4). */
const ORBIT_CONTAINS_AN_EDGE = 'an orbit contains an edge';

function asAny<T>(board: Board<T>): AnyBoard {
  return board as unknown as AnyBoard;
}

/** RangeError unless `symmetry` is a permutation of 0..n-1 (plan, P4-A1 instruction 5.3). */
function checkPermutation(n: number, symmetry: Symmetry): void {
  if (!Array.isArray(symmetry) || symmetry.length !== n) {
    throw new RangeError(`a symmetry of this board has ${n} entries, not ${Array.isArray(symmetry) ? symmetry.length : 'none'}`);
  }
  const seen: boolean[] = [];
  for (let k = 0; k < n; k++) seen.push(false);
  for (const x of symmetry) {
    if (!Number.isInteger(x) || x < 0 || x >= n) throw new RangeError(`the image ${String(x)} is outside 0..${n - 1}`);
    if (seen[x]) throw new RangeError(`the image ${x} appears twice: not a permutation`);
    seen[x] = true;
  }
}

/**
 * The orbits of a permutation (the oracle's tau_orbits): for i from 0 to n - 1 not yet seen, follow
 * i, tau[i], tau[tau[i]], ... back to i; each orbit sorted ascending, orbits in order of their least
 * position.
 */
function tauOrbits(tau: Symmetry): number[][] {
  const n = tau.length;
  const seen: boolean[] = [];
  for (let k = 0; k < n; k++) seen.push(false);
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    const o = [i];
    seen[i] = true;
    let j = tau[i]!;
    while (j !== i) {
      o.push(j);
      seen[j] = true;
      j = tau[j]!;
    }
    o.sort((a, b) => a - b);
    out.push(o);
  }
  return out;
}

function guardFinite<T>(board: Board<T>): void {
  requireGcm(board);
  requireFinite(board);
}

function gramOf<T>(board: Board<T>): Rational[][] {
  const B = gram(board);
  if (B === null) throw new NotFiniteType('this function needs a board of finite type; this board is not balanced');
  return B;
}

/** bil(B, x, y) = sum of x_i B_ij y_j over the pairs with x_i and y_j nonzero (oracle lines 129 to 131). */
function bil(B: readonly (readonly Rational[])[], x: readonly Rational[], y: readonly Rational[]): Rational {
  let s = rat(0);
  for (let i = 0; i < x.length; i++) {
    if (x[i]!.num === 0n) continue;
    for (let j = 0; j < y.length; j++) {
      if (y[j]!.num === 0n) continue;
      s = ratAdd(s, ratMul(ratMul(x[i]!, B[i]![j]!), y[j]!));
    }
  }
  return s;
}

// ---------------------------------------------------------------------------------------------
// symmetries (SPEC.md 5.3, E-6; oracle automorphisms)
// ---------------------------------------------------------------------------------------------

/**
 * All symmetries of the board: the permutations t with C[t[i]][t[j]] = C[i][j], computed as
 * relabellings(board, board, limit) and nothing more: lexicographic order (the identity first), at most
 * `limit` results (default CAPS.relabellingsDefault, E-6), the limit semantics of relabellings. Works on
 * every kind of board (5.6: roads in either direction join).
 */
export function symmetries<T>(board: Board<T>, limit?: number): Symmetry[];
export function symmetries(board: AnyBoard, limit?: number): Symmetry[];
export function symmetries<T>(board: Board<T>, limit: number = CAPS.relabellingsDefault): Symmetry[] {
  const b = asAny(board);
  return relabellings(b, b, limit);
}

// ---------------------------------------------------------------------------------------------
// fold, construction (a) of SPEC.md 2.13 (oracle fold and tau_orbits)
// ---------------------------------------------------------------------------------------------

/** The folded board object (plan reading of E-7): cartan in orbit order, labels in Bourbaki order. */
function foldedBoard(Cf: number[][]): Board {
  const m = Cf.length;
  const kind = boardKind(Cf);
  if (kind === 'not-a-board') throw new EngineError('the folded matrix is not a board');
  const cartan = Object.freeze(Cf.map((row) => Object.freeze(row)));
  const draft: Board = { n: m, cartan, labels: [], kind, arith: SafeInt };
  const labels: number[] = [];
  for (let k = 0; k < m; k++) labels.push(k + 1);
  let name: string | undefined;
  // identify needs a connected board; the fold of a disconnected finite board can be disconnected
  // (plan: then the labels stay in the order of the orbits and the board has no name)
  if (kind === 'gcm' && components(draft).length === 1) {
    const id = identify(draft);
    if (id !== null) {
      for (let k = 0; k < m; k++) labels[id.order[k]!] = k + 1;
      name = id.name;
    }
  }
  const board: Board = { n: m, cartan, labels: Object.freeze(labels), kind, arith: SafeInt };
  if (name !== undefined) board.name = name;
  return Object.freeze(board);
}

/**
 * Folds the board by a symmetry (construction (a) of SPEC.md 2.13): one node per orbit of `symmetry`,
 * A_fold[s][t] = the number of edges from orbit s into the first node of orbit t, C_fold = 2I - A_fold^T.
 * When some orbit contains an edge the board does not fold: folded is null and reason says so. The folded
 * board has cartan in the order of the orbits (so cartanNumbers(folded) is the golden folded_cartan),
 * labels 1..m in the Bourbaki order of the type identify names (labels[order[k]] = k + 1), that name,
 * kind from its matrix and SafeInt arithmetic. Like the oracle, fold does not check that the permutation
 * preserves the board. RangeError on a symmetry that is not a permutation of 0..n-1; NeedsTwoWayRoads on
 * a one-way board; NotFiniteType off the finite types (5.6).
 */
export function fold<T>(board: Board<T>, symmetry: Symmetry): FoldResult;
export function fold(board: AnyBoard, symmetry: Symmetry): FoldResult;
export function fold<T>(board: Board<T>, symmetry: Symmetry): FoldResult {
  checkPermutation(board.n, symmetry);
  guardFinite(board);
  const orbits = tauOrbits(symmetry);
  const A = adjacency(asAny(board));
  for (const o of orbits) {
    for (const i of o) {
      for (const j of o) {
        if (A[i]![j] !== 0) return { folded: null, orbits, reason: ORBIT_CONTAINS_AN_EDGE };
      }
    }
  }
  const m = orbits.length;
  const Af: number[][] = [];
  for (let s = 0; s < m; s++) {
    const row: number[] = [];
    for (let t = 0; t < m; t++) {
      if (s === t) {
        row.push(0);
        continue;
      }
      const i = orbits[t]![0]!;
      let total = 0;
      for (const j of orbits[s]!) total += A[j]![i]!;
      row.push(total);
    }
    Af.push(row);
  }
  const Cf: number[][] = [];
  for (let s = 0; s < m; s++) {
    const row: number[] = [];
    for (let t = 0; t < m; t++) row.push(s === t ? 2 : Af[t]![s]! === 0 ? 0 : -Af[t]![s]!);
    Cf.push(row);
  }
  return { folded: foldedBoard(Cf), orbits, reason: null };
}

// ---------------------------------------------------------------------------------------------
// Construction (b) of SPEC.md 2.13: averages over the group generated by the symmetry
// ---------------------------------------------------------------------------------------------

/**
 * The type of the averages of the roots over the cyclic group generated by `symmetry` (any order), with
 * its length classes (oracle averaged_roots_type): every root (all of them, exactly) is averaged over its
 * orbit under push(p)[tau[i]] = p[i], with rationals; the distinct averages, keyed by their rational
 * text in lowest terms, are classified by classifyRestricted with the Gram matrix of the board and the
 * number of orbits of the symmetry as rank. Defined for every symmetry of a finite board, whether or not
 * the board folds (the flip of A4 gives BC2) and for the identity (the board's own type). RangeError on a
 * non-permutation; NeedsTwoWayRoads, NotFiniteType as fold.
 */
export function averagedRootsType<T>(board: Board<T>, symmetry: Symmetry): RestrictedType;
export function averagedRootsType(board: AnyBoard, symmetry: Symmetry): RestrictedType;
export function averagedRootsType<T>(board: Board<T>, symmetry: Symmetry): RestrictedType {
  checkPermutation(board.n, symmetry);
  guardFinite(board);
  const n = board.n;
  const B = gramOf(board);
  const R = roots(board, CAPS.workerPositions);
  if (R.truncated) throw new EngineError('the roots of a finite board exceed the search cap');
  const toBig = board.arith.toBig;
  const push = (p: readonly bigint[]): bigint[] => {
    const q: bigint[] = [];
    for (let i = 0; i < n; i++) q.push(0n);
    for (let i = 0; i < n; i++) q[symmetry[i]!] = p[i]!;
    return q;
  };
  const same = (p: readonly bigint[], q: readonly bigint[]): boolean => p.every((x, i) => x === q[i]);
  const averages = new Map<string, Rational[]>();
  for (const root of R.items) {
    const a = root.map((x) => toBig(x));
    const orb: bigint[][] = [a];
    let b = push(a);
    while (!same(b, a)) {
      orb.push(b);
      b = push(b);
    }
    const avg: Rational[] = [];
    for (let i = 0; i < n; i++) {
      let s = 0n;
      for (const v of orb) s += v[i]!;
      avg.push(rat(s, BigInt(orb.length)));
    }
    const key = avg.map(ratToString).join(',');
    if (!averages.has(key)) averages.set(key, avg);
  }
  return classifyRestricted([...averages.values()], B, tauOrbits(symmetry).length);
}

/**
 * The Cartan matrix of the averaged simple roots, one per orbit of `symmetry` in the order of their least
 * position (oracle averaged_simple_cartan): av[s] has 1/|O_s| on the positions of orbit s and 0 elsewhere,
 * M[s][t] = 2 (av[s], av[t]) / (av[s], av[s]) with the form of the board. Every entry is an integer (the
 * oracle asserts it; EngineError otherwise, plan). When the board folds by `symmetry` this is the transpose
 * of the folded Cartan matrix (2.13 (b) [V]). Guards as averagedRootsType (plan: 5.6 does not name this
 * function; it belongs with fold and averagedRootsType).
 */
export function averagedSimpleCartan<T>(board: Board<T>, symmetry: Symmetry): number[][];
export function averagedSimpleCartan(board: AnyBoard, symmetry: Symmetry): number[][];
export function averagedSimpleCartan<T>(board: Board<T>, symmetry: Symmetry): number[][] {
  checkPermutation(board.n, symmetry);
  guardFinite(board);
  const n = board.n;
  const B = gramOf(board);
  const orbits = tauOrbits(symmetry);
  const av: Rational[][] = orbits.map((o) => {
    const v: Rational[] = [];
    for (let i = 0; i < n; i++) v.push(o.includes(i) ? rat(1, o.length) : rat(0));
    return v;
  });
  const M: number[][] = [];
  for (let s = 0; s < orbits.length; s++) {
    const row: number[] = [];
    const ss = bil(B, av[s]!, av[s]!);
    for (let t = 0; t < orbits.length; t++) {
      const x = ratDiv(ratMul(rat(2), bil(B, av[s]!, av[t]!)), ss);
      if (x.den !== 1n) throw new EngineError(`the averaged simple Cartan entry (${s}, ${t}) is ${ratToString(x)}, not an integer`);
      row.push(Number(x.num));
    }
    M.push(row);
  }
  return M;
}
