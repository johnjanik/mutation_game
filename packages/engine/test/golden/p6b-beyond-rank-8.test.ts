// Ranks 9 to 16 of A, B, C and D (P6-A2 repair after review, finding 2; DECISIONS.md 'MERGE: P6-A2 reviewed;
// rulings' (2)). The golden data stop at rank 8, while satakeCatalogue accepts any rank the family allows
// (instruction 5.2), so beyond rank 8 the records are checked against the closed forms of the parametric table of
// SPEC.md 6.4: Cartan's label, the real form, the black nodes, tau, the restricted roots, the pair
// (m_lambda, m_2lambda) at each simple restricted root and dim k; with the multiplicities by length class of the
// oracle's satake_catalogue (`em`, reference/lie_games.py lines 1488 to 1550) and the identities that
// reference/verify.py checks for every record (section 7): the multiplicities sum to |Phi| - |Phi_X|, the
// character is 2r - n - |Phi_X|, the real rank is the number of tau-orbits of white nodes, dim k + dim p = dim g.
// The table is written in labels, as SPEC.md prints it; the records' positions are converted with toLabels (E-7).
// Then canonicalPair at positions 9 and above (A11, A13, D12; trap 9, the integer order): the least image over the
// symmetries of the board, written out here (the identity and the flip of A_n, the identity and the swap of the two
// short arms of D_n), and invariance under them, on pairs whose tau is a symmetry and on pairs whose tau is not.
// No golden key is read, so no covers(). No clock is read.
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import { boardFromName, toLabels } from '../../src/board';
import { symmetries } from '../../src/fold';
import { canonicalPair, matchCatalogue, satakeCatalogue, satakeRecord } from '../../src/satakeCatalogue';

// ---------------------------------------------------------------------------------------------
// The closed forms of SPEC.md 6.4, in labels
// ---------------------------------------------------------------------------------------------

type TauKind = 'identity' | 'flip' | 'swap';

interface Row {
  label: string;
  form: string;
  /** black nodes, labels, ascending */
  black: number[];
  tau: TauKind;
  /** the restricted roots as the table prints them; null for the compact form */
  display: string | null;
  /** (class, mult) for each length class, in the oracle's order; null for the compact form */
  em: [string, number][] | null;
  /** orbit of white nodes (labels, ascending, joined by commas) -> (m_lambda, m_2lambda) */
  simple: Record<string, [number, number]>;
  dk: number;
}

/** a, a + step, ..., up to b included (labels). */
function span(a: number, b: number, step = 1): number[] {
  const out: number[] = [];
  for (let k = a; k <= b; k += step) out.push(k);
  return out;
}

const choose2 = (x: number): number => (x * (x - 1)) / 2;
const orbitKey = (orbit: readonly number[]): string => [...orbit].sort((a, b) => a - b).join(',');

/** The same pair (m_lambda, m_2lambda) at every node of a list. */
function each(nodes: number[], m: [number, number]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const i of nodes) out[orbitKey([i])] = m;
  return out;
}

/** The images of the labels 1..n under tau (the flip i <-> n + 1 - i, the swap n - 1 <-> n). */
function tauLabels(kind: TauKind, n: number): number[] {
  const t = span(1, n);
  if (kind === 'flip') return t.map((i) => n + 1 - i);
  if (kind === 'swap') {
    t[n - 2] = n;
    t[n - 1] = n - 1;
  }
  return t;
}

/** dim g of the classical families. */
function dimG(L: string, n: number): number {
  if (L === 'A') return n * (n + 2);
  if (L === 'D') return n * (2 * n - 1);
  return n * (2 * n + 1);
}

