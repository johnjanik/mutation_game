// P1-A3: node layouts of SPEC.md 6.1, the size rule and hit areas of 6.1 and 7.5 A-7, and the
// road styles of 6.2. Expected coordinates are written from the table of 6.1 by hand. Affine,
// twisted and preset boards are built as plain objects from the golden data, because
// boardFromName knows only the finite names in phase 1. No golden key is covered here (the
// golden data is test input only).
import { describe, expect, it } from 'vitest';
import golden from '../../../reference/golden_data.json';
import { adjacency, boardFromName, fromAdjacency } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import { nodePositions, twistedLayoutSource, type DrawLayout, type LayoutBoard } from '../../src/components/draw/layouts';
import { boardBoxWidth, gridUnit, hitSide, polygonRadius, toPixels } from '../../src/components/draw/geometry';
import { effectiveRoadStyle, roadElements, roadGlyphs } from '../../src/components/draw/roads';

type Pt = readonly [number, number];

const TYPE_NAMES = Object.keys(golden.types);
const AFFINE = golden.affine as Record<string, { name: string; constructor_name: string; cartan_node0_first: number[][] }>;
const TWISTED = golden.twisted_affine as { name: string; cartan: number[][]; reverse_of?: string }[];
const AFFINE_NAMES = golden.affine_names as Record<string, string[]>;

function plain(name: string | undefined, cartan: number[][], labels: number[]): LayoutBoard {
  return name === undefined ? { n: labels.length, labels, cartan } : { n: labels.length, labels, cartan, name };
}
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, k) => from + k);
const transpose = (M: number[][]): number[][] => M.map((_, i) => M.map((row) => row[i]!));
const identity2 = (n: number): number[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)));

/** Expected coordinates by label, from a map label -> point, in position order of `labels`. */
function byLabels(labels: readonly number[], at: Record<number, Pt>): Pt[] {
  return labels.map((l) => {
    const p = at[l];
    if (p === undefined) throw new Error(`no expected point for label ${l}`);
    return p;
  });
}

function expectXy(layout: DrawLayout, expected: readonly Pt[], what: string): void {
  expect(layout.xy.length, what).toBe(expected.length);
  layout.xy.forEach((p, k) => {
    expect(p[0], `${what} position ${k} x`).toBeCloseTo(expected[k]![0], 12);
    expect(p[1], `${what} position ${k} y`).toBeCloseTo(expected[k]![1], 12);
  });
}

// The table of 6.1 for the finite families, written out by label.
function tableFinite(letter: string, n: number): Record<number, Pt> {
  const at: Record<number, Pt> = {};
  if ('ABCFG'.includes(letter)) for (let i = 1; i <= n; i++) at[i] = [i, 0];
  if (letter === 'D') {
    for (let i = 1; i <= n - 2; i++) at[i] = [i, 0];
    at[n - 1] = [n - 1, 0.6];
    at[n] = [n - 1, -0.6];
  }
  if (letter === 'E') {
    // nodes 1, 3, 4, 5, 6, 7, 8 at x = 1..7 on y = 0; node 2 at (3, 1)
    const line = [1, 3, 4, 5, 6, 7, 8].filter((l) => l <= n);
    line.forEach((l, k) => (at[l] = [k + 1, 0]));
    at[2] = [3, 1];
  }
  return at;
}

// The table of 6.1 for the untwisted affine boards of rank r (labels 0..r), rows only.
function tableAffine(letter: string, r: number, rule: string = letter): Record<number, Pt> {
  if (letter === 'A' && r === 1) return { 0: [0, 0], 1: [1, 0] };
  const at = tableFinite(letter, r);
  if (rule === 'B') at[0] = [2, 1];
  if (rule === 'C' || rule === 'F' || (rule === 'E' && r === 7)) at[0] = [0, 0];
  if (rule === 'D') {
    at[1] = [1, -0.6];
    at[0] = [1, 0.6];
  }
  if (rule === 'E' && r === 6) at[0] = [3, 2];
  if (rule === 'E' && r === 8) at[0] = [8, 0];
  if (rule === 'G') at[0] = [3, 0];
  return at;
}

