// The bipartite colouring and the wave (SPEC.md 2.7 F8; 5.3 bipartition; 5.4 wavePlay; 5.7 phase 3;
// P3-A1 instruction 5.3, 5.4, 5.11): bipartition on all 32 types against bipartite_colouring, and the
// wave from rho for both start colours, whose number of rounds is the second comparison of
// types[*].coxeter_number in SPEC.md 5.7. That key is NOT registered here: a key is tested in exactly one
// file for coverage, and P1-A1's p1-types-roots.test.ts registers it; this file reads the stored value
// only to compare the rounds with it (verify.py lines 200 to 207).
import { describe, expect, it } from 'vitest';
import { applyWord } from '../../src/moves';
import { play } from '../../src/play';
import { bipartition, wavePlay } from '../../src/weyl';
import { ones } from '../helpers/p1';
import { TYPE_NAMES, boardOf, covers, golden, intEq, wordLabels } from './_harness';

covers('types[*].bipartite_colouring');

describe('bipartite colouring', () => {
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;
    it(`colouring of ${T}`, () => {
      const b = boardOf(T);
      const classes = bipartition(b);
      expect(classes).not.toBeNull();
      const [zero, one] = classes!;
      // the two classes partition the positions, each increasing
      expect([...zero, ...one].sort((x, y) => x - y)).toEqual([...Array(b.n).keys()]);
      for (let k = 1; k < zero.length; k++) expect(zero[k]!).toBeGreaterThan(zero[k - 1]!);
      for (let k = 1; k < one.length; k++) expect(one[k]!).toBeGreaterThan(one[k - 1]!);
      // joined nodes differ
      for (let i = 0; i < b.n; i++) {
        for (let j = 0; j < b.n; j++) {
          if (i !== j && (b.cartan[i]![j] !== 0 || b.cartan[j]![i] !== 0)) {
            expect(zero.includes(i)).not.toBe(zero.includes(j));
          }
        }
      }
      // the golden mapping of 5.3: colour 0 for class 0, in label order (position order here)
      const colour: number[] = [];
      for (let i = 0; i < b.n; i++) colour.push(zero.includes(i) ? 0 : 1);
      intEq(colour, rec.bipartite_colouring, 'bipartite_colouring');
    });
  }
});

describe('wave from rho lasts h rounds', () => {
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;
    if (rec.cartan.length < 2) continue;
    for (const c of [0, 1] as const) {
      it(`${T}, first colour ${c}`, () => {
        const b = boardOf(T);
        const N = play(b, ones(b)).moves;
        const w = wavePlay(b, ones(b), c);
        intEq(w.rounds, rec.coxeter_number, 'rounds = h');
        expect(w.legal).toBe(true);
        expect(w.word.length).toBe(N);
        intEq(w.position, ones(b).map((x) => -x), 'the wave ends at -rho');
        // the word is the wave: the end is reached by replaying it
        intEq(applyWord(b, ones(b), w.word, 'firing'), w.position);
      });
    }
  }
  it('E8: 30 rounds, 120 moves', () => {
    const b = boardOf('E8');
    const w = wavePlay(b, ones(b), 0);
    expect(w.rounds).toBe(30);
    expect(w.word.length).toBe(120);
  });
});

describe('A1 wave', () => {
  it('1 round with the first colour, 2 with the second (the empty class goes first), one move each', () => {
    const b = boardOf('A1');
    expect(bipartition(b)).toEqual([[0], []]);
    const w0 = wavePlay(b, [1], 0);
    expect(w0).toEqual({ rounds: 1, legal: true, position: [-1], word: [0] });
    const w1 = wavePlay(b, [1], 1);
    expect(w1).toEqual({ rounds: 2, legal: true, position: [-1], word: [0] });
  });
});

describe('A3 wave of Appendix A.2', () => {
  it('the four positions after each round, word 1, 3, 2, 1, 3, 2 in labels', () => {
    const b = boardOf('A3');
    const classes = bipartition(b)!;
    expect(classes).toEqual([[0, 2], [1]]);
    const w = wavePlay(b, [1, 1, 1], 0);
    expect(w.rounds).toBe(4);
    expect(w.legal).toBe(true);
    expect(w.word).toEqual([0, 2, 1, 0, 2, 1]);
    expect(wordLabels(b, w.word)).toEqual([1, 3, 2, 1, 3, 2]);
    // split the word by rounds: round k fires the class (first + k) mod 2
    const after: number[][] = [];
    let a = [1, 1, 1];
    let k = 0;
    for (let r = 0; r < w.rounds; r++) {
      const cls = classes[r % 2]!;
      a = applyWord(b, a, w.word.slice(k, k + cls.length), 'firing');
      k += cls.length;
      after.push(a);
    }
    expect(after).toEqual([[-1, 3, -1], [2, -3, 2], [-2, 1, -2], [-1, -1, -1]]);
    expect(w.position).toEqual([-1, -1, -1]);
  });
  it('the second colour first also lasts 4 rounds and ends at -rho', () => {
    const w = wavePlay(boardOf('A3'), [1, 1, 1], 1);
    expect(w.rounds).toBe(4);
    expect(w.word).toEqual([1, 0, 2, 1, 0, 2]);
    expect(w.position).toEqual([-1, -1, -1]);
  });
});

describe('waves from other starts (oracle wave_play)', () => {
  it('a start with no positive number: 0 rounds, legal, empty word, the start itself', () => {
    const w = wavePlay(boardOf('A3'), [0, 0, -1], 0);
    expect(w).toEqual({ rounds: 0, legal: true, position: [0, 0, -1], word: [] });
  });
  it('A2 from (1, -1): the first colour ends in 1 legal round; the second fires a non-positive node and takes 4 rounds', () => {
    const b = boardOf('A2');
    expect(wavePlay(b, [1, -1], 0)).toEqual({ rounds: 1, legal: true, position: [-1, 0], word: [0] });
    const w = wavePlay(b, [1, -1], 1);
    expect(w.rounds).toBe(4);
    expect(w.legal).toBe(false);
    expect(w.word).toEqual([1, 0, 1, 0]);
    expect(w.position).toEqual([-1, 0]);
  });
  it('A2 from (2, -1) with the first colour: 2 legal rounds', () => {
    expect(wavePlay(boardOf('A2'), [2, -1], 0)).toEqual({ rounds: 2, legal: true, position: [-1, -1], word: [0, 1] });
  });
  it('the arguments are not changed', () => {
    const a = Object.freeze([1, 1, 1]);
    const w = wavePlay(boardOf('A3'), a, 0);
    expect(a).toEqual([1, 1, 1]);
    expect(w.position).not.toBe(a);
  });
});
