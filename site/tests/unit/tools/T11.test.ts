// P4-A4: tool T11, the Folding Bench (SPEC.md 4 T11, 2.13, 4.0, 6.6, E-5, E-7, E-9). The acceptance of
// SPEC 4 T11 over every row of the golden key `folding`, through the tool's own pure functions in
// site/src/components/tools/t11/model.ts, plus the plan's checks (instruction section 6) and the server
// render of T11FoldingBench.svelte.
//
// Golden rows come from the harness of P0-A2 (packages/engine/test/golden/_harness.ts): `golden`,
// `matchRecord` (rule 5), `intEq` (rule 1), `labels` (rule 2), `TYPE_NAMES`. This file never calls
// `covers`: the key `folding` is tested in exactly one golden file, P4-A1's p4-folding.test.ts
// (CONTRACTS 3). Names (rule 6) and form values (the text of rule 4) are compared as exact strings with
// toBe. Every value expected below is either read from the golden file or computed by the engine; the
// only vectors typed are the worked values the instruction quotes from the oracle (section 5.6).
//
// Properties of T11 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// prediction, preset, caption): `symmetry` (images of all nodes in label order, as `y`) and `view`
// ('populations' | 'numbers'). `linkTo` and `layers` are accepted and ignored.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyWord, boardFromName, fold, roots, symmetries, toLabels } from '@engine';
import type { AnyBoard, Board } from '@engine';
import { TYPE_NAMES, golden, intEq, labels as harnessLabels, matchRecord } from '../../../../packages/engine/test/golden/_harness';
import {
  AVERAGE_CAPTION,
  CONSTRUCTION,
  FOLD_CAPTION,
  T11_BOARDS,
  T11_PRESETS,
  T11_TABS,
} from '../../../src/components/tools/t11/config';
import {
  FoldBench,
  ORBIT_EDGE_PHRASE,
  admitLink,
  announceSymmetric,
  averagedHint,
  averagedOf,
  defaultStart,
  defaultSymmetry,
  expandMove,
  exportData,
  foldContext,
  foldMessage,
  foldedWord,
  isSymmetricStart,
  offeredSymmetries,
  orbitOfLabel,
  orbitText,
  orbitsInBourbakiOrder,
  orbitsInLabels,
  playHint,
  replay,
  rootCount,
  symmetryText,
  symmetryToLabels,
  symmetryToPositions,
  undoAnnouncement,
} from '../../../src/components/tools/t11/model';
import { LINK_NOTICE, decodeState, encodeState } from '../../../src/lib/urlCodec';
import { positionsOf, type ToolState } from '../../../src/lib/state';
import { whereToRun } from '../../../src/lib/worker';
import T11 from '../../../src/tools/registry/T11';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';

interface FoldingRow {
  type: string;
  symmetry: number[];
  order: number;
  orbits: number[][];
  folds_to: string | null;
  folded_cartan: number[][] | null;
  folded_orbits_in_bourbaki_order: number[][] | null;
  averaged_roots_type: string;
  averaged_root_classes: { class: string; roots: number; form_value: string }[];
  averaged_simple_cartan: number[][];
}

const rows = golden.folding as FoldingRow[];
const foldingRows = rows.filter((r) => r.folds_to !== null);

const named = (name: string): AnyBoard => boardFromName(name);

/** A small seeded generator (mulberry32), so that every run draws the same plays (CONTRACTS 3). */
const SEED = 20261017;
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
const PLAYS_PER_ROW_AND_GAME = 200;

const defaultsOf = (board: string, symmetry: number[], view: 'numbers' | 'populations' = 'numbers'): ToolState => {
  const b = named(board);
  const ctx = foldContext(b, symmetry);
  return { schema: 1, tool: 'fold', board, view, coords: view, start: defaultStart(b, view, ctx.orbits), moves: [], symmetry };
};
const A3_DEFAULTS = (): ToolState => defaultsOf('A3', [3, 2, 1]);

