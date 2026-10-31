// The registry entry of T11, the Folding Bench (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number 11, id
// fold, phase 4). Owner P4-A4. Presets (CONTRACTS 6): `fold` and `average`; `golden` arrives in phase 7.
// `default` is required by the registry (4.0: "default is the state described in this section") and is
// `fold`. Each preset holds the state fields it fixes and its caption; the tab it opens is an option
// outside schema 1 (6.6), kept in t11/config.ts. `boards` is the thirteen named types with a symmetry
// other than the identity, so the codec refuses any other board with its notice (6.6 rule 8).
//
// This module is loaded on every tool page (the codec reads the registry): it imports only t11/config.ts,
// which imports nothing.
import type { PresetFields, ToolRegistryEntry } from '../types';
import { T11_BOARDS, T11_PRESETS, type T11PresetId } from '../../components/tools/t11/config';

/** Every data-out name T11 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T11.spec.ts). */
export const T11_OUTS = [
  // ToolFrame, History.svelte, Predict.svelte
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
  // T11
  'symmetry',
  'construction',
  'big-board',
  'folded-board',
  'folded-name',
  'folded-name-note',
  'fold-message',
  'orbits',
  'averaged-name',
  'averaged-name-note',
  'averaged-classes',
] as const;

function preset(id: T11PresetId): PresetFields {
  const { tab: _tab, ...fields } = T11_PRESETS[id];
  return { ...fields, start: [...fields.start], moves: [...fields.moves], symmetry: [...fields.symmetry] };
}

export default {
  number: 11,
  id: 'fold',
  title: 'Folding Bench',
  phase: 4,
  boards: [...T11_BOARDS],
  presets: { default: preset('default'), fold: preset('fold'), average: preset('average') },
  outs: [...T11_OUTS],
  component: () => import('../../components/tools/T11FoldingBench.svelte'),
} satisfies ToolRegistryEntry;
