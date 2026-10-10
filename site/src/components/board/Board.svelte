<script lang="ts">
  // The board (CONTRACTS.md 5.1; SPEC.md 4.0, 6.1 to 6.3, 7.4, 7.5 A-1 to A-7). A controlled
  // component: it holds no game state. The parent passes `values` and `canAct`, indexed by
  // position, and reacts to `onAct(position)`. Two layers: the drawing (aria-hidden) and, over it,
  // a group of real <button> elements, one per node, with a roving tabindex and the arrow keys of
  // A-1. Buttons are rendered disabled and enabled when the island hydrates (7.4).
  // The `u` and `r` shortcuts are left to the parent: it listens for keydown on an element around
  // the board and asks keyboard.ts `shortcutOf`, which accepts only keys pressed inside this group
  // (marked `data-board-group`), so the contract's prop list stays as it is.
  import { mutate, toLabels, toPositions } from '@engine';
  import type { Arith, Board as EngineBoard } from '@engine';
  import Node from './Node.svelte';
  import Roads from './Roads.svelte';
  import { drawingCentres, rowLayout } from './layout';
  import { arrowTarget, isArrowKey } from './keyboard';
  import { nodeName, speak, type NodeState } from '@lib/a11y';
  import type { BoardProps } from './types';

  let {
    board,
    values,
    game,
    canAct,
    labels: showLabels = true,
    roadStyle = 'dynkin',
    onAct,
    hintFor,
    name,
  }: BoardProps = $props();

  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  // Phase 0: every board is drawn as a row (6.1); P1-A3's layouts replace this line.
  const layout = $derived(rowLayout(board));
  const centres = $derived(drawingCentres(layout));
  const positions = $derived(Array.from({ length: board.n }, (_, k) => k));
  const kind = $derived(game === 'mutation' ? 'city' : 'node');

  // The roving tab stop: the lowest label at first, afterwards the last focused node (plan).
  const lowestLabelPosition = $derived(toPositions(board, [Math.min(...board.labels)])[0]!);
  let focused = $state<number | null>(null);
  const tabStop = $derived(focused !== null && focused < board.n ? focused : lowestLabelPosition);

  const buttons: (HTMLButtonElement | undefined)[] = [];

  /** The value at a position in the board's own arithmetic (decimal text for Big boards). */
  function inArith(arith: Arith<unknown>, v: number | string): unknown {
    return typeof arith.zero === 'bigint' ? BigInt(String(v)) : arith.fromInt(Number(v));
  }

  /**
   * What a mutation at position k would do to its city (SPEC.md 2.4(a)), found by calling the
   * engine: compare mutate(board, p, k)[k] with p[k]. Null when the values are not integers.
   */
  function cityState(k: number): NodeState | null {
    try {
      const b = board as EngineBoard<unknown>;
      const p = values.map((v) => inArith(b.arith, v));
      const after = mutate(b, p, k)[k];
      const s = b.arith.sign(b.arith.sub(after, p[k]));
      return s > 0 ? 'mutation would raise it' : s < 0 ? 'mutation would lower it' : 'mutation would change nothing';
    } catch {
      return null;
    }
  }

  function stateOf(k: number): NodeState | null {
    if (game === 'firing') return canAct[k] ? 'can be fired' : 'cannot be fired';
    return cityState(k);
  }

  const names = $derived(
    positions.map((k) => {
      const label = toLabels(board, [k])[0]!;
      const state = stateOf(k);
      if (state === null) return `${kind === 'city' ? 'City' : 'Node'} ${label}, ${kind === 'city' ? 'population' : 'value'} ${speak(values[k]!)}`;
      return nodeName(kind, label, values[k]!, state);
    }),
  );
  const stateTexts = $derived(positions.map((k) => stateOf(k) ?? ''));

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
    onAct(k);
  }
</script>

<div class="board" style="--k: {layout.columns}; --rows: {layout.rows};">
  <svg class="drawing" viewBox="0 0 {layout.columns} {layout.rows}" aria-hidden="true" focusable="false">
    <Roads {board} xy={centres} unit={1} {roadStyle} />
    {#each positions as k (k)}
      <Node
        label={board.labels[k]!}
        value={values[k]!}
        {kind}
        canAct={canAct[k] ?? false}
        stateText={stateTexts[k]!}
        x={centres[k]![0]}
        y={centres[k]![1]}
        unit={1}
        showLabel={showLabels}
      />
    {/each}
  </svg>
  <div class="hits" role="group" aria-label={name} data-board-group>
    {#each positions as k (k)}
      <button
        type="button"
        bind:this={buttons[k]}
        class="hit"
        class:can-act={canAct[k] ?? false}
        style="left: {(centres[k]![0] / layout.columns) * 100}%; top: {(centres[k]![1] / layout.rows) * 100}%;"
        tabindex={k === tabStop ? 0 : -1}
        disabled={!hydrated}
        aria-label={names[k]}
        title={hintFor?.(k) ?? undefined}
        data-node={board.labels[k]}
        data-board={game === 'mutation' ? 'populations' : 'numbers'}
        data-value={String(values[k])}
        data-can-act={canAct[k] ? 'true' : 'false'}
        onclick={() => act(k)}
        onfocus={() => (focused = k)}
        onkeydown={(event) => onKeydown(event, k)}
      ></button>
    {/each}
  </div>
</div>

<style>
  /* The size rule of SPEC.md 6.1: u = min(64, floor((W - 16) / k)) CSS pixels, W the width of the
     board's box (the nearest inline-size container, the tool's figure). Fixed in CSS so that the
     server HTML already has the final size (7.6). */
  .board {
    --u: min(64px, (100cqw - 16px) / var(--k));
    position: relative;
    box-sizing: content-box;
    width: calc(var(--k) * var(--u));
    height: calc(var(--rows) * var(--u));
    padding: 8px;
    margin-inline: auto;
  }
  @supports (width: round(down, 10.5px, 1px)) {
    .board {
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
  .hit {
    position: absolute;
    /* The hit area: a square of side min(44, u) centred on the node (6.1, A-7). */
    width: min(44px, var(--u));
    height: min(44px, var(--u));
    transform: translate(-50%, -50%);
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: default;
  }
  .hit.can-act:not(:disabled) {
    cursor: pointer;
  }
  .hit:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
