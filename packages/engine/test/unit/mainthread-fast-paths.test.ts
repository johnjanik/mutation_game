// regression: P3-RT-07-02 (residual: the engine work of loading a 12-node board into T4, SPEC 7.6
// "Main-thread work"). Four engine functions were made faster without changing any result (E-5):
// cartanClass decides on the leading principal minors of C by a fraction-free elimination (numbers, then
// bigint when a value leaves the safe range), smallestNonfiniteSubboard tests connectedness on bit masks
// and classifies the induced matrix without building a board, symmetrizer writes all ones on a symmetric
// matrix, and orbitGraph on a Big board searches on numbers while every value is a safe integer and goes
// on in bigint from the move where one is not. Each is checked here against the rule it replaces, written
// as a test helper from the oracle: cartan_class (lines 1061 to 1077, the leading minors of B = DC after
// the balance test of symmetrizer, lines 106 to 120, and is_symmetrizable), smallest_nonfinite_subboard
// (lines 1256 to 1271) and orbit_graph_capped (lines 1352 to 1370, the bigint loop with decimal keys).
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import { cartanClass, smallestNonfiniteSubboard, symmetrizer } from '../../src/classify';
import { determinant } from '../../src/linalg';
import { fire, mutate, type Game } from '../../src/moves';
import type { Rational } from '../../src/rational';
import { rat, ratDiv, ratEq, ratMul, ratSign, ratSub } from '../../src/rational';
import { orbitGraph, type OrbitGraph } from '../../src/search';
import { EngineOverflow } from '../../src/errors';
import { TYPE_NAMES, boardOf } from '../golden/_harness';
import { bigBoard } from '../helpers/p1';
import { cycle } from '../helpers/p2';

/** mulberry32: a small deterministic generator for the random boards (floats are allowed in tests). */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The oracle's components (two positions joined when C[i][j] or C[j][i] is nonzero), each sorted. */
function refComponents(C: number[][]): number[][] {
  const n = C.length;
  const seen = C.map(() => false);
  const out: number[][] = [];
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    seen[s] = true;
    const comp: number[] = [];
    const stack = [s];
    while (stack.length > 0) {
      const i = stack.pop()!;
      comp.push(i);
      for (let j = 0; j < n; j++) {
        if (!seen[j] && i !== j && (C[i]![j] !== 0 || C[j]![i] !== 0)) {
          seen[j] = true;
          stack.push(j);
        }
      }
    }
    out.push(comp.sort((a, b) => a - b));
  }
  return out;
}

/** The oracle's symmetrizer walk, then the pair check of is_symmetrizable: d, or null when not balanced. */
function refSymmetrizer(C: number[][]): Rational[] | null {
  const n = C.length;
  const d: (Rational | null)[] = C.map(() => null);
  for (const comp of refComponents(C)) {
    const s = comp[0]!;
    d[s] = rat(1);
    const stack = [s];
    while (stack.length > 0) {
      const i = stack.pop()!;
      for (const j of comp) {
        if (j !== i && C[i]![j] !== 0 && d[j] === null) {
          d[j] = ratDiv(ratMul(d[i]!, rat(C[i]![j]!)), rat(C[j]![i]!));
          stack.push(j);
        }
      }
    }
    let m = d[s]!;
    for (const i of comp) if (ratSign(ratSub(d[i]!, m)) < 0) m = d[i]!;
    for (const i of comp) d[i] = ratDiv(d[i]!, m);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) if (!ratEq(ratMul(d[i]!, rat(C[i]![j]!)), ratMul(d[j]!, rat(C[j]![i]!)))) return null;
  }
  return d as Rational[];
}

/** The oracle's cartan_class on a connected two-way matrix: the leading principal minors of B = DC. */
function refCartanClass(C: number[][]): 'finite' | 'affine' | 'indefinite' {
  const d = refSymmetrizer(C);
  if (d === null) return 'indefinite';
  const B = C.map((row, i) => row.map((x) => ratMul(d[i]!, rat(x))));
  const n = C.length;
  const minors: number[] = [];
  for (let k = 1; k <= n; k++) minors.push(ratSign(determinant(B.slice(0, k).map((row) => row.slice(0, k)))));
  if (minors.every((m) => m > 0)) return 'finite';
  if (minors.slice(0, -1).every((m) => m > 0) && minors[n - 1] === 0) return 'affine';
  return 'indefinite';
}

