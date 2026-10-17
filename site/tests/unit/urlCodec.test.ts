// P1-A2: the URL codec of SPEC.md 6.6 (CONTRACTS.md 4). One failing input per validation rule, the
// examples of 6.6 verbatim, prefixes, the round trip, and the long-list reading of rule 6 (5.3 of the
// instruction). Expected positions and legal moves are worked out by hand from SPEC 2.3 and 4 T1.
import { describe, expect, it, vi } from 'vitest';
import { toPositions } from '@two-games/engine';
import type { ToolRegistryEntry } from '../../src/tools/types';
import { defaultState, resolveBoard, type ToolState } from '../../src/lib/state';

// Rule 8 reads the registry through boardsOffered; the fixture stands in for registry files.
const fixture = vi.hoisted(() => ({ entries: [] as ToolRegistryEntry[] }));
vi.mock('../../src/tools/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/tools/index')>();
  return { ...actual, boardsOffered: (id: string) => actual.boardsOffered(id, fixture.entries) };
});

import {
  LINK_NOTICE,
  LONG_LIST_REPLAY,
  decodeState,
  decodeStateWith,
  encodeState,
  firstForbiddenMove,
} from '../../src/lib/urlCodec';

const BOARD_DEFAULTS: ToolState = defaultState('board', 'A3');

function decode(query: string, defaults: ToolState = BOARD_DEFAULTS, prefix?: string) {
  return decodeState(query, defaults.tool, defaults, prefix === undefined ? undefined : { prefix });
}

function expectFails(query: string, defaults: ToolState = BOARD_DEFAULTS): void {
  const r = decode(query, defaults);
  expect(r.notice, query).toBe(LINK_NOTICE);
  expect(r.state, query).toEqual(defaults);
}

function expectPasses(query: string, defaults: ToolState = BOARD_DEFAULTS): ToolState {
  const r = decode(query, defaults);
  expect(r.notice, query).toBeNull();
  return r.state;
}

const ident = (n: number): number[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)));
const cText = (m: number[][]): string => `c:${m.map((r) => r.join(',')).join(';')}`;

