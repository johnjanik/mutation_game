<script lang="ts">
  // The phase-0 island (plan; superseded in phase 1 by T1 inside ToolFrame). It holds the state
  // {board, coords: 'populations', start, moves} of SPEC.md 4.0 and 6.6, recomputes positions with
  // the engine (one engine call per move, 7.4), and composes Board, History, the polite live region
  // of A-4 and the <noscript> line of 7.4. Free play: every city may be mutated, no legality test.
  // Island properties beyond the common set of 4.0 Configuration: `boardName` (stands in for
  // `board`, because a Board object carries functions and cannot be serialised) and `name` (the
  // accessible name of the board group). Moves are labels; Board reports positions (E-7).
  import { boardFromName, mutate, toLabels, toPositions } from '@engine';
  import type { AnyBoard, Board as EngineBoard } from '@engine';
  import Board from './Board.svelte';
  import History from './History.svelte';
  import { announceTemplates, createAnnouncer, moveAnnouncement, speakList } from '@lib/a11y';
  import { shortcutOf } from './keyboard';
  import { rowLayout } from './layout';

  interface Props {
    id: string;
    boardName: string;
    start: number[];
    moves?: number[];
    name?: string;
  }

  let { id, boardName, start, moves: initialMoves = [], name }: Props = $props();

  type Position = readonly unknown[];

  function setUp(): { anyBoard: AnyBoard; board: EngineBoard<unknown>; positions: Position[]; moves: number[] } {
    const anyBoard = boardFromName(boardName);
    const board = anyBoard as EngineBoard<unknown>;
    const first: Position = start.map((v) => board.arith.fromInt(v));
    const positions: Position[] = [first];
    const moves = [...initialMoves];
    for (const label of moves) {
      const k = toPositions(anyBoard, [label])[0]!; // throws RangeError on a label not on the board
      positions.push(mutate(board, positions[positions.length - 1]!, k));
    }
    return { anyBoard, board, positions, moves };
  }

  const initial = setUp();
  const anyBoard = initial.anyBoard; // for the label functions and Board's prop
  const board = initial.board; // the same object, typed for generic engine calls
  let moves = $state<number[]>(initial.moves);
  let positions = $state.raw<Position[]>(initial.positions);
  let cursor = $state(initial.moves.length);

  let hydrated = $state(false);
  let region: HTMLDivElement | undefined = $state();
  let announce: (text: string) => void = () => {};

  $effect(() => {
    if (region) announce = createAnnouncer(region);
    hydrated = true;
  });

  const layout = rowLayout(board);
  const show = (p: Position): string[] => p.map((v) => board.arith.show(v));
  const values = $derived(show(positions[cursor]!));
  const canAct = $derived(values.map(() => true));
  const positionNames = $derived(
    positions.map((p, k) => (k === 0 ? `Start: populations ${speakList(show(p))}` : `After move ${k}: populations ${speakList(show(p))}`)),
  );

  function act(position: number): void {
    const label = toLabels(anyBoard, [position])[0]!;
    const before = positions[cursor]!;
    const after = mutate(board, before, position);
    moves = [...moves.slice(0, cursor), label];
    positions = [...positions.slice(0, cursor + 1), after];
    cursor = cursor + 1;
    announce(moveAnnouncement('Mutated', board.labels, label, show(before), show(after), cursor));
  }

  function announceArrival(to: number, from: number): void {
    if (to < from) {
      announce(announceTemplates.undid(to + 1, show(positions[to]!), 'populations'));
    } else if (to > from) {
      announce(moveAnnouncement('Mutated', board.labels, moves[to - 1]!, show(positions[to - 1]!), show(positions[to]!), to));
    }
  }

  function scrub(to: number): void {
    if (to < 0 || to > moves.length || to === cursor) return;
    const from = cursor;
    cursor = to;
    announceArrival(to, from);
  }

  const undo = (): void => scrub(cursor - 1);
  const redo = (): void => scrub(cursor + 1);

  function reset(): void {
    if (moves.length === 0) return;
    const from = cursor;
    moves = [];
    positions = [positions[0]!];
    cursor = 0;
    announceArrival(0, from);
  }

  function onKeydown(event: KeyboardEvent): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo();
    else redo();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="seed"
  {id}
  data-tool="board"
  data-moves={cursor}
  data-hydrated={hydrated ? 'true' : undefined}
  style="--k: {layout.columns}; --rows: {layout.rows};"
  onkeydown={onKeydown}
>
  <Board
    board={anyBoard}
    {values}
    game="mutation"
    {canAct}
    onAct={act}
    name={name ?? `Board ${boardName}, Populations view`}
  />
  <History
    total={moves.length}
    {cursor}
    {positionNames}
    {hydrated}
    onUndo={undo}
    onRedo={redo}
    onReset={reset}
    onScrub={scrub}
  />
  <p class="nojs"><noscript>Interactive when scripts are allowed.</noscript></p>
  <div class="visually-hidden" id="{id}-status" role="status" aria-live="polite" aria-atomic="true" bind:this={region}></div>
</div>

<style>
  /* The reserved box (SPEC.md 7.6): every row has a fixed height, and the total is written here,
     so the server HTML already has the size the hydrated island will have. */
  .seed {
    --u: min(64px, (100cqw - 16px) / var(--k));
    position: relative;
    display: grid;
    grid-template-rows: auto 108px 24px;
    gap: 12px;
    width: 100%;
    height: calc(var(--rows) * var(--u) + 16px + 12px + 108px + 12px + 24px);
    box-sizing: border-box;
  }
  @supports (width: round(down, 10.5px, 1px)) {
    .seed {
      --u: min(64px, round(down, (100cqw - 16px) / var(--k), 1px));
    }
  }
  .nojs {
    margin: 0;
    height: 24px;
    font-size: 14px;
    line-height: 24px;
    text-align: center;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
</style>
