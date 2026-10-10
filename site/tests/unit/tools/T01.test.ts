// P1-A5: tool T1, the Game Board (SPEC.md 4 T1, 4.0, 7.5). The acceptance criteria that range over
// every type or many random cases, the model of site/src/components/tools/t01/, and the server render
// of T01GameBoard.svelte for the properties a link cannot set (script, goal, rounds, hints, panels,
// roadStyle, prediction, linkTo). Golden values are read from reference/golden_data.json, never typed;
// this file calls no covers(): longest_word and fired_values belong to P1-A1's golden files.
// Random cases use a fixed seed (mulberry32, SEED below).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Big, CAPS, boardFromName, fire, mutate, toNumbers, toPositions, toPopulation, ratToString } from '@engine';
import type { AnyBoard, Board } from '@engine';
import {
  MODES,
  MODES_OF_VIEW,
  PICKER_GROUPS,
  PICKER_NAMES,
  T1Game,
  VIEWS,
  goalMet,
  goalNote,
  inLabelOrder,
  limitText,
  pairAllowed,
  panelsToDraw,
  requirePair,
  requireScript,
  roundCount,
  scriptCaption,
  scriptProgress,
  signWord,
  SCRIPT_OFF_TEXT,
  type Goal,
  type Mode,
  type View,
} from '../../../src/components/tools/t01/model';
import { isLong, shortValue, digitCount } from '../../../src/components/tools/t01/longNumber';
import { moveSentence, playSentence, refusalSentence, spokenValue, undoSentence } from '../../../src/components/tools/t01/announce';
import { followJumps, highlightMatches, predictionCorrect, predictionAnswerText } from '../../../src/components/tools/t01/interop';
import { createAnnouncer } from '../../../src/lib/a11y';
import { bigBoard, clearPublishedStates, followToolState, publishToolState } from '../../../src/lib/state';
import type { Prediction } from '../../../src/tools/types';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

/** A short key of this checkout, so that concurrent worktrees never share a compile cache (MERGE, P2 stage 2.1). */
function checkoutKey(): string {
  return createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8);
}
import { join } from 'node:path';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { longest_word: number[]; fired_values: number[]; cartan: number[][] }>;
};
const TYPE_NAMES = Object.keys(golden.types);

const SEED = 20261010;
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (rnd: () => number, lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));

const ones = (n: number): number[] => Array.from({ length: n }, () => 1);
const show = (board: AnyBoard, v: readonly unknown[]): string[] => v.map((x) => (board as Board<unknown>).arith.show(x));

/** The numbers C p of a shown population (strings by position), from the engine. */
function cp(board: AnyBoard, pops: readonly string[]): string[] {
  const b = board as Board<unknown>;
  const p = pops.map((x) => (typeof b.arith.zero === 'bigint' ? BigInt(x) : b.arith.fromInt(Number(x))));
  return show(board, toNumbers(b, p));
}

describe('T1 SPEC acceptance over every type and random cases', () => {
  it('legal play of longest_word from all ones on every type', () => {
    expect(TYPE_NAMES).toHaveLength(32);
    for (const name of TYPE_NAMES) {
      const { longest_word: word, fired_values: firedValues } = golden.types[name]!;
      const g = new T1Game({ board: name, view: 'numbers', mode: 'legal', coords: 'numbers', start: ones(golden.types[name]!.cartan.length) });
      const fired: number[] = [];
      for (const label of word) {
        const k = toPositions(g.board, [label])[0]!;
        expect(g.canAct()[k], `${name}: node ${label} allowed at move ${g.cursor + 1}`).toBe(true);
        fired.push(Number(g.shown.numbers[k]));
        expect(g.act(k).kind).toBe('moved');
      }
      expect(fired, name).toEqual(firedValues);
      expect(inLabelOrder(g.board, g.shown.numbers), name).toEqual(g.labels.map(() => '-1'));
      expect(g.gameOver).toBe(true);
    }
  });

  it('linked view keeps a = Cp on A3, B3, G2, E8', () => {
    const rnd = mulberry32(SEED);
    for (const name of ['A3', 'B3', 'G2', 'E8']) {
      const n = boardFromName(name).n;
      for (let trial = 0; trial < 100; trial++) {
        const start = Array.from({ length: n }, () => int(rnd, -9, 9));
        const g = new T1Game({ board: name, view: 'linked', mode: 'free', coords: 'populations', start });
        expect(g.view).toBe('linked');
        expect(g.shown.numbers).toEqual(cp(g.board, g.shown.populations!));
        const moves = int(rnd, 1, 12);
        for (let m = 0; m < moves; m++) {
          g.act(int(rnd, 0, n - 1));
          expect(g.shown.numbers).toEqual(cp(g.board, g.shown.populations!));
        }
      }
    }
  });

  it('undo restores the previous position exactly in all three modes', () => {
    const rnd = mulberry32(SEED + 1);
    const cases: { board: string; view: View; mode: Mode; coords: 'populations' | 'numbers'; start?: number[] }[] = [
      { board: 'A3', view: 'numbers', mode: 'free', coords: 'numbers' },
      { board: 'B3', view: 'populations', mode: 'free', coords: 'populations' },
      { board: 'G2', view: 'linked', mode: 'free', coords: 'numbers', start: [1, 0] },
      { board: 'D5', view: 'numbers', mode: 'legal', coords: 'numbers' },
      { board: 'A2', view: 'linked', mode: 'legal', coords: 'numbers', start: [1, 0] },
      { board: 'E6', view: 'populations', mode: 'raising', coords: 'populations' },
      { board: 'F4', view: 'linked', mode: 'raising', coords: 'populations' },
      { board: 'B2', view: 'linked', mode: 'raising', coords: 'numbers', start: [0, -1] },
    ];
    for (const c of cases) {
      for (let trial = 0; trial < 20; trial++) {
        const g = new T1Game(c);
        for (let m = 0; m < 15; m++) {
          const allowed = g.allowedPositions();
          if (allowed.length === 0) break;
          const before = JSON.stringify(g.shown);
          g.act(allowed[int(rnd, 0, allowed.length - 1)]!);
          const after = JSON.stringify(g.shown);
          expect(g.undo()).toBe(true);
          expect(JSON.stringify(g.shown), `${c.board} ${c.mode}`).toBe(before);
          expect(g.redo()).toBe(true);
          expect(JSON.stringify(g.shown)).toBe(after);
        }
      }
    }
  });
});

