// T13: the state of the Studio and its link (SPEC.md 6.6, 7.4, 4.0). Owner P6-A3. The state is CONTRACTS 4
// ToolState with tool 'satake' and the fields board, black and tau only (labels: the black nodes, and the
// image of every node in label order): the link carries g, x and t. The root, the stage of theta, the
// composite moves played, the open panel and the toggle are session state, outside schema 1 (6.6: "the root
// chosen in T13 ... a link opens the tool with those at their defaults").
import { cloneState, type ToolState } from '../../../lib/state';
import { LINK_NOTICE, decodeState } from '../../../lib/urlCodec';
import { T13_BOARDS } from './config';
import { boardOf, labelOrder } from './model';

/** The fields of a Satake state, in labels. */
export interface SatakeState {
  board: string;
  black: number[];
  tau: number[];
}

/** The ToolState of a Satake state: { schema, tool, board, black, tau }, nothing else. */
export function toolStateOf(s: SatakeState): ToolState {
  return { schema: 1, tool: 'satake', board: s.board, black: [...s.black], tau: [...s.tau] };
}

/** The split form of a board: no black node, tau the identity (plan: the default after a board change). */
export function splitState(board: string): SatakeState {
  return { board, black: [], tau: labelOrder(boardOf(board)) };
}

/**
 * Reads the instance's keys from a query string (6.6): the codec validates (a t that is not an involutive
 * symmetry, a board the tool does not offer, a stray label: the defaults and LINK_NOTICE); a board given
 * without x and t is the split form on that board; black labels are read as a set. Start, coords, moves
 * and every other field are dropped.
 */
export function admitLink(search: string, defaults: ToolState, prefix: string): { state: ToolState; notice: string | null } {
  const { state, notice } = decodeState(search, 'satake', defaults, { prefix });
  if (notice !== null) return { state: cloneState(defaults), notice };
  try {
    if (typeof state.board !== 'string' || !T13_BOARDS.includes(state.board)) throw new RangeError('a board T13 does not offer');
    const split = splitState(state.board);
    const black = [...new Set(state.black ?? split.black)].sort((a, b) => a - b);
    const tau = state.tau ?? split.tau;
    return { state: toolStateOf({ board: state.board, black, tau }), notice: null };
  } catch {
    return { state: cloneState(defaults), notice: LINK_NOTICE };
  }
}

/** The Satake state of a ToolState read by admitLink. */
export function satakeStateOf(s: ToolState): SatakeState {
  return { board: s.board as string, black: [...(s.black ?? [])], tau: [...(s.tau ?? splitState(s.board as string).tau)] };
}
