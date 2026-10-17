// The engine's Web Worker (SPEC.md 5.1 E-9; CONTRACTS.md 4). It receives { id, fn, args, board },
// deserializes the arguments, calls the engine function (or one of the two site replay functions,
// positionsOf and firstForbiddenMove) synchronously, and answers { id, ok: true, result } or
// { id, ok: false, error: { name, message, data? } }. It holds no state between calls except the
// engine's own cache (E-11). Created only by worker.ts, on the first call routed to it.
import * as engine from '@two-games/engine';
import { firstForbiddenMove, positionsOf } from './state';
import { deserialize, errorToWire, serialize, type CallMessage, type ReplyMessage } from './workerWire';

const api: Record<string, unknown> = { ...engine, positionsOf, firstForbiddenMove };

/** Handles one call; exported so that a unit test can drive it without a worker. */
export function handleCall(message: CallMessage): ReplyMessage {
  try {
    const f = api[message.fn];
    if (typeof f !== 'function') throw new TypeError(`the engine has no function ${message.fn}`);
    const args = message.args.map(deserialize);
    const result = (f as (...a: unknown[]) => unknown)(...args);
    return { id: message.id, ok: true, result: serialize(result) };
  } catch (err) {
    return { id: message.id, ok: false, error: errorToWire(err) };
  }
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<CallMessage>) => void) | null;
  postMessage(message: ReplyMessage): void;
}

// Inside a worker `self` is the worker's global scope; elsewhere (a unit test importing this module)
// there is no `self.postMessage` to answer through and nothing is installed.
const scope = (typeof self !== 'undefined' ? self : undefined) as unknown as WorkerScope | undefined;
if (scope && typeof scope.postMessage === 'function' && typeof (globalThis as { document?: unknown }).document === 'undefined') {
  scope.onmessage = (event) => {
    scope.postMessage(handleCall(event.data));
  };
}