describe('each rule of 6.6 gives defaults and the notice', () => {
  it('rule 1: a known key with a value that does not parse', () => {
    for (const q of ['v=x', 'm=q', 'c=z', 'c=n&s=1,a,1', 'w=1..2', 'e=k', 'j=xyz:1,2', 'q=ab:1,2', 'g=c:2,-1;-1', 'z=one', 'g=A3&g=A3']) {
      expectFails(q);
    }
    expectFails('j=xyz:1,1,2'); // coordinates must be distinct
    expectFails('j=xyz:1,2,4'); // and between 1 and n
    expectFails('r=1.-1.0');
    expectFails('d=9007199254740993,1,1'); // lambda holds safe integers only (plan)
    expectFails('c=n&s=1,,1');
    // The same keys with good values pass.
    for (const q of ['v=n', 'm=f', 'c=p', 'e=p', 'j=xyz:1,2,3', 'j=coxeter@30,20,0', 'q=ef:1,2', 'r=1.0.2', 'd=1,0,2']) expectPasses(q);
  });

  it('rule 2: a board that is not-a-board or has more than 12 nodes', () => {
    expectFails('g=c:2,-1;-1,3'); // diagonal entry 3
    expectFails(`g=${cText(ident(13))}`);
    expectFails('g=Q7');
    expect(expectPasses(`g=${cText(ident(12))}`).board).toEqual({ cartan: ident(12) });
  });

  it('rule 3: a g parameter longer than 512 characters', () => {
    // c:2,-1;-1,2 with the first -1 padded by leading zeros to exactly 512 characters.
    const pad = (len: number): string => `c:2,-${'0'.repeat(len - 'c:2,-1;-1,2'.length)}1;-1,2`;
    expect(pad(512)).toHaveLength(512);
    expect(expectPasses(`g=${pad(512)}`).board).toEqual({ cartan: [[2, -1], [-1, 2]] });
    expectFails(`g=${pad(513)}`);
  });

  it('rule 4: a start with an entry longer than 40 digits', () => {
    const custom = 'g=c:2,-1;-1,2&c=n';
    const forty = '9'.repeat(40);
    const s = expectPasses(`${custom}&s=${forty},1`);
    expect(s.start).toEqual([forty, 1]);
    expectFails(`${custom}&s=${forty}9,1`);
    expect(expectPasses(`${custom}&s=-${forty},1`).start).toEqual([`-${forty}`, 1]);
    // On E8 a 40-digit entry passes too (replayed with Big, no notice).
    const e8 = defaultState('board', 'E8');
    const r = decode(`c=n&v=n&m=l&s=${forty},1,1,1,1,1,1,1&w=1`, e8);
    expect(r.notice).toBeNull();
    expect(r.state.start?.[0]).toBe(forty);
  });

  it('rule 5: more than 20000 moves', () => {
    const a1 = defaultState('board', 'A1');
    const free = (n: number): string => `v=p&m=f&w=${Array.from({ length: n }, () => '1').join('.')}`;
    expect(expectPasses(free(20000), a1).moves).toHaveLength(20000);
    expectFails(free(20001), a1);
  });

  it('a link can never produce a position the mode forbids', () => {
    // Rule 6. Numbers on A2 from (1,1): 1, 2, 1 is a legal game; 2, 2 is not.
    const a2 = defaultState('board', 'A2');
    expectFails('g=A2&v=n&m=l&c=n&s=1,1&w=2.2', a2);
    expect(expectPasses('g=A2&v=n&m=l&c=n&s=1,1&w=1.2.1', a2).moves).toEqual([1, 2, 1]);
    // Raising on A3 from p = (1,0,0): a = Cp = (2,-1,0), so only city 2 may be mutated (trap 8).
    const a3 = defaultState('kostant', 'A3');
    expectPasses('v=p&m=r&c=p&s=1,0,0&w=2', a3);
    expectFails('v=p&m=r&c=p&s=1,0,0&w=1', a3);
    expectFails('v=p&m=r&c=p&s=1,0,0&w=3', a3); // a_3 = 0 does not allow a raise
    expectFails('g=A2&v=n&m=l&c=n&s=1,0&w=2', a2); // a number 0 cannot be fired
    // Linked on A2 from p = (1,0): a = Cp = (2,-1); legal allows node 1, not node 2.
    expectPasses('g=A2&v=l&m=l&c=p&s=1,0&w=1', a2);
    expectFails('g=A2&v=l&m=l&c=p&s=1,0&w=2', a2);
    // Free play allows anything.
    expectPasses('g=A2&v=n&m=f&c=n&s=1,1&w=2.2', a2);
  });

  it('rule 7: a t or y that is not a symmetry, or a t that is not an involution', () => {
    expectFails('t=2.1.3'); // swapping nodes 1 and 2 of A3 breaks the road 2-3
    expect(expectPasses('t=3.2.1').tau).toEqual([3, 2, 1]);
    const d4 = defaultState('board', 'D4');
    // A 3-cycle of the outer nodes 1, 3, 4 of D4 is a symmetry but not an involution.
    expectFails('t=3.2.4.1', d4);
    expect(expectPasses('y=3.2.4.1', d4).symmetry).toEqual([3, 2, 4, 1]);
    expectFails('y=1.1.3');
  });

  it('rule 8: a board that the tool does not offer', () => {
    fixture.entries = [{
      number: 6, id: 'mirror', title: 'Kaleidoscope', phase: 3, boards: ['A2', 'B2', 'G2'],
      presets: { default: { caption: 'Mirrors.' } }, outs: [], component: async () => ({}),
    }];
    try {
      const mirror = defaultState('mirror', 'A2');
      expectFails('g=c:2,-1;-1,2', mirror);
      expectFails('g=A3', mirror);
      expect(expectPasses('g=G2', mirror).board).toBe('G2');
      // A tool with no registry entry offers every board (plan).
      expect(expectPasses('g=c:2,-1;-1,2').board).toEqual({ cartan: [[2, -1], [-1, 2]] });
    } finally {
      fixture.entries = [];
    }
  });

  it('rule 9: a list whose length is not the number of nodes', () => {
    for (const q of ['c=n&s=1,1', 'd=1,1', 'r=1.1', 't=1.2', 'y=1.2']) expectFails(q);
  });

  it('rule 10: a label that is not a label of the board', () => {
    for (const q of ['w=4', 'x=4', 'k=4', 'q=ef:1,4', 'w=0', 'x=0', 'k=0', 'q=ef:0,1']) expectFails(q);
    expectPasses('w=1.2.3&x=1.3&k=2&q=serre-e:2,3');
  });

  it('rule 11 cases', () => {
    expectFails('v=p&m=l');
    expectFails('v=n&m=r');
    for (const q of ['v=p&m=f', 'v=p&m=r', 'v=n&m=f', 'v=n&m=l', 'v=l&m=f', 'v=l&m=l', 'v=l&m=r']) expectPasses(q);
    // On the effective state: T9's defaults (populations, raising) with only m=l in the link.
    expectFails('m=l', defaultState('kostant', 'A3'));
  });

  it('rule 12: s without c', () => {
    expectFails('s=1,0,0');
    expectPasses('c=p&s=1,0,0');
  });

  it('rule 13: an unknown schema number', () => {
    expectFails('z=2&g=A3');
    expect(expectPasses('g=A2&w=1').board).toBe('A2'); // a missing z is schema 1
    expectPasses('z=1&g=A3');
  });
});