/** The rows of SPEC.md 6.4 for the board L_n, in the order of the oracle's loops (compact form last). */
function table(L: string, n: number): Row[] {
  const rows: Row[] = [];
  if (L === 'A') {
    rows.push({ label: 'A I', form: `sl(${n + 1},R)`, black: [], tau: 'identity', display: `A${n}`, em: [['all', 1]], simple: each(span(1, n), [1, 0]), dk: (n * (n + 1)) / 2 });
    if (n % 2 === 1 && n >= 3) {
      const m = (n + 1) / 2;
      rows.push({ label: 'A II', form: `su*(${2 * m})`, black: span(1, n, 2), tau: 'identity', display: `A${m - 1}`, em: [['all', 4]], simple: each(span(2, n, 2), [4, 0]), dk: m * (2 * m + 1) });
    }
    for (let p = 1; p <= Math.floor((n + 1) / 2); p++) {
      const q = n + 1 - p;
      const simple: Record<string, [number, number]> = {};
      for (let i = 1; i < p; i++) simple[orbitKey([i, n + 1 - i])] = [2, 0];
      if (p < q) {
        simple[orbitKey([p, n + 1 - p])] = [2 * (q - p), 1];
        const em: [string, number][] = p === 1 ? [['short', 2 * (q - p)], ['long', 1]] : [['short', 2 * (q - p)], ['medium', 2], ['long', 1]];
        rows.push({ label: p === 1 ? 'A IV' : 'A III', form: `su(${p},${q})`, black: span(p + 1, n - p), tau: 'flip', display: `BC${p}`, em, simple, dk: p * p + q * q - 1 });
      } else {
        simple[orbitKey([p])] = [1, 0];
        rows.push({ label: 'A III', form: `su(${p},${p})`, black: [], tau: 'flip', display: `C${p}`, em: [['short', 2], ['long', 1]], simple, dk: 2 * p * p - 1 });
      }
    }
    rows.push({ label: 'compact', form: `su(${n + 1})`, black: span(1, n), tau: 'flip', display: null, em: null, simple: {}, dk: n * (n + 2) });
  } else if (L === 'B') {
    for (let p = 1; p <= n; p++) {
      const q = 2 * n + 1 - p;
      const simple = each(span(1, p - 1), [1, 0]);
      simple[orbitKey([p])] = [q - p, 0];
      const em: [string, number][] = p === 1 ? [['all', q - p]] : [['short', q - p], ['long', 1]];
      rows.push({ label: p === 1 ? 'B II' : 'B I', form: `so(${p},${q})`, black: span(p + 1, n), tau: 'identity', display: p === 1 ? 'A1' : `B${p}`, em, simple, dk: choose2(p) + choose2(q) });
    }
    rows.push({ label: 'compact', form: `so(${2 * n + 1})`, black: span(1, n), tau: 'identity', display: null, em: null, simple: {}, dk: n * (2 * n + 1) });
  } else if (L === 'C') {
    rows.push({ label: 'C I', form: `sp(${2 * n},R)`, black: [], tau: 'identity', display: `C${n}`, em: [['short', 1], ['long', 1]], simple: each(span(1, n), [1, 0]), dk: n * n });
    for (let p = 1; p <= Math.floor(n / 2); p++) {
      const q = n - p;
      const simple = each(span(2, 2 * p - 2, 2), [4, 0]);
      if (p < q) {
        simple[orbitKey([2 * p])] = [4 * (q - p), 3];
        const em: [string, number][] = p === 1 ? [['short', 4 * (q - p)], ['long', 3]] : [['short', 4 * (q - p)], ['medium', 4], ['long', 3]];
        rows.push({ label: 'C II', form: `sp(${p},${q})`, black: [...span(1, 2 * p - 1, 2), ...span(2 * p + 1, n)], tau: 'identity', display: `BC${p}`, em, simple, dk: p * (2 * p + 1) + q * (2 * q + 1) });
      } else {
        simple[orbitKey([n])] = [3, 0];
        const em: [string, number][] = p === 1 ? [['all', 3]] : [['short', 4], ['long', 3]];
        rows.push({ label: 'C II', form: `sp(${p},${p})`, black: span(1, n - 1, 2), tau: 'identity', display: p === 1 ? 'A1' : `C${p}`, em, simple, dk: 2 * p * (2 * p + 1) });
      }
    }
    rows.push({ label: 'compact', form: `sp(${n})`, black: span(1, n), tau: 'identity', display: null, em: null, simple: {}, dk: n * (2 * n + 1) });
  } else if (L === 'D') {
    for (let p = 1; p <= n; p++) {
      const q = 2 * n - p;
      const label = p === 1 ? 'D II' : 'D I';
      if (p === n) {
        rows.push({ label, form: `so(${n},${n})`, black: [], tau: 'identity', display: `D${n}`, em: [['all', 1]], simple: each(span(1, n), [1, 0]), dk: n * (n - 1) });
      } else if (p === n - 1) {
        const simple = each(span(1, n - 2), [1, 0]);
        simple[orbitKey([n - 1, n])] = [2, 0];
        rows.push({ label, form: `so(${p},${q})`, black: [], tau: 'swap', display: `B${n - 1}`, em: [['short', q - p], ['long', 1]], simple, dk: choose2(n - 1) + choose2(n + 1) });
      } else {
        const simple = each(span(1, p - 1), [1, 0]);
        simple[orbitKey([p])] = [2 * (n - p), 0];
        const em: [string, number][] = p === 1 ? [['all', q - p]] : [['short', q - p], ['long', 1]];
        rows.push({ label, form: `so(${p},${q})`, black: span(p + 1, n), tau: (n - p) % 2 === 0 ? 'identity' : 'swap', display: p === 1 ? 'A1' : `B${p}`, em, simple, dk: choose2(p) + choose2(q) });
      }
    }
    if (n % 2 === 0) {
      const simple = each(span(2, n - 2, 2), [4, 0]);
      simple[orbitKey([n])] = [1, 0];
      rows.push({ label: 'D III', form: `so*(${2 * n})`, black: span(1, n - 1, 2), tau: 'identity', display: `C${n / 2}`, em: [['short', 4], ['long', 1]], simple, dk: n * n });
    } else {
      const m = (n - 1) / 2;
      const simple = each(span(2, n - 3, 2), [4, 0]);
      simple[orbitKey([n - 1, n])] = [4, 1];
      const em: [string, number][] = m === 1 ? [['short', 4], ['long', 1]] : [['short', 4], ['medium', 4], ['long', 1]];
      rows.push({ label: 'D III', form: `so*(${2 * n})`, black: span(1, n - 2, 2), tau: 'swap', display: `BC${m}`, em, simple, dk: n * n });
    }
    rows.push({ label: 'compact', form: `so(${2 * n})`, black: span(1, n), tau: n % 2 === 0 ? 'identity' : 'swap', display: null, em: null, simple: {}, dk: n * (2 * n - 1) });
  }
  return rows;
}

