// P2-A5: tool T16, the Sandbox (SPEC 4 T16 Acceptance, 4.0, 4 T1, 4 T4, 5.1 E-2, E-7, 5.6, 6.6), at the
// level of the engine and the site libraries, and through the sandbox's own pure functions (the
// <script module> of T16Sandbox.svelte and T16BoardIO.svelte, loaded through the Vite SSR loader of
// _svelteSsr.ts, since the roster gives T16 no .ts helper). Golden values are read from
// reference/golden_data.json and never typed; the numbers in test names are for the reader only. No
// covers() call: bigint_test is a phase-1 golden key tested once in the engine's golden suite
// (CONTRACTS 3); this file proves the tool-level criterion.
//
// Properties T16Sandbox.svelte accepts (SPEC 4.0 Configuration: "Property names beyond these are the
// builder's choice and are listed in the tool's test file"):
//   common (4.0, CONTRACTS 5.2): id, board, coords, start, moves, linkTo (accepted, unused), preset
//     (only 'default'), caption
//   T1's, passed through:        view ('populations' | 'numbers' | 'linked'), mode (only 'free'; any
//                                other mode throws at build time, naming the instance)
//   plan addition:               boardPresets: EditorPreset[] (the test boards of classification_tests
//                                for the editor's picker; testBoardPresets() at build time)
//   not accepted:                prediction, layers (they do not apply to free play on a sandbox)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Big,
  EngineOverflow,
  SafeInt,
  applyWord,
  mutate,
  fire,
  ratToString,
  toPopulation,
  toPositions,
} from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import golden from '../../../../reference/golden_data.json';
import { resolveBoard, type BoardSpec, type ToolState } from '../../../src/lib/state';
import { LINK_NOTICE, decodeState, encodeState } from '../../../src/lib/urlCodec';
import { exportJSON } from '../../../src/lib/export';
import { shortValue } from '../../../src/components/tools/t01/longNumber';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';

interface BigintTest {
  cartan: number[][];
  population_start: number[];
  mutation_nodes: number[];
  population_end: string[];
  numbers_start: number[];
  firing_nodes: number[];
  firing_mode: string;
  numbers_end: string[];
  first_move_after_which_an_entry_exceeds_2_to_53: number;
}
const G = (golden as unknown as { bigint_test: BigintTest }).bigint_test;
const TWO_53 = 2n ** 53n;

/** The exports of T16Sandbox.svelte's module script (one module instance, through the SSR loader). */
interface SandboxModule {
  default: unknown;
  DEFAULT_BOARD: { cartan: number[][]; xy: [number, number][] };
  sandboxDefaults(config?: Record<string, unknown>, instanceId?: string): ToolState;
  readLink(search: string, defaults: ToolState, prefix?: string): { state: ToolState; notice: string | null };
  withBoard(state: ToolState, spec: BoardSpec): ToolState;
  normaliseView(state: ToolState): ToolState;
  viewChoices(state: ToolState): Record<'populations' | 'numbers' | 'linked', boolean>;
  exportOf(state: ToolState): string;
  sameMatrix(a: BoardSpec, b: BoardSpec): boolean;
}
interface BoardIOModule {
  parseBoardImport(text: string): { ok: true; spec: BoardSpec; nodes: number } | { ok: false; reason: string };
  boardObject(spec: BoardSpec): { cartan: number[][]; xy: [number, number][] };
  boardJsonText(spec: BoardSpec): string;
}

let ssr: SsrLoader;
let S: SandboxModule;
let IO: BoardIOModule;

beforeAll(async () => {
  ssr = await ssrLoader();
  S = await ssr.load<SandboxModule>('/src/components/tools/T16Sandbox.svelte');
  IO = await ssr.load<BoardIOModule>('/src/components/tools/T16BoardIO.svelte');
}, 120000);
afterAll(async () => {
  await ssr?.close();
});

const show = (board: AnyBoard, v: readonly unknown[]): string[] => v.map((x) => (board as Board<unknown>).arith.show(x));
const absBig = (x: bigint): bigint => (x < 0n ? -x : x);

