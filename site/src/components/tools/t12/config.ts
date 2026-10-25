// T12, the Representation Builder: the data the registry entry and the component share (SPEC.md 4 T12,
// 2.18, 3 M8, 4.0 Configuration, 6.6; CONTRACTS.md 5.2 and 6). Owner P5-A2. This module imports only the
// board list: the registry entry reads it in plain Node (site/tests/e2e/registry-outs.spec.ts), and the
// captions are computed from the engine in t12/rep.ts, never typed here.
import { T12_BOARDS } from './boards';

export { T12_BOARDS, offersBoard, type T12Board } from './boards';

/**
 * The panels of the tool, in their reading order on the default state (plan). A preset may put one panel
 * first ("which panel a preset opens"); that choice is an option outside schema 1 (6.6), so it is never
 * part of a link and Copy link carries only the state fields.
 */
export const T12_PANELS = ['orbit', 'matrices', 'relations', 'signed', 'string'] as const;
export type T12Panel = (typeof T12_PANELS)[number];

/** The state fields a preset fixes (6.6 names), the panel it puts first, nothing else (4.0 Configuration). */
export interface T12Preset {
  board: string;
  node: number;
  relation: string;
  coords: 'numbers';
  start: number[];
  moves: number[];
  first: T12Panel | null;
}

/**
 * The presets of CONTRACTS 6 that exist in phase 5 (`one-zero-weight` arrives in phase 7, SPEC 2.18 "One
 * zero weight"), matched to the figure table of SPEC 3 M8:
 * - `default` (rows 2 and 4, with the lesson's `board` and `node`): A2, node 1, [E1, F1] = H1, the string
 *   through omega_1; the smallest case with 3 by 3 matrices (M8 beat 3);
 * - `string-viewer` (row 1): the string through (2, 0) at node 1 of A2, the string viewer first;
 * - `relation-checker` (row 3): A2, node 1, ef:1,1, the relation checker first; the reader then picks ef:1,2;
 * - `signed-move` (row 5): A2, node 1, the move beside its signed version first.
 */
export const T12_PRESETS: Readonly<Record<'default' | 'string-viewer' | 'relation-checker' | 'signed-move', T12Preset>> = {
  default: { board: 'A2', node: 1, relation: 'ef:1,1', coords: 'numbers', start: [1, 0], moves: [], first: null },
  'string-viewer': { board: 'A2', node: 1, relation: 'ef:1,1', coords: 'numbers', start: [2, 0], moves: [], first: 'string' },
  'relation-checker': { board: 'A2', node: 1, relation: 'ef:1,1', coords: 'numbers', start: [1, 0], moves: [], first: 'relations' },
  'signed-move': { board: 'A2', node: 1, relation: 'ef:1,1', coords: 'numbers', start: [1, 0], moves: [], first: 'signed' },
};

export type T12PresetId = keyof typeof T12_PRESETS;

export const T12_PRESET_IDS = Object.keys(T12_PRESETS) as T12PresetId[];

/**
 * Every data-out name T12 renders (SPEC 4.0 Test hooks; CONTRACTS 5.2 `outs`; listed in
 * site/tests/e2e/T12.spec.ts). MatrixView.svelte takes its name from T12 (the `out` prop), so the seven
 * matrix names are T12's.
 */
export const T12_OUTS = [
  // ToolFrame, History.svelte, Predict.svelte
  'caption',
  'notice',
  'noscript',
  'exportNotice',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'predictResult',
  'predictReveal',
  // T12: the representation (the board and the node of the state shown, labels, for a lesson's checks)
  'state-board',
  'state-node',
  'dimension',
  'orbit-size',
  'minuscule',
  'explanation',
  'no-minuscule',
  'limit',
  'orbit-graph',
  'matrix-e',
  'matrix-f',
  'matrix-h',
  'relation-formula',
  'relation-verdict',
  'relation-left',
  'relation-right',
  'all-relations',
  'move-matrix',
  'signed-move',
  // T12: the string viewer
  'string-position',
  'string-length',
  'string-note',
  'start-message',
] as const;

/** The names of T12_OUTS that the default state does not render (a prediction; above the cap; a typed start refused). */
export const T12_CONDITIONAL_OUTS: readonly string[] = ['notice', 'predictResult', 'predictReveal', 'historyCounter', 'no-minuscule', 'limit', 'start-message'];

/** The board list as data for the picker: one group per letter (4.0 Board pickers). */
export const T12_GROUPS: readonly { letter: string; names: readonly string[] }[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter) => ({
  letter,
  names: T12_BOARDS.filter((n) => n.startsWith(letter)),
}));
