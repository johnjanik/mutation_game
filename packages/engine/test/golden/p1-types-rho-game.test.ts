// The game from all ones (SPEC.md 2.6, 2.7 F4; 5.7 phase 1; P1-A1 instruction 5.10): longest_word,
// fired_values, fired_tally, minus_w0 on all 32 types, through play, longestWord and minusW0.
import { describe, expect, it } from 'vitest';
import { positiveRoots } from '../../src/search';
import { play } from '../../src/play';
import { longestWord, minusW0 } from '../../src/finite';
import { ones, tallyOf } from '../helpers/p1';
import { TYPE_NAMES, boardOf, covers, golden, intEq, labels, wordLabels } from './_harness';

covers('types[*].longest_word', 'types[*].fired_values', 'types[*].fired_tally', 'types[*].minus_w0');

describe('the game from all ones', () => {
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;

    it(`game from all ones on ${T}`, () => {
      const b = boardOf(T);
      const r = play(b, ones(b));
      expect(r.status).toBe('ended');
      intEq(r.moves, positiveRoots(b).length, 'F4: N moves');
      intEq(r.fired, rec.fired_values, 'fired_values');
      intEq(r.position, ones(b).map((x) => -x), 'w0 sends rho to -rho');
    });

    it(`tally of fired values on ${T}`, () => {
      const b = boardOf(T);
      expect(tallyOf(play(b, ones(b)).fired)).toEqual(rec.fired_tally);
    });

    it(`longest word of ${T}`, () => {
      const b = boardOf(T);
      const word = longestWord(b);
      intEq(wordLabels(b, word), rec.longest_word, 'longest_word');
      expect(word).toEqual(play(b, ones(b)).word);
    });

    it(`minus w0 on ${T}`, () => {
      const b = boardOf(T);
      intEq(labels(b, minusW0(b)), rec.minus_w0, 'minus_w0');
    });
  }
});