/** Corner k of m on the unit circle, clockwise from the top with y up. */
const cornerAt = (k: number, m: number): Pt => [Math.sin((2 * Math.PI * k) / m), Math.cos((2 * Math.PI * k) / m)];

function affineBoard(key: string, name?: string): LayoutBoard {
  const e = AFFINE[key]!;
  return plain(name ?? e.constructor_name, e.cartan_node0_first, range(0, e.cartan_node0_first.length - 1));
}

describe('layouts of SPEC 6.1', () => {
  it('finite types follow the table of 6.1', () => {
    expect(TYPE_NAMES).toHaveLength(32);
    // Families written out literally from the table.
    const literal: Record<string, Pt[]> = {
      A3: [[1, 0], [2, 0], [3, 0]],
      B3: [[1, 0], [2, 0], [3, 0]],
      C3: [[1, 0], [2, 0], [3, 0]],
      F4: [[1, 0], [2, 0], [3, 0], [4, 0]],
      G2: [[1, 0], [2, 0]],
      D4: [[1, 0], [2, 0], [3, 0.6], [3, -0.6]],
      D5: [[1, 0], [2, 0], [3, 0], [4, 0.6], [4, -0.6]],
      E6: [[1, 0], [3, 1], [2, 0], [3, 0], [4, 0], [5, 0]],
      E7: [[1, 0], [3, 1], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]],
      E8: [[1, 0], [3, 1], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]],
    };
    for (const [name, xy] of Object.entries(literal)) expectXy(nodePositions(boardFromName(name)), xy, name);
    for (const name of TYPE_NAMES) {
      const board = boardFromName(name);
      const letter = name[0]!;
      const layout = nodePositions(board);
      expectXy(layout, byLabels(board.labels, tableFinite(letter, board.n)), name);
      expect(layout.kind, name).toBe('row');
      expect(layout.circle, name).toBe(false);
      const columns = letter === 'D' ? board.n - 1 : letter === 'E' ? board.n - 1 : board.n;
      expect(layout.columns, name).toBe(columns);
    }
    expect(nodePositions(boardFromName('E8')).columns).toBe(7);
  });

  it('untwisted affine boards follow the table of 6.1', () => {
    expect(Object.keys(AFFINE)).toHaveLength(32);
    const literal: Record<string, Pt[]> = {
      A1: [[0, 0], [1, 0]],
      B2: [[2, 1], [1, 0], [2, 0]],
      B3: [[2, 1], [1, 0], [2, 0], [3, 0]],
      C2: [[0, 0], [1, 0], [2, 0]],
      C3: [[0, 0], [1, 0], [2, 0], [3, 0]],
      D4: [[1, 0.6], [1, -0.6], [2, 0], [3, 0.6], [3, -0.6]],
      D5: [[1, 0.6], [1, -0.6], [2, 0], [3, 0], [4, 0.6], [4, -0.6]],
      E6: [[3, 2], [1, 0], [3, 1], [2, 0], [3, 0], [4, 0], [5, 0]],
      E7: [[0, 0], [1, 0], [3, 1], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]],
      E8: [[8, 0], [1, 0], [3, 1], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]],
      F4: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
      G2: [[3, 0], [1, 0], [2, 0]],
      A2: [cornerAt(0, 3), cornerAt(1, 3), cornerAt(2, 3)],
      A4: [cornerAt(0, 5), cornerAt(1, 5), cornerAt(2, 5), cornerAt(3, 5), cornerAt(4, 5)],
    };
    for (const [key, xy] of Object.entries(literal)) expectXy(nodePositions(affineBoard(key)), xy, `${key}~`);
    // A2~: node 0 at the top, node 1 next clockwise (to the right, below), node 2 on the left.
    const a2 = nodePositions(affineBoard('A2'));
    expect(a2.xy[0]![1]).toBeCloseTo(1, 12);
    expect(a2.xy[1]![0]).toBeGreaterThan(0);
    expect(a2.xy[2]![0]).toBeLessThan(0);

    for (const key of Object.keys(AFFINE)) {
      const board = affineBoard(key);
      const letter = key[0]!;
      const r = Number(key.slice(1));
      const layout = nodePositions(board);
      if (letter === 'A' && r >= 2) {
        expect(layout.kind, key).toBe('polygon');
        expect(layout.circle, key).toBe(true);
        expectXy(layout, range(0, r).map((k) => cornerAt(k, r + 1)), `${key}~`);
        continue;
      }
      expect(layout.kind, key).toBe('row');
      expect(layout.circle, key).toBe(false);
      expectXy(layout, byLabels(board.labels, tableAffine(letter, r)), `${key}~`);
      const columns: Record<string, number> = { A: 2, B: r, C: r + 1, D: r - 1, F: 5, G: 3, E: r === 6 ? 5 : r === 7 ? 7 : 8 };
      expect(layout.columns, key).toBe(columns[letter]);
    }
    // The B2 entry whose golden name is C2~ (constructor name B2~): node 0 at (2, 1) either way.
    expect(AFFINE.B2!.name).toBe('C2~');
    expectXy(nodePositions(affineBoard('B2', AFFINE.B2!.name)), literal.B2!, 'affine.B2 named C2~');
    expect(nodePositions(affineBoard('C8')).columns).toBe(9);
    expect(nodePositions(affineBoard('E8')).columns).toBe(8);
  });

  it('a board named C2~ is laid out by its matrix', () => {
    const b2 = plain('C2~', [[2, 0, -1], [0, 2, -1], [-2, -2, 2]], [0, 1, 2]);
    expect(AFFINE.B2!.cartan_node0_first).toEqual(b2.cartan);
    expectXy(nodePositions(b2), [[2, 1], [1, 0], [2, 0]], 'affine.B2 as C2~');
    const c2 = plain('C2~', [[2, -1, 0], [-2, 2, -2], [0, -1, 2]], [0, 1, 2]);
    expect(AFFINE.C2!.cartan_node0_first).toEqual(c2.cartan);
    expectXy(nodePositions(c2), [[0, 0], [1, 0], [2, 0]], 'affine.C2 as C2~');
    expectXy(nodePositions(plain('B2~', b2.cartan as number[][], [0, 1, 2])), [[2, 1], [1, 0], [2, 0]], 'affine.B2 as B2~');
    expectXy(nodePositions(plain('B2~', c2.cartan as number[][], [0, 1, 2])), [[0, 0], [1, 0], [2, 0]], 'affine.C2 as B2~');
  });

  it('twisted boards follow the table of 6.1', () => {
    expect(TWISTED).toHaveLength(10);
    let reversed = 0;
    for (const t of TWISTED) {
      const labels = range(0, t.cartan.length - 1);
      const layout = nodePositions(plain(t.name, t.cartan, labels));
      expect(layout.kind, t.name).toBe('row');
      if (t.reverse_of === undefined) {
        expect(['A2^(2)', 'A4^(2)', 'A6^(2)']).toContain(t.name);
        expectXy(layout, labels.map((i) => [i, 0] as const), t.name);
      } else {
        reversed++;
        // The untwisted board it reverses: the transpose, in the same node order (node 0 first).
        const untwisted = nodePositions(plain(t.reverse_of, transpose(t.cartan), labels));
        expect(untwisted.kind).toBe('row');
        expectXy(layout, untwisted.xy, `${t.name} as ${t.reverse_of}`);
        expect(layout.columns).toBe(untwisted.columns);
      }
    }
    expect(reversed).toBe(7);
    // D3^(2) reverses C2~: node 0 to the left of node 1.
    expectXy(nodePositions(plain('D3^(2)', TWISTED.find((t) => t.name === 'D3^(2)')!.cartan, [0, 1, 2])), [[0, 0], [1, 0], [2, 0]], 'D3^(2)');
  });

  it('twisted names of affine_names parse to the right layout', () => {
    const twisted = Object.entries(AFFINE_NAMES).flatMap(([size, names]) => names.filter((s) => s.includes('^')).map((s) => [Number(size), s] as const));
    expect(twisted).toHaveLength(23);
    // The parse rule agrees with golden twisted_affine's reverse_of on the ten records.
    for (const t of TWISTED) {
      const src = twistedLayoutSource(t.name);
      expect(src, t.name).not.toBeNull();
      if (t.reverse_of === undefined) expect('row' in src!, t.name).toBe(true);
      else expect('letter' in src! ? `${src.letter}${src.rank}~` : null, t.name).toBe(t.reverse_of);
    }
    const constructorEntry = (n: string) => Object.values(AFFINE).find((e) => e.constructor_name === n);
    for (const [size, name] of twisted) {
      const labels = range(0, size - 1);
      const even = /^A(\d+)\^\(2\)$/.exec(name);
      let expected: readonly Pt[];
      let cartan: number[][];
      let reverseOf: string | null = null;
      if (even && Number(even[1]) % 2 === 0) {
        expect(Number(even[1]) / 2 + 1, name).toBe(size);
        cartan = identity2(size);
        expected = labels.map((i) => [i, 0] as const);
      } else {
        if (even) reverseOf = `B${(Number(even[1]) + 1) / 2}~`;
        else if (/^D(\d+)\^\(2\)$/.test(name)) reverseOf = `C${Number(/^D(\d+)/.exec(name)![1]) - 1}~`;
        else if (name === 'E6^(2)') reverseOf = 'F4~';
        else if (name === 'D4^(3)') reverseOf = 'G2~';
        const entry = constructorEntry(reverseOf!);
        expect(entry, `${name} reverses ${reverseOf}`).toBeDefined();
        expect(entry!.cartan_node0_first.length, name).toBe(size);
        cartan = transpose(entry!.cartan_node0_first);
        expected = nodePositions(plain(reverseOf!, entry!.cartan_node0_first, labels)).xy;
      }
      const layout = nodePositions(plain(name, cartan, labels));
      expect(layout.kind, name).toBe('row');
      expect(layout.circle, name).toBe(false);
      expect(layout.xy, name).toHaveLength(size);
      expectXy(layout, expected, `${name}${reverseOf ? ` as ${reverseOf}` : ''}`);
    }
  });

  it('pentagon and square are regular polygons clockwise from the top', () => {
    for (const [name, m] of [['pentagon', 5], ['square', 4]] as const) {
      const labels = range(1, m);
      const layout = nodePositions(plain(name, identity2(m), labels));
      expect(layout.kind, name).toBe('polygon');
      expect(layout.circle, name).toBe(true);
      expect(layout.xy[0]![0]).toBeCloseTo(0, 12);
      expect(layout.xy[0]![1]).toBeCloseTo(1, 12);
      const angle = (p: Pt): number => Math.atan2(p[1], p[0]);
      const sides: number[] = [];
      for (let k = 0; k < m; k++) {
        const p = layout.xy[k]!;
        const q = layout.xy[(k + 1) % m]!;
        sides.push(Math.hypot(q[0] - p[0], q[1] - p[1]));
        // Clockwise with y up: the angle decreases (mod 2 pi) from one label to the next.
        const turn = (angle(p) - angle(q) + 2 * Math.PI) % (2 * Math.PI);
        expect(turn, `${name} ${k + 1} -> ${((k + 1) % m) + 1}`).toBeCloseTo((2 * Math.PI) / m, 12);
        expect(Math.hypot(p[0], p[1])).toBeCloseTo(1, 12);
      }
      for (const s of sides) expect(s).toBeCloseTo(sides[0]!, 12);
    }
  });

  it('node 0 sits next to the nodes it is joined to', () => {
    let checked = 0;
    for (const key of Object.keys(AFFINE)) {
      const board = affineBoard(key);
      const layout = nodePositions(board);
      if (layout.kind !== 'row') continue;
      // adjacency reads only n and cartan; the plain object stands in for a phase-2 engine board.
      const A = adjacency(board as AnyBoard);
      const p0 = board.labels.indexOf(0);
      const dist = (k: number): number => Math.hypot(layout.xy[k]![0] - layout.xy[p0]![0], layout.xy[k]![1] - layout.xy[p0]![1]);
      const neighbours = range(0, board.n - 1).filter((k) => k !== p0 && (A[p0]![k]! > 0 || A[k]![p0]! > 0));
      const others = range(0, board.n - 1).filter((k) => k !== p0 && !neighbours.includes(k));
      expect(neighbours.length, key).toBeGreaterThan(0);
      for (const k of neighbours) expect(dist(k), `${key}~ neighbour at position ${k}`).toBeLessThanOrEqual(1.2 + 1e-9);
      const nearestNeighbour = Math.min(...neighbours.map(dist));
      for (const k of others) expect(dist(k), `${key}~ non-neighbour at position ${k}`).toBeGreaterThanOrEqual(nearestNeighbour - 1e-9);
      checked++;
    }
    expect(checked).toBe(32 - 7); // all but A2~ .. A8~
  });

  it('custom boards keep valid coordinates and fall back to the circle', () => {
    const C3 = [[2, -1, 0], [-1, 2, -1], [0, -1, 2]];
    const board = plain(undefined, C3, [1, 2, 3]);
    const valid: Pt[] = [[0, 0], [11, 5], [3, 11]];
    const kept = nodePositions(board, valid);
    expect(kept.kind).toBe('custom');
    expect(kept.circle).toBe(false);
    expect(kept.xy).toEqual(valid);
    expect(kept.columns).toBe(12);
    expect(kept.rows).toBe(12);
    const circle = [cornerAt(0, 3), cornerAt(1, 3), cornerAt(2, 3)];
    const broken: (readonly Pt[] | undefined)[] = [
      undefined,
      [[0, 0], [1.5, 0], [2, 0]],
      [[0, 0], [1, 0], [0, 0]],
      [[0, 0], [12, 0], [2, 0]],
      [[0, 0], [-1, 0], [2, 0]],
      [[0, 0], [1, 0]],
      [[0, 0], [1, 0], [2, 0], [3, 0]],
      [[0, 0], [1, Number.NaN], [2, 0]],
    ];
    for (const xy of broken) {
      const layout = nodePositions(board, xy);
      expect(layout.kind, JSON.stringify(xy)).toBe('custom');
      expect(layout.circle, JSON.stringify(xy)).toBe(true);
      expectXy(layout, circle, JSON.stringify(xy));
    }
    // A board from fromAdjacency or subBoard carries no name: custom too, even when its matrix is affine.
    expect(nodePositions(plain(undefined, AFFINE.A1!.cartan_node0_first, [1, 2])).kind).toBe('custom');
    // An unknown name, or a name whose labels do not fit, is custom, never an exception.
    for (const b of [plain('H3', C3, [1, 2, 3]), plain('A3', C3, [2, 3, 4]), plain('E9', C3, [1, 2, 3]), plain('D4', C3, [1, 2, 3])]) {
      expect(() => nodePositions(b)).not.toThrow();
      expect(nodePositions(b).kind).toBe('custom');
    }
    // A1 as a custom board (fromAdjacency gives a named finite board only when the matrix is standard).
    expect(nodePositions(fromAdjacency([[0, 1], [1, 0]])).kind).toBe('row');
    expect(nodePositions(fromAdjacency([[0, 1, 0], [1, 0, 1], [1, 1, 0]])).kind).toBe('custom');
  });

  it('coordinates follow labels, not positions', () => {
    // D4 with its positions carrying labels 4, 3, 2, 1: position 0 is node 4, at (3, -0.6).
    const d4 = boardFromName('D4');
    const permuted = plain('D4', d4.cartan as number[][], [4, 3, 2, 1]);
    expectXy(nodePositions(permuted), [[3, -0.6], [3, 0.6], [2, 0], [1, 0]], 'D4 labels reversed');
    // An affine board whose positions carry labels 3, 2, 1, 0: node 0 is at position 3.
    const c3 = plain('C3~', AFFINE.C3!.cartan_node0_first, [3, 2, 1, 0]);
    expectXy(nodePositions(c3), [[3, 0], [2, 0], [1, 0], [0, 0]], 'C3~ labels reversed');
    // A custom board with labels 2 and 3 (a sub-board of D4): label 2 at the top, whatever its position.
    const sub = nodePositions(plain(undefined, [[2, -1], [-1, 2]], [2, 3]));
    expectXy(sub, [cornerAt(0, 2), cornerAt(1, 2)], 'labels 2, 3');
    const subReversed = nodePositions(plain(undefined, [[2, -1], [-1, 2]], [3, 2]));
    expectXy(subReversed, [cornerAt(1, 2), cornerAt(0, 2)], 'labels 3, 2');
  });
});

