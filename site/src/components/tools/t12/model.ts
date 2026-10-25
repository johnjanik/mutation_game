// T12, the Representation Builder: the state of one instance, its links, its export and its sentences, as
// pure functions with no DOM (SPEC.md 4 T12, 2.18, 4.0, 6.6, 7.4, E-5, E-7, E-9). Owner P5-A2. The
// computations are t12/rep.ts (re-exported here, so that the unit test imports one module); this module
// adds the site's libraries: the state of 6.6 (lib/state.ts), the codec (lib/urlCodec.ts), the routing of
// E-9 (lib/worker.ts: every engine call's hint goes through whereToRun before the call), the A-4
// templates (lib/a11y.ts). Labels everywhere outside the engine; toLabels and toPositions convert (E-7).
import { CAPS, EngineOverflow, fire, toLabels } from '@two-games/engine';
import type { AnyBoard, Board, RelationCheck, SparseMatrix } from '@two-games/engine';
import { announceTemplates, moveAnnouncement, speakList } from '../../../lib/a11y';
import { bigBoard, cloneState, integerOut, resolveBoard, type ToolState } from '../../../lib/state';
import { LINK_NOTICE, decodeState, normalisePrefix } from '../../../lib/urlCodec';
import { whereToRun, type CallHint } from '../../../lib/worker';
import { T12_PRESETS, offersBoard, type T12Panel, type T12PresetId } from './config';
import {
  DRAW_MAX,
  addMatrices,
  addRelations,
  addSignedMoves,
  buildRepresentation,
  minusculeOf,
  startRepresentation,
  byPosition,
  defaultNode,
  defaultRelation,
  entryList,
  enumerationHint,
  explanation,
  inLabelOrder,
  labelOrder,
  orbitDrawing,
  orbitLayers,
  listOnMain,
  omegaName,
  parseRelationCode,
  positionOf,
  relationCaption,
  relationParts,
  relationText,
  repCaption,
  representationDimension,
  shownCheck,
  signedCaption,
  stringCaption,
  stringView,
  type OrbitDrawing,
  type OrbitLayers,
  type OrbitVertex,
  type RelationDigest,
  type RepHint,
  type Representation,
  type Route,
  type StringView,
} from './rep';

export * from './rep';

/** The longest decimal entry a typed start takes (SPEC 6.6 Validation: "a start with an entry longer than 40 digits"). */
export const START_DIGITS_MAX = 40;

// ---------------------------------------------------------------------------------------------
// E-9: where each call runs
// ---------------------------------------------------------------------------------------------

/**
 * The route of every main-thread call of T12: the hint goes through whereToRun first, and a call that the
 * rule would send to the worker is refused (it cannot happen: every enumeration T12 makes has at most 2000
 * items known in advance from orbitSize, and every play is a legal play on a finite-type board, E-9 rules 1
 * and 2). In Node (build time) the rule does not apply, but the check is the same.
 */
export const mainRoute: Route = (fn, hint) => {
  if (whereToRun(hint as CallHint) !== 'main') throw new Error(`T12 would run ${fn} on the main thread where E-9 places it in the worker`);
};

/**
 * The hint of the relation list of an orbit whose work is above RELATIONS_MAIN_WORK (plan, decisions/P5-A2.md):
 * an enumeration without a size known to be within the main thread's 2000 items, which E-9 rule 1 sends to
 * the worker. chevalleySerre is not an enumeration in the words of E-9; its work grows with the square of
 * the rank times the size, and SPEC 7.6 bounds a main-thread call at 50 ms, so T12 marks it so (a request
 * to P1-A2 asks for a hint field that says this directly).
 */
export function relationsHint(board: AnyBoard): CallHint {
  return { board, kind: 'enumeration', finiteKnown: true };
}

export interface RoutedCall {
  fn: string;
  hint: RepHint | CallHint;
  where: 'main' | 'worker';
}

/**
 * The calls T12 makes to show the representation of a node, each with the hint it passes and where
 * whereToRun places it (reported in the decisions fragment, and checked by the unit test): the calls of
 * buildRepresentation and orbitLayers as they announce themselves, then the relation list, on the main thread
 * up to RELATIONS_MAIN_WORK and in the worker above.
 */
