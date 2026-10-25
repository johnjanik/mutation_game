// The data of one Atlas page (SPEC.md 4 T14; 2.8, 2.9, 2.10, 2.12, 6.4 to 6.6). Owner P6-A4.
//
// "One static page per board, generated at build time by calling the engine": every value below comes
// from an engine function, called in Node when Astro builds the page (E-9 does not apply at build time).
// Nothing here reads reference/golden_data.json, which is the test oracle only (site/tests/unit/atlas.test.ts
// compares every value with it for all 32 types). Values leave this module as labels, never positions
// (E-7: toLabels, and vectors put in label order), with integers as number or bigint (E-4).
//
// Each item carries the link to the tool that demonstrates it with the board loaded (T14: "Every item links
// to the tool that demonstrates it with that board loaded"). A link is a query of SPEC 6.6 with bare keys,
// written by encodeState from a state that names only what it changes; the page builds the href with the
// released mechanism, so a link to a tool that is not registered is left out (7.3). Which tool and what
// the link text says are the plan's choices (instruction 5.2); site/tests/unit/atlas.test.ts decodes every
// link of every page with decodeState and requires no notice.
//
// Pure: no DOM, no file system, no KaTeX. Build time only (the engine functions here are not given to the
// browser; the Atlas pages carry no island).
import {
  CAPS,
  adjacency,
  affineExtension,
  boardFromName,
  cartanNumbers,
  coxeterNumber,
  coxeterPlaneRings,
  countCompleteGames,
  determinant,
  exponentsFromFired,
  highestRoot,
  highestShortRoot,
  identifyAffine,
  minusW0,
  minusculeNodes,
  orbitSize,
  play,
  positiveRoots,
  roots,
  satakeCatalogue,
  symmetrizer,
  toLabels,
  toNumbers,
  transposeBoard,
  weylOrder,
} from '@two-games/engine';
import type { AnyBoard, Board, Rational } from '@two-games/engine';
import { encodeState } from '../../lib/urlCodec';
import type { ToolId, ToolState } from '../../lib/state';
import { isAtlasBoard } from './boards';

export { ATLAS_BOARDS, ATLAS_GROUPS, isAtlasBoard } from './boards';

/** T14: "roots (up to 120 positive ones listed)". No type exceeds it ($E_8$ has exactly 120). */
export const ROOT_LIST_CAP = 120;

/** The boards T8 offers (SPEC 4 T8; registry/T08.ts, offered.ts); T5 stands in on the others (plan). */
const WEYL_BOARDS: readonly string[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'D4', 'F4', 'G2'];

/** A link to a tool: the tool id, the query of SPEC 6.6 without '?', and a name that says where it goes. */
export interface ToolLink {
  tool: ToolId;
  query: string;
  text: string;
}

/** The items of the T14 entry that link to a tool, in its order (the real forms link one by one). */
export type ItemId =
  | 'cartan'
  | 'roads'
  | 'weights'
  | 'roots'
  | 'highest-roots'
  | 'exponents'
  | 'coxeter-number'
  | 'weyl-order'
  | 'det-cartan'
  | 'minuscule-nodes'
  | 'minus-w0'
  | 'orbit-sizes'
  | 'complete-games'
  | 'coxeter-plane'
  | 'affine';

/** One record of the Satake catalogue of the board (6.4), with labels, and its link to T13. */
export interface RealFormLine {
  cartanLabel: string;
  /** The plain-text name of 6.5 (`so(1,6)`); the page typesets it from satake-names.json. */
  realForm: string;
  /** Labels of the black nodes, increasing. */
  black: number[];
  /** The image of every node, in label order. */
  tau: number[];
  restrictedTypeDisplay: string | null;
  link: ToolLink;
}

/**
 * The row of the table of SPEC 2.10 that applies (plan names): `same` (his "B2", "C2", "G2" are these
 * boards with the same numbering), `reversed` (his "C_n", "B_n" for n >= 3 and "F4": this board with the
 * node order reversed), `D` (his vertex k is node n - k and his 0 is node n), `E` (his path 1, 2, 3, ...
 * is nodes 1, 3, 4, ... and his 0 is node 2), `none` (no row: A_n and E8). Never a list of roots.
 */
export interface WildbergerNote {
  row: 'same' | 'reversed' | 'D' | 'E' | 'none';
  /** Wildberger's name for this board in [W20] section 9 and [W-MS], or null where 2.10 has no row. */
  hisName: string | null;
  /** True on the B and C pages, which carry the sentence on the exchanged letters (9.5). */
  lettersExchanged: boolean;
}

