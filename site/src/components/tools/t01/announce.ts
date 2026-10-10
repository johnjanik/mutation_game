// The sentences of T1 for the polite live region (SPEC.md 7.5 A-4; CONTRACTS.md 5.3). Pure: it picks
// the A-4 template of lib/a11y.ts for a move, an undo, a play to the end or a refused action, and
// speaks every value ("minus 2"; a fraction "2 over 3", plan). Values arrive as the hooks carry
// them (decimal text or p/q), indexed by position; labels come with them.
import { announceTemplates, moveAnnouncement, speak, CHANGED_ONLY_ABOVE } from '@lib/a11y';
import type { Mode, Shown, View } from './model';

/** A value read aloud: "minus 2"; a fraction "2 over 3", "minus 1 over 3" (plan). */
export function spokenValue(text: string): string {
  const t = text.trim();
  if (!t.includes('/')) return speak(t);
  const [num, den] = t.split('/') as [string, string];
  return `${speak(num)} over ${den}`;
}

function spokenList(values: readonly string[]): string[] {
  return values.map(spokenValue);
}

/** Values in label order for a sentence (labels increasing, as the start and the table). */
function byLabel(labels: readonly number[], values: readonly string[]): { label: number; value: string }[] {
  return labels.map((label, k) => ({ label, value: values[k]! })).sort((x, y) => x.label - y.label);
}

function inOrder(labels: readonly number[], values: readonly string[]): string[] {
  return byLabel(labels, values).map((e) => e.value);
}

/** The sentence of one move (A-4), for the view in force. `move` is its number in the list. */
export function moveSentence(view: View, labels: readonly number[], label: number, before: Shown, after: Shown, move: number): string {
  const sortedLabels = [...labels].sort((a, b) => a - b);
  if (view === 'numbers') {
    return moveAnnouncement('Fired', sortedLabels, label, spokenList(inOrder(labels, before.numbers)), spokenList(inOrder(labels, after.numbers)), move);
  }
  const popsBefore = before.populations ?? [];
  const popsAfter = after.populations ?? [];
  if (view === 'populations') {
    return moveAnnouncement('Mutated', sortedLabels, label, spokenList(inOrder(labels, popsBefore)), spokenList(inOrder(labels, popsAfter)), move);
  }
  if (labels.length <= CHANGED_ONLY_ABOVE) {
    return announceTemplates.linked(label, spokenList(inOrder(labels, popsAfter)), spokenList(inOrder(labels, after.numbers)), move);
  }
  // Linked view above four nodes (plan): the changed entries of both boards in one sentence.
  const changed = (b: readonly string[], a: readonly string[], noun: string): string[] =>
    byLabel(labels, a)
      .filter((e, k) => byLabel(labels, b)[k]!.value !== e.value)
      .map((e) => `${noun} ${e.label} now ${spokenValue(e.value)}`);
  const cities = changed(popsBefore, popsAfter, 'city');
  const nodes = changed(before.numbers, after.numbers, 'node');
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  const parts: string[] = [];
  if (cities.length > 0) parts.push(cities.join(', '));
  if (nodes.length > 0) parts.push(nodes.join(', '));
  const body = parts.length > 0 ? `${cap(parts.join('; '))}. ` : '';
  return `Mutated city ${label} and fired node ${label}. ${body}Move ${move}.`;
}

/** "Undid move 4. Numbers now ..." (A-4); the linked view names both records (plan). */
export function undoSentence(view: View, labels: readonly number[], undone: number, now: Shown): string {
  if (view === 'numbers') return announceTemplates.undid(undone, spokenList(inOrder(labels, now.numbers)), 'numbers');
  const pops = spokenList(inOrder(labels, now.populations ?? []));
  if (view === 'populations') return announceTemplates.undid(undone, pops, 'populations');
  return `Undid move ${undone}. Populations now ${pops.join(', ')}; numbers now ${spokenList(inOrder(labels, now.numbers)).join(', ')}.`;
}

/** "Game over after 6 moves." (A-4). */
export function gameOverSentence(moves: number): string {
  return announceTemplates.gameOver(moves);
}

/**
 * One announcement for a whole play to the end (4.0, A-4): "Played 14 moves to the end. Numbers now
 * ...". A raising play names the populations (plan); a play stopped by its cap says it is still running.
 */
export function playSentence(view: View, mode: Mode, labels: readonly number[], moves: number, status: 'ended' | 'looped' | 'cap', now: Shown): string {
  const usePops = mode === 'raising' && now.populations !== null && view !== 'numbers';
  const values = spokenList(inOrder(labels, usePops ? now.populations! : now.numbers));
  if (status === 'cap') {
    return `Still running after ${moves} moves. ${usePops ? 'Populations' : 'Numbers'} now ${values.join(', ')}.`;
  }
  return announceTemplates.playedToEnd(moves, values, usePops ? 'populations' : 'numbers');
}

/**
 * A refused action (A-4): in legal play "Node 3 cannot be fired: its number is minus 2."; in raising
 * mode SPEC has no template (plan): "City 2 cannot be raised: its number is 1."
 */
export function refusalSentence(mode: Mode, label: number, number: string): string {
  if (mode === 'raising') return `City ${label} cannot be raised: its number is ${spokenValue(number)}.`;
  return announceTemplates.cannotFire(label, spokenValue(number));
}