/** The oracle's smallest_nonfinite_subboard, in positions, on a two-way matrix. */
function refSmallest(C: number[][]): { nodes: number[]; class: 'affine' | 'indefinite' } | null {
  const n = C.length;
  for (let size = 1; size <= n; size++) {
    // The subsets of one size in lexicographic order (itertools.combinations).
    const subsets: number[][] = [];
    const K: number[] = [];
    const go = (start: number): void => {
      if (K.length === size) {
        subsets.push([...K]);
        return;
      }
      for (let i = start; i < n; i++) {
        K.push(i);
        go(i + 1);
        K.pop();
      }
    };
    go(0);
    for (const S of subsets) {
      const sub = S.map((i) => S.map((j) => C[i]![j]!));
      if (refComponents(sub).length !== 1) continue;
      const cls = refCartanClass(sub);
      if (cls !== 'finite') return { nodes: S, class: cls };
    }
  }
  return null;
}

/** The loop of orbitGraph as it was before the search on numbers (decimal keys, mutate and fire in the board's arithmetic). */
function refOrbitGraph<T>(board: Board<T>, seeds: T[][], game: Game, cap: number, maxDepth?: number, legal = false): OrbitGraph<T> {
  const move = game === 'mutation' ? mutate : fire;
  const items: T[][] = [];
  const depth: number[] = [];
  const parent: (number | null)[] = [];
  const node: (number | null)[] = [];
  const index = new Map<string, number>();
  for (const s of seeds) {
    const key = s.join(',');
    if (index.has(key)) continue;
    index.set(key, items.length);
    items.push([...s]);
    depth.push(0);
    parent.push(null);
    node.push(null);
  }
  for (let h = 0; h < items.length; h++) {
    const v = items[h]!;
    const d = depth[h]!;
    if (maxDepth !== undefined && d >= maxDepth) continue;
    for (let i = 0; i < board.n; i++) {
      if (legal && board.arith.sign(v[i]!) <= 0) continue;
      const w = move(board, v, i);
      const key = w.join(',');
      if (index.has(key)) continue;
      if (items.length === cap) return { items, truncated: true, depthReached: depth[items.length - 1]!, completeLayers: d, depth, parent, node };
      index.set(key, items.length);
      items.push(w);
      depth.push(d + 1);
      parent.push(h);
      node.push(i);
    }
  }
  const last = depth[items.length - 1]!;
  return { items, truncated: false, depthReached: last, completeLayers: last, depth, parent, node };
}

/** A random two-way matrix on n nodes: each pair joined with probability p, road counts 1..maxRoads each way. */
function randomTwoWay(r: () => number, n: number, p: number, maxRoads: number, symmetric: boolean): number[][] {
  const C: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (r() >= p) continue;
      const x = 1 + Math.floor(r() * maxRoads);
      const y = symmetric ? x : 1 + Math.floor(r() * maxRoads);
      C[i]![j] = -x;
      C[j]![i] = -y;
    }
  }
  return C;
}

const units = (n: number): bigint[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1n : 0n)));
const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

