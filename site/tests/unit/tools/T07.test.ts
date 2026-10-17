// P3-A5: tool T7, the Symbolic Game, LinearForm and the T1 colour-class panel (SPEC.md 4 T7, 2.7 F6,
// 2.4 (b), 4.0, 7.3, 7.5, 7.6; Appendix A.1). The criteria that range over every type or many random
// cases, the pure helpers in the <script module> blocks of T07SymbolicGame.svelte, LinearForm.svelte and
// T01GameBoard.svelte (loaded through Vite with the Svelte plugin, _svelteSsr.ts, because the site-unit
// project compiles no .svelte file), and the server render for the properties a link cannot set
// (prediction). Golden values are read from reference/golden_data.json, never typed; the only vectors
// typed are the worked example of Appendix A.1. This file calls no covers() (it is not an engine file).
// Random starts use a fixed seed (mulberry32, SEED below).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyWord, boardFromName, play, positiveRoots, symbolicPlay, toPositions, transposeBoard } from '@engine';
import type { AnyBoard, Board } from '@engine';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';
import T07Entry from '../../../src/tools/registry/T07';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<
    string,
    {
      cartan: number[][];
      longest_word: number[];
      n_positive_roots: number;
      positive_roots?: number[][];
      bipartite_colouring: number[];
    }
  >;
};
const TYPE_NAMES = Object.keys(golden.types);
/** SPEC 4 T7 acceptance: every type of rank at most 4, and E6. */
const FOURTEEN = ['A1', 'A2', 'A3', 'A4', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'D4', 'F4', 'G2', 'E6'];

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

const key = (v: readonly (number | bigint)[]): string => v.map(String).join(',');
const keys = (vs: readonly (readonly (number | bigint)[])[]): string[] => vs.map(key).sort();
const ones = (n: number): number[] => Array.from({ length: n }, () => 1);
const named = (name: string): Board<number> => boardFromName(name) as Board<number>;
const word = (name: string): number[] => toPositions(named(name), golden.types[name]!.longest_word);

/** The module exports of the three Svelte files, loaded once. */
interface T07Module {
  T07_CAPTION: string;
  T07_BOARDS: readonly string[];
  NOT_FIRED: string;
  symbolicEntries(board: AnyBoard, word: readonly number[]): number[][];
  symbolicView(board: AnyBoard, moves: readonly number[], roots?: readonly (readonly number[])[]): { word: number[]; fired: number[][]; entries: number[][]; rows: { root: number[]; move: number | null }[] };
  reversedRoots(board: AnyBoard): number[][];
  matchRows(roots: readonly (readonly number[])[], fired: readonly (readonly number[])[]): { root: number[]; move: number | null }[];
  entrySign(coeffs: readonly number[]): -1 | 0 | 1;
  t07State(board: string, start: readonly (number | string)[], moves: readonly number[]): Record<string, unknown>;
  leftGame(state: Record<string, unknown>): { board: AnyBoard; shown: { numbers: string[] }; cursor: number; playToEnd(): { moves: number } };
  readLink(search: string, defaults: Record<string, unknown>, prefix: string): { state: Record<string, unknown>; notice: string | null };
  stateProblem(state: Record<string, unknown>): string | null;
  default: unknown;
}
interface LinearFormModule {
  RENDER: 'mathml' | 'spans';
  formTerms(coeffs: readonly (number | bigint)[], labels: readonly number[]): { op: string; coeff: string | null; label: number }[];
  formSpoken(coeffs: readonly (number | bigint)[], labels: readonly number[], letter?: string): string;
  formText(coeffs: readonly (number | bigint)[], labels: readonly number[], letter?: string): string;
  default: unknown;
}
interface T01Module {
  colourClasses(board: AnyBoard): { kind: 'classes'; first: number[]; second: number[] } | { kind: 'none' };
  classText(labels: readonly number[]): string;
  NO_COLOUR_CLASSES: string;
  default: unknown;
}
interface StateModule {
  resolveBoard(spec: string | { cartan: number[][] }): AnyBoard;
}

