// T12, the Representation Builder: the computations of the tool, as pure functions with no DOM and no
// site library (SPEC.md 4 T12, 2.18, 2.7 F11, 5.4 "Representations", 5.6, E-5, E-7, E-9). Owner P5-A2.
// Every mathematical value comes from the engine: minusculeNodes, orbitSize, play, minusculeMatrices,
// signedMoves, chevalleySerre, orbitGraph, fire and stringThrough. This module only converts between
// labels and positions (toLabels and toPositions, E-7), looks records up by their fields, and writes the
// sentences. It imports the engine and the layered layout only, so that the registry entry can compute the
// captions in plain Node (site/tests/e2e/registry-outs.spec.ts loads it); t12/model.ts adds the state, the
// links and the routing of E-9 (each call's hint goes through whereToRun before the call is made).
import {
  CAPS,
  EngineOverflow,
  cartanNumbers,
  chevalleySerre,
  fire,
  minusculeMatrices,
  minusculeNodes,
  orbitGraph,
  orbitSize,
  play,
  signedMoves,
  stringThrough,
  toLabels,
  toPositions,
} from '@two-games/engine';
import type { AnyBoard, Board, RelationCheck, SparseMatrix } from '@two-games/engine';
import { layeredLayout } from '../../draw/layeredLayout';

/** The true minus sign of SPEC 6.3. */
export const MINUS = '−';

/** The six relation codes of SPEC 5.2, in the order of the picker. */
export const RELATIONS = ['hh', 'he', 'hf', 'ef', 'serre-e', 'serre-f'] as const;
export type RelationCode = (typeof RELATIONS)[number];

/** The phrase SPEC 4 T12's acceptance asks for on node 2 of D4, with its number. */
export const someNumberPhrase = (m: number | string): string => `some number in the orbit is ${m}`;

/**
 * The bound on the positions drawn as a graph (plan, borrowed from T2's 300 of SPEC 5.6, "every vertex and
 * edge drawn up to 300"): above it the orbit is shown as the sizes of its layers. The same bound limits the
 * rows of a list of matrix entries and of the orbit table (plan): every minuscule orbit (at most 256
 * positions, B8 node 8) is listed in full.
 */
export const DRAW_MAX = CAPS.gardenDrawEverything;

/** At most this many positions of a string are listed; above, the first and last six with a count (plan). */
export const STRING_SHOWN_MAX = 12;

/** The number of records of the relation list on a board of rank n: 6n^2 - 2n (the engine's list, SPEC 2.18). */
export const relationCount = (n: number): number => 6 * n * n - 2 * n;

/**
 * The largest work, positions times relation records, of a relation list (chevalleySerre) computed on the
 * main thread (plan, measured; decisions/P5-A2.md). chevalleySerre is not an enumeration of E-9 rule 1, and
 * its work grows with the size of the orbit times the number of records (B8 node 5, 1792 positions, 368
 * records: about 420 ms in Node here), so SPEC 7.6 ("No engine call on the main thread may become a long
 * task") bounds it, not the 2000 items of E-9. Measured in Chromium with the processor slowed four times, on
 * the first call after a pick (the step that computes the list and redraws its verdict): about 6 µs a unit
 * of work plus 10 ms, so E6 node 1 (27 positions, 204 records, 5508 units) took 37 to 55 ms and A8 node 1
 * (9 positions, 368 records, 3312 units) 27 to 50 ms, at or over the budget of 50 ms. The bound 2500 sends
 * E6 nodes 1 and 6 and every list of rank 8 to the worker and keeps every list of at most 2500 units, the
 * largest D6 node 1 (12 by 204 = 2448), on the main thread, about 25 ms at four times slower.
 * minusculeMatrices, signedMoves and orbitGraph stay on the main thread up to 2000 positions, as E-9 rule 1
 * says.
 */
export const RELATIONS_MAIN_WORK = 2500;

/** The work of the relation list of an orbit: its positions times the number of records. */
export const relationWork = (orbitSize: number, n: number): number => orbitSize * relationCount(n);

/** Whether the relation list of an orbit of this size on a board of rank n is computed on the main thread. */
export const relationsOnMain = (orbitSize: number, n: number): boolean => relationWork(orbitSize, n) <= RELATIONS_MAIN_WORK;

/** relationsOnMain for a representation. */
export const listOnMain = (rep: Representation): boolean => relationsOnMain(rep.orbitSize, rep.board.n);

// ---------------------------------------------------------------------------------------------
// E-9: every enumeration and play is announced with its hint before it is made
// ---------------------------------------------------------------------------------------------

/** The hint of one engine call (the shape of CallHint in site/src/lib/worker.ts). */
export interface RepHint {
  board: AnyBoard;
  kind: 'enumeration' | 'play' | 'other';
  expectedItems?: number;
  finiteKnown?: boolean;
}

/**
 * Called with each engine call's name and hint just before the call is made (model.ts passes a check
 * through whereToRun, which throws unless the call belongs on the main thread). In Node, at build time,
 * nothing needs routing (E-9: "every call runs in-process").
 */
export type Route = (fn: string, hint: RepHint) => void;
const noRoute: Route = () => undefined;

/** The engine functions buildRepresentation calls (injectable so that a test can count the calls). */
export interface RepEngine {
  minusculeNodes: (board: AnyBoard) => number[];
  orbitSize: (board: AnyBoard, a: readonly number[]) => number;
  play: (board: AnyBoard, a: readonly number[]) => { fired: readonly unknown[]; moves: number };
  minusculeMatrices: (
    board: AnyBoard,
    i: number,
    cap?: number,
  ) => { basis: number[][]; E: SparseMatrix[]; F: SparseMatrix[]; H: SparseMatrix[]; moves: SparseMatrix[] } | null;
  signedMoves: (basis: readonly (readonly number[])[], E: readonly SparseMatrix[], F: readonly SparseMatrix[]) => SparseMatrix[];
  chevalleySerre: (board: AnyBoard, E: readonly SparseMatrix[], F: readonly SparseMatrix[], H: readonly SparseMatrix[]) => RelationCheck[];
}

