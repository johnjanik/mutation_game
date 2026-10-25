// The Satake functions of phase 6 (P6-A1) off the finite boards and with malformed diagrams (SPEC.md 5.6
// second table, last row: "the Wythoff, Satake, representation and geometry functions | throw
// NeedsTwoWayRoads | throw NotFiniteType"; E-5, E-10, E-11; P6-A1 instruction 5.2), on a board in pieces (MERGE
// ruling (1) on P6-A1: NeedsConnectedBoard from satake when the restricted root system is in several pieces),
// with the black set in any order, and with a population that has a hole (repair after review). No covers(): no golden
// key stores these cases; the phase-6 keys are covered in p6a-admissible-pairs.test.ts,
// p6a-satake-examples.test.ts and by P6-A2's full-record test. classifyRestricted takes a set of vectors,
// not a board, and has no guard (P4-A1's reading of 5.6).
import { describe, expect, it } from 'vitest';
import type { AnyBoard, Board } from '../../src/board';
import { boardFromName, components, fromAdjacency } from '../../src/board';
import { EngineError, NeedsConnectedBoard, NeedsTwoWayRoads, NotFiniteType } from '../../src/errors';
import type { SatakeDiagram } from '../../src/satake';
import { admissibility, restrictedBoard, satake, shadow2, theta } from '../../src/satake';
import { boardOf } from './_harness';

function caught(f: () => unknown): unknown {
  try {
    f();
  } catch (e) {
    return e;
  }
  return null;
}

/** A well-formed diagram on any board: no black node, tau the identity. */
function plain(b: AnyBoard): SatakeDiagram {
  // the diagram type names Board<number>; the guard cases hand it a Board<bigint> on purpose
  return { board: b as unknown as Board, black: [], tau: b.labels.map((_, i) => i) };
}

/** e_0 of the right length, as plain numbers. */
function e0(b: AnyBoard): number[] {
  return b.labels.map((_, i) => (i === 0 ? 1 : 0));
}

/** The five functions of P6-A1, each called with arguments of the right shape for the board. */
const GUARDED: [string, (b: AnyBoard) => unknown][] = [
  ['theta', (b) => theta(plain(b), e0(b))],
  ['shadow2', (b) => shadow2(plain(b), e0(b))],
  ['admissibility', (b) => admissibility(plain(b))],
  ['satake', (b) => satake(plain(b))],
  ['restrictedBoard', (b) => restrictedBoard(plain(b))],
];

describe('one-way board', () => {
  const oneWay = (): AnyBoard => fromAdjacency([[0, 1], [0, 0]]);
  it('is a one-way board', () => {
    expect(oneWay().kind).toBe('one-way');
  });
  for (const [name, f] of GUARDED) {
    it(`${name} throws NeedsTwoWayRoads, an EngineError`, () => {
      const e = caught(() => f(oneWay()));
      expect(e).toBeInstanceOf(NeedsTwoWayRoads);
      expect(e).toBeInstanceOf(EngineError);
    });
  }
  it('a one-way board of three nodes too', () => {
    const b = fromAdjacency([[0, 1, 0], [0, 0, 1], [0, 0, 0]]);
    for (const [, f] of GUARDED) expect(caught(() => f(b))).toBeInstanceOf(NeedsTwoWayRoads);
  });
});

describe('affine board', () => {
  for (const name of ['A2~', 'C2~', 'G2~']) {
    for (const [fn, f] of GUARDED) {
      it(`${fn} on ${name} throws NotFiniteType, an EngineError`, () => {
        const e = caught(() => f(boardFromName(name)));
        expect(e).toBeInstanceOf(NotFiniteType);
        expect(e).toBeInstanceOf(EngineError);
      });
    }
  }
  it('an indefinite board throws NotFiniteType as well', () => {
    const b = fromAdjacency([[0, 3], [3, 0]]);
    for (const [, f] of GUARDED) expect(caught(() => f(b))).toBeInstanceOf(NotFiniteType);
  });
});

