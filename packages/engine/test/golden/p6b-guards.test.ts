// The Satake functions of phase 6B (P6-A2: satakeCatalogue, satakeRecord, canonicalPair, matchCatalogue) off the
// finite boards, with unknown names, with pairs that are not admissible and with malformed input (SPEC.md 5.6
// second table, last row: "the Wythoff, Satake, representation and geometry functions | throw NeedsTwoWayRoads |
// throw NotFiniteType"; E-5, E-10 "NotAdmissible (satake, satakeRecord and restrictedBoard ...)", E-11; P6-A2
// instruction 5.2, 5.6, 6). No covers(): no golden key stores these cases; the phase-6 keys are covered by
// p6a-admissible-pairs.test.ts, p6a-satake-examples.test.ts, p6b-satake-records.test.ts,
// p6b-admissible-counts.test.ts and p6b-quasi-split.test.ts.
import { describe, expect, it } from 'vitest';
import type { AnyBoard, Board } from '../../src/board';
import { boardFromName, fromAdjacency, subBoard } from '../../src/board';
import { CAPS } from '../../src/caps';
import { EngineError, NeedsTwoWayRoads, NotABoard, NotAdmissible, NotFiniteType } from '../../src/errors';
import { symmetries } from '../../src/fold';
import type { SatakeDiagram } from '../../src/satake';
import { admissibility } from '../../src/satake';
import type { SatakeCatalogueEntry } from '../../src/satakeCatalogue';
import { canonicalPair, matchCatalogue, satakeCatalogue, satakeRecord } from '../../src/satakeCatalogue';
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

/** A well-formed catalogue entry for a board of n nodes: no black node, tau the identity. */
function entryOf(n: number, black: number[] = [], tau?: number[]): SatakeCatalogueEntry {
  const t: number[] = [];
  for (let i = 0; i < n; i++) t.push(i);
  return { cartan_label: 'x', real_form: 'x', black_nodes: black, tau: tau ?? t, restricted_type_display: null };
}

/** The two functions that take a diagram. */
const ON_DIAGRAMS: [string, (d: SatakeDiagram) => unknown][] = [
  ['canonicalPair', (d) => canonicalPair(d)],
  ['matchCatalogue', (d) => matchCatalogue(d)],
];

describe('one-way board', () => {
  const oneWay = (): AnyBoard => fromAdjacency([[0, 1], [0, 0]]);
  it('is a one-way board', () => {
    expect(oneWay().kind).toBe('one-way');
  });
  for (const [name, f] of ON_DIAGRAMS) {
    it(`${name} throws NeedsTwoWayRoads, an EngineError`, () => {
      const e = caught(() => f(plain(oneWay())));
      expect(e).toBeInstanceOf(NeedsTwoWayRoads);
      expect(e).toBeInstanceOf(EngineError);
    });
  }
  it('a one-way board of three nodes too', () => {
    const b = fromAdjacency([[0, 1, 0], [0, 0, 1], [0, 0, 0]]);
    for (const [fn, f] of ON_DIAGRAMS) expect(caught(() => f(plain(b))), fn).toBeInstanceOf(NeedsTwoWayRoads);
  });
});

describe('affine board', () => {
  for (const name of ['A2~', 'C2~', 'G2~', 'D4^(3)', 'pentagon']) {
    it(`canonicalPair and matchCatalogue on ${name} throw NotFiniteType, an EngineError`, () => {
      for (const [fn, f] of ON_DIAGRAMS) {
        const e = caught(() => f(plain(boardFromName(name))));
        expect(e, fn).toBeInstanceOf(NotFiniteType);
        expect(e, fn).toBeInstanceOf(EngineError);
      }
    });
    it(`satakeCatalogue and satakeRecord on ${name} throw NotFiniteType, an EngineError`, () => {
      const n = boardFromName(name).n;
      for (const e of [caught(() => satakeCatalogue(name)), caught(() => satakeRecord(name, entryOf(n)))]) {
        expect(e).toBeInstanceOf(NotFiniteType);
        expect(e).toBeInstanceOf(EngineError);
      }
    });
  }
  it('an indefinite board throws NotFiniteType as well', () => {
    const b = fromAdjacency([[0, 3], [3, 0]]);
    for (const [fn, f] of ON_DIAGRAMS) expect(caught(() => f(plain(b))), fn).toBeInstanceOf(NotFiniteType);
  });
});

