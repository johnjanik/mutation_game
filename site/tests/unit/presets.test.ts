// P4-A2: the mathematical content of the T10 preset files against the golden data (SPEC.md 2.14, 4 T10
// acceptance, 5.7 rules 3 and 5): vertex and edge counts against the `wythoff` records, the rings and
// distinct dots of the Coxeter plane against `types[T].coxeter_plane`, the 56 neighbours of E8 at inner
// product 1, the rings of the root polytopes against `numbers_of_highest_root`, and the two graphs on
// the hexagon of A2. Golden values are read with node:fs as data; no coverage is registered here (the
// golden keys are covered in the engine suite, CONTRACTS.md 3).
//
// The tests of the files read the files written by scripts/presets.mjs (committed under
// site/public/presets/T10/) and project them with the engine's euclideanBasis (P4-A1). The tests of
// the short roots (presetShortRoots, the shortRoots field of computePreset) need only the engine of
// phases 0 to 3 and run on a board with two root lengths that no shipped file covers.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, euclideanBasis, formValue, toPopulation } from '@engine';
import type { AnyBoard, Board } from '@engine';
import { countDistinct, frameFor, project, ringsOf, roundTo, toEuclidean } from '../../src/components/draw/projector';
import { PRESET_CONFIGS, presetFile, presetKey, presetShortRoots, type PresetConfig, type PresetData } from '../../src/components/draw/presetsT10';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = resolve(ROOT, 'site/public/presets/T10');

interface GoldenType {
  n_roots: number;
  weyl_order: number;
  coxeter_number: number;
  numbers_of_highest_root: number[];
  highest_short_root?: number[] | null;
  numbers_of_highest_short_root?: number[];
  n_short_positive?: number;
  positive_roots?: number[][];
  coxeter_plane?: { rings: [number, number][]; distinct_points: number; h_points_on_every_ring: boolean };
}
interface GoldenWythoff {
  type: string;
  rings: number[];
  f_vector: number[];
  edges_enumerated: boolean;
}
interface Golden {
  types: Record<string, GoldenType>;
  wythoff: GoldenWythoff[];
  coxeter_plane_types_with_coincident_points: string[];
  e8: { neighbours_at_inner_product_1: number };
}
const golden = JSON.parse(readFileSync(resolve(ROOT, 'reference/golden_data.json'), 'utf8')) as Golden;

const load = (config: PresetConfig): PresetData => JSON.parse(readFileSync(resolve(DIR, presetFile(presetKey(config))), 'utf8')) as PresetData;
const configOf = (board: string, preset: string): PresetConfig =>
  PRESET_CONFIGS.find((c) => c.board === board && (c.presets as readonly string[]).includes(preset))!;

/** The vertices of a file drawn at y = E C^-1 a and projected to the Coxeter plane, with no turn. */
function coxeterPoints(data: PresetData): { x: number; y: number }[] {
  const board: AnyBoard = boardFromName(data.board);
  const { E } = euclideanBasis(board);
  const frame = frameFor(board.n, { kind: 'coxeter' });
  return data.vertices.map((a) => project(frame, toEuclidean(board, E, a)));
}

/** Rule 3 of SPEC 5.7: the same number of rings, the same sizes innermost first, radii within 1e-5. */
function expectRings(actual: [number, number][], expected: [number, number][]): void {
  expect(actual.map((r) => r[1])).toEqual(expected.map((r) => r[1]));
  actual.forEach(([radius], k) => expect(Math.abs(radius - expected[k]![0])).toBeLessThanOrEqual(1e-5));
}

/** The unordered pairs of an adjacency file field, as "i,j" with i < j. */
const pairs = (lists: number[][]): Set<string> => new Set(lists.flatMap((l, i) => l.map((j) => `${i},${j}`)));

