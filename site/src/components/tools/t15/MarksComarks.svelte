<script lang="ts">
  // Marks and comarks side by side (SPEC.md 2.12, 4 T15 "Marks and comarks side by side, on a board where
  // they differ"), stacked under a narrow width (A-11). Left: the marks as a population, the frozen
  // population fixed by every mutation (Populations accent and icon, 8.3). Right: the comarks as the
  // weights of the level, which no firing changes (Numbers accent and icon). Both vectors come from the
  // engine (marks, comarks), by position, and are printed in label order. No play in this tab: the
  // node buttons act on nothing. Hooks: data-out="marks", "comarks" (comma-separated, label order),
  // "coincide".
  import type { Board as EngineBoard } from '@two-games/engine';
  import Board from '../../board/Board.svelte';
  import { NUMBERS_ICON, POPULATIONS_ICON } from '../../draw/palette';
  import { inLabelOrder } from './model';

  interface Props {
    board: EngineBoard<bigint>;
    name: string;
    /** By position. */
    marks: readonly number[];
    /** By position. */
    comarks: readonly number[];
    symmetric: boolean;
  }

  let { board, name, marks, comarks, symmetric }: Props = $props();

  const noState = $derived(Array.from({ length: board.n }, () => null));
  const none = $derived(Array.from({ length: board.n }, () => false));
  const marksText = $derived(inLabelOrder(board, marks).join(','));
  const comarksText = $derived(inLabelOrder(board, comarks).join(','));
</script>

{#snippet icon(i: typeof POPULATIONS_ICON)}
  <svg class="icon" viewBox={i.viewBox} width="16" height="16" aria-hidden="true" focusable="false"><path d={i.d} stroke={i.stroke} fill={i.fill} /></svg>
{/snippet}

<div class="pair">
  <section class="panel populations" aria-label="Marks of {name}">
    <p class="panel-title">{@render icon(POPULATIONS_ICON)} Marks: the frozen population</p>
    <Board {board} values={marks.map(String)} game="mutation" canAct={none} states={noState} name="Marks of {name}, as a population" onAct={() => {}} />
    <p class="line">
      The positive integer vector <math><mi>δ</mi></math> with <math><mi>C</mi><mi>δ</mi><mo>=</mo><mn>0</mn></math>. As a population it is fixed by every mutation: every city is exactly balanced by its neighbours.
      Marks in label order: <span class="numeral" data-out="marks">{marksText}</span>.
    </p>
  </section>
  <section class="panel numbers" aria-label="Comarks of {name}">
    <p class="panel-title">{@render icon(NUMBERS_ICON)} Comarks: the weights of the level</p>
    <Board {board} values={comarks.map(String)} game="firing" canAct={none} states={noState} name="Comarks of {name}, as weights" onAct={() => {}} />
    <p class="line">
      The positive integer vector <math><mi>c</mi></math> with <math><msup><mi>c</mi><mi>T</mi></msup><mi>C</mi><mo>=</mo><mn>0</mn></math>. The level of a position, <math><mo>∑</mo><msub><mi>c</mi><mi>i</mi></msub><msub><mi>a</mi><mi>i</mi></msub></math>, is unchanged by every firing.
      Comarks in label order: <span class="numeral" data-out="comarks">{comarksText}</span>.
    </p>
  </section>
</div>
<p class="line" data-out="coincide">
  {symmetric ? 'The Cartan matrix of this board is symmetric, so here the marks and the comarks coincide.' : 'Here the marks and the comarks differ.'}
  On simply laced boards marks and comarks coincide. On the others they differ, and reversing all roads exchanges them.
</p>

<style>
  .pair {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  }
  .panel {
    min-width: 0;
    padding: 8px 0;
    border-top: 4px solid;
    container-type: inline-size;
  }
  /* The accents mark the panels' borders and icons, never a node's fill (8.3). */
  .populations {
    border-top-color: var(--accent-populations);
  }
  .numbers {
    border-top-color: var(--accent-numbers);
  }
  .panel-title {
    margin: 0 0 4px;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .icon {
    flex: 0 0 auto;
  }
  .line {
    margin: 4px 0 0;
  }
  .numeral {
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
  }
</style>
