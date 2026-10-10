// The state object of a tool (SPEC.md 6.6, 7.4, 4.0; CONTRACTS.md 4). Positions are never part of
// the state: they are recomputed from the start and the moves by the engine. Everything outside the
// engine speaks labels (E-7); `start` is in label order and `moves` are labels, converted with
// toPositions and toLabels only.
//
// Engine imports go through the package name '@two-games/engine', the module the '@engine' alias of
// CONTRACTS 1 points at, because the root Vitest project for site/tests/unit does not read the
// tsconfig paths (decisions/P1-A2.md). Only phase-0 engine functions are used; where a phase-1
// function would be cleaner (toNumbers, applyWord) a comment says so.
import {
  Big,
  CAPS,
  EngineOverflow,
  NotABoard,
  SafeInt,
  boardFromName,
  boardKind,
  fire,
  fromAdjacency,
  mutate,
  toPositions,
} from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import { map } from 'nanostores';

export type ToolId =
  | 'board'
  | 'garden'
  | 'form'
  | 'lab'
  | 'numbers'
  | 'mirror'
  | 'symbolic'
  | 'weyl'
  | 'kostant'
  | 'geometry'
  | 'fold'
  | 'rep'
  | 'satake'
  | 'atlas'
  | 'affine'
  | 'sandbox';

/** The ids of the table at the head of SPEC.md section 4, in the order of the tool numbers. */
export const TOOL_IDS: readonly ToolId[] = [
  'board', 'garden', 'form', 'lab', 'numbers', 'mirror', 'symbolic', 'weyl',
  'kostant', 'geometry', 'fold', 'rep', 'satake', 'atlas', 'affine', 'sandbox',
];

export type BoardSpec = string | { cartan: number[][]; xy?: [number, number][] };

/** SPEC.md 6.6, exactly; tool-specific fields optional. No field holds a position (7.4). */
export interface ToolState {
  schema: 1;
  tool: ToolId;
  board: BoardSpec;
  view?: 'populations' | 'numbers' | 'linked';
  mode?: 'free' | 'legal' | 'raising';
  coords?: 'populations' | 'numbers';
  start?: (number | string)[]; // JSON numbers when safe integers, else decimal strings
  moves?: number[]; // labels
  black?: number[];
  tau?: number[];
  rings?: number[];
  projection?: string;
  graph?: 'polytope' | 'moves';
  symmetry?: number[];
  node?: number;
  relation?: string;
  lambda?: number[];
}

/** The fields of ToolState, in the order of the key table of 6.6 (after schema, tool, board). */
export const STATE_FIELDS = [
  'schema', 'tool', 'board', 'view', 'mode', 'coords', 'start', 'moves', 'black', 'tau', 'rings',
  'projection', 'graph', 'symmetry', 'node', 'relation', 'lambda',
] as const;

export type Coords = 'populations' | 'numbers';

// ---------------------------------------------------------------------------------------------
// Integers at the boundary: JSON numbers when safe, decimal strings otherwise (6.6, Data export).
// ---------------------------------------------------------------------------------------------

/** A safe integer as a number, any other integer as its decimal digits. */
export function integerOut(x: number | bigint | string): number | string {
  if (typeof x === 'number') {
    if (Number.isSafeInteger(x)) return x === 0 ? 0 : x;
    if (Number.isInteger(x)) return BigInt(x).toString();
    throw new RangeError(`${String(x)} is not an integer`);
  }
  const big = typeof x === 'bigint' ? x : parseInteger(x);
  const asNumber = Number(big);
  return Number.isSafeInteger(asNumber) && BigInt(asNumber) === big ? asNumber : big.toString();
}

/** Decimal text of an integer to bigint; RangeError unless it matches -?digits. */
export function parseInteger(text: string): bigint {
  if (!/^-?\d+$/.test(text)) throw new RangeError(`${JSON.stringify(text)} is not an integer`);
  return BigInt(text);
}

/** A start entry (number or decimal text) as bigint. */
function entryBig(x: number | string): bigint {
  if (typeof x === 'number') {
    if (!Number.isSafeInteger(x)) throw new RangeError(`${String(x)} is not a safe integer`);
    return BigInt(x);
  }
  return parseInteger(x);
}

