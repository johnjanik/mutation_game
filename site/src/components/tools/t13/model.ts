// T13, the Satake Studio: the pure functions of the tool (SPEC.md 4 T13, 2.15, 6.4, 6.5, A.5; E-5, E-7).
// Owner P6-A3. No DOM. Imported by T13SatakeStudio.svelte, by the registry entry through t13/caption.ts,
// and by site/tests/unit/tools/T13.test.ts, so that the unit test guards the tool's own data path.
//
// Mathematics comes from the engine only (SPEC 7.3): admissibility, theta, shadow2, longestWord, mutate,
// positiveRoots, satakeCatalogue, canonicalPair, choleskyBasis. What this file adds is bookkeeping: labels
// and positions (converted with toLabels and toPositions only, E-7), the C2 display adjustment of SPEC 6.4
// applied to the reader's own pair, the Bourbaki order of the drawn restricted board found by orbit, the
// three stages of theta (stage 1 moves entries along tau, stage 3 changes signs, stage 2 is the engine's
// word played with mutate), and the sentences the Studio writes. The coordinates of a shadow in the simple
// restricted roots come from the engine helper of t13/coords.ts; no linear system is solved here.
//
// This module is loaded in plain Node by the registry entry (registry-outs.spec.ts): it imports only the
// engine by its package name, the config, coords.ts and lib/a11y.ts (which imports nothing).
import {
  boardFromName,
  canonicalPair,
  choleskyBasis,
  longestWord,
  mutate,
  positiveRoots,
  satakeCatalogue,
  shadow2,
  symmetries,
  theta,
  toLabels,
  toPositions,
} from '@two-games/engine';
import type { Admissibility, Board, Reason, RestrictedBoard, SatakeComputed, SatakeDiagram, SatakeRecord, Word } from '@two-games/engine';
import { speakList } from '../../../lib/a11y';
import { restrictedCoordinatesFn } from './coords';
import type { T13Panel } from './config';

/** U+2212, the minus sign of values on screen (SPEC 6.3; house style 8.4). */
export const MINUS = '−';

// ---------------------------------------------------------------------------------------------
// Rich text: plain strings with subscripts and superscripts, rendered by the component
// ---------------------------------------------------------------------------------------------

export type RichPart = string | { sub: string } | { sup: string };
export type Rich = readonly RichPart[];

/** The text of a rich sentence as the page's textContent reads it (subscripts and superscripts inline). */
export function plainText(r: Rich): string {
  return r.map((p) => (typeof p === 'string' ? p : 'sub' in p ? p.sub : p.sup)).join('');
}

// ---------------------------------------------------------------------------------------------
// Boards, labels and positions (E-7)
// ---------------------------------------------------------------------------------------------

const boards = new Map<string, Board<number>>();

/** The board of a named finite type, built once per name (a named finite board uses SafeInt, E-2). */
export function boardOf(name: string): Board<number> {
  let b = boards.get(name);
  if (b === undefined) {
    b = boardFromName(name) as Board<number>;
    boards.set(name, b);
  }
  return b;
}

/** The labels of the board in increasing order: the order of `t` and of every vector shown (6.6). */
export function labelOrder(board: Board<number>): number[] {
  return [...board.labels].sort((a, b) => a - b);
}

/** The positions of the labels in increasing order. */
function labelOrderPositions(board: Board<number>): number[] {
  return toPositions(board, labelOrder(board));
}

/** A vector indexed by position, written in label order. */
export function inLabelOrder(board: Board<number>, v: readonly number[]): number[] {
  return labelOrderPositions(board).map((p) => v[p]!);
}

/** A vector written in label order, indexed by position. */
export function fromLabelOrder(board: Board<number>, v: readonly number[]): number[] {
  const out: number[] = new Array(board.n).fill(0);
  labelOrderPositions(board).forEach((p, k) => {
    out[p] = v[k]!;
  });
  return out;
}

/** tau in positions to the images of all nodes, in label order (the field `tau` of 6.6 and 6.4). */
export function tauToLabels(board: Board<number>, tau: readonly number[]): number[] {
  return labelOrderPositions(board).map((p) => toLabels(board, [tau[p]!])[0]!);
}

/** The images of all nodes in label order to tau in positions. */
export function tauFromLabels(board: Board<number>, images: readonly number[]): number[] {
  const out: number[] = new Array(board.n).fill(0);
  labelOrderPositions(board).forEach((p, k) => {
    out[p] = toPositions(board, [images[k]!])[0]!;
  });
  return out;
}

/** The identity in positions. */
export function identityTau(board: Board<number>): number[] {
  return board.labels.map((_, i) => i);
}

/** Labels to a SatakeDiagram in positions: the black labels read as a set, sorted (SPEC 5.2, E-7). */
export function diagramOf(boardName: string, blackLabels: readonly number[], tauLabels: readonly number[]): SatakeDiagram {
  const board = boardOf(boardName);
  const black = [...new Set(toPositions(board, [...blackLabels]))].sort((a, b) => a - b);
  return { board, black, tau: tauFromLabels(board, tauLabels) };
}

