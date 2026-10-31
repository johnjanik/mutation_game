// The boards each registered tool offers (SPEC.md 4.0 Board pickers; 6.6 rule 8), by tool id: the one
// piece of the registry that the browser needs. The URL codec (lib/urlCodec.ts) reads it through
// boardsOffered on every page that shows a tool, so this module imports only the small lists the
// registry entries themselves read, never an entry, a preset module or an engine function
// (RT-FIX P3-RT-07-04: the registry entries and their presets reach only the pages, at build time).
// Each value equals the `boards` of the tool's registry entry; site/tests/unit/registry-offered.test.ts
// checks every entry against this table, so a new registry file fails that test until it is listed here.
import type { ToolId } from '../lib/state';
import { T05_BOARDS } from '../components/tools/t05/boards';
import { KOSTANT_AFFINE_EXTRA, KOSTANT_BOARDS } from '../components/tools/t09/boards';
import { T10_BOARDS } from '../components/tools/t10/boards';
import { T11_BOARDS } from '../components/tools/t11/boards';
import { T12_BOARDS } from '../components/tools/t12/boards';
import { AFFINE_BOARDS } from '../components/tools/t15/boards';

/** The 32 named types grouped by letter (registry/T07.ts). */
const NAMED_TYPES: readonly string[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8',
  'F4',
  'G2',
];

/** Tool id to the boards it offers: 'all', or the names (registry/T{nn}.ts `boards`). */
export const BOARDS_OFFERED: Readonly<Partial<Record<ToolId, 'all' | readonly string[]>>> = {
  board: 'all',
  garden: 'all',
  form: 'all',
  lab: 'all',
  numbers: T05_BOARDS,
  mirror: ['A2', 'B2', 'C2', 'G2'],
  symbolic: NAMED_TYPES,
  weyl: ['A1', 'A2', 'A3', 'A4', 'A5', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'D4', 'F4', 'G2'],
  kostant: [...KOSTANT_BOARDS, ...AFFINE_BOARDS.filter((n) => n !== 'square' && n !== 'pentagon'), ...KOSTANT_AFFINE_EXTRA],
  geometry: T10_BOARDS,
  fold: T11_BOARDS,
  rep: T12_BOARDS,
  satake: NAMED_TYPES,
  atlas: NAMED_TYPES,
  affine: AFFINE_BOARDS,
  sandbox: 'all',
};
