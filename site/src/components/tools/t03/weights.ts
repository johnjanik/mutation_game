// The builder's model (SPEC.md 4 T3 "Builder", 2.1, 2.5; P2-A2 instruction 5.4). Pure, no DOM, no
// evaluation of a reader's form: the joined pairs of a board (from `adjacency`), the default and the
// configured weights, the rule that refuses a city weight below 1 and a road weight below 0, and
// `matrixOf`, the doubled integer matrix 2M handed to `formIsInvariant`. The witness the engine returns
// is turned into labels here (E-7), with the population after the mutation from `mutate`.
//
// Convention (plan, one throughout): Q_w(p) = sum_i w_i p_i^2 - sum_{i<j} w_ij p_i p_j = p^T M p with
// M_ii = w_i and M_ij = M_ji = -w_ij / 2. Invariance does not change under scaling, so `matrixOf`
// returns 2M (diagonal 2 w_i, off-diagonal -w_ij), an integer symmetric matrix. With the passing
// weights w_i = 2 d_i, w_ij = 2 d_i A_ji, M = B = DC (the engine's `gram`) and `matrixOf` returns 2B.
import { adjacency, mutate, toLabels, toPositions } from '@two-games/engine';
import type { AnyBoard, Board, InvarianceResult } from '@two-games/engine';

/** The least city weight: "City weights are positive" (SPEC 4 T3). */
export const CITY_MIN = 1;
/** The least road weight: "road weights are zero or positive" (SPEC 4 T3). */
export const ROAD_MIN = 0;
/**
 * The largest weight a control offers (plan). Weights are integers; the passing weights of every named
 * type are at most 6 (G2), and three times them, 18, still fits, so proportional choices can be tried.
 */
export const WEIGHT_MAX = 24;

export type WeightKind = 'city' | 'road';

/** A joined pair by positions (i < j) and by labels: at least one road between them, either way (2.1). */
export interface JoinedPair {
  positions: [number, number];
  labels: [number, number];
}

/** The joined pairs of a board, in increasing order of positions (i, j) with i < j. */
export function joinedPairs(board: AnyBoard): JoinedPair[] {
  const A = adjacency(board);
  const out: JoinedPair[] = [];
  for (let i = 0; i < board.n; i++) {
    for (let j = i + 1; j < board.n; j++) {
      if (A[i]![j]! !== 0 || A[j]![i]! !== 0) {
        const [li, lj] = toLabels(board, [i, j]) as [number, number];
        out.push({ positions: [i, j], labels: [li, lj] });
      }
    }
  }
  return out;
}

/** The weights of the builder: one per city (by position) and one per joined pair (in joinedPairs order). */
export interface Weights {
  city: number[];
  road: number[];
}

/** The default weights (plan): every city weight 1, every road weight 1. */
export function defaultWeights(board: AnyBoard): Weights {
  return { city: Array.from({ length: board.n }, () => 1), road: joinedPairs(board).map(() => 1) };
}

/** True when `w` is a weight the control of that kind accepts: an integer from the minimum to WEIGHT_MAX. */
export function weightAllowed(kind: WeightKind, w: number): boolean {
  const min = kind === 'city' ? CITY_MIN : ROAD_MIN;
  return Number.isInteger(w) && w >= min && w <= WEIGHT_MAX;
}

/**
 * Reads a weight typed or slid into a control: the integer when the control accepts it, otherwise null,
 * and the control keeps its last accepted weight (a city weight of 0 or below is refused, so is a
 * negative road weight; SPEC 4 T3, verify.py 1530).
 */
export function readWeight(kind: WeightKind, text: string): number | null {
  const t = text.trim().replace(/^−/, '-');
  if (!/^-?\d+$/.test(t)) return null;
  const w = Number(t);
  return weightAllowed(kind, w) ? w : null;
}

/** A road weight given by a page, by the labels of the pair. */
export interface RoadWeightProp {
  pair: [number, number];
  weight: number;
}

/**
 * The weights of a page's properties (`cityWeights` in label order, `roadWeights` by pairs of labels),
 * over the defaults. An authoring error (a wrong length, a pair that is not joined, a weight the
 * control would refuse) throws, naming the instance.
 */