/** "1", "1 and 2", "1, 2 and 4". */
export function listText(xs: readonly (number | string)[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** The pairs {i, tau(i)} with i < tau(i) among `nodes` (positions), sorted. */
function exchangedPairs(tau: readonly number[], keep: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < tau.length; i++) {
    const j = tau[i]!;
    if (i < j && keep(i) && keep(j)) out.push([i, j]);
  }
  return out;
}

/** The pairs of white nodes exchanged by tau (positions): the arrows of the drawing (2.15, 6.4 `arrows`). */
export function arrowsOf(d: SatakeDiagram): [number, number][] {
  const black = new Set(d.black);
  return exchangedPairs(d.tau, (i) => !black.has(i));
}

/** The pairs of black nodes exchanged by tau (positions): what the toggle "show tau on black nodes" draws. */
export function blackPairsOf(d: SatakeDiagram): [number, number][] {
  const black = new Set(d.black);
  return exchangedPairs(d.tau, (i) => black.has(i));
}

/** Every pair of nodes exchanged by tau, in labels: "identity", "1 ↔ 3", "1 ↔ 6, 3 ↔ 5" (the tau picker). */
export function pairsText(board: Board<number>, tau: readonly number[]): string {
  const pairs = exchangedPairs(tau, () => true).map((p) => toLabels(board, p).sort((a, b) => a - b));
  if (pairs.length === 0) return 'identity';
  return pairs
    .sort((a, b) => a[0]! - b[0]!)
    .map(([a, b]) => `${a} ↔ ${b}`)
    .join(', ');
}

/** The symmetries of the board of order at most 2, in the engine's order (the identity first). */
export function involutions(board: Board<number>): number[][] {
  return symmetries(board)
    .filter((t) => t.every((x, i) => t[x] === i))
    .map((t) => [...t]);
}

const rootCache = new WeakMap<Board<number>, number[][]>();

/** The positive roots of a finite board, sorted by total then lexicographically (positiveRoots), once per board. */
export function positiveRootsOf(board: Board<number>): number[][] {
  let r = rootCache.get(board);
  if (r === undefined) {
    r = positiveRoots(board);
    rootCache.set(board, r);
  }
  return r;
}

/** The roots the root picker offers: the positive roots in their order, then their negatives (plan). */
export function rootsOffered(board: Board<number>): number[][] {
  const pos = positiveRootsOf(board);
  return [...pos.map((r) => [...r]), ...pos.map((r) => r.map((x) => (x === 0 ? 0 : -x)))];
}

/**
 * The default root (plan): the first positive root that is not a root of the black sub-board (its support
 * reaches a white node); on the compact form, where every root is black, the first positive root.
 */
export function defaultRoot(d: SatakeDiagram): number[] {
  const black = new Set(d.black);
  const pos = positiveRootsOf(d.board);
  const r = pos.find((v) => v.some((x, i) => x !== 0 && !black.has(i))) ?? pos[0]!;
  return [...r];
}

// ---------------------------------------------------------------------------------------------
// The three lights (SPEC 4 T13 Three lights; 2.15; 5.2 Reason)
// ---------------------------------------------------------------------------------------------

/** Each condition of 2.15 in one line (plan wording). */
export const T13_CONDITIONS: readonly Rich[] = [
  ['τ', { sup: '2' }, ' = 1 and τ(X) = X'],
  ['on the black nodes, τ agrees with ', MINUS, 'w', { sub: 'X' }],
  ['at every white node j fixed by τ, ⟨α', { sub: 'j' }, ', ρ', { sub: 'X' }, { sup: '∨' }, '⟩ is an integer'],
];

export type Verdict = 'holds' | 'fails';

export interface LightView {
  n: 1 | 2 | 3;
  holds: boolean;
  word: Verdict;
  /** The sentence from the engine's Reason record, with node labels; null when the light holds. */
  reason: Rich | null;
}

export interface LightsView {
  symmetry: { holds: boolean; reason: Rich | null };
  lights: [LightView, LightView, LightView];
  admissible: boolean;
  verdict: 'admissible' | 'not admissible';
}

/** A fraction of the engine ("-1/2") with a true minus sign. */
function fractionText(v: string): string {
  return v.trim().replace(/^-/, MINUS);
}

function nodesWord(xs: readonly number[]): string {
  return `${xs.length === 1 ? 'node' : 'nodes'} ${listText(xs)}`;
}

/** The sentence of one Reason record, with labels (plan wording, decisions/P6-A3.md). */
export function reasonSentence(r: Reason, board: Board<number>): Rich {
  const ls = toLabels(board, r.nodes);
  switch (r.code) {
    case 'not-a-symmetry':
      return [`τ is not a symmetry of the board (it breaks the roads at ${nodesWord(ls)}).`];
    case 'not-an-involution':
      return [`τ applied twice is not the identity (${nodesWord(ls)}).`];
    case 'moves-black-set':
      return ls.length === 1
        ? [`τ sends black node ${ls[0]} to a white node, so it does not keep the black set.`]
        : [`τ sends black nodes ${listText(ls)} to white nodes, so it does not keep the black set.`];
    case 'differs-from-minus-wX':
      return [`On the black ${nodesWord(ls)}, τ differs from ${MINUS}w`, { sub: 'X' }, '.'];
    case 'not-an-integer': {
      // one fraction per node, in the order of the nodes, joined by "; " (MERGE ruling (2) on P6-A1)
      const values = (r.value ?? '').split(';').map(fractionText);
      const out: RichPart[] = [];
      ls.forEach((l, k) => {
        if (k > 0) out.push(k === ls.length - 1 ? ' and ' : ', ');
        out.push(`${k === 0 ? 'At' : 'at'} node ${l} the number ⟨α`, { sub: String(l) }, ', ρ', { sub: 'X' }, { sup: '∨' }, `⟩ is ${values[k] ?? ''}`);
      });
      out.push(ls.length === 1 ? ', which is not an integer.' : ', which are not integers.');
      return out;
    }
  }
}

/** The three lights, each judged on its own, with their sentences, and the verdict (SPEC 2.15). */
export function lights(adm: Admissibility, board: Board<number>): LightsView {
  const light = (n: 1 | 2 | 3): LightView => {
    const holds = adm[`condition_${n}`];
    const r = adm.reasons[`condition_${n}`];
    return { n, holds, word: holds ? 'holds' : 'fails', reason: holds || r === undefined ? null : reasonSentence(r, board) };
  };
  const sym = adm.reasons.symmetry;
  return {
    symmetry: { holds: adm.symmetry, reason: adm.symmetry || sym === undefined ? null : reasonSentence(sym, board) },
    lights: [light(1), light(2), light(3)],
    admissible: adm.admissible,
    verdict: adm.admissible ? 'admissible' : 'not admissible',
  };
}

/** The first sentence of the failure note, always shown when the pair is not admissible (plan wording). */
export const FAILURE_FIRST = 'This decoration is not the Satake diagram of any real form, so the Studio shows no data for it.';

/**
 * The note shown when the pair is not admissible (SPEC 2.15 "What a failed condition 3 means", in the site's
 * words). It never says that theta is not an involution: with conditions 1 and 2 holding, theta permutes the
 * roots and is an involution (the unit test checks it on every such pair of rank at most 4).
 */
export function failureNote(adm: Admissibility): Rich[] {
  const out: Rich[] = [[FAILURE_FIRST]];
  if (adm.symmetry && adm.condition_1 && adm.condition_2 && !adm.condition_3) {
    out.push([
      'Conditions 1 and 2 hold, and θ = ',
      MINUS,
      'w',
      { sub: 'X' },
      '∘τ can still be played: it permutes the roots, and playing it twice gives back the root. But no involution of the Lie algebra acts as this θ on the Cartan subalgebra and fixes the root vectors of the black nodes.',
    ]);
  }
  return out;
}

/** "Condition 1 holds, condition 2 holds, condition 3 fails. Not admissible." */
export function verdictTail(v: LightsView): string {
  const [a, b, c] = v.lights;
  return `Condition 1 ${a.word}, condition 2 ${b.word}, condition 3 ${c.word}. ${v.admissible ? 'Admissible.' : 'Not admissible.'}`;
}

/** After painting a node (A-4, plan wording). */
export function announcePaint(_board: Board<number>, label: number, black: boolean, v: LightsView): string {
  return `Node ${label} painted ${black ? 'black' : 'white'}. ${verdictTail(v)}`;
}

/** After a choice of tau (A-4, plan wording): "τ exchanges 1 and 3. ..." or "τ is the identity. ...". */
export function announceTau(board: Board<number>, tau: readonly number[], v: LightsView): string {
  const pairs = exchangedPairs(tau, () => true).map((p) => toLabels(board, p).sort((a, b) => a - b));
  pairs.sort((a, b) => a[0]! - b[0]!);
  if (pairs.length === 0) return `τ is the identity. ${verdictTail(v)}`;
  const parts = pairs.map(([a, b]) => `${a} and ${b}`);
  const said = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return `τ exchanges ${said}. ${verdictTail(v)}`;
}

/** After a stage of theta (A-4, plan wording). */
export function announceStage(stage: 1 | 2 | 3, populations: readonly number[]): string {
  return `Stage ${stage} of θ. Populations now ${speakList(populations)}.`;
}

/** After a composite move, one announcement for the whole word (A-4, plan wording). */
export function announceComposite(label: number, mutations: number, coords: readonly number[] | null): string {
  const head = `Played the composite move of restricted node ${label}, ${mutations} ${mutations === 1 ? 'mutation' : 'mutations'}.`;
  return coords === null ? head : `${head} Shadow coordinates now ${speakList(coords)}.`;
}

// ---------------------------------------------------------------------------------------------
// The data of an admissible pair (SPEC 4 T13 When admissible; 6.4; 6.5)
// ---------------------------------------------------------------------------------------------

/** The part of the engine's RestrictedBoard the Studio reads (rb.board is never read: the worker rebuilds it by name). */
export interface RestrictedLike {
  orbits: number[][];
  simpleRestrictedRoots2: number[][];
  cartan: number[][];
  compositeWords: Word[];
}

/** The restricted board of a pair with no white node (the compact form): empty (MERGE ruling (4) on P6-A1). */
export const EMPTY_RESTRICTED: RestrictedLike = { orbits: [], simpleRestrictedRoots2: [], cartan: [], compositeWords: [] };

/** How the restricted board is drawn: its name and, for each drawn node k (Bourbaki order), its orbit. */
export interface Drawing {
  /** The restricted board's name after the C2 adjustment of the record drawn by (SPEC 6.4). */
  name: string;
  /** The orbit (positions) drawn at Bourbaki node k + 1. */
  orbits: number[][];
  /** For Bourbaki node k + 1, the index of its orbit in rb.orbits (orbit order), found by orbit. */
  orbitIndex: number[];
  /** (m_lambda, m_2lambda) at Bourbaki node k + 1. */
  pairs: [number, number][];
  /** The reduced length of the composite move of Bourbaki node k + 1. */
  reducedLengths: number[];
}

export type Shape = 'split' | 'compact' | 'quasi-split';

export interface Assembled {
  sat: SatakeComputed;
  rb: RestrictedLike;
  /** One complete record per matched name, with the golden field names, nodes as positions (the reader's pair). */
  entries: SatakeRecord[];
  /** The entry that decides the drawing of the restricted board (the C2 rule, decisions/P6-A3.md). */
  drawingEntry: number;
  drawing: Drawing | null;
  shape: Shape | null;
}

const sameList = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, k) => x === b[k]);