/** The restricted board of SPEC.md 6.4: B_r for BC_r (A1 for r = 1), else the display (C2 kept, the adjustment). */
function restrictedBoardOf(display: string): string {
  const bc = /^BC(\d+)$/.exec(display);
  if (bc === null) return display;
  return bc[1] === '1' ? 'A1' : `B${bc[1]}`;
}

/** The number of orbits of tau (labels) on the white nodes. */
function whiteOrbits(t: readonly number[], black: readonly number[]): number {
  const seen = new Set<number>();
  let count = 0;
  for (let i = 1; i <= t.length; i++) {
    if (black.includes(i) || seen.has(i)) continue;
    count += 1;
    for (let j = i; !seen.has(j); j = t[j - 1]!) seen.add(j);
  }
  return count;
}

const BEYOND: string[] = [];
for (const L of ['A', 'B', 'C', 'D']) for (let n = 9; n <= 16; n++) BEYOND.push(`${L}${n}`);

describe('satakeCatalogue and satakeRecord beyond rank 8, against the closed forms of SPEC.md 6.4 (repair after review)', () => {
  for (const name of BEYOND) {
    // one board per test; the largest (D16) takes about half a second alone, and the limit of 60 s is the engine
    // suite's convention for long tests under the parallel suite (a limit of the runner, not a timing check)
    it(`${name}: every entry and every record`, () => {
      const L = name[0]!;
      const n = Number(name.slice(1));
      const board = boardFromName(name) as Board;
      expect(board.n).toBe(n);
      const rows = table(L, n);
      const entries = satakeCatalogue(name);
      // the entries, in the order of the oracle's loops, and no others
      expect(entries.map((e) => [e.cartan_label, e.real_form])).toEqual(rows.map((r) => [r.label, r.form]));
      entries.forEach((e, k) => {
        const row = rows[k]!;
        const where = `${name} ${row.form}`;
        const t = tauLabels(row.tau, n);
        // the entry: black positions ascending (as integers), tau the full involution, the display type
        expect(toLabels(board, e.black_nodes), where).toEqual(row.black);
        expect(toLabels(board, e.tau), where).toEqual(t);
        expect(e.restricted_type_display, where).toBe(row.display);
        // the record
        const rec = satakeRecord(name, e);
        expect(rec.dynkin_type, where).toBe(name);
        expect([rec.cartan_label, rec.real_form, rec.restricted_type_display], where).toEqual([row.label, row.form, row.display]);
        expect(toLabels(board, rec.black_nodes), where).toEqual(row.black);
        expect(toLabels(board, rec.tau), where).toEqual(t);
        // arrows: the pairs of white nodes that tau exchanges, each once, ascending; tau_moves_black_nodes
        const white = span(1, n).filter((i) => !row.black.includes(i));
        const arrows = white.filter((i) => t[i - 1]! > i).map((i) => [i, t[i - 1]!]);
        expect(rec.arrows.map((a) => toLabels(board, a)), where).toEqual(arrows);
        expect(rec.tau_moves_black_nodes, where).toBe(row.black.some((i) => t[i - 1] !== i));
        // dimensions
        expect(rec.rank, where).toBe(n);
        expect(rec.dim_g, where).toBe(dimG(L, n));
        expect(rec.dim_k, where).toBe(row.dk);
        expect(rec.dim_k + rec.dim_p, where).toBe(rec.dim_g);
        expect(rec.character, where).toBe(rec.dim_p - rec.dim_k);
        expect(rec.character, where).toBe(2 * rec.real_rank - n - rec.roots_compact_imaginary);
        expect(rec.real_rank, where).toBe(whiteOrbits(t, row.black));
        // matchCatalogue finds this record, and only it, from the entry's own pair (no coincidence beyond D4)
        expect(matchCatalogue({ board, black: e.black_nodes, tau: e.tau }), where).toEqual([rec]);
        if (row.display === null) {
          // the compact form (SPEC.md 6.4 "Fields of a catalogue record")
          expect(rec.real_rank, where).toBe(0);
          expect(rec.n_restricted_roots, where).toBe(0);
          for (const f of ['restricted_type', 'restricted_board', 'restricted_orbits_in_bourbaki_order'] as const) expect(rec[f], `${where}: ${f}`).toBeNull();
          for (const f of ['multiplicities', 'restricted_simple_orbits', 'restricted_simple_multiplicities', 'restricted_cartan'] as const) {
            expect(rec[f], `${where}: ${f}`).toEqual([]);
          }
          expect(rec.arrows, where).toEqual([]);
          return;
        }
        // the restricted roots: the computed type is the display (C2 is written B2), the board B_r for BC_r
        expect(rec.restricted_type, where).toBe(row.display === 'C2' ? 'B2' : row.display);
        expect(rec.restricted_board, where).toBe(restrictedBoardOf(row.display));
        expect(rec.real_rank, where).toBe(Number(/(\d+)$/.exec(row.display)![1]));
        // the multiplicities by length class, and their sum |Phi| - |Phi_X| (reference/verify.py)
        expect(rec.multiplicities.map((m) => [m.class, m.mult]), where).toEqual(row.em);
        expect(rec.multiplicities.reduce((s, m) => s + m.roots * m.mult, 0), where).toBe(rec.dim_g - n - rec.roots_compact_imaginary);
        expect(rec.multiplicities.reduce((s, m) => s + m.roots, 0), where).toBe(rec.n_restricted_roots);
        // (m_lambda, m_2lambda) at each simple restricted root, by its orbit of white nodes
        expect(rec.restricted_simple_orbits.length, where).toBe(rec.real_rank);
        const simple: Record<string, [number, number]> = {};
        rec.restricted_simple_orbits.forEach((o, j) => {
          simple[orbitKey(toLabels(board, o))] = rec.restricted_simple_multiplicities[j]!;
        });
        expect(simple, where).toEqual(row.simple);
      });
    }, 60000);
  }
});