export function routedCalls(spec: string, nodeLabel: number): RoutedCall[] {
  const calls: RoutedCall[] = [];
  const record: Route = (fn, hint) => calls.push({ fn, hint, where: whereToRun(hint as CallHint) });
  const rep = buildRepresentation(resolveBoard(spec), nodeLabel, { route: record, relations: 'later' });
  if (!rep.built) return calls;
  orbitLayers(rep, { route: record });
  const hint = listOnMain(rep) ? enumerationHint(rep.board, rep.orbitSize) : relationsHint(rep.board);
  calls.push({ fn: 'chevalleySerre', hint, where: whereToRun(hint as CallHint) });
  return calls;
}

// ---------------------------------------------------------------------------------------------
// Representations, kept for the boards and nodes visited (boards are immutable, E-11)
// ---------------------------------------------------------------------------------------------

const CACHE_MAX = 8;
const cache = new Map<string, Representation>();

/** Whether the code runs in Node (build time, unit tests), where E-9 does not apply: every call runs in-process. */
const inNode = (): boolean => typeof window === 'undefined';

/** Empties the cache of representations and of boards (a test seam: the next state is computed afresh, as in a new page). */
export function forgetRepresentations(): void {
  cache.clear();
  boards.clear();
}

const boards = new Map<string, AnyBoard>();

/**
 * The board of a name T12 offers, one object for the page (SPEC 5.6, last sentence: "by calling classify
 * once when the board is loaded"; E-11 keeps the verdict per board object). resolveBoard returns one object
 * only within a run of synchronous code, and a pick or a link spreads its work over tasks (SPEC 7.6), so T12
 * keeps the board of each name it has resolved: at most the 32 of t12/boards.ts, and boards are immutable.
 * RT-FIX P5-RT-07-02: a pick resolved its board in three tasks and classified it three times.
 */
export function boardOf(spec: string): AnyBoard {
  if (!offersBoard(spec)) throw new RangeError(`T12 does not offer the board ${spec}`);
  let board = boards.get(spec);
  if (board === undefined) {
    board = resolveBoard(spec);
    boards.set(spec, board);
  }
  return board;
}

/**
 * Computes the relation list of a representation on the main thread now: up to RELATIONS_MAIN_WORK, or any
 * size with `initial`, or in Node (build time, where every call runs in-process, E-9).
 */
export function relationsNow(rep: Representation, initial = false): void {
  if (!rep.built || rep.checks !== null) return;
  if (!initial && !inNode() && !listOnMain(rep)) throw new RangeError(`the relations of ${rep.orbitSize} positions on a board of rank ${rep.board.n} are computed in the worker`);
  addRelations(rep, { route: mainRoute });
}

/** The basis, E, F, H, the moves and the signed moves of a built representation, now (main thread, E-9 rule 1). */
export function ensureMatrices(rep: Representation): void {
  addMatrices(rep, { route: mainRoute });
  addSignedMoves(rep, { route: mainRoute });
}

/**
 * A step of work run in a task of its own; it may return further steps, which run next, each in a task of
 * its own (the tool's runSteps).
 */
export type Step = () => void | Step[];

/**
 * The representation of a node as steps, each to run in a task of its own (SPEC 7.6), filling the cache
 * that representationOf reads: decide (minusculeNodes, orbitSize, legal play), enumerate (minusculeMatrices),
 * sign (signedMoves; one node per task above DRAW_MAX positions), and for a node that is not minuscule
 * whose relation list stays on the main thread that list (its default relation is its first failing one).
 * After the last step representationOf(spec, label, 'staged') computes nothing.
 */
export function representationSteps(spec: string, nodeLabel: number): Step[] {
  const key = `${spec}|${nodeLabel}`;
  let rep: Representation | undefined;
  const get = (): Representation => {
    rep ??= cache.get(key);
    if (rep === undefined) {
      rep = startRepresentation(boardOf(spec), nodeLabel, { route: mainRoute });
      cache.set(key, rep);
      while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    }
    return rep;
  };
  return [
    () => void get(),
    () => addMatrices(get(), { route: mainRoute }),
    () => {
      const r = get();
      if (r.basis === null || r.signed !== null) return;
      if (r.orbitSize <= DRAW_MAX) return void addSignedMoves(r, { route: mainRoute });
      return Array.from({ length: r.board.n }, (_, k): Step => () => addSignedMoves(get(), { route: mainRoute }, k));
    },
    () => {
      const r = get();
      if (!r.minuscule && listOnMain(r)) relationsNow(r);
    },
  ];
}

