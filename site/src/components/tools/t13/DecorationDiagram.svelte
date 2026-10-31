<script lang="ts">
  // The decoration of T13 (SPEC.md 4 T13 Decorate; 6.3 last bullet; 2.15; 7.5 A-1 to A-7). Owner P6-A3.
  // A copy of the diagram drawn on its own, placed directly above the game board with the nodes aligned (the
  // same layout of 6.1 and the same size rule, in the same container), so that black and white never compete
  // with the sign encoding of the game board [D]. Black nodes are filled with the text colour and white nodes
  // are hollow (filled with the page colour), both outlined in the text colour, so that black means filled in
  // the light and the dark theme alike; white nodes exchanged by tau are joined
  // by an arrow; with the toggle "show tau on black nodes" the black nodes tau exchanges are joined by a dashed
  // arrow. Each node is a real <button> (one group, one tab stop, roving tabindex, the arrow keys of A-1),
  // named "Node 2, black"; Enter, Space or a click paints it the other colour.
  // Hooks (SPEC 4.0 Test hooks): data-node (label), data-board="numbers", data-value "1" on a black (filled) node
  // and "0" on a white (hollow) one, data-can-act; the colour in data-colour ("black" or "white"); on the drawing
  // data-arrow="1-5" and data-black-arrow="2-4" (labels). The copy plays no game, and 4.0 names two boards: it
  // takes "numbers", so that the populations a test or a lesson's Challenge reads are those of the game board
  // and of the restricted board only (decisions/RT-FIX-P6-t13.md).
  import { toLabels, toPositions } from '@two-games/engine';
  import type { Board as EngineBoard } from '@two-games/engine';
  import Roads from '../../board/Roads.svelte';
  import { nodePositions } from '../../draw/layouts';
  import { MARGIN, toPixels } from '../../draw/geometry';
  import { arrowTarget, isArrowKey } from '../../board/keyboard';

  interface Props {
    board: EngineBoard<number>;
    /** Black positions. */
    black: readonly number[];
    /** Pairs of white positions exchanged by tau (the arrows). */
    arrows: readonly (readonly [number, number])[];
    /** Pairs of black positions exchanged by tau (drawn dashed when `showBlackPairs`). */
    blackPairs: readonly (readonly [number, number])[];
    showBlackPairs: boolean;
    hydrated: boolean;
    frozen: boolean;
    name: string;
    onPaint: (position: number) => void;
  }

  let { board, black, arrows, blackPairs, showBlackPairs, hydrated, frozen, name, onPaint }: Props = $props();

  const uid = $props.id();
  const REF_UNIT = 64;
  /** Room below the nodes for the arrows, in grid units (the deepest arc, A8's 1 to 8, peaks 0.85 below). */
  const EXTRA = 0.9;

  const layout = $derived(nodePositions(board));
  const px = $derived(toPixels(layout, 2 * MARGIN + layout.columns * REF_UNIT));
  const centres = $derived(px.centres.map(([x, y]) => [(x - MARGIN) / REF_UNIT, (y - MARGIN) / REF_UNIT] as [number, number]));
  const viewW = $derived(layout.columns);
  const viewH = $derived(layout.rows + EXTRA);
  const positions = $derived(Array.from({ length: board.n }, (_, k) => k));
  const isBlack = $derived(positions.map((k) => black.includes(k)));

  const lowest = $derived(toPositions(board, [Math.min(...board.labels)])[0]!);
  let focused = $state<number | null>(null);
  const tabStop = $derived(focused !== null && focused < board.n ? focused : lowest);
  const buttons: (HTMLButtonElement | undefined)[] = [];

  const r2 = (v: number): number => Math.round(v * 1000) / 1000;

  /** A curved double arrow between two nodes, bulging away from the row (downwards; to the right for a vertical pair). */
  function arc(a: number, b: number): string {
    const [ax, ay] = centres[a]!;
    const [bx, by] = centres[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let nx = -dy / len;
    let ny = dx / len;
    if (Math.abs(ny) < 1e-9) {
      if (nx < 0) nx = -nx;
    } else if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const depth = 0.3 + 0.2 * len;
    // start and end just outside the discs, so that the arrowheads stay visible
    const ux = dx / len;
    const uy = dy / len;
    const s = 0.3;
    const sx = ax + ux * s * 0.5 + nx * s * 0.85;
    const sy = ay + uy * s * 0.5 + ny * s * 0.85;
    const ex = bx - ux * s * 0.5 + nx * s * 0.85;
    const ey = by - uy * s * 0.5 + ny * s * 0.85;
    const cx = (ax + bx) / 2 + nx * depth;
    const cy = (ay + by) / 2 + ny * depth;
    return `M ${r2(sx)} ${r2(sy)} Q ${r2(cx)} ${r2(cy)} ${r2(ex)} ${r2(ey)}`;
  }

  const pairKey = (p: readonly [number, number]): string => toLabels(board, [...p]).sort((x, y) => x - y).join('-');

  function onKeydown(event: KeyboardEvent, k: number): void {
    if (!isArrowKey(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const from = toLabels(board, [k])[0]!;
    const to = arrowTarget(layout, board.labels, from, event.key);
    const target = toPositions(board, [to])[0]!;
    focused = target;
    buttons[target]?.focus();
  }

  function paint(k: number): void {
    focused = k;
    if (frozen) return;
    onPaint(k);
  }
</script>

<div class="decoration" style="--k: {layout.columns}; --rows: {layout.rows + EXTRA};">
  <svg class="drawing" viewBox="0 0 {viewW} {viewH}" aria-hidden="true" focusable="false">
    <defs>
      <marker id="{uid}-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" class="head" />
      </marker>
    </defs>
    <Roads {board} xy={centres} unit={1} roadStyle="dynkin" />
    {#each arrows as p (pairKey(p))}
      <path class="arrow" data-arrow={pairKey(p)} d={arc(p[0], p[1])} marker-start="url(#{uid}-head)" marker-end="url(#{uid}-head)" />
    {/each}
    {#if showBlackPairs}
      {#each blackPairs as p (pairKey(p))}
        <path class="arrow black-pair" data-black-arrow={pairKey(p)} d={arc(p[0], p[1])} marker-start="url(#{uid}-head)" marker-end="url(#{uid}-head)" />
      {/each}
    {/if}
    {#each positions as k (k)}
      <circle class="node" class:black={isBlack[k]} data-colour-disc={board.labels[k]} cx={r2(centres[k]![0])} cy={r2(centres[k]![1])} r="0.25" />
      <text class="label" x={r2(centres[k]![0] + 0.33)} y={r2(centres[k]![1] - 0.3)} font-size="0.2" text-anchor="start" dominant-baseline="central">{board.labels[k]}</text>
    {/each}
  </svg>
  <div class="hits" role="group" aria-label={name}>
    {#each positions as k (k)}
      <button
        type="button"
        bind:this={buttons[k]}
        class="hit"
        style="left: {(centres[k]![0] / viewW) * 100}%; top: {(centres[k]![1] / viewH) * 100}%;"
        tabindex={k === tabStop ? 0 : -1}
        disabled={!hydrated}
        aria-disabled={hydrated && frozen ? 'true' : undefined}
        aria-label="Node {board.labels[k]}, {isBlack[k] ? 'black' : 'white'}"
        data-node={board.labels[k]}
        data-board="numbers"
        data-value={isBlack[k] ? '1' : '0'}
        data-colour={isBlack[k] ? 'black' : 'white'}
        data-can-act={frozen ? 'false' : 'true'}
        onclick={() => paint(k)}
        onfocus={() => (focused = k)}
        onkeydown={(event) => onKeydown(event, k)}
      ></button>
    {/each}
  </div>
</div>

<style>
  /* The size rule of SPEC 6.1, as Board.svelte, in the same container, so that every node sits exactly above
     its node on the game board; the box is EXTRA grid units taller for the arrows. */
  .decoration {
    --u: min(64px, (100cqw - 16px) / var(--k));
    position: relative;
    box-sizing: content-box;
    width: calc(var(--k) * var(--u));
    height: calc(var(--rows) * var(--u));
    padding: 8px;
    margin-inline: auto;
  }
  @supports (width: round(down, 10.5px, 1px)) {
    .decoration {
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
  .node {
    fill: var(--page);
    stroke: var(--text);
    stroke-width: 2.5px;
    vector-effect: non-scaling-stroke;
  }
  /* Black means filled and white means hollow, in both themes: a black node is filled with the text colour
     (black on the light page, light on the dark page), a white node with the page colour, so that the two
     differ by the contrast of text on the page in either theme (A-5, A-6; MERGE ruling (1) on P6-A3). */
  .node.black {
    fill: var(--text);
  }
  .label {
    font-family: var(--font-prose);
    fill: var(--text);
  }
  .arrow {
    fill: none;
    stroke: var(--arrow);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  .arrow.black-pair {
    stroke-dasharray: 4 3;
  }
  .head {
    fill: var(--arrow);
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
