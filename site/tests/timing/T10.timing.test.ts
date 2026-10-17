// P4-A3's main-thread timing test of tool T10, the Geometry Studio (SPEC.md 4 T10; 7.6; E-9), moved by P4-X2
// (for MERGE, P4 wave 4.4) from site/tests/unit/tools/T10.test.ts without a change to what it measures or to
// its bound: in the parallel site unit suite its medians reached 31.6 and 36.9 ms against 25 (17.8 and
// 19.4 ms alone). It runs alone through `npm run bench` (site/tests/timing/vitest.config.ts). The helpers
// below are copied from T10.test.ts as they stand there.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAPS, boardFromName, classify, orbitGraph, wythoffEdges } from '@engine';
import type { Board } from '@engine';
import { defaultProjectionText } from '../../src/components/tools/t10/config';
import {
  classifiedBoard,
  countsOf,
  edgeArgs,
  edgesToIndices,
  faceTable,
  fitsMainThread,
  fromPresetFile,
  shortRootRings,
  t10Board,
  vertexArgs,
  type PresetFile,
} from '../../src/components/tools/t10/scene';
import { MoveGraphBuilder, moveEdges } from '../../src/components/tools/t10/moves';
import { admit, factsOf, otherFacts, type StudioConfig } from '../../src/components/tools/t10/studio';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const golden = JSON.parse(readFileSync(`${ROOT}reference/golden_data.json`, 'utf8')) as { types: Record<string, unknown> };
const TYPES = Object.keys(golden.types);
const DATA_DIR = `${ROOT}site/public/presets/T10/`;
const fileOf = (name: string): PresetFile => JSON.parse(readFileSync(`${DATA_DIR}${name}`, 'utf8')) as PresetFile;

const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
const configOf = (board: string, rings: number[], projection?: string, graph: 'polytope' | 'moves' = 'polytope'): StudioConfig =>
  admit({ board, rings, projection: projection ?? defaultProjectionText(B(board).n), graph }, false)!;
const oneRing = (n: number, label: number): number[] => Array.from({ length: n }, (_, k) => (k + 1 === label ? 1 : 0));
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
function timeMedian(f: () => unknown, runs = 7): number {
  f(); // warm up once, outside the measurement
  const t: number[] = [];
  for (let k = 0; k < runs; k++) {
    const t0 = performance.now();
    f();
    t.push(performance.now() - t0);
  }
  return median(t);
}

describe('where the work runs', () => {
  it('main-thread work stays under the long-task budget', () => {
    const BUDGET = 25; // ms, the margin SPEC 7.6 sets for its own benchmark (plan)
    const timings: Record<string, number> = {};
    // Each piece is timed alone, because the tool runs each in a task of its own (studio.ts coreFactsInTasks,
    // prepareInTasks, enumerateInTasks; moves.ts deriveInTasks; the tests of T10.test.ts check that structure). The verdict of
    // classify is timed on a new board object (the engine keeps it per object, E-11), as the first change to
    // a board computes it; the short roots are timed without their cache, as the first change computes them.
    timings['E8: classify, first time on the board'] = timeMedian(() => classify(B('E8')));
    const e8 = classifiedBoard('E8');
    for (let label = 1; label <= 8; label++) {
      const rings = oneRing(8, label);
      timings[`E8 node ${label}: counts`] = timeMedian(() => countsOf(e8, rings));
      timings[`E8 node ${label}: face table`] = timeMedian(() => faceTable(e8, rings));
      timings[`E8 node ${label}: other facts, first time on the board`] = timeMedian(() => [shortRootRings(e8), otherFacts(e8, 'E8', rings)]);
    }
    // The showpiece: its data file read into orbit data, and its move graph from the vertex list (one slice).
    const showpieceFile = fileOf('E8-r0.0.0.0.0.0.0.1.json');
    timings['E8 showpiece: data file to orbit data'] = timeMedian(() => fromPresetFile(t10Board('E8'), showpieceFile));
    const showpiece = fromPresetFile(B('E8'), showpieceFile);
    expect(B('E8').n * showpiece.vertices.length).toBeLessThanOrEqual(CAPS.mainThreadItems);
    timings['E8 showpiece: move graph'] = timeMedian(() => moveEdges(B('E8'), showpiece.vertices));
    // The largest enumeration the plan still sends to the main thread, over the 32 types with one ringed node.
    let best: { T: string; label: number; items: number } | null = null;
    for (const T of TYPES) {
      const n = B(T).n;
      for (let label = 1; label <= n; label++) {
        const facts = factsOf(configOf(T, oneRing(n, label)));
        if (!fitsMainThread(facts.decision)) continue;
        const items = facts.decision.vertexItems + facts.decision.edgeItems;
        if (best === null || items > best.items) best = { T, label, items };
      }
    }
    expect(best).not.toBeNull();
    const largest = configOf(best!.T, oneRing(B(best!.T).n, best!.label));
    const lf = factsOf(largest);
    const what = `${best!.T} node ${best!.label}`;
    const vertices = orbitGraph(...vertexArgs(lf.board, largest.rings)).items;
    const edges = wythoffEdges(...edgeArgs(lf.board, largest.rings));
    timings[`largest main-thread vertex enumeration (${what}, ${lf.decision.vertexItems} items)`] = timeMedian(() => orbitGraph(...vertexArgs(lf.board, largest.rings)));
    timings[`largest main-thread edge enumeration (${what}, ${lf.decision.edgeItems} items)`] = timeMedian(() => wythoffEdges(...edgeArgs(lf.board, largest.rings)));
    timings[`its index pairs (${what})`] = timeMedian(() => edgesToIndices(vertices, edges));
    timings[`its move graph, one slice (${what})`] = timeMedian(() => new MoveGraphBuilder(lf.board, vertices).step(CAPS.mainThreadItems));
    for (const [w, ms] of Object.entries(timings)) expect(ms, w).toBeLessThan(BUDGET);
    console.info(`T10 main-thread medians (ms): ${JSON.stringify(Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v * 100) / 100])))}`);
  });
});
