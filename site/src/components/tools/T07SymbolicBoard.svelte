<script lang="ts">
  // The right board of T7, the Symbolic Game (SPEC.md 4 T7, 4.0, 6.1 to 6.3, 7.5 A-1 to A-7, A-12).
  // The same moves as the left board, played from the letters x_1, ..., x_n: each entry is a linear form.
  // Board.svelte draws a numeral on each node and its data-value is a decimal (4.0), neither of which
  // fits a form, so this sub-component (P3-A5, README 6: T07*.svelte) draws the board from the parts of
  // the board family: the layout of draw/layouts.ts, the size rule of 6.1 in the same CSS as Board, the
  // roads of Roads.svelte and the arrow-key model of keyboard.ts. The forms themselves are listed under
  // the drawing with LinearForm.svelte (MathML), one line per node, so that a long form never covers a
  // neighbour. The board only follows: its node buttons are real buttons in one tab stop (A-1) with
  // aria-disabled="true" and data-can-act="false"; activating one changes nothing.
  //
  // Hooks: on each button data-node (label), data-board="numbers", data-value (the coefficients in label
  // order joined by commas, for example 2,1), data-can-act="false", data-sign (positive, negative, zero
  // or mixed); on each line of the list data-entry (label) and data-form (the same coefficients).
  import { toLabels, toPositions } from '@two-games/engine';
  import type { AnyBoard } from '@two-games/engine';
  import Roads from '../board/Roads.svelte';
  import LinearForm, { formSpoken } from '../math/LinearForm.svelte';
  import { nodePositions } from '../draw/layouts';
  import { MARGIN, toPixels } from '../draw/geometry';
  import { arrowTarget, isArrowKey } from '../board/keyboard';

  interface Props {
    board: AnyBoard;
    /** The entry at each position: its coefficients, indexed by position. */
    entries: readonly (readonly number[])[];
    /** The sign of each entry (by position): 1, -1, or 0 when the coefficients do not share one sign. */
    signs: readonly (-1 | 0 | 1)[];
    /** The accessible name of the group (A-1). */
    name: string;
  }

  let { board, entries, signs, name }: Props = $props();

  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  const REF_UNIT = 64;
  const REF_POLYGON_W = 360;
  const layout = $derived(nodePositions(board));
  const px = $derived(toPixels(layout, layout.circle ? REF_POLYGON_W : 2 * MARGIN + layout.columns * REF_UNIT));
  const centres = $derived(
    px.centres.map(([x, y]) =>
      layout.circle ? ([x / REF_UNIT, y / REF_UNIT] as [number, number]) : ([(x - MARGIN) / REF_UNIT, (y - MARGIN) / REF_UNIT] as [number, number]),
    ),
  );
  const viewW = $derived(layout.circle ? px.width / REF_UNIT : layout.columns);
  const viewH = $derived(layout.circle ? px.height / REF_UNIT : layout.rows);
  const positions = $derived(Array.from({ length: board.n }, (_, k) => k));
  /** Positions in increasing label order (the order of the list of forms). */
  const byLabel = $derived(toPositions(board, [...board.labels].sort((a, b) => a - b)));

  const lowestLabelPosition = $derived(toPositions(board, [Math.min(...board.labels)])[0]!);
  let focused = $state<number | null>(null);
  const tabStop = $derived(focused !== null && focused < board.n ? focused : lowestLabelPosition);
  const buttons: (HTMLButtonElement | undefined)[] = [];

  /** The coefficients of an entry in label order, joined by commas (the hook of data-value). */
  const valueText = (k: number): string => byLabel.map((p) => String(entries[k]![p])).join(',');
  const signWord = (k: number): string => (signs[k] === 1 ? 'positive' : signs[k] === -1 ? 'negative' : entries[k]!.every((c) => c === 0) ? 'zero' : 'mixed');
  /** A-3 on the right board (plan wording): "Node 2, form x 1 plus x 2"; it never acts. */
  const nameOf = (k: number): string => `Node ${toLabels(board, [k])[0]}, form ${formSpoken(entries[k]!, board.labels)}`;

  function onKeydown(event: KeyboardEvent, k: number): void {
    if (!isArrowKey(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const from = toLabels(board, [k])[0]!;
    const to = arrowTarget(layout, board.labels, from, event.key);
    const target = toPositions(board, [to])[0]!;
    focused = target;
    buttons[target]?.focus();
  }
</script>

<div class="board" class:circle={layout.circle} style="--k: {layout.columns}; --rows: {layout.rows};">
  <svg class="drawing" viewBox="0 0 {viewW} {viewH}" aria-hidden="true" focusable="false">
    <Roads {board} xy={centres} unit={1} />
    {#each positions as k (k)}
      <g class="node {signs[k] === 1 ? 'sign-pos' : signs[k] === -1 ? 'sign-neg' : 'sign-zero'}">
        <circle class="disc" cx={centres[k]![0]} cy={centres[k]![1]} r={0.25} />
        <text class="sign" x={centres[k]![0]} y={centres[k]![1]} font-size={0.26} text-anchor="middle" dominant-baseline="central"
          >{signs[k] === 1 ? '+' : signs[k] === -1 ? '−' : ''}</text
        >
        <text class="label" x={centres[k]![0] + 0.33} y={centres[k]![1] - 0.3} font-size={0.2} text-anchor="start" dominant-baseline="central"
          >{board.labels[k]}</text
        >
      </g>
    {/each}
  </svg>
  <div class="hits" role="group" aria-label={name} data-board-group>
    {#each positions as k (k)}
      <button
        type="button"
        bind:this={buttons[k]}
        class="hit"
        style="left: {(centres[k]![0] / viewW) * 100}%; top: {(centres[k]![1] / viewH) * 100}%;"
        tabindex={k === tabStop ? 0 : -1}
        disabled={!hydrated}
        aria-disabled="true"
        aria-label={nameOf(k)}
        data-node={board.labels[k]}
        data-board="numbers"
        data-value={valueText(k)}
        data-can-act="false"
        data-sign={signWord(k)}
        onfocus={() => (focused = k)}
        onkeydown={(event) => onKeydown(event, k)}
      ></button>
    {/each}
  </div>
</div>
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<ul class="entries" aria-label="Entries of the symbolic board" tabindex="0">
  {#each byLabel as k (k)}
    <li data-entry={board.labels[k]} data-form={valueText(k)}>
      <span class="entry-label">Node {board.labels[k]}:</span>
      <LinearForm coeffs={entries[k]!} labels={board.labels} />
    </li>
  {/each}
</ul>

<style>
  /* The size rule of SPEC 6.1, as in Board.svelte (the box is reserved in the server HTML, 7.6). */
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
    cursor: default;
  }
  .board.circle .hit {
    width: 44px;
    height: 44px;
  }
  .entries:focus-visible,
  .hit:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  /* Sign of an entry by fill and glyph as well as colour (6.3, A-5): positive filled, negative outlined. */
  .disc {
    stroke-width: 2.5px;
    vector-effect: non-scaling-stroke;
  }
  .sign-pos .disc {
    fill: var(--sign-pos-fill);
    stroke: var(--sign-pos-fill);
  }
  .sign-neg .disc {
    fill: none;
    stroke: var(--sign-neg-outline);
  }
  .sign-zero .disc {
    fill: none;
    stroke: var(--sign-zero-outline);
  }
  .sign {
    font-family: var(--font-numerals);
    fill: var(--text);
  }
  .sign-pos .sign {
    fill: var(--sign-pos-numeral);
  }
  .label {
    font-family: var(--font-prose);
    fill: var(--text);
  }
  .entries {
    display: grid;
    gap: 2px;
    margin: 4px 8px 0;
    padding: 0;
    list-style: none;
    overflow-x: auto;
  }
  .entries li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-height: 1.6em;
  }
  .entry-label {
    flex: 0 0 auto;
  }
</style>
