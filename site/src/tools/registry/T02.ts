// T2, the Orbit Garden (SPEC.md 4 T2; CONTRACTS.md 5.2, 6). Owner P1-A6. Each preset is a state object
// and a link (4.0 Configuration); the options that 6.6 keeps out of a link (growth mode, what grows,
// grown, layers, positive roots only, labels, board choices) live in components/tools/t02/presets.ts
// beside the state, and the component reads them from there.
import type { PresetFields, ToolRegistryEntry } from '../types';
import { PRESETS, type GardenPresetId } from '../../components/tools/t02/presets';

function fields(id: GardenPresetId): PresetFields {
  const { state, caption } = PRESETS[id];
  const out: PresetFields = { board: state.board, caption };
  if (state.coords !== undefined) out.coords = state.coords;
  if (state.start !== undefined) out.start = [...state.start];
  if (state.moves !== undefined) out.moves = [...state.moves];
  return out;
}

export default {
  number: 2,
  id: 'garden',
  title: 'Orbit Garden',
  phase: 1,
  boards: 'all',
  presets: {
    default: fields('default'),
    follow: fields('follow'),
    explore: fields('explore'),
    'positive-roots': fields('positive-roots'),
    'triangle-40': fields('triangle-40'),
  },
  // Every data-out the tool renders: its own, then ToolFrame's.
  outs: ['found', 'total', 'stopMessage', 'verdict', 'layersGrown', 'layerChart', 'vertex', 'edge', 'rise', 'tableRow', 'chartRow', 'strip', 'caption', 'notice', 'noscript', 'exportNotice'],
  component: () => import('../../components/tools/T02OrbitGarden.svelte'),
} satisfies ToolRegistryEntry;
