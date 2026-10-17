// The arithmetic interface of SPEC.md 5.2 (E-2) with its two phase-0 instances.
// SafeInt: JavaScript numbers, every result checked with Number.isSafeInteger; a failure throws
// EngineOverflow. Big: bigint. Phase 7 adds ZPhi.
import { EngineOverflow } from './errors';

export { EngineOverflow };

export interface Arith<T> {
  zero: T;
  one: T;
  fromInt(n: number): T;
  add(a: T, b: T): T;
  sub(a: T, b: T): T;
  mul(a: T, b: T): T;
  neg(a: T): T;
  sign(a: T): -1 | 0 | 1;
  eq(a: T, b: T): boolean;
  show(a: T): string; // decimal text; also the hash key
  toBig(a: T): bigint; // SafeInt and Big only
}

export type Vec<T> = readonly T[];
export type Matrix<T> = readonly (readonly T[])[];

/** Checks a result, and normalises -0 to 0 so that show and eq behave as for integers. */
function checked(x: number, what: string): number {
  if (!Number.isSafeInteger(x)) {
    throw new EngineOverflow(`${what} gave ${String(x)}, which is not a safe integer`);
  }
  return x === 0 ? 0 : x;
}

export const SafeInt: Arith<number> = {
  zero: 0,
  one: 1,
  fromInt: (n) => checked(n, 'fromInt'),
  add: (a, b) => checked(a + b, 'add'),
  sub: (a, b) => checked(a - b, 'sub'),
  mul: (a, b) => checked(a * b, 'mul'),
  neg: (a) => (a === 0 ? 0 : -a),
  sign: (a) => (a > 0 ? 1 : a < 0 ? -1 : 0),
  eq: (a, b) => a === b,
  show: (a) => String(a),
  toBig: (a) => BigInt(a),
};

export const Big: Arith<bigint> = {
  zero: 0n,
  one: 1n,
  fromInt: (n) => BigInt(n),
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  neg: (a) => -a,
  sign: (a) => (a > 0n ? 1 : a < 0n ? -1 : 0),
  eq: (a, b) => a === b,
  show: (a) => a.toString(),
  toBig: (a) => a,
};
