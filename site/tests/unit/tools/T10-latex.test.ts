// P6-tikz: T10's Export LaTeX builder, site/src/components/tools/t10/latex.ts (SPEC.md 6.7 "Orbit graphs and
// projections are exported as plain TikZ coordinates"; the tikz-points form of decisions/P6-A5.md). The
// picture is built here as the studio builds it (factsOf, computeOrbit, drawnOf, pictureOf: the code of the
// snapshot and of the canvas), and the export is compared with that picture: one point per point drawn, one
// edge per edge drawn at rest, finite centimetres, y up, centred, at most 16 cm across. Golden counts are
// read from reference/golden_data.json, never typed.
import { describe, expect, it } from 'vitest';
import { CAPS } from '@engine';
import golden from '../../../../reference/golden_data.json';
import { exportLaTeX, type TikzPointsData } from '../../../src/lib/export';
import { computeOrbit, drawingMatrixOf } from '../../../src/components/tools/t10/scene';
import { drawnOf, factsOf, pictureOf, shortRootPositions, type DrawOptions } from '../../../src/components/tools/t10/studio';
import { moveEdges } from '../../../src/components/tools/t10/moves';
import { defaultProjectionText, type T10Graph } from '../../../src/components/tools/t10/config';
import type { Picture } from '../../../src/components/tools/t10/drawing';
import { CM_PER_PX, MAX_ACROSS_CM, projectionLatex, projectionScale } from '../../../src/components/tools/t10/latex';

const MINUS_SIGN = '−';

interface WythoffRecord {
  type: string;
  rings: number[];
  f_vector: number[];
  edges_enumerated: boolean;
}
const record = (type: string, rings: number[]): WythoffRecord => {
  const hits = (golden.wythoff as WythoffRecord[]).filter((r) => r.type === type && r.rings.join('.') === rings.join('.'));
  if (hits.length !== 1) throw new Error(`${hits.length} wythoff records for ${type} ${rings.join('.')}`);
  return hits[0]!;
};

/** The picture the studio draws for a configuration at rest, in a square box of `side` CSS pixels. */
function picture(board: string, rings: number[], opts: { projection?: string; graph?: T10Graph; shortRoots?: boolean; side?: number } = {}): Picture {
  const n = rings.length;
  const facts = factsOf({ board, rings, projection: opts.projection ?? defaultProjectionText(n), graph: opts.graph ?? 'polytope' });
  const data = computeOrbit(facts.board, rings, facts.decision)!;
  if (facts.config.graph === 'moves') data.moveEdges = moveEdges(facts.board, data.vertices);
  const options: DrawOptions = { uniform: false, shortRoots: opts.shortRoots ?? false, rotation: null, highlighted: null };
  const short = options.shortRoots && facts.shortRings !== null ? shortRootPositions(facts.board, facts.shortRings) : null;
  const drawn = drawnOf(facts, data, options, drawingMatrixOf(facts.board), short);
  const side = opts.side ?? 360;
  return pictureOf(facts, drawn, options, { width: side, height: side });
}

function dataOf(p: Picture): TikzPointsData {
  const choice = projectionLatex(p, CAPS.edgesAtRest);
  expect(choice).not.toBeNull();
  expect(choice!.kind).toBe('tikz-points');
  return choice!.data as TikzPointsData;
}

/** The checks every export must pass against the picture it came from. */
function checkAgainstPicture(p: Picture): { data: TikzPointsData; text: string } {
  const { width, height, points, segments } = p.scene;
  const data = dataOf(p);
  // One point per point drawn (the vertices, then the short roots), one edge per segment drawn, in order.
  expect(data.points).toHaveLength(points.length);
  expect(data.edges).toEqual(segments.map((s) => [s.a, s.b]));
  expect(data.labels).toBeUndefined();
  // Centimetres from the centre of the box, y up, one scale: natural size unless larger than 16 cm.
  const s = projectionScale(width, height);
  expect(s).toBe(Math.max(width, height) * CM_PER_PX > MAX_ACROSS_CM ? MAX_ACROSS_CM / Math.max(width, height) : CM_PER_PX);
  data.points.forEach(([x, y], k) => {
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    expect(x).toBeCloseTo((points[k]!.x - width / 2) * s, 12);
    expect(y).toBeCloseTo((height / 2 - points[k]!.y) * s, 12);
    // A point above the middle of the box on screen (smaller y in pixels) is above it in the picture.
    if (points[k]!.y < height / 2 - 1e-9) expect(y).toBeGreaterThan(0);
    if (points[k]!.y > height / 2 + 1e-9) expect(y).toBeLessThan(0);
  });
  const xs = data.points.map(([x]) => x);
  const ys = data.points.map(([, y]) => y);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(MAX_ACROSS_CM);
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(MAX_ACROSS_CM);
  // The form export.ts writes: one \fill per point, one \draw per edge, no U+2212.
  const text = exportLaTeX('tikz-points', data);
  expect(text).not.toContain(MINUS_SIGN);
  const lines = text.split('\n');
  expect(lines.filter((l) => l.startsWith('  \\fill ')).length).toBe(points.length);
  expect(lines.filter((l) => l.startsWith('  \\draw ')).length).toBe(segments.length);
  return { data, text };
}