describe('a board in pieces (MERGE ruling (1) on P6-A1; E-10, E-7)', () => {
  // A2 + A2, two pieces of finite type: admitted by requireFinite. Built by hand, so Big with no name.
  const pieces = (): Board => fromAdjacency([[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]]) as unknown as Board;
  it('the split form of A2 + A2: satake throws NeedsConnectedBoard; restrictedBoard gives labels 1..4 and no name', () => {
    const d: SatakeDiagram = { board: pieces(), black: [], tau: [0, 1, 2, 3] };
    expect(admissibility(d).admissible).toBe(true);
    // the restricted root system is A2 + A2, in two pieces: the oracle's classify_restricted cannot name it
    const e = caught(() => satake(d));
    expect(e).toBeInstanceOf(NeedsConnectedBoard);
    expect(e).toBeInstanceOf(EngineError);
    expect((e as Error).message).toMatch(/restricted root system in one piece/);
    expect((e as Error).message).toMatch(/in 2 pieces/);
    // restrictedBoard still returns the restricted board: one node per white node, in two pieces, labels 1..m in
    // orbit order and no name (identify is not called on a board in pieces)
    const rb = restrictedBoard(d);
    expect(rb.orbits).toEqual([[0], [1], [2], [3]]);
    expect(rb.cartan).toEqual([[2, -1, 0, 0], [-1, 2, 0, 0], [0, 0, 2, -1], [0, 0, -1, 2]]);
    expect(rb.board.n).toBe(4);
    expect(rb.board.kind).toBe('gcm');
    expect([...rb.board.labels]).toEqual([1, 2, 3, 4]);
    expect(rb.board.name).toBeUndefined();
    expect(components(rb.board).length).toBe(2);
  });
  it('a pair on the same board whose restricted root system is in one piece is computed: complex sl(3,C)', () => {
    // tau exchanges the pieces (reference/verify.py: restricted roots A2 with multiplicity 2)
    const s = satake({ board: pieces(), black: [], tau: [2, 3, 0, 1] });
    expect(s.restricted_type).toBe('A2');
    expect(s.multiplicities.map((m) => m.mult)).toEqual([2]);
    expect(s.restricted_board).toBe('A2');
  });
});

describe('malformed diagrams', () => {
  const b = boardOf('A3');
  const id = [0, 1, 2];
  const bad: [string, SatakeDiagram][] = [
    ['tau too short', { board: b, black: [], tau: [0, 1] }],
    ['tau too long', { board: b, black: [], tau: [0, 1, 2, 3] }],
    ['tau repeats an image', { board: b, black: [], tau: [0, 0, 2] }],
    ['tau has an image outside 0..n-1', { board: b, black: [], tau: [0, 1, 3] }],
    ['tau has a negative image', { board: b, black: [], tau: [-1, 1, 2] }],
    ['tau has a fraction', { board: b, black: [], tau: [0.5, 1, 2] }],
    ['black repeats a node', { board: b, black: [1, 1], tau: id }],
    ['black has a node outside 0..n-1', { board: b, black: [3], tau: id }],
    ['black has a negative node', { board: b, black: [-1], tau: id }],
    ['black has a fraction', { board: b, black: [0.5], tau: id }],
  ];
  const calls: [string, (d: SatakeDiagram) => unknown][] = [
    ['theta', (d) => theta(d, [1, 0, 0])],
    ['shadow2', (d) => shadow2(d, [1, 0, 0])],
    ['admissibility', (d) => admissibility(d)],
    ['satake', (d) => satake(d)],
    ['restrictedBoard', (d) => restrictedBoard(d)],
  ];
  for (const [what, d] of bad) {
    it(`${what}: every function throws RangeError`, () => {
      for (const [fn, f] of calls) expect(caught(() => f(d)), fn).toBeInstanceOf(RangeError);
    });
  }
  it('a population of the wrong length is a RangeError for theta and shadow2', () => {
    const d: SatakeDiagram = { board: b, black: [], tau: id };
    expect(caught(() => theta(d, [1, 0]))).toBeInstanceOf(RangeError);
    expect(caught(() => shadow2(d, [1, 0, 0, 0]))).toBeInstanceOf(RangeError);
    expect(caught(() => theta(d, [1, 0.5, 0]))).toBeInstanceOf(RangeError);
  });
  it('a population with a hole is a RangeError for theta and shadow2, as an undefined entry is (repair after review)', () => {
    const d: SatakeDiagram = { board: b, black: [], tau: id };
    // a sparse array of length 3 with nothing at index 1: Array.prototype.map would skip the hole
    const holed = new Array<number>(3);
    holed[0] = 1;
    holed[2] = 0;
    expect(1 in holed).toBe(false);
    expect(caught(() => theta(d, holed))).toBeInstanceOf(RangeError);
    expect(caught(() => shadow2(d, holed))).toBeInstanceOf(RangeError);
    const undef = [1, undefined, 0] as unknown as number[];
    expect(caught(() => theta(d, undef))).toBeInstanceOf(RangeError);
    expect(caught(() => shadow2(d, undef))).toBeInstanceOf(RangeError);
  });
  it('a well-formed diagram passes, and a tau that is no symmetry or no involution is not malformed', () => {
    expect(theta({ board: b, black: [2, 0], tau: id }, [0, 1, 0])).toEqual([-1, -1, -1]);
    // not a symmetry of A3 (swap of nodes 1 and 2), and of order 3: judged by admissibility, not refused
    expect(admissibility({ board: b, black: [], tau: [1, 0, 2] }).symmetry).toBe(false);
    expect(admissibility({ board: b, black: [], tau: [1, 2, 0] }).condition_1).toBe(false);
  });
});

