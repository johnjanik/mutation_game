<script lang="ts">
  // The roads between joined nodes (SPEC.md 6.2, 2.1). Phase 0 draws the single line of a (1,1)
  // pair in either style; the double and triple lines, the chevron, the thick line and the
  // `roads` style arrive with P1-A3, which replaces these internals without changing Board's props.
  import { adjacency } from '@engine';
  import type { RoadsProps } from './types';

  let { board, xy, unit, roadStyle = 'dynkin' }: RoadsProps = $props();

  // A pair is joined when a road runs between them in either direction (2.1).
  const segments = $derived.by(() => {
    const A = adjacency(board);
    const inset = 0.38 * unit; // stop at the outer ring of each node
    const out: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < board.n; i++) {
      for (let j = i + 1; j < board.n; j++) {
        if (A[i]![j]! > 0 || A[j]![i]! > 0) {
          const [ax, ay] = xy[i]!;
          const [bx, by] = xy[j]!;
          const len = Math.hypot(bx - ax, by - ay);
          if (len <= 2 * inset) continue;
          const ux = (bx - ax) / len;
          const uy = (by - ay) / len;
          out.push({
            key: `${i}-${j}`,
            x1: ax + ux * inset,
            y1: ay + uy * inset,
            x2: bx - ux * inset,
            y2: by - uy * inset,
          });
        }
      }
    }
    return out;
  });
</script>

<g class="roads" data-road-style={roadStyle}>
  {#each segments as s (s.key)}
    <line class="road" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
  {/each}
</g>

<style>
  .road {
    stroke: var(--road);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
  }
</style>
