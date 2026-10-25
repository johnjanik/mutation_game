// The Reason records of admissibility (SPEC.md 5.2 Reason, 5.4 "an Admissibility record: each condition judged
// independently, with a reason for each failure", E-7 "returns each reason as data (section 5.2) from which the
// tool writes its sentence with labels"; P6-A1 instruction 5.5). The golden file holds the oracle's reasons as
// sentences, which no test compares (5.7 rule 6); here the codes, the positions and the fractions are pinned.
// The fractions and failing nodes were read from the oracle's admissibility sentences (reference/lie_games.py
// line 489 onwards), node numbers there being 1-based labels and here positions. No golden key.
import { describe, expect, it } from 'vitest';
import { boardFromName, subBoard, toLabels } from '../../src/board';
import type { Board } from '../../src/board';
import type { Admissibility, Reason } from '../../src/errors';
import type { SatakeDiagram } from '../../src/satake';
import { admissibility } from '../../src/satake';
import { boardOf } from '../golden/_harness';

function adm(type: string, black: number[], tau: number[]): Admissibility {
  return admissibility({ board: boardOf(type), black, tau });
}

const ALL_CODES: Reason['code'][] = ['not-a-symmetry', 'not-an-involution', 'moves-black-set', 'differs-from-minus-wX', 'not-an-integer'];

describe('condition 3', () => {
  it('A3 black 1', () => {
    const a = adm('A3', [0], [0, 1, 2]);
    expect(a.condition_3).toBe(false);
    expect(a.reasons).toEqual({ condition_3: { code: 'not-an-integer', nodes: [1], value: '-1/2' } });
    expect(Object.keys(a.reasons)).toEqual(['condition_3']);
  });

  it('positions on a relabelled board', () => {
    // A3 as the sub-board of A5 on positions 2, 3, 4: its labels are 3, 4, 5, not 1, 2, 3 (E-7)
    const b = subBoard(boardFromName('A5') as Board, [2, 3, 4]);
    expect([...b.labels]).toEqual([3, 4, 5]);
    const d: SatakeDiagram = { board: b, black: [0], tau: [0, 1, 2] };
    const a = admissibility(d);
    const r = a.reasons.condition_3!;
    expect(r).toEqual({ code: 'not-an-integer', nodes: [1], value: '-1/2' });
    expect(toLabels(b, r.nodes)).toEqual([4]);
    // the flip on the same board: the black set moves, conditions 2 and 3 fail too, all in positions
    const f = admissibility({ board: b, black: [0], tau: [2, 1, 0] });
    expect(f.reasons.condition_1).toEqual({ code: 'moves-black-set', nodes: [0] });
    expect(f.reasons.condition_2).toEqual({ code: 'differs-from-minus-wX', nodes: [0] });
    expect(f.reasons.condition_3).toEqual({ code: 'not-an-integer', nodes: [1], value: '-1/2' });
    expect(toLabels(b, f.reasons.condition_1!.nodes)).toEqual([3]);
  });

  it('several white nodes with different fractions: the values in the order of the nodes, joined by "; "', () => {
    // A5, black nodes 1, 2, 4 (positions 0, 1, 3), identity: the oracle reports -3/2 at node 3 and -1/2 at node 5
    const a = adm('A5', [0, 1, 3], [0, 1, 2, 3, 4]);
    expect(a.reasons.condition_3).toEqual({ code: 'not-an-integer', nodes: [2, 4], value: '-3/2; -1/2' });
    expect(a.reasons.condition_2).toEqual({ code: 'differs-from-minus-wX', nodes: [0, 1] });
    expect(a.condition_1).toBe(true);
    expect(a.symmetry).toBe(true);
  });

  it('G2 with either node black', () => {
    expect(adm('G2', [1], [0, 1]).reasons).toEqual({ condition_3: { code: 'not-an-integer', nodes: [0], value: '-1/2' } });
    expect(adm('G2', [0], [0, 1]).reasons).toEqual({ condition_3: { code: 'not-an-integer', nodes: [1], value: '-3/2' } });
  });

  it('C3 black 3', () => {
    expect(adm('C3', [2], [0, 1, 2]).reasons).toEqual({ condition_3: { code: 'not-an-integer', nodes: [1], value: '-1/2' } });
  });
});

