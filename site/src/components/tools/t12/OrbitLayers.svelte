<script module lang="ts">
  // The orbit of omega_i drawn in layers (SPEC.md 4 T12 bullet 1; 6.3: "Edges of orbit graphs are coloured
  // by node from a palette of eight and carry the node label as text"; A-5, A-11; 7.6 reserved size).
  // Owner P5-A2. Layer 0 (omega_i alone) at the top; each vertex shows its position with true minus signs
  // and its basis index (the row and column of the matrices, plan); each edge joins mu and R_k mu, coloured
  // by edgeColour(label of k) and labelled with that label. An edge whose upper end has mu_k of 2 or more
  // is no entry of E_k or F_k: it is dashed, and the legend says why (the failure made visible, plan). Above
  // DRAW_MAX positions only the sizes of the layers are listed, with a sentence (4.0 Stated limits). The
  // drawing is a picture (role img) with a title; the orbit table of the tool's table view holds the same
  // data as text (A-10). Hooks: data-vertex (basis index, 1-based), data-layer, data-value (the position,
  // comma-joined); data-edge with data-edge-node (the label), data-edge-from and data-edge-to (basis
  // indices), data-step ("true" for an entry of F_k, "false" for a dashed edge); data-edge-label on the
  // label's text; data-layer-count on each count of the list.
  //
  // The SVG is written by orbitSvg, a pure function, and inserted as markup: one string parsed by the
  // browser costs a small part of what a component per vertex and edge costs (SPEC 7.6; measured on E7).
  import { edgeColour } from '../../draw/palette';
  import type { OrbitDrawing, OrbitLayers } from './rep';

  const CHAR = 7.4;
  const PAD = 10;
  const BOX_H = 38;
  const ROW = 78;
  const GAP = 18;
  const MARGIN = 12;

  const esc = (text: string): string => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

  /** The text of a vertex: its position and, after #, its basis index (one text element per vertex). */
  const vertexText = (text: string, basisIndex: number): string => `${text} #${basisIndex + 1}`;

  /**
   * The drawing as two SVG layers of one size, with their hooks: the edges (each with its label) below, and
   * the vertices above, which carry the role img and the title (the text alternative of the drawing). The
   * tool draws the two in two tasks (SPEC 7.6); the export of the figure composes them (lib/export.ts).
   */
  export function orbitSvg(
    layers: OrbitLayers,
    drawing: OrbitDrawing,
    texts: readonly string[],
    title: string,
    titleId: string,
  ): { width: number; height: number; edges: string; vertices: string } {
    const boxW = Math.max(56, Math.ceil(Math.max(...texts.map((t, k) => [...vertexText(t, layers.vertices[k]!.basisIndex)].length), 4) * CHAR + 2 * PAD));
    const colW = boxW + GAP;
    const width = drawing.widest * colW - GAP + 2 * MARGIN;
    const height = (drawing.layers - 1) * ROW + BOX_H + 2 * MARGIN;
    const cx = (v: number): number => MARGIN + drawing.x[v]! * colW + boxW / 2;
    const top = (v: number): number => MARGIN + drawing.y[v]! * ROW;
    const size = `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`;
    const out: string[] = [];
    out.push(`<svg class="drawing edges-layer" aria-hidden="true" ${size}><g class="edges">`);
    for (const e of layers.edges) {
      const x1 = cx(e.from);
      const y1 = top(e.from) + BOX_H;
      const x2 = cx(e.to);
      const y2 = top(e.to);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      out.push(
        `<g class="edge" data-edge="" data-edge-node="${e.node}" data-edge-from="${layers.vertices[e.from]!.basisIndex + 1}" data-edge-to="${layers.vertices[e.to]!.basisIndex + 1}" data-step="${e.step ? 'true' : 'false'}" style="--edge: ${edgeColour(e.node)}">` +
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${e.step ? '' : ' class="dashed"'}></line>` +
          `<circle class="badge" cx="${mx}" cy="${my}" r="9"></circle>` +
          `<text class="edge-label" data-edge-label="${e.node}" x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central">${e.node}</text></g>`,
      );
    }
    out.push('</g></svg>');
    const edges = out.join('');
    const vs: string[] = [];
    vs.push(`<svg class="drawing vertices-layer" role="img" aria-labelledby="${esc(titleId)}" ${size}><title id="${esc(titleId)}">${esc(title)}</title><g class="vertices">`);
    layers.vertices.forEach((v, k) => {
      vs.push(
        `<g class="vertex" data-vertex="${v.basisIndex + 1}" data-layer="${v.depth}" data-value="${v.values.join(',')}">` +
          `<rect x="${cx(k) - boxW / 2}" y="${top(k)}" width="${boxW}" height="${BOX_H}" rx="6"></rect>` +
          `<text class="position" x="${cx(k)}" y="${top(k) + BOX_H / 2}" text-anchor="middle" dominant-baseline="central">${esc(vertexText(texts[k]!, v.basisIndex))}</text></g>`,
      );
    });
    vs.push('</g></svg>');
    return { width, height, edges, vertices: vs.join('') };
  }