/**
 * How much of a representation representationOf computes now in the browser (in Node, at build time and in
 * the unit tests, it computes everything, E-9):
 * - 'facts': the decision alone (minusculeNodes, orbitSize, legal play): what a configured state needs while
 *   it hydrates, its panels being kept from the server's markup (SPEC 7.6; decisions/P5-A2.md);
 * - 'default': the facts, and for a node that is not minuscule whose list stays on the main thread the
 *   matrices and that list, from which its default relation (its first failing one) is read;
 * - 'staged' (a state loaded after hydration): the matrices and the signed moves too.
 * Every other list is left to the tool: a task of its own on the main thread up to RELATIONS_MAIN_WORK
 * (relationsNow), the worker above (engineCall with relationsHint), so that no task does both the matrices
 * and the relations.
 */
export type RepresentationNeed = 'facts' | 'default' | 'staged';

/** The representation of a node of an offered board (cached, at most CACHE_MAX kept). */
export function representationOf(spec: string, nodeLabel: number, need: RepresentationNeed = 'staged'): Representation {
  const key = `${spec}|${nodeLabel}`;
  let rep = cache.get(key);
  if (rep !== undefined) cache.delete(key);
  else rep = startRepresentation(boardOf(spec), nodeLabel, { route: mainRoute });
  cache.set(key, rep);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  if (inNode()) {
    ensureMatrices(rep);
    relationsNow(rep, true);
    return rep;
  }
  const smallFailing = rep.built && !rep.minuscule && listOnMain(rep);
  // The steps a pick left undone (another pick came first) are done here; each returns at once when done.
  if (need === 'staged' || (need === 'default' && smallFailing)) addMatrices(rep, { route: mainRoute });
  if (need === 'staged') addSignedMoves(rep, { route: mainRoute });
  if (need !== 'facts' && smallFailing) relationsNow(rep);
  return rep;
}

/** The minuscule nodes of a board as labels (the node picker's text mark, A-5). */
export function minusculeLabels(board: AnyBoard): number[] {
  return toLabels(board, minusculeOf(board)).sort((a, b) => a - b);
}

export interface OrbitView {
  layers: OrbitLayers;
  /** The layout when every vertex is drawn, else null. */
  drawing: OrbitDrawing | null;
  /** The vertices in basis order (the orbit table of the table view). */
  byBasis: OrbitVertex[];
}

const orbitBases = new WeakMap<Representation, OrbitLayers>();
const orbitViews = new WeakMap<Representation, OrbitView>();

/**
 * The orbit in layers of a built representation (orbitGraph and its depths and edges), kept per
 * representation (main thread, E-9 rule 1): the first of the two steps of orbitView, which a large orbit
 * takes in two tasks (SPEC 7.6).
 */
export function orbitBase(rep: Representation): OrbitLayers {
  let layers = orbitBases.get(rep);
  if (layers === undefined) {
    layers = orbitLayers(rep, { route: mainRoute });
    orbitBases.set(rep, layers);
  }
  return layers;
}

/** The orbit in layers of a built representation, with its layout, kept per representation (main thread, E-9 rule 1). */
export function orbitView(rep: Representation): OrbitView {
  const known = orbitViews.get(rep);
  if (known !== undefined) return known;
  const layers = orbitBase(rep);
  const v: OrbitView = { layers, drawing: layers.drawn ? orbitDrawing(layers) : null, byBasis: [...layers.vertices].sort((a, b) => a.basisIndex - b.basisIndex) };
  orbitViews.set(rep, v);
  return v;
}

/** Stores a relation list computed in the worker in the cached representation; false when it no longer applies. */
export function acceptRelations(rep: Representation, checks: RelationCheck[]): boolean {
  if (rep.checks !== null || !rep.built) return false;
  if (checks.length !== 6 * rep.board.n * rep.board.n - 2 * rep.board.n) throw new RangeError('the relation list does not have one record per relation');
  rep.checks = checks;
  return true;
}

// ---------------------------------------------------------------------------------------------
// The state of 6.6 (fields board, node, relation, coords, start, moves)
// ---------------------------------------------------------------------------------------------