describe('cartanClass and symmetrizer: the same results as the oracle rule they replace', () => {
  it('on 600 random connected boards of 1 to 8 nodes, symmetric or not, with 1 to 4 roads each way', () => {
    const r = rng(20261024);
    const seen = { finite: 0, affine: 0, indefinite: 0 };
    let count = 0;
    while (count < 600) {
      const n = 1 + Math.floor(r() * 8);
      const C = randomTwoWay(r, n, 0.2 + r() * 0.5, 1 + Math.floor(r() * 4), r() < 0.5);
      if (refComponents(C).length !== 1) continue;
      count += 1;
      const b = bigBoard(C);
      const cls = cartanClass(b);
      expect(cls, JSON.stringify(C)).toBe(refCartanClass(C));
      seen[cls] += 1;
      const d = symmetrizer(b);
      const want = refSymmetrizer(C);
      expect(d === null ? null : d.map((x) => `${x.num}/${x.den}`)).toEqual(want === null ? null : want.map((x) => `${x.num}/${x.den}`));
    }
    expect(seen.finite).toBeGreaterThan(20);
    expect(seen.affine).toBeGreaterThan(5);
    expect(seen.indefinite).toBeGreaterThan(20);
  });

  it('with entries whose minors leave the safe range (the bigint elimination), and on cycles and paths of 12 nodes', () => {
    const r = rng(7);
    let count = 0;
    while (count < 120) {
      const n = 2 + Math.floor(r() * 7);
      const C = randomTwoWay(r, n, 0.6, 1, r() < 0.5);
      // Large road counts on a few roads: the minors of C reach far beyond 2^53 on 8 nodes.
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && C[i]![j] !== 0 && r() < 0.5) C[i]![j] = -(1 + Math.floor(r() * 3_000_000));
      if (refComponents(C).length !== 1) continue;
      count += 1;
      expect(cartanClass(bigBoard(C)), JSON.stringify(C)).toBe(refCartanClass(C));
    }
    // A leading block of finite type keeps the pivots positive, so the elimination reaches the roads of
    // 2^27 behind it, where a product passes 2^53: only the bigint elimination is exact there.
    const L = 2 ** 27;
    for (const C of [
      [[2, -1, 0], [-1, 2, -L], [0, -L, 2]],
      [[2, -1, 0, 0], [-1, 2, -1, 0], [0, -1, 2, -L], [0, 0, -L, 2]],
      [[2, -1, 0, 0], [-1, 2, -2, -1], [0, -1, 2, -L], [0, -1, -2 * L, 2]],
    ]) {
      expect(cartanClass(bigBoard(C)), JSON.stringify(C)).toBe(refCartanClass(C));
    }
    for (const m of [3, 7, 12]) expect(cartanClass(bigBoard(cycle(m)))).toBe('affine');
    const path12 = Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => (i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0)));
    expect(cartanClass(bigBoard(path12))).toBe('finite');
  });
});

describe('smallestNonfiniteSubboard: the same results as the oracle loop', () => {
  it('on 300 random two-way boards of 1 to 8 nodes, connected or not', () => {
    const r = rng(1729);
    let nonNull = 0;
    for (let t = 0; t < 300; t++) {
      const n = 1 + Math.floor(r() * 8);
      const C = randomTwoWay(r, n, 0.15 + r() * 0.4, 1 + Math.floor(r() * 3), r() < 0.6);
      const want = refSmallest(C);
      if (want !== null) nonNull += 1;
      expect(smallestNonfiniteSubboard(bigBoard(C)), JSON.stringify(C)).toEqual(want);
    }
    expect(nonNull).toBeGreaterThan(50);
  });

  it('on the 12-cycle: the whole board, affine (every proper connected subset is a path)', () => {
    expect(smallestNonfiniteSubboard(bigBoard(cycle(12)))).toEqual({ nodes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], class: 'affine' });
  });
});

/** Every field of two search graphs, and the arithmetic of the items (bigint on a Big board, number on SafeInt). */
function same<T>(got: OrbitGraph<T>, want: OrbitGraph<T>, what: string, kind: 'bigint' | 'number' = 'bigint'): void {
  expect(got.truncated, what).toBe(want.truncated);
  expect(got.depthReached, what).toBe(want.depthReached);
  expect(got.completeLayers, what).toBe(want.completeLayers);
  expect(got.depth, what).toEqual(want.depth);
  expect(got.parent, what).toEqual(want.parent);
  expect(got.node, what).toEqual(want.node);
  expect(got.items, what).toEqual(want.items);
  for (const v of got.items) for (const x of v) expect(typeof x, what).toBe(kind);
}

