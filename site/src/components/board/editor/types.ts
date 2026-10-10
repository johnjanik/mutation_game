// The contract of the shared board editor (P2-A3; the plan's block of build-plan/agents/P2-A3, 5.2).
// CONTRACTS.md has no entry for the editor, so this file is the contract: T4 (P2-A3) and T16 (P2-A5)
// compose BoardEditor.svelte by exactly these props. MERGE copies the three declarations into
// CONTRACTS.md 5.1.
//
// When onChange emits a name and when a matrix: while the board is a preset that the reader has not
// edited, `next` is the preset's own BoardSpec (a name such as "E6", "D4~", "A2^(2)", or the
// `{ cartan }` of a test board); from the first edit on, `next` is `{ cartan, xy }` with labels
// 1..n in order of creation (E-7) and whole grid coordinates obeying SPEC 6.1.
import type { BoardSpec } from '../../../lib/state';

export interface EditorPreset {
  id: string;
  label: string;
  board: BoardSpec;
  group: 'finite' | 'affine' | 'twisted' | 'test';
}

export interface EditorChange {
  kind: 'add-node' | 'remove-node' | 'roads' | 'move' | 'preset';
  resetsPlay: boolean;
}

export interface BoardEditorProps {
  value: BoardSpec; // SPEC 6.6 "board": a name, or { cartan, xy? }
  onChange: (next: BoardSpec, change: EditorChange) => void;
  name: string; // accessible name of the editor group (A-1)
  disabled?: boolean; // true until the host island has hydrated (7.4)
  roadStyle?: 'dynkin' | 'roads'; // ignored on a one-way board, which is always drawn in 'roads' style (6.2)
  presets?: EditorPreset[]; // section 5.3; omitted: the finite types and the affine names only
  maxNodes?: number; // default CAPS.customNodes (12); the editor never allows more
  maxRoads?: number; // default CAPS.roadsEachWay (4); the editor never allows more
  values?: (number | string)[]; // what the host writes on the nodes (T16: the position); T4 passes nothing
  marked?: readonly number[]; // labels to mark on the drawing (T4: a smallest non-finite sub-board)
}
