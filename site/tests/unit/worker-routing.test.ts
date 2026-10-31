// P1-A2: where an engine call runs (SPEC.md 5.1 E-9; CONTRACTS.md 4): the rule at every boundary,
// the serialization of the worker messages, errors re-thrown as the same class, the in-process path
// at build time, and the lazy creation of the worker. The worker is a stub that answers through
// engine.worker.ts's own handler, so the whole path except the browser's Worker is exercised.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Big,
  EngineError,
  EngineOverflow,
  NeedsConnectedBoard,
  NeedsTwoWayRoads,
  NotABoard,
  NotAdmissible,
  NotAffine,
  NotFiniteType,
  SafeInt,
  boardFromName,
} from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import { __testing, engineCall, whereToRun } from '../../src/lib/worker';
import { deserialize, errorToWire, serialize, wireToError, type CallMessage, type ReplyMessage } from '../../src/lib/workerWire';
import { handleCall } from '../../src/lib/engine.worker';
import { bigBoard, resolveBoard, type ToolState } from '../../src/lib/state';

const A3 = boardFromName('A3');
const E6 = boardFromName('E6');
const E7 = boardFromName('E7');
const E8 = boardFromName('E8');
const CUSTOM_A2 = resolveBoard({ cartan: [[2, -1], [-1, 2]] });

describe('whereToRun', () => {
  it('enumeration 2000 main, 2001 worker, absent worker', () => {
    expect(whereToRun({ board: A3, kind: 'enumeration', expectedItems: 2000 })).toBe('main');
    expect(whereToRun({ board: A3, kind: 'enumeration', expectedItems: 12 })).toBe('main');
    expect(whereToRun({ board: A3, kind: 'enumeration', expectedItems: 2001 })).toBe('worker');
    expect(whereToRun({ board: A3, kind: 'enumeration' })).toBe('worker');
  });

  it('play 2000 moves main, 2001 worker', () => {
    expect(whereToRun({ board: A3, kind: 'play', moves: 2000 })).toBe('main');
    expect(whereToRun({ board: A3, kind: 'play', moves: 2001 })).toBe('worker');
    expect(whereToRun({ board: CUSTOM_A2, kind: 'play', moves: 2000 })).toBe('main');
    expect(whereToRun({ board: CUSTOM_A2, kind: 'play', moves: 2001 })).toBe('worker');
  });

  it('play to the end: named finite main, custom worker (phase 1)', () => {
    expect(whereToRun({ board: A3, kind: 'play' })).toBe('main');
    expect(whereToRun({ board: bigBoard(E8), kind: 'play' })).toBe('main');
    // Before phase 2 a custom board counts as not of finite type, even one equal to A2 (trap 14).
    expect(whereToRun({ board: CUSTOM_A2, kind: 'play' })).toBe('worker');
    // From phase 2 the caller may say so from classify.
    expect(whereToRun({ board: CUSTOM_A2, kind: 'play', finiteKnown: true })).toBe('main');
    expect(whereToRun({ board: A3, kind: 'play', finiteKnown: false })).toBe('worker');
  });

  it('count: group order 2000 main, 2001 worker', () => {
    expect(whereToRun({ board: A3, kind: 'count', expectedItems: 2000 })).toBe('main');
    expect(whereToRun({ board: A3, kind: 'count', expectedItems: 2001 })).toBe('worker');
  });

  it('satake: E7 and E8 worker, E6 main', () => {
    expect(whereToRun({ board: E7, kind: 'satake' })).toBe('worker');
    expect(whereToRun({ board: E8, kind: 'satake' })).toBe('worker');
    expect(whereToRun({ board: E6, kind: 'satake' })).toBe('main');
    expect(whereToRun({ board: E6, kind: 'satake', expectedItems: 36 })).toBe('worker'); // a sweep over pairs
  });

  it('other main', () => {
    expect(whereToRun({ board: CUSTOM_A2, kind: 'other' })).toBe('main');
    expect(whereToRun({ board: E8, kind: 'other', expectedItems: 1e9, moves: 1e9 })).toBe('main');
  });
});