/** The two 200-move states of bigint_test as sandbox states (two single-view links, trap of 9). */
function mutationState(): ToolState {
  return { schema: 1, tool: 'sandbox', board: { cartan: G.cartan }, view: 'populations', mode: 'free', coords: 'populations', start: [...G.population_start], moves: [...G.mutation_nodes] };
}
function firingState(): ToolState {
  return { schema: 1, tool: 'sandbox', board: { cartan: G.cartan }, view: 'numbers', mode: 'free', coords: 'numbers', start: [...G.numbers_start], moves: [...G.firing_nodes] };
}

describe('bigint_test (SPEC 4 T16 acceptance)', () => {
  it('the mutation sequence of bigint_test ends at population_end', () => {
    const board = resolveBoard({ cartan: G.cartan });
    expect(board.arith).toBe(Big);
    const word = toPositions(board, G.mutation_nodes);
    const end = applyWord(board as Board<bigint>, G.population_start.map(BigInt), word, 'mutation');
    for (const x of end) expect(typeof x).toBe('bigint');
    expect(show(board, end)).toEqual(G.population_end);
  });

  it('the firing sequence of bigint_test ends at numbers_end', () => {
    const board = resolveBoard({ cartan: G.cartan });
    expect(board.arith).toBe(Big);
    expect(G.firing_mode).toBe('free play');
    const word = toPositions(board, G.firing_nodes);
    const end = applyWord(board as Board<bigint>, G.numbers_start.map(BigInt), word, 'firing');
    for (const x of end) expect(typeof x).toBe('bigint');
    expect(show(board, end)).toEqual(G.numbers_end);
  });

  it('the first entry beyond 2^53 appears after the recorded move', () => {
    const recorded = G.first_move_after_which_an_entry_exceeds_2_to_53;
    // Along the mutation sequence, where the golden key is computed.
    const board = resolveBoard({ cartan: G.cartan }) as Board<bigint>;
    let p: bigint[] = G.population_start.map(BigInt);
    let first: number | null = null;
    G.mutation_nodes.forEach((label, k) => {
      p = mutate(board, p, toPositions(board, [label])[0]!);
      if (first === null && p.some((x) => absBig(x) > TWO_53)) first = k + 1;
      if (k + 1 === recorded - 1) expect(p.every((x) => absBig(x) <= TWO_53)).toBe(true);
      if (k + 1 === recorded) expect(p.some((x) => absBig(x) > TWO_53)).toBe(true);
    });
    expect(first).toBe(recorded);
    // Plan addition, not recorded by SPEC or the golden file: the same holds along the firing sequence.
    let a: bigint[] = G.numbers_start.map(BigInt);
    let firstFiring: number | null = null;
    G.firing_nodes.forEach((label, k) => {
      a = fire(board, a, toPositions(board, [label])[0]!);
      if (firstFiring === null && a.some((x) => absBig(x) > TWO_53)) firstFiring = k + 1;
    });
    expect(firstFiring).toBe(recorded);
  });

  it('a SafeInt board overflows where Big does not', () => {
    const recorded = G.first_move_after_which_an_entry_exceeds_2_to_53;
    const safe: Board<number> = { n: 2, cartan: G.cartan, labels: [1, 2], kind: 'gcm', arith: SafeInt };
    let p: number[] = [...G.population_start];
    let threwAt: number | null = null;
    for (let k = 0; k < G.mutation_nodes.length; k++) {
      try {
        p = mutate(safe, p, toPositions(safe, [G.mutation_nodes[k]!])[0]!);
      } catch (e) {
        expect(e).toBeInstanceOf(EngineOverflow);
        threwAt = k + 1;
        break;
      }
    }
    expect(threwAt).not.toBeNull();
    expect(threwAt!).toBeLessThanOrEqual(recorded);
    // The sandbox's board of the same matrix is Big and plays all 200 moves.
    expect(resolveBoard({ cartan: G.cartan }).arith).toBe(Big);
    expect(resolveBoard(S.DEFAULT_BOARD).arith).toBe(Big);
    expect(resolveBoard({ cartan: [[2, -1, 0], [-1, 2, -1], [0, -1, 2]] }).arith).toBe(Big);
  });
});