let loader: SsrLoader;
let T7: T07Module;
let LF: LinearFormModule;
let T1: T01Module;
let ST: StateModule;

beforeAll(async () => {
  loader = await ssrLoader();
  T7 = await loader.load<T07Module>('/src/components/tools/T07SymbolicGame.svelte');
  LF = await loader.load<LinearFormModule>('/src/components/math/LinearForm.svelte');
  T1 = await loader.load<T01Module>('/src/components/tools/T01GameBoard.svelte');
  ST = await loader.load<StateModule>('/src/lib/state.ts');
}, 120000);

afterAll(async () => {
  await loader?.close();
});

/** The golden list of the reversed board of `name` (SPEC 2.4 (b)), as the plan of 5.10 item 1 reads it. */
function reversedGolden(name: string): number[][] {
  const letter = name[0]!;
  const rank = name.slice(1);
  if (letter === 'B' && name !== 'B2') return golden.types[`C${rank}`]!.positive_roots!;
  if (letter === 'C' && name !== 'C2') return golden.types[`B${rank}`]!.positive_roots!;
  if (name === 'B2') return golden.types.C2!.positive_roots!;
  if (name === 'C2') return golden.types.B2!.positive_roots!;
  if (letter === 'F' || letter === 'G') return golden.types[name]!.positive_roots!.map((v) => [...v].reverse());
  return golden.types[name]!.positive_roots!;
}

