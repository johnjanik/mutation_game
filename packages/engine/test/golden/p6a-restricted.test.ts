// restrictedBoard against the 167 records of the golden key `satake` (SPEC.md 2.15 "The restricted game", 4 T13
// acceptance "each composite word acts on shadows as the reflection given by restricted_cartan", 5.4, 6.4, E-7
// row "folded board, restricted board"; P6-A1 instruction 5.7). Records are matched by dynkin_type and
// real_form (rule 5), node lists converted with the harness's labels() and toPositions (rule 2).
// No covers() (plan, P6-A1 instruction section 4): the key `satake` is registered by P6-A2's full-record test;
// this file reads it to check the restricted game and is reported as a deviation from CONTRACTS.md 3.
import { describe, expect, it } from 'vitest';
import { SafeInt } from '../../src/arith';
import type { Board } from '../../src/board';
import { cartanNumbers, components, toPositions } from '../../src/board';
import { gram, identify } from '../../src/classify';
import { longestWord } from '../../src/guards';
import { applyWord } from '../../src/moves';
import type { Rational } from '../../src/rational';
import { rat, ratAdd, ratDiv, ratMul } from '../../src/rational';
import type { SatakeDiagram } from '../../src/satake';
import { restrictedBoard, satake, shadow2, theta } from '../../src/satake';
import { roots } from '../../src/search';
import { boardOf, golden, intEq, labels, matchRecord } from './_harness';

interface SatakeRecord {
  dynkin_type: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  restricted_type_display: string | null;
  real_rank: number;
  w_X_word: number[];
  restricted_simple_orbits: number[][];
  restricted_cartan: number[][];
  restricted_board: string | null;
  restricted_orbits_in_bourbaki_order: number[][] | null;
  restricted_reflection_word_lengths: number[];
}

const RECORDS = golden.satake as SatakeRecord[];

function diagramOf(rec: SatakeRecord): { board: Board; d: SatakeDiagram } {
  const board = boardOf(rec.dynkin_type);
  return { board, d: { board, black: toPositions(board, rec.black_nodes), tau: toPositions(board, rec.tau) } };
}

const key = (v: readonly number[]): string => v.join(',');

/** The form (x, y) under gram, test-side. */
function form(B: Rational[][], x: readonly number[], y: readonly number[]): Rational {
  let s = rat(0);
  for (let i = 0; i < x.length; i++) for (let j = 0; j < y.length; j++) s = ratAdd(s, ratMul(B[i]![j]!, rat(x[i]! * y[j]!)));
  return s;
}

/** The number of positive roots a word sends to negative ones: the length of the element it plays. */
function inversions(board: Board, word: readonly number[]): number {
  const R = roots(board, 100000).items.filter((r) => r.every((x) => x >= 0));
  return R.filter((r) => applyWord(board, r, word, 'mutation').some((x) => x < 0)).length;
}

