<script lang="ts">
  // The formula of one Chevalley-Serre relation (SPEC.md 2.18; 7.3: the relations of T12 are written as
  // MathML; 7.5 A-12). Owner P5-A2. LinearForm.svelte (P3-A5) writes linear forms (coeffs, labels, letter)
  // and has no bracket, no ad and no exponent, so this component writes the relations with the same MathML
  // elements (<math>, <mi>, <mn>, <mo>, <msub>) plus <msup> and <mrow> for the exponent of ad, and follows
  // LinearForm's switch RENDER: the HTML-span fallback of 7.3 when it is set to 'spans'. Both paths carry
  // the same aria-label ("E 1 F 1 commutator equals H 1"). It is never inside a .katex element, whose
  // stylesheet hides MathML. Node labels are the subscripts (E-7); C_ij is substituted (plan).
  import { RENDER } from '../../math/LinearForm.svelte';
  import { MINUS, formulaSides, relationSpoken, type FormulaSide, type RelationParts } from './rep';

  interface Props {
    parts: RelationParts;
    /** The markup (default LinearForm's RENDER); the unit test renders both paths. */
    render?: 'mathml' | 'spans';
  }

  let { parts, render = RENDER }: Props = $props();

  const sides = $derived(formulaSides(parts));
  const spoken = $derived(relationSpoken(parts));
  /** The number written before a term (its sign is written apart): none for 1 and -1. */
  const coeffNum = (c: number): string | null => (c === 1 || c === -1 ? null : String(Math.abs(c)));
</script>

{#snippet sub(letter: string, n: number)}<msub><mi>{letter}</mi><mn>{n}</mn></msub>{/snippet}

{#snippet mside(s: FormulaSide)}
  {#if s.kind === 'zero'}<mn>0</mn>{:else if s.kind === 'bracket'}<mo>[</mo>{@render sub(s.x!.letter, s.x!.sub)}<mo separator="true">,</mo>{@render sub(s.y!.letter, s.y!.sub)}<mo>]</mo>{:else if s.kind === 'term'}{#if s.coeff! < 0}<mo>{MINUS}</mo>{/if}{#if coeffNum(s.coeff!) !== null}<mn>{coeffNum(s.coeff!)}</mn>{/if}{@render sub(s.x!.letter, s.x!.sub)}{:else}{#if s.exponent === 1}<mi>ad</mi><mo>(</mo>{@render sub(s.x!.letter, s.x!.sub)}<mo>)</mo>{:else}<msup><mrow><mi>ad</mi><mo>(</mo>{@render sub(s.x!.letter, s.x!.sub)}<mo>)</mo></mrow><mn>{s.exponent}</mn></msup>{/if}{@render sub(s.y!.letter, s.y!.sub)}{/if}
{/snippet}

{#snippet hsub(letter: string, n: number)}<i>{letter}</i><sub>{n}</sub>{/snippet}

{#snippet hside(s: FormulaSide)}
  {#if s.kind === 'zero'}0{:else if s.kind === 'bracket'}[{@render hsub(s.x!.letter, s.x!.sub)}, {@render hsub(s.y!.letter, s.y!.sub)}]{:else if s.kind === 'term'}{#if s.coeff! < 0}{MINUS}{/if}{#if coeffNum(s.coeff!) !== null}{coeffNum(s.coeff!)}{/if}{@render hsub(s.x!.letter, s.x!.sub)}{:else}ad({@render hsub(s.x!.letter, s.x!.sub)}){#if s.exponent !== 1}<sup>{s.exponent}</sup>{/if}&nbsp;{@render hsub(s.y!.letter, s.y!.sub)}{/if}
{/snippet}

{#if render === 'mathml'}
  <math class="relation-formula" aria-label={spoken} data-form-render="mathml" data-relation={parts.relation}
    >{@render mside(sides.left)}<mo>=</mo>{@render mside(sides.right)}</math
  >
{:else}
  <span class="relation-formula spans" role="math" aria-label={spoken} data-form-render="spans" data-relation={parts.relation}
    ><span aria-hidden="true">{@render hside(sides.left)} = {@render hside(sides.right)}</span></span
  >
{/if}

<style>
  .relation-formula {
    font-size: 1.1em;
    white-space: nowrap;
  }
  .spans i {
    font-family: var(--font-prose, serif);
  }
  .spans sub,
  .spans sup {
    font-size: 0.75em;
  }
</style>
