// T10, the Geometry Studio: the snapshot of SPEC.md 7.4 ("Tools that draw on a canvas (T10 ...) ship an SVG
// snapshot of their default view, produced at build time by the same drawing code running in Node"). Owner
// P4-A3. Used during server rendering only (the component calls it behind import.meta.env.SSR): every engine
// call runs in-process at build time (E-9).
//
// The modules only the snapshot needs at once (the SVG writer, the move graph, the typeset names of
// names.json) are imported dynamically behind import.meta.env.SSR, which the browser build replaces by
// false: a static import here would put them into the route's first scripts even where the call is dead
// (7.6: 90 kB), while the browser fetches each of them later, when it is first needed.
import { CAPS } from '@two-games/engine';
import type { PresetManifest } from '../../draw/presetsT10';
import type { Box } from './drawing';
import { moveGraphFitsOneTask } from './graphs';
import type { NameLookup } from './names';
import { MANIFEST_FILE } from './presets';
import { computeOrbit, drawingMatrixOf, fromPresetFile, type OrbitData, type PresetFile } from './scene';
import { drawnOf, figureText, loadPlan, pictureOf, type DrawOptions, type Drawn, type StudioFacts } from './studio';

const serverOnly = import.meta.env.SSR ? await Promise.all([import('./svg'), import('./moves'), import('./typesetNames')]) : null;

/**
 * The data files of site/public/presets/T10/ (the manifest and one file per configuration), read as text
 * during server rendering: the files the browser fetches for its default state (4 T10 Presets), so that the
 * server markup shows what the hydrated default shows (RT-FIX P4-MERGE-03).
 */
const presetFiles = import.meta.env.SSR ? import.meta.glob<string>('../../../../public/presets/T10/*.json', { query: '?raw', import: 'default' }) : null;
const presetText: ReadonlyMap<string, string> =
  presetFiles === null ? new Map() : new Map(await Promise.all(Object.entries(presetFiles).map(async ([path, load]) => [path.slice(path.lastIndexOf('/') + 1), await load()] as const)));

function modules(): NonNullable<typeof serverOnly> {
  if (serverOnly === null) throw new Error('the T10 snapshot is made during server rendering only');
  return serverOnly;
}

/** The manifest the browser fetches, or null when there is none (the browser's fetch then fails the same way). */
function presetManifest(): PresetManifest | null {
  const text = presetText.get(MANIFEST_FILE);
  return text === undefined ? null : (JSON.parse(text) as PresetManifest);
}

/** The typeset board names of names.json, for server rendering (7.3). */
export function ssrNames(): NameLookup {
  return modules()[2].KATEX_NAMES;
}

/** The box of the snapshot, in CSS pixels; the SVG scales to the figure's width (plan, as the drawing-time probe). */
export const SNAPSHOT_BOX: Box = { width: 360, height: 360 };

export interface Snapshot {
  svg: string;
  data: OrbitData | null;
  /**
   * True when the browser's own load of this configuration on hydration (loadPlan, origin 'load') completes
   * the orbit: from its data file, or enumerated on the main thread. False when it waits for "Draw the
   * orbit" (more than 2000 items, E-9) or is refused.
   */
  ready: boolean;
  drawn: Drawn | null;
  points: number;
  segments: number;
  labels: number;
}

/**
 * The SVG of a configuration at rest with the integer orbit, as the tool first shows it, projected with the
 * configured projection, rendered by renderSvg (polytope graph) or pictureSvg (move graph), with the colour
 * tokens. The orbit is the one the browser loads on hydration (RT-FIX P4-MERGE-03): the data file of the
 * configuration when the manifest has one (source 'preset', with both graphs), else computed in-process
 * (orbitGraph, wythoffEdges), with the move graph when it is the graph shown or when the browser derives it
 * at once (moveGraphFitsOneTask, as T10GeometryStudio.svelte). A refused orbit gives the empty box with its
 * text alternative; a vertices-only orbit, the points alone.
 */
export function snapshotOf(facts: StudioFacts, id: string): Snapshot {
  const [{ pictureSvg }, { moveEdges }] = modules();
  const plan = loadPlan(facts, presetManifest(), 'load');
  const file = plan.kind === 'file' ? presetText.get(plan.file) : undefined;
  if (plan.kind === 'file' && file === undefined) throw new Error(`the T10 data file ${plan.file} named by the manifest is missing`);
  const data = file !== undefined ? fromPresetFile(facts.board, JSON.parse(file) as PresetFile) : computeOrbit(facts.board, facts.config.rings, facts.decision);
  const ready = data !== null && plan.kind !== 'wait';
  const options: DrawOptions = { uniform: false, shortRoots: false, rotation: null, highlighted: null };
  let drawn: Drawn | null = null;
  if (data !== null) {
    if (data.moveEdges === null && (facts.config.graph === 'moves' || (ready && moveGraphFitsOneTask(facts.board.n, data.vertices.length)))) {
      data.moveEdges = moveEdges(facts.board, data.vertices);
    }
    drawn = drawnOf(facts, data, options, drawingMatrixOf(facts.board), null);
  }
  const empty: Drawn = { ys: [], shortYs: [], edges: [], stats: null, shared: null };
  const picture = pictureOf(facts, drawn ?? empty, options, SNAPSHOT_BOX);
  const svg = pictureSvg(picture, { title: figureText(facts, facts.config.graph), desc: 'A snapshot made at build time.', id });
  const segments = facts.decision.verticesOnly || drawn === null ? 0 : drawn.edges.length;
  return {
    svg,
    data,
    ready,
    drawn,
    points: drawn?.ys.length ?? 0,
    segments: segments > CAPS.edgesAtRest ? 0 : segments,
    labels: facts.config.graph === 'moves' ? segments : 0,
  };
}
