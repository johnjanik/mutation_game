<script lang="ts">
  // The restricted board of T13 (SPEC.md 4 T13 Restricted board; 2.15 "The restricted game"; 6.1, 6.2; 7.5 A-1
  // to A-7). Owner P6-A3. The board named by the record drawn by (after the C2 adjustment of 6.4), drawn by the
  // layout of 6.1 and the roads of 6.2, so its node with label k is Bourbaki node k and stands for the orbit
  // drawn there. Each node shows the chosen root's shadow coordinate at that node (sign encoding of 6.3, by
  // Node.svelte) and, below it, the pair (m_lambda, m_2lambda). Each node is a real <button> in one group with
  // one tab stop (roving tabindex, the arrow keys of A-1); Enter, Space or a click plays its composite move.
  // Hooks: data-node (restricted label), data-board="restricted", data-value (the coordinate), data-can-act.
  import { toLabels, toPositions } from '@two-games/engine';
  import type { Board as EngineBoard } from '@two-games/engine';
  import Roads from '../../board/Roads.svelte';
  import Node from '../../board/Node.svelte';
  import { nodePositions } from '../../draw/layouts';
  import { MARGIN, toPixels } from '../../draw/geometry';
  import { arrowTarget, isArrowKey } from '../../board/keyboard';

  interface Props {
    board: EngineBoard<number>;
    /** The shadow coordinate at each position (decimal text), or null when the coordinates are not available. */
    values: readonly string[] | null;
    /** "(8, 0)" at each position. */
    pairs: readonly string[];
    /** The accessible name of each position. */
    names: readonly string[];
    hydrated: boolean;
    frozen: boolean;
    name: string;
    onAct: (label: number) => void;
  }

  let { board, values, pairs, names, hydrated, frozen, name, onAct }: Props = $props();

  const REF_UNIT = 64;
  /** Room below the nodes for the pairs (m_lambda, m_2lambda), in grid units. */
  const EXTRA = 0.35;

  const layout = $derived(nodePositions(board));
  const px = $derived(toPixels(layout, 2 * MARGIN + layout.columns * REF_UNIT));
  const centres = $derived(px.centres.map(([x, y]) => [(x - MARGIN) / REF_UNIT, (y - MARGIN) / REF_UNIT] as [number, number]));
  const viewW = $derived(layout.columns);
  const viewH = $derived(layout.rows + EXTRA);
  const positions = $derived(Array.from({ length: board.n }, (_, k) => k));

  const lowest = $derived(toPositions(board, [Math.min(...board.labels)])[0]!);
  let focused = $state<number | null>(null);
  const tabStop = $derived(focused !== null && focused < board.n ? focused : lowest);
  const buttons: (HTMLButtonElement | undefined)[] = [];
  const r2 = (v: number): number => Math.round(v * 1000) / 1000;

  function onKeydown(event: KeyboardEvent, k: number): void {
    if (!isArrowKey(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const from = toLabels(board, [k])[0]!;
    const to = arrowTarget(layout, board.labels, from, event.key);
    const target = toPositions(board, [to])[0]!;
    focused = target;
    buttons[target]?.focus();
  }

  function act(k: number): void {
    focused = k;
    if (frozen) return;
    onAct(board.labels[k]!);
  }
</script>

<div class="restricted" style="--k: {layout.columns}; --rows: {layout.rows + EXTRA};">
  <svg class="drawing" viewBox="0 0 {viewW} {viewH}" aria-hidden="true" focusable="false">
    <Roads {board} xy={centres} unit={1} roadStyle="dynkin" />
    {#each positions as k (k)}
      {#if values !== null}
        <Node label={board.labels[k]!} value={values[k]!} kind="city" canAct={!frozen} stateText="" x={centres[k]![0]} y={centres[k]![1]} unit={1} />
      {:else}
        <circle class="plain" cx={r2(centres[k]![0])} cy={r2(centres[k]![1])} r="0.25" />
        <text class="label" x={r2(centres[k]![0] + 0.33)} y={r2(centres[k]![1] - 0.3)} font-size="0.2" text-anchor="start" dominant-baseline="central">{board.labels[k]}</text>
      {/if}
      <text class="pair" x={r2(centres[k]![0])} y={r2(centres[k]![1] + 0.47)} font-size="0.17" text-anchor="middle" dominant-baseline="central">{pairs[k]}</text>
    {/each}
  </svg>
  <div class="hits" role="group" aria-label={name} data-board-group>
    {#each positions as k (k)}
      <button
        type="button"
        bind:this={buttons[k]}
        class="hit"
        style="left: {(centres[k]![0] / viewW) * 100}%; top: {(centres[k]![1] / viewH) * 100}%;"
        tabindex={k === tabStop ? 0 : -1}
        disabled={!hydrated}
        aria-disabled={hydrated && frozen ? 'true' : undefined}
        aria-label={names[k]}
        data-node={board.labels[k]}
        data-board="restricted"
        data-value={values === null ? '' : values[k]}
        data-can-act={frozen ? 'false' : 'true'}
        onclick={() => act(k)}
        onfocus={() => (focused = k)}
        onkeydown={(event) => onKeydown(event, k)}
      ></button>
    {/each}
  </div>
</div>

<style>
  .restricted {
    --u: min(64px, (100cqw - 16px) / var(--k));
    position: relative;
    box-sizing: content-box;
    width: calc(var(--k) * var(--u));
    height: calc(var(--rows) * var(--u));
    padding: 8px;
    margin-inline: auto;
  }
  @supports (width: round(down, 10.5px, 1px)) {
    .restricted {
      --u: min(64px, round(down, (100cqw - 16px) / var(--k), 1px));
    }
  }
  .drawing,
  .hits {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
  }
  .drawing {
    overflow: visible;
  }
  .plain {
    fill: none;
    stroke: var(--sign-zero-outline);
    stroke-width: 2.5px;
    vector-effect: non-scaling-stroke;
  }
  .label,
  .pair {
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
    fill: var(--text);
  }
  .hit {
    position: absolute;
    width: min(44px, var(--u));
    height: min(44px, var(--u));
    transform: translate(-50%, -50%);
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .hit:disabled,
  .hit[aria-disabled='true'] {
    cursor: default;
  }
  .hit:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