describe('T7 SPEC acceptance (SPEC 4 T7, 2.7 F6, 2.4 (b))', () => {
  it('fired forms equal the positive roots of the transposed Cartan matrix on the 14 boards', () => {
    for (const name of FOURTEEN) {
      const b = named(name);
      const fired = symbolicPlay(b, word(name));
      const N = golden.types[name]!.n_positive_roots;
      expect(fired, name).toHaveLength(N);
      expect(new Set(fired.map(key)).size, `${name}: no repetition`).toBe(N);
      expect(keys(fired), `${name}: the roots of the transposed matrix`).toEqual(keys(positiveRoots(transposeBoard(b))));
      expect(keys(fired), `${name}: the golden list of the reversed board`).toEqual(keys(reversedGolden(name)));
      // The tool's own table: every row used exactly once, along the play's word.
      const view = T7.symbolicView(ST.resolveBoard(name), golden.types[name]!.longest_word);
      expect(view.rows).toHaveLength(N);
      expect(view.rows.every((r) => r.move !== null), name).toBe(true);
      expect(new Set(view.rows.map((r) => r.move)).size, name).toBe(N);
      expect(keys(view.rows.map((r) => r.root))).toEqual(keys(positiveRoots(transposeBoard(b))));
    }
  });

  it('on B3 the table differs from B3 own positive roots', () => {
    const rows = T7.reversedRoots(ST.resolveBoard('B3'));
    const own = golden.types.B3!.positive_roots!.map(key);
    const reversed = golden.types.C3!.positive_roots!.map(key);
    const rowKeys = new Set(rows.map(key));
    expect([...rowKeys].sort()).toEqual([...reversed].sort());
    const onlyInTable = reversed.filter((v) => !own.includes(v));
    const onlyInB3 = own.filter((v) => !reversed.includes(v));
    expect(onlyInTable.length).toBeGreaterThan(0);
    expect(onlyInB3.length).toBeGreaterThan(0);
    for (const v of onlyInTable) expect(rowKeys.has(v)).toBe(true);
    for (const v of onlyInB3) expect(rowKeys.has(v)).toBe(false);
  });

  it('A.1 B2 symbolic game', () => {
    // Appendix A.1: from (x1, x2) the moves 1, 2, 1, 2 fire x1, 2x1 + x2, x1 + x2, x2.
    expect(symbolicPlay(named('B2'), [0, 1, 0, 1])).toEqual([
      [1, 0],
      [2, 1],
      [1, 1],
      [0, 1],
    ]);
    const B2 = golden.types.B2!.positive_roots!.map(key);
    expect(B2).toContain(key([1, 2]));
    expect(B2).not.toContain(key([2, 1]));
    const view = T7.symbolicView(ST.resolveBoard('B2'), [1, 2, 1, 2]);
    expect(view.fired).toEqual([
      [1, 0],
      [2, 1],
      [1, 1],
      [0, 1],
    ]);
    expect(view.rows.find((r) => key(r.root) === key([2, 1]))!.move).toBe(1);
  });

  it('the right board entry at the fired node is the fired form, on every prefix of longest_word, all 32 types', () => {
    for (const name of TYPE_NAMES) {
      const b = ST.resolveBoard(name);
      const w = word(name);
      const fired = symbolicPlay(named(name), w);
      for (let k = 0; k < w.length; k++) {
        const entries = T7.symbolicEntries(b, w.slice(0, k));
        expect(entries[w[k]!], `${name} move ${k + 1}`).toEqual(fired[k]);
      }
    }
  });

  it('F6 from random all-positive starts', () => {
    const rnd = mulberry32(SEED);
    for (const name of FOURTEEN) {
      const b = named(name);
      const N = golden.types[name]!.n_positive_roots;
      for (let trial = 0; trial < 6; trial++) {
        const start = Array.from({ length: b.n }, () => 1 + Math.floor(rnd() * 9));
        const p = play(b, start);
        expect(p.status).toBe('ended');
        const fired = symbolicPlay(b, p.word);
        expect(fired).toHaveLength(N);
        fired.forEach((f, k) => {
          const value = f.reduce((acc, c, j) => acc + c * start[j]!, 0);
          expect(p.fired[k], `${name} from ${start.join(',')} move ${k + 1}`).toBe(value);
        });
        const view = T7.symbolicView(ST.resolveBoard(name), [...p.word].map((x) => b.labels[x]!));
        expect(view.rows.every((r) => r.move !== null), name).toBe(true);
        expect(new Set(view.rows.map((r) => r.move)).size).toBe(N);
      }
    }
  });

  it('every right-board entry has one sign, never zero, equal to the sign of the left number', () => {
    for (const name of TYPE_NAMES) {
      const b = named(name);
      const w = word(name);
      for (let k = 0; k <= w.length; k++) {
        const entries = T7.symbolicEntries(ST.resolveBoard(name), w.slice(0, k));
        const left = applyWord(b, ones(b.n), w.slice(0, k), 'firing');
        entries.forEach((e, j) => {
          const s = T7.entrySign(e);
          expect(s, `${name} after ${k} moves, node ${j + 1}: one sign`).not.toBe(0);
          expect(s, `${name} after ${k} moves, node ${j + 1}`).toBe(Math.sign(left[j]!));
        });
      }
    }
  });

  it('matchRows uses each row at most once and leaves the others unused', () => {
    const roots = T7.reversedRoots(ST.resolveBoard('A2'));
    const rows = T7.matchRows(roots, [roots[2]!, roots[2]!]);
    expect(rows.filter((r) => r.move !== null)).toHaveLength(1);
    expect(rows[2]!.move).toBe(0);
    expect(T7.entrySign([0, 0])).toBe(0);
    expect(T7.entrySign([1, -1])).toBe(0);
  });
});

