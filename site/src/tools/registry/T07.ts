// The registry entry of T7, the Symbolic Game (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number 7, id
// symbolic, phase 3). Owner P3-A5. One preset, `default` (CONTRACTS 6): A3, the board of M5 beat 5,
// from all ones with no move. M5 places the tool with board="A3" and M6 with board="B2" through the
// common properties; nothing else is a preset. The boards offered are the 32 named types (4.0 Board
// pickers), so the codec refuses every other board with its notice (6.6 rule 8). This module is loaded
// on every tool page (the codec reads the registry), so it imports no engine function.
import type { ToolRegistryEntry } from '../types';

/** The 32 named types, grouped by letter (the order of the picker; t01/model.ts PICKER_GROUPS). */
const NAMED_TYPES = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8',
  'F4',
  'G2',
];

/** Every data-out name T7 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T07.spec.ts). */
export const T07_OUTS = [
  'caption',
  'notice',
  'noscript',
  'mode',
  'numbersBoard',
  'symbolicBoard',
  'gameOver',
  'firedForms',
  'rootTable',
  'rootRow',
  'valuesTable',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'predictResult',
  'predictReveal',
  'exportNotice',
] as const;

export default {
  number: 7,
  id: 'symbolic',
  title: 'Symbolic Game',
  phase: 3,
  boards: NAMED_TYPES,
  presets: {
    default: {
      board: 'A3',
      coords: 'numbers',
      start: [1, 1, 1],
      moves: [],
      caption:
        'Play the numbers game on the left. The right board makes the same moves with letters in place of numbers, so every number fired is a linear form. Over a complete game each positive root of the reversed board is fired exactly once.',
    },
  },
  outs: [...T07_OUTS],
  component: () => import('../../components/tools/T07SymbolicGame.svelte'),
} satisfies ToolRegistryEntry;
