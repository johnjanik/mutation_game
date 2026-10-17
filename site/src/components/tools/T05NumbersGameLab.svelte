<script lang="ts">
  // T5, the Numbers Game Lab (SPEC.md 4 T5, 2.7 F3 F4 F6 to F10, 4.0, 6.6, 7.4, 7.5; Appendix A.2, A.3).
  // Legal play of the numbers game on the 32 named finite types from a chosen start, with the tape, the
  // tally read sideways into the exponents, the wave, two games compared and the dimension calculator.
  // Built on P1-A2's ToolFrame and the Board family (Board, History, Predict); every move and every
  // value comes from the engine through the pure modules of t05/. The default state of every preset is
  // computed in this script, so the server render writes it (4.0, 7.4); the island never needs the
  // worker (every play has at most N <= 120 moves, E-9).
  //
  // Properties (CONTRACTS 5.2; every name is listed in site/tests/e2e/T05.spec.ts): id, board, coords
  // (numbers only), start, moves, caption, preset (default, tally, wave, compared, dimension),
  // prediction, linkTo (ignored: T5 follows no tool), layers (ignored: T5 grows no set of positions),
  // and T5's own: tab, lambda (also a state field), firstColour, secondMoves, boardChoices.
  import { untrack } from 'svelte';
  import { coxeterNumber } from '@two-games/engine';
  import type { AnyBoard } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import Predict from '../board/Predict.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { nodePositions } from '../draw/layouts';
  import { MARGIN, toPixels } from '../draw/geometry';
  import { decodeState, encodeState } from '../../lib/urlCodec';
  import { resolveBoard, type BoardSpec, type ToolState } from '../../lib/state';
  import { announceTemplates } from '../../lib/a11y';
  import type { Prediction } from '../../tools/types';
  import { moveSentence, playSentence, refusalSentence, spokenValue, undoSentence } from './t01/announce';
  import { isLong, shortValue } from './t01/longNumber';
  import { NumbersGame, fundamentalIndex, fundamentalStart, inLabelOrder, isOnes, onesStart, readStartEntry, startKindOf, type StartKind } from './t05/game';
  import { TALLY_NOTE, groupOrder, longestBar, readsSideways, sidewaysReading, sidewaysRows, tallyOf } from './t05/tally';
  import { colourClasses, waveNote, waveOf, waveProgress, type Colour } from './t05/wave';
  import { AGREE_TEXT, compareGames } from './t05/compare';
  import { DIMENSION_FAILED, LAMBDA_DIGITS, dimensionOf, readLambdaEntry, validLambda } from './t05/dimension';
  import { TABS, isPresetId, presetOptions, presetSecondMoves, presetState, presetCaption, type Tab } from './t05/presets';
  import { admitLink, t05State } from './t05/link';
  import { exportPayload } from './t05/derived';
  import { pickerGroups } from './t05/boards';
  import {
    compareSentence,
    dimensionSentence,
    exponentsSentence,
    gameBSentence,
    roundSentence,
    singleMoveWaveSentence,
    startSentence,
    waveEndSentence,
  } from './t05/announce';

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
    /** T5: the tab shown first (outside the link, 6.6). */
    tab?: Tab;
    /** T5: lambda of the dimension calculator, one whole number per node in label order (state field `lambda`). */
    lambda?: number[];
    /** T5: the colour class that starts the wave (outside the link). */
    firstColour?: Colour;
    /** T5: game B's moves in "two games compared", labels (outside the link). */
    secondMoves?: number[];
    /** T5: the boards the picker offers (default: the 32 named types). */
    boardChoices?: string[];
  }

  let {
    id = '',
    board: boardProp,
    coords: coordsProp = 'numbers',
    start: startProp,
    moves: movesProp,
    caption: captionProp,
    preset: presetProp,
    prediction,
    tab: tabProp,
    lambda: lambdaProp,
    firstColour: firstColourProp,
    secondMoves: secondMovesProp,
    boardChoices,
  }: Props = $props();

  const instanceId = untrack(() => id);
  const choices = untrack(() => boardChoices);

  // The author's configuration, read once (4.0 Configuration): a preset, its board overridden by the
  // board property (start and moves then recomputed for that board), and the explicit properties.
  const author = untrack(() => {
    if (coordsProp !== 'numbers') throw new Error(`T5 instance "${instanceId || 'numbers'}": the start is a position of the numbers game (coords numbers)`);
    if (boardProp !== undefined && typeof boardProp !== 'string') throw new Error(`T5 instance "${instanceId || 'numbers'}": T5 offers only the named types`);
    const presetId = isPresetId(presetProp) ? presetProp : 'default';
    const p = presetState(presetId, boardProp);
    const options = presetOptions(presetId);
    const start = startProp ? [...startProp] : p.start;
    const moves = movesProp ? [...movesProp] : startProp ? [] : p.moves;
    const lambda = lambdaProp ? [...lambdaProp] : p.lambda;
    const n = resolveBoard(p.board).n;
    if (lambda !== undefined && !validLambda(lambda, n)) {
      throw new Error(`T5 instance "${instanceId || 'numbers'}": lambda must have ${n} whole numbers of at most ${LAMBDA_DIGITS} digits`);
    }
    const second = secondMovesProp ? [...secondMovesProp] : isOnes(start) ? presetSecondMoves(presetId, boardProp) : [];
    return {
      presetId,
      board: p.board,
      start,
      moves,
      lambda,
      second,
      tab: tabProp ?? options.tab,
      firstColour: firstColourProp ?? options.firstColour,
      caption: captionProp ?? presetCaption(presetId, boardProp),
    };
  });

  const defaults: ToolState = t05State({ board: author.board, start: author.start, moves: author.moves, lambda: author.lambda });
  const caption = author.caption;

  let game = $state.raw(new NumbersGame({ board: author.board, start: author.start, moves: author.moves }));
  let gameB = $state.raw(new NumbersGame({ board: author.board, start: author.start, moves: author.second }));
  let lambda = $state<number[] | undefined>(author.lambda);
  let lambdaDraft = $state<string[]>(untrack(() => (author.lambda ?? Array.from({ length: resolveBoard(author.board).n }, () => 0)).map(String)));
  let tab = $state<Tab>(untrack(() => author.tab));
  let firstColour = $state<Colour>(untrack(() => author.firstColour));
  let notice = $state<string | null>(null);
  let limit = $state<string | null>(null);
  let customOpen = $state(false);
  let customDraft = $state<string[]>([]);
  let fundamentalChoice = $state(0);
  let version = $state(0);
  let predictionResolved = $state(untrack(() => prediction === undefined));
  /**
   * The prediction is a question about the configured state (SPEC 4.0 Predict). A link or the back button
   * that loads another state before the reader has answered withdraws it (as T1 does), so that no question
   * stands over a board it does not describe.
   */
  let predictionWithdrawn = $state(false);

  const touch = (): void => {
    version++;
  };
  function cur(): NumbersGame {
    void version;
    return game;
  }
  function curB(): NumbersGame {
    void version;
    return gameB;
  }

  const frozen = $derived(!predictionResolved);
  const title = $derived(String(cur().spec));
  /** The named board itself (SafeInt), for the functions of the finite theory; the game may run on a Big copy. */
  const named: AnyBoard = $derived(resolveBoard(cur().spec));
  const n = $derived(named.n);
  const labelsInOrder = $derived([...named.labels].sort((a, b) => a - b));
  const shown = $derived(cur().shown);
  const canAct = $derived(frozen ? shown.map(() => false) : cur().canAct());
  const applied = $derived(cur().applied);
  const toolState: ToolState = $derived(t05State({ board: cur().spec, start: cur().start, moves: applied, lambda }));
  const lambdaEff = $derived(lambda ?? Array.from({ length: n }, () => 0));

  // Tape and tally (4 T5 "Tape", "Tally"; F7).
  const tape = $derived(cur().tape());
  const fired = $derived(tape.map((e) => e.value));
  const ended = $derived(cur().gameOver);
  const fromOnes = $derived(isOnes(cur().start));
  const bars = $derived(tallyOf(fired));
  const tallyMax = $derived(longestBar(bars));
  const sideways = $derived(readsSideways(fromOnes, ended));
  const reading = $derived(sideways ? sidewaysReading(fired, n) : null);
  const rows = $derived(sideways ? sidewaysRows(bars, n) : []);
  const order = $derived(groupOrder(named));
  const startKind: StartKind = $derived(customOpen ? 'custom' : startKindOf(cur().start));
  const fundamentalAt = $derived(fundamentalIndex(cur().start));

  // The wave (F8): one call of wavePlay, split into rounds.
  const wave = $derived(waveOf(named, firstColour));
  const progress = $derived(waveProgress(wave, fromOnes, applied));
  const classes = $derived(colourClasses(named));
  const h = $derived(coxeterNumber(named));
  const waveText = $derived(waveNote(wave, progress));
  const colourByPosition = $derived(Array.from({ length: n }, (_, k) => (classes[0].positions.includes(k) ? 0 : 1)));

  // Two games compared (F3).
  const firedB = $derived(curB().fired());
  const comparison = $derived(
    compareGames(
      { tape: fired, ended, end: cur().valuesInLabelOrder(), moves: applied.length },
      { tape: firedB, ended: curB().gameOver, end: curB().valuesInLabelOrder(), moves: curB().applied.length },
    ),
  );
  const canActB = $derived(frozen ? curB().shown.map(() => false) : curB().canAct());

  // The dimension calculator (F9): bigint products, the engine's weylDimension.
  const dim = $derived.by(() => {
    try {
      return dimensionOf(named, lambdaEff);
    } catch {
      return null;
    }
  });

  const display = (v: string): string => v.replace(/^-/, '−');
  const listText = (v: readonly string[]): string => v.map(display).join(', ');
  const tuple = (v: readonly string[]): string => `(${listText(v)})`;
  /** Exact digits in the tooltip for long values (4.0 Long numbers). */
  const tooltip = (values: readonly string[]) => (k: number): string | null => (isLong(values[k]!) ? values[k]! : null);

  const figureLabel = $derived(
    `Numbers Game Lab on ${title}: numbers ${inLabelOrder(named, shown).map(spokenValue).join(', ')} after ${applied.length} ${applied.length === 1 ? 'move' : 'moves'}.`,
  );

  const positionNames = $derived.by(() => {
    const g = cur();
    const out: string[] = [];
    for (let k = 0; k <= g.moves.length; k++) {
      out.push(`${k === 0 ? 'Start' : `After move ${k}`}: numbers ${g.valuesInLabelOrder(k).map(spokenValue).join(', ')}`);
    }
    return out;
  });

  // The wave's shapes over the board, in the same box and grid units as Board.svelte (6.1).
  const COLOURS: readonly Colour[] = [0, 1];
  const REF_UNIT = 64;
  const layout = $derived(nodePositions(named));
  const px = $derived(toPixels(layout, 2 * MARGIN + layout.columns * REF_UNIT));
  const centres = $derived(px.centres.map(([x, y]) => [(x - MARGIN) / REF_UNIT, (y - MARGIN) / REF_UNIT] as [number, number]));

  // The tally chart (drawn here in SVG; no chart library, 7.6).
  const COL = 28;
  const UNIT = 18;
  const chartW = $derived(Math.max(1, bars.length) * COL + 48);
  const chartH = $derived(Math.max(1, tallyMax) * UNIT + 44);
  const baseY = $derived(chartH - 24);

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a picker, a start)
  // ------------------------------------------------------------------------------------------

  function load(s: { board: string; start: (number | string)[]; moves: number[]; lambda?: number[] | undefined }, second: number[] = []): void {
    game = new NumbersGame({ board: s.board, start: s.start, moves: s.moves });
    gameB = new NumbersGame({ board: s.board, start: s.start, moves: second });
    lambda = s.lambda;
    lambdaDraft = (s.lambda ?? Array.from({ length: game.n }, () => 0)).map(String);
    limit = null;
    customOpen = false;
    touch();
  }

  function loadLink(decoded: ToolState, n0: string | null): void {
    const admitted = admitLink(decoded, n0, defaults);
    notice = admitted.notice;
    if (encodeState(admitted.state) === encodeState(toolState)) return;
    const s = admitted.state;
    const sameAsAuthor = encodeState(s) === encodeState(defaults);
    if (!sameAsAuthor && !predictionResolved) {
      predictionWithdrawn = true;
      predictionResolved = true;
    }
    load({ board: String(s.board), start: s.start ?? [], moves: s.moves ?? [], lambda: s.lambda }, sameAsAuthor ? author.second : []);
  }

  // Hydration: read the URL once with the instance prefix (6.6). Never a move by itself (4.0).
  $effect(() => {
    untrack(() => {
      try {
        const { state: decoded, notice: n0 } = decodeState(window.location.search, 'numbers', defaults, { prefix: instanceId });
        loadLink(decoded, n0);
      } catch {
        // decodeState never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  // ------------------------------------------------------------------------------------------
  // Actions on game A
  // ------------------------------------------------------------------------------------------

  /** The sentences a move appends when it ends the game (A-4 gameOver; the reading sideways, plan). */
  function endSentences(): string {
    const g = game;
    if (!g.gameOver) return '';
    let text = ` ${announceTemplates.gameOver(g.cursor)}`;
    if (isOnes(g.start)) {
      const r = sidewaysReading(g.fired(), g.n);
      text += ` ${exponentsSentence(r.exponents, r.product, groupOrder(resolveBoard(g.spec)))}`;
    }
    return text;
  }

  function act(position: number, announce: (t: string) => void): void {
    if (frozen) return;
    const before = game.shown;
    const r = game.act(position);
    if (r.kind === 'refused') {
      announce(refusalSentence('legal', r.label, r.number));
      return;
    }
    limit = null;
    touch();
    announce(moveSentence('numbers', game.labels, r.label, { populations: null, numbers: before }, { populations: null, numbers: game.shown }, game.cursor) + endSentences());
  }

  /** Step: in the wave tab, one round of the wave; elsewhere the lowest legal node (E-5). */
  function step(announce: (t: string) => void): void {
    if (frozen) return;
    if (tab === 'wave') {
      waveStep(announce);
      return;
    }
    const k = game.stepPosition();
    if (k !== null) act(k, announce);
  }

  function waveStep(announce: (t: string) => void): void {
    const p = progress;
    if (!p.follows || p.nextEnd === null) return;
    const word = wave.word.slice(game.cursor, p.nextEnd);
    game.appendWord(word.map((l) => game.labels.indexOf(l)));
    limit = null;
    touch();
    const now = game.valuesInLabelOrder();
    const said = wave.degenerate ? singleMoveWaveSentence(word[0]!, now) : roundSentence([...word].sort((a, b) => a - b), progress.roundsDone, now);
    announce(said + endSentences());
  }

  /** Play to the end: one engine call (play), or in the wave tab the rest of the wave's word. */
  function playToEnd(announce: (t: string) => void): void {
    if (frozen || ended) return;
    if (tab === 'wave') {
      const p = progress;
      if (!p.follows || p.nextEnd === null) return;
      const rest = wave.word.slice(game.cursor);
      game.appendWord(rest.map((l) => game.labels.indexOf(l)));
      touch();
      announce(wave.degenerate ? singleMoveWaveSentence(rest[0]!, game.valuesInLabelOrder()) : waveEndSentence(progress.roundsDone, game.cursor, game.valuesInLabelOrder()));
      return;
    }
    const outcome = game.playToEnd('lowest');
    limit = outcome.status === 'cap' ? `still running after ${outcome.moves} moves` : null;
    touch();
    announce(playSentence('numbers', 'legal', game.labels, outcome.moves, outcome.status, { populations: null, numbers: game.shown }));
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen) return;
    const from = game.cursor;
    if (!game.scrub(to)) return;
    limit = null;
    touch();
    const now = { populations: null, numbers: game.shownAt(to) };
    if (to < from) announce(undoSentence('numbers', game.labels, to + 1, now));
    else announce(moveSentence('numbers', game.labels, game.moves[to - 1]!, { populations: null, numbers: game.shownAt(to - 1) }, now, to));
  }

  const undo = (announce: (t: string) => void): void => scrub(game.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(game.cursor + 1, announce);

  function reset(announce: (t: string) => void): void {
    if (frozen) return;
    const from = game.cursor;
    if (!game.reset()) return;
    limit = null;
    touch();
    if (from > 0) announce(undoSentence('numbers', game.labels, 1, { populations: null, numbers: game.shownAt(0) }));
  }

  function onKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    if ((event.target as Element | null)?.closest?.('[data-game-b]')) return;
    event.preventDefault();
    if (action === 'undo') undo(announce);
    else redo(announce);
  }

  // ------------------------------------------------------------------------------------------
  // Game B (two games compared)
  // ------------------------------------------------------------------------------------------

  function actB(position: number, announce: (t: string) => void): void {
    if (frozen) return;
    const r = gameB.act(position);
    if (r.kind === 'refused') {
      announce(`Game B: ${refusalSentence('legal', r.label, r.number)}`);
      return;
    }
    touch();
    let text = gameBSentence(r.label, gameB.valuesInLabelOrder(), gameB.cursor);
    if (gameB.gameOver && game.gameOver) text += ` ${compareSentence(comparison.agree)}`;
    announce(text);
  }

  function stepB(announce: (t: string) => void): void {
    const k = gameB.stepPosition('highest');
    if (k !== null) actB(k, announce);
  }

  function playToEndB(announce: (t: string) => void): void {
    if (frozen || gameB.gameOver) return;
    const outcome = gameB.playToEnd('highest');
    touch();
    let text = `Game B: ${playSentence('numbers', 'legal', gameB.labels, outcome.moves, outcome.status, { populations: null, numbers: gameB.shown })}`;
    if (game.gameOver) text += ` ${compareSentence(comparison.agree)}`;
    announce(text);
  }

  function resetB(announce: (t: string) => void): void {
    if (frozen || !gameB.reset()) return;
    touch();
    announce(`Game B reset. Numbers now ${gameB.valuesInLabelOrder().map(spokenValue).join(', ')}.`);
  }

  // ------------------------------------------------------------------------------------------
  // Picker, start chooser, wave start, lambda
  // ------------------------------------------------------------------------------------------

  function pickBoard(name: string, announce: (t: string) => void): void {
    const b = resolveBoard(name);
    notice = null;
    load({ board: name, start: onesStart(b.n), moves: [] });
    fundamentalChoice = 0;
    announce(`Board ${name}. ${startSentence('ones', onesStart(b.n))}`);
  }

  function setStart(start: (number | string)[], kind: StartKind, announce: (t: string) => void, node?: number): void {
    notice = null;
    load({ board: String(game.spec), start, moves: [], lambda });
    announce(startSentence(kind, start, node));
  }

  function pickStartKind(kind: StartKind, announce: (t: string) => void): void {
    if (kind === 'ones') setStart(onesStart(n), 'ones', announce);
    else if (kind === 'fundamental') setStart(fundamentalStart(n, fundamentalChoice), 'fundamental', announce, labelsInOrder[fundamentalChoice]);
    else {
      customDraft = cur().start.map(String);
      customOpen = true;
    }
  }

  function pickFundamental(index: number, announce: (t: string) => void): void {
    fundamentalChoice = index;
    setStart(fundamentalStart(n, index), 'fundamental', announce, labelsInOrder[index]);
  }

  const customEntries = $derived(customDraft.map(readStartEntry));
  const customValid = $derived(customEntries.length === n && customEntries.every((e) => e !== null));

  function applyCustom(announce: (t: string) => void): void {
    if (!customValid) return;
    const start = customEntries as (number | string)[];
    setStart(start, startKindOf(start), announce);
  }

  function startWave(announce: (t: string) => void): void {
    if (frozen) return;
    notice = null;
    load({ board: String(game.spec), start: onesStart(n), moves: [], lambda });
    announce(`${startSentence('ones', onesStart(n))} The wave can start.`);
  }

  function pickColour(c: Colour, announce: (t: string) => void): void {
    firstColour = c;
    announce(`Colour class ${c} starts the wave.`);
  }

  function setLambdaEntry(index: number, text: string, input: HTMLInputElement, announce: (t: string) => void): void {
    const v = readLambdaEntry(text);
    if (v === null) {
      // The field refuses a negative entry or a seventh digit (plan): it returns to its last accepted text.
      if (text.trim() !== '') input.value = lambdaDraft[index] ?? '0';
      return;
    }
    const next = [...lambdaEff];
    next[index] = v;
    lambdaDraft = next.map(String);
    lambda = next;
    const d = dim;
    announce(d === null ? DIMENSION_FAILED : dimensionSentence(d.dimension));
  }

  function selectTab(t: Tab): void {
    if (frozen) return;
    tab = t;
  }

  /** The arrow keys of a tab list (WAI-ARIA tabs, automatic activation): Left, Right, Home, End. */
  function onTabKey(event: KeyboardEvent): void {
    const order = TABS.map((t) => t.id);
    const at = order.indexOf(tab);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (at + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (at + order.length - 1) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    if (next === null || frozen) return;
    event.preventDefault();
    selectTab(order[next]!);
    const list = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
    (list?.querySelector(`[data-tab="${order[next]}"]`) as HTMLElement | null)?.focus();
  }

  function exportData(): Record<string, unknown> {
    return exportPayload({
      game,
      tally: bars,
      reading,
      groupOrder: order,
      wave,
      waveProgress: progress,
      firstColour,
      gameB,
      comparison,
      dimension: dim,
      lambda: lambdaEff,
    });
  }
</script>

{#snippet shape(colour: Colour, x: number, y: number, s: number)}
  {#if colour === 0}
    <rect x={x - s} y={y - s} width={2 * s} height={2 * s} class="shape0" />
  {:else}
    <polygon points="{x},{y - s * 1.2} {x + s * 1.2},{y + s} {x - s * 1.2},{y + s}" class="shape1" />
  {/if}
{/snippet}

{#snippet cells(values: readonly string[])}
  {#each values as v, k (k)}<span class="cell">{display(v)}</span>{#if k < values.length - 1}<span class="sep">{', '}</span>{/if}{/each}
{/snippet}

{#snippet product(name: string, value: bigint, y: number)}
  <g class="product-line">
    {#if isLong(value.toString())}<title>{value.toString()}</title>{/if}
    <text x="8" {y} class="dim-text">{name}</text>
    <text x="8" y={y + 18} class="dim-num" data-out={name.startsWith('D') ? 'productRho' : 'productLambdaRho'} data-exact={value.toString()}>{shortValue(value.toString())}</text>
  </g>
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t05" data-board-name={title} onkeydown={(e) => onKeydown(e, api.announce)}>
    {#if prediction && !predictionWithdrawn}
      <Predict {prediction} hydrated={api.hydrated} labels={labelsInOrder} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    <p class="line" data-out="startKind" data-kind={startKindOf(cur().start)}>
      Start: {startKindOf(cur().start) === 'ones' ? 'all ones' : startKindOf(cur().start) === 'fundamental' ? `the fundamental weight of node ${labelsInOrder[fundamentalAt ?? 0]}` : 'custom'},
      <span class="numeral">{tuple(cur().valuesInLabelOrder(0))}</span>.
    </p>
    <div class="board-host">
      <Board
        board={cur().board}
        values={shown}
        game="firing"
        {canAct}
        name="Numbers game on {title}"
        disabled={frozen}
        hintFor={tooltip(shown)}
        onAct={(k) => act(k, api.announce)}
      />
      {#if tab === 'wave'}
        <div class="overlay" style="--k: {layout.columns}; --rows: {layout.rows};" aria-hidden="true">
          <svg viewBox="0 0 {layout.columns} {layout.rows}" focusable="false">
            {#each centres as [x, y], k (k)}
              <g data-colour-shape={colourByPosition[k] === 0 ? 'square' : 'triangle'} data-shape-node={named.labels[k]}>
                {@render shape(colourByPosition[k] as Colour, x - 0.32, y - 0.3, 0.07)}
              </g>
            {/each}
          </svg>
        </div>
      {/if}
    </div>
    <p class="line" data-out="gameOver">{ended ? announceTemplates.gameOver(applied.length) : ''}</p>
    <p class="line" data-out="limit">{limit ?? ''}</p>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div tabindex="0" role="group" aria-label="Tape" class="scrollbox tape-line">
      Tape: <span class="numeral" data-out="tape" data-count={fired.length}>{fired.length === 0 ? '' : listText(fired)}</span>{#if fired.length === 0}<span class="empty">no number fired yet</span>{/if}
    </div>
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
    <div class="tabs" role="tablist" aria-label="Views of the game">
      {#each TABS as t (t.id)}
        <button
          type="button"
          role="tab"
          class="tab"
          id="{instanceId || 'numbers'}-tab-{t.id}"
          aria-selected={tab === t.id ? 'true' : 'false'}
          aria-controls="{instanceId || 'numbers'}-panel"
          tabindex={tab === t.id ? 0 : -1}
          data-tab={t.id}
          data-control="tab"
          disabled={!api.hydrated || frozen}
          onclick={() => selectTab(t.id)}
          onkeydown={onTabKey}>{t.text}</button
        >
      {/each}
    </div>
    <div class="panel" role="tabpanel" id="{instanceId || 'numbers'}-panel" aria-labelledby="{instanceId || 'numbers'}-tab-{tab}" data-panel={tab}>
      {#if tab === 'tape'}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div tabindex="0" role="group" aria-label="Tape table" class="scrollbox">
          <table class="values">
            <caption>The tape: the number on each node just before it fired</caption>
            <thead><tr><th scope="col">Move</th><th scope="col">Node</th><th scope="col">Number fired</th></tr></thead>
            <tbody>
              {#each tape as e (e.move)}
                <tr><td class="numeral">{e.move}</td><td class="numeral">{e.label}</td><td class="numeral">{display(e.value)}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if tab === 'tally'}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div tabindex="0" role="group" aria-label="Tally chart" class="scrollbox chart-box" data-scroll="tally">
          <svg class="chart" width={chartW} height={chartH} viewBox="0 0 {chartW} {chartH}" role="img" aria-label="Tally: {bars.map((b) => `${spokenValue(b.value)} fired ${b.count} ${b.count === 1 ? 'time' : 'times'}`).join('; ') || 'no number fired yet'}">
            <line x1="20" y1={baseY} x2={chartW - 20} y2={baseY} class="axis" />
            {#each bars as b, j (b.value)}
              <g data-out="tallyBar" data-fired={b.value} data-count={b.count}>
                <rect x={24 + j * COL} y={baseY - b.count * UNIT} width={COL - 8} height={b.count * UNIT} class="bar" />
                <text x={24 + j * COL + (COL - 8) / 2} y={baseY + 16} class="bar-value" text-anchor="middle">{display(isLong(b.value) ? shortValue(b.value) : b.value)}</text>
                <text x={24 + j * COL + (COL - 8) / 2} y={baseY - b.count * UNIT - 4} class="bar-count" text-anchor="middle">{b.count}</text>
              </g>
            {/each}
            {#each rows as count, r (r)}
              <g class="row" data-row={r + 1}>
                <line x1="20" y1={baseY - (r + 0.5) * UNIT} x2={24 + count * COL - 8} y2={baseY - (r + 0.5) * UNIT} class="read" />
                <text x={28 + count * COL - 8} y={baseY - (r + 0.5) * UNIT + 4} class="read-text">{count}</text>
              </g>
            {/each}
          </svg>
        </div>
        {#if reading !== null}
          <p class="line">Read sideways, the rows give the exponents <span class="numeral" data-out="exponents">{reading.exponents.join(', ')}</span>.</p>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="scrollbox formula" tabindex="0" role="group" aria-label="Formula">
            <math>
              <mrow>
                <munder><mo>∏</mo><mi>i</mi></munder>
                <mo>(</mo><msub><mi>m</mi><mi>i</mi></msub><mo>+</mo><mn>1</mn><mo>)</mo>
                <mo>=</mo>
                {#each reading.factors as f, k (k)}{#if k > 0}<mo>·</mo>{/if}<mn>{f}</mn>{/each}
                <mo>=</mo>
                <mn>{reading.product}</mn>
              </mrow>
            </math>
          </div>
          <p class="line">
            Product <span class="numeral" data-out="exponentProduct">{reading.product}</span>; order of the group
            <span class="numeral" data-out="groupOrder">{order}</span>.
          </p>
        {:else}
          <p class="line" data-out="tallyNote">{TALLY_NOTE}</p>
        {/if}
      {:else if tab === 'wave'}
        <ul class="classes">
          {#each classes as c (c.colour)}
            <li data-out="colourClass" data-colour={c.colour} data-nodes={c.labels.join(',')}>
              <svg class="glyph" viewBox="-1 -1 2 2" width="16" height="16" aria-hidden="true" focusable="false">{@render shape(c.colour, 0, 0, 0.6)}</svg>
              Colour class {c.colour} ({c.colour === 0 ? 'squares' : 'triangles'}): {c.labels.length === 0 ? 'no node' : `${c.labels.length === 1 ? 'node' : 'nodes'} ${c.labels.join(', ')}`}
            </li>
          {/each}
        </ul>
        {#if wave.degenerate}
          <p class="line" data-out="waveNote">{waveText}</p>
        {:else}
          <fieldset class="colour-choice">
            <legend>Colour that starts</legend>
            {#each COLOURS as c (c)}
              <label class="radio">
                <input
                  type="radio"
                  name="{instanceId || 'numbers'}-colour"
                  value={c}
                  checked={firstColour === c}
                  data-control="firstColour"
                  disabled={!api.hydrated || frozen}
                  onchange={() => pickColour(c, api.announce)}
                />
                class {c}
              </label>
            {/each}
          </fieldset>
          <p class="line">
            Rounds: <span class="numeral" data-out="waveRounds">{progress.roundsDone}</span>; the Coxeter number is
            <span class="numeral" data-out="coxeterNumber">{h}</span>.
          </p>
          <p class="line" data-out="waveLegal" data-legal={wave.legal ? 'true' : 'false'}>{wave.legal ? 'Every firing of the wave is legal.' : 'Some firing of the wave is not legal.'}</p>
          {#if waveText !== null}
            <p class="line" data-out="waveNote">{waveText}</p>
            <button type="button" class="control" data-control="startWave" disabled={!api.hydrated || frozen} onclick={() => startWave(api.announce)}>Start the wave from all ones</button>
          {/if}
        {/if}
        <ol class="rounds">
          {#each wave.split.filter((r) => r.labels.length > 0).slice(0, progress.roundsDone) as r, k (k)}
            <li data-round={k + 1}>Round {k + 1}: {r.labels.length === 1 ? 'node' : 'nodes'} {[...r.labels].sort((a, b) => a - b).join(', ')}</li>
          {/each}
        </ol>
      {:else if tab === 'compared'}
        <div class="game-b" data-game-b="">
          <p class="line">Game B: the same start, played in its own order (step and play to the end take the highest node).</p>
          <Board
            board={curB().board}
            values={curB().shown}
            game="firing"
            canAct={canActB}
            name="Game B on {title}"
            disabled={frozen}
            hintFor={tooltip(curB().shown)}
            onAct={(k) => actB(k, api.announce)}
          />
          <div class="row-b">
            <button type="button" class="control" data-control="stepB" disabled={!api.hydrated || frozen || curB().gameOver} onclick={() => stepB(api.announce)}>Step B</button>
            <button type="button" class="control" data-control="playToEndB" disabled={!api.hydrated || frozen || curB().gameOver} onclick={() => playToEndB(api.announce)}>Play B to the end</button>
            <button type="button" class="control" data-control="resetB" disabled={!api.hydrated || frozen} onclick={() => resetB(api.announce)}>Reset B</button>
          </div>
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div tabindex="0" role="group" aria-label="Sorted tapes" class="scrollbox">
          <p class="line sorted">Game A sorted: <span class="numeral cells" data-out="sortedA">{@render cells(comparison.sortedA)}</span></p>
          <p class="line sorted">Game B sorted: <span class="numeral cells" data-out="sortedB">{@render cells(comparison.sortedB)}</span></p>
        </div>
        <p class="line" data-out="compareStatus">{comparison.status}</p>
        {#if comparison.agree}
          <p class="line agree" data-out="tapesAgree">{AGREE_TEXT}</p>
        {/if}
        <p class="line">
          Game A: <span class="numeral" data-out="movesA">{applied.length}</span> moves, now at <span class="numeral" data-out="endA">{tuple(cur().valuesInLabelOrder())}</span>.
        </p>
        <p class="line">
          Game B: <span class="numeral" data-out="movesB">{curB().applied.length}</span> moves, now at <span class="numeral" data-out="endB">{tuple(curB().valuesInLabelOrder())}</span>.
        </p>
      {:else}
        <fieldset class="lambda">
          <legend>λ, one whole number per node (at most {LAMBDA_DIGITS} digits, no negative number)</legend>
          {#each labelsInOrder as l, k (l)}
            <label class="lambda-field">
              <span>node {l}</span>
              <input
                type="text"
                inputmode="numeric"
                size="6"
                value={lambdaDraft[k] ?? '0'}
                data-control="lambda"
                data-lambda-node={l}
                disabled={!api.hydrated || frozen}
                oninput={(e) => setLambdaEntry(k, e.currentTarget.value, e.currentTarget, api.announce)}
              />
            </label>
          {/each}
        </fieldset>
        <p class="line">λ = <span class="numeral" data-out="lambda">{tuple(lambdaEff.map(String))}</span></p>
        {#if dim === null}
          <p class="line" data-out="dimensionNote">{DIMENSION_FAILED}</p>
        {:else}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div tabindex="0" role="group" aria-label="Tapes of the dimension calculator" class="scrollbox">
            <p class="line">Word of the game from ρ: <span class="numeral">{dim.word.join(', ')}</span></p>
            <p class="line">From ρ the numbers fired are <span class="numeral" data-out="tapeRho">{listText(dim.tapeRho)}</span></p>
            <p class="line">
              From λ + ρ = <span class="numeral">{tuple(dim.start)}</span> along the same word: <span class="numeral" data-out="tapeLambdaRho">{listText(dim.tapeLambdaRho)}</span>
            </p>
          </div>
          <svg class="dim-figure" width="320" height="96" viewBox="0 0 320 96" role="img" aria-label="Products: D from rho, M from lambda plus rho">
            {@render product('D, the product from ρ', dim.D, 16)}
            {@render product('M, the product from λ + ρ', dim.M, 58)}
          </svg>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="scrollbox formula" tabindex="0" role="group" aria-label="Formula">
            <math>
              <mrow>
                <mi mathvariant="normal">dim</mi><mo>&#x2061;</mo><mi>V</mi><mo>(</mo><mi>λ</mi><mo>)</mo>
                <mo>=</mo>
                <mfrac><mi>M</mi><mi>D</mi></mfrac>
                {#if !isLong(dim.M.toString())}
                  <mo>=</mo><mfrac><mn>{dim.M.toString()}</mn><mn>{dim.D.toString()}</mn></mfrac>
                {/if}
                <mo>=</mo>
                {#if isLong(dim.dimension.toString())}
                  <mtext>{shortValue(dim.dimension.toString())}</mtext>
                {:else}
                  <mn>{dim.dimension.toString()}</mn>
                {/if}
              </mrow>
            </math>
          </div>
          <!-- 4.0 Long numbers: shortened above 12 digits, the exact digits in the tooltip, the table and the export. -->
          <p class="line">Dimension: <span class="numeral" data-out="dimension" title={isLong(dim.dimension.toString()) ? dim.dimension.toString() : null}>{shortValue(dim.dimension.toString())}</span></p>
        {/if}
      {/if}
    </div>
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  {@const waveTab = tab === 'wave'}
  <!-- At the end of the game (or of the wave) the two controls are done but keep the focus the reader left
       on them: aria-disabled, the handlers doing nothing then; disabled only before hydration (7.4) and
       while a prediction freezes the board (A-1, WCAG 2.4.3). -->
  {@const done = !frozen && (ended || (waveTab && (!progress.follows || progress.nextEnd === null)))}
  <button
    type="button"
    class="control"
    data-control="step"
    disabled={!api.hydrated || frozen}
    aria-disabled={done ? 'true' : undefined}
    onclick={() => step(api.announce)}>{waveTab ? 'Step one round' : 'Step'}</button
  >
  <button
    type="button"
    class="control"
    data-control="playToEnd"
    data-play="end"
    disabled={!api.hydrated || frozen}
    aria-disabled={done ? 'true' : undefined}
    onclick={() => playToEnd(api.announce)}>Play to the end</button
  >
  <label class="setting">
    <span>Start</span>
    <select data-control="startKind" disabled={!api.hydrated || frozen} onchange={(e) => pickStartKind(e.currentTarget.value as StartKind, api.announce)}>
      <option value="ones" selected={startKind === 'ones'}>all ones</option>
      <option value="fundamental" selected={startKind === 'fundamental'}>a fundamental weight</option>
      <option value="custom" selected={startKind === 'custom'}>custom</option>
    </select>
  </label>
  {#if startKind === 'fundamental'}
    <label class="setting">
      <span>Node</span>
      <select data-control="fundamentalNode" disabled={!api.hydrated || frozen} onchange={(e) => pickFundamental(Number(e.currentTarget.value), api.announce)}>
        {#each labelsInOrder as l, k (l)}
          <option value={k} selected={(fundamentalAt ?? fundamentalChoice) === k}>{l}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if startKind === 'custom'}
    <span class="custom">
      {#each labelsInOrder as l, k (l)}
        <label class="lambda-field">
          <span>node {l}</span>
          <input type="text" inputmode="numeric" size="4" data-control="customEntry" data-entry-node={l} bind:value={customDraft[k]} disabled={!api.hydrated || frozen} />
        </label>
      {/each}
      <button type="button" class="control" data-control="customStart" disabled={!api.hydrated || frozen || !customValid} onclick={() => applyCustom(api.announce)}>Use this start</button>
    </span>
  {/if}
  <label class="setting">
    <span>Board</span>
    <select data-control="picker" disabled={!api.hydrated || frozen} onchange={(e) => pickBoard(e.currentTarget.value, api.announce)}>
      {#each pickerGroups(choices) as g (g.letter)}
        <optgroup label="Type {g.letter}" data-letter={g.letter}>
          {#each g.names as name (name)}
            <option value={name} selected={title === name}>{name}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </label>
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="values">
    <caption>Nodes of {title} after {cur().cursor} {cur().cursor === 1 ? 'move' : 'moves'}</caption>
    <thead><tr><th scope="col">Node</th><th scope="col">Number</th><th scope="col">Colour class</th></tr></thead>
    <tbody>
      {#each labelsInOrder as l, j (l)}
        {@const k = named.labels.indexOf(l)}
        <tr data-row={l}>
          <th scope="row">
            <button
              type="button"
              class="cell-button"
              data-table-node={l}
              disabled={!api.hydrated || frozen}
              aria-label="Fire node {l}, value {spokenValue(shown[k]!)}, {canAct[k] ? 'can be fired' : 'cannot be fired'}"
              onclick={() => act(k, api.announce)}>Node {l}</button
            >
          </th>
          <td class="numeral" data-table-value="number">{display(cur().valuesInLabelOrder()[j]!)}</td>
          <td>{colourByPosition[k]}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <table class="values">
    <caption>Tape</caption>
    <thead><tr><th scope="col">Move</th><th scope="col">Node</th><th scope="col">Number fired</th></tr></thead>
    <tbody>
      {#each tape as e (e.move)}<tr><td>{e.move}</td><td>{e.label}</td><td class="numeral">{display(e.value)}</td></tr>{/each}
    </tbody>
  </table>
  <table class="values">
    <caption>Tally{reading !== null ? `; exponents ${reading.exponents.join(', ')}, product ${reading.product}, order of the group ${order}` : ''}</caption>
    <thead><tr><th scope="col">Number fired</th><th scope="col">Times</th></tr></thead>
    <tbody>
      {#each bars as b (b.value)}<tr><td class="numeral">{display(b.value)}</td><td class="numeral">{b.count}</td></tr>{/each}
    </tbody>
  </table>
  <table class="values">
    <caption>The wave from all ones, colour class {firstColour} first{wave.degenerate ? ': a single move' : `: ${wave.rounds} rounds`}</caption>
    <thead><tr><th scope="col">Round</th><th scope="col">Colour class</th><th scope="col">Nodes</th></tr></thead>
    <tbody>
      {#each wave.split.filter((r) => r.labels.length > 0) as r, k (k)}<tr><td>{k + 1}</td><td>{r.colour}</td><td>{r.labels.join(', ')}</td></tr>{/each}
    </tbody>
  </table>
  <table class="values">
    <caption>Two games compared</caption>
    <tbody>
      <tr><th scope="row">Tape A</th><td class="numeral">{listText(fired)}</td></tr>
      <tr><th scope="row">Tape B</th><td class="numeral">{listText(firedB)}</td></tr>
      <tr><th scope="row">A sorted</th><td class="numeral">{listText(comparison.sortedA)}</td></tr>
      <tr><th scope="row">B sorted</th><td class="numeral">{listText(comparison.sortedB)}</td></tr>
    </tbody>
  </table>
  {#if dim !== null}
    <table class="values">
      <caption>Dimension for λ = {tuple(lambdaEff.map(String))}</caption>
      <tbody>
        <tr><th scope="row">Tape from ρ</th><td class="numeral">{listText(dim.tapeRho)}</td></tr>
        <tr><th scope="row">Tape from λ + ρ</th><td class="numeral">{listText(dim.tapeLambdaRho)}</td></tr>
        <tr><th scope="row">D</th><td class="numeral exact" data-table-exact="D">{dim.D.toString()}</td></tr>
        <tr><th scope="row">M</th><td class="numeral exact" data-table-exact="M">{dim.M.toString()}</td></tr>
        <tr><th scope="row">M / D</th><td class="numeral exact" data-table-exact="dimension">{dim.dimension.toString()}</td></tr>
      </tbody>
    </table>
  {/if}
{/snippet}

<ToolFrame
  toolId="numbers"
  {instanceId}
  title="Numbers Game Lab"
  {caption}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  boardName={title}
  derivedForExport={exportData}
  onPopState={(s, n0) => loadLink(s, n0)}
  {figure}
  {controls}
  {table}
/>

<style>
  .t05 {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  /* The answer field of a prediction keeps the tool within 320 pixels (A-11). */
  .t05 :global([data-prediction] input[type='text']) {
    width: 8em;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .numeral {
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
  }
  .board-host {
    position: relative;
  }
  .overlay {
    --u: min(64px, (100cqw - 16px) / var(--k));
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    box-sizing: content-box;
    width: calc(var(--k) * var(--u));
    height: calc(var(--rows) * var(--u));
    padding: 8px;
    margin-inline: auto;
    pointer-events: none;
  }
  @supports (width: round(down, 10.5px, 1px)) {
    .overlay {
      --u: min(64px, round(down, (100cqw - 16px) / var(--k), 1px));
    }
  }
  .overlay svg {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    overflow: visible;
  }
  .shape0 {
    fill: var(--text);
    stroke: var(--text);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  .shape1 {
    fill: var(--page);
    stroke: var(--text);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }
  .scrollbox {
    position: relative;
    max-width: 100%;
    overflow-x: auto;
    min-width: 0;
  }
  .tape-line {
    white-space: nowrap;
    min-height: 1.5em;
  }
  .empty {
    font-style: italic;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tab,
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
  .tab[aria-selected='true'] {
    border-width: 2px;
    font-weight: bold;
    text-decoration: underline;
  }
  .tab:disabled,
  .control:disabled,
  .control[aria-disabled='true'] {
    cursor: default;
  }
  .tab:focus-visible,
  .control:focus-visible,
  .cell-button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .panel {
    display: grid;
    gap: 8px;
    min-height: 120px;
  }
  /* Tally bars and tapes use a neutral token, neither a sign colour nor a view accent (plan, 8.3). */
  .bar {
    fill: var(--road);
    fill-opacity: 0.25;
    stroke: var(--road);
    stroke-width: 1.5px;
  }
  .axis {
    stroke: var(--text);
    stroke-width: 1px;
  }
  .read {
    stroke: var(--text);
    stroke-width: 1px;
    stroke-dasharray: 3 3;
  }
  .bar-value,
  .bar-count,
  .read-text,
  .dim-text,
  .dim-num {
    fill: var(--text);
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
    font-size: 13px;
  }
  .dim-num {
    font-size: 15px;
  }
  .classes,
  .rounds {
    margin: 0;
    padding-left: 1.5em;
  }
  .classes {
    list-style: none;
    padding-left: 0;
  }
  .classes li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .colour-choice,
  .lambda {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 4px 8px;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    min-width: 0;
  }
  .radio,
  .lambda-field,
  .setting {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .radio input {
    width: 24px;
    height: 24px;
    margin: 0;
  }
  input[type='text'] {
    min-height: 36px;
    min-width: 44px;
    font: inherit;
    font-family: var(--font-numerals);
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 4px;
    padding: 0 6px;
  }
  select {
    min-height: 44px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
  }
  .custom {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .game-b {
    display: grid;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--sign-zero-outline);
  }
  .row-b {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .sorted {
    white-space: nowrap;
  }
  .cells .cell {
    display: inline-block;
    min-width: 2.2ch;
    text-align: center;
  }
  .cells .sep {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .formula {
    overflow-x: auto;
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
  .exact {
    word-break: break-all;
    text-align: left;
  }
  .cell-button {
    min-width: 44px;
    min-height: 44px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
</style>
