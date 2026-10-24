// T4's verdict model (P2-A3; SPEC 4 T4 Verdict and Also shown, 2.5, 2.8, 2.12, 5.3, 5.6, D19, E-7, E-11).
// buildVerdict(board) calls classify, symmetrizer, spectralRadius and smallestNonfiniteSubboard once
// each for a board object and returns everything the panel shows, in labels. The words come from the
// classify record and nowhere else: no cap and no search ever writes into a verdict (4.0 Stated limits).
// One verdict is kept per board object (a WeakMap, like the engine's cache of E-11), so the panel, the
// counter's hint and the export share one call (5.6: "calling classify once when the board is loaded").
// verdictCore(board) is the verdict bullet alone (classify and symmetrizer), for T16, which shows no more.
import { classify, ratToString, smallestNonfiniteSubboard, spectralRadius, symmetrizer, toLabels } from '@two-games/engine';
import type { AnyBoard, ClassifyRecord, NonfiniteSubboard, Rational } from '@two-games/engine';

/** SPEC 4 T4, exactly: the verdict of a component with a one-way road. */
export const ONE_WAY_SENTENCE = 'has a one-way road: the theory does not apply';

/** The engine functions a verdict needs; injectable so a test can count the calls. */
export interface VerdictEngine {
  classify: (board: AnyBoard) => ClassifyRecord[];
  symmetrizer: (board: AnyBoard) => Rational[] | null;
  spectralRadius: (board: AnyBoard) => number | null;
  smallestNonfiniteSubboard: (board: AnyBoard) => NonfiniteSubboard | null;
}

export const ENGINE: VerdictEngine = { classify, symmetrizer, spectralRadius, smallestNonfiniteSubboard };

/** A board name split for typesetting with <sub> and <sup> (plan; names.json holds finite names only). */
export interface NameParts {
  letter: string;
  sub: string;
  /** "(2)" or "(3)" on a twisted board. */
  sup: string | null;
  /** True on an untwisted affine board ("A4~"), drawn with a tilde over the letter. */
  tilde: boolean;
}

/** The parts of a name such as "E6", "A4~", "D4^(3)"; null for any other spelling. */
export function nameParts(name: string): NameParts | null {
  const m = /^([A-G])([1-9][0-9]*)(~|\^\(([23])\))?$/.exec(name);
  if (m === null) return null;
  return { letter: m[1]!, sub: m[2]!, sup: m[4] ? `(${m[4]})` : null, tilde: m[3] === '~' };
}

/**
 * What the panel prints for a name `classify` returned: one name, or two for the rank-2 board of D19
 * ("B2 = C2" wherever a board is recognised from its shape; computed names say B2, SPEC 2.8).
 */
export function displayNames(name: string): NameParts[] {
  const parts = nameParts(name);
  if (parts === null) return [];
  if (name === 'B2') return [parts, { letter: 'C', sub: '2', sup: null, tilde: false }];
  return [parts];
}

/** The plain text of a displayed name: "B2 = C2", "A2~", "D4^(3)" (data-name; announcements). */
export function displayText(name: string): string {
  return name === 'B2' ? 'B2 = C2' : name;
}

/** A classify record with every node list in labels (E-7): nodes, bourbaki_order. Field order kept. */
export type LabelledRecord = ClassifyRecord;

export interface ComponentView {
  /** The record of classify with nodes and bourbaki_order as labels. */
  record: LabelledRecord;
  /** `finite`, `affine`, `indefinite`, or the one-way sentence: data-out="verdictClass". */
  classText: string;
  /** "balanced" or "not balanced", from the record (2.5). */
  balancedText: 'balanced' | 'not balanced';
  /** d_i of the component's nodes in the order of `record.nodes`, when the whole board is balanced. */
  weights: string[] | null;
  /** Reader's label against Bourbaki label 1..n, for a finite component; null otherwise. */
  matching: { reader: number; bourbaki: number }[] | null;
}

/** The verdict bullet of SPEC 4 T4 (classify and the weights), which T16 also shows. */
export interface VerdictCore {
  n: number;
  kind: 'gcm' | 'one-way';
  components: ComponentView[];
  /** symmetrizer(board) is not null: the whole board is balanced (2.5). */
  balanced: boolean;
  /** The weights d_i by position (least value 1 on each component), or null. */
  weights: string[] | null;
  /** Every component is finite (the finiteKnown of E-9's hint). */
  finiteKnown: boolean;
}

