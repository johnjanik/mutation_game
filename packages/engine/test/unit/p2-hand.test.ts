// Hand-checkable vectors of SPEC.md 2.5, 2.8, 2.12, A.4, A.6 and the values quoted in sections 5.3 to
// 5.15 of the P2-A1 instruction, with the edge cases of that file (plan addition under the README
// section 4 rule). The cross-check of cartanClass against the definition by all principal minors is the
// oracle's cartan_class_by_minors, written here as a test helper (never shipped). No golden key.
import { describe, expect, it } from 'vitest';
import { Big, SafeInt } from '../../src/arith';
import type { Board } from '../../src/board';
import { boardFromName, cartan, cartanNumbers, components, subBoard, transposeBoard } from '../../src/board';
import { CAPS } from '../../src/caps';
import { NeedsConnectedBoard, NeedsTwoWayRoads, NotABoard, NotFiniteType } from '../../src/errors';
import { affineCandidates, affineExtension, cartanClass, classify, identify, identifyAffine, relabellings,
  smallestNonfiniteSubboard, spectralRadius, symmetrizer, gram } from '../../src/index';
import { comarks, level, marks, nullVector, twistedAEven } from '../../src/affine';
import { coroot, formIsInvariant, formValue, isRootPopulation } from '../../src/form';
import { determinant } from '../../src/linalg';
import { mutate, toNumbers } from '../../src/moves';
import { kostantPlay, playFate } from '../../src/play';
import { ratSign, ratToString } from '../../src/rational';
import { roots } from '../../src/search';
import { TYPE_NAMES, boardOf, golden } from '../golden/_harness';
import { seededChoose } from '../helpers/p1';
import { A2_PLUS_TRIANGLE, ONE_WAY, STAR5, TRIANGLE, UNBALANCED_TRIANGLE, boardFromCartan, cycle, star, transposed,
  unitPlusMultiple } from '../helpers/p2';

const big = (C: number[][]) => boardFromCartan(C);
const texts = (r: readonly { num: bigint; den: bigint }[]) => r.map(ratToString);

/** A small deterministic generator for the random boards and starts (mulberry32; floats are allowed in tests). */
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

/** The oracle's cartan_class_by_minors (lines 1042 to 1058), the definition, exponential in n; a test helper only. */
function cartanClassByMinors(C: number[][]): 'finite' | 'affine' | 'indefinite' {
  const n = C.length;
  const full = determinant(C);
  let properOk = true;
  for (let mask = 1; mask < (1 << n) - 1 && properOk; mask++) {
    const K: number[] = [];
    for (let i = 0; i < n; i++) if ((mask >> i) & 1) K.push(i);
    const sub = K.map((i) => K.map((j) => C[i]![j]!));
    if (ratSign(determinant(sub)) <= 0) properOk = false;
  }
  if (properOk && ratSign(full) > 0) return 'finite';
  if (properOk && ratSign(full) === 0) return 'affine';
  return 'indefinite';
}

const TWISTED = golden.twisted_affine as { name: string; marks: number[]; comarks: number[]; symmetrizer: number[] }[];

describe('2.5 and 5.3: symmetrizer, gram, form values', () => {
  it('the d_i of B2, C2, G2, F4 and the twisted boards', () => {
    expect(texts(symmetrizer(boardOf('B2'))!)).toEqual(['2', '1']);
    expect(texts(symmetrizer(boardOf('C2'))!)).toEqual(['1', '2']);
    expect(texts(symmetrizer(boardOf('G2'))!)).toEqual(['1', '3']);
    expect(texts(symmetrizer(boardOf('F4'))!)).toEqual(['2', '2', '1', '1']);
    expect(texts(symmetrizer(boardFromName('A2^(2)'))!)).toEqual(['1', '4']);
    expect(texts(symmetrizer(boardFromName('D4^(3)'))!)).toEqual(['1', '3', '1']);
    expect(symmetrizer(big(UNBALANCED_TRIANGLE))).toBeNull();
    expect(symmetrizer(big([[2, -1, -2], [-2, 2, -1], [-1, -2, 2]]))).toBeNull();
    expect(symmetrizer(big(ONE_WAY))).toBeNull();
    // least value 1 on each component, components scaled independently
    const two = big([[2, -2, 0, 0], [-1, 2, 0, 0], [0, 0, 2, -1], [0, 0, -3, 2]]);
    expect(texts(symmetrizer(two)!)).toEqual(['1', '2', '3', '1']);
    expect(gram(big(ONE_WAY))).toBeNull();
    expect(gram(big(UNBALANCED_TRIANGLE))).toBeNull();
  });

  it('(alpha_i, alpha_i) = 2 d_i: B2 gives 4 and 2, G2 gives 6 on the long node', () => {
    const b2 = boardOf('B2');
    expect(ratToString(formValue(b2, [1, 0])!)).toBe('4');
    expect(ratToString(formValue(b2, [0, 1])!)).toBe('2');
    expect(ratToString(formValue(boardOf('G2'), [0, 1])!)).toBe('6');
    expect(ratToString(formValue(boardOf('G2'), [1, 0])!)).toBe('2');
    expect(ratToString(formValue(b2, [1, 0], [0, 1])!)).toBe('-2');
    expect(formValue(big(ONE_WAY), [1n, 1n])).toBeNull();
    expect(() => formValue(b2, [1])).toThrow(RangeError);
    expect(() => formValue(b2, [1, 0], [1])).toThrow(RangeError);
  });

  it('on a simply laced board (p, p) = 2 sum p_i^2 - 2 sum_edges p_i p_j', () => {
    const r = rng(7);
    for (const T of ['A4', 'D5', 'E6']) {
      const b = boardOf(T);
      const C = cartanNumbers(b);
      for (let trial = 0; trial < 20; trial++) {
        const p: number[] = [];
        for (let i = 0; i < b.n; i++) p.push(Math.floor(r() * 19) - 9);
        let expected = 0;
        for (let i = 0; i < b.n; i++) {
          expected += 2 * p[i]! * p[i]!;
          for (let j = i + 1; j < b.n; j++) if (C[i]![j] !== 0) expected -= 2 * p[i]! * p[j]!;
        }
        expect(ratToString(formValue(b, p)!)).toBe(String(expected));
      }
    }
  });

  it('coroots on B3 (2.5): (0,0,1) and theta = (1,2,2) with coroot (1,2,1), against F11 (2,2,1)', () => {
    const b = boardOf('B3');
    expect(coroot(b, [0, 0, 1])).toEqual([0, 0, 1]);
    expect(coroot(b, [1, 2, 2])).toEqual([1, 2, 1]);
    expect(coroot(b, [1, 0, 0])).toEqual([1, 0, 0]);
    expect(golden.types['B3']!.highest_root_of_reversed_board).toEqual([2, 2, 1]);
    expect(coroot(big(cartan('B3')), [1n, 2n, 2n])).toEqual([1n, 2n, 1n]);
    expect(() => coroot(b, [0, 0, 0])).toThrow(RangeError);
    expect(() => coroot(b, [1, 1])).toThrow(RangeError);
    // the coroots are the root populations of the reversed board (2.5)
    for (const T of ['B3', 'C3', 'G2', 'F4']) {
      const bt = boardOf(T);
      const rev = transposeBoard(bt);
      const revRoots = new Set(roots(rev, CAPS.mainThreadItems).items.map((v) => v.join(',')));
      for (const v of roots(bt, CAPS.mainThreadItems).items) expect(revRoots.has(coroot(bt, v).join(','))).toBe(true);
    }
  });
});