describe('long numbers (SPEC 4.0)', () => {
  /** The expected shortened text, built from a golden string: first digit, point, four digits, "... x 10^", count. */
  function expected(text: string): string {
    const negative = text.startsWith('-');
    const d = text.replace(/^-/, '');
    return `${negative ? '−' : ''}${d[0]}.${d.slice(1, 5)}... x 10^${d.length - 1} (${d.length} digits)`;
  }

  it("the long-number formatter on the sandbox's values", () => {
    expect(G.population_end[0]!.length).toBeGreaterThan(12);
    expect(shortValue(G.population_end[0]!)).toBe(expected(G.population_end[0]!));
    expect(shortValue(G.population_end[1]!)).toBe(expected(G.population_end[1]!));
    const neg = shortValue(G.numbers_end[1]!);
    expect(neg).toBe(expected(G.numbers_end[1]!));
    expect(neg.startsWith('−')).toBe(true);
    // 12 digits are shown in full; 13 are shortened.
    expect(shortValue(G.population_end[0]!.slice(0, 12))).toBe(G.population_end[0]!.slice(0, 12));
    expect(shortValue(`-${G.population_end[0]!.slice(0, 12)}`)).toBe(`−${G.population_end[0]!.slice(0, 12)}`);
    expect(shortValue(G.population_end[0]!.slice(0, 13))).toBe(expected(G.population_end[0]!.slice(0, 13)));
  });

  it('the data export of the 200-move states holds the exact digits', () => {
    for (const [state, end] of [
      [mutationState(), G.population_end],
      [firingState(), G.numbers_end],
    ] as const) {
      const text = S.exportOf(state);
      expect(text).not.toContain('...');
      expect(text).not.toContain('x 10^');
      const doc = JSON.parse(text) as { tool: string; state: ToolState; derived: { positions: Record<string, (number | string)[]>[]; verdict: { class: string }[] } };
      expect(doc.tool).toBe('sandbox');
      expect(doc.state.moves).toHaveLength(200);
      expect(doc.state.start).toEqual([1, 0]);
      const positions = doc.derived.positions;
      expect(positions).toHaveLength(201);
      const last = positions[positions.length - 1]!;
      const values = (state.coords === 'populations' ? last.populations : last.numbers)!;
      expect(values).toEqual(end);
      for (const v of values) expect(typeof v === 'string' && v.replace(/^-/, '').length).toBe(end[0]!.length);
      expect(doc.derived.verdict.map((r) => r.class)).toEqual(['indefinite']);
    }
    // exportJSON itself writes bigint as decimal text (the rule the sandbox relies on).
    expect(JSON.parse(exportJSON(mutationState(), { x: BigInt(G.population_end[0]!) })).derived.x).toBe(G.population_end[0]);
  });
});

describe('fractions and the view fallback (SPEC 4 T1)', () => {
  it('populations from a numbers start are exact fractions', () => {
    const a2 = resolveBoard('A2');
    expect(toPopulation(a2 as Board<number>, [1, 0])!.map(ratToString)).toEqual(['2/3', '1/3']);
    const d = resolveBoard(S.DEFAULT_BOARD) as Board<bigint>;
    const pop = toPopulation(d, [1n, 0n])!;
    const det = 4n - 9n; // det C = 2*2 - (-3)(-3), SPEC 2.6: denominators divide det C
    for (const r of pop) {
      expect(ratToString(r)).toMatch(/^-?\d+\/\d+$/);
      expect(absBig(det) % r.den).toBe(0n);
    }
  });

  it('a populations view from a fractional numbers start falls back to linked', () => {
    const defaults = S.sandboxDefaults();
    const r = S.readLink('?z=1&g=c:2,-3;-3,2&v=p&m=f&c=n&s=1,0', defaults);
    expect(r.notice).toBeNull();
    expect(r.state.view).toBe('linked');
    expect(S.viewChoices(r.state).populations).toBe(false);
    const a2 = S.readLink('?z=1&g=A2&v=p&m=f&c=n&s=1,0', defaults);
    expect(a2.state.view).toBe('linked');
    // A numbers start whose C^{-1} a is integral keeps the populations view.
    const integral = toPopulation(resolveBoard(S.DEFAULT_BOARD) as Board<bigint>, [2n, -3n])!;
    expect(integral.every((q) => q.den === 1n)).toBe(true);
    const kept = S.readLink('?z=1&g=c:2,-3;-3,2&v=p&m=f&c=n&s=2,-3', defaults);
    expect(kept.notice).toBeNull();
    expect(kept.state.view).toBe('populations');
    expect(S.viewChoices(kept.state)).toEqual({ populations: true, numbers: true, linked: true });
    // On a singular (affine) board a numbers start offers only the numbers view.
    const affine = S.readLink('?z=1&g=A2~&v=l&m=f&c=n&s=1,1,1', defaults);
    expect(affine.state.view).toBe('numbers');
    expect(S.viewChoices(affine.state)).toEqual({ populations: false, numbers: true, linked: false });
  });
});

