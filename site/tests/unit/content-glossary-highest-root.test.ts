// The glossary's entries "highest root" (row 35) and "root poset" (row 36), checked on every board of finite type.
// Adopted from two lenses of the phase 6 round:
//   RT-09: site/tests/unit/redteam-RT-09-p6-glossary-history.test.ts, describe P6-RT-09-01 (branch
//     worktree-agent-a59a82db3a362f1d9), on B2, B3, C3, F4, G2 with the oracle's values typed in;
//   RT-13: redteam/redteam-RT-13-p6-oracle-highest.py (branch worktree-agent-a46277fe7c5321fb3), a script over the
//     32 boards of finite type of rank at most eight, which becomes the loop over the golden types below.
// As found at f07eec6 the two definitions were "On a board of finite type, the root population at which no mutation
// raises any city." and "The positive root populations of a board, arranged by total population, with an edge from
// one to another wherever a mutation raises a city." Both are facts of the boards with single roads (M1 beats 3
// and 4 say them of E8 and of "a board of finite type with single roads"). On the 16 boards B2 to B8, C2 to C8, F4
// and G2 two root populations are raised by no mutation, the highest root and the highest short root (SPEC 2.6:
// "the root population of largest form value that no mutation raises"; 2.7 F13; 4 T9), and the raising moves of
// B2 are not the covering pairs of its root poset (4 T2 and 2.16 say that they are only "on a simply laced board
// of finite type").
// The reproducers asserted the counterexamples away, which can never pass; as in the adoptions of P3-RT-09-02
// (decisions/RT-FIX-P3-lesson-m5.md) and P4-RT-09-02 (content-m6-root-lengths.test.ts), each test keeps the
// computations with the values the reproducers observed and asserts the finding's expected instead: what each
// definition says is true, computed with the engine on all 32 boards and compared with the golden file.
// Run: npx vitest run --project site-unit site/tests/unit/content-glossary-highest-root.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, formValue, kostantPlay, mutate, ratToString, roots } from '@engine';
import type { Board } from '@engine';
import golden from '../../../reference/golden_data.json';

const GLOSSARY = readFileSync(fileURLToPath(new URL('../../src/content/pages/glossary.mdx', import.meta.url)), 'utf8');

interface GoldenType {
  cartan: number[][];
  n_roots: number;
  simply_laced: boolean;
  highest_root: number[];
  highest_short_root?: number[];
}
const TYPES = (golden as unknown as { types: Record<string, GoldenType> }).types;
const KOSTANT = (golden as unknown as { kostant: Record<string, { end_from_node: number[][] }> }).kostant;

/** The definition of the glossary entry whose dfn has this id, as written in the source. */
function definition(id: string): string {
  const at = GLOSSARY.indexOf(`<dfn id="${id}">`);
  expect(at, `glossary entry ${id}`).toBeGreaterThan(0);
  const m = /<dd data-col="definition">([^]*?)<\/dd>/.exec(GLOSSARY.slice(at));
  return m![1]!.trim();
}
/** The same, as the reader reads it: markup taken out, spaces collapsed. */
const plain = (s: string): string => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const key = (p: readonly number[]): string => `(${p.join(',')})`;

interface BoardData {
  board: Board<number>;
  roots: number[][];
  positive: number[][];
  form: (p: number[]) => number;
  /** The cities (positions) that a mutation would raise at p, with the rise. */
  raises: (p: number[]) => { i: number; to: number[]; rise: number }[];
}

function data(name: string): BoardData {
  const board = boardFromName(name) as Board<number>;
  const all = roots(board, 2000);
  expect(all.truncated, `${name}: the roots are complete`).toBe(false);
  const list = all.items.map((p) => p.map(Number));
  return {
    board,
    roots: list,
    positive: list.filter((p) => p.every((x) => x >= 0)),
    form: (p) => Number(ratToString(formValue(board, p)!)),
    raises: (p) => {
      const out: { i: number; to: number[]; rise: number }[] = [];
      for (let i = 0; i < board.n; i++) {
        const q = mutate(board, p, i).map(Number);
        if (q[i]! > p[i]!) out.push({ i, to: q, rise: q[i]! - p[i]! });
      }
      return out;
    },
  };
}

