// The ten root keys of types[*] (SPEC.md 5.7, phase 1; P1-A1 instruction 5.10): roots, positiveRoots,
// highestRoot, highestShortRoot, toNumbers, transposeBoard, coxeterNumber, minusculeNodes on all 32 types.
// Rule 7: positive_roots is present on 16 types; the short-root fields on the 16 types with two root lengths.
import { describe, expect, it } from 'vitest';
import { CAPS } from '../../src/caps';
import { transposeBoard } from '../../src/board';
import { toNumbers } from '../../src/moves';
import { positiveRoots, roots } from '../../src/search';
import { coxeterNumber, highestRoot, highestShortRoot, minusculeNodes } from '../../src/finite';
import { TYPE_NAMES, boardOf, covers, golden, intEq, labels, sortedPositiveRoots } from './_harness';

covers(
  'types[*].n_roots',
  'types[*].n_positive_roots',
  'types[*].positive_roots',
  'types[*].highest_root',
  'types[*].highest_short_root',
  'types[*].numbers_of_highest_root',
  'types[*].numbers_of_highest_short_root',
  'types[*].highest_root_of_reversed_board',
  'types[*].coxeter_number',
  'types[*].minuscule_nodes',
);

const total = (v: readonly number[]): number => v.reduce((s, x) => s + x, 0);

describe('phase 1 root keys of types[*]', () => {
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;

    it(`roots of ${T}`, () => {
      const b = boardOf(T);
      const all = roots(b, CAPS.mainThreadItems);
      expect(all.truncated).toBe(false);
      intEq(all.items.length, rec.n_roots, 'n_roots');
      const pos = positiveRoots(b);
      intEq(pos.length, rec.n_positive_roots, 'n_positive_roots');
      intEq(2 * pos.length, rec.n_roots, 'F1: 2N roots');
      if (rec.positive_roots !== undefined) {
        intEq(pos, rec.positive_roots, 'positive_roots in order');
      } else {
        expect(pos).toEqual(sortedPositiveRoots(pos));
      }
    });

    it(`highest root of ${T}`, () => {
      const b = boardOf(T);
      const top = highestRoot(b);
      intEq(top, rec.highest_root, 'highest_root');
      intEq(toNumbers(b, top), rec.numbers_of_highest_root, 'numbers_of_highest_root');
      intEq(total(top), coxeterNumber(b) - 1, 'F14: entries of the highest root sum to h - 1');
    });

    it(`highest short root of ${T}`, () => {
      const b = boardOf(T);
      const short = highestShortRoot(b);
      if (rec.highest_short_root !== undefined && rec.highest_short_root !== null) {
        expect(short).not.toBeNull();
        intEq(short, rec.highest_short_root, 'highest_short_root');
        intEq(toNumbers(b, short!), rec.numbers_of_highest_short_root, 'numbers_of_highest_short_root');
      } else {
        expect(short).toBeNull();
      }
    });

    it(`highest root of the reversed board of ${T}`, () => {
      const b = boardOf(T);
      intEq(highestRoot(transposeBoard(b)), rec.highest_root_of_reversed_board, 'highest_root_of_reversed_board');
    });

    it(`coxeter number of ${T}`, () => {
      const b = boardOf(T);
      const h = coxeterNumber(b);
      intEq(h, rec.coxeter_number, 'coxeter_number');
      intEq(h, (2 * positiveRoots(b).length) / b.n, 'h = 2N/n');
    });

    it(`minuscule nodes of ${T}`, () => {
      const b = boardOf(T);
      intEq(labels(b, minusculeNodes(b)), rec.minuscule_nodes, 'minuscule_nodes');
    });
  }
});
