// Where an engine call runs (SPEC.md 5.1 E-9; CONTRACTS.md 4). Engine functions are synchronous and
// know nothing about workers. At build time (Astro rendering in Node) every call runs in-process. In
// the browser this module decides BEFORE a call where it runs; everything runs on the main thread
// except the three cases of E-9, which run in a Web Worker behind the same promise. A call is never
// started in one place and continued in the other: a worker failure rejects the promise.
//
// The worker is created lazily, on the first call routed to it, never at import time: no route may
// fetch its script before the first interaction (7.6, worker-on-demand.spec.ts).
import * as engine from '@two-games/engine';
import { CAPS } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';
import { firstForbiddenMove, isNamedFinite, positionsOf } from './state';
import { deserialize, serialize, specOf, wireToError, type CallMessage, type ReplyMessage } from './workerWire';

export type CallHint = {
  board: AnyBoard;
  kind: 'enumeration' | 'play' | 'count' | 'satake' | 'other';
  expectedItems?: number;
  moves?: number;
  finiteKnown?: boolean;
};

/** The engine's exports plus the two site replay functions, so that a long link replay runs in the worker (plan). */
export const engineApi = { ...engine, positionsOf, firstForbiddenMove };

type AnyFunction = (...args: never[]) => unknown;
type Api = typeof engineApi;
/** The callable members of the engine API (classes and constants excluded). */
export type EngineApi = { [K in keyof Api as Api[K] extends AnyFunction ? K : never]: Api[K] };

const LIMIT = CAPS.mainThreadItems; // 2000 (E-9, 5.6)

/**
 * The rule of E-9 as a pure function of the hint.
 * - enumeration: main exactly when `expectedItems` is given and at most 2000 (the cap of the search
 *   when it is at most 2000, the number of roots of a finite-type board, from phase 3 orbitSize).
 * - play: worker when `moves` is given and above 2000 (a word, a link's move list); worker for a play
 *   to the end (`moves` absent) on a board not known to be finite; main otherwise. `finiteKnown`
 *   defaults to isNamedFinite(board): before phase 2 every custom board counts as not finite.
 * - count: worker when `expectedItems` (the order of the group) is above 2000.
 * - satake: worker for E7 and E8, and when `expectedItems` is given (the pairs of a sweep).
 * - other: main.
 * playFate always runs in the worker; engineCall checks the function name, which a hint lacks.
 */
export function whereToRun(hint: CallHint): 'main' | 'worker' {
  switch (hint.kind) {
    case 'enumeration':
      return hint.expectedItems !== undefined && hint.expectedItems <= LIMIT ? 'main' : 'worker';
    case 'play': {
      if (hint.moves !== undefined) return hint.moves > LIMIT ? 'worker' : 'main';
      const finite = hint.finiteKnown ?? isNamedFinite(hint.board);
      return finite ? 'main' : 'worker';
    }
    case 'count':
      return hint.expectedItems !== undefined && hint.expectedItems > LIMIT ? 'worker' : 'main';
    case 'satake':
      return hint.board.name === 'E7' || hint.board.name === 'E8' || hint.expectedItems !== undefined ? 'worker' : 'main';
    case 'other':
      return 'main';
  }
}

/** Functions that always run in the worker, whatever the hint (E-9 rule 2 names playFate). */
const ALWAYS_IN_WORKER: ReadonlySet<string> = new Set(['playFate']);

// ---------------------------------------------------------------------------------------------
// Runtime seams. In Node (build time, unit tests) calls run in-process; tests replace the seams.
// ---------------------------------------------------------------------------------------------

interface Runtime {
  inNode: () => boolean;
  createWorker: () => Worker;
}

const defaultRuntime: Runtime = {
  inNode: () => import.meta.env.SSR === true || typeof window === 'undefined',
  // The literal form that Vite turns into a separate worker chunk; evaluated only when called.
  createWorker: () => new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' }),
};

let runtime: Runtime = defaultRuntime;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(reason: Error): void {
  for (const p of pending.values()) p.reject(reason);
  pending.clear();
}

function theWorker(): Worker {
  if (worker !== null) return worker;
  const w = runtime.createWorker();
  w.onmessage = (event: MessageEvent<ReplyMessage>) => {
    const reply = event.data;
    const p = pending.get(reply.id);
    if (!p) return;
    pending.delete(reply.id);
    if (reply.ok) p.resolve(deserialize(reply.result));
    else p.reject(wireToError(reply.error));
  };
  w.onerror = (event: ErrorEvent) => {
    event.preventDefault?.();
    failAll(new Error(`the engine worker failed: ${event.message ?? 'unknown error'}`));
  };
  worker = w;
  return w;
}

type Fn = keyof EngineApi;

/**
 * Calls an engine function where E-9 says it runs and answers with a promise. In Node, or when the
 * rule says 'main', the function runs here and now. Otherwise the call is posted to the worker
 * ({ id, fn, args, board }) and the promise settles with its reply; errors keep their class.
 */
export function engineCall<F extends Fn>(
  fn: F,
  args: Parameters<EngineApi[F]>,
  hint: CallHint,
): Promise<Awaited<ReturnType<EngineApi[F]>>> {
  const name = fn as string;
  const where = ALWAYS_IN_WORKER.has(name) ? 'worker' : whereToRun(hint);
  if (runtime.inNode() || where === 'main') {
    try {
      const f = (engineApi as unknown as Record<string, (...a: unknown[]) => unknown>)[name];
      if (typeof f !== 'function') throw new TypeError(`the engine has no function ${name}`);
      return Promise.resolve(f(...(args as unknown[]))) as Promise<Awaited<ReturnType<EngineApi[F]>>>;
    } catch (err) {
      return Promise.reject(err);
    }
  }
  let message: CallMessage;
  try {
    message = { id: nextId++, fn: name, args: (args as unknown[]).map(serialize), board: specOf(hint.board) };
  } catch (err) {
    return Promise.reject(err);
  }
  const w = theWorker();
  return new Promise((resolve, reject) => {
    pending.set(message.id, { resolve: resolve as (v: unknown) => void, reject });
    try {
      w.postMessage(message);
    } catch (err) {
      pending.delete(message.id);
      reject(err);
    }
  });
}

/** Test seams (plan): replace how Node is detected and how the worker is made; reset the module. */
export const __testing = {
  setRuntime(partial: Partial<Runtime>): void {
    runtime = { ...runtime, ...partial };
  },
  reset(): void {
    if (worker !== null) worker.terminate?.();
    worker = null;
    failAll(new Error('reset'));
    runtime = defaultRuntime;
    nextId = 1;
  },
  workerCreated(): boolean {
    return worker !== null;
  },
};