describe('T1 model', () => {
  it('view and mode pairs outside the table are refused', () => {
    for (const v of VIEWS) {
      for (const m of MODES) {
        const allowed = MODES_OF_VIEW[v].includes(m);
        expect(pairAllowed(v, m)).toBe(allowed);
        if (allowed) expect(() => requirePair(v, m, 'b3')).not.toThrow();
        else expect(() => requirePair(v, m, 'b3')).toThrow(/b3/);
      }
    }
    expect(pairAllowed('populations', 'legal')).toBe(false);
    expect(pairAllowed('numbers', 'raising')).toBe(false);
  });

  it('A2 numbers start (1,0) gives populations 2/3 and 1/3', () => {
    const g = new T1Game({ board: 'A2', view: 'linked', mode: 'free', coords: 'numbers', start: [1, 0] });
    expect(g.shown.populations).toEqual(['2/3', '1/3']);
    expect(g.shown.numbers).toEqual(['1', '0']);
    const p = toPopulation(boardFromName('A2') as Board<number>, [1, 0])!.map(ratToString);
    expect(g.shown.populations).toEqual(p);
    // After a firing the populations are toPopulation of the new numbers, still exact.
    g.act(0);
    expect(g.shown.numbers).toEqual(['-1', '1']);
    expect(g.shown.populations).toEqual(toPopulation(boardFromName('A2') as Board<number>, [-1, 1])!.map(ratToString));
  });

  it('populations view from a numbers start falls back to linked unless integral', () => {
    const a2 = new T1Game({ board: 'A2', view: 'populations', mode: 'free', coords: 'numbers', start: [1, 0] });
    expect(a2.view).toBe('linked');
    expect(a2.requestedView).toBe('populations');
    expect(a2.state().view).toBe('populations');
    const e8 = new T1Game({ board: 'E8', view: 'populations', mode: 'free', coords: 'numbers', start: ones(8) });
    expect(e8.view).toBe('populations');
    expect(e8.shown.populations!.every((x) => !x.includes('/'))).toBe(true);
    // det C = 1 on E8: C p equals the start.
    expect(cp(e8.board, e8.shown.populations!)).toEqual(e8.shown.numbers);
    // A3 with an integral population stays too: a = (2,-1,0) is C(1,0,0).
    expect(new T1Game({ board: 'A3', view: 'populations', mode: 'free', coords: 'numbers', start: [2, -1, 0] }).view).toBe('populations');
  });

  it('singular board with a numbers start offers only the numbers view', () => {
    const triangle = { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] };
    for (const view of VIEWS) {
      const g = new T1Game({ board: triangle, view, mode: 'free', coords: 'numbers', start: [1, 1, 1] });
      expect(g.singular).toBe(true);
      expect(g.view).toBe('numbers');
      expect(g.shown.populations).toBeNull();
    }
    // Raising mode is not in the numbers view's row: it falls back to free play (plan).
    expect(new T1Game({ board: triangle, view: 'linked', mode: 'raising', coords: 'numbers', start: [1, 1, 1] }).mode).toBe('free');
    // From populations the singular board has populations and numbers, both integers.
    const pg = new T1Game({ board: triangle, view: 'linked', mode: 'free', coords: 'populations', start: [1, 0, 0] });
    expect(pg.view).toBe('linked');
    expect(pg.shown.numbers).toEqual(['2', '-1', '-1']);
  });

  it('E8 start beyond 2^53 switches to Big', () => {
    const start = ['9007199254740993', 1, 1, 1, 1, 1, 1, 1];
    const g = new T1Game({ board: 'E8', view: 'numbers', mode: 'free', coords: 'numbers', start });
    expect(g.board.arith).toBe(Big);
    expect(g.board.name).toBe('E8');
    expect(g.board.labels).toEqual(boardFromName('E8').labels);
    expect(inLabelOrder(g.board, g.shown.numbers)[0]).toBe('9007199254740993');
    g.act(0);
    expect(g.shown.numbers[0]).toBe('-9007199254740993');
    expect(g.state().start![0]).toBe('9007199254740993');
    // An overflow during play switches too, silently, and the values stay exact.
    const big = 2 ** 52;
    const h = new T1Game({ board: 'A2', view: 'numbers', mode: 'free', coords: 'numbers', start: [big, big] });
    expect(h.board.arith).not.toBe(Big);
    h.act(0);
    h.act(1);
    expect(h.board.arith).toBe(Big);
    const a = fire(bigBoard(boardFromName('A2')), [BigInt(big), BigInt(big)], 0);
    expect(h.shownAt(1).numbers).toEqual(show(h.board, a));
    expect(h.shown.numbers).toEqual(show(h.board, fire(h.board as Board<bigint>, a, 1)));
  });

  it('raising allows exactly a_i < 0 and legal exactly a_i > 0', () => {
    const rnd = mulberry32(SEED + 2);
    for (const name of ['A3', 'B3', 'D4', 'G2', 'E7']) {
      const n = boardFromName(name).n;
      for (let trial = 0; trial < 30; trial++) {
        const start = Array.from({ length: n }, () => int(rnd, -4, 4));
        const r = new T1Game({ board: name, view: 'linked', mode: 'raising', coords: 'populations', start });
        const l = new T1Game({ board: name, view: 'linked', mode: 'legal', coords: 'populations', start });
        const a = r.shown.numbers.map(Number);
        expect(r.canAct()).toEqual(a.map((x) => x < 0));
        expect(l.canAct()).toEqual(a.map((x) => x > 0));
      }
    }
  });

  it('sign fill and ring follow the value and the mode', () => {
    expect(signWord('2')).toBe('positive');
    expect(signWord('-1')).toBe('negative');
    expect(signWord('0')).toBe('zero');
    expect(signWord('-2/3')).toBe('negative');
    expect(signWord('1/3')).toBe('positive');
    const g = new T1Game({ board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 0, -1] });
    expect(g.shown.numbers.map(signWord)).toEqual(['positive', 'zero', 'negative']);
    expect(g.canAct()).toEqual([true, false, false]);
    const f = new T1Game({ board: 'A3', view: 'numbers', mode: 'free', coords: 'numbers', start: [1, 0, -1] });
    expect(f.canAct()).toEqual([true, true, true]);
  });

  it('M0 figure configurations', () => {
    // Row 1: A3 populations free p = (0,1,0); mutate city 1 gives (1,1,0).
    const r1 = new T1Game({ board: 'A3', view: 'populations', mode: 'free', coords: 'populations', start: [0, 1, 0] });
    r1.act(0);
    expect(r1.shown.populations).toEqual(['1', '1', '0']);
    // Row 2 (the prediction): from (1,1,0) mutating city 2 gives 0 at city 2.
    const r2 = new T1Game({ board: 'A3', view: 'populations', mode: 'free', coords: 'populations', start: [1, 1, 0] });
    r2.act(1);
    expect(r2.shown.populations![1]).toBe('0');
    const m0: Prediction = { question: 'What will city 2 hold after it mutates?', answer: { type: 'number', value: Number(r2.shown.populations![1]) }, reveal: '-1 + 1 + 0 = 0' };
    expect(predictionCorrect(m0, 0)).toBe(true);
    // Row 3: A3 numbers free a = (0,1,0); firing node 2 gives (1,-1,1).
    const r3 = new T1Game({ board: 'A3', view: 'numbers', mode: 'free', coords: 'numbers', start: [0, 1, 0] });
    r3.act(1);
    expect(r3.shown.numbers).toEqual(['1', '-1', '1']);
    // Row 4: A3 linked p = (0,1,0) shows (-1,2,-1); mutating city 2 lowers it by 2.
    const r4 = new T1Game({ board: 'A3', view: 'linked', mode: 'free', coords: 'populations', start: [0, 1, 0] });
    expect(r4.shown.numbers).toEqual(['-1', '2', '-1']);
    r4.act(1);
    expect(r4.shown.populations).toEqual(['0', '-1', '0']);
    expect(Number(r4.shownAt(0).populations![1]) - Number(r4.shown.populations![1])).toBe(Number(r4.shownAt(0).numbers[1]));
  });

  it('redo, reset and branching from an earlier position', () => {
    const g = new T1Game({ board: 'A3', view: 'numbers', mode: 'free', coords: 'numbers', start: [1, 1, 1] });
    g.act(0);
    g.act(1);
    g.act(2);
    const three = JSON.stringify(g.shown);
    g.undo();
    expect(g.state().moves).toEqual([1, 2]);
    g.redo();
    expect(g.state().moves).toEqual([1, 2, 3]);
    expect(JSON.stringify(g.shown)).toBe(three);
    g.reset();
    expect(g.cursor).toBe(0);
    expect(g.moves).toEqual([]);
    expect(g.shown.numbers).toEqual(['1', '1', '1']);
    for (const k of [0, 1, 2, 0, 1]) g.act(k);
    expect(g.scrub(2)).toBe(true);
    g.act(2);
    expect(g.moves).toEqual([1, 2, 3]);
    expect(g.cursor).toBe(3);
    expect(g.shown.numbers).toEqual(show(g.board, fire(g.board as Board<number>, fire(g.board as Board<number>, fire(g.board as Board<number>, [1, 1, 1], 0), 1), 2)));
  });

  it('a capped play is reported as still running', () => {
    const triangle = { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] };
    const g = new T1Game({ board: triangle, view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1, 1] });
    const outcome = g.playToEnd(10);
    expect(outcome).toEqual({ status: 'cap', moves: 10 });
    expect(g.moves).toHaveLength(10);
    expect(g.cursor).toBe(10);
    expect(limitText(outcome)).toBe('still running after 10 moves');
    expect(limitText({ status: 'ended', moves: 6 })).toBeNull();
    // The default cap is CAPS.playMoves.
    expect(CAPS.playMoves).toBe(20000);
  });

  it('play to the end and step follow the lowest position', () => {
    const g = new T1Game({ board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1, 1] });
    const s = new T1Game({ board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1, 1] });
    expect(g.playToEnd()).toEqual({ status: 'ended', moves: 6 });
    expect(g.shown.numbers).toEqual(['-1', '-1', '-1']);
    for (;;) {
      const k = s.stepPosition();
      if (k === null) break;
      s.act(k);
    }
    expect(s.moves).toEqual(g.moves);
    expect(g.moves).toEqual(golden.types.A3!.longest_word);
    // Raising play on A3 from p = (1,0,0) ends at (1,1,1) after 2 moves (Appendix A.4).
    const r = new T1Game({ board: 'A3', view: 'populations', mode: 'raising', coords: 'populations', start: [1, 0, 0] });
    r.act(r.stepPosition()!);
    expect(r.playToEnd()).toEqual({ status: 'ended', moves: 1 });
    expect(r.shown.populations).toEqual(['1', '1', '1']);
    expect(r.cursor).toBe(2);
    // Raising from numbers plays on -a: the same moves as the populations play.
    const rn = new T1Game({ board: 'A3', view: 'linked', mode: 'raising', coords: 'numbers', start: [2, -1, 0] });
    rn.playToEnd();
    expect(rn.shown.populations).toEqual(['1', '1', '1']);
    expect(rn.stepPosition()).toBeNull();
    expect(new T1Game({ board: 'A3', view: 'numbers', mode: 'free', coords: 'numbers' }).stepPosition()).toBeNull();
  });

  it('picker groups the 32 types by letter', () => {
    expect([...PICKER_NAMES].sort()).toEqual([...TYPE_NAMES].sort());
    expect(PICKER_NAMES).toHaveLength(32);
    for (const g of PICKER_GROUPS) {
      expect(g.names.every((n) => n.startsWith(g.letter))).toBe(true);
    }
    expect(new Set(PICKER_GROUPS.map((g) => g.letter)).size).toBe(PICKER_GROUPS.length);
    expect(PICKER_NAMES.some((n) => n.includes('~'))).toBe(false);
  });

  it('long number format', () => {
    expect(digitCount('-123')).toBe(3);
    expect(isLong('123456789012')).toBe(false);
    expect(isLong('1234567890123')).toBe(true);
    expect(isLong('-1234567890123')).toBe(true);
    expect(shortValue('123456789012')).toBe('123456789012');
    expect(shortValue('-5')).toBe('−5');
    expect(shortValue('9007199254740993')).toBe('9.0071... x 10^15 (16 digits)');
    expect(shortValue('-9007199254740993')).toBe('−9.0071... x 10^15 (16 digits)');
    const big = `12345${'0'.repeat(79)}`;
    expect(shortValue(big)).toBe('1.2345... x 10^83 (84 digits)');
    expect(shortValue('2/3')).toBe('2/3');
  });

  it('goal reach on A3', () => {
    const goal: Goal = { kind: 'reach', position: [1, 1, 0], text: 'Mutate city 1.' };
    const g = new T1Game({ board: 'A3', view: 'populations', mode: 'free', coords: 'populations', start: [0, 1, 0] });
    expect(goalMet(goal, g.board, g.shown, g.coords)).toBe(false);
    g.act(2);
    expect(goalMet(goal, g.board, g.shown, g.coords)).toBe(false);
    g.undo();
    g.act(0);
    expect(goalMet(goal, g.board, g.shown, g.coords)).toBe(true);
    // The two other kinds of goal read the numbers.
    const h = new T1Game({ board: 'A2', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1] });
    expect(goalMet({ kind: 'no-positive' }, h.board, h.shown, h.coords)).toBe(false);
    h.playToEnd();
    expect(goalMet({ kind: 'no-positive' }, h.board, h.shown, h.coords)).toBe(true);
    const k = new T1Game({ board: 'A3', view: 'populations', mode: 'raising', coords: 'populations', start: [1, 0, 0] });
    expect(goalMet({ kind: 'no-unhappy' }, k.board, k.shown, k.coords)).toBe(false);
    k.playToEnd();
    expect(goalMet({ kind: 'no-unhappy' }, k.board, k.shown, k.coords)).toBe(true);
  });

  it('goal mixed-signs gives up after 20 moves', () => {
    const rnd = mulberry32(SEED + 3);
    const goal: Goal = { kind: 'predicate', name: 'mixed-signs', giveUpAfter: 20, giveUpText: 'Twenty moves and no mixed signs: on this board it cannot happen.' };
    for (const name of ['A3', 'D4']) {
      for (let trial = 0; trial < 50; trial++) {
        const g = new T1Game({ board: name, view: 'populations', mode: 'free', coords: 'populations' });
        for (let m = 1; m <= 20; m++) {
          g.act(int(rnd, 0, g.n - 1));
          const met = goalMet(goal, g.board, g.shown, g.coords);
          expect(met).toBe(false);
          const note = goalNote(goal, met, g.cursor);
          if (m < 20) expect(note).toBeNull();
          else expect(note).toBe(goal.giveUpText);
        }
      }
    }
    // The predicate itself does fire on a population with mixed signs.
    expect(goalMet(goal, boardFromName('A2'), { populations: ['1', '-1'], numbers: ['3', '-3'] }, 'populations')).toBe(true);
  });

  it('script advances by Next', () => {
    const script = [
      { move: 1, caption: 'Mutate city 1.' },
      { move: 2, caption: 'Now city 2.' },
    ];
    const config = { board: 'A2', view: 'populations' as const, mode: 'free' as const, coords: 'populations' as const, start: [1, 0] };
    expect(() => requireScript(config, script, 'b1')).not.toThrow();
    expect(() => requireScript({ ...config, view: 'linked', mode: 'raising' }, script, 'b1')).toThrow(/b1/);
    const g = new T1Game(config);
    expect(scriptProgress(script, 0, g.applied)).toBe(0);
    expect(scriptCaption(script, 0)).toBe('Mutate city 1.');
    // Next makes the scripted move exactly as a click does.
    g.act(toPositions(g.board, [script[0]!.move])[0]!);
    expect(g.applied).toEqual([1]);
    expect(scriptProgress(script, 0, g.applied)).toBe(1);
    expect(scriptCaption(script, 1)).toBe('Now city 2.');
    g.undo();
    expect(scriptProgress(script, 0, g.applied)).toBe(0);
    g.act(1); // off script: city 2 first
    expect(scriptProgress(script, 0, g.applied)).toBe(-1);
    expect(scriptCaption(script, -1)).toBe(SCRIPT_OFF_TEXT);
  });

  it('round counter on B2', () => {
    const g = new T1Game({ board: 'B2', view: 'populations', mode: 'free', coords: 'populations', start: [1, 0] });
    const rounds = (): number => roundCount(g.cursor, 2);
    g.act(0);
    expect(rounds()).toBe(0);
    g.act(1);
    expect(rounds()).toBe(1);
    g.act(0);
    g.act(1);
    expect(rounds()).toBe(2);
    g.undo();
    expect(rounds()).toBe(1);
    expect(() => roundCount(3, 0)).toThrow();
  });

  it('hint ghosts equal the engine and are off in prediction steps', () => {
    const g = new T1Game({ board: 'B3', view: 'linked', mode: 'free', coords: 'populations', start: [1, 2, -1] });
    const ghosts = g.ghosts();
    const p = [1, 2, -1];
    const a = toNumbers(boardFromName('B3') as Board<number>, p);
    for (let k = 0; k < 3; k++) {
      expect(ghosts.populations![k]).toBe(String(mutate(boardFromName('B3') as Board<number>, p, k)[k]));
      expect(ghosts.numbers[k]).toBe(String(fire(boardFromName('B3') as Board<number>, a, k)[k]));
    }
    const legal = new T1Game({ board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, -1, 2] });
    expect(legal.ghosts().numbers).toEqual(['-1', null, '-2']);
    const frac = new T1Game({ board: 'A2', view: 'linked', mode: 'free', coords: 'numbers', start: [1, 0] });
    expect(frac.ghosts().populations![0]).toBe(ratToString(toPopulation(boardFromName('A2') as Board<number>, fire(boardFromName('A2') as Board<number>, [1, 0], 0))![0]!));
  });

  it('the colours panel of phase 3 is drawn by its own mechanism, not by panelsToDraw (MERGE, P3 stage 3.2, P3-A5)', () => {
    expect(panelsToDraw(['form', 'level', 'colours', 'lengths'])).not.toContain('colours');
    expect(panelsToDraw(undefined)).toEqual([]);
  });

  it('publishes and follows state by instance id', () => {
    clearPublishedStates();
    const g = new T1Game({ board: 'A3', view: 'linked', mode: 'free', coords: 'populations', start: [1, 0, 0] });
    const seen: unknown[] = [];
    const stop = followToolState('b1', (s) => seen.push(s));
    g.act(1);
    publishToolState('b1', g.state());
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(g.state());
    expect(JSON.stringify(seen[0])).not.toContain('positions');
    // A jump published by another tool under b1 is applied as a new move list from our start.
    const applied: number[][] = [];
    const stopJumps = followJumps('b1', () => g.state(), (moves) => applied.push(moves));
    publishToolState('b1', g.state()); // our own state: ignored
    expect(applied).toEqual([]);
    publishToolState('b1', { ...g.state(), moves: [2, 1, 3] });
    expect(applied).toEqual([[2, 1, 3]]);
    publishToolState('b1', { ...g.state(), board: 'A2', start: [1, 0], moves: [1] }); // another board: ignored
    expect(applied).toHaveLength(1);
    stop();
    stopJumps();
    clearPublishedStates();
  });

  it('highlight set and read', () => {
    const g = new T1Game({ board: 'A3', view: 'linked', mode: 'free', coords: 'populations', start: [1, 1, 0] });
    expect(highlightMatches({ kind: 'position', board: 'A3', value: [1, 1, 0] }, 'A3', g.board, g.shown)).toEqual({ populations: true, numbers: false });
    expect(highlightMatches({ kind: 'root', board: 'A3', value: [1, 1, -1] }, 'A3', g.board, g.shown)).toEqual({ populations: false, numbers: true });
    expect(highlightMatches({ kind: 'position', board: 'A2', value: [1, 1, 0] }, 'A3', g.board, g.shown).populations).toBe(false);
    expect(highlightMatches({ kind: 'node', board: 'A3', value: 2 }, 'A3', g.board, g.shown).populations).toBe(false);
  });

  it('prediction answers are checked by value or by choice', () => {
    const position: Prediction = { question: 'q', answer: { type: 'position', value: [1, -1, 1] }, reveal: 'r' };
    const choice: Prediction = { question: 'q', answer: { type: 'choice', options: ['3', '6', '24'], correct: 1 }, reveal: 'r' };
    expect(predictionCorrect(position, [1, -1, 1])).toBe(true);
    expect(predictionCorrect(position, [1, 1, 1])).toBe(false);
    expect(predictionCorrect(choice, 1)).toBe(true);
    expect(predictionCorrect(choice, 2)).toBe(false);
    expect(predictionAnswerText(choice)).toBe('6');
    expect(predictionAnswerText(position)).toBe('(1, -1, 1)');
  });

  it('export tables hold both boards with fractions as p/q', () => {
    const g = new T1Game({ board: 'A2', view: 'linked', mode: 'free', coords: 'numbers', start: [1, 0] });
    g.act(1);
    const d = g.derived() as { positions: { populations: unknown[]; numbers: unknown[] }[] };
    expect(d.positions[0]).toEqual({ move: 0, populations: ['2/3', '1/3'], numbers: [1, 0] });
    expect(d.positions).toHaveLength(2);
    const e8 = new T1Game({ board: 'E8', view: 'numbers', mode: 'free', coords: 'numbers', start: ['9007199254740993', 1, 1, 1, 1, 1, 1, 1] });
    expect((e8.derived() as { positions: { numbers: unknown[] }[] }).positions[0]!.numbers[0]).toBe('9007199254740993');
  });
});

