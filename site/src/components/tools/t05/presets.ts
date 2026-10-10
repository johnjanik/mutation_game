// The presets of T5 (SPEC.md 4.0 Configuration; 3 M4 row 2, M5 rows 6 to 8; CONTRACTS.md 6: compared,
// tally, wave, dimension, plus default). Pure. A preset fixes only what the reader could set by hand, so
// its state part is a state object and a link; the tab, the colour that starts the wave and game B's
// moves are view options outside schema 1 (6.6: "the tab of T5 ... not part of a link"). Moves and
// captions are computed by the engine for the board in force, never typed: on a lesson page the
// `board` property overrides a preset's board and the preset's start and moves are recomputed for it.
import { play, toLabels } from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import { resolveBoard } from '../../../lib/state';

export type Tab = 'tape' | 'tally' | 'wave' | 'compared' | 'dimension';
export const TABS: readonly { id: Tab; text: string }[] = [
  { id: 'tape', text: 'Tape' },
  { id: 'tally', text: 'Tally' },
  { id: 'wave', text: 'Wave' },
  { id: 'compared', text: 'Compared' },
  { id: 'dimension', text: 'Dimension' },
];

export type PresetId = 'default' | 'tally' | 'wave' | 'compared' | 'dimension';
export const PRESET_IDS: readonly PresetId[] = ['default', 'tally', 'wave', 'compared', 'dimension'];

/** The state part of a preset (fields of ToolState). */
export interface PresetState {
  board: string;
  coords: 'numbers';
  start: number[];
  moves: number[];
  lambda?: number[];
}

/** The options of a preset outside schema 1. */
export interface PresetOptions {
  tab: Tab;
  firstColour: 0 | 1;
  /** Game B of "two games compared" preset to the highest-node game (plan), or empty. */
  secondGame: 'highest' | 'none';
}

interface PresetDef {
  board: string;
  /** The lowest-node game from all ones is the move list. */
  playsGame: boolean;
  lambda?: number[];
  options: PresetOptions;
}

const DEFS: Record<PresetId, PresetDef> = {
  default: { board: 'A3', playsGame: true, options: { tab: 'tally', firstColour: 0, secondGame: 'none' } },
  tally: { board: 'A3', playsGame: false, options: { tab: 'tally', firstColour: 0, secondGame: 'none' } },
  wave: { board: 'A3', playsGame: false, options: { tab: 'wave', firstColour: 0, secondGame: 'none' } },
  compared: { board: 'A3', playsGame: true, options: { tab: 'compared', firstColour: 0, secondGame: 'highest' } },
  dimension: { board: 'A2', playsGame: false, lambda: [1, 1], options: { tab: 'dimension', firstColour: 0, secondGame: 'none' } },
};

export function isPresetId(id: string | undefined): id is PresetId {
  return id !== undefined && (PRESET_IDS as readonly string[]).includes(id);
}

/** The game from all ones with the lowest-node rule (or the highest), as labels: one call of `play`. */
export function onesGameWord(board: AnyBoard, rule: 'lowest' | 'highest' = 'lowest'): number[] {
  const b = board as Board<unknown>;
  const rho = Array.from({ length: b.n }, () => b.arith.one);
  const choose = rule === 'lowest' ? undefined : (allowed: readonly number[]) => allowed[allowed.length - 1]!;
  return toLabels(board, play(b, rho, choose).word);
}

/** The board of a preset, or the board property when one is given (plan). */
export function presetBoard(id: PresetId, boardName?: string): string {
  return boardName ?? DEFS[id].board;
}

/** The state part of a preset on its board, or on the board property (start and moves recomputed). */
export function presetState(id: PresetId, boardName?: string): PresetState {
  const def = DEFS[id];
  const name = presetBoard(id, boardName);
  const board = resolveBoard(name);
  const out: PresetState = {
    board: name,
    coords: 'numbers',
    start: Array.from({ length: board.n }, () => 1),
    moves: def.playsGame ? onesGameWord(board) : [],
  };
  if (def.lambda !== undefined && def.lambda.length === board.n) out.lambda = [...def.lambda];
  return out;
}

export function presetOptions(id: PresetId): PresetOptions {
  return { ...DEFS[id].options };
}

/** Game B's moves of a preset on a board (labels). */
export function presetSecondMoves(id: PresetId, boardName?: string): number[] {
  if (DEFS[id].options.secondGame !== 'highest') return [];
  return onesGameWord(resolveBoard(presetBoard(id, boardName)), 'highest');
}

/** The caption of a preset on a board, stating the result it shows (P1), with the engine's numbers. */
export function presetCaption(id: PresetId, boardName?: string): string {
  const name = presetBoard(id, boardName);
  const board = resolveBoard(name);
  const b = board as Board<unknown>;
  const rho = Array.from({ length: b.n }, () => b.arith.one);
  const game = play(b, rho);
  const n = game.moves;
  switch (id) {
    case 'default':
      return `On ${name}, from all ones, the numbers fired are the heights of the positive coroots. Read sideways when the game has ended, their tally gives the exponents, and the product of the exponents plus one is the order of the group.`;
    case 'tally':
      return `Play the game on ${name} from all ones: the tally counts how often each number is fired, and when the game ends its bars read sideways give the exponents, whose values plus one multiply to the order of the group.`;
    case 'wave':
      return `Fire one colour class at a time, starting from all ones on ${name}: every firing is legal, and the game ends after as many rounds as the Coxeter number.`;
    case 'compared':
      return `Two games from all ones on ${name} in different orders: both last ${n} moves, end at the same position, and fire the same numbers once the tapes are sorted.`;
    case 'dimension':
      return `On ${name}, replay the word of the game from all ones from lambda plus rho: the product of the numbers fired, divided by the product from rho, is the dimension of the representation with highest weight lambda.`;
  }
}
