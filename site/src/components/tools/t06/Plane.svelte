<script lang="ts">
  // The plane of T6 (SPEC.md 4 T6): one inline SVG with the chambers, the mirrors, the simple roots, the
  // overlays, the parallelogram of the population, the two perpendiculars of the numbers and the point.
  // Drawing and pointer handling only: every coordinate comes from t06/model.ts (plane coordinates,
  // mapped to the SIZE by SIZE box by toScreen with the screen y flipped), formatted with fmt.
  //
  // The SVG is one tab stop (data-control="plane") while the tool is interactive; the arrow keys step the
  // point by plus or minus one fundamental weight (Left and Right: a_1; Down and Up: a_2). The point can be
  // dragged with mouse, touch or pen (pointer capture; touch-action none on the point's handle only, so the
  // page still scrolls elsewhere); on release the parent snaps it to the weight lattice. Every drag has the
  // keys and the buttons as equivalents (A-8).
  import { DECIMALS, SIZE, fmt, toScreen, type Geometry, type LatticeDot, type OrbitPoint, type Readout, type Vec2 } from './model';

  interface Props {
    g: Geometry;
    r: Readout;
    /** The numbers drawn beside the perpendiculars (label order, as shown on screen). */
    shown: string[];
    roots: boolean;
    orbit: OrbitPoint[] | null;
    dots: LatticeDot[] | null;
    /** The root (label order, joined by commas) the page's highlight points at, or null. */
    marked: string | null;
    alt: string;
    active: boolean;
    onStep: (labelIndex: number, delta: 1 | -1) => void;
    onDrop: (y: Vec2) => void;
  }

  let { g, r, shown, roots, orbit, dots, marked, alt, active, onStep, onDrop }: Props = $props();

  let svg: SVGSVGElement | undefined = $state();
  /** The pointer position while dragging (screen units), or null. */
  let drag = $state<[number, number] | null>(null);
  let pointerId: number | null = null;

  const S = (y: Vec2): [number, number] => toScreen(g, y);
  const xy = (y: Vec2): string => {
    const [a, b] = S(y);
    return `${fmt(a)},${fmt(b)}`;
  };
  const points = (ys: readonly Vec2[]): string => ys.map(xy).join(' ');

  /** An arrow from the origin to y: the shaft and a small head (screen units). */
  function arrow(y: Vec2, head = 9): { x2: string; y2: string; head: string } {
    const [ox, oy] = S([0, 0]);
    const [tx, ty] = S(y);
    const len = Math.hypot(tx - ox, ty - oy) || 1;
    const ux = (tx - ox) / len;
    const uy = (ty - oy) / len;
    const bx = tx - head * ux;
    const by = ty - head * uy;
    const w = head * 0.45;
    return {
      x2: fmt(bx),
      y2: fmt(by),
      head: `${fmt(tx)},${fmt(ty)} ${fmt(bx - w * uy)},${fmt(by + w * ux)} ${fmt(bx + w * uy)},${fmt(by - w * ux)}`,
    };
  }

  const origin = $derived(S([0, 0]));
  const simpleArrows = $derived(
    g.order.map((i, k) => {
      const a = arrow(g.alpha[i]!);
      const [tx, ty] = S(g.alpha[i]!);
      const len = Math.hypot(tx - origin[0], ty - origin[1]) || 1;
      return { label: g.labels[k]!, ...a, lx: fmt(tx + (14 * (tx - origin[0])) / len), ly: fmt(ty + (14 * (ty - origin[1])) / len) };
    }),
  );
  const mirrorLabels = $derived(
    g.mirrors
      .filter((m) => m.simple !== 0)
      .map((m) => {
        // The label sits inside the window, near the end of the mirror where it leaves the dominant side.
        const t = (0.86 * g.R) / Math.max(Math.abs(m.to[0]), Math.abs(m.to[1]));
        const other = g.alpha[g.order[m.simple === g.labels[0] ? 1 : 0]!]!;
        const end: Vec2 = m.to[0] * other[0] + m.to[1] * other[1] >= 0 ? m.to : m.from;
        const [x, y] = S([end[0] * t, end[1] * t]);
        return { simple: m.simple, x: fmt(x), y: fmt(y) };
      }),
  );
  const dominantLabel = $derived.by(() => {
    const c = g.chambers.find((x) => x.dominant)!;
    const mid = (c.from + c.to) / 2;
    const [x, y] = S([0.55 * g.R * Math.cos(mid), 0.55 * g.R * Math.sin(mid)]);
    return { x: fmt(x), y: fmt(y) };
  });
  const point = $derived(S(r.y));
  const drawnPoint = $derived(drag ?? point);
  const perps = $derived(
    r.feet.map((f, k) => {
      const [fx, fy] = S(f);
      return { label: g.labels[k]!, x1: fmt(point[0]), y1: fmt(point[1]), x2: fmt(fx), y2: fmt(fy), lx: fmt((point[0] + fx) / 2), ly: fmt((point[1] + fy) / 2), text: shown[k]!, distance: fmt(r.distances[k]!) };
    }),
  );
  const rootArrows = $derived(roots ? g.roots.map((q) => ({ key: q.root.join(','), ...arrow(q.y, 7) })) : []);

  function toUser(event: PointerEvent): [number, number] | null {
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  function onPointerDown(event: PointerEvent): void {
    if (!active || r.offView) return;
    event.preventDefault();
    pointerId = event.pointerId;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    drag = toUser(event);
  }

  function onPointerMove(event: PointerEvent): void {
    if (drag === null || event.pointerId !== pointerId) return;
    drag = toUser(event) ?? drag;
  }

  function end(event: PointerEvent, drop: boolean): void {
    if (drag === null || event.pointerId !== pointerId) return;
    const at = toUser(event) ?? drag;
    const el = event.currentTarget as Element;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    drag = null;
    pointerId = null;
    if (!drop) return;
    const s = SIZE / 2 / g.R;
    onDrop([(at[0] - SIZE / 2) / s, (SIZE / 2 - at[1]) / s]);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
    const step: Record<string, [number, 1 | -1]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowUp: [1, 1],
      ArrowDown: [1, -1],
    };
    const s = step[event.key];
    if (s === undefined) return;
    event.preventDefault();
    onStep(s[0], s[1]);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={svg}
  class="plane"
  viewBox="0 0 {SIZE} {SIZE}"
  role="img"
  aria-label={alt}
  aria-roledescription="plane"
  aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
  tabindex={active ? 0 : -1}
  data-control="plane"
  data-decimals={DECIMALS}
  onkeydown={onKeydown}
>
  <g class="chambers">
    {#each g.chambers as c, k (k)}
      <polygon class="chamber" class:dominant={c.dominant} data-out="chamber" data-dominant={c.dominant ? 'true' : undefined} points={points(c.polygon)} />
    {/each}
  </g>
  <text class="dominant-label" x={dominantLabel.x} y={dominantLabel.y} text-anchor="middle" dominant-baseline="central">dominant</text>
  <g class="mirrors">
    {#each g.mirrors as m (m.index)}
      {@const [x1, y1] = S(m.from)}
      {@const [x2, y2] = S(m.to)}
      <line
        class="mirror"
        class:simple={m.simple !== 0}
        data-out="mirror"
        data-mirror={m.index}
        data-simple={m.simple !== 0 ? m.simple : undefined}
        x1={fmt(x1)}
        y1={fmt(y1)}
        x2={fmt(x2)}
        y2={fmt(y2)}
      />
    {/each}
    {#each mirrorLabels as l (l.simple)}
      <text class="mirror-label" x={l.x} y={l.y} text-anchor="middle" dominant-baseline="central">mirror {l.simple}</text>
    {/each}
  </g>
  {#if dots}
    <g class="lattices">
      {#each dots as d, k (k)}
        {@const [x, y] = S(d.y)}
        {#if d.lattice === 'root'}
          <circle class="dot root" data-out="latticeDot" data-lattice="root" data-x={fmt(d.y[0])} data-y={fmt(d.y[1])} cx={fmt(x)} cy={fmt(y)} r="2.5" />
        {:else}
          <rect class="dot weight" data-out="latticeDot" data-lattice="weight" data-x={fmt(d.y[0])} data-y={fmt(d.y[1])} x={fmt(x - 5)} y={fmt(y - 5)} width="10" height="10" transform="rotate(45 {fmt(x)} {fmt(y)})" />
        {/if}
      {/each}
    </g>
  {/if}
  {#if roots}
    <g class="roots">
      {#each rootArrows as a (a.key)}
        <g class="root" class:marked={marked === a.key} data-out="root" data-value={a.key} data-marked={marked === a.key ? 'true' : undefined}>
          <line x1={fmt(origin[0])} y1={fmt(origin[1])} x2={a.x2} y2={a.y2} />
          <polygon points={a.head} />
        </g>
      {/each}
    </g>
  {/if}
  {#if !r.offView}
    <polygon class="parallelogram" data-out="parallelogram" points={points(r.parallelogram)} />
  {/if}
  <g class="simple-roots">
    {#each simpleArrows as a (a.label)}
      <g class="simple-root" data-out="simpleRoot" data-node={a.label}>
        <line x1={fmt(origin[0])} y1={fmt(origin[1])} x2={a.x2} y2={a.y2} />
        <polygon points={a.head} />
        <text x={a.lx} y={a.ly} text-anchor="middle" dominant-baseline="central"><tspan font-style="italic">α</tspan><tspan baseline-shift="sub" font-size="11">{a.label}</tspan></text>
      </g>
    {/each}
  </g>
  {#if orbit}
    <g class="orbit">
      {#each orbit as o, k (k)}
        {@const [x, y] = S(o.y)}
        <polygon class="orbit-point" data-out="orbitPoint" data-value={o.numbers.join(',')} points="{fmt(x)},{fmt(y - 7)} {fmt(x - 6)},{fmt(y + 4)} {fmt(x + 6)},{fmt(y + 4)}" />
      {/each}
    </g>
  {/if}
  {#if !r.offView}
    <g class="perpendiculars">
      {#each perps as p (p.label)}
        <g class="distance" data-out="distance" data-node={p.label} data-value={p.distance}>
          <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
          <text x={p.lx} y={p.ly} dx="6" dy="-6" class="distance-label">{p.text}</text>
        </g>
      {/each}
    </g>
    <g
      class="point"
      class:dragging={drag !== null}
      data-out="point"
      data-x={fmt(r.y[0])}
      data-y={fmt(r.y[1])}
      style="transform: translate({fmt(drawnPoint[0])}px, {fmt(drawnPoint[1])}px);"
    >
      <circle class="point-dot" r="7" />
      <circle
        class="handle"
        r="22"
        role="presentation"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={(e) => end(e, true)}
        onpointercancel={(e) => end(e, false)}
        onlostpointercapture={(e) => end(e, false)}
      />
    </g>
  {/if}
  <circle class="origin" cx={fmt(origin[0])} cy={fmt(origin[1])} r="2.5" />
  <title>{alt}</title>
</svg>

<style>
  .plane {
    display: block;
    width: 100%;
    max-width: 400px;
    aspect-ratio: 1 / 1;
    height: auto;
    margin-inline: auto;
    overflow: hidden;
    color: var(--text);
    font-size: 14px;
  }
  .plane:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .chamber {
    fill: none;
    stroke: none;
  }
  .chamber.dominant {
    fill: var(--sign-zero-outline);
    fill-opacity: 0.18;
  }
  .dominant-label {
    fill: var(--text);
    font-size: 12px;
    font-style: italic;
  }
  .mirror {
    stroke: var(--sign-zero-outline);
    stroke-width: 1px;
    stroke-dasharray: 4 4;
  }
  .mirror.simple {
    stroke: var(--text);
    stroke-width: 2px;
    stroke-dasharray: none;
  }
  .mirror-label {
    fill: var(--text);
    font-size: 12px;
    paint-order: stroke;
    stroke: var(--page);
    stroke-width: 3px;
  }
  .dot.root {
    fill: var(--text);
  }
  .dot.weight {
    fill: none;
    stroke: var(--text);
    stroke-width: 1px;
  }
  .root line {
    stroke: var(--sign-zero-outline);
    stroke-width: 1.5px;
  }
  .root polygon {
    fill: var(--sign-zero-outline);
  }
  .root.marked line {
    stroke: var(--focus-ring);
    stroke-width: 3px;
  }
  .root.marked polygon {
    fill: var(--focus-ring);
  }
  .parallelogram {
    fill: none;
    stroke: var(--text);
    stroke-width: 1.5px;
    stroke-dasharray: 2 3;
  }
  .simple-root line {
    stroke: var(--text);
    stroke-width: 2.5px;
  }
  .simple-root polygon,
  .simple-root text {
    fill: var(--text);
  }
  .simple-root text {
    font-size: 16px;
  }
  .orbit-point {
    fill: none;
    stroke: var(--text);
    stroke-width: 1.5px;
  }
  .distance line {
    stroke: var(--text);
    stroke-width: 2px;
  }
  .distance-label {
    fill: var(--text);
    font-size: 14px;
    font-weight: bold;
    paint-order: stroke;
    stroke: var(--page);
    stroke-width: 3px;
  }
  .point {
    transition: transform 150ms ease-out;
  }
  .point.dragging {
    transition: none;
  }
  .point-dot {
    fill: var(--text);
    stroke: var(--page);
    stroke-width: 2px;
  }
  .handle {
    fill: transparent;
    touch-action: none;
    cursor: grab;
  }
  .point.dragging .handle {
    cursor: grabbing;
  }
  .origin {
    fill: var(--text);
  }
  @media (prefers-reduced-motion: reduce) {
    .point {
      transition: none;
    }
  }
</style>