// ---------------------------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------------------------

const FINITE_NAME = /^[A-G][1-9]\d*$/;

/**
 * True for a board built by boardFromName from a finite type name: SafeInt arithmetic, or a bigBoard
 * copy of such a board (which keeps the name). Custom boards never count before phase 2 (E-9 rule 2),
 * since resolveBoard gives every custom board Big arithmetic and no name.
 */
export function isNamedFinite(board: AnyBoard): boolean {
  if (board.arith === (SafeInt as unknown)) return true;
  return board.name !== undefined && FINITE_NAME.test(board.name);
}

/** The same board with Big arithmetic: entries as bigint, the same labels, kind and name (plan). */
export function bigBoard(board: AnyBoard): Board<bigint> {
  if (board.arith === (Big as unknown)) return board as Board<bigint>;
  const rows = (board.cartan as readonly (readonly (number | bigint)[])[]).map((row) =>
    Object.freeze(row.map((x) => BigInt(x))),
  );
  const out: Board<bigint> = {
    n: board.n,
    cartan: Object.freeze(rows),
    labels: board.labels,
    kind: board.kind,
    arith: Big,
  };
  if (board.name !== undefined) out.name = board.name;
  return Object.freeze(out);
}

/** A custom board without its name, in Big arithmetic (E-2: every other board uses Big). */
function customBig(board: AnyBoard): Board<bigint> {
  const big = bigBoard(board);
  if (big.name === undefined && board.arith === (Big as unknown)) return big;
  const out: Board<bigint> = { n: big.n, cartan: big.cartan, labels: big.labels, kind: big.kind, arith: Big };
  return Object.freeze(out);
}

/**
 * The board of a BoardSpec (CONTRACTS 4). A name that boardFromName knows as a finite type gives that
 * Board<number> with SafeInt; every other board gives Big (E-2). A custom matrix is checked with
 * boardKind first (not-a-board throws NotABoard), then against the cap of 12 nodes (RangeError
 * "board has more than 12 nodes"). A custom board is Big even when its matrix equals a named type's,
 * has no name, and has labels 1..n in order of creation (E-7). Its `cartan` holds the rows of C;
 * fromAdjacency takes A with A[i][j] = -C[j][i]. An unknown name throws NotABoard.
 */
export function resolveBoard(spec: BoardSpec): AnyBoard {
  if (typeof spec === 'string') return boardFromName(spec);
  if (spec === null || typeof spec !== 'object' || !Array.isArray(spec.cartan)) {
    throw new NotABoard('a custom board needs a cartan matrix');
  }
  const C = spec.cartan;
  if (boardKind(C) === 'not-a-board') throw new NotABoard('the matrix is not a board');
  if (C.length > CAPS.customNodes) throw new RangeError(`board has more than ${CAPS.customNodes} nodes`);
  const n = C.length;
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(i === j ? 0 : -C[j]![i]!);
    A.push(row);
  }
  return customBig(fromAdjacency(A));
}

/** The labels of the board in increasing order: the order of `start`, `s`, `d`, `r`, `t`, `y`. */
export function labelOrder(board: AnyBoard): number[] {
  return [...board.labels].sort((a, b) => a - b);
}

/** Position of each entry of a list given in label order. */
function labelOrderPositions(board: AnyBoard): number[] {
  return toPositions(board, labelOrder(board));
}

/**
 * The default start of SPEC 6.6: "all ones for numbers, one Martian in the first city for
 * populations" (the entry 1 at the first label, 0 elsewhere), in label order.
 */
export function defaultStart(board: AnyBoard, coords: Coords): number[] {
  const n = board.n;
  if (coords === 'numbers') return Array.from({ length: n }, () => 1);
  return Array.from({ length: n }, (_, k) => (k === 0 ? 1 : 0));
}

const POPULATION_TOOLS: readonly ToolId[] = ['board', 'garden', 'kostant'];
const NUMBER_TOOLS: readonly ToolId[] = ['numbers', 'symbolic', 'weyl', 'mirror', 'affine', 'sandbox'];

