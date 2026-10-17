// P2-A2: tool T3, the Form Finder (SPEC.md 4 T3, 2.5, 2.7 F2, 2.11, 5.4 to 5.6). The three acceptance
// criteria of SPEC 4 T3 at engine level, over the pure modules the component uses (t03/weights.ts,
// t03/digits.ts, t03/model.ts and T1's model for the play), the plan tests of the instruction (5.12),
// and the server render of T03FormFinder.svelte. Golden values are read from
// reference/golden_data.json as inputs, never typed and never the thing under test; this file calls no
// covers() (types[*].symmetrizer and classification_tests are P2-A1's keys, CONTRACTS 3).
// Random cases use the fixed seed SEED below (mulberry32).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  CAPS,
  adjacency,
  boardFromName,
  formIsInvariant,
  formValue,
  gram,
  isRootPopulation,
  mutate,
  ratToString,
  roots,
  symmetrizer,
} from '@engine';
import type { AnyBoard, Board } from '@engine';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import {
  CITY_MIN,
  WEIGHT_MAX,
  defaultWeights,
  initialWeights,
  joinedPairs,
  matrixOf,
  readWeight,
  weightAllowed,
  witnessView,
  witnessSentence,
} from '../../../src/components/tools/t03/weights';
import { MAX_DIGITS, digitNotice, entryAllowed, entryValue, offerEntry } from '../../../src/components/tools/t03/digits';
import { FORM_TEXT, byPosition, defaultRows, followPlay, formText, judgeRow, meterModel, rootVerdict, verdictText } from '../../../src/components/tools/t03/model';
import { FORM_PRESETS, partsInOrder } from '../../../src/components/tools/t03/presets';
import { T1Game } from '../../../src/components/tools/t01/model';
import { clearPublishedStates, followToolState, positionsOf, publishToolState, resolveBoard, type ToolState } from '../../../src/lib/state';
import { encodeState } from '../../../src/lib/urlCodec';
import T03 from '../../../src/tools/registry/T03';

/** A short key of this checkout, so that concurrent worktrees never share a compile cache (MERGE, P2 stage 2.1). */
function checkoutKey(): string {
  return createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8);
}

interface ClassificationTest {
  label: string;
  cartan: number[][];
  components: { balanced: boolean; class: string | null }[];
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { symmetrizer: number[] }>;
  affine: Record<string, { constructor_name: string; marks: number[] }>;
  classification_tests: ClassificationTest[];
};
const TYPE_NAMES = Object.keys(golden.types);
const classificationTest = (label: string): ClassificationTest => {
  const found = golden.classification_tests.filter((t) => t.label === label);
  expect(found).toHaveLength(1);
  return found[0]!;
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
const int = (rnd: () => number, lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));

const named = (name: string): Board<number> => boardFromName(name) as Board<number>;

/** The passing weights of SPEC 4 T3 from the engine's symmetrizer: w_i = 2 d_i, w_ij = 2 d_i A_ji. */
function symmetrizerWeights(board: AnyBoard): { city: number[]; road: number[] } {
  const d = symmetrizer(board)!;
  const A = adjacency(board);
  const di = (i: number): number => {
    expect(d[i]!.den).toBe(1n);
    return Number(d[i]!.num);
  };
  const city = d.map((_, i) => 2 * di(i));
  const road = joinedPairs(board).map(({ positions: [i, j] }) => {
    const wij = 2 * di(i) * A[j]![i]!;
    // The balance condition d_i A_ji = d_j A_ij makes the pair's weight well defined (trap 1).
    expect(2 * di(j) * A[i]![j]!).toBe(wij);
    return wij;
  });
  return { city, road };
}

const FIVE = ['A2', 'B2', 'B3', 'F4', 'G2'] as const;

