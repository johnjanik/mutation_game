// The boards T9 offers in phase 1 (SPEC.md 4.0 Board pickers, E-11): the 32 named finite types, in the
// order of the keys of golden_data.json `types` (checked against the file in T09.test.ts). A module of
// its own with no import, because the registry entry (loaded on every tool page through the codec)
// needs the list and nothing else of T9.
/** The affine boards the recipe of 2.12 can name (kostant[*].affine_board_from_node), beyond T15's 44 (MERGE, P2 stage 2.2). */
export const KOSTANT_AFFINE_EXTRA: readonly string[] = ['A9^(2)', 'A11^(2)', 'A13^(2)', 'A15^(2)', 'D6^(2)', 'D7^(2)', 'D8^(2)', 'D9^(2)'];

export const KOSTANT_BOARDS: readonly string[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8',
  'F4',
  'G2',
];