describe('reading', () => {
  it('unknown and foreign keys are ignored', () => {
    const r = decode('utm_source=x&b2.g=A2&b2.w=1&w=1.2&zz=3');
    expect(r.notice).toBeNull();
    expect(r.state.moves).toEqual([1, 2]);
    expect(r.state.board).toBe('A3');
    // Keys of another instance, for instance b1, are unknown keys for b2; foreign junk does not fail.
    const b2 = decode('b1.g=Q7&b1.v=x&b2.w=1', BOARD_DEFAULTS, 'b2.');
    expect(b2.notice).toBeNull();
    expect(b2.state.moves).toEqual([1]);
  });

  it('absent keys keep the defaults', () => {
    const author: ToolState = { schema: 1, tool: 'board', board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1, 1], moves: [1] };
    const only = expectPasses('w=1.2', author);
    expect(only).toEqual({ ...author, moves: [1, 2] });
    expect(expectPasses('', author)).toEqual(author);
    expect(expectPasses('?', author)).toEqual(author);
    // g alone resets start and moves to the tool's defaults for that board (plan, as a picker does).
    expect(expectPasses('g=B3', author)).toEqual({ ...author, board: 'B3', start: [1, 1, 1], moves: [] });
    expect(expectPasses('g=G2', author)).toEqual({ ...author, board: 'G2', start: [1, 1], moves: [] });
    // c without s takes the default start of those coords (plan).
    expect(expectPasses('c=p', author).start).toEqual([1, 0, 0]);
    // The leading '?' is accepted.
    expect(expectPasses('?w=3', author).moves).toEqual([3]);
  });

  it('bad coordinates spoil only the layout', () => {
    expect(expectPasses('g=c:2,-1;-3,2@0,0;1,0').board).toEqual({ cartan: [[2, -1], [-3, 2]], xy: [[0, 0], [1, 0]] });
    for (const bad of ['@0,0', '@a,b;1,0', '@0,0;1', '@0,0;1,0;2,0', '@']) {
      expect(expectPasses(`g=c:2,-1;-3,2${bad}`).board).toEqual({ cartan: [[2, -1], [-3, 2]] });
    }
    // Off the grid of 6.1 still parses (the layout code falls back to the circle).
    expect(expectPasses('g=c:2,-1;-3,2@0,0;99,-4').board).toEqual({ cartan: [[2, -1], [-3, 2]], xy: [[0, 0], [99, -4]] });
  });

  it('the decoded custom board keeps the rows of C (trap 9)', () => {
    const s = expectPasses('g=c:2,-1;-3,2&c=n&v=n&m=l&s=1,1&w=1');
    const board = resolveBoard(s.board);
    expect(board.cartan.map((r) => r.map(Number))).toEqual([[2, -1], [-3, 2]]);
    // From (1,1), firing node 1 gives (-1, 4); node 2 is then legal, node 1 is not.
    expect(expectPasses('g=c:2,-1;-3,2&c=n&v=n&m=l&s=1,1&w=1.2').moves).toEqual([1, 2]);
    expectFails('g=c:2,-1;-3,2&c=n&v=n&m=l&s=1,1&w=1.1');
  });
});