describe('t10/latex.ts: the projection as drawn, tikz-points', () => {
  it('the default, the cuboctahedron of A3 as a turned wireframe: the vertices and edges of its golden record', () => {
    const r = record('A3', [1, 0, 1]);
    const p = picture('A3', [1, 0, 1]);
    expect(p.scene.points).toHaveLength(r.f_vector[0]!);
    expect(p.scene.segments).toHaveLength(r.f_vector[1]!);
    const { text } = checkAgainstPicture(p);
    expect(text).toMatch(/\\fill \(-\d/);
    expect(projectionScale(360, 360)).toBe(CM_PER_PX);
  });

  it('the showpiece, E8 in its Coxeter plane: 240 points and 6720 edges at rest', () => {
    const r = record('E8', [0, 0, 0, 0, 0, 0, 0, 1]);
    const p = picture('E8', [0, 0, 0, 0, 0, 0, 0, 1], { projection: 'coxeter' });
    expect(p.scene.points).toHaveLength(r.f_vector[0]!);
    expect(p.scene.segments).toHaveLength(r.f_vector[1]!);
    expect(r.f_vector[1]!).toBeLessThanOrEqual(CAPS.edgesAtRest);
    checkAgainstPicture(p);
  });

  it('a box larger than 16 cm is scaled to 16 cm across', () => {
    const p = picture('B3', [1, 0, 1], { side: 1200 });
    expect(1200 * CM_PER_PX).toBeGreaterThan(MAX_ACROSS_CM);
    checkAgainstPicture(p);
    expect(projectionScale(1200, 1200)).toBe(MAX_ACROSS_CM / 1200);
  });

  it('the move graph of A2 from (1, 1): the hexagon of its roots, six edges (SPEC 2.14)', () => {
    const p = picture('A2', [1, 1], { graph: 'moves' });
    expect(p.scene.points).toHaveLength((golden.types as Record<string, { n_roots: number }>).A2!.n_roots);
    expect(p.scene.segments).toHaveLength(6);
    checkAgainstPicture(p);
  });

  it('the root polytope of B3 with its short roots: the short roots are points too, with no edges', () => {
    const plain = picture('B3', [0, 1, 0]);
    const p = picture('B3', [0, 1, 0], { shortRoots: true });
    expect(p.scene.points.length).toBeGreaterThan(plain.scene.points.length);
    expect(p.scene.segments).toHaveLength(plain.scene.segments.length);
    checkAgainstPicture(p);
  });

  it('above the cap of edges at rest no edge is written, as the canvas draws none', () => {
    const p = picture('A3', [1, 0, 1]);
    const data = projectionLatex(p, p.scene.segments.length - 1)!.data as TikzPointsData;
    expect(data.points).toHaveLength(p.scene.points.length);
    expect(data.edges).toEqual([]);
    expect((projectionLatex(p, p.scene.segments.length)!.data as TikzPointsData).edges).toHaveLength(p.scene.segments.length);
  });

  it('nothing drawn gives null (ToolFrame shows its notice)', () => {
    expect(projectionLatex(null, CAPS.edgesAtRest)).toBeNull();
    const p = picture('A3', [1, 0, 1]);
    expect(projectionLatex({ scene: { ...p.scene, points: [], segments: [] } }, CAPS.edgesAtRest)).toBeNull();
  });
});