describe('T11 acceptance over the golden key folding (SPEC 4 T11)', () => {
  it('the nine rows are present and eight of them fold', () => {
    expect(rows).toHaveLength(9);
    expect(foldingRows).toHaveLength(8);
  });

  it('for every folding row with a folded board, 200 random symmetric plays agree between the two boards in both games', () => {
    const next = rng(SEED);
    const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
    let checked = 0;
    for (const row of foldingRows) {
      const board = named(row.type) as Board<number>;
      const ctx = foldContext(board, row.symmetry);
      const folded = ctx.folded!;
      expect(folded).not.toBeNull();
      for (const game of ['mutation', 'firing'] as const) {
        for (let k = 0; k < PLAYS_PER_ROW_AND_GAME; k++) {
          // A symmetric start: one entry in [-9, 9] per orbit, in label order; a word of 1 to 12 orbits.
          const perOrbit = ctx.orbits.map(() => int(-9, 9));
          const start = [...board.labels].sort((a, b) => a - b).map((l) => perOrbit[orbitOfLabel(ctx, l)]!);
          const length = int(1, 12);
          const moves: number[] = [];
          for (let j = 0; j < length; j++) moves.push(Math.min(...harnessLabels(board, ctx.orbits[int(0, ctx.orbits.length - 1)]!)));
          const { big, small } = replay(ctx, start, moves, game);
          const message = `${row.type} symmetry ${row.symmetry.join('.')} ${game} start ${start.join(',')} word ${moves.join('.')}`;
          // Every node of every orbit equals the folded board's value on that orbit (2.13(a), [V]).
          for (let s = 0; s < ctx.orbits.length; s++) {
            for (const p of ctx.orbits[s]!) intEq(big[p], small[s], message);
          }
          // The folded board was played by the engine on its own Cartan matrix: the same word read
          // through the orbit map (folded position s is orbit s), never a copy of the big board's values.
          intEq(small, applyWord(folded, perOrbit, foldedWord(ctx, moves), game), message);
          checked++;
        }
      }
    }
    expect(checked).toBe(foldingRows.length * 2 * PLAYS_PER_ROW_AND_GAME);
  });

  it('for every folding row with a folded board, the folded board is folds_to and its labels follow folded_orbits_in_bourbaki_order', () => {
    for (const row of foldingRows) {
      const board = named(row.type);
      const ctx = foldContext(board, row.symmetry);
      expect(ctx.folded).not.toBeNull();
      expect(ctx.foldedName).toBe(row.folds_to);
      intEq(orbitsInLabels(ctx), row.orbits);
      intEq(orbitsInBourbakiOrder(ctx), row.folded_orbits_in_bourbaki_order);
      // Orbit s carries the Bourbaki label folded.labels[s] (E-7 table, the folded board).
      for (let s = 0; s < ctx.orbits.length; s++) {
        intEq(toLabels(board, ctx.orbits[s]!).sort((a, b) => a - b), row.folded_orbits_in_bourbaki_order![ctx.folded!.labels[s]! - 1]);
      }
    }
  });

  it('for every folding row the averaged type equals averaged_roots_type', () => {
    for (const { type, symmetry } of rows) {
      const row = matchRecord(rows, { type, symmetry });
      const ctx = foldContext(named(type), symmetry);
      const avg = averagedOf(ctx);
      expect(avg.name).toBe(row.averaged_roots_type);
      expect(avg.classes.map((c) => c.class)).toEqual(row.averaged_root_classes.map((c) => c.class));
      for (const expected of row.averaged_root_classes) {
        const got = avg.classes.find((c) => c.class === expected.class)!;
        intEq(got.roots, expected.roots, `${type} ${expected.class}`);
        expect(got.form_value).toBe(expected.form_value);
      }
    }
  });

  it('for the flip of A4 fold returns no board and the first tab\'s message says an orbit contains an edge', () => {
    const a4 = named('A4');
    const r = fold(a4, [3, 2, 1, 0]);
    expect(r.folded).toBeNull();
    expect(r.reason).not.toBeNull();
    const ctx = foldContext(a4, [4, 3, 2, 1]);
    expect(ctx.folded).toBeNull();
    expect(ORBIT_EDGE_PHRASE).toBe('an orbit contains an edge');
    expect(ctx.message).toContain('an orbit contains an edge');
    expect(foldMessage(r.reason!, [[2, 3]])).toContain('an orbit contains an edge');
    expect(foldMessage(r.reason!, [[2, 3]])).toContain('{2, 3}');
    // The phrase appears even if the engine's reason were worded otherwise.
    expect(foldMessage('some other wording', [[2, 3]])).toContain('an orbit contains an edge');
    expect(ctx.message).toBe('This board does not fold by this symmetry: an orbit contains an edge. The orbit {2, 3} contains an edge.');
    // No symmetric play on a board that does not fold: every node is not actable.
    const bench = new FoldBench({ board: 'A4', view: 'numbers', symmetry: [4, 3, 2, 1] });
    expect(bench.canAct()).toEqual([false, false, false, false]);
    expect(bench.act(0)).toBeNull();
  });

  it('the boards that never fold are A2, A4, A6 and A8, and only there', () => {
    for (const name of T11_BOARDS) {
      const b = named(name);
      const all = offeredSymmetries(b).map((s) => foldContext(b, symmetryToLabels(b, s)).folded === null);
      expect(all.every((x) => x), name).toBe(['A2', 'A4', 'A6', 'A8'].includes(name));
    }
  });
});