describe('unknown name', () => {
  for (const name of ['Q7', 'A0', 'B1', 'D3', 'E9', 'F5', 'G3', 'a3', 'A3 ', '', 'BC2']) {
    it(`satakeCatalogue and satakeRecord on ${JSON.stringify(name)} throw NotABoard, an EngineError`, () => {
      for (const e of [caught(() => satakeCatalogue(name)), caught(() => satakeRecord(name, entryOf(3)))]) {
        expect(e).toBeInstanceOf(NotABoard);
        expect(e).toBeInstanceOf(EngineError);
      }
    });
  }
  it('ranks beyond 8 follow the parametric rules (the golden data stop at 8)', () => {
    // A9 has 1 + 1 + 5 + 1 entries by the rules of SPEC.md 6.4 (A II for odd n, su(p, q) for p = 1..5, compact)
    expect(satakeCatalogue('A9').map((e) => e.real_form)).toEqual([
      'sl(10,R)', 'su*(10)', 'su(1,9)', 'su(2,8)', 'su(3,7)', 'su(4,6)', 'su(5,5)', 'su(10)',
    ]);
    expect(satakeCatalogue('D9').length).toBe(9 + 1 + 1);
    expect(satakeRecord('B9', satakeCatalogue('B9')[0]!).real_form).toBe('so(1,18)');
  });
});

describe('NotAdmissible from satakeRecord', () => {
  it('A2 with black node 1 and the identity: satakeRecord throws NotAdmissible, matchCatalogue returns []', () => {
    const entry: SatakeCatalogueEntry = {
      cartan_label: 'x', real_form: 'x', black_nodes: [0], tau: [0, 1], restricted_type_display: null,
    };
    const e = caught(() => satakeRecord('A2', entry));
    expect(e).toBeInstanceOf(NotAdmissible);
    expect(e).toBeInstanceOf(EngineError);
    const board = boardOf('A2');
    const d: SatakeDiagram = { board, black: [0], tau: [0, 1] };
    expect((e as NotAdmissible).data).toEqual(admissibility(d));
    expect((e as NotAdmissible).data.condition_3).toBe(false);
    let got: unknown = 'not called';
    expect(() => {
      got = matchCatalogue(d);
    }).not.toThrow();
    expect(got).toEqual([]);
    // canonicalPair is defined for every well-formed pair, admissible or not
    expect(canonicalPair(d)).toEqual({ black: [0], tau: [0, 1] });
  });
  it('a pair that fails every condition: NotAdmissible from satakeRecord, nothing from matchCatalogue', () => {
    // A3, black node 1, tau the flip: tau moves the black set (SPEC.md 2.15 table)
    const entry = entryOf(3, [0], [2, 1, 0]);
    expect(caught(() => satakeRecord('A3', entry))).toBeInstanceOf(NotAdmissible);
    expect(matchCatalogue({ board: boardOf('A3'), black: [0], tau: [2, 1, 0] })).toEqual([]);
  });
  it('a tau that is no symmetry of the board: NotAdmissible from satakeRecord, nothing from matchCatalogue', () => {
    const entry = entryOf(4, [], [1, 0, 2, 3]);
    expect(caught(() => satakeRecord('A4', entry))).toBeInstanceOf(NotAdmissible);
    expect(matchCatalogue({ board: boardOf('A4'), black: [], tau: [1, 0, 2, 3] })).toEqual([]);
  });
  it('a tau of order 3 on D4 with no black node matches nothing and is not refused', () => {
    expect(matchCatalogue({ board: boardOf('D4'), black: [], tau: [2, 1, 3, 0] })).toEqual([]);
    expect(caught(() => satakeRecord('D4', entryOf(4, [], [2, 1, 3, 0])))).toBeInstanceOf(NotAdmissible);
  });
});

