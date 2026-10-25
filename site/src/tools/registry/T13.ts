// The registry entry of T13, the Satake Studio (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number 13, id
// satake, phase 6). Owner P6-A3. Presets (CONTRACTS 6): `default`, `play-theta`, `shadows`, `lights`, `data`,
// `restricted`, `catalogue`, `tau-on-black`, each the state fields it fixes (board, black, tau: SPEC 6.6) and
// a caption; the panel it opens, its root and its toggle are options outside schema 1 (6.6), kept in
// t13/config.ts. `boards` is the 32 named types, so the codec refuses any other board with its notice (6.6
// rule 8; site/src/tools/offered.ts lists the same names).
//
// The captions are computed from the engine when this module loads (COMMON 4.4: no golden value typed),
// through t13/caption.ts, which imports only the engine, t13/model.ts, t13/load.ts and the config, so that
// this module also loads in plain Node (site/tests/e2e/registry-outs.spec.ts). The browser never loads it.
import type { PresetFields, ToolRegistryEntry } from '../types';
import { T13_BOARDS, T13_OUTS, T13_PRESETS, type T13PresetId } from '../../components/tools/t13/config';
import { captionFor } from '../../components/tools/t13/caption';

function preset(id: T13PresetId): PresetFields {
  const p = T13_PRESETS[id];
  return { board: p.board, black: [...p.black], tau: [...p.tau], caption: captionFor(p) };
}

export default {
  number: 13,
  id: 'satake',
  title: 'Satake Studio',
  phase: 6,
  boards: [...T13_BOARDS],
  presets: {
    default: preset('default'),
    'play-theta': preset('play-theta'),
    shadows: preset('shadows'),
    lights: preset('lights'),
    data: preset('data'),
    restricted: preset('restricted'),
    catalogue: preset('catalogue'),
    'tau-on-black': preset('tau-on-black'),
  },
  outs: [...T13_OUTS],
  component: () => import('../../components/tools/T13SatakeStudio.svelte'),
} satisfies ToolRegistryEntry;
