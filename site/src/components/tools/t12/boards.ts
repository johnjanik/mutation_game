// The boards T12 offers, in a module of its own with no import (as t05/boards.ts, t09/boards.ts and
// t11/boards.ts): site/src/tools/offered.ts can read this list for the URL codec on every page that shows
// a tool without loading the rest of T12 (SPEC.md 7.6; RT-FIX P3-RT-07-04, P4-RT-07-05). Owner P5-A2.

/**
 * The boards T12 offers: the 32 named finite types of golden_data.json, grouped by letter (SPEC 4.0 Board
 * pickers: "A tool whose description names no particular boards offers the 32 named types, grouped by
 * letter"; SPEC 4 T12 "For any node i of a named board"). Affine, twisted, preset and custom boards are
 * not offered: the representation functions throw NeedsTwoWayRoads or NotFiniteType off the finite types
 * (SPEC 5.6). B2 and C2 are two entries (D19: the picker shows the name the reader chose).
 */
export const T12_BOARDS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8',
  'F4',
  'G2',
] as const;

export type T12Board = (typeof T12_BOARDS)[number];

/** True for a name T12 offers. */
export function offersBoard(name: unknown): name is T12Board {
  return typeof name === 'string' && (T12_BOARDS as readonly string[]).includes(name);
}
