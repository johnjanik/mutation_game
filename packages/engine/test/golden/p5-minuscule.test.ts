// The golden key of phase 5, minuscule_representations (SPEC.md 2.18 [V], 4 T12 acceptance, 5.4 table
// "Representations", 5.7 phase 5 with rules 1, 2, 5 and 7, Appendix G; verify.py section 14, lines 1238 to
// 1275; P5-A1 instruction section 6). The 18 records are matched by type and node (rule 5); node is a label
// and is converted with toPositions (rule 2); weights_dynkin_labels is compared in order where it is present
// (rule 7: null above dimension 27). The checks of verify.py are reproduced on every record: the relations,
// the move matrix E + F + P0, the signed move exp(E)exp(-F)exp(E) and its square, and the cross-checks with
// weylDimension, orbitSize and minusculeNodes. Node 2 of D4, which is not minuscule, fails with both sides of
// every relation returned. The wall time of the 56 of E7 (the roster's "under two seconds") is a timing check
// and runs alone in the bench run, test/bench/p5-minuscule.bench.ts, as the E8 timing of phase 3 does.
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import { toLabels, toPositions } from '../../src/board';
import { minusculeNodes } from '../../src/guards';
import { fire } from '../../src/moves';
import type { RelationCheck, SparseMatrix } from '../../src/rep';
import { chevalleySerre, minusculeMatrices, signedMoves, spAdd, spEq, spKey, spMul } from '../../src/rep';
import { orbitSize, weylDimension } from '../../src/weyl';
import { boardOf, covers, golden, intEq, matchRecord } from './_harness';

covers('minuscule_representations');

interface MinusculeRecord {
  type: string;
  node: number; // a label (Appendix G)
  dimension: number;
  weights_dynkin_labels: number[][] | null;
}

const RECORDS = golden.minuscule_representations as MinusculeRecord[];

/**
 * The identifying fields (type, node label) of the 18 representations of SPEC.md 2.18: the five minuscule
 * nodes of A1 to A4, the spin representations of B2, B3, B4, the vector representations of C2, C3, the three
 * minuscule nodes of D4, nodes 1 and 5 of D5, the two 27s of E6 and the 56 of E7 (verify.py's list MINU).
 * Every other field is read from the golden file.
 */
const LISTED: [string, number][] = [
  ['A1', 1], ['A2', 1], ['A2', 2], ['A3', 2], ['A4', 2], ['B2', 2], ['B3', 3], ['B4', 4], ['C2', 1], ['C3', 1],
  ['D4', 1], ['D4', 3], ['D4', 4], ['D5', 1], ['D5', 5], ['E6', 1], ['E6', 6], ['E7', 7],
];

type Built = NonNullable<ReturnType<typeof minusculeMatrices>>;

interface Case {
  rec: MinusculeRecord;
  board: Board<number>;
  pos: number;
  m: Built;
}

const cache = new Map<string, Case>();

/** The record of (type, node) by rule 5, its board, the node's position, and the matrices (built once per file). */
function caseOf(type: string, node: number): Case {
  const id = `${type}:${node}`;
  let c = cache.get(id);
  if (c === undefined) {
    const rec = matchRecord(RECORDS, { type, node });
    const board = boardOf(type);
    const pos = toPositions(board, [node])[0]!;
    const m = minusculeMatrices(board, pos);
    if (m === null) throw new Error(`minusculeMatrices(${type}, ${pos}) is null`);
    c = { rec, board, pos, m };
    cache.set(id, c);
  }
  return c;
}

/** The unit vector at a position, as plain numbers (omega_i in Dynkin labels). */
function omega(n: number, i: number): number[] {
  const v: number[] = [];
  for (let k = 0; k < n; k++) v.push(k === i ? 1 : 0);
  return v;
}

/** The identity matrix of dimension d. */
function identity(d: number): SparseMatrix {
  const out: SparseMatrix = new Map();
  for (let r = 0; r < d; r++) out.set(spKey(r, r), 1n);
  return out;
}

/** P0 of node k: the projection onto the basis vectors whose number at node k is zero (verify.py line 1250). */
function p0(basis: number[][], k: number): SparseMatrix {
  const out: SparseMatrix = new Map();
  basis.forEach((a, r) => {
    if (a[k] === 0) out.set(spKey(r, r), 1n);
  });
  return out;
}

/** The entries as sorted [key, decimal text] pairs, for readable failure messages (plan). */
function dump(M: SparseMatrix): [string, string][] {
  return [...M.entries()].map(([k, v]) => [k, String(v)] as [string, string]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Numeric lexicographic comparison of two positions (Python's comparison of tuples). */
function lexCompare(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k]! < b[k]! ? -1 : 1;
  return 0;
}

/** The (relation, i, j) sequence of the plan's record order: i, then j, then hh, he, hf, ef, serre-e, serre-f. */
function expectedOrder(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out.push(`hh:${i},${j}`, `he:${i},${j}`, `hf:${i},${j}`, `ef:${i},${j}`);
      if (i !== j) out.push(`serre-e:${i},${j}`, `serre-f:${i},${j}`);
    }
  }
  return out;
}

