// P3-A6: tool T8, the Weyl Explorer (SPEC.md 4 T8; 2.6; 2.7 F5, F12; 5.4 to 5.6; E-9; 7.4). The
// acceptance criteria that range over every offered board are tested here on the tool's own t08/
// functions (graph.ts, heapView.ts, layout.ts, svgScene.ts, presets.ts, link.ts); the browser tests are
// in site/tests/e2e/T08.spec.ts. Golden values are read from reference/golden_data.json, never typed.
// No covers(): the keys read here (types[*].length_distribution, weyl_order, n_reduced_words_w0,
// heaps.A3) belong to P3-A1's and P3-A2's golden files (CONTRACTS 3).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import {
  CAPS,
  allCompleteGames,
  applyWord,
  boardFromName,
  commutationClassSize,
  countCompleteGames,
  fire,
  heapKey,
  legalLayers,
  legalNodes,
  longestWord,
  positiveRoots,
  separatingRoots,
  toLabels,
  toPositions,
  weylOrder,
} from '@two-games/engine';
import type { Board, Word } from '@two-games/engine';
import {
  ALL_EDGES_MAX,
  COUNT_NOT_OFFERED,
  buildGraph,
  countPaths,
  countText,
  edgesToDraw,
  gameCount,
  inLabelOrder,
  offeredBoards,
  onesOf,
  pathOfMoves,
  vertexDetails,
  wordOfVertex,
} from '../../../src/components/tools/t08/graph';
import { brickMultiset, bricksOf, heapData } from '../../../src/components/tools/t08/heapView';
import { buildScene, hitTest, layoutGraph, nextVertex } from '../../../src/components/tools/t08/layout';
import { countDots, sceneToSvg } from '../../../src/components/tools/t08/svgScene';
import { PRESETS, pickerGroups, weylState } from '../../../src/components/tools/t08/presets';
import { LINK_OUTSIDE, admitLink, followMoves, followedGame } from '../../../src/components/tools/t08/link';
import { T1Game, type T1Config } from '../../../src/components/tools/t01/model';
import registry from '../../../src/tools/registry/T08';
import { clearPublishedStates, followToolState, publishToolState, type ToolState } from '../../../src/lib/state';
import { decodeState, encodeState, LINK_NOTICE } from '../../../src/lib/urlCodec';
import { whereToRun, type CallHint } from '../../../src/lib/worker';
import { announceTemplates } from '../../../src/lib/a11y';

interface GoldenType {
  weyl_order?: number;
  length_distribution?: number[];
  n_reduced_words_w0?: number | string;
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, GoldenType>;
  heaps: Record<string, { complete_games: number; distinct_heaps: number; games_per_heap: number[] }>;
};

const OFFERED = offeredBoards();
const board = (name: string): Board<number> => boardFromName(name) as Board<number>;
const models = new Map(OFFERED.map((name) => [name, buildGraph(board(name), undefined, name)]));
const modelOf = (name: string) => models.get(name)!;