/**
 * Every displayed field of an admissible pair (plan signature assembleData(sat, rb, records, board), with the
 * board carried by the diagram). Numbers come from satake on the reader's own pair; names, Cartan's labels and
 * restricted_type_display from the records matchCatalogue returns. Each entry is a complete record of SPEC 6.4
 * for the reader's pair (black_nodes, tau, arrows and tau_moves_black_nodes are the reader's), and the C2
 * adjustment of 6.4 is applied entry by entry: where the entry displays C2, restricted_board is C2 and the
 * orbits in Bourbaki order are satake's, reversed. The restricted board is drawn by the record whose pair is
 * the reader's own, otherwise by the first record (on D4 with black nodes 3 and 4, so(2,6), drawn B2).
 */
export function assembleData(sat: SatakeComputed, rb: RestrictedLike, records: readonly SatakeRecord[], d: SatakeDiagram): Assembled {
  const board = d.board as Board<number>;
  const X = [...d.black].sort((a, b) => a - b);
  const tau = [...d.tau];
  const arrows = arrowsOf(d);
  const moves = X.some((i) => tau[i] !== i);
  const entries: SatakeRecord[] = records.map((r) => {
    let restrictedBoardName = sat.restricted_board;
    let order = sat.restricted_orbits_in_bourbaki_order === null ? null : sat.restricted_orbits_in_bourbaki_order.map((o) => [...o]);
    if (r.restricted_type_display === 'C2' && restrictedBoardName === 'B2' && order !== null) {
      restrictedBoardName = 'C2';
      order = order.reverse();
    }
    return {
      dynkin_type: board.name ?? r.dynkin_type,
      cartan_label: r.cartan_label,
      real_form: r.real_form,
      black_nodes: [...X],
      tau: [...tau],
      arrows: arrows.map(([a, b]) => [a, b] as [number, number]),
      tau_moves_black_nodes: moves,
      restricted_type_display: r.restricted_type_display,
      rank: sat.rank,
      real_rank: sat.real_rank,
      restricted_type: sat.restricted_type,
      multiplicities: sat.multiplicities.map((m) => ({ class: m.class, roots: m.roots, mult: m.mult })),
      n_restricted_roots: sat.n_restricted_roots,
      dim_g: sat.dim_g,
      dim_k: sat.dim_k,
      dim_p: sat.dim_p,
      character: sat.character,
      roots_compact_imaginary: sat.roots_compact_imaginary,
      roots_real: sat.roots_real,
      roots_complex: sat.roots_complex,
      w_X_word: [...sat.w_X_word],
      restricted_simple_orbits: sat.restricted_simple_orbits.map((o) => [...o]),
      restricted_simple_multiplicities: sat.restricted_simple_multiplicities.map(([a, b]) => [a, b] as [number, number]),
      restricted_cartan: sat.restricted_cartan === null ? [] : sat.restricted_cartan.map((row) => [...row]),
      restricted_board: restrictedBoardName,
      restricted_orbits_in_bourbaki_order: order,
      restricted_reflection_word_lengths: [...sat.restricted_reflection_word_lengths],
    };
  });
  const own = records.findIndex((r) => sameList(recordBlack(r), X) && sameList(r.tau, tau));
  const drawingEntry = entries.length === 0 ? -1 : own >= 0 ? own : 0;
  let drawing: Drawing | null = null;
  const e = entries[drawingEntry];
  if (e !== undefined && sat.real_rank > 0 && e.restricted_board !== null && e.restricted_orbits_in_bourbaki_order !== null) {
    const orbits = e.restricted_orbits_in_bourbaki_order.map((o) => [...o]);
    const orbitIndex = orbits.map((o) => rb.orbits.findIndex((x) => sameList(x, o)));
    drawing = {
      name: e.restricted_board,
      orbits,
      orbitIndex,
      pairs: orbitIndex.map((i) => [...sat.restricted_simple_multiplicities[i]!] as [number, number]),
      reducedLengths: orbitIndex.map((i) => sat.restricted_reflection_word_lengths[i]!),
    };
  }
  const n = board.n;
  const identity = tau.every((x, i) => x === i);
  const shape: Shape | null = X.length === n ? 'compact' : X.length === 0 ? (identity ? 'split' : 'quasi-split') : null;
  return { sat, rb, entries, drawingEntry, drawing, shape };
}

