<script lang="ts">
  // T13, the Satake Studio (SPEC.md 4 T13, 2.15, 4.0, 6.3, 6.4, 6.5, 6.6, 7.4, 7.5). Owner P6-A3. The reader
  // paints the nodes of a finite-type board black or white on a copy of the diagram drawn directly above the
  // game board, picks tau among the symmetries of order at most 2, and reads three lights (Kolb's conditions,
  // each judged on its own, each red light with its reason in words). When the pair is admissible the Studio
  // shows the name or names of the real form and its data, plays theta on a chosen root in three stages, draws
  // the shadows, draws the restricted board in Bourbaki order (a click plays the composite word on the big
  // board), and lists the catalogue of the board. Every value comes from the engine through t13/model.ts and
  // t13/load.ts; Satake data run where E-9 says (the worker on E7 and E8). The default state renders at build
  // time; the URL is read once on hydration (t13/link.ts: the codec, keys g, x and t only).
  //
  // Properties (CONTRACTS 5.2; listed in site/tests/e2e/T13.spec.ts): id, board, black, tau, root, caption,
  // preset, prediction; coords, start, moves, linkTo and layers are accepted and ignored. A board given
  // without black and tau is the split form on that board; properties override the preset's fields.
  import { untrack } from 'svelte';
  import { admissibility, shadow2, toLabels, toPositions } from '@two-games/engine';
  import type { Board as EngineBoard } from '@two-games/engine';
  import ToolFrame, { type FrameApi } from '../board/ToolFrame.svelte';
  import Board from '../board/Board.svelte';
  import History from '../board/History.svelte';
  import Predict from '../board/Predict.svelte';
  import { historyNames } from '../board/historyNames';
  import { shortcutOf } from '../board/keyboard';
  import { exampleLoaded } from '../../lib/history';
  import { announceTemplates, speakList } from '../../lib/a11y';
  import { encodeState } from '../../lib/urlCodec';
  import type { ToolState } from '../../lib/state';
  import type { Prediction } from '../../tools/types';
  import DecorationDiagram from './t13/DecorationDiagram.svelte';
  import RestrictedBoardView from './t13/RestrictedBoardView.svelte';
  import ShadowPicture from './t13/ShadowPicture.svelte';
  import RichText from './t13/RichText.svelte';
  import { T13_BOARDS, T13_EXAMPLES, T13_PANELS, T13_PRESETS, T13_PRESET_IDS, type T13Panel, type T13PresetId } from './t13/config';
  import {
    MINUS,
    T13_CONDITIONS,
    announceComposite,
    announcePaint,
    announceRestart,
    announceStage,
    announceTau,
    arrowsOf,
    assembleData,
    blackPairsOf,
    blackPhrase,
    boardOf,
    captionText,
    catalogueRows,
    coordinatesInBourbaki,
    defaultRoot,
    diagramOf,
    displayName,
    drawnPosition,
    exportData,
    failureNote,
    failureSentence,
    fromLabelOrder,
    halfText,
    inLabelOrder,
    intText,
    involutions,
    labelOrder,
    lights,
    listText,
    multiplicitiesText,
    orbitText,
    pairKey,
    pairsText,
    restrictedClick,
    restrictedNodeName,
    rootsOffered,
    shadowPoints,
    shadowRows,
    stageStep,
    tauFromLabels,
    tauPhrase,
    tauToLabels,
    vectorText,
    verdictTail,
    wordOfWX,
    type Assembled,
  } from './t13/model';
  import { computeNow, dataOnMainThread, fetchData, islandScript, pairJson, readIsland, type PairData } from './t13/load';
  import { admitLink, satakeStateOf, splitState, toolStateOf, type SatakeState } from './t13/link';
  import { loadNames, realFormAltHtml, realFormHtml } from './t13/names';

  interface Props {
    id?: string;
    board?: string;
    black?: number[];
    tau?: number[];
    root?: number[];
    caption?: string;
    preset?: string;
    prediction?: Prediction;
    coords?: unknown;
    start?: unknown;
    moves?: unknown;
    linkTo?: string;
    layers?: number;
  }

  let { id = '', board: boardProp, black: blackProp, tau: tauProp, root: rootProp, caption, preset, prediction }: Props = $props();

  // ------------------------------------------------------------------------------------------
  // The author's configuration, read once (CONTRACTS 5.2): properties over the preset's fields.
  // ------------------------------------------------------------------------------------------

  const instanceId = untrack(() => id);
  const where = instanceId || '(tool route)';
  /** An unknown preset id fails the build with the list of presets (as T8 does). */
  const presetId: T13PresetId = untrack(() => {
    if (preset === undefined) return 'default';
    if (!(T13_PRESET_IDS as readonly string[]).includes(preset)) throw new Error(`T13 instance ${where}: unknown preset ${preset} (presets: ${T13_PRESET_IDS.join(', ')})`);
    return preset as T13PresetId;
  });
  const presetFields = T13_PRESETS[presetId];

  /** The configured state; authoring errors fail the build with a message naming the instance (plan). */
  const authorState: SatakeState = untrack(() => {
    let s: SatakeState;
    if (boardProp !== undefined) {
      if (!T13_BOARDS.includes(boardProp)) throw new Error(`T13 instance ${where}: the board ${boardProp} is not one of the 32 named types`);
      const split = splitState(boardProp);
      s = { board: boardProp, black: blackProp ?? split.black, tau: tauProp ?? split.tau };
    } else {
      s = { board: presetFields.board, black: blackProp ?? presetFields.black, tau: tauProp ?? presetFields.tau };
    }
    const check = admitLink(encodeState(toolStateOf(s)), toolStateOf(splitState(s.board)), '');
    if (check.notice !== null) throw new Error(`T13 instance ${where}: black ${s.black.join('.')} and tau ${s.tau.join('.')} are not a decoration of ${s.board} (labels, tau of order at most 2)`);
    return satakeStateOf(check.state);
  });
  const defaults: ToolState = toolStateOf(authorState);

  const initialD = diagramOf(authorState.board, authorState.black, authorState.tau);
  const initialRoot: number[] = untrack(() => {
    const r = rootProp ?? (boardProp === undefined && presetFields.root !== undefined ? presetFields.root : undefined);
    if (r === undefined) return defaultRoot(initialD);
    const p = fromLabelOrder(initialD.board, r);
    if (!rootsOffered(initialD.board).some((x) => x.join(',') === p.join(','))) throw new Error(`T13 instance ${where}: the root ${r.join(',')} is not a root of ${authorState.board}`);
    return p;
  });
  const initialAdm = admissibility(initialD);
  const configuredKey = pairKey(authorState);
  const configuredOnMain = dataOnMainThread(initialD.board);
  /**
   * The server render and a main-thread board compute the data at once. On E7 and E8 (E-9) the server writes the
   * configured pair's data into the island and hydration reads them back (t13/load.ts), so that no default state
   * needs the worker; the worker is asked only after a change, or when the data are not in the page.
   */
  const fromIsland = import.meta.env.SSR || configuredOnMain ? null : readIsland(instanceId, configuredKey);
  const initialPair: PairData | null = import.meta.env.SSR || configuredOnMain ? computeNow(initialD, initialAdm) : (fromIsland?.data ?? null);
  /** The element that carries those data in the island, rendered by the server and adopted at hydration (E7, E8 only). */
  const islandHtml: string | null =
    configuredOnMain || initialPair === null ? null : islandScript(instanceId, configuredKey, fromIsland?.json ?? pairJson(initialPair));

  // ------------------------------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------------------------------

  /** One entry of the session's play on the game board (theta stages and composite moves; plan). */
  type Step =
    | { kind: 'stage'; stage: 1 | 2 | 3; population: number[]; frames: number[][] }
    | { kind: 'composite'; label: number; word: number[]; reducedLength: number; population: number[]; frames: number[][] };

  interface Play {
    start: number[];
    steps: Step[];
    cursor: number;
  }

  const keyOf = pairKey;

  let cfg = $state.raw<SatakeState>(authorState);
  let panel = $state<T13Panel>(untrack(() => presetFields.panel));
  let toggle = $state(untrack(() => presetFields.toggle));
  let notice = $state<string | null>(null);
  let pair = $state.raw<{ key: string; data: PairData } | null>(initialPair === null ? null : { key: configuredKey, data: initialPair });
  /** The pair whose data could not be computed, with the reason (a worker that failed); the next change asks again. */
  let failure = $state.raw<{ key: string; message: string } | null>(null);
  let play = $state.raw<Play>({ start: initialRoot, steps: [], cursor: 0 });
  let anim = $state.raw<{ frames: number[][]; index: number } | null>(null);
  let namesVersion = $state(0);
  let predictionResolved = $state(untrack(() => prediction === undefined));
  let predictionWithdrawn = $state(false);
  let generation = 0;
  /** The key of the pair whose data are being computed, so that a second request for it waits for the first. */
  let inFlight: string | null = null;
  let animTimer: ReturnType<typeof setTimeout> | null = null;

  const d = $derived(diagramOf(cfg.board, cfg.black, cfg.tau));
  const board = $derived(d.board as EngineBoard<number>);
  const adm = $derived(admissibility(d));
  const lv = $derived(lights(adm, board));
  const pairData = $derived(pair !== null && pair.key === keyOf(cfg) ? pair.data : null);
  const data: Assembled | null = $derived(pairData === null ? null : assembleData(pairData.sat, pairData.rb, pairData.records, d));
  const failedText = $derived(adm.admissible && data === null && failure !== null && failure.key === keyOf(cfg) ? failureSentence(failure.message) : null);
  const pending = $derived(adm.admissible && data === null && failedText === null);
  const frozen = $derived(!predictionResolved);
  const labels = $derived(labelOrder(board));
  const positions = $derived([play.start, ...play.steps.map((s) => s.population)]);
  const current = $derived(positions[play.cursor]!);
  const shown = $derived(anim !== null ? anim.frames[anim.index]! : current);
  const values = $derived(shown.map((x) => String(x)));
  const noneCanAct = $derived(board.labels.map(() => false));
  const step = $derived(play.cursor === 0 ? null : play.steps[play.cursor - 1]!);
  const stage = $derived(step !== null && step.kind === 'stage' ? step.stage : 0);
  const thetaOffered = $derived(adm.symmetry && adm.condition_1 && adm.condition_2);
  const word = $derived(wordOfWX(d));
  const arrows = $derived(arrowsOf(d));
  const blackPairs = $derived(blackPairsOf(d));
  const invs = $derived(involutions(board));
  const tauKey = $derived(cfg.tau.join('.'));
  const s2 = $derived(data === null ? null : shadow2(d, current));
  const coords = $derived(data === null || s2 === null ? null : coordinatesInBourbaki(d, data, s2));
  const rows = $derived(data !== null && panel === 'shadows' ? shadowRows(d) : null);
  const points = $derived(rows !== null && data !== null ? shadowPoints(d, data, rows) : null);
  const drawn = $derived(data?.drawing ? boardOf(data.drawing.name) : null);
  // The coordinates, the names and the pairs of the drawn restricted board, indexed by its positions (the
  // Bourbaki order of the drawing's arrays); a drawn node's label becomes a position only by drawnPosition (E-7).
  const drawnValues = $derived.by(() => {
    if (drawn === null || coords === null) return null;
    return coords.map((c) => String(c));
  });
  const drawnNames = $derived.by(() => {
    if (drawn === null || data === null || data.drawing === null) return [];
    const drawing = data.drawing;
    return drawn.labels.map((l) => `${restrictedNodeName(d, data, l)}${coords !== null ? `, shadow coordinate ${speakList([coords[drawnPosition(drawing, l)]!])}` : ''}`);
  });
  const drawnPairs = $derived(drawn === null || data === null || data.drawing === null ? [] : data.drawing.pairs.map(([a, b]) => `(${a}, ${b})`));
  const composite = $derived(step !== null && step.kind === 'composite' ? step : null);
  const catalogue = $derived(panel === 'catalogue' ? catalogueRows(cfg.board) : null);
  const roots = $derived(rootsOffered(board));
  const rootKey = $derived(play.start.join(','));

  // Only the names History reads: at most 50 positions are named, however long the play (7.4).
  const positionNames = $derived.by(() => {
    const ps = positions;
    return historyNames(play.steps.length, play.cursor, (k) => `${k === 0 ? 'Start' : `After step ${k}`}: populations ${speakList(inLabelOrder(board, ps[k]!))}`);
  });

  /** The theta panel: the stages from the population where the current run of theta started. */
  const runStart = $derived(stage === 0 ? current : positions[play.cursor - stage]!);
  const stagesShown = $derived.by(() => {
    if (!thetaOffered) return null;
    const s1 = stageStep(d, runStart, 1, word)[0]!;
    const s2list = stageStep(d, s1, 2, word);
    const s3 = stageStep(d, s2list.length > 0 ? s2list[s2list.length - 1]! : s1, 3, word)[0]!;
    return { s1, s2list, s3 };
  });

  const initialCaption = captionText({ d: initialD, panel: presetFields.panel, toggle: presetFields.toggle, adm: initialAdm, data: initialPair === null ? null : assembleData(initialPair.sat, initialPair.rb, initialPair.records, initialD), root: initialRoot });
  /** An author's own caption stays; the preset's (the tool route passes the registry's) follows the state. */
  const fixedCaption = untrack(() => (caption !== undefined && caption !== initialCaption ? caption : null));
  const captionNow = $derived(fixedCaption ?? captionText({ d, panel, toggle, adm, data, root: play.start, failed: failedText !== null }));

  const toolState = $derived(toolStateOf(cfg));
  const figureLabel = $derived(
    `Satake Studio on ${cfg.board} with ${blackPhrase(board, d.black)} and τ ${tauPhrase(board, d.tau)}: ${lv.verdict}${data !== null ? `, ${listText(data.entries.map((e) => displayName(e.real_form)))}` : ''}.`,
  );

  const nameHtml = (n: string): string => {
    void namesVersion;
    return realFormHtml(n);
  };
  const altHtml = (n: string): string | null => {
    void namesVersion;
    return realFormAltHtml(n);
  };

  // ------------------------------------------------------------------------------------------
  // Loading a state (a link, the back button, a picker, an example, a catalogue entry)
  // ------------------------------------------------------------------------------------------

  /**
   * Asks for the data of the current pair where E-9 says, unless they are there; a later request wins. A request
   * that fails (a worker that could not start or that failed) ends the wait with a sentence saying so, and the
   * next change asks again (instruction 5.12: never a frozen page).
   */
  function refresh(): void {
    const k = keyOf(cfg);
    if (!adm.admissible || pair?.key === k || inFlight === k) return;
    const g = ++generation;
    inFlight = k;
    failure = null;
    void fetchData(d, adm)
      .then(
        (r) => {
          if (g === generation && r !== null) pair = { key: k, data: r };
        },
        (e: unknown) => {
          if (g === generation) failure = { key: k, message: e instanceof Error ? e.message : String(e) };
        },
      )
      .finally(() => {
        if (g === generation) inFlight = null;
      });
  }

  function stopAnimation(): void {
    if (animTimer !== null) clearTimeout(animTimer);
    animTimer = null;
    anim = null;
  }

  /** A new decoration: everything below it is recomputed, and the root and the session history are reset (plan). */
  function setConfig(next: SatakeState): void {
    stopAnimation();
    cfg = next;
    play = { start: defaultRoot(d), steps: [], cursor: 0 };
    refresh();
  }

  /**
   * Fetches the typeset names (t13/names.ts), only from the reader's own actions (a paint, tau, the picker, an
   * example, a catalogue entry, a panel, the back button), never while the island hydrates from a link: SPEC 7.6
   * counts every script a route fetches before the first interaction (decisions/P6-A3.md; RT-FIX P6-RT-07-01).
   */
  function loadTypesetNames(): void {
    void loadNames().then(() => namesVersion++);
  }

  function readLink(): void {
    const { state, notice: n } = admitLink(window.location.search, defaults, instanceId);
    notice = n;
    const next = satakeStateOf(state);
    if (keyOf(next) === keyOf(cfg)) return;
    if (!predictionResolved && encodeState(state) !== encodeState(defaults)) {
      predictionWithdrawn = true;
      predictionResolved = true;
    }
    setConfig(next);
  }

  // Hydration: read the URL once with the instance prefix (6.6), and ask the worker for data the server
  // computed but this board may not compute on the main thread (E7, E8).
  $effect(() => {
    untrack(() => {
      readLink();
      refresh();
    });
  });

  // ------------------------------------------------------------------------------------------
  // Decorate
  // ------------------------------------------------------------------------------------------

  function paint(position: number, announce: (t: string) => void): void {
    if (frozen) return;
    const label = toLabels(board, [position])[0]!;
    const isBlack = cfg.black.includes(label);
    const black = isBlack ? cfg.black.filter((l) => l !== label) : [...cfg.black, label].sort((a, b) => a - b);
    notice = null;
    setConfig({ board: cfg.board, black, tau: cfg.tau });
    loadTypesetNames();
    announce(announcePaint(board, label, !isBlack, lv));
  }

  function pickTau(t: number[], announce: (t: string) => void): void {
    if (frozen) return;
    notice = null;
    setConfig({ board: cfg.board, black: cfg.black, tau: tauToLabels(board, t) });
    loadTypesetNames();
    announce(announceTau(board, d.tau, lv));
  }

  /** A picker resets the decoration to the split form and the root to the default (4.0; plan). */
  function pickBoard(name: string, announce: (t: string) => void): void {
    if (frozen || !T13_BOARDS.includes(name)) return;
    notice = null;
    setConfig(splitState(name));
    loadTypesetNames();
    announce(`Board ${name}, no black node, τ the identity. ${verdictTail(lv)}`);
  }

  /** An example of 2.15 or a catalogue entry: pushState (7.4). */
  function loadState(next: SatakeState, what: string, announce: (t: string) => void): void {
    if (frozen) return;
    notice = null;
    setConfig(next);
    loadTypesetNames();
    exampleLoaded(instanceId, toolStateOf(next));
    announce(`Loaded ${what}. ${verdictTail(lv)}`);
  }

  function pickRoot(key: string, announce: (t: string) => void): void {
    if (frozen) return;
    const r = roots.find((x) => x.join(',') === key);
    if (r === undefined) return;
    stopAnimation();
    const before = current;
    play = { start: [...r], steps: [], cursor: 0 };
    announce(announceRestart(board, 'Root chosen.', before, r));
  }

  // ------------------------------------------------------------------------------------------
  // Play: theta in stages, composite moves, history
  // ------------------------------------------------------------------------------------------

  function reducedMotion(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Shows the populations of the steps just played one by one (A-9: instant under reduced motion; at most 2 s). */
  function animate(frames: number[][]): void {
    stopAnimation();
    if (frames.length <= 1 || reducedMotion()) return;
    const delay = Math.max(40, Math.min(150, Math.floor(2000 / frames.length)));
    anim = { frames, index: 0 };
    const tick = (): void => {
      if (anim === null) return;
      if (anim.index >= anim.frames.length - 1) {
        anim = null;
        animTimer = null;
        return;
      }
      anim = { frames: anim.frames, index: anim.index + 1 };
      animTimer = setTimeout(tick, delay);
    };
    animTimer = setTimeout(tick, delay);
  }

  /** Appends steps after the cursor; acting from an earlier position discards the moves after it (4.0). */
  function pushSteps(steps: Step[]): void {
    const kept = play.steps.slice(0, play.cursor);
    play = { start: play.start, steps: [...kept, ...steps], cursor: kept.length + steps.length };
    animate(steps.flatMap((s) => (s.frames.length > 0 ? s.frames : [s.population])));
  }

  function stageFrom(p: number[], s: 1 | 2 | 3): Step {
    const frames = stageStep(d, p, s, word);
    return { kind: 'stage', stage: s, population: frames.length > 0 ? frames[frames.length - 1]! : [...p], frames };
  }

  function nextStage(announce: (t: string) => void): void {
    if (frozen || !thetaOffered) return;
    const s = (stage === 3 ? 1 : stage + 1) as 1 | 2 | 3;
    const before = current;
    const st = stageFrom(before, s);
    pushSteps([st]);
    announce(announceStage(board, s, before, st.population, play.cursor));
  }

  function playTheta(announce: (t: string) => void): void {
    if (frozen || !thetaOffered) return;
    const from = stage === 3 ? 0 : stage;
    const steps: Step[] = [];
    const before = current;
    let p = current;
    for (let s = from + 1; s <= 3; s++) {
      const st = stageFrom(p, s as 1 | 2 | 3);
      steps.push(st);
      p = st.population;
    }
    pushSteps(steps);
    announce(announceStage(board, 3, before, p, play.cursor));
  }

  function compositeMove(label: number, announce: (t: string) => void): void {
    if (frozen || data === null || data.drawing === null) return;
    const before = current;
    const mv = restrictedClick(d, data, label, before);
    const population = mv.populations.length > 0 ? mv.populations[mv.populations.length - 1]! : [...before];
    pushSteps([{ kind: 'composite', label, word: mv.word, reducedLength: mv.reducedLength, population, frames: mv.populations }]);
    announce(announceComposite(board, label, mv.word.length, coordinatesInBourbaki(d, data, shadow2(d, population)), before, population, play.cursor));
  }

  /** The announcement of step k (a redo or a scrub forward), against the position before it. */
  function stepAnnouncement(k: number): string {
    const st = play.steps[k - 1]!;
    const before = positions[k - 1]!;
    if (st.kind === 'stage') return announceStage(board, st.stage, before, st.population, k);
    return announceComposite(board, st.label, st.word.length, data === null ? null : coordinatesInBourbaki(d, data, shadow2(d, st.population)), before, st.population, k);
  }

  function scrub(to: number, announce: (t: string) => void): void {
    if (frozen || to < 0 || to > play.steps.length || to === play.cursor) return;
    stopAnimation();
    const from = play.cursor;
    play = { ...play, cursor: to };
    if (to < from) announce(announceTemplates.undid(from, inLabelOrder(board, positions[to]!), 'populations'));
    else announce(stepAnnouncement(to));
  }

  const undo = (announce: (t: string) => void): void => scrub(play.cursor - 1, announce);
  const redo = (announce: (t: string) => void): void => scrub(play.cursor + 1, announce);

  /** Reset empties the list and returns the root to its starting population (4.0 History). */
  function reset(announce: (t: string) => void): void {
    if (frozen) return;
    stopAnimation();
    const before = current;
    play = { start: play.start, steps: [], cursor: 0 };
    announce(announceRestart(board, 'Reset.', before, play.start));
  }

  function onKeydown(event: KeyboardEvent, announce: (t: string) => void): void {
    const action = shortcutOf(event);
    if (action === null) return;
    event.preventDefault();
    if (action === 'undo') undo(announce);
    else redo(announce);
  }

  // ------------------------------------------------------------------------------------------
  // Panels (WAI-ARIA tabs, automatic activation)
  // ------------------------------------------------------------------------------------------

  const uid = $props.id();

  /** Opens a panel; the reader's first action also fetches the typeset names (t13/names.ts). */
  function openPanel(id: T13Panel): void {
    panel = id;
    loadTypesetNames();
  }

  function onTabKey(event: KeyboardEvent): void {
    const order = T13_PANELS.map((p) => p.id);
    const at = order.indexOf(panel);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (at + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (at + order.length - 1) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    if (next === null) return;
    event.preventDefault();
    openPanel(order[next]!);
    const list = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
    (list?.querySelector(`[data-panel-tab="${order[next]}"]`) as HTMLElement | null)?.focus();
  }

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter) => ({ letter, names: T13_BOARDS.filter((n) => n.startsWith(letter)) }));
  const typeParts = (name: string): { letters: string; sub: string } => {
    const m = /^([A-Z]+)(\d+)$/.exec(name);
    return m === null ? { letters: name, sub: '' } : { letters: m[1]!, sub: m[2]! };
  };
  const exampleText = (x: (typeof T13_EXAMPLES)[number]): string => {
    const b = boardOf(x.board);
    return `${x.board}: ${blackPhrase(b, toPositions(b, x.black))}, τ ${pairsText(b, tauFromLabels(b, x.tau))}`;
  };
  const rootText = (r: readonly number[]): string => vectorText(inLabelOrder(board, [...r]));
  const shadowText = (v: readonly number[]): string => `(${inLabelOrder(board, [...v]).map(halfText).join(', ')})`;
  const pictureLabel = $derived(
    points === null || data === null
      ? ''
      : `Restricted roots of type ${data.entries[data.drawingEntry]!.restricted_type_display}, by their coordinates in the simple restricted roots: ${points.points
          .map((p) => `${vectorText(p.coords)} with multiplicity ${p.mult}`)
          .join(', ')}.`,
  );
  const characterOf = (x: number): string => intText(x);