describe('T7 state, links and Big', () => {
  it('registry entry and caption', () => {
    expect(T07Entry.id).toBe('symbolic');
    expect(T07Entry.number).toBe(7);
    expect(T07Entry.phase).toBe(3);
    expect(Object.keys(T07Entry.presets)).toEqual(['default']);
    expect(T07Entry.presets.default.caption).toBe(T7.T07_CAPTION);
    expect(T07Entry.boards).toEqual([...TYPE_NAMES].sort((a, b) => (a[0]! === b[0]! ? Number(a.slice(1)) - Number(b.slice(1)) : a < b ? -1 : 1)));
    expect(T7.T07_BOARDS).toEqual(T07Entry.boards);
    expect(T7.T07_CAPTION).not.toMatch(/\u2014/);
  });

  it('links: the state is read, and bad links give the default with the notice', () => {
    const defaults = T7.t07State('A3', [1, 1, 1], []);
    const ok = T7.readLink('?z=1&g=B2&c=n&s=1,1&w=1.2', defaults, '');
    expect(ok.notice).toBeNull();
    expect(ok.state).toEqual(T7.t07State('B2', [1, 1], [1, 2]));
    for (const bad of ['?z=1&g=B2&c=n&s=1,1&w=2.2', '?z=1&g=A2~', '?z=1&g=A3&c=n&s=1,0,1', '?z=1&g=A3&c=p', '?z=1&g=A3&s=1,1,1', '?z=1&g=A3&c=n&s=1,1']) {
      const r = T7.readLink(bad, defaults, '');
      expect(r.notice, bad).not.toBeNull();
      expect(r.state, bad).toEqual(defaults);
    }
    // A prefixed link on a lesson page.
    expect(T7.readLink('?b2.z=1&b2.g=G2&b2.c=n&b2.s=2,3', defaults, 'b2').state).toEqual(T7.t07State('G2', [2, 3], []));
  });

  it('a start beyond SafeInt reloads with Big and no message', () => {
    const big = `1${'0'.repeat(39)}`;
    expect(big).toHaveLength(40);
    const state = T7.t07State('A3', [big, 1, 1], [1]);
    expect(T7.stateProblem(state)).toBeNull();
    const r = T7.readLink(`?z=1&g=A3&c=n&s=${big},1,1&w=1`, T7.t07State('A3', [1, 1, 1], []), '');
    expect(r.notice).toBeNull();
    const g = T7.leftGame(r.state);
    expect(typeof (g.board as Board<unknown>).arith.zero).toBe('bigint');
    // The left play equals the Big play computed by the engine directly.
    const engineBig = applyWord(g.board as Board<bigint>, [BigInt(big), 1n, 1n], [0], 'firing');
    expect(g.shown.numbers).toEqual(engineBig.map(String));
    // The forms do not depend on the start: move 1 fires x1 (M5 beat 5), as from all ones.
    const fromOnes = T7.symbolicView(ST.resolveBoard('A3'), [1]).fired;
    expect(fromOnes).toEqual([[1, 0, 0]]);
    expect(T7.symbolicView(ST.resolveBoard(String(r.state.board)), r.state.moves as number[]).fired).toEqual(fromOnes);
  });

  // The timing test 'recomputation after a move stays under the long-task budget' runs alone, in
  // site/tests/timing/T07.timing.test.ts, through `npm run bench` (P4-X2, MERGE P4 wave 4.4).
});

