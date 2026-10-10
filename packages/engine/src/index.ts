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
