# Contracts between agents

Interfaces that agents working in parallel must agree on without talking. Everything here is derived from `SPEC.md` sections 4.0, 5.2 to 5.7, 6.3, 6.6, 7.3 to 7.6; where this file adds a name or a file path that the specification leaves to the builder, that addition is marked **(plan)** and is binding for the team. A change to a contract is a deviation to be reported, never made silently.

---

## 1. Repository, packages, commands

```
/                              npm workspaces: "packages/*", "site"
  package.json                 private; "engines": {"node": ">=22.12"}; exact pins; scripts below
  package-lock.json            committed
  tsconfig.base.json           strict, ESM, "moduleResolution": "bundler"
  CLAUDE.md                    Appendix H verbatim, adapted only where this plan adds a rule
  DECISIONS.md                 written by MERGE and GATE from decisions/*.md
  decisions/                   one fragment per agent id (plan)
  reports/                     gate reports, discrepancy scripts, release archives (plan; .gitignore'd except gate-*.md)
  reference/                   read-only
  scripts/                     size.mjs  verify.mjs  numbers-in-prose.mjs  names.mjs  lab.mjs (plan name for npm run lab)
  packages/engine/             "@two-games/engine" (plan)
  site/                        "@two-games/site" (plan)
  build-plan/                  this plan
```

