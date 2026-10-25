// The golden key `satake`: all 167 records of the Satake catalogue, every one of their 27 fields, through
// satakeCatalogue and satakeRecord (SPEC.md 6.4 in full: the parametric table, "Names in rank 2", "Coincidences",
// "Fields of a catalogue record"; 6.5; Appendix B; 2.15 "What the diagram does not show"; 5.4 "Satake functions
// (phase 6)"; 5.7 phase 6 and rules 1, 2, 5, 6, 7; Appendix G; P6-A2 instruction 5.3, 5.4, 5.8, 6).
// Records are matched by dynkin_type and real_form (rule 5); node fields are converted with the harness's labels()
// (rule 2); identifiers compare exactly (rule 6); a null that carries meaning compares as null (rule 7).
// This file registers `satake` (CONTRACTS.md 3; P6-A1's files compare its computed fields without covers(), see
// DECISIONS.md "MERGE: P6 stage 6.1, P6-A1").
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import type { SatakeComputed } from '../../src/satake';
import { admissibility, satake } from '../../src/satake';
import type { SatakeCatalogueEntry, SatakeRecord } from '../../src/satakeCatalogue';
import { satakeCatalogue, satakeRecord } from '../../src/satakeCatalogue';
import { TYPE_NAMES, boardOf, covers, golden, intEq, labels, matchRecord } from './_harness';

covers('satake');

