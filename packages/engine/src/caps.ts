// The caps of SPEC.md 5.6 (first table), 4.0, E-6 and E-9 as named constants, exactly CONTRACTS.md 2.3.
// No phase-0 function consults a cap; the engine does not cap the number of nodes (customNodes is for
// the editor and resolveBoard).
export const CAPS = {
  customNodes: 12,
  roadsEachWay: 4,
  layersOffFinite: 40,
  mainThreadItems: 2000,
  gardenPositions: 2000,
  gardenDrawEverything: 300,
  workerPositions: 100000,
  playMoves: 20000,
  linkMoves: 20000,
  verticesDrawn: 20000,
  edgesAtRest: 70000,
  edgesTurning: 8000,
  weylExplorerGroup: 1152,
  countGamesGroup: 60000,
  rootTestSteps: 20000,
  formFinderDigits: 6,
  repOrbit: 2000,
  matrixGridDim: 27,
  relabellingsDefault: 10000,
  legalLayersDefault: 100000,
} as const;