describe('orbitGraph on a SafeInt board: the same graph as the generic loop, and the same EngineOverflow', () => {
  it('on every finite type, from the simple roots (mutation) and from rho (firing, free and legal, cap 500)', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const e = units(b.n).map((v) => v.map((x) => Number(x)));
      const rho = [Array.from({ length: b.n }, () => 1)];
      same(orbitGraph(b, e, 'mutation', 2000), refOrbitGraph(b, e, 'mutation', 2000), `${T} roots`, 'number');
      same(orbitGraph(b, rho, 'firing', 500), refOrbitGraph(b, rho, 'firing', 500), `${T} rho`, 'number');
      same(orbitGraph(b, rho, 'firing', 500, 6, true), refOrbitGraph(b, rho, 'firing', 500, 6, true), `${T} rho legal`, 'number');
    }
  });

  it('a value that leaves the safe range throws EngineOverflow at the same move, with the same message', () => {
    for (const [T, seed, game] of [
      ['A2', [2 ** 52, 2 ** 52 - 1], 'mutation'],
      ['G2', [2 ** 51, 0], 'mutation'],
      ['G2', [0, 2 ** 51], 'mutation'],
      ['B3', [2 ** 52, 3, -(2 ** 49)], 'firing'],
      ['B3', [2 ** 51, 0, 0], 'firing'],
      ['G2', [2 ** 51, 0], 'firing'],
      ['G2', [0, 2 ** 51], 'firing'],
    ] as [string, number[], Game][]) {
      const b = boardOf(T);
      let want = '';
      let got = '';
      try {
        refOrbitGraph(b, [seed], game, 5000);
      } catch (e) {
        expect(e, `${T} reference`).toBeInstanceOf(EngineOverflow);
        want = (e as Error).message;
      }
      try {
        orbitGraph(b, [seed], game, 5000);
      } catch (e) {
        expect(e, T).toBeInstanceOf(EngineOverflow);
        got = (e as Error).message;
      }
      expect(want, `${T} ${JSON.stringify(seed)} overflows`).not.toBe('');
      expect(got, `${T} ${JSON.stringify(seed)}`).toBe(want);
    }
  });
});

describe('orbitGraph on a Big board: the same graph as the bigint loop', () => {

  it('on 150 random boards, both games, with and without a layer bound, legal firing, repeated seeds', () => {
    const r = rng(4242);
    for (let t = 0; t < 150; t++) {
      const n = 2 + Math.floor(r() * 5);
      const C = randomTwoWay(r, n, 0.5, 1 + Math.floor(r() * 3), r() < 0.5);
      const b = bigBoard(C);
      const game: Game = r() < 0.5 ? 'mutation' : 'firing';
      const legal = game === 'firing' && r() < 0.4;
      const seeds: bigint[][] = r() < 0.5 ? units(n) : Array.from({ length: 1 + Math.floor(r() * 3) }, () => Array.from({ length: n }, () => BigInt(Math.floor(r() * 7) - 3)));
      if (r() < 0.2) seeds.push([...seeds[0]!]);
      const cap = seeds.length + Math.floor(r() * 400);
      const maxDepth = r() < 0.5 ? Math.floor(r() * 12) : undefined;
      const what = `${JSON.stringify(C)} ${game} cap ${cap} depth ${maxDepth} legal ${legal}`;
      same(orbitGraph(b, seeds, game, cap, maxDepth, legal || undefined), refOrbitGraph(b, seeds, game, cap, maxDepth, legal), what);
    }
  });

  it('where values pass 2^53 during the search (the search goes on in bigint from that move)', () => {
    for (const [C, game] of [
      [[[2, -4], [-4, 2]], 'mutation'],
      [[[2, -1000, -1], [-1000, 2, -2], [-1, -2, 2]], 'mutation'],
      [[[2, -4], [-3, 2]], 'firing'],
      [[[2, -900, -2], [-700, 2, -2], [-2, -2, 2]], 'firing'],
    ] as [number[][], Game][]) {
      const b = bigBoard(C);
      const want = refOrbitGraph(b, units(C.length), game, 2000, 60);
      expect(want.items.some((v) => v.some((x) => x > SAFE || x < -SAFE)), `${JSON.stringify(C)} passes 2^53`).toBe(true);
      same(orbitGraph(b, units(C.length), game, 2000, 60), want, `${JSON.stringify(C)} ${game}`);
    }
  });

  it('with a seed beyond 2^53, and on the 12-cycle as T4 counts it (cap 2000, 40 layers)', () => {
    const b2 = bigBoard([[2, -1], [-1, 2]]);
    const seeds = [[2n ** 60n, -(2n ** 59n)], [1n, 0n]];
    same(orbitGraph(b2, seeds, 'mutation', 50), refOrbitGraph(b2, seeds, 'mutation', 50), 'seed beyond 2^53');
    const ring = bigBoard(cycle(12));
    same(orbitGraph(ring, units(12), 'mutation', 2000, 40), refOrbitGraph(ring, units(12), 'mutation', 2000, 40), '12-cycle');
    const chord = cycle(12).map((row) => [...row]);
    chord[0]![6] = -1;
    chord[6]![0] = -1;
    const withChord = bigBoard(chord);
    same(orbitGraph(withChord, units(12), 'mutation', 2000), refOrbitGraph(withChord, units(12), 'mutation', 2000), '12-cycle with a chord');
  });
});
