<script lang="ts">
  // The level meter of T15 (SPEC.md 2.12, 4 T15): the level of the current position, which no firing
  // changes, with its sign in words, and, in the Olympiad's form of the pentagon, the Olympiad's sum of
  // the numbers shown, which is minus the level. Values arrive as exact decimal text from the engine
  // (level) or from convention.ts (the sum); a value of more than 12 digits is shown shortened, exact in
  // data-value and the tooltip (4.0 Long numbers). Hooks: data-out="level" (data-value),
  // data-out="levelSign", data-out="sum" (data-value).
  import { displayValue } from '../../board/sign';
  import { isLong, shortValue } from '../t01/longNumber';
  import { signWord } from './fate';

  interface Props {
    /** The level, exact decimal text (ASCII hyphen). */
    level: string;
    /** The Olympiad's sum, exact decimal text, or null when the Olympiad's form is not shown. */
    sum: string | null;
  }

  let { level, sum }: Props = $props();

  const shown = (text: string): string => (isLong(text) ? shortValue(text) : displayValue(text));
  const sign = $derived((level.startsWith('-') ? -1 : /^0+$/.test(level) ? 0 : 1) as -1 | 0 | 1);
</script>

<div class="meter">
  <p class="line">
    Level of the position (the numbers weighted by the comarks, unchanged by every firing):
    <span class="numeral value" data-out="level" data-value={level} title={isLong(level) ? level : undefined}>{shown(level)}</span>,
    <span data-out="levelSign">{signWord(sign)}</span>.
  </p>
  {#if sum !== null}
    <p class="line">
      The Olympiad's sum of the numbers shown:
      <span class="numeral value" data-out="sum" data-value={sum} title={isLong(sum) ? sum : undefined}>{shown(sum)}</span>. It is minus the level, so
      "the sum is positive" in the Olympiad's convention is "the level is negative" here.
    </p>
  {/if}
</div>

<style>
  .meter {
    display: grid;
    gap: 4px;
  }
  .line {
    margin: 0;
  }
  .value {
    font-weight: bold;
  }
  .numeral {
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
  }
</style>
