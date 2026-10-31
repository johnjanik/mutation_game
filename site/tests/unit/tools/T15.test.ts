// P2-A4: tool T15, the Affine Playground (SPEC.md 4 T15, 2.12, 2.3, 2.9, 4.0, 5.6, 6.6, Appendix A.6
// and E item 6). The four acceptance criteria of SPEC 4 T15 over every board offered, run on the engine
// as the oracle's verify.py samples them (affine_checks, the pentagon section); the board list, the
// registry and its presets; the pure helpers of site/src/components/tools/t15/ (fate.ts, convention.ts,
// model.ts); the routing of `play on`; and the server render of T15AffinePlayground.svelte for what a
// link cannot set (prediction, the release default of the E6 wording). Golden values are read from
// reference/golden_data.json, never typed; this file calls no covers(): `affine`, `twisted_affine` and
// `pentagon_example` belong to P2-A1's golden files (CONTRACTS 3). Random cases use mulberry32 with the
// fixed seed SEED below. The positive-level sweep plays at the cap of SPEC 5.6, 20000 moves, on every
// board; it has its own timeout (COMMON 4.5: the cap is never lowered to make a test faster).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  Big,
  CAPS,
  applyWord,
  boardFromName,
  cartanNumbers,
  classify,
  comarks,
  fire,
  level,
  marks,
  playFate,
  toLabels,
  toNumbers,
} from '@engine';
import type { Board } from '@engine';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { AFFINE_BOARDS, AFFINE_BOARD_GROUPS } from '../../../src/components/tools/t15/boards';
import { PRESETS, TAB_IDS } from '../../../src/components/tools/t15/presets';
import {
  COMPUTED_TEXT,
  MARK_TEXT,
  MARK_TITLE,
  ROWS,
  SOURCED_TEXT,
  ZERO_POSITION_TEXT,
  fallbackText,
  isSimpleGraph,
  provenanceOf,
  reportText,
  rowOf,
  wrappedRow,
} from '../../../src/components/tools/t15/fate';
import { legalInOlympiad, legalInSite, olympiadSum, shownValues } from '../../../src/components/tools/t15/convention';
import { AffineGame, inLabelOrder, startFor, verdictText, withMartian } from '../../../src/components/tools/t15/model';
import { decodeState, encodeState } from '../../../src/lib/urlCodec';
import { whereToRun } from '../../../src/lib/worker';
import type { ToolState } from '../../../src/lib/state';
import T15 from '../../../src/tools/registry/T15';

/** A short key of this checkout, so that concurrent worktrees never share a compile cache (MERGE, P2 stage 2.1). */
function checkoutKey(): string {
  return createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8);
}

interface AffineRecord {
  name: string;
  constructor_name: string;
  cartan_node0_first: number[][];
  marks: number[];
  comarks: number[];
}
interface TwistedRecord {
  name: string;
  cartan: number[][];
  marks: number[];
  comarks: number[];
}
interface PentagonRecord {
  cartan: number[][];
  start_olympiad_convention: number[];
  start: number[];
  level: number;
  word_lowest_node_rule: number[];
  fired: number[];
  end: number[];
  moves: number;
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { n_positive_roots: number }>;
  affine: Record<string, AffineRecord>;
  twisted_affine: TwistedRecord[];
  pentagon_example: PentagonRecord;
};

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
const randInt = (rnd: () => number, lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));

const big = (name: string): Board<bigint> => boardFromName(name) as Board<bigint>;
const randomStart = (rnd: () => number, n: number): bigint[] => Array.from({ length: n }, () => BigInt(randInt(rnd, -9, 9)));
const sign = (x: bigint): -1 | 0 | 1 => (x > 0n ? 1 : x < 0n ? -1 : 0);

/** The finite type behind an offered board, for the 2N bound of 2.12 (untwisted boards and the polygons). */
function untwistedType(name: string): string | null {
  if (name.endsWith('~')) return name.slice(0, -1);
  if (name === 'square') return 'A3';
  if (name === 'pentagon') return 'A4';
  return null;
}