/**
 * The default start, all ones in label order (SPEC 6.6, field `start`: "default: all ones for numbers"), on
 * the tool route and after a pick of a board or a node; an author's start stays (RT-FIX P5-RT-10-03: it was
 * the fundamental position of the node).
 */
export function defaultStart(board: AnyBoard): number[] {
  return labelOrder(board).map(() => 1);
}

/** The tool's default state for a board, and a node (default: defaultNode), as a picker sets it (4.0; plan). */
export function defaultsFor(spec: string, nodeLabel?: number): ToolState {
  const board = boardOf(spec);
  const node = nodeLabel ?? defaultNode(board);
  const rep = representationOf(spec, node, 'default');
  return { schema: 1, tool: 'rep', board: spec, node, relation: defaultRelation(rep), coords: 'numbers', start: defaultStart(board), moves: [] };
}

/** The state of a preset (its fields; the panel it puts first is not part of the state, 6.6). */
export function presetState(id: T12PresetId): ToolState {
  const p = T12_PRESETS[id];
  return { schema: 1, tool: 'rep', board: p.board, node: p.node, relation: p.relation, coords: 'numbers', start: [...p.start], moves: [...p.moves] };
}

/** The author's configuration (properties over the preset's fields, CONTRACTS 5.2). */
export interface T12Props {
  board?: string;
  node?: number;
  relation?: string;
  coords?: string;
  start?: (number | string)[];
  moves?: number[];
  preset?: string;
}

export const presetIdOf = (preset: string | undefined): T12PresetId =>
  preset !== undefined && Object.prototype.hasOwnProperty.call(T12_PRESETS, preset) ? (preset as T12PresetId) : 'default';

/**
 * The configured state of an instance: each property over the preset's field, the preset's start, moves and
 * relation kept only while its board and node are kept, otherwise the defaults of the board and node.
 * RangeError on a configuration T12 cannot show (an authoring error; the component names the instance).
 */
export function configuredState(props: T12Props): ToolState {
  const preset = presetState(presetIdOf(props.preset));
  if (props.coords !== undefined && props.coords !== 'numbers') throw new RangeError('T12 takes coords "numbers" only (the string viewer plays the numbers game)');
  const spec = props.board ?? (preset.board as string);
  const samePreset = spec === preset.board && (props.node ?? preset.node) === preset.node;
  const base = samePreset ? preset : defaultsFor(spec, props.node);
  const state: ToolState = {
    ...base,
    relation: props.relation ?? base.relation,
    start: props.start !== undefined ? [...props.start] : base.start,
    moves: props.moves !== undefined ? [...props.moves] : base.moves,
  };
  new T12Tool(configOf(state)); // validates
  return state;
}

export interface T12Config {
  board: string;
  node: number;
  relation: string;
  start: (number | string)[];
  moves: number[];
}

export function configOf(s: ToolState): T12Config {
  if (typeof s.board !== 'string') throw new RangeError('T12 offers named boards only');
  if (s.node === undefined || s.relation === undefined || s.start === undefined) throw new RangeError('a T12 state has a node, a relation and a start');
  return { board: s.board, node: s.node, relation: s.relation, start: s.start, moves: s.moves ?? [] };
}

// ---------------------------------------------------------------------------------------------
// The numbers game of the string viewer: free play, positions kept per move (4.0 History; 7.4)
// ---------------------------------------------------------------------------------------------

const INTEGER = /^-?\d+$/;

/** The decimal text of a start entry, or RangeError (more than 40 digits, not an integer). */
function entryText(x: number | string): string {
  const t = String(integerOut(x));
  if (!INTEGER.test(t)) throw new RangeError(`${t} is not an integer`);
  if (t.replace(/^-/, '').length > START_DIGITS_MAX) throw new RangeError(`an entry has more than ${START_DIGITS_MAX} digits`);
  return t;
}

const isSafe = (t: string): boolean => Number.isSafeInteger(Number(t)) && String(Number(t)) === t.replace(/^-0$/, '0');

/** One move of the numbers game on decimal texts in label order: SafeInt while safe, else Big (as T1). */
export function fireText(board: Board<number>, values: readonly string[], label: number): string[] {
  const position = positionOf(board, label);
  if (values.every(isSafe)) {
    try {
      return inLabelOrder(board, fire(board, byPosition(board, values.map(Number)), position)).map(String);
    } catch (e) {
      if (!(e instanceof EngineOverflow)) throw e;
    }
  }
  const big = bigBoard(board);
  return inLabelOrder(big, fire(big, byPosition(big, values.map((t) => BigInt(t))), position)).map((x) => x.toString());
}

