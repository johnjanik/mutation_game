// The wave of T5 (SPEC.md 4 T5 "Wave"; 2.7 F8; 5.3 bipartition, 5.4 wavePlay; Appendix A.2). Pure, no
// DOM. The colour classes come from the engine's bipartition (class 0 holds the first position of each
// component, label 1 on every named type); the wave from all ones is one call of wavePlay, whose word is
// split into rounds here: round k fires class (firstColour + k) mod 2, its nodes in increasing position,
// as the engine fired them. On A1 one class is empty and the engine counts an empty round when it goes
// first; the tool shows the single move and a sentence instead of a number of rounds.
import { bipartition, toLabels, wavePlay } from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';

export type Colour = 0 | 1;

export interface ColourClass {
  colour: Colour;
  /** The nodes of the class as labels, increasing. */
  labels: number[];
  /** The nodes of the class as positions, increasing. */
  positions: number[];
}

/** The two colour classes as labels and positions (plan: shown by shape and label as well as colour). */
export function colourClasses(board: AnyBoard): [ColourClass, ColourClass] {
  const classes = bipartition(board);
  if (classes === null) throw new Error('the board has an odd cycle');
  const make = (colour: Colour, positions: number[]): ColourClass => ({
    colour,
    positions: [...positions],
    labels: toLabels(board, positions).sort((a, b) => a - b),
  });
  return [make(0, classes[0]), make(1, classes[1])];
}

/** The colour of each position (the golden bipartite_colouring, by position). */
export function colourOfPositions(board: AnyBoard): Colour[] {
  const [zero] = colourClasses(board);
  return Array.from({ length: board.n }, (_, k) => (zero.positions.includes(k) ? 0 : 1));
}

export interface WaveRound {
  /** The round's number, from 1. */
  round: number;
  colour: Colour;
  /** The nodes fired in the round, as labels in the order fired. */
  labels: number[];
  /** The same as positions. */
  positions: number[];
}

export interface Wave {
  /** The engine's count of rounds (wavePlay().rounds). */
  rounds: number;
  /** Every firing legal (wavePlay().legal; always true from all ones). */
  legal: boolean;
  /** The whole word, as labels. */
  word: number[];
  /** The rounds, split by colour; on A1 with the empty class first the first round is empty. */
  split: WaveRound[];
  /** The end position by position, as decimal text. */
  end: string[];
  /** One colour class is empty (A1): the wave is a single move and no count of rounds is shown. */
  degenerate: boolean;
}

/** The wave from all ones: one call of wavePlay, split into rounds by colour. */
export function waveOf(board: AnyBoard, firstColour: Colour): Wave {
  const b = board as Board<unknown>;
  const rho = Array.from({ length: b.n }, () => b.arith.one);
  const result = wavePlay(b, rho, firstColour);
  const classes = colourClasses(board);
  const split: WaveRound[] = [];
  let at = 0;
  for (let r = 0; r < result.rounds; r++) {
    const colour = ((firstColour + r) % 2) as Colour;
    const size = classes[colour].positions.length;
    const positions = result.word.slice(at, at + size);
    at += size;
    split.push({ round: r + 1, colour, positions: [...positions], labels: toLabels(board, positions) });
  }
  if (at !== result.word.length) throw new Error('the wave word does not split into rounds of the colour classes');
  return {
    rounds: result.rounds,
    legal: result.legal,
    word: toLabels(board, result.word),
    split,
    end: result.position.map((x) => b.arith.show(x)),
    degenerate: classes[0].positions.length === 0 || classes[1].positions.length === 0,
  };
}

/** Where a move list stands in the wave: whether it follows the wave, the rounds made, the next round's end. */
export interface WaveProgress {
  /** The moves are a prefix of the wave's word (and the start is all ones). */
  follows: boolean;
  /** Complete rounds made (non-empty rounds; on the degenerate A1 the single move). */
  roundsDone: number;
  /** The number of moves at the end of the next round to fire, or null when the wave has ended. */
  nextEnd: number | null;
}

/** The rounds that fire at least one node, in order (A1 drops its empty round). */
function nonEmpty(wave: Wave): WaveRound[] {
  return wave.split.filter((r) => r.labels.length > 0);
}

export function waveProgress(wave: Wave, fromOnes: boolean, applied: readonly number[]): WaveProgress {
  const follows = fromOnes && applied.length <= wave.word.length && applied.every((l, k) => wave.word[k] === l);
  if (!follows) return { follows: false, roundsDone: 0, nextEnd: null };
  let end = 0;
  let done = 0;
  for (const r of nonEmpty(wave)) {
    if (end + r.labels.length <= applied.length) {
      end += r.labels.length;
      done++;
    } else {
      return { follows, roundsDone: done, nextEnd: end + r.labels.length };
    }
  }
  return { follows, roundsDone: done, nextEnd: null };
}

/** The sentence of the A1 case (plan wording, decisions/P3-A3.md). */
export const A1_WAVE_NOTE = 'On A1 one colour class is empty: the wave is a single move.';

/** The sentence when the moves do not follow the wave (plan wording). */
export const WAVE_OFF_NOTE = 'The wave runs from all ones. Start it to fire one colour class per round.';

/** The note of the wave panel, or null. */
export function waveNote(wave: Wave, progress: WaveProgress): string | null {
  if (wave.degenerate) return A1_WAVE_NOTE;
  if (!progress.follows) return WAVE_OFF_NOTE;
  return null;
}
