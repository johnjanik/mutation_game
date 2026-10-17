// SPEC.md 5.7, property 11: "For every row of folding with a folded board: symmetric play commutes with
// folding, in both games." SPEC.md 2.13 (a) [V]: symmetric play of the mutation game on the big board is
// the mutation game on the folded board, and symmetric play of the numbers game is the numbers game on
// the folded board, with the same numbers. A random row among the eight that fold, a vector of m integers
// in [-9, 9] (the range of 5.7) constant on orbits, and an orbit s: acting on every node of orbit s of the
// big board equals one move at s on the folded board. Plan addition: the order within the orbit does not
// matter (the nodes of an orbit are not joined), checked by acting in reverse order too. The engine side
// of T11's criterion "200 random symmetric plays agree between the two boards in both games".
// Registers no golden key (p4-folding.test.ts covers `folding`).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { toPositions } from '../../src/board';
import { fold } from '../../src/fold';
import { fire, mutate } from '../../src/moves';
import { boardOf, golden } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P4-A1.md (CONTRACTS.md 3)
const SEED = 20261017;
const NUM_RUNS = 600;

interface FoldingRow {
  type: string;
  symmetry: number[];
  folds_to: string | null;
}

const FOLDING_ROWS = (golden.folding as FoldingRow[]).filter((r) => r.folds_to !== null);

function prepared(row: FoldingRow) {
  const board = boardOf(row.type);
  const tau = toPositions(board, row.symmetry);
  const res = fold(board, tau);
  if (res.folded === null) throw new Error(`${row.type} ${JSON.stringify(row.symmetry)} does not fold`);
  return { board, folded: res.folded, orbits: res.orbits };
}

const caseArb = fc.constantFrom(...FOLDING_ROWS).chain((row) => {
  const m = prepared(row).orbits.length;
  return fc.tuple(
    fc.constant(row),
    fc.array(fc.integer({ min: -9, max: 9 }), { minLength: m, maxLength: m }),
    fc.integer({ min: 0, max: m - 1 }),
  );
});

type Move = typeof mutate;

function checkCommutes(move: Move): Set<string> {
  const rowsSeen = new Set<string>();
  fc.assert(
    fc.property(caseArb, ([row, pf, s]) => {
      const { board, folded, orbits } = prepared(row);
      rowsSeen.add(`${row.type} ${JSON.stringify(row.symmetry)}`);
      const big: number[] = [];
      for (let i = 0; i < board.n; i++) big.push(0);
      orbits.forEach((o, t) => {
        for (const i of o) big[i] = pf[t]!;
      });
      let forward: number[] = big;
      for (const i of orbits[s]!) forward = move(board, forward, i);
      let backward: number[] = big;
      for (const i of [...orbits[s]!].reverse()) backward = move(board, backward, i);
      const small = move(folded, pf, s);
      orbits.forEach((o, t) => {
        for (const i of o) {
          expect(forward[i]).toBe(small[t]);
          expect(backward[i]).toBe(small[t]);
        }
      });
    }),
    { seed: SEED, numRuns: NUM_RUNS },
  );
  return rowsSeen;
}

describe('property 11: symmetric play commutes with folding', () => {
  it('there are eight rows with a folded board', () => {
    expect(FOLDING_ROWS.length).toBe(8);
  });

  it('mutation commutes with folding', () => {
    expect(checkCommutes(mutate).size).toBe(FOLDING_ROWS.length);
  });

  it('firing commutes with folding', () => {
    expect(checkCommutes(fire).size).toBe(FOLDING_ROWS.length);
  });
});