describe('the assert of the C2 adjustment', () => {
  it('an entry displayed C2 whose restricted board is not B2 throws EngineError (the oracle asserts it)', () => {
    const [split, , , , compact] = satakeCatalogue('A3');
    for (const entry of [split!, compact!]) {
      const e = caught(() => satakeRecord('A3', { ...entry, restricted_type_display: 'C2' }));
      expect(e, entry.real_form).toBeInstanceOf(EngineError);
      expect((e as Error).message).toBe('restricted board of a C2 record is not B2');
    }
    // the same entries with their own display are fine
    expect(satakeRecord('A3', split!).restricted_board).toBe('A3');
    expect(satakeRecord('A3', compact!).restricted_board).toBeNull();
  });
});

describe('malformed diagrams', () => {
  const b = boardOf('A3');
  const id = [0, 1, 2];
  const bad: [string, number[], number[]][] = [
    ['tau too short', [], [0, 1]],
    ['tau too long', [], [0, 1, 2, 3]],
    ['tau repeats an image', [], [0, 0, 2]],
    ['tau has an image outside 0..n-1', [], [0, 1, 3]],
    ['tau has a negative image', [], [-1, 1, 2]],
    ['tau has a fraction', [], [0.5, 1, 2]],
    ['black repeats a node', [1, 1], id],
    ['black has a node outside 0..n-1', [3], id],
    ['black has a negative node', [-1], id],
    ['black has a fraction', [0.5], id],
  ];
  for (const [what, black, tau] of bad) {
    it(`${what}: canonicalPair, matchCatalogue and satakeRecord throw RangeError`, () => {
      const d: SatakeDiagram = { board: b, black, tau };
      for (const [fn, f] of ON_DIAGRAMS) expect(caught(() => f(d)), fn).toBeInstanceOf(RangeError);
      expect(caught(() => satakeRecord('A3', entryOf(3, black, tau)))).toBeInstanceOf(RangeError);
    });
  }
  it('a diagram or an entry that is not an object, or lists that are not arrays, throw RangeError', () => {
    for (const [fn, f] of ON_DIAGRAMS) {
      expect(caught(() => f(null as unknown as SatakeDiagram)), fn).toBeInstanceOf(RangeError);
      expect(caught(() => f({ board: b, black: 'x', tau: id } as unknown as SatakeDiagram)), fn).toBeInstanceOf(RangeError);
      expect(caught(() => f({ board: b, black: [], tau: 'abc' } as unknown as SatakeDiagram)), fn).toBeInstanceOf(RangeError);
    }
    expect(caught(() => satakeRecord('A3', null as unknown as SatakeCatalogueEntry))).toBeInstanceOf(RangeError);
    expect(caught(() => satakeRecord('A3', { ...entryOf(3), tau: undefined } as unknown as SatakeCatalogueEntry))).toBeInstanceOf(RangeError);
  });
  it('the order of checks: the shape of the arguments, then the kind of board, then its class', () => {
    // a malformed pair on a one-way board is a RangeError; a well-formed one is NeedsTwoWayRoads
    const oneWay = fromAdjacency([[0, 1], [0, 0]]) as unknown as Board;
    expect(caught(() => canonicalPair({ board: oneWay, black: [], tau: [0, 0] }))).toBeInstanceOf(RangeError);
    expect(caught(() => canonicalPair({ board: oneWay, black: [], tau: [0, 1] }))).toBeInstanceOf(NeedsTwoWayRoads);
    // an unknown name is NotABoard before anything else
    expect(caught(() => satakeRecord('Q7', entryOf(2, [5], [0, 0])))).toBeInstanceOf(NotABoard);
  });
});