describe('glossary rows 35 and 36 on every board of finite type', () => {
  const names = Object.keys(TYPES);

  // regression: P6-RT-09-01
  // regression: P6-RT-13-01
  it('highest root: the definition names one root population on each of the 32 boards, and it is the highest root', () => {
    expect(names, 'the 32 boards of finite type of rank at most eight').toHaveLength(32);
    // RT-09's cases, with the oracle's values:
    // oracle: [r for r in roots(cartan(L,n)) if all(mutate(cartan(L,n), r, i)[i] <= r[i] for i in range(n))]
    //   B2 [(1,1),(1,2)]; B3 [(1,1,1),(1,2,2)]; C3 [(1,2,1),(2,2,1)]; F4 [(1,2,3,2),(2,3,4,2)]; G2 [(2,1),(3,2)]
    //   highest_root: B2 (1,2), B3 (1,2,2), C3 (2,2,1), F4 (2,3,4,2), G2 (3,2); the other is highest_short_root
    const cases: [string, number[], number[]][] = [
      ['B2', [1, 2], [1, 1]],
      ['B3', [1, 2, 2], [1, 1, 1]],
      ['C3', [2, 2, 1], [1, 2, 1]],
      ['F4', [2, 3, 4, 2], [1, 2, 3, 2]],
      ['G2', [3, 2], [2, 1]],
    ];
    for (const [name, highest, highestShort] of cases) {
      const d = data(name);
      expect(d.raises(highest), `${name}: no mutation raises the highest root`).toEqual([]);
      expect(d.raises(highestShort), `${name}: no mutation raises the highest short root either`).toEqual([]);
      expect([TYPES[name]!.highest_root, TYPES[name]!.highest_short_root]).toEqual([highest, highestShort]);
    }
    // RT-13's loop over every board: the root populations at which no mutation raises any city.
    const two: string[] = [];
    for (const name of names) {
      const t = TYPES[name]!;
      const d = data(name);
      expect(d.board.cartan.map((r) => r.map(Number)), `${name}: the board of the golden file`).toEqual(t.cartan);
      expect(d.roots, `${name}: every root`).toHaveLength(t.n_roots);
      const unraised = d.roots.filter((p) => d.raises(p).length === 0);
      if (unraised.length > 1) two.push(`${name} ${unraised.map(key).join(' ')}`);
      // The rule of the definition: of largest form value (over all the roots), and raised by no mutation.
      const largest = Math.max(...d.roots.map(d.form));
      expect(unraised.filter((p) => d.form(p) === largest).map(key), `${name}: the rule names the highest root`).toEqual([key(t.highest_root)]);
      // The second statement: with single roads it is the only one; with a double or triple road there is exactly
      // one other, the highest short root, of smaller form value.
      const single = d.board.cartan.every((row, i) => row.every((x, j) => i === j || Number(x) >= -1));
      expect(single, `${name}: single roads exactly when simply laced`).toBe(t.simply_laced);
      if (single) {
        expect(unraised.map(key), `${name}: single roads, one root population raised by no mutation`).toEqual([key(t.highest_root)]);
      } else {
        expect(unraised.map(key).sort(), `${name}: two root populations raised by no mutation`).toEqual([key(t.highest_root), key(t.highest_short_root!)].sort());
        expect(d.form(t.highest_short_root!), `${name}: the highest short root has the smaller form value`).toBeLessThan(d.form(t.highest_root));
      }
      // Kostant's game ends at the highest short root exactly when it starts from a short simple root population
      // (SPEC 2.7 F13), and at the highest root otherwise.
      for (let i = 0; i < d.board.n; i++) {
        const end = kostantPlay(d.board, i);
        expect(end.status).toBe('ended');
        const e = d.board.cartan.map((_, k) => (k === i ? 1 : 0));
        const want = d.form(e) < largest ? t.highest_short_root! : t.highest_root;
        expect(end.position.map(Number), `${name}: Kostant's game from city ${i + 1}`).toEqual(want);
        expect(end.position.map(Number)).toEqual(KOSTANT[name]!.end_from_node[i]);
      }
    }
    expect(two, 'the boards with a double or triple road').toHaveLength(16);
    // What the definition says.
    const def = plain(definition('highest-root'));
    expect(
      def,
      `glossary "${def}": on ${two.length} of 32 boards two root populations are raised by no mutation (${two.join('; ')}); SPEC 2.6: "the root population of largest form value that no mutation raises"`,
    ).toMatch(/^On a board of finite type, the root population of largest form value at which no mutation raises any city\./);
    expect(def, 'the entry says that with single roads it is the only one').toMatch(/single roads, it is the only root population at which no mutation raises any city/);
    expect(def, 'the entry names the other one, the highest short root').toMatch(/double or triple road, there is exactly one other, of smaller form value: the highest short root/);
    expect(def, "the entry says where Kostant's game ends at the highest short root").toMatch(/Kostant's game, attributed to Kostant, ends there when it starts from a short simple root population/);
  });

  // regression: P6-RT-09-01
  it('root poset: the definition is the order of the positive root populations, and its raising moves are its covers only with single roads', () => {
    // RT-09's case, with the oracle's values:
    // oracle: positive_roots(roots(cartan('B',2))) = (1,0), (0,1), (1,1), (1,2); raising edges by mutate:
    //   (1,0) -> (1,2) at city 2 (a rise of 2) and (0,1) -> (1,1) at city 1; the root poset has the covering
    //   relations (1,0) < (1,1), (0,1) < (1,1), (1,1) < (1,2) (differences of one simple root).
    const b2 = data('B2');
    const b2Edges = b2.positive.flatMap((p) => b2.raises(p).map((r) => `${key(p)}->${key(r.to)}`)).sort();
    expect(b2Edges).toEqual(['(0,1)->(1,1)', '(1,0)->(1,2)']);
    const below = (p: number[], q: number[]): boolean => p.every((x, k) => x <= q[k]!) && p.some((x, k) => x < q[k]!);
    const covers = (pos: number[][]): string[] =>
      pos
        .flatMap((p) => pos.filter((q) => below(p, q) && !pos.some((r) => below(p, r) && below(r, q))).map((q) => `${key(p)}->${key(q)}`))
        .sort();
    expect(covers(b2.positive)).toEqual(['(0,1)->(1,1)', '(1,0)->(1,1)', '(1,1)->(1,2)']);
    for (const name of Object.keys(TYPES)) {
      const t = TYPES[name]!;
      const d = data(name);
      expect(d.positive, `${name}: half of the roots are positive`).toHaveLength(t.n_roots / 2);
      const hasse = covers(d.positive);
      // One lies directly below another exactly when they differ by one Martian in one city.
      for (const c of hasse) {
        const [p, q] = c.split('->').map((s) => s.slice(1, -1).split(',').map(Number));
        expect(q!.reduce((s, x, k) => s + x - p![k]!, 0), `${name}: ${c} differs by one Martian`).toBe(1);
      }
      const moves = d.positive.flatMap((p) => d.raises(p).map((r) => ({ edge: `${key(p)}->${key(r.to)}`, rise: r.rise, p, i: r.i })));
      if (t.simply_laced) {
        expect(moves.map((m) => m.edge).sort(), `${name}: single roads, the raising moves are the covers`).toEqual(hasse);
        expect(moves.every((m) => m.rise === 1), `${name}: every raising move adds one Martian`).toBe(true);
      } else {
        // A raising move that adds two or three Martians passes over a positive root population between.
        const big = moves.filter((m) => m.rise > 1);
        expect(big.length, `${name}: some raising move adds more than one Martian`).toBeGreaterThan(0);
        for (const m of big) {
          const between = m.p.map((x, k) => (k === m.i ? x + 1 : x));
          expect(d.positive.map(key), `${name}: ${m.edge} passes over ${key(between)}`).toContain(key(between));
        }
        expect(moves.map((m) => m.edge).sort(), `${name}: the raising moves are not the covers`).not.toEqual(hasse);
      }
    }
    const def = plain(definition('root-poset'));
    expect(
      def,
      `glossary "${def}": on B2 the raising moves are ${b2Edges.join(', ')}, the covers of the root poset ${covers(b2.positive).join(', ')}; SPEC 4 T2 and 2.16 call the picture the root poset only "on a simply laced board of finite type"`,
    ).toMatch(/^The positive root populations of a board, ordered so that one lies below another when no city holds more in the first than in the second\./);
    expect(def).toMatch(/On a board of finite type with single roads, one lies directly below another exactly when a raising move leads from the first to the second/);
    expect(def).toMatch(/With a double or triple road a raising move can add two or three Martians/);
  });
});
