// P1-A7: tool T9, Kostant's Game (SPEC.md 4 T9, 2.7 F13, 2.12, 2.16, Appendix A.4). The G1 acceptance
// over every type and every starting node, through the pure functions of
// site/src/components/tools/t09/kostant.ts, the plan tests of the instruction (section 5.12), and the
// server render of T09Kostant.svelte. Golden values are read from reference/golden_data.json, never
// typed. This file calls no covers(): the three kostant keys belong to P1-A1's p1-kostant.test.ts
// (CONTRACTS 3, "a golden key is tested in exactly one file"). Random cases use a fixed seed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

/** A short key of this checkout, so that concurrent worktrees never share a compile cache (MERGE, P2 stage 2.1). */
function checkoutKey(): string {
  return createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8);
}
import { join } from 'node:path';
import { CAPS, EngineOverflow, boardFromName, kostantPlay, raisingNodes, raisingPlay, toNumbers } from '@engine';
import type { Board } from '@engine';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import {
  KOSTANT_BOARDS,
  MOOD_SHAPE,
  MOOD_STATE,
  endPanel,
  isNamedFinite,
  kostantSummary,
  moodOfText,
  moods,
  oneMartian,
  pickerGroups,
  playControl,
  playOutcome,
  recipeMatrix,
  startFromLink,
  stepPosition,
} from '../../../src/components/tools/t09/kostant';
import { bigBoard } from '../../../src/lib/state';
import { whereToRun } from '../../../src/lib/worker';
import T09 from '../../../src/tools/registry/T09';

