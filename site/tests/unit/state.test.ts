// P1-A2: the state object of SPEC.md 6.6 and 7.4 (CONTRACTS.md 4): defaultState, resolveBoard,
// positionsOf, bigBoard, the publish-follow API of linked tools, and the highlight store.
// Expected positions are computed by hand from the rules of SPEC 2.2 and 2.3, never from golden data.
import { afterEach, describe, expect, it } from 'vitest';
import { Big, NotABoard, SafeInt, boardFromName, cartanNumbers } from '@two-games/engine';
import {
  bigBoard,
  clearPublishedStates,
  defaultStart,
  defaultState,
  firstForbiddenMove,
  followToolState,
  isNamedFinite,
  positionsOf,
  publishToolState,
  resolveBoard,
  type ToolState,
} from '../../src/lib/state';
import { highlight } from '../../src/lib/highlight';

describe('resolveBoard', () => {
  it('resolveBoard', () => {
    const e8 = resolveBoard('E8');
    expect(e8.arith).toBe(SafeInt);
    expect(e8.name).toBe('E8');
    expect(e8.labels).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // A custom board equal to A2's matrix is still Big, unnamed, labelled 1..n.
    const custom = resolveBoard({ cartan: [[2, -1], [-1, 2]] });
    expect(custom.arith).toBe(Big);
    expect(custom.name).toBeUndefined();
    expect(custom.labels).toEqual([1, 2]);
    expect(custom.kind).toBe('gcm');

    // The C2 matrix, which fromAdjacency returns as SafeInt without a name, is Big too.
    const c2 = resolveBoard({ cartan: [[2, -2], [-1, 2]] });
    expect(c2.arith).toBe(Big);
    expect(c2.name).toBeUndefined();

    // Rows of the link are rows of C, not of A (trap 9): the decoded matrix is the one given.
    const g = resolveBoard({ cartan: [[2, -1], [-3, 2]] });
    expect(cartanNumbers(g)).toEqual([[2, -1], [-3, 2]]);
    expect(g.arith).toBe(Big);

    // A one-way board is a board.
    expect(resolveBoard({ cartan: [[2, -1], [0, 2]] }).kind).toBe('one-way');

    expect(() => resolveBoard({ cartan: [[2, -1], [-1, 3]] })).toThrow(NotABoard);
    expect(() => resolveBoard({ cartan: [[2, 1], [1, 2]] })).toThrow(NotABoard);
    const thirteen = Array.from({ length: 13 }, (_, i) => Array.from({ length: 13 }, (_, j) => (i === j ? 2 : 0)));
    expect(() => resolveBoard({ cartan: thirteen })).toThrow(new RangeError('board has more than 12 nodes'));
    const twelve = thirteen.slice(1).map((r) => r.slice(1));
    expect(resolveBoard({ cartan: twelve }).n).toBe(12);
    expect(() => resolveBoard('Q7')).toThrow(NotABoard);
    expect(() => resolveBoard('B3~')).toThrow(NotABoard); // until P2-A1 extends boardFromName
  });
});

describe('defaultState', () => {
  it('default starts', () => {
    const a3 = resolveBoard('A3');
    expect(defaultStart(a3, 'numbers')).toEqual([1, 1, 1]);
    expect(defaultStart(a3, 'populations')).toEqual([1, 0, 0]);

    expect(defaultState('board', 'A3')).toEqual({ schema: 1, tool: 'board', board: 'A3', coords: 'populations', start: [1, 0, 0], moves: [] });
    expect(defaultState('garden', 'B2').start).toEqual([1, 0]);
    expect(defaultState('kostant', 'D4')).toEqual({
      schema: 1, tool: 'kostant', board: 'D4', coords: 'populations', start: [1, 0, 0, 0], moves: [], view: 'populations', mode: 'raising',
    });
    for (const tool of ['numbers', 'symbolic', 'weyl', 'mirror', 'affine', 'sandbox'] as const) {
      const s = defaultState(tool, 'G2');
      expect(s.coords).toBe('numbers');
      expect(s.start).toEqual([1, 1]);
      expect(s.moves).toEqual([]);
    }
    expect(defaultState('satake', 'E6')).toEqual({ schema: 1, tool: 'satake', board: 'E6' });
    const custom = defaultState('board', { cartan: [[2, -1], [-3, 2]], xy: [[0, 0], [1, 0]] });
    expect(custom.board).toEqual({ cartan: [[2, -1], [-3, 2]], xy: [[0, 0], [1, 0]] });
    expect(custom.start).toEqual([1, 0]);
  });
});