/** Starts with entries in [-9, 9] whose level has the wanted sign, by rejection sampling (verify.py affine_checks). */
function startsOfLevel(rnd: () => number, b: Board<bigint>, want: -1 | 1, count: number): bigint[][] {
  const out: bigint[][] = [];
  for (let tries = 0; out.length < count; tries++) {
    if (tries > 100000) throw new Error(`no start of level sign ${want} found on ${b.name}`);
    const a = randomStart(rnd, b.n);
    if (sign(level(b, a)) === want) out.push(a);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The boards offered (SPEC 4 T15 first sentence; 4.0 Board pickers; 6.6 rule 8; E-7)
// ---------------------------------------------------------------------------------------------

describe('T15 boards and registry', () => {
  it('the registry offers exactly the boards of SPEC 4 T15', () => {
    const expected = [
      ...Object.values(golden.affine).map((r) => r.constructor_name),
      ...golden.twisted_affine.map((r) => r.name),
      'square',
      'pentagon',
    ];
    expect(AFFINE_BOARDS).toEqual(expected);
    expect(AFFINE_BOARDS).toHaveLength(44);
    expect(T15.boards).toEqual(expected);
    expect(AFFINE_BOARD_GROUPS.map((g) => g.label)).toEqual([
      'Untwisted, type A',
      'Untwisted, type B',
      'Untwisted, type C',
      'Untwisted, type D',
      'Untwisted, type E',
      'Untwisted, type F',
      'Untwisted, type G',
      'Twisted',
      'Polygons',
    ]);
    const byConstructor = new Map(Object.values(golden.affine).map((r) => [r.constructor_name, r]));
    for (const name of AFFINE_BOARDS) {
      const b = boardFromName(name);
      expect(b.arith, name).toBe(Big);
      expect(b.kind, name).toBe('gcm');
      expect(b.name, name).toBe(name);
      const polygon = name === 'square' || name === 'pentagon';
      expect([...b.labels], name).toEqual(Array.from({ length: b.n }, (_, k) => (polygon ? k + 1 : k)));
      const records = classify(b);
      expect(records, name).toHaveLength(1);
      expect(records[0]!.class, name).toBe('affine');
      const want = byConstructor.get(name)?.name ?? (golden.twisted_affine.some((t) => t.name === name) ? name : polygon ? (name === 'square' ? 'A3~' : 'A4~') : null);
      expect(records[0]!.name, name).toBe(want);
      expect(verdictText(records), name).toMatch(/^affine, recognised as /);
    }
    // D19 (plan reading for the affine pair): B2~ and C2~ are recognised as one board.
    expect(verdictText(classify(big('B2~')))).toBe('affine, recognised as B2~ = C2~');
    expect(verdictText(classify(big('C2~')))).toBe('affine, recognised as B2~ = C2~');
    // The square and the pentagon are the cycles of 6.1, the pentagon matrix that of pentagon_example.
    expect(cartanNumbers(big('pentagon'))).toEqual(golden.pentagon_example.cartan);
  });

  it('marks and comarks match the golden records and coincide exactly on symmetric boards', () => {
    for (const r of Object.values(golden.affine)) {
      const b = big(r.constructor_name);
      expect(cartanNumbers(b), r.constructor_name).toEqual(r.cartan_node0_first);
      expect(marks(b), r.constructor_name).toEqual(r.marks);
      expect(comarks(b), r.constructor_name).toEqual(r.comarks);
    }
    for (const r of golden.twisted_affine) {
      const b = big(r.name);
      expect(cartanNumbers(b), r.name).toEqual(r.cartan);
      expect(marks(b), r.name).toEqual(r.marks);
      expect(comarks(b), r.name).toEqual(r.comarks);
    }
    let symmetric = 0;
    let differ = 0;
    for (const name of AFFINE_BOARDS) {
      const b = big(name);
      const C = cartanNumbers(b);
      const sym = C.every((row, i) => row.every((x, j) => x === C[j]![i]));
      const same = marks(b).every((m, k) => m === comarks(b)[k]);
      expect(same, name).toBe(sym);
      if (sym) symmetric++;
      else differ++;
    }
    expect(symmetric).toBeGreaterThan(0);
    expect(differ).toBeGreaterThan(0);
    // The frozen preset's start on the square is its marks (all ones).
    expect(PRESETS.frozen.state.start).toEqual(marks(big('square')));
  });

  it('every preset is a valid link', () => {
    expect(T15.number).toBe(15);
    expect(T15.id).toBe('affine');
    expect(T15.phase).toBe(2);
    expect(Object.keys(T15.presets).sort()).toEqual(['default', 'frozen', 'marks-comarks', 'pentagon', 'three-fates']);
    expect(T15.presets.default).toEqual(T15.presets.frozen);
    expect(TAB_IDS).toEqual(['frozen', 'marks-comarks', 'pentagon', 'three-fates']);
    const toState = (fields: Record<string, unknown>): ToolState => {
      const { caption: _caption, ...rest } = fields;
      return { schema: 1, tool: 'affine', ...rest } as ToolState;
    };
    const defaults = toState(T15.presets.default as unknown as Record<string, unknown>);
    for (const [id, preset] of Object.entries(T15.presets)) {
      expect(preset.caption.length, id).toBeGreaterThan(40);
      const state = toState(preset as unknown as Record<string, unknown>);
      const { state: back, notice } = decodeState(encodeState(state), 'affine', defaults);
      expect(notice, id).toBeNull();
      // marks-comarks fixes only the board; on the route its link opens the frozen tab on that board
      // (6.6: the tab is not part of a link), so only the board comes back.
      if (state.coords !== undefined) expect(encodeState(back), id).toBe(encodeState(state));
      else expect(back.board, id).toBe(state.board);
      // Against its own defaults (a lesson instance with that preset) every preset comes back as it is.
      expect(encodeState(decodeState(encodeState(state), 'affine', state).state), id).toBe(encodeState(state));
    }
    // The registry and its captions type no golden number of pentagon_example (COMMON 4.4).
    for (const preset of Object.values(T15.presets)) expect(preset.caption).not.toMatch(/\b14\b|1230/);
    // A board the tool does not offer is refused (6.6 rule 8).
    expect(decodeState('z=1&g=A3', 'affine', defaults).notice).not.toBeNull();
    expect(decodeState('z=1&g=pentagon&c=n&s=1,-2,3,-4,1&w=1.3', 'affine', defaults).notice).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// fate.ts and convention.ts
// ---------------------------------------------------------------------------------------------

describe('T15 helpers', () => {
  it('fate.ts reports, rows and provenance', () => {
    expect(reportText('ended', 14)).toBe('ended after 14 moves');
    expect(reportText('looped', 8)).toBe('returned to an earlier position after 8 moves');
    expect(reportText('cap', CAPS.playMoves)).toBe('still running after 20000 moves');
    expect(CAPS.playMoves).toBe(20000);
    expect(reportText('ended', 1)).toBe('ended after 1 move');
    expect(reportText('ended', 0)).toBe('ended after 0 moves');
    expect(ROWS.negative).toBe('every legal play ends, after the same number of moves, at the same position');
    expect(ROWS.zero).toBe('the game never ends and visits only finitely many positions (it loops)');
    expect(ROWS.positive).toBe('the game never ends and the numbers grow without bound');
    expect(rowOf(-1, false)).toBe('negative');
    expect(rowOf(0, false)).toBe('zero');
    expect(rowOf(1, false)).toBe('positive');
    expect(rowOf(0, true)).toBeNull();
    expect(ZERO_POSITION_TEXT).not.toMatch(/never ends|grow/);
    // The zero position: playFate ends at once, and no row applies.
    const pent = big('pentagon');
    const zero = playFate(pent, [0n, 0n, 0n, 0n, 0n]);
    expect(reportText(zero.status, zero.moves)).toBe('ended after 0 moves');
    for (const name of ['A4~', 'D4~', 'E8~', 'square', 'pentagon']) expect(isSimpleGraph(big(name)), name).toBe(true);
    for (const name of ['A1~', 'B3~', 'C2~', 'F4~', 'G2~', ...golden.twisted_affine.map((t) => t.name)]) expect(isSimpleGraph(big(name)), name).toBe(false);
    for (const name of AFFINE_BOARDS) {
      const p = provenanceOf(big(name));
      if (isSimpleGraph(big(name))) {
        expect(p, name).toEqual({ kind: 'sourced', key: 'GSS12', text: SOURCED_TEXT });
      } else {
        expect(p.kind, name).toBe('unverified');
        if (p.kind === 'unverified') {
          expect(p.item).toBe('E6');
          for (const row of ['negative', 'zero', 'positive'] as const) expect(p.fallback(row)).toBe(fallbackText(row));
        }
      }
    }
    expect(SOURCED_TEXT).toBe('[GSS12] Theorem 1.2, with the signs reversed');
    expect(COMPUTED_TEXT).not.toMatch(/never ends|grow|loops/);
  });

  it('the release default is the fallback wording with no open-items link', () => {
    for (const row of ['negative', 'zero', 'positive'] as const) {
      const fallback = wrappedRow(row, 'fallback', '/');
      expect(fallback.startsWith('<span class="unverified-fallback" data-unverified="E6">')).toBe(true);
      expect(fallback.endsWith('</span>')).toBe(true);
      expect(fallback).toContain(ROWS[row]);
      expect(fallback).toContain('computed, with this argument');
      expect(fallback).toContain('The argument beside it:');
      expect(fallback).not.toContain('open-items');
      expect(fallback).not.toContain('<a');
      // The [U] step appears only as the argument's unconfirmed premise, naming no source.
      expect(fallback).not.toMatch(/Kac|Proposition/);
      const marked = wrappedRow(row, 'marked', '/sub/');
      expect(marked).toBe(
        `<span class="unverified" data-unverified="E6">${ROWS[row]} <a class="unverified-mark" href="/sub/open-items#E6" title="${MARK_TITLE}">${MARK_TEXT}</a></span>`,
      );
      expect(wrappedRow(row, 'plain', '/')).toBe(ROWS[row]);
    }
    expect(MARK_TITLE).toBe('Rests on item E6 of Appendix E; see its status on the open-items page');
    expect(MARK_TEXT).toBe('[unverified E6]');
    // The shapes are those of Unverified.astro (P0-A4), read from its source.
    const astro = readFileSync(fileURLToPath(new URL('../../../src/components/content/Unverified.astro', import.meta.url)), 'utf8');
    expect(astro).toContain('<span class="unverified" data-unverified={item}>');
    expect(astro).toContain('<a class="unverified-mark" href={href} title={title}>');
    expect(astro).toContain('<span class="unverified-fallback" data-unverified={item}>');
    expect(astro).toContain('Rests on item ${item} of Appendix E; see its status on the open-items page');
    expect(astro).toContain('`[unverified ${item}]`');
  });

  it('the Olympiad form negates the display and keeps the legal nodes', () => {
    const p = golden.pentagon_example;
    const a = p.start.map(BigInt);
    expect(shownValues(a, 'olympiad')).toEqual(p.start_olympiad_convention.map(BigInt));
    expect(shownValues(a, 'site')).toEqual(a);
    const pent = big('pentagon');
    expect(olympiadSum(a)).toBe(-level(pent, a));
    expect(Number(olympiadSum(a))).toBe(-p.level);
    const rnd = mulberry32(SEED);
    for (let t = 0; t < 100; t++) {
      const v = randomStart(rnd, 5);
      expect(legalInOlympiad(shownValues(v, 'olympiad'))).toEqual(legalInSite(v));
      expect(olympiadSum(v)).toBe(-level(pent, v));
    }
  });

  it('play on is routed to the worker', () => {
    for (const name of AFFINE_BOARDS) {
      expect(whereToRun({ board: big(name), kind: 'play', moves: CAPS.playMoves, finiteKnown: false }), name).toBe('worker');
    }
    // The component's call site gives exactly this hint.
    const source = readFileSync(fileURLToPath(new URL('../../../src/components/tools/T15AffinePlayground.svelte', import.meta.url)), 'utf8');
    expect(source).toMatch(/engineCall\('playFate', \[g\.board, a, undefined, cap\] as never, \{ board: g\.board, kind: 'play', moves: CAPS\.playMoves, finiteKnown: false \}\)/);
    expect(source).not.toMatch(/\bplayFate\(/);
    expect(source).not.toMatch(/golden_data|@lib\/golden|unverifiedRegistry/);
  });

  it('acting from an earlier position discards the moves after it, and undo needs no legality test', () => {
    const p = golden.pentagon_example;
    const pent = big('pentagon');
    const g = new AffineGame(pent, { coords: 'numbers', start: p.start });
    const r = playFate(pent, p.start.map(BigInt));
    g.appendPlay(r.word, r.position);
    expect(g.moves).toEqual(p.word_lowest_node_rule);
    expect(g.current.map(Number)).toEqual(p.end);
    expect(g.legalNow()).toEqual([]); // the end: no legal node
    const calls = g.legalCalls;
    expect(g.undo()).toBe(true);
    expect(g.legalCalls).toBe(calls);
    const prefix = toLabels(pent, r.word.slice(0, p.moves - 1));
    expect(g.current).toEqual(applyWord(pent, p.start.map(BigInt), r.word.slice(0, p.moves - 1), 'firing'));
    expect(prefix).toEqual(p.word_lowest_node_rule.slice(0, p.moves - 1));
    // Scrub to move 1 and fire node 5 by hand: the moves after it are gone.
    expect(g.moveTo(1)).toBe(true);
    const five = g.labels.indexOf(5);
    expect(g.numbersAt(1)[five]! > 0n).toBe(true);
    g.act(five);
    expect(g.moves).toEqual([p.word_lowest_node_rule[0]!, 5]);
    expect(g.state('pentagon').moves).toEqual([p.word_lowest_node_rule[0]!, 5]);
    expect(g.current).toEqual(applyWord(pent, p.start.map(BigInt), [p.word_lowest_node_rule[0]! - 1, five], 'firing'));
    expect(g.redo()).toBe(false);
    expect(g.reset()).toBe(true);
    expect(g.moves).toEqual([]);
    expect(g.current).toEqual(p.start.map(BigInt));
  });

  it('after a long play the history computes far positions in the worker and near ones here', async () => {
    const sq = big('square');
    const start = [1, 0, 0, 0];
    const r = playFate(sq, start.map(BigInt), undefined, CAPS.playMoves);
    expect(r.status).toBe('cap');
    const g = new AffineGame(sq, { coords: 'numbers', start });
    g.appendPlay(r.word, r.position);
    expect(g.moves).toHaveLength(CAPS.playMoves);
    expect(g.current).toEqual(r.position);
    // Move 14 is near the start: computed here; move 10000 is far from both cached ends.
    expect(g.moveTo(14)).toBe(true);
    expect(g.current).toEqual(applyWord(sq, start.map(BigInt), r.word.slice(0, 14), 'firing'));
    expect(g.positionAt(10000)).toBeNull();
    let far = 0;
    const run = async (v: bigint[], word: number[], game: 'firing' | 'mutation'): Promise<bigint[]> => {
      far++;
      expect(word.length).toBeGreaterThan(2000);
      return applyWord(sq, v, word, game);
    };
    expect(await g.moveToAsync(10000, run)).toBe(true);
    expect(far).toBe(1);
    expect(g.current).toEqual(applyWord(sq, start.map(BigInt), r.word.slice(0, 10000), 'firing'));
    // Back to the end: cached, no worker.
    expect(g.moveTo(CAPS.playMoves)).toBe(true);
    expect(g.current).toEqual(r.position);
    expect(far).toBe(1);
  });

  it('starts of the frozen population and a Martian', () => {
    const d4 = big('D4~');
    expect(startFor('populations', d4, marks(d4))).toEqual(inLabelOrder(d4, marks(d4)));
    expect(startFor('numbers', d4, marks(d4))).toEqual([1, 1, 1, 1, 1]);
    expect(withMartian(d4, marks(d4), 0)).toEqual(marks(d4).map((m, k) => m + (k === 0 ? 1 : 0)));
    // At the marks every number is zero: every city is happy (2.12, 2.16).
    for (const name of AFFINE_BOARDS) {
      const b = big(name);
      expect(toNumbers(b, marks(b).map(BigInt)).every((x) => x === 0n), name).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// SPEC 4 T15 acceptance, over every board offered
// ---------------------------------------------------------------------------------------------

describe('T15 acceptance (SPEC 4 T15)', () => {
  it('level is constant along 1000 random firings on every board offered', () => {
    const rnd = mulberry32(SEED);
    let changed = 0;
    for (const name of AFFINE_BOARDS) {
      const b = big(name);
      let a = randomStart(rnd, b.n);
      const l0 = level(b, a);
      for (let k = 0; k < 1000; k++) {
        const next = fire(b, a, randInt(rnd, 0, b.n - 1));
        if (next.some((x, j) => x !== a[j])) changed++;
        a = next;
        expect(level(b, a), name).toBe(l0);
      }
    }
    expect(changed).toBeGreaterThan(44 * 500); // the firings are not idle
  });

  it('pentagon example: 20 random orders end after 14 moves at the same end with the same fired numbers', () => {
    const p = golden.pentagon_example;
    const pent = big('pentagon');
    const start = p.start.map(BigInt);
    const multiset = (xs: readonly (number | bigint)[]): string => xs.map(Number).sort((x, y) => x - y).join(',');
    const rnd = mulberry32(SEED + 1);
    const words = new Set<string>();
    for (let t = 0; t < 20; t++) {
      const r = playFate(pent, start, (allowed) => allowed[randInt(rnd, 0, allowed.length - 1)]!);
      expect(r.status).toBe('ended');
      expect(r.moves).toBe(p.moves);
      expect(r.position.map(Number)).toEqual(p.end);
      expect(multiset(r.fired)).toBe(multiset(p.fired));
      words.add(r.word.join('.'));
    }
    expect(words.size).toBeGreaterThan(1); // the orders differ
  });

  it('pentagon example: the lowest-node rule gives the golden word, fired numbers and end', () => {
    const p = golden.pentagon_example;
    const pent = big('pentagon');
    const r = playFate(pent, p.start.map(BigInt));
    expect(r.status).toBe('ended');
    expect(toLabels(pent, r.word)).toEqual(p.word_lowest_node_rule);
    expect(r.fired.map(Number)).toEqual(p.fired);
    expect(r.position.map(Number)).toEqual(p.end);
    expect(r.moves).toBe(p.moves);
    expect(Number(level(pent, p.start.map(BigInt)))).toBe(p.level);
    expect(p.start).toEqual(p.start_olympiad_convention.map((x) => -x));
    // The preset's start is the example in the site's convention.
    expect(PRESETS.pentagon.state.start).toEqual(p.start);
    expect(PRESETS['three-fates'].state.start).toEqual(p.start);
  });

  it('negative level: 10 random starts on every board end', () => {
    const rnd = mulberry32(SEED + 2);
    for (const name of AFFINE_BOARDS) {
      const b = big(name);
      for (const a of startsOfLevel(rnd, b, -1, 10)) {
        const r = playFate(b, a);
        expect(r.status, `${name} ${a.join(',')}`).toBe('ended');
        // 2.12: the same length and end in another order of play.
        const other = playFate(b, a, (allowed) => allowed[randInt(rnd, 0, allowed.length - 1)]!);
        expect(other.moves, name).toBe(r.moves);
        expect(other.position, name).toEqual(r.position);
        expect(reportText(r.status, r.moves)).toMatch(/^ended after \d+ moves?$/);
      }
    }
  });

  it(
    'positive level: 10 random starts on every board are still running after 20000 moves',
    () => {
      const rnd = mulberry32(SEED + 3);
      const t0 = Date.now();
      for (const name of AFFINE_BOARDS) {
        const b = big(name);
        for (const a of startsOfLevel(rnd, b, 1, 10)) {
          const r = playFate(b, a, undefined, CAPS.playMoves);
          expect(r.status, `${name} ${a.join(',')}`).toBe('cap');
          expect(r.moves, name).toBe(CAPS.playMoves);
          expect(reportText(r.status, r.moves)).toBe('still running after 20000 moves');
        }
      }
      // Recorded in decisions/P2-A4.md.
      console.info(`positive-level sweep at the cap ${CAPS.playMoves}: ${Date.now() - t0} ms`);
    },
    600000,
  );

  it('root populations: the numbers of 5 random root populations on every board return to an earlier position', () => {
    const rnd = mulberry32(SEED + 4);
    for (const name of AFFINE_BOARDS) {
      const b = big(name);
      const type = untwistedType(name);
      const bound = type === null ? null : 2 * golden.types[type]!.n_positive_roots;
      for (let t = 0; t < 5; t++) {
        const i = randInt(rnd, 0, b.n - 1);
        const e = Array.from({ length: b.n }, (_, k) => (k === i ? 1n : 0n));
        const word = Array.from({ length: randInt(rnd, 1, 40) }, () => randInt(rnd, 0, b.n - 1));
        const p = applyWord(b, e, word, 'mutation');
        const a = toNumbers(b, p);
        expect(level(b, a), name).toBe(0n);
        expect(a.some((x) => x !== 0n), name).toBe(true);
        const r = playFate(b, a, undefined, CAPS.playMoves);
        expect(r.status, `${name} ${p.join(',')}`).toBe('looped');
        expect(r.firstVisit!, name).toBeLessThan(r.moves);
        if (bound !== null) expect(r.moves, `${name}: within 2N moves`).toBeLessThanOrEqual(bound);
        expect(reportText(r.status, r.moves)).toMatch(/^returned to an earlier position after \d+ moves?$/);
      }
    }
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
    cacheDir: join(tmpdir(), 'two-games-ssr-test-cache-t15-' + checkoutKey()),
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [svelte({ configFile: false })],
    // The aliases of CONTRACTS.md 1 from their one declaration, the paths of site/tsconfig.json (RT-FIX
    // P3-RT-12-05 and its residual; site/tests/unit/aliases-one-source.test.ts refuses a copy).
    resolve: { tsconfigPaths: true },
  });
  renderFn = ((await server.ssrLoadModule('svelte/server')) as { render: typeof renderFn }).render;
  Component = ((await server.ssrLoadModule('/src/components/tools/T15AffinePlayground.svelte')) as { default: unknown }).default;
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
function outHtml(body: string, name: string): string {
  const m = new RegExp(`<([a-z]+)\\b[^>]*data-out="${name}"[^>]*>([\\s\\S]*?)</\\1>`).exec(body);
  return m === null ? '' : m[2]!;
}
const text = (html: string): string => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const nodeButtons = (body: string): string[] => tags(body, 'button').filter((t) => attr(t, 'data-node') !== null);

describe('T15 server render', () => {
  it('the default renders the frozen population on the square', () => {
    const body = render({ preset: 'default' });
    expect(body).toContain('data-tool="affine"');
    expect(body).toContain('data-moves="0"');
    const nodes = nodeButtons(body);
    expect(nodes.map((t) => attr(t, 'data-node'))).toEqual(['1', '2', '3', '4']);
    expect(nodes.map((t) => attr(t, 'data-value'))).toEqual(['1', '1', '1', '1']);
    expect(nodes.every((t) => attr(t, 'data-board') === 'populations')).toBe(true);
    expect(nodes.every((t) => (attr(t, 'aria-label') ?? '').endsWith('mutation would change nothing'))).toBe(true);
    expect(nodes.every((t) => attr(t, 'disabled') !== null)).toBe(true);
    expect(text(outHtml(body, 'verdict'))).toBe('affine, recognised as A3~');
    expect(text(outHtml(body, 'moods'))).toMatch(/^Every city is happy/);
    expect(text(outHtml(body, 'caption'))).toBe(PRESETS.frozen.caption);
    // Nothing plays on load; the live region is empty; no fate is reported.
    expect(body).toMatch(/<div[^>]*data-live=""[^>]*><\/div>/);
    expect(body).not.toContain('data-out="fate"');
  });

  it('the pentagon preset opens in the Olympiad form with its level and sum', () => {
    const body = render({ preset: 'pentagon' });
    const p = golden.pentagon_example;
    const nodes = nodeButtons(body);
    expect(nodes.map((t) => attr(t, 'data-value'))).toEqual(p.start_olympiad_convention.map(String));
    expect(nodes.every((t) => attr(t, 'data-board') === 'numbers')).toBe(true);
    expect(attr(tags(body, 'span').find((t) => attr(t, 'data-out') === 'level')!, 'data-value')).toBe(String(p.level));
    expect(attr(tags(body, 'span').find((t) => attr(t, 'data-out') === 'sum')!, 'data-value')).toBe(String(-p.level));
    expect(text(outHtml(body, 'convention'))).toMatch(/^Olympiad form/);
    expect(text(outHtml(body, 'fate'))).toBe('');
    expect(text(outHtml(body, 'fateSentence'))).toContain(ROWS.negative);
    expect(text(outHtml(body, 'provenance'))).toContain(SOURCED_TEXT);
    // The legal nodes are those with a positive number in the site's convention, shown negative here.
    expect(nodes.map((t) => attr(t, 'data-can-act'))).toEqual(p.start.map((x) => (x > 0 ? 'true' : 'false')));
  });

  it('the release default is the fallback wording with no open-items link', () => {
    // Without unverifiedMode the island uses the release shape (G2~ from all ones: level 4, positive).
    const body = render({ preset: 'three-fates', board: 'G2~', start: [1, 1, 1] });
    const sentence = outHtml(body, 'fateSentence');
    expect(sentence).toContain('<span class="unverified-fallback" data-unverified="E6">');
    expect(text(sentence)).toContain(ROWS.positive);
    expect(text(sentence)).toContain('computed, with this argument');
    expect(body).not.toContain('open-items');
    expect(text(outHtml(body, 'provenance'))).toBe(COMPUTED_TEXT);
    // In preview the page passes 'marked'.
    const marked = render({ preset: 'three-fates', board: 'G2~', start: [1, 1, 1], unverifiedMode: 'marked' });
    expect(outHtml(marked, 'fateSentence')).toContain('<span class="unverified" data-unverified="E6">');
    expect(marked).toContain('open-items#E6');
  });

  it('the prediction prop freezes the board until answered', () => {
    const prediction = { question: 'Will this game end?', answer: { type: 'choice', options: ['yes', 'no'], correct: 0 }, reveal: 'Its level is negative.' };
    const free = render({ preset: 'three-fates' });
    expect(nodeButtons(free).some((t) => attr(t, 'data-can-act') === 'true')).toBe(true);
    const body = render({ preset: 'three-fates', prediction });
    expect(body).toContain('Will this game end?');
    expect(body).toMatch(/<details[^>]*>[\s\S]*Its level is negative\.[\s\S]*<\/details>/);
    expect(nodeButtons(body).every((t) => attr(t, 'data-can-act') === 'false')).toBe(true);
    const playOn = tags(body, 'button').find((t) => attr(t, 'data-control') === 'playOn')!;
    expect(attr(playOn, 'disabled')).not.toBeNull();
  });

  it('marks and comarks render side by side on G2~ and on D4^(3)', () => {
    const g2 = render({ preset: 'marks-comarks' });
    expect(text(outHtml(g2, 'marks'))).toBe(golden.affine.G2!.marks.join(','));
    expect(text(outHtml(g2, 'comarks'))).toBe(golden.affine.G2!.comarks.join(','));
    const d43 = render({ preset: 'marks-comarks', board: 'D4^(3)' });
    const rec = golden.twisted_affine.find((t) => t.name === 'D4^(3)')!;
    expect(text(outHtml(d43, 'marks'))).toBe(rec.marks.join(','));
    expect(text(outHtml(d43, 'comarks'))).toBe(rec.comarks.join(','));
  });

  it('an inconsistent configuration throws at build time', () => {
    expect(() => render({ preset: 'pentagon', board: 'square' })).toThrow(/pentagon/);
    expect(() => render({ board: 'A3' })).toThrow(/not offered/);
    expect(() => render({ preset: 'frozen', coords: 'numbers' })).toThrow(/coords/);
  });
});
