// Boards (SPEC.md 2.1, 2.8, 5.2, 5.3, E-7, E-8). Skeleton: stubs that throw until the tests exist.
import type { Arith, Matrix } from './arith';

export interface Board<T = number> {
  n: number;
  cartan: Matrix<T>; // C[i][j] = <alpha_i^vee, alpha_j>, positions 0..n-1
  labels: readonly number[]; // what the reader sees for each position (E-7)
  kind: 'gcm' | 'one-way';
  arith: Arith<T>;
  name?: string; // "E8", "B3", "A4~", "D4^(3)", "pentagon"; undefined if custom
}

export type AnyBoard = Board<number> | Board<bigint>;

export function cartan(_name: string): number[][] {
  throw new Error('not implemented');
}

export function boardFromName(_name: string): AnyBoard {
  throw new Error('not implemented');
}

export function fromAdjacency(_A: number[][]): AnyBoard {
  throw new Error('not implemented');
}

export function adjacency(_board: AnyBoard): number[][] {
  throw new Error('not implemented');
}

export function boardKind(_C: readonly (readonly number[])[]): 'not-a-board' | 'one-way' | 'gcm' {
  throw new Error('not implemented');
}

export function toLabels(_board: AnyBoard, _positions: readonly number[]): number[] {
  throw new Error('not implemented');
}

export function toPositions(_board: AnyBoard, _labels: readonly number[]): number[] {
  throw new Error('not implemented');
}

export function cartanNumbers(_board: AnyBoard): number[][] {
  throw new Error('not implemented');
}
