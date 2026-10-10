// P2-A7: the unit tests of the phase-2 additions (SPEC.md 4 T1, T2, T9; 2.11, 2.12; 4.0; 5.6 last
// sentence; E-9; E-11): classify once on load in state.ts (resolveBoard, boardVerdict, isFiniteType,
// finiteKnown), T2's verdict and layer bound, T9's affine board name, its link to T4 and "play on",
// T1's panels and its "play on" report strings. Golden values are read from
// reference/golden_data.json as test inputs and never typed; this file calls no covers(): the golden
// keys kostant[*].affine_board_from_node and classification_tests belong to P2-A1's golden files
// (CONTRACTS 3: a golden key is tested in exactly one file). Random cases use a fixed seed (SEED).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// The real engine with `classify` wrapped in a spy, so that the number of calls can be counted
// (5.6: "by calling classify once when the board is loaded"). Every other function is the real one.
vi.mock('@two-games/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@two-games/engine')>();
  return { ...real, classify: vi.fn(real.classify) };
});

import {
  CAPS,
  NotFiniteType,
  boardFromName,
  classify,
  formValue,
  highestRoot,
  kostantPlay,
  playFate,
  raisingPlay,
  ratToString,
  toNumbers,
} from '@two-games/engine';
import type { Board } from '@two-games/engine';
import { bigBoard, boardVerdict, boardVerdictInLabels, isFiniteType, resolveBoard } from '../../../src/lib/state';
import { whereToRun } from '../../../src/lib/worker';
import { T1Game, limitText } from '../../../src/components/tools/t01/model';
import {
  FORM_FRACTIONAL,
  FORM_NOT_BALANCED,
  fateText,
  formPanel,
  isAffineBoard,
  lengthSentence,
  lengthsReport,
  levelValue,
  phase2Panels,
  playControlDisabled,
  playLabel,
  playOnCap,
} from '../../../src/components/tools/t01/phase2';
import { ONE_WAY_TEXT, gardenLayersBound, gardenTotal, verdictText as gardenVerdictText } from '../../../src/components/tools/t02/phase2';
import { totalText } from '../../../src/components/tools/t02/garden';
import {
  affineBoardName,
  labHref,
  playControlPhase2,
  playDisabled,
  playLabelOf,
  playOnCap as kostantPlayOnCap,
  verdictText as kostantVerdictText,
} from '../../../src/components/tools/t09/phase2';
import { playOnHint, playOnWhere, runPlayOn } from '../../../src/components/tools/t09/playOn';
import { playControl } from '../../../src/components/tools/t09/kostant';
import type { Prediction } from '../../../src/tools/types';

// ---------------------------------------------------------------------------------------------
// Golden inputs (read, never typed)
// ---------------------------------------------------------------------------------------------

interface GoldenComponent { nodes: number[]; kind: string; balanced: boolean; class: string | null; name: string | null }
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { cartan: number[][] }>;
  kostant: Record<string, { affine_board_from_node: string[] }>;
  affine: Record<string, { name: string; cartan_node0_first: number[][] }>;
  twisted_affine: { name: string; cartan: number[][] }[];
  classification_tests: { label: string; cartan: number[][]; components: GoldenComponent[] }[];
  one_way_counterexample: { cartan: number[][]; start: number[]; moves: number[]; result: number[] };
  pentagon_example: { start: number[]; level: number; moves: number; end: number[]; word_lowest_node_rule: number[] };
  layer_growth_examples: { label: string; cartan?: number[][] }[];
};
const TYPE_NAMES = Object.keys(golden.types);
const AFFINE_NAMES = [...new Set([...Object.values(golden.affine).map((a) => a.name), ...golden.twisted_affine.map((t) => t.name)])];
const testBoard = (label: string) => golden.classification_tests.find((t) => t.label === label)!;
const TRIANGLE = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];

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

/** E6 renumbered as a custom matrix: the permutation sigma sends Bourbaki node sigma[k] to position k. */
function renumberedE6(): number[][] {
  const C = golden.types.E6!.cartan;
  const sigma = [3, 5, 0, 2, 4, 1];
  return sigma.map((i) => sigma.map((j) => C[i]![j]!));
}

const spy = classify as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------------------------
// state.ts: classify once on load (5.6, E-11), boardVerdict, isFiniteType, finiteKnown (E-9)
// ---------------------------------------------------------------------------------------------

