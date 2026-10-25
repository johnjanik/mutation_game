// The registry entry of T16, the Sandbox (P2-A5; CONTRACTS.md 5.2 and 6; SPEC.md 4 T16, 4.0; the table
// at the head of SPEC 4: number 16, id sandbox, phase 2). One preset, `default` (CONTRACTS 6), which
// fixes the default state and carries the caption. `boards: 'all'`: every name the editor's picker
// offers and every custom board the codec accepts (6.6 rule 8 refuses none). `released: true`: the
// form P1-A4 settled (lib/pages/released.ts reads the raw registry file; only an explicit false
// withholds a tool), so ModuleLinks closes every module with a link to the sandbox and its board.
// This module is loaded on every tool page through the codec: it imports nothing, and no golden value
// (the caption types neither the move after which the entries pass 2^53 nor the digit count).
import type { PresetFields, ToolRegistryEntry } from '../types';

/** Every data-out name T16 renders: its own, then T1's parts, History's, the editor's, ToolFrame's. */
export const T16_OUTS = [
  'verdict',
  'verdictName',
  'verdictBourbaki',
  'verdictMarks',
  'verdictComarks',
  'mode',
  'importStatus',
  'boardJson',
  'aCp',
  'bridgeSentence',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'editorSubject',
  'editorReason',
  'caption',
  'notice',
  'noscript',
  'exportNotice',
  'citeText', // ToolFrame, after a click on Cite (P6-A5)
] as const;

const DEFAULT: PresetFields = {
  board: {
    cartan: [
      [2, -3],
      [-3, 2],
    ],
    xy: [
      [0, 0],
      [1, 0],
    ],
  },
  view: 'populations',
  mode: 'free',
  coords: 'populations',
  start: [1, 0],
  moves: [],
  caption:
    'Two cities joined by three roads each way, a board the verdict calls indefinite. Both games are played freely here, with exact integers of any size: on this board the entries pass 2^53 within a few dozen moves, and every digit stays exact.',
};

export default {
  number: 16,
  id: 'sandbox',
  title: 'Sandbox',
  phase: 2,
  boards: 'all',
  presets: {
    default: DEFAULT,
  },
  outs: [...T16_OUTS],
  component: () => import('../../components/tools/T16Sandbox.svelte'),
  released: true,
} satisfies ToolRegistryEntry;