describe('5.4: cartanClass edge cases', () => {
  it('a one-node board is finite; one-way throws NeedsTwoWayRoads; two pieces throw NeedsConnectedBoard', () => {
    expect(cartanClass(boardOf('A1'))).toBe('finite');
    expect(cartanClass(big([[2]]))).toBe('finite');
    expect(() => cartanClass(big(ONE_WAY))).toThrow(NeedsTwoWayRoads);
    expect(() => cartanClass(big(A2_PLUS_TRIANGLE))).toThrow(NeedsConnectedBoard);
    expect(cartanClass(big([[2, -2], [-2, 2]]))).toBe('affine');
    expect(cartanClass(big([[2, -3], [-3, 2]]))).toBe('indefinite');
    expect(cartanClass(big([[2, -3], [-2, 2]]))).toBe('indefinite');
    expect(cartanClass(big(cycle(4)))).toBe('affine');
  });
});

describe('5.5: relabellings', () => {
  it('different sizes give []; D4 has six self-matchings; the star with four arms 24', () => {
    expect(relabellings(boardOf('A2'), boardOf('A3'))).toEqual([]);
    expect(relabellings(boardOf('A2'), boardOf('B2'))).toEqual([]);
    expect(relabellings(boardOf('D4'), boardOf('D4'))).toEqual([
      [0, 1, 2, 3], [0, 1, 3, 2], [2, 1, 0, 3], [2, 1, 3, 0], [3, 1, 0, 2], [3, 1, 2, 0],
    ]);
    const s4 = big(star(4));
    expect(relabellings(s4, s4).length).toBe(24);
    expect(relabellings(boardOf('A3'), boardOf('A3'))).toEqual([[0, 1, 2], [2, 1, 0]]);
    // p[i] = node of b1 playing node i of b2 (trap 2): C1[p[i]][p[j]] = C2[i][j]
    const b1 = boardOf('B3');
    const b2 = big([[2, -2, 0], [-1, 2, -1], [0, -1, 2]]);
    const ps = relabellings(b1, b2);
    expect(ps).toEqual([[2, 1, 0]]);
    const C1 = cartanNumbers(b1);
    const C2 = cartanNumbers(b2);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(C1[ps[0]![i]!]![ps[0]![j]!]).toBe(C2[i]![j]);
    expect(relabellings(b2, b1)).toEqual([[2, 1, 0]]);
  });

  it('works on one-way boards (roads in either direction join)', () => {
    const b = big(ONE_WAY);
    expect(relabellings(b, b)).toEqual([[0, 1]]);
    // the reversed road is the same one-way board with its nodes exchanged
    expect(relabellings(b, transposeBoard(b))).toEqual([[1, 0]]);
    expect(relabellings(b, big([[2, 0], [-2, 2]]))).toEqual([]);
    const c = big([[2, 0, -1], [-1, 2, 0], [0, 0, 2]]);
    expect(relabellings(c, c)).toEqual([[0, 1, 2]]);
  });

  it('the limit: the first `limit` found in search order, sorted; a bad limit is a RangeError', () => {
    const s4 = big(star(4));
    const all = relabellings(s4, s4);
    const some = relabellings(s4, s4, 5);
    expect(some.length).toBe(5);
    for (let k = 1; k < some.length; k++) expect(some[k - 1]!.join(',') < some[k]!.join(',')).toBe(true);
    const allKeys = new Set(all.map((p) => p.join(',')));
    for (const p of some) expect(allKeys.has(p.join(','))).toBe(true);
    // the search order places the centre first, then the arms in increasing position: the first five are
    expect(some).toEqual([[0, 1, 2, 3, 4], [0, 1, 2, 4, 3], [0, 1, 3, 2, 4], [0, 1, 3, 4, 2], [0, 1, 4, 2, 3]]);
    expect(relabellings(s4, s4, 24)).toEqual(all);
    expect(relabellings(s4, s4, 1000)).toEqual(all);
    expect(() => relabellings(s4, s4, 0)).toThrow(RangeError);
    expect(() => relabellings(s4, s4, 1.5)).toThrow(RangeError);
    expect(CAPS.relabellingsDefault).toBe(10000);
  });
});