describe('T11 boards and symmetries (plan 5.1, 5.2)', () => {
  it('offered boards are exactly the named types with a symmetry other than the identity', () => {
    expect(TYPE_NAMES).toHaveLength(32);
    const withSymmetry = TYPE_NAMES.filter((name) => symmetries(named(name)).length > 1);
    expect([...T11_BOARDS]).toEqual(withSymmetry);
    expect(T11.boards).toEqual(withSymmetry);
  });

  it('the identity is not offered; D4 lists five symmetries in the engine order, every other board one', () => {
    for (const name of T11_BOARDS) {
      const b = named(name);
      const all = symmetries(b);
      expect(all[0]).toEqual(b.labels.map((_, p) => p));
      expect(offeredSymmetries(b)).toEqual(all.slice(1));
      expect(offeredSymmetries(b)).toHaveLength(name === 'D4' ? 5 : 1);
    }
    const d4 = named('D4');
    expect(offeredSymmetries(d4).map((s) => symmetryToLabels(d4, s).join('.'))).toEqual(['1.2.4.3', '3.2.1.4', '3.2.4.1', '4.2.1.3', '4.2.3.1']);
    expect(defaultSymmetry(d4)).toEqual([1, 2, 4, 3]);
    expect(defaultSymmetry(named('A3'))).toEqual([3, 2, 1]);
    expect(defaultSymmetry(named('E6'))).toEqual([6, 2, 5, 4, 3, 1]);
    expect(defaultSymmetry(named('D5'))).toEqual([1, 2, 3, 5, 4]);
  });

  it('the default symmetry is the golden row\'s symmetry where the board has a row, and folds as the engine says elsewhere', () => {
    for (const name of ['A3', 'A4', 'A5', 'A7', 'D5', 'D6', 'E6']) {
      const row = rows.filter((r) => r.type === name);
      expect(row, name).toHaveLength(1);
      expect(defaultSymmetry(named(name))).toEqual(row[0]!.symmetry);
    }
    expect(defaultSymmetry(named('D4'))).toEqual(matchRecord(rows, { type: 'D4', symmetry: [1, 2, 4, 3] }).symmetry);
    for (const name of ['A2', 'A6', 'A8', 'D7', 'D8']) {
      const b = named(name);
      const sym = defaultSymmetry(b);
      const engine = fold(b, symmetryToPositions(b, sym));
      const ctx = foldContext(b, sym);
      expect(ctx.folded === null).toBe(engine.folded === null);
      if (engine.folded !== null) expect(ctx.foldedName).toBe(engine.folded.name);
    }
    // The three swaps of D4 (1.2.4.3, 3.2.1.4, 4.2.3.1) fold to C3, the two rotations (3.2.4.1, 4.2.1.3) to G2.
    const d4 = named('D4');
    expect(offeredSymmetries(d4).map((s) => foldContext(d4, symmetryToLabels(d4, s)).foldedName)).toEqual(['C3', 'C3', 'G2', 'G2', 'C3']);
    expect(offeredSymmetries(d4).map((s) => foldContext(d4, symmetryToLabels(d4, s)).order)).toEqual([2, 2, 3, 3, 2]);
    // The swaps give C3 in three orbit orders (the instruction's trap 3), each orbit at its Bourbaki label.
    expect(orbitsInBourbakiOrder(foldContext(d4, [1, 2, 4, 3]))).toEqual([[1], [2], [3, 4]]);
    expect(orbitsInBourbakiOrder(foldContext(d4, [3, 2, 1, 4]))).toEqual([[4], [2], [1, 3]]);
    expect(orbitsInBourbakiOrder(foldContext(d4, [4, 2, 3, 1]))).toEqual([[3], [2], [1, 4]]);
    // A permutation that is not a symmetry is refused (fold itself does not check, like the oracle).
    expect(() => foldContext(named('A3'), [1, 3, 2])).toThrow(RangeError);
  });

  it('symmetries convert between labels and positions only through toLabels and toPositions', () => {
    for (const name of T11_BOARDS) {
      const b = named(name);
      for (const s of offeredSymmetries(b)) {
        const images = symmetryToLabels(b, s);
        expect(symmetryToPositions(b, images)).toEqual([...s]);
      }
    }
    expect(() => symmetryToPositions(named('A3'), [3, 2])).toThrow(RangeError);
  });

  it('a symmetry is shown by its orbits in labels with its order', () => {
    const a3 = named('A3');
    const d4 = named('D4');
    expect(symmetryText(foldContext(a3, [3, 2, 1]))).toBe('{1, 3} {2}, order 2');
    expect(symmetryText(foldContext(d4, [3, 2, 4, 1]))).toBe('{1, 3, 4} {2}, order 3');
    expect(orbitText([2, 3])).toBe('{2, 3}');
  });

  it('the worked values of the instruction (from the oracle)', () => {
    // A3, flip, numbers from all ones: one symmetric move on the orbit of node 1.
    const a3 = new FoldBench({ board: 'A3', view: 'numbers', symmetry: [3, 2, 1] });
    a3.act(orbitOfLabel(a3.ctx, 1));
    expect(a3.bigInLabelOrder()).toEqual(['-1', '3', '-1']);
    expect(a3.foldedInLabelOrder()).toEqual(['-1', '3']);
    // D4, rotation 3.2.4.1, numbers from all ones: folded G2 shows -1 on its node 2 and 4 on its node 1.
    const d4 = new FoldBench({ board: 'D4', view: 'numbers', symmetry: [3, 2, 4, 1] });
    expect(d4.ctx.foldedName).toBe('G2');
    expect([...d4.ctx.folded!.labels]).toEqual([2, 1]);
    d4.act(orbitOfLabel(d4.ctx, 1));
    expect(d4.bigInLabelOrder()).toEqual(['-1', '4', '-1', '-1']);
    expect(d4.foldedInLabelOrder()).toEqual(['4', '-1']);
    // A3, populations from (1, 0, 1): mutating the orbit of city 1.
    const pops = new FoldBench({ board: 'A3', view: 'populations', symmetry: [3, 2, 1] });
    expect(pops.start).toEqual([1, 0, 1]);
    pops.act(orbitOfLabel(pops.ctx, 1));
    expect(pops.bigInLabelOrder()).toEqual(['-1', '0', '-1']);
    expect(pops.foldedInLabelOrder()).toEqual(['-1', '0']);
  });
});