describe('every reason code', () => {
  it('not-a-symmetry: the positions i for which some j has C[tau i][tau j] != C[i][j]', () => {
    // A4 with nodes 1 and 2 exchanged: rows 1, 2, 3 break, row 4 does not
    const a = adm('A4', [], [1, 0, 2, 3]);
    expect(a.symmetry).toBe(false);
    expect(a.reasons.symmetry).toEqual({ code: 'not-a-symmetry', nodes: [0, 1, 2] });
    expect(a.condition_1).toBe(true);
    expect(a.admissible).toBe(false);
    expect(adm('A3', [], [1, 0, 2]).reasons).toEqual({ symmetry: { code: 'not-a-symmetry', nodes: [0, 1, 2] } });
  });

  it('not-a-symmetry reads rows, not columns: the flip of B3 and of C3 (repair after review)', () => {
    // on a board that is not symmetric the rows i and the columns j where C[tau i][tau j] != C[i][j] differ:
    // the flip of B3 breaks rows 0 and 2 but only column 1, the flip of C3 row 1 but columns 0 and 2
    // (the oracle judges both pairs not a symmetry and nothing else)
    expect(adm('B3', [], [2, 1, 0]).reasons).toEqual({ symmetry: { code: 'not-a-symmetry', nodes: [0, 2] } });
    expect(adm('C3', [], [2, 1, 0]).reasons).toEqual({ symmetry: { code: 'not-a-symmetry', nodes: [1] } });
  });

  it('not-an-involution: the positions i with tau(tau(i)) != i, and it takes precedence over moves-black-set', () => {
    // D4, the rotation 1 -> 3 -> 4 -> 1 (positions 0 -> 2 -> 3 -> 0), a symmetry of order 3
    const a = adm('D4', [], [2, 1, 3, 0]);
    expect(a.symmetry).toBe(true);
    expect(a.reasons).toEqual({ condition_1: { code: 'not-an-involution', nodes: [0, 2, 3] } });
    // with node 1 black the rotation also moves the black set; the involution reason is the one given
    const b = adm('D4', [0], [2, 1, 3, 0]);
    expect(b.reasons.condition_1).toEqual({ code: 'not-an-involution', nodes: [0, 2, 3] });
    expect(b.reasons.condition_2).toEqual({ code: 'differs-from-minus-wX', nodes: [0] });
    expect(b.reasons.condition_3).toEqual({ code: 'not-an-integer', nodes: [1], value: '-1/2' });
  });

  it('not-an-involution names the positions tau(tau(i)) != i, not every position tau moves (repair after review)', () => {
    // A5, tau a 3-cycle on positions 0, 1, 2 and the exchange of 3 and 4: tau moves all five positions, but
    // applied twice it fixes 3 and 4. Not a symmetry either (every row breaks); the oracle reports both items.
    expect(adm('A5', [], [1, 2, 0, 4, 3]).reasons).toEqual({
      symmetry: { code: 'not-a-symmetry', nodes: [0, 1, 2, 3, 4] },
      condition_1: { code: 'not-an-involution', nodes: [0, 1, 2] },
    });
  });

  it('moves-black-set: the black positions whose image is white', () => {
    const a = adm('A3', [0], [2, 1, 0]);
    expect(a.reasons.condition_1).toEqual({ code: 'moves-black-set', nodes: [0] });
    expect(adm('A5', [0, 2], [4, 3, 2, 1, 0]).reasons.condition_1).toEqual({ code: 'moves-black-set', nodes: [0] });
  });

  it('differs-from-minus-wX: the black positions i with w_X(alpha_i) != -alpha_tau(i)', () => {
    expect(adm('A3', [0, 1], [0, 1, 2]).reasons).toEqual({ condition_2: { code: 'differs-from-minus-wX', nodes: [0, 1] } });
    expect(adm('D5', [0, 1, 2, 3, 4], [0, 1, 2, 3, 4]).reasons).toEqual({ condition_2: { code: 'differs-from-minus-wX', nodes: [3, 4] } });
  });

  it('each of the five codes is produced, and only failed items have an entry', () => {
    const seen = new Set<string>();
    const cases: [string, number[], number[]][] = [
      ['A4', [], [1, 0, 2, 3]], ['D4', [], [2, 1, 3, 0]], ['A3', [0], [2, 1, 0]], ['A3', [0, 1], [0, 1, 2]], ['A3', [0], [0, 1, 2]],
    ];
    for (const [T, X, tau] of cases) {
      const a = adm(T, X, tau);
      for (const key of ['symmetry', 'condition_1', 'condition_2', 'condition_3'] as const) {
        expect(key in a.reasons, `${T} ${key}`).toBe(!a[key]);
      }
      for (const r of Object.values(a.reasons)) {
        seen.add(r.code);
        expect('value' in r).toBe(r.code === 'not-an-integer');
        expect(r.nodes.length).toBeGreaterThan(0);
        expect([...r.nodes].sort((x, y) => x - y)).toEqual(r.nodes);
      }
    }
    expect([...seen].sort()).toEqual([...ALL_CODES].sort());
  });

  it('an admissible pair has no reason', () => {
    expect(adm('A3', [0, 2], [0, 1, 2]).reasons).toEqual({});
    expect(adm('E6', [2, 3, 4], [5, 1, 4, 3, 2, 0]).reasons).toEqual({});
    expect(adm('A1', [], [0])).toEqual({
      symmetry: true, condition_1: true, condition_2: true, condition_3: true, admissible: true, reasons: {},
    });
  });
});