interface KostantRecord {
  end_from_node: number[][];
  moves_from_node: number[];
  final_numbers_from_node: number[][];
}
interface TypeRecord {
  cartan: number[][];
  highest_root: number[];
  highest_short_root?: number[] | null;
  coxeter_number: number;
  n_positive_roots: number;
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, TypeRecord>;
  kostant: Record<string, KostantRecord>;
  affine: Record<string, { cartan_node0_first: number[][] }>;
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

const board = (name: string): Board<number> => boardFromName(name) as Board<number>;
/** One Martian at label k + 1 (label order; labels 1..n on the named types). */
const martian = (n: number, k: number): number[] => Array.from({ length: n }, (_, j) => (j === k ? 1 : 0));
const texts = (v: readonly (number | string)[]): string[] => v.map(String);

describe('T9 gate G1', () => {
  it('kostant: every type and starting node reproduces end_from_node, moves_from_node and final_numbers_from_node', () => {
    expect(TYPE_NAMES).toHaveLength(32);
    let cases = 0;
    for (const name of TYPE_NAMES) {
      const b = board(name);
      const rec = golden.kostant[name]!;
      for (let k = 0; k < b.n; k++) {
        const where = `${name} from city ${k + 1}`;
        const s = kostantSummary(b, martian(b.n, k));
        expect(s.status, where).toBe('ended');
        expect(s.end, where).toEqual(texts(rec.end_from_node[k]!));
        expect(s.moves, where).toBe(rec.moves_from_node[k]);
        expect(s.finalNumbers, where).toEqual(texts(rec.final_numbers_from_node[k]!));
        // The roster's wording: kostantPlay itself reproduces the three lists.
        const r = kostantPlay(b, k);
        expect(r.status, where).toBe('ended');
        expect([...r.position], where).toEqual(rec.end_from_node[k]);
        expect(r.moves, where).toBe(rec.moves_from_node[k]);
        expect(toNumbers(b, r.position), where).toEqual(rec.final_numbers_from_node[k]);
        // ... and kostantSummary returned the same end and move count as that call.
        expect(s.end, where).toEqual(texts(r.position));
        expect(s.moves, where).toBe(r.moves);
        expect(s.word.length, where).toBe(r.word.length);
        cases++;
      }
    }
    expect(cases).toBe(TYPE_NAMES.reduce((acc, n) => acc + golden.types[n]!.cartan.length, 0));
  });
});

describe('T9 end panel', () => {
  it('the end is named', () => {
    for (const name of TYPE_NAMES) {
      const b = board(name);
      const t = golden.types[name]!;
      const simplyLaced = t.highest_short_root === undefined || t.highest_short_root === null;
      for (let k = 0; k < b.n; k++) {
        const s = kostantSummary(b, martian(b.n, k));
        const isHighest = s.end.join(',') === t.highest_root.join(',');
        const isShort = !simplyLaced && s.end.join(',') === t.highest_short_root!.join(',');
        expect(s.name === 'highest root', `${name} ${k + 1}`).toBe(isHighest);
        expect(s.name === 'highest short root', `${name} ${k + 1}`).toBe(isShort);
        expect(s.name, `${name} ${k + 1}: every Kostant play ends at one of the two (F13)`).not.toBeNull();
        if (simplyLaced) expect(s.name).toBe('highest root');
      }
    }
    // A.4 and trap 3: the two numberings of the rank 2 board.
    expect(kostantSummary(board('B2'), [1, 0]).name).toBe('highest root');
    expect(kostantSummary(board('C2'), [1, 0]).name).toBe('highest short root');
    expect(kostantSummary(board('B3'), [0, 0, 1]).name).toBe('highest short root');
    expect(kostantSummary(board('G2'), [1, 0]).name).toBe('highest short root');
    expect(kostantSummary(board('G2'), [0, 1]).name).toBe('highest root');
  });

  it('h minus 2 on simply laced boards', () => {
    for (const name of TYPE_NAMES) {
      const b = board(name);
      const t = golden.types[name]!;
      const letter = name[0]!;
      for (let k = 0; k < b.n; k++) {
        const s = kostantSummary(b, martian(b.n, k));
        expect(s.h, name).toBe(t.coxeter_number);
        if ('ADE'.includes(letter)) {
          expect(s.simplyLaced, name).toBe(true);
          expect(s.moves, `${name} ${k + 1}`).toBe(t.coxeter_number - 2);
        } else {
          expect(s.simplyLaced, name).toBe(false);
        }
      }
    }
    // Trap 4: there the count differs.
    expect(kostantSummary(board('B2'), [1, 0]).moves).toBe(1);
    expect(kostantSummary(board('G2'), [1, 0]).moves).toBe(2);
  });

  it('marked cities are the positive final numbers', () => {
    expect(kostantSummary(board('A3'), [1, 0, 0]).marked).toEqual([1, 3]);
    expect(kostantSummary(board('D4'), [1, 0, 0, 0]).marked).toEqual([2]);
    expect(kostantSummary(board('E8'), martian(8, 0)).marked).toEqual([8]);
    expect(kostantSummary(board('B3'), [1, 0, 0]).marked).toEqual([2]);
    expect(kostantSummary(board('B3'), [0, 0, 1]).marked).toEqual([1]);
    const a1 = kostantSummary(board('A1'), [1]);
    expect(a1.marked).toEqual([1]);
    expect(a1.finalNumbers).toEqual(['2']);
    expect(a1.moves).toBe(0);
    for (const name of TYPE_NAMES) {
      const b = board(name);
      for (let k = 0; k < b.n; k++) {
        const s = kostantSummary(b, martian(b.n, k));
        const positive = s.finalNumbers.flatMap((x, j) => (Number(x) > 0 ? [j + 1] : []));
        expect(s.marked, `${name} ${k + 1}`).toEqual(positive);
        expect(s.marked.length, `${name} ${k + 1}`).toBeGreaterThan(0);
      }
    }
  });

  it('return counts', () => {
    let longStarts = 0;
    for (const name of TYPE_NAMES) {
      const b = board(name);
      for (let k = 0; k < b.n; k++) {
        const s = kostantSummary(b, martian(b.n, k));
        expect(s.returnCounts, `${name} ${k + 1}`).not.toBeNull();
        if (s.simplyLaced) {
          expect(s.returnCounts, `${name} ${k + 1}`).toEqual(s.finalNumbers);
          for (const x of s.finalNumbers) expect(['0', '1', ...(name === 'A1' ? ['2'] : [])]).toContain(x);
        }
        if (s.name === 'highest root') {
          longStarts++;
          expect(recipeMatrix(b, s.finalNumbers, s.returnCounts!), `${name} ${k + 1}`).toEqual(golden.affine[name]!.cartan_node0_first);
        }
      }
    }
    expect(longStarts).toBe(125);
    expect(kostantSummary(board('B2'), [1, 0]).finalNumbers).toEqual(['0', '2']);
    expect(kostantSummary(board('B2'), [1, 0]).returnCounts).toEqual(['0', '1']);
    expect(kostantSummary(board('B3'), [0, 0, 1]).returnCounts).toEqual(['2', '0', '0']);
    expect(kostantSummary(board('C3'), [0, 0, 1]).finalNumbers).toEqual(['2', '0', '0']);
    expect(kostantSummary(board('C3'), [0, 0, 1]).returnCounts).toEqual(['1', '0', '0']);
  });

  it('an end that is neither highest root gets no name and no recipe', () => {
    const b = board('A3');
    const panel = endPanel(b, [2, 2, 2], 0);
    expect(panel.name).toBeNull();
    expect(panel.returnCounts).toBeNull();
    expect(panel.marked).toEqual([1, 3]);
  });
});

describe('T9 moods and moves', () => {
  it('moods follow the sign of Cp', () => {
    expect(moods(board('A3'), [1, 0, 0])).toEqual(['manic', 'unhappy', 'happy']);
    expect(MOOD_STATE).toEqual({ unhappy: 'mutation would raise it', happy: 'mutation would change nothing', manic: 'mutation would lower it' });
    expect(new Set(Object.values(MOOD_SHAPE)).size).toBe(3);
    const rnd = mulberry32(SEED);
    let unhappySeen = 0;
    for (const name of ['A3', 'B3', 'G2', 'E8']) {
      const b = board(name);
      for (let r = 0; r < 100; r++) {
        const p = Array.from({ length: b.n }, () => int(rnd, -4, 4));
        const m = moods(b, p);
        const a = toNumbers(b, p);
        m.forEach((mood, k) => {
          expect(mood === 'unhappy', name).toBe(a[k]! < 0);
          expect(mood === 'manic', name).toBe(a[k]! > 0);
          expect(moodOfText(String(a[k]))).toBe(mood);
        });
        const unhappy = m.flatMap((x, k) => (x === 'unhappy' ? [k] : []));
        expect(unhappy, name).toEqual(raisingNodes(b, p));
        unhappySeen += unhappy.length;
      }
    }
    expect(unhappySeen).toBeGreaterThan(0);
  });

  it('any order of raising moves gives the same end', () => {
    const rnd = mulberry32(SEED + 1);
    const choose = (allowed: readonly number[]): number => allowed[int(rnd, 0, allowed.length - 1)]!;
    let differing = 0;
    for (const name of TYPE_NAMES) {
      const b = board(name);
      const rec = golden.kostant[name]!;
      for (let k = 0; k < b.n; k++) {
        for (let r = 0; r < 4; r++) {
          const play = kostantPlay(b, k, choose);
          // The reader's moves, replayed through the summary, give the golden end and length.
          const s = kostantSummary(b, martian(b.n, k), play.word.map((i) => b.labels[i]!));
          expect(s.end, `${name} ${k + 1}`).toEqual(texts(rec.end_from_node[k]!));
          expect(s.moves, `${name} ${k + 1}`).toBe(rec.moves_from_node[k]);
          if (play.word.join() !== kostantPlay(b, k).word.join()) differing++;
        }
      }
    }
    expect(differing, 'the random orders are not all the lowest-position order').toBeGreaterThan(0);
  });

  it('step takes the lowest unhappy city', () => {
    const steps = (name: string, start: number[]): number[] => {
      const b = board(name);
      let p: readonly number[] = start;
      const out: number[] = [];
      for (;;) {
        const k = stepPosition(b, p);
        if (k === null) return out;
        out.push(b.labels[k]!);
        p = raisingPlay(b, p, () => k, 1).position;
      }
    };
    expect(steps('D4', [1, 0, 0, 0])).toEqual([2, 3, 4, 2]);
    expect(steps('A3', [1, 0, 0])).toEqual([2, 3]);
    expect(steps('B3', [1, 0, 0])).toEqual([2, 3, 2]);
    expect(steps('B3', [0, 0, 1])).toEqual([2, 1]);
    expect(kostantSummary(board('D4'), [1, 0, 0, 0]).word).toEqual([2, 3, 4, 2]);
  });

  it('every call stays on the main thread', () => {
    for (const name of TYPE_NAMES) {
      const b = board(name);
      expect(isNamedFinite(b), name).toBe(true);
      expect(whereToRun({ board: b, kind: 'play', moves: golden.types[name]!.n_positive_roots, finiteKnown: true }), name).toBe('main');
    }
    expect(whereToRun({ board: board('E8'), kind: 'play', moves: 28, finiteKnown: true })).toBe('main');
    const source = readFileSync(fileURLToPath(new URL('../../../src/components/tools/T09Kostant.svelte', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/engineCall|lib\/worker/);
  });

  it('the default state is the M1 configuration and is deterministic', () => {
    expect(T09.number).toBe(9);
    expect(T09.id).toBe('kostant');
    expect(T09.boards).toEqual(TYPE_NAMES);
    const { caption, ...state } = T09.presets.default;
    expect(state).toEqual({ board: 'A3', coords: 'populations', start: [1, 0, 0], moves: [] });
    expect(Object.keys(T09.presets)).toEqual(['default']);
    const rec = golden.kostant.A3!;
    expect(caption).toContain(`(${rec.end_from_node[0]!.join(', ')})`);
    expect(caption).toContain(`${rec.moves_from_node[0]} moves`);
    expect(caption).toContain(`the ${kostantSummary(board('A3'), [1, 0, 0]).name}`);
    expect(kostantSummary(board('A3'), [1, 0, 0])).toEqual(kostantSummary(board('A3'), [1, 0, 0]));
    expect(oneMartian(board('A3'), [1, 0, 0])).toBe(0);
    expect(oneMartian(board('A3'), [1, 1, 0])).toBeNull();
    expect(playControl(board('A3'))).toBe('play to the end');
  });

  it('a numbers start is accepted only when its population is integral', () => {
    const b = board('A3');
    expect(startFromLink(b, 'numbers', [2, -1, 0])).toEqual([1, 0, 0]);
    expect(startFromLink(b, 'numbers', [1, 0, 0])).toBeNull();
    expect(startFromLink(b, 'populations', [1, 0, 0])).toEqual([1, 0, 0]);
    expect(startFromLink(b, 'populations', [3, -2, 7])).toEqual([3, -2, 7]);
    // E8: det C = 1, every numbers start is integral.
    expect(startFromLink(board('E8'), 'numbers', toNumbers(board('E8'), martian(8, 3)))).toEqual(martian(8, 3));
  });

  it('a raising play from any integer start ends within N moves', () => {
    const rnd = mulberry32(SEED + 2);
    let longest = 0;
    for (const name of ['A3', 'B3', 'C3', 'D4', 'E6', 'E8', 'F4', 'G2']) {
      const b = board(name);
      for (let r = 0; r < 60; r++) {
        const start = Array.from({ length: b.n }, () => int(rnd, -6, 6));
        const s = kostantSummary(b, start);
        expect(s.status, name).toBe('ended');
        expect(s.moves, name).toBeLessThanOrEqual(golden.types[name]!.n_positive_roots);
        longest = Math.max(longest, s.moves);
      }
    }
    expect(longest).toBeGreaterThan(28);
  });

  it('stated limit when the cap stops a play', () => {
    const cut = raisingPlay(board('E8'), martian(8, 0), undefined, 5);
    expect(cut.status).toBe('cap');
    expect(playOutcome(cut, 5)).toBe('still running after 5 moves');
    expect(playOutcome({ status: 'cap' }, CAPS.playMoves)).toBe('still running after 20000 moves');
    expect(playOutcome(raisingPlay(board('E8'), martian(8, 0)), CAPS.playMoves)).toBeNull();
    const s = kostantSummary(board('E8'), martian(8, 0), [], 5);
    expect(s.status).toBe('cap');
    expect(s.name).toBeNull();
    expect(s.moves).toBe(5);
  });

  it('the picker offers 32 types grouped by letter, or boardChoices', () => {
    const groups = pickerGroups();
    expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(groups.flatMap((g) => g.names)).toEqual(TYPE_NAMES);
    expect(KOSTANT_BOARDS).toEqual(TYPE_NAMES);
    for (const g of groups) for (const n of g.names) expect(n[0]).toBe(g.letter);
    expect(groups.flatMap((g) => g.names).some((n) => /[~^]/.test(n))).toBe(false);
    const few = pickerGroups(['A3', 'D4', 'E8']);
    expect(few).toEqual([
      { letter: 'A', names: ['A3'] },
      { letter: 'D', names: ['D4'] },
      { letter: 'E', names: ['E8'] },
    ]);
  });

  it('a start beyond SafeInt plays with Big', () => {
    const big = bigBoard(boardFromName('A3'));
    const e20 = '100000000000000000000';
    const s = kostantSummary(big, [e20, '0', '0']);
    expect(s.status).toBe('ended');
    expect(s.end).toEqual([e20, e20, e20]);
    expect(s.moves).toBe(2);
    expect(s.name).toBeNull();
    expect(() => kostantSummary(board('A3'), [e20, '0', '0'])).toThrow();
    let threw: unknown = null;
    try {
      kostantSummary(board('A3'), [e20, '0', '0']);
    } catch (e) {
      threw = e;
    }
    expect(threw instanceof EngineOverflow || threw instanceof RangeError).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Server render of the component (a loader like T01.test.ts's, with the aliases of CONTRACTS 1)
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
    cacheDir: join(tmpdir(), 'two-games-ssr-test-cache-t09-' + checkoutKey()),
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
  Component = ((await server.ssrLoadModule('/src/components/tools/T09Kostant.svelte')) as { default: unknown }).default;
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

describe('T9 server render', () => {
  it('the default renders moods and goal on the server', () => {
    const body = render({});
    expect(body).toContain('data-tool="kostant"');
    expect(outs(body, 'mood')).toEqual(['manic', 'unhappy', 'happy']);
    const goal = tags(body, 'p').find((t) => attr(t, 'data-out') === 'goal')!;
    expect(attr(goal, 'data-met')).toBe('false');
    expect(outs(body, 'bridgeSentence')[0]).toBe('The number on node i is the amount by which a mutation would lower city i.');
    expect(outs(body, 'endPanel')).toEqual([]);
    const nodes = tags(body, 'button').filter((t) => attr(t, 'data-node') !== null);
    expect(nodes.map((t) => attr(t, 'data-can-act'))).toEqual(['false', 'true', 'false']);
    expect(nodes.map((t) => attr(t, 'aria-label'))).toEqual([
      'City 1, population 1, mutation would lower it',
      'City 2, population 0, mutation would raise it',
      'City 3, population 0, mutation would change nothing',
    ]);
    for (const t of tags(body, 'button')) expect(attr(t, 'disabled'), t).not.toBeNull();
  });

  it('the end panel renders at build time when the state is at the end', () => {
    const a1 = render({ board: 'A1', start: [1] });
    expect(outs(a1, 'endName')[0]).toContain('the highest root');
    expect(outs(a1, 'moveCount')).toEqual(['0']);
    expect(outs(a1, 'finalNumbers')).toEqual(['2']);
    expect(outs(a1, 'marked')).toEqual(['1']);
    const b3 = render({ board: 'B3', start: [0, 0, 1], moves: [2, 1] });
    expect(outs(b3, 'endName')[0]).toContain('the highest short root');
    expect(outs(b3, 'hMinus2')).toEqual([]);
    expect(outs(b3, 'affineCaption')[0]).toMatch(/affine board/);
    expect(outs(b3, 'affineBoard')).toEqual([]);
    expect(b3).not.toContain('data-control="openLab"');
    const a3 = render({ board: 'A3', moves: [2, 3] });
    expect(outs(a3, 'hMinus2')[0]).toContain('2');
    expect(a3).toMatch(/data-out="hMinus2"[^>]*>[\s\S]*?<math/);
    expect(outs(a3, 'marked')).toEqual(['1, 3']);
  });

  it('boardChoices limits the picker, and a numbers start is converted', () => {
    const body = render({ board: 'D4', start: [1, 0, 0, 0], boardChoices: ['A3', 'D4', 'E8'] });
    const select = /<select[^>]*data-control="picker"[^>]*>([\s\S]*?)<\/select>/.exec(body)![1]!;
    expect(tags(select, 'option').map((t) => attr(t, 'value'))).toEqual(['A3', 'D4', 'E8']);
    const n = render({ board: 'A3', coords: 'numbers', start: [2, -1, 0] });
    const nodes = tags(n, 'button').filter((t) => attr(t, 'data-node') !== null);
    expect(nodes.map((t) => attr(t, 'data-value'))).toEqual(['1', '0', '0']);
    expect(() => render({ board: 'A3', coords: 'numbers', start: [1, 0, 0] })).toThrow(/integral/);
  });
});
