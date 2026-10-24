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
// Phase 2 (P2-A1): the six finite functions are re-exported from guards.ts, which adds the checks of
// SPEC.md 5.6 (E-11) in front of P1-A1's functions of finite.ts.
export { highestRoot, highestShortRoot, coxeterNumber, longestWord, minusW0, minusculeNodes } from './guards';
// Phase 2 (P2-A1): appended after the phase-1 exports.
export {
  symmetrizer,
  gram,
  cartanClass,
  relabellings,
  identify,
  affineCandidates,
  identifyAffine,
  classify,
  smallestNonfiniteSubboard,
  spectralRadius,
} from './classify';
export type { ClassifyRecord, NonfiniteSubboard } from './classify';
export { affineExtension, nullVector, marks, comarks, level, twistedAEven } from './affine';
export type { AffineExtension } from './affine';
export { formValue, formIsInvariant, isRootPopulation, coroot } from './form';
export type { InvarianceResult } from './form';
export { requireGcm, requireConnected, requireFinite, requireAffine } from './guards';
export { playFate } from './play';
// phase 3 (P3-A1): weyl.ts
export {
  bipartition,
  separatingRoots,
  wavePlay,
  exponentsFromFired,
  weylOrder,
  orbitSize,
  weylDimension,
  countCompleteGames,
  legalLayers,
} from './weyl';
export type { WaveResult } from './weyl';

// phase 3 (P3-A2): heaps.ts, geometry.ts
export { heap, heapKey, commutationClassSize, symbolicPlay, allCompleteGames } from './heaps';
export { choleskyBasis } from './geometry';

// phase 4 (P4-A1): fold.ts, restrictedType.ts, geometry.ts (phase-4 additions), wythoff.ts
export { symmetries, fold, averagedRootsType, averagedSimpleCartan } from './fold';
export type { Symmetry, FoldResult } from './fold';
export { classifyRestricted } from './restrictedType';
export type { RestrictedType, RestrictedEntry } from './restrictedType';
export { symEig, euclideanBasis, coxeterPlanePoints, coxeterPlaneRings, coxeterWord, applyWordFloat } from './geometry';
export type { CoxeterPlaneRings } from './geometry';
export { wythoffFaceTypes, wythoffFVector, wythoffEdges } from './wythoff';
export type { FaceType } from './wythoff';

// phase 5 (P5-A1): rep.ts
export { spKey, spMul, spAdd, spComm, spScale, spEq, minusculeMatrices, signedMoves, chevalleySerre, stringThrough } from './rep';
export type { SparseMatrix, RelationCheck } from './rep';