/** The coords a game tool starts in (plan), or null for a tool that holds no game. */
export function defaultCoords(tool: ToolId): Coords | null {
  if (POPULATION_TOOLS.includes(tool)) return 'populations';
  if (NUMBER_TOOLS.includes(tool)) return 'numbers';
  return null;
}

/**
 * The fallback state of a tool route: { schema: 1, tool, board }, plus coords, start and moves: []
 * for the game tools, and view 'populations' with mode 'raising' for T9. A tool's own defaults (its
 * props and presets) always override this.
 */
export function defaultState(tool: ToolId, board: BoardSpec): ToolState {
  const state: ToolState = { schema: 1, tool, board: cloneSpec(board) };
  const coords = defaultCoords(tool);
  if (coords !== null) {
    state.coords = coords;
    state.start = defaultStart(resolveBoard(board), coords);
    state.moves = [];
  }
  if (tool === 'kostant') {
    state.view = 'populations';
    state.mode = 'raising';
  }
  return state;
}

function cloneSpec(spec: BoardSpec): BoardSpec {
  if (typeof spec === 'string') return spec;
  const out: { cartan: number[][]; xy?: [number, number][] } = { cartan: spec.cartan.map((r) => [...r]) };
  if (spec.xy) out.xy = spec.xy.map(([x, y]) => [x, y] as [number, number]);
  return out;
}