const tag = (r: RelationCheck): string => `${r.relation}:${r.i},${r.j}`;

describe('the golden list', () => {
  it('holds the 18 representations of SPEC.md 2.18, each once, identified by type and node', () => {
    const inFile = RECORDS.map((r) => `${r.type}:${r.node}`).sort();
    expect(inFile).toEqual(LISTED.map(([t, n]) => `${t}:${n}`).sort());
    for (const [type, node] of LISTED) expect(matchRecord(RECORDS, { type, node }).type).toBe(type);
  });

  it('weights_dynkin_labels is null exactly above dimension 27 (rule 7)', () => {
    for (const rec of RECORDS) expect(rec.weights_dynkin_labels === null, `${rec.type} ${rec.node}`).toBe(rec.dimension > 27);
  });
});

describe('dimension equals the golden value', () => {
  for (const [type, node] of LISTED) {
    it(`${type} node ${node}`, () => {
      const { rec, board, m } = caseOf(type, node);
      intEq(m.basis.length, rec.dimension, `${type} node ${node}: dimension`);
      for (const list of [m.E, m.F, m.H, m.moves]) expect(list.length).toBe(board.n);
      for (const a of m.basis) expect(a.length).toBe(board.n);
    });
  }
});

describe('basis equals weights_dynkin_labels in order', () => {
  for (const [type, node] of LISTED) {
    it(`${type} node ${node}`, () => {
      const { rec, board, pos, m } = caseOf(type, node);
      // On every named finite board the labels are 1..n in position order, so a vector compares as it is.
      expect([...board.labels]).toEqual(board.labels.map((_, k) => k + 1));
      if (rec.weights_dynkin_labels !== null) intEq(m.basis, rec.weights_dynkin_labels, `${type} node ${node}: basis`);
      // Also where the field is null (E7 node 7): the basis is the orbit of omega_i, strictly decreasing.
      for (let r = 1; r < m.basis.length; r++) expect(lexCompare(m.basis[r - 1]!, m.basis[r]!), `${type} rows ${r - 1}, ${r}`).toBe(1);
      expect(m.basis.some((a) => lexCompare(a, omega(board.n, pos)) === 0)).toBe(true);
      const keys = new Set(m.basis.map((a) => a.join(',')));
      for (const a of m.basis) for (let k = 0; k < board.n; k++) expect(keys.has(fire(board, a, k).join(','))).toBe(true);
      for (const a of m.basis) for (const x of a) expect(Number.isSafeInteger(x)).toBe(true);
    });
  }
  it('the counts: 18 records, 17 with weights', () => {
    expect(LISTED.length).toBe(18);
    expect(LISTED.filter(([type, node]) => caseOf(type, node).rec.weights_dynkin_labels !== null).length).toBe(17);
  });
});

describe('every Chevalley-Serre relation holds', () => {
  for (const [type, node] of LISTED) {
    it(`${type} node ${node}`, () => {
      const { board, m } = caseOf(type, node);
      const n = board.n;
      const records = chevalleySerre(board, m.E, m.F, m.H);
      expect(records.length).toBe(6 * n * n - 2 * n);
      expect(records.map(tag)).toEqual(expectedOrder(n));
      for (const r of records) {
        expect(r.holds, `${type} node ${node}: ${tag(r)} ${JSON.stringify(dump(r.left))} vs ${JSON.stringify(dump(r.right))}`).toBe(true);
        expect(spEq(r.left, r.right)).toBe(true);
      }
    });
  }
  it('the record counts of A2 node 1, D4 node 2 and E7 node 7 are 20, 88 and 280', () => {
    const a2 = caseOf('A2', 1);
    const e7 = caseOf('E7', 7);
    const d4 = boardOf('D4');
    const m = minusculeMatrices(d4, 1)!;
    expect(chevalleySerre(a2.board, a2.m.E, a2.m.F, a2.m.H).length).toBe(20);
    expect(chevalleySerre(d4, m.E, m.F, m.H).length).toBe(88);
    expect(chevalleySerre(e7.board, e7.m.E, e7.m.F, e7.m.H).length).toBe(280);
  });
});