describe('arguments unchanged', () => {
  it('frozen black, tau and population are read, not written, and black is used sorted', () => {
    const b = boardOf('A3');
    const black = Object.freeze([2, 0]);
    const tau = Object.freeze([0, 1, 2]);
    const p = Object.freeze([0, 1, 0]);
    const d: SatakeDiagram = Object.freeze({ board: b, black, tau });
    expect(theta(d, p)).toEqual([-1, -1, -1]);
    expect(shadow2(d, p)).toEqual([1, 2, 1]);
    expect(admissibility(d).admissible).toBe(true);
    const s = satake(d);
    expect(s.w_X_word).toEqual([0, 2]);
    expect(restrictedBoard(d).orbits).toEqual([[1]]);
    expect(black).toEqual([2, 0]);
    expect(tau).toEqual([0, 1, 2]);
    expect(p).toEqual([0, 1, 0]);
  });
  it('black in any order gives the results of the sorted list: E6 and B3 (repair after review)', () => {
    // e6(-26) (black labels 2, 3, 4, 5, no arrow) and B3 with labels 2, 3 black, each given in reverse order.
    // The order matters to the word of w_X and to condition 3 when the list is not sorted first.
    const cases: [string, number[]][] = [['E6', [4, 3, 2, 1]], ['B3', [2, 1]]];
    for (const [T, rev] of cases) {
      const b = boardOf(T);
      const tau = b.labels.map((_, i) => i);
      const reversed: SatakeDiagram = { board: b, black: rev, tau };
      const sorted: SatakeDiagram = { board: b, black: [...rev].sort((x, y) => x - y), tau };
      const a = admissibility(reversed);
      expect(a.admissible, T).toBe(true);
      expect(a, T).toEqual(admissibility(sorted));
      expect(satake(reversed), T).toEqual(satake(sorted));
      const rr = restrictedBoard(reversed);
      const rs = restrictedBoard(sorted);
      expect(rr.compositeWords, T).toEqual(rs.compositeWords);
      expect(rr.cartan, T).toEqual(rs.cartan);
      expect([...rr.board.labels], T).toEqual([...rs.board.labels]);
      const p = b.labels.map((_, i) => (i % 3) - 1);
      expect(theta(reversed, p), T).toEqual(theta(sorted, p));
      expect(shadow2(reversed, p), T).toEqual(shadow2(sorted, p));
      expect(rev, T).not.toEqual([...rev].sort((x, y) => x - y));
    }
  });
  it('the result shares no array with the arguments', () => {
    const b = boardOf('A2');
    const d: SatakeDiagram = { board: b, black: [], tau: [1, 0] };
    const p = [0, 1];
    const t = theta(d, p);
    expect(t).not.toBe(p);
    expect(p).toEqual([0, 1]);
    const rb = restrictedBoard(d);
    expect(rb.orbits[0]).not.toBe(d.tau);
    const s = satake({ board: b, black: [], tau: [0, 1] });
    expect(s.w_X_word).toEqual([]);
  });
  it('two calls give equal results (no hidden state, E-5)', () => {
    const d: SatakeDiagram = { board: boardOf('E6'), black: [2, 3, 4], tau: [5, 1, 4, 3, 2, 0] };
    expect(satake(d)).toEqual(satake(d));
    const r1 = restrictedBoard(d);
    const r2 = restrictedBoard(d);
    expect(r1.compositeWords).toEqual(r2.compositeWords);
    expect(r1.board.labels).toEqual(r2.board.labels);
  });
});
