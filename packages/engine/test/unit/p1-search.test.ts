// The rules of SPEC.md 5.5 at their edges (P1-A1 instruction 5.6, 5.12): the cap that falls exactly at
// the end of a layer, layers 333 and 500 at a cap of 2000, maxDepth 0, a cap equal to the seeds, repeated
// seeds, legalOnly, wordTo, orbit, and the positive roots of Appendix A.1. No golden key.
import { describe, expect, it } from 'vitest';
import { CAPS } from '../../src/caps';
import { applyWord, fire } from '../../src/moves';
import { orbit, orbitGraph, positiveRoots, roots, wordTo } from '../../src/search';
import { bigBoard, digits, ones, unitVectors } from '../helpers/p1';
import { boardOf } from '../golden/_harness';

const TRIANGLE = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];
const THREE_EACH_WAY = [[2, -3], [-3, 2]];

describe('order and truncation of a search', () => {
  it('a cap that falls exactly at the end of a layer: the triangle with a cap of 9', () => {
    const b = bigBoard(TRIANGLE);
    const g = orbitGraph(b, unitVectors(b), 'mutation', 9);
    expect(g.items.length).toBe(9);
    expect(g.truncated).toBe(true);
    expect(g.completeLayers).toBe(1);
    expect(g.depthReached).toBe(1);
    expect(g.depth).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 1]);
  });

  it('a cap of 10 on the triangle cuts layer 2 after one position', () => {
    const b = bigBoard(TRIANGLE);
    const g = orbitGraph(b, unitVectors(b), 'mutation', 10);
    expect(g.items.length).toBe(10);
    expect(g.truncated).toBe(true);
    expect(g.completeLayers).toBe(1);
    expect(g.depthReached).toBe(2);
  });

  it('layer 333 on the triangle and layer 500 on the two-node board, at a cap of 2000', { timeout: 30000 }, () => {
    const t = bigBoard(TRIANGLE);
    const gt = orbitGraph(t, unitVectors(t), 'mutation', 2000, 600);
    expect(gt.truncated).toBe(true);
    expect(gt.completeLayers).toBe(332);
    expect(gt.items.length).toBe(2000);
    const w = bigBoard(THREE_EACH_WAY);
    const gw = orbitGraph(w, unitVectors(w), 'mutation', 2000, 600);
    expect(gw.truncated).toBe(true);
    expect(gw.completeLayers).toBe(499);
    let largest = 0;
    for (const v of gw.items) for (const x of v) largest = Math.max(largest, digits(x));
    expect(largest).toBe(210);
  });

  it('is in breadth-first order: the seeds first, then the nodes in increasing position', () => {
    const b = boardOf('A2');
    const g = orbitGraph(b, unitVectors(b), 'mutation', 100);
    // e_1, e_2; then from e_1: mutate 1 gives -e_1 (new), mutate 2 gives (1, 1) (new); from e_2: mutate 1 gives
    // (1, 1) (seen), mutate 2 gives -e_2; and so on
    expect(g.items.slice(0, 4)).toEqual([[1, 0], [0, 1], [-1, 0], [1, 1]]);
    expect(g.node.slice(0, 4)).toEqual([null, null, 0, 1]);
    expect(g.parent.slice(0, 4)).toEqual([null, null, 0, 0]);
    expect(g.items.length).toBe(6);
    expect(g.truncated).toBe(false);
    expect(g.completeLayers).toBe(g.depthReached);
    for (let k = 1; k < g.depth.length; k++) expect(g.depth[k]!).toBeGreaterThanOrEqual(g.depth[k - 1]!);
  });

  it('maxDepth 0 returns the seeds, not truncated', () => {
    const b = boardOf('B3');
    const g = orbitGraph(b, unitVectors(b), 'mutation', 2000, 0);
    expect(g.items).toEqual(unitVectors(b));
    expect(g.truncated).toBe(false);
    expect(g.depthReached).toBe(0);
    expect(g.completeLayers).toBe(0);
  });

  it('maxDepth ends a search without truncation although more positions exist', () => {
    const b = boardOf('E8');
    const g = orbitGraph(b, unitVectors(b), 'mutation', 2000, 2);
    expect(g.truncated).toBe(false);
    expect(g.depthReached).toBe(2);
    expect(g.completeLayers).toBe(2);
    expect(g.items.length).toBeLessThan(240);
    expect(roots(b, 2000).items.length).toBe(240);
  });

  it('a cap equal to the number of seeds with more positions reachable: truncated, completeLayers 0', () => {
    const b = boardOf('A3');
    const g = orbitGraph(b, unitVectors(b), 'mutation', 3);
    expect(g.items).toEqual(unitVectors(b));
    expect(g.truncated).toBe(true);
    expect(g.completeLayers).toBe(0);
    expect(g.depthReached).toBe(0);
  });

  it('a cap equal to the whole orbit is not truncated', () => {
    const b = boardOf('A2');
    const g = orbitGraph(b, unitVectors(b), 'mutation', 6);
    expect(g.items.length).toBe(6);
    expect(g.truncated).toBe(false);
  });

  it('a repeated seed is kept once, at its first occurrence', () => {
    const b = boardOf('A2');
    const g = orbitGraph(b, [[0, 1], [1, 0], [0, 1]], 'mutation', 100);
    expect(g.items.slice(0, 2)).toEqual([[0, 1], [1, 0]]);
    expect(g.depth.filter((d) => d === 0).length).toBe(2);
    expect(g.items.length).toBe(6);
  });

  it('legalOnly follows only positive numbers in firing; with mutation it is a RangeError', () => {
    const b = boardOf('A3');
    const g = orbitGraph(b, [ones(b)], 'firing', 2000, undefined, true);
    expect(g.truncated).toBe(false);
    expect(g.items.length).toBe(24);
    expect(g.depthReached).toBe(6);
    for (let k = 0; k < g.items.length; k++) {
      const p = g.parent[k];
      if (p === null) continue;
      const i = g.node[k]!;
      expect(g.items[p]![i]!).toBeGreaterThan(0);
      expect(fire(b, g.items[p]!, i)).toEqual(g.items[k]);
    }
    // every position with a positive number has a successor by legal play among the items
    const keys = new Set(g.items.map((v) => v.join(',')));
    for (const v of g.items) for (let i = 0; i < b.n; i++) if (v[i]! > 0) expect(keys.has(fire(b, v, i).join(','))).toBe(true);
    const free = orbitGraph(b, [ones(b)], 'firing', 2000);
    expect(free.items.length).toBe(24);
    expect(() => orbitGraph(b, [ones(b)], 'mutation', 2000, undefined, true)).toThrow(RangeError);
  });

  it('throws RangeError on no seeds, a seed of the wrong length, a cap below the seeds, a bad maxDepth', () => {
    const b = boardOf('A2');
    expect(() => orbitGraph(b, [], 'mutation', 10)).toThrow(RangeError);
    expect(() => orbitGraph(b, [[1]], 'mutation', 10)).toThrow(RangeError);
    expect(() => orbitGraph(b, unitVectors(b), 'mutation', 1)).toThrow(RangeError);
    expect(() => orbitGraph(b, unitVectors(b), 'mutation', 2.5)).toThrow(RangeError);
    expect(() => orbitGraph(b, unitVectors(b), 'mutation', 10, -1)).toThrow(RangeError);
    expect(() => orbitGraph(b, unitVectors(b), 'mutation', 10, 1.5)).toThrow(RangeError);
    expect(() => roots(b, 1)).toThrow(RangeError);
  });
});

