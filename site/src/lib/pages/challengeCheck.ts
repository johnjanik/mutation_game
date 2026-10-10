// The checks of the lesson component Challenge (P1-A4; SPEC.md 8.2 item 6, 8.5, 9.2). A check is a
// plain, serialisable object, because Astro island props cannot carry functions: a lesson writes
// <Challenge client:visible for="b9" check={{ kind: 'reach', board: 'populations', values: [1, 2, 1] }} .../>
// and Challenge.svelte observes the tool through the hooks of SPEC.md 4.0 only (data-tool,
// data-moves, data-node, data-board, data-value, data-out). `evaluate` is pure, so every kind is
// unit-tested without a browser.
//
// This module reaches the browser inside Challenge.svelte: it must never import @lib/golden,
// @lib/sources, @lib/unverifiedRegistry or the engine at run time (the engine is passed in by the
// component, which loads it only for the `input` kind).
import type { AnyBoard, Board } from '@engine';

export type BoardView = 'populations' | 'numbers';

/** The predicates the `input` kind accepts. Others are added on a lesson agent's request. */
export const INPUT_PREDICATES = ['fixed-by-every-mutation'] as const;
export type InputPredicate = (typeof INPUT_PREDICATES)[number];

export type ChallengeCheck =
  /** Met when the tool's output [data-out=name] has non-empty text, or text equal to `equals`. */
  | { kind: 'out'; name: string; equals?: string }
  /** Met when the values of that board, in increasing label order, equal `values` (8.5 "Reach a target", "Reach by raising"), within `maxMoves` moves when given. */
  | { kind: 'reach'; board: BoardView; values: (number | string)[]; maxMoves?: number }
  /** Met when at least `count` distinct value vectors have been shown on that board since the page loaded. */
  | { kind: 'distinct'; board: BoardView; count: number }
  /** The reader types a population; met when the predicate accepts it. */
  | { kind: 'input'; predicate: InputPredicate; board: string }
  /** Met when the values of that board hold a positive and a negative entry at once (8.5 "Find a counterexample"). */
  | { kind: 'mixed-signs'; board: BoardView }
  /** 8.5 "Explain": a free-text box that is not graded. Never reports success. */
  | { kind: 'explain' };

export interface NodeReading {
  /** data-node: the node's label. */
  label: number;
  /** data-board: populations or numbers. */
  board: string;
  /** data-value: decimal text, or p/q. */
  value: string;
}

/** What Challenge.svelte has read from the tool's hooks. */
export interface Observation {
  outs: Record<string, string>;
  nodes: NodeReading[];
  /** data-moves of the tool root, or null when absent. */
  moves: number | null;
  /** Distinct value vectors seen on each board since the page loaded. */
  seen: Record<BoardView, number>;
  /** For the input kind: whether the predicate accepted the reader's last vector. */
  inputAccepted: boolean;
}

/** The sentence shown and announced once when a check is met (plan). */
export const SUCCESS_TEXT = 'Goal reached.';

/** Values are compared as decimal text after mapping the true minus U+2212 to `-` (SPEC.md 6.3, 4.0). */
export function normaliseValue(text: string | number | bigint): string {
  return String(text).replace(/−/g, '-').replace(/\s+/g, '');
}

/** The values shown on one board, in increasing label order, normalised. */
export function valuesOf(nodes: readonly NodeReading[], board: BoardView): string[] {
  return nodes
    .filter((n) => n.board === board)
    .slice()
    .sort((a, b) => a.label - b.label)
    .map((n) => normaliseValue(n.value));
}

/** A key for a vector of values, used to count distinct vectors. */
export function vectorKey(values: readonly string[]): string {
  return values.join(',');
}

/** The sign of a decimal or p/q value; NaN text counts as 0. */
export function signOf(value: string): -1 | 0 | 1 {
  const v = normaliseValue(value);
  const num = v.split('/')[0] ?? '';
  if (!/^-?\d+$/.test(num) || /^-?0+$/.test(num)) return 0;
  return num.startsWith('-') ? -1 : 1;
}

