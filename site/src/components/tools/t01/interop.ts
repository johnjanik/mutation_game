// T1 and the rest of the page (SPEC.md 7.4 "Tools on one page", 4.0 Predict): following a state
// published under the instance's own id (T2's jump), the highlight store, and the check of a
// prediction's answer. Pure helpers; the component wires them.
import { encodeState } from '../../../lib/urlCodec';
import { followToolState, type ToolState } from '../../../lib/state';
import type { Highlight } from '../../../lib/highlight';
import type { Prediction } from '../../../tools/types';
import type { AnyBoard } from '@two-games/engine';
import { inLabelOrder } from './inLabelOrder';
import type { Shown } from './model';

/**
 * Follows states published under `instanceId` by other tools (plan: T2's jump). A state equal to the
 * current one (our own publish) is ignored; one on the same board and start is applied as a new move
 * list from our own start. Returns the function that stops following.
 */
export function followJumps(instanceId: string, current: () => ToolState, apply: (moves: number[]) => void): () => void {
  return followToolState(instanceId, (incoming) => {
    const mine = current();
    if (encodeState(incoming) === encodeState(mine)) return;
    const sameBoard = encodeState({ ...mine, moves: [] }) === encodeState({ ...incoming, view: mine.view, mode: mine.mode, moves: [] });
    if (!sameBoard) return;
    apply([...(incoming.moves ?? [])]);
  });
}

/** The name a board goes by in the highlight store: the spec string, or the custom matrix as in a link. */
export function highlightBoardName(spec: ToolState['board']): string {
  return typeof spec === 'string' ? spec : `c:${spec.cartan.map((r) => r.join(',')).join(';')}`;
}

/**
 * Whether the highlight marks this board (plan): a `position` or `root` value on the same board equal
 * to the current population (populations board) or numbers (numbers board), in label order.
 */
export function highlightMatches(h: Highlight | null, boardName: string, board: AnyBoard, shown: Shown): { populations: boolean; numbers: boolean } {
  const none = { populations: false, numbers: false };
  if (h === null || h.board !== boardName || !Array.isArray(h.value)) return none;
  if (h.kind !== 'position' && h.kind !== 'root') return none;
  const want = h.value.map(String);
  const eq = (values: readonly string[] | null): boolean => {
    if (values === null) return false;
    const have = inLabelOrder(board, values);
    return have.length === want.length && have.every((x, k) => x === want[k]);
  };
  return { populations: eq(shown.populations), numbers: eq(shown.numbers) };
}

/** The answer a reader gives: a number, one number per node, or the index of a choice. */
export type PredictionAnswer = number | number[];

/** Whether an answer is right: `value` for a number or a position, `correct` for a choice (CONTRACTS 5.2). */
export function predictionCorrect(prediction: Prediction, answer: PredictionAnswer): boolean {
  const a = prediction.answer;
  switch (a.type) {
    case 'number':
      return typeof answer === 'number' && answer === a.value;
    case 'position':
      return Array.isArray(answer) && answer.length === a.value.length && answer.every((x, k) => x === a.value[k]);
    case 'choice':
      return typeof answer === 'number' && answer === a.correct;
  }
}

/** The answer as text, for the reveal and the <details> without JavaScript. */
export function predictionAnswerText(prediction: Prediction): string {
  const a = prediction.answer;
  switch (a.type) {
    case 'number':
      return String(a.value);
    case 'position':
      return `(${a.value.join(', ')})`;
    case 'choice':
      return a.options[a.correct] ?? '';
  }
}