describe('T1 announcements', () => {
  const A2 = boardFromName('A2');

  it('choose the A-4 template for each view', () => {
    const n = new T1Game({ board: 'A2', view: 'numbers', mode: 'free', coords: 'numbers', start: [1, 1] });
    const before = n.shown;
    n.act(1);
    expect(moveSentence('numbers', A2.labels, 2, before, n.shown, 1)).toBe('Fired node 2. Numbers now 2, minus 1. Move 1.');
    const l = new T1Game({ board: 'A2', view: 'linked', mode: 'free', coords: 'populations', start: [1, 1] });
    const lb = l.shown;
    l.act(0);
    expect(moveSentence('linked', A2.labels, 1, lb, l.shown, 1)).toBe('Mutated city 1 and fired node 1. Populations now 0, 1; numbers now minus 1, 2. Move 1.');
    const p = new T1Game({ board: 'A3', view: 'populations', mode: 'free', coords: 'populations', start: [1, 0, 0] });
    const pb = p.shown;
    p.act(1);
    expect(moveSentence('populations', p.labels, 2, pb, p.shown, 1)).toBe('Mutated city 2. Populations now 1, 1, 0. Move 1.');
    const five = new T1Game({ board: 'A5', view: 'numbers', mode: 'free', coords: 'numbers' });
    const fb = five.shown;
    five.act(2);
    expect(moveSentence('numbers', five.labels, 3, fb, five.shown, 1)).toBe('Fired node 3. Node 2 now 2, node 3 now minus 1, node 4 now 2. Move 1.');
    const lf = new T1Game({ board: 'A5', view: 'linked', mode: 'free', coords: 'populations', start: [1, 0, 0, 0, 0] });
    const lfb = lf.shown;
    lf.act(1);
    expect(moveSentence('linked', lf.labels, 2, lfb, lf.shown, 1)).toBe('Mutated city 2 and fired node 2. City 2 now 1; node 1 now 1, node 2 now 1, node 3 now minus 1. Move 1.');
    // Fractions are spoken "2 over 3".
    expect(spokenValue('2/3')).toBe('2 over 3');
    expect(spokenValue('-1/3')).toBe('minus 1 over 3');
    const nu = new T1Game({ board: 'A2', view: 'numbers', mode: 'free', coords: 'numbers' });
    for (const k of [0, 1, 0, 1]) nu.act(k);
    nu.undo();
    expect(undoSentence('numbers', A2.labels, 4, nu.shown)).toBe('Undid move 4. Numbers now minus 1, minus 1.');
    expect(refusalSentence('legal', 2, '-2')).toBe('Node 2 cannot be fired: its number is minus 2.');
    expect(refusalSentence('raising', 2, '1')).toBe('City 2 cannot be raised: its number is 1.');
    const a3 = new T1Game({ board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers' });
    const o = a3.playToEnd();
    expect(playSentence('numbers', 'legal', a3.labels, o.moves, o.status, a3.shown)).toBe('Played 6 moves to the end. Numbers now minus 1, minus 1, minus 1.');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves within half a second announce only the last state', () => {
    vi.useFakeTimers();
    const region = { textContent: '' } as unknown as HTMLElement;
    const writes: string[] = [];
    let text = '';
    Object.defineProperty(region, 'textContent', {
      get: () => text,
      set: (v: string) => {
        text = v;
        if (v !== '') writes.push(v);
      },
    });
    const announce = createAnnouncer(region);
    const g = new T1Game({ board: 'A2', view: 'numbers', mode: 'free', coords: 'numbers' });
    for (const k of [0, 1, 0]) {
      const before = g.shown;
      g.act(k);
      announce(moveSentence('numbers', g.labels, k + 1, before, g.shown, g.cursor));
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual(['Fired node 1. Numbers now minus 1, minus 1. Move 3.']);
  });
});

// ---------------------------------------------------------------------------------------------
// Server render of the component with properties (CONTRACTS 5.2; plan 5.16)
// ---------------------------------------------------------------------------------------------

// A server-render loader like P1-A2's _svelteSsr.ts, with the aliases of CONTRACTS 1 given explicitly:
// the Board family imports '@engine' and '@lib/...', which Vite's tsconfigPaths does not resolve
// from a .svelte importer here.
const SITE = fileURLToPath(new URL('../../../', import.meta.url));
let server: ViteDevServer;
let renderFn: (c: unknown, o: { props: unknown }) => { body: string };
let T01: unknown;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-ssr-test-cache-t01-' + checkoutKey()),
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [svelte({ configFile: false })],
    resolve: {
      alias: {
        '@engine': join(SITE, '../packages/engine/src/index.ts'),
        '@components': join(SITE, 'src/components'),
        '@lib': join(SITE, 'src/lib'),
      },
    },
  });
  renderFn = ((await server.ssrLoadModule('svelte/server')) as { render: typeof renderFn }).render;
  T01 = ((await server.ssrLoadModule('/src/components/tools/T01GameBoard.svelte')) as { default: unknown }).default;
}, 60000);

