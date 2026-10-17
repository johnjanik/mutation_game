<script lang="ts">
  // T8, the Weyl Explorer (SPEC.md 4 T8; 2.6; 2.7 F5, F12; 4.0; 7.4; 7.5). Owner P3-A6. The graph of all
  // positions reached from all ones by legal play, in layers by the number of moves (t08/graph.ts, one
  // orbitGraph call per board, cached); the reader's game as a path in it, played on T8's own board
  // (Board.svelte in the numbers view, legal play, step and play to the end) or on a linked Game Board
  // (`linkTo`, followed through state.ts's followToolState); the details of the vertex hovered or
  // focused (position, a shortest word, the separating roots); the counter (countCompleteGames); the
  // heap view (heap, commutationClassSize). Above 192 elements the graph is a canvas after hydration,
  // with the SVG snapshot of the same scene rendered at build time (7.4). Every number comes from the
  // engine; nothing is computed by hand here. Positions inside, labels outside (E-7).
  //
  // Properties (CONTRACTS 5.2; listed in site/tests/e2e/T08.spec.ts): id, board, coords, start, moves,
  // linkTo, prediction, preset ('default' | 'counter' | 'heap'), caption, layers (accepted and ignored:
  // every board T8 offers is finite, 4.0 "Growth off the finite types" names T2 and T4 only), and the
  // plan properties boardChoices (limits the picker), plays (lists of labels offered as buttons that
  // load them), panel ('graph' | 'counter' | 'heap', the panel shown first).
  import { untrack } from 'svelte';
  import { toPositions } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import { historyNames } from '../board/historyNames';
  import Predict from '../board/Predict.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { decodeState, LINK_NOTICE } from '../../lib/urlCodec';
  import { exampleLoaded } from '../../lib/history';
  import { followToolState, integerOut, publishToolState, type BoardSpec, type ToolState } from '../../lib/state';
  import { highlight } from '../../lib/highlight';
  import { speak } from '../../lib/a11y';
  import type { Prediction } from '../../tools/types';
  import { T1Game } from './t01/model';
  import { gameOverSentence, moveSentence, playSentence, refusalSentence, spokenValue, undoSentence } from './t01/announce';
  import { countText, inLabelOrder, minus, offeredBoards, pathOf, vertexDetails, wordOfVertex } from './t08/graph';
  import { boardView, isPrepared, prepareBoard } from './t08/cache';
  import { buildScene } from './t08/layout';
  import { sceneToSvg } from './t08/svgScene';
  import { heapData } from './t08/heapView';
  import { PANELS, pickerGroups, presetOf, weylState, type WeylPanel } from './t08/presets';
  import { LINK_FOLLOWING, LINK_OUTSIDE, admitLink, followedGame } from './t08/link';
  import WeylGraph from './t08/WeylGraph.svelte';
  import VertexDetails from './t08/VertexDetails.svelte';
  import HeapView from './t08/HeapView.svelte';

  interface Props {
    id?: string;
    board?: BoardSpec;
    coords?: 'populations' | 'numbers';
    start?: (number | string)[];
    moves?: number[];
    caption?: string;
    preset?: string;
    prediction?: Prediction;
    linkTo?: string;
    layers?: number;
    /** Plan: the boards the picker offers (default: the fourteen T8 offers). */
    boardChoices?: string[];
    /** Plan: plays (labels) offered as buttons; loading one uses pushState (7.4). */
    plays?: number[][];
    /** Plan: the panel shown first. */
    panel?: WeylPanel;
  }

  let props: Props = $props();

  const OFFERED = offeredBoards();
  const instanceId = untrack(() => props.id ?? '');
  const linkTo = untrack(() => props.linkTo);

  // The configuration, read once (a page does not change its properties).
  const config = untrack(() => {
    const preset = presetOf(props.preset);
    const presetBoard = preset.state.board as string;
    const boardName = props.board ?? presetBoard;
    if (typeof boardName !== 'string' || !OFFERED.includes(boardName)) {
      throw new Error(`T8 instance "${instanceId || 'weyl'}": the Weyl Explorer does not offer the board ${JSON.stringify(boardName)} (SPEC 4 T8: ${OFFERED.join(', ')})`);
    }
    if (props.coords !== undefined && props.coords !== 'numbers') {
      throw new Error(`T8 instance "${instanceId || 'weyl'}": the graph is of numbers from all ones; coords must be numbers`);
    }
    if (props.start !== undefined && !props.start.every((x) => String(x) === '1')) {
      throw new Error(`T8 instance "${instanceId || 'weyl'}": the graph starts from all ones; another start has no place in it`);
    }
    const moves = props.moves ?? (boardName === presetBoard ? [...(preset.state.moves ?? [])] : []);
    return {
      board: boardName,
      moves,
      caption: props.caption ?? preset.caption,
      panel: props.panel ?? preset.options.panel,
      choices: props.boardChoices ?? preset.options.boardChoices,
      plays: props.plays ?? preset.options.plays ?? [],
      prediction: props.prediction,
    };
  });

  function makeGame(board: string, moves: readonly number[]): T1Game {
    const n = boardView(board).model.board.n;
    return new T1Game({ board, view: 'numbers', mode: 'legal', coords: 'numbers', start: Array.from({ length: n }, () => 1), moves: [...moves] });
  }

  const initial = makeGame(config.board, config.moves);
  const toState = (g: T1Game): ToolState => ({ ...g.state(), tool: 'weyl' });
  const defaults: ToolState = toState(initial);

  let game = $state.raw(initial);
  let version = $state(0);
  let notice = $state<string | null>(null);
  let panel = $state<WeylPanel>(untrack(() => config.panel));
  let inspect = $state<number | null>(null);
  let predictionResolved = $state(untrack(() => config.prediction === undefined));
  /** The last state the linked Game Board published, and whether it is a game in the graph. */
  let followed = $state.raw<ToolState | null>(null);
  let linkOk = $state(true);
  /** The board whose graph is being prepared after a pick or a link (a few short tasks), or null. */
  let preparing = $state<string | null>(null);

  const touch = (): void => {
    version++;
  };
  function cur(): T1Game {
    void version;
    return game;
  }

  const frozen = $derived(!predictionResolved);
  const boardName = $derived(cur().spec as string);
  const view = $derived(boardView(boardName));
  const model = $derived(view.model);
  const layout = $derived(view.layout);
  const toolState = $derived(toState(cur()));
  const shown = $derived(cur().shown);
  const canAct = $derived(frozen ? shown.numbers.map(() => false) : cur().canAct());
  const atEnd = $derived(cur().gameOver);
  const applied = $derived(cur().applied);

  // The path: the vertices of the positions of the play up to the cursor (7.4: kept in memory).
  const path = $derived.by(() => {
    const g = cur();
    if (linkTo !== undefined && !linkOk) return [];
    return pathOf(model, g.positions.slice(0, g.cursor + 1).map((p) => p.a));
  });
  const onPath = $derived(new Set(path.filter((k): k is number => k !== null)));
  const current = $derived(path.length === 0 ? null : (path[path.length - 1] ?? null));
  // Above 192 elements the edges at the focused vertex are drawn; at most 192 the scene ignores focus.
  const sceneFocus = $derived(model.edgeMode === 'all' ? null : inspect);
  const scene = $derived(buildScene(model, layout, path, sceneFocus));
  // At most 192 elements the SVG is the figure and follows every change at once. Above 192 it is the
  // snapshot under the canvas (the server render, the edge hooks that mirror the canvas, and what SVG
  // export takes); after hydration it is rewritten one task after the canvas is drawn, so that a pick
  // or a hover never adds the parsing of a large SVG to the task that draws (7.6).
  const inlineSvg = $derived(model.edgeMode === 'all' ? sceneToSvg(scene) : null);
  let snapshotSvg = $state(untrack(() => (model.edgeMode === 'all' ? '' : sceneToSvg(scene, { snapshot: true }))));
  $effect(() => {
    if (model.edgeMode === 'all') return;
    const s = scene;
    const timer = setTimeout(() => {
      snapshotSvg = sceneToSvg(s, { snapshot: true });
    }, 0);
    return () => clearTimeout(timer);
  });
  const svg = $derived(inlineSvg ?? snapshotSvg);
  const detailsAt = $derived(inspect ?? current ?? 0);
  const details = $derived(vertexDetails(model, detailsAt));
  const heap = $derived(heapData(model.board, applied));
  const groups = $derived(pickerGroups(OFFERED, config.choices));
  const panelOrder = $derived([panel, ...PANELS.filter((p) => p !== panel)]);
  // The page's highlight (7.4), read as $highlight: a position on this board that another tool points
  // at is marked on its vertex (entries arrive in label order).
  const highlighted = $derived.by(() => {
    const h = $highlight;
    if (h === null || h.kind !== 'position' || h.board !== boardName || !Array.isArray(h.value) || h.value.length !== model.board.n) return null;
    const order = [...model.board.labels].sort((a, b) => a - b);
    const v: number[] = new Array(model.board.n);
    toPositions(model.board, order).forEach((p, j) => {
      v[p] = (h.value as number[])[j]!;
    });
    return model.index.get(v.join(',')) ?? null;
  });
  const linkStatus = $derived(linkTo === undefined ? null : linkOk ? LINK_FOLLOWING : LINK_OUTSIDE);

  const positionTexts = new Map<string, string>();
  function positionText(k: number): string {
    const key = `${boardName}#${k}`;
    let t = positionTexts.get(key);
    if (t === undefined) {
      t = inLabelOrder(model.board, model.graph.items[k]!).join(',');
      positionTexts.set(key, t);
    }
    return t;
  }
  function vertexName(k: number): string {
    const entries = positionText(k).split(',').map((x) => speak(x)).join(', ');
    return `Position ${entries}, layer ${model.graph.depth[k]}${onPath.has(k) ? ', on the game' : ''}`;
  }
  const spokenPosition = (texts: readonly string[]): string => texts.map(spokenValue).join(', ');

  const figureLabel = $derived(`Weyl Explorer on ${boardName}: ${scene.label}`);
  const layerSentence = $derived(
    model.limit === null
      ? `${model.found} positions in ${model.layerSizes.length} layers`
      : `${model.limit}`,
  );

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a picker, a play, a jump, the linked board)
  // ------------------------------------------------------------------------------------------

  function load(board: string, moves: readonly number[]): void {
    game = makeGame(board, moves);
    inspect = null;
    touch();
  }

  async function loadLink(decoded: ToolState, n: string | null): Promise<void> {
    const admitted = n === null ? admitLink(decoded, OFFERED) : null;
    if (n !== null || admitted === null) {
      notice = n ?? LINK_NOTICE;
      load(defaults.board as string, defaults.moves ?? []);
      return;
    }
    notice = null;
    if (admitted.board === boardName && admitted.moves.join('.') === applied.join('.')) return;
    if (!isPrepared(admitted.board)) {
      preparing = admitted.board;
      await prepareBoard(admitted.board);
      if (preparing !== admitted.board) return;
      preparing = null;
    }
    load(admitted.board, admitted.moves);
  }

  // Hydration: read the URL once with the instance prefix (6.6). Never a move by itself (4.0).
  $effect(() => {
    untrack(() => {
      try {
        const { state: decoded, notice: n } = decodeState(window.location.search, 'weyl', defaults, { prefix: instanceId });
        void loadLink(decoded, n);
      } catch {
        // decodeState never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  // The linked Game Board (7.4): its state drives T8's path when it is a legal game from all ones.
  $effect(() => {
    if (linkTo === undefined) return;
    return followToolState(linkTo, (s) => {
      followed = s;
      const g = followedGame(s, OFFERED);
      if (g === null) {
        linkOk = false;
        return;
      }
      linkOk = true;
      if (g.board !== game.spec || g.moves.join('.') !== game.applied.join('.')) load(g.board, g.moves);
    });
  });

  // ------------------------------------------------------------------------------------------
  // Actions on T8's own board
  // ------------------------------------------------------------------------------------------

  function act(position: number, announce: (t: string) => void): void {
    if (frozen) return;
    const before = game.shown;
    const r = game.act(position);
    if (r.kind === 'refused') {
      announce(refusalSentence('legal', r.label, r.number));
      return;
    }
    touch();
    let text = moveSentence('numbers', game.labels, r.label, before, game.shown, game.cursor);
    if (game.gameOver) text += ` ${gameOverSentence(game.cursor)}`;
    announce(text);
  }

  function step(announce: (t: string) => void): void {
    if (frozen) return;
    const k = game.stepPosition();
    if (k !== null) act(k, announce);
  }

  function playToEnd(announce: (t: string) => void): void {
    if (frozen || atEnd) return;
    // At most N moves (24 on F4): one play call on the main thread (E-9 rule 2).
    const outcome = game.playToEnd();
    touch();
    announce(playSentence('numbers', 'legal', game.labels, outcome.moves, outcome.status, game.shown));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen) return;
    const from = game.cursor;
    if (!game.scrub(to)) return;
    touch();
    if (to < from) announce(undoSentence('numbers', game.labels, to + 1, game.shownAt(to)));
    else announce(moveSentence('numbers', game.labels, game.moves[to - 1]!, game.shownAt(to - 1), game.shownAt(to), to));
  }

  const undo = (announce: (t: string) => void): void => scrub(game.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(game.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    if (frozen) return;
    const from = game.cursor;
    if (!game.reset()) return;
    touch();
    if (from > 0) announce(undoSentence('numbers', game.labels, 1, game.shownAt(0)));
  }

  function onKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo(announce);
    else redo(announce);
  }

  // ------------------------------------------------------------------------------------------
  // Jumps, plays, picker, highlight
  // ------------------------------------------------------------------------------------------

  /** Activating a vertex: the moves become its shortest word (plan, as T2's jump). */
  function jump(k: number, announce: (t: string) => void): void {
    if (frozen) return;
    const word = wordOfVertex(model, k);
    const sentence = `Jumped to position ${spokenPosition(positionText(k).split(','))} by ${word.length} ${word.length === 1 ? 'move' : 'moves'}.`;
    if (linkTo !== undefined) {
      if (followed !== null && linkOk) publishToolState(linkTo, { ...followed, moves: word });
      announce(sentence);
      return;
    }
    load(boardName, word);
    announce(sentence);
  }

  function loadPlay(play: readonly number[], announce: (t: string) => void): void {
    if (frozen) return;
    if (linkTo !== undefined) {
      if (followed !== null && linkOk) publishToolState(linkTo, { ...followed, moves: [...play] });
    } else {
      load(boardName, play);
      exampleLoaded(instanceId, toState(game));
    }
    const h = heapData(model.board, play);
    announce(`Loaded the play ${play.join(', ')}. Plays with this stack: ${h.count.toString()}.`);
  }

  /** A picker change (4.0): start and moves go back to the defaults; the graph is prepared in short tasks (7.6). */
  async function pickBoard(name: string, announce: (t: string) => void): Promise<void> {
    if (!OFFERED.includes(name)) return;
    notice = null;
    preparing = name;
    const v = await prepareBoard(name);
    if (preparing !== name) return; // another pick came meanwhile
    preparing = null;
    load(name, []);
    announce(`Board ${name}: ${v.model.found} positions in ${v.model.layerSizes.length} layers.`);
  }

  function onInspect(k: number | null): void {
    inspect = k;
    if (k === null) {
      highlight.set(null);
      return;
    }
    highlight.set({ kind: 'position', board: boardName, value: positionText(k).split(',').map(Number) });
  }

  function onRootPoint(root: string[] | null): void {
    highlight.set(root === null ? null : { kind: 'root', board: boardName, value: root.map(Number) });
  }

  // ------------------------------------------------------------------------------------------
  // Export and table data
  // ------------------------------------------------------------------------------------------

  // Only the names History reads: a move names at most 50 positions however long the play (7.4).
  const positionNames = $derived.by(() => {
    const g = cur();
    return historyNames(g.moves.length, g.cursor, (k) => `${k === 0 ? 'Start' : `After move ${k}`}: numbers ${spokenPosition(inLabelOrder(g.board, g.shownAt(k).numbers))}`);
  });

  /** The vertices listed in the table: every vertex up to 192 elements; above, the path and the focused vertex (plan). */
  const tableVertices = $derived.by(() => {
    if (model.edgeMode === 'all') return model.drawn;
    const ks = new Set<number>();
    for (const k of path) if (k !== null) ks.add(k);
    if (inspect !== null) ks.add(inspect);
    return [...ks];
  });

  function exportData(): Record<string, unknown> {
    return {
      layerSizes: [...model.layerSizes],
      groupOrder: model.found,
      limit: model.limit,
      edgeMode: model.edgeMode,
      path: {
        word: [...applied],
        positions: path.map((k) => (k === null ? null : positionText(k).split(',').map((x) => integerOut(x)))),
      },
      vertex: {
        layer: details.layer,
        position: details.position.map((x) => integerOut(x)),
        word: details.word,
        separatingRoots: details.roots.map((r) => r.map((x) => integerOut(x))),
      },
      gameCount: view.games === null ? null : integerOut(view.games),
      pathCount: view.paths === null ? null : integerOut(view.paths),
      heap: heap.bricks.map((b) => ({ node: b.label, level: b.level })),
      heapCount: integerOut(heap.count),
    };
  }

  const labelsInOrder = $derived([...model.board.labels].sort((a, b) => a - b));
  const numsInOrder = $derived(inLabelOrder(model.board, shown.numbers));
  const canActInOrder = $derived(toPositions(model.board, labelsInOrder).map((p) => canAct[p] ?? false));
</script>

{#snippet graphPanel(api: FrameApi)}
  <section class="panel" data-panel="graph" aria-label="Graph of positions">
    <p class="line">
      <span class="numeral" data-out="groupOrder">{model.found}</span> positions in
      <span class="numeral">{model.layerSizes.length}</span> layers; edges drawn:
      <span data-out="edgeMode">{model.edgeMode}</span>{model.edgeMode === 'all' ? ' (every legal move)' : ' (along the game and at the focused vertex)'}.
    </p>
    {#if model.limit !== null}
      <p class="line" data-out="limit">{model.limit}</p>
    {/if}
    {#if preparing !== null}
      <p class="line" data-preparing={preparing}>Preparing the graph of {preparing}.</p>
    {/if}
    <ol class="layers numeral" data-out="layerSizes" aria-label="Positions per layer">
      {#each model.layerSizes as count, layer (layer)}
        <li data-layer={layer} data-count={count}><span class="layer-name">layer {layer}:</span> {count}</li>
      {/each}
    </ol>
    <WeylGraph
      {model}
      {layout}
      {scene}
      {svg}
      {positionText}
      {vertexName}
      {onPath}
      {current}
      {highlighted}
      hydrated={api.hydrated}
      disabled={frozen}
      name="Positions of {boardName}, {layerSentence}"
      onJump={(k) => jump(k, api.announce)}
      {onInspect}
    />
    <VertexDetails {details} pointed={inspect !== null} {onRootPoint} />
  </section>
{/snippet}

{#snippet counterPanel()}
  <section class="panel" data-panel="counter" aria-label="Counter">
    <p class="line">
      Complete games from all ones on {boardName}, the paths from top to bottom:
      <span class="numeral count" data-out="gameCount">{countText(view.games)}</span>
    </p>
    {#if view.paths !== null}
      <p class="line">
        Paths from the top vertex to the bottom vertex counted along the edges of the graph:
        <span class="numeral" data-out="pathCount">{view.paths.toString()}</span>
      </p>
    {/if}
  </section>
{/snippet}

{#snippet heapPanel()}
  <section class="panel" data-panel="heap" aria-label="Heap view">
    <p class="line">The current play as a stack of bricks{applied.length === 0 ? ' (no moves yet)' : `: ${applied.join(', ')}`}.</p>
    <HeapView {heap} name={boardName} />
  </section>
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t08" data-board-name={boardName} onkeydown={(e) => onKeydown(e, api.announce)}>
    {#if config.prediction}
      <Predict prediction={config.prediction} hydrated={api.hydrated} labels={labelsInOrder} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    {#if linkStatus !== null}
      <p class="line" data-out="linkStatus" data-linked={linkOk ? 'true' : 'false'}>{linkStatus}</p>
    {:else}
      <Board
        board={model.board}
        values={shown.numbers}
        game="firing"
        {canAct}
        name="Numbers game on {boardName}, legal play"
        disabled={frozen}
        onAct={(k) => act(k, api.announce)}
      />
      <History
        total={cur().moves.length}
        cursor={cur().cursor}
        {positionNames}
        hydrated={api.hydrated}
        {frozen}
        onUndo={() => undo(api.announce)}
        onRedo={() => redo(api.announce)}
        onReset={() => reset(api.announce)}
        onScrub={(to) => scrub(to, api.announce)}
      />
    {/if}
    {#each panelOrder as p (p)}
      {#if p === 'graph'}
        {@render graphPanel(api)}
      {:else if p === 'counter'}
        {@render counterPanel()}
      {:else}
        {@render heapPanel()}
      {/if}
    {/each}
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  {#if linkTo === undefined}
    <button type="button" class="control" data-control="step" disabled={!api.hydrated || frozen || atEnd} onclick={() => step(api.announce)}>Step</button>
    <button type="button" class="control" data-control="playToEnd" disabled={!api.hydrated || frozen || atEnd} onclick={() => playToEnd(api.announce)}>Play to the end</button>
    <label class="setting">
      <span>Board</span>
      <select data-control="picker" disabled={!api.hydrated || frozen} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value, api.announce)}>
        {#if !groups.some((g) => g.names.includes(boardName))}
          <option value="" selected disabled>{boardName}</option>
        {/if}
        {#each groups as g (g.letter)}
          <optgroup label="Type {g.letter}" data-letter={g.letter}>
            {#each g.names as name (name)}
              <option value={name} selected={boardName === name}>{name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
  {/if}
  {#each config.plays as play (play.join(','))}
    <button type="button" class="control" data-control="loadPlay" data-play={play.join(',')} disabled={!api.hydrated || frozen} onclick={() => loadPlay(play, api.announce)}>Play {play.join(', ')}</button>
  {/each}
  <label class="setting">
    <span>First</span>
    <select data-control="panel" disabled={!api.hydrated} onchange={(e) => (panel = (e.currentTarget as HTMLSelectElement).value as WeylPanel)}>
      {#each PANELS as p (p)}
        <option value={p} selected={panel === p}>{p === 'graph' ? 'graph' : p === 'counter' ? 'counter' : 'heap view'}</option>
      {/each}
    </select>
  </label>
{/snippet}

{#snippet table(api: FrameApi)}
  {#if linkTo === undefined}
    <table class="values">
      <caption>Nodes of {boardName} after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
      <thead>
        <tr><th scope="col">Node</th><th scope="col">Number</th><th scope="col">Legal move</th></tr>
      </thead>
      <tbody>
        {#each labelsInOrder as l, j (l)}
          <tr data-row={l}>
            <th scope="row">
              <button
                type="button"
                class="cell"
                data-table-node={l}
                disabled={!api.hydrated || frozen}
                aria-label="Fire node {l}, value {spokenValue(numsInOrder[j]!)}, {canActInOrder[j] ? 'can be fired' : 'cannot be fired'}"
                onclick={() => act(toPositions(model.board, [l])[0]!, api.announce)}>Node {l}</button
              >
            </th>
            <td class="numeral" data-table-value="number">{minus(numsInOrder[j]!)}</td>
            <td>{canActInOrder[j] ? 'yes' : 'no'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  <table class="values" data-table="layers">
    <caption>Positions per layer ({layerSentence})</caption>
    <thead><tr><th scope="col">Layer</th><th scope="col">Positions</th></tr></thead>
    <tbody>
      {#each model.layerSizes as count, layer (layer)}
        <tr data-table-layer={layer}><th scope="row">{layer}</th><td class="numeral" data-table-count={count}>{count}</td></tr>
      {/each}
    </tbody>
  </table>
  <table class="values" data-table="vertices">
    <caption>
      {model.edgeMode === 'all' ? 'Every position' : 'The positions of the game and the focused position'}; complete games: {countText(view.games)}{view.paths === null ? '' : `; paths from top to bottom: ${view.paths.toString()}`}
    </caption>
    <thead>
      <tr><th scope="col">Layer</th><th scope="col">Position</th><th scope="col">Shortest play</th><th scope="col">Mirrors crossed</th><th scope="col">Jump</th></tr>
    </thead>
    <tbody>
      {#each tableVertices as k (k)}
        {@const d = vertexDetails(model, k)}
        <tr data-table-vertex={positionText(k)} data-layer={d.layer}>
          <td class="numeral">{d.layer}</td>
          <td class="numeral">({d.position.map(minus).join(', ')})</td>
          <td class="numeral">{d.word.length === 0 ? 'none' : d.word.join(', ')}</td>
          <td class="numeral">{d.roots.length}</td>
          <td>
            <button type="button" class="cell" data-control="jumpRow" data-position={positionText(k)} disabled={!api.hydrated || frozen} onclick={() => jump(k, api.announce)}
              >Jump</button
            >
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <table class="values" data-table="heap">
    <caption>Bricks of the stack; plays with this stack: {heap.count.toString()}</caption>
    <thead><tr><th scope="col">Move</th><th scope="col">Node</th><th scope="col">Level</th></tr></thead>
    <tbody>
      {#each heap.bricks as b (b.move)}
        <tr><td class="numeral">{b.move + 1}</td><td class="numeral">{b.label}</td><td class="numeral">{b.level}</td></tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<ToolFrame
  toolId="weyl"
  {instanceId}
  title="Weyl Explorer"
  caption={config.caption}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  boardName={boardName}
  derivedForExport={exportData}
  onPopState={(s, n) => void loadLink(s, n)}
  {figure}
  {controls}
  {table}
/>

<style>
  .t08 {
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  .panel {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
  .count {
    font-weight: bold;
  }
  .layers {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .layer-name {
    color: var(--text);
  }
  .control {
    min-width: 44px;
    height: 44px;
    padding: 0 12px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
    cursor: pointer;
  }
  .control:disabled {
    cursor: default;
  }
  .control:focus-visible,
  .cell:focus-visible,
  select:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .setting {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  select {
    min-height: 44px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
  }
  .values {
    border-collapse: collapse;
    margin-bottom: 8px;
  }
  .values th,
  .values td {
    padding: 2px 6px;
    text-align: center;
  }
  .cell {
    min-width: 44px;
    min-height: 44px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
</style>