describe('wordTo', () => {
  it('replays through applyWord from the seed to every item of a search on B3, with length the depth', () => {
    const b = boardOf('B3');
    const seeds = unitVectors(b);
    const g = orbitGraph(b, seeds, 'mutation', 2000);
    expect(g.items.length).toBe(18);
    for (let k = 0; k < g.items.length; k++) {
      const word = wordTo(g, k);
      expect(word.length).toBe(g.depth[k]);
      let seed = k;
      while (g.parent[seed] !== null) seed = g.parent[seed]!;
      expect(applyWord(b, g.items[seed]!, word, 'mutation')).toEqual(g.items[k]);
    }
    const f = orbitGraph(b, [ones(b)], 'firing', 2000, undefined, true);
    for (let k = 0; k < f.items.length; k++) {
      expect(applyWord(b, ones(b), wordTo(f, k), 'firing')).toEqual(f.items[k]);
    }
  });

  it('gives [] for a seed and RangeError outside the items', () => {
    const b = boardOf('A2');
    const g = orbitGraph(b, unitVectors(b), 'mutation', 100);
    expect(wordTo(g, 0)).toEqual([]);
    expect(wordTo(g, 1)).toEqual([]);
    expect(() => wordTo(g, 6)).toThrow(RangeError);
    expect(() => wordTo(g, -1)).toThrow(RangeError);
  });
});

