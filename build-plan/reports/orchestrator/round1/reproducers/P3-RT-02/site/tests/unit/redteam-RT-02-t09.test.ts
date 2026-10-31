// RT-02 (convention-drift), phase 3, round 1: two latent conventions slips in T9's pure module
// (site/src/components/tools/t09/kostant.ts). Neither shows on screen today, because T9 offers only the 32
// named finite types (KOSTANT_BOARDS), whose labels are 1..n and whose names differ; both give wrong values
// as soon as the module is called on any other finite board. Expected values from the committed oracle:
// kostant_play, dynkin_labels and coroot_coords on the matrices named below (redteam/RT-02/batch.py style).
import { describe, expect, it } from 'vitest';
import { boardFromName, fromAdjacency, subBoard } from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import { affineCaptionParts, endPanel, kostantSummary } from '../../src/components/tools/t09/kostant';

function fromCartan(C: number[][]): AnyBoard {
  return fromAdjacency(C.map((_, i) => C.map((__, j) => (i === j ? 0 : -C[j]![i]!))));
}

describe('RT-02 attack 1: affineCaptionParts reads values[label - 1] (E-7: only toLabels / toPositions convert)', () => {
  it('on B3 drawn as nodes 2, 3, 4 of B4 the new city sends 1 road to city 2, not 0', () => {
    // subBoard(B4, positions [1, 2, 3]) is B3 in Bourbaki order with labels [2, 3, 4] (E-7: labels kept).
    // oracle: kostant_play(sub, 2) ends at (1, 1, 1); dynkin_labels = (1, 0, 0): city 2 (position 0) gets 1 road,
    // and <beta^vee, alpha_2> = 2 roads come back (coroot_coords((1,1,1)) = (2, 2, 1), first column of C: 2*2 - 2 = 2).
    const b = subBoard(boardFromName('B4'), [1, 2, 3]) as Board<number>;
    expect([...b.labels]).toEqual([2, 3, 4]);
    const panel = endPanel(b, [1, 1, 1], 2);
    expect(panel.marked).toEqual([2]);
    expect(panel.finalNumbers).toEqual(['1', '0', '0']);
    const parts = affineCaptionParts(panel)!;
    expect(parts.sends).toBe('1 to city 2');
    expect(parts.receives).toBe('2 from city 2');
  });
});

describe('RT-02 attack 41: the finite data cache of T9 is keyed by name and labels, not by the matrix', () => {
  it('the return counts of B3 with positions reversed do not depend on the board asked before it', () => {
    // B3 renumbered by a 3-cycle and B3 with its positions reversed: both unnamed Big boards with labels 1, 2, 3.
    const cyc = fromCartan([[2, -1, -1], [-2, 2, 0], [-1, 0, 2]]);
    const rev = fromCartan([[2, -2, 0], [-1, 2, -1], [0, -1, 2]]);
    expect(cyc.name).toBeUndefined();
    expect(rev.name).toBeUndefined();
    kostantSummary(cyc as Board<bigint>, [0, 1, 0]);
    // oracle on the reversed B3 from position 2 (label 3, the long end node): end (2, 2, 1), numbers (0, 1, 0),
    // coroot_coords of the end (1, 2, 1), return counts b_j = sum_k beta^vee_k C_kj = (0, 1, 0).
    const s = kostantSummary(rev as Board<bigint>, [0, 0, 1]);
    expect(s.end).toEqual(['2', '2', '1']);
    expect(s.finalNumbers).toEqual(['0', '1', '0']);
    expect(s.returnCounts).toEqual(['0', '1', '0']);
  });
});
