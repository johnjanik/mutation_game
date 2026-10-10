// SPEC.md 5.7, phase 0: types[*].cartan and types[*].adjacency, exercising cartan, adjacency, boardKind
// (and boardFromName, fromAdjacency, cartanNumbers) on all 32 types.
import { describe, expect, it } from 'vitest';
import { SafeInt } from '../../src/arith';
import { EngineError, NotABoard } from '../../src/errors';
import { adjacency, boardFromName, boardKind, cartan, cartanNumbers, fromAdjacency } from '../../src/board';
import { TYPE_NAMES, boardOf, covers, golden, intEq } from './_harness';

covers('types[*].cartan', 'types[*].adjacency');

describe.each(TYPE_NAMES.map((T) => [T] as const))('%s', (T) => {
  const record = golden.types[T]!;
  const rank = Number(T.slice(1));

  it('cartan(T) equals types[T].cartan', () => {
    intEq(cartan(T), record.cartan, T);
  });

  it('adjacency(T) equals types[T].adjacency', () => {
    intEq(adjacency(boardOf(T)), record.adjacency, T);
  });

  it('fromAdjacency(types[T].adjacency) rebuilds the board', () => {
    const board = fromAdjacency(record.adjacency);
    intEq(cartanNumbers(board), record.cartan, T);
    expect(board.arith).toBe(SafeInt);
    expect(board.kind).toBe('gcm');
    expect(board.n).toBe(rank);
    if (T !== 'C2') expect(board.name).toBe(T);
  });

  it('boardKind of every type is gcm', () => {
    expect(boardKind(record.cartan)).toBe('gcm');
    expect(boardKind(cartan(T))).toBe('gcm');
  });

  it('boardFromName(T) carries labels, kind, arith and name', () => {
    const board = boardFromName(T);
    expect(board.n).toBe(rank);
    expect([...board.labels]).toEqual(Array.from({ length: rank }, (_, k) => k + 1));
    expect(board.kind).toBe('gcm');
    expect(board.arith).toBe(SafeInt);
    expect(board.name).toBe(T);
    intEq(cartanNumbers(board), record.cartan, T);
    expect(board.cartan.length).toBe(rank);
  });
});

describe('reference matrices of 2.8', () => {
  it('B2, C2, G2, F4 come out exactly', () => {
    // the four reference matrices printed in SPEC.md 2.8
    expect(cartan('B2')).toEqual([[2, -1], [-2, 2]]);
    expect(cartan('C2')).toEqual([[2, -2], [-1, 2]]);
    expect(cartan('G2')).toEqual([[2, -3], [-1, 2]]);
    expect(cartan('F4')).toEqual([[2, -1, 0, 0], [-1, 2, -1, 0], [0, -2, 2, -1], [0, 0, -1, 2]]);
  });

  it('returns a fresh matrix each time', () => {
    const a = cartan('A3');
    const b = cartan('A3');
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
  });
});

describe('TYPE_NAMES', () => {
  it('has the 32 names of the instruction, 5.8, in order', () => {
    expect([...TYPE_NAMES]).toEqual([
      'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
      'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
      'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
      'D4', 'D5', 'D6', 'D7', 'D8',
      'E6', 'E7', 'E8', 'F4', 'G2',
    ]);
  });
});

describe('ranks beyond the golden file', () => {
  it('cartan(A12) is the path matrix on 12 nodes', () => {
    const C = cartan('A12');
    expect(C.length).toBe(12);
    for (let i = 0; i < 12; i++) {
      expect(C[i]!.length).toBe(12);
      for (let j = 0; j < 12; j++) {
        const expected = i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0;
        expect(C[i]![j]).toBe(expected);
      }
    }
  });

  it('cartan(B9) has C[8][7] === -2 and C[7][8] === -1', () => {
    const C = cartan('B9');
    expect(C.length).toBe(9);
    expect(C[8]![7]).toBe(-2);
    expect(C[7]![8]).toBe(-1);
  });

  it('cartan(C9) has C[7][8] === -2 and C[8][7] === -1', () => {
    const C = cartan('C9');
    expect(C[7]![8]).toBe(-2);
    expect(C[8]![7]).toBe(-1);
  });

  it('cartan(D9) joins node 9 to node 7, not to node 8', () => {
    const C = cartan('D9');
    expect(C.length).toBe(9);
    expect(C[8]![6]).toBe(-1);
    expect(C[6]![8]).toBe(-1);
    expect(C[8]![7]).toBe(0);
    expect(C[7]![8]).toBe(0);
  });
});

describe('unknown names throw NotABoard', () => {
  for (const name of ['B1', 'C1', 'D2', 'D3', 'E5', 'E9', 'F3', 'F5', 'G3', 'A0', 'H3', 'a3', '', 'A', 'A 3', ' A3', 'A3 ', 'A03', 'AA3']) {
    it(`cartan(${JSON.stringify(name)})`, () => {
      expect(() => cartan(name)).toThrow(NotABoard);
      expect(() => cartan(name)).toThrow(EngineError);
      expect(() => boardFromName(name)).toThrow(NotABoard);
    });
  }
});
