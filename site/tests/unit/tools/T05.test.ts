// P3-A3: tool T5, the Numbers Game Lab (SPEC.md 4 T5, 2.7 F3 F4 F6 to F10, Appendix A.2 and A.3). The
// acceptance of SPEC 4 T5 over every type and every weyl_dimension record, through the pure functions of
// site/src/components/tools/t05/, the plan tests of the instruction (section 5.12), and the server render
// of T05NumbersGameLab.svelte. Golden values are read from reference/golden_data.json, never typed. This
// file calls no covers(): the keys it reads belong to P1-A1's and P3-A1's golden files (CONTRACTS 3,
// "a golden key is tested in exactly one file"). The hand vectors of SPEC Appendix A and the oracle
// values of the instruction (section 5.7) are cited where they are used.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { boardFromName, play, weylDimension } from '@engine';
import type { Board } from '@engine';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import {
  NumbersGame,
  fundamentalStart,
  gameWord,
  onesStart,
  readStartEntry,
  startKindOf,
} from '../../../src/components/tools/t05/game';
import { TALLY_NOTE, groupOrder, readsSideways, sidewaysReading, sidewaysRows, tallyOf, tallyRecord } from '../../../src/components/tools/t05/tally';
import { A1_WAVE_NOTE, colourClasses, colourOfPositions, waveNote, waveOf, waveProgress } from '../../../src/components/tools/t05/wave';
import { AGREE_TEXT, compareGames, sortedTape } from '../../../src/components/tools/t05/compare';
import { LAMBDA_MAX, dimensionOf, readLambdaEntry, validLambda } from '../../../src/components/tools/t05/dimension';
import { PRESET_IDS, presetCaption, presetOptions, presetSecondMoves, presetState } from '../../../src/components/tools/t05/presets';
import { admitLink, t05State } from '../../../src/components/tools/t05/link';
import { exportPayload } from '../../../src/components/tools/t05/derived';
import { T05_BOARDS } from '../../../src/components/tools/t05/boards';
import { isLong, shortValue } from '../../../src/components/tools/t01/longNumber';
import { decodeState, encodeState, LINK_NOTICE } from '../../../src/lib/urlCodec';
import { positionsOf, resolveBoard, type ToolState } from '../../../src/lib/state';
import { whereToRun } from '../../../src/lib/worker';
import T05 from '../../../src/tools/registry/T05';

/** A short key of this checkout, so that concurrent worktrees never share a compile cache (MERGE, P2 stage 2.1). */
function checkoutKey(): string {
  return createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8);
}

interface TypeRecord {
  exponents: number[];
  weyl_order: number;
  fired_tally: Record<string, number>;
  fired_values: number[];
  longest_word: number[];
  coxeter_number: number;
  bipartite_colouring: number[];
}
interface DimensionRecord {
  type: string;
  highest_weight: number[];
  dimension: number;
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, TypeRecord>;
  weyl_dimension: DimensionRecord[];
};
const TYPE_NAMES = Object.keys(golden.types);
const rank = (name: string): number => boardFromName(name).n;

/** The game from all ones played to the end through t05/game.ts. */
function onesGame(name: string): NumbersGame {
  const g = new NumbersGame({ board: name, start: onesStart(rank(name)) });
  g.playToEnd();
  return g;
}

