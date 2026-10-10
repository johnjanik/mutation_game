// The derived tables of T5's "Download data" (SPEC.md 6.6 Data export: "the derived tables shown on
// screen ... all integers as JSON numbers when safe and as decimal strings otherwise"). Pure. Labels
// everywhere (E-7). exportJSON (lib/export.ts) adds the state, the engine version and the commit.
import { integerOut } from '../../../lib/state';
import type { NumbersGame } from './game';
import type { TallyBar, SidewaysReading } from './tally';
import { tallyRecord } from './tally';
import type { Wave, WaveProgress } from './wave';
import type { Comparison } from './compare';
import type { DimensionResult } from './dimension';

const ints = (v: readonly (string | number | bigint)[]): (number | string)[] => v.map((x) => integerOut(x));

export interface PayloadInput {
  game: NumbersGame;
  tally: readonly TallyBar[];
  reading: SidewaysReading | null;
  groupOrder: number;
  wave: Wave | null;
  waveProgress: WaveProgress | null;
  firstColour: 0 | 1;
  gameB: NumbersGame | null;
  comparison: Comparison | null;
  dimension: DimensionResult | null;
  lambda: readonly number[];
}

export function exportPayload(p: PayloadInput): Record<string, unknown> {
  const g = p.game;
  const positions = [];
  for (let k = 0; k <= g.cursor; k++) positions.push({ move: k, numbers: ints(g.valuesInLabelOrder(k)) });
  const out: Record<string, unknown> = {
    labels: [...g.board.labels].sort((a, b) => a - b),
    positions,
    tape: g.tape().map((e) => ({ move: e.move, node: e.label, fired: integerOut(e.value) })),
    tapeValues: ints(g.fired()),
    gameOver: g.gameOver,
    tally: tallyRecord(p.tally),
    groupOrder: p.groupOrder,
  };
  if (p.reading !== null) {
    out.exponents = [...p.reading.exponents];
    out.exponentProduct = p.reading.product;
  }
  if (p.wave !== null) {
    out.wave = {
      firstColour: p.firstColour,
      rounds: p.wave.degenerate ? null : p.wave.rounds,
      legal: p.wave.legal,
      singleMove: p.wave.degenerate,
      roundsMade: p.waveProgress?.roundsDone ?? 0,
      split: p.wave.split.filter((r) => r.labels.length > 0).map((r) => ({ round: r.round, colour: r.colour, nodes: [...r.labels] })),
    };
  }
  if (p.gameB !== null && p.comparison !== null) {
    out.compared = {
      tapeA: ints(g.fired()),
      tapeB: ints(p.gameB.fired()),
      movesA: g.applied,
      movesB: p.gameB.applied,
      sortedA: ints(p.comparison.sortedA),
      sortedB: ints(p.comparison.sortedB),
      endA: ints(g.valuesInLabelOrder()),
      endB: ints(p.gameB.valuesInLabelOrder()),
      agree: p.comparison.agree,
    };
  }
  if (p.dimension !== null) {
    out.dimension = {
      lambda: [...p.lambda],
      word: [...p.dimension.word],
      tapeRho: ints(p.dimension.tapeRho),
      lambdaPlusRho: ints(p.dimension.start),
      tapeLambdaRho: ints(p.dimension.tapeLambdaRho),
      D: integerOut(p.dimension.D),
      M: integerOut(p.dimension.M),
      dimension: integerOut(p.dimension.dimension),
    };
  }
  return out;
}