/** A deep copy of a state holding only the fields of ToolState (never positions, never options). */
export function cloneState(state: ToolState): ToolState {
  const out: Record<string, unknown> = {};
  for (const key of STATE_FIELDS) {
    const v = (state as unknown as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (key === 'board') out.board = cloneSpec(v as BoardSpec);
    else out[key] = Array.isArray(v) ? [...v] : v;
  }
  return out as unknown as ToolState;
}

// ---------------------------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------------------------

/**
 * The start as a vector in positions, in the board's arithmetic, or null when an entry does not fit
 * the arithmetic (a non-safe entry on a SafeInt board).
 */
function startVector<T>(board: Board<T>, start: readonly (number | string)[]): T[] | null {
  if (start.length !== board.n) {
    throw new RangeError(`the start has ${start.length} entries, but the board has ${board.n} nodes`);
  }
  const positions = labelOrderPositions(board as AnyBoard);
  const v: T[] = new Array(board.n);
  for (let k = 0; k < board.n; k++) {
    const big = entryBig(start[k]!);
    let x: T;
    if (board.arith === (Big as unknown)) x = big as unknown as T;
    else {
      const asNumber = Number(big);
      if (!Number.isSafeInteger(asNumber)) return null;
      x = board.arith.fromInt(asNumber);
    }
    v[positions[k]!] = x;
  }
  return v;
}

/** A vector in positions back to label order, by the integer rule. */
function outInLabelOrder<T>(board: Board<T>, v: readonly T[]): (number | string)[] {
  const positions = labelOrderPositions(board as AnyBoard);
  return positions.map((p) => integerOut(board.arith.toBig(v[p]!)));
}

/** Runs `body` on the board's arithmetic, again on bigBoard when it overflows (SafeInt to Big, T1). */
function withOverflowFallback<R>(board: AnyBoard, body: (b: Board<unknown>) => R | null): R {
  if (board.arith === (SafeInt as unknown)) {
    try {
      const r = body(board as Board<unknown>);
      if (r !== null) return r;
    } catch (e) {
      if (!(e instanceof EngineOverflow)) throw e;
    }
  }
  const r = body(bigBoard(board) as Board<unknown>);
  if (r === null) throw new RangeError('the start does not fit the arithmetic');
  return r;
}

/** The start of a state, or the default start for its coords. */
function startOf(board: AnyBoard, state: ToolState): (number | string)[] {
  return state.start ?? defaultStart(board, state.coords ?? 'populations');
}

/**
 * The start and every position after each move, recomputed by the engine in the game of `coords`
 * (`populations`: mutate; `numbers`: fire), in label order, entries by the integer rule.
 * This is for LOADING a state (a link, a preset): while a tool runs it keeps the list of positions in
 * memory and extends it by one position per move (7.4). Long lists run in the worker (E-9 rule 2).
 * On a named finite board a start or a play that leaves the safe range is replayed with Big (T1).
 * `coords` absent counts as populations. An unknown label throws RangeError.
 */
export function positionsOf(state: ToolState): (number | string)[][] {
  const board = resolveBoard(state.board);
  const moves = toPositions(board, state.moves ?? []);
  const start = startOf(board, state);
  const game = (state.coords ?? 'populations') === 'numbers' ? 'firing' : 'mutation';
  return withOverflowFallback(board, (b) => {
    const v0 = startVector(b, start);
    if (v0 === null) return null;
    const out: (number | string)[][] = [outInLabelOrder(b, v0)];
    let v: readonly unknown[] = v0;
    // Phase 1 has applyWord; this loop keeps one engine call per move and the list of every position.
    for (const i of moves) {
      v = game === 'firing' ? fire(b, v, i) : mutate(b, v, i);
      out.push(outInLabelOrder(b, v));
    }
    return out;
  });
}

/** a = C p, in positions (phase 1 has toNumbers; this keeps to phase-0 functions). */
function numbersFromPopulation<T>(board: Board<T>, p: readonly T[]): T[] {
  const { arith, cartan } = board;
  return cartan.map((row) => row.reduce((acc, c, j) => arith.add(acc, arith.mul(c, p[j]!)), arith.zero));
}

/**
 * The index of the first move of `state.moves` that the mode in force forbids at that point of the
 * play, or null when every move is allowed (SPEC 6.6 Validation, rule 6). Mode `free` or absent:
 * every move. `legal`: the node's number is positive. `raising`: the node's number is negative. The
 * numbers are the start itself when coords is `numbers`, and a = Cp when it is `populations`; they are
 * kept current by `fire`, which changes them exactly as mutating city i changes Cp (SPEC 2.4), so the
 * check stays in integers. A non-safe start or an overflow is replayed with Big, never a failure.
 * Exported again from urlCodec.ts (plan name); it lives here so that the worker can run it without
 * importing the tool registry.
 */
export function firstForbiddenMove(board: AnyBoard, state: ToolState): number | null {
  const mode = state.mode ?? 'free';
  const moves = state.moves ?? [];
  if (mode === 'free' || moves.length === 0) return null;
  const positions = toPositions(board, moves);
  const start = startOf(board, state);
  const fromNumbers = (state.coords ?? 'populations') === 'numbers';
  return withOverflowFallback(board, (b) => {
    const v0 = startVector(b, start);
    if (v0 === null) return null;
    let a: readonly unknown[] = fromNumbers ? v0 : numbersFromPopulation(b, v0);
    for (let k = 0; k < positions.length; k++) {
      const i = positions[k]!;
      const sign = b.arith.sign(a[i]!);
      if (mode === 'legal' ? sign <= 0 : sign >= 0) return { index: k };
      a = fire(b, a, i);
    }
    return { index: null };
  }).index;
}

// ---------------------------------------------------------------------------------------------
// Linked tools (7.4 "Two tools share state only when the page says so with a linkTo property")
// ---------------------------------------------------------------------------------------------

/** One Nano Store map per page: instance id to the ToolState it last published. Never positions. */
const published = map<Record<string, ToolState>>({});

/** Publishes the state of an instance to its followers (a copy holding only ToolState's fields). */
export function publishToolState(instanceId: string, state: ToolState): void {
  published.setKey(instanceId, cloneState(state));
}

/**
 * Follows the instance `instanceId`: `onChange` receives a copy of each ToolState it publishes (and
 * at once the last one, when it has already published), from which the follower recomputes its own
 * positions. The returned function stops the updates.
 */
export function followToolState(instanceId: string, onChange: (state: ToolState) => void): () => void {
  const current = published.get()[instanceId];
  if (current !== undefined) onChange(cloneState(current));
  return published.listen((value, _old, changedKey) => {
    if (changedKey !== instanceId) return;
    const next = value[instanceId];
    if (next !== undefined) onChange(cloneState(next));
  });
}

/** Clears the published states (tests, and a page that is torn down). */
export function clearPublishedStates(): void {
  published.set({});
}
