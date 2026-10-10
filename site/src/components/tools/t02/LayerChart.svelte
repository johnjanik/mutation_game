<script lang="ts">
  // The small chart of new positions per layer (SPEC.md 4 T2 "Boards that are not of finite type";
  // 4.0 Stated limits). Layer 0 is the seeds. A layer the cap cut is drawn hatched and named
  // incomplete, so a truncated result is never presented as complete. Bars take the text colour and
  // the zero outline, neither a sign colour nor a view accent (6.3, 8.3). The chart has a text
  // alternative; its numbers are also in the table view (A-10). It scrolls inside its box (A-11).
  interface Props {
    layers: { layer: number; count: number; complete: boolean }[];
  }
  let { layers }: Props = $props();

  const max = $derived(layers.reduce((m, l) => Math.max(m, l.count), 1));
  const alt = $derived(
    `New positions per layer, from layer 0: ${layers.map((l) => `${l.count}${l.complete ? '' : ' (incomplete)'}`).join(', ')}.`,
  );
</script>

<div class="chart-box">
  <div class="chart" data-out="layerChart" role="img" aria-label={alt}>
    {#each layers as l (l.layer)}
      <div
        class="bar"
        class:incomplete={!l.complete}
        data-layer={l.layer}
        data-count={l.count}
        data-complete={l.complete ? 'true' : 'false'}
        style="height: {Math.max(2, Math.round((l.count / max) * 56))}px;"
        title="Layer {l.layer}: {l.count} new{l.complete ? '' : ', incomplete'}"
      ></div>
    {/each}
  </div>
</div>

<style>
  .chart-box {
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 60px;
    padding: 2px 4px;
    width: max-content;
    border-bottom: 1px solid var(--text);
  }
  .bar {
    width: 8px;
    background: var(--text);
  }
  .bar.incomplete {
    background: repeating-linear-gradient(45deg, var(--text) 0 2px, transparent 2px 5px);
    outline: 1px solid var(--sign-zero-outline);
  }
</style>
