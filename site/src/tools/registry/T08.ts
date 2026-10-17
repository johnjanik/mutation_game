// T8, the Weyl Explorer (SPEC.md 4 T8; CONTRACTS.md 5.2, 6). Owner P3-A6. Offered on exactly the
// fourteen boards whose group has at most CAPS.weylExplorerGroup = 1152 elements (5.6); the list is
// derived by t08/graph.ts offeredBoards() from weylOrder, and T08.test.ts proves this literal equals it
// and the golden file. Each preset is a state object and a link (4.0); the options that a schema-1
// link never carries (panel, boardChoices, plays) live in components/tools/t08/presets.ts.
import type { PresetFields, ToolRegistryEntry } from '../types';
import { PRESETS, type WeylPresetId } from '../../components/tools/t08/presets';

function fields(id: WeylPresetId): PresetFields {
  const { state, caption } = PRESETS[id];
  return {
    board: state.board,
    view: state.view!,
    mode: state.mode!,
    coords: state.coords!,
    start: [...state.start!],
    moves: [...state.moves!],
    caption,
  };
}

/** Every data-out name T8 renders (its own, then ToolFrame's, History's and Predict's). */
export const T08_OUTS = [
  'layerSizes',
  'vertex',
  'edge',
  'vertexDetails', // the details panel (t08/VertexDetails.svelte), never empty (RT-FIX P3-RT-10-06)
  'canvas', // the drawing above 192 elements, after hydration (t08/WeylGraph.svelte; RT-FIX P3-RT-10-06)
  'vertexPosition',
  'vertexWord',
  'separatingRoots',
  'gameCount',
  'pathCount',
  'brick',
  'heapCount',
  'edgeMode',
  'snapshot',
  'linkStatus',
  'limit',
  'groupOrder',
  'caption',
  'notice',
  'noscript',
  'exportNotice',
  'moveCounter',
  'historyStrip',
  'historyCounter',
  'predictResult',
  'predictReveal',
] as const;

export default {
  number: 8,
  id: 'weyl',
  title: 'Weyl Explorer',
  phase: 3,
  boards: ['A1', 'A2', 'A3', 'A4', 'A5', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'D4', 'F4', 'G2'],
  presets: {
    default: fields('default'),
    counter: fields('counter'),
    heap: fields('heap'),
  },
  outs: [...T08_OUTS],
  component: () => import('../../components/tools/T08WeylExplorer.svelte'),
} satisfies ToolRegistryEntry;
