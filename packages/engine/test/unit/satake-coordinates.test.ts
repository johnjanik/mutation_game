// restrictedCoordinates (P6-A1 follow-up for T13; P6-A3 instruction 5.8 "Shadows" and 5.9 "The restricted board
// and composite moves"; SPEC.md 2.15 "Shadows: restricted roots" and "The restricted game"; SPEC 4 T13 "each
// composite word acts on shadows as the reflection given by restricted_cartan"; SPEC 7.3 "Components contain no
// mathematics beyond calling the engine"): the coordinates of a doubled shadow in the doubled simple restricted
// roots, one per orbit, in the order of rb.orbits (the order of rb.cartan and of rb.board's positions).
// Every diagram comes from a record of the golden key `satake` (its black_nodes and tau, as labels) through the
// harness (boardOf, toPositions, labels, intEq, matchRecord; rules 1, 2 and 5 of SPEC.md 5.7). No covers(): no new
// golden key; `satake` is registered by P6-A2's full-record test, and this file reads it as p6a-restricted.test.ts
// does.
import { describe, expect, it } from 'vitest';
import type { AnyBoard, Board } from '../../src/board';
import { boardFromName, cartanNumbers, fromAdjacency, toPositions } from '../../src/board';
import { EngineError, NeedsTwoWayRoads, NotFiniteType } from '../../src/errors';
import { restrictedCoordinates as fromIndex } from '../../src/index';
import { applyWord, mutate } from '../../src/moves';
import type { RestrictedBoard, SatakeDiagram } from '../../src/satake';
import { restrictedBoard, restrictedCoordinates, shadow2 } from '../../src/satake';
import { roots } from '../../src/search';
import { boardOf, golden, intEq, labels, matchRecord } from '../golden/_harness';

interface SatakeRecord {
  dynkin_type: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  real_rank: number;
  restricted_simple_orbits: number[][];
  restricted_cartan: number[][];
  restricted_orbits_in_bourbaki_order: number[][] | null;
}

const RECORDS = golden.satake as SatakeRecord[];

function diagramOf(rec: SatakeRecord): { board: Board; d: SatakeDiagram } {
  const board = boardOf(rec.dynkin_type);
  return { board, d: { board, black: toPositions(board, rec.black_nodes), tau: toPositions(board, rec.tau) } };
}

function record(type: string, realForm: string): { rec: SatakeRecord; board: Board; d: SatakeDiagram } {
  const rec = matchRecord(RECORDS, { dynkin_type: type, real_form: realForm });
  return { rec, ...diagramOf(rec) };
}

const key = (v: readonly number[]): string => v.join(',');

/** e at the node with this label, as a population. */
function unitAt(board: Board, label: number): number[] {
  const [i] = toPositions(board, [label]);
  return board.labels.map((_, j) => (j === i ? 1 : 0));
}

/** Every root of the board, positive and negative; as many as the golden n_roots of the type. */
function allRoots(board: Board, type: string): number[][] {
  const R = roots(board, 100000);
  expect(R.truncated).toBe(false);
  intEq(R.items.length, golden.types[type]!.n_roots, `${type}: number of roots`);
  return R.items;
}

function caught(f: () => unknown): unknown {
  try {
    f();
  } catch (e) {
    return e;
  }
  return null;
}

