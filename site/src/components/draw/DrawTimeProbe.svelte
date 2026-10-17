<script lang="ts">
  // P4-A2: the drawing-time probe of SPEC.md 7.6 ("The E8 root set, its Coxeter projection and 6720
  // edges draw in under 100 ms on the phone; a browser test records the drawing time on the CI runner
  // and fails above 100 ms there."). It fetches the manifest and the showpiece file of T10 from
  // BASE_URL, builds E8 and euclideanBasis, and the populations of the vertices once (toPopulation,
  // cached as T10 will cache them); then five times in a row it computes y = E p for every vertex,
  // projects to the Coxeter plane at zero turn, builds the scene for a 360 by 360 box with the depth
  // cue off and draws it at rest on the canvas with the page's device pixel ratio. Each repetition is
  // timed with performance.now() from before the first y to after drawScene returns and a one-pixel
  // read-back has forced the canvas to rasterise (MERGE, wave 4.2); the fetch, the
  // parse, euclideanBasis, toPopulation and the edge list are outside the timed region (plan).
  //
  // Hooks (SPEC 4.0): data-tool="geometry" and data-moves on the root, data-hydrated="true" when the
  // five draws are done (or failed); data-out="drawTime" (median of the five, ms, one decimal),
  // "drawTimes" (the five, comma separated), "firstDrawTime", "segmentsDrawn", "pointsDrawn", "dpr",
  // "error" (empty unless something failed). The three times carry data-measured (RT-FIX P4-MERGE-04: a
  // time measured on the reader's machine, not part of any default state). The hooks are empty before
  // hydration. Nothing animates (A-9): the five draws run once, when the island hydrates. The default
  // slot holds the SVG snapshot of the same picture, rendered at build time (SPEC 7.4), shown until the
  // canvas is drawn.
  import { onMount, tick } from 'svelte';
  import type { Snippet } from 'svelte';
  import { boardFromName, euclideanBasis, toPopulation } from '@engine';
  import type { Board } from '@engine';
  import { buildScene, frameFor, project, roundTo, toEuclideanPopulation, type Point3 } from './projector';
  import { drawScene } from './canvasScene';
  import { MANIFEST_FILE, PRESET_DIR, type PresetData, type PresetManifest } from './presetsT10';

  interface Props {
    /** The SVG snapshot (server-rendered markup), shown until the canvas has been drawn. */
    children?: Snippet;
  }
  let { children }: Props = $props();

  /** The box of the scene in CSS pixels (plan, 5.10). */
  const BOX = 360;
  /** The number of timed repetitions (plan: the median of five). */
  const RUNS = 5;

  let canvas: HTMLCanvasElement | undefined = $state();
  let drawn = $state(false);
  let done = $state(false);
  let times: number[] = $state([]);
  let segmentsDrawn: number | null = $state(null);
  let pointsDrawn: number | null = $state(null);
  let dpr: number | null = $state(null);
  let error = $state('');

  const fmt = (ms: number): string => roundTo(ms, 1).toFixed(1);
  const median = (xs: readonly number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };

  async function fetchJson<T>(file: string): Promise<T> {
    const url = import.meta.env.BASE_URL + PRESET_DIR + file;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return (await response.json()) as T;
  }

  async function run(): Promise<void> {
    const manifest = await fetchJson<PresetManifest>(MANIFEST_FILE);
    const entry = manifest.files.find((f) => f.presets.includes('showpiece'));
    if (entry === undefined) throw new Error('the manifest has no showpiece file');
    const data = await fetchJson<PresetData>(entry.file);
    // A named finite board has SafeInt arithmetic (CONTRACTS.md 2.4, boardFromName).
    const board = boardFromName(data.board) as Board<number>;
    const { E } = euclideanBasis(board);
    const populations = data.vertices.map((a) => {
      const p = toPopulation(board, a);
      if (p === null) throw new Error(`${data.board} has det C = 0`);
      return p.map((r) => Number(r.num) / Number(r.den));
    });
    const edges: [number, number][] = [];
    data.adjacency.forEach((list, i) => {
      for (const j of list) edges.push([i, j]);
    });
    const page = getComputedStyle(document.documentElement);
    const colours = {
      segment: page.getPropertyValue('--road').trim(),
      point: page.getPropertyValue('--text').trim(),
      page: page.getPropertyValue('--page').trim(),
    };

    // Show the canvas before drawing on it; the backing store is sized by the device pixel ratio.
    drawn = true;
    await tick();
    if (canvas === undefined) throw new Error('no canvas');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(BOX * ratio);
    canvas.height = Math.round(BOX * ratio);
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('no 2D context');

    const measured: number[] = [];
    let result = { segmentsDrawn: 0, pointsDrawn: 0 };
    for (let k = 0; k < RUNS; k++) {
      const t0 = performance.now();
      const frame = frameFor(board.n, { kind: 'coxeter' });
      const points: Point3[] = populations.map((p) => project(frame, toEuclideanPopulation(E, p)));
      const scene = buildScene(points, edges, { width: BOX, height: BOX }, { depthCue: false });
      result = drawScene(ctx, scene, colours, { turning: false, dpr: ratio });
      // MERGE, P4 wave 4.2, on the review of P4-A2: Chromium defers the rasterisation of the 2D calls,
      // so a one-pixel read-back forces the drawing to finish inside the timed region; without it the
      // measured time leaves out the drawing itself.
      ctx.getImageData(0, 0, 1, 1);
      measured.push(performance.now() - t0);
    }
    times = measured;
    segmentsDrawn = result.segmentsDrawn;
    pointsDrawn = result.pointsDrawn;
    dpr = ratio;
  }

  onMount(() => {
    run()
      .catch((err: unknown) => {
        error = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        done = true;
      });
  });
