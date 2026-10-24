// The spoken names of the history strip (SPEC.md 4.0 History, 7.4 "Single source of truth", 7.6
// "Main-thread work"). History.svelte reads a name for every position only while the strip shows one
// button per position; above STRIP_BUTTONS_MAX positions it is a slider that reads the name of the
// cursor alone. So a tool names at most STRIP_BUTTONS_MAX positions per change, however long the play
// is, and a move costs the same after 10 moves and after 20000 (RT-FIX P3-RT-07-01).

/** "A strip of more than 50 positions is shown as a slider with a counter" (4.0 History). */
export const STRIP_BUTTONS_MAX = 50;

/**
 * The `positionNames` History reads for a play of `total` moves with the cursor at `cursor`: every
 * position's name (0..total) when there are at most STRIP_BUTTONS_MAX positions, otherwise an array
 * of length total + 1 holding only the cursor's name. `nameAt(k)` is called once per name returned.
 */
export function historyNames(total: number, cursor: number, nameAt: (k: number) => string): string[] {
  const count = total + 1;
  if (count <= STRIP_BUTTONS_MAX) return Array.from({ length: count }, (_, k) => nameAt(k));
  const names: string[] = [];
  names.length = count;
  if (cursor >= 0 && cursor < count) names[cursor] = nameAt(cursor);
  return names;
}