describe('writing', () => {
  it('encodes the examples of 6.6 verbatim', () => {
    const e8: ToolState = { schema: 1, tool: 'board', board: 'E8', view: 'linked', mode: 'legal', coords: 'numbers', start: [1, 1, 1, 1, 1, 1, 1, 1], moves: [1, 2, 3, 1] };
    expect(encodeState(e8)).toBe('z=1&g=E8&v=l&m=l&c=n&s=1,1,1,1,1,1,1,1&w=1.2.3.1');
    expect(encodeState({ schema: 1, tool: 'board', board: { cartan: [[2, -1], [-3, 2]], xy: [[0, 0], [1, 0]] } })).toBe('z=1&g=c:2,-1;-3,2@0,0;1,0');
    expect(encodeState({ schema: 1, tool: 'satake', board: 'E6', black: [2, 3, 4, 5], tau: [1, 2, 3, 4, 5, 6] })).toBe('z=1&g=E6&x=2.3.4.5&t=1.2.3.4.5.6');
    expect(encodeState({ schema: 1, tool: 'affine', board: 'B3~' })).toBe('z=1&g=B3~');
    expect(encodeState({ schema: 1, tool: 'affine', board: 'D4^(3)' })).toBe('z=1&g=D4^(3)');
    expect(encodeState({ schema: 1, tool: 'geometry', board: 'E8', projection: 'xyz:1,2,3@30,20,0', rings: [1, 0, 0, 0, 0, 0, 0, 0], graph: 'polytope' }))
      .toBe('z=1&g=E8&r=1.0.0.0.0.0.0.0&j=xyz:1,2,3@30,20,0&e=p');
    expect(encodeState({ schema: 1, tool: 'rep', board: 'A3', node: 2, relation: 'serre-e:2,3' })).toBe('z=1&g=A3&k=2&q=serre-e:2,3');
    expect(encodeState({ schema: 1, tool: 'numbers', board: 'A3', lambda: [1, 0, 2], moves: [] })).toBe('z=1&g=A3&w=&d=1,0,2');
    // Decoding the example gives the state back.
    const back = decode('?z=1&g=E8&v=l&m=l&c=n&s=1,1,1,1,1,1,1,1&w=1.2.3.1', defaultState('board', 'E8'));
    expect(back.notice).toBeNull();
    expect(back.state).toEqual(e8);
  });

  it('lesson prefixes', () => {
    const s: ToolState = { schema: 1, tool: 'board', board: 'A3', moves: [1, 2] };
    expect(encodeState(s, { prefix: 'b2.' })).toBe('b2.z=1&b2.g=A3&b2.w=1.2');
    expect(encodeState(s, { prefix: 'b2' })).toBe('b2.z=1&b2.g=A3&b2.w=1.2');
    expect(encodeState(s, { prefix: '' })).toBe('z=1&g=A3&w=1.2');
    const link = 'b2.g=A3&b2.w=1.2';
    const defaults = defaultState('board', 'A2');
    const b2 = decode(link, defaults, 'b2.');
    expect(b2.notice).toBeNull();
    expect(b2.state).toEqual({ ...defaults, board: 'A3', start: [1, 0, 0], moves: [1, 2] });
    expect(decode(link, defaults, 'b2').state).toEqual(b2.state);
    expect(decode(link, defaults, 'b1.')).toEqual({ state: defaults, notice: null });
    expect(decode(link, defaults)).toEqual({ state: defaults, notice: null }); // a bare route
  });

  it('a link carries no site version', () => {
    const q = encodeState({ schema: 1, tool: 'board', board: 'A3', view: 'numbers', mode: 'free', coords: 'numbers', start: [1, 1, 1], moves: [1] });
    const keys = q.split('&').map((p) => p.split('=')[0]);
    expect(keys).toEqual(['z', 'g', 'v', 'm', 'c', 's', 'w']);
    expect(q).not.toMatch(/version|commit|date|\d{4}-\d{2}-\d{2}/i);
    expect(q).toBe('z=1&g=A3&v=n&m=f&c=n&s=1,1,1&w=1');
  });

  it('start entries above 2^53 are written in full', () => {
    const big: ToolState = { schema: 1, tool: 'board', board: 'E8', coords: 'numbers', start: ['9007199254740993', 1, 1, 1, 1, 1, 1, 1] };
    const q = encodeState(big);
    expect(q).toBe('z=1&g=E8&c=n&s=9007199254740993,1,1,1,1,1,1,1');
    const back = decode(q, defaultState('board', 'E8'));
    expect(back.notice).toBeNull();
    expect(back.state.start?.[0]).toBe('9007199254740993');
  });

  it('only the fields of schema 1 are encoded', () => {
    const withOptions = { schema: 1, tool: 'garden', board: 'A3', growth: 'explore', weights: [1, 2], tab: 2, positions: [[1, 0, 0]] } as unknown as ToolState;
    expect(encodeState(withOptions)).toBe('z=1&g=A3');
    // A key for such an option is an unknown key when reading.
    expect(expectPasses('growth=explore&tab=2')).toEqual(BOARD_DEFAULTS);
    expectFails('d=1,9007199254740993,1');
  });

  it('escapes only what would break a query', () => {
    const q = encodeState({ schema: 1, tool: 'geometry', board: 'E8', projection: 'a&b=c#d%e+f g' });
    expect(q).toBe('z=1&g=E8&j=a%26b%3Dc%23d%25e%2Bf%20g');
    expect(new URLSearchParams(q).get('j')).toBe('a&b=c#d%e+f g');
  });

  it('decoding never mutates defaults', () => {
    const defaults = deepFreeze(defaultState('board', 'A3'));
    const copy = structuredClone(defaults);
    const good = decode('g=A2&c=n&s=1,1&w=1.2', defaults);
    expect(good.notice).toBeNull();
    good.state.moves!.push(1);
    const bad = decode('z=2', defaults);
    expect(bad.notice).toBe(LINK_NOTICE);
    bad.state.start![0] = 99;
    expect(defaults).toEqual(copy);
  });
});

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