describe('D4 node 2 fails and returns both sides', () => {
  const d4 = boardOf('D4');
  it('the matrices are built for the 24 positions of the orbit, some with a 2', () => {
    const m = minusculeMatrices(d4, 1);
    expect(m).not.toBeNull();
    intEq(m!.basis.length, golden.types.D4!.fundamental_orbit_sizes[1], 'orbit of omega_2');
    expect(m!.basis.some((a) => a.some((x) => Math.abs(x) === 2))).toBe(true);
    // the hand check of the instruction (5.5), from the oracle: 8 of the 24 vectors hold a 2 or a -2, the first is (2, -1, 0, 0)
    expect(m!.basis.filter((a) => a.some((x) => Math.abs(x) === 2)).length).toBe(8);
    expect(m!.basis[0]).toEqual([2, -1, 0, 0]);
    // entries 2 and -2 reach H but neither E nor F
    expect([...m!.H[1]!.values()].some((v) => v === 2n || v === -2n)).toBe(true);
  });

  it('chevalleySerre returns 88 records; the failing ones carry both sides; exactly the 10 ef records of the oracle fail', () => {
    const m = minusculeMatrices(d4, 1)!;
    const records = chevalleySerre(d4, m.E, m.F, m.H);
    expect(records.length).toBe(88);
    expect(records.map(tag)).toEqual(expectedOrder(4));
    const failing = records.filter((r) => !r.holds);
    expect(failing.length).toBeGreaterThan(0);
    for (const r of failing) {
      expect(r.left).toBeInstanceOf(Map);
      expect(r.right).toBeInstanceOf(Map);
      expect(spEq(r.left, r.right)).toBe(false);
    }
    for (const r of records) expect(r.holds).toBe(spEq(r.left, r.right));
    // hand check, computed with reference/lie_games.py for the instruction (not a golden field)
    expect(failing.map(tag)).toEqual(['ef:0,0', 'ef:0,1', 'ef:1,0', 'ef:1,1', 'ef:1,2', 'ef:1,3', 'ef:2,1', 'ef:2,2', 'ef:3,1', 'ef:3,3']);
    // the oracle's single boolean is false
    expect(records.every((r) => r.holds)).toBe(false);
  });

  it('node 2 is not minuscule', () => {
    expect(toLabels(d4, minusculeNodes(d4))).not.toContain(2);
  });
});

describe('signed move is exp(E)exp(-F)exp(E) with square (-1)^H', () => {
  for (const [type, node] of LISTED) {
    it(`${type} node ${node}`, () => {
      const { board, m } = caseOf(type, node);
      const d = m.basis.length;
      const ident = identity(d);
      const signed = signedMoves(m.basis, m.E, m.F);
      expect(signed.length).toBe(board.n);
      for (let k = 0; k < board.n; k++) {
        const E = m.E[k]!;
        const F = m.F[k]!;
        expect(spMul(E, E).size, `E_${k}^2`).toBe(0);
        expect(spMul(F, F).size, `F_${k}^2`).toBe(0);
        const ex = spAdd(ident, E); // exp(E) = 1 + E since E^2 = 0
        const emf = spAdd(ident, F, -1n); // exp(-F) = 1 - F since F^2 = 0
        const lift = spMul(spMul(ex, emf), ex);
        expect(spEq(lift, signed[k]!), `node position ${k}`).toBe(true);
        expect(spEq(lift, spAdd(spAdd(E, F, -1n), p0(m.basis, k)))).toBe(true);
        const square: SparseMatrix = new Map();
        m.basis.forEach((a, r) => square.set(spKey(r, r), a[k] !== 0 ? -1n : 1n));
        expect(spEq(spMul(lift, lift), square), `square at node position ${k}`).toBe(true);
      }
    });
  }
});

describe('moves are the firing permutations', () => {
  for (const [type, node] of LISTED) {
    it(`${type} node ${node}`, () => {
      const { board, m } = caseOf(type, node);
      const index = new Map(m.basis.map((a, r) => [a.join(','), r] as [string, number]));
      for (let k = 0; k < board.n; k++) {
        const S = m.moves[k]!;
        expect(spEq(S, spAdd(spAdd(m.E[k]!, m.F[k]!), p0(m.basis, k))), `node position ${k}`).toBe(true);
        expect(S.size).toBe(m.basis.length);
        m.basis.forEach((a, c) => {
          const b = index.get(fire(board, a, k).join(','));
          expect(b).toBeDefined();
          expect(S.get(spKey(b!, c))).toBe(1n);
        });
      }
    });
  }
  it('on D4 node 2 the moves are still the firings, and are not E + F + P0', () => {
    const d4 = boardOf('D4');
    const m = minusculeMatrices(d4, 1)!;
    const index = new Map(m.basis.map((a, r) => [a.join(','), r] as [string, number]));
    let differs = 0;
    for (let k = 0; k < 4; k++) {
      m.basis.forEach((a, c) => expect(m.moves[k]!.get(spKey(index.get(fire(d4, a, k).join(','))!, c))).toBe(1n));
      expect(m.moves[k]!.size).toBe(m.basis.length);
      if (!spEq(m.moves[k]!, spAdd(spAdd(m.E[k]!, m.F[k]!), p0(m.basis, k)))) differs += 1;
    }
    expect(differs).toBeGreaterThan(0);
  });
});

describe('dimension agrees with Weyl and orbitSize; the nodes are minuscule', () => {
  for (const [type, node] of LISTED) {
    it(`${type} node ${node}`, () => {
      const { rec, board, pos, m } = caseOf(type, node);
      const w = omega(board.n, pos);
      const weyl = weylDimension(board, w);
      expect(typeof weyl).toBe('bigint');
      intEq(weyl, rec.dimension, 'weylDimension');
      expect(weyl).toBe(BigInt(m.basis.length));
      intEq(orbitSize(board, w), rec.dimension, 'orbitSize');
      expect(toLabels(board, minusculeNodes(board))).toContain(node);
      // F11: every number in the orbit of a minuscule omega_i is -1, 0 or 1
      for (const a of m.basis) for (const x of a) expect([-1, 0, 1]).toContain(x);
    });
  }
});