/** The verdict and T4's "Also shown" items. */
export interface Verdict extends VerdictCore {
  /** spectralRadius to four decimals; null (not shown) on a board with a one-way road. */
  spectralRadius: string | null;
  /** A smallest non-finite sub-board in labels; null on finite boards and boards with a one-way road. */
  nonfinite: { nodes: number[]; class: 'affine' | 'indefinite' } | null;
}

function labelled(board: AnyBoard, r: ClassifyRecord): LabelledRecord {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    out[k] = k === 'nodes' || k === 'bourbaki_order' ? toLabels(board, v as number[]) : Array.isArray(v) ? [...(v as number[])] : v;
  }
  return out as unknown as LabelledRecord;
}

function computeCore(board: AnyBoard, engine: VerdictEngine): VerdictCore {
  const records = engine.classify(board);
  const d = engine.symmetrizer(board);
  const weights = d === null ? null : d.map(ratToString);
  const components: ComponentView[] = records.map((r) => {
    const record = labelled(board, r);
    const classText = r.kind === 'one-way' || r.class === null ? ONE_WAY_SENTENCE : r.class;
    const matching =
      r.class === 'finite' && record.bourbaki_order !== undefined
        ? record.bourbaki_order.map((reader, k) => ({ reader, bourbaki: k + 1 }))
        : null;
    return {
      record,
      classText,
      balancedText: r.balanced ? 'balanced' : 'not balanced',
      weights: weights === null ? null : r.nodes.map((p) => weights[p]!),
      matching,
    };
  });
  return {
    n: board.n,
    kind: board.kind,
    components,
    balanced: d !== null,
    weights,
    finiteKnown: records.every((r) => r.class === 'finite'),
  };
}

function computeVerdict(board: AnyBoard, engine: VerdictEngine, core: VerdictCore): Verdict {
  const rho = engine.spectralRadius(board);
  const sub = engine.smallestNonfiniteSubboard(board);
  return {
    n: core.n,
    kind: core.kind,
    components: core.components,
    balanced: core.balanced,
    weights: core.weights,
    spectralRadius: rho === null ? null : rho.toFixed(4),
    nonfinite: sub === null ? null : { nodes: toLabels(board, sub.nodes), class: sub.class },
    finiteKnown: core.finiteKnown,
  };
}

const coreCache = new WeakMap<object, VerdictCore>();
const cache = new WeakMap<object, Verdict>();

/**
 * The verdict bullet of a board without T4's "Also shown" items, computed once per board object (and per
 * engine, for tests): classify and symmetrizer only. T16 shows this and nothing more ("No verdicts
 * beyond those of T4"; its plan leaves out balance, weights, spectral radius and the smallest non-finite
 * sub-board), so it never runs spectralRadius or smallestNonfiniteSubboard, the largest engine call of a
 * load on 12 nodes (SPEC 7.6 Main-thread work; RT-FIX residual P3-RT-07-02). buildVerdict shares it.
 */
export function verdictCore(board: AnyBoard, engine: VerdictEngine = ENGINE): VerdictCore {
  if (engine === ENGINE) {
    const hit = coreCache.get(board);
    if (hit !== undefined) return hit;
    const v = computeCore(board, engine);
    coreCache.set(board, v);
    return v;
  }
  return computeCore(board, engine);
}

/**
 * The verdict of a board, computed once per board object (and per engine, for tests). Keep one board
 * object per edit state and pass that object here and to every engine call (E-11).
 */
export function buildVerdict(board: AnyBoard, engine: VerdictEngine = ENGINE): Verdict {
  if (engine === ENGINE) {
    const hit = cache.get(board);
    if (hit !== undefined) return hit;
    const v = computeVerdict(board, engine, verdictCore(board));
    cache.set(board, v);
    return v;
  }
  return computeVerdict(board, engine, computeCore(board, engine));
}

/** One short phrase per component for the announcement after an edit (plan): "finite A3", "indefinite". */
export function verdictSummary(v: Verdict): string {
  return v.components
    .map((c) => {
      const r = c.record;
      if (r.kind === 'one-way' || r.class === null) return 'has a one-way road';
      if (r.class === 'indefinite') return 'indefinite';
      return `${r.class} ${displayText(r.name ?? '')}`.trim();
    })
    .join('; ');
}
