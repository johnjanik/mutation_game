<script lang="ts">
  // The fate of the numbers game on an affine board (SPEC.md 2.12, 4 T15, Appendix E item 6). The
  // report comes only from `play on` (playFate): "ended after k moves", "returned to an earlier position
  // after k moves", "still running after 20000 moves". The sentence is the row of the fate table of 2.12
  // that the level selects, as the table's statement with its provenance, never as something the play
  // has shown: [GSS12] Theorem 1.2 (signs reversed) on a simple graph; on every other board the row
  // rests on open item E6 and is rendered in the shapes of <Unverified> (fate.ts wrappedRow), the
  // fallback wording by default. Hooks: data-out="fate", "firstVisit", "fateSentence", "provenance".
  import { displayValue } from '../../board/sign';
  import { isLong, shortValue } from '../t01/longNumber';
  import {
    COMPUTED_TEXT,
    ROWS,
    ZERO_POSITION_TEXT,
    firstVisitText,
    reportText,
    sourcesHref,
    wrappedRow,
    type FateStatus,
    type Provenance,
    type RowKey,
    type UnverifiedMode,
  } from './fate';

  interface Props {
    report: { status: FateStatus; moves: number; firstVisit?: number } | null;
    /** The row the level selects, or null at the zero position. */
    row: RowKey | null;
    /** The level, exact decimal text. */
    level: string;
    provenance: Provenance;
    mode: UnverifiedMode;
    baseUrl: string;
  }

  let { report, row, level, provenance, mode, baseUrl }: Props = $props();

  const levelShown = $derived(isLong(level) ? shortValue(level) : displayValue(level));
</script>

<div class="fate">
  <p class="line report" data-out="fate">{report === null ? '' : reportText(report.status, report.moves)}</p>
  {#if report !== null && report.status === 'looped' && report.firstVisit !== undefined}
    <p class="line" data-out="firstVisit">The play came back to a position it had seen: {firstVisitText(report.firstVisit)}.</p>
  {/if}
  <p class="line" data-out="fateSentence">
    {#if row === null}
      {ZERO_POSITION_TEXT}
    {:else if provenance.kind === 'sourced'}
      Level {levelShown}: {ROWS[row]}.
    {:else}
      Level {levelShown}: {@html wrappedRow(row, mode, baseUrl)}{mode === 'fallback' ? '' : '.'}
    {/if}
  </p>
  {#if row !== null}
    <p class="line" data-out="provenance">
      {#if provenance.kind === 'sourced'}
        Source of this row: <a href={sourcesHref(baseUrl, provenance.key)}>{provenance.text}</a>, because that paper fires negative numbers.
      {:else}
        {COMPUTED_TEXT}
      {/if}
    </p>
  {/if}
</div>

<style>
  .fate {
    display: grid;
    gap: 4px;
  }
  .line {
    margin: 0;
  }
  .report {
    min-height: 1.5em;
    font-weight: bold;
  }
  .fate :global(.unverified) {
    text-decoration: underline dotted;
    text-decoration-color: var(--text);
    text-underline-offset: 0.2em;
  }
  .fate :global(.unverified-mark) {
    font-size: 0.85em;
    white-space: nowrap;
  }
  .fate :global(.unverified-mark:focus-visible),
  .fate a:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