/** A record's own black nodes, sorted (records give them sorted; read again for safety). */
function recordBlack(r: SatakeRecord): number[] {
  return [...r.black_nodes].sort((a, b) => a - b);
}

/** A record with every node field in labels (the screen and Download data). */
export function recordInLabels(board: Board<number>, rec: SatakeRecord): Record<string, unknown> {
  return {
    ...rec,
    black_nodes: toLabels(board, rec.black_nodes),
    tau: tauToLabels(board, rec.tau),
    arrows: rec.arrows.map((p) => toLabels(board, p)),
    w_X_word: toLabels(board, rec.w_X_word),
    restricted_simple_orbits: rec.restricted_simple_orbits.map((o) => toLabels(board, o)),
    restricted_orbits_in_bourbaki_order: rec.restricted_orbits_in_bourbaki_order === null ? null : rec.restricted_orbits_in_bourbaki_order.map((o) => toLabels(board, o)),
  };
}

/** "1: (8, 0); 2: (8, 0)": the pair at each node of the drawn restricted board, Bourbaki order; "none" without one. */
export function multiplicitiesText(data: Assembled): string {
  if (data.drawing === null) return 'none';
  return data.drawing.pairs.map(([a, b], k) => `${k + 1}: (${a}, ${b})`).join('; ');
}

