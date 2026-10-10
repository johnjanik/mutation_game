// The golden key `heaps` (SPEC.md 5.7, phase 3; 5.5 "Heaps"; 2.7 F5, F10, F11; P3-A2 instruction 5.10):
// allCompleteGames, heapKey and commutationClassSize on the six boards from all ones, and the three
// minuscule plays "A4 omega_2", "D5 omega_5", "E6 omega_1" (the node in the key is a label, converted
// with toPositions). The oracle's own checks of verify.py section 18 (lines 1537 to 1564) are replayed:
// the class size equals the number of games per heap, the minuscule plays have one heap, and the A3
// examples of heap and heapKey. This is the only file that registers `heaps`.
import { describe, expect, it } from 'vitest';
import { CAPS } from '../../src/caps';
import { toPositions } from '../../src/board';
import { allCompleteGames, commutationClassSize, heap, heapKey } from '../../src/heaps';
import { play } from '../../src/play';
import { orbit } from '../../src/search';
import { boardOf, covers, golden, intEq } from './_harness';
import { ones } from '../helpers/p1';

covers('heaps');

interface HeapsBoardRecord {
  complete_games: number;
  distinct_heaps: number;
  games_per_heap: number[];
}
interface HeapsMinusculeRecord {
  moves: number;
  orbit_size: number;
  complete_games: number;
}
const heaps = golden.heaps as Record<string, HeapsBoardRecord | HeapsMinusculeRecord>;

const SIX_BOARDS = ['A2', 'A3', 'B2', 'B3', 'G2', 'D4'] as const;
const MINUSCULE = [
  { key: 'A4 omega_2', type: 'A4', label: 2 },
  { key: 'D5 omega_5', type: 'D5', label: 5 },
  { key: 'E6 omega_1', type: 'E6', label: 1 },
] as const;

/** The games grouped by heapKey: one representative word and the count of each class. */
function classesOf(T: string): Map<string, { word: readonly number[]; games: number }> {
  const b = boardOf(T);
  const all = allCompleteGames(b, ones(b), CAPS.legalLayersDefault);
  expect(all.truncated).toBe(false);
  const classes = new Map<string, { word: readonly number[]; games: number }>();
  for (const w of all.items) {
    const key = heapKey(b, w);
    const cls = classes.get(key);
    if (cls === undefined) classes.set(key, { word: w, games: 1 });
    else cls.games += 1;
  }
  return classes;
}

function omegaOf(type: string, label: number): { b: ReturnType<typeof boardOf>; omega: number[] } {
  const b = boardOf(type);
  const [p] = toPositions(b, [label]);
  const omega: number[] = [];
  for (let j = 0; j < b.n; j++) omega.push(j === p ? 1 : 0);
  return { b, omega };
}

describe('golden key heaps', () => {
  it('heaps: six boards from all ones', () => {
    for (const T of SIX_BOARDS) {
      const rec = heaps[T] as HeapsBoardRecord;
      const b = boardOf(T);
      const all = allCompleteGames(b, ones(b), CAPS.legalLayersDefault);
      expect(all.truncated).toBe(false);
      intEq(all.items.length, rec.complete_games, `${T} complete_games`);
      const classes = classesOf(T);
      intEq(classes.size, rec.distinct_heaps, `${T} distinct_heaps`);
      const perHeap = [...classes.values()].map((c) => c.games).sort((x, y) => x - y);
      intEq(perHeap, rec.games_per_heap, `${T} games_per_heap`);
    }
  });

  it('class size equals games per heap', () => {
    let heapsSeen = 0;
    for (const T of SIX_BOARDS) {
      const b = boardOf(T);
      for (const [key, cls] of classesOf(T)) {
        intEq(commutationClassSize(b, cls.word), cls.games, `${T} heap ${key}`);
        heapsSeen += 1;
      }
    }
    expect(heapsSeen).toBe(2 + 8 + 2 + 14 + 2 + 182);
  });

  it('heaps: minuscule plays', () => {
    for (const { key, type, label } of MINUSCULE) {
      const rec = heaps[key] as HeapsMinusculeRecord;
      const { b, omega } = omegaOf(type, label);
      const r = play(b, omega);
      expect(r.status).toBe('ended');
      intEq(r.word.length, rec.moves, `${key} moves`);
      const o = orbit(b, [omega], 'firing', CAPS.mainThreadItems);
      expect(o.truncated).toBe(false);
      intEq(o.items.length, rec.orbit_size, `${key} orbit_size`);
      intEq(commutationClassSize(b, r.word), rec.complete_games, `${key} complete_games`);
    }
  });

  it('minuscule plays have one heap', () => {
    for (const { key, type, label } of MINUSCULE) {
      const { b, omega } = omegaOf(type, label);
      const r = play(b, omega);
      for (const x of r.fired) intEq(x, 1, `${key}: every number fired is 1`);
      if (type === 'E6') continue; // the oracle skips the enumeration on E6 omega_1
      const all = allCompleteGames(b, omega, CAPS.legalLayersDefault);
      expect(all.truncated).toBe(false);
      const keys = new Set(all.items.map((w) => heapKey(b, w)));
      expect(keys.size).toBe(1);
      intEq(commutationClassSize(b, r.word), all.items.length, `${key}: class size is the number of games`);
    }
  });

  it('A3 examples', () => {
    const b = boardOf('A3');
    expect(heapKey(b, [0, 2, 1])).toBe(heapKey(b, [2, 0, 1]));
    expect(heapKey(b, [0, 1, 0])).not.toBe(heapKey(b, [1, 0, 1]));
    expect(heap(b, [0, 1, 0, 2, 1, 0])).toEqual([1, 2, 3, 3, 4, 5]);
  });
});
