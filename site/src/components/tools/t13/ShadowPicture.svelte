<script lang="ts">
  // The picture of the restricted roots for real rank 1 and 2 (SPEC.md 4 T13 Shadows; 2.15; A-5, A-10). Owner
  // P6-A3. Each restricted root sits at its coordinates in the simple restricted roots (from the engine),
  // mapped through choleskyBasis of the drawn restricted board (t13/model.ts shadowPoints; floats for drawing
  // only, E-1), so that a root and its double of a BC system lie on one ray at distances 1 and 2. Each point
  // carries its multiplicity as text; a double is drawn as a ring, a root as a disc (shape, not colour alone);
  // the chosen root's shadow is framed by a square. The shadow table beside it is the text alternative.
  // Hooks: data-point (coordinates joined by commas), data-mult, data-double, data-chosen.
  import type { ShadowPoint } from './model';
  import { MINUS } from './model';

  interface Props {
    points: readonly ShadowPoint[];
    rank: 1 | 2;
    /** The coordinates of the chosen root's shadow, or null. */
    chosen: readonly number[] | null;
    label: string;
  }

  let { points, rank, chosen, label }: Props = $props();

  const span = $derived(Math.max(1e-9, ...points.map((p) => Math.max(Math.abs(p.xy[0]), Math.abs(p.xy[1])))));
  const at = (p: ShadowPoint): [number, number] => [p.xy[0] / span, -p.xy[1] / span];
  const r2 = (v: number): number => Math.round(v * 1000) / 1000;
  const coordText = (c: readonly number[]): string => `(${c.map((x) => (x < 0 ? `${MINUS}${-x}` : String(x))).join(', ')})`;
  const isChosen = (p: ShadowPoint): boolean => chosen !== null && p.coords.join(',') === chosen.join(',');
  const box = $derived(rank === 1 ? '-1.35 -0.45 2.7 0.9' : '-1.35 -1.35 2.7 2.7');
</script>

<svg class="shadow-picture" viewBox={box} role="img" aria-label={label}>
  <title>{label}</title>
  <line class="axis" x1="-1.25" y1="0" x2="1.25" y2="0" />
  {#if rank === 2}<line class="axis" x1="0" y1="-1.25" x2="0" y2="1.25" />{/if}
  {#each points as p (p.coords.join(','))}
    {@const [x, y] = at(p)}
    <line class="ray" x1="0" y1="0" x2={r2(x)} y2={r2(y)} />
  {/each}
  {#each points as p (p.coords.join(','))}
    {@const [x, y] = at(p)}
    <g data-point={p.coords.join(',')} data-mult={p.mult} data-double={p.double ? 'true' : 'false'} data-chosen={isChosen(p) ? 'true' : 'false'}>
      {#if isChosen(p)}<rect class="chosen" x={r2(x - 0.1)} y={r2(y - 0.1)} width="0.2" height="0.2" />{/if}
      <circle class="point" class:double={p.double} cx={r2(x)} cy={r2(y)} r="0.05" />
      <text class="mult" x={r2(x + 0.07)} y={r2(y - 0.09)} font-size="0.11" text-anchor="start" dominant-baseline="central">{p.mult}</text>
    </g>
  {/each}
  <desc>{points.map((p) => `${coordText(p.coords)} multiplicity ${p.mult}`).join('; ')}</desc>
</svg>

<style>
  .shadow-picture {
    display: block;
    width: min(100%, 360px);
    margin-inline: auto;
    overflow: visible;
  }
  .axis {
    stroke: var(--sign-zero-outline);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  .ray {
    stroke: var(--road);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }
  .point {
    fill: var(--text);
    stroke: var(--text);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  .point.double {
    fill: var(--page);
  }
  .chosen {
    fill: none;
    stroke: var(--focus-ring);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  .mult {
    fill: var(--text);
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
  }
</style>
