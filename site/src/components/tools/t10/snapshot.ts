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
import type { Box } from './drawing';
import type { NameLookup } from './names';
import { computeOrbit, drawingMatrixOf, type OrbitData } from './scene';
import { drawnOf, figureText, pictureOf, type DrawOptions, type Drawn, type StudioFacts } from './studio';

const serverOnly = import.meta.env.SSR ? await Promise.all([import('./svg'), import('./moves'), import('./typesetNames')]) : null;

function modules(): NonNullable<typeof serverOnly> {
  if (serverOnly === null) throw new Error('the T10 snapshot is made during server rendering only');
  return serverOnly;
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
  drawn: Drawn | null;
  points: number;
  segments: number;
  labels: number;
}

/**
 * The SVG of a configuration at rest with the integer orbit, as the tool first shows it: computed in-process
 * (orbitGraph, wythoffEdges, the move graph when it is the graph shown), projected with the configured
 * projection, rendered by renderSvg (polytope graph) or pictureSvg (move graph), with the colour tokens.
 * A refused orbit gives the empty box with its text alternative; a vertices-only orbit, the points alone.
 */
export function snapshotOf(facts: StudioFacts, id: string): Snapshot {
  const [{ pictureSvg }, { moveEdges }] = modules();
  const data = computeOrbit(facts.board, facts.config.rings, facts.decision);
  const options: DrawOptions = { uniform: false, shortRoots: false, rotation: null, highlighted: null };
  let drawn: Drawn | null = null;
  if (data !== null) {
    if (facts.config.graph === 'moves') data.moveEdges = moveEdges(facts.board, data.vertices);
    drawn = drawnOf(facts, data, options, drawingMatrixOf(facts.board), null);
  }
  const empty: Drawn = { ys: [], shortYs: [], edges: [], stats: null, shared: null };
  const picture = pictureOf(facts, drawn ?? empty, options, SNAPSHOT_BOX);
  const svg = pictureSvg(picture, { title: figureText(facts, facts.config.graph), desc: 'A snapshot made at build time.', id });
  const segments = facts.decision.verticesOnly || drawn === null ? 0 : drawn.edges.length;
  return {
    svg,
    data,
    drawn,
    points: drawn?.ys.length ?? 0,
    segments: segments > CAPS.edgesAtRest ? 0 : segments,
    labels: facts.config.graph === 'moves' ? segments : 0,
  };
}
