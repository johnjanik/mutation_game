<script lang="ts">
  // The graph figure of T8 (SPEC.md 4 T8 Size; 7.1; 7.4; 6.3; 7.5 A-1, A-2, A-5, A-7, A-9, A-10, A-11).
  // At most 192 elements: the scene as inline SVG (svgScene.ts) with a real <button> over every dot, one
  // of them in the tab order (roving tabindex). Above 192 elements: the SVG snapshot of the same scene
  // is what the server renders; after hydration a Canvas 2D drawing of the scene replaces it in place
  // (same box, no shift), and the keyboard works on one focusable button outside the canvas that moves
  // to the focused vertex (A-1: focus is never trapped in a canvas); hover and click on the canvas are a
  // hit test on the nearest dot within its hit area. The box has a fixed height and scrolls (A-11).
  // Nothing moves by itself (A-9); there is no transition.
  import { tick } from 'svelte';
  import type { WeylModel } from './graph';
  import { VERTEX_KEYS, hitTest, nextVertex, type GraphLayout, type Scene, type VertexKey } from './layout';
  import { drawScene, readColours } from './canvasScene';

  interface Props {
    model: WeylModel;
    layout: GraphLayout;
    scene: Scene;
    /** sceneToSvg(scene): the inline graph, or the snapshot above 192 elements. */
    svg: string;
    /** Position text (label order, commas) of each drawn vertex, by item index. */
    positionText: (k: number) => string;
    /** Accessible name of a vertex. */
    vertexName: (k: number) => string;
    onPath: ReadonlySet<number>;
    /** The vertex the game stands on now. */
    current: number | null;
    hydrated: boolean;
    disabled: boolean;
    /** Accessible name of the group of vertices. */
    name: string;
    onJump: (k: number) => void;
    /** Hover or focus entered (k) or left (null) a vertex. */
    onInspect: (k: number | null) => void;
  }

  let { model, layout, scene, svg, positionText, vertexName, onPath, current, hydrated, disabled, name, onJump, onInspect }: Props = $props();

  const canvasMode = $derived(model.edgeMode !== 'all');
  const BOX_MAX = 480;
  const boxHeight = $derived(Math.min(layout.height, BOX_MAX) + 2);

  // ---- SVG mode: one button per vertex -------------------------------------------------------
  let tabStop = $state<number | null>(null);
  const stop = $derived(tabStop !== null && model.drawn.includes(tabStop) ? tabStop : (current ?? model.drawn[0] ?? 0));
  const buttons: Record<number, HTMLButtonElement | undefined> = {};

  function onVertexKey(event: KeyboardEvent, k: number): void {
    if (!VERTEX_KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const to = nextVertex(layout, k, event.key as VertexKey);
    tabStop = to;
    const b = buttons[to];
    b?.focus();
    b?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---- Canvas mode: one cursor button and a canvas -------------------------------------------
  let cursor = $state<number | null>(null);
  const cursorAt = $derived(cursor !== null && model.drawn.includes(cursor) ? cursor : (current ?? model.drawn[0] ?? 0));
  let cursorButton: HTMLButtonElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let drawn = $state(false);
  let scale = $state(1);

  async function onCursorKey(event: KeyboardEvent): Promise<void> {
    if (!VERTEX_KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    cursor = nextVertex(layout, cursorAt, event.key as VertexKey);
    onInspect(cursor);
    await tick();
    cursorButton?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function pointAt(event: PointerEvent | MouseEvent): number | null {
    return hitTest(layout, event.offsetX, event.offsetY);
  }

  let hovered: number | null = null;
  function onCanvasMove(event: PointerEvent): void {
    const k = pointAt(event);
    if (k === hovered) return;
    hovered = k;
    onInspect(k ?? (document.activeElement === cursorButton ? cursorAt : null));
  }

  function onCanvasLeave(): void {
    hovered = null;
    onInspect(document.activeElement === cursorButton ? cursorAt : null);
  }

  function onCanvasClick(event: MouseEvent): void {
    if (disabled) return;
    const k = pointAt(event);
    if (k === null) return;
    cursor = k;
    onJump(k);
  }

  // A new board draws again from the snapshot (declared before the drawing, so it runs first).
  $effect(() => {
    void model;
    drawn = false;
    cursor = null;
    tabStop = null;
  });

  // Draw once per scene, in one pass, after hydration (7.6: no long task; nothing at server render).
  $effect(() => {
    const s = scene;
    const c = canvas;
    if (!canvasMode || c === undefined) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, 8192 / Math.max(s.width, s.height));
    scale = dpr;
    c.width = Math.round(s.width * dpr);
    c.height = Math.round(s.height * dpr);
    const ctx = c.getContext('2d');
    if (ctx === null) return;
    drawScene(ctx, s, readColours(c), dpr);
    drawn = true;
  });
</script>

<div class="weyl-box" style="height: {boxHeight}px;" data-graph-box="">
  <div class="stage" style="width: {layout.width}px; height: {layout.height}px;">
    {#if !canvasMode}
      <div class="svg-host">{@html svg}</div>
      <div class="vertices" role="group" aria-label={name}>
        {#each model.drawn as k (k)}
          <button
            type="button"
            bind:this={buttons[k]}
            class="vertex"
            class:current={k === current}
            style="left: {layout.cx[k]! - layout.hit / 2}px; top: {layout.cy[k]! - layout.hit / 2}px; width: {layout.hit}px; height: {layout.hit}px;"
            tabindex={k === stop ? 0 : -1}
            disabled={!hydrated || disabled}
            aria-label={vertexName(k)}
            data-out="vertex"
            data-position={positionText(k)}
            data-layer={model.graph.depth[k]}
            data-on-path={onPath.has(k) ? 'true' : 'false'}
            onclick={() => {
              tabStop = k;
              onJump(k);
            }}
            onfocus={() => {
              tabStop = k;
              onInspect(k);
            }}
            onblur={() => onInspect(null)}
            onpointerenter={() => onInspect(k)}
            onpointerleave={() => onInspect(null)}
            onkeydown={(event) => onVertexKey(event, k)}
          ></button>
        {/each}
      </div>
    {:else}
      <div class="svg-host snapshot" class:under={drawn}>{@html svg}</div>
      {#if hydrated}
        <!-- The pointer is a hit test on the drawing; the keyboard has the focus button below (A-1). -->
        <div
          class="canvas"
          role="img"
          aria-label={scene.label}
          data-out="canvas"
          data-scale={scale}
          data-hit={layout.hit}
          data-col={layout.colW}
          data-row={layout.rowH}
        >
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <canvas
            bind:this={canvas}
            style="width: {scene.width}px; height: {scene.height}px;"
            aria-hidden="true"
            onpointermove={onCanvasMove}
            onpointerleave={onCanvasLeave}
            onclick={onCanvasClick}
          ></canvas>
        </div>
      {/if}
      <div class="vertices" role="group" aria-label={name}>
        <button
          type="button"
          bind:this={cursorButton}
          class="vertex cursor"
          style="left: {layout.cx[cursorAt]! - layout.hit / 2}px; top: {layout.cy[cursorAt]! - layout.hit / 2}px; width: {layout.hit}px; height: {layout.hit}px;"
          disabled={!hydrated || disabled}
          aria-label={vertexName(cursorAt)}
          data-control="graphFocus"
          data-position={positionText(cursorAt)}
          data-layer={model.graph.depth[cursorAt]}
          data-on-path={onPath.has(cursorAt) ? 'true' : 'false'}
          onclick={() => onJump(cursorAt)}
          onfocus={() => onInspect(cursorAt)}
          onblur={() => onInspect(null)}
          onkeydown={onCursorKey}
        ></button>
      </div>
    {/if}
  </div>
</div>

<style>
  .weyl-box {
    position: relative;
    box-sizing: border-box;
    max-width: 100%;
    overflow: auto;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    background: var(--page);
  }
  .stage {
    position: relative;
  }
  .svg-host,
  .canvas,
  .vertices {
    position: absolute;
    inset: 0;
  }
  .svg-host :global(svg) {
    display: block;
  }
  .snapshot.under {
    visibility: hidden;
  }
  .canvas canvas {
    display: block;
  }
  .vertices {
    pointer-events: none;
  }
  .vertex {
    position: absolute;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    pointer-events: auto;
  }
  .vertex:disabled {
    cursor: default;
  }
  .vertex.cursor {
    pointer-events: none;
  }
  .vertex:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 1px;
    z-index: 1;
  }
</style>