</script>

{#snippet typeName(name: string | null)}
  {#if name === null}none{:else}{@const p = typeParts(name)}{p.letters}<sub>{p.sub}</sub>{/if}
{/snippet}

{#snippet lamp(holds: boolean)}
  <svg class="lamp" class:fails={!holds} viewBox="-1 -1 2 2" width="20" height="20" aria-hidden="true" focusable="false">
    {#if holds}<circle cx="0" cy="0" r="0.8" />{:else}<path d="M -0.7 -0.7 L 0.7 0.7 M 0.7 -0.7 L -0.7 0.7" />{/if}
  </svg>
{/snippet}

{#snippet figure(api: FrameApi)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="t13" data-panel-open={panel} onkeydown={(e) => onKeydown(e, api.announce)}>
    {#if islandHtml !== null}{@html islandHtml}{/if}
    {#if prediction && !predictionWithdrawn}
      <Predict {prediction} hydrated={api.hydrated} {labels} announce={api.announce} onResolved={() => (predictionResolved = true)} />
    {/if}
    <div class="decorate">
      <label class="setting">
        <span>Board</span>
        <select data-control="picker" disabled={!api.hydrated || frozen} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value, api.announce)}>
          {#each groups as g (g.letter)}
            <optgroup label="Type {g.letter}" data-letter={g.letter}>
              {#each g.names as name (name)}
                <option value={name} selected={cfg.board === name}>{name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <fieldset class="tau-picker" data-control="tau-picker">
        <legend>τ</legend>
        {#each invs as t (t.join('.'))}
          {@const images = tauToLabels(board, t).join('.')}
          <label class="radio">
            <input
              type="radio"
              name="{uid}-tau"
              value={images}
              checked={tauKey === images}
              disabled={!api.hydrated || frozen}
              data-control="tau"
              data-tau={images}
              onchange={() => pickTau(t, api.announce)}
            />
            <span>{pairsText(board, t)}</span>
          </label>
        {/each}
      </fieldset>
      <label class="setting toggle">
        <input type="checkbox" data-control="toggle" bind:checked={toggle} disabled={!api.hydrated} />
        <span>Show τ on black nodes</span>
      </label>
      <!-- Phase 7 (P7-A3) adds the toggle "generalized diagrams" here. -->
    </div>
    <div class="boards">
      <div class="decoration-host" data-out="decoration">
        <DecorationDiagram
          {board}
          black={d.black}
          {arrows}
          {blackPairs}
          showBlackPairs={toggle}
          hydrated={api.hydrated}
          {frozen}
          name="Decoration of {cfg.board}: paint the nodes black or white"
          onPaint={(k) => paint(k, api.announce)}
        />
      </div>
      <div class="game-host" data-out="game-board">
        <Board
          {board}
          {values}
          game="mutation"
          canAct={noneCanAct}
          name="Game board {cfg.board}: the chosen root as populations"
          disabled={frozen}
          onAct={() => api.announce('The game board moves by the stages of θ and by the composite moves.')}
        />
      </div>
    </div>
    <p class="line summary">
      Black nodes: <span class="numeral" data-out="black-nodes">{cfg.black.join('.')}</span>{cfg.black.length === 0 ? 'none' : ''}; τ:
      <span class="numeral" data-out="tau">{cfg.tau.join('.')}</span>; <span data-out="arrows"
        >arrows {arrows.length === 0 ? 'none' : arrows.map((p) => toLabels(board, p).join(' ↔ ')).join(', ')}{#if toggle}; τ on black nodes {blackPairs.length === 0
            ? 'none'
            : blackPairs.map((p) => toLabels(board, p).join(' ↔ ')).join(', ')}{/if}</span
      >.
    </p>
    <div class="root-row">
      <label class="setting">
        <span>Root</span>
        <select data-control="root" disabled={!api.hydrated || frozen} onchange={(e) => pickRoot((e.currentTarget as HTMLSelectElement).value, api.announce)}>
          {#each roots as r (r.join(','))}
            <option value={r.join(',')} selected={rootKey === r.join(',')}>{rootText(r)}</option>
          {/each}
        </select>
      </label>
      {#if data !== null && s2 !== null}
        <p class="line">
          Shadow <span class="numeral" data-out="shadow">{shadowText(s2)}</span>{#if coords !== null}; coordinates in the simple restricted roots
            <span class="numeral" data-out="shadow-coordinates">{vectorText(coords)}</span>{/if}.
        </p>
      {/if}
    </div>
    <section class="lights" aria-label="The three conditions">
      {#if !lv.symmetry.holds && lv.symmetry.reason}
        <p class="line" data-out="symmetry-reason"><RichText text={lv.symmetry.reason} /></p>
      {/if}
      <ol class="light-list">
        {#each lv.lights as l (l.n)}
          <li class="light" class:fails={!l.holds} data-light={l.n}>
            {@render lamp(l.holds)}
            <span class="condition">Condition {l.n}: <RichText text={T13_CONDITIONS[l.n - 1]!} />:</span>
            <strong class="word" data-out="light-{l.n}">{l.word}</strong>
            {#if l.reason !== null}<span class="reason" data-out="reason-{l.n}"><RichText text={l.reason} /></span>{/if}
          </li>
        {/each}
      </ol>
      <p class="line verdict">Verdict: <strong data-out="verdict">{lv.verdict}</strong></p>
      {#if !lv.admissible}
        <div class="failure" data-out="failure-note">
          {#each failureNote(adm) as p, k (k)}<p><RichText text={p} /></p>{/each}
        </div>
      {/if}
    </section>
    <div class="tabs" role="tablist" aria-label="Panels of the Studio">
      {#each T13_PANELS as p (p.id)}
        <button
          type="button"
          role="tab"
          class="tab"
          id="{uid}-tab-{p.id}"
          aria-selected={panel === p.id ? 'true' : 'false'}
          aria-controls="{uid}-panel"
          tabindex={panel === p.id ? 0 : -1}
          data-panel-tab={p.id}
          disabled={!api.hydrated}
          onclick={() => openPanel(p.id)}
          onkeydown={onTabKey}>{p.label}</button
        >
      {/each}
    </div>
    <div class="panel" role="tabpanel" id="{uid}-panel" aria-labelledby="{uid}-tab-{panel}" data-panel={panel}>
      {#if panel === 'lights'}
        <p class="line">The examples of the table of conditions on A<sub>3</sub> and A<sub>2</sub>; each loads its decoration.</p>
        <ul class="examples" data-out="examples">
          {#each T13_EXAMPLES as x, k (k)}
            <li>
              <button
                type="button"
                class="control"
                data-control="example"
                data-example={k}
                disabled={!api.hydrated || frozen}
                onclick={() => loadState({ board: x.board, black: [...x.black], tau: [...x.tau] }, exampleText(x), api.announce)}>{exampleText(x)}</button
              >
            </li>
          {/each}
        </ul>
      {:else if panel === 'data'}
        {#if data !== null}
          {@const e0 = data.entries[data.drawingEntry]!}
          <ul class="names">
            {#each data.entries as e (e.real_form)}
              {@const alt = altHtml(e.real_form)}
              <li data-out="real-form" data-name={e.real_form}>
                <span class="name">{@html nameHtml(e.real_form)}</span>{#if alt !== null}<span class="alt"> = {@html alt}</span>{/if}
                <span class="cartan">(<span data-out="cartan-label">{e.cartan_label}</span>)</span>, restricted roots
                <span data-out="restricted-type" data-name={e.restricted_type_display ?? 'none'}>{@render typeName(e.restricted_type_display)}</span>
              </li>
            {/each}
          </ul>
          <dl class="facts">
            <dt>Real rank</dt>
            <dd class="numeral" data-out="real-rank">{e0.real_rank}</dd>
            <dt>Multiplicities (m<sub>λ</sub>, m<sub>2λ</sub>) at the nodes of the restricted board</dt>
            <dd class="numeral" data-out="multiplicities">{multiplicitiesText(data)}</dd>
            <dt>Multiplicities by length</dt>
            <dd class="numeral" data-out="multiplicity-classes">{data.sat.multiplicities.length === 0 ? 'none' : data.sat.multiplicities.map((m) => `${m.class}: ${m.roots} roots, multiplicity ${m.mult}`).join('; ')}</dd>
            <dt>dim 𝔨</dt>
            <dd class="numeral" data-out="dim-k">{e0.dim_k}</dd>
            <dt>dim 𝔭</dt>
            <dd class="numeral" data-out="dim-p">{e0.dim_p}</dd>
            <dt>Character, dim 𝔭 {MINUS} dim 𝔨</dt>
            <dd><span class="numeral" data-out="character">{characterOf(e0.character)}</span> = 2r {MINUS} n {MINUS} |Φ<sub>X</sub>| (a closed form derived on this site)</dd>
          </dl>
          {#if data.shape !== null}
            <p class="line" data-out="shape">
              {#if data.shape === 'split'}All white with no arrows: the split form. θ = {MINUS}1 and every multiplicity is 1.{:else if data.shape === 'compact'}All
                black: the compact form. θ = 1 on the roots, and there are no restricted roots.{:else}No black node, with arrows: a quasi-split form. Its shadows are the
                averaged roots of the folding by τ.{/if}
            </p>
          {/if}
        {:else if pending}
          <p class="line" data-out="data-pending">computing the data in the background</p>
        {:else if failedText !== null}
          <p class="line" data-out="data-error">{failedText}</p>
        {:else}
          <p class="line">No data: the decoration is not admissible.</p>
        {/if}
      {:else if panel === 'theta'}
        <p class="line">
          θ = {MINUS}w<sub>X</sub>∘τ in three stages: move each population along τ; play the word of w<sub>X</sub>, the numbers game on the black nodes from all
          ones; change every sign.
        </p>
        <p class="line">Word of w<sub>X</sub>: <span class="numeral" data-out="theta-word">{word.length === 0 ? 'none' : toLabels(board, word).join(' ')}</span></p>
        <p class="line">Stage reached: <span class="numeral" data-out="theta-stage">{stage}</span> of 3</p>
        {#if stagesShown !== null}
          <ol class="stages" data-out="theta-stages">
            <li>Start <span class="numeral">{rootText(runStart)}</span></li>
            <li>After stage 1 <span class="numeral">{rootText(stagesShown.s1)}</span></li>
            <li>
              During stage 2 <span class="numeral"
                >{stagesShown.s2list.length === 0 ? 'nothing to play' : stagesShown.s2list.map((v) => rootText(v)).join(', ')}</span
              >
            </li>
            <li>After stage 3 <span class="numeral">{rootText(stagesShown.s3)}</span></li>
          </ol>
          <div class="row-buttons">
            <button type="button" class="control" data-control="theta-next" disabled={!api.hydrated || frozen} onclick={() => nextStage(api.announce)}>Next stage</button>
            <button type="button" class="control" data-control="theta-play" disabled={!api.hydrated || frozen} onclick={() => playTheta(api.announce)}>Play θ</button>
          </div>
        {:else}
          <p class="line" data-out="theta-note">θ is played here on a decoration that meets conditions 1 and 2.</p>
        {/if}
      {:else if panel === 'shadows'}
        {#if data === null}
          {#if failedText !== null}
            <p class="line" data-out="data-error">{failedText}</p>
          {:else}
            <p class="line">{pending ? 'computing the data in the background' : 'No shadows: the decoration is not admissible.'}</p>
          {/if}
        {:else if data.sat.real_rank === 0 || rows === null}
          <p class="line" data-out="no-restricted-roots">Every root is fixed by θ: there are no restricted roots.</p>
        {:else}
          <p class="line">
            The shadow of a root α is ½(α {MINUS} θα); the roots of the black nodes have shadow 0. Real rank <span class="numeral">{data.sat.real_rank}</span>.
          </p>
          {#if points !== null}
            <div class="picture" data-out="shadow-picture">
              <ShadowPicture points={points.points} rank={points.rank} chosen={coords} label={pictureLabel} />
            </div>
          {/if}
          <table class="table" data-out="shadow-table">
            <caption>Shadows and the positive roots above them</caption>
            <thead>
              <tr><th scope="col">Shadow ᾱ</th><th scope="col">Positive roots above it</th><th scope="col">Positive roots α with θα</th></tr>
            </thead>
            <tbody>
              {#each rows as r (r.shadow2.join(','))}
                <tr data-shadow={r.text}>
                  <th scope="row" class="numeral">{r.text}</th>
                  <td class="numeral">{r.roots.length}</td>
                  <td class="numeral">{r.roots.map((x) => `${rootText(x.root)} ↦ ${rootText(x.theta)}`).join('; ')}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {:else if panel === 'restricted'}
        {#if data === null}
          {#if failedText !== null}
            <p class="line" data-out="data-error">{failedText}</p>
          {:else}
            <p class="line">{pending ? 'computing the data in the background' : 'No restricted board: the decoration is not admissible.'}</p>
          {/if}
        {:else if data.drawing === null || drawn === null}
          <p class="line" data-out="no-restricted-roots">The compact form has no restricted roots and no restricted board.</p>
        {:else}
          <p class="line">
            Restricted board <span data-out="restricted-name" data-name={data.drawing.name}>{@render typeName(data.drawing.name)}</span>{#if data.drawing.name === 'B2' || data.drawing.name === 'C2'}
              (<span data-out="restricted-name-note">B<sub>2</sub> = C<sub>2</sub></span>){/if}, in Bourbaki order; each node shows the shadow coordinate and (m<sub
              >λ</sub
            >, m<sub>2λ</sub>). A node plays its composite move: the word of w<sub>X</sub>, then the longest word of X ∪ O.
          </p>
          <div class="restricted-host" data-out="restricted-board">
            <RestrictedBoardView
              board={drawn}
              values={drawnValues}
              pairs={drawnPairs}
              names={drawnNames}
              hydrated={api.hydrated}
              {frozen}
              name="Restricted board {data.drawing.name}"
              onAct={(k) => compositeMove(k, api.announce)}
            />
          </div>
          {#if composite !== null}
            <p class="line">
              Composite move of restricted node <span class="numeral">{composite.label}</span>, orbit {orbitText(d, data, composite.label)}:
              <span class="numeral word-list" data-out="composite-word">{toLabels(board, composite.word).join(' ')}</span>; reduced length
              <span class="numeral" data-out="composite-length">{composite.reducedLength}</span>.
            </p>
          {/if}
        {/if}
      {:else if panel === 'catalogue' && catalogue !== null}
        <table class="table catalogue" data-out="catalogue">
          <caption>The real forms of {cfg.board}</caption>
          <thead>
            <tr><th scope="col">Real form</th><th scope="col">Cartan's label</th><th scope="col">Black nodes</th><th scope="col">Arrows</th><th scope="col">Restricted roots</th><th scope="col">Load</th></tr>
          </thead>
          <tbody>
            {#each catalogue as row (row.realForm)}
              <tr data-out="catalogue-row" data-name={row.realForm} aria-current={pairData !== null && pairData.records.some((r) => r.real_form === row.realForm) ? 'true' : undefined}>
                <th scope="row">
                  <!-- text for the row header (axe empty-table-header); the name itself stays MathML for assistive technology (A-12) -->
                  <span class="visually-hidden">{'Real form, '}</span><span class="name">{@html nameHtml(row.realForm)}</span>
                  {#if row.sameAs.length > 0}<span class="same" data-out="same-form">same real form as {listText(row.sameAs.map(displayName))}</span>{/if}
                </th>
                <td>{row.cartanLabel}</td>
                <td class="numeral">{row.black.length === 0 ? 'none' : row.black.join(', ')}</td>
                <td class="numeral">{row.arrows.length === 0 ? 'none' : row.arrows.map((p) => p.join(' ↔ ')).join(', ')}</td>
                <td>{@render typeName(row.restrictedTypeDisplay)}</td>
                <td>
                  <button
                    type="button"
                    class="control"
                    data-control="catalogue-load"
                    data-name={row.realForm}
                    disabled={!api.hydrated || frozen}
                    aria-label="Load {displayName(row.realForm)}"
                    onclick={() => loadState({ board: cfg.board, black: [...row.black], tau: [...row.tau] }, displayName(row.realForm), api.announce)}>Load</button
                  >
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
    <!-- Undo, redo and reset come after every board that plays moves, the game board above and the theta
         controls and the restricted board in the panel (A-1; decisions/P6-A3.md, the repair). -->
    <History
      total={play.steps.length}
      cursor={play.cursor}
      {positionNames}
      hydrated={api.hydrated}
      {frozen}
      onUndo={() => undo(api.announce)}
      onRedo={() => redo(api.announce)}
      onReset={() => reset(api.announce)}
      onScrub={(to) => scrub(to, api.announce)}
    />
  </div>
{/snippet}

{#snippet table(api: FrameApi)}
  <table class="table" data-table="decoration">
    <caption>Decoration of {cfg.board}</caption>
    <thead>
      <tr><th scope="col">Node</th><th scope="col">Colour</th><th scope="col">τ(node)</th><th scope="col">Population</th></tr>
    </thead>
    <tbody>
      {#each labels as l, j (l)}
        {@const p = toPositions(board, [l])[0]!}
        {@const black = cfg.black.includes(l)}
        <tr>
          <th scope="row">{l}</th>
          <td>
            <button
              type="button"
              class="cell"
              data-table-node={l}
              disabled={!api.hydrated || frozen}
              aria-label="Node {l}, {black ? 'black' : 'white'}: paint it {black ? 'white' : 'black'}"
              onclick={() => paint(p, api.announce)}>{black ? 'black' : 'white'}</button
            >
          </td>
          <td class="numeral">{cfg.tau[j]}</td>
          <td class="numeral" data-table-population={l}>{intText(inLabelOrder(board, shown)[j]!)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <table class="table" data-table="lights">
    <caption>The three conditions</caption>
    <tbody>
      {#each lv.lights as l (l.n)}
        <tr><th scope="row">Condition {l.n}</th><td>{l.word}</td><td>{#if l.reason !== null}<RichText text={l.reason} />{/if}</td></tr>
      {/each}
      <tr><th scope="row">Verdict</th><td colspan="2">{lv.verdict}</td></tr>
    </tbody>
  </table>
  {#if data !== null && data.drawing !== null && drawn !== null}
    <table class="table" data-table="restricted">
      <caption>Restricted board {data.drawing.name}</caption>
      <thead>
        <tr><th scope="col">Node</th><th scope="col">Orbit</th><th scope="col">(m<sub>λ</sub>, m<sub>2λ</sub>)</th><th scope="col">Coordinate</th><th scope="col">Composite move</th></tr>
      </thead>
      <tbody>
        {#each drawn.labels as l (l)}
          {@const p = drawnPosition(data.drawing, l)}
          <tr>
            <th scope="row">{l}</th>
            <td class="numeral">{orbitText(d, data, l)}</td>
            <td class="numeral">{drawnPairs[p]}</td>
            <td class="numeral">{coords === null ? '' : intText(coords[p]!)}</td>
            <td>
              <button type="button" class="cell" data-table-restricted={l} disabled={!api.hydrated || frozen} aria-label="Play the composite move of restricted node {l}" onclick={() => compositeMove(l, api.announce)}
                >Play</button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <table class="table" data-table="classes">
      <caption>Multiplicities by length class</caption>
      <thead>
        <tr><th scope="col">Class</th><th scope="col">Restricted roots</th><th scope="col">Multiplicity</th></tr>
      </thead>
      <tbody>
        {#each data.sat.multiplicities as m (m.class)}
          <tr><th scope="row">{m.class}</th><td class="numeral">{m.roots}</td><td class="numeral">{m.mult}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/snippet}

<ToolFrame
  toolId="satake"
  {instanceId}
  title="Satake Studio"
  caption={captionNow}
  state={toolState}
  moves={play.cursor}
  {defaults}
  {notice}
  {figureLabel}
  boardName={cfg.board}
  derivedForExport={() => exportData(d, adm, data, data === null ? null : shadowRows(d))}
  onPopState={() => {
    readLink();
    loadTypesetNames();
  }}
  {figure}
  {table}
/>

<style>
  .t13 {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  .line {
    margin: 0;
  }
  .decorate {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }
  .setting {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    min-height: 44px;
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
  .tau-picker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .tau-picker legend {
    float: left;
    margin-inline-end: 6px;
    padding: 0;
  }
  .radio,
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    cursor: pointer;
  }
  .radio input,
  .toggle input {
    width: 24px;
    height: 24px;
    margin: 0;
  }
  /* The decoration and the game board in the same container, so that the size rule of 6.1 gives both the
     same unit and the nodes line up (6.3 last bullet). */
  .boards {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
  .game-host {
    border-radius: 8px;
    box-shadow: inset 0 0 0 2px var(--accent-populations);
  }
  .root-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
  .lights {
    display: grid;
    gap: 4px;
  }
  .light-list {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .light {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
  }
  .lamp {
    flex: 0 0 auto;
    align-self: center;
  }
  .lamp circle {
    fill: var(--accent-populations);
  }
  .lamp path {
    fill: none;
    stroke: var(--sign-neg-outline);
    stroke-width: 0.35;
    stroke-linecap: round;
  }
  .light.fails .word {
    color: var(--text);
    text-decoration: underline wavy var(--sign-neg-outline);
  }
  .reason {
    flex-basis: 100%;
    padding-inline-start: 28px;
  }
  .failure {
    padding: 8px 12px;
    border: 1px solid var(--sign-neg-outline);
    border-radius: 6px;
  }
  .failure p {
    margin: 0 0 4px;
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
    padding: 0 12px;
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
  .panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  .examples,
  .names {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .facts {
    display: grid;
    grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
    gap: 4px 12px;
    margin: 0;
  }
  .facts dd {
    margin: 0;
  }
  .stages {
    margin: 0;
    padding-inline-start: 20px;
  }
  .row-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .control,
  .cell {
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
    cursor: pointer;
  }
  .control:disabled,
  .cell:disabled,
  .tab:disabled {
    cursor: default;
  }
  .table {
    border-collapse: collapse;
    max-width: 100%;
  }
  .table caption {
    text-align: start;
  }
  .table th,
  .table td {
    padding: 2px 8px;
    text-align: start;
    vertical-align: top;
  }
  .panel .table {
    display: block;
    overflow-x: auto;
  }
  .word-list {
    overflow-wrap: anywhere;
  }
  .same {
    display: block;
    font-weight: normal;
    font-style: italic;
  }
  .picture {
    min-width: 0;
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
  .tab:focus-visible,
  .control:focus-visible,
  .cell:focus-visible,
  select:focus-visible,
  .radio input:focus-visible,
  .toggle input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (max-width: 599.98px) {
    .facts {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
