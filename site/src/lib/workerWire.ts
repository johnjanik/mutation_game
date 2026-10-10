// The messages between the page and the engine worker (CONTRACTS.md 4, worker.ts): serialization of
// arguments and results, and errors re-thrown as the same class. Shared by worker.ts (main side) and
// engine.worker.ts (worker side); it creates no worker and imports neither of them, so the worker's
// bundle never contains the code that starts a worker.
//   bigint          -> { "$big": "decimal" }
//   Map             -> { "$map": [[k, v], ...] }   (keys and values serialized in turn)
//   Board           -> { "$board": BoardSpec }      (rebuilt with resolveBoard)
//   bigBoard copy   -> { "$board": BoardSpec, "arith": "Big" }   (plan: a named finite board in Big)
// Rationals ({ num, den } of bigint) pass through the $big rule.
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
  cartanNumbers,
} from '@two-games/engine';
import type { Admissibility, AnyBoard } from '@two-games/engine';
import { bigBoard, resolveBoard, type BoardSpec } from './state';

export type Serialized =
  | null
  | boolean
  | number
  | string
  | { $big: string }
  | { $map: [Serialized, Serialized][] }
  | { $board: BoardSpec; arith?: 'Big' }
  | { $undefined: true }
  | Serialized[]
  | { [key: string]: Serialized };

export interface CallMessage {
  id: number;
  fn: string;
  args: Serialized[];
  board: BoardSpec | null;
}

export interface WireError {
  name: string;
  message: string;
  data?: Serialized;
}

export type ReplyMessage = { id: number; ok: true; result: Serialized } | { id: number; ok: false; error: WireError };

function isBoard(x: unknown): x is AnyBoard {
  if (x === null || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  return typeof b.n === 'number' && Array.isArray(b.cartan) && Array.isArray(b.labels) && typeof b.arith === 'object' && b.arith !== null;
}

/** The BoardSpec of a board: its name when it has one, otherwise its Cartan matrix. */
export function specOf(board: AnyBoard): BoardSpec {
  return board.name !== undefined ? board.name : { cartan: cartanNumbers(board) };
}

export function serialize(value: unknown): Serialized {
  if (value === null) return null;
  switch (typeof value) {
    case 'undefined':
      return { $undefined: true };
    case 'boolean':
    case 'number':
    case 'string':
      return value;
    case 'bigint':
      return { $big: value.toString() };
    case 'function':
    case 'symbol':
      throw new TypeError(`a ${typeof value} cannot be sent to the worker`);
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (value instanceof Map) return { $map: [...value.entries()].map(([k, v]) => [serialize(k), serialize(v)]) };
  if (isBoard(value)) {
    const spec = specOf(value);
    // A named board in Big whose name resolves to SafeInt (a bigBoard copy) keeps its arithmetic.
    return value.arith === (Big as unknown) && typeof spec === 'string' && resolveBoard(spec).arith !== (Big as unknown)
      ? { $board: spec, arith: 'Big' }
      : { $board: spec };
  }
  const out: Record<string, Serialized> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = serialize(v);
  return out;
}

export function deserialize(value: Serialized): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deserialize);
  const o = value as Record<string, unknown>;
  if (typeof o.$big === 'string' && Object.keys(o).length === 1) return BigInt(o.$big);
  if (o.$undefined === true && Object.keys(o).length === 1) return undefined;
  if (Array.isArray(o.$map) && Object.keys(o).length === 1) {
    return new Map((o.$map as [Serialized, Serialized][]).map(([k, v]) => [deserialize(k), deserialize(v)]));
  }
  if ('$board' in o) {
    const board = resolveBoard(o.$board as BoardSpec);
    return o.arith === 'Big' ? bigBoard(board) : board;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[k] = deserialize(v as Serialized);
  return out;
}

export function errorToWire(err: unknown): WireError {
  if (err instanceof Error) {
    const wire: WireError = { name: err.name, message: err.message };
    const data = (err as { data?: unknown }).data;
    if (data !== undefined) wire.data = serialize(data);
    return wire;
  }
  return { name: 'Error', message: String(err) };
}

/** Re-creates the error on the main side as the same class (E-10 classes and the built-in ones). */
export function wireToError(wire: WireError): Error {
  const data = wire.data === undefined ? undefined : deserialize(wire.data);
  let err: Error;
  switch (wire.name) {
    case 'NotAffine': {
      const cls = (data as { class?: 'finite' | 'indefinite' } | undefined)?.class ?? 'indefinite';
      err = new NotAffine(cls);
      break;
    }
    case 'NotAdmissible':
      err = new NotAdmissible(data as Admissibility, wire.message);
      break;
    case 'NotABoard': err = new NotABoard(wire.message); break;
    case 'NeedsTwoWayRoads': err = new NeedsTwoWayRoads(wire.message); break;
    case 'NeedsConnectedBoard': err = new NeedsConnectedBoard(wire.message); break;
    case 'NotFiniteType': err = new NotFiniteType(wire.message); break;
    case 'EngineOverflow': err = new EngineOverflow(wire.message); break;
    case 'EngineError': err = new EngineError(wire.message); break;
    case 'RangeError': err = new RangeError(wire.message); break;
    case 'TypeError': err = new TypeError(wire.message); break;
    default: err = new Error(wire.message);
  }
  err.message = wire.message;
  return err;
}