describe('orbit and roots', () => {
  it('orbit returns the same items and truncation as orbitGraph', () => {
    const b = bigBoard(TRIANGLE);
    const g = orbitGraph(b, unitVectors(b), 'mutation', 50, 10);
    const o = orbit(b, unitVectors(b), 'mutation', 50, 10);
    expect(o.items).toEqual(g.items);
    expect(o.truncated).toBe(g.truncated);
    expect(o.truncated).toBe(true);
    const full = orbit(b, unitVectors(b), 'mutation', 2000, 5);
    expect(full.truncated).toBe(false);
    expect(full.items.length).toBe(3 + 6 + 6 + 6 + 6 + 6);
  });

  it('roots seeds the simple root populations in order and uses the board arithmetic', () => {
    const b = bigBoard([[2, -1], [-1, 2]]);
    const r = roots(b, CAPS.mainThreadItems);
    expect(r.items.slice(0, 2)).toEqual([[1n, 0n], [0n, 1n]]);
    expect(r.items.length).toBe(6);
    expect(r.truncated).toBe(false);
  });
});

describe('positiveRoots', () => {
  it('positiveRoots matches A.1', () => {
    // SPEC.md Appendix A.1, "the positive root populations, grouped by height"
    expect(positiveRoots(boardOf('A2'))).toEqual([[0, 1], [1, 0], [1, 1]]);
    expect(positiveRoots(boardOf('B2'))).toEqual([[0, 1], [1, 0], [1, 1], [1, 2]]);
    expect(positiveRoots(boardOf('G2'))).toEqual([[0, 1], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]]);
  });

  it('sorts by total then lexicographically, numerically, on a Big board', () => {
    const b = bigBoard([[2, -1], [-1, 2]]);
    expect(positiveRoots(b)).toEqual([[0n, 1n], [1n, 0n], [1n, 1n]]);
    const w = bigBoard(THREE_EACH_WAY);
    const pos = positiveRoots(w, 2000, 6);
    for (let k = 1; k < pos.length; k++) {
      const a = pos[k - 1]!;
      const c = pos[k]!;
      const ta = a[0]! + a[1]!;
      const tc = c[0]! + c[1]!;
      expect(ta < tc || (ta === tc && (a[0]! < c[0]! || (a[0] === c[0] && a[1]! < c[1]!)))).toBe(true);
    }
    expect(pos.some((v) => v.some((x) => x >= 10n))).toBe(true);
  });

  it('takes a cap and maxDepth', () => {
    const b = bigBoard(TRIANGLE);
    expect(positiveRoots(b, 2000, 1).length).toBe(3 + 3);
    // the three seeds, sorted lexicographically within total 1
    expect(positiveRoots(b, 2000, 0)).toEqual([[0n, 0n, 1n], [0n, 1n, 0n], [1n, 0n, 0n]]);
  });
});