describe('T11 state, moves and links (plan 5.3, 6.6)', () => {
  it('a symmetric move is recorded as the lowest label of its orbit and expands in increasing position', () => {
    const defaults = A3_DEFAULTS();
    const { state, notice } = admitLink('?w=3', defaults, '');
    expect(notice).toBeNull();
    expect(state.moves).toEqual([1]);
    expect(encodeState(state)).toContain('w=1');
    const ctx = foldContext(named('A3'), [3, 2, 1]);
    expect(expandMove(ctx, orbitOfLabel(ctx, 3))).toEqual([0, 2]);
    expect(expandMove(ctx, orbitOfLabel(ctx, 1))).toEqual([0, 2]);
    expect(foldedWord(ctx, [1])).toEqual([0]);
    expect(foldedWord(ctx, [3, 2])).toEqual([0, 1]);
    // On D4 with the rotation the orbit {1, 3, 4} expands to three positions, increasing.
    const d4 = foldContext(named('D4'), [3, 2, 4, 1]);
    expect(expandMove(d4, orbitOfLabel(d4, 4))).toEqual([0, 2, 3]);
    // The bench records the orbit's lowest label, one entry per symmetric move.
    const bench = new FoldBench({ board: 'A3', view: 'numbers', symmetry: [3, 2, 1] });
    bench.act(orbitOfLabel(bench.ctx, 3));
    bench.act(orbitOfLabel(bench.ctx, 2));
    expect(bench.state().moves).toEqual([1, 2]);
    // Undo removes one symmetric move, and both boards return to the position before it.
    const before = bench.foldedInLabelOrder(1);
    bench.scrub(1);
    expect(bench.state().moves).toEqual([1]);
    expect(bench.foldedInLabelOrder()).toEqual(before);
    expect(bench.bigInLabelOrder()).toEqual(['-1', '3', '-1']);
  });

  it('the state round-trips through encodeState and decodeState with y, and a y that is not a symmetry loads the defaults with the notice', () => {
    const defaults = defaultsOf('D4', [1, 2, 4, 3]);
    const bench = new FoldBench({ board: 'D4', view: 'numbers', symmetry: [3, 2, 4, 1] });
    bench.act(orbitOfLabel(bench.ctx, 1));
    bench.act(orbitOfLabel(bench.ctx, 2));
    const state = bench.state();
    const query = encodeState(state);
    expect(query).toContain('y=3.2.4.1');
    expect(query).toContain('w=1.2');
    const { state: back, notice } = admitLink(`?${query}`, defaults, '');
    expect(notice).toBeNull();
    expect(back).toEqual(state);
    expect(decodeState(query, 'fold', defaults).state.symmetry).toEqual([3, 2, 4, 1]);
    // y=1.3.2 on A3 is not a symmetry (6.6 rule 7).
    const bad = admitLink('?g=A3&y=1.3.2', A3_DEFAULTS(), '');
    expect(bad.notice).toBe(LINK_NOTICE);
    expect(bad.state).toEqual(A3_DEFAULTS());
    // The identity is a symmetry the tool does not offer (plan): the defaults with the notice.
    expect(admitLink('?g=A3&y=1.2.3', A3_DEFAULTS(), '').notice).toBe(LINK_NOTICE);
    // A board the tool does not offer (6.6 rule 8).
    expect(admitLink('?g=B3', A3_DEFAULTS(), '').notice).toBe(LINK_NOTICE);
    // A new board without y takes that board's default symmetry, start and no moves.
    const d5 = admitLink('?g=D5', A3_DEFAULTS(), '');
    expect(d5.notice).toBeNull();
    expect(d5.state.symmetry).toEqual([1, 2, 3, 5, 4]);
    expect(d5.state.start).toEqual([1, 1, 1, 1, 1]);
    expect(d5.state.moves).toEqual([]);
    // With a prefix on a lesson page.
    const pre = admitLink('?b1.g=D4&b1.y=3.2.4.1&b1.w=4', A3_DEFAULTS(), 'b1');
    expect(pre.notice).toBeNull();
    expect(pre.state.moves).toEqual([1]);
    expect(encodeState(pre.state, { prefix: 'b1' })).toContain('b1.y=3.2.4.1');
  });

  it('a link with v=l loads the defaults with the notice, and a parseable m is ignored and not written back', () => {
    const defaults = A3_DEFAULTS();
    const linked = admitLink('?g=A3&v=l&w=1', defaults, '');
    expect(linked.notice).toBe(LINK_NOTICE);
    expect(linked.state).toEqual(defaults);
    const withMode = admitLink('?g=A3&m=l&w=1', defaults, '');
    expect(withMode.notice).toBeNull();
    expect(withMode.state.moves).toEqual([1]);
    expect(withMode.state.mode).toBeUndefined();
    expect(encodeState(withMode.state)).not.toMatch(/(^|&)m=/);
    // Raising mode is ignored too (it would not be allowed with the numbers view in T1's table).
    expect(admitLink('?g=A3&m=r&w=1', defaults, '').notice).toBeNull();
    const unparsed = admitLink('?g=A3&m=z', defaults, '');
    expect(unparsed.notice).toBe(LINK_NOTICE);
    expect(unparsed.state).toEqual(defaults);
  });

  it('a start that is not constant on orbits, a mismatch of view and coords, or moves on a board that does not fold load the defaults with the notice', () => {
    const defaults = A3_DEFAULTS();
    expect(admitLink('?c=n&s=1,2,3', defaults, '').notice).toBe(LINK_NOTICE);
    expect(admitLink('?c=n&s=2,5,2', defaults, '').notice).toBeNull();
    expect(admitLink('?v=p&c=n', defaults, '').notice).toBe(LINK_NOTICE);
    expect(admitLink('?g=A4&w=1', defaults, '').notice).toBe(LINK_NOTICE);
    expect(isSymmetricStart(foldContext(named('A3'), [3, 2, 1]), [1, 2, 1])).toBe(true);
    expect(isSymmetricStart(foldContext(named('A3'), [3, 2, 1]), [1, 2, 3])).toBe(false);
  });

  it('the view decides the game and the default start: all ones, or one Martian in every city of the orbit of city 1', () => {
    const pops = admitLink('?v=p', A3_DEFAULTS(), '');
    expect(pops.notice).toBeNull();
    expect(pops.state.view).toBe('populations');
    expect(pops.state.coords).toBe('populations');
    expect(pops.state.start).toEqual([1, 0, 1]);
    const e6 = named('E6');
    expect(defaultStart(e6, 'populations', foldContext(e6, [6, 2, 5, 4, 3, 1]).orbits)).toEqual([1, 0, 0, 0, 0, 1]);
    const d4 = named('D4');
    expect(defaultStart(d4, 'populations', foldContext(d4, [1, 2, 4, 3]).orbits)).toEqual([1, 0, 0, 0]);
    expect(defaultStart(d4, 'populations', foldContext(d4, [3, 2, 1, 4]).orbits)).toEqual([1, 0, 1, 0]);
    expect(defaultStart(d4, 'numbers', foldContext(d4, [3, 2, 1, 4]).orbits)).toEqual([1, 1, 1, 1]);
  });

  it('presets are state objects: fold on A3 and average on A5, the tab outside the state', () => {
    for (const [id, p] of Object.entries(T11_PRESETS)) {
      const b = named(p.board);
      expect(p.symmetry, id).toEqual(defaultSymmetry(b));
      expect(p.start, id).toEqual(defaultStart(b, p.view, foldContext(b, p.symmetry).orbits));
      expect(p.coords).toBe(p.view);
    }
    expect(T11_PRESETS.default.tab).toBe('fold');
    expect(T11_PRESETS.average.tab).toBe('average');
    expect(T11_PRESETS.fold.caption).toBe(FOLD_CAPTION);
    expect(T11_PRESETS.average.caption).toBe(AVERAGE_CAPTION);
    // The golden slot: present as data, not released in phase 4.
    expect(T11_TABS.map((t) => [t.id, t.released])).toEqual([['fold', true], ['average', true], ['golden', false]]);
    expect(CONSTRUCTION.fold).toBe('Folding the board (orbit sums)');
    expect(CONSTRUCTION.average).toBe('Restricting the roots (orbit averages)');
  });
});

