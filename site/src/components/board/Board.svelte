<script lang="ts">
  // The board (CONTRACTS.md 5.1; SPEC.md 4.0, 6.1 to 6.3, 7.4, 7.5 A-1 to A-7). A controlled
  // component: it holds no game state. The parent passes `values` and `canAct`, indexed by
  // position, and reacts to `onAct(position)`. Two layers: the drawing (aria-hidden) and, over it,
  // a group of real <button> elements, one per node, with a roving tabindex and the arrow keys of
  // A-1. Buttons are rendered disabled and enabled when the island hydrates (7.4).
  // The `u` and `r` shortcuts are left to the parent: it listens for keydown on an element around
  // the board and asks keyboard.ts `shortcutOf`, which accepts only keys pressed inside this group
  // (marked `data-board-group`), so the contract's prop list stays as it is.
  //
  // P1-A5 (phase 1): the layout comes from P1-A3's nodePositions (every layout of SPEC 6.1) and the
  // pixel rule from toPixels; values may be fractions "p/q" (drawn stacked) or long numbers (drawn
  // shortened, exact in data-value and the tooltip); optional props for T1, all additive (the props of
  // CONTRACTS 5.1 are unchanged): xy, states, spoken, ghosts, disabled, highlighted, onFocusNode.
  // Extra hooks on each button: data-sign (positive, negative, zero) and data-ring (true when the
  // may-act second ring is drawn).
  import { mutate, toLabels, toPositions } from '@two-games/engine';
  import type { Arith, Board as EngineBoard } from '@two-games/engine';
  import Node from './Node.svelte';
  import Roads from './Roads.svelte';
  import { nodePositions } from '../draw/layouts';
  import { MARGIN, toPixels } from '../draw/geometry';
  import { arrowTarget, isArrowKey } from './keyboard';
  import { signOf } from './sign';
  import { nodeName, speak, type NodeState } from '../../lib/a11y';
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
    xy,
    states,
    spoken,
    ghosts,
    disabled = false,
    highlighted = false,
    onFocusNode,
  }: BoardProps = $props();

  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  /** One grid unit in the reference frame of toPixels (the cap of the size rule, 6.1). */
  const REF_UNIT = 64;
  /** The polygon box at its full width, min(W, 360) (6.1). */
  const REF_POLYGON_W = 360;

  const layout = $derived(nodePositions(board, xy));
  // The drawing's coordinates are grid units: toPixels at the width where u = 64, divided by 64. On a
  // row or grid layout the CSS rule below scales the box to the real u; on a circle the box is the
  // polygon box of 6.1 (side min(W, 360)) and the drawing scales with it.
  const px = $derived(toPixels(layout, layout.circle ? REF_POLYGON_W : 2 * MARGIN + layout.columns * REF_UNIT));
  const centres = $derived(
    px.centres.map(([x, y]) =>
      layout.circle ? ([x / REF_UNIT, y / REF_UNIT] as [number, number]) : ([(x - MARGIN) / REF_UNIT, (y - MARGIN) / REF_UNIT] as [number, number]),
    ),
  );
  const viewW = $derived(layout.circle ? px.width / REF_UNIT : layout.columns);
  const viewH = $derived(layout.circle ? px.height / REF_UNIT : layout.rows);
  const positions = $derived(Array.from({ length: board.n }, (_, k) => k));
  const kind = $derived(game === 'mutation' ? 'city' : 'node');

  // The roving tab stop: the lowest label at first, afterwards the last focused node (plan).
  const lowestLabelPosition = $derived(toPositions(board, [Math.min(...board.labels)])[0]!);
  let focused = $state<number | null>(null);
  let pointed = $state<number | null>(null);
  const tabStop = $derived(focused !== null && focused < board.n ? focused : lowestLabelPosition);
  /** The node whose hint ghost is shown: the one hovered, else the one focused. */
  const ghostAt = $derived(pointed ?? focused);

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
      const after = mutate(b, p, k);
      const s = b.arith.sign(b.arith.sub(after[k], p[k]));
      return s > 0 ? 'mutation would raise it' : s < 0 ? 'mutation would lower it' : 'mutation would change nothing';
    } catch {
      return null;
    }
  }

  function stateOf(k: number): NodeState | null {
    if (states !== undefined) return states[k] ?? null;
    if (game === 'firing') return canAct[k] ? 'can be fired' : 'cannot be fired';
    return cityState(k);
  }

  const names = $derived(
    positions.map((k) => {
      const label = toLabels(board, [k])[0]!;
      const state = stateOf(k);
      const said = spoken?.[k] ?? speak(values[k]!);
      if (state === null) return `${kind === 'city' ? 'City' : 'Node'} ${label}, ${kind === 'city' ? 'population' : 'value'} ${said}`;
      return nodeName(kind, label, said, state);
    }),
  );
  const stateTexts = $derived(positions.map((k) => stateOf(k) ?? ''));
  const signs = $derived(
    positions.map((k) => {
      const s = signOf(String(values[k]));
      return s > 0 ? 'positive' : s < 0 ? 'negative' : 'zero';
    }),
  );

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

  function setFocus(k: number | null): void {
    focused = k ?? focused;
    onFocusNode?.(k);
  }
</script>

<div
  class="board"
  class:circle={layout.circle}
  class:highlighted
  data-highlighted={highlighted ? 'true' : undefined}
  style="--k: {layout.columns}; --rows: {layout.rows};"
>
  <svg class="drawing" viewBox="0 0 {viewW} {viewH}" aria-hidden="true" focusable="false">
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
        ghost={ghostAt === k ? (ghosts?.[k] ?? null) : null}
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
        style="left: {(centres[k]![0] / viewW) * 100}%; top: {(centres[k]![1] / viewH) * 100}%;"
        tabindex={k === tabStop ? 0 : -1}
        disabled={!hydrated || disabled}
        aria-label={names[k]}
        title={hintFor?.(k) ?? undefined}
        data-node={board.labels[k]}
        data-board={game === 'mutation' ? 'populations' : 'numbers'}
        data-value={String(values[k])}
        data-can-act={canAct[k] ? 'true' : 'false'}
        data-sign={signs[k]}
        data-ring={canAct[k] ? 'true' : 'false'}
        onclick={() => act(k)}
        onfocus={() => setFocus(k)}
        onblur={() => onFocusNode?.(null)}
        onpointerenter={() => {
          pointed = k;
          onFocusNode?.(k);
        }}
        onpointerleave={() => {
          pointed = null;
          onFocusNode?.(null);
        }}
        onkeydown={(event) => onKeydown(event, k)}
      ></button>
    {/each}
  </div>
</div>

<style>
  /* The size rule of SPEC.md 6.1: u = min(64, floor((W - 16) / k)) CSS pixels, W the width of the
     board's box (the nearest inline-size container, the tool's figure, which runs from edge to edge
     of the viewport below 400 pixels: boardBoxWidth of draw/geometry.ts). Fixed in CSS so that the
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
  /* Polygon and circle layouts: the box of 6.1 is min(W, 360) square; hit areas are 44 (A-7). */
  .board.circle {
    box-sizing: border-box;
    width: min(100cqw, 360px);
    height: min(100cqw, 360px);
    padding: 0;
  }
  .board.highlighted {
    outline: 2px dashed var(--focus-ring);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .drawing,
  .hits {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
  }
  .board.circle .drawing,
  .board.circle .hits {
    inset: 0;
    width: 100%;
    height: 100%;
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
  .board.circle .hit {
    width: 44px;
    height: 44px;
  }
  .hit.can-act:not(:disabled) {
    cursor: pointer;
  }
  .hit:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
