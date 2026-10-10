// The URL form of a tool's state and its validation (SPEC.md 6.6 "URL form" and "Validation";
// CONTRACTS.md 4). The query string is assembled by hand so that commas, semicolons, dots, `~` and
// `^` stay readable, and is parsed with URLSearchParams. Only the sixteen fields of the key table are
// written; a link carries no site version. Any failure of 6.6 loads the instance's defaults with the
// notice LINK_NOTICE, and nothing of the link is applied.
import { CAPS, boardKind } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import {
  cloneState,
  defaultStart,
  firstForbiddenMove,
  labelOrder,
  resolveBoard,
  integerOut,
  type BoardSpec,
  type Coords,
  type ToolId,
  type ToolState,
} from './state';
import { boardsOffered } from '../tools/index';
import { whereToRun } from './worker';

export { firstForbiddenMove };

/** The notice of a link that could not be read (plan wording; 6.6 fixes only the meaning). */
export const LINK_NOTICE = 'The link could not be read, so the tool shows its default state.';

/**
 * How rule 6 is checked on a link of more than 2000 moves (plan, a deviation pending MERGE):
 * 'sync' is the contract reading (decodeState replays every list of up to 20000 moves itself);
 * 'worker' marks a long list with `replayCheck: true` for the tool to check in the worker (E-9 rule 2).
 */
export const LONG_LIST_REPLAY: 'sync' | 'worker' = 'sync';

/** The keys of 6.6 in the order they are written (plan): z first, then the order of the key table. */
const KEY_ORDER = ['z', 'g', 'v', 'm', 'c', 's', 'w', 'x', 't', 'r', 'j', 'e', 'y', 'k', 'q', 'd'] as const;
type Key = (typeof KEY_ORDER)[number];
const KEYS: ReadonlySet<string> = new Set(KEY_ORDER);

const VIEW_CODE = { populations: 'p', numbers: 'n', linked: 'l' } as const;
const MODE_CODE = { free: 'f', legal: 'l', raising: 'r' } as const;
const COORDS_CODE = { populations: 'p', numbers: 'n' } as const;
const GRAPH_CODE = { polytope: 'p', moves: 'm' } as const;

function invert<T extends Record<string, string>>(o: T): Record<string, keyof T> {
  const out: Record<string, keyof T> = {};
  for (const [k, v] of Object.entries(o)) out[v] = k;
  return out;
}
const VIEW_OF = invert(VIEW_CODE);
const MODE_OF = invert(MODE_CODE);
const COORDS_OF = invert(COORDS_CODE);
const GRAPH_OF = invert(GRAPH_CODE);

/** The T1 table of views and modes (SPEC 4 T1). */
const MODES_OF_VIEW: Record<'populations' | 'numbers' | 'linked', readonly string[]> = {
  populations: ['free', 'raising'],
  numbers: ['free', 'legal'],
  linked: ['free', 'legal', 'raising'],
};

const RELATIONS = ['hh', 'he', 'hf', 'ef', 'serre-e', 'serre-f'] as const;

/** 'b2' and 'b2.' both give 'b2.'; empty or absent gives bare keys. */
export function normalisePrefix(prefix: string | undefined): string {
  if (!prefix) return '';
  return prefix.endsWith('.') ? prefix : `${prefix}.`;
}