describe('5.6: identify names B2 for C2; identifyAffine names C2~ for B2~ and C2~', () => {
  it('identify', () => {
    expect(identify(boardOf('C2'))).toEqual({ name: 'B2', order: [1, 0] });
    expect(identify(boardOf('B2'))).toEqual({ name: 'B2', order: [0, 1] });
    expect(identify(boardOf('D4'))).toEqual({ name: 'D4', order: [0, 1, 2, 3] });
    expect(identify(boardOf('G2'))).toEqual({ name: 'G2', order: [0, 1] });
    expect(identify(big(ONE_WAY))).toBeNull();
    expect(() => identify(big(A2_PLUS_TRIANGLE))).toThrow(NeedsConnectedBoard);
    expect(identify(big(TRIANGLE))).toBeNull();
    expect(identify(big(STAR5))).toBeNull();
    for (const T of TYPE_NAMES) {
      const expected = T === 'C2' ? 'B2' : T;
      expect(identify(boardOf(T))!.name).toBe(expected);
      expect(classify(boardOf(T))[0]!.name).toBe(expected);
    }
  });

  it('identifyAffine', () => {
    expect(identifyAffine(boardFromName('square'))).toBe('A3~');
    expect(identifyAffine(boardFromName('pentagon'))).toBe('A4~');
    expect(identifyAffine(boardFromName('B2~'))).toBe('C2~');
    expect(identifyAffine(boardFromName('C2~'))).toBe('C2~');
    expect(classify(boardFromName('B2~'))[0]!.name).toBe('C2~');
    expect(identifyAffine(big(ONE_WAY))).toBeNull();
    expect(() => identifyAffine(big(A2_PLUS_TRIANGLE))).toThrow(NeedsConnectedBoard);
    expect(identifyAffine(boardOf('A3'))).toBeNull();
    expect(identifyAffine(big(STAR5))).toBeNull();
    expect(identifyAffine(big(star(4)))).toBe('D4~');
  });

  it('affineCandidates: Kac names, B2~ skipped, twistedAEven, the transposes', () => {
    expect(affineCandidates(3).map((c) => c.name)).toEqual(['A2~', 'C2~', 'G2~', 'A4^(2)', 'D3^(2)', 'D4^(3)']);
    expect(affineCandidates(2).map((c) => c.name)).toEqual(['A1~', 'A2^(2)']);
    expect(twistedAEven(1)).toEqual([[2, -4], [-1, 2]]);
    expect(twistedAEven(2)).toEqual([[2, -2, 0], [-1, 2, -2], [0, -1, 2]]);
    expect(twistedAEven(3)).toEqual([[2, -2, 0, 0], [-1, 2, -1, 0], [0, -1, 2, -2], [0, 0, -1, 2]]);
    expect(() => twistedAEven(0)).toThrow(RangeError);
    const d43 = affineCandidates(3).find((c) => c.name === 'D4^(3)')!;
    expect(d43.cartan).toEqual(transposed(cartanNumbers(affineExtension(boardOf('G2')).board)));
    expect(d43.cartan).toEqual([[2, 0, -1], [0, 2, -1], [-1, -3, 2]]);
    for (const c of affineCandidates(5)) expect(c.name).not.toMatch(/\^\(1\)/);
    expect(() => affineCandidates(2.5)).toThrow(RangeError);
  });
});

