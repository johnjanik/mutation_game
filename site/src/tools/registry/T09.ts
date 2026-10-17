// The registry entry of T9, Kostant's Game (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number 9, id
// kostant, phase 1). Owner P1-A7. One preset, `default`: M1 row 3's first board, A3 with one Martian in
// city 1 (plan). `boards` is the 32 named types in the order of golden_data.json: phase 1 offers no
// affine or custom board (E-11), so the codec refuses them with its notice (6.6 rule 8); P2-A7 widens
// it. The caption's numbers come from the engine at module load, never typed (COMMON 4.4).
import { boardFromName, kostantPlay } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import type { ToolRegistryEntry } from '../types';
import { KOSTANT_AFFINE_EXTRA, KOSTANT_BOARDS } from '../../components/tools/t09/boards';
import { AFFINE_BOARDS } from '../../components/tools/t15/boards';

// Only kostantPlay here: this module is loaded on every tool page (the codec reads the registry), so
// it must not pull in T9's end panel. F13 names the end "the highest root" on a simply laced board;
// T09.test.ts checks the caption against the golden record and the end panel.
const A3 = boardFromName('A3') as Board<number>;
const play = kostantPlay(A3, 0);

/** Every data-out name T9 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T09.spec.ts). */
export const T09_OUTS = [
  'verdict', // P2-A7: the verdict of classify beside the play-on report (MERGE added the name)
  'caption',
  'notice',
  'noscript',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'mood',
  'goal',
  'goalMet',
  'bridgeSentence',
  'endPanel',
  'endName',
  'moveCount',
  'hMinus2',
  'finalNumbers',
  'marked',
  'returnCounts',
  'affineCaption',
  'affineBoard',
  'limit',
  'predictResult',
  'predictReveal',
  'exportNotice', // ToolFrame's export notice (phase 2, P2-A6), on every tool (RT-FIX P3-RT-10-06)
] as const;

export default {
  number: 9,
  id: 'kostant',
  title: "Kostant's Game",
  phase: 1,
  // MERGE, P2 stage 2.2 (request of P2-A7): the affine boards too, so that a link such as g=D4~ loads the phase-2 'play on'.
  boards: [...KOSTANT_BOARDS, ...AFFINE_BOARDS.filter((n) => n !== 'square' && n !== 'pentagon'), ...KOSTANT_AFFINE_EXTRA],
  presets: {
    default: {
      board: 'A3',
      coords: 'populations',
      start: [1, 0, 0],
      moves: [],
      caption: `Start with one Martian in city 1 of A3 and mutate only where a city rises: the game stops after ${play.moves} moves at (${play.position.join(', ')}), the highest root, whatever the order of the moves.`,
    },
  },
  outs: [...T09_OUTS],
  component: () => import('../../components/tools/T09Kostant.svelte'),
} satisfies ToolRegistryEntry;
