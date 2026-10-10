// Shared helpers for the phase-1 tests (P1-A1 instruction 5.12, plan addition). Imported by test files
// only; nothing under src/ depends on this file. seededChoose uses floating point, which the rule of
// E-1 forbids in src/ and allows here.
import { Big } from '../../src/arith';
import type { Board } from '../../src/board';
import { boardKind } from '../../src/board';
import type { Choose } from '../../src/moves';

/**
 * A Board<bigint> from an integer Cartan matrix: labels 1..n unless given, kind from boardKind, Big
 * arithmetic, no name; frozen like the engine's own boards. Throws when the matrix is not a board.
 */
export function bigBoard(cartan: number[][], labels?: number[]): Board<bigint> {
  const kind = boardKind(cartan);
  if (kind === 'not-a-board') throw new Error('bigBoard: the matrix is not a board');
  const n = cartan.length;
  const rows = cartan.map((row) => Object.freeze(row.map((x) => BigInt(x))));
  const lab: number[] = labels === undefined ? [] : [...labels];
  if (labels === undefined) for (let k = 1; k <= n; k++) lab.push(k);
  if (lab.length !== n) throw new Error(`bigBoard: ${lab.length} labels for ${n} nodes`);
  return Object.freeze({ n, cartan: Object.freeze(rows), labels: Object.freeze(lab), kind, arith: Big });
}

/** e_0, ..., e_{n-1} in the board's arithmetic (the simple root populations, or the fundamental weights). */
export function unitVectors<T>(board: Board<T>): T[][] {
  const { arith, n } = board;
  const out: T[][] = [];
  for (let i = 0; i < n; i++) {
    const v: T[] = [];
    for (let j = 0; j < n; j++) v.push(j === i ? arith.one : arith.zero);
    out.push(v);
  }
  return out;
}

/** rho, "the position with 1 on every node" (SPEC.md 2.6). */
export function ones<T>(board: Board<T>): T[] {
  const out: T[] = [];
  for (let j = 0; j < board.n; j++) out.push(board.arith.one);
  return out;
}

/** The tally of fired values as the golden file stores it: keys String(value), in increasing numeric order. */
export function tallyOf(fired: readonly (number | bigint)[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const x of fired) {
    const k = String(x);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const keys = [...counts.keys()].sort((a, b) => {
    const d = BigInt(a) - BigInt(b);
    return d < 0n ? -1 : d > 0n ? 1 : 0;
  });
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = counts.get(k)!;
  return out;
}

/** A deterministic Choose: a small generator (mulberry32) seeded once, picking among the allowed positions. */
export function seededChoose<T>(seed: number): Choose<T> {
  let state = seed >>> 0;
  return (allowed) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return allowed[Math.floor(r * allowed.length)]!;
  };
}

/** The number of decimal digits of |x|. */
export function digits(x: number | bigint): number {
  if (typeof x === 'bigint') return (x < 0n ? -x : x).toString().length;
  return String(Math.abs(x)).length;
}