describe('positionsOf', () => {
  it('positionsOf on A2 and on a custom board', () => {
    // Numbers on A2 from (1,1): firing 1, 2, 1 gives (-1,2), (1,-2), (-1,-1) (SPEC 4 T1).
    const numbers: ToolState = { schema: 1, tool: 'board', board: 'A2', coords: 'numbers', start: [1, 1], moves: [1, 2, 1] };
    expect(positionsOf(numbers)).toEqual([[1, 1], [-1, 2], [1, -2], [-1, -1]]);

    // Populations on A2 from (1,0): mutating city 1 gives (-1,0); city 2 then gives (-1,-1).
    const pops: ToolState = { schema: 1, tool: 'board', board: 'A2', coords: 'populations', start: [1, 0], moves: [1, 2] };
    expect(positionsOf(pops)).toEqual([[1, 0], [-1, 0], [-1, -1]]);

    // A custom board, C = [[2,-1],[-3,2]]: mutating city 1 from (1,1) gives 1 - (2 - 1) = 0;
    // firing node 1 from (1,1) gives a_2 = 1 - C[1][0] * 1 = 4.
    const customPops: ToolState = { schema: 1, tool: 'board', board: { cartan: [[2, -1], [-3, 2]] }, coords: 'populations', start: [1, 1], moves: [1] };
    expect(positionsOf(customPops)).toEqual([[1, 1], [0, 1]]);
    const customNumbers: ToolState = { ...customPops, coords: 'numbers' };
    expect(positionsOf(customNumbers)).toEqual([[1, 1], [-1, 4]]);

    // Labels at the boundary: an unknown label throws.
    expect(() => positionsOf({ ...numbers, moves: [3] })).toThrow(RangeError);
    // A start beyond 2^53 on a named finite board is replayed with Big, digits kept.
    const huge: ToolState = { schema: 1, tool: 'board', board: 'A2', coords: 'numbers', start: ['9007199254740993', 1], moves: [1] };
    expect(positionsOf(huge)).toEqual([['9007199254740993', 1], ['-9007199254740993', '9007199254740994']]);
    // An overflow during the play switches to Big silently.
    const edge: ToolState = { schema: 1, tool: 'board', board: 'A2', coords: 'numbers', start: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], moves: [1] };
    expect(positionsOf(edge)[1]).toEqual([-Number.MAX_SAFE_INTEGER, '18014398509481982']);
  });

  it('firstForbiddenMove reads the numbers, also in the populations view (trap 8)', () => {
    const a3 = resolveBoard('A3');
    // p = (1,0,0) gives a = Cp = (2,-1,0): city 2 is the only raising move.
    const raising: ToolState = { schema: 1, tool: 'kostant', board: 'A3', view: 'populations', mode: 'raising', coords: 'populations', start: [1, 0, 0], moves: [2] };
    expect(firstForbiddenMove(a3, raising)).toBeNull();
    expect(firstForbiddenMove(a3, { ...raising, moves: [1] })).toBe(0);
    expect(firstForbiddenMove(a3, { ...raising, moves: [3] })).toBe(0);
    const a2 = resolveBoard('A2');
    const legal: ToolState = { schema: 1, tool: 'board', board: 'A2', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1], moves: [1, 2, 1] };
    expect(firstForbiddenMove(a2, legal)).toBeNull();
    expect(firstForbiddenMove(a2, { ...legal, moves: [1, 2, 1, 1] })).toBe(3);
    expect(firstForbiddenMove(a2, { ...legal, moves: [2, 2] })).toBe(1);
    expect(firstForbiddenMove(a2, { ...legal, mode: 'free', moves: [2, 2] })).toBeNull();
  });
});

describe('bigBoard', () => {
  it('bigBoard', () => {
    const b3 = boardFromName('B3');
    const big = bigBoard(b3);
    expect(big.arith).toBe(Big);
    expect(big.labels).toEqual(b3.labels);
    expect(big.kind).toBe(b3.kind);
    expect(big.name).toBe('B3');
    expect(big.n).toBe(3);
    expect(big.cartan.map((r) => r.map((x) => typeof x))).toEqual([['bigint', 'bigint', 'bigint'], ['bigint', 'bigint', 'bigint'], ['bigint', 'bigint', 'bigint']]);
    expect(cartanNumbers(big)).toEqual(cartanNumbers(b3));
    expect(Object.isFrozen(big)).toBe(true);
    expect(bigBoard(big)).toBe(big);
    expect(isNamedFinite(big)).toBe(true);
    expect(isNamedFinite(b3)).toBe(true);
    expect(isNamedFinite(resolveBoard({ cartan: [[2, -1], [-1, 2]] }))).toBe(false);
  });
});

describe('linked tools', () => {
  afterEach(() => clearPublishedStates());

  it('publish and follow', () => {
    const got1: ToolState[] = [];
    const got2: ToolState[] = [];
    const stop1 = followToolState('b1', (s) => got1.push(s));
    const stop2 = followToolState('b2', (s) => got2.push(s));
    const s1: ToolState = { schema: 1, tool: 'board', board: 'A2', coords: 'populations', start: [1, 0], moves: [1] };
    // A caller that carries positions or options along: only ToolState's fields arrive.
    publishToolState('b1', { ...s1, positions: [[1, 0], [-1, 0]], growth: 'explore' } as unknown as ToolState);
    publishToolState('b1', { ...s1, moves: [1, 2] });
    expect(got1).toEqual([s1, { ...s1, moves: [1, 2] }]);
    for (const s of got1) {
      expect(Object.keys(s).sort()).toEqual(['board', 'coords', 'moves', 'schema', 'start', 'tool']);
    }
    expect(got2).toEqual([]);
    stop1();
    publishToolState('b1', { ...s1, moves: [] });
    expect(got1).toHaveLength(2);
    // A late follower receives the last published state at once.
    const late: ToolState[] = [];
    const stop3 = followToolState('b1', (s) => late.push(s));
    expect(late).toEqual([{ ...s1, moves: [] }]);
    stop2();
    stop3();
  });
});

describe('highlight store', () => {
  it('highlight store', () => {
    expect(highlight.get()).toBeNull();
    const seen: unknown[] = [];
    const stop = highlight.listen((v) => seen.push(v));
    highlight.set({ kind: 'root', board: 'A3', value: [1, 1, 0] });
    highlight.set({ kind: 'node', board: 'A3', value: 2 });
    highlight.set(null);
    stop();
    expect(seen).toEqual([{ kind: 'root', board: 'A3', value: [1, 1, 0] }, { kind: 'node', board: 'A3', value: 2 }, null]);
    expect(typeof highlight.subscribe).toBe('function'); // read as $highlight in Svelte 5 (7.2 item 5)
  });
});