describe('T11 announcements (A-4; plan wording)', () => {
  it('a symmetric move of two and of three nodes, a one-node orbit, and the changed-nodes form above four nodes', () => {
    const a3 = new FoldBench({ board: 'A3', view: 'numbers', symmetry: [3, 2, 1] });
    const r = a3.act(orbitOfLabel(a3.ctx, 1))!;
    expect(announceSymmetric(a3, r)).toBe('Fired nodes 1 and 3. Numbers now minus 1, 3, minus 1. Move 1.');
    const one = a3.act(orbitOfLabel(a3.ctx, 2))!;
    expect(announceSymmetric(a3, one)).toBe('Fired node 2. Numbers now 2, minus 3, 2. Move 2.');
    const d4 = new FoldBench({ board: 'D4', view: 'numbers', symmetry: [3, 2, 4, 1] });
    expect(announceSymmetric(d4, d4.act(orbitOfLabel(d4.ctx, 1))!)).toBe('Fired nodes 1, 3 and 4. Numbers now minus 1, 4, minus 1, minus 1. Move 1.');
    const pops = new FoldBench({ board: 'A3', view: 'populations', symmetry: [3, 2, 1] });
    expect(announceSymmetric(pops, pops.act(orbitOfLabel(pops.ctx, 1))!)).toBe('Mutated cities 1 and 3. Populations now minus 1, 0, minus 1. Move 1.');
    const a5 = new FoldBench({ board: 'A5', view: 'numbers', symmetry: [5, 4, 3, 2, 1] });
    expect(announceSymmetric(a5, a5.act(orbitOfLabel(a5.ctx, 1))!)).toBe('Fired nodes 1 and 5. Node 1 now minus 1, node 2 now 2, node 4 now 2, node 5 now minus 1. Move 1.');
    const a5p = new FoldBench({ board: 'A5', view: 'populations', symmetry: [5, 4, 3, 2, 1] });
    expect(announceSymmetric(a5p, a5p.act(orbitOfLabel(a5p.ctx, 2))!)).toBe('Mutated cities 2 and 4. City 2 now 1, city 4 now 1. Move 1.');
    expect(announceSymmetric(a5p, a5p.act(orbitOfLabel(a5p.ctx, 3))!)).toBe('Mutated city 3. City 3 now 2. Move 2.');
    expect(undoAnnouncement(a3, 2, 1)).toBe('Undid move 2. Numbers now minus 1, 3, minus 1.');
  });
});

