<script lang="ts">
  // Undo, redo, reset and the strip of past positions (SPEC.md 4.0 History, A-1, A-8, P9, P10).
  // Controlled: the parent holds the move list and the cursor. The buttons follow the board in the
  // tab order, are rendered disabled until hydration (7.4), and afterwards stay enabled at every
  // cursor, doing nothing when there is nothing to undo, redo or reset (plan). Above 50 positions
  // the strip becomes a slider with a counter; Undo and Redo remain its button equivalent (A-8).
  import type { HistoryProps } from './types';

  let { total, cursor, positionNames, hydrated, onUndo, onRedo, onReset, onScrub, frozen = false }: HistoryProps = $props();
  // P1-A5: `frozen` (a prediction step) disables every control; data-control hooks on the buttons.
  const off = $derived(!hydrated || frozen);

  /** "A strip of more than 50 positions is shown as a slider with a counter" (4.0). */
  const STRIP_BUTTONS_MAX = 50;
  const count = $derived(total + 1);
  const asSlider = $derived(count > STRIP_BUTTONS_MAX);
  const indices = $derived(Array.from({ length: count }, (_, k) => k));

  function onRange(event: Event): void {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isInteger(value)) onScrub(value);
  }
</script>

<div class="history">
  <div class="controls">
    <button type="button" class="control" data-control="undo" disabled={off} onclick={onUndo}>Undo</button>
    <button type="button" class="control" data-control="redo" disabled={off} onclick={onRedo}>Redo</button>
    <button type="button" class="control" data-control="reset" disabled={off} onclick={onReset}>Reset</button>
    <span class="moves">Moves: <span class="numeral" data-out="moveCounter">{cursor}</span></span>
  </div>
  <div class="strip" data-out="historyStrip" role="group" aria-label="Past positions">
    {#if asSlider}
      <input
        type="range"
        class="slider"
        min="0"
        max={total}
        step="1"
        value={cursor}
        disabled={off}
        data-control="historySlider"
        aria-label="Position in the history"
        aria-valuetext={positionNames[cursor]}
        oninput={onRange}
      />
      <span class="counter numeral" data-out="historyCounter">{cursor} of {total}</span>
    {:else}
      {#each indices as k (k)}
        <button
          type="button"
          class="step numeral"
          class:current={k === cursor}
          disabled={off}
          data-step={k}
          aria-label={positionNames[k]}
          aria-current={k === cursor ? 'step' : undefined}
          onclick={() => onScrub(k)}>{k}</button
        >
      {/each}
    {/if}
  </div>
</div>

<style>
  .history {
    display: grid;
    gap: 8px;
  }
  .controls {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    height: 44px;
  }
  .control {
    min-width: 44px;
    height: 44px;
    padding: 0 12px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
    cursor: pointer;
  }
  .control:disabled,
  .step:disabled {
    cursor: default;
  }
  .moves {
    margin-inline-start: auto;
    white-space: nowrap;
  }
  .strip {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 56px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 6px;
    box-sizing: border-box;
  }
  .step {
    flex: 0 0 auto;
    min-width: 36px;
    height: 36px;
    padding: 0 4px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
  .step.current {
    border: 2px solid var(--text);
    font-weight: bold;
  }
  .slider {
    flex: 1 1 auto;
    min-width: 0;
    height: 36px;
  }
  .counter {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .control:focus-visible,
  .step:focus-visible,
  .slider:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