describe('board import and export (SPEC 4 T16)', () => {
  it('board import and export round trip', () => {
    const exported = JSON.parse(IO.boardJsonText(S.DEFAULT_BOARD)) as { cartan: number[][]; xy: number[][] };
    expect(exported).toEqual({ cartan: S.DEFAULT_BOARD.cartan, xy: S.DEFAULT_BOARD.xy });
    const back = IO.parseBoardImport(IO.boardJsonText(S.DEFAULT_BOARD));
    expect(back).toEqual({ ok: true, spec: { cartan: S.DEFAULT_BOARD.cartan, xy: S.DEFAULT_BOARD.xy }, nodes: 2 });
    // A name, a bare object, a state object and a data export.
    expect(IO.parseBoardImport('"A3"')).toEqual({ ok: true, spec: 'A3', nodes: 3 });
    expect(IO.parseBoardImport('{"cartan": [[2, -3], [-3, 2]]}')).toEqual({ ok: true, spec: { cartan: G.cartan }, nodes: 2 });
    expect(IO.parseBoardImport(JSON.stringify(mutationState()))).toMatchObject({ ok: true, spec: { cartan: G.cartan } });
    const dataExport = S.exportOf(mutationState());
    expect(IO.parseBoardImport(dataExport)).toMatchObject({ ok: true, spec: { cartan: G.cartan }, nodes: 2 });
    // A named board exports as its matrix with whole grid points.
    const a3 = IO.boardObject('A3');
    expect(a3.cartan).toEqual([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]);
    expect(a3.xy).toEqual([[0, 0], [1, 0], [2, 0]]);
    // Refused, each with a reason (the board stays as it was: the parser never returns a spec).
    const thirteen = Array.from({ length: 13 }, (_, i) => Array.from({ length: 13 }, (_, j) => (i === j ? 2 : 0)));
    for (const bad of [
      '{"cartan": [[2, -3], [-3, 1]]}',
      '{"cartan": [[2, 1], [-1, 2]]}',
      JSON.stringify({ cartan: thirteen }),
      '{"cartan": [[2, -1], [-1]]}',
      '{"cartan": [[2, -1], [-1, 2]], "xy": [[0, 0]]}',
      '{"cartan": [[2, -1.5], [-1, 2]]}',
      '"Q7"',
      'not json at all',
      '[]',
    ]) {
      const r = IO.parseBoardImport(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.reason.length, bad).toBeGreaterThan(0);
    }
  });
});

