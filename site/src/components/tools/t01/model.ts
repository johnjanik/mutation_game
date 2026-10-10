// The model of T1, the Game Board (SPEC.md 4 T1, 4.0, 2.2 to 2.4, 2.6, 6.6, 7.4). Pure functions and
// one small class, no DOM: the view and mode table, the moves each mode allows, the list of positions
// from `start` and `moves` in either coordinates, the populations of a numbers start through
// toPopulation, the fallbacks of the view, the SafeInt-to-Big switch, goals, scripts and rounds.
// Every move goes through the engine (mutate, fire, toNumbers, toPopulation, play, raisingPlay);
// nothing here computes a move by hand. Positions inside, labels outside (E-7): `moves`, `start`
// and everything the reader sees use labels; the engine is called with positions.
import {
  CAPS,
  EngineOverflow,
  fire,
  legalNodes,
  mutate,
  play,
  raisingNodes,
  raisingPlay,
  ratToString,
  toLabels,
  toNumbers,
  toPopulation,
  toPositions,
} from '@two-games/engine';
import type { AnyBoard, Board, PlayResult, Rational } from '@two-games/engine';
import { bigBoard, defaultStart, labelOrder, resolveBoard, type BoardSpec, type ToolState } from '../../../lib/state';

export type View = 'populations' | 'numbers' | 'linked';
export type Mode = 'free' | 'legal' | 'raising';
export type Coords = 'populations' | 'numbers';
export type GameName = 'mutation' | 'firing';

export const VIEWS: readonly View[] = ['populations', 'numbers', 'linked'];
export const MODES: readonly Mode[] = ['free', 'legal', 'raising'];

/** The table of SPEC 4 T1: the modes each view allows. */
export const MODES_OF_VIEW: Readonly<Record<View, readonly Mode[]>> = {
  populations: ['free', 'raising'],
  numbers: ['free', 'legal'],
  linked: ['free', 'legal', 'raising'],
};

/** Words for the mode in force (SPEC 2.3: "The site offers both and always says which is active"). */
export const MODE_TEXT: Readonly<Record<Mode, string>> = {
  free: 'free play',
  legal: 'legal play',
  raising: 'raising moves',
};

export function pairAllowed(view: View, mode: Mode): boolean {
  return MODES_OF_VIEW[view]?.includes(mode) ?? false;
}

/** Throws, naming the instance, when a view and a mode are outside the table (an authoring error). */
export function requirePair(view: View, mode: Mode, instanceId: string): void {
  if (!pairAllowed(view, mode)) {
    throw new Error(`T1 instance "${instanceId || 'board'}": the view ${view} does not allow the mode ${mode} (SPEC 4 T1)`);
  }
}

// ---------------------------------------------------------------------------------------------
// Values as text
// ---------------------------------------------------------------------------------------------

/** A value as the hooks carry it: decimal text (ASCII hyphen) or `p/q` (4.0 Test hooks). */
export type ValueText = string;

/** True when the text is a fraction `p/q` with q > 1. */
export function isFraction(text: string): boolean {
  return text.includes('/');
}

/** The sign of a value text (a fraction's sign is its numerator's). */
export function signOfText(text: string): -1 | 0 | 1 {
  const t = text.trim();
  const num = t.split('/')[0]!;
  if (/^-?0+$/.test(num)) return 0;
  return num.startsWith('-') ? -1 : 1;
}

/** `data-sign` of a node (plan hook): positive, negative or zero. */
export function signWord(text: string): 'positive' | 'negative' | 'zero' {
  const s = signOfText(text);
  return s > 0 ? 'positive' : s < 0 ? 'negative' : 'zero';
}

// ---------------------------------------------------------------------------------------------
// The picker (4.0 Board pickers): the 32 named types grouped by letter. Phase 1 offers no affine board.
// ---------------------------------------------------------------------------------------------