describe('T5 acceptance (SPEC 4 T5)', () => {
  it('there are 32 types and the picker offers exactly them', () => {
    expect(TYPE_NAMES).toHaveLength(32);
    expect([...T05_BOARDS].sort()).toEqual([...TYPE_NAMES].sort());
    expect(T05.boards).toEqual([...T05_BOARDS]);
  });

  it('the tally of the game from all ones reads sideways to the golden exponents on every type', () => {
    for (const name of TYPE_NAMES) {
      const n = rank(name);
      const g = new NumbersGame({ board: name, start: onesStart(n) });
      // Step by step: the reading is absent before the last move.
      while (!g.gameOver) {
        expect(readsSideways(true, g.gameOver), name).toBe(false);
        g.act(g.stepPosition()!);
      }
      expect(readsSideways(true, g.gameOver)).toBe(true);
      expect(readsSideways(false, g.gameOver)).toBe(false);
      expect(sidewaysReading(g.fired(), n).exponents, name).toEqual(golden.types[name]!.exponents);
      // The rows of the chart read sideways are the exponents in decreasing order (the conjugate partition).
      expect([...sidewaysRows(tallyOf(g.fired()), n)].sort((a, b) => a - b), name).toEqual(golden.types[name]!.exponents);
    }
  });

  it('the product of (m_i + 1) and the group order shown equal weyl_order on every type', () => {
    for (const name of TYPE_NAMES) {
      const g = onesGame(name);
      const r = sidewaysReading(g.fired(), rank(name));
      expect(r.product, name).toBe(golden.types[name]!.weyl_order);
      expect(r.factors, name).toEqual(golden.types[name]!.exponents.map((m) => m + 1));
      expect(groupOrder(g.board), name).toBe(golden.types[name]!.weyl_order);
    }
  });

  it('the tally of the game from all ones equals fired_tally on every type', () => {
    for (const name of TYPE_NAMES) {
      const g = onesGame(name);
      const record = tallyRecord(tallyOf(g.fired()));
      expect(record, name).toEqual(golden.types[name]!.fired_tally);
      // Keys in increasing numeric order (E8 fires 1 to 29: "10" must not come before "9").
      const keys = Object.keys(record).map(Number);
      expect(keys, name).toEqual([...keys].sort((a, b) => a - b));
      expect(Object.keys(record), name).toEqual(Object.keys(golden.types[name]!.fired_tally));
      expect(g.fired().map(Number), name).toEqual(golden.types[name]!.fired_values);
      expect(g.applied, name).toEqual(golden.types[name]!.longest_word);
    }
  });

  it('the wave from all ones takes coxeter_number rounds with every firing legal on every type of rank at least 2, whichever colour starts', () => {
    for (const name of TYPE_NAMES) {
      if (rank(name) < 2) continue;
      const board = resolveBoard(name);
      const h = golden.types[name]!.coxeter_number;
      // Class 0 holds label 1; the colouring is the golden one.
      expect(colourOfPositions(board), name).toEqual(golden.types[name]!.bipartite_colouring);
      for (const first of [0, 1] as const) {
        const wave = waveOf(board, first);
        expect(wave.rounds, `${name} first ${first}`).toBe(h);
        expect(wave.legal).toBe(true);
        expect(wave.degenerate).toBe(false);
        expect(wave.split).toHaveLength(h);
        const classes = colourClasses(board);
        wave.split.forEach((r, k) => {
          expect(r.colour).toBe((first + k) % 2);
          expect([...r.positions].sort((a, b) => a - b)).toEqual(classes[r.colour].positions);
          expect(r.positions).toEqual([...r.positions].sort((a, b) => a - b));
        });
        expect(wave.end.every((x) => x === '-1')).toBe(true);
        // Played round by round through game.ts, every firing is legal and the tool counts h rounds.
        const g = new NumbersGame({ board: name, start: onesStart(board.n) });
        let progress = waveProgress(wave, true, g.applied);
        while (progress.nextEnd !== null) {
          const word = wave.word.slice(g.applied.length, progress.nextEnd);
          for (const l of word) expect(g.act(board.labels.indexOf(l)).kind).toBe('moved');
          progress = waveProgress(wave, true, g.applied);
        }
        expect(progress.roundsDone).toBe(h);
        expect(g.gameOver).toBe(true);
        expect(waveNote(wave, progress)).toBeNull();
      }
    }
  });

  it('on A1 the wave is a single move and the wave model returns the A1 note', () => {
    const board = resolveBoard('A1');
    for (const first of [0, 1] as const) {
      const wave = waveOf(board, first);
      expect(wave.word).toEqual([1]);
      expect(wave.degenerate).toBe(true);
      const before = waveProgress(wave, true, []);
      expect(waveNote(wave, before)).toBe(A1_WAVE_NOTE);
      expect(waveProgress(wave, true, [1]).nextEnd).toBeNull();
    }
    expect(A1_WAVE_NOTE).toContain('single move');
  });

  it('the dimension calculator reproduces all 30 weyl_dimension records including 3875 for E8', () => {
    expect(golden.weyl_dimension).toHaveLength(30);
    let sawE8 = false;
    for (const rec of golden.weyl_dimension) {
      const board = resolveBoard(rec.type);
      const r = dimensionOf(board, rec.highest_weight);
      expect(typeof r.D).toBe('bigint');
      expect(typeof r.M).toBe('bigint');
      expect(r.M % r.D, rec.type).toBe(0n);
      expect(r.M / r.D, `${rec.type} ${rec.highest_weight.join(',')}`).toBe(BigInt(rec.dimension));
      expect(r.dimension).toBe(weylDimension(board, rec.highest_weight));
      // The tape from rho is the golden fired_values and the word the longest_word.
      expect(r.tapeRho.map(Number)).toEqual(golden.types[rec.type]!.fired_values);
      expect(r.word).toEqual(golden.types[rec.type]!.longest_word);
      if (rec.type === 'E8' && rec.highest_weight.join(',') === '1,0,0,0,0,0,0,0') {
        sawE8 = true;
        expect(r.dimension).toBe(BigInt(rec.dimension));
      }
    }
    expect(sawE8).toBe(true);
  });
});

