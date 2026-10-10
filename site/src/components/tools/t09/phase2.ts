// P2-A7: the phase-2 parts of T9, Kostant's Game (SPEC.md 4 T9 last sentences and the G2 acceptance,
// 2.12 "Building affine boards from finite ones" and "On an affine board Kostant's game never ends",
// Appendix A.4, 4.0 "Step and play to the end", 6.6, E-9 rule 2). Pure functions and the one call that
// runs a "play on" where E-9 says, in a new file beside P1-A7's t09/kostant.ts (its tool agent's file;
// P2-A7 instruction 5.9 case 2: `isNamedFinite` and `playControl` there stay as they are and the
// component calls these). Every value comes from the engine; the affine board is named by
// identifyAffine of affineExtension, never by a matrix built here (7.3).
import { CAPS, affineExtension, highestShortRoot, identifyAffine } from '@two-games/engine';
import type { AnyBoard, Board, ClassifyRecord } from '@two-games/engine';
import { boardVerdict, isFiniteType } from '../../../lib/state';
import { playControl } from './kostant';

/**
 * The affine board that Kostant's recipe builds from the end population `end` (by position, in the
 * board's arithmetic) of a finite board: with theta the highest root it is the untwisted affine board,
 * with theta the highest short root a twisted one (2.12). `short` is true exactly when `end` equals
 * highestShortRoot(board), which is null on simply laced boards (trap 5; verify.py uses d[i] != max d,
 * which agrees on the 32 types). The name is what identifyAffine returns (`C2~` for the board of B2,
 * D19 does not apply to affine names). Call only on a board isFiniteType accepts.
 */
export function affineBoardName(board: AnyBoard, end: readonly unknown[]): string | null {
  const b = board as Board<unknown>;
  const hs = highestShortRoot(b);
  const show = (x: unknown): string => b.arith.show(x);
  const short = hs !== null && hs.length === end.length && hs.every((x, k) => show(x) === show(end[k]));
  return identifyAffine(affineExtension(board, short).board);
}

/**
 * The link of the "add the city" button: T4's own route with the board in the bare key `g` (6.6),
 * assembled by hand so that `~`, `^` and the brackets of `D4^(3)` stay readable (plan for the brackets:
 * 6.6 lists commas, semicolons, dots, `~` and `^`; brackets are legal in a query string).
 */
export function labHref(base: string, name: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}tools/lab?g=${name}`;
}

export type PlayControl = 'play to the end' | 'play on';

/**
 * The play control from the verdict (SPEC 4 T9, G2: "on an affine board the tool offers "play on" in
 * place of "play to the end""): 'play to the end' on a board classify calls finite, 'play on' on every
 * other board, where a play need not end (4.0; T9 offers only finite and affine boards).
 */
export function playControlPhase2(board: AnyBoard): PlayControl {
  // 5.9 case 2: P1-A7's playControl (kostant.ts, unchanged) on a finite board, "play on" otherwise.
  return isFiniteType(board) ? playControl(board) : 'play on';
}

/** The visible text of the control (the phase-1 capitalisation) and the plan attribute `data-play`. */
export function playLabelOf(control: PlayControl): { text: string; play: 'end' | 'on' } {
  return control === 'play on' ? { text: 'Play on', play: 'on' } : { text: 'Play to the end', play: 'end' };
}

/** The verdict text of T9 (plan): per component the class word and the name, `affine D4~`. */
export function verdictText(records: readonly ClassifyRecord[]): string {
  return records
    .map((r) => {
      if (r.kind === 'one-way' || r.class === null) return 'has a one-way road: the theory does not apply';
      if (r.name === null) return r.class;
      // D19: a finite rank-2 board recognised from its shape is written B2=C2.
      return `${r.class} ${r.class === 'finite' && r.name === 'B2' ? 'B2=C2' : r.name}`;
    })
    .join('; ');
}

/** The verdict text of a board, from the records cached when it was resolved. */
export function boardVerdictText(board: AnyBoard): string {
  return verdictText(boardVerdict(board));
}

/**
 * The cap of one "play on" from move `cursor`: 20000 (5.6), never past the link maximum of 20000
 * moves in all (6.6); 0 disables the control (plan: a second "play on" after one that reached the cap).
 */
export function playOnCap(cursor: number): number {
  return Math.max(0, Math.min(CAPS.playMoves, CAPS.linkMoves - cursor));
}

/** The one announcement of a play that reached its cap (plan; A-4 has no template for it). */
export function capAnnouncement(moves: number): string {
  return `Still running after ${moves} moves.`;
}

/** Whether the play control is disabled (4.0 Predict; the end; a play in progress; the link maximum). */
export function playDisabled(s: { hydrated: boolean; frozen: boolean; busy: boolean; atEnd: boolean; playOn: boolean; cursor: number }): boolean {
  return !s.hydrated || s.frozen || s.busy || s.atEnd || (s.playOn && playOnCap(s.cursor) === 0);
}
