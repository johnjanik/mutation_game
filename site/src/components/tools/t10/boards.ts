// The boards T10 offers, in a module of its own with no import (as t05/boards.ts and t09/boards.ts):
// site/src/tools/offered.ts reads this list for the URL codec on every page that shows a tool, and the
// rest of t10/config.ts (the presets with their captions, the outs) must stay out of that shared code
// (SPEC.md 7.6; RT-FIX P4-RT-07-05). t10/config.ts re-exports it for the tool and its registry entry.

/** The boards T10 offers, grouped by letter in the picker (SPEC 2.8; D19: named as the reader chose them). */
export const T10_BOARDS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8',
  'F4', 'G2',
] as const;
