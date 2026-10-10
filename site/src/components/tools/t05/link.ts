// T5's own reading of a decoded link (SPEC.md 6.6 Validation; plan, decisions/P3-A3.md). The codec of
// P1-A2 checks a move against the mode in force only when the state has a mode, and T5's state has none
// (it plays legal moves only), so T5 checks the rule itself on the decoded state: every move must be a
// legal firing. A link in the populations coords, or with a view or mode other than numbers and legal,
// is unreadable for T5. A `d` with a negative entry or an entry of more than 6 digits keeps the rest of
// the link, loads the default lambda and shows the notice. Pure.
import { LINK_NOTICE } from '../../../lib/urlCodec';
import { cloneState, firstForbiddenMove, resolveBoard, type ToolState } from '../../../lib/state';
import { validLambda } from './dimension';

export interface Admitted {
  state: ToolState;
  notice: string | null;
}

/** The state T5 writes: exactly { schema, tool, board, coords, start, moves, lambda? } (CONTRACTS 4). */
export function t05State(s: { board: ToolState['board']; start: (number | string)[]; moves: number[]; lambda?: number[] | undefined }): ToolState {
  const out: ToolState = { schema: 1, tool: 'numbers', board: s.board, coords: 'numbers', start: [...s.start], moves: [...s.moves] };
  if (s.lambda !== undefined) out.lambda = [...s.lambda];
  return out;
}

export function admitLink(decoded: ToolState, notice: string | null, defaults: ToolState): Admitted {
  const refuse = (): Admitted => ({ state: cloneState(defaults), notice: LINK_NOTICE });
  try {
    if ((decoded.coords ?? 'numbers') !== 'numbers') return refuse();
    if (decoded.view !== undefined && decoded.view !== 'numbers') return refuse();
    if (decoded.mode !== undefined && decoded.mode !== 'legal') return refuse();
    const board = resolveBoard(decoded.board);
    const start = decoded.start ?? Array.from({ length: board.n }, () => 1);
    const moves = decoded.moves ?? [];
    if (firstForbiddenMove(board, { ...decoded, coords: 'numbers', mode: 'legal', start, moves }) !== null) return refuse();
    let lambda = decoded.lambda;
    let n = notice;
    if (lambda !== undefined && !validLambda(lambda, board.n)) {
      const sameBoard = JSON.stringify(decoded.board) === JSON.stringify(defaults.board);
      lambda = sameBoard && validLambda(defaults.lambda, board.n) ? defaults.lambda : undefined;
      n = LINK_NOTICE;
    }
    return { state: t05State({ board: decoded.board, start, moves, lambda }), notice: n };
  } catch {
    return refuse();
  }
}
