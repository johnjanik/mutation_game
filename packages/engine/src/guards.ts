// The guards of SPEC.md E-11 and the table of 5.6 (CONTRACTS.md 2.1): the WeakMap cache of classify
// verdicts, requireGcm, requireConnected, requireFinite, requireAffine, and the guarded versions of the
// six phase-1 finite functions, which index.ts re-exports in place of finite.ts (plan: finite.ts is
// P1-A1's file and is not edited). Boards are immutable, so the cache cannot go stale; it changes no
// result (E-5). Nothing runs at module load (trap 15).
import type { AnyBoard, Board } from './board';
import { boardKind, components } from './board';
import { NeedsConnectedBoard, NeedsTwoWayRoads, NotAffine, NotFiniteType } from './errors';
import type { Word } from './moves';
import {
  coxeterNumber as coxeterNumberUnguarded,
  highestRoot as highestRootUnguarded,
  highestShortRoot as highestShortRootUnguarded,
  longestWord as longestWordUnguarded,
  minusW0 as minusW0Unguarded,
  minusculeNodes as minusculeNodesUnguarded,
} from './finite';
import type { ClassifyRecord } from './classify';
import { classifyUncached, intCartan } from './classify';

const verdicts = new WeakMap<object, ClassifyRecord[]>();

/** The classify verdict of a board object, computed once (E-11). Internal: callers never change the records. */
export function cachedClassify<T>(board: Board<T>): readonly ClassifyRecord[];
export function cachedClassify(board: AnyBoard): readonly ClassifyRecord[];
export function cachedClassify<T>(board: Board<T>): readonly ClassifyRecord[] {
  let v = verdicts.get(board);
  if (v === undefined) {
    v = classifyUncached(board);
    verdicts.set(board, v);
  }
  return v;
}

/** NeedsTwoWayRoads when the board has a one-way road. */
export function requireGcm<T>(board: Board<T>): void;
export function requireGcm(board: AnyBoard): void;
export function requireGcm<T>(board: Board<T>): void {
  if (boardKind(intCartan(board)) === 'one-way') {
    throw new NeedsTwoWayRoads('this function needs a board on which every road has a road back');
  }
}

/** NeedsConnectedBoard when the board is in several pieces (roads in either direction join). */
export function requireConnected<T>(board: Board<T>): void;
export function requireConnected(board: AnyBoard): void;
export function requireConnected<T>(board: Board<T>): void {
  if (components(board).length > 1) throw new NeedsConnectedBoard('this function needs a connected board');
}

/**
 * NeedsTwoWayRoads when any component has a one-way road, then NotFiniteType unless every component is
 * of finite type (plan: a disconnected board whose pieces are all finite counts as finite, so longestWord
 * keeps working on the black nodes of a Satake diagram).
 */
export function requireFinite<T>(board: Board<T>): void;
export function requireFinite(board: AnyBoard): void;
export function requireFinite<T>(board: Board<T>): void {
  const recs = cachedClassify(board);
  if (recs.some((r) => r.kind === 'one-way')) {
    throw new NeedsTwoWayRoads('this function needs a board on which every road has a road back');
  }
  const bad = recs.find((r) => r.class !== 'finite');
  if (bad !== undefined) {
    throw new NotFiniteType(`this function needs a board of finite type; this board is ${String(bad.class)}`);
  }
}

/**
 * NeedsTwoWayRoads when any component has a one-way road, then NotAffine unless the board is connected
 * with class 'affine'. The message carries the class (P0-A2's text); on several components it names each
 * class in order (plan), with data.class the first class that is not affine, or 'indefinite' when every
 * piece is affine (a board in several affine pieces is not affine).
 */
export function requireAffine<T>(board: Board<T>): void;
export function requireAffine(board: AnyBoard): void;
export function requireAffine<T>(board: Board<T>): void {
  const recs = cachedClassify(board);
  if (recs.some((r) => r.kind === 'one-way')) {
    throw new NeedsTwoWayRoads('this function needs a board on which every road has a road back');
  }
  if (recs.length === 1 && recs[0]!.class === 'affine') return;
  const classes = recs.map((r) => String(r.class));
  const first = recs.find((r) => r.class === 'finite' || r.class === 'indefinite');
  const cls: 'finite' | 'indefinite' = first === undefined ? 'indefinite' : (first.class as 'finite' | 'indefinite');
  const err = new NotAffine(cls);
  if (recs.length > 1) {
    err.message = `this function needs an affine board; this board has ${recs.length} components, whose classes are ${classes.join(', ')}`;
  }
  throw err;
}

// ---------------------------------------------------------------------------------------------
// The six phase-1 finite functions with their guards (SPEC.md 5.6, last row)
// ---------------------------------------------------------------------------------------------

export function highestRoot<T>(board: Board<T>): T[];
export function highestRoot(board: AnyBoard): (number | bigint)[];
export function highestRoot<T>(board: Board<T>): T[] {
  requireFinite(board);
  return highestRootUnguarded(board);
}

export function highestShortRoot<T>(board: Board<T>): T[] | null;
export function highestShortRoot(board: AnyBoard): (number | bigint)[] | null;
export function highestShortRoot<T>(board: Board<T>): T[] | null {
  requireFinite(board);
  return highestShortRootUnguarded(board);
}

export function coxeterNumber<T>(board: Board<T>): number;
export function coxeterNumber(board: AnyBoard): number;
export function coxeterNumber<T>(board: Board<T>): number {
  requireFinite(board);
  return coxeterNumberUnguarded(board);
}

export function longestWord<T>(board: Board<T>, nodes?: readonly number[]): Word;
export function longestWord(board: AnyBoard, nodes?: readonly number[]): Word;
export function longestWord<T>(board: Board<T>, nodes?: readonly number[]): Word {
  requireFinite(board);
  return longestWordUnguarded(board, nodes);
}

export function minusW0<T>(board: Board<T>): number[];
export function minusW0(board: AnyBoard): number[];
export function minusW0<T>(board: Board<T>): number[] {
  requireFinite(board);
  return minusW0Unguarded(board);
}

export function minusculeNodes<T>(board: Board<T>): number[];
export function minusculeNodes(board: AnyBoard): number[];
export function minusculeNodes<T>(board: Board<T>): number[] {
  requireFinite(board);
  return minusculeNodesUnguarded(board);
}