afterAll(async () => {
  await server?.close();
});

function render(props: Record<string, unknown>): string {
  return renderFn(T01, { props: { id: 'b1', caption: 'A test board.', ...props } }).body;
}

function tags(source: string, name: string): string[] {
  return source.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>/])`).exec(tag);
  return m === null ? null : (m[1] ?? '');
}

function out(body: string, name: string): string | null {
  const m = new RegExp(`<([a-z]+)\\b[^>]*data-out="${name}"[^>]*>([\\s\\S]*?)</\\1>`).exec(body);
  return m === null ? null : m[2]!.replace(/<[^>]+>/g, '').trim();
}

const nodeButtons = (body: string): string[] => tags(body, 'button').filter((t) => attr(t, 'data-node') !== null);

describe('T1 server render', () => {
  it('renders the default state with the bridge sentence, fractions and hooks', () => {
    const body = render({ board: 'A2', view: 'linked', coords: 'numbers', start: [1, 0] });
    const root = tags(body, 'section')[0]!;
    expect(attr(root, 'data-tool')).toBe('board');
    expect(attr(root, 'data-instance')).toBe('b1');
    expect(attr(root, 'data-moves')).toBe('0');
    const pops = nodeButtons(body).filter((t) => attr(t, 'data-board') === 'populations');
    expect(pops.map((t) => attr(t, 'data-value'))).toEqual(['2/3', '1/3']);
    expect(out(body, 'bridgeSentence')).toBe('The number on node i is the amount by which a mutation would lower city i.');
    expect(body).toContain('<math');
  });

  it('view and mode pairs outside the table are refused', () => {
    expect(() => render({ id: 'b7', board: 'A3', view: 'numbers', mode: 'raising' })).toThrow(/b7/);
  });

  it('script advances by Next', () => {
    const body = render({ board: 'A2', view: 'populations', mode: 'free', start: [1, 0], script: [{ move: 1, caption: 'First caption.' }, { move: 2, caption: 'Second.' }] });
    expect(tags(body, 'button').some((t) => attr(t, 'data-control') === 'next')).toBe(true);
    expect(out(body, 'scriptCaption')).toBe('First caption.');
  });

  it('round counter on B2', () => {
    const body = render({ board: 'B2', view: 'populations', mode: 'free', start: [1, 0], rounds: 2 });
    expect(out(body, 'roundCounter')).toBe('Round 0');
  });

  it('roadStyle passes through', () => {
    const roadStyles = (body: string): string[] => tags(body, 'g').map((t) => attr(t, 'data-road-style')).filter((x): x is string => x !== null);
    expect(roadStyles(render({ board: 'B2', view: 'populations', roadStyle: 'roads' }))).toEqual(['roads']);
    expect(roadStyles(render({ board: 'B2', view: 'populations' }))).toEqual(['dynkin']);
    const oneWay = { cartan: [[2, -1], [0, 2]] };
    expect(roadStyles(render({ board: oneWay, view: 'numbers', coords: 'numbers', roadStyle: 'dynkin' }))).toEqual(['roads']);
  });

  it('the colours panel renders in phase 3 through colourClasses (MERGE, P3 stage 3.2, request of P3-A5)', () => {
    const body = render({ board: 'A3', panels: ['form', 'level', 'colours', 'lengths'] });
    expect(body).toMatch(/data-out="colourClasses"/);
    expect(out(body, 'notice')).toBeNull();
    expect(render({ board: 'A3' })).not.toMatch(/data-out="colourClasses"/);
  });

  it('prediction freezes the board', () => {
    const prediction: Prediction = { question: 'What will city 2 hold after it mutates?', answer: { type: 'number', value: 0 }, reveal: 'It holds -1 + 1 + 0 = 0.' };
    const body = render({ board: 'A3', view: 'populations', start: [1, 1, 0], hints: true, prediction });
    const buttons = nodeButtons(body);
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(attr(b, 'data-can-act')).toBe('false');
    expect(body).not.toContain('data-ghost');
    // Without a prediction the same configuration offers every node.
    for (const b of nodeButtons(render({ board: 'A3', view: 'populations', start: [1, 1, 0], hints: true }))) expect(attr(b, 'data-can-act')).toBe('true');
  });

  it('prediction details without JavaScript', () => {
    const prediction: Prediction = { question: 'What will city 2 hold after it mutates?', answer: { type: 'number', value: 0 }, reveal: 'It holds -1 + 1 + 0 = 0.' };
    const body = render({ board: 'A3', view: 'populations', start: [1, 1, 0], prediction });
    const q = body.indexOf('What will city 2 hold after it mutates?');
    const d = body.indexOf('<details', q);
    expect(q).toBeGreaterThan(-1);
    expect(d).toBeGreaterThan(q);
    const details = body.slice(d, body.indexOf('</details>', d));
    expect(details).toContain('It holds -1 + 1 + 0 = 0.');
    expect(details).toMatch(/>\s*0\s*</);
  });

  it('goal line and outputs are reserved', () => {
    const body = render({ board: 'A3', view: 'populations', start: [0, 1, 0], goal: { kind: 'reach', position: [1, 1, 0], text: 'Mutate city 1.' } });
    expect(out(body, 'goal')).toBe('Mutate city 1.');
    expect(body).toContain('data-out="goalMet"');
    expect(body).toContain('data-out="goalNote"');
  });

  it('hooks on every node: sign and ring', () => {
    const body = render({ board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 0, -1] });
    const buttons = nodeButtons(body);
    expect(buttons.map((b) => attr(b, 'data-sign'))).toEqual(['positive', 'zero', 'negative']);
    expect(buttons.map((b) => attr(b, 'data-ring'))).toEqual(['true', 'false', 'false']);
    expect(buttons.map((b) => attr(b, 'data-can-act'))).toEqual(['true', 'false', 'false']);
    expect(out(body, 'mode')).toBe('legal play');
  });
});
