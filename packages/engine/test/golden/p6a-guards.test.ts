// The Satake functions of phase 6 (P6-A1) off the finite boards and with malformed diagrams (SPEC.md 5.6
// second table, last row: "the Wythoff, Satake, representation and geometry functions | throw
// NeedsTwoWayRoads | throw NotFiniteType"; E-5, E-10, E-11; P6-A1 instruction 5.2). No covers(): no golden
// key stores these cases; the phase-6 keys are covered in p6a-admissible-pairs.test.ts,
// p6a-satake-examples.test.ts and by P6-A2's full-record test. classifyRestricted takes a set of vectors,
// not a board, and has no guard (P4-A1's reading of 5.6).
import { describe, expect, it } from 'vitest';
import type { AnyBoard, Board } from '../../src/board';
import { boardFromName, fromAdjacency } from '../../src/board';
import { EngineError, NeedsTwoWayRoads, NotFiniteType } from '../../src/errors';
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