// ---------------------------------------------------------------------------------------------
// Round trip on random valid states (seeded).
// ---------------------------------------------------------------------------------------------

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const NAMES = ['A1', 'A2', 'A3', 'A5', 'B2', 'C2', 'B3', 'C4', 'D4', 'D5', 'E6', 'E7', 'E8', 'F4', 'G2'];
const VIEW_MODES: [ToolState['view'], ToolState['mode']][] = [
  ['populations', 'free'], ['populations', 'raising'], ['numbers', 'free'], ['numbers', 'legal'],
  ['linked', 'free'], ['linked', 'legal'], ['linked', 'raising'], [undefined, undefined],
];

function randomState(rand: () => number): ToolState {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const int = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));
  let board: ToolState['board'];
  if (rand() < 0.25) {
    const n = int(1, 5);
    const C = ident(n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rand() < 0.5) { C[i]![j] = -int(1, 3); C[j]![i] = -int(1, 3); }
    board = rand() < 0.5 ? { cartan: C } : { cartan: C, xy: C.map((_, k) => [k, int(0, 3)] as [number, number]) };
  } else board = pick(NAMES);
  const b = resolveBoard(board);
  const labels = [...b.labels];
  const state: ToolState = { schema: 1, tool: 'board', board };
  const [view, mode] = pick(VIEW_MODES);
  if (view) state.view = view;
  if (mode) state.mode = mode;
  if (rand() < 0.8) {
    state.coords = rand() < 0.5 ? 'populations' : 'numbers';
    state.start = labels.map(() => (rand() < 0.1 ? `${pick(['', '-'])}${int(1, 9)}${'7'.repeat(int(16, 39))}` : int(-3, 3)));
    // Moves: free play at random; in legal and raising mode, a play that the mode allows.
    const moves: number[] = [];
    if (!mode || mode === 'free') {
      for (let k = int(0, 8); k > 0; k--) moves.push(pick(labels));
    } else if (!state.start.some((x) => typeof x === 'string')) {
      const big = b.cartan.map((r) => r.map((x) => BigInt(x)));
      let a = (state.coords === 'numbers' ? state.start.map((x) => BigInt(x)) : big.map((row) => row.reduce((s, c, j) => s + c * BigInt(state.start![j]!), 0n)));
      const fireBig = (v: bigint[], i: number): bigint[] => v.map((x, j) => x - big[j]![i]! * v[i]!);
      for (let k = int(0, 6); k > 0; k--) {
        const allowed = labels.filter((l) => {
          const v = a[toPositions(b, [l])[0]!]!;
          return mode === 'legal' ? v > 0n : v < 0n;
        });
        if (allowed.length === 0) break;
        const l = pick(allowed);
        moves.push(l);
        a = fireBig(a, toPositions(b, [l])[0]!);
      }
    }
    state.moves = moves;
  }
  if (rand() < 0.3) state.black = labels.filter(() => rand() < 0.4);
  if (rand() < 0.3) state.tau = [...labels];
  if (rand() < 0.3) state.symmetry = [...labels];
  if (rand() < 0.3) state.rings = labels.map(() => int(0, 2));
  if (rand() < 0.2) state.projection = pick(['coxeter', 'coxeter@10,0,350']);
  if (rand() < 0.2) state.graph = pick(['polytope', 'moves'] as const);
  if (rand() < 0.2) state.node = pick(labels);
  if (rand() < 0.2) state.relation = `${pick(['hh', 'ef', 'serre-f'])}:${pick(labels)},${pick(labels)}`;
  if (rand() < 0.2) state.lambda = labels.map(() => int(0, 3));
  return state;
}

