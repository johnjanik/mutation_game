<script lang="ts">
  // A minimal tool drawn inside ToolFrame, for toolframe.test.ts (server render) and
  // toolframe-hydration.spec.ts (hydration in Chromium). Free play by mutation on a named board,
  // one engine call per move (7.4). Not a tool of the site; it lives under tests/fixtures.
  import ToolFrame from '../../../src/components/board/ToolFrame.svelte';
  import { mutate, toLabels } from '@two-games/engine';
  import type { Board } from '@two-games/engine';
  import { positionsOf, resolveBoard, type ToolState } from '../../../src/lib/state';

  interface Props {
    instanceId?: string;
    initial: ToolState;
    figureLabel?: string;
    withHistoryRow?: boolean;
    notice?: string | null;
  }
  let { instanceId = '', initial, figureLabel, withHistoryRow = true, notice = null }: Props = $props();

  const board = resolveBoard(untrackInitial().board) as Board<unknown>;
  function untrackInitial(): ToolState {
    return initial;
  }
  let toolState = $state<ToolState>(structuredClone(untrackInitial()));
  let positions = $state.raw(positionsOf(untrackInitial()));
  const current = $derived(positions[positions.length - 1]!);

  function act(position: number): void {
    const label = toLabels(board as never, [position])[0]!;
    const before = current.map((x) => board.arith.fromInt(Number(x)));
    const after = mutate(board, before, position).map((x) => Number(x));
    positions = [...positions, after];
    toolState = { ...toolState, moves: [...(toolState.moves ?? []), label] };
  }
  function undo(): void {
    if ((toolState.moves ?? []).length === 0) return;
    positions = positions.slice(0, -1);
    toolState = { ...toolState, moves: (toolState.moves ?? []).slice(0, -1) };
  }
  function reset(): void {
    positions = positions.slice(0, 1);
    toolState = { ...toolState, moves: [] };
  }
</script>

<ToolFrame
  toolId={toolState.tool}
  {instanceId}
  title="Fixture tool"
  caption="A fixture board in its default state."
  state={toolState}
  defaults={initial}
  derivedForExport={() => ({ positions })}
  {figureLabel}
  {notice}
  onUndo={withHistoryRow ? undo : undefined}
  onRedo={withHistoryRow ? () => {} : undefined}
  onReset={withHistoryRow ? reset : undefined}
>
  {#snippet figure(api)}
    <svg viewBox="0 0 100 40" role="img" aria-label="Fixture board" data-figure="">
      {#each current as value, k (k)}
        <circle cx={20 + 60 * k} cy="20" r="10"></circle>
        <text x={20 + 60 * k} y="24" data-numeral={k + 1}>{value}</text>
      {/each}
    </svg>
    <div class="nodes">
      {#each current as value, k (k)}
        <button type="button" data-node={board.labels[k]} data-value={String(value)} data-can-act="true" disabled={!api.hydrated} onclick={() => act(k)}>City {board.labels[k]}</button>
      {/each}
    </div>
  {/snippet}
  {#snippet controls(api)}
    <button type="button" data-control="step" onclick={() => { act(0); api.announce('Stepped.'); }}>Step</button>
  {/snippet}
  {#snippet table()}
    <table>
      <caption>Populations</caption>
      <thead><tr><th scope="col">City</th><th scope="col">Population</th></tr></thead>
      <tbody>
        {#each current as value, k (k)}
          <tr><td><button type="button" data-table-node={board.labels[k]} onclick={() => act(k)}>{board.labels[k]}</button></td><td>{value}</td></tr>
        {/each}
      </tbody>
    </table>
  {/snippet}
</ToolFrame>
