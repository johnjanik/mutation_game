// RT-11 attack 7 (SPEC.md 5.4: wavePlay gives "rounds and legality of the wave", oracle wave_play; SPEC.md
// 2.3: a node may be fired only when its number is positive): a wave that fires a node holding 0 is not
// legal (the oracle's test is `a[i] <= 0`). No test fired a zero in a wave, so a wavePlay that marked only
// negative firings as illegal passed the whole suite (mutant M3-wave-legal). Adopted from the red team
// (P3-RT-11-07). Expected values printed by the oracle with
//   python3 -c "import sys; sys.path.insert(0, 'reference'); import lie_games as L; print(L.wave_play(L.cartan('A', 3), (1, 0, 0), 0))"
// and the same call for each row (letter, rank, start, first colour); positions equal labels minus one on
// these named boards.
import { describe, expect, it } from 'vitest';
import { wavePlay } from '../../src/weyl';
import { boardOf } from '../golden/_harness';

const CASES: [string, number[], 0 | 1, number, boolean][] = [
  ['A3', [1, 0, 0], 0, 3, false],
  ['A3', [1, 0, 0], 1, 4, false],
  ['A3', [0, 1, 0], 0, 4, false],
  ['A3', [0, 1, 0], 1, 3, true],
  ['B3', [1, 0, 0], 0, 5, false],
  ['B3', [1, 0, 0], 1, 6, false],
  ['G2', [1, 0], 0, 5, true],
  ['G2', [1, 0], 1, 6, false],
];

describe('wave legality when a node holding 0 is fired', () => {
  for (const [T, start, first, rounds, legal] of CASES) {
    // regression: P3-RT-11-07
    it(`${T} from (${start.join(', ')}), first colour ${first}: ${rounds} rounds, legal ${legal}`, () => {
      const w = wavePlay(boardOf(T), start, first);
      expect(w.rounds).toBe(rounds);
      expect(w.legal).toBe(legal);
    });
  }
});
