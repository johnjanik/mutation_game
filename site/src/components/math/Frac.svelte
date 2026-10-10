<script lang="ts">
  // A stacked fraction in plain markup (SPEC.md 6.3 "Fractions ... are set as stacked fractions",
  // 7.3: Frac.svelte for T1 and T6; no KaTeX at runtime, 7.6). `value` is the engine's text: "p/q"
  // or an integer "p" (shown as it is). The sign is set before the fraction with a true minus sign;
  // the accessible text reads "2 over 3" (plan).
  interface Props {
    value: string;
  }

  let { value }: Props = $props();

  const parts = $derived.by(() => {
    const t = value.trim();
    const negative = t.startsWith('-') || t.startsWith('−');
    const body = t.replace(/^[-−]/, '');
    const [num, den] = body.split('/') as [string, string | undefined];
    return { negative, num, den };
  });
  const spoken = $derived(`${parts.negative ? 'minus ' : ''}${parts.num}${parts.den ? ` over ${parts.den}` : ''}`);
</script>

{#if parts.den}<span class="frac" role="img" aria-label={spoken} data-frac={value}>{#if parts.negative}<span class="sign" aria-hidden="true">−</span>{/if}<span class="stack" aria-hidden="true"><span class="num">{parts.num}</span><span class="den">{parts.den}</span></span></span>{:else}<span class="int" data-frac={value}>{parts.negative ? '−' : ''}{parts.num}</span>{/if}

<style>
  .frac {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }
  .stack {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.05;
    font-size: 0.85em;
  }
  .num {
    border-bottom: 1px solid currentColor;
    padding: 0 0.15em;
  }
  .den {
    padding: 0 0.15em;
  }
  .int {
    font-variant-numeric: tabular-nums;
  }
</style>
