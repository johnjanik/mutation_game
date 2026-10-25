// The 32 boards of the Atlas (SPEC.md 4 T14 "One static page per board"; 2.8, the families of finite
// type). Owner P6-A4. Written from the families of SPEC 2.8 (A1 to A8, B2 to B8, C2 to C8, D4 to D8, E6,
// E7, E8, F4, G2), never read from reference/golden_data.json; site/tests/unit/atlas.test.ts checks that
// the list equals the 32 type names of the golden file in file order (plan). No import: the picker of
// /tools/atlas (AtlasPicker.svelte) and the registry entry read this file in the browser and on every
// tool page.

/** The families of SPEC 2.8 with the ranks the Atlas covers (rank at most 8). */
const FAMILIES: readonly { letter: string; from: number; to: number }[] = [
  { letter: 'A', from: 1, to: 8 },
  { letter: 'B', from: 2, to: 8 },
  { letter: 'C', from: 2, to: 8 },
  { letter: 'D', from: 4, to: 8 },
  { letter: 'E', from: 6, to: 8 },
  { letter: 'F', from: 4, to: 4 },
  { letter: 'G', from: 2, to: 2 },
];

/** The boards grouped by letter, by rank within a letter (4.0 Board pickers: "grouped by letter"). */
export const ATLAS_GROUPS: readonly { letter: string; names: readonly string[] }[] = FAMILIES.map(({ letter, from, to }) => ({
  letter,
  names: Array.from({ length: to - from + 1 }, (_, k) => `${letter}${from + k}`),
}));

/** The 32 names, in the order of the groups. */
export const ATLAS_BOARDS: readonly string[] = ATLAS_GROUPS.flatMap((g) => g.names);

/** True for one of the 32 names. */
export function isAtlasBoard(name: unknown): name is string {
  return typeof name === 'string' && ATLAS_BOARDS.includes(name);
}