describe('restricted board', () => {
  it('restricted board agrees with satake', () => {
    expect(RECORDS.length).toBe(167);
    for (const rec of RECORDS) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const rb = restrictedBoard(d);
      const s = satake(d);
      expect(rb.orbits, where).toEqual(s.restricted_simple_orbits);
      expect(rb.cartan, where).toEqual(s.restricted_cartan);
      expect(rb.compositeWords.map((w) => w.length - 2 * s.w_X_word.length), where).toEqual(s.restricted_reflection_word_lengths);
      // and with the record: orbits as labels, the Cartan matrix in orbit order, the reduced lengths
      expect(rb.orbits.map((o) => labels(board, o)), where).toEqual(rec.restricted_simple_orbits);
      intEq(rb.cartan, rec.restricted_cartan, where);
      intEq(rb.compositeWords.map((w) => w.length - 2 * s.w_X_word.length), rec.restricted_reflection_word_lengths, where);
      expect(rb.simpleRestrictedRoots2.length, where).toBe(rb.orbits.length);
    }
  });

  it('each composite word is w_X followed by the longest word of X u O, of reduced length l(w_{X u O}) - l(w_X)', () => {
    for (const rec of RECORDS) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const rb = restrictedBoard(d);
      const X = [...d.black].sort((a, b) => a - b);
      const wx = longestWord(board, X);
      rb.orbits.forEach((o, k) => {
        const wxo = longestWord(board, [...X, ...o]);
        expect(rb.compositeWords[k], where).toEqual([...wx, ...wxo]);
        // the reduced length is the number of positive roots the composite move sends to negative ones
        expect(inversions(board, rb.compositeWords[k]!), where).toBe(wxo.length - wx.length);
        // the doubled simple restricted root is the shadow of the orbit's least node
        expect(rb.simpleRestrictedRoots2[k], where).toEqual(shadow2(d, board.labels.map((_, i) => (i === o[0] ? 1 : 0))));
      });
    }
  });

  it('composite words reflect the shadows', () => {
    let checked = 0;
    for (const rec of RECORDS) {
      if (rec.real_rank === 0) continue;
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const rb = restrictedBoard(d);
      const B = gram(board)!;
      const R = roots(board, 100000).items;
      const shadowOf = new Map(R.map((a) => [key(a), shadow2(d, a)] as const));
      rb.simpleRestrictedRoots2.forEach((sk, k) => {
        const skk = form(B, sk, sk);
        for (const a of R) {
          const v = shadowOf.get(key(a))!;
          const image = applyWord(board, a, rb.compositeWords[k]!, 'mutation');
          const got = shadowOf.get(key(image));
          expect(got, `${where}: the image of a root is a root`).toBeDefined();
          const c = ratDiv(ratMul(rat(2), form(B, v, sk)), skk);
          expect(c.den, where).toBe(1n);
          const want = v.map((x, i) => x - Number(c.num) * sk[i]!);
          if (key(got!) !== key(want)) expect(got, `${where}: orbit ${k}, root ${key(a)}`).toEqual(want);
          checked += 1;
        }
        // in particular the simple restricted root goes to its negative, with c = 2
        const negated = R.filter((a) => key(shadowOf.get(key(a))!) === key(sk)).map((a) => shadowOf.get(key(applyWord(board, a, rb.compositeWords[k]!, 'mutation')))!);
        for (const s of negated) expect(s, where).toEqual(sk.map((x) => (x === 0 ? 0 : -x)));
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('composite words commute with theta', () => {
    for (const rec of RECORDS) {
      if (rec.real_rank === 0) continue;
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const rb = restrictedBoard(d);
      const R = roots(board, 100000).items;
      const thetaOf = new Map(R.map((a) => [key(a), theta(d, a)] as const));
      for (const w of rb.compositeWords) {
        for (const a of R) {
          const left = thetaOf.get(key(applyWord(board, a, w, 'mutation')))!;
          const right = applyWord(board, thetaOf.get(key(a))!, w, 'mutation');
          if (key(left) !== key(right)) expect(left, `${where}: root ${key(a)}`).toEqual(right);
        }
      }
    }
  });

  it('restricted board labels in Bourbaki order', () => {
    for (const rec of RECORDS) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const rb = restrictedBoard(d);
      const m = rb.orbits.length;
      expect(rb.board.n, where).toBe(m);
      expect(rb.board.kind, where).toBe('gcm');
      expect(rb.board.arith, where).toBe(SafeInt);
      expect(Object.isFrozen(rb.board), where).toBe(true);
      intEq(cartanNumbers(rb.board), rec.restricted_cartan, where);
      // labels: a permutation of 1..m
      expect([...rb.board.labels].sort((a, b) => a - b), where).toEqual(Array.from({ length: m }, (_, k) => k + 1));
      if (rec.restricted_board === null) {
        // compact form: no orbit, no name
        expect(m, where).toBe(0);
        expect(rb.board.name, where).toBeUndefined();
        expect(rec.restricted_orbits_in_bourbaki_order, where).toBeNull();
        continue;
      }
      expect(components(rb.board).length, where).toBe(1);
      const id = identify(rb.board)!;
      for (let k = 0; k < m; k++) expect(rb.board.labels[id.order[k]!], where).toBe(k + 1);
      const byLabel = [...rb.orbits.keys()].sort((a, b) => rb.board.labels[a]! - rb.board.labels[b]!).map((k) => labels(board, rb.orbits[k]!));
      if (rec.restricted_type_display === 'C2') {
        // SPEC.md 6.4 "Names in rank 2": satakeRecord renames the board C2 and lists its two orbits reversed
        // (short node first); restrictedBoard, like satake, names it B2 in identify's order
        expect(rec.restricted_board, where).toBe('C2');
        expect(rb.board.name, where).toBe('B2');
        expect(byLabel, where).toEqual([...rec.restricted_orbits_in_bourbaki_order!].reverse());
      } else {
        expect(rb.board.name, where).toBe(rec.restricted_board);
        expect(byLabel, where).toEqual(rec.restricted_orbits_in_bourbaki_order);
      }
    }
  });

  it('e6(-14): orbit order and Bourbaki order differ', () => {
    const rec = matchRecord(RECORDS, { dynkin_type: 'E6', real_form: 'e6(-14)' });
    const { board, d } = diagramOf(rec);
    const rb = restrictedBoard(d);
    expect(rb.orbits.map((o) => labels(board, o))).toEqual([[1, 6], [2]]);
    // the denominator of each row is that row's norm: [[2, -2], [-1, 2]], not its transpose
    expect(rb.cartan).toEqual([[2, -2], [-1, 2]]);
    expect(rb.board.name).toBe('B2');
    expect([...rb.board.labels]).toEqual([2, 1]);
    const byLabel = [0, 1].sort((a, b) => rb.board.labels[a]! - rb.board.labels[b]!).map((k) => labels(board, rb.orbits[k]!));
    expect(byLabel).toEqual([[2], [1, 6]]);
    expect(satake(d).restricted_orbits_in_bourbaki_order!.map((o) => labels(board, o))).toEqual([[2], [1, 6]]);
  });

  it('a compact form has the empty restricted board', () => {
    const rec = matchRecord(RECORDS, { dynkin_type: 'A3', real_form: 'su(4)' });
    const { d } = diagramOf(rec);
    const rb = restrictedBoard(d);
    expect(rb.orbits).toEqual([]);
    expect(rb.simpleRestrictedRoots2).toEqual([]);
    expect(rb.cartan).toEqual([]);
    expect(rb.compositeWords).toEqual([]);
    expect(rb.board.n).toBe(0);
    expect(rb.board.labels).toEqual([]);
    expect(rb.board.name).toBeUndefined();
  });
});