describe('5.7: affineExtension values and the Kostant recipe of A.4', () => {
  it('G2, B3 short, D5 short', () => {
    const g2 = affineExtension(boardOf('G2'));
    expect(cartanNumbers(g2.board)).toEqual([[2, 0, -1], [0, 2, -3], [-1, -1, 2]]);
    expect(g2.marks).toEqual([1, 3, 2]);
    expect(g2.comarks).toEqual([1, 1, 2]);
    expect(g2.board.name).toBe('G2~');
    expect(g2.board.arith).toBe(Big);
    expect(Object.isFrozen(g2.board)).toBe(true);
    expect(Object.isFrozen(g2.board.cartan)).toBe(true);
    const b3s = affineExtension(boardOf('B3'), true);
    expect(cartanNumbers(b3s.board)).toEqual([[2, -2, 0, 0], [-1, 2, -1, 0], [0, -1, 2, -1], [0, 0, -2, 2]]);
    expect(b3s.marks).toEqual([1, 1, 1, 1]);
    expect(b3s.comarks).toEqual([1, 2, 2, 1]);
    expect(identifyAffine(b3s.board)).toBe('D4^(2)');
    expect(b3s.board.name).toBeUndefined();
    const d5 = affineExtension(boardOf('D5'));
    const d5s = affineExtension(boardOf('D5'), true);
    expect(cartanNumbers(d5s.board)).toEqual(cartanNumbers(d5.board));
    expect(d5s.marks).toEqual(d5.marks);
    expect(d5s.comarks).toEqual(d5.comarks);
    // marks and comarks are the null vectors of the result and of its transpose
    for (const T of TYPE_NAMES) {
      const ext = affineExtension(boardOf(T));
      const C = cartanNumbers(ext.board);
      expect(nullVector(C)).toEqual(ext.marks);
      expect(nullVector(transposed(C))).toEqual(ext.comarks);
      expect(marks(ext.board)).toEqual(ext.marks);
      expect(comarks(ext.board)).toEqual(ext.comarks);
    }
    expect(() => affineExtension(boardOf('A2'), 1 as unknown as boolean)).toThrow(RangeError);
  });

  it('A.4: where Kostant\'s game ends on the boards with two root lengths, and the affine board built', () => {
    const rows: [string, number, number[], string][] = [
      ['B2', 0, [1, 2], 'C2~'], ['B2', 1, [1, 1], 'D3^(2)'],
      ['B3', 0, [1, 2, 2], 'B3~'], ['B3', 2, [1, 1, 1], 'D4^(2)'],
      ['C3', 2, [2, 2, 1], 'C3~'], ['C3', 0, [1, 2, 1], 'A5^(2)'],
      ['F4', 0, [2, 3, 4, 2], 'F4~'], ['F4', 3, [1, 2, 3, 2], 'E6^(2)'],
      ['G2', 1, [3, 2], 'G2~'], ['G2', 0, [2, 1], 'D4^(3)'],
    ];
    for (const [T, start, end, name] of rows) {
      const b = boardOf(T);
      const k = kostantPlay(b, start);
      expect(k.status).toBe('ended');
      expect(k.position).toEqual(end);
      const C = cartanNumbers(b);
      const a = toNumbers(b, end);
      const ev = coroot(b, end);
      const back = C[0]!.map((_, j) => ev.reduce((s, x, t) => s + x * C[t]![j]!, 0));
      const Cx = [[2, ...back.map((x) => -x)], ...C.map((row, j) => [-a[j]!, ...row])];
      expect(identifyAffine(big(Cx))).toBe(name);
      expect(golden.kostant as Record<string, { affine_board_from_node: string[] }>).toHaveProperty(T);
      expect((golden.kostant as Record<string, { affine_board_from_node: string[] }>)[T]!.affine_board_from_node[start]).toBe(name);
    }
    // the simply laced cases of A.4
    expect(kostantPlay(boardOf('A3'), 0).position).toEqual([1, 1, 1]);
    expect(kostantPlay(boardOf('D4'), 0).position).toEqual([1, 2, 1, 1]);
    expect(toNumbers(boardOf('D4'), [1, 2, 1, 1])).toEqual([0, 1, 0, 0]);
  });
});

