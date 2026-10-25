// The registry entry of T4, the Classification Lab (P2-A3; CONTRACTS.md 5.2 and 6; SPEC.md 4 table:
// number 4, id lab, phase 2). This module is loaded on every tool page (the codec reads the registry),
// so it imports only T4's tiny preset table and nothing of the engine. T4 offers every valid board of at
// most 12 nodes ('all'): names, affine and twisted names, and custom matrices (6.6 rule 8 refuses none).
import type { PresetFields, ToolRegistryEntry } from '../types';
import { LAB_PRESETS, type LabPresetId } from '../../components/tools/t04/toolPresets';

/** Every data-out name T4 renders (its own, then the editor's, then ToolFrame's); listed in T04.spec.ts. */
export const T04_OUTS = [
  'nodeCount',
  'kind',
  'verdictClass',
  'verdictName',
  'componentNodes',
  'bourbakiOrder',
  'marks',
  'comarks',
  'balanced',
  'weights',
  'spectralRadius',
  'nonfiniteSubboard',
  'rootCount',
  'layerCounts',
  'completeCount',
  'stopMessage',
  'counterStatus',
  'counterNotice',
  'hunterResult',
  'linkNotice',
  'editorSubject',
  'editorMarked',
  'editorReason',
  'caption',
  'notice',
  'noscript',
  'exportNotice',
  'citeText', // ToolFrame, after a click on Cite (P6-A5)
] as const;

function fields(id: LabPresetId): PresetFields {
  const p = LAB_PRESETS[id];
  const board = typeof p.board === 'string' ? p.board : { cartan: p.board.cartan.map((r) => [...r]), ...(p.board.xy ? { xy: p.board.xy.map((q) => [q[0], q[1]] as [number, number]) } : {}) };
  return { board, caption: p.caption };
}

export default {
  number: 4,
  id: 'lab',
  title: 'Classification Lab',
  phase: 2,
  boards: 'all',
  presets: {
    default: fields('default'),
    verdict: fields('verdict'),
    hunter: fields('hunter'),
  },
  outs: [...T04_OUTS],
  component: () => import('../../components/tools/T04ClassificationLab.svelte'),
} satisfies ToolRegistryEntry;
