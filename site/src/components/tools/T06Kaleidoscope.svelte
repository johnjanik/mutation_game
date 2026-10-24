<script lang="ts">
  // T6, the Kaleidoscope (SPEC.md 4 T6, 2.4, 2.5, 2.14, 4.0, 7.3 to 7.5). For the rank 2 boards A2, B2,
  // C2, G2: the plane with the two mirrors, the simple roots drawn as the mirror normals (the columns of
  // choleskyBasis), the chambers, and one point. The point is a position a of the numbers game: its
  // numbers are drawn as scaled distances to the mirrors (2.4(d)) and its population p = C^{-1} a as the
  // parallelogram along the normals and as exact fractions. Firing a node reflects the point. Built on
  // P1-A2's ToolFrame and the Board family; every value comes from the engine through t06/model.ts, and
  // the default state is computed synchronously so that the server render writes it (7.4, E-9). T6
  // never calls the worker.
  //
  // Properties (CONTRACTS 5.2; every name is listed in site/tests/e2e/T06.spec.ts): id, board, coords,
  // start, moves, caption, preset (only 'default'), prediction, linkTo and layers (accepted and ignored:
  // no placement links T6 and it grows no set), and the plan properties
  //   overlays: ('roots' | 'orbit' | 'lattices')[]   the overlays switched on at first (default [])
  //   boardChoices: string[]                           limits the picker (default A2, B2, C2, G2)
  import { untrack } from 'svelte';
  import { toLabels } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import { historyNames } from '../board/historyNames';
  import Predict from '../board/Predict.svelte';
  import Frac from '../math/Frac.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { announceTemplates } from '../../lib/a11y';
  import { highlight } from '../../lib/highlight';
  import { decodeState, encodeState, LINK_NOTICE } from '../../lib/urlCodec';
  import type { BoardSpec, ToolState } from '../../lib/state';
  import type { Prediction } from '../../tools/types';
  import T06 from '../../tools/registry/T06';
  import Plane from './t06/Plane.svelte';
  import {
    MirrorGame,
    OVERLAYS,
    OVERLAY_NAMES,
    T06_BOARDS,
    admitLink,
    altText,
    boardSentence,
    byPosition,
    equation,
    exportDerived,
    interactive,
    isT06Board,
    latticeDots,
    orbitPoints,
    overlaySentence,
    placed,
    placementSentence,
    shownValue,
    snap,
    spoken,
    stepped,
    type MirrorConfig,
    type Overlay,
    type T06Board,
    type Vec2,
  } from './t06/model';

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
    /** Plan: the overlays switched on at first (M2 beat 4 passes ['roots']). */
    overlays?: Overlay[];
    /** Plan: the boards the picker offers (default: the four of SPEC 4 T6). */
    boardChoices?: string[];
  }

  let {
    id = '',
    board: boardProp,
    coords: coordsProp,
    start: startProp,
    moves: movesProp,
    caption: captionProp,
    preset = 'default',
    prediction,
    overlays: overlaysProp = [],
    boardChoices,
  }: Props = $props();

  const instanceId = untrack(() => id);
  const presetFields = untrack(() => (T06.presets as Record<string, (typeof T06.presets)['default']>)[preset] ?? T06.presets.default);
  const caption = untrack(() => captionProp ?? presetFields.caption);
  const choices: T06Board[] = untrack(() => (boardChoices ?? [...T06_BOARDS]).filter(isT06Board));

  // The author's configuration, read once (a populations start is placed at a = Cp, as a c=p link is).
  const authorConfig: MirrorConfig = untrack(() => {
    const s: ToolState = {
      schema: 1,
      tool: 'mirror',
      board: boardProp ?? presetFields.board ?? 'A2',
      coords: coordsProp ?? presetFields.coords ?? 'numbers',
      start: startProp ?? presetFields.start ?? [1, 1],
      moves: movesProp ?? presetFields.moves ?? [],
    };
    const c = admitLink(s);
    if (c === null) throw new Error(`T6 instance "${instanceId || 'mirror'}": the board ${JSON.stringify(s.board)} is not one of A2, B2, C2, G2`);
    return c;
  });

  const initialGame = new MirrorGame(authorConfig);
  const defaults: ToolState = initialGame.state();

  let game = $state.raw(initialGame);
  let version = $state(0);
  let notice = $state<string | null>(null);
  let shownOverlays = $state<Overlay[]>(untrack(() => OVERLAYS.filter((o) => overlaysProp.includes(o))));
  let predictionResolved = $state(untrack(() => prediction === undefined));
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  const touch = (): void => {
    version++;
  };
  function cur(): MirrorGame {
    void version;
    return game;
  }

  const active = $derived(interactive({ hydrated, prediction: prediction !== undefined, resolved: predictionResolved }));
  const g = $derived(cur().geo);
  const r = $derived(cur().readout);
  const name = $derived(cur().name);
  const toolState = $derived(cur().state());
  const eq = $derived(equation(g, r));
  const numbersShown = $derived(r.numbers.map(shownValue));
  const orbit = $derived(shownOverlays.includes('orbit') ? orbitPoints(g, cur().current) : null);
  const dots = $derived(shownOverlays.includes('lattices') ? latticeDots(g) : null);
  const alt = $derived(altText(name, r, shownOverlays));
  const marked = $derived.by(() => {
    const h = $highlight;
    if (h === null || h.kind !== 'root' || h.board !== name || !Array.isArray(h.value)) return null;
    return h.value.join(',');
  });
  // Only the names History reads: a move names at most 50 positions however long the play (7.4).
  const positionNames = $derived.by(() => {
    const gm = cur();
    return historyNames(gm.moves.length, gm.cursor, (k) => `${k === 0 ? 'Start' : `After move ${k}`}: numbers ${gm.readoutAt(k).numbers.map(spoken).join(', ')}`);
  });

  /** Exact digits in the tooltip of a long number (4.0 Long numbers), by position. */
  const tooltip = (k: number): string | null => {
    const v = byPosition(g, r.numbers)[k]!;
    return shownValue(v) === v.replace(/^-/, '−') ? null : v;
  };

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, the picker, a placement)
  // ------------------------------------------------------------------------------------------

  function load(c: MirrorConfig): void {
    game = new MirrorGame(c);
    touch();
  }

  function loadLink(decoded: ToolState, n: string | null): void {
    let c: MirrorConfig | null = null;
    try {
      c = admitLink(decoded);
      if (c !== null) new MirrorGame(c);
    } catch {
      c = null;
    }
    if (c === null) {
      notice = LINK_NOTICE;
      load(admitLink(defaults)!);
      return;
    }
    notice = n;
    const next = new MirrorGame(c);
    if (encodeState(next.state()) !== encodeState(game.state())) {
      game = next;
      touch();
    }
  }

  // Hydration: read the URL once with the instance prefix (6.6). Never a move by itself (4.0).
  $effect(() => {
    untrack(() => {
      try {
        const { state: decoded, notice: n } = decodeState(window.location.search, 'mirror', defaults, { prefix: instanceId });
        loadLink(decoded, n);
      } catch {
        // decodeState never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------

  function fireNode(position: number, announce: (t: string) => void): void {
    if (!active) return;
    const label = toLabels(g.board, [position])[0]!;
    const move = game.fire(label);
    touch();
    announce(announceTemplates.fired(label, game.readout.numbers, move));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (!active) return;
    const from = game.cursor;
    if (!game.scrub(to)) return;
    touch();
    const now = game.readout.numbers;
    if (to < from) announce(announceTemplates.undid(to + 1, now));
    else announce(announceTemplates.fired(game.moves[to - 1]!, now, to));
  }

  const undo = (announce: (t: string) => void): void => scrub(game.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(game.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    if (!active) return;
    const from = game.cursor;
    if (!game.reset()) return;
    touch();
    if (from > 0) announce(announceTemplates.undid(1, game.readout.numbers));
  }

  function onKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo(announce);
    else redo(announce);
  }

  /** Every placement path (buttons, keys, drag) ends here: start set, moves emptied, one sentence. */
  function place(c: MirrorConfig, announce: (t: string) => void): void {
    if (!active) return;
    notice = null;
    load(c);
    announce(placementSentence(game.readout));
  }

  const step = (k: number, delta: 1 | -1, announce: (t: string) => void): void => place(stepped(game, k, delta), announce);
  const drop = (y: Vec2, announce: (t: string) => void): void => place(placed(game.name, snap(g, y)), announce);

  function pickBoard(value: string, announce: (t: string) => void): void {
    if (!active || !isT06Board(value)) return;
    notice = null;
    load({ board: value, start: [1, 1], moves: [] });
    announce(boardSentence(value, game.readout));
  }

  function toggle(o: Overlay, on: boolean, announce: (t: string) => void): void {
    shownOverlays = OVERLAYS.filter((x) => (x === o ? on : shownOverlays.includes(x)));
    announce(overlaySentence(o, on));
  }

  const exportData = (): Record<string, unknown> => exportDerived(game, shownOverlays);

  const minus = (t: string): string => t.replace(/^-/, '−');
</script>

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t06" onkeydown={(e) => onKeydown(e, api.announce)}>
    {#if prediction}
      <Predict {prediction} hydrated={api.hydrated} labels={g.labels} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    <p class="line" data-out="boardName" data-name={name}>Board <span class="name">{name[0]}<sub>{name.slice(1)}</sub></span></p>
    <div class="plane-box">
      <Plane
        {g}
        {r}
        shown={numbersShown}
        roots={shownOverlays.includes('roots')}
        {orbit}
        {dots}
        {marked}
        {alt}
        {active}
        onStep={(k, d) => step(k, d, api.announce)}
        onDrop={(y) => drop(y, api.announce)}
      />
    </div>
    {#if r.offView}
      <p class="line off-view" data-out="offView">The point lies outside the drawn window; its numbers and its population are shown below.</p>
    {/if}
    <!-- Each name starts with the button's visible text (WCAG 2.5.3 Label in Name; RT-FIX P4-RT-05-07). -->
    <div class="place" role="group" aria-label="Place the point">
      <button type="button" class="control" data-control="a1-minus" disabled={!active} aria-label="a1 − 1: move the point, number at node 1 minus 1" onclick={() => step(0, -1, api.announce)}
        ><i>a</i><sub>1</sub> − 1</button
      >
      <button type="button" class="control" data-control="a1-plus" disabled={!active} aria-label="a1 + 1: move the point, number at node 1 plus 1" onclick={() => step(0, 1, api.announce)}
        ><i>a</i><sub>1</sub> + 1</button
      >
      <button type="button" class="control" data-control="a2-minus" disabled={!active} aria-label="a2 − 1: move the point, number at node 2 minus 1" onclick={() => step(1, -1, api.announce)}
        ><i>a</i><sub>2</sub> − 1</button
      >
      <button type="button" class="control" data-control="a2-plus" disabled={!active} aria-label="a2 + 1: move the point, number at node 2 plus 1" onclick={() => step(1, 1, api.announce)}
        ><i>a</i><sub>2</sub> + 1</button
      >
    </div>
    <div class="readouts">
      <section class="panel numbers-panel" aria-label="Numbers">
        <p class="panel-title">Numbers: the scaled distances to the mirrors</p>
        <Board
          board={g.board}
          values={byPosition(g, r.numbers)}
          game="firing"
          canAct={[true, true]}
          states={['can be fired', 'can be fired']}
          spoken={byPosition(g, r.numbers).map(spoken)}
          disabled={!active}
          hintFor={tooltip}
          name="Numbers of the point on {name}: fire a node to reflect the point"
          onAct={(k) => fireNode(k, api.announce)}
        />
        <p class="line numeral" data-out="numbers" data-value={r.numbers.join(',')}>
          {#each numbersShown as v, k (k)}<span class="entry"><i>a</i><sub>{g.labels[k]}</sub> = {v}</span>{/each}
        </p>
      </section>
      <section class="panel population-panel" aria-label="Population">
        <p class="panel-title">Population: the coefficients along the normals</p>
        <p class="line numeral" data-out="population" data-value={r.population.join(',')}>
          {#each r.population as v, k (k)}<span class="entry"><i>p</i><sub>{g.labels[k]}</sub> = <Frac value={shownValue(v)} /></span>{/each}
        </p>
      </section>
    </div>
    <div class="equation" data-out="equation" role="group" aria-label={eq.words}>
      <span class="eq-name"><i>a</i> = <i>C</i><i>p</i>:</span>
      <span class="vec" aria-hidden="true">{#each eq.numbers as v, k (k)}<span>{shownValue(v)}</span>{/each}</span>
      <span aria-hidden="true">=</span>
      <table class="matrix">
        <caption>C</caption>
        <thead><tr><td></td>{#each g.labels as l (l)}<th scope="col">{l}</th>{/each}</tr></thead>
        <tbody>
          {#each eq.cartan as row, i (i)}
            <tr><th scope="row">{g.labels[i]}</th>{#each row as x, j (j)}<td>{minus(String(x))}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
      <span class="vec" aria-hidden="true">{#each eq.population as v, k (k)}<span><Frac value={shownValue(v)} /></span>{/each}</span>
    </div>
    <!-- SPEC 2.4(a) verbatim [D]: the bridge sentence wherever both views are shown together. -->
    <p class="line bridge" data-out="bridge">The number on node <i>i</i> is the amount by which a mutation would lower city <i>i</i>.</p>
    <History
      total={cur().moves.length}
      cursor={cur().cursor}
      {positionNames}
      hydrated={api.hydrated}
      frozen={!active}
      onUndo={() => undo(api.announce)}
      onRedo={() => redo(api.announce)}
      onReset={() => reset(api.announce)}
      onScrub={(to) => scrub(to, api.announce)}
    />
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  <label class="setting">
    <span>Board</span>
    <select data-control="picker" disabled={!active} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value, api.announce)}>
      {#each choices as b (b)}
        <option value={b} selected={name === b}>{b}</option>
      {/each}
    </select>
  </label>
  {#each OVERLAYS as o (o)}
    <label class="setting overlay">
      <input
        type="checkbox"
        data-control="overlay-{o}"
        disabled={!api.hydrated}
        checked={shownOverlays.includes(o)}
        onchange={(e) => toggle(o, (e.currentTarget as HTMLInputElement).checked, api.announce)}
      />
      <span>{OVERLAY_NAMES[o]}</span>
    </label>
  {/each}
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values">
    <caption>The point on {name} after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
    <thead>
      <tr>
        <th scope="col">Node</th>
        <th scope="col">Number</th>
        <th scope="col">Population</th>
      </tr>
    </thead>
    <tbody>
      {#each g.labels as l, k (l)}
        <tr data-row={l}>
          <th scope="row">
            <button
              type="button"
              class="cell"
              data-table-node={l}
              disabled={!api.hydrated || !active}
              aria-label="Fire node {l}, value {spoken(r.numbers[k]!)}"
              onclick={() => fireNode(g.order[k]!, api.announce)}>Node {l}</button
            >
          </th>
          <td class="numeral exact" data-table-value="number">{minus(r.numbers[k]!)}</td>
          <td class="numeral exact" data-table-value="population">{minus(r.population[k]!)}</td>
        </tr>
      {/each}
      <tr data-row="equation">
        <th scope="row">a = Cp</th>
        <td colspan="2" class="numeral exact" data-table-value="equation">
          ({r.numbers.map(minus).join(', ')}) = C ({r.population.map(minus).join(', ')}), C with rows {eq.cartan.map((row) => `(${row.map((x) => minus(String(x))).join(', ')})`).join(', ')}
        </td>
      </tr>
    </tbody>
  </table>
{/snippet}

<ToolFrame
  toolId="mirror"
  {instanceId}
  title="Kaleidoscope"
  {caption}
  state={toolState}
  {defaults}
  {notice}
  figureLabel={alt}
  boardName={name}
  derivedForExport={exportData}
  onPopState={(s, n) => loadLink(s, n)}
  {figure}
  {controls}
  {table}
/>

<style>
  .t06 {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .plane-box {
    width: 100%;
    max-width: 400px;
    margin-inline: auto;
  }
  .place {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 8px;
  }
  .panel {
    display: grid;
    gap: 4px;
    padding: 8px;
    border: 2px solid var(--text);
    border-radius: 6px;
    min-width: 0;
    container-type: inline-size;
  }
  /* SPEC 8.3: the accents mark the borders of panels, never text and never a node fill. */
  .numbers-panel {
    border-color: var(--accent-numbers);
  }
  .population-panel {
    border-color: var(--accent-populations);
  }
  .panel-title {
    margin: 0;
    font-size: 0.9em;
  }
  .entry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-inline-end: 16px;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .equation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .vec {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 0 6px;
    border-inline: 1px solid var(--text);
    border-radius: 6px;
    font-variant-numeric: tabular-nums;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .matrix {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .matrix caption {
    font-style: italic;
  }
  .matrix th {
    font-size: 0.75em;
    font-weight: normal;
    padding: 0 4px;
  }
  .matrix td {
    padding: 0 6px;
    text-align: center;
  }
  .bridge {
    font-weight: bold;
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
  select:focus-visible,
  input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .setting {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .overlay input {
    width: 24px;
    height: 24px;
    margin: 0;
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
  }
  .values th,
  .values td {
    padding: 2px 6px;
    text-align: center;
  }
  .exact {
    overflow-wrap: anywhere;
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
