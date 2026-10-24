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
  parseRelationCode,
  positionOf,
  relationCaption,
  relationParts,
  relationText,
  repCaption,
  relationsOnMain,
  signedCaption,
  stringCaption,
  stringView,
  type OrbitDrawing,
  type OrbitLayers,
  type OrbitVertex,
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
 * The hint of the relation list of an orbit above RELATIONS_MAIN_MAX positions (plan, decisions/P5-A2.md):
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
 * up to RELATIONS_MAIN_MAX positions and in the worker above.
 */
export function routedCalls(spec: string, nodeLabel: number): RoutedCall[] {
  const calls: RoutedCall[] = [];
  const record: Route = (fn, hint) => calls.push({ fn, hint, where: whereToRun(hint as CallHint) });
  const rep = buildRepresentation(resolveBoard(spec), nodeLabel, { route: record, relations: 'later' });
  if (!rep.built) return calls;
  orbitLayers(rep, { route: record });
  const hint = relationsOnMain(rep.orbitSize) ? enumerationHint(rep.board, rep.orbitSize) : relationsHint(rep.board);
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

/**
 * Computes the relation list of a representation on the main thread now: up to RELATIONS_MAIN_MAX positions,
 * or any size with `initial` (the configured state, which never waits for the worker, E-9 and SPEC 7.6),
 * or in Node.
 */
export function relationsNow(rep: Representation, initial = false): void {
  if (!rep.built || rep.checks !== null) return;
  if (!initial && !inNode() && !relationsOnMain(rep.orbitSize)) throw new RangeError(`the relations of ${rep.orbitSize} positions are computed in the worker`);
  addRelations(rep, { route: mainRoute });
}

/**
 * The representation of a node as steps, each to run in a task of its own (SPEC 7.6), filling the cache
 * that representationOf reads: decide (minusculeNodes, orbitSize, legal play), enumerate (minusculeMatrices),
 * sign (signedMoves), and for a node that is not minuscule with a small orbit its relation list (its
 * default relation is its first failing one). After the last step representationOf(spec, label, 'staged')
 * computes nothing.
 */
export function representationSteps(spec: string, nodeLabel: number): (() => void)[] {
  const key = `${spec}|${nodeLabel}`;
  let rep: Representation | undefined;
  const get = (): Representation => {
    rep ??= cache.get(key);
    if (rep === undefined) {
      if (!offersBoard(spec)) throw new RangeError(`T12 does not offer the board ${spec}`);
      rep = startRepresentation(resolveBoard(spec), nodeLabel, { route: mainRoute });
      cache.set(key, rep);
      while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    }
    return rep;
  };
  return [
    () => void get(),
    () => addMatrices(get(), { route: mainRoute }),
    () => addSignedMoves(get(), { route: mainRoute }),
    () => {
      const r = get();
      if (!r.minuscule && relationsOnMain(r.orbitSize)) relationsNow(r);
    },
  ];
}

/**
 * The representation of a node of an offered board (cached, at most CACHE_MAX kept). `relations` says when
 * its list of relations is computed: 'initial' (the configured state of an instance, and every call in
 * Node) computes it now, whatever the size, so that no default state needs the worker (E-9, SPEC 7.6);
 * 'staged' (a state loaded after hydration) computes it now only for a node that is not minuscule with at
 * most RELATIONS_MAIN_MAX positions (its default relation is its first failing one), and leaves the others
 * to the tool: a later task of the main thread up to RELATIONS_MAIN_MAX positions (relationsNow), the
 * worker above (engineCall with relationsHint), so that no task does both the matrices and the relations.
 */
export function representationOf(spec: string, nodeLabel: number, relations: 'initial' | 'staged' = 'initial'): Representation {
  const key = `${spec}|${nodeLabel}`;
  let rep = cache.get(key);
  if (rep !== undefined) cache.delete(key);
  else {
    if (!offersBoard(spec)) throw new RangeError(`T12 does not offer the board ${spec}`);
    rep = startRepresentation(resolveBoard(spec), nodeLabel, { route: mainRoute });
  }
  cache.set(key, rep);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  // The steps a pick left undone (another pick came first) are done here; each returns at once when done.
  addMatrices(rep, { route: mainRoute });
  addSignedMoves(rep, { route: mainRoute });
  if (relations === 'initial' || inNode()) relationsNow(rep, true);
  else if (!rep.minuscule && relationsOnMain(rep.orbitSize)) relationsNow(rep);
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

const orbitViews = new WeakMap<Representation, OrbitView>();

/** The orbit in layers of a built representation, with its layout, kept per representation (main thread, E-9 rule 1). */
export function orbitView(rep: Representation): OrbitView {
  const known = orbitViews.get(rep);
  if (known !== undefined) return known;
  const layers = orbitLayers(rep, { route: mainRoute });
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

/** omega_i as a start in label order: 1 at the node's label, 0 elsewhere (the default start, plan). */
export function omegaStart(board: AnyBoard, nodeLabel: number): number[] {
  return labelOrder(board).map((l) => (l === nodeLabel ? 1 : 0));
}

/** The tool's default state for a board, and a node (default: defaultNode), as a picker sets it (4.0; plan). */
export function defaultsFor(spec: string, nodeLabel?: number): ToolState {
  if (!offersBoard(spec)) throw new RangeError(`T12 does not offer the board ${spec}`);
  const board = resolveBoard(spec);
  const node = nodeLabel ?? defaultNode(board);
  const rep = representationOf(spec, node, 'staged');
  return { schema: 1, tool: 'rep', board: spec, node, relation: defaultRelation(rep), coords: 'numbers', start: omegaStart(board, node), moves: [] };
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

  constructor(cfg: T12Config, opts: { defer?: boolean; relations?: 'initial' | 'staged' } = {}) {
    if (!offersBoard(cfg.board)) throw new RangeError(`T12 does not offer the board ${cfg.board}`);
    this.spec = cfg.board;
    this.board = resolveBoard(cfg.board) as Board<number>;
    if (!this.board.labels.includes(cfg.node)) throw new RangeError(`${cfg.node} is not a label of ${cfg.board}`);
    this.node = cfg.node;
    this.rep = representationOf(cfg.board, cfg.node, opts.relations ?? 'initial');
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
    const view = stringView(board, vector, this.node, { route: mainRoute });
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
    if (k !== null && /^\d+$/.test(k) && Number(k) !== base.node && resolveBoard(base.board as string).labels.includes(Number(k))) base = defaultsFor(base.board as string, Number(k));
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
    const tool = new T12Tool(configOf(state), { defer: true, relations: 'staged' });
    return { state: tool.state(), notice: null };
  } catch {
    return refuse;
  }
}

// ---------------------------------------------------------------------------------------------
// Sentences: captions, announcements, names
// ---------------------------------------------------------------------------------------------

/** The caption of a state with the panel a preset puts first (plan; every number from the engine). */
export function captionOf(tool: T12Tool, first: T12Panel | null, k: number = tool.node): string {
  if (first === 'string') return stringCaption(tool.spec, tool.string());
  if (first === 'relations') return relationCaption(tool.rep, tool.relation);
  if (first === 'signed') return signedCaption(tool.rep, k);
  return repCaption(tool.rep);
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
  return `${tool.spec}, node ${tool.node}: the orbit of ω${tool.node} has ${rep.orbitSize} positions. ${explanation(rep)}`;
}

/** The announcement after a relation was picked (plan): the formula and the verdict. */
export function relationSentence(tool: T12Tool, check: RelationCheck | null): string {
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
export function exportData(tool: T12Tool): Record<string, unknown> {
  const rep = tool.rep;
  const lists = (ms: readonly SparseMatrix[] | null) => (ms === null ? null : inLabelOrder(tool.board, ms).map(entryList));
  const view = tool.string();
  return {
    node: tool.node,
    construction: rep.construction,
    minuscule: rep.minuscule,
    orbitSize: rep.orbitSize,
    built: rep.built,
    dimension: rep.basis?.length ?? null,
    explanation: explanation(rep),
    basis: rep.basis === null ? null : rep.basis.map((v) => inLabelOrder(tool.board, v)),
    E: lists(rep.E),
    F: lists(rep.F),
    H: lists(rep.H),
    moves: lists(rep.moves),
    signedMoves: lists(rep.signed),
    relations: rep.checks === null ? null : rep.checks.map((c) => ({ relation: c.relation, i: toLabels(tool.board, [c.i])[0]!, j: toLabels(tool.board, [c.j])[0]!, holds: c.holds })),
    relation: tool.relation,
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
