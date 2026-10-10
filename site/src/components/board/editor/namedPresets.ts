// The editor's named board presets (P2-A3; SPEC 4 T4 Presets, 2.8, 2.12, 6.6, D19). Client-safe: names
// only, no golden file and no engine call, so the picker costs nothing at hydration (7.6). Each entry's
// board is the name itself, which resolveBoard builds through boardFromName when it is chosen. The test
// boards of classification_tests are not here: they are golden matrices, read at build time by
// presets.ts and passed to the island as a property.
//
// The lists are checked against the keys of golden_data.json (`types`, `affine[*].constructor_name`,
// `twisted_affine[*].name`) in site/tests/unit/boardEditor.test.ts.
import type { EditorPreset } from './types';

/** The 32 finite types of golden.types, in file order (grouped by letter). Both B2 and C2 (D19). */
export const FINITE_NAMES: readonly string[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8',
  'F4',
  'G2',
];

/** The untwisted affine boards by golden affine[T].constructor_name: the finite name and a tilde. */
export const AFFINE_NAMES: readonly string[] = FINITE_NAMES.map((n) => `${n}~`);

/** The ten twisted boards of golden twisted_affine, by name, in file order. */
export const TWISTED_NAMES: readonly string[] = [
  'A2^(2)', 'A4^(2)', 'A6^(2)', 'D3^(2)', 'D4^(2)', 'D5^(2)', 'A5^(2)', 'A7^(2)', 'E6^(2)', 'D4^(3)',
];

/** Display labels that say what M3 calls these boards (SPEC 3 M3 beats 1 and 2; plan). */
const GLOSS: Readonly<Record<string, string>> = {
  'A2~': 'A2~, the triangle',
  'D4~': 'D4~, the star with four arms',
  'B2': 'B2 (= C2)',
  'C2': 'C2 (= B2)',
};

function entry(name: string, group: EditorPreset['group']): EditorPreset {
  return { id: name, label: GLOSS[name] ?? name, board: name, group };
}

/** The finite types, then the 32 untwisted and 10 twisted affine boards (plan: the editor's default list). */
export function namedPresets(): EditorPreset[] {
  return [
    ...FINITE_NAMES.map((n) => entry(n, 'finite')),
    ...AFFINE_NAMES.map((n) => entry(n, 'affine')),
    ...TWISTED_NAMES.map((n) => entry(n, 'twisted')),
  ];
}

/** The id of a test board preset: `test:` and its classification_tests label. */
export function testPresetId(label: string): string {
  return `test:${label}`;
}
