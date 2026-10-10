<script lang="ts">
  // One drawn node (SPEC.md 6.3, 6.1, 4.0 Signs, A-5): the disc, the numeral, the label beside it
  // and the second ring for "may act here". Drawing only; the button over it carries the semantics.
  import { displayValue, signOf } from './sign';
  import type { NodeProps } from './types';

  let { label, value, kind, canAct, stateText, x, y, unit, showLabel = true }: NodeProps = $props();

  const sign = $derived(signOf(value));
  const signClass = $derived(sign > 0 ? 'sign-pos' : sign < 0 ? 'sign-neg' : 'sign-zero');
  const numeral = $derived(displayValue(value));
  const r = $derived(0.3 * unit);
</script>

<g class="node {signClass}" class:can-act={canAct} data-kind={kind} data-state={stateText}>
  {#if canAct}
    <circle class="ring" cx={x} cy={y} r={0.38 * unit} />
  {/if}
  <circle class="disc" data-disc={label} cx={x} cy={y} {r} />
  <text class="numeral" data-numeral={label} {x} {y} font-size={numeral.length > 3 ? 0.18 * unit : 0.26 * unit}
    text-anchor="middle" dominant-baseline="central">{numeral}</text>
  {#if showLabel}
    <text class="label" x={x + 0.42 * unit} y={y - 0.3 * unit} font-size={0.2 * unit}
      text-anchor="start" dominant-baseline="central">{label}</text>
  {/if}
</g>

<style>
  .disc {
    stroke-width: 2.5px;
    vector-effect: non-scaling-stroke;
    transition:
      fill 150ms ease-out,
      stroke 150ms ease-out;
  }
  .sign-pos .disc {
    fill: var(--sign-pos-fill);
    stroke: var(--sign-pos-fill);
  }
  .sign-neg .disc {
    fill: none;
    stroke: var(--sign-neg-outline);
  }
  .sign-zero .disc {
    fill: none;
    stroke: var(--sign-zero-outline);
  }
  .ring {
    fill: none;
    stroke: var(--text);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }
  .numeral {
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
    fill: var(--text);
  }
  .sign-pos .numeral {
    fill: var(--sign-pos-numeral);
  }
  .label {
    font-family: var(--font-prose);
    fill: var(--text);
  }
  @media (prefers-reduced-motion: reduce) {
    .disc {
      transition: none;
    }
  }
</style>
