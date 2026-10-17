<script lang="ts">
  // T15, the Affine Playground (SPEC.md 4 T15, 2.12, 2.3, 2.9, 4.0, 5.6, 6.6, 7.4, 7.5, Appendix A.6 and
  // E item 6). The numbers game and the mutation game on the 44 affine boards of SPEC 4 T15, with four
  // configurations (CONTRACTS 6): `frozen` (the marks as a population; one Martian wakes the board),
  // `marks-comarks` (the two null vectors side by side), `pentagon` (the 1986 Olympiad puzzle in its own
  // form, with the switch to the site's convention and the level meter) and `three-fates` (a start, its
  // level, and the fate `play on` reports). Composed of the board family (P1-A2's ToolFrame, Board,
  // History, Predict) and T1's helpers (long numbers), as T9 is: T01GameBoard renders its own ToolFrame
  // with data-tool="board" and reads links as tool `board`, so it cannot be nested here (decisions/P1-A7.md).
  // Every value comes from the engine: boardFromName, classify (once per board object), marks, comarks,
  // level, toNumbers, legalNodes, fire, mutate, applyWord, isRootPopulation, and playFate through
  // engineCall, which always runs it in the worker (E-9 rule 2). The default state of every tab renders
  // at build time and needs neither playFate nor the worker. The Olympiad's form is display only:
  // state, links and exports stay in the site's convention (D7, D8).
  //
  // Properties (CONTRACTS 5.2; every name is listed in site/tests/e2e/T15.spec.ts): id, board, coords,
  // start, moves, caption, preset ('default', 'frozen', 'marks-comarks', 'pentagon', 'three-fates'),
  // prediction, linkTo and layers (accepted and ignored: T15 follows no tool and grows no set), and the
  // plan property unverifiedMode ('marked' | 'fallback' | 'plain', default 'fallback'), decided at build
  // time by the page (t15/T15Route.astro applies the rule of <Unverified>).
  import { untrack } from 'svelte';
  import { CAPS, boardFromName, classify, comarks as comarksOf, isRootPopulation, level as levelOf, marks as marksOf, toLabels } from '@two-games/engine';
  import type { Board as EngineBoard, ClassifyRecord } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import Predict from '../board/Predict.svelte';
  import { shortcutOf } from '../board/keyboard';
  import { displayValue } from '../board/sign';
  import { decodeState, encodeState, LINK_NOTICE } from '../../lib/urlCodec';
  import { firstForbiddenMove, integerOut, labelOrder, type ToolState } from '../../lib/state';
  import { engineCall } from '../../lib/worker';
  import { announceTemplates, moveAnnouncement, speak, type NodeState } from '../../lib/a11y';
  import type { Prediction } from '../../tools/types';
  import { isLong, shortValue } from './t01/longNumber';
  import { AFFINE_BOARD_GROUPS, AFFINE_BOARDS } from './t15/boards';
  import { PRESETS, TAB_TEXT, tabOfPreset, type PresetId } from './t15/presets';
  import { provenanceOf, reportText, rowOf, type FateStatus, type Provenance, type UnverifiedMode } from './t15/fate';
  import { olympiadSum, shownValues, type Convention } from './t15/convention';
  import { AffineGame, MAIN_THREAD_MOVES, byPosition, entryBig, inLabelOrder, isSymmetric, startFor, verdictText, withMartian, type Coords } from './t15/model';
  import Tabs from './t15/Tabs.svelte';
  import LevelMeter from './t15/LevelMeter.svelte';
  import FateReport from './t15/FateReport.svelte';
  import MarksComarks from './t15/MarksComarks.svelte';
  import StartEditor from './t15/StartEditor.svelte';
  import ConventionSwitch from './t15/ConventionSwitch.svelte';

  interface Props {
    id?: string;
    board?: string;
    coords?: Coords;
    start?: (number | string)[];
    moves?: number[];
    caption?: string;
    preset?: string;
    prediction?: Prediction;
    linkTo?: string;
    layers?: number;
    /** Plan: how a row resting on open item E6 is rendered (fate.ts); the release shape by default. */
    unverifiedMode?: UnverifiedMode;
  }

  let {
    id = '',
    board: boardProp,
    coords: coordsProp,
    start: startProp,
    moves: movesProp,
    caption: captionProp,
    preset,
    prediction,
    unverifiedMode = 'fallback',
  }: Props = $props();

  const instanceId = untrack(() => id);
  const where = `T15 instance "${untrack(() => id) || 'affine'}"`;
  const BASE = import.meta.env.BASE_URL;

  // ------------------------------------------------------------------------------------------
  // Boards: built once per name, classified once per board object (5.6, last sentence).
  // ------------------------------------------------------------------------------------------

  interface BoardInfo {
    name: string;
    board: EngineBoard<bigint>;
    records: ClassifyRecord[];
    verdict: string;
    /** By position. */
    marks: number[];
    comarks: number[];
    symmetric: boolean;
    provenance: Provenance;
  }
  const infos = new Map<string, BoardInfo>();
  function info(name: string): BoardInfo {
    const known = infos.get(name);
    if (known !== undefined) return known;
    if (!AFFINE_BOARDS.includes(name)) throw new RangeError(`${name} is not a board the Affine Playground offers`);
    const board = boardFromName(name) as EngineBoard<bigint>;
    const records = classify(board);
    const made: BoardInfo = {
      name,
      board,
      records,
      verdict: verdictText(records),
      marks: marksOf(board),
      comarks: comarksOf(board),
      symmetric: isSymmetric(board),
      provenance: provenanceOf(board),
    };
    infos.set(name, made);
    return made;
  }

  const coordsOfTab = (t: PresetId): Coords => (t === 'frozen' ? 'populations' : 'numbers');

  /** A game for a tab and board: the preset's start on the preset's board, else the tool's default for that board. */
  function gameFor(t: PresetId, name: string, start?: readonly (number | string)[], moves?: readonly number[]): AffineGame {
    const inf = info(name);
    const p = PRESETS[t].state;
    const coords = coordsOfTab(t);
    const s = start ?? (name === p.board && p.start !== undefined ? p.start : startFor(coords, inf.board, inf.marks));
    return new AffineGame(inf.board, { coords, start: s, moves: moves ?? [] });
  }

  // ------------------------------------------------------------------------------------------
  // The author's configuration, read once (4.0 Configuration). An inconsistent one throws at build time.
  // ------------------------------------------------------------------------------------------

  const initialTab: PresetId = untrack(() => tabOfPreset(preset) ?? (coordsProp === 'numbers' ? 'three-fates' : 'frozen'));
  const authored = untrack(() => {
    const p = PRESETS[initialTab].state;
    const name = boardProp ?? p.board;
    if (!AFFINE_BOARDS.includes(name)) throw new Error(`${where}: the board ${name} is not offered (SPEC 4 T15)`);
    if (initialTab === 'pentagon' && name !== 'pentagon') throw new Error(`${where}: the pentagon preset is played on the pentagon`);
    if (initialTab !== 'marks-comarks' && coordsProp !== undefined && coordsProp !== coordsOfTab(initialTab)) {
      throw new Error(`${where}: the ${initialTab} preset uses coords ${coordsOfTab(initialTab)}`);
    }
    return { name, game: initialTab === 'marks-comarks' ? null : gameFor(initialTab, name, startProp, movesProp) };
  });

  let tab = $state<PresetId>(initialTab);
  let boardName = $state<string>(authored.name);
  let game = $state.raw<AffineGame | null>(authored.game);
  let version = $state(0);
  let convention = $state<Convention>(initialTab === 'pentagon' ? 'olympiad' : 'site');
  let report = $state<{ status: FateStatus; moves: number; firstVisit?: number } | null>(null);
  let notice = $state<string | null>(null);
  let busy = $state(false);
  let martianCity = $state<number | null>(null);
  let predictionResolved = $state(untrack(() => prediction === undefined));
  let loadToken = 0;

  const touch = (): void => {
    version++;
  };
  function cur(): AffineGame | null {
    void version;
    return game;
  }

  function stateOf(t: PresetId, name: string, g: AffineGame | null): ToolState {
    if (t === 'marks-comarks' || g === null) return { schema: 1, tool: 'affine', board: name };
    return g.state(name);
  }

  const defaults: ToolState = untrack(() => stateOf(initialTab, authored.name, authored.game));
  const toolState = $derived(stateOf(tab, boardName, cur()));

  // ------------------------------------------------------------------------------------------
  // What the figure shows, all from the engine
  // ------------------------------------------------------------------------------------------

  const inf = $derived(info(boardName));
  const anyBoard = $derived(inf.board);
  const frozen = $derived(!predictionResolved);
  const labelsInOrder = $derived(labelOrder(anyBoard));
  const caption = $derived(tab === initialTab && captionProp !== undefined ? captionProp : PRESETS[tab].caption);
  const shownConvention: Convention = $derived(tab === 'pentagon' ? convention : 'site');
  const isNumbers = $derived(tab === 'pentagon' || tab === 'three-fates');

  /** The current position by position (populations in `frozen`, numbers otherwise). */
  const current = $derived.by(() => cur()?.current ?? null);
  /** The numbers a (= C p in `frozen`) at the cursor, in the site's convention. */
  const numbersNow = $derived.by(() => {
    const g = cur();
    return g === null ? null : g.numbersAt(g.cursor);
  });
  const values = $derived.by(() => {
    if (current === null) return [] as string[];
    return isNumbers ? shownValues(current, shownConvention).map(String) : current.map(String);
  });
  const atLinkCap = $derived((cur()?.cursor ?? 0) >= CAPS.linkMoves);
  const legal = $derived.by(() => {
    const g = cur();
    if (g === null || !isNumbers) return [] as number[];
    return g.legalNow();
  });
  const canAct = $derived.by(() => {
    const n = anyBoard.n;
    if (frozen || busy || atLinkCap || current === null) return Array.from({ length: n }, () => false);
    if (!isNumbers) return Array.from({ length: n }, () => true);
    const set = new Set(legal);
    return Array.from({ length: n }, (_, k) => set.has(k));
  });

  /** Moods of the cities (2.16): the sign of a_i = (C p)_i from toNumbers. */
  const moodStates: (NodeState | null)[] | undefined = $derived.by(() => {
    if (isNumbers || numbersNow === null) return undefined;
    return numbersNow.map((x) => (x < 0n ? 'mutation would raise it' : x > 0n ? 'mutation would lower it' : 'mutation would change nothing'));
  });
  const moodsText = $derived.by(() => {
    if (isNumbers || numbersNow === null) return '';
    const unhappy = numbersNow.filter((x) => x < 0n).length;
    const manic = numbersNow.filter((x) => x > 0n).length;
    const happy = numbersNow.length - unhappy - manic;
    if (unhappy === 0 && manic === 0) return 'Every city is happy: a mutation anywhere would change nothing.';
    const c = (k: number, word: string): string => `${k} ${k === 1 ? 'city' : 'cities'} ${word}`;
    return `${c(unhappy, 'unhappy')} (a mutation would raise them), ${c(happy, 'happy')}, ${c(manic, 'manic')} (a mutation would lower them).`;
  });

  /** The root test of the start after a Martian (2.12, 2.11; 5.6: null is "too large to test here"). */
  const rootTest = $derived.by(() => {
    const g = cur();
    if (tab !== 'frozen' || g === null) return null;
    const startPos = byPosition(anyBoard, g.start.map(entryBig));
    if (startPos.every((x, k) => x === BigInt(inf.marks[k]!))) return null;
    const r = isRootPopulation(anyBoard, startPos);
    return r === null ? 'too large to test here' : r ? 'The start is a root population.' : 'The start is not a root population.';
  });

  const levelText = $derived(numbersNow === null ? '0' : levelOf(anyBoard, numbersNow).toString());
  const levelSign = $derived((levelText.startsWith('-') ? -1 : levelText === '0' ? 0 : 1) as -1 | 0 | 1);
  const zeroPosition = $derived(numbersNow !== null && numbersNow.every((x) => x === 0n));
  const row = $derived(rowOf(levelSign, zeroPosition));
  const sumText = $derived(tab === 'pentagon' && convention === 'olympiad' && numbersNow !== null ? olympiadSum(numbersNow).toString() : null);
  const gameOverText = $derived(isNumbers && current !== null && legal.length === 0 ? announceTemplates.gameOver(cur()!.cursor) : '');

  const marksInOrder = $derived(inLabelOrder(anyBoard, inf.marks));
  const comarksInOrder = $derived(inLabelOrder(anyBoard, inf.comarks));
  const valuesInOrder = $derived(inLabelOrder(anyBoard, values));
  const startTexts = $derived((cur()?.start ?? []).map((x) => String(x)));

  const spokenNow = $derived(valuesInOrder.map((v) => speak(v)));
  const figureLabel = $derived(
    tab === 'marks-comarks'
      ? `Affine Playground on ${boardName}, marks and comarks: marks ${marksInOrder.join(', ')}; comarks ${comarksInOrder.join(', ')}.`
      : `Affine Playground on ${boardName}, ${TAB_TEXT[tab].toLowerCase()}: ${isNumbers ? 'numbers' : 'populations'} ${spokenNow.join(', ')}.`,
  );

  /** Exact digits in the tooltip for long values (4.0 Long numbers). */
  const tooltip = (vs: readonly string[]) => (k: number): string | null => (vs[k] !== undefined && isLong(vs[k]!) ? vs[k]! : null);
  const display = (v: string): string => displayValue(v);
  const shown = (v: string): string => (isLong(v) ? shortValue(v) : displayValue(v));

  /** The values of index k of the history in label order, as shown, for the strip and the announcements. */
  function shownAt(g: AffineGame, k: number): string[] {
    const v = g.positionAt(k) ?? [];
    const out = isNumbers ? shownValues(v, shownConvention) : v;
    return inLabelOrder(anyBoard, out.map(String));
  }

  const positionNames = $derived.by(() => {
    const g = cur();
    if (g === null) return [] as string[];
    const total = g.moves.length;
    const noun = isNumbers ? 'numbers' : 'populations';
    const name = (k: number): string => `${k === 0 ? 'Start' : `After move ${k}`}: ${noun} ${shownAt(g, k).map((v) => speak(v)).join(', ')}`;
    if (total + 1 <= 50) return Array.from({ length: total + 1 }, (_, k) => name(k));
    const sparse: string[] = new Array(total + 1).fill('');
    sparse[g.cursor] = name(g.cursor);
    return sparse;
  });

  // ------------------------------------------------------------------------------------------
  // Loading a state: tabs, the picker, the start, a link, the back button
  // ------------------------------------------------------------------------------------------

  function commit(t: PresetId, name: string, g: AffineGame | null): void {
    loadToken++;
    tab = t;
    boardName = name;
    game = g;
    report = null;
    busy = false;
    if (g === null || martianCity === null || !g.labels.includes(martianCity)) martianCity = null;
    touch();
  }

  function selectTab(t: PresetId): void {
    if (frozen || t === tab) return;
    const p = PRESETS[t].state;
    notice = null;
    convention = t === 'pentagon' ? 'olympiad' : 'site';
    commit(t, p.board, t === 'marks-comarks' ? null : gameFor(t, p.board));
  }

  function pickBoard(name: string, announce: (t: string) => void): void {
    if (frozen || !AFFINE_BOARDS.includes(name)) return;
    notice = null;
    commit(tab, name, tab === 'marks-comarks' ? null : gameFor(tab, name));
    announce(`Board ${name}.`);
  }

  function setStartEntry(k: number, text: string): void {
    const g = game;
    if (g === null || frozen) return;
    const next = [...g.start];
    next[k] = integerOut(BigInt(text));
    commit(tab, boardName, new AffineGame(anyBoard, { coords: g.coords, start: next }));
  }

  function addMartian(announce: (t: string) => void): void {
    if (frozen || game === null) return;
    const city = martianCity ?? labelsInOrder[0]!;
    const start = withMartian(anyBoard, inf.marks, city);
    const keep = city;
    commit('frozen', boardName, new AffineGame(anyBoard, { coords: 'populations', start }));
    martianCity = keep;
    announce(`One Martian added in city ${city}. Populations now ${start.map((x) => speak(x)).join(', ')}.`);
  }

  function frozenStart(announce: (t: string) => void): void {
    if (frozen || game === null) return;
    commit('frozen', boardName, gameFor('frozen', boardName, startFor('populations', anyBoard, inf.marks)));
    announce(`Frozen population. Populations now ${marksInOrder.join(', ')}.`);
  }

  /** applyWord in the worker for a stretch of more than 2000 moves (E-9 rule 2). */
  function farRunner(b: EngineBoard<bigint>) {
    return async (v: bigint[], word: number[], g: 'firing' | 'mutation'): Promise<bigint[]> =>
      (await engineCall('applyWord', [b, v, word, g] as never, { board: b, kind: 'play', moves: word.length })) as bigint[];
  }

  function hasKey(search: string, key: string): boolean {
    const prefix = instanceId === '' ? '' : instanceId.endsWith('.') ? instanceId : `${instanceId}.`;
    try {
      return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).has(prefix + key);
    } catch {
      return false;
    }
  }

  /** The tab a link opens (plan): coords populations opens `frozen`, numbers `three-fates` (or `pentagon` on its own instance). */
  function tabForState(s: ToolState): PresetId {
    if (s.coords === 'populations') return 'frozen';
    if (s.coords === 'numbers') return initialTab === 'pentagon' && s.board === 'pentagon' ? 'pentagon' : 'three-fates';
    return 'marks-comarks';
  }

  function loadDefaults(): void {
    convention = initialTab === 'pentagon' ? 'olympiad' : 'site';
    commit(initialTab, authored.name, initialTab === 'marks-comarks' ? null : gameFor(initialTab, authored.name, startProp, movesProp));
  }

  /**
   * Applies a state read from a link (6.6). The codec has checked it; T15 adds rule 6 for the numbers
   * tabs, whose hand play is legal play (a move must fire a positive number), and puts the marks back as
   * the start when a link names a board for the frozen population without a start (4.0 Board pickers).
   * Long move lists are checked and replayed in the worker (E-9 rule 2).
   */
  async function loadLink(s: ToolState, n: string | null, search: string): Promise<void> {
    if (n !== null) {
      notice = n;
      loadDefaults();
      return;
    }
    const token = ++loadToken;
    try {
      const name = typeof s.board === 'string' ? s.board : '';
      const nextTab = tabForState(s);
      const b = info(name).board;
      if (nextTab === 'marks-comarks') {
        notice = null;
        commit(nextTab, name, null);
        return;
      }
      const coords = coordsOfTab(nextTab);
      // A link that names no start keeps the author's start on the author's board, else the tool's
      // default for the board: the marks in `frozen`, all ones for numbers (4.0 Board pickers; plan).
      let start: (number | string)[];
      if (hasKey(search, 's') && s.start !== undefined) start = s.start;
      else if (defaults.board === name && defaults.coords === coords && defaults.start !== undefined) start = defaults.start;
      else start = startFor(coords, b, info(name).marks);
      const moves = s.moves ?? [];
      if (coords === 'numbers' && moves.length > 0) {
        const check: ToolState = { schema: 1, tool: 'affine', board: name, coords, start: [...start], moves: [...moves], mode: 'legal' };
        const bad =
          moves.length > MAIN_THREAD_MOVES
            ? await engineCall('firstForbiddenMove', [b, check] as never, { board: b, kind: 'play', moves: moves.length })
            : firstForbiddenMove(b, check);
        if (bad !== null) throw new RangeError('a move the legal play forbids');
      }
      const g = new AffineGame(b, { coords, start, moves });
      if (!g.cheap(g.cursor)) {
        busy = true;
        await g.positionAtAsync(g.cursor, farRunner(b));
      }
      if (token !== loadToken) return;
      notice = null;
      convention = nextTab === 'pentagon' ? 'olympiad' : 'site';
      commit(nextTab, name, g);
    } catch {
      if (token !== loadToken) return;
      notice = LINK_NOTICE;
      loadDefaults();
    }
  }

  // Hydration: read the URL once with the instance prefix (6.6). Never a move by itself (4.0).
  $effect(() => {
    untrack(() => {
      try {
        const search = window.location.search;
        const { state: decoded, notice: n } = decodeState(search, 'affine', defaults, { prefix: instanceId });
        if (n !== null || encodeState(decoded) !== encodeState(defaults)) void loadLink(decoded, n, search);
      } catch {
        // decodeState never throws on a bad link; a failure here leaves the default state.
      }
    });
  });

  // ------------------------------------------------------------------------------------------
  // Moves: hand play, step, play on, the history
  // ------------------------------------------------------------------------------------------

  function sentenceOfMove(label: number, before: string[], after: string[], move: number): string {
    return moveAnnouncement(isNumbers ? 'Fired' : 'Mutated', labelsInOrder, label, before.map((v) => speak(v)), after.map((v) => speak(v)), move);
  }

  function act(position: number, announce: (t: string) => void): void {
    const g = game;
    if (g === null || frozen || busy) return;
    if (!canAct[position]) {
      const label = toLabels(anyBoard, [position])[0]!;
      if (isNumbers) announce(announceTemplates.cannotFire(label, speak(values[position]!)));
      return;
    }
    const before = valuesInOrder;
    const label = g.act(position);
    report = null;
    touch();
    let sentence = sentenceOfMove(label, before, shownAt(g, g.cursor), g.cursor);
    if (isNumbers && g.legalNow().length === 0) sentence += ` ${announceTemplates.gameOver(g.cursor)}`;
    announce(sentence);
  }

  function step(announce: (t: string) => void): void {
    if (legal.length > 0) act(legal[0]!, announce);
  }

  async function playOn(announce: (t: string) => void): Promise<void> {
    const g = game;
    if (g === null || frozen || busy || !isNumbers) return;
    const from = g.cursor;
    const cap = CAPS.playMoves - from;
    if (cap < 1) return;
    const a = g.numbersAt(from);
    const token = loadToken;
    busy = true;
    try {
      // E-9 rule 2: playFate runs in the worker, always; the hint says so before the call (5.6).
      const r = await engineCall('playFate', [g.board, a, undefined, cap] as never, { board: g.board, kind: 'play', moves: CAPS.playMoves, finiteKnown: false });
      if (token !== loadToken || game !== g || g.cursor !== from) return;
      const result = r as unknown as { status: FateStatus; moves: number; word: number[]; position: bigint[]; firstVisit?: number };
      g.appendPlay(result.word, result.position);
      const total = from + result.moves;
      report = result.firstVisit !== undefined ? { status: result.status, moves: total, firstVisit: from + result.firstVisit } : { status: result.status, moves: total };
      touch();
      const now = shownAt(g, g.cursor).map((v) => speak(v));
      if (result.status === 'ended') announce(announceTemplates.playedToEnd(result.moves, now));
      else announce(`Played ${result.moves === 1 ? '1 move' : `${result.moves} moves`}; ${reportText(result.status, total)}. Numbers now ${now.join(', ')}.`);
    } catch (e) {
      notice = e instanceof Error ? e.message : String(e);
    } finally {
      if (token === loadToken) busy = false;
    }
  }

  async function moveTo(to: number, announce: (t: string) => void): Promise<void> {
    const g = game;
    if (g === null || frozen || busy) return;
    const from = g.cursor;
    if (to === from || to < 0 || to > g.moves.length) return;
    if (!g.moveTo(to)) {
      const token = loadToken;
      busy = true;
      try {
        await g.moveToAsync(to, farRunner(g.board));
      } finally {
        if (token === loadToken) busy = false;
      }
      if (token !== loadToken) return;
    }
    report = null;
    touch();
    const noun = isNumbers ? 'numbers' : 'populations';
    const now = shownAt(g, g.cursor);
    if (to < from) announce(announceTemplates.undid(to + 1, now.map((v) => speak(v)), noun));
    else announce(sentenceOfMove(g.moves[to - 1]!, shownAt(g, to - 1), now, to));
  }

  function undo(announce: (t: string) => void): void {
    const g = game;
    if (g === null || frozen || busy || g.cursor === 0) return;
    const from = g.cursor;
    g.undo();
    report = null;
    touch();
    announce(announceTemplates.undid(from, shownAt(g, g.cursor).map((v) => speak(v)), isNumbers ? 'numbers' : 'populations'));
  }

  function redo(announce: (t: string) => void): void {
    const g = game;
    if (g === null || frozen || busy || g.cursor >= g.moves.length) return;
    void moveTo(g.cursor + 1, announce);
  }

  function reset(announce: (t: string) => void): void {
    const g = game;
    if (g === null || frozen || busy) return;
    const from = g.cursor;
    if (!g.reset()) return;
    report = null;
    touch();
    if (from > 0) announce(announceTemplates.undid(1, shownAt(g, 0).map((v) => speak(v)), isNumbers ? 'numbers' : 'populations'));
  }

  function onKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo(announce);
    else redo(announce);
  }

  // ------------------------------------------------------------------------------------------
  // Download data (6.6): the state in the site's convention and the tables shown on screen
  // ------------------------------------------------------------------------------------------

  function exportData(): Record<string, unknown> {
    const g = game;
    const out: Record<string, unknown> = {
      tab,
      board: boardName,
      verdict: inf.verdict,
      labels: labelsInOrder,
      marks: marksInOrder,
      comarks: comarksInOrder,
    };
    if (g !== null) {
      const pos = inLabelOrder(anyBoard, g.current).map((x) => integerOut(x));
      out[g.coords] = pos;
      out.level = integerOut(BigInt(levelText));
      if (tab === 'pentagon') {
        out.convention = convention;
        out.shown = inLabelOrder(anyBoard, shownValues(g.current, convention)).map((x) => integerOut(x));
        out.olympiadSum = integerOut(olympiadSum(numbersNow ?? []));
      }
      out.report = report === null ? null : reportText(report.status, report.moves);
      if (report?.firstVisit !== undefined) out.firstVisit = report.firstVisit;
    }
    return out;
  }
