<script lang="ts" module>
  /** One vertex as drawn. */
  export interface GraphVertex {
    /** The hook text: entries in label order joined by commas (data-position). */
    position: string;
    /** The layer shown in data-layer: the depth, or the total in the positive view. */
    layer: number;
    /** The label drawn on the vertex (entries, long ones shortened), shown only when labelled. */
    text: string;
    /** The exact entries, for the tooltip (4.0 Long numbers). */
    exact: string;
    /** The accessible name (A-3 style, built with speak). */
    name: string;
  }

  /** One edge as drawn, with its end points in pixels. */
  export interface GraphEdge {
    from: number;
    to: number;
    label: number;
    /** The rise in the positive view (decimal text), or null. */
    rise: string | null;
    /** Lines drawn: 1, 2 or 3 for a rise on a finite-type board; 1 otherwise. */
    lines: number;
    /** Whether the rise is written as a numeral on the edge (off the finite types). */
    numeral: boolean;
    /** Sideways offset of the whole edge, for a second edge between the same two positions. */
    offset: number;
  }
</script>

<script lang="ts">
  // The drawing of the garden (SPEC.md 4 T2 "Size"; 6.3 edges; 7.5 A-1, A-2, A-5, A-7, A-11). Vertices
  // are real <button> elements over an SVG of the edges, in a box that scrolls in both directions when
  // the layers are wider or deeper than the page (A-11). One vertex is in the tab order (roving
  // tabindex); the arrows move as nextVertex says; Enter or Space jumps. Edges are coloured by node
  // from the tokens --edge-1 to --edge-8 AND carry the node label as text (A-5). Nothing moves by
  // itself; there is no transition (A-9).
  import { edgeColour } from '../../draw/palette';
  import { lineOffsets, nextVertex, shifted, type DrawLayout, type VertexKey } from './drawing';

  interface Props {
    layout: DrawLayout;
    vertices: GraphVertex[];
    edges: GraphEdge[];
    labelled: boolean;
    hydrated: boolean;
    /** Accessible name of the group. */
    name: string;
    onJump: (index: number) => void;
    /** Focus or hover entered (index) or left (null) a vertex. */
    onPoint: (index: number | null) => void;
    /** The vertex holding the keyboard focus changed (for the edges drawn above 300 positions). */
    onFocusChange: (index: number | null) => void;
  }

  let { layout, vertices, edges, labelled, hydrated, name, onJump, onPoint, onFocusChange }: Props = $props();

  let tabStop = $state(0);
  const stop = $derived(tabStop < vertices.length ? tabStop : 0);
  const buttons: (HTMLButtonElement | undefined)[] = [];

  const KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

  function onKeydown(event: KeyboardEvent, k: number): void {
    if (!KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const to = nextVertex(layout, k, event.key as VertexKey, vertices.length);
    tabStop = to;
    const b = buttons[to];
    b?.focus();
    b?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function mid(e: GraphEdge, t: number, off: number): [number, number] {
    const [x1, y1, x2, y2] = shifted(layout.cx[e.from]!, layout.cy[e.from]!, layout.cx[e.to]!, layout.cy[e.to]!, e.offset + off);
    return [Math.round((x1 + (x2 - x1) * t) * 100) / 100, Math.round((y1 + (y2 - y1) * t) * 100) / 100];
  }
</script>

<div class="garden-box" style="height: {Math.min(layout.height, 520)}px;">
  <div class="canvas" style="width: {layout.width}px; height: {layout.height}px;">
    <svg class="edges" width={layout.width} height={layout.height} viewBox="0 0 {layout.width} {layout.height}" aria-hidden="true" focusable="false">
      {#each edges as e, k (k)}
        <g
          data-out="edge"
          data-label={e.label}
          data-from={vertices[e.from]!.position}
          data-to={vertices[e.to]!.position}
          data-rise={e.rise ?? undefined}
          style="stroke: {edgeColour(e.label)};"
        >
          {#each lineOffsets(e.lines) as off (off)}
            {@const s = shifted(layout.cx[e.from]!, layout.cy[e.from]!, layout.cx[e.to]!, layout.cy[e.to]!, e.offset + off)}
            <line x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />
          {/each}
          <text class="edge-label" x={mid(e, 0.42, 9)[0]} y={mid(e, 0.42, 9)[1]} text-anchor="middle" dominant-baseline="central">{e.label}</text>
          {#if e.numeral && e.rise !== null}
            {@const rt = mid(e, 0.58, -11)}
            <text class="rise" data-out="rise" x={rt[0]} y={rt[1]} text-anchor="middle" dominant-baseline="central">+{e.rise}</text>
          {/if}
        </g>
      {/each}
    </svg>
    <div class="vertices" role="group" aria-label={name}>
      {#each vertices as v, k (k)}
        <button
          type="button"
          bind:this={buttons[k]}
          class="vertex"
          class:dot={!labelled}
          style="left: {layout.cx[k]! - layout.w / 2}px; top: {layout.cy[k]! - layout.h / 2}px; width: {layout.w}px; height: {layout.h}px;"
          tabindex={k === stop ? 0 : -1}
          disabled={!hydrated}
          aria-label={v.name}
          title={v.exact}
          data-out="vertex"
          data-position={v.position}
          data-layer={v.layer}
          onclick={() => {
            tabStop = k;
            onJump(k);
          }}
          onfocus={() => {
            tabStop = k;
            onFocusChange(k);
            onPoint(k);
          }}
          onblur={() => {
            onFocusChange(null);
            onPoint(null);
          }}
          onpointerenter={() => onPoint(k)}
          onpointerleave={() => onPoint(null)}
          onkeydown={(event) => onKeydown(event, k)}>{labelled ? v.text : ''}</button
        >
      {/each}
    </div>
  </div>
</div>

<style>
  .garden-box {
    position: relative;
    max-width: 100%;
    overflow: auto;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    background: var(--page);
  }
  .canvas {
    position: relative;
  }
  .edges {
    position: absolute;
    inset: 0;
    overflow: visible;
  }
  .edges line {
    stroke-width: 2px;
  }
  .edge-label,
  .rise {
    font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    fill: var(--text);
    stroke: none;
    paint-order: stroke;
  }
  .rise {
    font-weight: bold;
  }
  .vertices {
    position: absolute;
    inset: 0;
  }
  .vertex {
    position: absolute;
    box-sizing: border-box;
    margin: 0;
    padding: 0 4px;
    font: 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--text);
    background: var(--page);
    border: 2px solid var(--text);
    border-radius: 22px;
    cursor: pointer;
  }
  .vertex:disabled {
    cursor: default;
  }
  .vertex.dot {
    border-radius: 50%;
    border-width: 0;
    background: transparent;
  }
  .vertex.dot::before {
    content: '';
    position: absolute;
    inset: 7px;
    border-radius: 50%;
    background: var(--text);
  }
  .vertex:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
    z-index: 1;
  }
</style>
