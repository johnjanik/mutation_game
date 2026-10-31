<script lang="ts">
  // T11, the Folding Bench (SPEC.md 4 T11, 2.13, 4.0, 6.6, 7.4, 7.5). Owner P4-A4. A board with a
  // symmetry, its orbits coloured, and the folded board beside it in Bourbaki order: one click acts on a
  // whole orbit of the big board (a symmetric move) and the folded board, played by the engine on its own
  // Cartan matrix, shows the same numbers (2.13(a)). The second tab, "average", names the type of the
  // averaged roots (2.13(b)) for every symmetry, including those along which the board does not fold.
  // Every value comes from the engine through t11/model.ts. The default state renders at build time; the
  // URL is read once on hydration (admitLink: the codec, then T11's own rules).
  //
  // Properties (CONTRACTS 5.2; listed in site/tests/unit/tools/T11.test.ts): id, board, view, coords,
  // start, moves, symmetry, caption, preset ('default' | 'fold' | 'average': the state fields and the tab),
  // prediction; linkTo and layers are accepted and ignored.
  import { untrack } from 'svelte';
  import { toPositions } from '@two-games/engine';
  import type { AnyBoard } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import { historyNames } from '../board/historyNames';
  import Predict from '../board/Predict.svelte';
  import OrbitOverlay from './t11/OrbitOverlay.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { encodeState } from '../../lib/urlCodec';
  import { labelOrder, resolveBoard, type ToolState } from '../../lib/state';
  import { engineCall } from '../../lib/worker';
  import { speak } from '../../lib/a11y';
  import { POPULATIONS_ICON, NUMBERS_ICON } from '../draw/palette';
  import { isLong } from './t01/longNumber';
  import type { Prediction } from '../../tools/types';
  import { CONSTRUCTION, T11_BOARDS, T11_PRESETS, T11_TABS, type T11View } from './t11/config';
  import {
    FoldBench,
    admitLink,
    announceSymmetric,
    averagedOf,
    captionFor,
    defaultSymmetry,
    exportData,
    foldContext,
    offeredSymmetries,
    orbitOfLabel,
    orbitText,
    orbitsInLabels,
    symmetryText,
    symmetryToLabels,
    undoAnnouncement,
    type BenchConfig,
  } from './t11/model';

  interface Props {
    id?: string;
    board?: string;
    view?: T11View;
    coords?: T11View;
    start?: (number | string)[];
    moves?: number[];
    symmetry?: number[];
    caption?: string;
    preset?: string;
    prediction?: Prediction;
    linkTo?: string;
    layers?: number;
  }

  let { id = '', board: boardProp, view: viewProp, coords: coordsProp, start: startProp, moves: movesProp, symmetry: symmetryProp, caption, preset, prediction }: Props = $props();

  // The author's configuration is read once (CONTRACTS 5.2): props over the preset's fields.
  const instanceId = untrack(() => id);
  const presetFields = untrack(() => T11_PRESETS[preset === 'average' || preset === 'fold' ? preset : 'default']);
  /** An author's own caption stays; the preset's caption (the tool route passes the registry's) follows the state. */
  const fixedCaption = untrack(() => (caption !== undefined && caption !== presetFields.caption ? caption : null));
  const authorConfig: BenchConfig = untrack(() => {
    const board = boardProp ?? presetFields.board;
    const view = viewProp ?? coordsProp ?? presetFields.view;
    if (coordsProp !== undefined && coordsProp !== view) throw new Error(`T11 instance ${instanceId || '(tool route)'}: coords must equal the view`);
    const sameBoard = board === presetFields.board;
    const symmetry = symmetryProp ?? (sameBoard ? presetFields.symmetry : undefined);
    const samePreset = sameBoard && view === presetFields.view && (symmetry ?? []).join('.') === presetFields.symmetry.join('.');
    const c: BenchConfig = { board, view };
    if (symmetry !== undefined) c.symmetry = symmetry;
    const start = startProp ?? (samePreset ? presetFields.start : undefined);
    if (start !== undefined) c.start = start;
    const moves = movesProp ?? (samePreset ? presetFields.moves : undefined);
    if (moves !== undefined) c.moves = moves;
    return c;
  });
  // Authoring errors fail the build with a message naming the instance (plan).
  const initial = untrack(() => {
    try {
      return new FoldBench(authorConfig);
    } catch (e) {
      throw new Error(`T11 instance ${instanceId || '(tool route)'}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  const defaults: ToolState = initial.state();

  let bench = $state.raw(initial);
  let version = $state(0);
  let tab = $state<'fold' | 'average'>(untrack(() => presetFields.tab));
  let notice = $state<string | null>(null);
  let busy = $state(false);
  let predictionResolved = $state(untrack(() => prediction === undefined));
  /**
   * The prediction is a question about the configured state (SPEC 4.0 Predict). A link or the back button
   * that loads another state before the reader has answered withdraws it (as T1 does), so that no question
   * stands over a board it does not describe.
   */
  let predictionWithdrawn = $state(false);
  let generation = 0;

  const touch = (): void => {
    version++;
  };
  /** The bench, read so that a derived value depends on `version` (the model is a mutable class). */
  function cur(): FoldBench {
    void version;
    return bench;
  }

  const ctx = $derived(cur().ctx);
  const spec = $derived(cur().spec);
  const folds = $derived(ctx.folded !== null);
  const frozen = $derived(!predictionResolved || busy || cur().pending);
  const boards = $derived(cur().boards());
  const bigValues = $derived(cur().bigValues());
  const foldedValues = $derived(cur().foldedValues());
  const noneCanAct = $derived(ctx.orbitOf.map(() => false));
  const bigCanAct = $derived(frozen ? noneCanAct : cur().canAct());
  const foldedCanAct = $derived(ctx.orbits.map(() => folds && !frozen));
  const toolState = $derived(cur().state());
  const isNumbers = $derived(cur().view === 'numbers');
  const game = $derived(cur().game);
  const bigLabels = $derived([...ctx.board.labels].sort((a, b) => a - b));
  /** The folded board's labels in increasing order (Bourbaki order), the order of foldedInLabelOrder. */
  const foldedLabels = $derived(ctx.folded === null ? [] : labelOrder(ctx.folded));
  const foldedName = $derived(ctx.foldedName ?? '');
  const orbitLabels = $derived(orbitsInLabels(ctx));
  /** The colour (and folded label) of each big position's orbit. */
  const bigColours = $derived(ctx.orbitOf.map((s) => ctx.colour[s]!));
  const badges = $derived(folds ? ctx.orbitOf.map((s) => ctx.folded!.labels[s]!) : null);
  /** The legend: one entry per orbit, in folded label order when the board folds (plan). */
  const legend = $derived(
    ctx.orbits
      .map((_, s) => ({ s, colour: ctx.colour[s]!, labels: orbitLabels[s]!, folded: folds ? ctx.folded!.labels[s]! : null }))
      .sort((a, b) => a.colour - b.colour),
  );
  const averaged = $derived(tab === 'average' ? averagedOf(ctx) : null);
  const captionText = $derived(
    fixedCaption ??
      (spec === presetFields.board && ctx.images.join('.') === presetFields.symmetry.join('.') && tab === presetFields.tab ? presetFields.caption : captionFor(ctx, tab)),
  );
  const symmetryOptions = $derived(offeredSymmetries(ctx.board).map((s) => symmetryToLabels(ctx.board, s)));
  const symmetryValue = $derived(ctx.images.join('.'));
  const tabs = T11_TABS.filter((t) => t.released);

  /** Exact digits in the tooltip for long values (4.0 Long numbers). */
  const tooltip = (values: readonly string[]) => (k: number): string | null => (isLong(values[k]!) ? values[k]! : null);
  const spokenList = (values: readonly string[]): string => values.map((v) => speak(v)).join(', ');

  const figureLabel = $derived.by(() => {
    const b = cur();
    const noun = isNumbers ? 'numbers' : 'populations';
    const first = `Folding Bench on ${spec} with the symmetry ${symmetryText(ctx)}: big board ${noun} ${spokenList(b.bigInLabelOrder())}`;
    const second = folds ? `; folded board ${foldedName} ${noun} ${spokenList(b.foldedInLabelOrder())}` : `; ${ctx.message}`;
    return `${first}${second}${averaged !== null ? `; averaged roots ${averaged.name}` : ''}.`;
  });

  // Only the names History reads: a move names at most 50 positions however long the play (7.4).
  const positionNames = $derived.by(() => {
    const b = cur();
    const noun = isNumbers ? 'numbers' : 'populations';
    return historyNames(b.moves.length, b.cursor, (k) => `${k === 0 ? 'Start' : `After move ${k}`}: ${noun} ${spokenList(b.bigInLabelOrder(k))}`);
  });

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a picker)
  // ------------------------------------------------------------------------------------------

  /** Builds the bench of a configuration; a long list of moves from a link is replayed where E-9 says. */
  function load(cfg: BenchConfig): void {
    const g = ++generation;
    const b = new FoldBench(cfg, { defer: true });
    bench = b;
    touch();
    if (!b.pending) return;
    if (!b.needsWorker()) {
      b.replaySync();
      touch();
      return;
    }
    void replayInWorker(b, g);
  }

  /**
   * E-9 rule 2, "a long list of moves read from a link": both replays go through engineCall with their
   * hints (positionsOf, the site's replay, which returns every position). While they run, both boards keep
   * the start, no node can act, the controls are disabled and nothing is announced. Errors are not caught.
   */
  async function replayInWorker(b: FoldBench, g: number): Promise<void> {
    busy = true;
    try {
      const states = b.workerStates();
      const hints = b.hints();
      const [big, small] = await Promise.all([engineCall('positionsOf', [states.big], hints.big), engineCall('positionsOf', [states.folded], hints.folded)]);
      if (g !== generation) return;
      b.acceptReplay(big, small);
    } finally {
      if (g === generation) busy = false;
      touch();
    }
  }

  function configOf(s: ToolState): BenchConfig {
    const c: BenchConfig = { board: s.board as string, view: (s.view ?? 'numbers') as T11View };
    if (s.symmetry !== undefined) c.symmetry = s.symmetry;
    if (s.start !== undefined) c.start = s.start;
    if (s.moves !== undefined) c.moves = s.moves;
    return c;
  }

  function readLink(): void {
    const { state, notice: n } = admitLink(window.location.search, defaults, instanceId);
    notice = n;
    if (encodeState(state) === encodeState(bench.state())) return;
    if (!predictionResolved && encodeState(state) !== encodeState(defaults)) {
      predictionWithdrawn = true;
      predictionResolved = true;
    }
    load(configOf(state));
  }

  // Hydration: read the URL once with the instance prefix (6.6).
  $effect(() => {
    untrack(() => readLink());
  });

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------

  /** One symmetric move on orbit s (a click, Enter or Space on any node of the orbit, on either board). */
  function act(s: number, announce: (t: string) => void): void {
    if (frozen) return;
    if (!bench.folds) {
      announce(ctx.message ?? '');
      return;
    }
    const r = bench.act(s);
    if (r === null) return;
    touch();
    announce(announceSymmetric(bench, r));
  }

  /** The announcement after the cursor moved: an undo reads the position reached, a redo the move made. */
  function arrive(to: number, from: number, announce: (t: string) => void): void {
    const b = bench;
    if (to < from) announce(undoAnnouncement(b, to + 1, to));
    else if (to > from) {
      const orbit = orbitOfLabel(b.ctx, b.moves[to - 1]!);
      announce(announceSymmetric(b, { orbit, labels: orbitLabels[orbit]!, move: to, before: b.bigValues(to - 1), after: b.bigValues(to) }));
    }
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen) return;
    const from = bench.cursor;
    if (!bench.scrub(to)) return;
    touch();
    arrive(to, from, announce);
  }

  const undo = (announce: (t: string) => void): void => scrub(bench.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(bench.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    if (frozen) return;
    const from = bench.cursor;
    if (!bench.reset()) return;
    touch();
    arrive(0, from, announce);
  }

  function onKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo(announce);
    else redo(announce);
  }

  /** A picker resets the symmetry, the start and the moves to the tool's defaults for the board (4.0; plan). */
  function pickBoard(name: string): void {
    notice = null;
    load({ board: name, view: bench.view, symmetry: defaultSymmetry(resolveBoard(name)) });
  }

  function pickSymmetry(value: string): void {
    notice = null;
    load({ board: bench.spec, view: bench.view, symmetry: value.split('.').map(Number) });
  }

  function pickView(v: T11View): void {
    notice = null;
    load({ board: bench.spec, view: v, symmetry: bench.ctx.images });
  }

  function selectTab(t: 'fold' | 'average'): void {
    tab = t;
  }

  /** The arrow keys of a tab list (WAI-ARIA tabs, automatic activation): Left, Right, Home, End. */
  function onTabKey(event: KeyboardEvent): void {
    const order = tabs.map((t) => t.id as 'fold' | 'average');
    const at = order.indexOf(tab);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (at + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (at + order.length - 1) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectTab(order[next]!);
    const list = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
    (list?.querySelector(`[data-tab="${order[next]}"]`) as HTMLElement | null)?.focus();
  }

  const uid = $derived(instanceId || 'fold');
  const groups = (['A', 'D', 'E'] as const).map((letter) => ({ letter, names: T11_BOARDS.filter((n) => n.startsWith(letter)) }));
  const nameParts = (name: string): { letters: string; sub: string } => {
    const m = /^([A-Z]+)(\d+)$/.exec(name);
    return m === null ? { letters: name, sub: '' } : { letters: m[1]!, sub: m[2]! };
  };
  const anyBoard = (b: unknown): AnyBoard => b as AnyBoard;
</script>

{#snippet icon(i: typeof POPULATIONS_ICON)}
  <svg class="icon" viewBox={i.viewBox} width="16" height="16" aria-hidden="true" focusable="false"><path d={i.d} stroke={i.stroke} fill={i.fill} /></svg>
{/snippet}

{#snippet typeset(name: string)}
  {@const p = nameParts(name)}{p.letters}<sub>{p.sub}</sub>
{/snippet}

{#snippet orbitLegend()}
  <ul class="legend" data-out="orbits" aria-label="Orbits of the symmetry">
    {#each legend as item (item.s)}
      <li data-orbit={item.labels.join(',')} data-folded-label={item.folded ?? undefined}>
        <svg class="swatch" viewBox="-1 -1 2 2" width="18" height="18" aria-hidden="true" focusable="false"
          ><circle cx="0" cy="0" r="0.72" style="stroke: var(--edge-{item.colour})" /></svg
        >
        {#if item.folded !== null}
          Orbit <span class="numeral">{orbitText(item.labels)}</span>: folded node <span class="numeral">{item.folded}</span>
        {:else}
          Orbit <span class="numeral">{orbitText(item.labels)}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<!-- The big board with its orbits coloured: played on the fold tab; on the average tab (RT-FIX P4-MERGE-01) the
     same drawing is the tab's default figure (4.0, 7.4: the SVG board with its values), with no node to act on. -->
{#snippet bigPanel(api: FrameApi, play: boolean)}
  <div class="panel" class:numbers={isNumbers} class:populations={!isNumbers} data-out="big-board">
    <p class="panel-title">Big board {spec}</p>
    <div class="board-host">
      <OrbitOverlay board={anyBoard(boards.big)} colours={bigColours} {badges} />
      <Board
        board={anyBoard(boards.big)}
        values={bigValues}
        {game}
        canAct={play ? bigCanAct : noneCanAct}
        name="Big board {spec}"
        disabled={!play || !predictionResolved || busy}
        hintFor={tooltip(bigValues)}
        onAct={(k) => act(ctx.orbitOf[k]!, api.announce)}
      />
    </div>
  </div>
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t11" data-view={cur().view} data-tab-shown={tab} onkeydown={(e) => onKeydown(e, api.announce)}>
    {#if prediction && !predictionWithdrawn}
      <Predict {prediction} hydrated={api.hydrated} labels={bigLabels} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    <p class="line" data-out="symmetry">Symmetry of {spec}: <span class="numeral">{symmetryText(ctx)}</span>.</p>
    <div class="tabs" role="tablist" aria-label="Two constructions called folding">
      {#each tabs as t (t.id)}
        <button
          type="button"
          role="tab"
          class="tab"
          id="{uid}-tab-{t.id}"
          aria-selected={tab === t.id ? 'true' : 'false'}
          aria-controls="{uid}-panel"
          tabindex={tab === t.id ? 0 : -1}
          data-tab={t.id}
          data-control="tab"
          disabled={!api.hydrated}
          onclick={() => selectTab(t.id as 'fold' | 'average')}
          onkeydown={onTabKey}>{t.label}</button
        >
      {/each}
    </div>
    <div class="tab-panel" role="tabpanel" id="{uid}-panel" aria-labelledby="{uid}-tab-{tab}" data-panel={tab}>
      <p class="construction" data-out="construction">{CONSTRUCTION[tab]}</p>
      {#if tab === 'fold'}
        <p class="line view">
          {@render icon(isNumbers ? NUMBERS_ICON : POPULATIONS_ICON)}
          {#if folds}
            {isNumbers ? 'Numbers game' : 'Mutation game'}, symmetric play: one click acts on a whole orbit.
          {:else}
            {isNumbers ? 'Numbers game' : 'Mutation game'}, no symmetric play: the board does not fold by this symmetry.
          {/if}
        </p>
        <div class="boards">
          {@render bigPanel(api, true)}
          {#if folds}
            <div class="panel" class:numbers={isNumbers} class:populations={!isNumbers} data-out="folded-board">
              <p class="panel-title">
                Folded board <span data-out="folded-name" data-name={foldedName}>{@render typeset(foldedName)}</span>{#if foldedName === 'B2'}
                  (<span data-out="folded-name-note">B<sub>2</sub> = C<sub>2</sub></span>){/if}
              </p>
              <div class="board-host">
                <OrbitOverlay board={anyBoard(boards.folded)} colours={ctx.colour} />
                <Board
                  board={anyBoard(boards.folded)}
                  values={foldedValues}
                  {game}
                  canAct={foldedCanAct}
                  name="Folded board {foldedName}"
                  disabled={!predictionResolved || busy}
                  hintFor={tooltip(foldedValues)}
                  onAct={(s) => act(s, api.announce)}
                />
              </div>
            </div>
          {:else}
            <div class="panel message">
              <p class="line" data-out="fold-message">{ctx.message}</p>
            </div>
          {/if}
        </div>
        {@render orbitLegend()}
        <History
          total={cur().moves.length}
          cursor={cur().cursor}
          {positionNames}
          hydrated={api.hydrated}
          frozen={frozen}
          onUndo={() => undo(api.announce)}
          onRedo={() => redo(api.announce)}
          onReset={() => reset(api.announce)}
          onScrub={(to) => scrub(to, api.announce)}
        />
      {:else if averaged !== null}
        <p class="line">
          Averaged roots: <strong data-out="averaged-name" data-name={averaged.name}>{@render typeset(averaged.name)}</strong>{#if averaged.name === 'B2'}
            (<span data-out="averaged-name-note">B<sub>2</sub> = C<sub>2</sub></span>){/if}{#if folds}; folded board: <span
              data-out="folded-name"
              data-name={foldedName}>{@render typeset(foldedName)}</span
            >{/if}.
        </p>
        {@render bigPanel(api, false)}
        <table class="classes" data-out="averaged-classes">
          <caption>Length classes of the averaged roots</caption>
          <thead>
            <tr><th scope="col">Class</th><th scope="col">Roots</th><th scope="col">Form value</th></tr>
          </thead>
          <tbody>
            {#each averaged.classes as c (c.class)}
              <tr data-class={c.class}><th scope="row">{c.class}</th><td class="numeral">{c.roots}</td><td class="numeral">{c.form_value}</td></tr>
            {/each}
          </tbody>
        </table>
        {@render orbitLegend()}
      {/if}
    </div>
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  <label class="setting">
    <span>Board</span>
    <select data-control="picker" disabled={!api.hydrated || frozen} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value)}>
      {#each groups as g (g.letter)}
        <optgroup label="Type {g.letter}" data-letter={g.letter}>
          {#each g.names as name (name)}
            <option value={name} selected={spec === name}>{name}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </label>
  <label class="setting">
    <span>Symmetry</span>
    <select data-control="symmetry" disabled={!api.hydrated || frozen} onchange={(e) => pickSymmetry((e.currentTarget as HTMLSelectElement).value)}>
      {#each symmetryOptions as images (images.join('.'))}
        <option value={images.join('.')} selected={symmetryValue === images.join('.')}>{symmetryText(foldContext(ctx.board, images))}</option>
      {/each}
    </select>
  </label>
  <label class="setting">
    <span>Game</span>
    <select data-control="view" disabled={!api.hydrated || frozen} onchange={(e) => pickView((e.currentTarget as HTMLSelectElement).value as T11View)}>
      <option value="populations" selected={!isNumbers}>Populations</option>
      <option value="numbers" selected={isNumbers}>Numbers</option>
    </select>
  </label>
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values" data-table="big">
    <caption>Big board {spec}, after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
    <thead>
      <tr>
        <th scope="col">Node</th>
        <th scope="col">Orbit</th>
        {#if folds}<th scope="col">Folded node</th>{/if}
        <th scope="col">{isNumbers ? 'Number' : 'Population'}</th>
      </tr>
    </thead>
    <tbody>
      {#each bigLabels as l, j (l)}
        {@const s = orbitOfLabel(ctx, l)}
        <tr>
          <th scope="row">{l}</th>
          <td class="numeral">{orbitText(orbitLabels[s]!)}</td>
          {#if folds}<td class="numeral">{ctx.folded!.labels[s]}</td>{/if}
          <td>
            <button
              type="button"
              class="cell"
              data-table-board="big"
              data-table-node={l}
              disabled={!api.hydrated || frozen}
              aria-label="{isNumbers ? 'Node' : 'City'} {l}, {isNumbers ? 'value' : 'population'} {speak(cur().bigInLabelOrder()[j]!)}{folds ? `: a symmetric move on ${orbitText(orbitLabels[s]!)}` : ''}"
              onclick={() => act(s, api.announce)}>{cur().bigInLabelOrder()[j]}</button
            >
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if folds}
    <table class="values" data-table="folded">
      <caption>Folded board {foldedName}, after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
      <thead>
        <tr><th scope="col">Node</th><th scope="col">Orbit</th><th scope="col">{isNumbers ? 'Number' : 'Population'}</th></tr>
      </thead>
      <tbody>
        {#each cur().foldedInLabelOrder() as v, j (j)}
          {@const l = foldedLabels[j]!}
          {@const s = toPositions(ctx.folded!, [l])[0]!}
          <tr>
            <th scope="row">{l}</th>
            <td class="numeral">{orbitText(orbitLabels[s]!)}</td>
            <td>
              <button
                type="button"
                class="cell"
                data-table-board="folded"
                data-table-node={l}
                disabled={!api.hydrated || frozen}
                aria-label="{isNumbers ? 'Node' : 'City'} {l} of the folded board, {isNumbers ? 'value' : 'population'} {speak(v)}: a symmetric move on {orbitText(orbitLabels[s]!)}"
                onclick={() => act(s, api.announce)}>{v}</button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/snippet}

<ToolFrame
  toolId="fold"
  {instanceId}
  title="Folding Bench"
  caption={captionText}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  boardName={spec}
  derivedForExport={() => exportData(bench)}
  onPopState={() => {
    readLink();
  }}
  {figure}
  {controls}
  {table}
/>

<style>
  .t11 {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .view {
    display: flex;
    align-items: center;
    gap: 6px;
    font-style: italic;
  }
  .construction {
    margin: 0;
    font-weight: bold;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    border-bottom: 1px solid var(--sign-zero-outline);
  }
  .tab {
    min-width: 44px;
    min-height: 44px;
    padding: 0 16px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-bottom: 0;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
  }
  .tab[aria-selected='true'] {
    border: 2px solid var(--text);
    border-bottom: 0;
    font-weight: bold;
  }
  .tab:disabled {
    cursor: default;
  }
  .tab-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  /* The two boards side by side where the figure is at least 600 pixels wide, stacked below, big board
     first (A-11, 4.0 Small screens). Each panel is its own size container, so the size rule of 6.1
     measures the panel; nothing clips, so a focus ring is never cut by the box (A-2). */
  .boards {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  @container (min-width: 600px) {
    .boards {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .panel {
    container-type: inline-size;
    min-width: 0;
    border-radius: 8px;
    padding: 4px 0;
  }
  /* The view's accent marks the panel's border, never a node (8.3). */
  .panel.numbers {
    box-shadow: inset 0 0 0 2px var(--accent-numbers);
  }
  .panel.populations {
    box-shadow: inset 0 0 0 2px var(--accent-populations);
  }
  .panel.message {
    padding: 8px 12px;
    box-shadow: inset 0 0 0 1px var(--sign-zero-outline);
  }
  .panel-title {
    margin: 0 8px;
    font-weight: bold;
  }
  .board-host {
    position: relative;
  }
  .icon {
    flex: 0 0 auto;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0;
    padding: 0 8px;
    list-style: none;
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .swatch circle {
    fill: none;
    stroke-width: 3px;
    vector-effect: non-scaling-stroke;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
  .classes,
  .values {
    border-collapse: collapse;
  }
  .classes th,
  .classes td,
  .values th,
  .values td {
    padding: 2px 8px;
    text-align: center;
  }
  .classes caption,
  .values caption {
    text-align: start;
  }
  /* A picker never widens the page at 320 pixels (A-11): the label wraps and the select shrinks, so a long
     symmetry ({1} {2} {3} {4} {5} {6} {7, 8} on D8) is cut inside its own box. */
  .setting {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
  }
  select {
    min-height: 44px;
    max-width: 100%;
    min-width: 0;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
  }
  .cell {
    min-width: 44px;
    min-height: 44px;
    font: inherit;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    overflow-wrap: anywhere;
  }
  .tab:focus-visible,
  .cell:focus-visible,
  select:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