/** Everything one Atlas page shows. Nodes are labels; vectors and matrices are in label order. */
export interface AtlasSheet {
  name: string;
  letter: string;
  rank: number;
  /** The labels 1..n in increasing order (E-7). */
  labels: number[];
  /** C with C_ij = <alpha_i^vee, alpha_j> (2.1; this site, Kac and SageMath). */
  cartan: number[][];
  /** The transpose, as Bourbaki and Humphreys print it (2.9). */
  cartanTransposed: number[][];
  /** A_ij = roads from i to j = -C_ji (2.1). */
  adjacency: number[][];
  /** The weights d_i (2.5), normalised to least 1. */
  symmetrizer: Rational[];
  nRoots: number;
  nPositiveRoots: number;
  /** The positive roots as populations, sorted by total, then lexicographically, at most ROOT_LIST_CAP. */
  positiveRoots: number[][];
  highestRoot: number[];
  numbersOfHighestRoot: number[];
  /** Null on the simply laced types (the engine's highestShortRoot). */
  highestShortRoot: number[] | null;
  numbersOfHighestShortRoot: number[] | null;
  /** True exactly when the engine finds no highest short root: every root has one length. */
  simplyLaced: boolean;
  exponents: number[];
  coxeterNumber: number;
  weylOrder: number;
  detCartan: Rational;
  minusculeNodes: number[];
  /** The images (sigma(1), ..., sigma(n)) of the nodes under -w0. */
  minusW0: number[];
  minusW0Identity: boolean;
  fundamentalOrbitSizes: number[];
  /** The number of complete games from all ones; null when the group has more than CAPS.countGamesGroup elements (5.6). */
  completeGames: bigint | null;
  /** [radius, number of roots] per ring of the Coxeter plane, innermost first; null on rank 1. */
  coxeterPlaneRings: [number, number][] | null;
  /** The affine board of 2.12: its name recognised from its shape, the name that builds it, marks and comarks (node 0 first). */
  affine: { name: string; constructorName: string; labels: number[]; marks: number[]; comarks: number[] };
  realForms: RealFormLine[];
  /** The tool link of each item; null where an item is omitted (the Coxeter plane on rank 1). */
  links: Record<ItemId, ToolLink | null>;
  wildberger: WildbergerNote;
  /** Kac numbers the nodes of E6, E7, E8 and G2 differently (2.9: [S2] for E6, [U] for the rest; Appendix E item 4). */
  kacNumbering: boolean;
}

// ---------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------

/** Positions in increasing order of their labels. */
function positionsByLabel(board: AnyBoard): number[] {
  return board.labels.map((label, position) => ({ label, position })).sort((a, b) => a.label - b.label).map((x) => x.position);
}

/** A vector indexed by position, put in label order. */
function vectorInLabelOrder<V>(board: AnyBoard, v: readonly V[]): V[] {
  return positionsByLabel(board).map((p) => v[p]!);
}

/** A safe-integer value of the board's arithmetic (every value of a named finite board is one); never -0. */
function int(x: number | bigint): number {
  const n = Number(x);
  if (!Number.isSafeInteger(n)) throw new RangeError(`atlasData: ${String(x)} is not a safe integer`);
  return n + 0;
}

/** An integer matrix indexed by positions, rows and columns put in label order. */
function matrixInLabelOrder(board: AnyBoard, m: readonly (readonly (number | bigint)[])[]): number[][] {
  const order = positionsByLabel(board);
  return order.map((i) => order.map((j) => int(m[i]![j]!)));
}

const ints = (v: readonly (number | bigint)[]): number[] => v.map(int);

