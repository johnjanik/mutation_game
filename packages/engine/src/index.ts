// The public API of @two-games/engine: re-exports and nothing else. Later agents append their exports.
export { SafeInt, Big } from './arith';
export type { Arith, Vec, Matrix } from './arith';
export {
  EngineError,
  NotABoard,
  NeedsTwoWayRoads,
  NeedsConnectedBoard,
  NotFiniteType,
  NotAffine,
  NotAdmissible,
  EngineOverflow,
} from './errors';
export type { Admissibility, Reason } from './errors';
export { CAPS } from './caps';
export {
  cartan,
  boardFromName,
  fromAdjacency,
  adjacency,
  boardKind,
  toLabels,
  toPositions,
  cartanNumbers,
} from './board';
export type { Board, AnyBoard } from './board';
export { mutate, fire } from './moves';
export type { Word, Game, Choose } from './moves';
// Phase 1 (P1-A1): appended after P0-A2's exports.
export { rat, ratAdd, ratSub, ratMul, ratDiv, ratNeg, ratEq, ratSign, ratToString } from './rational';
export type { Rational } from './rational';
export { determinant, solve, inverse } from './linalg';
export { components, transposeBoard, subBoard } from './board';
export {
  mutationMatrix,
  firingMatrix,
  toNumbers,
  toPopulation,
  applyWord,
  legalNodes,
  raisingNodes,
} from './moves';
export { orbit, orbitGraph, wordTo, roots, positiveRoots } from './search';
export type { Enumeration, OrbitGraph } from './search';
export { play, raisingPlay, kostantPlay } from './play';
export type { PlayResult } from './play';
export { highestRoot, highestShortRoot, coxeterNumber, longestWord, minusW0, minusculeNodes } from './finite';
