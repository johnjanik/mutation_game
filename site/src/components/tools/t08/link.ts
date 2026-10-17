// T8 driven by a Game Board (SPEC.md 7.4 "Tools on one page": "the Weyl Explorer driven by one"; plan
// 5.4 and 5.8). Pure helpers over a ToolState published through state.ts's publishToolState and
// followed with followToolState (P1-A2's mechanism; no second one). A followed state is a game in the
// graph only when it is a legal game from all ones, in the numbers, on a board T8 offers; otherwise T8
// draws no path and says so in words (data-out="linkStatus").
import { fire, toPositions } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import { resolveBoard, type ToolState } from '../../../lib/state';
import type { T1Game } from '../t01/model';

export const LINK_FOLLOWING = 'The marked path is the game played on the linked board.';
export const LINK_OUTSIDE = "The linked board's position is not in this graph: the graph holds the positions reached from all ones by legal play.";

/** The board and moves of a followed state that T8 can show as a path, or null (plan, 5.4). */
export function followedGame(s: ToolState, offered: readonly string[]): { board: string; moves: number[] } | null {
  if (typeof s.board !== 'string' || !offered.includes(s.board)) return null;
  if ((s.coords ?? 'populations') !== 'numbers') return null;
  let b: Board<number>;
  try {
    b = resolveBoard(s.board) as Board<number>;
  } catch {
    return null;
  }
  const start = s.start ?? [];
  if (start.length !== b.n || !start.every((x) => String(x) === '1')) return null;
  const moves = s.moves ?? [];
  let positions: number[];
  try {
    positions = toPositions(b, moves);
  } catch {
    return null;
  }
  let a: number[] = Array.from({ length: b.n }, () => 1);
  for (const i of positions) {
    if (b.arith.sign(a[i]!) <= 0) return null; // not a legal move: the play leaves the graph
    a = fire(b, a, i);
  }
  return { board: s.board, moves: [...moves] };
}

/**
 * The followed board's new state applied to the game T8 holds, in place, when it is the same game: the
 * same board, the numbers, the start all ones. SPEC 7.4: "while a tool runs it keeps the list of
 * positions of the current play in memory and extends it by one position per move, so a move costs one
 * engine call however long the play is". The moves both lists share are kept; an undo or a redo along
 * the held list moves the cursor and costs no engine call; each move after the shared ones is one legal
 * firing on the held game (T1Game.act refuses a move the legal play forbids). Returns 'unchanged' when
 * the held game already stands there, 'changed' when it was moved, 'outside' when a move is not a legal
 * firing or not a node of the board (the followed play has left the graph; the held game keeps the legal
 * moves before it), and null when the state is another game, which the caller loads from the start.
 */
export function followMoves(game: T1Game, s: ToolState): 'unchanged' | 'changed' | 'outside' | null {
  if (s.board !== game.spec || (s.coords ?? 'populations') !== 'numbers') return null;
  const start = s.start ?? [];
  if (start.length !== game.n || !start.every((x) => String(x) === '1')) return null;
  const moves = s.moves ?? [];
  const held = game.moves;
  let k = 0;
  while (k < moves.length && k < held.length && moves[k] === held[k]) k++;
  if (k === moves.length && k === game.cursor) return 'unchanged';
  game.scrub(k);
  for (let j = k; j < moves.length; j++) {
    let position: number;
    try {
      position = toPositions(game.board, [moves[j]!])[0]!;
    } catch {
      return 'outside';
    }
    if (game.act(position).kind === 'refused') return 'outside';
  }
  return 'changed';
}

/**
 * T8's own reading of a decoded link (plan, 5.2): the graph is "reachable from all ones", so a link
 * whose coords are not the numbers, whose start is not all ones, whose view or mode is another, or
 * whose moves are not a legal game is refused (null) and the tool loads its default state with the
 * codec's notice. Otherwise the board and moves, in T8's state shape.
 */
export function admitLink(s: ToolState, offered: readonly string[]): { board: string; moves: number[] } | null {
  if ((s.view ?? 'numbers') !== 'numbers' || (s.mode ?? 'legal') !== 'legal') return null;
  return followedGame({ ...s, coords: s.coords ?? 'numbers' }, offered);
}
