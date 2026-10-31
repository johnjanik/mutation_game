// The registry entry of T12, the Representation Builder (CONTRACTS.md 5.2 and 6; SPEC.md 4 table: number
// 12, id rep, phase 5). Owner P5-A2. Presets (CONTRACTS 6): `string-viewer`, `default`, `relation-checker`,
// `signed-move`; `one-zero-weight` arrives in phase 7 (SPEC 2.18 "One zero weight"). Each preset holds the
// state fields it fixes and its caption; the panel it puts first is an option outside schema 1 (6.6), kept
// in t12/config.ts. `boards` is the 32 named types, so the codec refuses any other board with its notice
// (6.6 rule 8) once site/src/tools/offered.ts lists it (a request to MERGE); T12 refuses them itself too.
//
// The captions are computed from the engine when this module loads (COMMON 4.4: no golden value typed),
// through t12/rep.ts, which imports only the engine and the layered layout, so that this module also loads
// in plain Node (site/tests/e2e/registry-outs.spec.ts). The browser never loads the registry.
import { boardFromName } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import type { PresetFields, ToolRegistryEntry } from '../types';
import { T12_BOARDS, T12_OUTS, T12_PRESETS, type T12PresetId } from '../../components/tools/t12/config';
import { buildRepresentation, byPosition, relationCaption, repCaption, signedCaption, stringCaption, stringView } from '../../components/tools/t12/rep';

function preset(id: T12PresetId): PresetFields {
  const { first, ...fields } = T12_PRESETS[id];
  const board = boardFromName(fields.board) as Board<number>;
  const rep = buildRepresentation(board, fields.node);
  let caption: string;
  if (first === 'string') caption = stringCaption(fields.board, stringView(board as Board<unknown>, byPosition(board, fields.start), fields.node));
  else if (first === 'relations') caption = relationCaption(rep, fields.relation);
  else if (first === 'signed') caption = signedCaption(rep, fields.node);
  else caption = repCaption(rep);
  return { ...fields, start: [...fields.start], moves: [...fields.moves], caption };
}

export default {
  number: 12,
  id: 'rep',
  title: 'Representation Builder',
  phase: 5,
  boards: [...T12_BOARDS],
  presets: {
    default: preset('default'),
    'string-viewer': preset('string-viewer'),
    'relation-checker': preset('relation-checker'),
    'signed-move': preset('signed-move'),
  },
  outs: [...T12_OUTS],
  component: () => import('../../components/tools/T12RepresentationBuilder.svelte'),
} satisfies ToolRegistryEntry;
