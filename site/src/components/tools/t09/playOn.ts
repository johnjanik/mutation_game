// P2-A7: the one call of T9 that may leave the main thread (SPEC.md E-9 rule 2: "a play to the end on
// a board that is not of finite type" runs in the worker). Kept in its own module, which the component
// imports dynamically on the first "play on", so that the worker client is not part of the code the
// route fetches before the first interaction (7.6) and no default state needs it (E-9).
import { raisingPlay } from '@two-games/engine';
import type { AnyBoard, PlayResult } from '@two-games/engine';
import { isFiniteType } from '../../../lib/state';
import { engineCall, provide, whereToRun, type CallHint } from '../../../lib/worker';

// The engine function this module calls by name through engineCall.
provide({ raisingPlay });

/** The hint of a "play on": finiteKnown from classify's verdict (E-9 from phase 2). */
export function playOnHint(board: AnyBoard): CallHint {
  return { board, kind: 'play', finiteKnown: isFiniteType(board) };
}

/** Where a "play on" runs: the worker off the finite types, the main thread on a finite board. */
export function playOnWhere(board: AnyBoard): 'main' | 'worker' {
  return whereToRun(playOnHint(board));
}

/**
 * Runs "play on": raisingPlay from the population `p` (by position) with the lowest-position rule
 * and the cap, where E-9 says (in Node, in-process). A call is never started in one place and
 * continued in the other.
 */
export function runPlayOn(board: AnyBoard, p: readonly unknown[], cap: number): Promise<PlayResult<unknown>> {
  return engineCall('raisingPlay', [board, p, undefined, cap] as never, playOnHint(board)) as Promise<PlayResult<unknown>>;
}
