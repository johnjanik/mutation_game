// The registry entry of T15, the Affine Playground (CONTRACTS.md 5.2 and 6; SPEC.md 4 T15, 4.0; the
// table at the head of SPEC 4: number 15, id affine, phase 2). Owner P2-A4. Five presets: `default`
// (the same state and caption as `frozen`, the tool's first appearance in M3 beat 3; not a fifth tab)
// and the four ids of CONTRACTS 6, each a state object and a link. `boards` is the list of 44 names of
// SPEC 4 T15 (t15/boards.ts), so the codec refuses every other board (6.6 rule 8). This module is
// loaded on every tool page through the codec: it imports no engine function.
import type { PresetFields, ToolRegistryEntry } from '../types';
import { AFFINE_BOARDS } from '../../components/tools/t15/boards';
import { PRESETS, type PresetId } from '../../components/tools/t15/presets';

function fields(id: PresetId): PresetFields {
  const { state, caption } = PRESETS[id];
  const out: PresetFields = { board: state.board, caption };
  if (state.coords !== undefined) out.coords = state.coords;
  if (state.start !== undefined) out.start = [...state.start];
  if (state.moves !== undefined) out.moves = [...state.moves];
  return out;
}

/** Every data-out name T15 renders, its own then ToolFrame's (listed in site/tests/e2e/T15.spec.ts). */
export const T15_OUTS = [
  'boardName',
  'verdict',
  'tab',
  'moods',
  'rootTest',
  'marks',
  'comarks',
  'coincide',
  'level',
  'levelSign',
  'sum',
  'convention',
  'fate',
  'firstVisit',
  'fateSentence',
  'provenance',
  'gameOver',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'busy',
  'predictResult',
  'predictReveal',
  'caption',
  'notice',
  'noscript',
  'exportNotice',
] as const;

export default {
  number: 15,
  id: 'affine',
  title: 'Affine Playground',
  phase: 2,
  boards: [...AFFINE_BOARDS],
  presets: {
    default: fields('frozen'),
    frozen: fields('frozen'),
    'marks-comarks': fields('marks-comarks'),
    pentagon: fields('pentagon'),
    'three-fates': fields('three-fates'),
  },
  outs: [...T15_OUTS],
  component: () => import('../../components/tools/T15AffinePlayground.svelte'),
} satisfies ToolRegistryEntry;