describe('T5 plan tests', () => {
  it('step and play to the end use the lowest-node rule and match play', () => {
    for (const name of TYPE_NAMES) {
      const stepped = new NumbersGame({ board: name, start: onesStart(rank(name)) });
      while (!stepped.gameOver) stepped.act(stepped.stepPosition()!);
      expect(stepped.applied, name).toEqual(golden.types[name]!.longest_word);
      const played = new NumbersGame({ board: name, start: onesStart(rank(name)) });
      const outcome = played.playToEnd();
      expect(outcome.status).toBe('ended');
      expect(played.applied).toEqual(stepped.applied);
      const b = boardFromName(name) as Board<number>;
      expect(played.applied).toEqual(play(b, onesStart(b.n)).word.map((k) => b.labels[k]));
    }
  });

  it('the fundamental weight start omega_1 on A3 ends at (0, 0, -1) after 3 moves', () => {
    // Oracle: play(cartan('A', 3), [1, 0, 0]) gives ((0, 0, -1), [0, 1, 2], [1, 1, 1]).
    const g = new NumbersGame({ board: 'A3', start: fundamentalStart(3, 0) });
    expect(startKindOf(g.start)).toBe('fundamental');
    g.playToEnd();
    expect(g.applied).toEqual([1, 2, 3]);
    expect(g.valuesInLabelOrder()).toEqual(['0', '0', '-1']);
    expect(g.fired()).toEqual(['1', '1', '1']);
    // Never read into exponents: the start is not all ones.
    expect(readsSideways(startKindOf(g.start) === 'ones', g.gameOver)).toBe(false);
    expect(TALLY_NOTE).toContain('all ones');
  });

  it('the start kind is derived from the start', () => {
    expect(startKindOf([1, 1, 1])).toBe('ones');
    expect(startKindOf([0, 1, 0])).toBe('fundamental');
    expect(startKindOf([2, -1, 3])).toBe('custom');
    expect(startKindOf([0, 0, 0])).toBe('custom');
    expect(readStartEntry('−12')).toBe(-12);
    expect(readStartEntry('1'.repeat(41))).toBeNull();
    expect(readStartEntry('9'.repeat(20))).toBe('9'.repeat(20));
    expect(readStartEntry('1.5')).toBeNull();
  });

  it('a start beyond the safe range is reloaded with Big arithmetic, with no message', () => {
    const huge = '9'.repeat(20);
    const g = new NumbersGame({ board: 'A2', start: [huge, 1] });
    expect(typeof (g.board as Board<unknown>).arith.zero).toBe('bigint');
    g.act(0);
    expect(g.fired()).toEqual([huge]);
    // An overflow during play switches too: a start near the edge of the safe range.
    const edge = String(Number.MAX_SAFE_INTEGER);
    const h = new NumbersGame({ board: 'A2', start: [edge, edge] });
    h.act(0);
    expect(typeof (h.board as Board<unknown>).arith.zero).toBe('bigint');
    expect(h.valuesInLabelOrder()).toEqual([`-${edge}`, (2n * BigInt(edge)).toString()]);
  });

  it('positions are recomputed from start and moves', () => {
    const state: ToolState = t05State({ board: 'A3', start: [1, 1, 1], moves: [1, 2, 1, 3, 2, 1] });
    const g = new NumbersGame({ board: 'A3', start: state.start!, moves: state.moves! });
    const expected = positionsOf(state).map((p) => p.map(String));
    for (let k = 0; k <= 6; k++) expect(g.valuesInLabelOrder(k)).toEqual(expected[k]);
    // A.2: after move 4 the position is (-1, 2, -3).
    expect(g.valuesInLabelOrder(4)).toEqual(['-1', '2', '-3']);
    g.undo();
    g.undo();
    expect(g.valuesInLabelOrder()).toEqual(expected[4]);
    g.redo();
    expect(g.valuesInLabelOrder()).toEqual(expected[5]);
    g.scrub(2);
    expect(g.applied).toEqual([1, 2]);
    g.reset();
    expect(g.applied).toEqual([]);
    expect(() => new NumbersGame({ board: 'A3', start: [1, 1, 1], moves: [1, 1] })).toThrow(RangeError);
  });

  it('every T5 play routes to the main thread', () => {
    const e8 = resolveBoard('E8');
    const moves = onesGame('E8').applied.length;
    expect(moves).toBe(golden.types.E8!.longest_word.length);
    expect(whereToRun({ board: e8, kind: 'play', moves, finiteKnown: true })).toBe('main');
    for (const name of TYPE_NAMES) {
      expect(whereToRun({ board: resolveBoard(name), kind: 'play', moves: onesGame(name).applied.length, finiteKnown: true })).toBe('main');
    }
    // The component never imports the worker client.
    const src = readFileSync(fileURLToPath(new URL('../../../src/components/tools/T05NumbersGameLab.svelte', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/engineCall|lib\/worker/);
  });

  it('two games compared agree after sorting, not in order', () => {
    // Oracle values (python3 reference/lie_games.py play with choose=lambda pos: pos[-1]):
    // A3 from (1,1,1): low word 1,2,1,3,2,1 fires 1,2,1,3,2,1; high word 3,2,3,1,2,3 fires 1,2,1,3,2,1.
    // G2 from (1,1): low word 1,2,1,2,1,2 fires 1,2,5,3,4,1; high word 2,1,2,1,2,1 fires 1,4,3,5,2,1.
    // A3 from (2,-1,3): low fires 2,1,4,3,2; high fires 3,2,4,2,1; both end at (-2,-1,-1) after 5 moves.
    const cases: { board: string; start: number[]; tapeA: string[]; tapeB: string[]; end: string[] }[] = [
      { board: 'A3', start: [1, 1, 1], tapeA: ['1', '2', '1', '3', '2', '1'], tapeB: ['1', '2', '1', '3', '2', '1'], end: ['-1', '-1', '-1'] },
      { board: 'G2', start: [1, 1], tapeA: ['1', '2', '5', '3', '4', '1'], tapeB: ['1', '4', '3', '5', '2', '1'], end: ['-1', '-1'] },
      { board: 'A3', start: [2, -1, 3], tapeA: ['2', '1', '4', '3', '2'], tapeB: ['3', '2', '4', '2', '1'], end: ['-2', '-1', '-1'] },
    ];
    for (const c of cases) {
      const a = new NumbersGame({ board: c.board, start: c.start });
      const b = new NumbersGame({ board: c.board, start: c.start });
      a.playToEnd('lowest');
      b.playToEnd('highest');
      expect(a.fired()).toEqual(c.tapeA);
      expect(b.fired()).toEqual(c.tapeB);
      const cmp = compareGames(
        { tape: a.fired(), ended: a.gameOver, end: a.valuesInLabelOrder(), moves: a.applied.length },
        { tape: b.fired(), ended: b.gameOver, end: b.valuesInLabelOrder(), moves: b.applied.length },
      );
      expect(cmp.agree).toBe(true);
      expect(cmp.status).toBe(AGREE_TEXT);
      expect(cmp.sameEnd).toBe(true);
      expect(cmp.sameLength).toBe(true);
      expect(a.valuesInLabelOrder()).toEqual(c.end);
      expect(cmp.sortedA).toEqual(sortedTape(c.tapeB));
    }
    // The unsorted G2 tapes differ: a comparison in move order would fail.
    expect(cases[1]!.tapeA).not.toEqual(cases[1]!.tapeB);
    // An unfinished game compares nothing.
    const half = new NumbersGame({ board: 'G2', start: [1, 1] });
    half.act(0);
    const done = new NumbersGame({ board: 'G2', start: [1, 1] });
    done.playToEnd();
    const unfinished = compareGames(
      { tape: half.fired(), ended: half.gameOver, end: half.valuesInLabelOrder(), moves: 1 },
      { tape: done.fired(), ended: true, end: done.valuesInLabelOrder(), moves: 6 },
    );
    expect(unfinished.agree).toBe(false);
    expect(unfinished.status).toMatch(/Game A is unfinished/);
    // Numeric sort: 10 after 9.
    expect(sortedTape(['10', '9', '-2'])).toEqual(['-2', '9', '10']);
  });

  it('the dimension vectors of Appendix A.3', () => {
    const a2 = dimensionOf(resolveBoard('A2'), [1, 1]);
    expect(a2.word).toEqual([1, 2, 1]);
    expect(a2.tapeRho).toEqual(['1', '2', '1']);
    expect(a2.start).toEqual(['2', '2']);
    expect(a2.tapeLambdaRho).toEqual(['2', '4', '2']);
    expect([a2.D, a2.M, a2.dimension]).toEqual([2n, 16n, 8n]);
    const g2 = dimensionOf(resolveBoard('G2'), [1, 0]);
    expect(g2.tapeRho).toEqual(['1', '2', '5', '3', '4', '1']);
    expect(g2.tapeLambdaRho).toEqual(['2', '3', '7', '4', '5', '1']);
    expect([g2.D, g2.M, g2.dimension]).toEqual([120n, 840n, 7n]);
    const b2 = dimensionOf(resolveBoard('B2'), [0, 1]);
    expect(b2.tapeRho).toEqual(['1', '3', '2', '1']);
    expect(b2.tapeLambdaRho).toEqual(['1', '4', '3', '2']);
    expect([b2.D, b2.M, b2.dimension]).toEqual([6n, 24n, 4n]);
    // lambda must be dominant and within the cap of 6 digits.
    expect(validLambda([1, -1], 2)).toBe(false);
    expect(validLambda([LAMBDA_MAX, 0], 2)).toBe(true);
    expect(validLambda([LAMBDA_MAX + 1, 0], 2)).toBe(false);
    expect(() => dimensionOf(resolveBoard('A2'), [-1, 1])).toThrow(RangeError);
    expect(readLambdaEntry('1234567')).toBeNull();
    expect(readLambdaEntry('-1')).toBeNull();
    expect(readLambdaEntry('999999')).toBe(999999);
  });

  it('the E8 dimension products are shortened with exact digits', () => {
    const r = dimensionOf(resolveBoard('E8'), [1, 0, 0, 0, 0, 0, 0, 0]);
    const D = r.D.toString();
    const M = r.M.toString();
    expect(D).toHaveLength(107);
    expect(M).toHaveLength(110);
    expect(r.D > 2n ** 53n).toBe(true);
    expect(isLong(D)).toBe(true);
    expect(shortValue(D)).toBe(`${D[0]}.${D.slice(1, 5)}... x 10^106 (107 digits)`);
    expect(shortValue(M)).toBe(`${M[0]}.${M.slice(1, 5)}... x 10^109 (110 digits)`);
    expect(shortValue(D).startsWith('1.2389... x 10^106')).toBe(true);
    expect(shortValue(M).startsWith('4.8010... x 10^109')).toBe(true);
  });

  it('the export payload holds the derived tables, with exact decimal strings beyond the safe range', () => {
    const board = resolveBoard('E8');
    const game = new NumbersGame({ board: 'E8', start: onesStart(8) });
    game.playToEnd();
    const tally = tallyOf(game.fired());
    const dimension = dimensionOf(board, [1, 0, 0, 0, 0, 0, 0, 0]);
    const payload = exportPayload({
      game,
      tally,
      reading: sidewaysReading(game.fired(), 8),
      groupOrder: groupOrder(board),
      wave: waveOf(board, 0),
      waveProgress: waveProgress(waveOf(board, 0), true, game.applied),
      firstColour: 0,
      gameB: null,
      comparison: null,
      dimension,
      lambda: [1, 0, 0, 0, 0, 0, 0, 0],
    });
    const json = JSON.parse(JSON.stringify(payload)) as Record<string, any>; // any: a parsed JSON payload read field by field
    expect(json.dimension.D).toBe(dimension.D.toString());
    expect(json.dimension.M).toBe(dimension.M.toString());
    expect(String(json.dimension.D)).toHaveLength(107);
    expect(String(json.dimension.M)).toHaveLength(110);
    expect(json.dimension.dimension).toBe(Number(dimension.dimension));
    expect(typeof json.dimension.dimension).toBe('number');
    expect(json.tally).toEqual(golden.types.E8!.fired_tally);
    expect(json.exponents).toEqual(golden.types.E8!.exponents);
    expect(json.groupOrder).toBe(golden.types.E8!.weyl_order);
    expect(json.positions).toHaveLength(game.applied.length + 1);
    expect(json.wave.rounds).toBe(golden.types.E8!.coxeter_number);
  });

  it('every preset is a state object and a link', () => {
    for (const id of PRESET_IDS) {
      const p = presetState(id);
      const state = t05State(p);
      const encoded = encodeState(state);
      expect(encoded).not.toMatch(/tab|firstColour|secondMoves|(^|&)[vm]=/);
      const other: ToolState = t05State({ board: 'B3', start: [1, 1, 1], moves: [] });
      const back = decodeState(encoded, 'numbers', other);
      expect(back.notice, id).toBeNull();
      expect(back.state, id).toEqual(state);
      // The registry's preset holds the same state part and a caption.
      const reg = (T05.presets as Record<string, Record<string, unknown>>)[id]!;
      expect(reg.board).toBe(p.board);
      expect(reg.moves).toEqual(p.moves);
      expect(reg.start).toEqual(p.start);
      expect(reg.lambda).toEqual(p.lambda);
      expect(typeof reg.caption).toBe('string');
      expect(reg.caption).toBe(presetCaption(id));
      expect(reg).not.toHaveProperty('tab');
    }
    expect(presetState('default').moves).toEqual(golden.types.A3!.longest_word);
    expect(presetSecondMoves('compared')).toEqual(gameWord('A3', [1, 1, 1], 'highest'));
    expect(presetOptions('wave')).toEqual({ tab: 'wave', firstColour: 0, secondGame: 'none' });
    expect(presetState('dimension')).toMatchObject({ board: 'A2', lambda: [1, 1] });
  });

  it('a link is read with the legal rule and the lambda cap', () => {
    const defaults = t05State({ ...presetState('dimension') });
    const read = (q: string) => {
      const d = decodeState(q, 'numbers', defaults);
      return admitLink(d.state, d.notice, defaults);
    };
    expect(read('g=A2&d=1,1')).toEqual({ state: defaults, notice: null });
    expect(read('g=A2&d=2,0').state.lambda).toEqual([2, 0]);
    const negative = read('g=A2&d=-1,1');
    expect(negative.notice).toBe(LINK_NOTICE);
    expect(negative.state.lambda).toEqual([1, 1]);
    const long = read('g=A2&d=1234567,1');
    expect(long.notice).toBe(LINK_NOTICE);
    expect(long.state.lambda).toEqual([1, 1]);
    // An illegal move (node 1 fired twice), the populations coords, another view or mode: defaults and the notice.
    for (const q of ['g=A2&c=n&s=1,1&w=1.1', 'g=A2&c=p&s=1,0', 'g=A2&v=l', 'g=A2&m=f', 'g=A2~']) {
      const r = read(q);
      expect(r.notice, q).toBe(LINK_NOTICE);
      expect(r.state, q).toEqual(defaults);
    }
    expect(read('g=A3&c=n&s=1,1,1&w=1.2').state).toEqual(t05State({ board: 'A3', start: [1, 1, 1], moves: [1, 2] }));
  });
});

// ---------------------------------------------------------------------------------------------
// Server render of the component (a loader like T09.test.ts's, with the aliases of CONTRACTS 1)
// ---------------------------------------------------------------------------------------------

const SITE = fileURLToPath(new URL('../../../', import.meta.url));
let server: ViteDevServer;
let renderFn: (c: unknown, o: { props: unknown }) => { body: string };
let Component: unknown;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-ssr-test-cache-t05-' + checkoutKey()),
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [svelte({ configFile: false })],
    // The aliases of CONTRACTS.md 1 from their one declaration, the paths of site/tsconfig.json (RT-FIX
    // P3-RT-12-05 and its residual; site/tests/unit/aliases-one-source.test.ts refuses a copy).
    resolve: { tsconfigPaths: true },
  });
  renderFn = ((await server.ssrLoadModule('svelte/server')) as { render: typeof renderFn }).render;
  Component = ((await server.ssrLoadModule('/src/components/tools/T05NumbersGameLab.svelte')) as { default: unknown }).default;
}, 60000);