/** The accessible name of restricted node k (A-3, plan wording): its orbit in labels and its pair. */
export function restrictedNodeName(d: SatakeDiagram, data: Assembled, k: number): string {
  const drawing = data.drawing!;
  const orbit = toLabels(d.board, drawing.orbits[k - 1]!);
  const [a, b] = drawing.pairs[k - 1]!;
  return `Restricted node ${k}, orbit ${listText(orbit)}, multiplicity ${a} and ${b}`;
}

/** The orbit drawn at restricted node k, in labels ("1 and 6"). */
export function orbitText(d: SatakeDiagram, data: Assembled, k: number): string {
  return listText(toLabels(d.board, data.drawing!.orbits[k - 1]!));
}

// ---------------------------------------------------------------------------------------------
// Theta in three stages (SPEC 4 T13 Play theta; 2.15)
// ---------------------------------------------------------------------------------------------

/** The word of w_X: the longest word of the black sub-board (the engine's longestWord, positions). */
export function wordOfWX(d: SatakeDiagram): number[] {
  return [...longestWord(d.board, [...d.black].sort((a, b) => a - b))];
}

/**
 * The populations one stage of theta produces from p: stage 1, one population, each entry moved along tau
 * (q[tau[i]] = p[i], as the oracle); stage 2, the population after each letter of the word of w_X played as
 * mutations, left to right (empty when there is no black node); stage 3, one population, every sign changed.
 */
export function stageStep(d: SatakeDiagram, p: readonly number[], stage: 1 | 2 | 3, word: readonly number[] = wordOfWX(d)): number[][] {
  if (stage === 1) {
    const q: number[] = new Array(p.length).fill(0);
    for (let i = 0; i < p.length; i++) q[d.tau[i]!] = p[i]!;
    return [q];
  }
  if (stage === 3) return [p.map((x) => (x === 0 ? 0 : -x))];
  const out: number[][] = [];
  let v: number[] = [...p];
  for (const i of word) {
    v = mutate(d.board, v, i);
    out.push(v);
  }
  return out;
}

export interface ThetaStages {
  word: number[];
  stage1: number[];
  /** The population after each letter of the word of w_X. */
  stage2: number[][];
  stage3: number[];
}

/** The three stages of theta on a population (the end equals the engine's theta; unit test). */
export function thetaStages(d: SatakeDiagram, root: readonly number[]): ThetaStages {
  const word = wordOfWX(d);
  const stage1 = stageStep(d, root, 1, word)[0]!;
  const stage2 = stageStep(d, stage1, 2, word);
  const stage3 = stageStep(d, stage2.length > 0 ? stage2[stage2.length - 1]! : stage1, 3, word)[0]!;
  return { word, stage1, stage2, stage3 };
}

// ---------------------------------------------------------------------------------------------
// Shadows (SPEC 4 T13 Shadows; 2.15; A.5)
// ---------------------------------------------------------------------------------------------

/** Half of an integer, written as text: 2 gives "1", 1 gives "1/2", -1 gives "−1/2". */
export function halfText(x: number): string {
  if (x === 0) return '0';
  const sign = x < 0 ? MINUS : '';
  const a = Math.abs(x);
  return a % 2 === 0 ? `${sign}${a / 2}` : `${sign}${a}/2`;
}

/** A vector of integers in round brackets, with true minus signs: "(0, −1)". */
export function vectorText(v: readonly number[]): string {
  return `(${v.map((x) => (x < 0 ? `${MINUS}${-x}` : String(x))).join(', ')})`;
}

export interface ShadowRow {
  /** The doubled shadow, alpha - theta alpha, in positions. */
  shadow2: number[];
  /** The shadow at half, in label order: "0" or "(1/2, 1, 1/2)". */
  text: string;
  zero: boolean;
  /** The positive roots above it, with theta of each, in positions; lexicographic order. */
  roots: { root: number[]; theta: number[] }[];
}