describe('serialization', () => {
  it('serialization', () => {
    const value = {
      big: 123456789012345678901234567890n,
      list: [1, -2n, 'x', null, true],
      map: new Map<string, bigint>([['0,1', 3n], ['2,2', -1n]]),
      rational: { num: -2n, den: 3n },
      nothing: undefined,
    };
    const wire = serialize(value);
    // The JSON form of CONTRACTS 4 survives JSON as well as postMessage.
    const text = JSON.stringify(wire);
    expect(text).toContain('{"$big":"123456789012345678901234567890"}');
    expect(text).toContain('"$map":[["0,1",{"$big":"3"}],["2,2",{"$big":"-1"}]]');
    expect(deserialize(JSON.parse(text))).toEqual(value);

    // Boards travel as their BoardSpec and are rebuilt with resolveBoard.
    expect(serialize(A3)).toEqual({ $board: 'A3' });
    const a3 = deserialize(serialize(A3)) as AnyBoard;
    expect(a3.arith).toBe(SafeInt);
    expect(a3.name).toBe('A3');
    const custom = deserialize(serialize(resolveBoard({ cartan: [[2, -1], [-3, 2]] }))) as AnyBoard;
    expect(serialize(custom)).toEqual({ $board: { cartan: [[2, -1], [-3, 2]] } });
    expect(custom.arith).toBe(Big);
    expect(custom.cartan.map((r) => r.map(Number))).toEqual([[2, -1], [-3, 2]]);
    // A bigBoard copy of a named finite board keeps its arithmetic (plan: the $board marker).
    expect(serialize(bigBoard(E8))).toEqual({ $board: 'E8', arith: 'Big' });
    const e8 = deserialize(serialize(bigBoard(E8))) as AnyBoard;
    expect(e8.arith).toBe(Big);
    expect(e8.name).toBe('E8');

    expect(() => serialize(() => 1)).toThrow(TypeError);
  });

  it('errors keep their class', () => {
    const admissibility = { symmetry: true, condition_1: false, condition_2: true, condition_3: true, admissible: false, reasons: { condition_1: { code: 'moves-black-set' as const, nodes: [1, 2] } } };
    const cases: [Error, new (...a: never[]) => Error][] = [
      [new NotABoard('not a board here'), NotABoard],
      [new NeedsTwoWayRoads(), NeedsTwoWayRoads],
      [new NeedsConnectedBoard(), NeedsConnectedBoard],
      [new NotFiniteType(), NotFiniteType],
      [new NotAffine('finite'), NotAffine],
      [new NotAdmissible(admissibility), NotAdmissible],
      [new EngineOverflow('too big'), EngineOverflow],
      [new EngineError('generic'), EngineError],
      [new RangeError('label 7 is not on this board'), RangeError],
    ];
    for (const [err, cls] of cases) {
      const back = wireToError(JSON.parse(JSON.stringify(errorToWire(err))));
      expect(back).toBeInstanceOf(cls);
      expect(back.name).toBe(err.name);
      expect(back.message).toBe(err.message);
    }
    const na = wireToError(errorToWire(new NotAffine('indefinite'))) as NotAffine;
    expect(na.message).toContain('indefinite');
    expect(na.data).toEqual({ class: 'indefinite' });
    const nad = wireToError(errorToWire(new NotAdmissible(admissibility))) as NotAdmissible;
    expect(nad.data).toEqual(admissibility);
    const unknown = wireToError({ name: 'WeirdError', message: 'odd' });
    expect(unknown.constructor).toBe(Error);
    expect(unknown.message).toBe('odd');
  });
});

/** A stub Worker that answers through engine.worker.ts's handler, asynchronously, as a worker would. */
class StubWorker {
  static created = 0;
  static posted: CallMessage[] = [];
  static replyWith: ((m: CallMessage) => ReplyMessage | 'crash') | null = null;
  onmessage: ((e: { data: ReplyMessage }) => void) | null = null;
  onerror: ((e: { message: string; preventDefault(): void }) => void) | null = null;
  constructor(readonly url?: unknown, readonly options?: unknown) {
    StubWorker.created++;
  }
  postMessage(message: CallMessage): void {
    StubWorker.posted.push(message);
    const copy = structuredClone(message);
    setTimeout(() => {
      const reply = StubWorker.replyWith ? StubWorker.replyWith(copy) : handleCall(copy);
      if (reply === 'crash') this.onerror?.({ message: 'boom', preventDefault() {} });
      else this.onmessage?.({ data: structuredClone(reply) });
    }, 0);
  }
  terminate(): void {}
}

