// The registry entry of T10, the Geometry Studio (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number 10, id
// geometry, phase 4). Owner P4-A3. Presets (CONTRACTS 6): root-polytope, rings, face-table, two-graphs,
// make-uniform, showpiece, coxeter-plane; `default` is required by the registry (4.0) and is the root
// polytope of A3, the cuboctahedron wireframe of M7 beat 1. Each preset holds the state fields it fixes
// (board, rings, projection, graph) and its caption. `boards` is the 32 named finite types.
//
// This module is loaded on every tool page (the codec reads the registry): it imports only t10/config.ts,
// which imports nothing.
import type { PresetFields, ToolRegistryEntry } from '../types';
import { T10_BOARDS, T10_OUTS, T10_PRESETS, type T10PresetId } from '../../components/tools/t10/config';

function preset(id: T10PresetId): PresetFields {
  const { board, rings, projection, graph, caption } = T10_PRESETS[id];
  return { board, rings: [...rings], projection, graph, caption };
}

export default {
  number: 10,
  id: 'geometry',
  title: 'Geometry Studio',
  phase: 4,
  boards: [...T10_BOARDS],
  presets: {
    default: preset('default'),
    'root-polytope': preset('root-polytope'),
    rings: preset('rings'),
    'face-table': preset('face-table'),
    'two-graphs': preset('two-graphs'),
    'make-uniform': preset('make-uniform'),
    showpiece: preset('showpiece'),
    'coxeter-plane': preset('coxeter-plane'),
  },
  outs: [...T10_OUTS],
  component: () => import('../../components/tools/T10GeometryStudio.svelte'),
} satisfies ToolRegistryEntry;