/** Escapes only what would break a query: & = # % + and space (no valid value holds them). */
function escapeValue(text: string): string {
  return text.replace(/[&=#%+ ]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

/** The text of `g`: a name, or c: rows ; entries , and optionally @ grid coordinates. */
export function encodeBoard(board: BoardSpec): string {
  if (typeof board === 'string') return board;
  let text = `c:${board.cartan.map((row) => row.join(',')).join(';')}`;
  if (board.xy && board.xy.length > 0) text += `@${board.xy.map((p) => p.join(',')).join(';')}`;
  return text;
}

/**
 * The query string of a state, without '?' (SPEC 6.6). `opts.prefix` is the instance id and a dot
 * on a lesson page ('b2.' or 'b2'); bare keys otherwise. Keys in the order z g v m c s w x t r j e y
 * k q d; a key is written only when its field is present; options outside schema 1 never are.
 */
export function encodeState(state: ToolState, opts?: { prefix?: string }): string {
  const prefix = normalisePrefix(opts?.prefix);
  const values: Partial<Record<Key, string>> = {};
  values.z = '1';
  values.g = encodeBoard(state.board);
  if (state.view !== undefined) values.v = VIEW_CODE[state.view];
  if (state.mode !== undefined) values.m = MODE_CODE[state.mode];
  if (state.coords !== undefined) values.c = COORDS_CODE[state.coords];
  if (state.start !== undefined) values.s = state.start.map((x) => String(integerOut(x))).join(',');
  if (state.moves !== undefined) values.w = state.moves.join('.');
  if (state.black !== undefined) values.x = state.black.join('.');
  if (state.tau !== undefined) values.t = state.tau.join('.');
  if (state.rings !== undefined) values.r = state.rings.join('.');
  if (state.projection !== undefined) values.j = state.projection;
  if (state.graph !== undefined) values.e = GRAPH_CODE[state.graph];
  if (state.symmetry !== undefined) values.y = state.symmetry.join('.');
  if (state.node !== undefined) values.k = String(state.node);
  if (state.relation !== undefined) values.q = state.relation;
  if (state.lambda !== undefined) values.d = state.lambda.join(',');
  const parts: string[] = [];
  for (const key of KEY_ORDER) {
    const v = values[key];
    if (v !== undefined) parts.push(`${prefix}${key}=${escapeValue(v)}`);
  }
  return parts.join('&');
}

// ---------------------------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------------------------

/** Thrown inside the decoder when the link breaks a rule of 6.6; `rule` is its number in the list. */
class LinkError extends Error {
  constructor(readonly rule: number, message: string) {
    super(message);
  }
}

const INT = /^-?\d+$/;
const NONNEG = /^\d+$/;
const NUMBER = /^-?\d+(\.\d+)?$/;

function fail(rule: number, message: string): never {
  throw new LinkError(rule, message);
}

/** Splits a list; an empty token inside (`1..2`, `1,,2`) or an empty list where one is needed does not parse. */
function tokens(text: string, sep: string, rule = 1): string[] {
  const parts = text.split(sep);
  if (parts.some((p) => p === '')) fail(rule, `empty entry in ${JSON.stringify(text)}`);
  return parts;
}

function intToken(t: string): number {
  if (!INT.test(t)) fail(1, `${JSON.stringify(t)} is not an integer`);
  const n = Number(t);
  if (!Number.isSafeInteger(n)) fail(1, `${t} is not a safe integer`);
  return n;
}

function labelList(text: string): number[] {
  return text === '' ? [] : tokens(text, '.').map(intToken);
}

function requireLabels(board: AnyBoard, labels: readonly number[], key: string): void {
  for (const l of labels) if (!board.labels.includes(l)) fail(10, `${key}: ${l} is not a label of the board`);
}

function requireLength(board: AnyBoard, list: readonly unknown[], key: string): void {
  if (list.length !== board.n) fail(9, `${key} has ${list.length} entries, but the board has ${board.n} nodes`);
}

/** Parses the text of `g` into a BoardSpec (rule 1 for the syntax; the board itself is rule 2). */
function parseBoard(text: string): BoardSpec {
  if (text === '') fail(1, 'g is empty');
  if (!text.startsWith('c:')) {
    if (!/^[A-Za-z0-9~^()_-]+$/.test(text)) fail(1, `${JSON.stringify(text)} is not a board name`);
    return text;
  }
  const body = text.slice(2);
  const at = body.indexOf('@');
  const matrixText = at < 0 ? body : body.slice(0, at);
  const rows = tokens(matrixText, ';').map((row) => tokens(row, ',').map((t) => {
    if (!INT.test(t)) fail(1, `${JSON.stringify(t)} is not an integer`);
    return Number(t);
  }));
  const width = rows[0]!.length;
  if (rows.some((r) => r.length !== width)) fail(1, 'the rows of the matrix differ in length');
  const spec: { cartan: number[][]; xy?: [number, number][] } = { cartan: rows };
  if (at >= 0) {
    // Coordinates that do not parse as n pairs spoil only the layout: they are dropped, no notice.
    const xyText = body.slice(at + 1);
    const pairs = xyText.split(';').map((p) => p.split(','));
    if (pairs.length === rows.length && pairs.every((p) => p.length === 2 && p.every((x) => NUMBER.test(x)))) {
      spec.xy = pairs.map((p) => [Number(p[0]), Number(p[1])] as [number, number]);
    }
  }
  return spec;
}

/** Rule 2 on a parsed spec: not-a-board, more than 12 nodes, or a name the engine does not know. */
function boardOf(spec: BoardSpec): AnyBoard {
  if (typeof spec !== 'string') {
    if (boardKind(spec.cartan) === 'not-a-board') fail(2, 'not a board');
    if (spec.cartan.length > CAPS.customNodes) fail(2, `more than ${CAPS.customNodes} nodes`);
  }
  try {
    return resolveBoard(spec);
  } catch (e) {
    return fail(2, e instanceof Error ? e.message : 'not a board');
  }
}

function sameBoardSpec(a: BoardSpec, b: BoardSpec): boolean {
  return encodeBoard(a) === encodeBoard(b);
}

/** Start entries: integers, at most 40 digits each (rule 4 is checked earlier, on the raw text). */
function startList(text: string): (number | string)[] {
  return tokens(text, ',').map((t) => {
    if (!INT.test(t)) fail(1, `${JSON.stringify(t)} is not an integer`);
    return integerOut(t);
  });
}

/** Rule 7: a permutation of the labels that keeps every entry of C; for `t` also an involution. */
function requireSymmetry(board: AnyBoard, images: readonly number[], key: 't' | 'y'): void {
  const order = labelOrder(board);
  const seen = new Set<number>();
  for (const l of images) {
    if (!board.labels.includes(l) || seen.has(l)) fail(7, `${key} is not a permutation of the labels`);
    seen.add(l);
  }
  // sigma as positions: the node with the k-th label goes to the node labelled images[k].
  const pos = (label: number): number => board.labels.indexOf(label);
  const sigma: number[] = new Array(board.n);
  order.forEach((label, k) => {
    sigma[pos(label)] = pos(images[k]!);
  });
  const C = board.cartan as readonly (readonly (number | bigint)[])[];
  for (let i = 0; i < board.n; i++) {
    for (let j = 0; j < board.n; j++) {
      if (String(C[sigma[i]!]![sigma[j]!]) !== String(C[i]![j])) fail(7, `${key} is not a symmetry of the board`);
    }
  }
  if (key === 't') {
    for (let i = 0; i < board.n; i++) if (sigma[sigma[i]!] !== i) fail(7, 't is not an involution');
  }
}

const PROJECTION = /^(coxeter|xyz:(\d+),(\d+),(\d+))(@(-?\d+),(-?\d+),(-?\d+))?$/;
const RELATION = /^(hh|he|hf|ef|serre-e|serre-f):(-?\d+),(-?\d+)$/;

export interface DecodeResult {
  state: ToolState;
  notice: string | null;
  /** Present only under the 'worker' reading: rule 6 is left to the tool's worker replay. */
  replayCheck?: true;
}

/**
 * Reads the state of one instance from a query string (SPEC 6.6). Absent keys keep `defaults`;
 * unknown keys (and keys of other instances) are ignored; any failure gives `{ state: defaults,
 * notice: LINK_NOTICE }`. `defaults` is never mutated.
 */
export function decodeState(search: string, tool: ToolId, defaults: ToolState, opts?: { prefix?: string }): { state: ToolState; notice: string | null } {
  return decodeStateWith(search, tool, defaults, { prefix: opts?.prefix, longListReplay: LONG_LIST_REPLAY });
}

/** decodeState with the long-list reading made explicit (plan; used by decodeState and by tests). */
export function decodeStateWith(
  search: string,
  tool: ToolId,
  defaults: ToolState,
  opts?: { prefix?: string; longListReplay?: 'sync' | 'worker' },
): DecodeResult {
  try {
    return decodeOrThrow(search, tool, defaults, normalisePrefix(opts?.prefix), opts?.longListReplay ?? LONG_LIST_REPLAY);
  } catch (e) {
    if (e instanceof LinkError) return { state: cloneState(defaults), notice: LINK_NOTICE };
    // Anything the engine throws on a link is a link that could not be read, too.
    return { state: cloneState(defaults), notice: LINK_NOTICE };
  }
}

function decodeOrThrow(search: string, tool: ToolId, defaults: ToolState, prefix: string, longListReplay: 'sync' | 'worker'): DecodeResult {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw: Partial<Record<Key, string>> = {};
  for (const [name, value] of params) {
    if (!name.startsWith(prefix)) continue;
    const key = name.slice(prefix.length);
    if (!KEYS.has(key)) continue; // unknown keys, and keys of other instances, are ignored
    if (raw[key as Key] !== undefined) fail(1, `the key ${name} is given twice`);
    raw[key as Key] = value;
  }
  if (Object.keys(raw).length === 0) return { state: cloneState(defaults), notice: null };

  // Length checks on the raw text, before any parsing work (rules 3, 5, 4).
  if (raw.g !== undefined && raw.g.length > 512) fail(3, 'g is longer than 512 characters');
  if (raw.w !== undefined && raw.w !== '') {
    let count = 1;
    for (let k = 0; k < raw.w.length; k++) if (raw.w.charCodeAt(k) === 46) count++;
    if (count > CAPS.linkMoves) fail(5, `more than ${CAPS.linkMoves} moves`);
  }
  if (raw.s !== undefined) {
    for (const t of raw.s.split(',')) if (t.replace(/^-/, '').length > 40) fail(4, 'a start entry is longer than 40 digits');
  }

  // Schema (rule 13; a missing z is schema 1).
  if (raw.z !== undefined) {
    if (!INT.test(raw.z)) fail(1, 'z is not an integer');
    if (raw.z !== '1') fail(13, `unknown schema ${raw.z}`);
  }

  const state = cloneState(defaults);
  let board: AnyBoard;
  if (raw.g !== undefined) {
    const spec = parseBoard(raw.g);
    board = boardOf(spec);
    const offered = boardsOffered(tool);
    if (offered !== 'all' && (typeof spec !== 'string' || !offered.includes(spec))) fail(8, 'the tool does not offer this board');
    if (!sameBoardSpec(spec, defaults.board)) {
      // As a picker does (4.0): start and moves go back to the tool's defaults for the new board, and
      // the tool-specific lists of the old board are dropped (plan).
      state.board = spec;
      if (state.start !== undefined) state.start = defaultStart(board, state.coords ?? 'populations');
      if (state.moves !== undefined) state.moves = [];
      for (const f of ['black', 'tau', 'rings', 'symmetry', 'node', 'relation', 'lambda'] as const) delete state[f];
    } else {
      state.board = spec; // the same board; keeps the link's xy when it has one
    }
  } else {
    board = boardOf(state.board);
  }

  if (raw.v !== undefined) {
    const v = VIEW_OF[raw.v];
    if (v === undefined) fail(1, `v=${raw.v}`);
    state.view = v;
  }
  if (raw.m !== undefined) {
    const m = MODE_OF[raw.m];
    if (m === undefined) fail(1, `m=${raw.m}`);
    state.mode = m;
  }
  if (raw.c !== undefined) {
    const c = COORDS_OF[raw.c] as Coords | undefined;
    if (c === undefined) fail(1, `c=${raw.c}`);
    state.coords = c;
    if (raw.s === undefined) state.start = defaultStart(board, c);
  }
  if (raw.e !== undefined) {
    const e = GRAPH_OF[raw.e];
    if (e === undefined) fail(1, `e=${raw.e}`);
    state.graph = e;
  }
  if (raw.s !== undefined) {
    const start = startList(raw.s);
    if (raw.c === undefined) fail(12, 's without c');
    requireLength(board, start, 's');
    state.start = start;
  }
  if (raw.d !== undefined) {
    const lambda = tokens(raw.d, ',').map(intToken);
    requireLength(board, lambda, 'd');
    state.lambda = lambda;
  }
  if (raw.w !== undefined) {
    const moves = labelList(raw.w);
    requireLabels(board, moves, 'w');
    state.moves = moves;
  }
  if (raw.x !== undefined) {
    const black = labelList(raw.x);
    requireLabels(board, black, 'x');
    state.black = black;
  }
  if (raw.t !== undefined) {
    const tau = tokens(raw.t, '.').map(intToken);
    requireLength(board, tau, 't');
    requireSymmetry(board, tau, 't');
    state.tau = tau;
  }
  if (raw.y !== undefined) {
    const symmetry = tokens(raw.y, '.').map(intToken);
    requireLength(board, symmetry, 'y');
    requireSymmetry(board, symmetry, 'y');
    state.symmetry = symmetry;
  }
  if (raw.r !== undefined) {
    const rings = tokens(raw.r, '.').map((t) => {
      if (!NONNEG.test(t)) fail(1, `${JSON.stringify(t)} is not a non-negative integer`);
      return intToken(t);
    });
    requireLength(board, rings, 'r');
    state.rings = rings;
  }
  if (raw.j !== undefined) {
    const m = PROJECTION.exec(raw.j);
    if (m === null) fail(1, `j=${raw.j}`);
    if (m[2] !== undefined) {
      const axes = [m[2], m[3], m[4]].map(Number);
      if (new Set(axes).size !== 3 || axes.some((a) => a < 1 || a > board.n)) fail(1, `j=${raw.j}`);
    }
    state.projection = raw.j;
  }
  if (raw.k !== undefined) {
    const node = intToken(raw.k);
    requireLabels(board, [node], 'k');
    state.node = node;
  }
  if (raw.q !== undefined) {
    const m = RELATION.exec(raw.q);
    if (m === null || !(RELATIONS as readonly string[]).includes(m[1]!)) fail(1, `q=${raw.q}`);
    requireLabels(board, [intToken(m[2]!), intToken(m[3]!)], 'q');
    state.relation = raw.q;
  }

  // Rule 11 on the effective state.
  if (state.view !== undefined && state.mode !== undefined && !MODES_OF_VIEW[state.view].includes(state.mode)) {
    fail(11, `view ${state.view} does not allow mode ${state.mode}`);
  }
  // Rule 9 on the effective start (defaults' start on a new board was reset above).
  if (state.start !== undefined) requireLength(board, state.start, 's');

  // Rule 6: replay with the engine and check each move before making it.
  const n = state.moves?.length ?? 0;
  if (n > 0 && state.mode !== undefined && state.mode !== 'free') {
    if (longListReplay === 'worker' && whereToRun({ board, kind: 'play', moves: n }) === 'worker') {
      return { state, notice: null, replayCheck: true };
    }
    if (firstForbiddenMove(board, state) !== null) fail(6, 'a move the mode forbids');
  }
  return { state, notice: null };
}