describe('links (SPEC 6.6)', () => {
  it('the 200-move links round-trip through the codec', () => {
    const defaults = S.sandboxDefaults();
    for (const state of [mutationState(), firingState()]) {
      const query = encodeState(state);
      expect(query).toContain(`w=${state.moves!.join('.')}`);
      expect(query).toContain('s=1,0');
      const r = S.readLink(`?${query}`, defaults);
      expect(r.notice).toBeNull();
      expect(r.state).toEqual(state);
      expect(decodeState(`?${query}`, 'sandbox', defaults)).toEqual({ state, notice: null });
    }
    // 20001 moves, and a mode the sandbox does not offer, give the defaults with the notice.
    const tooMany = S.readLink(`?z=1&g=c:2,-3;-3,2&v=p&m=f&c=p&s=1,0&w=${Array.from({ length: 20001 }, (_, k) => (k % 2) + 1).join('.')}`, defaults);
    expect(tooMany).toEqual({ state: defaults, notice: LINK_NOTICE });
    for (const q of ['?m=l', '?v=n&m=l', '?v=l&m=r']) {
      // The codec accepts the pair (T1's table allows it); the sandbox refuses the mode (plan 5.2 case (b)).
      expect(S.readLink(q, defaults), q).toEqual({ state: defaults, notice: LINK_NOTICE });
    }
    expect(decodeState('?v=n&m=l', 'sandbox', defaults).notice).toBeNull();
  });

  it('links that cannot be read load the default with the notice', () => {
    const defaults = S.sandboxDefaults();
    const thirteen = Array.from({ length: 13 }, (_, i) => Array.from({ length: 13 }, (_, j) => (i === j ? 2 : 0)).join(',')).join(';');
    const longG = `c:${'2,'.repeat(255)}2`;
    expect(longG.length).toBe(513);
    const cases = [
      'g=c:2,-3;-3',
      'g=c:2,1;-1,2',
      `g=c:${thirteen}`,
      `g=${longG}`,
      `c=p&s=${'1'.repeat(41)},0`,
      's=1,0',
      'c=p&s=1,0,0',
      'w=3',
      'v=p&m=l',
      'z=2',
      'v=x',
      'w=1..2',
      'g=c:2,-3.5;-3,2',
    ];
    for (const q of cases) expect(S.readLink(`?${q}`, defaults), q).toEqual({ state: defaults, notice: LINK_NOTICE });
    // 40 digits are within the cap (6.6 counts digits without the sign).
    expect(S.readLink(`?c=p&s=${'9'.repeat(40)},0`, defaults).notice).toBeNull();
  });

  it("the codec's reading rules on the sandbox route", () => {
    const defaults = S.sandboxDefaults();
    expect(defaults).toEqual({
      schema: 1,
      tool: 'sandbox',
      board: S.DEFAULT_BOARD,
      view: 'populations',
      mode: 'free',
      coords: 'populations',
      start: [1, 0],
      moves: [],
    });
    expect(S.readLink('?foo=1', defaults)).toEqual({ state: defaults, notice: null });
    // Without z: schema 1.
    for (const state of [mutationState(), firingState()]) {
      const query = encodeState(state).replace(/^z=1&/, '');
      expect(query.startsWith('g=')).toBe(true);
      expect(S.readLink(`?${query}`, defaults)).toEqual({ state, notice: null });
    }
    const a3 = S.readLink('?g=A3', defaults);
    expect(a3).toEqual({ state: { ...defaults, board: 'A3', start: [1, 0, 0], moves: [] }, notice: null });
    // Repeated coordinates spoil only the layout: the board is loaded with no notice.
    const repeated = S.readLink('?g=c:2,-3;-3,2@0,0;0,0', defaults);
    expect(repeated.notice).toBeNull();
    expect(repeated.state.board).toEqual({ cartan: G.cartan, xy: [[0, 0], [0, 0]] });
  });

  it('every board change resets start and moves', () => {
    const played: ToolState = { ...mutationState(), moves: [2, 1, 2] };
    const a3 = S.withBoard(played, 'A3');
    expect(a3).toMatchObject({ board: 'A3', coords: 'populations', start: [1, 0, 0], moves: [], mode: 'free', tool: 'sandbox' });
    const numbers: ToolState = { ...firingState(), moves: [1, 2] };
    const affine = S.withBoard(numbers, 'A2~');
    expect(affine).toMatchObject({ board: 'A2~', coords: 'numbers', start: [1, 1, 1], moves: [], view: 'numbers' });
    const custom = S.withBoard(numbers, { cartan: [[2, 0], [-1, 2]], xy: [[0, 0], [1, 0]] });
    expect(custom).toMatchObject({ coords: 'numbers', start: [1, 1], moves: [] });
    // A move of a node changes only xy: the matrix is the same (the island keeps the play then).
    expect(S.sameMatrix(S.DEFAULT_BOARD, { cartan: S.DEFAULT_BOARD.cartan, xy: [[3, 3], [4, 3]] })).toBe(true);
    expect(S.sameMatrix(S.DEFAULT_BOARD, { cartan: [[2, -2], [-3, 2]] })).toBe(false);
  });

  it('page-author props are the defaults a link overrides', () => {
    const props = { board: 'A3', view: 'numbers', coords: 'numbers' };
    const defaults = S.sandboxDefaults(props, 'b1');
    expect(defaults).toEqual({ schema: 1, tool: 'sandbox', board: 'A3', view: 'numbers', mode: 'free', coords: 'numbers', start: [1, 1, 1], moves: [] });
    expect(S.readLink('', defaults, 'b1')).toEqual({ state: defaults, notice: null });
    // A key of another instance is ignored; bare keys are not this instance's on a lesson page.
    expect(S.readLink('?b2.v=p&v=p', defaults, 'b1')).toEqual({ state: defaults, notice: null });
    // v=p changes only the view, which the T1 rule then sends to linked (C^{-1}(1,1,1) on A3 is fractional).
    const pop = toPopulation(resolveBoard('A3') as Board<number>, [1, 1, 1])!;
    const expectedView = pop.some((q) => q.den !== 1n) ? 'linked' : 'populations';
    expect(S.readLink('?b1.v=p', defaults, 'b1')).toEqual({ state: { ...defaults, view: expectedView }, notice: null });
    // A link naming g replaces the board and resets start and moves to the defaults for that board.
    expect(S.readLink('?b1.g=A2', defaults, 'b1')).toEqual({ state: { ...defaults, board: 'A2', start: [1, 1], moves: [] }, notice: null });
    // A mode other than free is an authoring error.
    expect(() => S.sandboxDefaults({ mode: 'legal' }, 'b9')).toThrow(/b9/);
  });
});

