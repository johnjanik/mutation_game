// The golden key `folding` (SPEC.md 2.13, 5.2 "for fold, folded.cartan is compared with folded_cartan and
// identify(folded) with folds_to", 5.3 symmetries, 5.4 fold, averagedRootsType, averagedSimpleCartan,
// 5.7 phase 4 and rules 1, 2, 4 to 7, Appendix G; P4-A1 instruction 5.2 to 5.5 and 5.14). Every field of
// the nine rows except quasi_split_real_form (phase 6, P6-A1) is reproduced; rows are matched by `type`
// and `symmetry` (rule 5), node lists are converted with the harness's labels() and toPositions (rule 2,
// E-7), and `reason` is compared as a plan check only (rule 6 makes it documentation).
import { describe, expect, it } from 'vitest';
import { SafeInt } from '../../src/arith';
import type { AnyBoard } from '../../src/board';
import { cartanNumbers, fromAdjacency, toLabels, toPositions } from '../../src/board';
import { CAPS } from '../../src/caps';
import { identify } from '../../src/classify';
import { averagedRootsType, averagedSimpleCartan, fold, symmetries } from '../../src/fold';
import { TYPE_NAMES, boardOf, covers, golden, intEq, labels, matchRecord } from './_harness';

covers('folding');

interface AveragedClass {
  class: string;
  roots: number;
  form_value: string;
}

interface FoldingRecord {
  type: string;
  symmetry: number[];
  order: number;
  orbits: number[][];
  averaged_roots_type: string;
  averaged_simple_cartan: number[][];
  averaged_root_classes: AveragedClass[];
  quasi_split_real_form: string | null;
  folds_to: string | null;
  folded_cartan: number[][] | null;
  folded_orbits_in_bourbaki_order: number[][] | null;
  reason: string | null;
}

const ROWS = golden.folding as FoldingRecord[];

/** The transpose of an integer matrix (test-side). */
function transpose(M: readonly (readonly number[])[]): number[][] {
  return M.map((_, i) => M.map((row) => row[i]!));
}

/** The least k >= 1 with tau^k the identity (plan check of `order`). */
function orderOf(tau: readonly number[]): number {
  let k = 1;
  let pw = [...tau];
  while (pw.some((x, i) => x !== i)) {
    pw = pw.map((x) => tau[x]!);
    k += 1;
  }
  return k;
}

/**
 * The group sizes of the symmetries of the named finite boards: SPEC.md 4 T11 offers exactly A2 to A8,
 * D4 to D8 and E6 as "the named types that have a symmetry other than the identity"; the sizes 2 and 6
 * are the oracle's automorphisms (P4-A1 instruction 5.2). Every other type has the identity alone.
 */
function expectedGroupSize(T: string): number {
  if (T === 'D4') return 6;
  if (/^A[2-8]$/.test(T) || /^D[5-8]$/.test(T) || T === 'E6') return 2;
  return 1;
}

/** The 9-node star of the plan (P4-A1 instruction 5.2): node 0 joined both ways to nodes 1 to 8. */
function star9(): AnyBoard {
  const A: number[][] = [];
  for (let i = 0; i < 9; i++) {
    const row: number[] = [];
    for (let j = 0; j < 9; j++) row.push(i !== j && (i === 0 || j === 0) ? 1 : 0);
    A.push(row);
  }
  return fromAdjacency(A);
}

