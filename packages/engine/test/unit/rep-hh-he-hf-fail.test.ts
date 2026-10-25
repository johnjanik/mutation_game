// RT-11 phase 5 round (P5-RT-11-01): chevalleySerre's verdicts for hh, he and hf on a case where they fail.
// On every set of matrices minusculeMatrices builds, [H_i, H_j] = 0, [H_i, E_j] = C_ij E_j and
// [H_i, F_j] = -C_ij F_j hold whatever the node (H is diagonal with the numbers of the basis, and E_j, F_j
// move a basis vector by a column of C), so the golden records and D4 node 2 never see one of these three
// relations fail, and the hand cases of p5-rep-units.test.ts pass H = 0 and read only the Serre records.
// chevalleySerre is a general function (SPEC 5.2 RelationCheck; rep.ts: "nothing assumes entries in
// {0, 1} or a particular basis"), ported from the oracle's chevalley_serre_ok, which compares both sides of
// every relation for any E, F, H. Here E, F and H are hand matrices on A2 for which the oracle's sides differ
// in hh, he and hf; the values were printed by the oracle's sp_comm and sp_scale (no Python runs at test
// time), and chevalley_serre_ok is False on them.
// oracle: from lie_games import sp_comm, sp_scale, chevalley_serre_ok; C = [[2, -1], [-1, 2]];
//   E = [{(0, 1): 1}, {}]; F = [{(1, 0): 1}, {}]; H = [{(0, 1): 1}, {(1, 0): 1}]; for i, j: print sp_comm(H[i], H[j]),
//   sp_comm(H[i], E[j]) against sp_scale(E[j], C[i][j]), sp_comm(H[i], F[j]) against sp_scale(F[j], -C[i][j])
//   (the script rt11_hh_he_hf_oracle.py of lens branch worktree-agent-ab56dba79c1bf690f).
// Fails under the lens's mutants M33-hh-he-hf-hold, M33-hh-skipped, M33-hh-holds, M33-he-right-zero and
// M33-hf-right-left of rep.ts; passes on 006f50d.
import { describe, expect, it } from 'vitest';
import { boardFromName } from '../../src/board';
import type { RelationCheck, SparseMatrix } from '../../src/rep';
import { chevalleySerre } from '../../src/rep';

const sp = (entries: [string, number][]): SparseMatrix => new Map(entries.map(([k, v]) => [k, BigInt(v)] as [string, bigint]));
const dump = (M: SparseMatrix): [string, string][] =>
  [...M.entries()].map(([k, v]) => [k, String(v)] as [string, string]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

function recordOf(records: RelationCheck[], relation: RelationCheck['relation'], i: number, j: number): RelationCheck {
  const hits = records.filter((r) => r.relation === relation && r.i === i && r.j === j);
  expect(hits.length).toBe(1);
  return hits[0]!;
}

describe('chevalleySerre: hh, he and hf can fail, and each record compares its two sides', () => {
  // A = e_0 e_1^T (key "0,1"), B = e_1 e_0^T (key "1,0"); E = (A, 0), F = (B, 0), H = (A, B).
  const board = boardFromName('A2');
  const E = [sp([['0,1', 1]]), new Map()] as SparseMatrix[];
  const F = [sp([['1,0', 1]]), new Map()] as SparseMatrix[];
  const H = [sp([['0,1', 1]]), sp([['1,0', 1]])];
  const records = chevalleySerre(board, E, F, H);

  // [row, column, value] of the oracle, as "row,column" keys and decimal text
  const cases: [RelationCheck['relation'], number, number, [string, string][], [string, string][]][] = [
    ['hh', 0, 1, [['0,0', '1'], ['1,1', '-1']], []],
    ['hh', 1, 0, [['0,0', '-1'], ['1,1', '1']], []],
    ['he', 0, 0, [], [['0,1', '2']]],
    ['he', 1, 0, [['0,0', '-1'], ['1,1', '1']], [['0,1', '-1']]],
    ['hf', 0, 0, [['0,0', '1'], ['1,1', '-1']], [['1,0', '-2']]],
    ['hf', 1, 0, [], [['1,0', '1']]],
  ];

  for (const [relation, i, j, left, right] of cases) {
    // regression: P5-RT-11-01
    it(`${relation}:${i},${j} fails with the oracle's two sides`, () => {
      const r = recordOf(records, relation, i, j);
      expect(dump(r.left)).toEqual(left);
      expect(dump(r.right)).toEqual(right);
      expect(r.holds).toBe(false);
    });
  }

  // regression: P5-RT-11-01
  it('the records that hold in the oracle hold here (hh:0,0, he:0,1, hf:0,1)', () => {
    for (const [relation, i, j] of [['hh', 0, 0], ['he', 0, 1], ['hf', 0, 1], ['hh', 1, 1]] as const) {
      expect(recordOf(records, relation, i, j).holds, `${relation}:${i},${j}`).toBe(true);
    }
  });
});