describe('T10 preset files: the mathematics against the golden data', () => {
  it('the D4 file shows 12 distinct dots for 24 roots and the A3 file 8 for 12 in the Coxeter plane', () => {
    for (const name of ['D4', 'A3']) {
      const g = golden.types[name]!;
      expect(golden.coxeter_plane_types_with_coincident_points).toContain(name);
      const data = load(configOf(name, 'root-polytope'));
      // On a simply laced board the root polytope is every root.
      expect(data.vertices).toHaveLength(g.n_roots);
      const pts = coxeterPoints(data);
      expect(countDistinct(pts), name).toBe(g.coxeter_plane!.distinct_points);
      expect(countDistinct(pts)).toBeLessThan(g.n_roots);
      expectRings(ringsOf(pts), g.coxeter_plane!.rings);
    }
    // A tiny negative coordinate rounds to 0, not to -0, before points are counted.
    expect(Object.is(roundTo(-1e-9, 6), 0)).toBe(true);
    expect(countDistinct([{ x: -1e-9, y: 1 }, { x: 0, y: 1 }])).toBe(1);
  });

  it('the E8 file projected to the Coxeter plane has 8 rings of 30 with the golden radii and 240 distinct points', () => {
    const g = golden.types['E8']!;
    const data = load(configOf('E8', 'showpiece'));
    const pts = coxeterPoints(data);
    expectRings(ringsOf(pts), g.coxeter_plane!.rings);
    expect(countDistinct(pts)).toBe(g.coxeter_plane!.distinct_points);
    expect(golden.coxeter_plane_types_with_coincident_points).not.toContain('E8');
    // h_points_on_every_ring: every ring holds exactly h points.
    expect(g.coxeter_plane!.h_points_on_every_ring).toBe(true);
    for (const [, count] of ringsOf(pts)) expect(count).toBe(g.coxeter_number);
  });

  it('vertex and edge counts and fVector of every file equal its wythoff record', () => {
    let matched = 0;
    for (const config of PRESET_CONFIGS) {
      const data = load(config);
      const record = golden.wythoff.find((w) => w.type === data.board && w.rings.join(',') === data.rings.join(','));
      if (data.board === 'A2') {
        // A2 has no wythoff record; its counts come from SPEC 2.14 (next test).
        expect(record).toBeUndefined();
        continue;
      }
      expect(record, data.key).toBeDefined();
      matched++;
      const f = record!.f_vector;
      expect(record!.edges_enumerated).toBe(true);
      expect(data.edgesEnumerated).toBe(true);
      expect(data.counts.vertices, data.key).toBe(f[0]);
      expect(data.counts.edges, data.key).toBe(f[1]);
      expect(data.vertices).toHaveLength(f[0]!);
      expect(pairs(data.adjacency).size).toBe(f[1]);
      expect(data.fVector.slice(0, f.length).map(String), data.key).toEqual(f.map(String));
    }
    expect(matched).toBe(PRESET_CONFIGS.filter((c) => c.board !== 'A2').length);
  });

  it('A2 from (1,1) has six polytope edges, six move edges and four shared', () => {
    const data = load(configOf('A2', 'two-graphs'));
    expect(data.rings).toEqual([1, 1]);
    // The orbit of a regular position is the whole group: the hexagon.
    expect(data.vertices).toHaveLength(golden.types['A2']!.weyl_order);
    const polytope = pairs(data.adjacency);
    const moves = pairs(data.moveAdjacency);
    // SPEC 2.14 [V] (checked by reference/verify.py; no golden key): six edges in each graph, four shared.
    expect(polytope.size).toBe(6);
    expect(moves.size).toBe(6);
    expect([...polytope].filter((p) => moves.has(p))).toHaveLength(4);
    expect(data.counts).toEqual({ vertices: golden.types['A2']!.weyl_order, edges: 6, moveEdges: 6 });
  });

  it('in the E8 file every vertex has 56 neighbours and every edge joins roots at inner product 1', () => {
    const data = load(configOf('E8', 'showpiece'));
    const board = boardFromName('E8') as Board<number>;
    const degree = new Array<number>(data.vertices.length).fill(0);
    data.adjacency.forEach((l, i) => {
      for (const j of l) {
        degree[i]!++;
        degree[j]!++;
      }
    });
    for (const d of degree) expect(d).toBe(golden.e8.neighbours_at_inner_product_1);
    // det C = 1 on E8: every position is an integer population; the form on the ends of every edge is exactly 1.
    const pops = data.vertices.map((a) => {
      const p = toPopulation(board, a)!;
      for (const r of p) expect(r.den).toBe(1n);
      return p.map((r) => r.num);
    });
    data.adjacency.forEach((l, i) => {
      for (const j of l) {
        const v = formValue(board, pops[i]!, pops[j]!)!;
        expect(v.num === 1n && v.den === 1n, `${i},${j}`).toBe(true);
      }
    });
  });

  it('the rings of every root polytope configuration equal numbers_of_highest_root', () => {
    const roots = PRESET_CONFIGS.filter((c) => c.rings === 'highest-root');
    expect(roots.map((c) => c.board)).toEqual(['A2', 'A3', 'D4', 'E8']);
    for (const config of roots) {
      const data = load(config);
      expect(data.rings, config.board).toEqual(golden.types[config.board]!.numbers_of_highest_root);
    }
    // The four root polytope configurations are on simply laced boards (the golden file has no highest
    // short root for them), so their files carry no short roots.
    for (const config of roots) {
      const short = golden.types[config.board]!.highest_short_root;
      expect(short === undefined || short === null, config.board).toBe(true);
    }
    // No file carries short roots: the root polytopes for the reason above, and every other configuration
    // because it is not a root polytope (B3 has two root lengths, but its two files are not root polytopes).
    for (const config of PRESET_CONFIGS) expect(load(config).shortRoots, presetKey(config)).toBeNull();
  });
});