const lex = (a: readonly number[], b: readonly number[]): number => {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k]! - b[k]!;
  return 0;
};

/**
 * The positive roots grouped by their shadow (shadow2, kept doubled; SPEC 2.15), the row 0 of the black
 * sub-board first when there is one, then the positive restricted roots by total, then lexicographically;
 * inside a row the roots in lexicographic order (the layout of A.5).
 */
export function shadowRows(d: SatakeDiagram): ShadowRow[] {
  const board = d.board as Board<number>;
  const groups = new Map<string, ShadowRow>();
  for (const r of positiveRootsOf(board)) {
    const s = shadow2(d, r);
    const key = s.join(',');
    let row = groups.get(key);
    if (row === undefined) {
      const zero = s.every((x) => x === 0);
      row = { shadow2: s, text: zero ? '0' : `(${inLabelOrder(board, s).map(halfText).join(', ')})`, zero, roots: [] };
      groups.set(key, row);
    }
    row.roots.push({ root: [...r], theta: theta(d, r) });
  }
  const rows = [...groups.values()];
  for (const row of rows) row.roots.sort((a, b) => lex(inLabelOrder(board, a.root), inLabelOrder(board, b.root)));
  const total = (v: readonly number[]): number => v.reduce((s, x) => s + x, 0);
  rows.sort((a, b) => (a.zero !== b.zero ? (a.zero ? -1 : 1) : total(a.shadow2) - total(b.shadow2) || lex(inLabelOrder(board, a.shadow2), inLabelOrder(board, b.shadow2))));
  return rows;
}

/**
 * The coordinates of a doubled shadow in the simple restricted roots, in the Bourbaki order of the drawn
 * restricted board: the engine's coordinates (orbit order, t13/coords.ts) read by orbit. Null when there is
 * no restricted board, when the engine helper is not available, or when the engine refuses the vector.
 */
export function coordinatesInBourbaki(d: SatakeDiagram, data: Assembled, s2: readonly number[]): number[] | null {
  const fn = restrictedCoordinatesFn;
  if (fn === null || data.drawing === null) return null;
  let c: number[];
  try {
    c = fn(d, data.rb as RestrictedBoard, s2);
  } catch (e) {
    if (e instanceof RangeError) return null;
    throw e;
  }
  return data.drawing.orbitIndex.map((i) => c[i]!);
}

export interface ShadowPoint {
  /** Coordinates in the simple restricted roots, Bourbaki order of the drawn board. */
  coords: number[];
  /** The point of the picture: the coordinates mapped by choleskyBasis of the drawn board (floats, drawing only). */
  xy: [number, number];
  mult: number;
  /** True for twice a restricted root (2 lambda of a BC system). */
  double: boolean;
  /** The doubled shadow (positions). */
  shadow2: number[];
}

export interface ShadowPoints {
  rank: 1 | 2;
  points: ShadowPoint[];
}

/**
 * The picture of the restricted roots for real rank 1 and 2 (SPEC 4 T13 Shadows): each restricted root at its
 * coordinates in the simple restricted roots (from the engine), mapped through the triangular basis
 * choleskyBasis of the drawn restricted board, with its multiplicity (the number of roots above it); the
 * negative restricted roots have the multiplicities of the positive ones (theta(-a) = -theta(a)). Null above
 * real rank 2, for the compact form, or when the coordinates are not available.
 */
export function shadowPoints(d: SatakeDiagram, data: Assembled, rows: readonly ShadowRow[]): ShadowPoints | null {
  const drawing = data.drawing;
  if (drawing === null || (drawing.orbits.length !== 1 && drawing.orbits.length !== 2)) return null;
  const U = choleskyBasis(boardOf(drawing.name));
  const r = drawing.orbits.length as 1 | 2;
  const points: ShadowPoint[] = [];
  for (const row of rows) {
    if (row.zero) continue;
    const c = coordinatesInBourbaki(d, data, row.shadow2);
    if (c === null) return null;
    for (const sign of [1, -1]) {
      const coords = c.map((x) => (x === 0 ? 0 : sign * x));
      let x = 0;
      let y = 0;
      for (let k = 0; k < r; k++) {
        x += U[0]![k]! * coords[k]!;
        if (r === 2) y += U[1]![k]! * coords[k]!;
      }
      points.push({ coords, xy: [x, y], mult: row.roots.length, double: false, shadow2: row.shadow2.map((v) => (v === 0 ? 0 : sign * v)) });
    }
  }
  const keys = new Set(points.map((p) => p.coords.join(',')));
  for (const p of points) p.double = p.coords.every((x) => x % 2 === 0) && keys.has(p.coords.map((x) => x / 2).join(','));
  return { rank: r, points };
}

// ---------------------------------------------------------------------------------------------
// The restricted board and composite moves (SPEC 4 T13 Restricted board; 2.15 "The restricted game")
// ---------------------------------------------------------------------------------------------

export interface CompositeMove {
  /** The index of the orbit drawn at the node, in rb.orbits (orbit order). */
  orbitIndex: number;
  /** The composite word (positions): the word of w_X, then the longest word of X u O; not reduced. */
  word: number[];
  reducedLength: number;
  /** The population after each letter, played as mutations from the given population. */
  populations: number[][];
}