/** A fixed-seed generator (mulberry32), seed recorded here. */
const SEED = 20261010;
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('T8 graph model', () => {
  it('offered boards are exactly the types with weyl_order at most 1152', () => {
    const fromGolden = Object.entries(golden.types)
      .filter(([, t]) => t.weyl_order !== undefined && t.weyl_order <= CAPS.weylExplorerGroup)
      .map(([name]) => name)
      .sort();
    expect([...OFFERED].sort()).toEqual(fromGolden);
    expect([...registry.boards].sort()).toEqual(fromGolden);
    expect(registry.boards).toEqual(OFFERED);
    expect(OFFERED).toHaveLength(14);
    // Boards just above the cap are not offered (the cap is a group order, not a rank).
    for (const name of ['A6', 'D5', 'E6', 'B5', 'C5']) expect(OFFERED).not.toContain(name);
  });

  it('layer sizes equal length_distribution and sum to weyl_order on every offered board', () => {
    for (const name of OFFERED) {
      const m = modelOf(name);
      const t = golden.types[name]!;
      expect(m.graph.truncated, name).toBe(false);
      expect(m.graph.items.length, name).toBe(t.weyl_order);
      expect(m.found, name).toBe(weylOrder(board(name)));
      expect(m.layerSizes, name).toEqual(t.length_distribution);
      expect(m.layerSizes, name).toEqual(legalLayers(board(name)));
      expect(m.layerSizes.reduce((a, b) => a + b, 0), name).toBe(t.weyl_order);
      expect(m.limit, name).toBeNull();
    }
    // F4 at the cap exactly: 1152 items, not truncated (5.5: the cap acts on item cap + 1).
    expect(modelOf('F4').graph.items.length).toBe(CAPS.weylExplorerGroup);
    expect(modelOf('F4').graph.truncated).toBe(false);
  });

  it('top-to-bottom paths equal n_reduced_words_w0 on every offered board', () => {
    for (const name of OFFERED) {
      const m = modelOf(name);
      const want = BigInt(golden.types[name]!.n_reduced_words_w0!);
      expect(countPaths(m), name).toBe(want);
      expect(gameCount(m), name).toBe(want);
      expect(countCompleteGames(board(name)), name).toBe(want);
    }
  });

  it('every edge is a legal move one layer down, and the graph has |W| n / 2 edges', () => {
    for (const name of OFFERED) {
      const m = modelOf(name);
      const b = m.board;
      for (const e of m.edges) {
        const v = m.graph.items[e.from]!;
        expect(v[e.node]! > 0, name).toBe(true);
        expect(fire(b, v, e.node)).toEqual(m.graph.items[e.to]);
        expect(m.graph.depth[e.to], name).toBe(m.graph.depth[e.from]! + 1);
        expect(e.label).toBe(toLabels(b, [e.node])[0]);
      }
      expect(m.edges.length * 2, name).toBe(m.found * b.n);
    }
  });

  it('the widest layer equals the maximum of length_distribution (A3 6, B3 8, A4 22, D4 30, B4 46, A5 101, F4 94)', () => {
    for (const name of OFFERED) {
      const lay = layoutGraph(modelOf(name));
      expect(lay.widest, name).toBe(Math.max(...golden.types[name]!.length_distribution!));
      expect(lay.layers, name).toBe(golden.types[name]!.length_distribution!.length);
      // The drawing is as wide as its widest layer needs; hit areas never overlap (A-7).
      expect(lay.width).toBeGreaterThanOrEqual(lay.widest * lay.hit);
      expect(lay.colW).toBeGreaterThanOrEqual(lay.hit);
      expect(lay.rowH).toBeGreaterThanOrEqual(lay.hit);
      expect(lay.hit).toBeGreaterThanOrEqual(24);
    }
    expect(layoutGraph(modelOf('A3')).hit).toBe(44);
  });

  it('edges drawn: all at 192 elements, only path and focus above', () => {
    const d4 = modelOf('D4');
    expect(d4.found).toBe(ALL_EDGES_MAX);
    expect(d4.edgeMode).toBe('all');
    expect(edgesToDraw(d4, [0], null)).toHaveLength(384);
    for (const name of ['A5', 'B4', 'C4', 'F4']) expect(modelOf(name).edgeMode, name).toBe('game-and-focus');
    for (const name of OFFERED) expect(modelOf(name).edgeMode, name).toBe(modelOf(name).found > 192 ? 'game-and-focus' : 'all');
    const f4 = modelOf('F4');
    expect(edgesToDraw(f4, [0], null)).toHaveLength(0);
    const full = pathOfMoves(f4, toLabels(f4.board, (play24(f4.board))));
    expect(full).toHaveLength(25);
    expect(edgesToDraw(f4, full, null)).toHaveLength(24);
    const focus = 500;
    const around = f4.edges.filter((e) => e.from === focus || e.to === focus).length;
    expect(around).toBe(f4.board.n); // every vertex of a finite group has n neighbours
    const drawn = edgesToDraw(f4, [0], focus);
    expect(drawn).toHaveLength(around);
    for (const k of drawn) expect(f4.edges[k]!.from === focus || f4.edges[k]!.to === focus).toBe(true);
  });

  it('the shortest word replays to the vertex', () => {
    for (const name of OFFERED) {
      const m = modelOf(name);
      const b = m.board;
      for (let k = 0; k < m.found; k++) {
        const word = wordOfVertex(m, k);
        expect(word.length).toBe(m.graph.depth[k]);
        let a = onesOf(b);
        for (const i of toPositions(b, word)) {
          expect(legalNodes(b, a)).toContain(i);
          a = fire(b, a, i);
        }
        expect(a).toEqual(m.graph.items[k]);
        expect(applyWord(b, onesOf(b), toPositions(b, word), 'firing')).toEqual(m.graph.items[k]);
      }
    }
  });

  it('separating roots count the layer', () => {
    for (const name of OFFERED) {
      const m = modelOf(name);
      const b = m.board;
      const pos = positiveRoots(b).map((r) => inLabelOrder(b, r).join(','));
      // F4 is checked on a sample of every 7th vertex (1152 calls of positiveRoots otherwise).
      const step = m.found > 400 ? 7 : 1;
      for (let k = 0; k < m.found; k += step) {
        const d = vertexDetails(m, k);
        expect(d.roots.length, `${name} vertex ${k}`).toBe(d.layer);
        const idx = d.roots.map((r) => pos.indexOf(r.join(',')));
        expect(idx.every((i) => i >= 0)).toBe(true);
        expect([...idx].sort((x, y) => x - y)).toEqual(idx);
      }
    }
    // B3 and C3 differ (a transposition would show here).
    const b3 = modelOf('B3');
    const c3 = modelOf('C3');
    const setsB = new Set(b3.drawn.map((k) => vertexDetails(b3, k).roots.map((r) => r.join(',')).join(';')));
    const setsC = new Set(c3.drawn.map((k) => vertexDetails(c3, k).roots.map((r) => r.join(',')).join(';')));
    expect([...setsB].sort()).not.toEqual([...setsC].sort());
  });

  it('the A3 example: after 1,3,2 the details panel shows the engine values', () => {
    const m = modelOf('A3');
    const b = m.board;
    const path = pathOfMoves(m, [1, 3, 2]);
    expect(path.every((k) => k !== null)).toBe(true);
    const k = path[3]!;
    const d = vertexDetails(m, k);
    const a = applyWord(b, onesOf(b), toPositions(b, [1, 3, 2]), 'firing');
    expect(d.position).toEqual(inLabelOrder(b, a));
    expect(d.layer).toBe(3);
    expect(d.word).toEqual(toLabels(b, toPositions(b, d.word)));
    expect(d.word).toHaveLength(3);
    expect(d.roots).toEqual(separatingRoots(b, a).map((r) => inLabelOrder(b, r)));
  });

  it('every call stays on the main thread', () => {
    for (const name of OFFERED) {
      const b = board(name);
      const hints: CallHint[] = [
        { board: b, kind: 'enumeration', expectedItems: CAPS.weylExplorerGroup, finiteKnown: true },
        { board: b, kind: 'count', expectedItems: weylOrder(b), finiteKnown: true },
        { board: b, kind: 'play', moves: positiveRoots(b).length, finiteKnown: true },
      ];
      for (const h of hints) expect(whereToRun(h), `${name} ${h.kind}`).toBe('main');
    }
  });

  it('stated limits: a cut-off search is said in words', () => {
    const g = buildGraph(board('F4'), 100, 'F4');
    expect(g.graph.truncated).toBe(true);
    expect(g.graph.items).toHaveLength(100);
    const L = g.graph.completeLayers;
    expect(g.limit).toBe(`stopped after 100 positions; layers 0 to ${L} are complete`);
    const deepest = Math.max(...g.graph.depth);
    expect(L).toBeLessThan(deepest);
    expect(g.layerSizes).toHaveLength(L + 1);
    expect(g.drawn.every((k) => g.graph.depth[k]! <= L)).toBe(true);
    expect(countPaths(g)).toBeNull();
    const lay = layoutGraph(g);
    const scene = buildScene(g, lay, [0], null);
    expect(scene.label).toContain(g.limit!);
    expect(countText(null)).toBe(COUNT_NOT_OFFERED);
    expect(countText(16n)).toBe('16');
    // No string the tool can show says "not of finite type".
    const source = readFileSync(fileURLToPath(new URL('../../../src/components/tools/T08WeylExplorer.svelte', import.meta.url)), 'utf8');
    const strings = [source, ...Object.values(PRESETS).map((p) => p.caption), LINK_OUTSIDE, scene.label];
    for (const s of strings) expect(s).not.toMatch(/not of finite type/);
  });
});

