// satake against the 167 records of the golden key `satake` (SPEC.md 2.15, 5.4, 5.7 phase 6 and rules 1, 2, 5,
// 6, 7, 6.4 "Fields of a catalogue record" and "Names in rank 2", Appendix A.5, Appendix G; P6-A1 instruction
// 5.3 to 5.6, 5.8, 5.10). Every computed field, from rank to restricted_reflection_word_lengths, is reproduced
// from the stored black_nodes and tau; records are matched by dynkin_type and real_form (rule 5), node fields
// converted with the harness's labels() (rule 2). Also: the invariants of reference/verify.py, Appendix A.5,
// the e6(-26) example of 2.15, the refusal of pairs that are not admissible (NotAdmissible, E-10), the special
// shapes of 2.15 and the quasi-split cross-check of 2.13 (b).
// No covers() (plan, P6-A1 instruction section 4): the key `satake` is registered by P6-A2's full-record test;
// reading it here without covers() is reported as a deviation from CONTRACTS.md 3. The key `folding` is read
// for the quasi-split check only and is covered by p4-folding.test.ts. The E7 and E8 timings run alone in
// test/bench/p6a-satake.bench.ts (no clock is read in the parallel suite).
import { describe, expect, it, vi } from 'vitest';
import type { Board } from '../../src/board';
import { subBoard, toPositions } from '../../src/board';
import { gram } from '../../src/classify';
import { mutate } from '../../src/moves';
import { EngineError, NotAdmissible } from '../../src/errors';
import { averagedRootsType } from '../../src/fold';
import type { Rational } from '../../src/rational';
import { rat, ratDiv, ratMul, ratSub } from '../../src/rational';
import * as restrictedType from '../../src/restrictedType';
import type { SatakeComputed, SatakeDiagram } from '../../src/satake';
import { admissibility, restrictedBoard, satake, shadow2, theta } from '../../src/satake';
import { positiveRoots, roots } from '../../src/search';
import { boardOf, golden, intEq, labels } from './_harness';

// classifyRestricted is wrapped in a spy that calls the real function, so that the refusal of a pair failing
// condition 3 can be shown to happen before any shadow is classified (P6-A1 instruction 5.8, trap 4).
vi.mock('../../src/restrictedType', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/restrictedType')>();
  return { ...mod, classifyRestricted: vi.fn(mod.classifyRestricted) };
});