describe('5.8: nullVector, marks, comarks, level', () => {
  it('the tables of 2.12 (untwisted, node 0 first)', () => {
    const table: [string, number[], number[]][] = [
      ['A1~', [1, 1], [1, 1]],
      ['A4~', [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
      ['B3~', [1, 1, 2, 2], [1, 1, 2, 1]],
      ['C3~', [1, 2, 2, 1], [1, 1, 1, 1]],
      ['D4~', [1, 1, 2, 1, 1], [1, 1, 2, 1, 1]],
      ['E6~', [1, 1, 2, 2, 3, 2, 1], [1, 1, 2, 2, 3, 2, 1]],
      ['E7~', [1, 2, 2, 3, 4, 3, 2, 1], [1, 2, 2, 3, 4, 3, 2, 1]],
      ['E8~', [1, 2, 3, 4, 6, 5, 4, 3, 2], [1, 2, 3, 4, 6, 5, 4, 3, 2]],
      ['F4~', [1, 2, 3, 4, 2], [1, 2, 3, 2, 1]],
      ['G2~', [1, 3, 2], [1, 1, 2]],
    ];
    for (const [name, mk, cmk] of table) {
      const b = boardFromName(name);
      expect(marks(b)).toEqual(mk);
      expect(comarks(b)).toEqual(cmk);
    }
  });

  it('the twisted table of 2.12, and reversing all roads exchanges marks and comarks', () => {
    const twisted: [string, number[], number[]][] = [
      ['A2^(2)', [2, 1], [1, 2]], ['A4^(2)', [2, 2, 1], [1, 2, 2]], ['A6^(2)', [2, 2, 2, 1], [1, 2, 2, 2]],
      ['D3^(2)', [1, 1, 1], [1, 2, 1]], ['D4^(2)', [1, 1, 1, 1], [1, 2, 2, 1]], ['D5^(2)', [1, 1, 1, 1, 1], [1, 2, 2, 2, 1]],
      ['A5^(2)', [1, 1, 2, 1], [1, 1, 2, 2]], ['A7^(2)', [1, 1, 2, 2, 1], [1, 1, 2, 2, 2]],
      ['E6^(2)', [1, 2, 3, 2, 1], [1, 2, 3, 4, 2]], ['D4^(3)', [1, 1, 2], [1, 3, 2]],
    ];
    for (const [name, mk, cmk] of twisted) {
      const b = boardFromName(name);
      expect(marks(b)).toEqual(mk);
      expect(comarks(b)).toEqual(cmk);
    }
    const all = [...TYPE_NAMES.map((T) => `${T}~`), ...TWISTED.map((r) => r.name)];
    for (const name of all) {
      const b = boardFromName(name);
      const rev = transposeBoard(b);
      expect(marks(rev)).toEqual(comarks(b));
      expect(comarks(rev)).toEqual(marks(b));
      expect(marks(b).every((x) => x > 0) && comarks(b).every((x) => x > 0)).toBe(true);
      const simplyLaced = cartanNumbers(b).every((row, i) => row.every((x, j) => x === cartanNumbers(b)[j]![i]));
      expect(marks(b).join(',') === comarks(b).join(',')).toBe(simplyLaced);
    }
  });

  it('nullVector on singular and non-singular matrices', () => {
    expect(nullVector(cartan('A3'))).toBeNull();
    expect(nullVector(cartan('E8'))).toBeNull();
    expect(nullVector(cartanNumbers(boardFromName('pentagon')))).toEqual([1, 1, 1, 1, 1]);
    expect(nullVector([[2n, -2n], [-2n, 2n]])).toEqual([1, 1]);
    expect(nullVector([[0, 0], [0, 0]])).toBeNull(); // corank 2
    expect(nullVector([[1, 1], [1, 1]])).toBeNull(); // the null vector (1, -1) has mixed signs
    expect(nullVector([[2, -2, 0, 0], [-2, 2, 0, 0], [0, 0, 2, -2], [0, 0, -2, 2]])).toBeNull(); // two affine pieces
    expect(() => nullVector([[1, 2, 3], [4, 5, 6]])).toThrow(RangeError);
  });

  it('level: the pentagon start (1, -2, 3, -4, 1) has level -1; the SafeInt and Big arithmetics agree', () => {
    const p = boardFromName('pentagon');
    expect(level(p, [1n, -2n, 3n, -4n, 1n])).toBe(-1n);
    const g2 = affineExtension(boardOf('G2')).board;
    expect(level(g2, [1n, 1n, 1n])).toBe(4n);
    const sb: Board<number> = { n: 3, cartan: cartanNumbers(g2), labels: [0, 1, 2], kind: 'gcm', arith: SafeInt };
    expect(level(sb, [1, 1, 1])).toBe(4);
    expect(() => level(p, [1n, 1n])).toThrow(RangeError);
  });

  it('the level of every root population, read through a = Cp, is zero (2.12), on every affine board', () => {
    const all = [...TYPE_NAMES.map((T) => `${T}~`), ...TWISTED.map((r) => r.name)];
    for (const name of all) {
      const b = boardFromName(name) as Board<bigint>; // every affine board is a Big board (E-2)
      const r = roots(b, 400, 4);
      expect(r.items.length).toBeGreaterThan(b.n);
      for (const v of r.items) expect(level(b, toNumbers(b, v))).toBe(0n);
    }
  });
});

describe('5.9: spectral radius and smallest non-finite sub-boards', () => {
  it('2cos(pi/(n+1)) on paths, 2 on affine boards, 3 on three roads each way, > 2 on E10', () => {
    for (const n of [2, 5, 12]) {
      const b = n === 12 ? big(cartan('A12')) : boardOf(`A${n}`);
      expect(Math.abs(spectralRadius(b)! - 2 * Math.cos(Math.PI / (n + 1)))).toBeLessThan(1e-9);
    }
    for (const T of TYPE_NAMES) {
      expect(spectralRadius(boardOf(T))!).toBeLessThan(2 - 1e-9);
      expect(Math.abs(spectralRadius(boardFromName(`${T}~`))! - 2)).toBeLessThan(1e-6);
    }
    for (const r of TWISTED) expect(Math.abs(spectralRadius(boardFromName(r.name))! - 2)).toBeLessThan(1e-6);
    expect(Math.abs(spectralRadius(big([[2, -3], [-3, 2]]))! - 3)).toBeLessThan(1e-9);
    expect(spectralRadius(big(ONE_WAY))).toBeNull();
    expect(spectralRadius(big([[2]]))).toBe(0);
  });

  it('smallestNonfiniteSubboard values', () => {
    expect(smallestNonfiniteSubboard(big(STAR5))).toEqual({ nodes: [0, 1, 2, 3, 4], class: 'affine' });
    expect(smallestNonfiniteSubboard(boardFromName('D4~'))).toEqual({ nodes: [0, 1, 2, 3, 4], class: 'affine' });
    expect(smallestNonfiniteSubboard(big(A2_PLUS_TRIANGLE))).toEqual({ nodes: [2, 3, 4], class: 'affine' });
    expect(smallestNonfiniteSubboard(boardOf('E8'))).toBeNull();
    expect(smallestNonfiniteSubboard(big(ONE_WAY))).toBeNull();
    expect(smallestNonfiniteSubboard(big([[2, -3], [-3, 2]]))).toEqual({ nodes: [0, 1], class: 'indefinite' });
    // lexicographic within a size: the hyperbolic pair (1, 3) comes before the affine pair (2, 3)
    expect(smallestNonfiniteSubboard(big([[2, -1, -3], [-1, 2, -2], [-3, -2, 2]]))).toEqual({ nodes: [0, 2], class: 'indefinite' });
  });
});

describe('5.10: formIsInvariant', () => {
  it('values on B2 and the unbalanced triangle; T3 passes exactly for twice the Gram matrix up to scale', () => {
    const b2 = boardOf('B2');
    expect(formIsInvariant(b2, [[4, -2], [-2, 2]])).toEqual({ invariant: true });
    expect(formIsInvariant(b2, [[8, -4], [-4, 4]])).toEqual({ invariant: true });
    expect(formIsInvariant(b2, [[2, -1], [-1, 2]])).toEqual({ invariant: false, witness: { node: 1, population: [1, 0] } });
    const u = big(UNBALANCED_TRIANGLE);
    expect(formIsInvariant(u, [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]])).toEqual({ invariant: false, witness: { node: 1, population: [1, 0, 0] } });
    expect(() => formIsInvariant(b2, [[2, -1], [0, 2]])).toThrow(RangeError);
    expect(() => formIsInvariant(b2, [[2, -1]])).toThrow(RangeError);
    expect(() => formIsInvariant(b2, [[2, -1, 0], [-1, 2, 0], [0, 0, 2]])).toThrow(RangeError);
    expect(() => formIsInvariant(b2, [[2, 0.5], [0.5, 2]])).toThrow(RangeError);
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const d = symmetrizer(b)!;
      const scale = d.reduce((s, x) => s * x.den, 1n);
      const W = cartanNumbers(b).map((row, i) => row.map((x) => Number((2n * d[i]!.num * scale) / d[i]!.den) * x));
      expect(formIsInvariant(b, W)).toEqual({ invariant: true });
      if (b.n >= 2) {
        const bad = W.map((row) => [...row]);
        bad[0]![0] = bad[0]![0]! + 1;
        const r = formIsInvariant(b, bad);
        expect(r.invariant).toBe(false);
        expect(r.witness).toBeDefined();
      }
    }
  });
});

