// The boards T11 offers, in a module of its own with no import (as t05/boards.ts and t09/boards.ts):
// site/src/tools/offered.ts reads this list for the URL codec on every page that shows a tool, and the
// rest of t11/config.ts (the presets with their captions, the construction texts) must stay out of that
// shared code (SPEC.md 7.6; RT-FIX P4-RT-07-05). t11/config.ts re-exports it for the tool and its registry entry.

/**
 * The boards T11 offers (SPEC 4 T11: "A2 to A8, D4 to D8 and E6, the named types that have a symmetry
 * other than the identity"), grouped by letter in the picker. The unit test checks this list against
 * `symmetries` on all 32 golden types.
 */
export const T11_BOARDS = ['A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'D4', 'D5', 'D6', 'D7', 'D8', 'E6'] as const;