interface SatakeRecord {
  dynkin_type: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  restricted_type_display: string | null;
  rank: number;
  real_rank: number;
  restricted_type: string | null;
  multiplicities: { class: string; roots: number; mult: number }[];
  n_restricted_roots: number;
  dim_g: number;
  dim_k: number;
  dim_p: number;
  character: number;
  roots_compact_imaginary: number;
  roots_real: number;
  roots_complex: number;
  w_X_word: number[];
  restricted_simple_orbits: number[][];
  restricted_simple_multiplicities: [number, number][];
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

/** A diagram from labels, for the named checks written from the text of SPEC.md. */
function diagram(type: string, blackLabels: number[], tauLabels?: number[]): SatakeDiagram {
  const board = boardOf(type);
  const tau = tauLabels === undefined ? board.labels.map((_, i) => i) : toPositions(board, tauLabels);
  return { board, black: toPositions(board, blackLabels), tau };
}

const key = (v: readonly number[]): string => v.join(',');
const neg = (v: readonly number[]): number[] => v.map((x) => (x === 0 ? 0 : -x));
const allRoots = (board: Board): number[][] => roots(board, 100000).items;

/** The rank over the rationals of a list of integer vectors (Gaussian elimination, test-side). */
function rankOf(vectors: readonly (readonly number[])[]): number {
  const rows: Rational[][] = vectors.map((v) => v.map((x) => rat(x)));
  const n = rows[0]?.length ?? 0;
  let rk = 0;
  for (let col = 0; col < n; col++) {
    const piv = rows.findIndex((r, k) => k >= rk && r[col]!.num !== 0n);
    if (piv < 0) continue;
    [rows[rk], rows[piv]] = [rows[piv]!, rows[rk]!];
    for (let k = 0; k < rows.length; k++) {
      if (k === rk || rows[k]![col]!.num === 0n) continue;
      const f = ratDiv(rows[k]![col]!, rows[rk]![col]!);
      rows[k] = rows[k]!.map((x, j) => ratSub(x, ratMul(f, rows[rk]![j]!)));
    }
    rk += 1;
  }
  return rk;
}

/** The thrown value of f, or null. */
function caught(f: () => unknown): unknown {
  try {
    f();
  } catch (e) {
    return e;
  }
  return null;
}

/** The fields satake must return, in the order of the golden record from `rank` on (SPEC.md 6.4). */
const COMPUTED_FIELDS = (() => {
  const keys = Object.keys(RECORDS[0]!);
  return keys.slice(keys.indexOf('rank'));
})();

describe('satake computed fields', () => {
  it('computed fields of every record', () => {
    expect(RECORDS.length).toBe(167);
    expect(COMPUTED_FIELDS[COMPUTED_FIELDS.length - 1]).toBe('restricted_reflection_word_lengths');
    for (const rec of RECORDS) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const s: SatakeComputed = satake(d);
      // exactly the computed fields, no catalogue field (dynkin_type, cartan_label, real_form, ... are P6-A2's)
      expect(Object.keys(s), where).toEqual(COMPUTED_FIELDS);
      for (const f of ['rank', 'real_rank', 'n_restricted_roots', 'dim_g', 'dim_k', 'dim_p', 'character',
        'roots_compact_imaginary', 'roots_real', 'roots_complex'] as const) {
        intEq(s[f], rec[f], `${where}: ${f}`);
      }
      // identifiers, and a meaningful null compares as null (rules 6, 7)
      expect(s.restricted_type, where).toBe(rec.restricted_type);
      expect(s.multiplicities, where).toEqual(rec.multiplicities);
      expect(labels(board, s.w_X_word), where).toEqual(rec.w_X_word);
      expect(s.restricted_simple_orbits.map((o) => labels(board, o)), where).toEqual(rec.restricted_simple_orbits);
      intEq(s.restricted_simple_multiplicities, rec.restricted_simple_multiplicities, `${where}: restricted_simple_multiplicities`);
      intEq(s.restricted_cartan, rec.restricted_cartan, `${where}: restricted_cartan`);
      intEq(s.restricted_reflection_word_lengths, rec.restricted_reflection_word_lengths, `${where}: restricted_reflection_word_lengths`);
      const order = s.restricted_orbits_in_bourbaki_order === null ? null : s.restricted_orbits_in_bourbaki_order.map((o) => labels(board, o));
      if (rec.restricted_type_display === 'C2') {
        // SPEC.md 6.4 "Names in rank 2": on su(2,2), sp(4,R), sp(2,2) and so*(8) the stored restricted_board is C2
        // and the stored restricted_orbits_in_bourbaki_order is reversed by satakeRecord (P6-A2); the plain
        // function satake says B2, in identify's order
        expect(rec.restricted_board, where).toBe('C2');
        expect(s.restricted_board, where).toBe('B2');
        expect(order, where).toEqual([...rec.restricted_orbits_in_bourbaki_order!].reverse());
      } else {
        expect(s.restricted_board, where).toBe(rec.restricted_board);
        expect(order, where).toEqual(rec.restricted_orbits_in_bourbaki_order);
      }
    }
    // the four records of the exception, by name
    expect(RECORDS.filter((r) => r.restricted_type_display === 'C2').map((r) => r.real_form).sort()).toEqual(
      ['so*(8)', 'sp(2,2)', 'sp(4,R)', 'su(2,2)'],
    );
  });

  it('real rank is the dimension of the span of the shadows', () => {
    for (const rec of RECORDS) {
      const { board, d } = diagramOf(rec);
      const distinct = new Map<string, number[]>();
      for (const a of allRoots(board)) {
        const s = shadow2(d, a);
        if (s.some((x) => x !== 0)) distinct.set(key(s), s);
      }
      const s = satake(d);
      expect(rankOf([...distinct.values()]), `${rec.dynkin_type} ${rec.real_form}`).toBe(s.real_rank);
      expect(distinct.size).toBe(s.n_restricted_roots);
    }
  });

  it('dimension identities', () => {
    for (const rec of RECORDS) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const s = satake(diagramOf(rec).d);
      expect(s.dim_k + s.dim_p, where).toBe(s.dim_g);
      expect(s.character, where).toBe(2 * s.real_rank - s.rank - s.roots_compact_imaginary);
      expect(s.multiplicities.reduce((t, m) => t + m.roots * m.mult, 0), where).toBe(s.dim_g - s.rank - s.roots_compact_imaginary);
      expect(s.multiplicities.reduce((t, m) => t + m.roots, 0), where).toBe(s.n_restricted_roots);
      expect(s.roots_compact_imaginary + s.roots_real + s.roots_complex, where).toBe(s.dim_g - s.rank);
      expect(s.restricted_simple_orbits.length, where).toBe(s.real_rank);
    }
  });

