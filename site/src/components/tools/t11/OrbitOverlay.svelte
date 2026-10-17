<script lang="ts">
  // The orbit colouring of T11 (SPEC.md 4 T11 "orbits are coloured"; 6.3; 8.3; A-5). Owner P4-A4.
  // Decoration only, never the fill of a node (6.3 keeps fill and outline for the sign) and never an
  // accent of 8.3: an outer ring around each node in the colour of its orbit (--edge-k, colour k for the
  // orbit at folded label k), and, on the big board, a badge holding the folded label of the node's orbit
  // as text, so that the colour is never the only cue (A-5). Drawn in the same box and grid units as
  // Board.svelte (the size rule of 6.1, as T9's overlay), placed BEFORE the board in the page so that the
  // board's buttons and their focus ring are painted over it (A-2). aria-hidden: the legend and the node
  // names carry the same information as text.
  import type { AnyBoard } from '@two-games/engine';
  import { nodePositions } from '../../draw/layouts';
  import { MARGIN, toPixels } from '../../draw/geometry';

  interface Props {
    board: AnyBoard;
    /** The colour 1 to 8 of each position's orbit. */
    colours: readonly number[];
    /** The text of each position's badge (the folded label of its orbit), or null for no badges. */
    badges?: readonly (number | null)[] | null;
  }

  let { board, colours, badges = null }: Props = $props();

  /** One grid unit in the reference frame of toPixels, as Board.svelte. */
  const REF_UNIT = 64;
  const layout = $derived(nodePositions(board));
  const px = $derived(toPixels(layout, 2 * MARGIN + layout.columns * REF_UNIT));
  const centres = $derived(px.centres.map(([x, y]) => [(x - MARGIN) / REF_UNIT, (y - MARGIN) / REF_UNIT] as const));
  const r2 = (v: number): number => Math.round(v * 1000) / 1000;
</script>

<div class="overlay" style="--k: {layout.columns}; --rows: {layout.rows};" aria-hidden="true">
  <svg viewBox="0 0 {layout.columns} {layout.rows}" focusable="false">
    {#each centres as [x, y], k (k)}
      <g data-ring-node={board.labels[k]} data-orbit-ring={colours[k]}>
        <circle class="orbit-ring" cx={r2(x)} cy={r2(y)} r="0.41" style="stroke: var(--edge-{colours[k]})" />
        {#if badges !== null && badges[k] !== null && badges[k] !== undefined}
          <rect class="badge" x={r2(x + 0.23)} y={r2(y + 0.2)} width="0.24" height="0.24" rx="0.05" style="stroke: var(--edge-{colours[k]})" />
          <text class="badge-text" x={r2(x + 0.35)} y={r2(y + 0.325)} font-size="0.17" text-anchor="middle" dominant-baseline="central">{badges[k]}</text>
        {/if}
      </g>
    {/each}
  </svg>
</div>

<style>
  /* The same box as Board.svelte's .board (SPEC 6.1 size rule), so the rings sit on the nodes. */
  .overlay {
    --u: min(64px, (100cqw - 16px) / var(--k));
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    box-sizing: content-box;
    width: calc(var(--k) * var(--u));
    height: calc(var(--rows) * var(--u));
    padding: 8px;
    margin-inline: auto;
    pointer-events: none;
  }
  @supports (width: round(down, 10.5px, 1px)) {
    .overlay {
      --u: min(64px, round(down, (100cqw - 16px) / var(--k), 1px));
    }
  }
  .overlay svg {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    overflow: visible;
  }
  .orbit-ring {
    fill: none;
    stroke-width: 3px;
    vector-effect: non-scaling-stroke;
  }
  .badge {
    fill: var(--page);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  .badge-text {
    fill: var(--text);
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
    font-weight: bold;
  }
</style>