describe('T11 export, worker and hints (4.0 Share and export; E-9)', () => {
  it('exportData gives the orbits, the folded name and Cartan matrix, the averaged type and both position lists', () => {
    const bench = new FoldBench({ board: 'A3', view: 'numbers', symmetry: [3, 2, 1] });
    bench.act(orbitOfLabel(bench.ctx, 1));
    const row = matchRecord(rows, { type: 'A3', symmetry: [3, 2, 1] });
    const d = exportData(bench) as {
      view: string;
      symmetry: { images: number[]; orbits: number[][]; order: number };
      folded: { name: string; labels: number[]; cartan: number[][]; orbitsInBourbakiOrder: number[][] } | null;
      averaged: { name: string; classes: { class: string; roots: number; form_value: string }[] };
      bigPositions: (number | string)[][];
      foldedPositions: (number | string)[][];
    };
    expect(d.view).toBe('numbers');
    expect(d.symmetry.images).toEqual([3, 2, 1]);
    intEq(d.symmetry.orbits, row.orbits);
    intEq(d.symmetry.order, row.order);
    expect(d.folded!.name).toBe(row.folds_to);
    intEq(d.folded!.cartan, row.folded_cartan);
    intEq(d.folded!.orbitsInBourbakiOrder, row.folded_orbits_in_bourbaki_order);
    expect(d.folded!.labels).toEqual([1, 2]);
    expect(d.averaged.name).toBe(row.averaged_roots_type);
    expect(d.averaged.classes).toEqual(row.averaged_root_classes);
    expect(d.bigPositions).toEqual([[1, 1, 1], [-1, 3, -1]]);
    expect(d.foldedPositions).toEqual([[1, 1], [-1, 3]]);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    // A board that does not fold exports no folded board and its message.
    const a4 = exportData(new FoldBench({ board: 'A4', view: 'numbers', symmetry: [4, 3, 2, 1] })) as { folded: unknown; foldMessage: string; foldedPositions: unknown };
    expect(a4.folded).toBeNull();
    expect(a4.foldedPositions).toBeNull();
    expect(a4.foldMessage).toContain('an orbit contains an edge');
  });

  it('a link whose expanded word has more than 2000 moves is played in the worker', () => {
    const a3 = named('A3');
    const ctx = foldContext(a3, [3, 2, 1]);
    const word = (k: number): number[] => Array.from({ length: k }, () => 1);
    expect(playHint(a3, foldedWord(ctx, word(1001)).flatMap((s) => expandMove(ctx, s)).length)).toEqual({ board: a3, kind: 'play', moves: 2002 });
    expect(whereToRun(playHint(a3, 2002))).toBe('worker');
    expect(whereToRun(playHint(a3, 2000))).toBe('main');
    const long = new FoldBench({ board: 'A3', view: 'numbers', symmetry: [3, 2, 1], moves: word(1001) }, { defer: true });
    expect(long.hints().big.moves).toBe(2002);
    expect(long.hints().folded.moves).toBe(1001);
    expect(long.needsWorker()).toBe(true);
    expect(new FoldBench({ board: 'A3', view: 'numbers', symmetry: [3, 2, 1], moves: word(1000) }, { defer: true }).needsWorker()).toBe(false);
    // The averaged roots run on the main thread: the roots of a finite board are known in advance.
    for (const name of T11_BOARDS) {
      const b = named(name);
      expect(rootCount(name)).toBe(roots(b as Board<number>, 1000).items.length);
      expect(averagedHint(b)).toEqual({ board: b, kind: 'enumeration', finiteKnown: true, expectedItems: rootCount(name) });
      expect(whereToRun(averagedHint(b))).toBe('main');
    }
  });

  it('the worker replay (positionsOf on each board) gives the positions of the main-thread replay', () => {
    for (const [board, symmetry, view] of [['A3', [3, 2, 1], 'numbers'], ['D4', [3, 2, 4, 1], 'populations'], ['E6', [6, 2, 5, 4, 3, 1], 'numbers']] as const) {
      const moves: number[] = [];
      const b = named(board);
      const ctx = foldContext(b, [...symmetry]);
      for (let k = 0; k < 30; k++) moves.push(Math.min(...toLabels(b, ctx.orbits[(k * 7) % ctx.orbits.length]!)));
      const sync = new FoldBench({ board, view, symmetry: [...symmetry], moves });
      const deferred = new FoldBench({ board, view, symmetry: [...symmetry], moves }, { defer: true });
      expect(deferred.pending).toBe(true);
      const calls = deferred.workerStates();
      deferred.acceptReplay(positionsOf(calls.big), positionsOf(calls.folded));
      expect(deferred.pending).toBe(false);
      for (let k = 0; k <= moves.length; k++) {
        expect(deferred.bigInLabelOrder(k)).toEqual(sync.bigInLabelOrder(k));
        expect(deferred.foldedInLabelOrder(k)).toEqual(sync.foldedInLabelOrder(k));
      }
    }
  });

  it('a start beyond the safe range plays in Big with no message', () => {
    const huge = '123456789012345678901234567890';
    const bench = new FoldBench({ board: 'A3', view: 'numbers', symmetry: [3, 2, 1], start: [huge, huge, huge] });
    bench.act(0);
    expect(bench.bigInLabelOrder()).toEqual([`-${huge}`, (3n * BigInt(huge)).toString(), `-${huge}`]);
    expect(bench.foldedInLabelOrder()).toEqual([`-${huge}`, (3n * BigInt(huge)).toString()]);
  });
});

