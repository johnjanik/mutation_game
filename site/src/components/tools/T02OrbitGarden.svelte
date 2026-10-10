<script lang="ts">
  // T2, the Orbit Garden (SPEC.md 4 T2; 4.0; 5.4; 5.5; 5.6; 6.3; 6.6; 7.4; 7.5). Owner P1-A6.
  // "Grows a set of positions as a graph: one vertex per position found, one edge per move, coloured
  // and labelled by node." In `roots` mode the seeds are the single Martians and the moves are
  // mutations; in `orbit` mode the seed is one position of either game. It grows breadth-first, one
  // layer per press (`explore`), or as the reader visits positions on the board (`follow`).
  //
  // Every engine call runs synchronously on the main thread with the cap CAPS.gardenPositions (E-9
  // rule 1); nothing here imports the worker. The default growth (`grown`) is computed in this script,
  // so Astro's server render writes it into the HTML (E-9: at build time every call runs in-process).
  // The state is { schema, tool, board, coords, start, moves } (6.6); the growth mode, what grows,
  // grown, layers, positiveOnly, vertexLabels and boardChoices are options outside the link.
  //
  // Properties beyond the common ones (listed in site/tests/e2e/T02.spec.ts): grown, grows, growth,
  // positiveOnly, vertexLabels, boardChoices. Hooks: see the comment block of T02.spec.ts.
  import { untrack } from 'svelte';
  import { CAPS, EngineOverflow, fire, mutate, toLabels, toPositions } from '@two-games/engine';
  import type { AnyBoard, Board as EngineBoard, OrbitGraph } from '@two-games/engine';
  import ToolFrame from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { announceTemplates, moveAnnouncement, speakList } from '../../lib/a11y';
  import { highlight } from '../../lib/highlight';
  import { bigBoard, boardVerdict, followToolState, isFiniteType, publishToolState, resolveBoard, type BoardSpec, type Coords, type ToolState } from '../../lib/state';
  import { decodeState, encodeBoard } from '../../lib/urlCodec';
  import type { Prediction } from '../../tools/types';
  import {
    canGrow,
    chartLayers,
    clampLayers,
    drawsEverything,
    entriesInLabelOrder,
    gameOf,
    grow,
    highlightFor,
    jumpTo,
    keyOf,
    moveEdges,
    newPerLayer,
    playEdges,
    positionText,
    startVector,
    totalText,
    vertexIndex,
    visibleEdges,
    wordFromStart,
    type GardenEdge,
    type GardenSpec,
    type Grows,
    type Growth,
    type Vector,
  } from './t02/garden';
  import { followStopMessage, layersGrownText, stopMessage } from './t02/limits';
  import { positiveView } from './t02/poset';
  import { followStart, followStep, moveMade, type FollowModel } from './t02/follow';
  import { exactText, vertexText } from './t02/numbers';
  import { pickedState, pickerGroups, presetOf } from './t02/presets';
  import { drawGarden } from './t02/drawing';
  import GardenGraph, { type GraphEdge, type GraphVertex } from './t02/GardenGraph.svelte';
  import LayerChart from './t02/LayerChart.svelte';
  // Phase 2 (P2-A7): the finite test from classify's verdict (5.6), the verdict text beside the stop message.
  import { gardenLayersBound, gardenTotal, verdictText } from './t02/phase2';

  interface Props {
    id?: string;
    board?: BoardSpec;
    coords?: Coords;
    start?: (number | string)[];
    moves?: number[];
    /** The instance id of a T1 on the same page to follow (7.4). */
    linkTo?: string;
    /**
     * Accepted (4.0 Predict); the freezing and the reveal are wired when P1-A5's Predict.svelte is on
     * the integration branch (requested of MERGE). M1 places no prediction on T2.
     */
    prediction?: Prediction;
    preset?: string;
    caption?: string;
    layers?: number;
    grown?: number;
    grows?: Grows;
    growth?: Growth;
    positiveOnly?: boolean;
    vertexLabels?: boolean;
    boardChoices?: string[];
  }

  let props: Props = $props();

  // ------------------------------------------------------------------------------------------
  // Configuration: the preset, then the properties over it (read once; a page does not change them).
  // ------------------------------------------------------------------------------------------
  function configure() {
    const p = presetOf(props.preset);
    const boardSpec: BoardSpec = props.board ?? p.state.board;
    const sameBoard = props.board === undefined || JSON.stringify(props.board) === JSON.stringify(p.state.board);
    const coords: Coords = props.coords ?? p.state.coords ?? 'populations';
    const b = resolveBoard(boardSpec);
    const defaultStart = coords === 'numbers' ? Array.from({ length: b.n }, () => 1) : Array.from({ length: b.n }, (_, k) => (k === 0 ? 1 : 0));
    const start = props.start ?? (sameBoard && props.coords === undefined ? (p.state.start ?? defaultStart) : defaultStart);
    const defaults: ToolState = { schema: 1, tool: 'garden', board: boardSpec, coords, start: [...start], moves: [...(props.moves ?? [])] };
    const grows: Grows = props.grows ?? (coords === 'numbers' ? 'orbit' : p.options.grows);
    return {
      instanceId: props.id ?? '',
      caption: props.caption ?? p.caption,
      defaults,
      grows,
      growth: props.growth ?? p.options.growth,
      grown: props.grown ?? p.options.grown,
      layers: props.layers ?? p.options.layers,
      positiveOnly: props.positiveOnly ?? p.options.positiveOnly,
      vertexLabels: props.vertexLabels ?? p.options.vertexLabels,
      boardChoices: props.boardChoices ?? p.options.boardChoices,
      linkTo: props.linkTo,
    };
  }
  const config = untrack(configure);

  // ------------------------------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------------------------------
  let boardSpec = $state.raw<BoardSpec>(config.defaults.board);
  let coords = $state<Coords>(config.defaults.coords ?? 'populations');
  let start = $state.raw<(number | string)[]>(config.defaults.start ?? []);
  /** Every move in the list, including those undone (redo puts them back); `cursor` are applied. */
  let allMoves = $state.raw<number[]>(config.defaults.moves ?? []);
  let cursor = $state((config.defaults.moves ?? []).length);
  let forceBig = $state(false);
  let grows = $state<Grows>(config.grows);
  let growth = $state<Growth>(config.growth);
  let positiveOnly = $state(config.positiveOnly);
  let labelsOn = $state(config.vertexLabels);
  let totalShown = $state(false);
  let notice = $state<string | null>(null);
  let focusedVertex = $state<number | null>(null);
  /** The state of the followed T1, when `linkTo` names one and it has published. */
  let followed = $state.raw<ToolState | null>(null);

  const resolved = $derived(resolveBoard(boardSpec));
  const startNeedsBig = $derived(start.some((x) => typeof x === 'string' && !Number.isSafeInteger(Number(x))));
  /** The board every engine call uses: the board itself, or its Big copy (E-2, after an overflow). */
  const gb: AnyBoard = $derived(forceBig || startNeedsBig ? bigBoard(resolved) : resolved);
  const startVec: Vector = $derived(startVector(gb, start).v);
  const game = $derived(gameOf(grows, coords));
  const bound = $derived(gardenLayersBound(resolved, config.layers));
  const boardText = $derived(typeof boardSpec === 'string' ? boardSpec : encodeBoard(boardSpec));

  /** Layers grown in `explore`. */
  let layersGrown = $state(clampLayers(config.grown, gardenLayersBound(resolveBoard(config.defaults.board), config.layers)));

  const spec: GardenSpec = $derived(grows === 'roots' ? { board: gb, grows, game } : { board: gb, grows, game, seed: startVec });

  // The play on the board the garden shows, kept in memory and extended by one position per move (7.4).
  function replay(b: AnyBoard, v0: Vector, moves: readonly number[], g: 'mutation' | 'firing'): Vector[] {
    const out: Vector[] = [v0];
    const move = g === 'mutation' ? mutate : fire;
    for (const label of moves) out.push(move(b as EngineBoard<unknown>, out[out.length - 1]!, toPositions(b, [label])[0]!));
    return out;
  }
  function safeReplay(moves: readonly number[]): Vector[] {
    try {
      return replay(gb, startVec, moves, coords === 'numbers' ? 'firing' : 'mutation');
    } catch (e) {
      if (!(e instanceof EngineOverflow)) throw e;
      forceBig = true;
      return replay(bigBoard(gb), startVector(bigBoard(gb), start).v, moves, coords === 'numbers' ? 'firing' : 'mutation');
    }
  }
  let positions = $state.raw<Vector[]>(untrack(() => safeReplay(allMoves)));
  const current = $derived(positions[cursor] ?? positions[positions.length - 1]!);
  const boardGame = $derived(coords === 'numbers' ? 'firing' : 'mutation');

  // ------------------------------------------------------------------------------------------
  // The garden
  // ------------------------------------------------------------------------------------------
  const grown = $derived(grow(spec, layersGrown));
  const gGraph: OrbitGraph<unknown> = $derived(grown.graph);
  let followModel = $state.raw<FollowModel | null>(untrack(() => (growth === 'follow' ? followStart(gb, current, game, bound) : null)));

  function restartFollow(): void {
    followModel = followStart(gb, current, game, bound);
  }
  /** The follow model, made when first needed. */
  function fm(): FollowModel {
    if (followModel === null) followModel = followStart(gb, current, game, bound);
    return followModel;
  }

  interface View {
    items: Vector[];
    rank: number[];
    layer: number[];
    edges: GraphEdge[];
    /** For each vertex, the graph and index a jump reads its word from, or null. */
    jumpRef: ({ graph: OrbitGraph<unknown>; index: number } | null)[];
    /** The garden edges (for the edge filter above 300). */
    gardenEdges: GardenEdge[];
  }

  function offsetsFor(edges: { from: number; to: number }[]): number[] {
    const count = new Map<string, number>();
    return edges.map((e) => {
      const id = `${e.from}|${e.to}`;
      const k = count.get(id) ?? 0;
      count.set(id, k + 1);
      return k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * 7 * Math.ceil(k / 2);
    });
  }

  const usePositive = $derived(positiveOnly && grows === 'roots' && growth === 'explore');

  const view: View = $derived.by(() => {
    const b = grown.board;
    if (growth === 'follow' && followModel !== null) {
      const m = followModel;
      const off = offsetsFor(m.edges);
      return {
        items: m.items,
        rank: m.rank,
        layer: m.rank,
        edges: m.edges.map((e, k) => ({ from: e.from, to: e.to, label: e.label, rise: null, lines: 1, numeral: false, offset: off[k]! })),
        jumpRef: m.inRankGraph.map((r) => (r === null ? null : { graph: m.rankGraph, index: r })),
        gardenEdges: m.edges,
      };
    }
    if (usePositive) {
      const pv = positiveView(b, layersGrown);
      const idx = vertexIndex(b, gGraph.items);
      const minTotal = pv.totals.length > 0 ? pv.totals[0]! : 1n;
      const edges = pv.edges.map((e) => ({ from: e.from, to: e.to, node: e.node, label: e.label }));
      const off = offsetsFor(edges);
      return {
        items: pv.vertices,
        rank: pv.totals.map((t) => Number(t - minTotal)),
        layer: pv.totals.map((t) => Number(t)),
        edges: pv.edges.map((e, k) => ({
          from: e.from,
          to: e.to,
          label: e.label,
          rise: e.rise.toString(),
          lines: pv.riseStyle === 'lines' ? Number(e.rise) : 1,
          numeral: pv.riseStyle === 'numeral',
          offset: off[k]!,
        })),
        jumpRef: pv.vertices.map((v) => {
          const i = idx.get(keyOf(b, v));
          return i === undefined ? null : { graph: gGraph, index: i };
        }),
        gardenEdges: edges,
      };
    }
    const edges = moveEdges(b, gGraph.items, spec.game);
    const off = offsetsFor(edges);
    return {
      items: gGraph.items as Vector[],
      rank: gGraph.depth,
      layer: gGraph.depth,
      edges: edges.map((e, k) => ({ from: e.from, to: e.to, label: e.label, rise: null, lines: 1, numeral: false, offset: off[k]! })),
      jumpRef: gGraph.items.map((_, k) => ({ graph: gGraph, index: k })),
      gardenEdges: edges,
    };
  });

  const viewBoard = $derived(growth === 'follow' && followModel !== null ? gb : grown.board);
  const keys = $derived(view.items.map((v) => keyOf(viewBoard, v)));
  const entries = $derived(view.items.map((v) => entriesInLabelOrder(viewBoard, v)));
  const labelled = $derived(labelsOn && drawsEverything(view.items.length));
  const layout = $derived(
    drawGarden({
      keys,
      rank: view.rank,
      edges: view.edges.map((e) => [e.from, e.to] as const),
      texts: entries.map((e) => vertexText(e)),
      labelled,
    }),
  );
  const noun = $derived(grows === 'roots' ? 'Root population' : 'Position');
  const vertices: GraphVertex[] = $derived(
    entries.map((e, k) => ({
      position: e.join(','),
      layer: view.layer[k]!,
      text: vertexText(e),
      exact: exactText(e),
      name: `${noun} ${speakList(e)}, ${usePositive ? 'total' : 'layer'} ${view.layer[k]}`,
    })),
  );
  const index = $derived(new Map(keys.map((k, i) => [k, i] as const)));
  const along = $derived(
    playEdges(
      view.gardenEdges,
      index,
      positions.slice(0, cursor + 1).map((v) => keyOf(viewBoard, v)),
      allMoves.slice(0, cursor),
    ),
  );
  const shownEdges = $derived(visibleEdges(view.gardenEdges, view.items.length, focusedVertex, along).map((k) => view.edges[k]!));

  const found = $derived(growth === 'follow' && followModel !== null ? followModel.items.length : gGraph.items.length);
  const message = $derived(growth === 'follow' ? followStopMessage(found, CAPS.gardenPositions) : stopMessage(gGraph, layersGrown, bound, CAPS.gardenPositions));
  const chart = $derived(growth === 'follow' && followModel !== null ? newPerLayer(followModel.rank).map((count, layer) => ({ layer, count, complete: true })) : chartLayers(gGraph));
  const growable = $derived(growth === 'explore' && canGrow(gGraph, layersGrown, bound));
  const total = $derived(totalShown ? totalText(gardenTotal(spec, bound)) : '');
  /**
   * Phase 2 (P2-A7): the verdict of `classify`, computed once when the board was resolved (5.6), shown
   * beside the stop message (SPEC 4 T2). A board classify calls finite shows no stop message and no
   * verdict; the words come only from classify, never from a cap (4.0).
   */
  const verdict: string | null = $derived(isFiniteType(resolved) ? null : verdictText(boardVerdict(resolved)));

  const toolState: ToolState = $derived({ schema: 1, tool: 'garden', board: boardSpec, coords, start, moves: allMoves.slice(0, cursor) });
  const showBoard = $derived(config.linkTo === undefined);

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------
  /** ToolFrame's announcer, captured from the figure snippet for the undo, redo and reset row. */
  let frameAnnounce: (text: string) => void = () => {};
  function captureAnnounce(announce: (text: string) => void): string {
    frameAnnounce = announce;
    return '';
  }
  const show = (v: Vector): string[] => v.map((x) => (gb.arith as EngineBoard<unknown>['arith']).show(x));

  function load(next: ToolState): void {
    const boardChanged = JSON.stringify(next.board) !== JSON.stringify(boardSpec);
    boardSpec = next.board;
    coords = next.coords ?? 'populations';
    if (coords === 'numbers') grows = 'orbit';
    start = next.start ?? start;
    forceBig = false;
    allMoves = next.moves ?? [];
    cursor = allMoves.length;
    positions = safeReplay(allMoves);
    if (boardChanged) {
      layersGrown = clampLayers(config.grown, gardenLayersBound(resolveBoard(boardSpec), config.layers));
      totalShown = false;
    }
    if (growth === 'follow') restartFollow();
  }

  function act(k: number, announce: (t: string) => void): void {
    const label = toLabels(gb, [k])[0]!;
    const before = current;
    let after: Vector;
    try {
      after = (boardGame === 'mutation' ? mutate : fire)(gb as EngineBoard<unknown>, before, k);
    } catch (e) {
      if (!(e instanceof EngineOverflow)) throw e;
      forceBig = true;
      positions = safeReplay(allMoves);
      return act(k, announce);
    }
    allMoves = [...allMoves.slice(0, cursor), label];
    positions = [...positions.slice(0, cursor + 1), after];
    cursor = cursor + 1;
    if (growth === 'follow') followModel = followStep(fm(), gb, before, after, k);
    announce(moveAnnouncement(boardGame === 'mutation' ? 'Mutated' : 'Fired', gb.labels, label, show(before), show(after), cursor));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (to < 0 || to > allMoves.length || to === cursor) return;
    const from = cursor;
    cursor = to;
    const nounWord = coords === 'numbers' ? 'numbers' : 'populations';
    if (to < from) announce(announceTemplates.undid(to + 1, show(positions[to]!), nounWord));
    else announce(moveAnnouncement(boardGame === 'mutation' ? 'Mutated' : 'Fired', gb.labels, allMoves[to - 1]!, show(positions[to - 1]!), show(positions[to]!), to));
  }

  function reset(announce: (t: string) => void): void {
    allMoves = [];
    cursor = 0;
    positions = safeReplay([]);
    layersGrown = clampLayers(config.grown, bound);
    if (growth === 'follow') restartFollow();
    announce(`Reset. The garden holds ${growth === 'follow' ? fm().items.length : grow(spec, layersGrown).graph.items.length} positions.`);
  }

  function growLayer(announce: (t: string) => void): void {
    if (!growable) return;
    const before = gGraph.items.length;
    layersGrown = layersGrown + 1;
    const g = grow(spec, layersGrown).graph;
    const m = stopMessage(g, layersGrown, bound, CAPS.gardenPositions);
    announce(`Layer ${layersGrown} grown: ${g.items.length - before} new, ${g.items.length} found so far.${m ? ` ${m[0]!.toUpperCase()}${m.slice(1)}.` : ''}`);
  }

  function revealTotal(announce: (t: string) => void): void {
    totalShown = true;
    announce(`Total: ${totalText(gardenTotal(spec, bound))}.`);
  }

  function jump(k: number, announce: (t: string) => void): void {
    const ref = view.jumpRef[k];
    if (!ref) return;
    const j = jumpTo(viewBoard, ref.graph, ref.index);
    if (config.linkTo !== undefined && followed !== null) {
      // With a linked T1: its own start, a shortest word to the vertex, published under its id.
      const t1Start = startVector(gb, followed.start ?? start).v;
      const word = wordFromStart(gb, t1Start, followed.coords === 'numbers' ? 'firing' : 'mutation', keys[k]!, bound);
      if (word !== null) publishToolState(config.linkTo, { ...followed, moves: word });
      return;
    }
    start = j.start;
    allMoves = j.moves;
    cursor = j.moves.length;
    positions = safeReplay(allMoves);
    announce(`Jumped to ${noun.toLowerCase()} ${speakList(entries[k]!)} by ${j.moves.length === 1 ? '1 move' : `${j.moves.length} moves`}.`);
  }

  function point(k: number | null): void {
    if (k === null) {
      highlight.set(null);
      return;
    }
    highlight.set(highlightFor(viewBoard, boardText, grows, view.items[k] ?? null));
  }

  function setGrowth(next: Growth, announce: (t: string) => void): void {
    growth = next;
    if (next === 'follow') restartFollow();
    announce(next === 'follow' ? 'Follow mode: positions appear as the board visits them.' : 'Explore mode: grow one layer per press.');
  }

  function setGrows(next: Grows, announce: (t: string) => void): void {
    grows = next;
    totalShown = false;
    if (growth === 'follow') restartFollow();
    announce(next === 'roots' ? 'Growing the root populations.' : 'Growing the orbit of the start.');
  }

  function pick(name: string, announce: (t: string) => void): void {
    if (name === '' || name === boardSpec) return;
    load(pickedState(toolState, name));
    announce(`Board ${name}. The garden holds ${found} positions.`);
  }

  function onBoardKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    scrub(action === 'undo' ? cursor - 1 : cursor + 1, announce);
  }

  // ------------------------------------------------------------------------------------------
  // Hydration: the link (6.6), the back button, the followed T1 (7.4)
  // ------------------------------------------------------------------------------------------
  $effect(() => {
    untrack(() => {
      if (typeof location === 'undefined') return;
      const { state: s, notice: n } = decodeState(location.search, 'garden', config.defaults, { prefix: config.instanceId });
      notice = n;
      if (JSON.stringify(s) !== JSON.stringify(config.defaults)) load(s);
    });
  });

  function onPopState(s: ToolState, n: string | null): void {
    notice = n;
    load(s);
  }

  $effect(() => {
    const id = config.linkTo;
    if (id === undefined) return;
    return followToolState(id, (s) => {
      const before = followed;
      followed = s;
      const sameBase =
        before !== null && JSON.stringify(before.board) === JSON.stringify(s.board) && before.coords === s.coords && JSON.stringify(before.start) === JSON.stringify(s.start);
      if (!sameBase) {
        load({ ...s, tool: 'garden' });
        return;
      }
      const oldMoves = before.moves ?? [];
      const newMoves = s.moves ?? [];
      const made = moveMade(oldMoves, newMoves);
      const prev = positions[Math.max(0, newMoves.length - 1)] ?? null;
      allMoves = [...newMoves];
      cursor = newMoves.length;
      positions = safeReplay(allMoves);
      if (growth === 'follow') {
        const node = made === null ? null : toPositions(gb, [made])[0]!;
        followModel = followStep(fm(), gb, made === null ? null : prev, positions[cursor]!, node);
      }
    });
  });

  // ------------------------------------------------------------------------------------------
  // Data export (6.6): the derived tables shown on screen
  // ------------------------------------------------------------------------------------------
  function integer(text: string): number | string {
    const n = Number(text);
    return Number.isSafeInteger(n) && String(n) === text ? n : text;
  }
  function derivedForExport(): Record<string, unknown> {
    const words = view.jumpRef.map((r) => (r === null ? null : jumpTo(viewBoard, r.graph, r.index).moves));
    return {
      grows,
      growth,
      layersGrown: growth === 'explore' ? layersGrown : null,
      positiveOnly: usePositive,
      positions: entries.map((e, k) => ({ entries: e.map(integer), layer: view.layer[k], word: words[k] })),
      edges: view.edges.map((e) => ({ from: entries[e.from]!.map(integer), to: entries[e.to]!.map(integer), label: e.label, ...(e.rise !== null ? { rise: integer(e.rise) } : {}) })),
      newPerLayer: chart.map((c) => c.count),
      truncated: growth === 'explore' ? gGraph.truncated : false,
      completeLayers: growth === 'explore' ? gGraph.completeLayers : null,
      depthReached: growth === 'explore' ? gGraph.depthReached : null,
      stopMessage: message,
      verdict: message ? verdict : null,
      found,
      total: totalShown ? total : null,
    };
  }

  const groups = $derived(pickerGroups(config.boardChoices));
  const boardName = $derived(typeof boardSpec === 'string' ? boardSpec : 'custom');
  const figureLabel = $derived(
    `Orbit garden on ${typeof boardSpec === 'string' ? `board ${boardSpec}` : 'a custom board'}: ${found} positions found${message ? `, ${message}` : ''}.`,
  );
