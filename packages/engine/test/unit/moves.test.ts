// The hand checks of SPEC.md Appendix A.1 (firing tables from (1, 1) and mutation lines on A2, B2, G2)
// and of 2.11 (the one-way play), in positions, on SafeInt boards and on hand-built Big copies; purity
// of arguments; RangeError on bad input. Plan addition of the P0-A2 instruction; registers no golden key.
import { describe, expect, it } from 'vitest';
import { Big, SafeInt } from '../../src/arith';
import type { Board } from '../../src/board';
import { cartanNumbers, fromAdjacency } from '../../src/board';
import { fire, mutate } from '../../src/moves';
import { boardOf } from '../golden/_harness';

function bigCopy(board: Board<number> | Board<bigint>): Board<bigint> {
  return {
    n: board.n,
    cartan: cartanNumbers(board).map((row) => row.map((x) => BigInt(x))),
    labels: board.labels,
    kind: board.kind,
    arith: Big,
  };
}

const big = (v: number[]): bigint[] => v.map((x) => BigInt(x));

/** Plays a firing table: fires the nodes (positions) in turn and returns every position after the start. */
function fireAll<T>(board: Board<T>, start: readonly T[], nodes: number[]): T[][] {
  const out: T[][] = [];
  let a: readonly T[] = start;
  for (const i of nodes) {
    a = fire(board, a, i);
    out.push([...a]);
  }
  return out;
}

describe('A.1 firing tables', () => {
  // Appendix A.1: labels in the text, positions in code (node 1 is position 0)
  const tables: [string, number[], number[][]][] = [
    ['A2', [0, 1, 0], [[-1, 2], [1, -2], [-1, -1]]],
    ['B2', [0, 1, 0, 1], [[-1, 3], [2, -3], [-2, 1], [-1, -1]]],
    ['G2', [0, 1, 0, 1, 0, 1], [[-1, 2], [5, -2], [-5, 3], [4, -3], [-4, 1], [-1, -1]]],
  ];
  for (const [T, nodes, expected] of tables) {
    it(`${T} from (1, 1) with SafeInt`, () => {
      expect(fireAll(boardOf(T), [1, 1], nodes)).toEqual(expected);
    });
    it(`${T} from (1, 1) with Big`, () => {
      expect(fireAll(bigCopy(boardOf(T)), [1n, 1n], nodes)).toEqual(expected.map(big));
    });
  }

  it('fire uses column i of C: on B2 firing node 1 adds 2 to node 2', () => {
    // the asymmetric step (1, 1) -> (-1, 3) of A.1 tells row from column
    expect(fire(boardOf('B2'), [1, 1], 0)).toEqual([-1, 3]);
    expect(fire(boardOf('B2'), [1, 1], 1)).toEqual([2, -1]);
    expect(fire(boardOf('G2'), [-1, 2], 1)).toEqual([5, -2]);
  });
});

describe('A.1 mutation lines', () => {
  it('A2: mutating city 1 of (1, 1) gives (0, 1); city 2 gives (1, 0)', () => {
    expect(mutate(boardOf('A2'), [1, 1], 0)).toEqual([0, 1]);
    expect(mutate(boardOf('A2'), [1, 1], 1)).toEqual([1, 0]);
    expect(mutate(bigCopy(boardOf('A2')), [1n, 1n], 0)).toEqual([0n, 1n]);
  });

  it('B2: mutating city 2 of (1, 2) gives (1, 0)', () => {
    expect(mutate(boardOf('B2'), [1, 2], 1)).toEqual([1, 0]);
    expect(mutate(bigCopy(boardOf('B2')), [1n, 2n], 1)).toEqual([1n, 0n]);
    // and the row of C, not the column: mutating city 1 of (1, 2) uses C[0][1] = -1
    expect(mutate(boardOf('B2'), [1, 2], 0)).toEqual([1, 2]);
  });

  it('G2: mutating city 2 of (3, 2) gives (3, 1)', () => {
    expect(mutate(boardOf('G2'), [3, 2], 1)).toEqual([3, 1]);
    expect(mutate(bigCopy(boardOf('G2')), [3n, 2n], 1)).toEqual([3n, 1n]);
    // the positive root populations of A.1 in a chain of mutations from (0, 1): (3, 1) <- (0, 1) at city 1
    expect(mutate(boardOf('G2'), [0, 1], 0)).toEqual([3, 1]);
  });

  it('mutation changes only entry i', () => {
    const p = [2, -3, 5, 1];
    const q = mutate(boardOf('D4'), p, 1);
    expect(q[0]).toBe(p[0]);
    expect(q[2]).toBe(p[2]);
    expect(q[3]).toBe(p[3]);
    // q[1] = p[1] - (C[1][0] p[0] + 2 p[1] + C[1][2] p[2] + C[1][3] p[3]) = -3 - (-2 - 6 - 5 - 1) = 11
    expect(q[1]).toBe(11);
  });
});

describe('2.11 one-way play', () => {
  const board = fromAdjacency([[0, 1], [0, 0]]);

  it('(1, 0) -> (1, 1) -> (-1, 1) by mutating city 2, then city 1, with Big', () => {
    expect(board.arith).toBe(Big);
    const b = board as Board<bigint>;
    const step1 = mutate(b, [1n, 0n], 1);
    expect(step1).toEqual([1n, 1n]);
    const step2 = mutate(b, step1, 0);
    expect(step2).toEqual([-1n, 1n]);
  });

  it('the same on a hand-built SafeInt copy of the one-way board', () => {
    const safe: Board<number> = { n: 2, cartan: cartanNumbers(board), labels: [1, 2], kind: 'one-way', arith: SafeInt };
    expect(mutate(safe, mutate(safe, [1, 0], 1), 0)).toEqual([-1, 1]);
    expect(fire(safe, [1, 0], 0)).toEqual([-1, 1]);
    expect(fire(safe, [1, 0], 1)).toEqual([1, 0]);
  });
});

describe('purity', () => {
  it('mutate and fire leave their input arrays unchanged and return new arrays', () => {
    const board = boardOf('B2');
    const p = [1, 2];
    const before = [...p];
    const q = mutate(board, p, 1);
    expect(p).toEqual(before);
    expect(q).not.toBe(p);
    const a = [1, 1];
    const b = fire(board, a, 0);
    expect(a).toEqual([1, 1]);
    expect(b).not.toBe(a);
    const frozen = Object.freeze([1, 1]);
    expect(() => mutate(board, frozen, 0)).not.toThrow();
    expect(() => fire(board, frozen, 0)).not.toThrow();
  });

  it('the board is never changed by a move', () => {
    const board = boardOf('G2');
    const before = cartanNumbers(board);
    mutate(board, [3, 2], 1);
    fire(board, [1, 1], 0);
    expect(cartanNumbers(board)).toEqual(before);
    expect(Object.isFrozen(board)).toBe(true);
  });
});

describe('RangeError on bad input', () => {
  const board = boardOf('A3');
  it('i = n, i = -1 and a non-integer i', () => {
    expect(() => mutate(board, [1, 1, 1], 3)).toThrow(RangeError);
    expect(() => fire(board, [1, 1, 1], 3)).toThrow(RangeError);
    expect(() => mutate(board, [1, 1, 1], -1)).toThrow(RangeError);
    expect(() => fire(board, [1, 1, 1], 1.5)).toThrow(RangeError);
  });
  it('a vector of the wrong length', () => {
    expect(() => mutate(board, [1, 1], 0)).toThrow(RangeError);
    expect(() => fire(board, [1, 1, 1, 1], 0)).toThrow(RangeError);
  });
});