/** The board and vector of a position given as decimal texts in label order: SafeInt when safe, else Big. */
export function inArithmetic(board: Board<number>, values: readonly string[]): { board: Board<unknown>; vector: unknown[] } {
  if (values.every(isSafe)) return { board: board as Board<unknown>, vector: byPosition(board, values.map(Number)) };
  const big = bigBoard(board);
  return { board: big as Board<unknown>, vector: byPosition(big, values.map((t) => BigInt(t))) };
}

/** What a move did, for the announcement. */
export interface MoveResult {
  label: number;
  move: number;
  before: string[];
  after: string[];
}

/**
 * One T12 instance: the representation of a node and the play of the string viewer. The position is
 * recomputed by the engine from the start and the moves (4.0); the positions after each move are kept,
 * one engine call per move (7.4). With `defer`, a long list of moves read from a link (more than 2000,
 * E-9 rule 2) is not replayed in the constructor: the caller replays it in the worker (positionsOf).
 */
export class T12Tool {
  readonly spec: string;
  readonly board: Board<number>;
  readonly node: number;
  readonly rep: Representation;
  relation: string;
  readonly start: string[];
  moves: number[];
  cursor: number;
  pending: boolean;
  private at: (string[] | undefined)[];

  /**
   * `need` says how much of the representation the browser computes now (representationOf): 'facts' for the
   * configured state while it hydrates (its panels are the server's until they go live), 'staged' for a
   * state loaded afterwards. In Node everything is computed.
   */
  constructor(cfg: T12Config, opts: { defer?: boolean; need?: RepresentationNeed } = {}) {
    this.spec = cfg.board;
    this.board = boardOf(cfg.board) as Board<number>;
    if (!this.board.labels.includes(cfg.node)) throw new RangeError(`${cfg.node} is not a label of ${cfg.board}`);
    this.node = cfg.node;
    this.rep = representationOf(cfg.board, cfg.node, opts.need ?? 'facts');
    if (parseRelationCode(this.board, cfg.relation) === null) throw new RangeError(`${cfg.relation} is not a relation of ${cfg.board}`);
    this.relation = cfg.relation;
    if (cfg.start.length !== this.board.n) throw new RangeError(`the start has ${cfg.start.length} entries, but ${cfg.board} has ${this.board.n} nodes`);
    this.start = cfg.start.map(entryText);
    for (const l of cfg.moves) if (!this.board.labels.includes(l)) throw new RangeError(`${l} is not a label of ${cfg.board}`);
    if (cfg.moves.length > CAPS.linkMoves) throw new RangeError(`more than ${CAPS.linkMoves} moves`);
    this.moves = [...cfg.moves];
    this.cursor = this.moves.length;
    this.at = [this.start];
    this.pending = opts.defer === true && this.needsWorker();
    if (!this.pending) this.replaySync();
  }

  /** The hint of the replay of the moves (E-9 rule 2: "a long list of moves read from a link"). */
  replayHint(): CallHint {
    return { board: this.board, kind: 'play', moves: this.moves.length };
  }

  needsWorker(): boolean {
    return this.moves.length > 0 && whereToRun(this.replayHint()) === 'worker';
  }

  /** Plays every move not yet played, on the main thread. */
  replaySync(): void {
    for (let k = 0; k < this.moves.length; k++) if (this.at[k + 1] === undefined) this.at[k + 1] = fireText(this.board, this.at[k]!, this.moves[k]!);
    this.pending = false;
  }

  /** The state given to the site's positionsOf in the worker (the whole play, from the start). */
  workerState(): ToolState {
    return { schema: 1, tool: 'rep', board: this.spec, coords: 'numbers', start: this.start.map((t) => integerOut(t)), moves: [...this.moves] };
  }

  /** Takes the positions of the worker's replay (label order, the start first). */
  acceptReplay(list: readonly (readonly (number | string)[])[]): void {
    if (list.length !== this.moves.length + 1) throw new RangeError('the replay does not match the moves');
    this.at = list.map((row) => row.map((x) => String(x)));
    this.pending = false;
  }