describe('unnamed board', () => {
  it('matchCatalogue on a finite board without a name throws RangeError; canonicalPair works there', () => {
    // the C2 matrix built from its roads stays unnamed (fromAdjacency), and a sub-board has no name (subBoard)
    const c2 = fromAdjacency([[0, 1], [2, 0]]) as Board;
    const a3 = subBoard(boardOf('A4'), [0, 1, 2]);
    expect(c2.name).toBeUndefined();
    expect(a3.name).toBeUndefined();
    for (const board of [c2, a3]) {
      const d = plain(board);
      const e = caught(() => matchCatalogue(d));
      expect(e).toBeInstanceOf(RangeError);
      expect((e as Error).message).toContain('boardFromName');
      expect(canonicalPair(d)).toEqual({ black: [], tau: d.tau });
    }
    // two pieces of finite type and no name (reference/verify.py runs satake on the sum of two A2)
    const sum = fromAdjacency([[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]]) as Board;
    expect(caught(() => matchCatalogue({ board: sum, black: [], tau: [2, 3, 0, 1] }))).toBeInstanceOf(RangeError);
    // the exchange of the two pieces is conjugate only to [3, 2, 1, 0] (by a flip of one piece); it is the least
    expect(canonicalPair({ board: sum, black: [], tau: [3, 2, 1, 0] })).toEqual({ black: [], tau: [2, 3, 0, 1] });
    expect(canonicalPair({ board: sum, black: [], tau: [2, 3, 0, 1] })).toEqual({ black: [], tau: [2, 3, 0, 1] });
  });
  it('a board whose name does not belong to its matrix throws RangeError', () => {
    const a3 = boardOf('A3');
    const fake = Object.freeze({ ...boardOf('C3'), name: 'A3' }) as Board;
    expect(caught(() => matchCatalogue({ board: fake, black: [], tau: [0, 1, 2] }))).toBeInstanceOf(RangeError);
    expect(matchCatalogue({ board: a3, black: [], tau: [0, 1, 2] }).map((r) => r.real_form)).toEqual(['sl(4,R)']);
  });
});

describe('a board with more symmetries than the cap (repair after review)', () => {
  /** k isolated nodes: a finite board (A1 taken k times) whose symmetries are all k! permutations. */
  const isolated = (k: number): Board => fromAdjacency(Array.from({ length: k }, () => new Array<number>(k).fill(0))) as Board;
  const id = (k: number): number[] => Array.from({ length: k }, (_, i) => i);

  it('8 isolated nodes (8! = 40320 symmetries): canonicalPair throws RangeError naming CAPS.relabellingsDefault', () => {
    const b = isolated(8);
    expect(b.kind).toBe('gcm');
    // symmetries stops at its limit without a flag: asked for one more than the cap, it fills the limit
    expect(symmetries(b, CAPS.relabellingsDefault + 1).length).toBe(CAPS.relabellingsDefault + 1);
    // two pairs of one class: before the repair they got the different representatives [0, 2] and [0, 1]
    for (const black of [[6, 7], [0, 1]]) {
      const e = caught(() => canonicalPair({ board: b, black, tau: id(8) }));
      expect(e, JSON.stringify(black)).toBeInstanceOf(RangeError);
      expect((e as Error).message).toContain('CAPS.relabellingsDefault');
      expect((e as Error).message).toContain(String(CAPS.relabellingsDefault));
    }
    // and with a tau that exchanges two nodes (the review's 9-node case, here on 8 nodes)
    const t = id(8);
    t[0] = 7;
    t[7] = 0;
    expect(caught(() => canonicalPair({ board: b, black: [6], tau: t }))).toBeInstanceOf(RangeError);
    // a malformed pair is still refused first by its shape (the order of checks)
    expect(caught(() => canonicalPair({ board: b, black: [8], tau: id(8) }))).toBeInstanceOf(RangeError);
  });

  it('7 isolated nodes (7! = 5040 symmetries, under the cap): the least image over the whole group', () => {
    const b = isolated(7);
    expect(symmetries(b, CAPS.relabellingsDefault + 1).length).toBe(5040);
    // values checked against the oracle's canonical_pair with automorphisms(C) (scratch script, not committed)
    expect(canonicalPair({ board: b, black: [5, 6], tau: id(7) })).toEqual({ black: [0, 1], tau: id(7) });
    expect(canonicalPair({ board: b, black: [0, 1], tau: id(7) })).toEqual({ black: [0, 1], tau: id(7) });
    expect(canonicalPair({ board: b, black: [5], tau: [6, 1, 2, 3, 4, 5, 0] })).toEqual({ black: [0], tau: [0, 1, 2, 3, 4, 6, 5] });
    expect(canonicalPair({ board: b, black: [3, 6], tau: [1, 2, 0, 4, 3, 6, 5] })).toEqual({ black: [0, 1], tau: [2, 3, 0, 1, 5, 6, 4] });
  });
});