describe('T10 presets: the short roots of a root polytope (SPEC 2.14)', () => {
  const rootPolytope = (board: string): PresetConfig => ({ board, rings: 'highest-root', presets: ['root-polytope'] });

  it('a root polytope on a board with two root lengths carries the orbit of the highest short root, else null', () => {
    // Every named type of the golden file but C2, which is the board B2 (its computed name says B2).
    const names = Object.keys(golden.types).filter((t) => t !== 'C2');
    let twoLengths = 0;
    let checkedAgainstRoots = 0;
    for (const name of names) {
      const g = golden.types[name]!;
      const short = presetShortRoots(rootPolytope(name));
      if (g.highest_short_root === undefined || g.highest_short_root === null) {
        expect(short, name).toBeNull();
        continue;
      }
      twoLengths++;
      expect(short, name).not.toBeNull();
      // The orbit starts at the numbers of the highest short root and holds each short root once.
      expect(short![0], name).toEqual(g.numbers_of_highest_short_root);
      expect(short!, name).toHaveLength(2 * g.n_short_positive!);
      expect(new Set(short!.map((v) => v.join(','))).size).toBe(short!.length);
      // Every point is a short root: an integer population of the length of the highest short root, and,
      // where the golden file lists the positive roots (rank 4 and below), plus or minus one of them.
      const board = boardFromName(name) as Board<number>;
      const positive = g.positive_roots === undefined ? null : new Set(g.positive_roots.map((r) => r.join(',')));
      const shortLength = formValue(board, g.highest_short_root)!;
      for (const a of short!) {
        const p = toPopulation(board, a)!.map((r) => {
          expect(r.den).toBe(1n);
          return Number(r.num);
        });
        const length = formValue(board, p)!;
        expect(length.num === shortLength.num && length.den === shortLength.den, `${name} ${a.join(',')}`).toBe(true);
        if (positive === null) continue;
        const sign = p.some((x) => x > 0) ? 1 : -1;
        expect(positive.has(p.map((x) => sign * x).join(',')), `${name} ${a.join(',')}`).toBe(true);
      }
      if (positive !== null) checkedAgainstRoots++;
    }
    // The boards B, C, F4 and G2 of the golden file have two root lengths; the loop must have met them,
    // and checked those of rank 4 and below against the golden positive roots.
    expect(twoLengths).toBeGreaterThan(0);
    expect(checkedAgainstRoots).toBeGreaterThan(0);
  });

  it('a configuration that is not a root polytope carries no short roots, on a board with two root lengths too', () => {
    const b3 = golden.types['B3']!;
    expect(b3.highest_short_root).not.toBeNull();
    expect(presetShortRoots(rootPolytope('B3'))).not.toBeNull();
    for (const config of PRESET_CONFIGS) expect(presetShortRoots(config), presetKey(config)).toBeNull();
    // The rule is exercised by shipped configurations: those of B3 (face-table, make-uniform).
    const notRootPolytopes = PRESET_CONFIGS.filter((c) => c.rings !== 'highest-root' && golden.types[c.board]!.highest_short_root != null);
    expect(notRootPolytopes.length).toBeGreaterThan(0);
  });
});