/** The unit vector of the node of position k (the population e_k, or the fundamental weight omega_k). */
function unit(board: AnyBoard, k: number): number[] {
  return Array.from({ length: board.n }, (_, j) => (j === k ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------
// Links (SPEC 6.6). A state names only what the link changes: the board, and the fields of the item.
// ---------------------------------------------------------------------------------------------

function link(tool: ToolId, board: string, fields: Omit<Partial<ToolState>, 'schema' | 'tool' | 'board'>, text: string): ToolLink {
  const state: ToolState = { schema: 1, tool, board, ...fields };
  return { tool, query: encodeState(state), text };
}

// ---------------------------------------------------------------------------------------------
// The notes of 2.9 and 2.10
// ---------------------------------------------------------------------------------------------

function wildbergerNote(letter: string, rank: number, name: string): WildbergerNote {
  const lettersExchanged = letter === 'B' || letter === 'C';
  if ((letter === 'B' || letter === 'C') && rank === 2) return { row: 'same', hisName: name, lettersExchanged };
  if (letter === 'B') return { row: 'reversed', hisName: `C${rank}`, lettersExchanged };
  if (letter === 'C') return { row: 'reversed', hisName: `B${rank}`, lettersExchanged };
  if (letter === 'F') return { row: 'reversed', hisName: name, lettersExchanged };
  if (letter === 'G') return { row: 'same', hisName: name, lettersExchanged };
  if (letter === 'D') return { row: 'D', hisName: name, lettersExchanged };
  if (letter === 'E' && rank <= 7) return { row: 'E', hisName: name, lettersExchanged };
  return { row: 'none', hisName: null, lettersExchanged };
}

// ---------------------------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------------------------

/**
 * Computes every item of the Atlas page of one of the 32 named finite types with the engine. Throws
 * RangeError for any other name (the Atlas has no other pages).
 */
export function atlasData(name: string): AtlasSheet {
  if (!isAtlasBoard(name)) throw new RangeError(`atlasData: ${JSON.stringify(name)} is not one of the 32 boards of the Atlas`);
  const board = boardFromName(name) as Board<number>;
  const n = board.n;
  const letter = name[0]!;
  const labels = positionsByLabel(board).map((p) => board.labels[p]!);
  const byLabel = (positions: readonly number[]): number[] => toLabels(board, positions).sort((a, b) => a - b);

  // 1, 2. The Cartan matrix, its transpose (2.9), the roads.
  const cartan = matrixInLabelOrder(board, cartanNumbers(board));
  const cartanTransposed = matrixInLabelOrder(board, cartanNumbers(transposeBoard(board)));
  const roadCounts = matrixInLabelOrder(board, adjacency(board));

  // 3. The weights d_i.
  const d = symmetrizer(board);
  if (d === null) throw new Error(`atlasData: ${name} has no weights`);

  // 4. Roots: all of them counted, the positive ones listed (sorted by total, then lexicographically).
  const all = roots(board, CAPS.mainThreadItems);
  if (all.truncated) throw new Error(`atlasData: the roots of ${name} were cut off`);
  const positive = positiveRoots(board);
  const listed = positive.slice(0, ROOT_LIST_CAP).map((p) => ints(vectorInLabelOrder(board, p)));

  // 5. Highest roots and their numbers a = C p.
  const theta = highestRoot(board);
  const short = highestShortRoot(board);

  // 6, 7, 8. Exponents from the game from all ones (lowest node first, E-5), h, |W|.
  const ones = Array.from({ length: n }, () => 1);
  const game = play(board, ones);
  if (game.status !== 'ended') throw new Error(`atlasData: the game from all ones on ${name} did not end`);
  const exponents = exponentsFromFired(ints(game.fired), n);
  const h = coxeterNumber(board);
  const W = weylOrder(board);

  // 9, 10, 11. det C, minuscule nodes, -w0 (images of the nodes, in label order).
  const det = determinant(board.cartan);
  const minuscule = byLabel(minusculeNodes(board));
  const images = minusW0(board);
  const minusW0Labels = positionsByLabel(board).map((p) => toLabels(board, [images[p]!])[0]!);

  // 12. Orbit sizes of the fundamental weights, node by node in label order.
  const orbitSizes = positionsByLabel(board).map((p) => orbitSize(board, unit(board, p)));

  // 13. Complete games from all ones, where the group has at most CAPS.countGamesGroup elements (5.6).
  const completeGames = W <= CAPS.countGamesGroup ? countCompleteGames(board) : null;

  // 14. Ring sizes in the Coxeter plane; rank 1 has no Coxeter plane, so the function is not called.
  const rings = n >= 2 ? coxeterPlaneRings(board).rings.map(([r, k]) => [r, k] as [number, number]) : null;

  // 15. The affine board (trap 3: built from this board, never from the name of the affine board).
  const ext = affineExtension(board);
  const affineName = identifyAffine(ext.board);
  if (affineName === null || ext.board.name === undefined) throw new Error(`atlasData: the affine board of ${name} has no name`);
  const affinePositions = positionsByLabel(ext.board);

  // 16. Real forms: the Satake catalogue of the board, in catalogue order (6.4), with labels.
  const realForms: RealFormLine[] = satakeCatalogue(name).map((e) => {
    const black = byLabel(e.black_nodes);
    const tau = positionsByLabel(board).map((p) => toLabels(board, [e.tau[p]!])[0]!);
    return {
      cartanLabel: e.cartan_label,
      realForm: e.real_form,
      black,
      tau,
      restrictedTypeDisplay: e.restricted_type_display,
      link: link('satake', name, { black, tau }, `Open the real form ${e.real_form} (${e.cartan_label}) in the Satake Studio`),
    };
  });

  const weyl = WEYL_BOARDS.includes(name);
  const omega1 = unit(board, positionsByLabel(board)[0]!);
  const numbersOfTheta = ints(vectorInLabelOrder(board, toNumbers(board, theta)));
  const links: Record<ItemId, ToolLink | null> = {
    cartan: link('board', name, {}, `Play both games on ${name} in the Game Board`),
    roads: link('board', name, {}, `See the roads of ${name} on the Game Board`),
    weights: link('form', name, {}, `Find the weights of ${name} in the Form Finder`),
    roots: link('garden', name, {}, `Grow the root populations of ${name} from the single Martians in the Orbit Garden`),
    'highest-roots': link('kostant', name, {}, `Play Kostant's game on ${name}: it ends at a highest root`),
    exponents: link('numbers', name, {}, `Play the numbers game on ${name} in the Numbers Game Lab; its Tally tab reads the exponents off the numbers fired`),
    'coxeter-number': link('numbers', name, {}, `Open the Numbers Game Lab on ${name} and choose its Wave tab to count the rounds`),
    'weyl-order': weyl
      ? link('weyl', name, {}, `See every element of the group of ${name} in the Weyl Explorer`)
      : link('numbers', name, {}, `Play the numbers game on ${name} in the Numbers Game Lab; its Tally tab gives the exponents, and the group order is the product of the exponents plus one`),
    'det-cartan': link('board', name, { view: 'linked' }, `See a = Cp at work on ${name} in the linked view of the Game Board`),
    'minuscule-nodes':
      minuscule.length > 0
        ? link('rep', name, { node: minuscule[0]! }, `Build the representation of node ${minuscule[0]} of ${name} in the Representation Builder`)
        : link('rep', name, {}, `Open the Representation Builder on ${name}, where the construction fails at every node`),
    'minus-w0': link(
      'board',
      name,
      { view: 'numbers', mode: 'legal', coords: 'numbers', start: omega1 },
      `Play the numbers game on ${name} from the fundamental weight of node 1 in the Game Board; played to the end it stops at minus the weight of node ${minusW0Labels[0]}`,
    ),
    'orbit-sizes': link(
      'garden',
      name,
      { coords: 'numbers', start: omega1 },
      `Open the Orbit Garden on ${name} at the fundamental weight of node 1 and grow its orbit`,
    ),
    'complete-games': weyl
      ? link('weyl', name, {}, `Open the Weyl Explorer on ${name} and choose its counter`)
      : link('board', name, { view: 'numbers', mode: 'legal', coords: 'numbers', start: ones }, `Play a complete game from all ones on ${name} in the Game Board`),
    'coxeter-plane':
      rings === null
        ? null
        : link('geometry', name, { rings: numbersOfTheta, projection: 'coxeter' }, `See the roots of ${name} in the Coxeter plane in the Geometry Studio`),
    affine: link('affine', ext.board.name, {}, `Play on the affine board ${ext.board.name} in the Affine Playground`),
  };

  return {
    name,
    letter,
    rank: n,
    labels,
    cartan,
    cartanTransposed,
    adjacency: roadCounts,
    symmetrizer: vectorInLabelOrder(board, d),
    nRoots: all.items.length,
    nPositiveRoots: positive.length,
    positiveRoots: listed,
    highestRoot: ints(vectorInLabelOrder(board, theta)),
    numbersOfHighestRoot: numbersOfTheta,
    highestShortRoot: short === null ? null : ints(vectorInLabelOrder(board, short)),
    numbersOfHighestShortRoot: short === null ? null : ints(vectorInLabelOrder(board, toNumbers(board, short))),
    simplyLaced: short === null,
    exponents,
    coxeterNumber: h,
    weylOrder: W,
    detCartan: det,
    minusculeNodes: minuscule,
    minusW0: minusW0Labels,
    minusW0Identity: minusW0Labels.every((v, k) => v === labels[k]),
    fundamentalOrbitSizes: orbitSizes,
    completeGames,
    coxeterPlaneRings: rings,
    affine: {
      name: affineName,
      constructorName: ext.board.name,
      labels: affinePositions.map((p) => ext.board.labels[p]!),
      marks: vectorInLabelOrder(ext.board, ext.marks),
      comarks: vectorInLabelOrder(ext.board, ext.comarks),
    },
    realForms,
    links,
    wildberger: wildbergerNote(letter, n, name),
    kacNumbering: name === 'E6' || name === 'E7' || name === 'E8' || name === 'G2',
  };
}