</script>

<div class="probe" data-tool="geometry" data-moves="0" data-hydrated={done ? 'true' : undefined}>
  <figure>
    <div class="box">
      <div class="snapshot" hidden={drawn}>
        {@render children?.()}
      </div>
      <!-- The text alternative sits on the canvas's box: Svelte does not allow role="img" on a canvas. -->
      <div
        class="drawing"
        hidden={!drawn}
        role="img"
        aria-label="The roots of E8 in the Coxeter plane, each joined to the roots at inner product 1, drawn on a canvas"
      >
        <canvas bind:this={canvas} width={BOX} height={BOX}></canvas>
      </div>
    </div>
    <figcaption data-out="caption">
      The root set of E8 projected to its Coxeter plane, with the edges of its root polytope. Without
      JavaScript the picture is the SVG snapshot made at build time by the same drawing code; with it, the
      canvas is drawn five times and timed.
    </figcaption>
  </figure>
  <p class="nojs"><noscript><span data-out="noscript">The timing needs JavaScript; the picture above is the snapshot made at build time.</span></noscript></p>
  <dl class="results">
    <dt>Median drawing time of five, ms</dt>
    <dd data-out="drawTime" data-measured="">{times.length === RUNS ? fmt(median(times)) : ''}</dd>
    <dt>The five drawing times, ms</dt>
    <dd data-out="drawTimes" data-measured="">{times.map(fmt).join(', ')}</dd>
    <dt>First drawing time, ms</dt>
    <dd data-out="firstDrawTime" data-measured="">{times.length > 0 ? fmt(times[0]!) : ''}</dd>
    <dt>Segments drawn</dt>
    <dd data-out="segmentsDrawn">{segmentsDrawn ?? ''}</dd>
    <dt>Points drawn</dt>
    <dd data-out="pointsDrawn">{pointsDrawn ?? ''}</dd>
    <dt>Device pixel ratio</dt>
    <dd data-out="dpr">{dpr ?? ''}</dd>
    <dt>Error</dt>
    <dd data-out="error">{error}</dd>
  </dl>
</div>

<style>
  .probe {
    margin: 16px 0;
  }
  .probe figure {
    margin: 0;
  }
  .box {
    width: 100%;
    max-width: 360px;
  }
  .box canvas,
  .box :global(svg) {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }
  .box [hidden] {
    display: none;
  }
  .results {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 16px;
    justify-content: start;
  }
  .results dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