export const REP_ENGINE: RepEngine = {
  minusculeNodes: (b) => minusculeNodes(b),
  orbitSize: (b, a) => orbitSize(b, a),
  play: (b, a) => play(b as Board<number>, a),
  minusculeMatrices: (b, i, cap) => minusculeMatrices(b, i, cap),
  signedMoves: (basis, E, F) => signedMoves(basis, E, F),
  chevalleySerre: (b, E, F, H) => chevalleySerre(b, E, F, H),
};

/** The hint of an enumeration whose size is known in advance (E-9 rule 1: from phase 3, orbitSize). */
export const enumerationHint = (board: AnyBoard, expectedItems: number): RepHint => ({ board, kind: 'enumeration', expectedItems, finiteKnown: true });

/** The hint of a legal play on a finite-type board (E-9 rule 2: main, at most N moves). */
export const playHint = (board: AnyBoard): RepHint => ({ board, kind: 'play', finiteKnown: true });

// ---------------------------------------------------------------------------------------------
// Labels and positions (E-7)
// ---------------------------------------------------------------------------------------------

/** The labels of a board in increasing order: the order of `start` and of every vector shown. */
export function labelOrder(board: AnyBoard): number[] {
  return [...board.labels].sort((a, b) => a - b);
}

/** The position of the node with this label (RangeError on a label that is not on the board). */
export function positionOf(board: AnyBoard, label: number): number {
  return toPositions(board, [label])[0]!;
}

/** The label of the node at this position. */
export function labelOf(board: AnyBoard, position: number): number {
  return toLabels(board, [position])[0]!;
}

/** A vector indexed by position, rearranged in label order. */
export function inLabelOrder<V>(board: AnyBoard, v: readonly V[]): V[] {
  return toPositions(board, labelOrder(board)).map((p) => v[p]!);
}

/** A vector given in label order, rearranged by position. */
export function byPosition<V>(board: AnyBoard, v: readonly V[]): V[] {
  const out: V[] = new Array<V>(board.n);
  toPositions(board, labelOrder(board)).forEach((p, k) => {
    out[p] = v[k]!;
  });
  return out;
}

/** One entry with a true minus sign (6.3). */
export function signed(x: number | bigint | string): string {
  const t = String(x);
  return t.startsWith('-') ? `${MINUS}${t.slice(1)}` : t;
}

/** A position written as on screen: "(1, 0)", "(−1, 1)", entries in the order given. */
export function positionText(v: readonly (number | bigint | string)[]): string {
  return `(${v.map(signed).join(', ')})`;
}

