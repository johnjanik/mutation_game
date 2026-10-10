// The two moves (SPEC.md 2.2, 2.3). Skeleton: stubs that throw until the tests exist.
import type { Vec } from './arith';
import type { Board } from './board';

export type Word = readonly number[]; // positions, in the order played
export type Game = 'mutation' | 'firing';
export type Choose<T> = (allowed: readonly number[], v: Vec<T>) => number; // picks a position among allowed

export function mutate<T>(_board: Board<T>, _p: Vec<T>, _i: number): T[] {
  throw new Error('not implemented');
}

export function fire<T>(_board: Board<T>, _a: Vec<T>, _i: number): T[] {
  throw new Error('not implemented');
}
