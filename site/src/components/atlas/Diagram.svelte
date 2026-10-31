<script lang="ts">
  // The drawing of a named board (SPEC.md 6.1, 6.2): nodes with their labels beside them (6.1: "Node
  // labels are always visible beside the nodes") and the roads in the `dynkin` style. Owner P6-A4. An
  // image with a text alternative (role img and an accessible name; A-10), with no buttons: the Atlas pages
  // render it on the server with no client directive, and the picker of /tools/atlas renders one per board.
  // Colours are the theme tokens (CONTRACTS 8): roads and arrows in var(--road) and var(--arrow), node
  // outlines and labels in var(--text), so the drawing holds in both themes (A-6).
  import type { BoardDiagram } from './diagram';

  interface Props {
    diagram: BoardDiagram;
    /** The accessible name of the drawing. */
    label: string;
  }

  let { diagram, label }: Props = $props();

  /** Fixed precision, so the server render and the hydrated render print the same text. */
  const f = (v: number): string => String(Math.round(v * 100) / 100 + 0);
</script>

<svg
  class="atlas-diagram"
  viewBox="0 0 {f(diagram.width)} {f(diagram.height)}"
  width={f(diagram.width)}
  height={f(diagram.height)}
  role="img"
  aria-label={label}
  data-diagram={diagram.name}
>
  <g class="roads">
    {#each diagram.roads as el, k (k)}
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
  {#each diagram.nodes as node (node.label)}
    <circle class="node" cx={f(node.x)} cy={f(node.y)} r={f(0.2 * diagram.unit)} />
    <text
      class="node-label"
      x={f(node.x + 0.3 * diagram.unit)}
      y={f(node.y - 0.3 * diagram.unit)}
      font-size={f(Math.max(10, 0.26 * diagram.unit))}
      text-anchor="start"
      dominant-baseline="central">{node.label}</text
    >
  {/each}
</svg>

<style>
  .atlas-diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }
  .atlas-diagram :global(.road) {
    stroke: var(--road);
    fill: none;
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
  }
  .atlas-diagram :global(.chevron) {
    stroke: var(--arrow);
    fill: none;
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .atlas-diagram :global(.arrowhead) {
    fill: var(--arrow);
  }
  .node {
    fill: var(--page);
    stroke: var(--text);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  .node-label {
    fill: var(--text);
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
  }
</style>