/** Whether the check is met by the observation. */
export function evaluate(check: ChallengeCheck, obs: Observation): boolean {
  switch (check.kind) {
    case 'out': {
      const text = obs.outs[check.name];
      if (text === undefined) return false;
      if (check.equals !== undefined) return normaliseValue(text) === normaliseValue(check.equals);
      return text.trim() !== '';
    }
    case 'reach': {
      const shown = valuesOf(obs.nodes, check.board);
      const want = check.values.map(normaliseValue);
      if (shown.length === 0 || shown.length !== want.length) return false;
      if (!shown.every((v, i) => v === want[i])) return false;
      if (check.maxMoves !== undefined) return obs.moves !== null && obs.moves <= check.maxMoves;
      return true;
    }
    case 'distinct':
      return obs.seen[check.board] >= check.count;
    case 'input':
      return obs.inputAccepted;
    case 'mixed-signs': {
      const signs = valuesOf(obs.nodes, check.board).map(signOf);
      return signs.includes(1) && signs.includes(-1);
    }
    case 'explain':
      return false;
  }
}

/** Checks the shape of a check given as an island prop; throws with a message naming the problem. */
export function validateCheck(check: unknown): ChallengeCheck {
  const c = check as Record<string, unknown> | null;
  const isView = (v: unknown): v is BoardView => v === 'populations' || v === 'numbers';
  if (!c || typeof c !== 'object') throw new Error('Challenge: check must be an object');
  switch (c.kind) {
    case 'out':
      if (typeof c.name === 'string' && c.name !== '' && (c.equals === undefined || typeof c.equals === 'string')) return c as ChallengeCheck;
      break;
    case 'reach':
      if (isView(c.board) && Array.isArray(c.values) && c.values.length > 0 && (c.maxMoves === undefined || Number.isInteger(c.maxMoves))) return c as ChallengeCheck;
      break;
    case 'distinct':
      if (isView(c.board) && Number.isInteger(c.count) && (c.count as number) > 0) return c as ChallengeCheck;
      break;
    case 'input':
      if ((INPUT_PREDICATES as readonly unknown[]).includes(c.predicate) && typeof c.board === 'string' && c.board !== '') return c as ChallengeCheck;
      break;
    case 'mixed-signs':
      if (isView(c.board)) return c as ChallengeCheck;
      break;
    case 'explain':
      return c as ChallengeCheck;
  }
  throw new Error(`Challenge: check ${JSON.stringify(check)} is not one of the kinds out, reach, distinct, input, mixed-signs, explain with their fields`);
}

/** Parses a typed population: integers separated by commas or spaces, U+2212 allowed. Null when malformed. */
export function parsePopulation(text: string): bigint[] | null {
  const parts = text.replace(/−/g, '-').replace(/[()[\]]/g, ' ').split(/[\s,;]+/).filter((s) => s !== '');
  if (parts.length === 0 || !parts.every((s) => /^[-+]?\d{1,40}$/.test(s))) return null;
  return parts.map((s) => BigInt(s));
}

/** The engine functions the input kind calls (passed in, so this module never bundles the engine). */
export interface EngineForInput {
  boardFromName(name: string): AnyBoard;
  mutate<T>(board: Board<T>, p: readonly T[], i: number): T[];
}

/**
 * Whether the typed population, in increasing label order on the named board, is accepted by the
 * predicate. `fixed-by-every-mutation`: nonzero, and every mutation leaves it unchanged (the engine's
 * mutate at each node), which is the statement that every entry of Cp is 0.
 */
export function acceptsInput(predicate: InputPredicate, boardName: string, text: string, engine: EngineForInput): boolean {
  const typed = parsePopulation(text);
  if (typed === null) return false;
  const board = engine.boardFromName(boardName) as Board<unknown>;
  if (typed.length !== board.n) return false;
  if (typed.every((x) => x === 0n)) return false;
  const big = typeof board.arith.zero === 'bigint';
  if (!big && !typed.every((x) => Number.isSafeInteger(Number(x)))) return false;
  // Entry k of the typed vector belongs to the k-th smallest label (E-7).
  const order = [...board.labels.keys()].sort((a, b) => board.labels[a]! - board.labels[b]!);
  const p: unknown[] = new Array(board.n);
  order.forEach((position, k) => {
    p[position] = big ? typed[k]! : board.arith.fromInt(Number(typed[k]!));
  });
  switch (predicate) {
    case 'fixed-by-every-mutation':
      for (let i = 0; i < board.n; i++) {
        const after = engine.mutate(board, p, i);
        if (!after.every((v, j) => board.arith.eq(v, p[j]))) return false;
      }
      return true;
  }
}
