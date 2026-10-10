// The pure part of T9, Kostant's Game (SPEC.md 4 T9, 2.7 F13, 2.12, 2.16, Appendix A.4; plan of
// build-plan/agents/P1-A7-t09-kostant.md, section 5.11). No DOM: the moods, the summary of a play and
// its end panel, the recipe of 2.12, the reading of a link's start, the stated limit, the picker groups.
// Every value comes from the engine (toNumbers, raisingNodes, mutate, raisingPlay, kostantPlay,
// highestRoot, highestShortRoot, coxeterNumber, transposeBoard, toPopulation); nothing is typed.
// Positions inside, labels outside (E-7): starts, moves and the lists returned here are in label order.
// These functions live in this module, not in the component's <script module>, because the site-unit
// Vitest project does not compile .svelte files (decisions/P1-A3.md, decisions/P1-A7.md).
import {
  CAPS,
  coxeterNumber,
  highestRoot,
  highestShortRoot,
  kostantPlay,
  mutate,
  raisingNodes,
  raisingPlay,
  toLabels,
  toNumbers,
  toPopulation,
  toPositions,
  transposeBoard,
} from '@two-games/engine';
import type { AnyBoard, Board, PlayResult } from '@two-games/engine';
import type { NodeState } from '../../../lib/a11y';
import { bigBoard, integerOut, labelOrder, type Coords } from '../../../lib/state';
import { inLabelOrder, startVector } from '../t01/model';
import { KOSTANT_BOARDS } from './boards';

// ---------------------------------------------------------------------------------------------
// Moods (SPEC 2.16: "unhappy a_i < 0, happy a_i = 0, manic or excited a_i > 0", with a = C p, D7)
// ---------------------------------------------------------------------------------------------

export type Mood = 'unhappy' | 'happy' | 'manic';

/** The A-3 state string of each mood (CONTRACTS 5.3), used unchanged in the node's accessible name. */
export const MOOD_STATE: Readonly<Record<Mood, NodeState>> = {
  unhappy: 'mutation would raise it',
  happy: 'mutation would change nothing',
  manic: 'mutation would lower it',
};

/**
 * The shape drawn for each mood (A-5: by shape and word as well as colour; plan): unhappy a chevron
 * pointing down, happy a level bar, manic a chevron pointing up. The value is the `data-shape` hook.
 */
export const MOOD_SHAPE: Readonly<Record<Mood, 'chevron-down' | 'bar' | 'chevron-up'>> = {
  unhappy: 'chevron-down',
  happy: 'bar',
  manic: 'chevron-up',
};

/** The mood of every city, by position, from the sign of its number (C p)_i. */
export function moods<T>(board: Board<T>, p: readonly T[]): Mood[] {
  const a = toNumbers(board, p);
  return a.map((x) => {
    const s = board.arith.sign(x);
    return s < 0 ? 'unhappy' : s > 0 ? 'manic' : 'happy';
  });
}

/** The mood of a city from the decimal text of its number (as T1's model shows it). */
export function moodOfText(text: string): Mood {
  const t = text.trim();
  if (/^-?0+$/.test(t)) return 'happy';
  return t.startsWith('-') ? 'unhappy' : 'manic';
}

// ---------------------------------------------------------------------------------------------
// The finite-type data of a board, computed once per board and arithmetic
// ---------------------------------------------------------------------------------------------

interface FiniteData {
  highest: string[];
  highestShort: string[] | null;
  h: number;
  /** The coroot of the highest root and of the highest short root, by position (decimal text). */
  corootOfHighest: string[];
  corootOfHighestShort: string[] | null;
}

const finiteCache = new Map<string, FiniteData>();

/**
 * Called only on named finite boards (E-11). The coroots without the form (plan, because `coroot` is
 * phase 2): on a simply laced board the coroot of a root is the root itself; otherwise the highest root
 * of the reversed board is the coroot of the highest SHORT root (F11) and the highest short root of the
 * reversed board is the coroot of the highest root (2.5: the coroots are the root populations of the
 * reversed board). P2-A7 may switch to coroot(board, end).
 */