describe('restrictedCoordinates on every shadow of every record', () => {
  it('is exported from src/index.ts', () => {
    expect(typeof fromIndex).toBe('function');
    expect(fromIndex).toBe(restrictedCoordinates);
  });

  it('every root of the 167 records: integer coordinates of one sign that recombine to the shadow exactly, all zero exactly on the black sub-board', () => {
    expect(RECORDS.length).toBe(167);
    const failures: string[] = [];
    let checked = 0;
    for (const rec of RECORDS) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const rb = restrictedBoard(d);
      const m = rb.orbits.length;
      expect(m, where).toBe(rec.real_rank);
      expect(rb.orbits.map((o) => labels(board, o)), where).toEqual(rec.restricted_simple_orbits);
      const black = new Set(d.black);
      for (const a of allRoots(board, rec.dynkin_type)) {
        const s = shadow2(d, a);
        const c = restrictedCoordinates(d, rb, s);
        const at = `${where}, root (${key(a)}), shadow (${key(s)}), coordinates (${key(c)})`;
        checked += 1;
        if (c.length !== m) {
          failures.push(`${at}: ${c.length} coordinates, not ${m}`);
          continue;
        }
        if (!c.every((x) => Number.isInteger(x))) failures.push(`${at}: not integers`);
        // all of one sign, in the stronger form the order of the roots gives: a positive root's shadow has
        // coordinates >= 0, a negative root's coordinates <= 0
        const positive = a.every((x) => x >= 0);
        if (!(positive ? c.every((x) => x >= 0) : c.every((x) => x <= 0))) {
          failures.push(`${at}: the coordinates of a ${positive ? 'positive' : 'negative'} root are not all of its sign`);
        }
        // the coordinates recombine to the shadow exactly
        const back = s.map((_, i) => c.reduce((t, ck, k) => t + ck * rb.simpleRestrictedRoots2[k]![i]!, 0));
        if (key(back) !== key(s)) failures.push(`${at}: they recombine to (${key(back)})`);
        // zero exactly on the roots of the black sub-board (SPEC.md 2.15: the roots with zero shadow)
        const inBlack = a.every((x, i) => x === 0 || black.has(i));
        const zero = c.every((x) => x === 0);
        if (zero !== inBlack) failures.push(`${at}: all zero ${zero}, root of the black sub-board ${inBlack}`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    expect(failures.length).toBe(0);
    // every root of every record was checked: the sum of the golden n_roots over the records
    expect(checked).toBe(RECORDS.reduce((t, rec) => t + golden.types[rec.dynkin_type]!.n_roots, 0));
  });
});

describe('the restricted game on the coordinates', () => {
  it('each composite word changes the coordinates of every shadow as the mutation of the restricted board at its position (SPEC 4 T13)', () => {
    const failures: string[] = [];
    let records = 0;
    let checked = 0;
    for (const rec of RECORDS) {
      if (rec.real_rank === 0) continue;
      records += 1;
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const rb = restrictedBoard(d);
      // the board mutate plays on is the golden restricted_cartan, rows and columns in the order of the orbits
      intEq(rb.cartan, rec.restricted_cartan, where);
      intEq(cartanNumbers(rb.board), rec.restricted_cartan, where);
      expect(rb.orbits.map((o) => labels(board, o)), where).toEqual(rec.restricted_simple_orbits);
      for (const a of allRoots(board, rec.dynkin_type)) {
        const c = restrictedCoordinates(d, rb, shadow2(d, a));
        rb.compositeWords.forEach((w, k) => {
          const image = applyWord(board, a, w, 'mutation');
          const got = restrictedCoordinates(d, rb, shadow2(d, image));
          const want = mutate(rb.board, c, k);
          if (key(got) !== key(want)) {
            failures.push(`${where}, orbit ${k}, root (${key(a)}): coordinates (${key(c)}) became (${key(got)}), not (${key(want)})`);
          }
          checked += 1;
        });
      }
    }
    // SPEC.md 2.15: the 135 catalogue records of positive real rank
    expect(records).toBe(135);
    expect(failures.slice(0, 10)).toEqual([]);
    expect(failures.length).toBe(0);
    // every root with every orbit: the sum of the golden n_roots times real_rank over the records
    expect(checked).toBe(RECORDS.reduce((t, rec) => t + golden.types[rec.dynkin_type]!.n_roots * rec.real_rank, 0));
  });
});

describe('worked examples', () => {
  it('e6(-26) (SPEC.md 2.15, P6-A3 5.9): alpha_6 has coordinates (0, 1) in orbit order [[1], [6]], and (0, -1) after the composite word of the orbit of node 6', () => {
    const { rec, board, d } = record('E6', 'e6(-26)');
    expect(rec.black_nodes).toEqual([2, 3, 4, 5]);
    expect(rec.tau).toEqual([1, 2, 3, 4, 5, 6]);
    const rb = restrictedBoard(d);
    expect(rb.orbits.map((o) => labels(board, o))).toEqual([[1], [6]]);
    const alpha6 = unitAt(board, 6);
    const c = restrictedCoordinates(d, rb, shadow2(d, alpha6));
    expect(c).toEqual([0, 1]);
    const k = rb.orbits.findIndex((o) => labels(board, o).includes(6));
    expect(k).toBe(1);
    // restricted node 2 of the drawn A2 is that orbit (restricted_orbits_in_bourbaki_order)
    expect(rb.board.name).toBe('A2');
    expect(rb.board.labels[k]).toBe(2);
    expect(rec.restricted_orbits_in_bourbaki_order![1]).toEqual([6]);
    const image = applyWord(board, alpha6, rb.compositeWords[k]!, 'mutation');
    expect(restrictedCoordinates(d, rb, shadow2(d, image))).toEqual([0, -1]);
    expect(mutate(rb.board, c, k)).toEqual([0, -1]);
    // and alpha_1 is the simple restricted root of the other orbit
    expect(restrictedCoordinates(d, rb, shadow2(d, unitAt(board, 1)))).toEqual([1, 0]);
  });

  it('su(1,2) (SPEC.md Appendix A.5): BC1, the shadows of the six roots have coordinates +-1 (four roots) and +-2 (two roots)', () => {
    const { board, d } = record('A2', 'su(1,2)');
    const rb = restrictedBoard(d);
    const coords = allRoots(board, 'A2').map((a) => restrictedCoordinates(d, rb, shadow2(d, a)));
    expect(coords.map((c) => c.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(coords.map((c) => c[0]!).sort((x, y) => x - y)).toEqual([-2, -1, -1, 1, 1, 2]);
  });

  it('e6(-14): coordinates follow the orbit order [[1, 6], [2]], not the Bourbaki order [[2], [1, 6]]', () => {
    const { board, d } = record('E6', 'e6(-14)');
    const rb = restrictedBoard(d);
    expect(rb.orbits.map((o) => labels(board, o))).toEqual([[1, 6], [2]]);
    expect(restrictedCoordinates(d, rb, shadow2(d, unitAt(board, 1)))).toEqual([1, 0]);
    expect(restrictedCoordinates(d, rb, shadow2(d, unitAt(board, 6)))).toEqual([1, 0]);
    expect(restrictedCoordinates(d, rb, shadow2(d, unitAt(board, 2)))).toEqual([0, 1]);
  });
});

describe('refusals', () => {
  it('a shadow of the wrong length throws RangeError', () => {
    const { d } = record('A3', 'sl(4,R)');
    const rb = restrictedBoard(d);
    for (const v of [[2, 0], [2, 0, 0, 0], []]) {
      const e = caught(() => restrictedCoordinates(d, rb, v));
      expect(e, key(v)).toBeInstanceOf(RangeError);
      expect((e as Error).message, key(v)).toMatch(/entries, but the board has 3 nodes/);
    }
  });

  it('a shadow with an entry that is not an integer throws RangeError', () => {
    const { d } = record('A2', 'sl(3,R)');
    const rb = restrictedBoard(d);
    expect(caught(() => restrictedCoordinates(d, rb, [0.5, 0]))).toBeInstanceOf(RangeError);
    expect(caught(() => restrictedCoordinates(d, rb, [Number.NaN, 0]))).toBeInstanceOf(RangeError);
  });

  it('half of a simple restricted root on a split form is not an integer combination: RangeError', () => {
    const { d } = record('A2', 'sl(3,R)');
    const rb = restrictedBoard(d);
    expect(rb.simpleRestrictedRoots2).toEqual([[2, 0], [0, 2]]);
    expect(restrictedCoordinates(d, rb, [2, 0])).toEqual([1, 0]);
    const e = caught(() => restrictedCoordinates(d, rb, [1, 0]));
    expect(e).toBeInstanceOf(RangeError);
    expect((e as Error).message).toMatch(/not an integer combination/);
    expect((e as Error).message).toMatch(/1\/2, 0/);
  });

  it('a vector outside the span of the simple restricted roots throws RangeError', () => {
    const { board, d } = record('E6', 'e6(-26)');
    const rb = restrictedBoard(d);
    // twice alpha_2, a black node: no combination of the two simple restricted roots
    const e = caught(() => restrictedCoordinates(d, rb, unitAt(board, 2).map((x) => 2 * x)));
    expect(e).toBeInstanceOf(RangeError);
    expect((e as Error).message).toMatch(/is not a combination of the simple restricted roots/);
  });

  it('a compact form: [] for the zero vector, RangeError for any other', () => {
    for (const [type, form] of [['A2', 'su(3)'], ['E6', 'e6(-78)'], ['B2', 'so(5)']] as const) {
      const { board, d } = record(type, form);
      const rb = restrictedBoard(d);
      expect(rb.orbits).toEqual([]);
      expect(restrictedCoordinates(d, rb, board.labels.map(() => 0))).toEqual([]);
      for (const a of allRoots(board, type)) expect(restrictedCoordinates(d, rb, shadow2(d, a))).toEqual([]);
      const e = caught(() => restrictedCoordinates(d, rb, unitAt(board, 1).map((x) => 2 * x)));
      expect(e, form).toBeInstanceOf(RangeError);
      expect((e as Error).message, form).toMatch(/no simple restricted root/);
    }
  });

  it('a restricted board of another diagram or of another size throws RangeError', () => {
    const split = record('A2', 'sl(3,R)');
    const quasi = record('A2', 'su(1,2)');
    const rbSplit = restrictedBoard(split.d);
    // orbits [[0], [1]] against the diagram's one orbit [[0, 1]]
    let e = caught(() => restrictedCoordinates(quasi.d, rbSplit, [2, 2]));
    expect(e).toBeInstanceOf(RangeError);
    expect((e as Error).message).toMatch(/belongs to another diagram/);
    // a restricted board of A3 on an A2 diagram
    const rbA3 = restrictedBoard(record('A3', 'sl(4,R)').d);
    e = caught(() => restrictedCoordinates(split.d, rbA3, [2, 0]));
    expect(e).toBeInstanceOf(RangeError);
    // as many orbits, but other ones: e6(-26) has [[1], [6]], e6(-14) has [[1, 6], [2]] (labels)
    const e614 = record('E6', 'e6(-14)');
    const rb626 = restrictedBoard(record('E6', 'e6(-26)').d);
    e = caught(() => restrictedCoordinates(e614.d, rb626, shadow2(e614.d, unitAt(e614.board, 1))));
    expect(e).toBeInstanceOf(RangeError);
    expect((e as Error).message).toMatch(/orbit 0 of this restricted board is not the orbit \(0, 5\) of the diagram/);
    // the right orbits, but simple restricted roots of the wrong length
    e = caught(() => restrictedCoordinates(split.d, { ...rbSplit, simpleRestrictedRoots2: [[2, 0, 0], [0, 2, 0]] }, [2, 0]));
    expect(e).toBeInstanceOf(RangeError);
    expect((e as Error).message).toMatch(/simple restricted root 0 has 3 entries, but the board has 2 nodes/);
  });

  it('a malformed diagram throws RangeError', () => {
    const { board, d } = record('A2', 'sl(3,R)');
    const rb = restrictedBoard(d);
    expect(caught(() => restrictedCoordinates({ board, black: [], tau: [0, 0] }, rb, [2, 0]))).toBeInstanceOf(RangeError);
    expect(caught(() => restrictedCoordinates({ board, black: [2], tau: [0, 1] }, rb, [2, 0]))).toBeInstanceOf(RangeError);
  });
});

describe('guards (SPEC.md 5.6, E-11)', () => {
  /** A diagram with no black node and tau the identity, with a restricted board of the right shape for it. */
  function plain(b: AnyBoard): { d: SatakeDiagram; rb: RestrictedBoard; v: number[] } {
    const n = b.labels.length;
    const board = b as unknown as Board; // the diagram type names Board<number>; the guard cases hand it others
    const e = (i: number): number[] => b.labels.map((_, j) => (j === i ? 2 : 0));
    const rb: RestrictedBoard = {
      orbits: b.labels.map((_, i) => [i]),
      simpleRestrictedRoots2: b.labels.map((_, i) => e(i)),
      cartan: cartanNumbers(b),
      compositeWords: [],
      board,
    };
    return { d: { board, black: [], tau: b.labels.map((_, i) => i) }, rb, v: e(n - 1) };
  }

  it('a one-way board throws NeedsTwoWayRoads, an EngineError', () => {
    const { d, rb, v } = plain(fromAdjacency([[0, 1], [0, 0]]));
    const e = caught(() => restrictedCoordinates(d, rb, v));
    expect(e).toBeInstanceOf(NeedsTwoWayRoads);
    expect(e).toBeInstanceOf(EngineError);
  });

  it('an affine or indefinite board throws NotFiniteType, an EngineError', () => {
    for (const b of [boardFromName('A2~'), boardFromName('G2~'), fromAdjacency([[0, 3], [3, 0]])]) {
      const { d, rb, v } = plain(b);
      const e = caught(() => restrictedCoordinates(d, rb, v));
      expect(e).toBeInstanceOf(NotFiniteType);
      expect(e).toBeInstanceOf(EngineError);
    }
  });
});

describe('pure (E-5)', () => {
  it('frozen arguments are read, not written; the result shares no array with them; two calls agree', () => {
    const { board, d } = record('E6', 'e6(-14)');
    const rb = restrictedBoard(d);
    const deep = <T>(rows: T[][]): readonly (readonly T[])[] => Object.freeze(rows.map((r) => Object.freeze([...r])));
    const frozenRb: RestrictedBoard = Object.freeze({
      ...rb,
      orbits: deep(rb.orbits) as number[][],
      simpleRestrictedRoots2: deep(rb.simpleRestrictedRoots2) as number[][],
    });
    const frozenD: SatakeDiagram = Object.freeze({ board, black: Object.freeze([...d.black]), tau: Object.freeze([...d.tau]) });
    // alpha_1 + alpha_2: the sum of the two simple restricted roots (orbits {1, 6} and {2})
    const s = Object.freeze(shadow2(d, board.labels.map((l) => (l === 1 || l === 2 ? 1 : 0))));
    const before = JSON.stringify([frozenRb.orbits, frozenRb.simpleRestrictedRoots2, frozenD.black, frozenD.tau, s]);
    const c1 = restrictedCoordinates(frozenD, frozenRb, s);
    expect(c1).toEqual([1, 1]);
    for (const row of [...frozenRb.orbits, ...frozenRb.simpleRestrictedRoots2, frozenD.black, frozenD.tau, s]) {
      expect(c1).not.toBe(row);
    }
    c1[0] = 99;
    expect(restrictedCoordinates(frozenD, frozenRb, s)).toEqual([1, 1]);
    expect(JSON.stringify([frozenRb.orbits, frozenRb.simpleRestrictedRoots2, frozenD.black, frozenD.tau, s])).toBe(before);
    // the same diagram with the black nodes in another order gives the same coordinates
    expect(restrictedCoordinates({ ...d, black: [...d.black].reverse() }, rb, s)).toEqual([1, 1]);
  });
});
