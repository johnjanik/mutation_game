<script lang="ts">
  // The meter of T3 (SPEC.md 4 T3 "Meter: shows the form value (p,p) of the current population during
  // play"). Computes nothing: the parent passes the engine's text from t03/model.ts (formValue through
  // ratToString), or null when the board has no invariant form, or a message when the source cannot be
  // read as a population. Plain text with a true minus sign; a value of more than 12 digits is shortened
  // with the exact digits in the tooltip (4.0 Long numbers). The accent of 8.3 marks the border only.
  import { isLong, shortValue } from '../t01/longNumber';
  import { FORM_TEXT } from './model';

  interface Props {
    value: string | null;
    message: string | null;
    /** The id of the label element, for the group's name. */
    labelId: string;
  }

  let { value, message, labelId }: Props = $props();

  const shown = $derived(message ?? (value === null ? FORM_TEXT.noForm : shortValue(value)));
  const exact = $derived(value !== null && isLong(value) ? value : undefined);
</script>

<div class="meter" role="group" aria-labelledby={labelId}>
  <p class="meter-label" id={labelId}>Form value <span class="pp">(<i>p</i>, <i>p</i>)</span></p>
  <p class="meter-value" class:words={value === null || message !== null} data-out="formValue" data-value={value ?? ''} title={exact}>{shown}</p>
</div>

<style>
  .meter {
    display: grid;
    gap: 2px;
    min-width: 8em;
    padding: 8px 12px;
    border: 2px solid var(--accent-populations);
    border-radius: 6px;
    background: var(--page);
  }
  .meter-label,
  .meter-value {
    margin: 0;
  }
  .meter-value {
    font-size: 1.6em;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .meter-value.words {
    font-size: 1em;
  }
</style>
