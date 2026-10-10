// The E-7 check of SPEC.md 5.1 on affine boards (P2-A1 instruction 5.15): classify,
// smallestNonfiniteSubboard and identify return positions, and converting with toLabels on a board whose
// labels start at 0 yields labels starting at 0. A stray + 1 passes every golden test (whose boards have
// labels 1..n) and fails here. No golden key.
import { describe, expect, it } from 'vitest';
import { boardFromName, cartan, cartanNumbers, subBoard, toLabels } from '../../src/board';
import { classify, identify, smallestNonfiniteSubboard } from '../../src/classify';
import { affineExtension } from '../../src/affine';
import { boardOf } from '../golden/_harness';
import { renumber } from '../helpers/p2';

describe('E-7 on affine boards', () => {
  it('classify(A4~).nodes are positions 0..4 and their labels are 0..4', () => {
    const b = boardFromName('A4~');
    expect([...b.labels]).toEqual([0, 1, 2, 3, 4]);
    const recs = classify(b);
    expect(recs.length).toBe(1);
    expect(recs[0]!.nodes).toEqual([0, 1, 2, 3, 4]);
    expect(toLabels(b, recs[0]!.nodes)).toEqual([0, 1, 2, 3, 4]);
    expect(recs[0]!.name).toBe('A4~');
  });

  it('classify(D4^(3)) likewise with 0..2', () => {
    const b = boardFromName('D4^(3)');
    expect([...b.labels]).toEqual([0, 1, 2]);
    const recs = classify(b);
    expect(recs[0]!.nodes).toEqual([0, 1, 2]);
    expect(toLabels(b, recs[0]!.nodes)).toEqual([0, 1, 2]);
    expect(recs[0]!.marks).toEqual([1, 1, 2]);
  });

  it('smallestNonfiniteSubboard(E8~) is positions 0..8 with labels 0..8; D4~ gives all five', () => {
    const e8 = boardFromName('E8~');
    const sub = smallestNonfiniteSubboard(e8);
    expect(sub).toEqual({ nodes: [0, 1, 2, 3, 4, 5, 6, 7, 8], class: 'affine' });
    expect(toLabels(e8, sub!.nodes)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const d4 = boardFromName('D4~');
    const sub4 = smallestNonfiniteSubboard(d4);
    expect(sub4).toEqual({ nodes: [0, 1, 2, 3, 4], class: 'affine' });
    expect(toLabels(d4, sub4!.nodes)).toEqual([0, 1, 2, 3, 4]);
  });

  it('bourbaki_order of the finite sub-board of D4~ is a list of positions whose labels are 1..4 in Bourbaki order', () => {
    const d4 = boardFromName('D4~');
    const finite = subBoard(d4, [1, 2, 3, 4]);
    expect([...finite.labels]).toEqual([1, 2, 3, 4]);
    const recs = classify(finite);
    expect(recs.length).toBe(1);
    expect(recs[0]!.name).toBe('D4');
    const order = recs[0]!.bourbaki_order!;
    expect(order).toEqual([0, 1, 2, 3]);
    expect(toLabels(finite, order)).toEqual([1, 2, 3, 4]);
    expect(renumber(cartanNumbers(finite), order)).toEqual(cartan('D4'));
    const id = identify(finite);
    expect(id).toEqual({ name: 'D4', order: [0, 1, 2, 3] });
  });

  it('on a sub-board of A4~ that keeps label 0, identify(...).order is in positions and its labels start at 0', () => {
    const b = boardFromName('A4~');
    const sub = subBoard(b, [0, 1, 2]);
    expect([...sub.labels]).toEqual([0, 1, 2]);
    const id = identify(sub);
    expect(id).toEqual({ name: 'A3', order: [0, 1, 2] });
    expect(toLabels(sub, id!.order)).toEqual([0, 1, 2]);
    const recs = classify(sub);
    expect(recs[0]!.bourbaki_order).toEqual([0, 1, 2]);
    expect(toLabels(sub, recs[0]!.bourbaki_order!)).toEqual([0, 1, 2]);
  });

  it('affineExtension labels the added node 0 and the finite board 1..n, for short extensions too', () => {
    for (const T of ['A3', 'B3', 'C3', 'G2', 'F4']) {
      const b = boardOf(T);
      const expected = [0, ...b.labels];
      expect([...affineExtension(b).board.labels]).toEqual(expected);
      expect([...affineExtension(b, true).board.labels]).toEqual(expected);
    }
    expect(affineExtension(boardOf('B3')).board.name).toBe('B3~');
    expect(affineExtension(boardOf('B3'), true).board.name).toBeUndefined();
    expect(affineExtension(subBoard(boardOf('B3'), [1, 2])).board.name).toBeUndefined();
  });
});