describe('server render (SPEC 4.0 Works before and without JavaScript)', () => {
  it('renders the default board, the indefinite verdict, values 1 and 0, the table and disabled controls', () => {
    const html = ssr.render(S.default, { id: '', caption: 'The default caption.', preset: 'default' });
    expect(html).toContain('data-tool="sandbox"');
    expect(html).toContain('data-moves="0"');
    expect(html).toMatch(/data-out="verdict"[^>]*>[\s\S]*?<strong>indefinite<\/strong>/);
    expect(html).toMatch(/data-node="1" data-board="populations" data-value="1"/);
    expect(html).toMatch(/data-node="2" data-board="populations" data-value="0"/);
    expect(html).toContain('The default caption.');
    expect(html).toContain('<table');
    expect(html).toContain('data-out="boardJson"');
    expect(html).toContain('data-editor=""');
    expect(html).not.toMatch(/engine\.worker/);
    const controls = html.match(/<(button|select|input|textarea)\b[^>]*>/g) ?? [];
    expect(controls.length).toBeGreaterThan(10);
    for (const c of controls) expect(c, c).toMatch(/\sdisabled(=|\s|>)/);
  });

  it('renders a one-way board in the roads style with the one-way sentence, and B2 recognised from its shape', () => {
    const oneWay = ssr.render(S.default, { id: 'b1', board: { cartan: [[2, 0], [-1, 2]], xy: [[0, 0], [1, 0]] } });
    expect(oneWay).toContain('has a one-way road: the theory does not apply');
    const styles = [...oneWay.matchAll(/<g class="roads[^"]*" data-road-style="([a-z]+)"/g)].map((m) => m[1]);
    expect(styles.length).toBeGreaterThan(0);
    for (const s of styles) expect(s).toBe('roads');
    const b2 = ssr.render(S.default, { id: 'b1', board: { cartan: [[2, -1], [-2, 2]] } });
    expect(b2).toMatch(/data-out="verdict" data-tex="B_2=C_2"/);
    expect(b2).toContain('<math');
    const named = ssr.render(S.default, { id: 'b1', board: 'C2' });
    expect(named).toMatch(/data-out="verdict" data-tex="C_\{2\}"/);
    expect(named).not.toContain('B_2=C_2');
  });
});