  it('zero shadows are the black roots', () => {
    for (const rec of RECORDS) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      const X = [...d.black].sort((a, b) => a - b);
      const blackPositive = X.length === 0 ? [] : positiveRoots(subBoard(board, X), 100000);
      const s = satake(d);
      expect(s.roots_compact_imaginary, where).toBe(2 * blackPositive.length);
      // the roots with zero shadow are exactly the roots of the black sub-board, in full coordinates
      const embedded = new Set<string>();
      for (const r of blackPositive) {
        const v = board.labels.map(() => 0);
        X.forEach((i, k) => {
          v[i] = r[k]!;
        });
        embedded.add(key(v));
        embedded.add(key(neg(v)));
      }
      const zero = new Set(allRoots(board).filter((a) => shadow2(d, a).every((x) => x === 0)).map(key));
      expect([...zero].sort(), where).toEqual([...embedded].sort());
    }
  });
});

describe('named checks', () => {
  it('Appendix A.5', () => {
    // su(1,2): A2, no black node, tau exchanges the two nodes; theta(p1, p2) = -(p2, p1)
    const su12 = diagram('A2', [], [2, 1]);
    expect(theta(su12, [0, 1])).toEqual([-1, 0]);
    expect(theta(su12, [1, 0])).toEqual([0, -1]);
    expect(theta(su12, [1, 1])).toEqual([-1, -1]);
    expect(shadow2(su12, [0, 1])).toEqual([1, 1]); // the shadow (1/2, 1/2), doubled
    expect(shadow2(su12, [1, 0])).toEqual([1, 1]);
    expect(shadow2(su12, [1, 1])).toEqual([2, 2]);
    let s = satake(su12);
    expect(s.real_rank).toBe(1);
    expect(s.restricted_type).toBe('BC1');
    expect(s.multiplicities).toEqual([{ class: 'short', roots: 2, mult: 2 }, { class: 'long', roots: 2, mult: 1 }]);
    expect(s.dim_k).toBe(4);
    // su*(4): A3, black nodes 1 and 3, tau the identity; the word of w_X is 1, 3
    const sustar4 = diagram('A3', [1, 3]);
    expect(theta(sustar4, [0, 1, 0])).toEqual([-1, -1, -1]);
    expect(theta(sustar4, [0, 1, 1])).toEqual([-1, -1, 0]);
    expect(theta(sustar4, [1, 1, 0])).toEqual([0, -1, -1]);
    expect(theta(sustar4, [1, 1, 1])).toEqual([0, -1, 0]);
    expect(theta(sustar4, [1, 0, 0])).toEqual([1, 0, 0]);
    expect(theta(sustar4, [0, 0, 1])).toEqual([0, 0, 1]);
    expect(shadow2(sustar4, [0, 1, 0])).toEqual([1, 2, 1]);
    expect(shadow2(sustar4, [1, 0, 0])).toEqual([0, 0, 0]);
    s = satake(sustar4);
    expect(s.w_X_word).toEqual([0, 2]);
    expect(s.real_rank).toBe(1);
    expect(s.restricted_type).toBe('A1');
    expect(s.multiplicities).toEqual([{ class: 'all', roots: 2, mult: 4 }]);
    expect(s.dim_k).toBe(10);
    // su(1,3): A3, black node 2, tau the flip; the word of w_X is 2
    const su13 = diagram('A3', [2], [3, 2, 1]);
    expect(theta(su13, [0, 0, 1])).toEqual([-1, -1, 0]);
    expect(theta(su13, [0, 1, 1])).toEqual([-1, 0, 0]);
    expect(theta(su13, [1, 0, 0])).toEqual([0, -1, -1]);
    expect(theta(su13, [1, 1, 0])).toEqual([0, 0, -1]);
    expect(theta(su13, [0, 1, 0])).toEqual([0, 1, 0]);
    expect(theta(su13, [1, 1, 1])).toEqual([-1, -1, -1]);
    expect(shadow2(su13, [0, 0, 1])).toEqual([1, 1, 1]);
    expect(shadow2(su13, [1, 1, 1])).toEqual([2, 2, 2]);
    s = satake(su13);
    expect(s.w_X_word).toEqual([1]);
    expect(s.real_rank).toBe(1);
    expect(s.restricted_type).toBe('BC1');
    expect(s.multiplicities).toEqual([{ class: 'short', roots: 2, mult: 4 }, { class: 'long', roots: 2, mult: 1 }]);
    expect(s.dim_k).toBe(9);
  });

  it('e6(-26)', () => {
    const d = diagram('E6', [2, 3, 4, 5]);
    const s = satake(d);
    expect(s.w_X_word.length).toBe(12);
    expect(s.restricted_reflection_word_lengths).toEqual([8, 8]);
    expect(s.restricted_board).toBe('A2');
    expect(s.multiplicities).toEqual([{ class: 'all', roots: 6, mult: 8 }]);
    // each composite word is the 12 letters of w_X then the 20 of w_{X u O} (a D5), 32 letters, reduced length 8
    expect(restrictedBoard(d).compositeWords.map((w) => w.length)).toEqual([32, 32]);
  });

  it('theta orders its stages: permute by tau, then play w_X, then negate', () => {
    // a tau of order 3 tells "q[tau[i]] = p[i]" from "q[i] = p[tau[i]]": D4, the rotation 1 -> 3 -> 4 -> 1
    const rot = diagram('D4', [], [3, 2, 4, 1]);
    expect(theta(rot, [1, 0, 0, 0])).toEqual([0, 0, -1, 0]);
    // on su(1,3) the black node 2 is played after the flip: -s_2 of the flipped e_3
    expect(theta(diagram('A3', [2], [3, 2, 1]), [0, 0, 1])).toEqual([-1, -1, 0]);
    // where tau moves the black set (A3, black node 1, the flip; theta does not check admissibility) the two
    // orders differ: permuting first gives the oracle's values, playing w_X first would give their negatives
    // on the first three (values of the oracle's theta)
    const moved = diagram('A3', [1], [3, 2, 1]);
    expect(theta(moved, [1, 0, 0])).toEqual([0, 0, -1]);
    expect(theta(moved, [0, 1, 0])).toEqual([-1, -1, 0]);
    expect(theta(moved, [0, 0, 1])).toEqual([1, 0, 0]);
    expect(theta(moved, [1, 1, 0])).toEqual([-1, -1, -1]);
  });
});

