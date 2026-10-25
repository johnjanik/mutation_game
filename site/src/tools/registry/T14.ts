// T14, the Atlas (SPEC.md 4 T14; CONTRACTS.md 5.2, 6: "T14 is static pages"; SPEC 4 table: number 14, id
// atlas, phase 6). Owner P6-A4. The Atlas is one static page per board, /atlas/<board>/ (pages/atlas/), and
// an index, /atlas/; this entry gives it the tool routes /tools/atlas and /embed/atlas, which render
// AtlasPicker.svelte: the 32 boards grouped by letter, each a link to its page. Offered on the 32 named
// finite types (4.0 Board pickers); the picker's only input is `g` (6.6). No preset beyond `default`, which
// collectRegistry requires, with a caption and no state field (CONTRACTS 6). This module is loaded on the
// pages at build time and imports only the list of boards (no engine function).
//
// The component path runs through components/tools/ (`tools/../atlas/`): it names the same file as
// @components/atlas/AtlasPicker.svelte, written so that site/tests/e2e/registry-outs.spec.ts, which reads
// the component of every registry entry from an import under components/tools/, finds it (plan; a request
// to MERGE to let that pattern accept components/atlas/ is in decisions/P6-A4.md).
import type { ToolRegistryEntry } from '../types';
import { ATLAS_BOARDS } from '../../components/atlas/boards';

/**
 * Every data-out name T14 renders (SPEC 4.0 Test hooks; listed at the top of site/tests/e2e/T14.spec.ts):
 * the Atlas pages' values (each with data-exact), then the outputs of the picker on /tools/atlas and
 * /embed/atlas (citeText after Cite is pressed).
 */
export const T14_OUTS = [
  'caption',
  'noscript',
  'cartan',
  'cartan-transposed',
  'adjacency',
  'symmetrizer',
  'n-roots',
  'n-positive-roots',
  'positive-roots',
  'highest-root',
  'numbers-of-highest-root',
  'highest-short-root',
  'numbers-of-highest-short-root',
  'exponents',
  'coxeter-number',
  'weyl-order',
  'det-cartan',
  'minuscule-nodes',
  'minus-w0',
  'fundamental-orbit-sizes',
  'complete-games',
  'coxeter-plane-rings',
  'affine-name',
  'marks',
  'comarks',
  'real-forms',
  'notice',
  'chosen',
  'citeText',
] as const;

export default {
  number: 14,
  id: 'atlas',
  title: 'Atlas',
  phase: 6,
  boards: [...ATLAS_BOARDS],
  presets: {
    default: {
      caption: `The Atlas has a data sheet for each of the ${ATLAS_BOARDS.length} boards of finite type, computed by the engine when the site is built: choose a board to open its page.`,
    },
  },
  outs: [...T14_OUTS],
  component: () => import('../../components/tools/../atlas/AtlasPicker.svelte'),
} satisfies ToolRegistryEntry;