describe('engineCall', () => {
  const g = globalThis as unknown as { Worker?: unknown };
  let savedWorker: unknown;
  beforeEach(() => {
    savedWorker = g.Worker;
    g.Worker = StubWorker;
    StubWorker.created = 0;
    StubWorker.posted = [];
    StubWorker.replyWith = null;
  });
  afterEach(() => {
    __testing.reset();
    g.Worker = savedWorker;
  });

  it('engineCall in Node never creates a worker', async () => {
    // The default runtime: in Node (build time, and here) every call runs in-process.
    const p = await engineCall('mutate', [bigBoard(A3) as never, [1n, 0n, 0n] as never, 0], { board: A3, kind: 'enumeration' });
    expect(p).toEqual([-1n, 0n, 0n]);
    await expect(engineCall('boardFromName', ['Q7'], { board: A3, kind: 'enumeration' })).rejects.toBeInstanceOf(NotABoard);
    expect(StubWorker.created).toBe(0);
    expect(__testing.workerCreated()).toBe(false);
  });

  it('the worker is lazy', async () => {
    // Importing worker.ts constructed nothing; a browser runtime with calls on the main thread neither.
    expect(StubWorker.created).toBe(0);
    __testing.setRuntime({ inNode: () => false });
    expect(await engineCall('toLabels', [A3, [0, 2]], { board: A3, kind: 'other' })).toEqual([1, 3]);
    expect(StubWorker.created).toBe(0);
    // The first call routed to the worker constructs it, exactly once, with the module type.
    const first = engineCall('mutate', [bigBoard(A3) as never, [1n, 0n, 0n] as never, 1], { board: A3, kind: 'enumeration' });
    expect(StubWorker.created).toBe(1);
    expect(await first).toEqual([1n, 1n, 0n]);
    const second = await engineCall('fire', [A3 as never, [1, 1, 1] as never, 0], { board: A3, kind: 'play', moves: 5000 });
    expect(second).toEqual([-1, 2, 1]);
    expect(StubWorker.created).toBe(1);
    expect(StubWorker.posted.map((m) => [m.id, m.fn, m.board])).toEqual([[1, 'mutate', 'A3'], [2, 'fire', 'A3']]);
    expect(StubWorker.posted[0]!.args[0]).toEqual({ $board: 'A3', arith: 'Big' });
  });

  it('errors from the worker keep their class', async () => {
    __testing.setRuntime({ inNode: () => false });
    await expect(engineCall('boardFromName', ['Q7'], { board: A3, kind: 'enumeration' })).rejects.toBeInstanceOf(NotABoard);
    await expect(engineCall('toPositions', [A3, [7]], { board: A3, kind: 'enumeration' })).rejects.toBeInstanceOf(RangeError);
    // A worker failure rejects the promise; nothing is continued on the main thread.
    StubWorker.replyWith = () => 'crash';
    await expect(engineCall('toLabels', [A3, [0]], { board: A3, kind: 'enumeration' })).rejects.toThrow(/boom/);
  });

  // MERGE, on P6-A3's request: a worker that failed is dropped, and the next call starts a new one.
  it('a worker that failed is dropped, and the next call starts a new one', async () => {
    __testing.setRuntime({ inNode: () => false });
    StubWorker.replyWith = () => 'crash';
    await expect(engineCall('toLabels', [A3, [0]], { board: A3, kind: 'enumeration' })).rejects.toThrow(/boom/);
    expect(StubWorker.created).toBe(1);
    StubWorker.replyWith = null;
    expect(await engineCall('toLabels', [A3, [0, 2]], { board: A3, kind: 'enumeration' })).toEqual([1, 3]);
    expect(StubWorker.created).toBe(2);
  });

  it('playFate goes to the worker on a named finite board', async () => {
    __testing.setRuntime({ inNode: () => false });
    // playFate arrives in phase 2; a stub answer stands in for it.
    StubWorker.replyWith = (m) => ({ id: m.id, ok: true, result: serialize({ status: 'ended', moves: 0 }) });
    const r = await engineCall('playFate' as never, [A3, [0, 0, 0]] as never, { board: A3, kind: 'other' });
    expect(r).toEqual({ status: 'ended', moves: 0 });
    expect(StubWorker.created).toBe(1);
    expect(StubWorker.posted[0]!.fn).toBe('playFate');
    expect(StubWorker.posted[0]!.board).toBe('A3');
  });

  it('firstForbiddenMove runs in the worker', async () => {
    __testing.setRuntime({ inNode: () => false });
    const a2 = boardFromName('A2');
    const moves = [1, 2, 1, ...Array.from({ length: 1998 }, () => 1)];
    const state: ToolState = { schema: 1, tool: 'board', board: 'A2', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1], moves };
    const hint = { board: a2, kind: 'play' as const, moves: moves.length };
    expect(whereToRun(hint)).toBe('worker');
    expect(await engineCall('firstForbiddenMove', [a2, state], hint)).toBe(3);
    expect(StubWorker.posted.map((m) => m.fn)).toEqual(['firstForbiddenMove']);
    // positionsOf is exposed too.
    expect(await engineCall('positionsOf', [{ ...state, moves: [1, 2, 1] }], { board: a2, kind: 'play', moves: 2001 })).toEqual([[1, 1], [-1, 2], [1, -2], [-1, -1]]);
  });
});