  /** The position after k moves (the cursor by default), decimal texts in label order; the start while pending. */
  values(k: number = this.cursor): string[] {
    return this.at[k] ?? this.at[0]!;
  }

  /** One move of free play at the node with this label, from the cursor (later moves are discarded). */
  act(label: number): MoveResult | null {
    if (this.pending || !this.board.labels.includes(label)) return null;
    const before = this.values();
    this.moves = [...this.moves.slice(0, this.cursor), label];
    this.at.length = this.cursor + 1;
    this.at[this.cursor + 1] = fireText(this.board, before, label);
    this.cursor++;
    return { label, move: this.cursor, before, after: this.values() };
  }

  /** Moves the cursor (undo, redo, the strip); false when out of range, unchanged or pending. */
  scrub(k: number): boolean {
    if (this.pending || !Number.isInteger(k) || k < 0 || k > this.moves.length || k === this.cursor) return false;
    this.cursor = k;
    return true;
  }

  /** Empties the list (4.0 History: "reset empties the list"). */
  reset(): boolean {
    if (this.pending || this.moves.length === 0) return false;
    this.moves = [];
    this.cursor = 0;
    this.at.length = 1;
    return true;
  }

  /** The state of 6.6: the moves up to the cursor. */
  state(): ToolState {
    return {
      schema: 1,
      tool: 'rep',
      board: this.spec,
      node: this.node,
      relation: this.relation,
      coords: 'numbers',
      start: this.start.map((t) => integerOut(t)),
      moves: this.moves.slice(0, this.cursor),
    };
  }

  private lastString: { key: string; view: StringView } | null = null;

  /** The string through the current position at the representation's node (2.18 Strings), kept for the position shown. */
  string(): StringView {
    const key = this.values().join(',');
    if (this.lastString?.key === key) return this.lastString.view;
    const { board, vector } = inArithmetic(this.board, this.values());
    // A safe start whose line, ends or legal play pass 2^53 is computed again on the Big board (as fireText).
    const view = stringView(board, vector, this.node, { route: mainRoute, big: (b) => bigBoard(b) as Board<unknown> });
    this.lastString = { key, view };
    return view;
  }
}

/** Parses a typed start (one field per node, label order); a sentence saying what is wrong, or the entries. */
export function readTypedStart(board: AnyBoard, fields: readonly string[]): { start: string[] } | { problem: string } {
  if (fields.length !== board.n) return { problem: `Type one whole number for each of the ${board.n} nodes.` };
  const out: string[] = [];
  for (let k = 0; k < fields.length; k++) {
    const t = fields[k]!.trim().replace(/^−/, '-').replace(/^\+/, '');
    const label = labelOrder(board)[k]!;
    if (!INTEGER.test(t)) return { problem: `Type a whole number for node ${label}.` };
    if (t.replace(/^-/, '').length > START_DIGITS_MAX) return { problem: `The entry of node ${label} has more than ${START_DIGITS_MAX} digits.` };
    out.push(String(integerOut(t)));
  }
  return { start: out };
}

// ---------------------------------------------------------------------------------------------
// Links (6.6; plan rules of the instruction, section 5.10)
// ---------------------------------------------------------------------------------------------

/** The keys of 6.6 that name T12's fields; the keys of the other tools (v m x t r j e y d) are ignored (plan). */
const OWN_KEYS: ReadonlySet<string> = new Set(['z', 'g', 'c', 's', 'w', 'k', 'q']);
const CODEC_KEYS: ReadonlySet<string> = new Set('zgvmcswxtrjeykqd'.split(''));

/**
 * Reads one instance's state from a query string: the codec (decodeState) first, then T12's own rules
 * (plan): keys of the other tools are left out before the codec reads the link; a `g` or a `k` that changes
 * the board or the node takes that board's and node's defaults for every field the link does not name (the
 * start omega_k, no moves, the default relation), as a picker does; `c=p` is refused (the string viewer
 * plays the numbers game); `c` without `s` keeps the tool's start; a board T12 does not offer and a Serre
 * relation with equal nodes are refused. Any failure: the configured state and LINK_NOTICE.
 */