describe('5.11: isRootPopulation values and the cap boundary', () => {
  it('values on the triangle and on A2^(2)', () => {
    const t = big(TRIANGLE);
    expect(isRootPopulation(t, [-1n, 0n, 0n])).toBe(true);
    expect(isRootPopulation(t, [0n, 0n, 0n])).toBe(false);
    expect(isRootPopulation(t, [1n, -1n, 0n])).toBe(false);
    expect(isRootPopulation(t, [1n, 1n, 1n])).toBe(false);
    expect(isRootPopulation(t, [2n, 1n, 1n])).toBe(true);
    expect(isRootPopulation(t, [-2n, -1n, -1n])).toBe(true);
    const a22 = boardFromName('A2^(2)');
    expect(isRootPopulation(a22, [3n, 1n])).toBe(true);
    expect(isRootPopulation(a22, [2n, 2n])).toBe(false);
    expect(isRootPopulation(a22, [4n, 3n])).toBe(true);
    expect(isRootPopulation(boardOf('A2'), [1, 1])).toBe(true);
    expect(isRootPopulation(boardOf('A2'), [2, 1])).toBe(false);
    expect(() => isRootPopulation(boardOf('A2'), [1])).toThrow(RangeError);
    expect(() => isRootPopulation(boardOf('A2'), [1, 1], -1)).toThrow(RangeError);
    expect(() => isRootPopulation(boardOf('A2'), [1, 1], 2.5)).toThrow(RangeError);
    expect(() => isRootPopulation(big(ONE_WAY), [1n, 1n])).toThrow(NeedsTwoWayRoads);
  });

  it('root test steps: e_1 + k delta on the triangle takes 2k steps (true at cap 2k, null at cap 2k - 1)', () => {
    const t = big(TRIANGLE);
    for (let k = 1; k <= 4; k++) {
      const v = unitPlusMultiple(3, 0, k, [1, 1, 1]).map((x) => BigInt(x));
      expect(isRootPopulation(t, v, 2 * k)).toBe(true);
      expect(isRootPopulation(t, v, 2 * k - 1)).toBeNull();
      expect(isRootPopulation(t, v)).toBe(true);
    }
    expect(CAPS.rootTestSteps).toBe(20000);
    // a single Martian needs no step: true even at cap 0
    expect(isRootPopulation(t, [0n, 1n, 0n], 0)).toBe(true);
    expect(isRootPopulation(t, [2n, 1n, 1n], 0)).toBeNull();
  });
});