describe('refusals', () => {
  // The rows of the table of SPEC.md 2.15 that are not admissible, written from that table (labels)
  const NOT_ADMISSIBLE: [string, number[], number[] | undefined][] = [
    ['A3', [1], undefined], ['A3', [1, 2], undefined], ['A3', [1], [3, 2, 1]], ['A2', [1], undefined],
    ['C3', [3], undefined], ['D5', [1, 2, 3, 4, 5], undefined], ['G2', [2], undefined], ['G2', [1], undefined],
  ];

  it('refuses non-admissible pairs', () => {
    for (const [T, X, tau] of NOT_ADMISSIBLE) {
      const d = diagram(T, X, tau);
      const a = admissibility(d);
      expect(a.admissible).toBe(false);
      const first = (['symmetry', 'condition_1', 'condition_2', 'condition_3'] as const).find((k) => !a[k])!;
      for (const f of [satake, restrictedBoard]) {
        const e = caught(() => f(d));
        expect(e, `${T} ${JSON.stringify(X)}`).toBeInstanceOf(NotAdmissible);
        expect(e).toBeInstanceOf(EngineError);
        expect((e as NotAdmissible).data).toEqual(a);
        expect((e as Error).message).toBe(`not admissible: ${first}`);
      }
    }
    expect((caught(() => satake(diagram('A3', [1], [3, 2, 1]))) as Error).message).toBe('not admissible: condition_1');
    expect((caught(() => satake(diagram('A2', [1]))) as Error).message).toBe('not admissible: condition_3');
    // a tau that is not a symmetry of the board
    expect((caught(() => satake(diagram('A3', [], [2, 1, 3]))) as Error).message).toBe('not admissible: symmetry');
  });

  it('theta on A2 black 1 is -s1', () => {
    const d = diagram('A2', [1]);
    const board = d.board;
    const R = allRoots(board);
    const images = new Set<string>();
    for (const a of R) {
      const t = theta(d, a);
      expect(t).toEqual(neg(mutate(board, a, 0)));
      expect(theta(d, t)).toEqual(a);
      images.add(key(t));
    }
    // an involution that permutes the roots (SPEC.md 2.15 "What a failed condition 3 means")
    expect([...images].sort()).toEqual(R.map(key).sort());
    for (const p of [[3, -7], [0, 5], [-2, -2], [9, 1]]) expect(theta(d, p)).toEqual(neg(mutate(board, p, 0)));
    expect(caught(() => satake(d))).toBeInstanceOf(NotAdmissible);
  });

  it('G2 generalized pairs are refused', () => {
    const spy = vi.mocked(restrictedType.classifyRestricted);
    for (const X of [[2], [1]]) {
      const d = diagram('G2', X);
      spy.mockClear();
      for (const f of [satake, restrictedBoard]) {
        const e = caught(() => f(d));
        expect(e).toBeInstanceOf(NotAdmissible);
        expect((e as Error).message).toBe('not admissible: condition_3');
      }
      // the refusal comes from the admissibility check, before any shadow is classified
      expect(spy).not.toHaveBeenCalled();
    }
    // why that order matters (SPEC.md 2.15, generalized diagrams): the shadows of G2 with the short node 1
    // black look like BC1 to the ported classifier, and with the long node 2 black they fail its own check
    const shadowsOf = (X: number[]): number[][] => {
      const d = diagram('G2', X);
      const S = new Map<string, number[]>();
      for (const a of allRoots(d.board)) {
        const s = shadow2(d, a);
        if (s.some((x) => x !== 0)) S.set(key(s), s);
      }
      return [...S.values()];
    };
    const B = gram(boardOf('G2'))!;
    expect(restrictedType.classifyRestricted(shadowsOf([1]), B, 1).name).toBe('BC1');
    expect(caught(() => restrictedType.classifyRestricted(shadowsOf([2]), B, 1))).toBeInstanceOf(EngineError);
    // an admissible pair does reach it
    spy.mockClear();
    satake(diagram('G2', []));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('special shapes', () => {
  it('split forms have theta = -1', () => {
    const split = RECORDS.filter((r) => r.black_nodes.length === 0 && r.tau.every((t, k) => t === k + 1));
    expect(split.length).toBeGreaterThan(0);
    for (const rec of split) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      for (const a of allRoots(board)) expect(theta(d, a), where).toEqual(neg(a));
      const s = satake(d);
      for (const m of s.multiplicities) expect(m.mult, where).toBe(1);
      for (const pair of s.restricted_simple_multiplicities) expect(pair, where).toEqual([1, 0]);
      // the restricted roots are the roots themselves: r = n, and as many restricted roots as roots
      expect(s.real_rank, where).toBe(s.rank);
      expect(s.n_restricted_roots, where).toBe(s.dim_g - s.rank);
    }
  });

  it('compact forms have theta = 1 on roots', () => {
    const compact = RECORDS.filter((r) => r.black_nodes.length === r.rank);
    expect(compact.length).toBeGreaterThan(0);
    for (const rec of compact) {
      const where = `${rec.dynkin_type} ${rec.real_form}`;
      const { board, d } = diagramOf(rec);
      for (const a of allRoots(board)) expect(theta(d, a), where).toEqual(a);
      const s = satake(d);
      expect(s.real_rank, where).toBe(0);
      expect(s.n_restricted_roots, where).toBe(0);
      expect(s.restricted_type, where).toBeNull();
      expect(s.restricted_board, where).toBeNull();
      expect(s.restricted_orbits_in_bourbaki_order, where).toBeNull();
      expect(s.multiplicities, where).toEqual([]);
      expect(s.restricted_simple_orbits, where).toEqual([]);
      expect(s.restricted_simple_multiplicities, where).toEqual([]);
      expect(s.restricted_reflection_word_lengths, where).toEqual([]);
      // an empty list, not null, as the golden record of su(4) shows
      expect(s.restricted_cartan, where).toEqual([]);
      expect(s.dim_k, where).toBe(s.dim_g);
      expect(s.dim_p, where).toBe(0);
    }
  });

  it('quasi-split forms restrict to the averaged roots', () => {
    const rows = (golden.folding as { type: string; symmetry: number[]; order: number; averaged_roots_type: string }[]).filter((r) => r.order === 2);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const board = boardOf(row.type);
      const tau = toPositions(board, row.symmetry);
      const s = satake({ board, black: [], tau });
      expect(s.restricted_type, row.type).toBe(row.averaged_roots_type);
      expect(s.restricted_type, row.type).toBe(averagedRootsType(board, tau).name);
    }
  });
});
