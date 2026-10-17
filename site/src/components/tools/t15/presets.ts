// The four presets of T15 (CONTRACTS.md 6: frozen, marks-comarks, pentagon, three-fates) as state
// objects with their captions (SPEC.md 4.0 Configuration: "every preset is also a state object and a
// link"; 4.0 Starts meaningful). Shared by the registry entry and the island. No engine import: the
// registry loads this file on every tool page. The start of `frozen` on the square is the frozen
// population of a cycle, all ones (SPEC 3 M3 beat 3); T15.test.ts checks it equals marks(square). The
// pentagon start is the example of SPEC 2.12 in the site's convention, a configuration value; its level
// and the length of its play are never typed here (they come from the engine).

export type PresetId = 'frozen' | 'marks-comarks' | 'pentagon' | 'three-fates';

/** The tabs, in order (plan). `default` is not a tab: it opens `frozen`. */
export const TAB_IDS: readonly PresetId[] = ['frozen', 'marks-comarks', 'pentagon', 'three-fates'];

export const TAB_TEXT: Readonly<Record<PresetId, string>> = {
  frozen: 'Frozen population',
  'marks-comarks': 'Marks and comarks',
  pentagon: 'The pentagon',
  'three-fates': 'Three fates',
};

export interface T15PresetState {
  board: string;
  coords?: 'populations' | 'numbers';
  start?: number[];
  moves?: number[];
}

export interface T15Preset {
  state: T15PresetState;
  caption: string;
}

export const PRESETS: Readonly<Record<PresetId, T15Preset>> = {
  frozen: {
    state: { board: 'square', coords: 'populations', start: [1, 1, 1, 1], moves: [] },
    caption:
      'The frozen population on the square: every city is exactly balanced by its neighbours, so every city is happy and no mutation changes anything. Add one Martian and play: the populations start to grow.',
  },
  'marks-comarks': {
    state: { board: 'G2~' },
    caption:
      'Marks and comarks of the affine board of G2 side by side. The marks are the population that every mutation leaves fixed; the comarks weigh the level, which no firing changes. On this board the two differ.',
  },
  pentagon: {
    state: { board: 'pentagon', coords: 'numbers', start: [1, -2, 3, -4, 1], moves: [] },
    caption:
      "The 1986 Olympiad puzzle on the pentagon, in the Olympiad's own form: a negative number is flipped and added to both neighbours. Its numbers have a positive sum, which in this site's convention is a negative level, so every order of play ends, after the same number of moves.",
  },
  'three-fates': {
    state: { board: 'pentagon', coords: 'numbers', start: [1, -2, 3, -4, 1], moves: [] },
    caption:
      'On an affine board the level decides the fate of the numbers game: change a number, watch the level, and press play on to see the game end, return to an earlier position, or keep running.',
  },
};

/** Which preset id names a tab ('default' and an absent preset open `frozen`). */
export function tabOfPreset(preset: string | undefined): PresetId | null {
  if (preset === undefined || preset === '' || preset === 'default') return null;
  return (TAB_IDS as readonly string[]).includes(preset) ? (preset as PresetId) : null;
}