function finiteData(board: AnyBoard): FiniteData {
  const b = board as Board<unknown>;
  const key = `${board.name ?? ''}|${typeof b.arith.zero}|${board.labels.join(',')}`;
  const hit = finiteCache.get(key);
  if (hit !== undefined) return hit;
  const show = (v: readonly unknown[]): string[] => v.map((x) => b.arith.show(x));
  const highest = show(highestRoot(b));
  const hs = highestShortRoot(b);
  const highestShort = hs === null ? null : show(hs);
  let corootOfHighest = highest;
  let corootOfHighestShort: string[] | null = null;
  if (highestShort !== null) {
    const rev = transposeBoard(b);
    corootOfHighest = show(highestShortRoot(rev)!);
    corootOfHighestShort = show(highestRoot(rev));
  }
  const data: FiniteData = { highest, highestShort, h: coxeterNumber(b), corootOfHighest, corootOfHighestShort };
  finiteCache.set(key, data);
  return data;
}

// ---------------------------------------------------------------------------------------------
// The end of a play (SPEC 4 T9, F13, 2.12)
// ---------------------------------------------------------------------------------------------

export type EndName = 'highest root' | 'highest short root';

export interface EndPanel {
  /** The end population, label order, decimal text. */
  end: string[];
  /** The number of moves from the start to the end. */
  moves: number;
  /** The highest root, the highest short root, or null (an end from a start other than one Martian). */
  name: EndName | null;
  /** Simply laced in phase 1: highestShortRoot is null (5.4). */
  simplyLaced: boolean;
  /** The Coxeter number h (5.4: 2N/n). */
  h: number;
  /** a = C (end), label order: `final_numbers_from_node` (verify.py line 902), not the play's `fired`. */
  finalNumbers: string[];
  /** The labels of the cities whose final number is positive, increasing. */
  marked: number[];
  /** b_j = <beta^vee, alpha_j>, label order, when the end is named; null otherwise. */
  returnCounts: string[] | null;
}

/**
 * The end panel of a population at which no city is unhappy, reached after `moves` moves. `end` is by
 * position in the board's arithmetic. Named finite boards only (phase 1).
 */
export function endPanel<T>(board: Board<T>, end: readonly T[], moves: number): EndPanel {
  const show = (v: readonly T[]): string[] => v.map((x) => board.arith.show(x));
  const data = finiteData(board as AnyBoard);
  const endText = show(end);
  const same = (x: readonly string[] | null): boolean => x !== null && x.every((v, k) => v === endText[k]);
  const name: EndName | null = same(data.highest) ? 'highest root' : same(data.highestShort) ? 'highest short root' : null;
  const a = toNumbers(board, end);
  let returnCounts: string[] | null = null;
  if (name !== null) {
    // b = C^T beta^vee, that is b_j = sum_k beta^vee_k C_kj (SPEC 2.12).
    const coroot = name === 'highest root' ? data.corootOfHighest : data.corootOfHighestShort!;
    const cv = coroot.map((x) => BigInt(x));
    const C = board.cartan as readonly (readonly unknown[])[];
    const b: string[] = [];
    for (let j = 0; j < board.n; j++) {
      let s = 0n;
      for (let k = 0; k < board.n; k++) s += cv[k]! * BigInt(String(C[k]![j]));
      b.push(s.toString());
    }
    returnCounts = inLabelOrder(board as AnyBoard, b);
  }
  const positive = a.map((x, k) => (board.arith.sign(x) > 0 ? k : -1)).filter((k) => k >= 0);
  return {
    end: inLabelOrder(board as AnyBoard, endText),
    moves,
    name,
    simplyLaced: data.highestShort === null,
    h: data.h,
    finalNumbers: inLabelOrder(board as AnyBoard, show(a)),
    marked: toLabels(board as AnyBoard, positive).sort((x, y) => x - y),
    returnCounts,
  };
}

export interface KostantSummary extends EndPanel {
  status: PlayResult<unknown>['status'];
  /** The labels of every move made, from the start. */
  word: number[];
}

