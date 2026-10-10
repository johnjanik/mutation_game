// The boards T15, the Affine Playground, offers (SPEC.md 4 T15, first sentence; 4.0 Board pickers;
// 6.6 rule 8). Written out as literals so that neither the registry nor the island imports the golden
// file; site/tests/unit/tools/T15.test.ts checks them against `affine[*].constructor_name`,
// `twisted_affine[*].name` (file order), `square` and `pentagon`. B2~ and C2~ are two numberings of
// one board; both are listed, each shown under the name the reader chose (D19). No import: the
// registry entry loads this file on every tool page.

export interface BoardGroup {
  /** The group's heading in the picker (plan): untwisted boards by letter, then twisted, then polygons. */
  readonly label: string;
  readonly names: readonly string[];
}

/** The 44 boards in picker order, grouped (plan). */
export const AFFINE_BOARD_GROUPS: readonly BoardGroup[] = [
  { label: 'Untwisted, type A', names: ['A1~', 'A2~', 'A3~', 'A4~', 'A5~', 'A6~', 'A7~', 'A8~'] },
  { label: 'Untwisted, type B', names: ['B2~', 'B3~', 'B4~', 'B5~', 'B6~', 'B7~', 'B8~'] },
  { label: 'Untwisted, type C', names: ['C2~', 'C3~', 'C4~', 'C5~', 'C6~', 'C7~', 'C8~'] },
  { label: 'Untwisted, type D', names: ['D4~', 'D5~', 'D6~', 'D7~', 'D8~'] },
  { label: 'Untwisted, type E', names: ['E6~', 'E7~', 'E8~'] },
  { label: 'Untwisted, type F', names: ['F4~'] },
  { label: 'Untwisted, type G', names: ['G2~'] },
  { label: 'Twisted', names: ['A2^(2)', 'A4^(2)', 'A6^(2)', 'D3^(2)', 'D4^(2)', 'D5^(2)', 'A5^(2)', 'A7^(2)', 'E6^(2)', 'D4^(3)'] },
  { label: 'Polygons', names: ['square', 'pentagon'] },
];

/** The 44 names, in picker order (the registry's `boards`). */
export const AFFINE_BOARDS: readonly string[] = AFFINE_BOARD_GROUPS.flatMap((g) => g.names);