describe('T3 acceptance (SPEC 4 T3)', () => {
  it('builder accepts the symmetrizer weights on A2, B2, B3, F4, G2', () => {
    for (const name of FIVE) {
      const board = named(name);
      // The symmetrizer the builder's weights come from is the golden one (an input check, not the test).
      expect(symmetrizer(board)!.map(ratToString)).toEqual(golden.types[name]!.symmetrizer.map(String));
      const w = symmetrizerWeights(board);
      const M = matrixOf(board, w.city, w.road);
      const B = gram(board)!;
      // matrixOf returns 2M, and with the passing weights M = B = DC: every entry is twice gram's.
      for (let i = 0; i < board.n; i++) {
        for (let j = 0; j < board.n; j++) {
          expect(B[i]![j]!.den, `${name} gram[${i}][${j}]`).toBe(1n);
          expect(M[i]![j], `${name} matrixOf[${i}][${j}]`).toBe(Number(2n * B[i]![j]!.num));
        }
      }
      const r = formIsInvariant(board, M);
      expect(r.invariant, name).toBe(true);
      expect(r.witness, name).toBeUndefined();
      expect(witnessView(board, r)).toBeNull();
      // Proportional weights pass too.
      const r3 = formIsInvariant(board, matrixOf(board, w.city.map((x) => 3 * x), w.road.map((x) => 3 * x)));
      expect(r3.invariant, `${name} x3`).toBe(true);
      expect(r3.witness).toBeUndefined();
    }
    // The examples of the instruction (5.4), each checked against symmetrizer rather than typed into the tool.
    expect(symmetrizerWeights(named('B2'))).toEqual({ city: [4, 2], road: [4] });
    expect(symmetrizerWeights(named('G2'))).toEqual({ city: [2, 6], road: [6] });
    expect(symmetrizerWeights(named('A2'))).toEqual({ city: [2, 2], road: [2] });
  });

  it('builder rejects a perturbation of any one weight with a witness', () => {
    for (const name of FIVE) {
      const board = named(name);
      const w = symmetrizerWeights(board);
      const tries: { city: number[]; road: number[] }[] = [];
      w.city.forEach((_, k) => tries.push({ city: w.city.map((x, j) => (j === k ? x + 1 : x)), road: [...w.road] }));
      w.road.forEach((_, k) => tries.push({ city: [...w.city], road: w.road.map((x, j) => (j === k ? x + 1 : x)) }));
      expect(tries.length).toBe(board.n + joinedPairs(board).length);
      for (const t of tries) {
        const r = formIsInvariant(board, matrixOf(board, t.city, t.road));
        expect(r.invariant, `${name} ${JSON.stringify(t)}`).toBe(false);
        expect(r.witness).toBeDefined();
        expect(r.witness!.node).toBeGreaterThanOrEqual(0);
        expect(r.witness!.node).toBeLessThan(board.n);
        expect(r.witness!.population).toHaveLength(board.n);
        // The witness is real: the mutation changes the quadratic form of 2M on that population.
        const M = matrixOf(board, t.city, t.road);
        const p = r.witness!.population;
        const q = mutate(board, p, r.witness!.node);
        expect(quad(M, p)).not.toBe(quad(M, q));
        const view = witnessView(board, r)!;
        expect(board.labels).toContain(view.city);
        expect(view.before).toEqual(p.map(String));
        expect(view.after).toEqual(q.map(String));
      }
    }
  });

  it('meter is constant along 1000 random free moves on every type', () => {
    expect(TYPE_NAMES).toHaveLength(32);
    const rnd = mulberry32(SEED);
    for (const name of TYPE_NAMES) {
      const board = boardFromName(name);
      const start = Array.from({ length: board.n }, () => int(rnd, -9, 9));
      if (!start.some((x) => x !== 0)) start[0] = 1;
      const game = new T1Game({ board: name, view: 'populations', mode: 'free', coords: 'populations', start });
      const read = (): string | null => meterModel(undefined, null, { board: game.board, population: populationNow(game) }).value;
      const first = read();
      expect(first, name).not.toBeNull();
      // The meter's text is the engine's formValue of the start (rule 4 text).
      expect(first).toBe(ratToString(formValue(board, byPosition(board, start) as never)!));
      for (let m = 0; m < 1000; m++) {
        const r = game.act(int(rnd, 0, board.n - 1));
        expect(r.kind).toBe('moved');
        expect(read(), `${name} move ${m + 1}`).toBe(first);
      }
      expect(game.cursor).toBe(1000);
    }
  });

  it('100 random positive weight choices fail with a witness on both unbalanced triangles', () => {
    const rnd = mulberry32(SEED + 1);
    for (const label of ['triangle with one double road (unbalanced)', 'triangle with unbalanced road counts all round']) {
      const t = classificationTest(label);
      expect(t.components[0]!.balanced).toBe(false);
      const board = resolveBoard({ cartan: t.cartan });
      expect(joinedPairs(board)).toHaveLength(3);
      for (let k = 0; k < 100; k++) {
        const city = [int(rnd, 1, 6), int(rnd, 1, 6), int(rnd, 1, 6)];
        const road = [int(rnd, 0, 6), int(rnd, 0, 6), int(rnd, 0, 6)];
        const r = formIsInvariant(board, matrixOf(board, city, road));
        expect(r.invariant, `${label} ${city} ${road}`).toBe(false);
        expect(r.witness, `${label} ${city} ${road}`).toBeDefined();
        expect(witnessView(board, r)).not.toBeNull();
      }
    }
  });
});