describe('size rule of SPEC 6.1 and A-7', () => {
  it('grid unit and hit side reproduce A-7 at 320', () => {
    expect([6, 7, 8, 9, 12].map((k) => hitSide(gridUnit(320, k)))).toEqual([44, 43, 38, 33, 25]);
    const all = range(1, 12).map((k) => hitSide(gridUnit(320, k)));
    expect(all).toEqual([44, 44, 44, 44, 44, 44, 43, 38, 33, 30, 27, 25]);
    for (const h of all) expect(h).toBeGreaterThanOrEqual(24);
    expect(hitSide(gridUnit(360, 7))).toBe(44);
    expect(gridUnit(1024, 1)).toBe(64);
    expect(boardBoxWidth(320, 700)).toBe(320);
    expect(boardBoxWidth(399, 700)).toBe(399);
    expect(boardBoxWidth(400, 700)).toBe(700);
    // E8 occupies 7 columns: 43 at 320 through nodePositions and toPixels.
    expect(toPixels(nodePositions(boardFromName('E8')), 320).hit).toBe(43);
    expect(toPixels(nodePositions(affineBoard('C8')), 320).hit).toBe(33);
  });

  it('polygon radius keeps hit areas of 44 apart', () => {
    expect(polygonRadius(320)).toBe(130);
    expect(polygonRadius(360)).toBe(150);
    expect(polygonRadius(1024)).toBe(150);
    for (let m = 3; m <= 12; m++) expect(2 * 130 * Math.sin(Math.PI / m)).toBeGreaterThanOrEqual(44 * Math.SQRT2);
    expect(2 * 130 * Math.sin(Math.PI / 12)).toBeCloseTo(67.29, 2);
    expect(2 * 130 + 44).toBeLessThanOrEqual(320 - 16);
    const px = toPixels(nodePositions(affineBoard('A8')), 320);
    expect(px.hit).toBe(44);
    expect(px.width).toBeLessThanOrEqual(320);
  });

  it('hit areas never overlap on any standard layout', () => {
    const layouts: [string, DrawLayout][] = [];
    for (const name of TYPE_NAMES) layouts.push([name, nodePositions(boardFromName(name))]);
    for (const key of Object.keys(AFFINE)) layouts.push([`${key}~`, nodePositions(affineBoard(key))]);
    layouts.push(['affine.B2 as C2~', nodePositions(affineBoard('B2', 'C2~'))]);
    for (const t of TWISTED) layouts.push([t.name, nodePositions(plain(t.name, t.cartan, range(0, t.cartan.length - 1)))]);
    for (const [size, names] of Object.entries(AFFINE_NAMES)) {
      for (const name of names.filter((s) => s.includes('^'))) layouts.push([name, nodePositions(plain(name, identity2(Number(size)), range(0, Number(size) - 1)))]);
    }
    layouts.push(['pentagon', nodePositions(plain('pentagon', identity2(5), range(1, 5)))]);
    layouts.push(['square', nodePositions(plain('square', identity2(4), range(1, 4)))]);
    for (let n = 1; n <= 12; n++) layouts.push([`custom circle ${n}`, nodePositions(plain(undefined, identity2(n), range(1, n)))]);
    layouts.push(['custom row of 12', nodePositions(plain(undefined, identity2(12), range(1, 12)), range(0, 11).map((x) => [x, 0] as const))]);
    layouts.push(['custom grid', nodePositions(plain(undefined, identity2(4), range(1, 4)), [[0, 0], [1, 0], [0, 1], [11, 11]])]);
    expect(layouts.length).toBeGreaterThan(100);
    for (const W of [320, 360, 1024]) {
      for (const [name, layout] of layouts) {
        const px = toPixels(layout, W);
        expect(px.hit, `${name} at ${W}`).toBeGreaterThanOrEqual(24);
        expect(px.width, `${name} at ${W}`).toBeLessThanOrEqual(Math.max(W, 360 + 16));
        for (let i = 0; i < px.centres.length; i++) {
          for (let j = i + 1; j < px.centres.length; j++) {
            const dx = Math.abs(px.centres[i]![0] - px.centres[j]![0]);
            const dy = Math.abs(px.centres[i]![1] - px.centres[j]![1]);
            const apart = dx >= px.hit - 1e-9 || dy >= px.hit - 1e-9;
            expect(apart, `${name} at ${W}: positions ${i} and ${j}`).toBe(true);
          }
          // Inside the box.
          expect(px.centres[i]![0] - px.hit / 2).toBeGreaterThanOrEqual(-1e-9);
          expect(px.centres[i]![1] - px.hit / 2).toBeGreaterThanOrEqual(-1e-9);
          expect(px.centres[i]![0] + px.hit / 2).toBeLessThanOrEqual(px.width + 1e-9);
          expect(px.centres[i]![1] + px.hit / 2).toBeLessThanOrEqual(px.height + 1e-9);
        }
      }
    }
  });

  it('toPixels flips y once', () => {
    // E6: node 2 at (3, 1) is above node 4 at (3, 0) in the grid, so it has the smaller SVG y.
    const px = toPixels(nodePositions(boardFromName('E6')), 1024);
    expect(px.centres[1]![1]).toBeLessThan(px.centres[3]![1]);
    expect(px.centres[1]![0]).toBeCloseTo(px.centres[3]![0], 12);
    // Polygon: label 0 of A2~ at the top.
    const tri = toPixels(nodePositions(affineBoard('A2')), 320);
    expect(tri.centres[0]![1]).toBeLessThan(tri.centres[1]![1]);
  });
});

