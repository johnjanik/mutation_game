// P6-A3: tool T13, the Satake Studio (SPEC.md 4 T13, 2.15, 4.0, 6.4, 6.6, Appendix A.5, E-7, E-9). The
// acceptance of SPEC 4 T13 over every type, every record of `satake`, every pair of `admissible_pairs` and
// every entry of `satake_examples`, through the tool's own pure functions in
// site/src/components/tools/t13/model.ts and its data loader t13/load.ts, so that the tool's data path is
// guarded and not only the engine.
//
// Golden values come from the harness of P0-A2 (packages/engine/test/golden/_harness.ts): `golden`,
// `TYPE_NAMES`, `boardOf`, `labels` and `wordLabels` (rule 2), `intEq` (rule 1), `matchRecord` (rule 5).
// Identifiers (real_form, cartan_label, restricted_type, restricted_type_display, restricted_board) compare
// with toBe (rule 6); a meaningful null as null (rule 7). This file never calls `covers`: the keys `satake`,
// `admissible_pairs` and `satake_examples` are registered by the engine's golden files of P6-A1 and P6-A2,
// and a golden key is tested in exactly one file (CONTRACTS 3; a deviation reported to MERGE). The only
// golden values typed are SPEC worked values (Appendix A.5, the e6(-26) example of 2.15), each marked as such
// where it is typed (MERGE ruling (11) on P6-A3); every other expected value is read from the golden file or
// computed. Announcement inputs are plain test vectors, not golden values.
//
// Properties of T13 beyond the common ones of 4.0 Configuration (id, board, prediction, preset, caption):
// black (labels of the black nodes), tau (images of all nodes in label order) and root (a population in
// label order). coords, start, moves and linkTo do not apply.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  admissibility,
  boardFromName,
  matchCatalogue,
  mutate,
  positiveRoots,
  restrictedBoard,
  restrictedCoordinates,
  satake,
  satakeCatalogue,
  satakeRecord,
  shadow2,
  symmetries,
  theta,
  toLabels,
  toPositions,
} from '@two-games/engine';
import type { Board, SatakeDiagram } from '@two-games/engine';
import { TYPE_NAMES, golden, intEq, labels, matchRecord, wordLabels } from '../../../../packages/engine/test/golden/_harness';
import { T13_BOARDS, T13_EXAMPLES, T13_OUTS, T13_PRESETS, T13_PRESET_IDS } from '../../../src/components/tools/t13/config';
import {
  FAILURE_FIRST,
  T13_CONDITIONS,
  announceComposite,
  announcePaint,
  announceRestart,
  announceStage,
  announceTau,
  arrowsOf,
  assembleData,
  blackPairsOf,
  captionText,
  catalogueRows,
  coordinatesInBourbaki,
  defaultRoot,
  diagramOf,
  displayName,
  displayRecord,
  exportData,
  failureNote,
  failureSentence,
  fromLabelOrder,
  involutions,
  populationsTail,
  lights,
  multiplicitiesText,
  pairKey,
  pairsText,
  plainText,
  recordInLabels,
  restrictedClick,
  restrictedNodeName,
  rootsOffered,
  shadowPoints,
  shadowRows,
  tauToLabels,
  thetaStages,
  type Assembled,
  type RestrictedLike,
} from '../../../src/components/tools/t13/model';
import { computeNow, fetchData, islandScript, pairFromJson, pairJson, satakeHint, type Caller, type DataFns } from '../../../src/components/tools/t13/load';
import { captionFor } from '../../../src/components/tools/t13/caption';
import { admitLink, toolStateOf } from '../../../src/components/tools/t13/link';
import { BOARDS_OFFERED } from '../../../src/tools/offered';
import { LINK_NOTICE, decodeState, encodeState } from '../../../src/lib/urlCodec';
import { whereToRun } from '../../../src/lib/worker';
import { announceTemplates } from '../../../src/lib/a11y';
import T13 from '../../../src/tools/registry/T13';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';

interface GoldenSatakeRecord {
  dynkin_type: string;
  cartan_label: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  arrows: [number, number][];
  tau_moves_black_nodes: boolean;
  restricted_type_display: string | null;
  rank: number;
  real_rank: number;
  restricted_type: string | null;
  multiplicities: { class: string; roots: number; mult: number }[];
  n_restricted_roots: number;
  dim_g: number;
  dim_k: number;
  dim_p: number;
  character: number;
  roots_compact_imaginary: number;
  roots_real: number;
  roots_complex: number;
  w_X_word: number[];
  restricted_simple_orbits: number[][];
  restricted_simple_multiplicities: [number, number][];
  restricted_cartan: number[][];
  restricted_board: string | null;
  restricted_orbits_in_bourbaki_order: number[][] | null;
  restricted_reflection_word_lengths: number[];
}

interface GoldenExample {
  type: string;
  black_nodes: number[];
  tau: number[];
  condition_1: boolean;
  condition_2: boolean;
  condition_3: boolean;
  admissible: boolean;
  real_forms: string[];
}

const RECORDS = golden.satake as GoldenSatakeRecord[];
const PAIRS = golden.admissible_pairs as Record<string, [number[], number[]][]>;
const EXAMPLES = golden.satake_examples as GoldenExample[];

const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
/** The negative of a vector, without -0 (the engine writes 0). */
const neg = (v: readonly number[]): number[] => v.map((x) => (x === 0 ? 0 : -x));
const word = (holds: boolean): string => (holds ? 'holds' : 'fails');
const rank = (type: string): number => B(type).n;

/** Everything the tool computes for one pair, through its own data path (computeNow = satake, restrictedBoard, matchCatalogue). */
function dataOf(d: SatakeDiagram): Assembled {
  const now = computeNow(d, admissibility(d));
  if (now === null) throw new Error('not admissible');
  return assembleData(now.sat, now.rb, now.records, d);
}

/** The data of every golden record, computed once (E7 and E8 are the costly ones). */
let all: { g: GoldenSatakeRecord; d: SatakeDiagram; data: Assembled }[] = [];
beforeAll(() => {
  all = RECORDS.map((g) => {
    const d = diagramOf(g.dynkin_type, g.black_nodes, g.tau);
    return { g, d, data: dataOf(d) };
  });
}, 120000);

describe('the boards and the decoration (SPEC 4 T13 Decorate, 4.0 Board pickers)', () => {
  it('the boards offered are the 32 named types of golden.types, grouped by letter, and offered.ts lists them', () => {
    expect([...T13_BOARDS].sort()).toEqual([...TYPE_NAMES].sort());
    expect(BOARDS_OFFERED.satake).toEqual(T13_BOARDS);
  });

  it('involutions lists exactly the identity, the flip on A_n and E6, the swap on D_n and the three swaps on D4', () => {
    for (const type of TYPE_NAMES) {
      const board = B(type);
      const inv = involutions(board);
      const all2 = symmetries(board).filter((t) => t.every((x, i) => t[x] === i));
      // the engine's order of symmetries, filtered to order at most 2; the identity first
      expect(inv.map((t) => [...t]), type).toEqual(all2.map((t) => [...t]));
      expect(tauToLabels(board, inv[0]!), type).toEqual(labels(board, board.labels.map((_, i) => i)));
      const text = inv.map((t) => pairsText(board, t));
      expect(text[0], type).toBe('identity');
      const m = /^([A-G])(\d+)$/.exec(type)!;
      const L = m[1]!;
      const n = Number(m[2]);
      if (type === 'D4') {
        expect(inv.map((t) => tauToLabels(board, t).join('.'))).toEqual(['1.2.3.4', '1.2.4.3', '3.2.1.4', '4.2.3.1']);
        expect(text).toEqual(['identity', '3 ↔ 4', '1 ↔ 3', '1 ↔ 4']);
      } else if ((L === 'A' && n >= 2) || type === 'E6') {
        expect(inv.length, type).toBe(2);
        const flip = type === 'E6' ? [6, 2, 5, 4, 3, 1] : Array.from({ length: n }, (_, k) => n - k);
        expect(tauToLabels(board, inv[1]!), type).toEqual(flip);
      } else if (L === 'D') {
        expect(inv.length, type).toBe(2);
        const swap = Array.from({ length: n }, (_, k) => k + 1);
        swap[n - 2] = n;
        swap[n - 1] = n - 1;
        expect(tauToLabels(board, inv[1]!), type).toEqual(swap);
        expect(text[1], type).toBe(`${n - 1} ↔ ${n}`);
      } else {
        expect(inv.length, type).toBe(1);
      }
    }
    expect(pairsText(B('A3'), tauOf('A3', [3, 2, 1]))).toBe('1 ↔ 3');
    expect(pairsText(B('E6'), tauOf('E6', [6, 2, 5, 4, 3, 1]))).toBe('1 ↔ 6, 3 ↔ 5');
  });

  it('diagramOf converts labels to positions once, with toPositions, and tauToLabels converts back', () => {
    const d = diagramOf('E6', [5, 2, 4, 3, 2], [6, 2, 5, 4, 3, 1]);
    expect([...d.black]).toEqual(toPositions(d.board, [2, 3, 4, 5]));
    expect(tauToLabels(d.board, d.tau)).toEqual([6, 2, 5, 4, 3, 1]);
    expect(d.board.name).toBe('E6');
  });

  it('arrows join white nodes only; the toggle shows tau on black nodes (su(1,5): arrow 1 to 5, black 2 and 4)', () => {
    const d = diagramOf('A5', [2, 3, 4], [5, 4, 3, 2, 1]);
    expect(arrowsOf(d).map((p) => labels(d.board, p))).toEqual([[1, 5]]);
    expect(blackPairsOf(d).map((p) => labels(d.board, p))).toEqual([[2, 4]]);
    for (const { g, d: dd } of all) {
      expect(arrowsOf(dd).map((p) => labels(dd.board, p)), `${g.dynkin_type} ${g.real_form}`).toEqual(g.arrows);
      expect(blackPairsOf(dd).length > 0, `${g.dynkin_type} ${g.real_form}`).toBe(g.tau_moves_black_nodes);
    }
  });
});

/** tau in positions from images in label order (the test's own conversion, through toPositions). */
function tauOf(type: string, images: number[]): number[] {
  const board = B(type);
  const out: number[] = new Array(board.n);
  const order = [...board.labels].sort((a, b) => a - b);
  order.forEach((l, k) => {
    out[toPositions(board, [l])[0]!] = toPositions(board, [images[k]!])[0]!;
  });
  return out;
}

