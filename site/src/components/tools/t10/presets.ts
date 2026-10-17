// T10, the Geometry Studio: the presets as state objects, the placed figures of M7, and the mapping from a
// configuration (board, rings) to its build-time data file (SPEC.md 4 T10 Presets; 3 M7; 4.0 Configuration;
// 6.6; E-9). Owner P4-A3. The data files and their manifest are P4-A2's pipeline
// (site/src/components/draw/presetsT10.ts, scripts/presets.mjs); the list of configurations is the M7
// figure table. A data file depends only on the board and the rings, so a state opens from a file exactly
// when its (board, rings) is a configuration of the manifest, whatever its projection and graph, and
// whether it came from a preset or from a link (compare board and rings, never the preset id).
import type { ToolState } from '../../../lib/state';
import { MANIFEST_FILE, PRESET_DIR, presetFor, type ManifestEntry, type PresetManifest } from '../../draw/presetsT10';
import { T10_PRESETS, type T10PresetId } from './config';

export { MANIFEST_FILE, PRESET_DIR };

/** The state object of a preset (4.0: "every preset is also a state object and a link"). */
export function presetState(id: T10PresetId): ToolState {
  const p = T10_PRESETS[id];
  return { schema: 1, tool: 'geometry', board: p.board, rings: [...p.rings], projection: p.projection, graph: p.graph };
}

/** The preset of an id, or the default for an unknown id. */
export function presetOf(id: string | undefined): { id: T10PresetId; preset: (typeof T10_PRESETS)[T10PresetId] } {
  const key = (id !== undefined && id in T10_PRESETS ? id : 'default') as T10PresetId;
  return { id: key, preset: T10_PRESETS[key] };
}

/** One figure placed by M7 (beats 1 to 6), with the board it is placed on, and the default of the route. */
export interface PlacedFigure {
  beat: number | null;
  preset: T10PresetId;
  board: string;
}

/**
 * The nine figures of M7 beats 1 to 6 (the root polytope of A2, A3 and D4 counted as three) and the
 * default (beat null). Their (board, rings) pairs are seven distinct data files.
 */
export const PLACED_FIGURES: readonly PlacedFigure[] = [
  { beat: 1, preset: 'root-polytope', board: 'A2' },
  { beat: 1, preset: 'root-polytope', board: 'A3' },
  { beat: 1, preset: 'root-polytope', board: 'D4' },
  { beat: 2, preset: 'rings', board: 'A3' },
  { beat: 3, preset: 'face-table', board: 'B3' },
  { beat: 4, preset: 'two-graphs', board: 'A2' },
  { beat: 5, preset: 'make-uniform', board: 'B3' },
  { beat: 6, preset: 'showpiece', board: 'E8' },
  { beat: 6, preset: 'coxeter-plane', board: 'D4' },
  { beat: null, preset: 'default', board: 'A3' },
];

/** The manifest entry of a configuration (rings in label order), or null when it is not precomputed. */
export function dataFileFor(manifest: PresetManifest, board: string, rings: readonly number[]): ManifestEntry | null {
  return presetFor(manifest, board, rings);
}

/** The URL of a data file under the site's base (7.2 item 10: never a leading slash). */
export function dataUrl(base: string, file: string): string {
  return base + PRESET_DIR + file;
}

/** True when a state opens from a data file: its board and rings are a configuration of the manifest. */
export function opensFromFile(manifest: PresetManifest, state: Pick<ToolState, 'board' | 'rings'>): boolean {
  return typeof state.board === 'string' && state.rings !== undefined && presetFor(manifest, state.board, state.rings) !== null;
}

/**
 * The states of the four-shell table of M7 beat 7 (5.1; links, not presets): the roots (240), the orbit
 * of the first fundamental weight (2160), of the seventh (6720), and, for 17280 + 240, the orbit of the
 * second and, separately, the doubled roots. For P4-A6, who writes the table; the e2e test opens them.
 */
export const SHELL_LINKS: readonly string[] = [
  'g=E8&r=0.0.0.0.0.0.0.1&j=coxeter',
  'g=E8&r=1.0.0.0.0.0.0.0&j=coxeter',
  'g=E8&r=0.0.0.0.0.0.1.0&j=coxeter',
  'g=E8&r=0.1.0.0.0.0.0.0&j=coxeter',
  'g=E8&r=0.0.0.0.0.0.0.2&j=coxeter',
];