Root scripts (names from `SPEC.md` 7.7; bodies are the builder's): `test`, `build`, `build:release` (= `RELEASE=1 astro build`), `preview`, `e2e`, `size`, `lab`, `report`, `verify`, `typecheck` **(plan)**, `check` **(plan: typecheck + test)**. `npm run build` must run `scripts/names.mjs` first (7.3).

Path aliases in the site **(plan)**: `@engine` → `@two-games/engine`, `@components/*` → `site/src/components/*`, `@lib/*` → `site/src/lib/*`.

`site/astro.config.mjs` **(plan)**: besides the default export it exports a pure function `siteAndBase(env: Record<string, string | undefined>): { site: string; base: string }` implementing `SPEC.md` 7.2 item 10 (so the rule is unit-testable), treats `SITE_URL` and `BASE_PATH` independently with an empty string counting as unset, normalises `base` to begin and end with `/`, and honours an optional `OUT_DIR` variable for the output directory (used by the `BASE_PATH=/sub/path/` build of the `e2e:basepath` command). The Vitest root configuration is whichever file Vitest 5.0.3 reads (`vitest.workspace.ts` or `test.projects` in a root `vitest.config.ts`); `P0-A1` records the file name, and later agents refer to "the root Vitest configuration".

---

## 2. The engine

### 2.1 Module files and which phase owns them

| File | Contents | Phase (owner) |
|---|---|---|
| `src/index.ts` | re-exports the public API; nothing else | 0 (`P0-A2`); later agents append their exports |
| `src/arith.ts` | `Arith<T>`, `SafeInt`, `Big`, `EngineOverflow`; phase 7 adds `ZPhi` | 0 |
| `src/errors.ts` | all error classes of E-10 | 0 |
| `src/caps.ts` **(plan)** | the numbers of section 5.6 as named constants (below) | 0 |
| `src/board.ts` | `Board`, `cartan`, `boardFromName` (finite names), `fromAdjacency`, `adjacency`, `boardKind`, `toLabels`, `toPositions`, `cartanNumbers`; phase 1 adds `components`, `transposeBoard`, `subBoard`; phase 2 adds affine, twisted, `pentagon`, `square` to `boardFromName` | 0, 1, 2 |
| `src/moves.ts` | `mutate`, `fire`; phase 1 adds `mutationMatrix`, `firingMatrix`, `toNumbers`, `toPopulation`, `applyWord`, `legalNodes`, `raisingNodes` | 0, 1 |
| `src/rational.ts` | `Rational` and its operations | 1 |
| `src/linalg.ts` | `determinant`, `solve`, `inverse` over `Rational` | 1 |
| `src/search.ts` | `orbit`, `orbitGraph`, `wordTo`, `roots`, `positiveRoots` | 1 |
| `src/play.ts` | `play`, `raisingPlay`, `kostantPlay`; phase 2 adds `playFate` | 1, 2 |
| `src/finite.ts` | `highestRoot`, `highestShortRoot`, `coxeterNumber`, `longestWord`, `minusW0`, `minusculeNodes` | 1 |
| `src/classify.ts` | `symmetrizer`, `gram`, `cartanClass`, `relabellings`, `identify`, `affineCandidates`, `identifyAffine`, `classify`, `smallestNonfiniteSubboard`, `spectralRadius` | 2 |
| `src/affine.ts` | `affineExtension`, `marks`, `comarks`, `level`, `nullVector`, the twisted tables | 2 |
| `src/form.ts` | `formValue`, `formIsInvariant`, `isRootPopulation`, `coroot` | 2 |
| `src/guards.ts` | the `WeakMap` cache of `classify` verdicts; `requireGcm`, `requireConnected`, `requireFinite`, `requireAffine` | 2 |
| `src/weyl.ts` | `bipartition`, `separatingRoots`, `wavePlay`, `exponentsFromFired`, `weylOrder`, `orbitSize`, `weylDimension`, `countCompleteGames`, `legalLayers` | 3 (`P3-A1`) |
| `src/heaps.ts` | `heap`, `heapKey`, `commutationClassSize`, `symbolicPlay`, `allCompleteGames` | 3 (`P3-A2`) |
| `src/geometry.ts` | `choleskyBasis` (3, `P3-A2`); `symEig`, `euclideanBasis`, `coxeterPlanePoints`, `coxeterPlaneRings`, `coxeterWord`, `applyWordFloat` (4) | 3, 4 |
| `src/fold.ts` | `symmetries`, `fold`, `averagedRootsType`, `averagedSimpleCartan` | 4 |
| `src/wythoff.ts` | `wythoffFaceTypes`, `wythoffFVector`, `wythoffEdges` | 4 |
| `src/restrictedType.ts` **(plan)** | `classifyRestricted`, the oracle's `classify_restricted` ported as it stands (needed by `averagedRootsType` in phase 4 and by `satake` in phase 6) | 4 (`P4-A1`) |
| `src/rep.ts` | `SparseMatrix` operations, `minusculeMatrices`, `signedMoves`, `chevalleySerre`, `stringThrough`; phase 7 adds `orbitPlusZeroMatrices` | 5 |
| `src/satake.ts` | `theta`, `shadow2`, `admissibility`, `satake`, `restrictedBoard`; re-exports `classifyRestricted` | 6 (`P6-A1`) |
| `src/satakeCatalogue.ts` | `satakeCatalogue`, `satakeRecord`, `canonicalPair`, `matchCatalogue` | 6 (`P6-A2`) |
| `src/golden.ts` | phase 7: `ZPhi` arithmetic, `coxeterH`, `goldenFold` | 7 |

`packages/engine/package.json` has `"dependencies": {}` and only `typescript`, `vitest`, `fast-check` as development dependencies. Nothing in `src/` imports from outside `src/`.

### 2.2 Types (from `SPEC.md` 5.2, with the plan's additions marked)

```ts
export interface Arith<T> {
  zero: T; one: T; fromInt(n: number): T;
  add(a: T, b: T): T; sub(a: T, b: T): T; mul(a: T, b: T): T; neg(a: T): T;
  sign(a: T): -1 | 0 | 1; eq(a: T, b: T): boolean;
  show(a: T): string;                    // decimal text; also the hash key
  toBig(a: T): bigint;                   // SafeInt and Big only
}
export const SafeInt: Arith<number>;     // every result checked with Number.isSafeInteger; failure throws EngineOverflow
export const Big: Arith<bigint>;

export type Vec<T> = readonly T[];
export type Matrix<T> = readonly (readonly T[])[];
export type Game = 'mutation' | 'firing';                               // (plan)
export type Choose<T> = (allowed: readonly number[], v: Vec<T>) => number; // (plan) picks a position among allowed

export interface Board<T = number> {
  n: number;
  cartan: Matrix<T>;                     // C[i][j] = <alpha_i^vee, alpha_j>, positions 0..n-1
  labels: readonly number[];             // what the reader sees for each position (E-7)
  kind: 'gcm' | 'one-way';
  arith: Arith<T>;
  name?: string;                         // "E8", "B3", "A4~", "D4^(3)", "pentagon"; undefined if custom
}
export type AnyBoard = Board<number> | Board<bigint>;                    // (plan)

export type Word = readonly number[];    // positions, in the order played
export interface Rational { num: bigint; den: bigint; }                  // den > 0, lowest terms
export interface Enumeration<X> { items: X[]; truncated: boolean; }
export interface PlayResult<T> { status: 'ended' | 'looped' | 'cap'; moves: number; word: Word;
                                 fired: T[]; position: Vec<T>; firstVisit?: number; }
export interface OrbitGraph<T> { items: Vec<T>[]; truncated: boolean; depthReached: number; completeLayers: number;
                                 depth: number[]; parent: (number | null)[]; node: (number | null)[]; }
export type Symmetry = readonly number[];                                // image of each position
export interface SatakeDiagram { board: Board; black: readonly number[]; tau: Symmetry; }
export interface Admissibility { symmetry: boolean; condition_1: boolean; condition_2: boolean; condition_3: boolean;
                                 admissible: boolean; reasons: Record<string, Reason>; }
export interface Reason { code: 'not-a-symmetry' | 'not-an-involution' | 'moves-black-set' | 'differs-from-minus-wX' | 'not-an-integer';
                          nodes: number[]; value?: string; }
export interface FoldResult { folded: Board | null; orbits: number[][]; reason: string | null; }
export interface InvarianceResult { invariant: boolean; witness?: { node: number; population: number[] }; }
export type SparseMatrix = Map<string, bigint>;                           // key "row,column"
export interface RelationCheck { relation: 'hh' | 'he' | 'hf' | 'ef' | 'serre-e' | 'serre-f'; i: number; j: number;
                                 holds: boolean; left: SparseMatrix; right: SparseMatrix; }

// Records with the golden field names (SPEC 5.2, "Five functions return records with the golden field names").
// Nodes inside are POSITIONS; tests convert with toLabels before comparing.
export interface ClassifyRecord { nodes: number[]; kind: 'gcm' | 'one-way'; balanced: boolean;
                                  class: 'finite' | 'affine' | 'indefinite' | null; name: string | null;
                                  bourbaki_order?: number[]; marks?: number[]; comarks?: number[]; }
export interface NonfiniteSubboard { nodes: number[]; class: 'affine' | 'indefinite'; }
export interface SatakeComputed {   // what satake() returns: the fields of SPEC 6.4 from rank to restricted_reflection_word_lengths
  rank: number; real_rank: number; restricted_type: string | null;
  multiplicities: { class: string; roots: number; mult: number }[]; n_restricted_roots: number;
  dim_g: number; dim_k: number; dim_p: number; character: number;
  roots_compact_imaginary: number; roots_real: number; roots_complex: number;
  w_X_word: number[]; restricted_simple_orbits: number[][]; restricted_simple_multiplicities: [number, number][];
  restricted_cartan: number[][] | null; restricted_board: string | null;
  restricted_orbits_in_bourbaki_order: number[][] | null; restricted_reflection_word_lengths: number[];
}
export interface SatakeCatalogueEntry { cartan_label: string; real_form: string; black_nodes: number[]; tau: number[];
                                        restricted_type_display: string | null; }
export interface SatakeRecord extends SatakeCatalogueEntry, SatakeComputed {
  dynkin_type: string; arrows: [number, number][]; tau_moves_black_nodes: boolean; }
export interface RestrictedBoard { orbits: number[][]; simpleRestrictedRoots2: number[][]; cartan: number[][];
                                   compositeWords: Word[]; board: Board; }                 // (plan)
export interface FaceType { nodes: number[]; dimension: number; count: bigint; }            // (plan)
export interface WaveResult<T> { rounds: number; legal: boolean; position: Vec<T>; word: Word; } // (plan)
export interface AffineExtension { board: Board<bigint>; marks: number[]; comarks: number[]; } // (plan)
```

Error classes (E-10), all extending `EngineError` **(plan)**: `NotABoard`, `NeedsTwoWayRoads`, `NeedsConnectedBoard`, `NotFiniteType`, `NotAffine` (message carries the class), `NotAdmissible` (carries the `Admissibility`), `EngineOverflow`. Reaching a cap is never thrown.

### 2.3 Caps (`src/caps.ts`, plan)

```ts
export const CAPS = {
  customNodes: 12, roadsEachWay: 4, layersOffFinite: 40, mainThreadItems: 2000, gardenPositions: 2000,
  gardenDrawEverything: 300, workerPositions: 100000, playMoves: 20000, linkMoves: 20000,
  verticesDrawn: 20000, edgesAtRest: 70000, edgesTurning: 8000, weylExplorerGroup: 1152,
  countGamesGroup: 60000, rootTestSteps: 20000, formFinderDigits: 6, repOrbit: 2000, matrixGridDim: 27,
  relabellingsDefault: 10000, legalLayersDefault: 100000,
} as const;
```

### 2.4 Signatures by phase

Every function takes positions and returns positions. `board` may be `Board<number>` or `Board<bigint>`; vectors are in the board's arithmetic. Functions marked **finite** throw `NeedsTwoWayRoads` on a one-way board and `NotFiniteType` off the finite types (from phase 2, through `guards.ts`; in phase 1 they are called only on named finite boards). Oracle names are in `SPEC.md` 5.3 and 5.4.

**Phase 0**

```ts
cartan(name: string): number[][]                                   // "A3", "B4", ... any rank the family allows; throws NotABoard on an unknown name
boardFromName(name: string): AnyBoard                              // finite names → Board<number> with SafeInt; phase 2 extends
fromAdjacency(A: number[][]): AnyBoard                             // C = 2I - A^T; SafeInt if identify names a finite type (phase 2), else Big; phase 0: Big unless the matrix equals a named finite type's
adjacency(board: AnyBoard): number[][]
boardKind(C: readonly (readonly number[])[]): 'not-a-board' | 'one-way' | 'gcm'
toLabels(board: AnyBoard, positions: readonly number[]): number[]
toPositions(board: AnyBoard, labels: readonly number[]): number[]  // throws RangeError on an unknown label
cartanNumbers(board: AnyBoard): number[][]                         // (plan) integer copy for display and tests
mutate<T>(board: Board<T>, p: Vec<T>, i: number): T[]
fire<T>(board: Board<T>, a: Vec<T>, i: number): T[]
```

**Phase 1**

```ts
components(board): number[][]                                      // positions, each sorted, components in order of least position
transposeBoard(board): AnyBoard;  subBoard(board, nodes: readonly number[]): AnyBoard   // labels kept (E-7)
determinant(M: Matrix<number> | Matrix<bigint> | Matrix<Rational>): Rational
rational helpers: rat(num, den?), ratAdd, ratSub, ratMul, ratDiv, ratEq, ratSign, ratToString ("p/q" or "p")
mutationMatrix(board, i): number[][];  firingMatrix(board, i): number[][]
toNumbers<T>(board: Board<T>, p: Vec<T>): T[]                      // a = C p
toPopulation(board, a: Vec<T>): Rational[] | null                  // C^{-1} a; null when det C = 0
applyWord<T>(board, v: Vec<T>, word: Word, game: Game): T[]
legalNodes<T>(board, a: Vec<T>): number[];  raisingNodes<T>(board, p: Vec<T>): number[]   // positions, increasing
play<T>(board, a: Vec<T>, choose?: Choose<T>, cap?: number): PlayResult<T>              // status 'ended' | 'cap'
raisingPlay<T>(board, p: Vec<T>, choose?, cap?): PlayResult<T>;  kostantPlay(board, i: number, choose?, cap?): PlayResult<T>
orbit<T>(board, seeds: Vec<T>[], game: Game, cap: number, maxDepth?: number): Enumeration<T[]>
orbitGraph<T>(board, seeds, game, cap, maxDepth?, legalOnly?: boolean): OrbitGraph<T>
wordTo(graph: OrbitGraph<unknown>, index: number): Word
roots(board, cap: number, maxDepth?: number): Enumeration<T[]>;  positiveRoots(board, cap?, maxDepth?): T[][]  // sorted by total, then lexicographically
highestRoot(board): T[];  highestShortRoot(board): T[] | null                                                    // finite
coxeterNumber(board): number;  longestWord(board, nodes?: readonly number[]): Word;  minusW0(board): number[];  minusculeNodes(board): number[]   // finite
```

`orbitGraph` order and truncation are exactly `SPEC.md` 5.5: seeds in the order given; then each position in the order found, nodes in increasing position; a position at depth `maxDepth` is not expanded (and that leaves `truncated` false); the cap stops the search when it is about to add position number cap+1, with `truncated: true`, exactly `cap` items, and `completeLayers` equal to the depth of the position being expanded.

**Phase 2**

```ts
symmetrizer(board): Rational[] | null;  gram(board): Rational[][] | null
cartanClass(board): 'finite' | 'affine' | 'indefinite'            // connected gcm only; throws NeedsConnectedBoard, NeedsTwoWayRoads
relabellings(b1, b2, limit?: number): number[][]                  // lexicographic; p[i] = node of b1 playing node i of b2
identify(board): { name: string; order: number[] } | null         // connected finite board in any numbering; order[k] = position playing Bourbaki node k+1
affineCandidates(m: number): { name: string; cartan: number[][] }[];  identifyAffine(board): string | null
classify(board): ClassifyRecord[]                                  // one per component; throws NotABoard
smallestNonfiniteSubboard(board): NonfiniteSubboard | null
affineExtension(board, short?: boolean): AffineExtension           // node 0 first; finite only
marks(board): number[];  comarks(board): number[];  level<T>(board, a: Vec<T>): T    // affine only; NotAffine otherwise
spectralRadius(board): number | null                               // null on one-way
playFate<T>(board, a, choose?, cap?): PlayResult<T>                // 'ended' | 'looped' | 'cap'
isRootPopulation(board, v, cap?: number): boolean | null           // gcm only; null when the descent exceeds cap steps
coroot(board, root): T[];  formValue(board, p, q?): Rational | null;  formIsInvariant(board, M: number[][]): InvarianceResult
boardFromName: adds "X~" (untwisted), "B2~" and "C2~" both accepted, twisted names "A2^(2)" ... "D4^(3)", "pentagon", "square"; all return Board<bigint> with labels per E-7
```

**Phase 3** (`P3-A1`: `weyl.ts`; `P3-A2`: `heaps.ts`, `choleskyBasis`)

```ts
// weyl.ts (P3-A1)
bipartition(board): [number[], number[]] | null
separatingRoots(board, a): T[][];  wavePlay(board, a, firstColour: 0 | 1): WaveResult<T>
exponentsFromFired(fired: readonly number[], n: number): number[];  weylOrder(board): number
orbitSize(board, a): number;  weylDimension(board, lambda: readonly number[]): bigint
countCompleteGames(board, cap?: number): bigint | null;  legalLayers(board, start?, cap?): number[] | null
// heaps.ts (P3-A2)
allCompleteGames(board, start, cap): Enumeration<Word>
heap(board, word): number[];  heapKey(board, word): string;  commutationClassSize(board, word): bigint
symbolicPlay(board, word): number[][]                              // the linear forms fired, as integer coefficient vectors
choleskyBasis(board): number[][]                                   // upper triangular U with U^T U = B (floats)
```

**Phase 4**

```ts
symmetries(board, limit?): Symmetry[];  fold(board, symmetry): FoldResult
averagedRootsType(board, symmetry): { name: string; classes: { class: string; roots: number; form_value: string }[] }
averagedSimpleCartan(board, symmetry): number[][]
symEig(M: number[][]): { values: number[]; vectors: number[][] }    // cyclic Jacobi, ascending
euclideanBasis(board): { E: number[][]; eigenvalues: number[] }
coxeterPlanePoints(board): [number, number][];  coxeterPlaneRings(board): { rings: [number, number][]; distinct_points: number; h_points_on_every_ring: boolean }
coxeterWord(board): Word;  applyWordFloat(board, v: number[], word, game): number[]
wythoffFaceTypes(board, rings: readonly number[]): FaceType[];  wythoffFVector(board, rings): bigint[]
wythoffEdges(board, rings, cap: number): Enumeration<[number[], number[]]>
```

**Phase 5**

```ts
minusculeMatrices(board, i: number, cap?: number): { basis: number[][]; E: SparseMatrix[]; F: SparseMatrix[]; H: SparseMatrix[]; moves: SparseMatrix[] } | null
signedMoves(basis, E, F): SparseMatrix[];  chevalleySerre(board, E, F, H): RelationCheck[]
stringThrough(board, mu: readonly number[], i: number): number[][]
```

**Phase 6** (`P6-A1`: first five; `P6-A2`: the rest)

```ts
theta(d: SatakeDiagram, p): number[];  shadow2(d, root): number[];  admissibility(d): Admissibility
satake(d): SatakeComputed                                          // throws NotAdmissible
restrictedBoard(d): RestrictedBoard                                // throws NotAdmissible
restrictedCoordinates(d, rb: RestrictedBoard, shadow2: Vec<number>): number[]   // (plan, P6-A1 follow-up for T13) integer coordinates of a doubled shadow in the simple restricted roots, in the order of rb.orbits; RangeError when not an integer combination
classifyRestricted(S: number[][], B: Rational[][], r: number): { name: string; classes: ... }   // ported as it stands from the oracle
satakeCatalogue(name: string): SatakeCatalogueEntry[];  satakeRecord(name: string, entry: SatakeCatalogueEntry): SatakeRecord
canonicalPair(d): { black: number[]; tau: number[] };  matchCatalogue(d): SatakeRecord[]    // 0, 1 or 2 records
```

### 2.5 Behaviour off the finite boards

Exactly the table of `SPEC.md` 5.6. In particular: `toPopulation` returns `null` when $\det C=0$; `symmetrizer`, `gram`, `formValue` return `null` when not balanced; `classify` returns a record with `kind: 'one-way'`, `class: null`, `balanced: false`, `name: null` on a one-way component; `marks`, `comarks`, `level` throw `NotAffine` on finite boards too.

---

## 3. The golden-test harness (`packages/engine/test/golden/_harness.ts`, owner `P0-A2`)

```ts
export const golden: GoldenData;                                   // parsed once from reference/golden_data.json; never mutated
export const TYPE_NAMES: readonly string[];                        // the 32 keys of golden.types in file order
export function boardOf(typeName: string): Board<number>;
export function covers(...keys: string[]): void;                   // registers the golden keys a test file covers; written to test/golden/coverage.json by the Vitest reporter/globalSetup
export const GOLDEN_KEYS_BY_PHASE: Record<0|1|2|3|4|5|6|7, string[]>;   // the table of SPEC 5.7, machine-readable
export function labels(board: AnyBoard, positions: readonly number[]): number[];
export function wordLabels(board: AnyBoard, word: Word): number[];
export function intEq(actual: unknown, expected: unknown, message?: string): void;        // rule 1; bigint vs decimal string allowed
export function ringsEq(actual: [number, number][], expected: [number, number][]): void;  // rule 3; radii within 1e-5
export function ratText(r: Rational): string;                                              // rule 4
export function matchRecord<T extends object>(list: T[], where: Partial<T>): T;            // rule 5; throws unless exactly one
export function sortedPositiveRoots(list: number[][]): number[][];                          // total, then lexicographic
```

Rules: a golden key is tested in exactly one file (so coverage is unambiguous); every test file calls `covers(...)` with the keys it tests, using the spellings of the table in `SPEC.md` 5.7; the comparison rules 1 to 7 are implemented once here and never re-implemented in a test. `GATE` fails if `coverage.json` lacks a key assigned to a phase at or below the gate's.

Property tests live in `test/properties/p{n}-*.test.ts`, one file per numbered property of 5.7, with `fast-check` and a fixed seed recorded in the file.

The benchmark of 7.6 lives in `test/bench/orbit.bench.ts` (phase 3, `P3-A2`): the 12-cycle with a chord joining nodes 1 and 7, 2000 positions, `Big`, median of seven runs, fails above 25 ms.

---

## 4. Site libraries (`site/src/lib/`, owner `P1-A2` unless stated)

```ts
// katex.ts  (owner P0-A3)
export function renderTex(src: string, display: boolean): string;   // KaTeX renderToString in Node, MathML included (A-12), throwOnError: true
// The installed KaTeX version, its CSS and its fonts are one package: site/public/katex/ is copied from node_modules/katex/dist at build time by scripts/names.mjs or a prebuild step, never hand-copied.

// state.ts
export type ToolId = 'board'|'garden'|'form'|'lab'|'numbers'|'mirror'|'symbolic'|'weyl'|'kostant'|'geometry'|'fold'|'rep'|'satake'|'atlas'|'affine'|'sandbox';
export type BoardSpec = string | { cartan: number[][]; xy?: [number, number][] };   // SPEC 6.6 "board"
export interface ToolState {               // SPEC 6.6, exactly; tool-specific fields optional
  schema: 1; tool: ToolId; board: BoardSpec;
  view?: 'populations'|'numbers'|'linked'; mode?: 'free'|'legal'|'raising'; coords?: 'populations'|'numbers';
  start?: (number | string)[];             // JSON numbers when safe integers, else decimal strings (same rule as data export)
  moves?: number[];                        // labels
  black?: number[]; tau?: number[]; rings?: number[]; projection?: string; graph?: 'polytope'|'moves';
  symmetry?: number[]; node?: number; relation?: string; lambda?: number[];
}
export function defaultState(tool: ToolId, board: BoardSpec): ToolState;
export function resolveBoard(spec: BoardSpec): AnyBoard;            // named finite → SafeInt; everything else → Big; validates with boardKind; throws on not-a-board or > 12 nodes
export function positionsOf(state: ToolState): (number|string)[][]; // start and every position after each move, recomputed by the engine

// urlCodec.ts
export function encodeState(state: ToolState, opts?: { prefix?: string }): string;                    // query string without '?', keys of SPEC 6.6
export function decodeState(search: string, tool: ToolId, defaults: ToolState, opts?: { prefix?: string }): { state: ToolState; notice: string | null };
export function decodeStateWith(search: string, tool: ToolId, defaults: ToolState, opts?: { prefix?: string; longListReplay?: 'sync' | 'worker' }): { state: ToolState; notice: string | null };  // (plan) test-only variant; decodeState delegates to it with the LONG_LIST_REPLAY default 'sync'
// Every rule of SPEC 6.6 "Validation" is enforced; on any failure the result is { state: defaults, notice: "<the sentence>" }.

// worker.ts  (E-9)
export type CallHint = { board: AnyBoard; kind: 'enumeration'|'play'|'count'|'satake'|'other'; expectedItems?: number; moves?: number; finiteKnown?: boolean };
export function whereToRun(hint: CallHint): 'main' | 'worker';    // pure; unit-tested against the three rules of E-9
export function engineCall<F extends keyof EngineApi>(fn: F, args: Parameters<EngineApi[F]>, hint: CallHint): Promise<Awaited<ReturnType<EngineApi[F]>>>;
export function provide(fns: Partial<EngineApi>): void;   // (plan, P6-size) the main-thread table: every module that calls engineCall provides the engine functions it calls by name (playFate excepted); a name not provided runs from the whole engine loaded on demand
// Worker message: { id, fn, args: Serialized[], board: BoardSpec } → { id, ok: true, result } | { id, ok: false, error: { name, message, data? } }.
// Serialization: bigint as { "$big": "decimal" }; Map as { "$map": [[k, v], ...] }; Board as its BoardSpec (rebuilt with resolveBoard); errors re-thrown on the main side as the same class.

// a11y.ts  (SPEC 7.5; owner P0-A5, extended by P1-A2)
export function speak(n: number | string | bigint): string;         // "minus 2"
export const nodeName: (kind: 'node'|'city', label: number, value, state: 'can be fired'|'cannot be fired'|'mutation would raise it'|'mutation would lower it'|'mutation would change nothing') => string;  // A-3
export const announceTemplates: {
  fired(label, numbers, move): string; mutated(label, populations, move): string; linked(label, populations, numbers, move): string;
  cannotFire(label, value): string; gameOver(moves): string; playedToEnd(moves, numbers): string; undid(move, numbers): string;
  changedOnly(verb, label, changes: [label, value][], move): string;   // boards with more than four nodes
};
export function createAnnouncer(region: HTMLElement): (text: string) => void;   // coalesces within 500 ms to the last text, with the count of moves

// export.ts
export function exportJSON(state: ToolState, derived: Record<string, unknown>): string;  // includes engine version and git commit; bigint as decimal strings
export function exportSVG(svg: SVGSVGElement, footer: FooterLine | null): string;        // phase 2 (P2-A6)
export function exportPNG(svg: SVGSVGElement, footer: FooterLine | null, scale?: number): Promise<Blob>;  // phase 2 (P2-A6)
export function exportLaTeX(kind: 'dynkin'|'tikz-graph'|'tikz-points', data: unknown): string;          // phase 6 (P6-A5)

// sources.ts and unverifiedRegistry.ts (owner P0-A4): the SOURCES.md key parser and the <Unverified> usage registry (see P0-A4's instruction)

// golden.ts  (owner P0-A4)
export function resolveGoldenPath(path: string): unknown;           // SPEC 7.3 <G> path grammar; throws GoldenPathError("path ... resolves to N values")
export function formatGoldenValue(v: unknown, as?: 'word'|'count'|'plain'): string;

// highlight.ts  (nanostores)
export const highlight: Atom<{ kind: 'node'|'root'|'position'; board: string; value: number | number[] } | null>;
```

---

## 5. Board and tool components

### 5.1 Board family (`site/src/components/board/`, owner `P0-A5`; `P1-A5` extends)

`Board.svelte` props: `{ board: AnyBoard; values: (number|string)[]; game: 'mutation'|'firing'; canAct: boolean[]; labels?: boolean; roadStyle?: 'dynkin'|'roads'; decoration?: ...; onAct: (position: number) => void; hintFor?: (position) => string | null; name: string /* accessible name */ }`. Renders an SVG with real `<button>` elements positioned over the drawing (A-1), roving `tabindex`, the arrow-key model of A-1, Home/End, Enter/Space, the hooks `data-node` (label), `data-board`, `data-value`, `data-can-act`. Sign encoding per 6.3 by numeral, fill and colour. Hit area `min(44, u)` per 6.1.

`History.svelte`: undo, redo, reset buttons (visible, after the board in tab order), the strip of past positions (slider above 50), `u` and `r` shortcuts active only while focus is inside the board.

`ToolFrame.svelte` **(plan; owner `P1-A2`)**: the chrome every tool uses: title and caption; the control row rendered `disabled` until hydration; `step` and `play to the end` or `play on` slots; "Copy link", "Download data", from phase 2 "Export SVG" and "Export PNG", from phase 6 "Export LaTeX", "Cite"; "Show as table" toggle whose table has one button per node (A-10); the polite live region, present and empty before the first move; the `<noscript>` line; `data-tool` and `data-moves` on the root. Props: `{ toolId, instanceId, title, caption, state, derivedForExport, onUndo, onRedo, onReset, children snippets: figure, controls, table }`.

### 5.2 Tool components (`site/src/components/tools/T{nn}{Name}.svelte`)

Common props (all optional except `id`): `id`, `board`, `coords`, `start`, `moves`, `linkTo`, `prediction`, `preset`, `caption`, `layers`. T1 adds `view`, `mode`, `script`, `goal`, `hints`, `panels`, `roadStyle`. A tool reads the URL on hydration through `decodeState` with its instance prefix, applies it over its props, and writes back with `encodeState` on change.

```ts
export interface Prediction {
  question: string;
  answer: { type: 'number'; value: number } | { type: 'position'; value: number[] } | { type: 'choice'; options: string[]; correct: number };
  reveal: string;
}
```

Registry **(plan)**: `site/src/tools/registry/T{nn}.ts` exports
```ts
export default { number: 1, id: 'board', title: 'Game Board', phase: 1,
  boards: 'all' as 'all' | string[],                 // which boards the picker offers
  presets: { default: { caption: '...' }, ... },     // preset id → state fields it fixes (every preset is a state object and a link) + caption
  outs: ['moveCounter', 'gameOver', ...],            // every data-out name the tool renders
  component: () => import('@components/tools/T01GameBoard.svelte') } satisfies ToolRegistryEntry;
```
`site/src/tools/index.ts` collects the registry with `import.meta.glob`; `pages/tools/[tool].astro` and `pages/embed/[tool].astro` are generated from it. A tool agent never edits those pages.

Tests **(plan)**: `site/tests/unit/tools/T{nn}.test.ts` (Vitest, criteria over all boards or random cases), `site/tests/e2e/T{nn}.spec.ts` (Playwright: the named examples and one case per kind of board offered; a comment block at the top lists the `data-out` names used). Playwright tests read only `data-*` hooks and the live region.

### 5.3 Announcements and names (exact strings of `SPEC.md` 7.5)

A-3: `Node 3, value 2, can be fired` · `Node 5, value 0, cannot be fired` · `City 2, population 1, mutation would raise it`. A-4: `Fired node 3. Numbers now minus 1, 2, minus 3. Move 4.` · `Mutated city 2. Populations now 1, 1, 0. Move 1.` · `Mutated city 1 and fired node 1. Populations now 0, 1; numbers now minus 1, 2. Move 2.` · `Node 3 cannot be fired: its number is minus 2.` · `Game over after 6 moves.` · `Played 14 moves to the end. Numbers now 0, 0, 0, 0, minus 1.` · `Undid move 4. Numbers now ...` · above four nodes: `Fired node 4. Node 3 now 3, node 4 now minus 2, node 5 now 1. Move 7.`

Stated limits (4.0): `stopped after 40 layers` · `stopped after 2000 positions; layers 0 to 10 are complete` · `still running after 20000 moves` · `too large to test here` · `more than 2000`.

---

## 6. Preset ids (from the figure tables of `SPEC.md` section 3; kebab-case, plan)

| Tool | Presets |
|---|---|
| T2 `garden` | `follow`, `explore`, `positive-roots`, `triangle-40` |
| T3 `form` | `meter`, `builder`, `small-values` |
| T4 `lab` | `default`, `verdict`, `hunter` |
| T5 `numbers` | `compared`, `tally`, `wave`, `dimension` |
| T6 `mirror` | `default` (point at $a=(1,1)$) |
| T7 `symbolic` | `default` |
| T8 `weyl` | `default`, `counter`, `heap` |
| T9 `kostant` | `default` |
| T10 `geometry` | `root-polytope`, `rings`, `face-table`, `two-graphs`, `make-uniform`, `showpiece`, `coxeter-plane` |
| T11 `fold` | `fold`, `average`, `golden` (phase 7) |
| T12 `rep` | `string-viewer`, `default`, `relation-checker`, `signed-move`, `one-zero-weight` (phase 7) |
| T13 `satake` | `default`, `play-theta`, `shadows`, `lights`, `data`, `restricted`, `catalogue`, `tau-on-black` |
| T15 `affine` | `frozen`, `marks-comarks`, `pentagon`, `three-fates` |
| T16 `sandbox` | `default` |

T1 and T14 have no presets (T1 is configured by its properties; T14 is static pages).

---

## 7. Lesson authoring (MDX)

Frontmatter **(plan)**: `title`, `module` (0 to 10), `question`, `phase`, `released: true|false`, `draft: true` (D17: stays true until the owner approves), `outcomes: ["LO1", ...]`, `sources: ["W20", ...]`.

Imports: tool components from `@components/tools/...`; content components from `@components/content` (`G`, `Tex`, `Unverified`, `Cite`) and the lesson layout components **(plan; owner `P1-A4`)**: `Beat` (numbered beat with a figure slot), `Seen` ("What we have seen" framed box with a `provenance` prop: a citation key or `"verified by computation"`), `LieTheory` (the paragraph for readers who know Lie theory), `Challenge` (goal text, a `check` that reports success, built on a tool instance), `ModuleLinks` (sandbox with the module's board, atlas, next module; omitted automatically when the target is not released), `Sources`, `DraftMark`.

Islands: the first tool on a page `client:idle`, every other `client:visible` (7.6). Instance ids `b1`, `b2`, ... in reading order. Every tool has a `caption` prop stating the result it demonstrates (P1).

Numbers: every number with a golden value through `<G k="..."/>`; in formulas through `<Tex src="... {{path}} ..."/>`. The `<G>` path grammar is `SPEC.md` 7.3.

---

## 8. CSS custom properties (6.3, 8.3; plan names)

`--page`, `--text`, `--sign-pos-fill`, `--sign-pos-numeral`, `--sign-neg-outline`, `--sign-zero-outline`, `--edge-1` to `--edge-8`, `--accent-populations` (`#009E73`), `--accent-numbers` (`#CC79A7`), `--focus-ring`, `--road`, `--arrow`. Light and dark values exactly as the tables of 6.3; dark theme under `@media (prefers-color-scheme: dark)` with a manual switch stored in `localStorage` (`data-theme` on `<html>`).

---

## 9. Reference integrity

SHA-256 at the start of the build (10 October 2026):

```
c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f  reference/golden_data.json
485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad  reference/lie_games.py
1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d  reference/verify.py
```

`GATE` and `RT-11` recompute and compare these at every phase. A difference is a blocker.

---

## 10. Branches, commits, fragments, reports

Branch per build agent `agent/P{k}-A{m}`; per red-team lens `redteam/P{k}-RT-{nn}`; per fix cluster `fix/P{k}-<cluster>`. Commit messages begin with the agent id. Decisions fragments `decisions/<id>.md` in the form of `COMMON.md` 5.1. Reports in the JSON of `COMMON.md` 5.2 (build) or `RED-TEAM-COMMON.md` 5 to 7 (red team).