describe('state.ts: classify once when the board is loaded', () => {
  beforeEach(() => {
    spy.mockClear();
  });

  it('resolveBoard calls classify exactly once per board', () => {
    const e6 = resolveBoard('E6');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe(e6);
    isFiniteType(e6);
    boardVerdict(e6);
    isFiniteType(e6);
    boardVerdictInLabels(e6);
    expect(spy).toHaveBeenCalledTimes(1);
    // A Big copy of a resolved board shares the verdict (same matrix): no second call.
    expect(isFiniteType(bigBoard(e6))).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const custom = resolveBoard({ cartan: TRIANGLE });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(isFiniteType(custom)).toBe(false);
    expect(boardVerdict(custom)[0]!.class).toBe('affine');
    expect(spy).toHaveBeenCalledTimes(2);
    // A board built by boardFromName directly is classified on first request, then cached.
    const d4 = boardFromName('D4~');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(isFiniteType(d4)).toBe(false);
    expect(boardVerdict(d4)).toBe(boardVerdict(d4));
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('boardVerdict reuses the cached records', () => {
    const b = resolveBoard({ cartan: testBoard('two components: A2 and the triangle').cartan });
    const first = boardVerdict(b);
    const second = boardVerdict(b);
    expect(second).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    // The cached records are classify's own verdict (a fresh, uncached call through the spy).
    expect(spy.getMockImplementation()!(b)).toEqual(first);
    // In labels for export (E-7): the golden components, labels 1..5 on a custom board.
    const labelled = boardVerdictInLabels(b);
    expect(labelled.map((r) => r.nodes)).toEqual(testBoard('two components: A2 and the triangle').components.map((c) => c.nodes));
  });

  it('isFiniteType from classify', () => {
    const e6 = resolveBoard({ cartan: renumberedE6() });
    expect(e6.name).toBeUndefined();
    expect(isFiniteType(e6)).toBe(true);
    expect(boardVerdict(e6)[0]!.name).toBe('E6');
    for (const name of TYPE_NAMES) expect(isFiniteType(resolveBoard(name)), name).toBe(true);
    for (const name of [...AFFINE_NAMES, 'B2~', 'C2~', 'pentagon', 'square']) expect(isFiniteType(resolveBoard(name)), name).toBe(false);
    expect(isFiniteType(resolveBoard({ cartan: TRIANGLE }))).toBe(false);
    expect(isFiniteType(resolveBoard({ cartan: golden.one_way_counterexample.cartan }))).toBe(false);
    expect(isFiniteType(resolveBoard({ cartan: testBoard('two components: A2 and the triangle').cartan }))).toBe(false);
    // Several finite pieces are finite, as the engine's requireFinite (P2-A1) accepts them.
    expect(isFiniteType(resolveBoard({ cartan: [[2, -1, 0], [-1, 2, 0], [0, 0, 2]] }))).toBe(true);
  });

  it('whereToRun gets finiteKnown from the verdict', () => {
    // A play to the end (no move count known in advance): main on a board classify calls finite,
    // worker otherwise (E-9 rule 2); before phase 2 the custom E6 counted as not finite.
    const e6 = resolveBoard({ cartan: renumberedE6() });
    const tri = resolveBoard({ cartan: TRIANGLE });
    expect(whereToRun({ board: e6, kind: 'play', finiteKnown: isFiniteType(e6) })).toBe('main');
    expect(whereToRun({ board: e6, kind: 'play' })).toBe('worker'); // the phase-1 default, which the tools no longer use
    expect(whereToRun({ board: tri, kind: 'play', finiteKnown: isFiniteType(tri) })).toBe('worker');
    // A word of 2001 moves runs in the worker whatever the board (E-9 rule 2).
    expect(whereToRun({ board: e6, kind: 'play', moves: CAPS.mainThreadItems + 1, finiteKnown: isFiniteType(e6) })).toBe('worker');
    // T9's "play on" hint carries the verdict.
    expect(playOnHint(resolveBoard('D4~')).finiteKnown).toBe(false);
    expect(playOnWhere(resolveBoard('D4~'))).toBe('worker');
    expect(playOnWhere(resolveBoard('D4'))).toBe('main');
    expect(playOnWhere(e6)).toBe('main');
  });

  it('resolveBoard resolves every board name of 6.6 with the engine labels', () => {
    for (const name of AFFINE_NAMES) {
      const b = resolveBoard(name);
      expect(b.labels[0], name).toBe(0);
      expect([...b.labels], name).toEqual(Array.from({ length: b.n }, (_, k) => k));
      expect(boardVerdict(b).map((r) => r.class), name).toEqual(['affine']);
    }
    expect(boardVerdict(resolveBoard('B2~'))[0]!.name).toBe('C2~');
    expect(boardVerdict(resolveBoard('C2~'))[0]!.name).toBe('C2~');
    for (const name of ['A9^(2)', 'A15^(2)', 'D6^(2)', 'D9^(2)']) expect(boardVerdict(resolveBoard(name))[0]!.name, name).toBe(name);
    expect([...resolveBoard('pentagon').labels]).toEqual([1, 2, 3, 4, 5]);
    expect([...resolveBoard('square').labels]).toEqual([1, 2, 3, 4]);
    expect(boardVerdict(resolveBoard('pentagon'))[0]!.name).toBe('A4~');
    expect(boardVerdict(resolveBoard('square'))[0]!.name).toBe('A3~');
  });
});

// ---------------------------------------------------------------------------------------------
// T2: the verdict beside the stop message; the layer bound and the total from the verdict
// ---------------------------------------------------------------------------------------------

describe('T2 phase 2', () => {
  it('garden verdict text for every classification_tests board', () => {
    const word = (c: GoldenComponent): string => (c.kind === 'one-way' ? ONE_WAY_TEXT : c.class!);
    for (const t of golden.classification_tests) {
      const b = resolveBoard({ cartan: t.cartan });
      const records = boardVerdict(b);
      // The expected order is the order of the records classify returns, matched to the golden
      // components by their nodes (in labels).
      const expected = records.map((r) => {
        const labels = r.nodes.map((p) => b.labels[p]!);
        const g = t.components.find((c) => JSON.stringify(c.nodes) === JSON.stringify(labels));
        expect(g, t.label).toBeDefined();
        return word(g!);
      });
      expect(gardenVerdictText(records), t.label).toBe(expected.join('; '));
    }
    expect(gardenVerdictText(boardVerdict(resolveBoard({ cartan: TRIANGLE })))).toBe('affine');
    expect(gardenVerdictText(boardVerdict(resolveBoard({ cartan: testBoard('two components: A2 and the triangle').cartan })))).toBe('finite; affine');
    expect(gardenVerdictText(boardVerdict(resolveBoard({ cartan: golden.one_way_counterexample.cartan })))).toBe('has a one-way road: the theory does not apply');
    expect(gardenVerdictText(boardVerdict(resolveBoard({ cartan: testBoard('star with five arms').cartan })))).toBe('indefinite');
  });

  it('the layers bound and the total follow classify, not the name', () => {
    const e6 = resolveBoard({ cartan: renumberedE6() });
    expect(gardenLayersBound(e6)).toBeUndefined();
    expect(gardenLayersBound(resolveBoard({ cartan: TRIANGLE }))).toBe(CAPS.layersOffFinite);
    expect(gardenLayersBound(resolveBoard('D4~'))).toBe(CAPS.layersOffFinite);
    expect(gardenLayersBound(resolveBoard('E6'))).toBeUndefined();
    expect(gardenLayersBound(e6, 7)).toBe(7);
    const spec = { board: e6, grows: 'roots' as const, game: 'mutation' as const };
    expect(totalText(gardenTotal(spec, undefined))).toBe('72');
    const tri = resolveBoard({ cartan: TRIANGLE });
    expect(totalText(gardenTotal({ board: tri, grows: 'roots', game: 'mutation' }, 40))).toBe('no total on this board');
  });
});

// ---------------------------------------------------------------------------------------------
// T9: the affine board of the recipe, the link to T4, "play on"
// ---------------------------------------------------------------------------------------------

describe('T9 phase 2', () => {
  it('affineBoardName matches kostant[T].affine_board_from_node for every type and node', () => {
    let checked = 0;
    for (const name of TYPE_NAMES) {
      const b = resolveBoard(name) as Board<number>;
      const expected = golden.kostant[name]!.affine_board_from_node;
      for (let i = 0; i < b.n; i++) {
        const r = kostantPlay(b, i);
        expect(r.status, `${name} node ${i + 1}`).toBe('ended');
        expect(affineBoardName(b, r.position), `${name} node ${i + 1}`).toBe(expected[i]);
        checked++;
      }
    }
    expect(checked).toBe(TYPE_NAMES.reduce((s, t) => s + golden.types[t]!.cartan.length, 0));
  });

  it('openLab href carries the named board for every type and node', () => {
    for (const name of TYPE_NAMES) {
      const b = resolveBoard(name) as Board<number>;
      for (let i = 0; i < b.n; i++) {
        const affine = affineBoardName(b, kostantPlay(b, i).position)!;
        for (const base of ['/', '/mutation_game/']) {
          const href = labHref(base, affine);
          expect(href).toBe(`${base}tools/lab?g=${affine}`);
          // ~ ^ ( ) stay readable (6.6; plan for the brackets) and the codec's URLSearchParams reads the name back.
          expect(href).not.toMatch(/%/);
          expect(new URLSearchParams(href.split('?')[1]).get('g')).toBe(affine);
        }
        // T4 can build the board from the name, and classify recognises it under that name.
        const named = resolveBoard(affine);
        expect(boardVerdict(named).map((r) => r.name), affine).toEqual([affine === 'B2~' ? 'C2~' : affine]);
      }
    }
    expect(labHref('/', 'D4~')).toBe('/tools/lab?g=D4~');
    expect(labHref('/sub/path', 'D4^(3)')).toBe('/sub/path/tools/lab?g=D4^(3)');
  });

  it('playControl is play on exactly on affine boards', () => {
    for (const name of TYPE_NAMES) {
      const b = resolveBoard(name);
      expect(playControlPhase2(b), name).toBe('play to the end');
      expect(playControlPhase2(b)).toBe(playControl(b)); // P1-A7's function on finite boards (5.9 case 2)
      expect(playLabelOf(playControlPhase2(b))).toEqual({ text: 'Play to the end', play: 'end' });
    }
    for (const name of [...AFFINE_NAMES, 'B2~', 'C2~', 'pentagon', 'square', 'A9^(2)', 'D9^(2)']) {
      const b = resolveBoard(name);
      expect(playControlPhase2(b), name).toBe('play on');
      expect(playLabelOf(playControlPhase2(b))).toEqual({ text: 'Play on', play: 'on' });
    }
    expect(kostantVerdictText(boardVerdict(resolveBoard('D4~')))).toBe('affine D4~');
    expect(kostantVerdictText(boardVerdict(resolveBoard('B2~')))).toBe('affine C2~');
  });

  it('Kostant play reaches the cap from every city of every affine board of the golden data', async () => {
    // 2.12 [V]: "On an affine board Kostant's game never ends"; verify.py checks 300 moves.
    for (const name of AFFINE_NAMES) {
      const b = resolveBoard(name) as Board<bigint>;
      for (let i = 0; i < b.n; i++) {
        const r = kostantPlay(b, i, undefined, 300);
        expect(r.status, `${name} from node ${b.labels[i]}`).toBe('cap');
        expect(r.moves).toBe(300);
      }
    }
    // One board at the tool's cap, through the call the tool makes (in Node it runs in-process).
    const d4 = resolveBoard('D4~') as Board<bigint>;
    const p = Array.from({ length: d4.n }, (_, k) => (k === 0 ? 1n : 0n));
    const r = await runPlayOn(d4, p, kostantPlayOnCap(0));
    expect(r.status).toBe('cap');
    expect(r.moves).toBe(CAPS.playMoves);
    expect(r.word).toHaveLength(20000);
    // A second "play on" after it would pass the link maximum: the control is disabled (plan).
    expect(kostantPlayOnCap(r.moves)).toBe(0);
    expect(kostantPlayOnCap(3)).toBe(CAPS.linkMoves - 3);
    expect(playDisabled({ hydrated: true, frozen: false, busy: false, atEnd: false, playOn: true, cursor: r.moves })).toBe(true);
    expect(playDisabled({ hydrated: true, frozen: false, busy: false, atEnd: false, playOn: true, cursor: 0 })).toBe(false);
  });

  it('the end panel never calls the finite theory on an affine board (E-11 guard)', () => {
    // highestRoot throws off the finite types (P2-A1's guards), which is why the component asks isFiniteType first.
    expect(() => highestRoot(resolveBoard('D4~'))).toThrow(NotFiniteType);
    expect(isFiniteType(resolveBoard('D4~'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// T1: the panels and "play on"
// ---------------------------------------------------------------------------------------------

describe('T1 phase 2', () => {
  it('form panel value constant along 100 random mutations on A3, B3, G2 and the triangle', () => {
    const rand = mulberry32(SEED);
    for (const spec of ['A3', 'B3', 'G2', { cartan: TRIANGLE }] as const) {
      const b = resolveBoard(spec);
      const g = new T1Game({ board: spec, view: 'populations', mode: 'free', coords: 'populations', start: Array.from({ length: b.n }, () => Math.floor(rand() * 7) - 3) });
      const first = formPanel(g.board, g.current.pop, null);
      expect(first.kind).toBe('value');
      // The value is the engine's (p, p), not a typed number.
      expect(first).toEqual({ kind: 'value', value: ratToString(formValue(g.board, g.current.pop as (number | bigint)[])!) });
      const values = new Set<string>();
      for (let k = 0; k < 100; k++) {
        g.act(Math.floor(rand() * b.n));
        const v = formPanel(g.board, g.current.pop, null);
        values.add(v.kind === 'value' ? v.value : 'note');
      }
      expect([...values], JSON.stringify(spec)).toEqual([first.kind === 'value' ? first.value : '']);
    }
    // Not balanced and one-way: the panel says so in words.
    const unbalanced = resolveBoard({ cartan: testBoard('triangle with one double road (unbalanced)').cartan });
    expect(formPanel(unbalanced, [1n, 0n, 0n], null)).toEqual({ kind: 'note', text: FORM_NOT_BALANCED });
    expect(formPanel(resolveBoard({ cartan: golden.one_way_counterexample.cartan }), [1n, 0n], null)).toEqual({ kind: 'note', text: FORM_NOT_BALANCED });
    // A fractional population (numbers start on A2): a note, no value.
    const a2 = new T1Game({ board: 'A2', view: 'linked', coords: 'numbers', start: [1, 0] });
    expect(formPanel(a2.board, null, a2.current.frac)).toEqual({ kind: 'note', text: FORM_FRACTIONAL });
  });

  it('the level panel is drawn on affine boards only, and is constant along legal firings', () => {
    expect(phase2Panels(['form', 'level', 'colours', 'lengths'], resolveBoard('D4~'))).toEqual(['form', 'level', 'lengths']);
    expect(phase2Panels(['form', 'level', 'colours', 'lengths'], resolveBoard('A3'))).toEqual(['form', 'lengths']);
    expect(phase2Panels(['level'], resolveBoard({ cartan: testBoard('two components: A2 and the triangle').cartan }))).toEqual([]);
    expect(phase2Panels(['level'], resolveBoard({ cartan: golden.one_way_counterexample.cartan }))).toEqual([]);
    expect(isAffineBoard(resolveBoard('pentagon'))).toBe(true);
    const ex = golden.pentagon_example;
    const g = new T1Game({ board: 'pentagon', view: 'numbers', mode: 'legal', coords: 'numbers', start: ex.start });
    for (let k = 0; k <= ex.moves; k++) {
      expect(levelValue(g.board, g.current.a), `after ${k} moves`).toBe(String(ex.level));
      const s = g.stepPosition();
      if (s !== null) g.act(s);
    }
    expect(g.gameOver).toBe(true);
    // For a population start the numbers Cp have level 0 (2.12; c^T C = 0).
    const p = new T1Game({ board: 'D4~', view: 'linked', mode: 'free', coords: 'populations', start: [3, -1, 2, 0, 5] });
    expect(levelValue(p.board, p.current.a)).toBe('0');
  });

  it('lengths panel: long and short nodes from symmetrizer', () => {
    const b3 = lengthsReport(resolveBoard('B3'));
    expect(b3.kind).toBe('parts');
    if (b3.kind !== 'parts') return;
    expect(b3.parts[0]!.nodes.map((x) => [x.label, x.length])).toEqual([[1, 'long'], [2, 'long'], [3, 'short']]);
    expect(lengthSentence(b3.parts[0]!, false)).toBe('Long nodes 1 and 2; short node 3.');
    const a3 = lengthsReport(resolveBoard('A3'));
    if (a3.kind === 'parts') expect(lengthSentence(a3.parts[0]!, false)).toBe('All nodes have the same length.');
    const g2 = lengthsReport(resolveBoard('G2'));
    if (g2.kind === 'parts') expect(g2.parts[0]!.nodes.map((x) => x.length)).toEqual(['short', 'long']);
    // A twisted board with three values of d (A4^(2), d = (1, 2, 4)): the values 2d are listed.
    const tw = lengthsReport(resolveBoard('A4^(2)'));
    expect(tw.kind).toBe('parts');
    if (tw.kind === 'parts') {
      expect(tw.parts[0]!.kind).toBe('many');
      expect(tw.parts[0]!.nodes.map((x) => x.squared)).toEqual(['2', '4', '8']);
    }
    expect(lengthsReport(resolveBoard({ cartan: golden.one_way_counterexample.cartan }))).toEqual({ kind: 'unbalanced' });
    // Two components, each normalised to least value 1.
    const two = lengthsReport(resolveBoard({ cartan: [[2, -1, 0, 0], [-2, 2, 0, 0], [0, 0, 2, -1], [0, 0, -1, 2]] }));
    if (two.kind === 'parts') {
      expect(two.parts.map((p) => p.kind)).toEqual(['two', 'equal']);
      expect(lengthSentence(two.parts[1]!, true)).toBe('Nodes 3 and 4: all nodes have the same length.');
    }
  });

  it('T1 fate report strings for ended, looped and cap', () => {
    const run = (spec: Parameters<typeof resolveBoard>[0], start: (number | string)[]) => {
      const g = new T1Game({ board: spec, view: 'numbers', mode: 'legal', coords: 'numbers', start });
      expect(isFiniteType(g.board)).toBe(false);
      expect(playLabel(isFiniteType(g.board))).toEqual({ text: 'Play on', play: 'on' });
      const call = g.playCall();
      const result = playFate(g.board, call.vector as (number | bigint)[], undefined, playOnCap(g.cursor));
      const outcome = g.applyPlay(result);
      const gameOver = g.gameOver ? `Game over after ${g.cursor} ${g.cursor === 1 ? 'move' : 'moves'}.` : '';
      return { g, result, outcome, gameOver, fate: fateText(outcome), limit: limitText(outcome) };
    };
    // Negative level (the pentagon example): ended; the game-over text, never T15's "ended after k moves".
    const ex = golden.pentagon_example;
    const ended = run('pentagon', ex.start);
    expect(ended.result.status).toBe('ended');
    expect(ended.gameOver.toLowerCase()).toBe(`game over after ${ended.result.moves} moves.`);
    expect(ended.result.moves).toBe(ex.moves);
    expect(ended.fate).toBeNull();
    expect(ended.limit).toBeNull();
    expect(`${ended.gameOver} ${ended.fate ?? ''} ${ended.limit ?? ''}`).not.toMatch(/ended after/);
    // Level zero: the numbers Cp of a root population come back to an earlier position.
    const pent = resolveBoard('pentagon') as Board<bigint>;
    const a = toNumbers(pent, [1n, 1n, 0n, 0n, 0n]);
    const looped = run('pentagon', a.map((x) => Number(x)));
    expect(looped.result.status).toBe('looped');
    expect(looped.fate).toBe(`returned to an earlier position after ${looped.result.moves} moves`);
    expect(looped.limit).toBeNull();
    expect(looped.gameOver).toBe('');
    // Positive level (all ones on the triangle, level 3): still running at the cap.
    const cap = run({ cartan: TRIANGLE }, [1, 1, 1]);
    expect(cap.result.status).toBe('cap');
    expect(cap.limit).toBe('still running after 20000 moves');
    expect(cap.fate).toBeNull();
    expect(playOnCap(cap.g.cursor)).toBe(0);
    expect(playControlDisabled({ hydrated: true, frozen: false, busy: false, atEnd: false, finite: false, cursor: cap.g.cursor })).toBe(true);
    // The raising play off the finite types: raisingPlay with the same cap.
    const d4 = resolveBoard('D4~') as Board<bigint>;
    expect(raisingPlay(d4, [1n, 0n, 0n, 0n, 0n], undefined, playOnCap(0)).status).toBe('cap');
  });
});

// ---------------------------------------------------------------------------------------------
// Server render of T1 and T9 with properties (the panels, the hooks, a frozen prediction)
// ---------------------------------------------------------------------------------------------

const SITE = fileURLToPath(new URL('../../../', import.meta.url));
let server: ViteDevServer;
let renderFn: (c: unknown, o: { props: unknown }) => { body: string };
let T01: unknown;
let T09: unknown;

beforeAll(async () => {
  const key = createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8);
  server = await createServer({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-ssr-test-cache-p2a7-' + key),
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
  T09 = ((await server.ssrLoadModule('/src/components/tools/T09Kostant.svelte')) as { default: unknown }).default;
}, 60000);

afterAll(async () => {
  await server?.close();
});

const render = (c: unknown, props: Record<string, unknown>): string => renderFn(c, { props: { id: 'b1', caption: 'A test.', ...props } }).body;
function tags(source: string, name: string): string[] {
  return source.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
}
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>/])`).exec(tag);
  return m === null ? null : (m[1] ?? '');
}
function out(body: string, name: string): string | null {
  const m = new RegExp(`<([a-z]+)\\b[^>]*data-out="${name}"[^>]*>([\\s\\S]*?)</\\1>`).exec(body);
  return m === null ? null : m[2]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
const playControlTag = (body: string): string => tags(body, 'button').find((t) => attr(t, 'data-control') === 'playToEnd')!;
/** The signed numeral in a text, read from the text alone (true minus sign or hyphen). */
const signedNumerals = (text: string): string[] => (text.match(/[-−]?\d+(?:\/\d+)?/g) ?? []).map((x) => x.replace('−', '-'));

const prediction: Prediction = { question: 'How many moves?', answer: { type: 'number', value: 14 }, reveal: 'Fourteen.' };

describe('server render of the phase-2 additions', () => {
  it('panel filter in phase 2 renders form, level and lengths and never colours', () => {
    const body = render(T01, { board: 'D4~', view: 'linked', coords: 'populations', start: [1, 0, 0, 0, 0], panels: ['form', 'level', 'colours', 'lengths'] });
    expect(body).toContain('data-out="formValue"');
    expect(body).toContain('data-out="level"');
    expect(body).toContain('data-out="lengths"');
    expect(body).not.toContain('data-panel="colours"');
    expect(out(body, 'notice')).toBeNull();
    expect(signedNumerals(out(body, 'formValue')!)).toEqual(['2']);
    expect(signedNumerals(out(body, 'level')!)).toEqual(['0']);
    // On a finite board the level panel is not rendered; form and lengths are.
    const a3 = render(T01, { board: 'A3', panels: ['form', 'level', 'colours', 'lengths'] });
    expect(a3).toContain('data-out="formValue"');
    expect(a3).not.toContain('data-out="level"');
    expect(a3).toContain('data-out="lengths"');
    // Without panels nothing is added.
    expect(render(T01, { board: 'D4~' })).not.toContain('data-panel=');
  });

  it('form and level panels show signed numerals', () => {
    const ex = golden.pentagon_example;
    const body = render(T01, { board: 'pentagon', view: 'numbers', mode: 'legal', coords: 'numbers', start: ex.start, panels: ['form', 'level'] });
    const level = out(body, 'level')!;
    expect(signedNumerals(level)).toEqual([String(ex.level)]);
    expect(level).toContain('−'); // the true minus sign of 6.3 carries the sign in the text
    // A negative form value (an indefinite balanced board, p = (1, 1)): the engine's value, signed.
    const board = { cartan: testBoard('rank 2 with 3 roads each way').cartan };
    const expected = ratToString(formValue(resolveBoard(board), [1n, 1n])!);
    expect(expected.startsWith('-')).toBe(true);
    const neg = render(T01, { board, view: 'populations', coords: 'populations', start: [1, 1], panels: ['form'] });
    expect(signedNumerals(out(neg, 'formValue')!)).toEqual([expected]);
    expect(out(neg, 'formValue')).toContain('−');
  });

  it('T1 lengths panel on B3 marks nodes 1 and 2 long and node 3 short', () => {
    const body = render(T01, { board: 'B3', panels: ['lengths'] });
    const items = tags(body, 'li').filter((t) => attr(t, 'data-length') !== null);
    expect(items.map((t) => [attr(t, 'data-label'), attr(t, 'data-length')])).toEqual([['1', 'long'], ['2', 'long'], ['3', 'short']]);
    expect(out(body, 'lengths')).toContain('Long nodes 1 and 2; short node 3.');
  });

  it('the play control keeps its hook and says play on off the finite types', () => {
    const pent = playControlTag(render(T01, { board: 'pentagon', view: 'numbers', mode: 'legal', coords: 'numbers', start: golden.pentagon_example.start }));
    expect(attr(pent, 'data-play')).toBe('on');
    const a2 = render(T01, { board: 'A2', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1] });
    expect(attr(playControlTag(a2), 'data-play')).toBe('end');
    expect(a2).toMatch(/data-control="playToEnd"[^>]*>\s*Play to the end\s*</);
    expect(a2).not.toContain('data-out="fate"');
    const tri = render(T01, { board: { cartan: TRIANGLE }, view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1, 1] });
    expect(tri).toMatch(/data-control="playToEnd"[^>]*>\s*Play on\s*</);
    expect(tri).toContain('data-out="fate"');
    expect(tri).toContain('data-out="limit"');
    // T9: play on on D4~, play to the end on D4.
    const t9a = render(T09, { board: 'D4~', start: [1, 0, 0, 0, 0] });
    expect(attr(playControlTag(t9a), 'data-play')).toBe('on');
    expect(t9a).toMatch(/data-control="playToEnd"[^>]*>\s*Play on\s*</);
    expect(t9a).toContain('data-out="verdict"');
    expect(t9a).not.toContain('data-out="endPanel"');
    const t9f = render(T09, { board: 'D4' });
    expect(attr(playControlTag(t9f), 'data-play')).toBe('end');
    expect(t9f).not.toContain('data-out="verdict"');
  });

  it('the end panel names the affine board and links to T4 (replaces the phase-1 absence check)', () => {
    const b3 = render(T09, { board: 'B3', start: [0, 0, 1], moves: [2, 1] });
    const expected = golden.kostant.B3!.affine_board_from_node[2]!;
    expect(out(b3, 'affineBoard')).toBe(expected);
    const span = tags(b3, 'span').find((t) => attr(t, 'data-out') === 'affineBoard')!;
    expect(attr(span, 'data-name')).toBe(expected);
    expect(out(b3, 'affineCaption')).toContain(`affine board, ${expected}.`);
    const link = tags(b3, 'a').find((t) => attr(t, 'data-control') === 'openLab')!;
    expect(attr(link, 'href')).toMatch(new RegExp(`tools/lab\\?g=${expected.replace(/[\^()]/g, '\\$&')}$`));
    const d4 = render(T09, { board: 'D4', start: [1, 0, 0, 0], moves: [2, 3, 4, 2] });
    expect(out(d4, 'affineBoard')).toBe('D4~');
    expect(attr(tags(d4, 'a').find((t) => attr(t, 'data-control') === 'openLab')!, 'href')).toMatch(/tools\/lab\?g=D4~$/);
    expect(out(d4, 'openLab')).toBeNull();
    expect(d4).toMatch(/data-control="openLab"[^>]*>add the city</);
    // Before the end there is no name and no link (the static default of 4.0).
    const start = render(T09, { board: 'D4' });
    expect(start).not.toContain('data-out="affineBoard"');
    expect(start).not.toContain('data-control="openLab"');
  });

  it('play on and openLab respect a frozen prediction', () => {
    // T1 on the pentagon, T9 on D4~ and on D4 at the end, each with an unanswered prediction.
    const t1 = render(T01, { board: 'pentagon', view: 'numbers', mode: 'legal', coords: 'numbers', start: golden.pentagon_example.start, prediction });
    expect(attr(playControlTag(t1), 'data-play')).toBe('on');
    expect(attr(playControlTag(t1), 'disabled')).not.toBeNull();
    const t9a = render(T09, { board: 'D4~', start: [1, 0, 0, 0, 0], prediction });
    expect(attr(playControlTag(t9a), 'data-play')).toBe('on');
    expect(attr(playControlTag(t9a), 'disabled')).not.toBeNull();
    const t9f = render(T09, { board: 'D4', start: [1, 0, 0, 0], moves: [2, 3, 4, 2], prediction });
    expect(attr(playControlTag(t9f), 'data-play')).toBe('end');
    expect(t9f).not.toContain('data-control="openLab"');
    // The rule the components apply after hydration: frozen disables, answered enables (both forms).
    for (const finite of [true, false]) {
      expect(playControlDisabled({ hydrated: true, frozen: true, busy: false, atEnd: false, finite, cursor: 0 })).toBe(true);
      expect(playControlDisabled({ hydrated: true, frozen: false, busy: false, atEnd: false, finite, cursor: 0 })).toBe(false);
      expect(playDisabled({ hydrated: true, frozen: true, busy: false, atEnd: false, playOn: !finite, cursor: 0 })).toBe(true);
      expect(playDisabled({ hydrated: true, frozen: false, busy: false, atEnd: false, playOn: !finite, cursor: 0 })).toBe(false);
    }
  });

  it('a numbers start on an affine board offers only the numbers view', () => {
    const body = render(T01, { id: '', board: 'D4~', view: 'linked', coords: 'numbers', start: [1, 1, 1, 1, 1], panels: ['level'] });
    expect(tags(body, 'button').filter((t) => attr(t, 'data-board') === 'populations')).toHaveLength(0);
    expect(tags(body, 'button').filter((t) => attr(t, 'data-board') === 'numbers')).toHaveLength(5);
    const select = /<select[^>]*data-control="view"[^>]*>([\s\S]*?)<\/select>/.exec(body)![1]!;
    expect(tags(select, 'option').map((t) => attr(t, 'value'))).toEqual(['numbers']);
    // Its level is shown (comarks of D4~ against all ones), from the engine.
    const b = resolveBoard('D4~') as Board<bigint>;
    expect(signedNumerals(out(body, 'level')!)).toEqual([levelValue(b, Array.from({ length: b.n }, () => 1n))]);
    // A population start keeps all three views.
    const pop = render(T01, { id: '', board: 'D4~', view: 'linked', coords: 'populations', start: [1, 0, 0, 0, 0] });
    const select2 = /<select[^>]*data-control="view"[^>]*>([\s\S]*?)<\/select>/.exec(pop)![1]!;
    expect(tags(select2, 'option').map((t) => attr(t, 'value'))).toEqual(['populations', 'numbers', 'linked']);
  });
});

