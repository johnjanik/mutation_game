// The registry entry of T1, the Game Board (CONTRACTS.md 5.2; SPEC.md 4 table: number 1, id board,
// phase 1). "T1 and T14 have no presets" (CONTRACTS 6): `default` holds the state of the tool's own
// route, because ToolRegistryEntry requires one (plan; decisions/P1-A5.md). `boards: 'all'` means, in
// phase 1, the 32 named types of the picker and any custom Cartan matrix of at most 12 nodes by link;
// affine boards arrive in phase 2. The caption's numbers come from the engine, never typed.
import { boardFromName, toNumbers } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import type { ToolRegistryEntry } from '../types';

const A2 = boardFromName('A2') as Board<number>;
const numbers = toNumbers(A2, [1, 0]).map((x) => String(x).replace('-', '−'));

/** Every data-out name T1 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T01.spec.ts). */
export const T01_OUTS = [
  'formValue', // P2-A7: the three panels of phase 2 and the play-on fate (MERGE added the names)
  'level',
  'lengths',
  'fate',
  'caption',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'mode',
  'gameOver',
  'bridgeSentence',
  'aCp',
  'notice',
  'limit',
  'scriptCaption',
  'roundCounter',
  'goal',
  'goalMet',
  'goalNote',
  'predictResult',
  'predictReveal',
  'noscript',
] as const;

/** The outs that only properties can produce (script, rounds, goal, prediction): checked by server render. */
// The phase-2 panels appear only when a page names them in `panels`, and the fate only off the finite types (P2-A7).
export const T01_PROP_ONLY_OUTS: readonly string[] = ['scriptCaption', 'roundCounter', 'goal', 'goalMet', 'goalNote', 'predictResult', 'predictReveal', 'formValue', 'level', 'lengths', 'fate'];

export default {
  number: 1,
  id: 'board',
  title: 'Game Board',
  phase: 1,
  boards: 'all',
  presets: {
    default: {
      board: 'A2',
      view: 'linked',
      mode: 'free',
      coords: 'populations',
      start: [1, 0],
      caption: `One Martian in city 1 of A2 gives the numbers ${numbers.join(' and ')}: each number is the amount by which a mutation would lower its city, so one move changes both records at once.`,
    },
  },
  outs: [...T01_OUTS],
  component: () => import('@components/tools/T01GameBoard.svelte'),
} satisfies ToolRegistryEntry;