export function initialWeights(board: AnyBoard, cityWeights: readonly number[] | undefined, roadWeights: readonly RoadWeightProp[] | undefined, instanceId = ''): Weights {
  const who = `T3 instance "${instanceId || 'form'}"`;
  const w = defaultWeights(board);
  if (cityWeights !== undefined) {
    if (cityWeights.length !== board.n) throw new Error(`${who}: cityWeights has ${cityWeights.length} entries, but the board has ${board.n} cities`);
    const order = [...board.labels].sort((a, b) => a - b);
    const positions = toPositions(board, order);
    cityWeights.forEach((x, k) => {
      if (!weightAllowed('city', x)) throw new Error(`${who}: the city weight ${String(x)} is not a whole number from ${CITY_MIN} to ${WEIGHT_MAX}`);
      w.city[positions[k]!] = x;
    });
  }
  if (roadWeights !== undefined) {
    const pairs = joinedPairs(board);
    for (const r of roadWeights) {
      const k = pairs.findIndex((p) => (p.labels[0] === r.pair[0] && p.labels[1] === r.pair[1]) || (p.labels[0] === r.pair[1] && p.labels[1] === r.pair[0]));
      if (k < 0) throw new Error(`${who}: cities ${r.pair[0]} and ${r.pair[1]} are not joined`);
      if (!weightAllowed('road', r.weight)) throw new Error(`${who}: the road weight ${String(r.weight)} is not a whole number from ${ROAD_MIN} to ${WEIGHT_MAX}`);
      w.road[k] = r.weight;
    }
  }
  return w;
}

/**
 * The doubled integer matrix 2M of Q_w (plan convention): diagonal 2 w_i, off-diagonal -w_ij on the
 * joined pairs and 0 elsewhere; symmetric by construction, so `formIsInvariant`'s two oracle tests
 * agree (trap 9). `road` is aligned with `joinedPairs(board)`.
 */
export function matrixOf(board: AnyBoard, cityWeights: readonly number[], roadWeights: readonly number[]): number[][] {
  const pairs = joinedPairs(board);
  if (cityWeights.length !== board.n) throw new RangeError(`${cityWeights.length} city weights for ${board.n} cities`);
  if (roadWeights.length !== pairs.length) throw new RangeError(`${roadWeights.length} road weights for ${pairs.length} joined pairs`);
  const M = Array.from({ length: board.n }, (_, i) => Array.from({ length: board.n }, (_, j) => (i === j ? 2 * cityWeights[i]! : 0)));
  pairs.forEach((p, k) => {
    const [i, j] = p.positions;
    const v = roadWeights[k]! === 0 ? 0 : -roadWeights[k]!;
    M[i]![j] = v;
    M[j]![i] = v;
  });
  return M;
}

/** What the builder shows of a failing test: the city (label), the witness population and its image, in label order. */
export interface WitnessView {
  city: number;
  before: string[];
  after: string[];
}

/**
 * The witness of an InvarianceResult in labels (E-7): `witness.node` is a position, `witness.population`
 * is in position order; the population after the mutation comes from `mutate`. Null when there is none.
 */
export function witnessView(board: AnyBoard, result: InvarianceResult): WitnessView | null {
  const w = result.witness;
  if (result.invariant || w === undefined) return null;
  const b = board as Board<unknown>;
  const p = w.population.map((x) => b.arith.fromInt(x));
  const q = mutate(b, p, w.node);
  const order = toPositions(board, [...board.labels].sort((x, y) => x - y));
  return {
    city: toLabels(board, [w.node])[0]!,
    before: order.map((k) => b.arith.show(p[k])),
    after: order.map((k) => b.arith.show(q[k])),
  };
}

/** Words of the builder (plan wording; recorded in decisions/P2-A2.md). */
export const BUILDER_TEXT = {
  pass: 'Passes: every mutation preserves this form.',
  fail: 'Fails: some mutation changes this form.',
  untested: 'Press Test to ask the engine about these weights.',
} as const;

/** The witness sentence, with a true minus sign (U+2212) on screen. */
export function witnessSentence(w: WitnessView): string {
  const show = (v: readonly string[]): string => `(${v.map((x) => x.replace(/^-/, '−')).join(', ')})`;
  return `Witness: mutating city ${w.city} takes the population ${show(w.before)} to ${show(w.after)}, and the form does not take the same value on the two.`;
}