/** The legal play from rho with the lowest-node rule, as positions (N moves). */
function play24(b: Board<number>): Word {
  let a = onesOf(b);
  const word: number[] = [];
  for (;;) {
    const legal = legalNodes(b, a);
    if (legal.length === 0) return word;
    word.push(legal[0]!);
    a = fire(b, a, legal[0]!);
  }
}

describe('T8 heap view', () => {
  it('two plays that differ by exchanging adjacent moves at unjoined nodes show the same heap', () => {
    const random = rng(SEED);
    for (const name of OFFERED) {
      const b = board(name);
      const words: Word[] = [];
      if (b.n <= 3) {
        const all = allCompleteGames(b, onesOf(b), CAPS.mainThreadItems);
        expect(all.truncated).toBe(false);
        words.push(...all.items);
      } else {
        words.push(longestWord(b));
        for (let s = 0; s < 6; s++) {
          let a = onesOf(b);
          const w: number[] = [];
          for (;;) {
            const legal = legalNodes(b, a);
            if (legal.length === 0) break;
            const i = legal[Math.floor(random() * legal.length)]!;
            w.push(i);
            a = fire(b, a, i);
          }
          words.push(w);
        }
      }
      const joined = (i: number, j: number): boolean => i === j || b.cartan[i]![j] !== 0 || b.cartan[j]![i] !== 0;
      let exchanges = 0;
      for (const w of words) {
        const labels = toLabels(b, w);
        const base = heapData(b, labels);
        for (let k = 0; k + 1 < w.length; k++) {
          if (joined(w[k]!, w[k + 1]!)) continue;
          const swapped = [...labels];
          [swapped[k], swapped[k + 1]] = [swapped[k + 1]!, swapped[k]!];
          const other = heapData(b, swapped);
          expect(brickMultiset(other.bricks)).toEqual(brickMultiset(base.bricks));
          expect(other.key).toBe(base.key);
          expect(other.count).toBe(base.count);
          exchanges++;
        }
      }
      // On two nodes every pair of nodes is joined; from rank 3 on some exchange is always met.
      if (b.n > 2) expect(exchanges, name).toBeGreaterThan(0);
    }
  });

  it('on A3 the 16 complete games show 8 different heaps with games_per_heap', () => {
    const b = board('A3');
    const g = golden.heaps.A3!;
    const all = allCompleteGames(b, onesOf(b), CAPS.mainThreadItems);
    expect(all.items).toHaveLength(g.complete_games);
    const groups = new Map<string, number>();
    for (const w of all.items) {
      const key = heapData(b, toLabels(b, w)).key;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    expect(groups.size).toBe(g.distinct_heaps);
    expect([...groups.values()].sort((x, y) => x - y)).toEqual(g.games_per_heap);
    for (const w of all.items) {
      const d = heapData(b, toLabels(b, w));
      expect(d.count).toBe(BigInt(groups.get(d.key)!));
      expect(d.key).toBe(heapKey(b, w));
    }
  });

  it('the bricks of 1,3,2 and 3,1,2 on A3 agree; columns in label order; the empty word counts 1', () => {
    const b = board('A3');
    const one = bricksOf(b, [1, 3, 2]);
    const two = bricksOf(b, [3, 1, 2]);
    expect(brickMultiset(one)).toEqual(brickMultiset(two));
    expect(one.map((x) => x.column)).toEqual([0, 2, 1]);
    expect(heapData(b, [1, 3, 2]).count).toBe(commutationClassSize(b, toPositions(b, [1, 3, 2])));
    expect(heapData(b, []).count).toBe(1n);
    expect(heapData(b, []).bricks).toEqual([]);
  });
});

describe('T8 layout, scene, keyboard', () => {
  it('the arrow keys visit every vertex of A3 and Home and End reach the top and the bottom', () => {
    const m = modelOf('A3');
    const lay = layoutGraph(m);
    const seen = new Set<number>();
    for (const row of lay.order) {
      let v = row[0]!;
      seen.add(v);
      for (let s = 0; s < row.length; s++) {
        v = nextVertex(lay, v, 'ArrowRight');
        seen.add(v);
      }
    }
    expect(seen.size).toBe(m.found);
    const top = nextVertex(lay, 5, 'Home');
    expect(m.graph.depth[top]).toBe(0);
    const bottom = nextVertex(lay, 5, 'End');
    expect(m.graph.depth[bottom]).toBe(m.graph.depthReached);
    expect(m.graph.depth[nextVertex(lay, top, 'ArrowDown')]).toBe(1);
    expect(hitTest(lay, lay.cx[7]!, lay.cy[7]!)).toBe(7);
    expect(hitTest(lay, lay.cx[7]! + lay.hit, lay.cy[7]!)).not.toBe(7);
  });

  it('the default states are deterministic', () => {
    for (const name of ['A3', 'D4', 'F4']) {
      const a = buildGraph(board(name), undefined, name);
      const b = buildGraph(board(name), undefined, name);
      const sa = sceneToSvg(buildScene(a, layoutGraph(a), [0], null));
      const sb = sceneToSvg(buildScene(b, layoutGraph(b), [0], null));
      expect(sa).toBe(sb);
    }
    for (const p of Object.values(PRESETS)) {
      const m = buildGraph(board(p.state.board as string), undefined, p.state.board as string);
      const path = pathOfMoves(m, p.state.moves ?? []);
      expect(sceneToSvg(buildScene(m, layoutGraph(m), path, null))).toBe(sceneToSvg(buildScene(m, layoutGraph(m), path, null)));
    }
  });

  it('the A3 scene draws 24 dots and 36 labelled edges, the path marked', () => {
    const m = modelOf('A3');
    const path = pathOfMoves(m, [1, 3, 2]);
    const svg = sceneToSvg(buildScene(m, layoutGraph(m), path, null));
    expect(countDots(svg)).toBe(24);
    expect(svg.match(/data-out="edge"/g)).toHaveLength(36);
    expect(svg.match(/data-on-path="true"/g)).toHaveLength(3);
    expect(svg.match(/data-path-mark="true"/g)).toHaveLength(4);
    expect(svg).toContain('role="img"');
    expect(svg).toMatch(/aria-label="[^"]*A3[^"]*24 positions in 7 layers/);
    expect(svg).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

describe('T8 presets, links, picker', () => {
  it("a preset's link carries its state and none of its options", () => {
    const defaults = weylState('A3', 3);
    for (const [id, p] of Object.entries(PRESETS)) {
      const state: ToolState = id === 'heap' ? { ...p.state, moves: [3, 1, 2] } : p.state;
      const query = encodeState(state);
      const { state: back, notice } = decodeState(query, 'weyl', defaults);
      expect(notice, id).toBeNull();
      expect(back.board).toBe(state.board);
      expect(back.coords).toBe('numbers');
      expect(back.start).toEqual([1, 1, 1]);
      expect(back.moves).toEqual(state.moves);
      for (const key of ['boardChoices', 'panel', 'plays', 'counter', 'heap']) expect(query).not.toContain(key);
      expect(admitLink(back, OFFERED)).toEqual({ board: state.board, moves: state.moves });
    }
    expect(PRESETS.default.state.moves).toEqual([]);
    expect(PRESETS.heap.state.moves).toEqual([1, 3, 2]);
    expect(PRESETS.heap.options.plays).toEqual([
      [1, 3, 2],
      [3, 1, 2],
    ]);
    expect(PRESETS.counter.options.boardChoices).toEqual(['A2', 'A3', 'B3', 'D4']);
    // A page may pass A4 in boardChoices (M5 beat 3 names it): the picker lists it and the count is 768.
    const groups = pickerGroups(OFFERED, ['A2', 'A3', 'A4', 'B3', 'D4']);
    expect(groups.flatMap((g) => g.names)).toEqual(['A2', 'A3', 'A4', 'B3', 'D4']);
    expect(countPaths(modelOf('A4'))).toBe(BigInt(golden.types.A4!.n_reduced_words_w0!));
    expect(gameCount(modelOf('A4'))).toBe(BigInt(golden.types.A4!.n_reduced_words_w0!));
    expect(pickerGroups(OFFERED).map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'F', 'G']);
  });

  it('links outside the graph are refused', () => {
    const defaults = weylState('A3', 3);
    // Another start, populations, free play, an illegal move: each refused.
    const cases = ['g=A3&c=n&s=1,0,1', 'g=A3&c=p&s=1,0,0', 'g=A3&m=f&w=1.1', 'g=A3&v=l'];
    for (const q of cases) {
      const { state, notice } = decodeState(q, 'weyl', defaults);
      const admitted = notice === null ? admitLink(state, OFFERED) : null;
      expect(admitted, q).toBeNull();
    }
    // A board T8 does not offer: the codec's notice.
    expect(decodeState('g=E6', 'weyl', defaults).notice).toBe(LINK_NOTICE);
    expect(decodeState('g=D5', 'weyl', defaults).notice).toBe(LINK_NOTICE);
    // An illegal move under the default legal mode: the codec's notice (6.6 rule 6).
    expect(decodeState('w=1.1', 'weyl', defaults).notice).toBe(LINK_NOTICE);
    // A good link is admitted.
    const ok = decodeState('g=B3&w=1.2', 'weyl', defaults);
    expect(ok.notice).toBeNull();
    expect(admitLink(ok.state, OFFERED)).toEqual({ board: 'B3', moves: [1, 2] });
  });

  it("a linked T1's state drives the path", () => {
    clearPublishedStates();
    const seen: (ReturnType<typeof followedGame> | 'none')[] = [];
    const stop = followToolState('b1', (s) => seen.push(followedGame(s, OFFERED) ?? 'none'));
    const t1 = (board: string, start: number[], moves: number[]): ToolState => ({
      schema: 1,
      tool: 'board',
      board,
      view: 'numbers',
      mode: 'legal',
      coords: 'numbers',
      start,
      moves,
    });
    publishToolState('b1', t1('A3', [1, 1, 1], [1, 3, 2]));
    publishToolState('b1', t1('A3', [2, 1, 1], [1]));
    publishToolState('b1', t1('E6', [1, 1, 1, 1, 1, 1], []));
    publishToolState('b1', { ...t1('A3', [1, 0, 0], []), coords: 'populations', view: 'populations', mode: 'free' });
    stop();
    expect(seen).toHaveLength(4);
    const first = seen[0];
    expect(first).toEqual({ board: 'A3', moves: [1, 3, 2] });
    const m = modelOf('A3');
    const path = pathOfMoves(m, (first as { moves: number[] }).moves);
    expect(path).toHaveLength(4);
    const b = m.board;
    let a = onesOf(b);
    const positions = [a];
    for (const i of toPositions(b, [1, 3, 2])) {
      a = fire(b, a, i);
      positions.push(a);
    }
    expect(path.map((k) => m.graph.items[k!])).toEqual(positions);
    expect(seen.slice(1)).toEqual(['none', 'none', 'none']);
    expect(LINK_OUTSIDE).toMatch(/not in this graph/);
  });

  it('announcements of a move use the A-4 templates unchanged', () => {
    expect(announceTemplates.fired(1, ['minus 1', '2', '1'], 1)).toBe('Fired node 1. Numbers now minus 1, 2, 1. Move 1.');
  });
});

// ---------------------------------------------------------------------------------------------
// Server render of the component (a Vite server with the Svelte plugin and the aliases of CONTRACTS 1)
// ---------------------------------------------------------------------------------------------

const SITE = fileURLToPath(new URL('../../../', import.meta.url));
let server: ViteDevServer;
let renderFn: (c: unknown, o: { props: unknown }) => { body: string };
let Component: unknown;

function checkoutKey(): string {
  return createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8);
}

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-ssr-test-cache-t08-' + checkoutKey()),
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
  Component = ((await server.ssrLoadModule('/src/components/tools/T08WeylExplorer.svelte')) as { default: unknown }).default;
}, 60000);

afterAll(async () => {
  await server?.close();
});

function render(props: Record<string, unknown>): string {
  return renderFn(Component, { props: { id: '', ...props } }).body;
}

function snapshotOf(html: string): string | null {
  const m = /<svg[^>]*data-out="snapshot"[\s\S]*?<\/svg>/.exec(html);
  return m ? m[0] : null;
}

describe('T8 server render', () => {
  it('server rendering F4 yields the SVG snapshot', () => {
    for (const name of ['F4', 'A5', 'B4', 'C4']) {
      const html = render({ board: name });
      const snap = snapshotOf(html);
      expect(snap, name).not.toBeNull();
      const order = golden.types[name]!.weyl_order!;
      const layers = golden.types[name]!.length_distribution!.length;
      expect(countDots(snap!), name).toBe(order);
      expect(snap).toContain('role="img"');
      expect(snap).toMatch(new RegExp(`aria-label="[^"]*${name}[^"]*${order} positions in ${layers} layers`));
      expect(html).not.toMatch(/<canvas/);
      expect(html).toMatch(/data-out="edgeMode"[^>]*>game-and-focus</);
      expect(html).toMatch(new RegExp(`data-out="groupOrder"[^>]*>${order}<`));
    }
    for (const name of ['A3', 'D4']) {
      const html = render({ board: name });
      expect(snapshotOf(html), name).toBeNull();
      const order = golden.types[name]!.weyl_order!;
      expect(html.match(/data-out="vertex"/g), name).toHaveLength(order);
      expect(html).toMatch(/data-out="edgeMode"[^>]*>all</);
      expect(html.match(/data-out="edge"/g), name).toHaveLength((order * boardFromName(name).n) / 2);
    }
  });

  it('the default A3 render has the graph, layer sizes, counter, heap, caption, table and disabled controls', () => {
    const html = render({ preset: 'default' });
    expect(html).toContain('data-tool="weyl"');
    expect(html).toContain('data-moves="0"');
    expect(html.match(/data-out="vertex"/g)).toHaveLength(24);
    expect(html.match(/data-out="edge"/g)).toHaveLength(36);
    expect(html).toMatch(new RegExp(`data-out="gameCount"[^>]*>${String(golden.types.A3!.n_reduced_words_w0)}<`));
    const sizes = [...html.matchAll(/data-layer="(\d+)" data-count="(\d+)"/g)].map((m) => Number(m[2]));
    expect(sizes).toEqual(golden.types.A3!.length_distribution);
    expect(html).toContain(PRESETS.default.caption);
    expect(html).toContain('Show as table');
    expect(html).toMatch(/data-control="step"[^>]*disabled/);
    expect(html).toMatch(/data-control="picker"[^>]*disabled/);
    expect(html.match(/<button[^>]*data-node=/g)).toHaveLength(3);
    expect(html).toMatch(/data-out="heapCount"[^>]*>1</);
  });

  it('the presets render through properties alone', () => {
    const heap = render({ preset: 'heap' });
    expect(heap).toContain('data-moves="3"');
    expect(heap.match(/data-control="loadPlay"/g)).toHaveLength(2);
    expect(heap).toMatch(/data-play="1,3,2"/);
    expect(heap).toMatch(/data-play="3,1,2"/);
    expect(heap.match(/data-out="brick"/g)).toHaveLength(3);
    expect(heap).toMatch(/data-out="heapCount"[^>]*>2</);
    expect(heap.match(/data-on-path="true"/g)!.length).toBeGreaterThanOrEqual(4);
    // The heap panel comes first in the heap preset, the counter first in the counter preset.
    expect(heap.indexOf('data-panel="heap"')).toBeLessThan(heap.indexOf('data-panel="graph"'));
    const counter = render({ preset: 'counter' });
    expect(counter.indexOf('data-panel="counter"')).toBeLessThan(counter.indexOf('data-panel="graph"'));
    const options = [...counter.matchAll(/<option value="([A-G]\d)"/g)].map((m) => m[1]);
    expect(options).toEqual(['A2', 'A3', 'B3', 'D4']);
    const withA4 = render({ preset: 'counter', boardChoices: ['A2', 'A3', 'A4', 'B3', 'D4'], board: 'A4' });
    expect(withA4).toMatch(new RegExp(`data-out="gameCount"[^>]*>${String(golden.types.A4!.n_reduced_words_w0)}<`));
    // With linkTo, T8 shows no board of its own and no step or play control.
    const linked = render({ preset: 'default', linkTo: 'b1' });
    expect(linked).not.toMatch(/<button[^>]*data-node=/);
    expect(linked).not.toMatch(/data-control="step"/);
    expect(linked).toContain('data-out="linkStatus"');
  });
});

describe('regressions', () => {
  // SPEC 7.4: "while a tool runs it keeps the list of positions of the current play in memory and extends
  // it by one position per move, so a move costs one engine call however long the play is". T8 following a
  // Game Board rebuilt its game from the whole followed play on every move (the cause of P3-RT-04-04 in T2
  // and T3). followMoves extends the game it holds: the positions held are kept (the same objects), an
  // undo or a redo only moves the cursor, a move the legal play forbids leaves the graph, and another
  // start, board or game is left to a load. Oracle (fire on A3 from (1, 1, 1)): 1 gives (-1, 2, 1), 2 gives
  // (1, -2, 3), 1 gives (-1, -1, 3), where node 1 holds -1 and cannot be fired.
  // regression: P3-RT-13-04
  it('followMoves extends the held game, keeps every position held, and leaves another game to a load', () => {
    const t1 = (moves: number[], start: number[] = [1, 1, 1]): ToolState => ({ schema: 1, tool: 'board', board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', start, moves });
    const config = (moves: number[]): T1Config => ({ board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1, 1], moves });
    const game = new T1Game(config([]));
    expect(followMoves(game, t1([]))).toBe('unchanged');
    expect(followMoves(game, t1([1]))).toBe('changed');
    const first = game.positions[1];
    expect(followMoves(game, t1([1, 2, 1]))).toBe('changed');
    expect(game.positions[1]).toBe(first);
    expect(game.applied).toEqual([1, 2, 1]);
    expect(game.shown).toEqual(new T1Game(config([1, 2, 1])).shown);
    // An undo and a redo move the cursor over the same positions.
    const held = game.positions;
    expect(followMoves(game, t1([1, 2]))).toBe('changed');
    expect(game.cursor).toBe(2);
    expect(game.positions).toBe(held);
    expect(followMoves(game, t1([1, 2, 1]))).toBe('changed');
    expect(game.positions).toBe(held);
    expect(followMoves(game, t1([1, 2, 1]))).toBe('unchanged');
    // A move the legal play forbids leaves the graph, as followedGame says.
    expect(followMoves(game, t1([1, 2, 1, 1]))).toBe('outside');
    expect(followedGame(t1([1, 2, 1, 1]), OFFERED)).toBeNull();
    // Another start, another board, the populations: another game, loaded from the start.
    expect(followMoves(game, t1([], [2, 1, 1]))).toBeNull();
    expect(followMoves(game, { ...t1([]), board: 'B3' })).toBeNull();
    expect(followMoves(game, { ...t1([]), coords: 'populations' })).toBeNull();
  });
});
