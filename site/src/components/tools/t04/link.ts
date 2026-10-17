// The length guard of T4's link (P2-A3; SPEC 6.6: "a g parameter longer than 512 characters" is refused).
// The query string is assembled by hand, so the length that counts is that of the value as written by
// encodeBoard. No board the editor can make reaches the limit (at most 493 characters: 12 rows of at most
// 34 characters, 11 semicolons, c: and @, and 12 coordinate pairs); the check stays as a guard (plan).
import { encodeBoard } from '../../../lib/urlCodec';
import type { BoardSpec } from '../../../lib/state';

export const G_LIMIT = 512;

/** The value of `g` for a board, as the codec writes it. */
export function gValue(spec: BoardSpec): string {
  return encodeBoard(spec);
}

/** True when a `g` value (or a board's) is short enough for a link the codec will read. */
export function linkFits(value: string | BoardSpec): boolean {
  const text = typeof value === 'string' ? value : gValue(value);
  return text.length <= G_LIMIT;
}

/** The notice shown when a board is too large for a link (plan wording). */
export const TOO_LONG_NOTICE = 'This board is too large for a link; use Download data to keep it.';