</script>

<script lang="ts">
  import { DRAW_MAX } from './rep';

  interface Props {
    layers: OrbitLayers;
    drawing: OrbitDrawing | null;
    /** The text of each vertex (its position, label order, true minus signs), indexed like layers.vertices. */
    texts: readonly string[];
    /** The title of the picture (its text alternative). */
    title: string;
    /** omega_i written as "ω1". */
    omegaText: string;
    /** Whether the edges are drawn (a tool draws the vertices first and the edges in a later task). */
    edges?: boolean;
  }

  let { layers, drawing, texts, title, omegaText, edges = true }: Props = $props();

  const uid = $props.id();
  const dashed = $derived(layers.edges.some((e) => !e.step));
  const total = $derived(layers.layerSizes.reduce((a, b) => a + b, 0));
  const svg = $derived(layers.drawn && drawing !== null ? orbitSvg(layers, drawing, texts, title, `${uid}-title`) : null);
</script>

<div class="orbit" data-out="orbit-graph" data-drawn={layers.drawn ? 'true' : 'false'} data-positions={total}>
  {#if svg !== null}
    <!-- A scroll box is a tab stop so that a wide orbit can be scrolled from the keyboard (A-11). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="box" tabindex="0" role="group" aria-label="The orbit of {omegaText} in layers (scrolls sideways)">
      <div class="stack" style="width: {svg.width}px; height: {svg.height}px;">
        {#if edges}{@html svg.edges}{/if}{@html svg.vertices}
      </div>
    </div>
    <p class="legend">
      Layer 0 is {omegaText}; each edge joins a position to the one reached by firing the node written on it, and its colour is that node's.
      {#if dashed}A dashed edge leaves a position whose number at that node is 2 or more: it is no entry of E or F, which is where the recipe fails.{:else}Each edge is an entry of F from the upper position, and of E back.{/if}
      The number after # is the row and column of the position in the matrices.
    </p>
  {:else}
    <p class="legend">The orbit of {omegaText} has {total} positions, more than {DRAW_MAX}, so the full graph is not drawn; these are the sizes of its layers.</p>
    <ol class="counts" data-layer-counts="">
      {#each layers.layerSizes as size, d (d)}
        <li data-layer-count={size} data-layer={d}>Layer {d}: {size} {size === 1 ? 'position' : 'positions'}</li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .orbit {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  /* The drawing scrolls inside its own box when wider than the column (A-11), a tab stop with a name. */
  .box {
    overflow-x: auto;
    max-width: 100%;
    border-radius: 6px;
  }
  .box:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  /* The two layers lie on each other, edges below and vertices above. */
  .stack {
    position: relative;
    margin-inline: auto;
  }
  .box :global(.drawing) {
    position: absolute;
    inset: 0;
    display: block;
  }
  .box :global(.edge line) {
    stroke: var(--edge);
    stroke-width: 2.5px;
  }
  .box :global(.edge line.dashed) {
    stroke-dasharray: 6 4;
  }
  /* The label is written in the text colour on a badge ringed in the edge's colour, so the text keeps 4.5
     to 1 (A-6) and the colour is never the only cue (A-5). */
  .box :global(.badge) {
    fill: var(--page);
    stroke: var(--edge);
    stroke-width: 2px;
  }
  .box :global(.edge-label) {
    font-family: var(--font-numerals, monospace);
    font-size: 12px;
    font-weight: bold;
    fill: var(--text);
  }
  .box :global(.vertex rect) {
    fill: var(--page);
    stroke: var(--text);
    stroke-width: 1.5px;
  }
  .box :global(.vertex .position) {
    font-family: var(--font-numerals, monospace);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    fill: var(--text);
  }
  .legend {
    margin: 0;
  }
  .counts {
    margin: 0;
    padding-inline-start: 1.5em;
    font-variant-numeric: tabular-nums;
  }
</style>