/** The 32 type names of golden_data.json, grouped by letter, by rank within a letter (plan). */
export const PICKER_GROUPS: readonly { letter: string; names: readonly string[] }[] = [
  { letter: 'A', names: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'] },
  { letter: 'B', names: ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'] },
  { letter: 'C', names: ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'] },
  { letter: 'D', names: ['D4', 'D5', 'D6', 'D7', 'D8'] },
  { letter: 'E', names: ['E6', 'E7', 'E8'] },
  { letter: 'F', names: ['F4'] },
  { letter: 'G', names: ['G2'] },
];

export const PICKER_NAMES: readonly string[] = PICKER_GROUPS.flatMap((g) => g.names);

/** The name of a board spec as the reader chose it (D19): `C2` stays `C2`. */
export function boardTitle(spec: BoardSpec): string {
  return typeof spec === 'string' ? spec : `custom board with ${spec.cartan.length} nodes`;
}

// ---------------------------------------------------------------------------------------------
// Configuration and fallbacks (SPEC 4 T1 "Coordinates of the start")
// ---------------------------------------------------------------------------------------------

export interface T1Config {
  board: BoardSpec;
  view?: View;
  mode?: Mode;
  coords?: Coords;
  start?: (number | string)[];
  moves?: number[];
}

/** Default view and mode when a property is absent (plan): the linked view in free play. */
export const DEFAULT_VIEW: View = 'linked';
export const DEFAULT_MODE: Mode = 'free';

/**
 * The view actually drawn (SPEC 4 T1): with `coords: numbers`, a singular Cartan matrix offers only
 * the numbers view (no population; the level-zero population is phase 2 work), and the populations
 * view needs an integral C^{-1} a, falling back to linked otherwise. `population` is toPopulation of
 * the start (null when det C = 0).
 */
export function effectiveView(requested: View, coords: Coords, population: Rational[] | null | undefined): View {
  if (coords !== 'numbers') return requested;
  if (population === null) return 'numbers';
  if (requested === 'populations' && population !== undefined && population.some((r) => r.den !== 1n)) return 'linked';
  return requested;
}

/** The mode kept after a view fallback: a mode the drawn view does not allow becomes free play (plan). */
export function effectiveMode(view: View, mode: Mode): Mode {
  return pairAllowed(view, mode) ? mode : 'free';
}

// ---------------------------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------------------------

/** One position of the play: the numbers always; the population as integers or as rationals. */
export interface Position {
  /** The population in the board's arithmetic, when `coords` is populations. */
  pop: readonly unknown[] | null;
  /** The population C^{-1} a when `coords` is numbers and the view shows populations; null otherwise. */
  frac: readonly Rational[] | null;
  /** The numbers a = C p (populations) or the position itself (numbers). */
  a: readonly unknown[];
}

/** Snapshot of the texts of one position, by position (engine order). */
export interface Shown {
  populations: ValueText[] | null;
  numbers: ValueText[];
}

function entryBig(x: number | string): bigint {
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) throw new RangeError(`${String(x)} is not an integer`);
    return BigInt(x);
  }
  if (!/^-?\d+$/.test(x)) throw new RangeError(`${JSON.stringify(x)} is not an integer`);
  return BigInt(x);
}

function fitsSafe(x: number | string): boolean {
  return Number.isSafeInteger(Number(entryBig(x))) && BigInt(Number(entryBig(x))) === entryBig(x);
}

/** A board whose arithmetic can hold the start: SafeInt boards with a non-safe entry become Big. */
export function boardForStart(board: AnyBoard, start: readonly (number | string)[]): AnyBoard {
  if (start.every(fitsSafe)) return board;
  return bigBoard(board);
}

/** The start (label order) as a vector by position in the board's arithmetic. */
export function startVector(board: AnyBoard, start: readonly (number | string)[]): unknown[] {
  if (start.length !== board.n) throw new RangeError(`the start has ${start.length} entries, but the board has ${board.n} nodes`);
  const positions = toPositions(board, labelOrder(board));
  const b = board as Board<unknown>;
  const big = typeof b.arith.zero === 'bigint';
  const v: unknown[] = new Array(board.n);
  start.forEach((x, k) => {
    v[positions[k]!] = big ? entryBig(x) : b.arith.fromInt(Number(entryBig(x)));
  });
  return v;
}

/** A vector by position as a list in label order (the order of `start`, the table and exports). */
export function inLabelOrder<X>(board: AnyBoard, v: readonly X[]): X[] {
  return toPositions(board, labelOrder(board)).map((p) => v[p]!);
}

// ---------------------------------------------------------------------------------------------
// Goals (SPEC 4 T1 Configuration "goal")
// ---------------------------------------------------------------------------------------------

/** The goal property (plan shape). `text` is the goal line shown to the reader. */
export type Goal =
  | { kind: 'reach'; position: (number | string)[]; game?: GameName; text?: string }
  | { kind: 'no-positive'; text?: string }
  | { kind: 'no-unhappy'; text?: string }
  | { kind: 'predicate'; name: PredicateName; giveUpAfter?: number; giveUpText?: string; text?: string };

/** The short list of named predicates (plan). `mixed-signs`: M1 beat 2. */
export const PREDICATES = {
  /** A population with a negative city while another is positive (SPEC 3 M1 beat 2). */
  'mixed-signs': (s: Shown): boolean => {
    const v = s.populations ?? [];
    return v.some((x) => signOfText(x) < 0) && v.some((x) => signOfText(x) > 0);
  },
} as const;
export type PredicateName = keyof typeof PREDICATES;

export const GOAL_MET_TEXT = 'Goal reached.';

export function defaultGoalText(goal: Goal): string {
  if (goal.text) return goal.text;
  switch (goal.kind) {
    case 'reach':
      return `Goal: reach ${goal.position.join(', ')}.`;
    case 'no-positive':
      return 'Goal: reach a position with no positive number.';
    case 'no-unhappy':
      return 'Goal: make no city unhappy.';
    case 'predicate':
      return `Goal: ${goal.name}.`;
  }
}

/** Whether the goal holds at a shown position (values compared as text, from the engine). */
export function goalMet(goal: Goal, board: AnyBoard, shown: Shown, coords: Coords): boolean {
  switch (goal.kind) {
    case 'reach': {
      const game = goal.game ?? (coords === 'numbers' ? 'firing' : 'mutation');
      const values = game === 'firing' ? shown.numbers : shown.populations;
      if (values === null) return false;
      const want = goal.position.map((x) => String(x));
      const have = inLabelOrder(board, values);
      return want.length === have.length && want.every((w, k) => w === have[k]);
    }
    case 'no-positive':
      return shown.numbers.every((x) => signOfText(x) <= 0);
    case 'no-unhappy':
      return shown.numbers.every((x) => signOfText(x) >= 0);
    case 'predicate': {
      const p = PREDICATES[goal.name];
      if (p === undefined) throw new Error(`T1: unknown goal predicate ${String(goal.name)}`);
      return p(shown);
    }
  }
}

/** The give-up caption after the stated number of moves (M1 beat 2: "the caption says so after 20 moves"). */
export function goalNote(goal: Goal, met: boolean, moves: number): string | null {
  if (met || goal.kind !== 'predicate' || goal.giveUpAfter === undefined) return null;
  if (moves < goal.giveUpAfter) return null;
  return goal.giveUpText ?? `After ${goal.giveUpAfter} moves this goal has not been met: on this board it cannot be.`;
}

// ---------------------------------------------------------------------------------------------
// Script and rounds
// ---------------------------------------------------------------------------------------------

/** The script property (plan shape): moves as labels, each with its caption. */
export type Script = readonly { move: number; caption: string }[];

/**
 * How far the script has gone: the number of its moves that the moves made since `base` follow, or
 * -1 when the reader has acted off the script (which ends it until undo returns to the script).
 */
export function scriptProgress(script: Script, base: number, applied: readonly number[]): number {
  if (applied.length < base) return 0;
  const made = applied.slice(base);
  if (made.length > script.length) return -1;
  for (let k = 0; k < made.length; k++) if (made[k] !== script[k]!.move) return -1;
  return made.length;
}

export const SCRIPT_END_TEXT = 'End of the script.';
export const SCRIPT_OFF_TEXT = 'The script has ended: a move was made that it does not contain.';

/** The caption shown beside "Next": the caption of the next scripted move (plan). */
export function scriptCaption(script: Script, progress: number): string {
  if (progress < 0) return SCRIPT_OFF_TEXT;
  if (progress >= script.length) return SCRIPT_END_TEXT;
  return script[progress]!.caption;
}

/** Complete rounds in the current move list (plan: moves divided by `rounds`, rounded down). */
export function roundCount(moves: number, rounds: number): number {
  if (!Number.isInteger(rounds) || rounds < 1) throw new RangeError(`rounds must be a positive whole number, not ${String(rounds)}`);
  return Math.floor(moves / rounds);
}

// ---------------------------------------------------------------------------------------------
// Panels (SPEC 4 T1 Shows): each arrives with its engine functions.
// ---------------------------------------------------------------------------------------------

export type Panel = 'form' | 'level' | 'colours' | 'lengths';

/**
 * The panels this phase can draw. form (formValue), level (level) and lengths (symmetrizer): phase 2;
 * colours (bipartition): phase 3. Phase 1 has none of these engine functions, so no panel is drawn.
 */
export const PANELS_AVAILABLE: readonly Panel[] = [];

export function panelsToDraw(panels: readonly Panel[] | undefined): Panel[] {
  return (panels ?? []).filter((p) => PANELS_AVAILABLE.includes(p));
}

// ---------------------------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------------------------

export type ActResult =
  | { kind: 'moved'; label: number; position: number }
  | { kind: 'refused'; label: number; position: number; number: ValueText };

export interface PlayOutcome {
  status: PlayResult<unknown>['status'];
  moves: number;
}

/** The arguments of the engine call of "play to the end" (so that the tool can run it in the worker). */
export interface PlayCall {
  fn: 'play' | 'raisingPlay';
  vector: readonly unknown[];
}

/**
 * One instance's play: the start, the move list (labels; it may run past the cursor after an undo,
 * for redo), the cursor, and the list of positions, extended by one engine call per move (7.4).
 */
export class T1Game {
  readonly spec: BoardSpec;
  /** The board in its current arithmetic: a named finite board switches to Big on overflow, silently. */
  board: AnyBoard;
  readonly coords: Coords;
  /** The view the author or the link asked for; written in the state. */
  readonly requestedView: View;
  readonly requestedMode: Mode;
  /** The view and the mode drawn, after the fallbacks of SPEC 4 T1. */
  readonly view: View;
  readonly mode: Mode;
  readonly start: (number | string)[];
  readonly singular: boolean;
  moves: number[];
  cursor: number;
  positions: Position[];

  constructor(config: T1Config) {
    this.spec = config.board;
    const resolved = resolveBoard(config.board);
    this.coords = config.coords ?? 'populations';
    this.requestedView = config.view ?? DEFAULT_VIEW;
    this.requestedMode = config.mode ?? DEFAULT_MODE;
    this.start = [...(config.start ?? defaultStart(resolved, this.coords))];
    this.board = boardForStart(resolved, this.start);
    let population: Rational[] | null | undefined;
    if (this.coords === 'numbers') population = toPopulation(this.board as Board<unknown>, startVector(this.board, this.start));
    this.singular = population === null;
    this.view = effectiveView(this.requestedView, this.coords, population);
    this.mode = effectiveMode(this.view, this.requestedMode);
    this.moves = [];
    this.cursor = 0;
    this.positions = [];
    this.guarded(() => {
      this.positions = [this.initial()];
    });
    const labels = config.moves ?? [];
    if (labels.length > 0) this.appendWord(toPositions(this.board, labels));
  }

  /** Whether the populations are shown (populations or linked view). */
  get showsPopulations(): boolean {
    return this.view !== 'numbers';
  }

  get showsNumbers(): boolean {
    return this.view !== 'populations';
  }

  get n(): number {
    return this.board.n;
  }

  get current(): Position {
    return this.positions[this.cursor]!;
  }

  /** Labels by position. */
  get labels(): readonly number[] {
    return this.board.labels;
  }

  private get b(): Board<unknown> {
    return this.board as Board<unknown>;
  }

  /** Runs `body`, and on EngineOverflow switches to Big, recomputes every position, and runs it again. */
  private guarded<R>(body: () => R): R {
    try {
      return body();
    } catch (e) {
      if (!(e instanceof EngineOverflow) || typeof this.b.arith.zero === 'bigint') throw e;
    }
    this.board = bigBoard(this.board);
    this.recompute();
    return body();
  }

  private initial(): Position {
    const v = startVector(this.board, this.start);
    if (this.coords === 'populations') return { pop: v, frac: null, a: toNumbers(this.b, v) };
    return { pop: null, frac: this.fracOf(v), a: v };
  }

  private fracOf(a: readonly unknown[]): Rational[] | null {
    if (!this.showsPopulations || this.singular) return null;
    return toPopulation(this.b, a);
  }

  /** The position after acting at `k`: mutate (populations) or fire (numbers), then the other record. */
  private after(pos: Position, k: number): Position {
    if (this.coords === 'populations') {
      const p = mutate(this.b, pos.pop!, k);
      return { pop: p, frac: null, a: toNumbers(this.b, p) };
    }
    const a = fire(this.b, pos.a, k);
    return { pop: null, frac: this.fracOf(a), a };
  }

  /** Every position again from the start (after the switch to Big). */
  private recompute(): void {
    const ks = toPositions(this.board, this.moves);
    const out: Position[] = [this.initial()];
    for (const k of ks) out.push(this.after(out[out.length - 1]!, k));
    this.positions = out;
  }

  /** The texts of a position, by position. */
  shownAt(index: number): Shown {
    const pos = this.positions[index]!;
    const show = (x: unknown): string => this.b.arith.show(x);
    let populations: ValueText[] | null = null;
    if (this.showsPopulations) {
      if (pos.pop !== null) populations = pos.pop.map(show);
      else if (pos.frac !== null) populations = pos.frac.map(ratToString);
    }
    return { populations, numbers: pos.a.map(show) };
  }

  get shown(): Shown {
    return this.shownAt(this.cursor);
  }

  /** The positions the mode allows at the current position, increasing (E-5 order). */
  allowedPositions(index = this.cursor): number[] {
    const pos = this.positions[index]!;
    switch (this.mode) {
      case 'free':
        return Array.from({ length: this.n }, (_, k) => k);
      case 'legal':
        return legalNodes(this.b, pos.a);
      case 'raising':
        // A city may be raised where its number (C p)_i is negative (2.4(a)).
        if (pos.pop !== null) return raisingNodes(this.b, pos.pop);
        return Array.from({ length: this.n }, (_, k) => k).filter((k) => this.b.arith.sign(pos.a[k]) < 0);
    }
  }

  /** May act at each position (by position). */
  canAct(index = this.cursor): boolean[] {
    const allowed = new Set(this.allowedPositions(index));
    return Array.from({ length: this.n }, (_, k) => allowed.has(k));
  }

  /** Legal play has ended: no positive number (only in legal mode). */
  get gameOver(): boolean {
    return this.mode === 'legal' && this.allowedPositions().length === 0;
  }

  /** Acts at a position: a move when the mode allows it, else a refusal (nothing changes). */
  act(position: number): ActResult {
    const label = toLabels(this.board, [position])[0]!;
    if (!this.canAct()[position]) {
      return { kind: 'refused', label, position, number: this.b.arith.show(this.current.a[position]) };
    }
    this.appendWord([position]);
    return { kind: 'moved', label, position };
  }

  /** Appends moves (positions) at the cursor, discarding the moves after it; one engine call per move. */
  appendWord(word: readonly number[]): void {
    if (word.length === 0 && this.cursor === this.moves.length) return;
    this.moves = this.moves.slice(0, this.cursor);
    this.positions = this.positions.slice(0, this.cursor + 1);
    const labels = toLabels(this.board, word);
    this.guarded(() => {
      const start = this.moves.length;
      // On a retry after the switch to Big, the moves already appended were recomputed with the rest.
      for (let k = this.positions.length - 1 - start; k < word.length; k++) {
        const next = this.after(this.positions[this.positions.length - 1]!, word[k]!);
        this.positions.push(next);
        this.moves.push(labels[k]!);
      }
    });
    this.cursor = this.moves.length;
  }

  /** The move "step" makes: the lowest allowed position (E-5), or null in free play or at the end. */
  stepPosition(): number | null {
    if (this.mode === 'free') return null;
    return this.allowedPositions()[0] ?? null;
  }

  /** The engine call of "play to the end" from the current position (lowest position first, no choose). */
  playCall(): PlayCall {
    const pos = this.current;
    if (this.mode === 'legal') return { fn: 'play', vector: pos.a };
    if (this.mode === 'raising') {
      if (pos.pop !== null) return { fn: 'raisingPlay', vector: pos.pop };
      // From numbers: the cities with a negative number are the nodes of -a with a positive one;
      // firing is linear, so play on -a makes the same moves.
      return { fn: 'play', vector: pos.a.map((x) => this.b.arith.neg(x)) };
    }
    throw new Error('T1: play to the end is offered only in legal and raising modes');
  }

  /** Runs play to the end on this thread and appends its word. */
  playToEnd(cap: number = CAPS.playMoves): PlayOutcome {
    const result = this.guarded(() => {
      const call = this.playCall();
      return call.fn === 'play' ? play(this.b, call.vector, undefined, cap) : raisingPlay(this.b, call.vector, undefined, cap);
    });
    return this.applyPlay(result);
  }

  /** Appends the word of a play computed elsewhere (the worker) and reports its status. */
  applyPlay(result: { status: PlayOutcome['status']; word: readonly number[] }): PlayOutcome {
    this.appendWord(result.word);
    return { status: result.status, moves: result.word.length };
  }

  undo(): boolean {
    if (this.cursor === 0) return false;
    this.cursor--;
    return true;
  }

  redo(): boolean {
    if (this.cursor >= this.moves.length) return false;
    this.cursor++;
    return true;
  }

  reset(): boolean {
    if (this.moves.length === 0) return false;
    this.moves = [];
    this.positions = [this.positions[0]!];
    this.cursor = 0;
    return true;
  }

  scrub(to: number): boolean {
    if (!Number.isInteger(to) || to < 0 || to > this.moves.length || to === this.cursor) return false;
    this.cursor = to;
    return true;
  }

  /** The moves made up to the cursor (labels). */
  get applied(): number[] {
    return this.moves.slice(0, this.cursor);
  }

  /** The ToolState of the current point of the play (SPEC 6.6): moves up to the cursor, never positions. */
  state(): ToolState {
    return {
      schema: 1,
      tool: 'board',
      board: cloneSpec(this.spec),
      view: this.requestedView,
      mode: this.requestedMode,
      coords: this.coords,
      start: [...this.start],
      moves: this.applied,
    };
  }

  /** What a node would show after acting there (hints): by position, null where the mode forbids it. */
  ghosts(): { populations: (ValueText | null)[] | null; numbers: (ValueText | null)[] } {
    const allowed = this.canAct();
    const pos = this.current;
    const pops: (ValueText | null)[] = [];
    const nums: (ValueText | null)[] = [];
    for (let k = 0; k < this.n; k++) {
      if (!allowed[k]) {
        pops.push(null);
        nums.push(null);
        continue;
      }
      const next = this.guarded(() => this.after(pos, k));
      nums.push(this.b.arith.show(next.a[k]));
      if (next.pop !== null) pops.push(this.b.arith.show(next.pop[k]));
      else if (next.frac !== null) pops.push(ratToString(next.frac[k]!));
      else pops.push(null);
    }
    return { populations: this.showsPopulations ? pops : null, numbers: nums };
  }

  /**
   * The derived tables of "Download data" (6.6): the positions of the current play in label order,
   * both boards' values in the linked view, fractions as p/q, integers as the engine's decimal text.
   */
  derived(): Record<string, unknown> {
    const positions = [];
    for (let k = 0; k <= this.cursor; k++) {
      const s = this.shownAt(k);
      const entry: Record<string, unknown> = { move: k };
      if (s.populations !== null) entry.populations = inLabelOrder(this.board, s.populations).map(exportValue);
      if (this.showsNumbers || s.populations === null) entry.numbers = inLabelOrder(this.board, s.numbers).map(exportValue);
      positions.push(entry);
    }
    return { view: this.view, mode: this.mode, labels: labelOrder(this.board), positions };
  }
}

/** A value for export: a safe integer as a number, anything longer as decimal text, a fraction as p/q. */
export function exportValue(text: ValueText): number | string {
  if (isFraction(text)) return text;
  const big = BigInt(text);
  const n = Number(big);
  return Number.isSafeInteger(n) && BigInt(n) === big ? n : text;
}

function cloneSpec(spec: BoardSpec): BoardSpec {
  if (typeof spec === 'string') return spec;
  const out: { cartan: number[][]; xy?: [number, number][] } = { cartan: spec.cartan.map((r) => [...r]) };
  if (spec.xy) out.xy = spec.xy.map(([x, y]) => [x, y] as [number, number]);
  return out;
}

/** The config of a ToolState (the inverse of T1Game.state()). */
export function configOf(state: ToolState): T1Config {
  const c: T1Config = { board: state.board };
  if (state.view !== undefined) c.view = state.view;
  if (state.mode !== undefined) c.mode = state.mode;
  if (state.coords !== undefined) c.coords = state.coords;
  if (state.start !== undefined) c.start = state.start;
  if (state.moves !== undefined) c.moves = state.moves;
  return c;
}

/** The text a stated limit gives for a play stopped by its cap (5.6; CONTRACTS 5.3). */
export function limitText(outcome: PlayOutcome): string | null {
  return outcome.status === 'cap' ? `still running after ${outcome.moves} moves` : null;
}

/**
 * Checks a script against the mode at build time (plan): every scripted move must be allowed at its
 * turn from the start and the configured moves. Throws an Error naming the instance otherwise.
 */
export function requireScript(config: T1Config, script: Script | undefined, instanceId: string): void {
  if (!script || script.length === 0) return;
  const g = new T1Game(config);
  for (const [k, step] of script.entries()) {
    if (!g.labels.includes(step.move)) {
      throw new Error(`T1 instance "${instanceId || 'board'}": script move ${k + 1} names ${step.move}, which is not a label of the board`);
    }
    const position = toPositions(g.board, [step.move])[0]!;
    if (g.act(position).kind !== 'moved') {
      throw new Error(`T1 instance "${instanceId || 'board'}": script move ${k + 1} (node ${step.move}) is not allowed in ${MODE_TEXT[g.mode]}`);
    }
  }
}