/**
 * The move "step" makes (4.0, E-5): one raising move with the engine's rule, raisingPlay with a cap
 * of 1, so the lowest-position choice lives in the engine. Null when no city is unhappy.
 */
export function stepPosition<T>(board: Board<T>, p: readonly T[]): number | null {
  const r = raisingPlay(board, p, undefined, 1);
  return r.word[0] ?? null;
}

/** The position k when `start` (label order) is one Martian e_k, else null. */
export function oneMartian(board: AnyBoard, start: readonly (number | string | bigint)[]): number | null {
  const texts = start.map((x) => String(x));
  const ones = texts.flatMap((t, k) => (/^0*1$/.test(t) ? [k] : []));
  if (ones.length !== 1 || !texts.every((t, k) => k === ones[0] || /^-?0+$/.test(t))) return null;
  return toPositions(board, [labelOrder(board)[ones[0]!]!])[0]!;
}

/**
 * The whole play from `start` (label order) after the moves already made (labels), finished by the
 * raising play with the lowest-position rule (E-5). One Martian and no moves: `kostantPlay`; otherwise
 * the moves are replayed with `mutate` (each must raise its city) and finished with `raisingPlay`.
 * The board's arithmetic is used as it is: a start beyond SafeInt needs the Big board (the component
 * switches, as T1 does); on a SafeInt board such a start throws EngineOverflow or RangeError.
 */
export function kostantSummary<T>(
  board: Board<T>,
  start: readonly (number | string | bigint)[],
  moves: readonly number[] = [],
  cap: number = CAPS.playMoves,
): KostantSummary {
  const k = oneMartian(board as AnyBoard, start);
  let result: PlayResult<T>;
  let made: number[] = [];
  if (k !== null && moves.length === 0) {
    result = kostantPlay(board, k, undefined, cap);
  } else {
    const v0 = startVector(board as AnyBoard, start.map((x) => (typeof x === 'bigint' ? x.toString() : x))) as T[];
    const big = typeof board.arith.zero === 'bigint';
    if (!big && v0.some((x) => !Number.isSafeInteger(x as unknown as number))) throw new RangeError('the start does not fit SafeInt');
    let p: readonly T[] = v0;
    made = toPositions(board as AnyBoard, moves);
    for (const i of made) {
      if (!raisingNodes(board, p).includes(i)) throw new RangeError(`city ${toLabels(board as AnyBoard, [i])[0]} would not rise`);
      p = mutate(board, p, i);
    }
    result = raisingPlay(board, p, undefined, cap);
  }
  const word = toLabels(board as AnyBoard, [...made, ...result.word]);
  const total = made.length + result.moves;
  if (result.status !== 'ended') {
    const show = result.position.map((x) => board.arith.show(x));
    return {
      status: result.status,
      word,
      end: inLabelOrder(board as AnyBoard, show),
      moves: total,
      name: null,
      simplyLaced: false,
      h: 0,
      finalNumbers: [],
      marked: [],
      returnCounts: null,
    };
  }
  return { status: 'ended', word, ...endPanel(board, result.position, total) };
}

/**
 * The Cartan matrix of the recipe of 2.12, node 0 first: row 0 is (2, -b_1, ..., -b_n), column 0
 * below it is (-a_1, ..., -a_n), then C (in label order). Plan test against affine[T].cartan_node0_first.
 */
export function recipeMatrix(board: AnyBoard, finalNumbers: readonly string[], returnCounts: readonly string[]): number[][] {
  const order = toPositions(board, labelOrder(board));
  const C = board.cartan as readonly (readonly (number | bigint)[])[];
  const rows: number[][] = [[2, ...returnCounts.map((b) => -Number(b))]];
  order.forEach((i, r) => {
    rows.push([-Number(finalNumbers[r]), ...order.map((j) => Number(C[i]![j]))]);
  });
  return rows.map((row) => row.map((x) => (Object.is(x, -0) ? 0 : x)));
}

// ---------------------------------------------------------------------------------------------
// Boards, controls, links, limits (sections 5.2, 5.5, 5.8)
// ---------------------------------------------------------------------------------------------

export { KOSTANT_BOARDS };