describe('5.12: boardFromName additions', () => {
  it('pentagon and square', () => {
    const p = boardFromName('pentagon');
    expect(cartanNumbers(p)).toEqual(cycle(5));
    expect([...p.labels]).toEqual([1, 2, 3, 4, 5]);
    expect(p.arith).toBe(Big);
    expect(p.kind).toBe('gcm');
    expect(p.name).toBe('pentagon');
    const s = boardFromName('square');
    expect(cartanNumbers(s)).toEqual(cycle(4));
    expect([...s.labels]).toEqual([1, 2, 3, 4]);
    expect(s.name).toBe('square');
    expect(Object.isFrozen(s) && Object.isFrozen(s.cartan) && Object.isFrozen(s.labels)).toBe(true);
  });

  it('X~ for every finite name, B2~ and C2~, the name as given', () => {
    const b2 = boardFromName('B2~');
    expect(cartanNumbers(b2)).toEqual([[2, 0, -1], [0, 2, -1], [-2, -2, 2]]);
    expect(b2.name).toBe('B2~');
    const c2 = boardFromName('C2~');
    expect(cartanNumbers(c2)).toEqual([[2, -1, 0], [-2, 2, -2], [0, -1, 2]]);
    expect(c2.name).toBe('C2~');
    for (const T of TYPE_NAMES) {
      const b = boardFromName(`${T}~`);
      expect(b.n).toBe(boardOf(T).n + 1);
      expect([...b.labels]).toEqual(b.labels.map((_, k) => k));
      expect(b.arith).toBe(Big);
      expect(b.kind).toBe('gcm');
      expect(b.name).toBe(`${T}~`);
      expect(cartanNumbers(b)).toEqual(cartanNumbers(affineExtension(boardOf(T)).board));
    }
    // no cap on the node count in the engine (5.6): A20~ has 21 nodes
    expect(boardFromName('A20~').n).toBe(21);
    expect(classify(boardFromName('A20~'))[0]!.name).toBe('A20~');
  });

  it('twisted names up to 13 nodes; unknown names throw NotABoard', () => {
    expect(boardFromName('A2^(2)').n).toBe(2);
    expect([...boardFromName('A4^(2)').labels]).toEqual([0, 1, 2]);
    expect(boardFromName('D13^(2)').n).toBe(13);
    expect(boardFromName('A24^(2)').n).toBe(13);
    expect(boardFromName('A23^(2)').n).toBe(13);
    for (const name of ['D14^(2)', 'A25^(2)', 'A3^(2)', 'B2^(2)', 'E7^(2)', 'D5^(3)', 'H3', 'A0~', 'B1~', 'pentagon~', 'A2^(1)', 'triangle', '', 'a2~']) {
      expect(() => boardFromName(name)).toThrow(NotABoard);
    }
    // the phase-0 finite branch is unchanged
    const b3 = boardFromName('B3');
    expect(b3.arith).toBe(SafeInt);
    expect([...b3.labels]).toEqual([1, 2, 3]);
    expect(cartanNumbers(b3)).toEqual(cartan('B3'));
  });
});

describe('5.14: playFate fates', () => {
  it('values: the triangle loops after 6 moves with firstVisit 2; the zero position ends; the A2 cap rule', () => {
    const t = big(TRIANGLE);
    const r = playFate(t, toNumbers(t, [1n, 0n, 0n]));
    expect(r.status).toBe('looped');
    expect(r.moves).toBe(6);
    expect(r.firstVisit).toBe(2);
    expect(r.word).toEqual([0, 1, 2, 0, 1, 0]);
    expect(r.fired).toEqual([2n, 1n, 2n, 1n, 2n, 1n]);
    expect(r.position).toEqual([-1n, -1n, 2n]);
    const z = playFate(t, [0n, 0n, 0n]);
    expect(z).toEqual({ status: 'ended', moves: 0, word: [], fired: [], position: [0n, 0n, 0n] });
    const a2 = boardOf('A2');
    const c3 = playFate(a2, [1, 1], undefined, 3);
    expect(c3.status).toBe('cap');
    expect(c3.moves).toBe(3);
    expect(c3.position).toEqual([-1, -1]);
    expect(c3).not.toHaveProperty('firstVisit');
    const c4 = playFate(a2, [1, 1], undefined, 4);
    expect(c4.status).toBe('ended');
    expect(c4.moves).toBe(3);
    expect(() => playFate(a2, [1, 1], undefined, 0)).toThrow(RangeError);
    expect(() => playFate(a2, [1, 1], undefined, 2.5)).toThrow(RangeError);
    expect(() => playFate(a2, [1], undefined, 5)).toThrow(RangeError);
    expect(() => playFate(a2, [1, 1], () => 5)).toThrow(RangeError);
    expect(() => playFate(a2, [1, 1], (allowed) => allowed[allowed.length - 1]!)).not.toThrow();
    expect(playFate(a2, [1, 1], (allowed) => allowed[allowed.length - 1]!).word).toEqual([1, 0, 1]);
    expect(CAPS.playMoves).toBe(20000);
    // a repeat on the cap-th move is 'looped' (the loop test comes first)
    const r6 = playFate(t, toNumbers(t, [1n, 0n, 0n]), undefined, 6);
    expect(r6.status).toBe('looped');
    // works on a one-way board
    expect(['ended', 'looped', 'cap']).toContain(playFate(big(ONE_WAY), [1n, 1n]).status);
  });

  it("'ended' on every finite type from random starts; 'looped' from the numbers of a root population; 'cap' at positive level", () => {
    const r = rng(2026);
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      for (let trial = 0; trial < 3; trial++) {
        const a: number[] = [];
        for (let i = 0; i < b.n; i++) a.push(Math.floor(r() * 11) - 5);
        const f = playFate(b, a);
        expect(f.status).toBe('ended');
        expect(f.position.every((x) => x <= 0)).toBe(true);
        const g = playFate(b, a, seededChoose(trial + 1));
        expect(g.status).toBe('ended');
        expect(g.moves).toBe(f.moves);
        expect(g.position).toEqual(f.position);
      }
    }
    const all = [...TYPE_NAMES.map((T) => `${T}~`), ...TWISTED.map((x) => x.name)];
    for (const name of all) {
      const b = boardFromName(name) as Board<bigint>;
      let p: bigint[] = b.labels.map((_, k) => (k === 0 ? 1n : 0n));
      for (let k = 0; k < 12; k++) p = mutate(b, p, Math.floor(r() * b.n));
      const numbers = toNumbers(b, p);
      expect(level(b, numbers)).toBe(0n);
      const looped = playFate(b, numbers, undefined, 3000);
      expect(looped.status).toBe('looped');
      expect(looped.firstVisit).toBeDefined();
      expect(looped.firstVisit!).toBeLessThan(looped.moves);
      const ones = b.labels.map(() => 1n);
      expect(level(b, ones) > 0n).toBe(true);
      const cap = playFate(b, ones, undefined, 400);
      expect(cap.status).toBe('cap');
      expect(cap.moves).toBe(400);
      const negative = b.labels.map((_, k) => (k === 0 ? -3n : 1n));
      if (level(b, negative) < 0n) expect(playFate(b, negative, undefined, 3000).status).toBe('ended');
    }
  });
});