// ---------------------------------------------------------------------------------------------
// canonicalPair at positions 9 and above
// ---------------------------------------------------------------------------------------------

interface Pair {
  black: number[];
  tau: number[];
}

/** The symmetries of A_n and D_n (n >= 5) in positions, written out: the identity and the flip, or the swap. */
function writtenSymmetries(name: string, n: number): number[][] {
  const id = span(0, n - 1);
  if (name.startsWith('A')) return [id, id.map((i) => n - 1 - i)];
  const swap = [...id];
  swap[n - 2] = n - 1;
  swap[n - 1] = n - 2;
  return [id, swap];
}

/** (g(X) sorted ascending as integers, g tau g^-1), with t[g[i]] = g[tau[i]]. */
function image(g: readonly number[], p: Pair): Pair {
  const t: number[] = p.tau.map(() => 0);
  p.tau.forEach((x, i) => {
    t[g[i]!] = g[x]!;
  });
  return { black: p.black.map((i) => g[i]!).sort((a, b) => a - b), tau: t };
}

/** Lexicographic order on integer lists, then the order of SPEC.md 5.5: the black set first, then tau. */
function listOrder(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < Math.min(a.length, b.length); k++) if (a[k] !== b[k]) return a[k]! - b[k]!;
  return a.length - b.length;
}
const pairOrder = (p: Pair, q: Pair): number => listOrder(p.black, q.black) || listOrder(p.tau, q.tau);