afterAll(async () => {
  await server?.close();
});

function render(props: Record<string, unknown>): string {
  return renderFn(Component, { props: { id: '', ...props } }).body;
}
function tags(source: string, name: string): string[] {
  return source.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
}
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>/])`).exec(tag);
  return m === null ? null : (m[1] ?? '');
}
function outs(body: string, name: string): string[] {
  const re = new RegExp(`<([a-z]+)\\b[^>]*data-out="${name}"[^>]*>([\\s\\S]*?)</\\1>`, 'g');
  return [...body.matchAll(re)].map((m) => m[2]!.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
}
function nodeValues(body: string, which: 'numbers' = 'numbers'): string[] {
  return tags(body, 'button')
    .filter((t) => attr(t, 'data-board') === which && attr(t, 'data-node') !== null)
    .map((t) => attr(t, 'data-value')!);
}

describe('T5 server render', () => {
  it('the default renders the tape, the tally reading and 24 beside 24', () => {
    const body = render({ preset: 'default' });
    expect(body).toContain('data-tool="numbers"');
    expect(body).toContain('data-moves="6"');
    expect(outs(body, 'tape')[0]).toBe('1, 2, 1, 3, 2, 1');
    expect(outs(body, 'exponents')[0]).toBe('1, 2, 3');
    expect(outs(body, 'exponentProduct')[0]).toBe(String(golden.types.A3!.weyl_order));
    expect(outs(body, 'groupOrder')[0]).toBe(String(golden.types.A3!.weyl_order));
    expect(outs(body, 'gameOver')[0]).toMatch(/Game over after 6 moves/);
    const bars = tags(body, '[a-z]+').filter((t) => attr(t, 'data-out') === 'tallyBar');
    expect(bars.map((t) => [attr(t, 'data-fired'), attr(t, 'data-count')])).toEqual(Object.entries(golden.types.A3!.fired_tally).map(([v, c]) => [v, String(c)]));
    // Every control is disabled in the server HTML.
    for (const t of tags(body, 'button')) expect(attr(t, 'disabled'), t).not.toBeNull();
    expect(body).toContain('<math');
  });

  it('the tally, wave and dimension presets render as M5 rows 6 to 8 specify', () => {
    const tallyA3 = render({ preset: 'tally', board: 'A3' });
    expect(tallyA3).toContain('data-moves="0"');
    expect(tallyA3).toMatch(/data-tab="tally"[^>]*aria-selected="true"|aria-selected="true"[^>]*data-tab="tally"/);
    expect(nodeValues(tallyA3)).toEqual(['1', '1', '1']);
    expect(outs(tallyA3, 'tallyNote')[0]).toBe(TALLY_NOTE);
    const tallyE8 = render({ preset: 'tally', board: 'E8' });
    expect(nodeValues(tallyE8)).toEqual(Array(8).fill('1'));
    expect(tallyE8).toContain('data-control="playToEnd"');
    for (const [name, h] of [['A3', golden.types.A3!.coxeter_number], ['E8', golden.types.E8!.coxeter_number]] as const) {
      const wave = render({ preset: 'wave', board: name });
      expect(wave).toMatch(/data-tab="wave"[^>]*aria-selected="true"|aria-selected="true"[^>]*data-tab="wave"/);
      expect(outs(wave, 'coxeterNumber')[0]).toBe(String(h));
      expect(outs(wave, 'waveRounds')[0]).toBe('0');
      expect(waveOf(resolveBoard(name), 0).split).toHaveLength(h);
    }
    const dim = render({ preset: 'dimension', board: 'A2', lambda: [1, 1] });
    expect(outs(dim, 'tapeRho')[0]).toBe('1, 2, 1');
    expect(outs(dim, 'tapeLambdaRho')[0]).toBe('2, 4, 2');
    expect(outs(dim, 'productRho')[0]).toBe('2');
    expect(outs(dim, 'productLambdaRho')[0]).toBe('16');
    expect(outs(dim, 'dimension')[0]).toBe('8');
    expect(outs(render({ preset: 'dimension' }), 'dimension')[0]).toBe('8');
  });

  it('the board property overrides a preset board and recomputes its start and moves', () => {
    const wave = render({ preset: 'wave', board: 'E8' });
    expect(nodeValues(wave)).toEqual(Array(8).fill('1'));
    expect(wave).toContain('data-moves="0"');
    const compared = render({ preset: 'compared', board: 'B2' });
    expect(compared).toContain('data-moves="4"');
    expect(outs(compared, 'tape')[0]).toBe('1, 3, 2, 1');
    expect(presetState('compared', 'B2').moves).toEqual([1, 2, 1, 2]);
    expect(outs(compared, 'movesB')[0]).toBe('4');
  });

  it('server rendering with a prediction freezes the boards and follows the question with a details element', () => {
    const answer = play(boardFromName('A3') as Board<number>, [1, 1, 1]).moves;
    for (const prediction of [
      { question: 'How many moves does the game on A3 from all ones take?', answer: { type: 'number', value: answer }, reveal: 'Six moves, whatever the order.' },
      { question: 'Will another order end elsewhere?', answer: { type: 'choice', options: ['yes', 'no'], correct: 1 }, reveal: 'Every order ends at the same place.' },
    ]) {
      const body = render({ preset: 'tally', prediction });
      const q = body.indexOf(prediction.question);
      expect(q).toBeGreaterThan(-1);
      const details = body.indexOf('<details', q);
      expect(details).toBeGreaterThan(q);
      const end = body.indexOf('</details>', details);
      const inside = body.slice(details, end);
      expect(inside).toContain(prediction.reveal);
      if (prediction.answer.type === 'number') expect(inside).toContain(String(answer));
      else expect(inside).toContain('no');
      for (const t of tags(body, 'button').filter((x) => attr(x, 'data-node') !== null || ['step', 'playToEnd'].includes(attr(x, 'data-control') ?? '') || attr(x, 'data-tab') !== null)) {
        expect(attr(t, 'disabled'), t).not.toBeNull();
        if (attr(t, 'data-node') !== null) expect(attr(t, 'data-can-act')).toBe('false');
      }
    }
  });

  it('the prediction answer is computed by the engine', () => {
    // Plan example: "How many moves does the game on A3 from all ones take?", a number, from play.
    const g = onesGame('A3');
    expect(g.applied.length).toBe(play(boardFromName('A3') as Board<number>, [1, 1, 1]).moves);
    expect(g.applied.length).toBe(golden.types.A3!.longest_word.length);
  });
});

describe('regressions', () => {
  // P3-RT-04-03: T5 shows the notice of a default state over a link it applied. On T5 a link whose `d`
  // parses but is not a lambda the calculator takes (a negative entry, or more than 6 digits) was applied
  // in part: the link's board, start and moves were shown, lambda went back to a default, and the notice
  // "The link could not be read, so the tool shows its default state." was shown although the tool did not
  // show its default state. SPEC 6.6 Validation: a failure "makes the instance load its default state and
  // show a notice"; a value that is not a failure is applied with no notice. t05/link.ts admitLink().
  const { caption: _c, ...fields } = T05.presets.default;
  const D = { schema: 1, tool: 'numbers', ...fields } as ToolState;

  for (const q of ['g=E8&c=n&s=1,1,1,1,1,1,1,1&w=1&d=1000000,0,0,0,0,0,0,0', 'g=E8&c=n&s=1,1,1,1,1,1,1,1&w=1&d=-1,0,0,0,0,0,0,0']) {
    // regression: P3-RT-04-03
    it(q, () => {
      const decoded = decodeState(q, 'numbers', D);
      expect(decoded.notice).toBeNull(); // the codec accepts d (6.6: "one integer per node")
      const r = admitLink(decoded.state, decoded.notice, D);
      // Either the whole link is applied with no notice, or the notice comes with the default state.
      if (r.notice !== null) {
        expect(r.notice).toBe(LINK_NOTICE);
        expect(r.state).toEqual(D);
      }
    });
  }
});