describe('folding rows', () => {
  it('there are nine rows, each identified by type and symmetry', () => {
    expect(ROWS.length).toBe(9);
    for (const row of ROWS) expect(matchRecord(ROWS, { type: row.type, symmetry: row.symmetry })).toBe(row);
  });

  for (const row of ROWS) {
    describe(`folding row ${row.type} ${JSON.stringify(row.symmetry)}`, () => {
      const rec = matchRecord(ROWS, { type: row.type, symmetry: row.symmetry });
      const board = boardOf(rec.type);
      const tau = toPositions(board, rec.symmetry);

      it("symmetries contain the row's symmetry", () => {
        const all = symmetries(board);
        expect(all.length).toBe(expectedGroupSize(rec.type));
        expect(all.map((s) => [...s])).toContainEqual(tau);
        expect([...all[0]!]).toEqual(board.labels.map((_, k) => k));
      });

      it('order', () => {
        expect(orderOf(tau)).toBe(rec.order);
      });

      it('orbits, in the order given, as labels', () => {
        const res = fold(board, tau);
        expect(res.orbits.map((o) => labels(board, o))).toEqual(rec.orbits);
      });

      if (rec.folds_to === null) {
        it('does not fold: an orbit contains an edge', () => {
          const res = fold(board, tau);
          expect(res.folded).toBeNull();
          // rule 6 makes `reason` documentation; the text is a plan check (P4-A1 instruction 5.3)
          expect(res.reason).toBe(rec.reason);
          // rule 7: the nulls of a board that does not fold
          expect(rec.folded_cartan).toBeNull();
          expect(rec.folded_orbits_in_bourbaki_order).toBeNull();
        });
      } else {
        it('folds to the board named in folds_to, with the folded Cartan matrix in orbit order', () => {
          const res = fold(board, tau);
          expect(res.reason).toBeNull();
          const folded = res.folded;
          expect(folded).not.toBeNull();
          const f = folded!;
          expect(identify(f)?.name).toBe(rec.folds_to);
          intEq(cartanNumbers(f), rec.folded_cartan);
          expect(f.arith).toBe(SafeInt);
          expect(f.kind).toBe('gcm');
          expect(f.n).toBe(res.orbits.length);
          expect(f.name).toBe(rec.folds_to);
          // labels: a permutation of 1..m giving the Bourbaki order of the type identify names (E-7)
          expect([...f.labels].sort((x, y) => x - y)).toEqual(f.labels.map((_, k) => k + 1));
          const id = identify(f)!;
          expect(toLabels(f, id.order)).toEqual(f.labels.map((_, k) => k + 1));
        });

        it('folded_orbits_in_bourbaki_order', () => {
          const res = fold(board, tau);
          const f = res.folded!;
          const positions = f.labels.map((_, t) => t).sort((s, t) => f.labels[s]! - f.labels[t]!);
          expect(positions.map((t) => labels(board, res.orbits[t]!))).toEqual(rec.folded_orbits_in_bourbaki_order);
        });

        it('averaged simple Cartan is the transpose of the folded matrix', () => {
          // SPEC.md 2.13 (b) [V]: when the board folds, the Cartan matrix of the averaged simple roots is
          // the transpose of the folded Cartan matrix
          const res = fold(board, tau);
          expect(averagedSimpleCartan(board, tau)).toEqual(transpose(cartanNumbers(res.folded!)));
        });
      }

      it('averaged_roots_type and averaged_root_classes', () => {
        const avg = averagedRootsType(board, tau);
        expect(avg.name).toBe(rec.averaged_roots_type);
        expect(avg.classes.length).toBe(rec.averaged_root_classes.length);
        rec.averaged_root_classes.forEach((c, k) => {
          const got = avg.classes[k]!;
          expect(got.class).toBe(c.class);
          intEq(got.roots, c.roots);
          expect(got.form_value).toBe(c.form_value);
        });
      });

      it('averaged_simple_cartan', () => {
        intEq(averagedSimpleCartan(board, tau), rec.averaged_simple_cartan);
      });
    });
  }
});

describe('symmetries', () => {
  it('group sizes of the T11 boards', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const all = symmetries(b);
      expect(all.length, T).toBe(expectedGroupSize(T));
      expect([...all[0]!], T).toEqual(b.labels.map((_, k) => k));
      // each is a symmetry: C[t[i]][t[j]] = C[i][j] (the oracle's automorphisms)
      const C = cartanNumbers(b);
      for (const s of all) expect(C.every((row, i) => row.every((x, j) => C[s[i]!]![s[j]!] === x)), T).toBe(true);
    }
    // D4: the permutations of the three outer nodes, in lexicographic order (oracle automorphisms)
    expect(symmetries(boardOf('D4')).map((s) => [...s])).toEqual([
      [0, 1, 2, 3], [0, 1, 3, 2], [2, 1, 0, 3], [2, 1, 3, 0], [3, 1, 0, 2], [3, 1, 2, 0],
    ]);
  });

  it('symmetries default limit is 10000', () => {
    // E-6: "relabellings and symmetries take a limit on the number of results (default 10000)"; the star
    // with eight arms has 8! = 40320 symmetries
    const star = star9();
    const byDefault = symmetries(star);
    expect(CAPS.relabellingsDefault).toBe(10000);
    expect(byDefault.length).toBe(10000);
    expect(byDefault.map((s) => [...s])).toEqual(symmetries(star, CAPS.relabellingsDefault).map((s) => [...s]));
    expect(symmetries(star, 50000).length).toBe(40320);
    expect(symmetries(star, 5).map((s) => [...s])).toEqual(byDefault.slice(0, 5).map((s) => [...s]));
    expect([...byDefault[0]!]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