</script>

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t15" data-board-name={boardName} onkeydown={(e) => onKeydown(e, api.announce)}>
    <Tabs current={tab} disabled={!api.hydrated || frozen || busy} onSelect={selectTab} />
    <p class="line">
      Board <span data-out="boardName">{boardName}</span>: <span data-out="verdict">{inf.verdict}</span>.
    </p>
    {#if prediction}
      <Predict {prediction} hydrated={api.hydrated} labels={labelsInOrder} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    {#if tab === 'marks-comarks'}
      <MarksComarks board={anyBoard} name={boardName} marks={inf.marks} comarks={inf.comarks} symmetric={inf.symmetric} />
    {:else}
      {#if tab === 'pentagon'}
        <ConventionSwitch {convention} disabled={!api.hydrated || frozen} onToggle={() => (convention = convention === 'olympiad' ? 'site' : 'olympiad')} />
      {/if}
      <div class="board-host">
        <Board
          board={anyBoard}
          {values}
          game={isNumbers ? 'firing' : 'mutation'}
          {canAct}
          name="{isNumbers ? 'Numbers' : 'Populations'} board on {boardName}"
          states={moodStates}
          disabled={frozen}
          hintFor={tooltip(values)}
          onAct={(k) => act(k, api.announce)}
        />
      </div>
      {#if tab === 'frozen'}
        <p class="line" data-out="moods">{moodsText}</p>
        <p class="line" data-out="rootTest">{rootTest ?? ''}</p>
      {:else}
        <LevelMeter level={levelText} sum={sumText} />
        <p class="line" data-out="gameOver">{gameOverText}</p>
        <FateReport {report} {row} level={levelText} provenance={inf.provenance} mode={unverifiedMode} baseUrl={BASE} />
      {/if}
      <p class="line" data-out="busy" aria-hidden={busy ? undefined : 'true'}>{busy ? 'Computing in the background.' : ''}</p>
      <History
        total={cur()?.moves.length ?? 0}
        cursor={cur()?.cursor ?? 0}
        {positionNames}
        hydrated={api.hydrated}
        frozen={frozen || busy}
        onUndo={() => undo(api.announce)}
        onRedo={() => redo(api.announce)}
        onReset={() => reset(api.announce)}
        onScrub={(to) => void moveTo(to, api.announce)}
      />
    {/if}
  </div>
{/snippet}

{#snippet controls(api: FrameApi)}
  {#if isNumbers}
    <button type="button" class="control" data-control="step" disabled={!api.hydrated || frozen || busy || legal.length === 0 || atLinkCap} onclick={() => step(api.announce)}
      >Step</button
    >
    <button
      type="button"
      class="control"
      data-control="playOn"
      disabled={!api.hydrated || frozen || busy || (cur()?.cursor ?? 0) >= CAPS.playMoves}
      onclick={() => void playOn(api.announce)}>Play on</button
    >
  {/if}
  {#if tab === 'frozen'}
    <label class="setting">
      <span>Martian's city</span>
      <select
        data-control="martianCity"
        disabled={!api.hydrated || frozen || busy}
        onchange={(e) => (martianCity = Number((e.currentTarget as HTMLSelectElement).value))}
      >
        {#each labelsInOrder as l (l)}
          <option value={l} selected={(martianCity ?? labelsInOrder[0]) === l}>{l}</option>
        {/each}
      </select>
    </label>
    <button type="button" class="control" data-control="martian" disabled={!api.hydrated || frozen || busy} onclick={() => addMartian(api.announce)}
      >Add one Martian</button
    >
    <button type="button" class="control" data-control="frozenStart" disabled={!api.hydrated || frozen || busy} onclick={() => frozenStart(api.announce)}
      >Frozen population</button
    >
  {/if}
  {#if tab !== 'pentagon'}
    <label class="setting">
      <span>Board</span>
      <select data-control="picker" disabled={!api.hydrated || frozen || busy} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value, api.announce)}>
        {#each AFFINE_BOARD_GROUPS as g (g.label)}
          <optgroup label={g.label}>
            {#each g.names as name (name)}
              <option value={name} selected={boardName === name}>{name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
  {/if}
  {#if tab === 'three-fates' && cur() !== null}
    <StartEditor labels={labelsInOrder} values={startTexts} disabled={!api.hydrated || frozen || busy} onChange={setStartEntry} />
  {/if}
{/snippet}

{#snippet table(api: FrameApi)}
  {#if tab === 'marks-comarks'}
    <table class="values">
      <caption>Marks and comarks of {boardName}, in label order</caption>
      <thead>
        <tr>
          <th scope="col">Node</th>
          {#each labelsInOrder as l (l)}
            <th scope="col">
              <button type="button" class="cell" data-table-node={l} disabled={!api.hydrated}
                onclick={() => api.announce(`Node ${l}: mark ${marksInOrder[labelsInOrder.indexOf(l)]}, comark ${comarksInOrder[labelsInOrder.indexOf(l)]}.`)}>{l}</button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        <tr><th scope="row">Marks</th>{#each marksInOrder as m, j (j)}<td class="numeral">{m}</td>{/each}</tr>
        <tr><th scope="row">Comarks</th>{#each comarksInOrder as c, j (j)}<td class="numeral">{c}</td>{/each}</tr>
      </tbody>
    </table>
  {:else}
    <table class="values">
      <caption>{isNumbers ? 'Nodes' : 'Cities'} of {boardName} after {cur()?.cursor ?? 0} {(cur()?.cursor ?? 0) === 1 ? 'move' : 'moves'}</caption>
      <thead>
        <tr>
          <th scope="col">{isNumbers ? 'Node' : 'City'}</th>
          <th scope="col">{isNumbers ? (shownConvention === 'olympiad' ? 'Number (Olympiad form)' : 'Number') : 'Population'}</th>
          {#if !isNumbers}<th scope="col">Number</th>{/if}
          <th scope="col">{isNumbers ? 'May be fired' : 'Mood'}</th>
        </tr>
      </thead>
      <tbody>
        {#each labelsInOrder as l, j (l)}
          {@const k = anyBoard.labels.indexOf(l)}
          <tr data-row={l}>
            <th scope="row">
              <button
                type="button"
                class="cell"
                data-table-node={l}
                disabled={!api.hydrated || frozen || busy}
                aria-label="{isNumbers ? `Fire node ${l}, value` : `Mutate city ${l}, population`} {speak(valuesInOrder[j] ?? '0')}"
                onclick={() => act(k, api.announce)}>{isNumbers ? 'Node' : 'City'} {l}</button
              >
            </th>
            <td class="numeral" data-table-value="value">{display(valuesInOrder[j] ?? '0')}</td>
            {#if !isNumbers}
              <td class="numeral" data-table-value="number">{display(String(inLabelOrder(anyBoard, numbersNow ?? [])[j] ?? 0n))}</td>
            {/if}
            <td>
              {#if isNumbers}{canAct[k] ? 'yes' : 'no'}{:else}{(moodStates?.[k] ?? '').replace('mutation would raise it', 'unhappy').replace('mutation would change nothing', 'happy').replace('mutation would lower it', 'manic')}{/if}
            </td>
          </tr>
        {/each}
        {#if isNumbers}
          <tr data-row="level"><th scope="row">Level</th><td class="numeral" data-table-value="level">{display(levelText)}</td><td></td></tr>
        {/if}
      </tbody>
    </table>
  {/if}
{/snippet}

<ToolFrame
  toolId="affine"
  {instanceId}
  title="Affine Playground"
  {caption}
  state={toolState}
  {defaults}
  {notice}
  {figureLabel}
  boardName={boardName}
  derivedForExport={exportData}
  onPopState={(s, n) => void loadLink(s, n, typeof window === 'undefined' ? '' : window.location.search)}
  {figure}
  {controls}
  {table}
/>

<style>
  .t15 {
    display: grid;
    gap: 8px;
  }
  .line {
    margin: 0;
    min-height: 1.5em;
  }
  .board-host {
    position: relative;
  }
  .numeral {
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
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
    max-width: 100%;
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