describe('2.12 [V]: cartanClass agrees with the definition by all principal minors', () => {
  it('on the 32 types, every board of affineCandidates(m) for m <= 9, and 400 random connected boards of 2 to 5 nodes', () => {
    for (const T of TYPE_NAMES) {
      expect(cartanClass(boardOf(T))).toBe('finite');
      expect(cartanClassByMinors(cartan(T))).toBe('finite');
    }
    for (let m = 2; m <= 9; m++) {
      for (const c of affineCandidates(m)) {
        if (m > 7) continue; // verify.py skips the exponential check above 7 nodes
        expect(cartanClass(big(c.cartan))).toBe('affine');
        expect(cartanClassByMinors(c.cartan)).toBe('affine');
      }
    }
    // the random boards of verify.py lines 1440 to 1450: the pairs of road counts, both directions
    const PAIRS: [number, number][] = [[0, 0], [0, 0], [1, 1], [1, 1], [1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 2], [1, 4], [4, 1], [2, 3]];
    const r = rng(1986);
    let count = 0;
    const seen = { finite: 0, affine: 0, indefinite: 0 };
    while (count < 400) {
      const n = 2 + Math.floor(r() * 4);
      const M: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let j = 0; j < n; j++) row.push(i === j ? 2 : 0);
        M.push(row);
      }
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
          const [x, y] = PAIRS[Math.floor(r() * PAIRS.length)]!;
          M[i]![j] = -x;
          M[j]![i] = -y;
        }
      }
      const b = big(M);
      if (components(b).length !== 1) continue;
      count += 1;
      const cls = cartanClass(b);
      expect(cls).toBe(cartanClassByMinors(M));
      seen[cls] += 1;
    }
    expect(seen.finite).toBeGreaterThan(0);
    expect(seen.affine).toBeGreaterThan(0);
    expect(seen.indefinite).toBeGreaterThan(0);
  });

  it('the unbalanced triangle is indefinite by both tests, whatever its minors', () => {
    expect(cartanClass(big(UNBALANCED_TRIANGLE))).toBe('indefinite');
    expect(cartanClassByMinors(UNBALANCED_TRIANGLE)).toBe('indefinite');
  });
});

describe('E-5: functions do not change their arguments', () => {
  it('deep-frozen inputs pass through every phase-2 function', () => {
    const freeze = <X>(v: X[]): readonly X[] => Object.freeze(v);
    const b = boardOf('B2');
    const p = freeze([1, 2]);
    const q = freeze([0, 1]);
    const M = [Object.freeze([4, -2]), Object.freeze([-2, 2])] as unknown as number[][];
    Object.freeze(M);
    expect(symmetrizer(b)).not.toBeNull();
    expect(gram(b)).not.toBeNull();
    expect(cartanClass(b)).toBe('finite');
    expect(relabellings(b, b)).toEqual([[0, 1]]);
    expect(identify(b)!.name).toBe('B2');
    expect(identifyAffine(b)).toBeNull();
    expect(classify(b).length).toBe(1);
    expect(smallestNonfiniteSubboard(b)).toBeNull();
    expect(spectralRadius(b)).toBeGreaterThan(0);
    expect(affineExtension(b).marks).toEqual([1, 1, 2]);
    expect(formValue(b, p, q)).not.toBeNull();
    expect(formIsInvariant(b, M)).toEqual({ invariant: true });
    expect(isRootPopulation(b, p)).toBe(true);
    expect(coroot(b, p)).toEqual([1, 1]);
    expect(playFate(b, p).status).toBe('ended');
    const aff = boardFromName('C2~');
    const a = freeze([1n, -2n, 1n]);
    expect(marks(aff)).toEqual([1, 2, 1]);
    expect(comarks(aff)).toEqual([1, 1, 1]);
    expect(level(aff, a)).toBe(0n);
    expect(nullVector(cartanNumbers(aff))).toEqual([1, 2, 1]);
    expect(playFate(aff, a, undefined, 50).status).toBe('looped');
    expect(p).toEqual([1, 2]);
    expect(q).toEqual([0, 1]);
    expect(a).toEqual([1n, -2n, 1n]);
    expect(M).toEqual([[4, -2], [-2, 2]]);
    // the results share no array with the inputs or with each other
    const m1 = marks(aff);
    const m2 = marks(aff);
    expect(m1).not.toBe(m2);
    const c1 = classify(aff);
    expect(c1[0]!.marks).not.toBe(classify(aff)[0]!.marks);
    const sub = subBoard(aff, [1, 2]); // the C2 matrix, recognised as B2 in the reversed order
    expect(classify(sub)[0]!).toEqual({ nodes: [0, 1], kind: 'gcm', balanced: true, class: 'finite', name: 'B2', bourbaki_order: [1, 0] });
    expect(() => affineExtension(aff)).toThrow(NotFiniteType);
  });
});
