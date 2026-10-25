// The registry entry of T3, the Form Finder (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number 3, id
// form, phase 2). Owner P2-A2. Presets `meter`, `builder`, `small-values` (and `default`, which every
// entry has): the state part is a link, the part brought to the front lives in t03/presets.ts.
// `boards: 'all'`, as T1 and T2: the picker shows the 32 named types grouped by letter (4.0), and the
// codec (6.6 rule 8) accepts every board resolveBoard resolves, so pages and links can place the tool
// on A2~, D4~, pentagon, square or a custom matrix (M3 beat 2). No engine import: this module is
// loaded on every tool page through the codec.
import type { PresetFields, ToolRegistryEntry } from '../types';
import { FORM_PRESETS, type FormPresetId } from '../../components/tools/t03/presets';

function fields(id: FormPresetId): PresetFields {
  const { state, caption } = FORM_PRESETS[id];
  return { board: state.board, coords: state.coords!, start: [...state.start!], moves: [...state.moves!], caption };
}

/** Every data-out name T3 renders (SPEC 4.0 Test hooks; listed in site/tests/e2e/T03.spec.ts): its own, then those of History, Predict and ToolFrame. */
export const T03_OUTS = [
  'formValue',
  'meterNote',
  'testVerdict',
  'witness',
  'smallValue',
  'smallVerdict',
  'digitNotice',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'predictResult',
  'predictReveal',
  'caption',
  'notice',
  'noscript',
  'exportNotice',
  'citeText', // ToolFrame, after a click on Cite (P6-A5)
] as const;

export default {
  number: 3,
  id: 'form',
  title: 'Form Finder',
  phase: 2,
  boards: 'all',
  presets: {
    default: fields('default'),
    meter: fields('meter'),
    builder: fields('builder'),
    'small-values': fields('small-values'),
  },
  outs: [...T03_OUTS],
  component: () => import('../../components/tools/T03FormFinder.svelte'),
} satisfies ToolRegistryEntry;