export function admitLink(search: string, configured: ToolState, prefix: string): { state: ToolState; notice: string | null } {
  const pre = normalisePrefix(prefix);
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const kept = new URLSearchParams();
  const has = new Set<string>();
  for (const [name, value] of params) {
    const key = name.startsWith(pre) ? name.slice(pre.length) : null;
    if (key !== null && CODEC_KEYS.has(key)) {
      if (!OWN_KEYS.has(key)) continue;
      has.add(key);
    }
    kept.append(name, value);
  }
  if (has.size === 0) return { state: cloneState(configured), notice: null };
  const refuse = { state: cloneState(configured), notice: LINK_NOTICE };
  let base = configured;
  try {
    const g = kept.get(`${pre}g`);
    if (g !== null && offersBoard(g) && g !== configured.board) base = defaultsFor(g);
    const k = kept.get(`${pre}k`);
    if (k !== null && /^\d+$/.test(k) && Number(k) !== base.node && boardOf(base.board as string).labels.includes(Number(k))) base = defaultsFor(base.board as string, Number(k));
  } catch {
    base = configured;
  }
  const { state, notice } = decodeState(kept.toString(), 'rep', base, { prefix });
  if (notice !== null) return refuse;
  try {
    if (typeof state.board !== 'string' || !offersBoard(state.board)) return refuse;
    if (state.coords !== 'numbers') return refuse;
    if (has.has('c') && !has.has('s')) state.start = base.start === undefined ? state.start : [...base.start];
    for (const f of ['view', 'mode', 'black', 'tau', 'rings', 'projection', 'graph', 'symmetry', 'lambda'] as const) delete state[f];
    // Validated without replaying a long list here: the component replays it where E-9 says (rule 2).
    const tool = new T12Tool(configOf(state), { defer: true, need: 'staged' });
    return { state: tool.state(), notice: null };
  } catch {
    return refuse;
  }
}

/** Whether a query string names one of T12's keys for the instance with this prefix (`q`: the link chose the relation). */
export function linkNames(search: string, prefix: string, key: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.has(`${normalisePrefix(prefix)}${key}`);
}

// ---------------------------------------------------------------------------------------------
// Sentences: captions, announcements, names
// ---------------------------------------------------------------------------------------------

/**
 * The caption of a state with the panel a preset puts first (plan; every number from the engine). `digest`
 * is the server's digest of the configured state's relations, read while the list is not computed.
 */
export function captionOf(tool: T12Tool, first: T12Panel | null, k: number = tool.node, digest: RelationDigest | null = null): string {
  if (first === 'string') return stringCaption(tool.spec, tool.string());
  if (first === 'relations') return relationCaption(tool.rep, tool.relation, digest);
  if (first === 'signed') return signedCaption(tool.rep, k, digest);
  return repCaption(tool.rep, digest);
}

/** The announcement of a move (A-4; changed nodes only above four nodes). */
export function moveSentence(tool: T12Tool, r: MoveResult): string {
  return moveAnnouncement('Fired', labelOrder(tool.board), r.label, r.before, r.after, r.move);
}

/** The announcement after the cursor moved back: "Undid move 4. Numbers now ..." (A-4). */
export function undoSentence(tool: T12Tool, undone: number, at: number): string {
  return announceTemplates.undid(undone, tool.values(at), 'numbers');
}

/** The announcement after a start was typed (plan). */
export function startSentence(tool: T12Tool): string {
  return `Start set. Numbers now ${speakList(tool.values(0))}.`;
}

/** The announcement after a board or a node was picked (plan). */
export function pickSentence(tool: T12Tool): string {
  const rep = tool.rep;
  return `${tool.spec}, node ${tool.node}: the orbit of ${omegaName(tool.node)} has ${rep.orbitSize} positions. ${explanation(rep)}`;
}

/** The announcement after a relation was picked (plan): the formula and the verdict. */
export function relationSentence(tool: T12Tool, check: { holds: boolean } | null): string {
  const parts = relationParts(tool.board, tool.relation);
  const text = parts === null ? tool.relation : relationText(parts);
  if (check === null) return `${text}: checked in the background.`;
  return `${text}: the two sides are ${check.holds ? 'equal' : 'not equal'}.`;
}

/** The name of a position in History's strip (plan): "Start: numbers 1, 0", "After move 2: numbers ...". */
export function positionName(tool: T12Tool, k: number): string {
  return `${k === 0 ? 'Start' : `After move ${k}`}: numbers ${speakList(tool.values(k))}`;
}

