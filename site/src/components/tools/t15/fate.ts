// The fate of the numbers game on an affine board, in words (SPEC.md 2.12, 4 T15, Appendix E item 6).
// Pure functions, no DOM: the three report strings of `play on`, the three rows of the fate table of
// 2.12 (quoted exactly), the row the level selects, the provenance of the row, and the markup of the
// row on a board where it rests on open item E6.
//
// Provenance (plan, decisions/P2-A4.md): 2.12 sources the table "for simply laced affine boards"
// ([GSS12] Theorem 1.2, with the signs reversed). This file reads "simply laced" as "a simple graph in
// the sense of 2.1" (A_ij = A_ji in {0, 1} for every pair), the cautious reading: A1~, whose matrix is
// symmetric with an entry -2, is wrapped as E6 like every B~, C~, F4~, G2~ and twisted board.
//
// `<Unverified>` is an Astro component and cannot run inside a Svelte island, so the island renders the
// equivalent markup from `wrappedRow`, with the class names, title, mark text and anchor of
// site/src/components/content/Unverified.astro (P0-A4). The mode is decided at build time by the page
// (t15/T15Route.astro applies isReleaseBuild and decide of unverifiedRegistry.ts); the default, when
// nobody passes it, is the release shape 'fallback'.
import { CAPS, cartanNumbers } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';

export type FateStatus = 'ended' | 'looped' | 'cap';

function movesPhrase(k: number): string {
  return k === 1 ? '1 move' : `${k} moves`;
}

/**
 * The report of `play on` (SPEC 4 T15), with k the engine's move count: "ended after 14 moves",
 * "returned to an earlier position after 8 moves", "still running after 20000 moves". One move is
 * written in the singular (plan). At the cap the count is the cap of SPEC 5.6, CAPS.playMoves.
 */
export function reportText(status: FateStatus, moves: number): string {
  switch (status) {
    case 'ended':
      return `ended after ${movesPhrase(moves)}`;
    case 'looped':
      return `returned to an earlier position after ${movesPhrase(moves)}`;
    case 'cap':
      return `still running after ${CAPS.playMoves} moves`;
  }
}

/** The optional addition for a loop (plan): the move count at which the repeated position was first seen. */
export function firstVisitText(firstVisit: number): string {
  return firstVisit === 0 ? 'the position repeated is the start' : `the position repeated was first reached after ${movesPhrase(firstVisit)}`;
}

/** The three rows of the fate table of SPEC 2.12, character for character. */
export const ROWS = {
  negative: 'every legal play ends, after the same number of moves, at the same position',
  zero: 'the game never ends and visits only finitely many positions (it loops)',
  positive: 'the game never ends and the numbers grow without bound',
} as const;

export type RowKey = keyof typeof ROWS;

/**
 * The row the level selects (2.12: "play ends exactly when the level is negative or the position is
 * zero"): null for the zero position, where no row applies.
 */
export function rowOf(levelSign: -1 | 0 | 1, zeroPosition: boolean): RowKey | null {
  if (zeroPosition) return null;
  return levelSign < 0 ? 'negative' : levelSign > 0 ? 'positive' : 'zero';
}

/** The sentence shown for the zero position, in place of a row (plan). */
export const ZERO_POSITION_TEXT = 'The position is zero: no number is positive, so play has already ended, and no row of the table applies.';

/** The sign of the level in words (plan). */
export function signWord(sign: -1 | 0 | 1): 'negative' | 'zero' | 'positive' {
  return sign < 0 ? 'negative' : sign > 0 ? 'positive' : 'zero';
}

/**
 * A simple graph in the sense of SPEC 2.1: A_ij = A_ji in {0, 1} for every pair i != j, read from the
 * Cartan matrix (A_ij = -C_ji). True on A2~ to A8~, D~, E~, the square and the pentagon; false on A1~
 * (an entry -2), every B~, C~, F4~, G2~ and every twisted board.
 */
export function isSimpleGraph(board: AnyBoard): boolean {
  const C = cartanNumbers(board);
  for (let i = 0; i < board.n; i++) {
    for (let j = 0; j < board.n; j++) {
      if (i === j) continue;
      if (C[i]![j] !== C[j]![i]) return false;
      if (C[i]![j] !== 0 && C[i]![j] !== -1) return false;
    }
  }
  return true;
}

/** The citation shown on a simple graph (8.4: the convention is stated with the source). */
export const SOURCED_TEXT = '[GSS12] Theorem 1.2, with the signs reversed';

/** The provenance shown on every other board (plan): no source states the table there (2.12). */
export const COMPUTED_TEXT = 'Computed on this site: no source read states this table for this board.';

export type Provenance = { kind: 'sourced'; key: 'GSS12'; text: string } | { kind: 'unverified'; item: 'E6'; fallback: (row: RowKey) => string };

export function provenanceOf(board: AnyBoard): Provenance {
  if (isSimpleGraph(board)) return { kind: 'sourced', key: 'GSS12', text: SOURCED_TEXT };
  return { kind: 'unverified', item: 'E6', fallback: fallbackText };
}

/**
 * The fallback wording of the row on a board where it rests on open item E6 (plan text of the
 * instruction, kept as written): the row quoted exactly, qualified as computed, with the argument
 * beside it. The step that 2.12 marks [U] appears only as the argument's unconfirmed premise.
 */
export function fallbackText(row: RowKey): string {
  return (
    `On this board ${ROWS[row]}; computed, with this argument, not yet from a source. ` +
    'Random play on the 42 affine boards agreed with this for every sampled start. ' +
    'The argument beside it: each legal firing lowers by one the number of positive coroots that pair positively with the position, ' +
    'so play ends exactly when that number is finite. ' +
    'That this number is finite exactly at negative level and at the zero position rests on a description of the Tits cone of an affine matrix that is not yet confirmed from a source.'
  );
}

/**
 * How the island renders a row that rests on E6, decided at build time like <Unverified> (P0-A4):
 * 'marked' in a preview build, 'fallback' in a release build while E6 is open, 'plain' in a release
 * build once the owner has closed E6.
 */
export type UnverifiedMode = 'marked' | 'fallback' | 'plain';

/** The title and mark text of Unverified.astro, exactly. */
export const MARK_TITLE = 'Rests on item E6 of Appendix E; see its status on the open-items page';
export const MARK_TEXT = '[unverified E6]';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The open-items anchor of P0-A4, from the base path. */
export function openItemsHref(baseUrl: string): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}open-items#E6`;
}

/**
 * The markup of a row resting on E6, in the shapes Unverified.astro emits: marked (preview), fallback
 * (release), or the plain row (release, E6 closed). The level prefix stays outside, before it.
 */
export function wrappedRow(row: RowKey, mode: UnverifiedMode, baseUrl: string): string {
  if (mode === 'marked') {
    return `<span class="unverified" data-unverified="E6">${escapeHtml(ROWS[row])} <a class="unverified-mark" href="${escapeHtml(openItemsHref(baseUrl))}" title="${escapeHtml(MARK_TITLE)}">${MARK_TEXT}</a></span>`;
  }
  if (mode === 'plain') return escapeHtml(ROWS[row]);
  return `<span class="unverified-fallback" data-unverified="E6">${escapeHtml(fallbackText(row))}</span>`;
}

/** The sources anchor of P0-A4 for a citation key. */
export function sourcesHref(baseUrl: string, key: string): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}sources#${key}`;
}