interface GoldenSatakeRecord {
  dynkin_type: string;
  cartan_label: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  arrows: [number, number][];
  tau_moves_black_nodes: boolean;
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

const GOLDEN = golden.satake as GoldenSatakeRecord[];

interface Computed {
  type: string;
  board: Board;
  entry: SatakeCatalogueEntry;
  rec: SatakeRecord;
}

// Every record is computed once per file and reused (P6-A2 instruction, trap 17: E7 and E8 are the costly ones).
let cache: Computed[] | null = null;
function computed(): Computed[] {
  if (cache === null) {
    cache = [];
    for (const type of TYPE_NAMES) {
      const board = boardOf(type);
      for (const entry of satakeCatalogue(type)) cache.push({ type, board, entry, rec: satakeRecord(type, entry) });
    }
  }
  return cache;
}

/** The 19 fields of satake's result (SPEC.md 6.4, from rank to restricted_reflection_word_lengths). */
const COMPUTED_FIELDS = (() => {
  const keys = Object.keys(GOLDEN[0]!);
  return keys.slice(keys.indexOf('rank')) as (keyof SatakeComputed)[];
})();

const isIdentity = (t: readonly number[]): boolean => t.every((x, i) => x === i);

/** Letter and rank of a finite type name, for the rules of SPEC.md 2.15 written as formulas. */
function letterRank(type: string): { L: string; n: number } {
  const m = /^([A-G])(\d+)$/.exec(type)!;
  return { L: m[1]!, n: Number(m[2]) };
}

describe('the catalogue', () => {
  it('catalogue order: each type gives its entries in the order of the golden records of that type', () => {
    for (const type of TYPE_NAMES) {
      const got = satakeCatalogue(type).map((e) => e.real_form);
      const expected = GOLDEN.filter((g) => g.dynkin_type === type).map((g) => g.real_form);
      expect(got, type).toEqual(expected);
    }
  });

  it('an entry has exactly the five fields of the contract (no expected multiplicities or dim k)', () => {
    for (const type of TYPE_NAMES) {
      for (const e of satakeCatalogue(type)) {
        expect(Object.keys(e), `${type} ${e.real_form}`).toEqual(['cartan_label', 'real_form', 'black_nodes', 'tau', 'restricted_type_display']);
        // positions 0..n-1, black sorted, tau a permutation
        const n = boardOf(type).n;
        expect([...e.black_nodes].sort((a, b) => a - b)).toEqual(e.black_nodes);
        expect([...e.tau].sort((a, b) => a - b)).toEqual(boardOf(type).labels.map((_, i) => i));
        expect(e.black_nodes.every((i) => Number.isInteger(i) && i >= 0 && i < n)).toBe(true);
      }
    }
  });

  it('every entry is admissible', () => {
    for (const { type, board, entry } of computed()) {
      const a = admissibility({ board, black: entry.black_nodes, tau: entry.tau });
      expect(a.admissible, `${type} ${entry.real_form}`).toBe(true);
    }
  });
});

describe('satake records', () => {
  it('the 167 records and no others', () => {
    const got = computed().map(({ rec }) => `${rec.dynkin_type} ${rec.real_form}`);
    const expected = GOLDEN.map((g) => `${g.dynkin_type} ${g.real_form}`);
    expect(new Set(got).size).toBe(got.length);
    expect([...got].sort()).toEqual([...expected].sort());
    expect(got.length).toBe(GOLDEN.length);
    // SPEC.md 6.4: "key satake, 167 records, compact forms included"
    expect(got.length).toBe(167);
  });

  it('field names of a record: the 27 names of the golden record, in its order, and no other', () => {
    for (const { rec } of computed()) {
      const g = matchRecord(GOLDEN, { dynkin_type: rec.dynkin_type, real_form: rec.real_form });
      expect(Object.keys(rec), `${rec.dynkin_type} ${rec.real_form}`).toEqual(Object.keys(g));
    }
    expect(Object.keys(GOLDEN[0]!).length).toBe(27);
  });

  it('every field of every record', () => {
    const checked = new Set<string>();
    const seen = (...f: string[]): void => f.forEach((x) => checked.add(x));
    for (const { type, board, rec } of computed()) {
      const where = `${type} ${rec.real_form}`;
      const g = matchRecord(GOLDEN, { dynkin_type: type, real_form: rec.real_form });
      // identifiers (rule 6); a meaningful null compares as null (rule 7)
      expect(rec.dynkin_type, where).toBe(g.dynkin_type);
      expect(rec.dynkin_type, where).toBe(type);
      expect(rec.cartan_label, where).toBe(g.cartan_label);
      expect(rec.real_form, where).toBe(g.real_form);
      expect(rec.restricted_type, where).toBe(g.restricted_type);
      expect(rec.restricted_type_display, where).toBe(g.restricted_type_display);
      expect(rec.restricted_board, where).toBe(g.restricted_board);
      seen('dynkin_type', 'cartan_label', 'real_form', 'restricted_type', 'restricted_type_display', 'restricted_board');
      // node fields, converted to labels (rule 2)
      expect(labels(board, rec.black_nodes), where).toEqual(g.black_nodes);
      expect(labels(board, rec.tau), where).toEqual(g.tau);
      expect(rec.arrows.map((p) => labels(board, p)), where).toEqual(g.arrows);
      expect(labels(board, rec.w_X_word), where).toEqual(g.w_X_word);
      expect(rec.restricted_simple_orbits.map((o) => labels(board, o)), where).toEqual(g.restricted_simple_orbits);
      if (g.restricted_orbits_in_bourbaki_order === null) {
        expect(rec.restricted_orbits_in_bourbaki_order, where).toBeNull();
      } else {
        expect(rec.restricted_orbits_in_bourbaki_order, where).not.toBeNull();
        expect(rec.restricted_orbits_in_bourbaki_order!.map((o) => labels(board, o)), where).toEqual(g.restricted_orbits_in_bourbaki_order);
      }
      seen('black_nodes', 'tau', 'arrows', 'w_X_word', 'restricted_simple_orbits', 'restricted_orbits_in_bourbaki_order');
      // booleans and integers exactly (rule 1)
      expect(rec.tau_moves_black_nodes, where).toBe(g.tau_moves_black_nodes);
      for (const f of ['rank', 'real_rank', 'n_restricted_roots', 'dim_g', 'dim_k', 'dim_p', 'character',
        'roots_compact_imaginary', 'roots_real', 'roots_complex'] as const) {
        intEq(rec[f], g[f], `${where}: ${f}`);
        seen(f);
      }
      seen('tau_moves_black_nodes');
      // lists in order (rule 5): one entry per length class, with its class (an identifier), roots and mult
      expect(rec.multiplicities.length, where).toBe(g.multiplicities.length);
      rec.multiplicities.forEach((m, k) => {
        const gm = g.multiplicities[k]!;
        expect(Object.keys(m), where).toEqual(Object.keys(gm));
        expect(m.class, where).toBe(gm.class);
        intEq(m.roots, gm.roots, `${where}: multiplicities[${k}].roots`);
        intEq(m.mult, gm.mult, `${where}: multiplicities[${k}].mult`);
      });
      intEq(rec.restricted_simple_multiplicities, g.restricted_simple_multiplicities, `${where}: restricted_simple_multiplicities`);
      intEq(rec.restricted_cartan, g.restricted_cartan, `${where}: restricted_cartan`);
      intEq(rec.restricted_reflection_word_lengths, g.restricted_reflection_word_lengths, `${where}: restricted_reflection_word_lengths`);
      seen('multiplicities', 'restricted_simple_multiplicities', 'restricted_cartan', 'restricted_reflection_word_lengths');
    }
    // every one of the 27 fields was compared
    expect([...checked].sort()).toEqual(Object.keys(GOLDEN[0]!).sort());
  });

  it('worked values of the instruction: e6(-14), su(2,2), su(4)', () => {
    const rec = (type: string, form: string): { board: Board; rec: SatakeRecord } => {
      const c = computed().find((x) => x.type === type && x.rec.real_form === form)!;
      return { board: c.board, rec: c.rec };
    };
    const e6 = rec('E6', 'e6(-14)');
    const g = matchRecord(GOLDEN, { dynkin_type: 'E6', real_form: 'e6(-14)' });
    // tau exchanges the black nodes 3 and 5 as well as the white nodes 1 and 6; one arrow is drawn
    expect(labels(e6.board, e6.rec.tau)).toEqual(g.tau);
    expect(e6.rec.arrows.map((p) => labels(e6.board, p))).toEqual(g.arrows);
    expect(e6.rec.arrows.length).toBe(1);
    expect(e6.rec.tau_moves_black_nodes).toBe(true);
    expect(e6.rec.restricted_board).toBe('B2');
    const su22 = rec('A3', 'su(2,2)');
    expect(su22.rec.restricted_board).toBe('C2');
    expect(su22.rec.restricted_type).toBe('B2');
    const su4 = rec('A3', 'su(4)');
    expect(su4.rec.arrows).toEqual([]);
    expect(su4.rec.tau_moves_black_nodes).toBe(true);
    expect(isIdentity(su4.rec.tau)).toBe(false);
  });
});

describe('SPEC.md 6.4 rules', () => {
  it('the C2 adjustment', () => {
    const recs = computed();
    // SPEC.md 6.4 "Names in rank 2": C2 is displayed exactly for su(2,2), sp(4,R), sp(2,2) and so*(8)
    const c2 = recs.filter(({ rec }) => rec.restricted_type_display === 'C2').map(({ rec }) => rec.real_form).sort();
    expect(c2).toEqual(['so*(8)', 'sp(2,2)', 'sp(4,R)', 'su(2,2)']);
    expect(recs.filter(({ rec }) => rec.restricted_board === 'C2').map(({ rec }) => rec.real_form).sort()).toEqual(c2);
    // so(2,q) keeps B2 (display B2, board B2)
    const so2q = recs.filter(({ rec }) => /^so\(2,\d+\)$/.test(rec.real_form));
    expect(so2q.length).toBeGreaterThan(0);
    for (const { rec } of so2q) {
      expect(rec.restricted_type_display, rec.real_form).toBe('B2');
      expect(rec.restricted_board, rec.real_form).toBe('B2');
    }
    for (const { type, board, entry, rec } of recs) {
      const where = `${type} ${rec.real_form}`;
      const s = satake({ board, black: entry.black_nodes, tau: entry.tau });
      if (rec.restricted_type_display === 'C2') {
        // the computed type stays B2; only the board's name and the order of its two orbits change, on a copy
        expect(rec.restricted_type, where).toBe('B2');
        expect(s.restricted_type, where).toBe('B2');
        expect(s.restricted_board, where).toBe('B2');
        expect(rec.restricted_board, where).toBe('C2');
        expect(rec.restricted_orbits_in_bourbaki_order, where).toEqual([...s.restricted_orbits_in_bourbaki_order!].reverse());
        expect(rec.restricted_orbits_in_bourbaki_order, where).not.toEqual(s.restricted_orbits_in_bourbaki_order);
        for (const f of COMPUTED_FIELDS) {
          if (f === 'restricted_board' || f === 'restricted_orbits_in_bourbaki_order') continue;
          expect(rec[f], `${where}: ${f}`).toEqual(s[f]);
        }
      } else {
        // everywhere else the display is the computed type, and the record carries satake's fields unchanged
        expect(rec.restricted_type_display, where).toBe(rec.restricted_type);
        for (const f of COMPUTED_FIELDS) expect(rec[f], `${where}: ${f}`).toEqual(s[f]);
      }
    }
    // su(2,2): satake lists the orbits [[2], [1, 3]] in identify's order, the record [[1, 3], [2]], short node first
    const su22 = recs.find(({ rec }) => rec.real_form === 'su(2,2)')!;
    const s22 = satake({ board: su22.board, black: su22.entry.black_nodes, tau: su22.entry.tau });
    expect(s22.restricted_orbits_in_bourbaki_order!.map((o) => labels(su22.board, o))).toEqual([[2], [1, 3]]);
    expect(su22.rec.restricted_orbits_in_bourbaki_order!.map((o) => labels(su22.board, o))).toEqual([[1, 3], [2]]);
  });

  it('compact forms', () => {
    const compact = computed().filter(({ rec }) => rec.cartan_label === 'compact');
    // one compact form per type
    expect(compact.map(({ type }) => type)).toEqual([...TYPE_NAMES]);
    for (const { type, board, rec } of compact) {
      const where = `${type} ${rec.real_form}`;
      expect(rec.black_nodes, where).toEqual(board.labels.map((_, i) => i));
      expect(rec.arrows, where).toEqual([]);
      expect(rec.real_rank, where).toBe(0);
      for (const f of ['multiplicities', 'restricted_simple_orbits', 'restricted_simple_multiplicities', 'restricted_cartan',
        'restricted_reflection_word_lengths'] as const) {
        expect(rec[f], `${where}: ${f}`).toEqual([]);
      }
      for (const f of ['restricted_type', 'restricted_type_display', 'restricted_board', 'restricted_orbits_in_bourbaki_order'] as const) {
        expect(rec[f], `${where}: ${f}`).toBeNull();
      }
    }
    // and only the compact forms have no restricted type
    for (const { rec } of computed()) {
      if (rec.cartan_label !== 'compact') expect(rec.restricted_type, rec.real_form).not.toBeNull();
    }
  });

  it('tau hidden by the drawing (SPEC.md 2.15 "What the diagram does not show")', () => {
    const recs = computed().map(({ rec }) => rec);
    const hidden = recs.filter((r) => !isIdentity(r.tau) && r.arrows.length === 0).map((r) => r.real_form).sort();
    const both = recs.filter((r) => r.arrows.length > 0 && r.tau_moves_black_nodes).map((r) => r.real_form).sort();
    // the rules of 2.15 as formulas over the 32 types
    const expectedHidden: string[] = [];
    const expectedBoth: string[] = [];
    for (const type of TYPE_NAMES) {
      const { L, n } = letterRank(type);
      if (L === 'D') {
        for (let p = 1; p <= n - 2; p++) if ((n - p) % 2 === 1) expectedHidden.push(`so(${p},${2 * n - p})`);
        if (n % 2 === 1) expectedHidden.push(`so(${2 * n})`);
      }
      if (L === 'A' && n >= 2) {
        expectedHidden.push(`su(${n + 1})`);
        for (let p = 1; p <= Math.floor((n + 1) / 2); p++) if (n + 1 - p - p >= 3) expectedBoth.push(`su(${p},${n + 1 - p})`);
      }
      if (type === 'E6') {
        expectedHidden.push('e6(-78)');
        expectedBoth.push('e6(-14)');
      }
    }
    expect(hidden).toEqual(expectedHidden.sort());
    expect(both).toEqual(expectedBoth.sort());
    // arrows join white nodes only, each pair once, sorted; a black node is never on an arrow
    for (const r of recs) {
      for (const [i, j] of r.arrows) {
        expect(i < j, r.real_form).toBe(true);
        expect(r.tau[i], r.real_form).toBe(j);
        expect(r.black_nodes.includes(i) || r.black_nodes.includes(j), r.real_form).toBe(false);
      }
      const sorted = [...r.arrows].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      expect(r.arrows, r.real_form).toEqual(sorted);
      const expectedMoves = r.black_nodes.some((i) => r.tau[i] !== i);
      expect(r.tau_moves_black_nodes, r.real_form).toBe(expectedMoves);
    }
  });
});
