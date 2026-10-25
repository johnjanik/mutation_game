// The registry entry of T5, the Numbers Game Lab (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number 5, id
// numbers, phase 3). Owner P3-A3. Presets: default, tally, wave, compared, dimension (CONTRACTS 6, plus
// default, 4.0 Configuration). Each holds the state fields it fixes and its caption; the tab, the colour
// that starts the wave and game B's moves are options outside schema 1, kept in t05/presets.ts (6.6).
// Moves and captions come from the engine (t05/presets.ts), never typed. `boards` is the 32 named types,
// so the codec refuses any other board with its notice (6.6 rule 8). This module is loaded on every tool
// page (the codec reads the registry), so it imports only the presets module.
import type { ToolRegistryEntry, PresetFields } from '../types';
import { T05_BOARDS } from '../../components/tools/t05/boards';
import { PRESET_IDS, presetCaption, presetState, type PresetId } from '../../components/tools/t05/presets';

/** Every data-out name T5 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T05.spec.ts). */
export const T05_OUTS = [
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
  'startKind',
  'tape',
  'tallyBar',
  'tallyNote',
  'exponents',
  'exponentProduct',
  'groupOrder',
  'gameOver',
  'limit',
  'waveRounds',
  'waveLegal',
  'waveNote',
  'coxeterNumber',
  'colourClass',
  'sortedA',
  'sortedB',
  'tapesAgree',
  'compareStatus',
  'endA',
  'endB',
  'movesA',
  'movesB',
  'lambda',
  'tapeRho',
  'tapeLambdaRho',
  'productRho',
  'productLambdaRho',
  'dimension',
  'dimensionNote',
] as const;

function preset(id: PresetId): PresetFields {
  return { ...presetState(id), caption: presetCaption(id) };
}

const presets = Object.fromEntries(PRESET_IDS.map((id) => [id, preset(id)])) as { default: PresetFields } & Record<string, PresetFields>;

export default {
  number: 5,
  id: 'numbers',
  title: 'Numbers Game Lab',
  phase: 3,
  boards: [...T05_BOARDS],
  presets,
  outs: [...T05_OUTS],
  component: () => import('../../components/tools/T05NumbersGameLab.svelte'),
} satisfies ToolRegistryEntry;
