<script lang="ts">
  // The heap view (SPEC.md 4 T8 bullet 3): the current word as a stack of bricks, one column per node
  // (labels increasing left to right), each brick at the level the engine's heap gives (1 = the floor),
  // with its node label as text and the node's edge colour as its outline (A-5: the colour is never
  // the only cue); and the number of plays with the same stack (commutationClassSize, bigint).
  // Hooks: data-out="brick" (data-node, data-level, data-move), data-out="heapCount".
  import { edgeColour } from '../../draw/palette';
  import type { HeapData } from './heapView';

  interface Props {
    heap: HeapData;
    name: string;
  }

  let { heap, name }: Props = $props();

  const W = 40;
  const H = 26;
  const GAP = 4;
  const PAD = 6;
  const levels = $derived(Math.max(heap.height, 1));
  const width = $derived(PAD * 2 + heap.columns.length * (W + GAP) - GAP);
  const height = $derived(PAD * 2 + levels * (H + GAP) + 16);
  const floorY = $derived(height - PAD - 16);
  const x = (column: number): number => PAD + column * (W + GAP);
  const y = (level: number): number => floorY - level * (H + GAP) + GAP;
  const label = $derived(
    heap.bricks.length === 0
      ? `Stack of bricks on ${name}: empty.`
      : `Stack of bricks on ${name}: ${heap.bricks.length} bricks; ${heap.columns
          .map((c) => {
            const lv = heap.bricks.filter((b) => b.label === c).map((b) => b.level);
            return lv.length === 0 ? `node ${c} none` : `node ${c} at levels ${lv.join(', ')}`;
          })
          .join('; ')}.`,
  );
</script>

<div class="heap">
  <svg class="bricks" {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label={label}>
    <line x1={PAD} y1={floorY + 1} x2={width - PAD} y2={floorY + 1} style="stroke: var(--text);" stroke-width="2" />
    {#each heap.columns as c, j (c)}
      <text x={x(j) + W / 2} y={height - PAD - 2} text-anchor="middle" font-size="12" style="fill: var(--text);">{c}</text>
    {/each}
    {#each heap.bricks as b (b.move)}
      <g data-out="brick" data-node={b.label} data-level={b.level} data-move={b.move + 1}>
        <rect x={x(b.column)} y={y(b.level)} width={W} height={H} rx="4" style="fill: var(--page); stroke: {edgeColour(b.label)};" stroke-width="3" />
        <text x={x(b.column) + W / 2} y={y(b.level) + H / 2} text-anchor="middle" dominant-baseline="central" font-size="13" style="fill: var(--text);">{b.label}</text>
      </g>
    {/each}
  </svg>
  <p class="line">
    Plays with this stack: <span class="numeral" data-out="heapCount">{heap.count.toString()}</span>
  </p>
</div>

<style>
  .heap {
    display: grid;
    gap: 4px;
    overflow-x: auto;
  }
  .bricks {
    display: block;
  }
  .line {
    margin: 0;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
</style>