/**
 * The finite test (phase 1): the board's name is one of the 32 type names. P2-A7 switches this one
 * function to the verdict resolveBoard attaches (classify).
 */
export function isNamedFinite(board: AnyBoard): boolean {
  return board.name !== undefined && KOSTANT_BOARDS.includes(board.name);
}

/**
 * The label of the play control. Phase 1: always "play to the end". P2-A7 returns "play on" on an
 * affine board and reports "still running after 20000 moves" with the verdict of classify.
 */
export function playControl(board: AnyBoard): 'play to the end' | 'play on' {
  void board;
  return 'play to the end';
}

/**
 * The start of a link as an integer population in label order, or null for a refusal (plan; SPEC 4 T1
 * "Coordinates of the start"): populations pass through; numbers a give C^{-1} a, accepted only when
 * every entry has denominator 1 (T9 has no linked view to fall back to).
 */
export function startFromLink(board: AnyBoard, coords: Coords, start: readonly (number | string)[]): (number | string)[] | null {
  if (coords === 'populations') return [...start];
  // In Big arithmetic, so that a long numbers start cannot overflow (the result is rational anyway).
  const big = bigBoard(board);
  const pop = toPopulation(big, startVector(big, start) as bigint[]);
  if (pop === null || pop.some((r) => r.den !== 1n)) return null;
  return inLabelOrder(board, pop.map((r) => integerOut(r.num)));
}

/** The stated limit of a play (4.0 Stated limits; 5.6): null when it ended, the words at its cap. */
export function playOutcome(result: { status: PlayResult<unknown>['status'] }, cap: number): string | null {
  return result.status === 'cap' ? `still running after ${cap} moves` : null;
}

/** The picker's groups, one per letter A to G in that order, or only the boards in `boardChoices`. */
export function pickerGroups(boardChoices?: readonly string[]): { letter: string; names: string[] }[] {
  const groups: { letter: string; names: string[] }[] = [];
  for (const name of KOSTANT_BOARDS) {
    if (boardChoices !== undefined && !boardChoices.includes(name)) continue;
    const letter = name[0]!;
    const last = groups[groups.length - 1];
    if (last !== undefined && last.letter === letter) last.names.push(name);
    else groups.push({ letter, names: [name] });
  }
  return groups;
}

// ---------------------------------------------------------------------------------------------
// Words (plan wording; site's own words, SPEC 8.4)
// ---------------------------------------------------------------------------------------------

/** "(1, 1, 1)" with true minus signs. */
export function tuple(values: readonly string[]): string {
  return `(${values.map((v) => v.replace(/^-/, '−')).join(', ')})`;
}

/** The sentence of data-out="endName". */
export function endSentence(panel: Pick<EndPanel, 'name' | 'end'>): string {
  if (panel.name === null) return `No city is unhappy. The game stops at ${tuple(panel.end)}.`;
  return `The game stops at the ${panel.name}, ${tuple(panel.end)}.`;
}

/** The sentence added to an announcement when the goal is met (plan). */
export function endAnnouncement(panel: Pick<EndPanel, 'name'>): string {
  if (panel.name === null) return 'No city is unhappy.';
  return `No city is unhappy. This is the ${panel.name}.`;
}

/** "1 and 3", "1, 2 and 4". */
export function cityList(labels: readonly number[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** The phase-1 caption of SPEC 2.12, without the name of the affine board (P2-A7 adds it). */
export function affineCaptionParts(panel: EndPanel): { cities: string; sends: string; receives: string; equal: boolean } | null {
  if (panel.returnCounts === null || panel.marked.length === 0) return null;
  const at = (labels: readonly number[], values: readonly string[]): string =>
    labels.map((l) => `${values[l - 1]} to city ${l}`).join(', ');
  const back = (labels: readonly number[], values: readonly string[]): string =>
    labels.map((l) => `${values[l - 1]} from city ${l}`).join(', ');
  return {
    cities: cityList(panel.marked),
    sends: at(panel.marked, panel.finalNumbers),
    receives: back(panel.marked, panel.returnCounts),
    equal: panel.simplyLaced,
  };
}
