// The golden field `folding[*].quasi_split_real_form` (SPEC.md 2.13 (b): "For a symmetry of order 2, construction
// (b) is exactly the Satake diagram with no black nodes and arrows given by sigma (section 2.15): the averaged roots
// are the restricted roots of the quasi-split real form named in the table"; 5.7 phase 6 and rules 2, 5, 6, 7;
// Appendix G; P6-A2 instruction 5.8). For each of the nine rows, matched by type and symmetry (rule 5), the pair
// with no black node and tau the row's symmetry is matched against the catalogue (matchCatalogue); the computed
// value is the one real form found, or null when none is (rule 7: the rotation of order 3 of D4, whose tau fails
// condition 1). The rest of `folding` is covered by p4-folding.test.ts.
import { describe, expect, it } from 'vitest';
import { toPositions } from '../../src/board';
import { averagedRootsType } from '../../src/fold';
import { admissibility } from '../../src/satake';
import { matchCatalogue } from '../../src/satakeCatalogue';
import { boardOf, covers, golden, matchRecord } from './_harness';

covers('folding[*].quasi_split_real_form');

interface FoldingRow {
  type: string;
  symmetry: number[];
  order: number;
  averaged_roots_type: string;
  quasi_split_real_form: string | null;
}

const ROWS = golden.folding as FoldingRow[];

describe('folding[*].quasi_split_real_form', () => {
  it('quasi-split real form of every folding row', () => {
    expect(ROWS.length).toBe(9);
    for (const row of ROWS) {
      const where = `${row.type} ${JSON.stringify(row.symmetry)}`;
      expect(matchRecord(ROWS, { type: row.type, symmetry: row.symmetry }), where).toBe(row);
      const board = boardOf(row.type);
      const tau = toPositions(board, row.symmetry);
      const m = matchCatalogue({ board, black: [], tau });
      const computed = m.length === 1 ? m[0]!.real_form : null;
      // identifiers exactly (rule 6); the null of the rotation of order 3 compares as null (rule 7)
      expect(computed, where).toBe(row.quasi_split_real_form);
      if (row.order === 2) {
        // exactly one record, and it is a quasi-split form: no black node, the arrows of the symmetry
        expect(m.length, where).toBe(1);
        expect(m[0]!.black_nodes, where).toEqual([]);
        expect(m[0]!.tau, where).toEqual(tau);
        // its restricted roots are the averaged roots of the row (2.13 (b))
        expect(m[0]!.restricted_type, where).toBe(row.averaged_roots_type);
        expect(m[0]!.restricted_type, where).toBe(averagedRootsType(board, tau).name);
      } else {
        expect(m, where).toEqual([]);
        expect(admissibility({ board, black: [], tau }).condition_1, where).toBe(false);
      }
    }
    // the eight rows of order 2 and the one of order 3
    expect(ROWS.filter((r) => r.order === 2).length).toBe(8);
    expect(ROWS.filter((r) => r.quasi_split_real_form === null).map((r) => r.order)).toEqual([3]);
  });
});