/**
 * A click, Enter or Space on node k of the drawn restricted board: the orbit drawn there (Bourbaki order) is
 * found in rb.orbits by orbit, never by index (on e6(-14) node 1 is the orbit {2}, the second in orbit order),
 * and its composite word is played letter by letter on the big board with the engine's mutate.
 */
export function restrictedClick(d: SatakeDiagram, data: Assembled, k: number, population: readonly number[]): CompositeMove {
  const drawing = data.drawing;
  if (drawing === null) throw new RangeError('this pair has no restricted board');
  const orbitIndex = drawing.orbitIndex[k - 1];
  if (orbitIndex === undefined || orbitIndex < 0) throw new RangeError(`the restricted board has no node ${k}`);
  const word = [...data.rb.compositeWords[orbitIndex]!];
  const populations: number[][] = [];
  let v: number[] = [...population];
  for (const i of word) {
    v = mutate(d.board, v, i);
    populations.push(v);
  }
  return { orbitIndex, word, reducedLength: data.sat.restricted_reflection_word_lengths[orbitIndex]!, populations };
}

// ---------------------------------------------------------------------------------------------
// The catalogue (SPEC 4 T13 Catalogue; 6.4 Coincidences)
// ---------------------------------------------------------------------------------------------

export interface CatalogueRow {
  realForm: string;
  cartanLabel: string;
  /** Labels. */
  black: number[];
  /** Images of all nodes in label order. */
  tau: number[];
  /** Pairs of white nodes exchanged by tau, in labels. */
  arrows: [number, number][];
  restrictedTypeDisplay: string | null;
  /** The other rows of the same real form (their canonicalPair agrees): so(2,6) and so*(8) on D4. */
  sameAs: string[];
}

const catalogueCache = new Map<string, CatalogueRow[]>();