/** A fixed sequence of pseudo-random integers (a linear congruential generator with a fixed seed; no clock). */
function generator(seed: number): (below: number) => number {
  let s = seed >>> 0;
  return (below) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % below;
  };
}

/** A permutation of 0..n-1 (Fisher-Yates on the generator). */
function permutation(next: (below: number) => number, n: number): number[] {
  const t = span(0, n - 1);
  for (let i = n - 1; i > 0; i--) {
    const j = next(i + 1);
    [t[i], t[j]] = [t[j]!, t[i]!];
  }
  return t;
}

/** The pairs tried on a board: every catalogue entry, and subsets meeting positions 9 and above with many taus. */
function pairsOf(name: string, n: number, auts: number[][]): Pair[] {
  const next = generator(20261025 + n);
  const out: Pair[] = satakeCatalogue(name).map((e) => ({ black: e.black_nodes, tau: e.tau }));
  // taus: the symmetries, transpositions and a 3-cycle through the positions 9 and above, and some permutations
  const id = span(0, n - 1);
  const swapped = (i: number, j: number): number[] => {
    const t = [...id];
    t[i] = j;
    t[j] = i;
    return t;
  };
  const taus: number[][] = [...auts, swapped(9, n - 1), swapped(2, 10), swapped(0, 10)];
  const cycle = [...id];
  cycle[0] = 10;
  cycle[10] = 3;
  cycle[3] = 0;
  taus.push(cycle);
  for (let k = 0; k < 8; k++) taus.push(permutation(next, n));
  for (let k = 0; k < 48; k++) {
    const black = span(0, n - 1).filter(() => next(2) === 1);
    if (!black.some((i) => i >= 9)) black.push(9 + next(n - 9));
    for (const tau of taus) out.push({ black: [...new Set(black)].sort((a, b) => b - a), tau });
  }
  return out;
}

describe('canonicalPair at positions 9 and above: the least image, invariant under the symmetries (repair after review)', () => {
  it('worked cases where the integer order and the order of the decimal text differ', () => {
    const a11 = boardFromName('A11') as Board;
    const a13 = boardFromName('A13') as Board;
    const id11 = span(0, 10);
    // black 0, 2, 10 on A11: the flip gives 0, 8, 10, so the pair is its own representative, sorted as integers
    expect(canonicalPair({ board: a11, black: [10, 2, 0], tau: id11 })).toEqual({ black: [0, 2, 10], tau: id11 });
    // black 10 on A13: the flip gives 2, which is less than 10 as an integer (not as text)
    expect(canonicalPair({ board: a13, black: [10], tau: span(0, 12) })).toEqual({ black: [2], tau: span(0, 12) });
    // tau the 3-cycle 0 -> 10 -> 3 -> 0 on A11: the flip conjugates it to 0 -> 7 -> 10 -> 0, which is less (7 < 10)
    const cycle = [10, 1, 2, 0, 4, 5, 6, 7, 8, 9, 3];
    expect(canonicalPair({ board: a11, black: [], tau: cycle })).toEqual({ black: [], tau: [7, 1, 2, 3, 4, 5, 6, 10, 8, 9, 0] });
  });

  for (const name of ['A11', 'A13', 'D12']) {
    it(`${name}: every pair gives the least of its images, and every image gives the same`, () => {
      const board = boardFromName(name) as Board;
      const n = board.n;
      const auts = writtenSymmetries(name, n);
      // the engine's symmetries are the two written out
      expect(symmetries(board).map((g) => JSON.stringify(g)).sort()).toEqual(auts.map((g) => JSON.stringify(g)).sort());
      const pairs = pairsOf(name, n, auts);
      expect(pairs.filter((p) => p.black.some((i) => i >= 9)).length).toBeGreaterThan(48);
      for (const p of pairs) {
        const where = `${name} ${JSON.stringify(p)}`;
        const c = canonicalPair({ board, black: p.black, tau: p.tau });
        const images = auts.map((g) => image(g, p));
        const least = images.reduce((a, b) => (pairOrder(b, a) < 0 ? b : a));
        expect(c, where).toEqual(least);
        for (const q of images) expect(canonicalPair({ board, black: [...q.black].reverse(), tau: q.tau }), where).toEqual(c);
      }
    }, 60000);
  }
});