/** p^T M p for an integer matrix (the test's own check of a witness; the tool never evaluates a form). */
function quad(M: readonly (readonly number[])[], p: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) for (let j = 0; j < p.length; j++) s += p[i]! * M[i]![j]! * p[j]!;
  return s;
}

/** The current population of a T1Game in label order. */
function populationNow(game: T1Game): string[] {
  const pops = game.shown.populations!;
  const order = [...game.board.labels].sort((x, y) => x - y);
  return order.map((l) => pops[game.board.labels.indexOf(l)]!);
}

describe('T3 plan tests (instruction 5.12)', () => {
  it('100 random positive weight choices fail on the one-way road', () => {
    const t = classificationTest('one-way road');
    const board = resolveBoard({ cartan: t.cartan });
    expect(board.kind).toBe('one-way');
    expect(joinedPairs(board)).toHaveLength(1);
    const rnd = mulberry32(SEED + 2);
    for (let k = 0; k < 100; k++) {
      const city = [int(rnd, 1, 6), int(rnd, 1, 6)];
      const road = [int(rnd, 0, 6)];
      const r = formIsInvariant(board, matrixOf(board, city, road));
      expect(r.invariant, `${city} ${road}`).toBe(false);
      expect(r.witness).toBeDefined();
    }
    // Why the controls refuse 0: the degenerate form [[1, 0], [0, 0]] is invariant there (verify.py 1530).
    expect(formIsInvariant(board, [[2, 0], [0, 0]]).invariant).toBe(true);
    // The meter and small values say there is no invariant form, and the root test is not called.
    expect(formText(board, byPosition(board, [1, 0]))).toBeNull();
    expect(rootVerdict(board, byPosition(board, [1, 0]))).toBe(FORM_TEXT.needsTwoWay);
    expect(judgeRow(board, ['1', '0'])).toEqual({ complete: true, value: null, verdict: FORM_TEXT.needsTwoWay });
  });

  it('a zero city weight is refused by the control\'s model', () => {
    expect(CITY_MIN).toBe(1);
    expect(weightAllowed('city', 0)).toBe(false);
    expect(weightAllowed('city', -1)).toBe(false);
    expect(weightAllowed('city', 1)).toBe(true);
    expect(weightAllowed('city', 1.5)).toBe(false);
    expect(weightAllowed('road', 0)).toBe(true);
    expect(weightAllowed('road', -1)).toBe(false);
    expect(weightAllowed('city', WEIGHT_MAX)).toBe(true);
    expect(weightAllowed('city', WEIGHT_MAX + 1)).toBe(false);
    expect(readWeight('city', '0')).toBeNull();
    expect(readWeight('city', '−2')).toBeNull();
    expect(readWeight('city', '3')).toBe(3);
    expect(readWeight('road', '0')).toBe(0);
    expect(readWeight('road', '-1')).toBeNull();
    expect(readWeight('road', 'x')).toBeNull();
    expect(() => initialWeights(named('A2'), [0, 1], undefined)).toThrow(/city weight 0/);
    expect(() => initialWeights(named('A2'), undefined, [{ pair: [1, 2], weight: -1 }])).toThrow(/road weight -1/);
    expect(() => initialWeights(named('A3'), undefined, [{ pair: [1, 3], weight: 1 }])).toThrow(/not joined/);
    // Defaults: every weight 1; on a simply laced board that passes (the Tits form up to scale), on B2 it fails.
    const a3 = named('A3');
    const d = defaultWeights(a3);
    expect(formIsInvariant(a3, matrixOf(a3, d.city, d.road)).invariant).toBe(true);
    const b2 = named('B2');
    const db = defaultWeights(b2);
    expect(formIsInvariant(b2, matrixOf(b2, db.city, db.road)).invariant).toBe(false);
    // Page weights in label order and by pairs of labels.
    expect(initialWeights(b2, [4, 2], [{ pair: [2, 1], weight: 4 }])).toEqual({ city: [4, 2], road: [4] });
    // matrixOf is symmetric and integer with -w_ij off the diagonal.
    expect(matrixOf(b2, [4, 2], [4])).toEqual([
      [8, -4],
      [-4, 4],
    ]);
  });

  it('least nonzero form value in the box [-2,2]^n is 2, attained exactly at the short roots', () => {
    for (const name of ['A2', 'A3', 'B2', 'B3', 'C3', 'D4', 'G2', 'F4']) {
      const board = named(name);
      const R = roots(board, CAPS.mainThreadItems);
      expect(R.truncated).toBe(false);
      const short = new Set(R.items.filter((r) => ratToString(formValue(board, r)!) === '2').map((r) => r.join(',')));
      expect(short.size).toBeGreaterThan(0);
      let least: bigint | null = null;
      const atTwo = new Set<string>();
      const shortInBox = new Set([...short].filter((k) => k.split(',').every((x) => Math.abs(Number(x)) <= 2)));
      const p = Array.from({ length: board.n }, () => -2);
      for (;;) {
        if (p.some((x) => x !== 0)) {
          const v = formValue(board, p)!;
          expect(v.den).toBe(1n);
          if (least === null || v.num < least) least = v.num;
          if (v.num === 2n) atTwo.add(p.join(','));
        }
        let k = 0;
        while (k < board.n && p[k] === 2) p[k++] = -2;
        if (k === board.n) break;
        p[k]!++;
      }
      expect(least, name).toBe(2n);
      expect([...atTwo].sort(), name).toEqual([...shortInBox].sort());
    }
  });

  it('the frozen population has form value 0', () => {
    for (const name of TYPE_NAMES) {
      const rec = golden.affine[name]!;
      const board = boardFromName(rec.constructor_name);
      expect(board.n).toBeLessThanOrEqual(9);
      const delta = byPosition(board, rec.marks);
      expect(formText(board, delta), rec.constructor_name).toBe('0');
      // Every mutation leaves it where it is, and the meter model reads 0 for it.
      expect(meterModel(undefined, null, { board, population: rec.marks.map(String) }).value).toBe('0');
    }
  });

  it('isRootPopulation returns null past the cap and the tool shows the fixed string', () => {
    const board = boardFromName('A2~');
    expect([...board.labels].sort()).toEqual([0, 1, 2]);
    const row = (k: number): string[] => [String(k + 1), String(k), String(k)];
    expect(isRootPopulation(board, byPosition(board, row(9000)) as never)).toBe(true);
    expect(isRootPopulation(board, byPosition(board, row(11000)) as never)).toBeNull();
    expect(judgeRow(board, row(9000))).toEqual({ complete: true, value: '2', verdict: 'root population' });
    expect(judgeRow(board, row(11000))).toEqual({ complete: true, value: '2', verdict: 'too large to test here' });
    expect(verdictText(null)).toBe('too large to test here');
    expect(verdictText(false)).toBe('not a root population');
    expect(verdictText(true)).toBe('root population');
    // The default cap is the engine's, never a larger one.
    expect(CAPS.rootTestSteps).toBe(20000);
    // Mixed signs and zero are judged at once as not root populations.
    expect(judgeRow(named('A3'), ['1', '-1', '0']).verdict).toBe('not a root population');
    expect(judgeRow(named('A3'), ['0', '0', '0'])).toEqual({ complete: true, value: '0', verdict: 'not a root population' });
    expect(judgeRow(named('A3'), ['1', '', '0'])).toEqual({ complete: false, value: null, verdict: FORM_TEXT.incomplete });
    // The tailed triangle of M2 beat 5: value 2 and not a root population (F2 is for finite type only).
    const tailed = resolveBoard({
      cartan: [
        [2, -1, -1, 0, 0],
        [-1, 2, -1, 0, 0],
        [-1, -1, 2, -1, 0],
        [0, 0, -1, 2, -1],
        [0, 0, 0, -1, 2],
      ],
    });
    expect(judgeRow(tailed, ['1', '1', '1', '0', '1'])).toEqual({ complete: true, value: '2', verdict: 'not a root population' });
  });

  it('capped root test timing is measured', () => {
    const board = boardFromName('A2~');
    const v = byPosition(board, ['11001', '11000', '11000']);
    const times: number[] = [];
    for (let k = 0; k < 7; k++) {
      const t0 = performance.now();
      expect(isRootPopulation(board, v as never)).toBeNull();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[3]!;
    // Recorded, not asserted (instruction 5.10): the 50 ms rule of SPEC 7.6 is about the phone.
    process.stdout.write(
      `[T03 timing] capped root test on A2~ (k = 11000, ${CAPS.rootTestSteps} steps): median ${median.toFixed(1)} ms of 7 runs ` +
        `(${times.map((t) => t.toFixed(1)).join(', ')}); four times the median ${(4 * median).toFixed(1)} ms; node ${process.version}, ${process.platform} ${process.arch}\n`,
    );
    expect(times).toHaveLength(7);
  });

  it('the six-digit rule', () => {
    expect(MAX_DIGITS).toBe(CAPS.formFinderDigits);
    expect(entryAllowed('123456')).toBe(true);
    expect(entryAllowed('1234567')).toBe(false);
    expect(entryAllowed('-123456')).toBe(true);
    expect(entryAllowed('−123456')).toBe(true);
    expect(entryAllowed('-1234567')).toBe(false);
    expect(entryAllowed('12a')).toBe(false);
    expect(entryAllowed('1-2')).toBe(false);
    expect(entryAllowed('')).toBe(true);
    expect(entryAllowed('-')).toBe(true);
    // Typed one key at a time: the seventh digit is refused and the field keeps six.
    let text = '';
    let refusals = 0;
    for (const ch of '1234567') {
      const r = offerEntry(text, text + ch);
      text = r.text;
      if (r.refused) refusals++;
    }
    expect(text).toBe('123456');
    expect(refusals).toBe(1);
    // Pasted at once: refused whole, the field keeps what it had.
    expect(offerEntry('12', '1234567')).toEqual({ text: '12', refused: true });
    expect(offerEntry('', 'abc')).toEqual({ text: '', refused: true });
    expect(offerEntry('', '−5')).toEqual({ text: '-5', refused: false });
    expect(entryValue('-12')).toBe(-12);
    expect(entryValue('-')).toBeNull();
    expect(entryValue('')).toBeNull();
    expect(entryValue('-0')).toBe(0);
    expect(digitNotice(2, 1, '123456')).toContain(`at most ${CAPS.formFinderDigits} digits`);
  });

  it('labels on an affine board', () => {
    const board = boardFromName('A2~');
    const pairs = joinedPairs(board);
    expect(pairs.flatMap((p) => p.labels).sort()).toEqual([0, 0, 1, 1, 2, 2]);
    const w = defaultWeights(board);
    w.city[0]! += 1;
    const r = formIsInvariant(board, matrixOf(board, w.city, w.road));
    expect(r.invariant).toBe(false);
    const view = witnessView(board, r)!;
    // The witness city is the label of the engine's position (toLabels, never + 1).
    expect(view.city).toBe(board.labels[r.witness!.node]);
    expect([0, 1, 2]).toContain(view.city);
    expect(witnessSentence(view)).toContain(`city ${view.city}`);
  });

  it('the linked meter follows the T1 state and does not move', () => {
    clearPublishedStates();
    const t1: ToolState = { schema: 1, tool: 'board', board: 'A3', view: 'linked', mode: 'free', coords: 'populations', start: [1, 0, 0], moves: [] };
    let followed: ToolState | null = null;
    const stop = followToolState('b1', (s) => {
      followed = s;
    });
    // The T3's own configured state differs (value 4), so a meter reading its own state would show 4.
    const own = { board: named('A3'), population: ['1', '0', '1'] };
    expect(meterModel('b1', null, own).value).toBe('4');
    expect(meterModel('b1', null, own).ownBoard).toBe(false);
    const word = [1, 2, 3];
    for (let k = 0; k <= word.length; k++) {
      publishToolState('b1', { ...t1, moves: word.slice(0, k) });
      expect(followed).not.toBeNull();
      const m = meterModel('b1', followed, own);
      const all = positionsOf(followed!);
      expect(m.population).toEqual(all[all.length - 1]!.map(String));
      expect(m.value, `after ${k} moves`).toBe('2');
      expect(m.ownBoard).toBe(false);
    }
    // After mutating cities 1, 2, 3 from (1, 0, 0) the T1 stands at (-1, -1, -1), and the meter still reads 2.
    expect(meterModel('b1', followed, own).population).toEqual(['-1', '-1', '-1']);
    // Without linkTo the meter reads its own board and draws it.
    expect(meterModel(undefined, followed, own)).toMatchObject({ value: '4', ownBoard: true });
    // A numbers start cannot be read as a population.
    publishToolState('b1', { ...t1, coords: 'numbers', start: [1, 1, 1] });
    expect(meterModel('b1', followed, own)).toMatchObject({ value: null, message: FORM_TEXT.numbersLink });
    stop();
    clearPublishedStates();
  });

  it('presets are state objects and links; default rows', () => {
    expect(Object.keys(T03.presets).sort()).toEqual(['builder', 'default', 'meter', 'small-values']);
    for (const [id, p] of Object.entries(FORM_PRESETS)) {
      expect(T03.presets[id as keyof typeof T03.presets]!.caption).toBe(p.caption);
      expect(p.caption).not.toMatch(/\u2014/);
      const link = encodeState(p.state);
      expect(link).toMatch(/^z=1&g=A[23]&c=p&s=1,0(,0)?&w=$/);
    }
    expect(T03.boards).toBe('all');
    expect(partsInOrder('builder')).toEqual(['builder', 'meter', 'small-values']);
    expect(defaultRows(named('A3'))).toEqual([
      ['1', '0', '0'],
      ['1', '1', '1'],
      ['1', '0', '1'],
    ]);
    const judged = defaultRows(named('A3')).map((r) => judgeRow(named('A3'), r));
    expect(judged.map((j) => [j.value, j.verdict])).toEqual([
      ['2', 'root population'],
      ['2', 'root population'],
      ['4', 'not a root population'],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Server render
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
    cacheDir: join(tmpdir(), 'two-games-ssr-test-cache-t03-' + checkoutKey()),
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
  Component = ((await server.ssrLoadModule('/src/components/tools/T03FormFinder.svelte')) as { default: unknown }).default;
}, 60000);

afterAll(async () => {
  await server?.close();
});

function render(props: Record<string, unknown>): string {
  return renderFn(Component, { props: { id: '', caption: 'A test caption.', ...props } }).body;
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

describe('T3 server render', () => {
  it('the default state renders the board, the meter, the builder and the judged rows', () => {
    const body = render({ preset: 'default' });
    expect(body).toContain('data-tool="form"');
    expect(outs(body, 'formValue')).toEqual(['2']);
    const nodes = tags(body, 'button').filter((t) => attr(t, 'data-node') !== null);
    expect(nodes.map((t) => attr(t, 'data-value'))).toEqual(['1', '0', '0']);
    expect(nodes.every((t) => attr(t, 'data-board') === 'populations' && attr(t, 'data-can-act') === 'true')).toBe(true);
    expect(outs(body, 'smallValue')).toEqual(['2', '2', '4']);
    expect(outs(body, 'smallVerdict')).toEqual(['root population', 'root population', 'not a root population']);
    // Every control is disabled until hydration (7.4): inputs, Test, Add a row.
    const controls = [...tags(body, 'input'), ...tags(body, 'button'), ...tags(body, 'select')];
    expect(controls.length).toBeGreaterThan(20);
    for (const t of controls) expect(attr(t, 'disabled'), t).not.toBeNull();
    expect(tags(body, 'button').some((t) => attr(t, 'data-control') === 'test')).toBe(true);
    expect(outs(body, 'testVerdict')).toEqual([FORM_TEXTS_UNTESTED]);
    expect(outs(body, 'witness')).toEqual(['']);
    // Three city weights and two road weights on A3, each a slider and a number field.
    expect(tags(body, 'input').filter((t) => attr(t, 'data-weight') !== null)).toHaveLength(10);
  });

  it('presets put their part first and set their board', () => {
    const builder = render({ preset: 'builder' });
    expect(tags(builder, 'button').filter((t) => attr(t, 'data-node') !== null)).toHaveLength(2);
    const parts = tags(builder, 'div').map((t) => attr(t, 'data-part')).filter((x) => x !== null);
    expect(parts).toEqual(['builder', 'meter', 'small-values']);
    const small = render({ preset: 'small-values' });
    expect(tags(small, 'div').map((t) => attr(t, 'data-part')).filter((x) => x !== null)[0]).toBe('small-values');
  });

  it('labels on an affine board: fields and weights start at city 0', () => {
    const body = render({ board: 'A2~' });
    const nodes = tags(body, 'button').filter((t) => attr(t, 'data-node') !== null);
    expect(nodes.map((t) => attr(t, 'data-node')).sort()).toEqual(['0', '1', '2']);
    expect(body).toMatch(/aria-label="City 0 in row 1"/);
    expect(body).toMatch(/City 0 weight/);
    expect(body).not.toMatch(/City 3 weight/);
  });

  it('a one-way board says it has no invariant form', () => {
    const body = render({ board: { cartan: [[2, 0], [-1, 2]] } });
    expect(outs(body, 'formValue')).toEqual([FORM_TEXT.noForm]);
    expect(outs(body, 'smallVerdict')[0]).toBe(FORM_TEXT.needsTwoWay);
  });

  it('with linkTo the tool draws no board of its own', () => {
    const body = render({ linkTo: 'b1', preset: 'meter', board: 'A3', start: [1, 0, 0] });
    expect(tags(body, 'button').filter((t) => attr(t, 'data-node') !== null)).toHaveLength(0);
    expect(outs(body, 'formValue')).toEqual(['2']);
  });

  it('page weights and rows are applied', () => {
    const body = render({ board: 'B2', cityWeights: [4, 2], roadWeights: [{ pair: [1, 2], weight: 4 }], populations: [[1, 1], [0, 0]] });
    const nums = tags(body, 'input').filter((t) => attr(t, 'type') === 'number');
    expect(nums.map((t) => attr(t, 'value'))).toEqual(['4', '2', '4']);
    expect(outs(body, 'smallValue')).toEqual(['2', '0']);
  });
});

const FORM_TEXTS_UNTESTED = 'Press Test to ask the engine about these weights.';

describe('regressions', () => {
  // SPEC 7.4: "While a tool runs it keeps the list of positions of the current play in memory and
  // extends it by one position per move, so a move costs one engine call however long the play is."
  // The linked meter replayed the whole followed play (positionsOf) on every state the T1 published.
  // A position kept from the play held is the same array object; a replay would build a new one.
  // regression: P3-RT-04-04
  it('the linked meter extends the followed play instead of replaying it from the start', () => {
    const t1: ToolState = { schema: 1, tool: 'board', board: 'A3', view: 'linked', mode: 'free', coords: 'populations', start: [1, 0, 0], moves: [] };
    const own = { board: named('A3'), population: ['1', '0', '1'] };
    const long = Array.from({ length: 20000 }, (_, k) => (k % 3) + 1);
    const reading = (m: { population: string[]; value: string | null }) => ({ population: m.population, value: m.value });
    const held = followPlay(null, { ...t1, moves: long });
    expect(held.positions).toHaveLength(long.length + 1);
    expect(reading(meterModel('b1', held.state, own, held))).toEqual(reading(meterModel('b1', held.state, own)));
    // One more move: every position held is kept, the board is not resolved again, one position is added.
    const next = followPlay(held, { ...t1, moves: [...long, 2] });
    expect(next.board).toBe(held.board);
    expect(next.positions).toHaveLength(long.length + 2);
    for (const k of [0, 1, 9999, long.length]) expect(next.positions[k]).toBe(held.positions[k]);
    const all = positionsOf(next.state);
    expect(meterModel('b1', next.state, own, next).population).toEqual(all[all.length - 1]!.map(String));
    // An undo keeps the positions and computes none.
    const undo = followPlay(next, { ...t1, moves: long });
    expect(undo.positions).toHaveLength(long.length + 1);
    expect(undo.positions[long.length]).toBe(held.positions[long.length]);
    // Another start is a load.
    const other = followPlay(undo, { ...t1, start: [0, 1, 0], moves: [1] });
    expect(other.positions).toHaveLength(2);
    expect(meterModel('b1', other.state, own, other).population).toEqual(positionsOf(other.state)[1]!.map(String));
    // A move that leaves the safe range is replayed with Big, as positionsOf does.
    const max = Number.MAX_SAFE_INTEGER;
    const near = followPlay(null, { ...t1, start: [max, 0, max], moves: [] });
    const over = followPlay(near, { ...t1, start: [max, 0, max], moves: [2] });
    expect(meterModel('b1', over.state, own, over).population).toEqual(positionsOf(over.state)[1]!.map(String));
    expect(meterModel('b1', over.state, own, over).population).toEqual([String(max), String(2n * BigInt(max)), String(max)]);
  });
});
