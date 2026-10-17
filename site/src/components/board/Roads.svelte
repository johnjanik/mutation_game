<script lang="ts">
  // The roads between joined nodes (SPEC.md 6.2, 2.1). Internals by P1-A3, props as P0-A5 defined
  // them. What to draw comes from draw/roads.ts: the style in force (always `roads` on a board with
  // a one-way road), the glyphs of each joined pair and their SVG elements, whose colours are the
  // tokens var(--road), var(--arrow) and var(--text). This component renders those elements and
  // adds only the aria-hidden wrapper: the node buttons carry the semantics.
  import { effectiveRoadStyle, roadElements, roadGlyphs } from '../draw/roads';
  import type { RoadsProps } from './types';

  let { board, xy, unit, roadStyle }: RoadsProps = $props();

  const style = $derived(effectiveRoadStyle(board, roadStyle));
  const elements = $derived(roadElements(roadGlyphs(board, style), xy, unit));
</script>

<g class="roads" data-road-style={style} aria-hidden="true">
  {#each elements as el, k (k)}
    {#if el.tag === 'line'}
      <line {...el.attrs} />
    {:else if el.tag === 'path'}
      <path {...el.attrs} />
    {:else if el.tag === 'polygon'}
      <polygon {...el.attrs} />
    {:else}
      <text {...el.attrs}>{el.text}</text>
    {/if}
  {/each}
</g>

<style>
  /* The colours repeat the descriptors' presentation attributes, so they hold even where a
     browser ignores var() in an attribute. */
  .roads :global(.road) {
    stroke: var(--road);
    fill: none;
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
  }
  .roads :global(.road.thick) {
    stroke-width: 6px;
  }
  .roads :global(.chevron) {
    stroke: var(--arrow);
    fill: none;
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .roads :global(.arrowhead) {
    fill: var(--arrow);
  }
  .roads :global(.road-count) {
    fill: var(--text);
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
  }
</style>
