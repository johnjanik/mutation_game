// The editor's board presets with the test boards (P2-A3; SPEC 4 T4 Presets, 7.6). BUILD TIME ONLY:
// this module reads reference/golden_data.json through @lib/golden, so it must never be imported by a
// .svelte file or anything else that reaches the browser (the golden file is 455 kB). Pages and
// lessons call it in their frontmatter and pass the result to the island as a serialised property:
//   <T04ClassificationLab boardPresets={testBoardPresets()} ... />
// and lesson authors write `board={testBoard('one-way road')}` without typing a matrix.
import { resolveGoldenPath } from '../../../lib/golden';
import type { BoardSpec } from '../../../lib/state';
import { namedPresets, testPresetId } from './namedPresets';
import type { EditorPreset } from './types';

interface TestRecord {
  label: string;
  cartan: number[][];
}

function testRecords(): TestRecord[] {
  return resolveGoldenPath('classification_tests') as TestRecord[];
}

/** The thirteen test boards of classification_tests, by label, each as `{ cartan }` with labels 1..n. */
export function testBoardPresets(): EditorPreset[] {
  return testRecords().map((r) => ({
    id: testPresetId(r.label),
    label: r.label,
    board: { cartan: r.cartan.map((row) => [...row]) },
    group: 'test' as const,
  }));
}

/** Every preset of the picker: 32 finite types, 32 untwisted and 10 twisted affine boards, 13 test boards. */
export function editorPresets(): EditorPreset[] {
  return [...namedPresets(), ...testBoardPresets()];
}

/** The board of a classification_tests record by its label (for lesson authors; throws on an unknown label). */
export function testBoard(label: string): BoardSpec {
  const r = testRecords().find((t) => t.label === label);
  if (r === undefined) throw new Error(`no test board labelled ${JSON.stringify(label)} in classification_tests`);
  return { cartan: r.cartan.map((row) => [...row]) };
}