describe('three lights (SPEC 4 T13 Three lights, 2.15)', () => {
  it('for every type the pairs the lights accept over all subsets and all involutive symmetries equal admissible_pairs', () => {
    for (const type of TYPE_NAMES) {
      const board = B(type);
      const n = board.n;
      const invs = involutions(board).map((t) => tauToLabels(board, t));
      const found: string[] = [];
      for (let mask = 0; mask < 1 << n; mask++) {
        const X: number[] = [];
        for (let i = 0; i < n; i++) if ((mask >> i) & 1) X.push(i);
        const blackLabels = labels(board, X);
        for (const t of invs) {
          const d = diagramOf(type, blackLabels, t);
          const v = lights(admissibility(d), d.board);
          // the verdict is the conjunction of the three lights (and the symmetry, always true here)
          expect(v.symmetry.holds).toBe(true);
          expect(v.admissible).toBe(v.lights.every((l) => l.holds));
          if (v.admissible) found.push(JSON.stringify([labels(d.board, [...d.black].sort((a, b) => a - b)), tauToLabels(d.board, d.tau)]));
        }
      }
      const expected = PAIRS[type]!.map((p) => JSON.stringify(p));
      expect(new Set(found).size, type).toBe(found.length);
      expect([...found].sort(), type).toEqual([...expected].sort());
    }
  }, 120000);

  it('every satake_examples entry shows the recorded verdict for each light', () => {
    for (const e of EXAMPLES) {
      const where = `${e.type} black ${e.black_nodes.join(',')} tau ${e.tau.join('.')}`;
      const d = diagramOf(e.type, e.black_nodes, e.tau);
      const v = lights(admissibility(d), d.board);
      expect(v.lights.map((l) => l.word), where).toEqual([word(e.condition_1), word(e.condition_2), word(e.condition_3)]);
      expect(v.verdict, where).toBe(e.admissible ? 'admissible' : 'not admissible');
      for (const l of v.lights) {
        if (l.holds) expect(l.reason, where).toBeNull();
        else expect(plainText(l.reason!).length, where).toBeGreaterThan(20);
      }
      if (e.admissible) expect(dataOf(d).entries.map((x) => x.real_form), where).toEqual(e.real_forms);
      else expect(computeNow(d, admissibility(d)), where).toBeNull();
    }
    // the six example buttons of the lights preset are rows of satake_examples (matched, never by index)
    for (const x of T13_EXAMPLES) {
      const e = matchRecord(EXAMPLES, { type: x.board, black_nodes: x.black, tau: x.tau });
      expect(e.type).toBe(x.board);
    }
    expect(T13_EXAMPLES.map((x) => x.board)).toEqual(['A3', 'A3', 'A3', 'A3', 'A3', 'A2']);
  });

  it('the reason sentences name the nodes by label and the fraction with a true minus sign (A2 node 1; A3 node 1 with the flip; A5 two nodes)', () => {
    const a2 = diagramOf('A2', [1], [1, 2]);
    const v2 = lights(admissibility(a2), a2.board);
    expect(plainText(v2.lights[2]!.reason!)).toBe('At node 2 the number ⟨α2, ρX∨⟩ is −1/2, which is not an integer.');
    const a3 = diagramOf('A3', [1], [3, 2, 1]);
    const v3 = lights(admissibility(a3), a3.board);
    expect(v3.lights.map((l) => plainText(l.reason!))).toEqual([
      'τ sends black node 1 to a white node, so it does not keep the black set.',
      'On the black node 1, τ differs from −wX.',
      'At node 2 the number ⟨α2, ρX∨⟩ is −1/2, which is not an integer.',
    ]);
    // two nodes fail condition 3: one clause per node, each with its own fraction, in the order of the nodes
    const a5 = diagramOf('A5', [1, 2, 4], [1, 2, 3, 4, 5]);
    const r5 = admissibility(a5).reasons.condition_3!;
    expect(labels(a5.board, r5.nodes)).toEqual([3, 5]);
    expect(plainText(lights(admissibility(a5), a5.board).lights[2]!.reason!)).toBe(
      'At node 3 the number ⟨α3, ρX∨⟩ is −3/2 and at node 5 the number ⟨α5, ρX∨⟩ is −1/2, which are not integers.',
    );
    // condition 2 on several black nodes; not-an-involution and not-a-symmetry on tau that no picker offers
    const d5 = diagramOf('D5', [1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    const r2 = admissibility(d5).reasons.condition_2!;
    expect(plainText(lights(admissibility(d5), d5.board).lights[1]!.reason!)).toBe(`On the black nodes ${listText(labels(d5.board, r2.nodes))}, τ differs from −wX.`);
    const cyc = { board: B('A5'), black: [], tau: [1, 2, 0, 4, 3] } satisfies SatakeDiagram;
    const vc = lights(admissibility(cyc), cyc.board);
    expect(vc.symmetry.holds).toBe(false);
    expect(plainText(vc.symmetry.reason!)).toMatch(/^τ is not a symmetry of the board \(it breaks the roads at nodes 1, 2, 3, 4 and 5\)\.$/);
    expect(plainText(vc.lights[0]!.reason!)).toBe('τ applied twice is not the identity (nodes 1, 2 and 3).');
    expect(vc.verdict).toBe('not admissible');
  });

  it('each light states its condition in one line', () => {
    expect(T13_CONDITIONS.map(plainText)).toEqual([
      'τ2 = 1 and τ(X) = X',
      'on the black nodes, τ agrees with −wX',
      'at every white node j fixed by τ, ⟨αj, ρX∨⟩ is an integer',
    ]);
  });
});

/** "1", "1 and 2", "1, 2 and 4" (the tool's way of joining labels; written out here for the test). */
function listText(xs: readonly number[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** The golden (m_lambda, m_2lambda) of an orbit (labels), found in restricted_simple_orbits by orbit. */
function goldenPair(g: GoldenSatakeRecord, orbit: readonly number[]): [number, number] {
  const s = g.restricted_simple_orbits.findIndex((x) => x.join() === orbit.join());
  if (s < 0) throw new Error(`${g.real_form}: no orbit ${orbit.join()}`);
  return g.restricted_simple_multiplicities[s]!;
}

/** The golden reduced length of the composite move of an orbit (labels), found by orbit. */
function goldenReducedLength(g: GoldenSatakeRecord, orbit: readonly number[]): number {
  const s = g.restricted_simple_orbits.findIndex((x) => x.join() === orbit.join());
  if (s < 0) throw new Error(`${g.real_form}: no orbit ${orbit.join()}`);
  return g.restricted_reflection_word_lengths[s]!;
}

describe('when not admissible (SPEC 4 T13; 2.15 "What a failed condition 3 means")', () => {
  it('the failure note: always the first sentence; with conditions 1 and 2 holding, the careful sentence', () => {
    const a2 = diagramOf('A2', [1], [1, 2]);
    const note = failureNote(admissibility(a2)).map(plainText);
    expect(note[0]).toBe(FAILURE_FIRST);
    expect(note[0]).toBe('This decoration is not the Satake diagram of any real form, so the Studio shows no data for it.');
    expect(note.join(' ')).toContain('no involution of the Lie algebra acts as this θ on the Cartan subalgebra and fixes the root vectors of the black nodes');
    const a3 = diagramOf('A3', [1, 2], [1, 2, 3]);
    expect(failureNote(admissibility(a3)).map(plainText)).toEqual([FAILURE_FIRST]);
    // condition 3 fails together with conditions 1 and 2 (A3, black node 1, the flip): the careful sentence,
    // which claims that conditions 1 and 2 hold, is not shown
    const flip = admissibility(diagramOf('A3', [1], [3, 2, 1]));
    expect([flip.condition_1, flip.condition_2, flip.condition_3]).toEqual([false, false, false]);
    expect(failureNote(flip).map(plainText)).toEqual([FAILURE_FIRST]);
    // on every pair of rank at most 4 the careful sentence appears exactly when conditions 1 and 2 hold and 3 fails
    for (const type of TYPE_NAMES.filter((t) => rank(t) <= 4)) {
      forEachPair(type, (d, adm) => {
        const careful = adm.symmetry && adm.condition_1 && adm.condition_2 && !adm.condition_3;
        expect(failureNote(adm).length, `${type} ${d.black.join(',')} ${d.tau.join(',')}`).toBe(careful ? 2 : 1);
      });
    }
  });

  it('where conditions 1 and 2 hold and condition 3 fails, theta permutes the roots and is an involution, as the note says (boards of rank at most 4)', () => {
    let cases = 0;
    for (const type of TYPE_NAMES.filter((t) => rank(t) <= 4)) {
      const board = B(type);
      const all2 = [...positiveRoots(board), ...positiveRoots(board).map(neg)];
      const keys = new Set(all2.map((r) => r.join(',')));
      forEachPair(type, (d, adm) => {
        if (!(adm.condition_1 && adm.condition_2 && !adm.condition_3)) return;
        cases++;
        for (const r of all2) {
          const t = theta(d, r);
          expect(keys.has(t.join(','))).toBe(true);
          expect(theta(d, t)).toEqual(r);
        }
      });
    }
    expect(cases).toBeGreaterThan(10);
  });

  it('no sentence the tool writes contains "not an involution" for a failed condition 3', () => {
    let failed3 = 0;
    for (const type of TYPE_NAMES.filter((t) => rank(t) <= 4)) {
      forEachPair(type, (d, adm) => {
        const texts = [...failureNote(adm), ...lights(adm, d.board).lights.flatMap((l) => (l.reason ? [l.reason] : []))].map(plainText);
        if (!adm.condition_3) failed3++;
        for (const t of texts) {
          expect(t.toLowerCase()).not.toMatch(/(theta|θ) is not an involution/);
          if (!adm.condition_3) expect(t.toLowerCase()).not.toContain('not an involution');
        }
      });
    }
    expect(failed3).toBeGreaterThan(20);
  });

  it('satake and restrictedBoard are never called on a pair that is not admissible', async () => {
    let notAdmissible = 0;
    for (const type of ['A2', 'A3', 'C3', 'D4', 'G2']) {
      const pairs: { d: SatakeDiagram; adm: ReturnType<typeof admissibility> }[] = [];
      forEachPair(type, (d, adm) => pairs.push({ d, adm }));
      for (const { d, adm } of pairs) {
        const calls: string[] = [];
        const spy: Caller = (fn, args) => {
          calls.push(fn);
          return Promise.resolve(({ satake, restrictedBoard, matchCatalogue } as Record<string, (...a: unknown[]) => unknown>)[fn]!(...(args as unknown[]))) as never;
        };
        const got = await fetchData(d, adm, spy);
        // computeNow (the server render, a main-thread board) with the same three functions spied
        const nowCalls: string[] = [];
        const fns: DataFns = {
          satake: (x) => (nowCalls.push('satake'), satake(x)),
          restrictedBoard: (x) => (nowCalls.push('restrictedBoard'), restrictedBoard(x)),
          matchCatalogue: (x) => (nowCalls.push('matchCatalogue'), matchCatalogue(x)),
        };
        const now = computeNow(d, adm, fns);
        if (adm.admissible) {
          expect(got).not.toBeNull();
          expect(now).not.toBeNull();
          // a pair with no white node has the empty restricted board without a call
          const white = d.black.length < d.board.n;
          expect(calls.sort()).toEqual(white ? ['matchCatalogue', 'restrictedBoard', 'satake'] : ['matchCatalogue', 'satake']);
          expect(nowCalls.sort()).toEqual(white ? ['matchCatalogue', 'restrictedBoard', 'satake'] : ['matchCatalogue', 'satake']);
        } else {
          notAdmissible++;
          expect(got).toBeNull();
          expect(calls).toEqual([]);
          expect(now).toBeNull();
          expect(nowCalls).toEqual([]);
        }
      }
    }
    expect(notAdmissible).toBeGreaterThan(20);
  });
});

/** Every subset of the positions with every involutive symmetry of a type. */
function forEachPair(type: string, f: (d: SatakeDiagram, adm: ReturnType<typeof admissibility>) => void): void {
  const board = B(type);
  for (const tau of involutions(board)) {
    for (let mask = 0; mask < 1 << board.n; mask++) {
      const X: number[] = [];
      for (let i = 0; i < board.n; i++) if ((mask >> i) & 1) X.push(i);
      const d = diagramOf(type, labels(board, X), tauToLabels(board, tau));
      f(d, admissibility(d));
    }
  }
}

describe('when admissible: names and data (SPEC 4 T13, 6.4, 6.5)', () => {
  it('every field of every satake record is reproduced through the tool\'s data path', () => {
    const checked = new Set<string>();
    expect(all.length).toBe(RECORDS.length);
    for (const { g, d, data } of all) {
      const where = `${g.dynkin_type} ${g.real_form}`;
      const board = d.board;
      const e = data.entries.find((x) => x.real_form === g.real_form);
      expect(e, where).toBeDefined();
      const rec = e!;
      expect(Object.keys(rec), where).toEqual(Object.keys(g));
      for (const f of Object.keys(g)) checked.add(f);
      // identifiers (rule 6), meaningful nulls (rule 7)
      for (const f of ['dynkin_type', 'cartan_label', 'real_form', 'restricted_type', 'restricted_type_display', 'restricted_board'] as const) {
        expect(rec[f], `${where}: ${f}`).toBe(g[f]);
      }
      expect(rec.tau_moves_black_nodes, where).toBe(g.tau_moves_black_nodes);
      // node fields in labels (rule 2)
      expect(labels(board, rec.black_nodes), where).toEqual(g.black_nodes);
      expect(labels(board, rec.tau), where).toEqual(g.tau);
      expect(rec.arrows.map((p) => labels(board, p)), where).toEqual(g.arrows);
      expect(wordLabels(board, rec.w_X_word), where).toEqual(g.w_X_word);
      expect(rec.restricted_simple_orbits.map((o) => labels(board, o)), where).toEqual(g.restricted_simple_orbits);
      if (g.restricted_orbits_in_bourbaki_order === null) expect(rec.restricted_orbits_in_bourbaki_order, where).toBeNull();
      else expect(rec.restricted_orbits_in_bourbaki_order!.map((o) => labels(board, o)), where).toEqual(g.restricted_orbits_in_bourbaki_order);
      // integers (rule 1)
      for (const f of ['rank', 'real_rank', 'n_restricted_roots', 'dim_g', 'dim_k', 'dim_p', 'character', 'roots_compact_imaginary', 'roots_real', 'roots_complex'] as const) {
        intEq(rec[f], g[f], `${where}: ${f}`);
      }
      expect(rec.multiplicities.map((m) => m.class), where).toEqual(g.multiplicities.map((m) => m.class));
      intEq(rec.multiplicities.map((m) => [m.roots, m.mult]), g.multiplicities.map((m) => [m.roots, m.mult]), `${where}: multiplicities`);
      intEq(rec.restricted_simple_multiplicities, g.restricted_simple_multiplicities, `${where}: restricted_simple_multiplicities`);
      intEq(rec.restricted_cartan, g.restricted_cartan, `${where}: restricted_cartan`);
      intEq(rec.restricted_reflection_word_lengths, g.restricted_reflection_word_lengths, `${where}: restricted_reflection_word_lengths`);
      // the tool's own conversion for the screen and the export agrees with the harness's
      const inLabels = recordInLabels(board, rec);
      expect(inLabels.black_nodes, where).toEqual(g.black_nodes);
      expect(inLabels.tau, where).toEqual(g.tau);
      expect(inLabels.arrows, where).toEqual(g.arrows);
      expect(inLabels.w_X_word, where).toEqual(g.w_X_word);
      expect(inLabels.restricted_simple_orbits, where).toEqual(g.restricted_simple_orbits);
      expect(inLabels.restricted_orbits_in_bourbaki_order, where).toEqual(g.restricted_orbits_in_bourbaki_order);
    }
    expect([...checked].sort()).toEqual(Object.keys(RECORDS[0]!).sort());
  });

  it('the C2 adjustment: the four C2 records name the restricted board C2 and list its orbits reversed from satake; the drawing follows the record', () => {
    const c2 = all.filter(({ g }) => g.restricted_type_display === 'C2');
    expect(c2.map(({ g }) => g.real_form).sort()).toEqual(['so*(8)', 'sp(2,2)', 'sp(4,R)', 'su(2,2)']);
    for (const { g, d, data } of c2) {
      const plain = satake(d);
      expect(plain.restricted_board, g.real_form).toBe('B2');
      expect(data.drawing!.name, g.real_form).toBe('C2');
      expect(data.drawing!.orbits.map((o) => labels(d.board, o)), g.real_form).toEqual(g.restricted_orbits_in_bourbaki_order);
      expect(data.drawing!.orbits, g.real_form).toEqual([...plain.restricted_orbits_in_bourbaki_order!].reverse());
    }
    // a B2 record keeps satake's order
    const so25 = all.find(({ g }) => g.real_form === 'so(2,5)')!;
    expect(so25.data.drawing!.name).toBe('B2');
    expect(so25.data.drawing!.orbits).toEqual(satake(so25.d).restricted_orbits_in_bourbaki_order);
  });

  it('D4 with black nodes 3 and 4 gives so(2,6) with B2 and so*(8) with C2', () => {
    const d = diagramOf('D4', [3, 4], [1, 2, 3, 4]);
    const data = dataOf(d);
    expect(data.entries.map((e) => [e.real_form, e.restricted_type_display])).toEqual([
      ['so(2,6)', 'B2'],
      ['so*(8)', 'C2'],
    ]);
    expect(data.entries.map((e) => e.real_form)).toEqual(matchRecord(EXAMPLES, { type: 'D4', black_nodes: [3, 4], tau: [1, 2, 3, 4] }).real_forms);
    // the drawing follows the record whose pair is the reader's: so(2,6), drawn B2
    expect(data.drawingEntry).toBe(0);
    expect(data.drawing!.name).toBe('B2');
    // with a pair of the class that is no record's own (black 1 and 4), the drawing follows the first record
    const d14 = diagramOf('D4', [1, 4], [1, 2, 3, 4]);
    const data14 = dataOf(d14);
    expect(data14.entries.map((e) => e.real_form)).toEqual(['so(2,6)', 'so*(8)']);
    expect(data14.drawingEntry).toBe(0);
    // the reader's own pair gives the numbers: black nodes and tau are the reader's
    expect(labels(d14.board, data14.entries[1]!.black_nodes)).toEqual([1, 4]);
    // so*(8) loaded by its own pair is drawn C2
    const d13 = diagramOf('D4', [1, 3], [1, 2, 3, 4]);
    const data13 = dataOf(d13);
    expect(data13.drawingEntry).toBe(1);
    expect(data13.drawing!.name).toBe('C2');
  });

  it('the restricted board drawn by its name agrees with restricted_cartan through the Bourbaki orbits (135 records)', () => {
    let n = 0;
    for (const { g, d, data } of all) {
      if (g.real_rank === 0) {
        expect(data.drawing, g.real_form).toBeNull();
        continue;
      }
      n++;
      const drawn = B(data.drawing!.name);
      const C = drawn.cartan;
      const idx = data.drawing!.orbitIndex;
      for (let k = 0; k < drawn.n; k++) {
        for (let l = 0; l < drawn.n; l++) expect(C[k]![l], `${g.dynkin_type} ${g.real_form} (${k}, ${l})`).toBe(g.restricted_cartan[idx[k]!]![idx[l]!]);
      }
      // the pair (m_lambda, m_2lambda) at each drawn node is found by orbit, not by index
      data.drawing!.orbits.forEach((o, k) => {
        const s = g.restricted_simple_orbits.findIndex((x) => x.join() === labels(d.board, o).join());
        expect(data.drawing!.pairs[k], g.real_form).toEqual(g.restricted_simple_multiplicities[s]);
      });
    }
    expect(n).toBe(all.filter(({ g }) => g.real_rank > 0).length);
  });

  it('multiplicities in text by drawn node, Bourbaki order, the pair found by orbit (every record); none for a compact form', () => {
    // SPEC 2.15 worked value (e6(-26)): restricted board A2, every restricted root of multiplicity 8, no doubled root
    const e626 = all.find(({ g }) => g.real_form === 'e6(-26)')!;
    expect(multiplicitiesText(e626.data)).toBe('1: (8, 0); 2: (8, 0)');
    // every record, against the golden pair of the orbit drawn at each Bourbaki node
    for (const { g, data } of all) {
      if (g.restricted_orbits_in_bourbaki_order === null) continue;
      expect(multiplicitiesText(data), g.real_form).toBe(g.restricted_orbits_in_bourbaki_order.map((o, k) => `${k + 1}: (${goldenPair(g, o).join(', ')})`).join('; '));
    }
    // e6(-14) is one of the records where drawn node 1 is not the first orbit in orbit order
    const e614 = all.find(({ g }) => g.real_form === 'e6(-14)')!;
    expect(e614.data.drawing!.orbits.map((o) => labels(e614.d.board, o))).toEqual(e614.g.restricted_orbits_in_bourbaki_order);
    expect(e614.data.drawing!.orbitIndex[0]).not.toBe(0);
    const su4 = all.find(({ g }) => g.real_form === 'su(4)')!;
    expect(multiplicitiesText(su4.data)).toBe('none');
    expect(su4.data.shape).toBe('compact');
    expect(all.find(({ g }) => g.real_form === 'sl(4,R)')!.data.shape).toBe('split');
    expect(all.find(({ g }) => g.real_form === 'su(2,2)')!.data.shape).toBe('quasi-split');
    expect(all.find(({ g }) => g.real_form === 'su(1,3)')!.data.shape).toBeNull();
  });

  it('restricted node names: the orbit and the pair found by orbit (every record)', () => {
    let n = 0;
    for (const { g, d, data } of all) {
      if (g.restricted_orbits_in_bourbaki_order === null) continue;
      g.restricted_orbits_in_bourbaki_order.forEach((o, k) => {
        const [a, b] = goldenPair(g, o);
        expect(restrictedNodeName(d, data, k + 1), g.real_form).toBe(`Restricted node ${k + 1}, orbit ${listText(o)}, multiplicity ${a} and ${b}`);
        n++;
      });
    }
    expect(n).toBeGreaterThan(all.filter(({ g }) => g.real_rank > 0).length);
  });

  it('data on su(1,3) and the examples of Appendix B: real rank, restricted type, dimensions, character', () => {
    for (const [type, form] of [['A3', 'su(1,3)'], ['B3', 'so(2,5)'], ['C3', 'sp(1,2)'], ['E6', 'e6(-26)'], ['G2', 'g2(-14)']] as const) {
      const { g, data } = all.find((x) => x.g.dynkin_type === type && x.g.real_form === form)!;
      const e = data.entries[data.drawingEntry]!;
      intEq([e.real_rank, e.dim_k, e.dim_p, e.character], [g.real_rank, g.dim_k, g.dim_p, g.character], form);
      expect(e.restricted_type_display, form).toBe(g.restricted_type_display);
    }
  });
});

describe('play theta (SPEC 4 T13, 2.15, A.5)', () => {
  it('the worked values of A.5: su*(4) on (0,1,0), su(1,3) on (0,0,1), su(1,2)', () => {
    const s4 = diagramOf('A3', [1, 3], [1, 2, 3]);
    const t = thetaStages(s4, [0, 1, 0]);
    expect(wordLabels(s4.board, t.word)).toEqual([1, 3]);
    expect(t.stage1).toEqual([0, 1, 0]);
    expect(t.stage2).toEqual([
      [1, 1, 0],
      [1, 1, 1],
    ]);
    expect(t.stage3).toEqual([-1, -1, -1]);
    const s13 = diagramOf('A3', [2], [3, 2, 1]);
    const u = thetaStages(s13, [0, 0, 1]);
    expect(u.stage1).toEqual([1, 0, 0]);
    expect(u.stage2).toEqual([[1, 1, 0]]);
    expect(u.stage3).toEqual([-1, -1, 0]);
    const s12 = diagramOf('A2', [], [2, 1]);
    for (const p of [[1, 0], [0, 1], [3, -2]]) expect(thetaStages(s12, p).stage3).toEqual(neg([p[1]!, p[0]!]));
    expect(thetaStages(s12, [1, 0]).stage2).toEqual([]);
  });

  it('thetaStages ends at theta for every root of every catalogue record of rank at most 4', () => {
    let count = 0;
    for (const { g, d } of all) {
      if (g.rank > 4) continue;
      for (const r of rootsOffered(d.board)) {
        const t = thetaStages(d, r);
        const end = t.stage3;
        expect(end, `${g.real_form} ${r.join(',')}`).toEqual(theta(d, r));
        expect(t.stage2.length).toBe(t.word.length);
        count++;
      }
    }
    expect(count).toBeGreaterThan(500);
  });

  it('the default root: the first positive root that is not a root of the black sub-board; on a compact form the first positive root', () => {
    expect(defaultRoot(diagramOf('A3', [1, 3], [1, 2, 3]))).toEqual([0, 1, 0]);
    expect(defaultRoot(diagramOf('A3', [2], [3, 2, 1]))).toEqual([0, 0, 1]);
    const e6 = diagramOf('E6', [2, 3, 4, 5], [1, 2, 3, 4, 5, 6]);
    const a6 = toPositions(e6.board, [6])[0]!;
    expect(defaultRoot(e6)).toEqual(e6.board.labels.map((_, i) => (i === a6 ? 1 : 0)));
    const su4 = diagramOf('A3', [1, 2, 3], [3, 2, 1]);
    expect(defaultRoot(su4)).toEqual(positiveRoots(su4.board)[0]);
    // rootsOffered: the positive roots, sorted, then their negatives
    const pr = positiveRoots(B('A3'));
    expect(rootsOffered(B('A3'))).toEqual([...pr, ...pr.map(neg)]);
  });
});

describe('shadows (SPEC 4 T13 Shadows, 2.15, A.5)', () => {
  it('the tables of A.5: su(1,2), su*(4), su(1,3)', () => {
    const half = (rows: ReturnType<typeof shadowRows>) =>
      rows.map((r) => [r.text, r.roots.length, r.roots.map((x) => `${x.root.join(',')}>${x.theta.join(',')}`).join(' ')]);
    expect(half(shadowRows(diagramOf('A2', [], [2, 1])))).toEqual([
      ['(1/2, 1/2)', 2, '0,1>-1,0 1,0>0,-1'],
      ['(1, 1)', 1, '1,1>-1,-1'],
    ]);
    expect(half(shadowRows(diagramOf('A3', [1, 3], [1, 2, 3])))).toEqual([
      ['0', 2, '0,0,1>0,0,1 1,0,0>1,0,0'],
      ['(1/2, 1, 1/2)', 4, '0,1,0>-1,-1,-1 0,1,1>-1,-1,0 1,1,0>0,-1,-1 1,1,1>0,-1,0'],
    ]);
    expect(half(shadowRows(diagramOf('A3', [2], [3, 2, 1])))).toEqual([
      ['0', 1, '0,1,0>0,1,0'],
      ['(1/2, 1/2, 1/2)', 4, '0,0,1>-1,-1,0 0,1,1>-1,0,0 1,0,0>0,-1,-1 1,1,0>0,0,-1'],
      ['(1, 1, 1)', 1, '1,1,1>-1,-1,-1'],
    ]);
  });

  it('the shadow rows group every positive root by shadow2; counts agree with the multiplicities (every record)', () => {
    for (const { g, d } of all) {
      const rows = shadowRows(d);
      const total = rows.reduce((s, r) => s + r.roots.length, 0);
      expect(total, g.real_form).toBe(positiveRoots(d.board).length);
      for (const r of rows) for (const x of r.roots) expect(shadow2(d, x.root), g.real_form).toEqual(r.shadow2);
      // the positive restricted roots: n_restricted_roots / 2 rows besides the row 0
      intEq(rows.filter((r) => !r.zero).length * 2, g.n_restricted_roots, g.real_form);
      expect(rows.some((r) => r.zero), g.real_form).toBe(g.roots_compact_imaginary > 0);
    }
  });

  it('shadows on su(1,2): lambda with multiplicity 2 and 2 lambda with multiplicity 1, on one ray at distances 1 and 2', () => {
    const d = diagramOf('A2', [], [2, 1]);
    const data = dataOf(d);
    const pts = shadowPoints(d, data, shadowRows(d))!;
    expect(pts.rank).toBe(1);
    const byCoord = new Map(pts.points.map((p) => [p.coords.join(','), p]));
    expect(byCoord.get('1')!.mult).toBe(2);
    expect(byCoord.get('2')!.mult).toBe(1);
    expect(byCoord.get('-1')!.mult).toBe(2);
    expect(byCoord.get('-2')!.mult).toBe(1);
    const x1 = byCoord.get('1')!.xy;
    const x2 = byCoord.get('2')!.xy;
    expect(Math.abs(x2[0] - 2 * x1[0])).toBeLessThan(1e-12);
    expect(Math.abs(x2[1] - 2 * x1[1])).toBeLessThan(1e-12);
  });
});

describe('the restricted board and composite moves (SPEC 4 T13 Restricted board, 2.15)', () => {
  it('e6(-26) (SPEC 2.15 worked example): w_X has 12 letters, each composite move has reduced length 8; alpha_6 is the simple restricted root of its node and that node reflects it', () => {
    const { g, d, data } = all.find(({ g }) => g.real_form === 'e6(-26)')!;
    const e = data.entries[0]!;
    // SPEC 2.15 worked values: the word of w_X has 12 letters, each composite move has reduced length 8
    expect(e.w_X_word.length).toBe(12);
    const root = defaultRoot(d);
    // the drawn node whose orbit holds node 6 (golden Bourbaki order): alpha_6 is its simple restricted root
    const k6 = g.restricted_orbits_in_bourbaki_order!.findIndex((o) => o.includes(6));
    const unit = g.restricted_orbits_in_bourbaki_order!.map((_, k) => (k === k6 ? 1 : 0));
    for (let k = 1; k <= 2; k++) {
      const move = restrictedClick(d, data, k, root);
      expect(move.reducedLength).toBe(8);
      // the composite word: the word of w_X, then the longest word of X u O, of length l(w_X) + the reduced length
      expect(move.word.length).toBe(2 * e.w_X_word.length + move.reducedLength);
      expect(move.populations.length).toBe(move.word.length);
    }
    expect(coordinatesInBourbaki(d, data, shadow2(d, root))).toEqual(unit);
    const move = restrictedClick(d, data, k6 + 1, root);
    expect(coordinatesInBourbaki(d, data, shadow2(d, move.populations[move.populations.length - 1]!))).toEqual(unit.map((x) => (x === 0 ? 0 : -x)));
  });

  it('a click on drawn node k plays the word of the orbit drawn there, found by orbit (e6(-14): node 1 is orbit 2)', () => {
    const { d, data } = all.find(({ g }) => g.real_form === 'e6(-14)')!;
    const m1 = restrictedClick(d, data, 1, defaultRoot(d));
    expect(labels(d.board, data.rb.orbits[m1.orbitIndex]!)).toEqual([2]);
    expect(m1.word).toEqual(data.rb.compositeWords[m1.orbitIndex]);
    const m2 = restrictedClick(d, data, 2, defaultRoot(d));
    expect(labels(d.board, data.rb.orbits[m2.orbitIndex]!)).toEqual([1, 6]);
  });

  it('each composite word acts on shadows as the reflection of restricted_cartan (every record of positive real rank, every root, every orbit)', () => {
    let checks = 0;
    for (const { g, d, data } of all) {
      if (g.real_rank === 0) continue;
      const golden_C = g.restricted_cartan;
      const rbBoard = { n: golden_C.length, cartan: golden_C, labels: golden_C.map((_, i) => i + 1), kind: 'gcm', arith: d.board.arith } as unknown as Board<number>;
      const drawn = B(data.drawing!.name);
      for (const r of rootsOffered(d.board)) {
        const before = coordinatesInOrbitOrder(d, data.rb, shadow2(d, r));
        const beforeB = coordinatesInBourbaki(d, data, shadow2(d, r))!;
        for (let k = 1; k <= drawn.n; k++) {
          const move = restrictedClick(d, data, k, r);
          const after = move.populations.length === 0 ? r : move.populations[move.populations.length - 1]!;
          // orbit order: mutate on the golden restricted_cartan at the orbit's index
          expect(coordinatesInOrbitOrder(d, data.rb, shadow2(d, after)), `${g.real_form} ${r.join(',')} node ${k}`).toEqual(mutate(rbBoard, before, move.orbitIndex));
          // the drawing: mutate on the drawn restricted board at node k, in Bourbaki order
          expect(coordinatesInBourbaki(d, data, shadow2(d, after)), `${g.real_form} ${r.join(',')} drawn ${k}`).toEqual(mutate(drawn, beforeB, toPositions(drawn, [k])[0]!));
          checks++;
        }
      }
    }
    expect(checks).toBeGreaterThan(1000);
  }, 300000);
});

/** The engine's coordinates in orbit order (restrictedCoordinates, P6-A1's follow-up). */
function coordinatesInOrbitOrder(d: SatakeDiagram, rb: RestrictedLike, s2: number[]): number[] {
  return restrictedCoordinates(d, rb as never, s2);
}

describe('where the computation runs (E-9; 7.6)', () => {
  it('on E7 and E8 every satake, restrictedBoard, satakeRecord and matchCatalogue call is routed to the worker, and on E6 to the main thread', async () => {
    for (const [type, where] of [['E6', 'main'], ['E7', 'worker'], ['E8', 'worker'], ['A3', 'main'], ['D8', 'main']] as const) {
      const board = B(type);
      expect(whereToRun(satakeHint(board)), type).toBe(where);
      const seen: { fn: string; kind: string; board: string | undefined }[] = [];
      const stub: Caller = (fn, args, hint) => {
        seen.push({ fn, kind: hint.kind, board: hint.board.name });
        expect(whereToRun(hint), `${type} ${fn}`).toBe(where);
        return Promise.resolve(({ satake, restrictedBoard, matchCatalogue } as Record<string, (...a: unknown[]) => unknown>)[fn]!(...(args as unknown[]))) as never;
      };
      const d = diagramOf(type, [], board.labels.map((l) => l).sort((a, b) => a - b));
      const got = await fetchData(d, admissibility(d), stub);
      expect(got, type).not.toBeNull();
      expect(seen.map((s) => s.fn).sort(), type).toEqual(['matchCatalogue', 'restrictedBoard', 'satake']);
      expect(seen.every((s) => s.kind === 'satake' && s.board === type), type).toBe(true);
      expect(seen.some((s) => s.fn === 'satakeRecord'), type).toBe(false);
    }
  });
});

describe('state, link and presets (SPEC 6.6; 4.0; CONTRACTS 6)', () => {
  it('the state round-trips through encodeState and decodeState with x and t only', () => {
    for (const p of T13_PRESET_IDS) {
      const pr = T13_PRESETS[p];
      const s = toolStateOf({ board: pr.board, black: pr.black, tau: pr.tau });
      expect(Object.keys(s).sort()).toEqual(['black', 'board', 'schema', 'tau', 'tool']);
      const q = encodeState(s);
      expect(q).toBe(`z=1&g=${pr.board}&x=${pr.black.join('.')}&t=${pr.tau.join('.')}`);
      const back = decodeState(q, 'satake', toolStateOf({ board: 'A3', black: [2], tau: [3, 2, 1] }));
      expect(back.notice).toBeNull();
      expect(admitLink(q, toolStateOf({ board: 'A3', black: [2], tau: [3, 2, 1] }), '').state).toEqual(s);
    }
    expect(encodeState(toolStateOf({ board: 'A1', black: [], tau: [1] }))).toBe('z=1&g=A1&x=&t=1');
    // a board alone gives the split form on that board
    const defaults = toolStateOf({ board: 'A3', black: [2], tau: [3, 2, 1] });
    expect(admitLink('g=E6', defaults, '').state).toEqual(toolStateOf({ board: 'E6', black: [], tau: [1, 2, 3, 4, 5, 6] }));
    // a key absent keeps the configured value; a lesson instance reads its prefixed keys
    expect(admitLink('b3.x=1.3&b3.t=1.2.3', defaults, 'b3').state).toEqual(toolStateOf({ board: 'A3', black: [1, 3], tau: [1, 2, 3] }));
    // repeated or unsorted black labels are read as a set
    expect(admitLink('x=3.1.3&t=1.2.3', defaults, '').state.black).toEqual([1, 3]);
  });

  it('a t that is not an involutive symmetry, a board the tool does not offer, a stray label: the defaults with the notice', () => {
    const defaults = toolStateOf({ board: 'A3', black: [2], tau: [3, 2, 1] });
    for (const q of ['g=A3&t=2.1.3', 'g=A3&t=1.2', 'g=A3~', 'g=pentagon', 'g=c:2,-1;-1,2', 'x=7', 'g=D4&t=3.2.4.1', 'g=E9']) {
      const r = admitLink(q, defaults, '');
      expect(r.notice, q).toBe(LINK_NOTICE);
      expect(r.state, q).toEqual(defaults);
    }
  });

  it('each preset is a state object with its panel; captions are computed from the engine and name the result', () => {
    for (const p of T13_PRESET_IDS) {
      const pr = T13_PRESETS[p];
      expect(T13_BOARDS).toContain(pr.board);
      const d = diagramOf(pr.board, pr.black, pr.tau);
      expect(admissibility(d).admissible || p === 'lights', p).toBe(true);
      const c = captionFor(pr);
      expect(c.length, p).toBeGreaterThan(40);
      expect(c, p).not.toMatch(/—/);
    }
    const g = (type: string, form: string): GoldenSatakeRecord => matchRecord(RECORDS, { dynkin_type: type, real_form: form });
    const su13 = g('A3', 'su(1,3)');
    const c0 = captionFor(T13_PRESETS.default);
    expect(c0).toContain('su(1,3)');
    expect(c0).toContain(`real rank ${su13.real_rank}`);
    expect(c0).toContain(`dim 𝔨 = ${su13.dim_k}`);
    const e6 = g('E6', 'e6(-26)');
    const cr = captionFor(T13_PRESETS.restricted);
    expect(cr).toContain(`fixed sequence of ${dataOf(diagramOf('E6', [2, 3, 4, 5], [1, 2, 3, 4, 5, 6])).rb.compositeWords[0]!.length} moves of E6`);
    expect(cr).toContain(`multiplicity ${e6.multiplicities[0]!.mult}`);
    expect(cr).toContain(e6.restricted_board!);
    const cc = captionFor(T13_PRESETS.catalogue);
    expect(cc).toContain(`${RECORDS.filter((r) => r.dynkin_type === 'D4').length} records`);
    expect(cc).toContain('so(2,6) and so*(8)');
    // SPEC A.5 worked value: theta of su*(4) takes (0, 1, 0) to (-1, -1, -1)
    expect(captionFor(T13_PRESETS['play-theta'])).toContain('(−1, −1, −1)');
  });

  it('the catalogue rows: the records of the board in the engine order, so(2,6) and so*(8) marked as one real form', () => {
    const rows = catalogueRows('D4');
    expect(rows.map((r) => r.realForm)).toEqual(RECORDS.filter((r) => r.dynkin_type === 'D4').map((r) => r.real_form));
    const same = rows.filter((r) => r.sameAs.length > 0);
    expect(same.map((r) => [r.realForm, r.sameAs])).toEqual([
      ['so(2,6)', ['so*(8)']],
      ['so*(8)', ['so(2,6)']],
    ]);
    for (const type of TYPE_NAMES) {
      const rs = catalogueRows(type);
      for (const r of rs) {
        const gr = matchRecord(RECORDS, { dynkin_type: type, real_form: r.realForm });
        expect(r.black, `${type} ${r.realForm}`).toEqual(gr.black_nodes);
        expect(r.tau, `${type} ${r.realForm}`).toEqual(gr.tau);
        expect(r.arrows, `${type} ${r.realForm}`).toEqual(gr.arrows);
        expect(r.cartanLabel).toBe(gr.cartan_label);
        expect(r.restrictedTypeDisplay).toBe(gr.restricted_type_display);
        if (type !== 'D4') expect(r.sameAs).toEqual([]);
      }
    }
  });
});

describe('captions (SPEC 4.0 "Starts meaningful"; 6.5 and 8.4: display spellings)', () => {
  it('on every admissible pair and every panel: names with a true minus sign, formulas in words, dim 𝔨, "1 move"; the restricted panel pairs each drawn node with its own word and reduced length', () => {
    // the data of each record's own pair, computed once in beforeAll (the first record of a pair, as the drawing)
    const known = new Map<string, { g: GoldenSatakeRecord; data: Assembled }>();
    for (const { g, d, data } of all) {
      const key = pairKey({ board: d.board.name!, black: labels(d.board, d.black), tau: tauToLabels(d.board, d.tau) });
      if (!known.has(key)) known.set(key, { g, data });
    }
    const panels = ['lights', 'data', 'theta', 'shadows', 'restricted', 'catalogue'] as const;
    let captions = 0;
    let nodes = 0;
    let mixed = 0;
    for (const type of TYPE_NAMES) {
      for (const [black, tau] of PAIRS[type]!) {
        const d = diagramOf(type, black, tau);
        const adm = admissibility(d);
        const rec = known.get(pairKey({ board: type, black, tau }));
        const data = rec?.data ?? dataOf(d);
        // on a record's own pair, the golden reduced length of the orbit at Bourbaki node k, found by orbit
        const goldenL = (k: number): number | null =>
          rec === undefined || rec.g.restricted_orbits_in_bourbaki_order === null ? null : goldenReducedLength(rec.g, rec.g.restricted_orbits_in_bourbaki_order[k]!);
        const where = `${type} black ${black.join(',')} tau ${tau.join('.')}`;
        for (const panel of panels) {
          const c = captionText({ d, panel, toggle: false, adm, data, root: defaultRoot(d) });
          captions++;
          expect(c, `${where} ${panel}`).not.toContain('-');
          expect(c, `${where} ${panel}`).not.toContain('_');
          expect(c, `${where} ${panel}`).not.toMatch(/\bdim [kp]\b/);
          expect(c, `${where} ${panel}`).not.toMatch(/\b1 moves\b/);
          expect(c, `${where} ${panel}`).not.toContain('—');
          if (panel !== 'catalogue') for (const e of data.entries) expect(c, `${where} ${panel}`).toContain(displayName(e.real_form));
        }
        if (data.drawing === null) continue;
        // each drawn node k (Bourbaki order): its word has 2 l(w_X) + L letters, L the reduced length of the orbit drawn at k
        const c = captionText({ d, panel: 'restricted', toggle: false, adm, data, root: defaultRoot(d) });
        const wX = data.sat.w_X_word.length;
        const ownL = data.drawing.orbits.map((o) => data.sat.restricted_reflection_word_lengths[data.sat.restricted_simple_orbits.findIndex((x) => x.join() === o.join())]!);
        const uniform = /each of its moves is a fixed sequence of (\d+) moves? of [A-G]\d, of reduced length (\d+),/.exec(c);
        const items = [...c.matchAll(/(\d+) moves? of reduced length (\d+) at node (\d+)/g)].map((m) => m.slice(1).map(Number));
        if (uniform !== null) {
          expect(items, where).toEqual([]);
          expect(new Set(ownL).size, where).toBe(1);
          expect(Number(uniform[2]), where).toBe(ownL[0]);
          expect(Number(uniform[1]), where).toBe(2 * wX + ownL[0]!);
          if (goldenL(0) !== null) expect(Number(uniform[2]), where).toBe(goldenL(0));
          nodes += ownL.length;
        } else {
          mixed++;
          expect(items.map(([, , k]) => k), where).toEqual(ownL.map((_, k) => k + 1));
          for (const [n, l, k] of items) {
            expect(l, `${where} node ${k}`).toBe(ownL[k! - 1]);
            if (goldenL(k! - 1) !== null) expect(l, `${where} node ${k} (golden)`).toBe(goldenL(k! - 1));
            expect(n, `${where} node ${k}`).toBe(2 * wX + l!);
            nodes++;
          }
        }
      }
    }
    expect(captions).toBe(6 * Object.values(PAIRS).reduce((s, p) => s + p.length, 0));
    expect(nodes).toBeGreaterThan(all.filter(({ g }) => g.real_rank > 0).length);
    // the pairs the review found mis-paired (their two nodes differ) are among the ones checked node by node
    expect(mixed).toBeGreaterThanOrEqual(6);
    // and a word of one letter is "1 move" (the split form of A1)
    const a1 = diagramOf('A1', [], [1]);
    expect(captionText({ d: a1, panel: 'restricted', toggle: false, adm: admissibility(a1), data: dataOf(a1), root: defaultRoot(a1) })).toContain('a fixed sequence of 1 move of A1');
  }, 120000);

  it('names in their display spelling: a true minus sign (e6(−26)); the data spelling stays in data', () => {
    expect(displayName('e6(-26)')).toBe('e6(−26)');
    expect(displayName('su(1,3)')).toBe('su(1,3)');
    const e6 = diagramOf('E6', [2, 3, 4, 5], [1, 2, 3, 4, 5, 6]);
    const data = dataOf(e6);
    expect(data.entries[0]!.real_form).toBe('e6(-26)');
    const c = captionText({ d: e6, panel: 'data', toggle: false, adm: admissibility(e6), data, root: defaultRoot(e6) });
    expect(c).toContain('e6(−26)');
    expect(c).toContain('dim 𝔨 = ');
    expect(c).toContain('dim 𝔭 = ');
  });
});

describe('announcements (A-4, plan wording) and stated limits (4.0)', () => {
  it('paint, tau, a stage of theta, a composite move', () => {
    const a2 = diagramOf('A2', [1], [1, 2]);
    expect(announcePaint(a2.board, 1, true, lights(admissibility(a2), a2.board))).toBe(
      'Node 1 painted black. Condition 1 holds, condition 2 holds, condition 3 fails. Not admissible.',
    );
    const a3 = diagramOf('A3', [2], [3, 2, 1]);
    expect(announceTau(a3.board, a3.tau, lights(admissibility(a3), a3.board))).toBe('τ exchanges 1 and 3. Condition 1 holds, condition 2 holds, condition 3 holds. Admissible.');
    const e6 = diagramOf('E6', [], [6, 2, 5, 4, 3, 1]);
    expect(announceTau(e6.board, e6.tau, lights(admissibility(e6), e6.board))).toMatch(/^τ exchanges 1 and 6, and 3 and 5\. /);
    const id = diagramOf('A3', [], [1, 2, 3]);
    expect(announceTau(id.board, id.tau, lights(admissibility(id), id.board))).toMatch(/^τ is the identity\. /);
    expect(announcePaint(a3.board, 2, false, lights(admissibility(a3), a3.board))).toMatch(/^Node 2 painted white\. /);
    // at most four nodes: every population and the step number (A-4)
    expect(announceStage(a3.board, 2, [1, 0, 1], [1, 1, 1], 2)).toBe('Stage 2 of θ. Populations now 1, 1, 1. Move 2.');
    expect(announceComposite(a3.board, 1, 1, null, [0, 1, 0], [0, -1, 0], 1)).toBe('Played the composite move of restricted node 1, 1 mutation. Populations now 0, minus 1, 0. Move 1.');
    expect(announceRestart(a3.board, 'Reset.', [1, 1, 0], [0, 0, 1])).toBe('Reset. Populations now 0, 0, 1. Move 0.');
    // above four nodes: only the changed cities, read by the site's changedOnly, and the step number (A-4)
    const e6b = diagramOf('E6', [2, 3, 4, 5], [1, 2, 3, 4, 5, 6]).board;
    const p = (labelled: number[]): number[] => fromLabelOrder(e6b, labelled);
    expect(announceStage(e6b, 1, p([0, 0, 0, 0, 0, 1]), p([0, 0, 0, 0, 0, 1]), 1)).toBe('Stage 1 of θ. Move 1.');
    expect(announceStage(e6b, 2, p([0, 0, 0, 0, 0, 1]), p([1, 1, 2, 2, 1, 1]), 2)).toBe('Stage 2 of θ. City 1 now 1, city 2 now 1, city 3 now 2, city 4 now 2, city 5 now 1. Move 2.');
    expect(announceComposite(e6b, 2, 32, [0, -1], p([0, 0, 0, 0, 0, 1]), p([0, 0, 0, 0, 0, -1]), 3)).toBe(
      'Played the composite move of restricted node 2, 32 mutations. Shadow coordinates now 0, minus 1. City 6 now minus 1. Move 3.',
    );
    expect(announceRestart(e6b, 'Root chosen.', p([0, 0, 0, 0, 0, 1]), p([1, 0, 0, 0, 0, 1]))).toBe('Root chosen. City 1 now 1. Move 0.');
    // the same text as announceTemplates.changedOnly after its head
    expect(populationsTail(e6b, p([0, 0, 0, 0, 0, 1]), p([0, 0, 0, 0, 0, -1]), 3)).toBe(announceTemplates.changedOnly('Mutated', 6, [[6, -1]], 3).replace(/^Mutated city 6\. /, ''));
  });

  it('the failure sentence of a worker that failed', () => {
    expect(failureSentence('the engine worker failed: unknown error')).toBe(
      'The data could not be computed (the engine worker failed: unknown error). The next change of the decoration or the board asks for them again.',
    );
    expect(failureSentence('')).toMatch(/^The data could not be computed\. /);
  });

  it('no text the model writes says not of finite type, stopped after or still running after', () => {
    const banned = /not of finite type|stopped after|still running after/i;
    const texts: string[] = [];
    for (const type of TYPE_NAMES) {
      const board = B(type);
      const d = diagramOf(type, [], [...board.labels].sort((a, b) => a - b));
      const adm = admissibility(d);
      texts.push(...lights(adm, d.board).lights.map((l) => l.word), ...failureNote(adm).map(plainText));
      texts.push(captionFor({ board: type, black: [], tau: [...board.labels].sort((a, b) => a - b), panel: 'data', toggle: false }));
    }
    for (const { d, data } of all) {
      texts.push(multiplicitiesText(data), ...data.entries.map((e) => JSON.stringify(recordInLabels(d.board, e))));
      if (data.drawing) for (let k = 1; k <= data.drawing.orbits.length; k++) texts.push(restrictedNodeName(d, data, k));
    }
    for (const t of texts) expect(t).not.toMatch(banned);
    expect(texts.length).toBeGreaterThan(400);
  });

  it('Download data holds the verdicts and the record fields in labels, integers as numbers', () => {
    const d = diagramOf('D4', [3, 4], [1, 2, 3, 4]);
    const data = dataOf(d);
    const x = exportData(d, admissibility(d), data, shadowRows(d)) as {
      admissibility: { admissible: boolean; condition_3: boolean; reasons: Record<string, unknown> };
      records: { real_form: string; black_nodes: number[]; dim_k: number }[];
      shadows: { shadow: string; roots: number[][] }[];
    };
    expect(x.admissibility.admissible).toBe(true);
    expect(x.records.map((r) => r.real_form)).toEqual(['so(2,6)', 'so*(8)']);
    expect(x.records[0]!.black_nodes).toEqual([3, 4]);
    expect(typeof x.records[0]!.dim_k).toBe('number');
    expect(x.shadows.length).toBeGreaterThan(0);
    const a2 = diagramOf('A2', [1], [1, 2]);
    const y = exportData(a2, admissibility(a2), null, null) as { admissibility: { reasons: { condition_3: { nodes: number[]; value: string } } }; records: unknown[] };
    expect(y.admissibility.reasons.condition_3).toEqual({ code: 'not-an-integer', nodes: [2], value: '-1/2' });
    expect(y.records).toEqual([]);
  });

  it('the data-out names of the registry are unique and include the names of the instruction', () => {
    expect(new Set(T13_OUTS).size).toBe(T13_OUTS.length);
    for (const n of ['decoration', 'black-nodes', 'tau', 'arrows', 'light-1', 'light-2', 'light-3', 'reason-1', 'reason-2', 'reason-3', 'verdict', 'failure-note',
      'real-form', 'cartan-label', 'restricted-type', 'real-rank', 'multiplicities', 'dim-k', 'dim-p', 'character', 'shape', 'theta-word', 'theta-stage',
      'shadow', 'shadow-coordinates', 'shadow-picture', 'shadow-table', 'restricted-board', 'restricted-name', 'composite-word', 'composite-length',
      'catalogue', 'catalogue-row', 'same-form', 'examples', 'notice', 'citeText']) {
      expect(T13_OUTS as readonly string[]).toContain(n);
    }
    expect(toLabels(B('A3'), [0])).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------------------------
// The registry entry and the server render (7.4, 4.0 "Works before and without JavaScript", CONTRACTS 6)
// ---------------------------------------------------------------------------------------------

type T13Module = { default: unknown };
let loader: SsrLoader;
let T13C: T13Module;

beforeAll(async () => {
  loader = await ssrLoader();
  T13C = await loader.load<T13Module>('/src/components/tools/T13SatakeStudio.svelte');
}, 120000);

/** The text of each element carrying data-out="name" whose content has no nested element of the same tag. */
const outText = (body: string, name: string): string[] =>
  [...body.matchAll(new RegExp(`data-out="${name}"[^>]*>([^]*?)</(?:p|span|div|li|ul|strong|dd|figcaption)>`, 'g'))].map((m) =>
    m[1]!.replace(/<!--[^]*?-->/g, '').replace(/<[^>]+>/g, '').trim(),
  );
/** The data-value of each node button inside the element data-out="name", in document order. */
const valuesIn = (body: string, name: string): string[] => {
  const at = body.indexOf(`data-out="${name}"`);
  if (at < 0) return [];
  const rest = body.slice(at);
  const end = rest.indexOf('</div></div>');
  return [...rest.slice(0, end < 0 ? undefined : end).matchAll(/data-node="(\d+)"[^>]*?data-value="([^"]*)"/g)].map((m) => m[2]!);
};

describe('T13 registry entry and server render', () => {
  it('the registry entry: number 13, id satake, phase 6, the 32 boards, the eight presets of CONTRACTS 6 as state objects, the outs', () => {
    expect([T13.number, T13.id, T13.title, T13.phase]).toEqual([13, 'satake', 'Satake Studio', 6]);
    expect(T13.boards).toEqual([...T13_BOARDS]);
    expect(Object.keys(T13.presets).sort()).toEqual([...T13_PRESET_IDS].sort());
    for (const id of T13_PRESET_IDS) {
      const p = T13_PRESETS[id];
      expect(T13.presets[id], id).toEqual({ board: p.board, black: p.black, tau: p.tau, caption: captionFor(p) });
    }
    expect(T13.presets.default).toEqual({ board: 'A3', black: [2], tau: [3, 2, 1], caption: captionFor(T13_PRESETS.default) });
    expect(T13.outs).toEqual([...T13_OUTS]);
  });

  it('each preset renders its state and its panel open at build time', () => {
    for (const id of T13_PRESET_IDS) {
      const p = T13_PRESETS[id];
      const body = loader.render(T13C.default, { id: 'b1', preset: id });
      expect(body, id).toContain(`data-panel="${p.panel}"`);
      expect(outText(body, 'black-nodes'), id).toEqual([p.black.join('.')]);
      expect(outText(body, 'tau'), id).toEqual([p.tau.join('.')]);
      expect(outText(body, 'caption'), id).toEqual([captionFor(p)]);
    }
    const lightsBody = loader.render(T13C.default, { id: 'b1', preset: 'lights' });
    expect((lightsBody.match(/data-control="example"/g) ?? []).length).toBe(T13_EXAMPLES.length);
    expect(outText(lightsBody, 'light-3')).toEqual(['holds']);
    const theta1 = loader.render(T13C.default, { id: 'b1', preset: 'play-theta' });
    expect(outText(theta1, 'theta-word')).toEqual(['1 3']);
    expect(outText(theta1, 'theta-stage')).toEqual(['0']);
    expect(valuesIn(theta1, 'game-board')).toEqual(['0', '1', '0']);
    const shadows = loader.render(T13C.default, { id: 'b1', preset: 'shadows' });
    expect(shadows).toContain('data-out="shadow-picture"');
    expect(shadows).toContain('data-out="shadow-table"');
    expect((shadows.match(/data-point="/g) ?? []).length).toBe(4);
    const restricted = loader.render(T13C.default, { id: 'b1', preset: 'restricted' });
    expect(outText(restricted, 'restricted-name')).toEqual(['A2']);
    expect(valuesIn(restricted, 'restricted-board')).toEqual(['0', '1']);
    expect(outText(restricted, 'real-form')).toHaveLength(0); // the restricted panel is open, not the data
    const catalogue = loader.render(T13C.default, { id: 'b1', preset: 'catalogue' });
    expect((catalogue.match(/data-out="catalogue-row"/g) ?? []).length).toBe(RECORDS.filter((r) => r.dynkin_type === 'D4').length);
    expect((catalogue.match(/data-out="same-form"/g) ?? []).length).toBe(2);
    const tob = loader.render(T13C.default, { id: 'b1', preset: 'tau-on-black' });
    expect(tob).toContain('data-black-arrow="2-4"');
    expect(tob).toContain('data-arrow="1-5"');
    expect(tob).toMatch(/data-control="toggle"[^>]*checked|checked[^>]*data-control="toggle"/);
    const def = loader.render(T13C.default, { id: '', preset: 'default', caption: captionFor(T13_PRESETS.default) });
    expect(def).toContain('data-name="su(1,3)"');
    expect(outText(def, 'real-rank')).toEqual(['1']);
  });

  it('a board property without black and tau gives the split form on that board; properties override the preset', () => {
    const a1 = loader.render(T13C.default, { id: 'b1', board: 'A1', preset: 'default' });
    expect(outText(a1, 'black-nodes')).toEqual(['']);
    expect(outText(a1, 'tau')).toEqual(['1']);
    expect(a1).toContain(`data-name="${matchRecord(RECORDS, { dynkin_type: 'A1', black_nodes: [] }).real_form}"`);
    const over = loader.render(T13C.default, { id: 'b2', preset: 'play-theta', black: [2], tau: [3, 2, 1] });
    expect(outText(over, 'black-nodes')).toEqual(['2']);
    expect(over).toContain('data-panel="theta"');
    const root = loader.render(T13C.default, { id: 'b3', preset: 'play-theta', root: [1, 1, 0] });
    expect(valuesIn(root, 'game-board')).toEqual(['1', '1', '0']);
    expect(() => loader.render(T13C.default, { id: 'b4', board: 'A3~' })).toThrow(/b4/);
    expect(() => loader.render(T13C.default, { id: 'b5', board: 'A3', black: [], tau: [2, 1, 3] })).toThrow(/b5/);
    expect(() => loader.render(T13C.default, { id: 'b6', board: 'A3', root: [1, 0, 1] })).toThrow(/b6/);
  });

  it('an unknown preset id fails the build with the list of presets', () => {
    expect(() => loader.render(T13C.default, { id: 'p1', preset: 'shadow' })).toThrow(/T13 instance p1: unknown preset shadow \(presets: default, play-theta, shadows, lights, data, restricted, catalogue, tau-on-black\)/);
    // an inherited property name is no preset either
    expect(() => loader.render(T13C.default, { id: 'p2', preset: 'toString' })).toThrow(/unknown preset toString/);
    for (const id of T13_PRESET_IDS) expect(() => loader.render(T13C.default, { id: 'p3', preset: id })).not.toThrow();
  });

  it('an instance configured on E7 or E8 carries the data of its pair in the island, and only those (E-9)', () => {
    for (const [board, black, tau] of [['E7', [], [1, 2, 3, 4, 5, 6, 7]], ['E7', [2, 5, 7], [1, 2, 3, 4, 5, 6, 7]], ['E8', [], [1, 2, 3, 4, 5, 6, 7, 8]]] as const) {
      const body = loader.render(T13C.default, { id: 'e1', board, black: [...black], tau: [...tau] });
      const d = diagramOf(board, black, tau);
      const now = computeNow(d, admissibility(d))!;
      const script = islandScript('e1', pairKey({ board, black: [...black], tau: [...tau] }), pairJson(now));
      expect(body, board).toContain(script);
      expect(body.split('data-t13-pair=').length - 1, board).toBe(1);
      // the JSON reads back to the same data, and the data shown at build time are those data
      const json = /data-t13-pair="[^"]*">([^<]*)<\/script>/.exec(body)![1]!;
      const back = pairFromJson(json)!;
      expect(back.sat).toEqual(now.sat);
      expect(back.records).toEqual(now.records);
      expect(back.rb.compositeWords).toEqual(now.rb.compositeWords);
      expect(back.rb.orbits).toEqual(now.rb.orbits);
      expect(outText(body, 'real-rank')).toEqual([String(now.sat.real_rank)]);
    }
    // a board whose data are computed on the main thread carries none
    for (const props of [{ id: 'e2' }, { id: 'e3', board: 'E6' }, { id: 'e4', board: 'D8' }, { id: 'e5', preset: 'restricted' }]) {
      expect(loader.render(T13C.default, props), JSON.stringify(props)).not.toContain('data-t13-pair');
    }
    // a pair that is not admissible has no data, so the island carries none
    expect(loader.render(T13C.default, { id: 'e6', board: 'E7', black: [1], tau: [1, 2, 3, 4, 5, 6, 7] })).not.toContain('data-t13-pair');
    // pairJson leaves no character that could end the script element, and reads back exactly
    const e7 = diagramOf('E7', [], [1, 2, 3, 4, 5, 6, 7]);
    const e7now = computeNow(e7, admissibility(e7))!;
    const odd = { ...e7now, records: [{ ...e7now.records[0]!, real_form: '</script><!-- & \u2028' }] };
    const oddJson = pairJson(odd);
    expect(oddJson).not.toMatch(/[<>&\u2028]/);
    expect(pairFromJson(oddJson)!.records[0]!.real_form).toBe('</script><!-- & \u2028');
    expect(pairFromJson('{"sat": 1}')).toBeNull();
    expect(pairFromJson('not json')).toBeNull();
  });

  it('the figure is named with display spellings (A-10)', () => {
    const body = loader.render(T13C.default, { id: 'f1', board: 'E6', black: [2, 3, 4, 5], tau: [1, 2, 3, 4, 5, 6] });
    expect(body).toContain('aria-label="Satake Studio on E6 with black nodes 2, 3, 4 and 5 and τ the identity: admissible, e6(−26)."');
  });

  it('an author caption stays; the preset caption follows the state', () => {
    expect(outText(loader.render(T13C.default, { id: 'c1', caption: 'An author caption.' }), 'caption')).toEqual(['An author caption.']);
    expect(outText(loader.render(T13C.default, { id: 'c2', board: 'E6', black: [2, 3, 4, 5], tau: [1, 2, 3, 4, 5, 6] }), 'caption')[0]).toContain('e6(−26)');
  });

  it('every data-out name the server renders is in the outs; every control is disabled; no em-dash', () => {
    const bodies = [
      ...T13_PRESET_IDS.map((p) => loader.render(T13C.default, { id: 'b1', preset: p })),
      loader.render(T13C.default, { id: 'b2', board: 'A2', black: [1], tau: [1, 2] }),
      loader.render(T13C.default, { id: 'b3', board: 'G2', black: [1, 2], tau: [1, 2], preset: 'restricted' }),
      loader.render(T13C.default, { id: 'b4', board: 'E8' }),
      loader.render(T13C.default, { id: 'b5', board: 'A3', black: [1], tau: [3, 2, 1], preset: 'play-theta' }),
      loader.render(T13C.default, { id: 'b6', prediction: { question: 'Which?', answer: { type: 'number', value: 1 }, reveal: 'One.' } }),
    ];
    const seen = new Set<string>();
    for (const body of bodies) {
      for (const m of body.matchAll(/data-out="([^"]+)"/g)) seen.add(m[1]!);
      // every control is rendered disabled until hydration (7.4)
      for (const m of body.matchAll(/<(button|select|input)\b[^>]*>/g)) expect(m[0], m[0]).toMatch(/\sdisabled(\s|=|>|\/)/);
      expect(body).not.toContain('—');
    }
    for (const name of seen) expect(T13_OUTS as readonly string[], name).toContain(name);
    // the not-admissible case renders the failure note and no data
    expect(bodies[T13_PRESET_IDS.length]).toContain('data-out="failure-note"');
    expect(bodies[T13_PRESET_IDS.length]).not.toContain('data-out="real-rank"');
    // the compact form: no restricted board
    expect(bodies[T13_PRESET_IDS.length + 1]).toContain('data-out="no-restricted-roots"');
    // E8 at build time: the data computed in Node (E-9 does not apply there)
    expect(outText(bodies[T13_PRESET_IDS.length + 2]!, 'real-rank')).toEqual(['8']);
    // conditions 1 and 2 failing: theta is not offered
    expect(bodies[T13_PRESET_IDS.length + 3]).toContain('data-out="theta-note"');
  });
});

afterAll(async () => {
  all = [];
  await loader?.close();
});

// ---------------------------------------------------------------------------------------------
// Regressions of the phase 6 red-team round (RT-FIX P6, cluster t13)
// ---------------------------------------------------------------------------------------------

describe('regressions', () => {
  // Adopted from the RT-02 lens (site/tests/unit/redteam-RT-02-p6-c2-once.test.ts), attack 13 (the C2 adjustment
  // applied by the wrong function). SPEC 6.4: "This adjustment is made by satake_record (engine: satakeRecord);
  // the plain function satake would say B2." SPEC Appendix H, Rules (and CLAUDE.md): "Satake records for display
  // come from satakeRecord, which applies the C2 naming of SPEC 6.4." The second test checks that the records T13
  // shows are satakeRecord's for the reader's own pair, on every catalogue pair and every symmetry image of one.
  describe('RT-02 p6 attack 13: the C2 naming of SPEC 6.4 is applied by satakeRecord only', () => {
    // regression: P6-RT-02-01
    it('t13/model.ts does not apply the C2 adjustment itself', () => {
      const src = readFileSync(fileURLToPath(new URL('../../../src/components/tools/t13/model.ts', import.meta.url)), 'utf8');
      const code = src
        .split('\n')
        .map((line, k) => [k + 1, line] as const)
        .filter(([, line]) => !/^\s*(\/\/|\*|\/\*\*)/.test(line));
      const hits = code.filter(([, line]) => /restricted_type_display === 'C2'|restrictedBoardName = 'C2'|order\.reverse\(\)/.test(line)).map(([k, line]) => `model.ts:${k}: ${line.trim()}`);
      expect(hits).toEqual([]);
    });

    // regression: P6-RT-02-01
    it('satakeRecord on the reader\'s own pair gives the restricted board and Bourbaki orbits T13 shows (every catalogue pair and symmetry image, rank at most 6)', () => {
      let checked = 0;
      for (const name of T13_BOARDS) {
        const board = boardFromName(name) as Board<number>;
        if (board.n > 6) continue;
        const auts = symmetries(board);
        for (const e of satakeCatalogue(name)) {
          for (const g of auts) {
            const black = e.black_nodes.map((i) => g[i]!).sort((a, b) => a - b);
            const tau: number[] = new Array(board.n).fill(0);
            e.tau.forEach((t, i) => {
              tau[g[i]!] = g[t]!;
            });
            const d: SatakeDiagram = { board, black, tau };
            const records = matchCatalogue(d);
            const data = assembleData(satake(d), black.length === board.n ? { orbits: [], simpleRestrictedRoots2: [], cartan: [], compositeWords: [] } : restrictedBoard(d), records, d);
            data.entries.forEach((shown, k) => {
              const r = satakeRecord(name, { ...records[k]!, black_nodes: black, tau });
              expect([shown.restricted_board, shown.restricted_orbits_in_bourbaki_order], `${name} ${shown.real_form} ${black.join('.')} ${tau.join('.')}`).toEqual([
                r.restricted_board,
                r.restricted_orbits_in_bourbaki_order,
              ]);
              checked++;
            });
          }
        }
      }
      expect(checked).toBeGreaterThan(100);
    });

    // The fix takes the records for display from satakeRecord (t13/model.ts displayRecord); on E7 and E8 that must
    // not put satakeRecord on the main thread (SPEC 5.1 E-9 item 3). Their only symmetry is the identity, so every
    // record matchCatalogue returns there is of the reader's own pair and is returned as it is (the same object:
    // satakeRecord would make a new one).
    // regression: P6-RT-02-01
    it('on E7 and E8 the record for display of every admissible pair is the record matchCatalogue returned (no satakeRecord on the main thread, E-9)', () => {
      let checked = 0;
      for (const type of ['E7', 'E8']) {
        for (const [black, tau] of PAIRS[type]!) {
          const d = diagramOf(type, black, tau);
          const records = matchCatalogue(d);
          expect(records.length, `${type} ${black.join('.')}`).toBeGreaterThan(0);
          for (const r of records) {
            expect(displayRecord(d, r), `${type} ${r.real_form}`).toBe(r);
            checked++;
          }
        }
      }
      expect(checked).toBe(RECORDS.filter((r) => r.dynkin_type === 'E7' || r.dynkin_type === 'E8').length);
    });
  });

  // Adopted from the RT-02 lens (site/tests/unit/redteam-RT-02-p6-label-arith.test.ts), attack 1 (stray
  // conversions between positions and labels) on T13's restricted board. SPEC 5.1 E-7: "Two functions, toLabels
  // and toPositions, convert node lists and words; nothing else converts." T13 draws the restricted board as
  // boardFromName(<restricted board name>), and the arrays of the drawing (orbits, pairs, orbitIndex,
  // coordinates) are in its position order; a label of a drawn node is turned into an index of those arrays only
  // by toPositions on the drawn board, and back only by toLabels.
  describe('RT-02 p6: T13 converts restricted-board labels only through toLabels and toPositions (E-7)', () => {
    const FILES = ['../../../src/components/tools/t13/model.ts', '../../../src/components/tools/T13SatakeStudio.svelte'];
    /** Index arithmetic on a restricted-board label: x[k - 1], x[l - 1], or a label written as k + 1. */
    const PATTERNS: RegExp[] = [/(orbits|pairs|orbitIndex|coords|drawnPairs)\[[kl] - 1\]/, /\$\{k \+ 1\}/];

    // regression: P6-RT-02-02
    it('no label arithmetic on the drawn restricted board', () => {
      const hits: string[] = [];
      for (const rel of FILES) {
        const path = fileURLToPath(new URL(rel, import.meta.url));
        readFileSync(path, 'utf8')
          .split('\n')
          .forEach((line, k) => {
            if (/^\s*(\/\/|\*|\/\*\*)/.test(line)) return;
            if (PATTERNS.some((p) => p.test(line))) hits.push(`${rel.replace('../../../', 'site/')}:${k + 1}: ${line.trim()}`);
          });
      }
      expect(hits).toEqual([]);
    });
  });
});