describe('T11 registry entry (CONTRACTS 5.2; plan 5.14)', () => {
  it('the T11 registry entry has id fold, number 11, phase 4, presets fold and average, and lists every data-out name', async () => {
    expect(T11.id).toBe('fold');
    expect(T11.number).toBe(11);
    expect(T11.phase).toBe(4);
    expect(T11.title).toBe('Folding Bench');
    expect(Object.keys(T11.presets).sort()).toEqual(['average', 'default', 'fold']);
    expect(T11.presets).not.toHaveProperty('golden');
    for (const id of ['default', 'fold', 'average'] as const) {
      const { tab: _tab, ...fields } = T11_PRESETS[id];
      expect(T11.presets[id]).toEqual(fields);
    }
    // Every data-out name the server renders in the cases of the tool is listed (4.0 Test hooks).
    const bodies = [
      loader.render(T11C.default, { id: '' }),
      loader.render(T11C.default, { id: 'b1', board: 'A4', symmetry: [4, 3, 2, 1] }),
      loader.render(T11C.default, { id: 'b2', preset: 'average' }),
      loader.render(T11C.default, { id: 'b3', preset: 'average', board: 'A4', symmetry: [4, 3, 2, 1] }),
      loader.render(T11C.default, { id: 'b4', board: 'D4', symmetry: [3, 2, 4, 1], prediction: { question: 'Which?', answer: { type: 'number', value: 4 }, reveal: 'Four.' } }),
    ];
    const seen = new Set<string>();
    for (const body of bodies) for (const m of body.matchAll(/data-out="([^"]+)"/g)) seen.add(m[1]!);
    for (const name of seen) expect(T11.outs, name).toContain(name);
    for (const name of ['big-board', 'folded-board', 'folded-name', 'folded-name-note', 'fold-message', 'averaged-name', 'averaged-name-note', 'averaged-classes', 'orbits', 'construction']) {
      expect(T11.outs).toContain(name);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Server render (7.4, 4.0 "Works before and without JavaScript")
// ---------------------------------------------------------------------------------------------

type T11Module = { default: unknown };
let loader: SsrLoader;
let T11C: T11Module;

beforeAll(async () => {
  loader = await ssrLoader();
  T11C = await loader.load<T11Module>('/src/components/tools/T11FoldingBench.svelte');
}, 120000);

afterAll(async () => {
  await loader?.close();
});

const outText = (body: string, name: string): string[] =>
  [...body.matchAll(new RegExp(`data-out="${name}"[^>]*>([^]*?)</(?:p|span|div|li|ul|strong)>`, 'g'))].map((m) => m[1]!.replace(/<[^>]+>/g, '').replace(/<!--[^]*?-->/g, '').trim());

describe('T11 server render', () => {
  it('default state: A3 folded to B2 with both boards, the orbits, the construction, disabled controls and the table', () => {
    const body = loader.render(T11C.default, { id: '' });
    expect(body).toContain('data-tool="fold"');
    expect(body).toContain('data-moves="0"');
    expect(body).toContain('data-out="big-board"');
    expect(body).toContain('data-out="folded-board"');
    expect(outText(body, 'folded-name')).toEqual(['B2']);
    expect(body).toContain('data-out="folded-name-note"');
    expect(outText(body, 'construction')).toEqual(['Folding the board (orbit sums)']);
    expect(body).toContain('aria-label="Big board A3"');
    expect(body).toContain('aria-label="Folded board B2"');
    // Three big nodes and two folded nodes, all ones, all can act, all disabled before hydration.
    const buttons = [...body.matchAll(/<button[^>]*data-node="(\d+)"[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(5);
    for (const b of buttons) {
      expect(b).toContain('data-value="1"');
      expect(b).toContain('data-board="numbers"');
      expect(b).toContain('data-can-act="true"');
      expect(b).toMatch(/\sdisabled(=""|\s|>)/);
    }
    // Orbit colouring as decoration: rings and badges in edge colours, never a fill; the legend as text.
    expect(body).toMatch(/data-orbit-ring="1"/);
    expect(body).toContain('var(--edge-1)');
    expect(body).toContain('var(--edge-2)');
    expect(body).toMatch(/data-out="orbits"/);
    expect(body).toContain('{1, 3}');
    // Tabs: fold selected, average offered, golden not rendered; every tab disabled before hydration.
    expect(body).toMatch(/data-tab="fold"[^>]*aria-selected="true"|aria-selected="true"[^>]*data-tab="fold"/);
    expect(body).toContain('data-tab="average"');
    expect(body).not.toContain('data-tab="golden"');
    for (const t of body.match(/<button[^>]*role="tab"[^>]*>/g) ?? []) expect(t).toMatch(/\sdisabled/);
    for (const s of body.match(/<select[^>]*>/g) ?? []) expect(s).toMatch(/\sdisabled/);
    // The table view: one button per node of each board, in a details element.
    expect((body.match(/data-table-board="big"/g) ?? []).length).toBe(3);
    expect((body.match(/data-table-board="folded"/g) ?? []).length).toBe(2);
    expect(body).toContain('<noscript>');
    expect(body).toMatch(/data-live=""[^>]*><\/div>|<div[^>]*data-live=""[^>]*><\/div>/);
    expect(body).not.toContain('data-out="fold-message"');
    expect(body).not.toContain('quasi');
  });

  it('A4 with the flip: the message in place of the folded board, and no node can act', () => {
    const body = loader.render(T11C.default, { id: 'b1', board: 'A4', symmetry: [4, 3, 2, 1] });
    expect(outText(body, 'fold-message')[0]).toContain('an orbit contains an edge');
    expect(body).not.toContain('data-out="folded-board"');
    const buttons = [...body.matchAll(/<button[^>]*data-node="(\d+)"[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(4);
    for (const b of buttons) expect(b).toContain('data-can-act="false"');
  });

  it('the average tab: A5 averages to C3 beside the folded B3; A4 gives BC2 with three classes; A3 carries the B2 = C2 note', () => {
    const a5 = loader.render(T11C.default, { id: 'b2', preset: 'average' });
    expect(outText(a5, 'construction')).toEqual(['Restricting the roots (orbit averages)']);
    expect(outText(a5, 'averaged-name')).toEqual(['C3']);
    expect(outText(a5, 'folded-name')).toEqual(['B3']);
    expect(a5).not.toContain('data-out="averaged-name-note"');
    expect(a5).toContain('data-out="averaged-classes"');
    const a4 = loader.render(T11C.default, { id: 'b3', preset: 'average', board: 'A4', symmetry: [4, 3, 2, 1] });
    expect(outText(a4, 'averaged-name')).toEqual(['BC2']);
    const classRows = [...a4.matchAll(/<tr data-class="([a-z]+)"[^>]*>([^]*?)<\/tr>/g)].map((m) => [m[1], m[2]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()]);
    expect(classRows).toEqual([
      ['short', 'short 4 1/2'],
      ['medium', 'medium 4 1'],
      ['long', 'long 4 2'],
    ]);
    expect(a4).not.toContain('data-out="averaged-name-note"');
    const a3 = loader.render(T11C.default, { id: 'b4', preset: 'average', board: 'A3', symmetry: [3, 2, 1], start: [1, 1, 1] });
    expect(outText(a3, 'averaged-name')).toEqual(['B2']);
    expect(a3).toContain('data-out="averaged-name-note"');
    const g2 = loader.render(T11C.default, { id: 'b5', preset: 'average', board: 'D4', symmetry: [3, 2, 4, 1] });
    expect(outText(g2, 'averaged-name')).toEqual(['G2']);
    expect(g2).not.toContain('data-out="averaged-name-note"');
  });

  it('D4 with the rotation: the folded G2 is drawn in Bourbaki order, its node 2 the long orbit {1, 3, 4}', () => {
    const body = loader.render(T11C.default, { id: 'b6', board: 'D4', symmetry: [3, 2, 4, 1] });
    expect(outText(body, 'folded-name')).toEqual(['G2']);
    const folded = body.slice(body.indexOf('data-out="folded-board"'), body.indexOf('data-out="orbits"'));
    const order = (folded.match(/<button[^>]*data-node="\d+"[^>]*>/g) ?? []).map((tag) => [Number(/data-node="(\d+)"/.exec(tag)![1]), Number(/left: ([\d.]+)%/.exec(tag)![1])] as const);
    expect(order).toHaveLength(2);
    // Label 1 is drawn left of label 2 (6.1: node i at (i, 0)), whatever the order of the positions.
    const x = new Map(order.map(([l, left]) => [l, left]));
    expect(x.get(1)!).toBeLessThan(x.get(2)!);
    // The long orbit {1, 3, 4} is folded node 2: its ring has colour 2 on both boards, {2} colour 1.
    expect(folded).toMatch(/data-ring-node="2" data-orbit-ring="2"/);
    expect(folded).toMatch(/data-ring-node="1" data-orbit-ring="1"/);
    const big = body.slice(body.indexOf('data-out="big-board"'), body.indexOf('data-out="folded-board"'));
    for (const l of [1, 3, 4]) expect(big).toMatch(new RegExp(`data-ring-node="${l}" data-orbit-ring="2"`));
    expect(big).toMatch(/data-ring-node="2" data-orbit-ring="1"/);
  });

  it('authoring errors fail the build naming the instance', () => {
    expect(() => loader.render(T11C.default, { id: 'b7', board: 'B3' })).toThrow(/b7/);
    expect(() => loader.render(T11C.default, { id: 'b7', board: 'A3', symmetry: [1, 3, 2] })).toThrow(/b7/);
    expect(() => loader.render(T11C.default, { id: 'b7', board: 'A3', start: [1, 2, 3] })).toThrow(/b7/);
    expect(() => loader.render(T11C.default, { id: 'b7', board: 'A4', symmetry: [4, 3, 2, 1], moves: [1] })).toThrow(/b7/);
  });
});