describe('roads of SPEC 6.2', () => {
  it('dynkin style counts lines and points chevrons from long to short', () => {
    expect(roadGlyphs(boardFromName('B3'), 'dynkin')).toEqual([
      { kind: 'lines', from: 0, to: 1, count: 1, chevronTowards: null },
      { kind: 'lines', from: 1, to: 2, count: 2, chevronTowards: 2 },
    ]);
    expect(roadGlyphs(boardFromName('C3'), 'dynkin')).toEqual([
      { kind: 'lines', from: 0, to: 1, count: 1, chevronTowards: null },
      { kind: 'lines', from: 1, to: 2, count: 2, chevronTowards: 1 },
    ]);
    expect(roadGlyphs(boardFromName('F4'), 'dynkin')).toEqual([
      { kind: 'lines', from: 0, to: 1, count: 1, chevronTowards: null },
      { kind: 'lines', from: 1, to: 2, count: 2, chevronTowards: 2 },
      { kind: 'lines', from: 2, to: 3, count: 1, chevronTowards: null },
    ]);
    expect(roadGlyphs(boardFromName('G2'), 'dynkin')).toEqual([{ kind: 'lines', from: 0, to: 1, count: 3, chevronTowards: 0 }]);
    for (const name of ['A3', 'E8', 'D5', 'E6']) {
      const glyphs = roadGlyphs(boardFromName(name), 'dynkin');
      expect(glyphs, name).toHaveLength(boardFromName(name).n - 1);
      for (const g of glyphs) expect(g, name).toMatchObject({ kind: 'lines', count: 1, chevronTowards: null });
    }
    // E8: node 2 (position 1) joins node 4 (position 3); pairs in increasing (i, j) order.
    expect(roadGlyphs(boardFromName('E8'), 'dynkin').map((g) => [g.from, g.to])).toEqual([[0, 2], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]);
  });

  it('pairs with a product of four or more are a thick line with both counts', () => {
    expect(roadGlyphs(fromAdjacency([[0, 2], [2, 0]]), 'dynkin')).toEqual([{ kind: 'thick', from: 0, to: 1, countAtFrom: 2, countAtTo: 2 }]);
    const a22 = fromAdjacency([[0, 1], [4, 0]]);
    expect(a22.cartan.map((r) => r.map(Number))).toEqual(TWISTED.find((t) => t.name === 'A2^(2)')!.cartan);
    expect(roadGlyphs(a22, 'dynkin')).toEqual([{ kind: 'thick', from: 0, to: 1, countAtFrom: 1, countAtTo: 4 }]);
  });

  it('roads style draws one arrow per road', () => {
    const b2 = boardFromName('B2');
    const glyphs = roadGlyphs(b2, 'roads');
    expect(glyphs.filter((g) => g.kind === 'arrow' && g.from === 0 && g.to === 1)).toHaveLength(2);
    expect(glyphs.filter((g) => g.kind === 'arrow' && g.from === 1 && g.to === 0)).toHaveLength(1);
    const total = (b: AnyBoard) => adjacency(b).flat().reduce((s, x) => s + x, 0);
    expect(glyphs).toHaveLength(total(b2));
    for (const b of [boardFromName('G2'), boardFromName('E8'), fromAdjacency([[0, 4, 1], [3, 0, 2], [0, 1, 0]])]) {
      const g = roadGlyphs(b, 'roads');
      expect(g).toHaveLength(total(b));
      // Distinct curvatures: no two roads of a pair are drawn on the same curve.
      const els = roadElements(g, b.labels.map((_, k) => [k * 2, (k % 2) * 1.5] as const), 1).filter((e) => e.tag === 'path');
      expect(new Set(els.map((e) => e.attrs.d)).size).toBe(els.length);
    }
  });

  it('road elements use the road, arrow and text tokens', () => {
    const line = (k: number): [number, number] => [k + 0.5, 0.5];
    const b3 = roadElements(roadGlyphs(boardFromName('B3'), 'dynkin'), [line(0), line(1), line(2)], 1);
    const lines = b3.filter((e) => e.tag === 'line');
    expect(lines).toHaveLength(3);
    for (const e of lines) expect(e.attrs.stroke).toBe('var(--road)');
    const chevrons = b3.filter((e) => e.attrs.class === 'chevron');
    expect(chevrons).toHaveLength(1);
    expect(chevrons[0]!.attrs.stroke).toBe('var(--arrow)');
    // The chevron's tip points at node 3 (position 2): its middle point is the one with the largest x.
    const pts = chevrons[0]!.attrs.d!.replace(/[ML]/g, ' ').trim().split(/\s+/).map((s) => s.split(',').map(Number));
    expect(pts[1]![0]).toBeGreaterThan(pts[0]![0]!);

    const a22 = roadElements(roadGlyphs(fromAdjacency([[0, 1], [4, 0]]), 'dynkin'), [[0.5, 0.5], [1.5, 0.5]], 1);
    const thick = a22.filter((e) => e.tag === 'line');
    expect(thick).toHaveLength(1);
    expect(thick[0]!.attrs.stroke).toBe('var(--road)');
    expect(thick[0]!.attrs.class).toContain('thick');
    const texts = a22.filter((e) => e.tag === 'text');
    expect(texts.map((e) => e.text)).toEqual(['1', '4']);
    for (const e of texts) expect(e.attrs.fill).toBe('var(--text)');
    expect(Number(texts[0]!.attrs.x)).toBeLessThan(Number(texts[1]!.attrs.x)); // 1 beside node 0, 4 beside node 1

    const b2 = roadElements(roadGlyphs(boardFromName('B2'), 'roads'), [[0.5, 0.5], [1.5, 0.5]], 1);
    const heads = b2.filter((e) => e.tag === 'polygon');
    expect(heads).toHaveLength(3);
    for (const e of heads) expect(e.attrs.fill).toBe('var(--arrow)');
    for (const e of b2.filter((x) => x.tag === 'path')) expect(e.attrs.stroke).toBe('var(--road)');

    for (const e of [...b3, ...a22, ...b2]) expect(JSON.stringify(e)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('a board with a one-way road always uses roads style', () => {
    const oneWay = fromAdjacency([[0, 1], [0, 0]]);
    expect(oneWay.kind).toBe('one-way');
    expect(effectiveRoadStyle(oneWay, 'dynkin')).toBe('roads');
    expect(effectiveRoadStyle(oneWay)).toBe('roads');
    expect(effectiveRoadStyle(boardFromName('A2'))).toBe('dynkin');
    expect(effectiveRoadStyle(boardFromName('A2'), 'roads')).toBe('roads');
    expect(roadGlyphs(oneWay, effectiveRoadStyle(oneWay, 'dynkin'))).toEqual([{ kind: 'arrow', from: 0, to: 1, index: 0, of: 1 }]);
  });
});