/** Whether the nodes and the pickers can act (4.0 Predict: frozen until the reader answers or presses "show me"). */
export function interaction(n: number, opts: { hydrated: boolean; frozen: boolean; pending: boolean }): { canAct: boolean[]; controls: boolean } {
  const live = opts.hydrated && !opts.frozen && !opts.pending;
  return { canAct: Array.from({ length: n }, () => live), controls: live };
}

// ---------------------------------------------------------------------------------------------
// Download data (4.0 Share and export; 6.6 Data export)
// ---------------------------------------------------------------------------------------------

/** A decimal text as an export value: a JSON number when safe, the text otherwise (6.6). */
const out = (t: string | bigint | number): number | string => integerOut(typeof t === 'bigint' ? t : String(t));

/**
 * What "Download data" writes beside the state (plan): the representation (node, minuscule, orbit size,
 * dimension, the explanation, the basis in label order, E, F, H, the moves and the signed moves of every node
 * as lists of [row, column, value] with 1-based indices, the relations as { relation, i, j, holds } in labels),
 * the string viewer's line, and the positions of its play up to the cursor. Integers are JSON numbers when
 * safe and decimal strings otherwise.
 */
export function exportData(tool: T12Tool, digest: RelationDigest | null = null): Record<string, unknown> {
  const rep = tool.rep;
  ensureMatrices(rep);
  // The relation list, when it is not computed yet and belongs on the main thread (a list above the bound
  // stays null until the worker's arrives; the relation shown keeps its two sides, from the digest).
  if (rep.built && rep.checks === null && listOnMain(rep)) relationsNow(rep);
  const lists = (ms: readonly SparseMatrix[] | null) => (ms === null ? null : inLabelOrder(tool.board, ms).map(entryList));
  const view = tool.string();
  const orbit = rep.built ? orbitView(rep) : null;
  const shown = shownCheck(rep, tool.relation, digest);
  return {
    node: tool.node,
    construction: rep.construction,
    minuscule: rep.minuscule,
    orbitSize: rep.orbitSize,
    built: rep.built,
    // The representation's dimension (RT-FIX P5-RT-09-02); the size of the matrices is orbitSize.
    dimension: out(representationDimension(rep, mainRoute)),
    explanation: explanation(rep),
    basis: rep.basis === null ? null : rep.basis.map((v) => inLabelOrder(tool.board, v)),
    E: lists(rep.E),
    F: lists(rep.F),
    H: lists(rep.H),
    moves: lists(rep.moves),
    signedMoves: lists(rep.signed),
    relations: rep.checks === null ? null : rep.checks.map((c) => ({ relation: c.relation, i: toLabels(tool.board, [c.i])[0]!, j: toLabels(tool.board, [c.j])[0]!, holds: c.holds })),
    relation: tool.relation,
    // The relation shown, with its two sides as [row, column, value] lists (1-based), as on screen.
    relationSides: shown === null ? null : { relation: tool.relation, holds: shown.holds, left: entryList(shown.left).map(([r, c, v]) => [r, c, out(v)]), right: entryList(shown.right).map(([r, c, v]) => [r, c, out(v)]) },
    // The orbit as drawn: each position (label order) with its row of the matrices and its layer, and the
    // edges [from row, to row, node label] when the graph is drawn (at most DRAW_MAX positions), else null.
    orbit: orbit === null ? null : orbit.byBasis.map((v) => ({ row: v.basisIndex + 1, position: inLabelOrder(tool.board, v.values), layer: v.depth })),
    edges: orbit === null || !orbit.layers.drawn ? null : orbit.layers.edges.map((e) => [orbit.layers.vertices[e.from]!.basisIndex + 1, orbit.layers.vertices[e.to]!.basisIndex + 1, e.node]),
    string: {
      node: view.node,
      through: view.through.map(out),
      length: out(view.length),
      direction: view.direction,
      positions: view.shown.map((p) => ({ step: out(p.step), position: p.values.map(out), inOrbit: p.inOrbit })),
      listedInFull: view.elided === 0n,
    },
    positions: Array.from({ length: tool.cursor + 1 }, (_, k) => tool.values(k).map(out)),
    drawBound: DRAW_MAX,
  };
}
