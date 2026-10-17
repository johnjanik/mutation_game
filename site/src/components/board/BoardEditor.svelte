<script lang="ts">
  // The shared board editor (P2-A3; SPEC 4 T4 Editor, 5.6, 6.1, 6.2, 7.5 A-1, A-2, A-5, A-7, A-8, A-10, A-11).
  // A controlled component: `value` is the board (a name, or { cartan, xy }); every edit is emitted
  // through `onChange(next, change)` and nothing changes until the host passes the new value back. The
  // contract is editor/types.ts (BoardEditorProps), which T16 (P2-A5) composes unchanged.
  //
  // While the board is an unedited preset the drawing uses its layout of 6.1 (named rows, polygons, or the
  // circle in label order for a matrix without coordinates); the first edit turns the layout into whole
  // grid points (editor/model.ts gridOf) and emits { cartan, xy } with labels 1..n.
  //
  // The drawing reuses the Board family's parts (Roads.svelte, Node.svelte when the host writes values,
  // the layouts and the size rule of draw/, the arrow-key model of keyboard.ts) but not Board.svelte
  // itself: Board's node names follow the game template of A-3 ("Node 3, value 2, can be fired") and
  // need a value on every node, and it has no way to mark nodes, while an editor names its nodes
  // "Node 3, selected" and T4 marks a sub-board (deviation recorded in decisions/P2-A3.md).
  //
  // Keyboard (A-1, A-8): the nodes are one tab stop with a roving tabindex; arrows move the focus (on a
  // custom layout they follow the labels and wrap), Home and End go to the first and last label, Enter or
  // Space selects the focused node as the subject of the road and move controls. Ctrl or Alt with an
  // arrow moves the focused node by one grid point; Delete or Backspace removes it; + adds a node. Every
  // action also has a button or a select after the drawing; dragging a node is never the only way.
  import { tick, untrack } from 'svelte';
  import { CAPS, toLabels } from '@two-games/engine';
  import type { AnyBoard } from '@two-games/engine';
  import Roads from './Roads.svelte';
  import Node from './Node.svelte';
  import { nodePositions } from '../draw/layouts';
  import { MARGIN, toPixels } from '../draw/geometry';
  import { effectiveRoadStyle } from '../draw/roads';
  import { arrowTarget, isArrowKey } from './keyboard';
  import { resolveBoard, type BoardSpec } from '../../lib/state';
  import {
    RESETS_PLAY,
    addNode,
    fromSpec,
    moveNode,
    removeNode,
    roadsBetween,
    setRoads,
    toSpec,
    type EditorBoard,
  } from './editor/model';
  import { namedPresets } from './editor/namedPresets';
  import type { BoardEditorProps, EditorChange, EditorPreset } from './editor/types';

  let {
    value,
    onChange,
    name,
    disabled = false,
    roadStyle = 'dynkin',
    presets,
    maxNodes = CAPS.customNodes,
    maxRoads = CAPS.roadsEachWay,
    values,
    marked = [],
  }: BoardEditorProps = $props();

  const uid = $props.id();

  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });
  const off = $derived(!hydrated || disabled);

  const nodeCap = $derived(Math.min(maxNodes, CAPS.customNodes));
  const roadCap = $derived(Math.min(maxRoads, CAPS.roadsEachWay));
  const roadChoices = $derived(Array.from({ length: roadCap + 1 }, (_, k) => k));

  const board: AnyBoard = $derived(resolveBoard(value));
  const edit: EditorBoard = $derived(fromSpec(value, board));
  const layout = $derived(nodePositions(board, typeof value === 'string' ? undefined : value.xy));
  const style = $derived(effectiveRoadStyle(board, roadStyle));
  const positions = $derived(Array.from({ length: board.n }, (_, k) => k));
  const labels = $derived(board.labels);
  const markedSet = $derived(new Set(marked));

  // The drawing in grid units, exactly as Board.svelte computes it (6.1 size rule; polygon box).
  const REF_UNIT = 64;
  const REF_POLYGON_W = 360;
  const px = $derived(toPixels(layout, layout.circle ? REF_POLYGON_W : 2 * MARGIN + layout.columns * REF_UNIT));
  const centres = $derived(
    px.centres.map(([x, y]) =>
      layout.circle ? ([x / REF_UNIT, y / REF_UNIT] as [number, number]) : ([(x - MARGIN) / REF_UNIT, (y - MARGIN) / REF_UNIT] as [number, number]),
    ),
  );
  const viewW = $derived(layout.circle ? px.width / REF_UNIT : layout.columns);
  const viewH = $derived(layout.circle ? px.height / REF_UNIT : layout.rows);

  // The subject of the road and move controls, and the other end of the road (positions).
  let subjectRaw = $state(0);
  let otherRaw = $state(1);
  const subject = $derived(Math.min(Math.max(0, subjectRaw), board.n - 1));
  const other = $derived.by(() => {
    if (otherRaw >= 0 && otherRaw < board.n && otherRaw !== subject) return otherRaw;
    if (board.n < 2) return -1;
    return subject === 0 ? 1 : 0;
  });
  const subjectLabel = $derived(labels[subject]!);
  const otherLabel = $derived(other >= 0 ? labels[other]! : null);
  const roads = $derived(other >= 0 ? roadsBetween(edit, subject, other) : { out: 0, back: 0 });
  const labelOrder = $derived([...positions].sort((a, b) => labels[a]! - labels[b]!));

  // Roving tab stop (A-1): the lowest label first, then the last focused node.
  let focused = $state<number | null>(null);
  const lowest = $derived(labelOrder[0] ?? 0);
  const tabStop = $derived(focused !== null && focused < board.n ? focused : lowest);
  const buttons: (HTMLButtonElement | undefined)[] = [];

  const presetList: EditorPreset[] = $derived(presets ?? namedPresets());
  const groups = $derived(
    (
      [
        ['finite', 'Finite types'],
        ['affine', 'Affine boards'],
        ['twisted', 'Twisted affine boards'],
        ['test', 'Test boards'],
      ] as const
    )
      .map(([g, title]) => ({ g, title, entries: presetList.filter((p) => p.group === g) }))
      .filter((x) => x.entries.length > 0),
  );
  let pick = $state(untrack(() => (typeof value === 'string' ? value : '')));

  const addReason = $derived(board.n >= nodeCap ? `A board has at most ${nodeCap} nodes.` : '');
  const removeReason = $derived(board.n <= 1 ? 'A board keeps at least one node.' : '');

  function emit(next: EditorBoard | null, kind: EditorChange['kind']): boolean {
    if (next === null || off) return false;
    onChange(toSpec(next), { kind, resetsPlay: RESETS_PLAY[kind] });
    return true;
  }

  function select(k: number): void {
    if (off) return;
    if (k !== subject) {
      otherRaw = subject;
      subjectRaw = k;
    }
    focused = k;
  }

  function add(): void {
    if (emit(addNode(edit, nodeCap), 'add-node')) subjectRaw = board.n;
  }

  async function remove(k: number = subject): Promise<void> {
    const n = board.n;
    if (!emit(removeNode(edit, k), 'remove-node')) return;
    const next = Math.min(k, n - 2);
    subjectRaw = next;
    otherRaw = -1;
    if (focused !== null) {
      focused = next;
      await tick();
      buttons[next]?.focus();
    }
  }

  function move(k: number, dx: number, dy: number): void {
    const [x, y] = edit.xy[k]!;
    emit(moveNode(edit, k, x + dx, y + dy), 'move');
  }

  // A board from a link may hold more than roadCap roads one way (5.6: the engine accepts any count, the
  // editor refuses more). The selects show the count held, as an option the reader cannot choose; a
  // change the editor refuses (setRoads checks both counts) puts the select back on the count held.
  function setOut(event: Event): void {
    const el = event.currentTarget as HTMLSelectElement;
    if (other < 0 || !emit(setRoads(edit, subject, other, Number(el.value), roads.back, roadCap), 'roads')) el.value = String(roads.out);
  }

  function setBack(event: Event): void {
    const el = event.currentTarget as HTMLSelectElement;
    if (other < 0 || !emit(setRoads(edit, subject, other, roads.out, Number(el.value), roadCap), 'roads')) el.value = String(roads.back);
  }

  function loadPreset(): void {
    const p = presetList.find((e) => e.id === pick);
    if (p === undefined || off) return;
    subjectRaw = 0;
    otherRaw = 1;
    onChange(typeof p.board === 'string' ? p.board : JSON.parse(JSON.stringify(p.board)), { kind: 'preset', resetsPlay: RESETS_PLAY.preset });
  }

  function onNodeKey(event: KeyboardEvent, k: number): void {
    if (off) return;
    const mod = event.ctrlKey || event.altKey || event.metaKey;
    if (isArrowKey(event.key) && mod && event.key.startsWith('Arrow')) {
      event.preventDefault();
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key as 'ArrowLeft']!;
      select(k);
      move(k, d[0]!, d[1]!);
      return;
    }
    if (isArrowKey(event.key) && !mod) {
      event.preventDefault();
      const from = labels[k]!;
      const to = arrowTarget(layout, labels, from, event.key);
      const target = labels.indexOf(to);
      focused = target;
      buttons[target]?.focus();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && !mod) {
      event.preventDefault();
      void remove(k);
      return;
    }
    if (event.key === '+' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      add();
    }
  }

  // Dragging (6.1: snap on drop to whole grid points; refused on a taken point). A pointer press that does
  // not move is a click and selects the node.
  let drag = $state<{ k: number; x0: number; y0: number; dx: number; dy: number; moved: boolean; id: number } | null>(null);
  let suppressClick = false;
  let hitsEl: HTMLDivElement | undefined = $state();

  /** One grid unit in CSS pixels on screen (the box over the number of columns; 44 on a circle). */
  function unitPx(): number {
    if (!hitsEl) return 44;
    if (layout.circle) return 44;
    return hitsEl.getBoundingClientRect().width / Math.max(1, layout.columns);
  }

  function onPointerDown(event: PointerEvent, k: number): void {
    if (off || event.button !== 0 || !event.isPrimary) return;
    drag = { k, x0: event.clientX, y0: event.clientY, dx: 0, dy: 0, moved: false, id: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (drag === null || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x0;
    const dy = event.clientY - drag.y0;
    drag = { ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > 6 };
  }

  function onPointerUp(event: PointerEvent): void {
    if (drag === null || event.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    suppressClick = true;
    const u = unitPx();
    const gx = Math.round(d.dx / u);
    const gy = Math.round(-d.dy / u);
    if (gx !== 0 || gy !== 0) {
      select(d.k);
      move(d.k, gx, gy);
    }
  }

  function onClick(k: number): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    select(k);
  }

  function nodeName(k: number): string {
    const v = values?.[k];
    const base = v === undefined ? `Node ${labels[k]}` : `Node ${labels[k]}, value ${String(v).replace(/^-/, 'minus ')}`;
    const marks = [k === subject ? 'selected' : null, markedSet.has(labels[k]!) ? 'marked' : null].filter((s) => s !== null);
    return marks.length === 0 ? base : `${base}, ${marks.join(', ')}`;
  }

  const moveLabels = $derived([
    ['left', -1, 0, '←'],
    ['right', 1, 0, '→'],
    ['up', 0, 1, '↑'],
    ['down', 0, -1, '↓'],
  ] as const);

  // Keep the subject on the board when the host replaces the board.
  $effect(() => {
    void board;
    untrack(() => {
      if (subjectRaw >= board.n) subjectRaw = board.n - 1;
      if (typeof value === 'string') pick = value;
    });
  });
</script>

<div
  class="editor"
  data-editor=""
  data-road-style={style}
  data-nodes={board.n}
  data-selected={subjectLabel}
>
  <div class="drawing-box">
    <div class="board" class:circle={layout.circle} style="--k: {layout.columns}; --rows: {layout.rows};">
      <svg class="drawing" viewBox="0 0 {viewW} {viewH}" role="img" aria-label="{name}: {board.n} {board.n === 1 ? 'node' : 'nodes'}" focusable="false">
        <Roads {board} xy={centres} unit={1} roadStyle={style} />
        {#each positions as k (k)}
          {@const [x, y] = centres[k]!}
          {#if markedSet.has(labels[k]!)}
            <g class="mark" data-mark={labels[k]}>
              <circle cx={x} cy={y} r="0.42" />
              <path d="M {x - 0.4} {y - 0.33} h 0.12 M {x - 0.34} {y - 0.39} v 0.12" />
            </g>
          {/if}
          {#if k === subject}
            <circle class="selected-ring" data-selected-ring={labels[k]} cx={x} cy={y} r="0.34" />
          {/if}
          {#if values !== undefined && values[k] !== undefined}
            <Node label={labels[k]!} value={values[k]!} kind="node" canAct={false} stateText="" {x} {y} unit={1} />
          {:else}
            <g class="plain-node">
              <circle class="disc" cx={x} cy={y} r="0.25" />
              <text class="label" data-label={labels[k]} x={x + 0.33} y={y - 0.3} font-size="0.2" text-anchor="start" dominant-baseline="central"
                >{labels[k]}</text
              >
            </g>
          {/if}
        {/each}
      </svg>
      <div class="hits" role="group" aria-label={name} data-board-group bind:this={hitsEl}>
        {#each positions as k (k)}
          <button
            type="button"
            bind:this={buttons[k]}
            class="hit"
            class:dragging={drag !== null && drag.k === k && drag.moved}
            style="left: {(centres[k]![0] / viewW) * 100}%; top: {(centres[k]![1] / viewH) * 100}%;{drag !== null && drag.k === k && drag.moved
              ? ` translate: ${drag.dx}px ${drag.dy}px;`
              : ''}"
            tabindex={k === tabStop ? 0 : -1}
            disabled={off}
            aria-label={nodeName(k)}
            data-node={labels[k]}
            data-board="populations"
            data-value={values?.[k] === undefined ? '' : String(values[k])}
            data-can-act="true"
            data-selected={k === subject ? 'true' : 'false'}
            data-marked={markedSet.has(labels[k]!) ? 'true' : 'false'}
            data-xy={edit.xy[k]!.join(',')}
            onclick={() => onClick(k)}
            onfocus={() => (focused = k)}
            onkeydown={(e) => onNodeKey(e, k)}
            onpointerdown={(e) => onPointerDown(e, k)}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointercancel={() => (drag = null)}
          ></button>
        {/each}
      </div>
    </div>
  </div>

  <div class="tools" data-editor-controls="">
    <p class="status" id="{uid}-status">
      Selected: <span data-out="editorSubject">node {subjectLabel}</span>{#if marked.length > 0}. Marked: nodes <span data-out="editorMarked"
          >{marked.join(', ')}</span
        >{/if}.
    </p>
    <div class="row">
      <button type="button" class="control" data-control="addNode" disabled={off || addReason !== ''} onclick={add}>Add node</button>
      <button type="button" class="control" data-control="removeNode" disabled={off || removeReason !== ''} onclick={() => remove()}
        >Remove node {subjectLabel}</button
      >
      <span class="reason" data-out="editorReason">{addReason || removeReason}</span>
    </div>
    <div class="row" role="group" aria-label="Move node {subjectLabel}">
      <span class="what">Move node {subjectLabel}</span>
      {#each moveLabels as [dir, dx, dy, arrow] (dir)}
        <button
          type="button"
          class="control small"
          data-control="move-{dir}"
          disabled={off}
          aria-label="Move node {subjectLabel} {dir}"
          onclick={() => move(subject, dx, dy)}>{arrow}</button
        >
      {/each}
    </div>
    {#if other >= 0}
      <div class="row roads-row">
        <label class="setting">
          <span>Roads between node {subjectLabel} and node</span>
          <select data-control="roadsOther" disabled={off} value={other} onchange={(e) => (otherRaw = Number((e.currentTarget as HTMLSelectElement).value))}>
            {#each labelOrder.filter((p) => p !== subject) as p (p)}
              <option value={p}>{labels[p]}</option>
            {/each}
          </select>
        </label>
        <label class="setting">
          <span>from {subjectLabel} to {otherLabel}</span>
          <select data-control="roadsOut" disabled={off} value={roads.out} onchange={setOut}>
            {#each roadChoices as c (c)}
              <option value={c}>{c}</option>
            {/each}
            {#if roads.out > roadCap}
              <option value={roads.out} disabled>{roads.out}</option>
            {/if}
          </select>
        </label>
        <label class="setting">
          <span>from {otherLabel} to {subjectLabel}</span>
          <select data-control="roadsBack" disabled={off} value={roads.back} onchange={setBack}>
            {#each roadChoices as c (c)}
              <option value={c}>{c}</option>
            {/each}
            {#if roads.back > roadCap}
              <option value={roads.back} disabled>{roads.back}</option>
            {/if}
          </select>
        </label>
      </div>
    {/if}
    <div class="row">
      <label class="setting">
        <span>Board</span>
        <select data-control="picker" disabled={off} bind:value={pick}>
          {#if !presetList.some((p) => p.id === pick)}
            <option value={pick} disabled>{pick === '' ? 'custom board' : pick}</option>
          {/if}
          {#each groups as group (group.g)}
            <optgroup label={group.title} data-group={group.g}>
              {#each group.entries as p (p.id)}
                <option value={p.id}>{p.label}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <button type="button" class="control" data-control="loadPreset" disabled={off} onclick={loadPreset}>Load board</button>
    </div>
  </div>
</div>

<style>
  .editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  .drawing-box {
    overflow-x: auto;
    container-type: inline-size;
  }
  /* The size rule of SPEC 6.1, as Board.svelte writes it. */
  .board {
    --u: min(64px, (100cqw - 16px) / var(--k));
    position: relative;
    box-sizing: content-box;
    width: calc(var(--k) * var(--u));
    height: calc(var(--rows) * var(--u));
    padding: 8px;
    margin-inline: auto;
  }
  @supports (width: round(down, 10.5px, 1px)) {
    .board {
      --u: min(64px, round(down, (100cqw - 16px) / var(--k), 1px));
    }
  }
  .board.circle {
    box-sizing: border-box;
    width: min(100cqw, 360px);
    height: min(100cqw, 360px);
    padding: 0;
  }
  .drawing,
  .hits {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
  }
  .board.circle .drawing,
  .board.circle .hits {
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .drawing {
    overflow: visible;
  }
  .disc {
    fill: var(--page);
    stroke: var(--sign-zero-outline);
    stroke-width: 2.5px;
    vector-effect: non-scaling-stroke;
  }
  .label {
    font-family: var(--font-prose);
    fill: var(--text);
  }
  .selected-ring {
    fill: none;
    stroke: var(--text);
    stroke-width: 3px;
    vector-effect: non-scaling-stroke;
  }
  .mark circle,
  .mark path {
    fill: none;
    stroke: var(--text);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }
  .mark circle {
    stroke-dasharray: 4 3;
  }
  .hit {
    position: absolute;
    width: min(44px, var(--u));
    height: min(44px, var(--u));
    transform: translate(-50%, -50%);
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: grab;
    touch-action: none;
  }
  .board.circle .hit {
    width: 44px;
    height: 44px;
  }
  .hit:disabled {
    cursor: default;
  }
  .hit.dragging {
    outline: 2px dashed var(--focus-ring);
    cursor: grabbing;
  }
  .hit:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .tools {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  .status {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .what {
    margin-inline-end: 4px;
  }
  .reason:empty {
    display: none;
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
  .control.small {
    padding: 0;
  }
  .control:disabled {
    cursor: default;
  }
  .setting {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
  }
  select {
    min-height: 44px;
    min-width: 44px;
    max-width: 100%;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
  }
  .control:focus-visible,
  select:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .hit {
      transition: none;
    }
  }
</style>