describe('arguments unchanged', () => {
  it('frozen black, tau and entries are read, not written, and black is used sorted', () => {
    const board = boardOf('D4');
    const black = Object.freeze([3, 2]);
    const tau = Object.freeze([0, 1, 2, 3]);
    const d: SatakeDiagram = Object.freeze({ board, black, tau });
    expect(canonicalPair(d)).toEqual({ black: [0, 2], tau: [0, 1, 2, 3] });
    expect(matchCatalogue(d).map((r) => r.real_form)).toEqual(['so(2,6)', 'so*(8)']);
    expect(black).toEqual([3, 2]);
    expect(tau).toEqual([0, 1, 2, 3]);
    const entry: SatakeCatalogueEntry = Object.freeze({
      cartan_label: 'D I', real_form: 'so(2,6)', black_nodes: Object.freeze([3, 2]) as number[],
      tau: Object.freeze([0, 1, 2, 3]) as number[], restricted_type_display: 'B2',
    });
    const rec = satakeRecord('D4', entry);
    expect(rec.black_nodes).toEqual([2, 3]);
    expect(entry.black_nodes).toEqual([3, 2]);
    expect(rec.black_nodes).not.toBe(entry.black_nodes);
    expect(rec.tau).not.toBe(entry.tau);
  });
  it('the C2 reversal is made on a copy: satake itself still lists the orbits in identify order', () => {
    const [entry] = satakeCatalogue('C2');
    const r1 = satakeRecord('C2', entry!);
    const r2 = satakeRecord('C2', entry!);
    expect(r1).toEqual(r2);
    expect(r1.restricted_board).toBe('C2');
    r1.restricted_orbits_in_bourbaki_order!.reverse();
    expect(satakeRecord('C2', entry!)).toEqual(r2);
  });
  it('each call of satakeCatalogue gives fresh entries (no hidden state, E-5)', () => {
    const first = satakeCatalogue('E6');
    const tau0 = [...first[1]!.tau];
    first[1]!.tau.reverse();
    first[1]!.black_nodes.push(0);
    first.pop();
    const second = satakeCatalogue('E6');
    expect(second.length).toBe(5);
    expect(second[1]!.tau).toEqual(tau0);
    expect(second[1]!.black_nodes).toEqual([]);
    // the compact form's tau is a copy too, never the shared constant of E6 (FLIP_E6)
    expect(second[4]!.tau).not.toBe(second[1]!.tau);
  });
  it('two calls give equal results', () => {
    const d: SatakeDiagram = { board: boardOf('E6'), black: [2, 3, 4], tau: [5, 1, 4, 3, 2, 0] };
    expect(matchCatalogue(d)).toEqual(matchCatalogue(d));
    expect(canonicalPair(d)).toEqual(canonicalPair(d));
  });
});
