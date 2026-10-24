// T11, the Folding Bench: the data that the registry entry and the component share (SPEC.md 4 T11, 2.13,
// 6.6; CONTRACTS.md 5.2 and 6). Owner P4-A4. This module imports nothing: the registry module that reads
// it is loaded on every tool page (the codec reads the registry), so it must stay small.

/**
 * The boards T11 offers (SPEC 4 T11: "A2 to A8, D4 to D8 and E6, the named types that have a symmetry
 * other than the identity"), grouped by letter in the picker. The unit test checks this list against
 * `symmetries` on all 32 golden types.
 */
export { T11_BOARDS } from './boards';

/** Which game is played on both boards (T11 offers no linked view; plan). */
export type T11View = 'populations' | 'numbers';

/** The tabs of T11. `golden` is the slot of phase 7 (SPEC 2.17): present in the data, rendered nowhere. */
export type T11Tab = 'fold' | 'average' | 'golden';

export interface T11TabSpec {
  id: T11Tab;
  /** The visible label; SPEC 4 T11 names the second tab "average". */
  label: string;
  /** False until the phase that builds the tab (plan): an unreleased tab is not rendered. */
  released: boolean;
}

/** The tab list as data (plan, section 5.13 of the instruction): phase 7 releases `golden`. */
export const T11_TABS: readonly T11TabSpec[] = [
  { id: 'fold', label: 'Fold', released: true },
  { id: 'average', label: 'Average', released: true },
  { id: 'golden', label: 'Golden', released: false },
];

/** Each tab names its construction with the words of SPEC 2.13 (data-out="construction"). */
export const CONSTRUCTION: Readonly<Record<'fold' | 'average', string>> = {
  fold: 'Folding the board (orbit sums)',
  average: 'Restricting the roots (orbit averages)',
};

/** The state fields a preset fixes (6.6 names), the tab it opens, and its caption (4.0 Configuration). */
export interface T11Preset {
  board: string;
  view: T11View;
  coords: T11View;
  start: number[];
  moves: number[];
  symmetry: number[];
  tab: 'fold' | 'average';
  caption: string;
}

export const FOLD_CAPTION =
  'Folding A3 by its flip gives the board B2 = C2. One click acts on a whole orbit of the big board, and the folded board, played on its own Cartan matrix, shows the same numbers.';

export const AVERAGE_CAPTION =
  'Averaging the roots of A5 over its flip gives a root system of type C3, while folding the board by the same flip gives B3: the two constructions give dual answers.';

/**
 * The presets of CONTRACTS 6 (`fold`, `average`; `golden` arrives in phase 7) and the `default` entry the
 * registry requires (4.0: "default is the state described in this section"), which is `fold`.
 */
export const T11_PRESETS: Readonly<Record<'default' | 'fold' | 'average', T11Preset>> = {
  default: { board: 'A3', view: 'numbers', coords: 'numbers', start: [1, 1, 1], moves: [], symmetry: [3, 2, 1], tab: 'fold', caption: FOLD_CAPTION },
  fold: { board: 'A3', view: 'numbers', coords: 'numbers', start: [1, 1, 1], moves: [], symmetry: [3, 2, 1], tab: 'fold', caption: FOLD_CAPTION },
  average: {
    board: 'A5',
    view: 'numbers',
    coords: 'numbers',
    start: [1, 1, 1, 1, 1],
    moves: [],
    symmetry: [5, 4, 3, 2, 1],
    tab: 'average',
    caption: AVERAGE_CAPTION,
  },
};

export type T11PresetId = keyof typeof T11_PRESETS;
