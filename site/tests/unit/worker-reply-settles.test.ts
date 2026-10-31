// Every reply of the engine worker settles engineCall's promise (CONTRACTS.md 4: errors re-thrown on the main
// side as the same class; worker.ts: a worker failure rejects the promise). A reply that the main side cannot
// rebuild (deserialize throws, for instance because resolveBoard refuses a board in the result) rejects the
// call with that error, of its own class, instead of escaping worker.ts's message handler with the promise
// still pending. The worker is a stub that answers through engine.worker.ts's own handler, asynchronously,
// and records what a browser would report for an exception thrown by the message handler.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EngineError, NotABoard, boardFromName, restrictedBoard, satakeCatalogue } from '@two-games/engine';
import type { Board, SatakeDiagram } from '@two-games/engine';
import { handleCall } from '../../src/lib/engine.worker';
import { __testing, engineCall } from '../../src/lib/worker';
import type { CallMessage, ReplyMessage } from '../../src/lib/workerWire';

class StubWorker {
  static uncaught: string[] = [];
  static replyWith: ((m: CallMessage) => ReplyMessage) | null = null;
  onmessage: ((e: { data: ReplyMessage }) => void) | null = null;
  onerror: ((e: { message: string; preventDefault(): void }) => void) | null = null;
  postMessage(message: CallMessage): void {
    const copy = structuredClone(message);
    setTimeout(() => {
      const reply = structuredClone(StubWorker.replyWith ? StubWorker.replyWith(copy) : handleCall(copy));
      try {
        this.onmessage?.({ data: reply });
      } catch (err) {
        // a browser reports an exception thrown by a message handler, and nothing else happens
        StubWorker.uncaught.push(String(err));
      }
    }, 0);
  }
  terminate(): void {}
}

/** How the promise settles, or 'pending after 2 s'; with the error itself when it rejects. */
async function settle(p: Promise<unknown>): Promise<{ settled: string; error?: unknown }> {
  return Promise.race([
    p.then(
      () => ({ settled: 'resolved' }),
      (e: Error) => ({ settled: `rejected: ${e.name}`, error: e }),
    ),
    new Promise<{ settled: string }>((r) => setTimeout(() => r({ settled: 'pending after 2 s' }), 2000)),
  ]);
}

describe('a reply of the engine worker always settles the call', () => {
  beforeEach(() => {
    StubWorker.uncaught = [];
    StubWorker.replyWith = null;
    __testing.setRuntime({ inNode: () => false, createWorker: () => new StubWorker() as unknown as Worker });
  });
  afterEach(() => __testing.reset());

  for (const name of ['E7', 'E8']) {
    const board = boardFromName(name) as Board;
    for (const e of satakeCatalogue(name).filter((x) => x.black_nodes.length === board.n)) {
      // regression: P6-RT-03-02
      it(`restrictedBoard of the compact form ${e.real_form} of ${name}, routed to the worker, settles: the empty board that resolveBoard refuses rejects as NotABoard`, async () => {
        const d: SatakeDiagram = { board, black: e.black_nodes, tau: e.tau };
        expect(restrictedBoard(d).board.n).toBe(0); // the main thread answers the empty board (MERGE ruling (4) on P6-A1)
        const r = await settle(engineCall('restrictedBoard', [d], { board, kind: 'satake' }));
        // Its BoardSpec { cartan: [] } is refused by resolveBoard on the main side; how an empty board crosses the
        // wire is left to the owner (decisions/RT-FIX-P6-worker-wire.md). Until then the call rejects, as that class.
        expect({ settled: r.settled, uncaught: StubWorker.uncaught }).toEqual({ settled: 'rejected: NotABoard', uncaught: [] });
        expect(r.error).toBeInstanceOf(NotABoard);
        expect(r.error).toBeInstanceOf(EngineError);
      });
    }
  }

  // regression: P6-RT-03-02
  it('a reply whose result or error data the main side cannot rebuild rejects the call with that error, and the next call is answered', async () => {
    const A3 = boardFromName('A3');
    const hint = { board: A3, kind: 'enumeration' as const };
    StubWorker.replyWith = (m) => ({ id: m.id, ok: true, result: { $board: 'Q7' } });
    const r1 = await settle(engineCall('toLabels', [A3, [0]], hint));
    expect({ settled: r1.settled, uncaught: StubWorker.uncaught }).toEqual({ settled: 'rejected: NotABoard', uncaught: [] });
    expect(r1.error).toBeInstanceOf(NotABoard);
    StubWorker.replyWith = (m) => ({ id: m.id, ok: false, error: { name: 'NotAffine', message: 'odd', data: { $board: 'Q7' } } });
    const r2 = await settle(engineCall('toLabels', [A3, [0]], hint));
    expect({ settled: r2.settled, uncaught: StubWorker.uncaught }).toEqual({ settled: 'rejected: NotABoard', uncaught: [] });
    StubWorker.replyWith = null;
    expect(await engineCall('toLabels', [A3, [0, 2]], hint)).toEqual([1, 3]);
  });
});