describe('round trip', () => {
  it('round trip is idempotent', () => {
    const rand = lcg(20261010);
    for (let k = 0; k < 400; k++) {
      const s = randomState(rand);
      const q = encodeState(s);
      const defaults: ToolState = { schema: 1, tool: 'board', board: s.board };
      const r = decodeState(q, 'board', defaults);
      expect(r.notice, q).toBeNull();
      expect(encodeState(r.state), q).toBe(q);
      expect(r.state, q).toEqual(s);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Rule 6 on long lists (5.3 of the instruction): both readings, selected explicitly.
// ---------------------------------------------------------------------------------------------

/** 1.2.1 is the legal game from (1,1) on A2; it ends there, so a fourth move is forbidden. */
const LONG = `g=A2&v=n&m=l&c=n&s=1,1&w=1.2.1.${Array.from({ length: 1998 }, () => '1').join('.')}`;

describe('long move lists', () => {
  it('rule 6 on 2001 moves gives defaults and the notice', () => {
    expect(LONG.split('w=')[1]!.split('.')).toHaveLength(2001);
    const a2 = defaultState('board', 'A2');
    expect(decodeStateWith(LONG, 'board', a2, { longListReplay: 'sync' })).toEqual({ state: a2, notice: LINK_NOTICE });
    if (LONG_LIST_REPLAY === 'sync') expect(decodeState(LONG, 'board', a2)).toEqual({ state: a2, notice: LINK_NOTICE });
  });

  it('more than 2000 moves are marked for the worker replay', () => {
    const a2 = defaultState('board', 'A2');
    const r = decodeStateWith(LONG, 'board', a2, { longListReplay: 'worker' });
    expect(r.notice).toBeNull();
    expect(r.replayCheck).toBe(true);
    expect(r.state.moves).toHaveLength(2001);
    // What the worker will answer for it.
    expect(firstForbiddenMove(resolveBoard('A2'), r.state)).toBe(3);
    // At most 2000 moves are still checked inside decodeState under either reading.
    const short = `g=A2&v=n&m=l&c=n&s=1,1&w=1.2.1.${Array.from({ length: 1997 }, () => '1').join('.')}`;
    expect(decodeStateWith(short, 'board', a2, { longListReplay: 'worker' })).toEqual({ state: a2, notice: LINK_NOTICE });
    // Every other rule still gives the notice at once.
    expect(decodeStateWith(`${LONG}&z=2`, 'board', a2, { longListReplay: 'worker' }).notice).toBe(LINK_NOTICE);
  });

  it('a large start on a named finite board replays with Big and no notice (trap 11)', () => {
    const a2 = defaultState('board', 'A2');
    const huge = '9'.repeat(30);
    const r = decode(`v=n&m=l&c=n&s=${huge},1&w=1.2`, a2);
    expect(r.notice).toBeNull();
    const edge = decode(`v=n&m=l&c=n&s=${Number.MAX_SAFE_INTEGER},${Number.MAX_SAFE_INTEGER}&w=1.2`, a2);
    expect(edge.notice).toBeNull();
    expect(edge.state.start).toEqual([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
  });
});