/** Every record of the board, in the engine's order (satakeCatalogue); main thread on every board (E-9). */
export function catalogueRows(name: string): CatalogueRow[] {
  const cached = catalogueCache.get(name);
  if (cached !== undefined) return cached;
  const board = boardOf(name);
  const entries = satakeCatalogue(name);
  const keys = entries.map((e) => JSON.stringify(canonicalPair({ board, black: e.black_nodes, tau: e.tau })));
  const rows = entries.map((e, k) => {
    const d: SatakeDiagram = { board, black: e.black_nodes, tau: e.tau };
    return {
      realForm: e.real_form,
      cartanLabel: e.cartan_label,
      black: toLabels(board, e.black_nodes),
      tau: tauToLabels(board, e.tau),
      arrows: arrowsOf(d).map((p) => toLabels(board, p) as [number, number]),
      restrictedTypeDisplay: e.restricted_type_display,
      sameAs: entries.filter((_, j) => j !== k && keys[j] === keys[k]).map((x) => x.real_form),
    };
  });
  catalogueCache.set(name, rows);
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Download data (SPEC 6.6 Data export)
// ---------------------------------------------------------------------------------------------

/** The derived tables of "Download data", in labels: the verdicts, the records of each name, the shadows. */
export function exportData(d: SatakeDiagram, adm: Admissibility, data: Assembled | null, rows: readonly ShadowRow[] | null): Record<string, unknown> {
  const board = d.board as Board<number>;
  const reasons: Record<string, unknown> = {};
  for (const [k, r] of Object.entries(adm.reasons)) {
    const o: Record<string, unknown> = { code: r.code, nodes: toLabels(board, r.nodes) };
    if (r.value !== undefined) o.value = r.value;
    reasons[k] = o;
  }
  return {
    admissibility: {
      symmetry: adm.symmetry,
      condition_1: adm.condition_1,
      condition_2: adm.condition_2,
      condition_3: adm.condition_3,
      admissible: adm.admissible,
      reasons,
    },
    records: data === null ? [] : data.entries.map((e) => recordInLabels(board, e)),
    shadows:
      rows === null
        ? []
        : rows.map((r) => ({
            shadow: r.text.replaceAll(MINUS, '-'),
            shadow2: inLabelOrder(board, r.shadow2),
            roots: r.roots.map((x) => inLabelOrder(board, x.root)),
            theta: r.roots.map((x) => inLabelOrder(board, x.theta)),
          })),
  };
}

// ---------------------------------------------------------------------------------------------
// Captions (SPEC 4.0 "Starts meaningful"): computed from the engine, never typed
// ---------------------------------------------------------------------------------------------

/** "no black node", "black node 2", "black nodes 2, 3, 4 and 5". */
export function blackPhrase(board: Board<number>, black: readonly number[]): string {
  const ls = toLabels(board, [...black].sort((a, b) => a - b));
  return ls.length === 0 ? 'no black node' : `black ${ls.length === 1 ? 'node' : 'nodes'} ${listText(ls)}`;
}

/** "the identity", "exchanging 1 and 3", "exchanging 1 and 6, and 3 and 5". */
export function tauPhrase(board: Board<number>, tau: readonly number[]): string {
  const pairs = exchangedPairs(tau, () => true).map((p) => toLabels(board, p).sort((a, b) => a - b));
  if (pairs.length === 0) return 'the identity';
  const parts = pairs.sort((a, b) => a[0]! - b[0]!).map(([a, b]) => `${a} and ${b}`);
  return `exchanging ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`}`;
}

/** An integer with a true minus sign. */
export function intText(x: number): string {
  return x < 0 ? `${MINUS}${-x}` : String(x);
}

/** The multiplicity of each length class in words: "multiplicity 8 on every restricted root". */
function classPhrase(sat: SatakeComputed): string {
  if (sat.multiplicities.length === 1 && sat.multiplicities[0]!.class === 'all') return `every restricted root has multiplicity ${sat.multiplicities[0]!.mult}`;
  return `the multiplicity is ${listText(sat.multiplicities.map((m) => `${m.mult} on the ${m.class} restricted roots`))}`;
}

export interface CaptionInput {
  d: SatakeDiagram;
  panel: T13Panel;
  toggle: boolean;
  adm: Admissibility;
  data: Assembled | null;
  /** The chosen root (positions), for the theta panel. */
  root: readonly number[];
}

/**
 * The caption of the current state and panel (4.0: "the caption states the result"); every number is read
 * from the engine's results. Plain sentences, no em-dash (8.4).
 */
export function captionText(c: CaptionInput): string {
  const board = c.d.board as Board<number>;
  const name = board.name!;
  const where = `On ${name} with ${blackPhrase(board, c.d.black)} and τ ${tauPhrase(board, c.d.tau)}`;
  if (c.panel === 'catalogue') {
    const rows = catalogueRows(name);
    const same = rows.filter((r) => r.sameAs.length > 0);
    const tail = same.length >= 2 ? `; ${same[0]!.realForm} and ${same[0]!.sameAs[0]} are the same real form` : '';
    return `The catalogue of ${name} has ${rows.length} records${tail}. Loading a record paints its decoration.`;
  }
  if (!c.adm.admissible) {
    const failed = c.adm.symmetry ? [1, 2, 3].filter((n) => !c.adm[`condition_${n as 1 | 2 | 3}`]) : [];
    const what = failed.length === 0 ? 'τ is not a symmetry of the board' : `condition ${listText(failed)} ${failed.length === 1 ? 'fails' : 'fail'}`;
    return `${where}, ${what}, so the decoration is not the Satake diagram of any real form.`;
  }
  if (c.data === null) return `${where}, all three conditions hold; the data are computed in the background.`;
  const data = c.data;
  const names = listText(data.entries.map((e) => e.real_form));
  const e = data.entries[data.drawingEntry]!;
  const sat = data.sat;
  const toggleSentence =
    c.toggle && blackPairsOf(c.d).length > 0
      ? ` The drawing shows ${arrowsOf(c.d).length === 0 ? 'no arrow' : `only the ${arrowsOf(c.d).length === 1 ? 'arrow' : 'arrows'} between ${listText(arrowsOf(c.d).map((p) => listText(toLabels(board, p))))}`}, and the toggle shows that τ also exchanges the black nodes ${listText(blackPairsOf(c.d).map((p) => listText(toLabels(board, p))))}.`
      : '';
  switch (c.panel) {
    case 'theta': {
      const t = thetaStages(c.d, c.root);
      const w = t.word.length === 0 ? 'play w_X, which is empty here' : `play w_X = ${toLabels(board, t.word).join(' ')}`;
      return `θ = ${MINUS}w_X∘τ for ${names} on ${name} takes the root ${vectorText(inLabelOrder(board, [...c.root]))} to ${vectorText(inLabelOrder(board, t.stage3))} in three stages: move each population along τ, ${w}, and change every sign.`;
    }
    case 'shadows': {
      if (sat.real_rank === 0) return `${where}, the decoration is the compact form ${names}: every root is fixed by θ, so no root has a shadow.`;
      return `The shadows of the roots of ${name} for ${names} form a restricted root system of type ${e.restricted_type_display}, and ${classPhrase(sat)}.`;
    }
    case 'restricted': {
      if (data.drawing === null) return `${where}, the decoration is the compact form ${names}, which has no restricted board.`;
      const lens = [...new Set(data.rb.compositeWords.map((x) => x.length))];
      const red = [...new Set(data.drawing.reducedLengths)];
      return `For ${names} on ${name} the restricted board is ${data.drawing.name}: each of its moves is a fixed sequence of ${listText(lens)} moves of ${name}, of reduced length ${listText(red)}, and ${classPhrase(sat)}.`;
    }
    case 'lights': {
      return `${where}, all three conditions hold: the decoration is the Satake diagram of ${names}. The buttons load the examples of A3 and A2 from the table of conditions.${toggleSentence}`;
    }
    default: {
      if (sat.real_rank === 0) return `${where}, the decoration is the Satake diagram of the compact form ${names}: real rank 0, no restricted roots, dim k = ${sat.dim_k}.${toggleSentence}`;
      return `${where}, the decoration is the Satake diagram of ${names}: real rank ${sat.real_rank}, restricted roots of type ${e.restricted_type_display} with multiplicities ${multiplicitiesText(data)}, dim k = ${sat.dim_k}, dim p = ${sat.dim_p}, character ${intText(sat.character)}.${toggleSentence}`;
    }
  }
}