describe('LinearForm helpers', () => {
  const L3 = [1, 2, 3];
  it('terms and spoken text', () => {
    expect(LF.formTerms([1, 0], [1, 2])).toEqual([{ op: '', coeff: null, label: 1 }]);
    expect(LF.formSpoken([1, 0], [1, 2])).toBe('x 1');
    expect(LF.formTerms([2, 1], [1, 2])).toEqual([
      { op: '', coeff: '2', label: 1 },
      { op: '+', coeff: null, label: 2 },
    ]);
    expect(LF.formSpoken([2, 1], [1, 2])).toBe('2 x 1 plus x 2');
    expect(LF.formText([2, 1], [1, 2])).toBe('2x1 + x2');
    expect(LF.formSpoken([1, 1, 1], L3)).toBe('x 1 plus x 2 plus x 3');
    expect(LF.formTerms([-1, 0, -2], L3)).toEqual([
      { op: '−', coeff: null, label: 1 },
      { op: '−', coeff: '2', label: 3 },
    ]);
    expect(LF.formSpoken([-1, 0, -2], L3)).toBe('minus x 1 minus 2 x 3');
    expect(LF.formText([-1, 0, -2], L3)).toBe('−x1 − 2x3');
    expect(LF.formTerms([0, 0, 0], L3)).toEqual([]);
    expect(LF.formSpoken([0, 0, 0], L3)).toBe('0');
    expect(LF.formText([0, 0, 0], L3)).toBe('0');
    expect(LF.formSpoken([3n, -1n], [1, 2])).toBe('3 x 1 minus x 2');
  });

  it('subscripts are labels, in label order (E-7)', () => {
    // Labels starting at 0, given out of order by position: x0 comes first.
    expect(LF.formTerms([1, 2, 0], [1, 0, 2])).toEqual([
      { op: '', coeff: '2', label: 0 },
      { op: '+', coeff: null, label: 1 },
    ]);
    expect(LF.formSpoken([0, 1], [0, 1])).toBe('x 1');
    expect(LF.formSpoken([1, 0], [0, 1])).toBe('x 0');
    expect(LF.formSpoken([1], [7], 'y')).toBe('y 7');
  });

  it('renders MathML, or spans behind the switch, with the aria-label', () => {
    expect(LF.RENDER).toBe('mathml');
    const math = loader.render(LF.default, { coeffs: [2, 1], labels: [1, 2] });
    expect(math).toMatch(/<math[^>]*aria-label="2 x 1 plus x 2"/);
    expect(math.replace(/<!--[^]*?-->/g, '').replace(/ class="[^"]*"/g, '').replace(/ data-form-render="[^"]*"/, '').replace(/ aria-label="[^"]*"/, '')).toBe(
      '<math><mn>2</mn><msub><mi>x</mi><mn>1</mn></msub><mo>+</mo><msub><mi>x</mi><mn>2</mn></msub></math>',
    );
    const zero = loader.render(LF.default, { coeffs: [0, 0], labels: [1, 2] });
    expect(zero.replace(/<!--[^]*?-->/g, '')).toMatch(/<mn>0<\/mn><\/math>/);
    const neg = loader.render(LF.default, { coeffs: [-1, 0, -2], labels: [1, 2, 3] }).replace(/<!--[^]*?-->/g, '');
    expect(neg).toContain('<mo>−</mo><msub><mi>x</mi><mn>1</mn></msub><mo>−</mo><mn>2</mn><msub><mi>x</mi><mn>3</mn></msub>');
    const spans = loader.render(LF.default, { coeffs: [2, 1], labels: [1, 2], render: 'spans' }).replace(/<!--[^]*?-->/g, '');
    expect(spans).not.toContain('<math');
    expect(spans).toMatch(/aria-label="2 x 1 plus x 2"/);
    expect(spans).toMatch(/<sub[^>]*>1<\/sub>/);
    expect(spans).toMatch(/<sub[^>]*>2<\/sub>/);
  });
});

