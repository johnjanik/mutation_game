// The registry entry of T6, the Kaleidoscope (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number 6, id
// mirror, phase 3). Owner P3-A4. One preset, `default` (CONTRACTS 6: "point at a = (1,1)"): A2 with the
// point at a = (1, 1), overlays off (M4 beat 4, row 4). M2 beat 4 places the same preset with the
// property overlays={["roots"]}. `boards` is exactly the four rank 2 boards of SPEC 4 T6 under their
// own names (D19), so the codec refuses any other with its notice (6.6 rule 8).
//
// This module is loaded on every tool page (the codec reads the registry): it imports nothing but types.
import type { ToolRegistryEntry } from '../types';

/** Every data-out name T6 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T06.spec.ts). */
export const T06_OUTS = [
  'caption',
  'notice',
  'noscript',
  'exportNotice',
  'citeText', // ToolFrame, after a click on Cite (P6-A5)
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'predictResult',
  'predictReveal',
  'boardName',
  'numbers',
  'population',
  'equation',
  'bridge',
  'point',
  'distance',
  'parallelogram',
  'simpleRoot',
  'mirror',
  'chamber',
  'root',
  'orbitPoint',
  'latticeDot',
  'offView',
] as const;

/** Every data-control name T6 renders beyond ToolFrame's own (listed in site/tests/e2e/T06.spec.ts). */
export const T06_CONTROLS = [
  'picker',
  'plane',
  'a1-minus',
  'a1-plus',
  'a2-minus',
  'a2-plus',
  'overlay-roots',
  'overlay-orbit',
  'overlay-lattices',
  'undo',
  'redo',
  'reset',
  'historySlider',
] as const;

export default {
  number: 6,
  id: 'mirror',
  title: 'Kaleidoscope',
  phase: 3,
  boards: ['A2', 'B2', 'C2', 'G2'],
  presets: {
    default: {
      board: 'A2',
      coords: 'numbers',
      start: [1, 1],
      moves: [],
      caption:
        'Firing a node reflects the point in its mirror. The numbers are the scaled distances to the two mirrors, the population is the pair of coefficients along the two normals, and the two stay linked by a = Cp.',
    },
  },
  outs: [...T06_OUTS],
  component: () => import('../../components/tools/T06Kaleidoscope.svelte'),
} satisfies ToolRegistryEntry;
