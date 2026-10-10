<script lang="ts">
  // One drawn node (SPEC.md 6.3, 6.1, 4.0 Signs, A-5): the disc, the numeral, the label beside it
  // and the second ring for "may act here". Drawing only; the button over it carries the semantics.
  // P1-A5: a fraction "p/q" is set as a stacked fraction (6.3); a value of more than 12 digits is drawn
  // shortened (4.0 Long numbers; exact in data-value and the tooltip); an optional hint ghost is drawn
  // below the node (SPEC 4 T1 Hints).
  import { displayValue, signOf, TRUE_MINUS } from './sign';
  import { isLong, shortValue } from '../tools/t01/longNumber';
  import type { NodeProps } from './types';

  let { label, value, kind, canAct, stateText, x, y, unit, showLabel = true, ghost = null }: NodeProps = $props();

  const text = $derived(String(value));
  const sign = $derived(signOf(text));
  const signClass = $derived(sign > 0 ? 'sign-pos' : sign < 0 ? 'sign-neg' : 'sign-zero');
  const fraction = $derived.by(() => {
    if (!text.includes('/')) return null;
    const negative = text.startsWith('-') || text.startsWith(TRUE_MINUS);
    const [num, den] = text.replace(/^[-−]/, '').split('/') as [string, string];
    const long = isLong(num) || isLong(den);
    return { sign: negative ? TRUE_MINUS : '', num: long ? shortValue(num) : num, den: long ? shortValue(den) : den };
  });
  const numeral = $derived(fraction !== null ? '' : isLong(text) ? shortValue(text) : displayValue(text));
  const r = $derived(0.25 * unit);
  const size = $derived(numeral.length > 12 ? 0.07 * unit : numeral.length > 3 ? 0.15 * unit : 0.22 * unit);
  const ghostText = $derived(ghost === null ? null : ghost.includes('/') ? ghost.replace(/^-/, TRUE_MINUS) : isLong(ghost) ? shortValue(ghost) : displayValue(ghost));
</script>

<g class="node {signClass}" class:can-act={canAct} data-kind={kind} data-state={stateText}>
  {#if canAct}
    <circle class="ring" cx={x} cy={y} r={0.32 * unit} />
  {/if}
  <circle class="disc" data-disc={label} cx={x} cy={y} {r} />
  {#if fraction !== null}
    <g class="numeral fraction" data-numeral={label}>
      {#if fraction.sign}
        <text x={x - 0.15 * unit} {y} font-size={0.14 * unit} text-anchor="middle" dominant-baseline="central">{fraction.sign}</text>
      {/if}
      <text x={x + (fraction.sign ? 0.03 : 0) * unit} y={y - 0.085 * unit} font-size={0.14 * unit} text-anchor="middle" dominant-baseline="central">{fraction.num}</text>
      <line class="bar" x1={x - 0.09 * unit + (fraction.sign ? 0.03 : 0) * unit} x2={x + 0.09 * unit + (fraction.sign ? 0.03 : 0) * unit} y1={y} y2={y} />
      <text x={x + (fraction.sign ? 0.03 : 0) * unit} y={y + 0.095 * unit} font-size={0.14 * unit} text-anchor="middle" dominant-baseline="central">{fraction.den}</text>
    </g>
  {:else}
    <text class="numeral" data-numeral={label} {x} {y} font-size={size} text-anchor="middle" dominant-baseline="central">{numeral}</text>
  {/if}
  {#if showLabel}
    <text class="label" data-label={label} x={x + 0.33 * unit} y={y - 0.3 * unit} font-size={0.2 * unit}
      text-anchor="start" dominant-baseline="central">{label}</text>
  {/if}
  {#if ghostText !== null}
    <text class="ghost" data-ghost={label} {x} y={y + 0.42 * unit} font-size={0.16 * unit} text-anchor="middle" dominant-baseline="central"
      >{ghostText}</text
    >
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
  .numeral text {
    fill: inherit;
  }
  .bar {
    stroke: var(--text);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  .sign-pos .numeral {
    fill: var(--sign-pos-numeral);
  }
  .sign-pos .bar {
    stroke: var(--sign-pos-numeral);
  }
  .label {
    font-family: var(--font-prose);
    fill: var(--text);
  }
  .ghost {
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
    fill: var(--text);
    font-style: italic;
  }
  @media (prefers-reduced-motion: reduce) {
    .disc {
      transition: none;
    }
  }
</style>
