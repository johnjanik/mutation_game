// The sentences of T5 that have no template in SPEC.md 7.5 A-4 (plan wordings, decisions/P3-A3.md).
// Pure. Moves, undo, refusals, game over and a play to the end use the A-4 templates through T1's
// t01/announce.ts and lib/a11y.ts unchanged; this file adds the wave round, the readouts and the start.
import { speak } from '../../../lib/a11y';

/** "1 and 3", "1, 3 and 5", "2". */
export function andList(items: readonly (number | string)[]): string {
  const t = items.map(String);
  if (t.length <= 1) return t.join('');
  return `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`;
}

/** One round of the wave: "Fired nodes 1 and 3. Round 1. Numbers now minus 1, 3, minus 1." */
export function roundSentence(labels: readonly number[], round: number, numbers: readonly string[]): string {
  const nodes = labels.length === 1 ? `node ${labels[0]}` : `nodes ${andList(labels)}`;
  return `Fired ${nodes}. Round ${round}. Numbers now ${numbers.map(speak).join(', ')}.`;
}

/** The whole wave played to the end: one announcement (4.0). */
export function waveEndSentence(rounds: number, moves: number, numbers: readonly string[]): string {
  return `Played the wave to the end: ${rounds} ${rounds === 1 ? 'round' : 'rounds'}, ${moves} ${moves === 1 ? 'move' : 'moves'}. Numbers now ${numbers.map(speak).join(', ')}.`;
}

/** The A1 wave (one move): "Fired node 1. The wave is a single move. Numbers now minus 1." */
export function singleMoveWaveSentence(label: number, numbers: readonly string[]): string {
  return `Fired node ${label}. The wave is a single move. Numbers now ${numbers.map(speak).join(', ')}.`;
}

/** The reading sideways: "Exponents 1, 2, 3; product 24; order of the group 24." */
export function exponentsSentence(exponents: readonly number[], product: number, order: number): string {
  return `Exponents ${exponents.join(', ')}; product ${product}; order of the group ${order}.`;
}

/** "Dimension 8." */
export function dimensionSentence(dimension: bigint | string): string {
  return `Dimension ${String(dimension)}.`;
}

/** The comparison once both games have ended. */
export function compareSentence(agree: boolean): string {
  return agree ? 'Both games have ended. The sorted tapes agree.' : 'Both games have ended. The sorted tapes differ.';
}

/** A new start: "Start all ones: 1, 1, 1." and so on. */
export function startSentence(kind: 'ones' | 'fundamental' | 'custom', start: readonly (number | string)[], node?: number): string {
  const values = start.map((x) => speak(String(x))).join(', ');
  if (kind === 'ones') return `Start all ones: ${values}.`;
  if (kind === 'fundamental') return `Start the fundamental weight of node ${node ?? ''}: ${values}.`;
  return `Custom start: ${values}.`;
}

/** Game B's move (plan): "Game B: fired node 3. Numbers now 1, 2, minus 1. Move 1." */
export function gameBSentence(label: number, numbers: readonly string[], move: number): string {
  return `Game B: fired node ${label}. Numbers now ${numbers.map(speak).join(', ')}. Move ${move}.`;
}
