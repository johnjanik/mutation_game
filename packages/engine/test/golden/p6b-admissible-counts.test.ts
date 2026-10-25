// The golden key `admissible_counts` (SPEC.md 2.15 "Which pairs are real forms": the admissible pairs, up to
// symmetries of the board, are exactly the real forms; 6.4 "Coincidences"; 5.5 "The class of a Satake pair";
// 5.7 phase 6 and rule 1; Appendix G; P6-A2 instruction 5.8). For every one of the 32 types, as
// reference/verify.py does: every subset of the positions and every symmetry of the board that is an involution
// (the identity included); the pairs that admissibility accepts are grouped by canonicalPair; then
// real_forms_including_compact is the number of groups, catalogue_records the number of entries of
// satakeCatalogue, admissible_pairs_total the number of pairs. Also: the canonical pairs of the catalogue entries
// are exactly the groups; two entries share a canonical pair only on D4, and there exactly so(2,6) and so*(8);
// summed over the types, the records and the classes of the golden file (one record more than classes).
import { describe, expect, it } from 'vitest';
import { symmetries } from '../../src/fold';
import { admissibility } from '../../src/satake';
import { canonicalPair, satakeCatalogue } from '../../src/satakeCatalogue';
import { TYPE_NAMES, boardOf, covers, golden, intEq } from './_harness';

covers('admissible_counts');

interface Counts {
  real_forms_including_compact: number;
  catalogue_records: number;
  admissible_pairs_total: number;
}

const COUNTS = golden.admissible_counts as Record<string, Counts>;

interface Enumerated {
  groups: Map<string, number>; // canonical pair (as JSON) -> number of admissible pairs in it
  catalogue: Map<string, string[]>; // canonical pair -> the real forms of the catalogue entries in it
  records: number;
  pairs: number;
}

const cache = new Map<string, Enumerated>();
/** The enumeration of one type, done once per file (P6-A2 instruction, trap 17). */
function enumeratedOf(type: string): Enumerated {
  let found = cache.get(type);
  if (found === undefined) {
    const board = boardOf(type);
    const n = board.n;
    const invols = symmetries(board).filter((t) => t.every((x, i) => t[x] === i));
    const groups = new Map<string, number>();
    let pairs = 0;
    for (let mask = 0; mask < 1 << n; mask++) {
      const black: number[] = [];
      for (let i = 0; i < n; i++) if ((mask >> i) & 1) black.push(i);
      for (const tau of invols) {
        const d = { board, black, tau };
        if (!admissibility(d).admissible) continue;
        pairs += 1;
        const key = JSON.stringify(canonicalPair(d));
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
    }
    const catalogue = new Map<string, string[]>();
    const entries = satakeCatalogue(type);
    for (const e of entries) {
      const key = JSON.stringify(canonicalPair({ board, black: e.black_nodes, tau: e.tau }));
      catalogue.set(key, [...(catalogue.get(key) ?? []), e.real_form]);
    }
    found = { groups, catalogue, records: entries.length, pairs };
    cache.set(type, found);
  }
  return found;
}

/** Every type with its enumeration, in the order of the golden types. */
function enumerated(): [string, Enumerated][] {
  return TYPE_NAMES.map((type) => [type, enumeratedOf(type)]);
}

describe('admissible_counts', () => {
  it('has the 32 types, each with the three counts', () => {
    expect(Object.keys(COUNTS)).toEqual([...TYPE_NAMES]);
    for (const type of TYPE_NAMES) {
      expect(Object.keys(COUNTS[type]!).sort(), type).toEqual(['admissible_pairs_total', 'catalogue_records', 'real_forms_including_compact']);
    }
  });

  for (const type of TYPE_NAMES) {
    it(`counts of every type: ${type}`, () => {
      const e = enumeratedOf(type);
      intEq(e.groups.size, COUNTS[type]!.real_forms_including_compact, `${type}: real_forms_including_compact`);
      intEq(e.records, COUNTS[type]!.catalogue_records, `${type}: catalogue_records`);
      intEq(e.pairs, COUNTS[type]!.admissible_pairs_total, `${type}: admissible_pairs_total`);
    });
  }

  it('the catalogue covers every class of admissible pairs, and nothing else', () => {
    for (const [type, e] of enumerated()) {
      expect([...e.catalogue.keys()].sort(), type).toEqual([...e.groups.keys()].sort());
    }
  });

  it('one coincidence, on D4', () => {
    const merged: [string, string[]][] = [];
    for (const [type, e] of enumerated()) {
      for (const forms of e.catalogue.values()) if (forms.length > 1) merged.push([type, forms]);
    }
    // so(2,6) and so*(8) are the same real form through triality (SPEC.md 2.15, 6.4 "Coincidences")
    expect(merged).toEqual([['D4', ['so(2,6)', 'so*(8)']]]);
    // so on every other board the records are as many as the real forms, and on D4 one more
    for (const type of TYPE_NAMES) {
      const c = COUNTS[type]!;
      expect(c.catalogue_records - c.real_forms_including_compact, type).toBe(type === 'D4' ? 1 : 0);
    }
  });

  it('records and classes summed over the types: one record more than classes (SPEC.md 6.4 "Coincidences")', () => {
    let records = 0;
    let classes = 0;
    for (const [, e] of enumerated()) {
      records += e.records;
      classes += e.groups.size;
    }
    // both sums are read from the golden file, not typed (repair after review)
    const goldenClasses = Object.values(COUNTS).reduce((s, c) => s + c.real_forms_including_compact, 0);
    intEq(records, (golden.satake as unknown[]).length, 'records against the golden satake list');
    intEq(classes, goldenClasses, 'classes against the golden counts');
    expect(records - classes).toBe(1);
  });
});