describe('T1 colour-class panel', () => {
  it('colour classes agree with bipartite_colouring', () => {
    for (const name of TYPE_NAMES) {
      const r = T1.colourClasses(ST.resolveBoard(name));
      expect(r.kind, name).toBe('classes');
      if (r.kind !== 'classes') continue;
      const colouring = golden.types[name]!.bipartite_colouring;
      const first = colouring.map((c, k) => [c, k + 1] as const).filter(([c]) => c === 0).map(([, l]) => l);
      const second = colouring.map((c, k) => [c, k + 1] as const).filter(([c]) => c === 1).map(([, l]) => l);
      expect(r.first, name).toEqual(first);
      expect(r.second, name).toEqual(second);
    }
    expect(T1.classText([1, 3])).toBe('nodes 1, 3');
    expect(T1.classText([2])).toBe('node 2');
    expect(T1.classText([])).toBe('no node');
  });

  it('null and the odd-cycle text on A2~; a one-way board is split by roads either way', () => {
    expect(T1.colourClasses(ST.resolveBoard('A2~'))).toEqual({ kind: 'none' });
    expect(T1.NO_COLOUR_CLASSES).toBe('No two colour classes: the board has a cycle of odd length.');
    const oneWay = ST.resolveBoard({ cartan: [[2, -1, 0], [0, 2, 0], [0, -1, 2]] });
    expect(oneWay.kind).toBe('one-way');
    expect(T1.colourClasses(oneWay)).toEqual({ kind: 'classes', first: [1, 3], second: [2] });
    // An affine board keeps node 0 first in the first class (labels, E-7).
    const d4 = T1.colourClasses(ST.resolveBoard('D4~'));
    expect(d4.kind).toBe('classes');
    if (d4.kind === 'classes') expect(d4.first).toContain(0);
  });

  it('the panel renders only when listed, with its hooks', () => {
    const { default: T01 } = T1 as unknown as { default: unknown };
    const without = loader.render(T01, { board: 'A3', view: 'numbers', coords: 'numbers' });
    expect(without).not.toContain('data-out="colourClasses"');
    const body = loader.render(T01, { board: 'A3', view: 'numbers', coords: 'numbers', panels: ['colours'] });
    expect(body).toMatch(/data-out="colourClasses" data-class-1="1,3" data-class-2="2"/);
    expect(body).toContain('First class: nodes 1, 3;');
    expect(body).toContain('second class: node 2.');
    expect(body).toContain('●');
    expect(body).toContain('■');
    const tri = loader.render(T01, { board: { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] }, view: 'numbers', coords: 'numbers', panels: ['colours'] });
    expect(tri).toMatch(/data-out="colourClasses" data-none="true"/);
    expect(tri).toContain(T1.NO_COLOUR_CLASSES);
  });
});

describe('T7 server render', () => {
  it('default state: both boards, MathML of x1, x2, x3, the table with every row unused', () => {
    const body = loader.render(T7.default, { id: '', caption: T7.T07_CAPTION });
    expect(body).toContain('data-tool="symbolic"');
    expect(body).toContain('data-out="numbersBoard"');
    expect(body).toContain('data-out="symbolicBoard"');
    for (const l of [1, 2, 3]) expect(body).toMatch(new RegExp(`<math[^>]*aria-label="x ${l}"`));
    const rows = body.match(/data-out="rootRow"[^>]*/g) ?? [];
    expect(rows).toHaveLength(golden.types.A3!.n_positive_roots);
    for (const r of rows) expect(r).toContain('data-used="false"');
    expect((body.match(new RegExp(T7.NOT_FIRED, 'g')) ?? []).length).toBe(golden.types.A3!.n_positive_roots);
  });

  it('prediction freezes the board', () => {
    const prediction = { question: 'How many forms will be fired?', answer: { type: 'number', value: golden.types.A3!.n_positive_roots }, reveal: 'One for each positive root.' };
    const body = loader.render(T7.default, { id: 'b1', caption: T7.T07_CAPTION, prediction });
    const q = body.indexOf('How many forms will be fired?');
    const d = body.indexOf('<details', q);
    expect(q).toBeGreaterThan(-1);
    expect(d).toBeGreaterThan(q);
    const details = body.slice(d, body.indexOf('</details>', d));
    expect(details).toContain(String(golden.types.A3!.n_positive_roots));
    expect(details).toContain('One for each positive root.');
    const buttons = body.match(/<button[^>]*data-node=[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(6);
    for (const b of buttons) expect(b).toMatch(/ disabled/);
    // The left board's nodes are offered no move while frozen.
    for (const b of buttons) expect(b).toContain('data-can-act="false"');
  });

  it('authoring errors name the instance', () => {
    expect(() => loader.render(T7.default, { id: 'b4', board: 'A3', start: [1, 0, 1] })).toThrow(/b4/);
    expect(() => loader.render(T7.default, { id: 'b4', board: 'A2~' })).toThrow(/b4/);
    expect(() => loader.render(T7.default, { id: 'b4', board: 'B2', moves: [2, 2] })).toThrow(/b4/);
  });
});