/** The unit vector omega_i at a position, in numbers (the fundamental weight, SPEC 2.18). */
export function omega(board: AnyBoard, position: number): number[] {
  return Array.from({ length: board.n }, (_, k) => (k === position ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------
// The representation of one node (SPEC 4 T12 first paragraph; 2.18; 5.6)
// ---------------------------------------------------------------------------------------------

export interface Representation {
  /** Which recipe of 2.18 built it; phase 7 adds 'one-zero-weight' (orbitPlusZeroMatrices) beside it. */
  construction: 'minuscule';
  board: AnyBoard;
  /** The board's name (the name the reader chose, D19). */
  name: string;
  /** The node, as a label (E-7) and as a position. */
  node: number;
  position: number;
  /** minusculeNodes(board) holds the position (F11): the verdict, never read off the relation list. */
  minuscule: boolean;
  /** The board has a minuscule node at all (E8, F4 and G2 have none). */
  boardHasMinuscule: boolean;
  /** orbitSize(board, omega_i): the number of positions, known without an enumeration. */
  orbitSize: number;
  /** orbitSize is at most CAPS.repOrbit (2000), so the matrices are built (5.6). */
  built: boolean;
  /**
   * F11's third condition: in the legal play from omega_i the first number fired that is greater than 1,
   * with the move that fires it (1-based), or null when every number fired is 1 (a minuscule node).
   */
  firstLarge: { value: number; move: number } | null;
  /** The orbit in decreasing lexicographic order (E-5): row and column r of every matrix belong to basis[r]. */
  basis: number[][] | null;
  E: SparseMatrix[] | null;
  F: SparseMatrix[] | null;
  H: SparseMatrix[] | null;
  /** The firing moves as permutation matrices, and their signed versions E_k - F_k + P_k^0. */
  moves: SparseMatrix[] | null;
  signed: SparseMatrix[] | null;
  /** The signed moves computed so far, one node per task (addSignedMoves with a node), until all are. */
  signedPart: (SparseMatrix | null)[] | null;
  /**
   * Every Chevalley-Serre relation with both sides, in the engine's order (looked up by fields only); null
   * until computed when the list is computed later, in the worker (relations: 'later').
   */
  checks: RelationCheck[] | null;
}

/**
 * The relation list of a configured state as the server computed it, shipped in the page so that hydration
 * computes no relation list (SPEC 7.6; decisions/P5-A2.md): the number of records and of failing ones, and
 * the relation shown with its verdict and its two sides as [row, column, value] (0-based, decimal text).
 */
export interface RelationDigest {
  board: string;
  node: number;
  code: string;
  holds: boolean;
  total: number;
  failing: number;
  left: [number, number, string][];
  right: [number, number, string][];
}

/** The digest of the relation `code` of a representation whose list is computed (null otherwise). */
export function relationDigest(rep: Representation, code: string): RelationDigest | null {
  if (rep.checks === null) return null;
  const c = findRelation(rep.checks, rep.board, code);
  if (c === null) return null;
  const side = (m: SparseMatrix): [number, number, string][] => entryList(m).map(([r, k, v]) => [r - 1, k - 1, v.toString()]);
  return { board: rep.name, node: rep.node, code, holds: c.holds, total: rep.checks.length, failing: rep.checks.filter((x) => !x.holds).length, left: side(c.left), right: side(c.right) };
}

/** A sparse matrix from the [row, column, value] list of a digest. */
function digestMatrix(entries: readonly [number, number, string][]): SparseMatrix {
  return new Map(entries.map(([r, c, v]) => [`${r},${c}`, BigInt(v)]));
}

/** The relation shown and its two sides: from the list when computed, else from the digest of the same relation. */
export interface ShownCheck {
  holds: boolean;
  left: SparseMatrix;
  right: SparseMatrix;
}

const digestChecks = new WeakMap<RelationDigest, ShownCheck>();

/** The digest when it describes this representation (its board and node), else null. */
const digestOf = (rep: Representation, digest: RelationDigest | null): RelationDigest | null =>
  digest !== null && digest.board === rep.name && digest.node === rep.node ? digest : null;

/** The relation `code` with its sides, from the list when it is computed, else from a digest of that relation. */
export function shownCheck(rep: Representation, code: string, digest: RelationDigest | null = null): ShownCheck | null {
  if (rep.checks !== null) return findRelation(rep.checks, rep.board, code);
  const d = digestOf(rep, digest);
  if (d === null || d.code !== code) return null;
  let c = digestChecks.get(d);
  if (c === undefined) {
    c = { holds: d.holds, left: digestMatrix(d.left), right: digestMatrix(d.right) };
    digestChecks.set(d, c);
  }
  return c;
}

/** The number of relation records and of failing ones: from the list, else from a digest, else null. */
export function relationTally(rep: Representation, digest: RelationDigest | null = null): { total: number; failing: number } | null {
  if (rep.checks !== null) return { total: rep.checks.length, failing: rep.checks.filter((c) => !c.holds).length };
  const d = digestOf(rep, digest);
  return d === null ? null : { total: d.total, failing: d.failing };
}

/**
 * Builds the representation of the node with label `nodeLabel` on a named finite board, deciding in this
 * order without running an enumeration into a cap (SPEC 5.6 last sentence; E-9 rule 1): `minuscule` from
 * minusculeNodes; the size from orbitSize(board, omega_i); the explanation's number from legal play
 * (F11's third condition, no enumeration); then, only when the size is at most CAPS.repOrbit,
 * minusculeMatrices (with that cap), signedMoves and, with `relations: 'now'` (the default), chevalleySerre.
 * Above the cap nothing is enumerated: "the tool shows the explanation alone" (SPEC 4 T12). With
 * `relations: 'later'` the caller computes the relation list itself (in the worker, RELATIONS_MAIN_WORK).
 */
export function buildRepresentation(
  board: AnyBoard,
  nodeLabel: number,
  opts: { engine?: RepEngine; route?: Route; relations?: 'now' | 'later' | 'auto' } = {},
): Representation {
  const rep = startRepresentation(board, nodeLabel, opts);
  if (!rep.built) return rep;
  addMatrices(rep, opts);
  addSignedMoves(rep, opts);
  const when = opts.relations ?? 'now';
  if (when === 'now' || (when === 'auto' && listOnMain(rep))) addRelations(rep, opts);
  return rep;
}

/**
 * The steps of buildRepresentation, which the tool runs one per task after a pick (SPEC 7.6): the first
 * decides (minusculeNodes, orbitSize, legal play from omega_i), the others enumerate and compute.
 */
export function startRepresentation(board: AnyBoard, nodeLabel: number, opts: { engine?: RepEngine; route?: Route } = {}): Representation {
  const engine = opts.engine ?? REP_ENGINE;
  const route = opts.route ?? noRoute;
  if (board.name === undefined) throw new RangeError('T12 builds representations on named boards only');
  const position = positionOf(board, nodeLabel);
  const nodes = engine === REP_ENGINE ? minusculeOf(board) : engine.minusculeNodes(board);
  const minuscule = nodes.includes(position);
  const w = omega(board, position);
  const size = engine.orbitSize(board, w);
  route('play', playHint(board));
  const fired = engine.play(board, w).fired.map((x) => Number(x));
  const at = fired.findIndex((x) => x > 1);
  const firstLarge = at < 0 ? null : { value: fired[at]!, move: at + 1 };
  if (minuscule !== (firstLarge === null)) {
    throw new Error(`minusculeNodes and the numbers fired from omega_${nodeLabel} on ${board.name} disagree (F11)`);
  }
  const rep: Representation = {
    construction: 'minuscule',
    board,
    name: board.name,
    node: nodeLabel,
    position,
    minuscule,
    boardHasMinuscule: nodes.length > 0,
    orbitSize: size,
    built: size <= CAPS.repOrbit,
    firstLarge,
    basis: null,
    E: null,
    F: null,
    H: null,
    moves: null,
    signed: null,
    signedPart: null,
    checks: null,
  };
  return rep;
}

/** Step 2: the basis and E, F, H and the moves (minusculeMatrices, CAPS.repOrbit), when the orbit is built. */
export function addMatrices(rep: Representation, opts: { engine?: RepEngine; route?: Route } = {}): void {
  if (!rep.built || rep.basis !== null) return;
  const engine = opts.engine ?? REP_ENGINE;
  const size = rep.orbitSize;
  (opts.route ?? noRoute)('minusculeMatrices', enumerationHint(rep.board, size));
  const m = engine.minusculeMatrices(rep.board, rep.position, CAPS.repOrbit);
  if (m === null) throw new Error(`minusculeMatrices found more than ${CAPS.repOrbit} positions where orbitSize gave ${size}`);
  if (m.basis.length !== size) throw new Error(`minusculeMatrices found ${m.basis.length} positions where orbitSize gave ${size}`);
  rep.basis = m.basis;
  rep.E = m.E;
  rep.F = m.F;
  rep.H = m.H;
  rep.moves = m.moves;
}

/**
 * Step 3: the signed moves E_k - F_k + P_k^0 (signedMoves), for every node at once, or with `only` (a
 * position) for that node alone, so that a large orbit spends one task per node (SPEC 7.6; decisions/P5-A2.md).
 * For one node the engine is called with E_k and F_k alone and each basis vector cut to its entry at k,
 * which is all that P_k^0 reads (signedMoves of the engine takes the k-th matrices with the k-th entries).
 */
export function addSignedMoves(rep: Representation, opts: { engine?: RepEngine; route?: Route } = {}, only?: number): void {
  if (rep.basis === null || rep.signed !== null) return;
  const engine = opts.engine ?? REP_ENGINE;
  (opts.route ?? noRoute)('signedMoves', enumerationHint(rep.board, rep.orbitSize));
  if (only === undefined) {
    rep.signed = engine.signedMoves(rep.basis, rep.E!, rep.F!);
    rep.signedPart = null;
    return;
  }
  const part = (rep.signedPart ??= Array.from({ length: rep.board.n }, () => null));
  if (part[only] === null) {
    const column = rep.basis.map((v) => [v[only]!]);
    part[only] = engine.signedMoves(column, [rep.E![only]!], [rep.F![only]!])[0]!;
  }
  if (part.every((m) => m !== null)) {
    rep.signed = part as SparseMatrix[];
    rep.signedPart = null;
  }
}

/** Step 4: every relation with both sides (chevalleySerre), on the thread the caller is on. */
export function addRelations(rep: Representation, opts: { engine?: RepEngine; route?: Route } = {}): void {
  if (rep.basis === null || rep.checks !== null) return;
  const engine = opts.engine ?? REP_ENGINE;
  (opts.route ?? noRoute)('chevalleySerre', enumerationHint(rep.board, rep.orbitSize));
  rep.checks = engine.chevalleySerre(rep.board, rep.E!, rep.F!, rep.H!);
}

/** The dimension shown (data-out="dimension"): the size of the basis, which equals the orbit's size. */
export function dimensionOf(rep: Representation): number {
  return rep.basis?.length ?? rep.orbitSize;
}

const minusculeByName = new Map<string, number[]>();

/** minusculeNodes of a named board, computed once per name (boards are immutable, E-11; a name fixes the board). */
export function minusculeOf(board: AnyBoard): number[] {
  if (board.name === undefined) return minusculeNodes(board);
  let known = minusculeByName.get(board.name);
  if (known === undefined) {
    known = minusculeNodes(board);
    minusculeByName.set(board.name, known);
  }
  return [...known];
}

/** The default node of a board (plan): its smallest minuscule label, else label 1 (the first label). */
export function defaultNode(board: AnyBoard): number {
  const minuscule = minusculeOf(board);
  if (minuscule.length === 0) return labelOrder(board)[0]!;
  return Math.min(...toLabels(board, minuscule));
}

// ---------------------------------------------------------------------------------------------
// The explanation (SPEC 4 T12 acceptance; 2.18; F11's third condition)
// ---------------------------------------------------------------------------------------------

/** "ω1": the fundamental weight of a node label. */
export const omegaName = (label: number): string => `ω${label}`;

/**
 * The sentence of data-out="explanation" (plan wording): for a node that is not minuscule it carries the
 * number found by legal play from omega_i, "some number in the orbit is 2" on node 2 of D4.
 */
export function explanation(rep: Representation): string {
  const i = rep.node;
  if (rep.minuscule) return `Node ${i} is minuscule: every number in the orbit of ${omegaName(i)} is ${MINUS}1, 0 or 1, and all the relations hold.`;
  const { value, move } = rep.firstLarge!;
  const head = `Node ${i} is not minuscule: ${someNumberPhrase(value)} (legal play from ${omegaName(i)} fires a ${value} at move ${move})`;
  return rep.built ? `${head}, so the steps E and F of the recipe miss some moves and the relations fail.` : `${head}, so the steps E and F of the recipe would miss some moves.`;
}

/**
 * For a board with no minuscule node (E8, F4, G2), or null: what the recipe of this tool builds there,
 * none of the representations. Not that they all need more than the game: SPEC 2.18 "One zero weight"
 * builds the 7 of G2 from the game, and its [D] "need more than the game" is for the representations out
 * of reach of both recipes (RT-FIX P5-RT-08-05).
 */
export function noMinusculeSentence(rep: Representation): string | null {
  return rep.boardHasMinuscule ? null : 'This board has no minuscule node, so the recipe of this tool builds none of its representations.';
}

/** The stated limit of 4.0 and 5.6 above 2000 positions (data-out="limit"), or null when the matrices are built. */
export function limitSentence(rep: Representation): string | null {
  if (rep.built) return null;
  return `The orbit of ${omegaName(rep.node)} has ${rep.orbitSize} positions, more than ${CAPS.repOrbit}, so the matrices are not built here.`;
}

// ---------------------------------------------------------------------------------------------
// Relations: codes with labels (6.6 `q`) and RelationCheck with positions (5.2)
// ---------------------------------------------------------------------------------------------

export interface RelationRef {
  relation: RelationCode;
  /** Positions (E-7: the engine's RelationCheck.i and .j). */
  i: number;
  j: number;
}

const CODE = /^(hh|he|hf|ef|serre-e|serre-f):(\d+),(\d+)$/;

export const isSerre = (r: RelationCode): boolean => r === 'serre-e' || r === 'serre-f';

/** The labels of a relation's two nodes (E-7: positions in RelationRef, labels on screen; toLabels only). */
export function relationLabels(board: AnyBoard, r: { i: number; j: number }): readonly [number, number] {
  const [i, j] = toLabels(board, [r.i, r.j]) as [number, number];
  return [i, j];
}

/** The 6.6 code of a relation: "ef:1,2", labels always both written (plan). */
export function relationCode(board: AnyBoard, r: RelationRef): string {
  const [i, j] = relationLabels(board, r);
  return `${r.relation}:${i},${j}`;
}

/**
 * A code of 6.6 to a relation in positions, or null when it is not one the board has: an unknown code, a
 * label that is not on the board, or a Serre relation with equal nodes (2.18: "i != j").
 */
export function parseRelationCode(board: AnyBoard, code: string): RelationRef | null {
  const m = CODE.exec(code);
  if (m === null) return null;
  const li = Number(m[2]);
  const lj = Number(m[3]);
  if (!board.labels.includes(li) || !board.labels.includes(lj)) return null;
  const relation = m[1] as RelationCode;
  const [i, j] = toPositions(board, [li, lj]) as [number, number];
  if (isSerre(relation) && i === j) return null;
  return { relation, i, j };
}

/** The check of a code, found by its fields (never by index into the engine's list), or null. */
export function findRelation(checks: readonly RelationCheck[], board: AnyBoard, code: string): RelationCheck | null {
  const r = parseRelationCode(board, code);
  if (r === null) return null;
  return checks.find((c) => c.relation === r.relation && c.i === r.i && c.j === r.j) ?? null;
}

/** The first check that fails, in the engine's order, or null. */
export function firstFailing(checks: readonly RelationCheck[]): RelationCheck | null {
  return checks.find((c) => !c.holds) ?? null;
}

/** The relation [E_i, F_i] = H_i of the representation's own node, the default before any list is known. */
export const ownRelation = (rep: Representation): string => `ef:${rep.node},${rep.node}`;

/**
 * The default relation of a representation (plan): [E_i, F_i] = H_i for a minuscule node, for a node whose
 * matrices are not built, and for an orbit whose relation list is computed in the worker (work above
 * RELATIONS_MAIN_WORK, so that the default never waits for the worker; when that list arrives and the reader
 * has picked no relation, the tool moves to the first failing check, failingDefault); otherwise, for a node
 * that is not minuscule, the first failing check in the engine's order, so that the tool shows a failing
 * relation on load (ef:1,1 on node 2 of D4).
 */
export function defaultRelation(rep: Representation): string {
  const own = ownRelation(rep);
  if (rep.minuscule || !rep.built || !listOnMain(rep)) return own;
  if (rep.checks === null) throw new Error('the relations of a list within RELATIONS_MAIN_WORK are computed with it');
  const f = firstFailing(rep.checks);
  return f === null ? own : relationCode(rep.board, f);
}

/**
 * The relation to move to when a list computed later (in the worker) arrives while the default [E_i, F_i] =
 * H_i of a node that is not minuscule is shown and the reader has picked none: the first failing check, so
 * that the tool shows the failure (SPEC 4 T12); null when nothing should move.
 */
export function failingDefault(rep: Representation, shown: string): string | null {
  if (rep.minuscule || rep.checks === null || shown !== ownRelation(rep)) return null;
  const f = firstFailing(rep.checks);
  return f === null ? null : relationCode(rep.board, f);
}

/** The summary line (data-out="all-relations", plan): "All 20 relations hold." or "10 of 88 relations fail." */
export function relationSummary(checks: readonly RelationCheck[] | { total: number; failing: number }): string {
  const { total, failing } = Array.isArray(checks) ? { total: checks.length, failing: checks.filter((c) => !c.holds).length } : (checks as { total: number; failing: number });
  if (failing === 0) return `All ${total} relations hold.`;
  return `${failing} of ${total} relations ${failing === 1 ? 'fails' : 'fail'}.`;
}

/** The parts of a relation's formula: labels for the subscripts, C_ij and the exponent 1 - C_ij evaluated. */
export interface RelationParts {
  relation: RelationCode;
  /** Labels (E-7: subscripts are labels). */
  i: number;
  j: number;
  /** C_ij of the board (the Cartan matrix in positions, read through cartanNumbers). */
  cij: number;
  /** 1 - C_ij for the Serre relations, else null. */
  exponent: number | null;
}

export function relationParts(board: AnyBoard, code: string): RelationParts | null {
  const r = parseRelationCode(board, code);
  if (r === null) return null;
  const cij = cartanNumbers(board)[r.i]![r.j]!;
  return { relation: r.relation, i: labelOf(board, r.i), j: labelOf(board, r.j), cij, exponent: isSerre(r.relation) ? 1 - cij : null };
}

/** One side of a formula as terms: [letter, subscript] pairs with a coefficient, or zero. */
export interface FormulaSide {
  kind: 'bracket' | 'term' | 'zero' | 'ad';
  /** bracket: [X_a, Y_b]; term: coeff X_a; ad: ad(X_a)^exponent Y_b. */
  x?: { letter: string; sub: number };
  y?: { letter: string; sub: number };
  coeff?: number;
  exponent?: number;
}

/** The two sides of the formula of a relation, with C_ij substituted (plan: "[H1, E2] = −E2" on A2). */
export function formulaSides(p: RelationParts): { left: FormulaSide; right: FormulaSide } {
  const X = (letter: string, sub: number) => ({ letter, sub });
  const term = (coeff: number, letter: string, sub: number): FormulaSide => (coeff === 0 ? { kind: 'zero' } : { kind: 'term', coeff, x: X(letter, sub) });
  switch (p.relation) {
    case 'hh':
      return { left: { kind: 'bracket', x: X('H', p.i), y: X('H', p.j) }, right: { kind: 'zero' } };
    case 'he':
      return { left: { kind: 'bracket', x: X('H', p.i), y: X('E', p.j) }, right: term(p.cij, 'E', p.j) };
    case 'hf':
      return { left: { kind: 'bracket', x: X('H', p.i), y: X('F', p.j) }, right: term(-p.cij, 'F', p.j) };
    case 'ef':
      return { left: { kind: 'bracket', x: X('E', p.i), y: X('F', p.j) }, right: p.i === p.j ? term(1, 'H', p.i) : { kind: 'zero' } };
    case 'serre-e':
      return { left: { kind: 'ad', x: X('E', p.i), y: X('E', p.j), exponent: p.exponent! }, right: { kind: 'zero' } };
    case 'serre-f':
      return { left: { kind: 'ad', x: X('F', p.i), y: X('F', p.j), exponent: p.exponent! }, right: { kind: 'zero' } };
  }
}

function sideText(s: FormulaSide): string {
  const v = (x: { letter: string; sub: number }): string => `${x.letter}${x.sub}`;
  switch (s.kind) {
    case 'zero':
      return '0';
    case 'bracket':
      return `[${v(s.x!)}, ${v(s.y!)}]`;
    case 'term':
      return `${s.coeff === 1 ? '' : s.coeff === -1 ? MINUS : signed(s.coeff!)}${v(s.x!)}`;
    case 'ad':
      return `ad(${v(s.x!)})${s.exponent === 1 ? '' : `^${s.exponent}`} ${v(s.y!)}`;
  }
}

function sideSpoken(s: FormulaSide): string {
  const v = (x: { letter: string; sub: number }): string => `${x.letter} ${x.sub}`;
  switch (s.kind) {
    case 'zero':
      return '0';
    case 'bracket':
      return `${v(s.x!)} ${v(s.y!)} commutator`;
    case 'term':
      return `${s.coeff === 1 ? '' : s.coeff === -1 ? 'minus ' : s.coeff! < 0 ? `minus ${-s.coeff!} ` : `${s.coeff} `}${v(s.x!)}`;
    case 'ad':
      return `ad ${v(s.x!)}${s.exponent === 1 ? '' : ` to the power ${s.exponent}`} applied to ${v(s.y!)}`;
  }
}

/** The relation as plain text with a true minus sign: "[E1, F1] = H1", "ad(E1)^2 E2 = 0". */
export function relationText(p: RelationParts): string {
  const { left, right } = formulaSides(p);
  return `${sideText(left)} = ${sideText(right)}`;
}

/** The accessible name of the formula (plan): "E 1 F 1 commutator equals H 1". */
export function relationSpoken(p: RelationParts): string {
  const { left, right } = formulaSides(p);
  return `${sideSpoken(left)} equals ${sideSpoken(right)}`;
}

/** The six relations as the picker names them (plan; plain text, the formula is shown beside it). */
export const RELATION_NAMES: Readonly<Record<RelationCode, string>> = {
  hh: `[H, H] = 0`,
  he: `[H, E] = C E`,
  hf: `[H, F] = ${MINUS}C F`,
  ef: `[E, F] = H or 0`,
  'serre-e': `Serre relation for E`,
  'serre-f': `Serre relation for F`,
};

// ---------------------------------------------------------------------------------------------
// Matrices (5.4 the basis; 5.6 grids up to 27)
// ---------------------------------------------------------------------------------------------

/** "grid" up to CAPS.matrixGridDim (27, inclusive: the 27 of E6), "list" above (the 56 of E7). */
export function matrixFormat(dim: number): 'grid' | 'list' {
  return dim <= CAPS.matrixGridDim ? 'grid' : 'list';
}

const NO_HEADERS: readonly string[] = Object.freeze([]);
const headersOf = new WeakMap<object, readonly string[]>();

/**
 * The row and column headers of a matrix: the basis positions written with true minus signs. The same
 * array for the same basis, so that a drawn MatrixView keeps its table (and the one it took over from the
 * server) when the tool's state changes elsewhere: new headers would write every table again.
 */
export function basisHeaders(rep: Representation): readonly string[] {
  if (rep.basis === null) return NO_HEADERS;
  let h = headersOf.get(rep.basis);
  if (h === undefined) {
    h = Object.freeze(rep.basis.map((v) => positionText(inLabelOrder(rep.board, v))));
    headersOf.set(rep.basis, h);
  }
  return h;
}

/** A sparse matrix as [row, column, value] with 1-based basis indices, row-major (Download data, plan). */
export function entryList(m: SparseMatrix): [number, number, bigint][] {
  const out: [number, number, bigint][] = [];
  for (const [key, v] of m) {
    const [r, c] = key.split(',').map(Number) as [number, number];
    out.push([r + 1, c + 1, v]);
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// ---------------------------------------------------------------------------------------------
// The orbit in layers (SPEC 4 T12 bullet 1; 5.4 note on move graphs; 6.3 edge colours)
// ---------------------------------------------------------------------------------------------

export interface OrbitVertex {
  /** The key of the position: its entries by position joined by commas. */
  key: string;
  /** The entries by position. */
  values: number[];
  /** The layer: the number of moves from omega_i (orbitGraph's depth). */
  depth: number;
  /** Its index in the basis (0-based): row and column of the matrices. */
  basisIndex: number;
}

export interface OrbitEdge {
  /** Vertex indices: `from` is the end nearer omega_i (the higher weight), `to` is R_k from it. */
  from: number;
  to: number;
  /** The node k, as a label (the text on the edge) and as a position. */
  node: number;
  position: number;
  /** mu_k at the upper end: 1 on a minuscule orbit, where the edge is the entry of F_k; 2 or more otherwise. */
  value: number;
  /** True when value is 1: the edge is an entry of F_k (and its reverse of E_k). */
  step: boolean;
}

export interface OrbitLayers {
  vertices: OrbitVertex[];
  /** Every edge when `drawn`, else none. */
  edges: OrbitEdge[];
  /** The number of positions in each layer, layer 0 first. */
  layerSizes: number[];
  /** Every vertex and edge is drawn (at most DRAW_MAX positions); otherwise the layer sizes stand for the graph. */
  drawn: boolean;
}

/**
 * The orbit of omega_i in layers: orbitGraph from omega_i in the numbers game (cap CAPS.repOrbit; layer 0
 * is omega_i alone), and when the orbit is drawn, one edge between mu and R_k mu for every position mu and
 * node k with mu_k > 0 (each pair once: the end with mu_k > 0 is the end nearer omega_i). A node with
 * mu_k = 0 fixes mu and draws nothing. Only for a representation whose matrices are built.
 */
export function orbitLayers(rep: Representation, opts: { route?: Route } = {}): OrbitLayers {
  if (!rep.built || rep.basis === null) throw new RangeError('the orbit is drawn only when the matrices are built');
  const route = opts.route ?? noRoute;
  const board = rep.board as Board<number>;
  route('orbitGraph', enumerationHint(board, rep.orbitSize));
  const g = orbitGraph(board, [omega(board, rep.position)], 'firing', CAPS.repOrbit);
  if (g.truncated) throw new Error('the orbit of a built representation was truncated');
  const basisIndex = new Map<string, number>();
  rep.basis.forEach((v, r) => basisIndex.set(v.join(','), r));
  const vertices: OrbitVertex[] = g.items.map((item, v) => {
    const values = item.map((x) => Number(x));
    const key = values.join(',');
    return { key, values, depth: g.depth[v]!, basisIndex: basisIndex.get(key)! };
  });
  const layerSizes: number[] = [];
  for (const v of vertices) layerSizes[v.depth] = (layerSizes[v.depth] ?? 0) + 1;
  const drawn = vertices.length <= DRAW_MAX;
  const edges: OrbitEdge[] = [];
  if (drawn) {
    const index = new Map<string, number>();
    vertices.forEach((v, k) => index.set(v.key, k));
    vertices.forEach((v, k) => {
      for (let p = 0; p < board.n; p++) {
        const value = v.values[p]!;
        if (value <= 0) continue;
        const to = index.get(fire(board, v.values, p).join(','));
        if (to === undefined) throw new Error('a move left the orbit');
        edges.push({ from: k, to, node: labelOf(board, p), position: p, value, step: value === 1 });
      }
    });
  }
  return { vertices, edges, layerSizes, drawn };
}

export interface OrbitDrawing {
  /** The column and the layer of each vertex (layeredLayout). */
  x: number[];
  y: number[];
  widest: number;
  layers: number;
}

/** The layered layout of the drawn orbit: rank = layer, edges as drawn (site/src/components/draw/layeredLayout.ts). */
export function orbitDrawing(o: OrbitLayers): OrbitDrawing {
  const l = layeredLayout({ keys: o.vertices.map((v) => v.key), rank: o.vertices.map((v) => v.depth), edges: o.edges.map((e) => [e.from, e.to] as [number, number]) });
  return { x: l.x, y: l.y, widest: l.widestRank, layers: l.rankCount };
}

// ---------------------------------------------------------------------------------------------
// The string viewer (SPEC 4 T12 bullet 5; 2.18 Strings)
// ---------------------------------------------------------------------------------------------

export interface StringPosition {
  /** Exact decimal text of each entry, in label order. */
  values: string[];
  /** The entries joined by commas (also the key of the flip). */
  key: string;
  /** Its place on the line as shown, counted from mu (0 is mu). */
  step: bigint;
  /** Whether it lies in the orbit of mu (F3: legal play from both ends at one position). */
  inOrbit: boolean;
}

export interface StringView {
  /** The node, as a label. */
  node: number;
  /** mu in label order. */
  through: string[];
  /** down: mu_i > 0, the line mu, mu - alpha_i, ...; up: mu_i < 0, read from mu upward; single: mu_i = 0. */
  direction: 'down' | 'up' | 'single';
  /** The number of positions on the line, |mu_i| + 1. */
  length: bigint;
  /** The positions listed, from mu (all of them up to STRING_SHOWN_MAX, else the first and last six or the two ends). */
  shown: StringPosition[];
  /** Positions not listed between shown[gapAfter] and shown[gapAfter + 1]. */
  elided: bigint;
  gapAfter: number | null;
  /** The line has more than CAPS.mainThreadItems positions: only its two ends are computed (plan, 5.9). */
  tooLong: boolean;
  /** The line holds entries beyond the safe integers, which stringThrough does not take: the two ends only. */
  unsafe: boolean;
}

type AnyVec = readonly unknown[];

/** The end of legal play from a position (play's position): the same for two positions exactly when they are in one orbit (F3). */
function playEnd(board: Board<unknown>, v: AnyVec, route: Route): string {
  route('play', playHint(board as AnyBoard));
  const r = play(board, v as readonly unknown[]);
  return r.position.map((x) => board.arith.show(x)).join(',');
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const absBig = (x: bigint): bigint => (x < 0n ? -x : x);

/**
 * The line of positions through mu at the node with label `nodeLabel` (2.18 Strings): for mu_i >= 0,
 * stringThrough(board, mu, i), that is mu, mu - alpha_i, ..., mu - mu_i alpha_i; for mu_i < 0 the same
 * line read from the other end, stringThrough(board, fire(board, mu, i), i) reversed, which starts at mu
 * and climbs by alpha_i (the oracle asserts mu_i >= 0, so stringThrough is never called with mu_i < 0);
 * for mu_i = 0 the line is mu alone. stringThrough is called only when the line has at most
 * CAPS.mainThreadItems positions and no entry of it can pass 2^53 (each entry j of the line lies within
 * |mu_j| + mu_i |C_ji| of 0, read off the start and the board); otherwise the two ends, mu and R_i mu
 * (fire), stand for it, with the count. Each position listed is marked in or out of the orbit of mu by
 * comparing the ends of legal play from it and from mu (F3; on a finite-type board two positions are in one
 * orbit exactly when legal play from each ends at the same position). `board` carries the arithmetic of
 * `mu` (a SafeInt board, or its Big copy for a start beyond the safe range); `mu` is indexed by position.
 * On a SafeInt board a number that passes 2^53 on the way (in a firing or in legal play, EngineOverflow)
 * makes the whole view be computed again on `opts.big(board)`, the Big copy, as fireText does (SPEC 4.0
 * Long numbers; CLAUDE.md Numbers); without `opts.big` the EngineOverflow is thrown.
 */
export function stringView(board: Board<unknown>, mu: AnyVec, nodeLabel: number, opts: { route?: Route; big?: (board: AnyBoard) => Board<unknown> } = {}): StringView {
  const route = opts.route ?? noRoute;
  try {
    return lineView(board, mu, nodeLabel, route);
  } catch (e) {
    if (!(e instanceof EngineOverflow) || opts.big === undefined || typeof board.arith.zero === 'bigint') throw e;
    const big = opts.big(board as AnyBoard);
    return lineView(big, mu.map((x) => board.arith.toBig(x)), nodeLabel, route);
  }
}

function lineView(board: Board<unknown>, mu: AnyVec, nodeLabel: number, route: Route): StringView {
  const any = board as AnyBoard;
  const i = positionOf(any, nodeLabel);
  const a = board.arith;
  const sign = a.sign(mu[i]!);
  const show = (v: AnyVec): string[] => inLabelOrder(any, v.map((x) => a.show(x)));
  const top: AnyVec = sign >= 0 ? mu : fire(board, mu as readonly unknown[], i);
  const reach = absBig(a.toBig(top[i]!));
  const length = reach + 1n;
  const tooLong = length > BigInt(CAPS.mainThreadItems);
  const safe = top.every((x, j) => absBig(a.toBig(x)) + reach * absBig(a.toBig(board.cartan[j]![i]!)) <= MAX_SAFE);
  let line: AnyVec[] | null = null;
  if (sign === 0) line = [mu];
  else if (!tooLong && safe) {
    route('stringThrough', enumerationHint(any, Number(length)));
    const nums = stringThrough(any, top.map((x) => Number(a.toBig(x))), i);
    line = nums.map((v) => v.map((x) => (typeof a.zero === 'bigint' ? BigInt(x) : x)));
  }
  const ends: AnyVec[] = [top, fire(board, top as readonly unknown[], i)];
  let shownVecs: { v: AnyVec; step: bigint }[];
  let elided = 0n;
  let gapAfter: number | null = null;
  if (line !== null) {
    const fromMu = sign < 0 ? [...line].reverse() : line;
    if (fromMu.length <= STRING_SHOWN_MAX) shownVecs = fromMu.map((v, k) => ({ v, step: BigInt(k) }));
    else {
      const half = STRING_SHOWN_MAX / 2;
      shownVecs = [...fromMu.slice(0, half).map((v, k) => ({ v, step: BigInt(k) })), ...fromMu.slice(-half).map((v, k) => ({ v, step: BigInt(fromMu.length - half + k) }))];
      elided = BigInt(fromMu.length - STRING_SHOWN_MAX);
      gapAfter = half - 1;
    }
  } else {
    const fromMu = sign < 0 ? [ends[1]!, ends[0]!] : ends;
    shownVecs = [
      { v: fromMu[0]!, step: 0n },
      { v: fromMu[1]!, step: length - 1n },
    ];
    elided = length - 2n;
    gapAfter = 0;
  }
  const muEnd = playEnd(board, mu, route);
  const shown: StringPosition[] = shownVecs.map(({ v, step }) => {
    const values = show(v);
    return { values, key: values.join(','), step, inOrbit: playEnd(board, v, route) === muEnd };
  });
  return {
    node: nodeLabel,
    through: show(mu),
    direction: sign > 0 ? 'down' : sign < 0 ? 'up' : 'single',
    length,
    shown,
    elided,
    gapAfter,
    tooLong,
    unsafe: line === null && !tooLong,
  };
}

/** The sentence under the line (data-out="string-note", plan wording). */
export function stringNote(view: StringView): string {
  const i = view.node;
  const parts: string[] = [];
  if (view.direction === 'single') parts.push(`The number on node ${i} is 0, so the line through this position is the position alone, and firing node ${i} leaves it where it is.`);
  else if (view.direction === 'down') parts.push(`The number on node ${i} is positive: the line runs down from this position by α${i}, and firing node ${i} turns it end over end.`);
  else parts.push(`The number on node ${i} is negative: the line is read from this position upward by α${i}, and firing node ${i} turns it end over end.`);
  if (view.tooLong) parts.push(`It has more than ${CAPS.mainThreadItems} positions, so only its two ends are shown.`);
  else if (view.unsafe && view.elided > 0n) parts.push(`Its entries pass 2^53, so only its two ends are computed here.`);
  else if (view.elided > 0n) parts.push(`The ${view.elided} positions between the first six and the last six are not listed.`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------------------------
// Captions (4.0 "Starts meaningful": the caption states the result; every number from the engine)
// ---------------------------------------------------------------------------------------------

function joinAnd(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The caption of a representation (plan): what the figure shows for this board and node. The counts of the
 * relations come from the list, or from the digest the server shipped while the list is not computed.
 */
export function repCaption(rep: Representation, digest: RelationDigest | null = null): string {
  const i = rep.node;
  const d = dimensionOf(rep);
  if (!rep.built) {
    return `On ${rep.name}, node ${i} is not minuscule: ${someNumberPhrase(rep.firstLarge!.value)}. The orbit of ${omegaName(i)} has ${rep.orbitSize} positions, more than ${CAPS.repOrbit}, so the matrices are not built here.`;
  }
  const tally = relationTally(rep, digest);
  if (tally === null) {
    return `On ${rep.name}, node ${i}${rep.minuscule ? ' is minuscule' : ` is not minuscule: ${someNumberPhrase(rep.firstLarge!.value)}`}. The orbit of ${omegaName(i)} gives ${d} by ${d} matrices E, F and H, whose Chevalley-Serre relations are checked in the background.`;
  }
  if (rep.minuscule) {
    return `On ${rep.name} the ${d} positions of the orbit of ${omegaName(i)} give ${d} by ${d} matrices E, F and H that satisfy all ${tally.total} Chevalley-Serre relations.`;
  }
  return `On ${rep.name}, node ${i} is not minuscule: ${someNumberPhrase(rep.firstLarge!.value)}, and ${tally.failing} of the ${tally.total} Chevalley-Serre relations fail for the ${d} by ${d} matrices read off the game.`;
}

/** The caption of the relation checker (plan): the chosen relation, its verdict, and the count. */
export function relationCaption(rep: Representation, code: string, digest: RelationDigest | null = null): string {
  const check = shownCheck(rep, code, digest);
  const tally = relationTally(rep, digest);
  const parts = relationParts(rep.board, code);
  if (check === null || tally === null || parts === null) return repCaption(rep, digest);
  const d = dimensionOf(rep);
  return `On ${rep.name}, node ${rep.node}: the two sides of ${relationText(parts)} are ${check.holds ? 'equal' : 'not equal'} for the ${d} by ${d} matrices read off the game. ${relationSummary(tally)}`;
}

/** The caption of the move beside its signed version (plan). */
export function signedCaption(rep: Representation, k: number, digest: RelationDigest | null = null): string {
  if (!rep.built || !rep.minuscule) return repCaption(rep, digest);
  return `On ${rep.name}, node ${rep.node}: firing node ${k} is a permutation matrix of zeros and ones, and exp(E${k}) exp(${MINUS}F${k}) exp(E${k}) = E${k} ${MINUS} F${k} + P${k} is the same matrix with one sign changed in each pair.`;
}

/** The caption of the string viewer (plan): the line, its length, and the positions outside the orbit. */
export function stringCaption(name: string, view: StringView): string {
  const i = view.node;
  const mu = positionText(view.through);
  const n = view.length;
  const listed = view.elided === 0n ? `: ${joinAnd(view.shown.map((p) => positionText(p.values)))}` : `, from ${positionText(view.shown[0]!.values)} to ${positionText(view.shown[view.shown.length - 1]!.values)}`;
  const head = `On ${name} the line through ${mu} at node ${i} has ${n} ${n === 1n ? 'position' : 'positions'}${listed}.`;
  if (view.direction === 'single') return `${head} The number on node ${i} is 0, so firing node ${i} leaves it where it is.`;
  const outside = view.shown.filter((p) => !p.inOrbit).map((p) => positionText(p.values));
  const tail =
    outside.length === 0
      ? '.'
      : `, and ${joinAnd(outside)} ${outside.length === 1 ? 'lies' : 'lie'} outside the orbit of ${mu}.`;
  return `${head} Firing node ${i} turns it end over end${tail}`;
}