</script>

<ToolFrame
  toolId="garden"
  instanceId={config.instanceId}
  title="Orbit Garden"
  caption={config.caption}
  state={toolState}
  defaults={config.defaults}
  {derivedForExport}
  {notice}
  {figureLabel}
  {onPopState}
  onUndo={showBoard ? () => scrub(cursor - 1, frameAnnounce) : undefined}
  onRedo={showBoard ? () => scrub(cursor + 1, frameAnnounce) : undefined}
  onReset={() => reset(frameAnnounce)}
>
  {#snippet figure(api)}
    {@const _announceCaptured = captureAnnounce(api.announce)}
    <div class="garden" data-announce-ready={_announceCaptured}>
      <GardenGraph
        {layout}
        {vertices}
        edges={shownEdges}
        {labelled}
        hydrated={api.hydrated}
        name="Garden of {found} positions"
        onJump={(k) => jump(k, api.announce)}
        onPoint={point}
        onFocusChange={(k) => (focusedVertex = k)}
      />
      <div class="readout">
        <p class="counter">
          Found so far: <span class="numeral" data-out="found">{found}</span>
          <span class="sep">/</span>
          Total: <span class="numeral" data-out="total">{total}</span>
        </p>
        <p class="message">
          {#if message}
            <span data-out="stopMessage">{message}</span>
            {#if verdict !== null}<span data-out="verdict">{verdict}</span>{/if}
          {:else if growth === 'explore'}
            <span data-out="layersGrown">{layersGrownText(layersGrown)}</span>
          {/if}
        </p>
      </div>
      <LayerChart layers={chart} />
      {#if showBoard}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="own-board" onkeydown={(event) => onBoardKeydown(event, api.announce)}>
          <Board
            board={gb}
            values={show(current)}
            game={boardGame}
            canAct={current.map(() => true)}
            onAct={(k) => act(k, api.announce)}
            name="Board {boardName}, {coords === 'numbers' ? 'Numbers' : 'Populations'} view"
          />
          <div class="strip" data-out="strip" role="group" aria-label="Past positions">
            {#if allMoves.length + 1 > 50}
              <input
                type="range"
                min="0"
                max={allMoves.length}
                step="1"
                value={cursor}
                disabled={!api.hydrated}
                data-control="scrub"
                aria-label="Position in the history"
                oninput={(event) => scrub(Number((event.currentTarget as HTMLInputElement).value), api.announce)}
              />
              <span class="numeral">{cursor} of {allMoves.length}</span>
            {:else}
              {#each positions as p, k (k)}
                <button
                  type="button"
                  class="step numeral"
                  class:current={k === cursor}
                  disabled={!api.hydrated}
                  data-control="scrub"
                  data-step={k}
                  aria-current={k === cursor ? 'step' : undefined}
                  aria-label={k === 0 ? `Start: ${speakList(show(p))}` : `After move ${k}: ${speakList(show(p))}`}
                  onclick={() => scrub(k, api.announce)}>{k}</button
                >
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet controls(api)}
    <button type="button" class="control" data-control="grow" disabled={!growable} onclick={() => growLayer(api.announce)}>Grow one layer</button>
    <button type="button" class="control" data-control="showTotal" disabled={totalShown} onclick={() => revealTotal(api.announce)}>Show total</button>
    <button
      type="button"
      class="control"
      data-control="growth"
      aria-pressed={growth === 'follow'}
      onclick={() => setGrowth(growth === 'follow' ? 'explore' : 'follow', api.announce)}>Follow the board</button
    >
    <button
      type="button"
      class="control"
      data-control="grows"
      aria-pressed={grows === 'orbit'}
      disabled={coords === 'numbers'}
      onclick={() => setGrows(grows === 'roots' ? 'orbit' : 'roots', api.announce)}>Orbit of the start</button
    >
    <button
      type="button"
      class="control"
      data-control="positiveOnly"
      aria-pressed={usePositive}
      disabled={grows !== 'roots' || growth !== 'explore'}
      onclick={() => (positiveOnly = !positiveOnly)}>Positive roots only</button
    >
    <button type="button" class="control" data-control="vertexLabels" aria-pressed={labelsOn} onclick={() => (labelsOn = !labelsOn)}>Vertex labels</button>
    <label class="picker">
      Board
      <select
        class="control"
        data-control="picker"
        value={typeof boardSpec === 'string' ? boardSpec : ''}
        onchange={(event) => pick((event.currentTarget as HTMLSelectElement).value, api.announce)}
      >
        {#if typeof boardSpec !== 'string' || !groups.some((g) => g.names.includes(boardSpec as string))}
          <option value="" disabled>{typeof boardSpec === 'string' ? boardSpec : 'Custom board'}</option>
        {/if}
        {#each groups as g (g.letter)}
          <optgroup label={g.letter}>
            {#each g.names as name (name)}
              <option value={name}>{name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
  {/snippet}

  {#snippet table(api)}
    <table>
      <caption>Positions found ({found}), with the shortest word from a seed</caption>
      <thead><tr><th scope="col">Layer</th><th scope="col">Position</th><th scope="col">Word</th><th scope="col">Jump</th></tr></thead>
      <tbody>
        {#each entries as e, k (keys[k])}
          <tr data-out="tableRow" data-position={e.join(',')} data-layer={view.layer[k]}>
            <td class="numeral">{view.layer[k]}</td>
            <td class="numeral">{exactText(e)}</td>
            <td class="numeral">{view.jumpRef[k] ? jumpTo(viewBoard, view.jumpRef[k]!.graph, view.jumpRef[k]!.index).moves.join(' ') : ''}</td>
            <td><button type="button" data-control="jumpRow" disabled={view.jumpRef[k] === null} onclick={() => jump(k, api.announce)}>Jump</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <table>
      <caption>New positions per layer</caption>
      <thead><tr><th scope="col">Layer</th><th scope="col">New</th></tr></thead>
      <tbody>
        {#each chart as c (c.layer)}
          <tr data-out="chartRow" data-layer={c.layer} data-count={c.count}><td class="numeral">{c.layer}</td><td class="numeral">{c.count}{c.complete ? '' : ' (incomplete)'}</td></tr>
        {/each}
      </tbody>
    </table>
    {#if showBoard}
      <table>
        <caption>The board, {coords === 'numbers' ? 'numbers' : 'populations'}</caption>
        <thead><tr><th scope="col">{coords === 'numbers' ? 'Node' : 'City'}</th><th scope="col">Value</th></tr></thead>
        <tbody>
          {#each show(current) as value, k (k)}
            <tr>
              <td><button type="button" data-table-node={gb.labels[k]} onclick={() => act(k, api.announce)}>{coords === 'numbers' ? 'Fire' : 'Mutate'} {gb.labels[k]}</button></td>
              <td class="numeral">{exactText([value])}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/snippet}
</ToolFrame>

<style>
  .garden {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .readout {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    align-items: baseline;
  }
  .readout p {
    margin: 0;
    min-height: 24px;
  }
  .numeral {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
  .own-board {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .strip {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    overflow-x: auto;
    padding: 4px;
  }
  .step {
    flex: 0 0 auto;
    min-width: 36px;
    height: 36px;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
  .step.current {
    border: 2px solid var(--text);
    font-weight: bold;
  }
  .step:focus-visible,
  .control:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .control {
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
  }
  .control[aria-pressed='true'] {
    border-width: 3px;
    font-weight: bold;
  }
  .picker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  table {
    border-collapse: collapse;
    margin: 8px 0;
  }
  th,
  td {
    padding: 2px 8px;
    text-align: left;
  }
  td button {
    min-height: 24px;
  }
</style>
