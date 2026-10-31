// T13, the Satake Studio: the data that the registry entry, the component and the tests share (SPEC.md 4
// T13, 2.15, 4.0, 6.6; CONTRACTS.md 5.2 and 6). Owner P6-A3. This module imports nothing, so that the
// registry entry, which plain Node loads too (site/tests/e2e/registry-outs.spec.ts), stays small.

/** The 32 named types grouped by letter (SPEC 4.0 Board pickers; the keys of golden.types, D19). */
export const T13_BOARDS: readonly string[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8',
  'F4',
  'G2',
];

/**
 * The panels of the Studio (plan): the lights themselves, the decoration and the game board are always
 * shown; one panel below them is open at a time. A preset names the panel it opens; the panel is an option
 * outside schema 1 (SPEC 6.6), so a link opens the Studio with its default panel.
 */
export type T13Panel = 'lights' | 'data' | 'theta' | 'shadows' | 'restricted' | 'catalogue';

export interface T13PanelSpec {
  id: T13Panel;
  label: string;
}

/** The tab list, in reading order (plan). */
export const T13_PANELS: readonly T13PanelSpec[] = [
  { id: 'lights', label: 'Examples' },
  { id: 'data', label: 'Data' },
  { id: 'theta', label: 'Play θ' },
  { id: 'shadows', label: 'Shadows' },
  { id: 'restricted', label: 'Restricted board' },
  { id: 'catalogue', label: 'Catalogue' },
];

/** A preset: the state fields it fixes (labels, SPEC 6.6), the panel it opens, the root and the toggle. */
export interface T13Preset {
  board: string;
  black: number[];
  tau: number[];
  panel: T13Panel;
  /** The root chosen for theta and the composite moves, in label order; absent: the default rule. */
  root?: number[];
  /** "show tau on black nodes" (SPEC 4 T13 Toggles). */
  toggle: boolean;
}

export type T13PresetId = 'default' | 'play-theta' | 'shadows' | 'lights' | 'data' | 'restricted' | 'catalogue' | 'tau-on-black';

export const T13_PRESET_IDS: readonly T13PresetId[] = ['default', 'play-theta', 'shadows', 'lights', 'data', 'restricted', 'catalogue', 'tau-on-black'];

/**
 * The presets of CONTRACTS 6, from the figure table of SPEC 3 M9 (beats 1 to 8). `default` is the state of
 * the tool route (plan: A3 with black node 2 and the flip, su(1,3) of Appendix A.5), and `data` the same
 * state with the data panel open, as M9 beat 5 asks. Every preset is a state object and a link (4.0).
 */
export const T13_PRESETS: Readonly<Record<T13PresetId, T13Preset>> = {
  default: { board: 'A3', black: [2], tau: [3, 2, 1], panel: 'data', toggle: false },
  'play-theta': { board: 'A3', black: [1, 3], tau: [1, 2, 3], panel: 'theta', root: [0, 1, 0], toggle: false },
  shadows: { board: 'A2', black: [], tau: [2, 1], panel: 'shadows', toggle: false },
  lights: { board: 'A2', black: [], tau: [1, 2], panel: 'lights', toggle: false },
  data: { board: 'A3', black: [2], tau: [3, 2, 1], panel: 'data', toggle: false },
  restricted: { board: 'E6', black: [2, 3, 4, 5], tau: [1, 2, 3, 4, 5, 6], panel: 'restricted', toggle: false },
  catalogue: { board: 'D4', black: [], tau: [1, 2, 3, 4], panel: 'catalogue', toggle: false },
  'tau-on-black': { board: 'A5', black: [2, 3, 4], tau: [5, 4, 3, 2, 1], panel: 'data', toggle: true },
};

/** One row of the example table of SPEC 2.15 that the `lights` panel offers as a button (plan). */
export interface T13Example {
  board: string;
  black: number[];
  tau: number[];
}

/**
 * The rows of the table of SPEC 2.15 on A3 and A2, in the table's order: the five rows of A3, then the row
 * of A2. Written from the specification, never read from the golden file (the unit test finds each row in
 * satake_examples).
 */
export const T13_EXAMPLES: readonly T13Example[] = [
  { board: 'A3', black: [1, 3], tau: [1, 2, 3] },
  { board: 'A3', black: [1], tau: [1, 2, 3] },
  { board: 'A3', black: [1, 2], tau: [1, 2, 3] },
  { board: 'A3', black: [2], tau: [3, 2, 1] },
  { board: 'A3', black: [1], tau: [3, 2, 1] },
  { board: 'A2', black: [1], tau: [1, 2] },
];

/** Every data-out name T13 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T13.spec.ts). */
export const T13_OUTS = [
  // ToolFrame, History.svelte, Predict.svelte
  'caption',
  'notice',
  'noscript',
  'exportNotice',
  'citeText',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'predictResult',
  'predictReveal',
  // T13: the decoration
  'decoration',
  'black-nodes',
  'tau',
  'arrows',
  'game-board',
  // the lights
  'symmetry-reason',
  'light-1',
  'light-2',
  'light-3',
  'reason-1',
  'reason-2',
  'reason-3',
  'verdict',
  'failure-note',
  'examples',
  // the data
  'data-pending',
  'data-error',
  'real-form',
  'cartan-label',
  'restricted-type',
  'real-rank',
  'multiplicities',
  'multiplicity-classes',
  'dim-k',
  'dim-p',
  'character',
  'shape',
  // theta
  'theta-word',
  'theta-stage',
  'theta-stages',
  'theta-note',
  // shadows
  'shadow',
  'shadow-coordinates',
  'shadow-picture',
  'shadow-table',
  'no-restricted-roots',
  // the restricted board
  'restricted-board',
  'restricted-name',
  'restricted-name-note',
  'composite-word',
  'composite-length',
  // the catalogue
  'catalogue',
  'catalogue-row',
  'same-form',
] as const;
