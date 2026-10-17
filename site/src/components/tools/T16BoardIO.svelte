<script module lang="ts">
  // T16's import and export of boards as JSON (P2-A5; SPEC 4 T16 "Import and export of boards as JSON",
  // 6.6 "board" and Validation, 5.6, E-7, E-8). Pure functions in this module script (the roster gives
  // T16 no .ts helper): the import parser, which applies the codec's rules for boards, and the export
  // text. The component below is the panel: a labelled text field with "Import board", a file input,
  // "Export board" (a download of board.json) and the same text shown in data-out="boardJson".
  //
  // Format (plan; SPEC says only "as JSON"): the `board` value of SPEC 6.6 in its object form,
  // {"cartan": [[2, -3], [-3, 2]], "xy": [[0, 0], [1, 0]]}, `xy` optional. Import also accepts a bare
  // name ("A3", "B3~"), a state object of 6.6 (its `board`), and a whole data export (its
  // `state.board`); every other field, a start or a move list included, is ignored. Import and export
  // are of boards, never of positions.
  import { CAPS, adjacency, boardKind, toLabels, type AnyBoard } from '@two-games/engine';
  import { resolveBoard, type BoardSpec } from '../../lib/state';
  import { fromSpec, toSpec } from '../board/editor/model';

  /** The result of reading a board from text: the spec, or the reason it was refused. */
  export type ImportResult = { ok: true; spec: BoardSpec; nodes: number } | { ok: false; reason: string };

  /** The status line after a refused import (plan wording). */
  export function refusedText(reason: string): string {
    return `The board could not be read: ${reason}. The board was left as it was.`;
  }

  /** The status line after an import (plan wording). */
  export function importedText(nodes: number): string {
    return `Board imported: ${nodes} ${nodes === 1 ? 'node' : 'nodes'}. The play starts again from the default start.`;
  }

  function refuse(reason: string): ImportResult {
    return { ok: false, reason };
  }

  /** A JSON value that is a board spec, or the reason it is not one. Recurses into `board` and `state.board`. */
  function specOf(value: unknown, depth = 0): ImportResult {
    if (depth > 3) return refuse('no board was found in it');
    if (typeof value === 'string') {
      try {
        const b = resolveBoard(value);
        return { ok: true, spec: value, nodes: b.n };
      } catch (e) {
        // resolveBoard refuses a known name above 12 nodes with a RangeError (6.6, as for a matrix).
        return refuse(e instanceof RangeError ? e.message : `no board is named ${JSON.stringify(value)}`);
      }
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return refuse('it is neither a board name nor an object with a cartan matrix');
    const o = value as Record<string, unknown>;
    if ('cartan' in o) return customSpec(o.cartan, o.xy);
    if ('board' in o) return specOf(o.board, depth + 1);
    if ('state' in o && o.state !== null && typeof o.state === 'object' && 'board' in (o.state as object)) {
      return specOf((o.state as Record<string, unknown>).board, depth + 1);
    }
    return refuse('it has no field cartan, board or state.board');
  }

  /** The checks of 6.6 for a custom board, in the order a reader would fix them. */
  function customSpec(cartan: unknown, xy: unknown): ImportResult {
    if (!Array.isArray(cartan) || cartan.length === 0) return refuse('cartan is not a list of rows');
    if (!cartan.every((row) => Array.isArray(row))) return refuse('cartan is not a list of rows');
    const rows = cartan as unknown[][];
    const n = rows.length;
    if (rows.some((row) => row.length !== n)) return refuse(`cartan is not square: it has ${n} rows, and every row needs ${n} entries`);
    if (rows.some((row) => row.some((x) => typeof x !== 'number' || !Number.isSafeInteger(x)))) return refuse('cartan has an entry that is not a whole number');
    const C = rows as number[][];
    if (n > CAPS.customNodes) return refuse(`it has ${n} nodes, and a board has at most ${CAPS.customNodes}`);
    if (boardKind(C) === 'not-a-board') {
      return refuse('the matrix is not a board (every diagonal entry must be 2 and every other entry 0 or a negative whole number)');
    }
    const spec: { cartan: number[][]; xy?: [number, number][] } = { cartan: C.map((r) => r.map((x) => (x === 0 ? 0 : x))) };
    if (xy !== undefined && xy !== null) {
      if (!Array.isArray(xy)) return refuse('xy is not a list of points');
      if (xy.length !== n) return refuse(`xy has ${xy.length} ${xy.length === 1 ? 'point' : 'points'}, but the board has ${n} ${n === 1 ? 'node' : 'nodes'}`);
      if (!xy.every((p) => Array.isArray(p) && p.length === 2 && p.every((c) => typeof c === 'number' && Number.isFinite(c)))) {
        return refuse('xy has a point that is not a pair of numbers');
      }
      // Coordinates that break the rule of 6.1 (not whole, outside 0 to 11, repeated) are kept: they
      // spoil only the layout, which falls back to the circle in label order (6.6, as for links).
      spec.xy = (xy as number[][]).map((p) => [p[0]!, p[1]!] as [number, number]);
    }
    let board: AnyBoard;
    try {
      board = resolveBoard(spec);
    } catch (e) {
      return refuse(e instanceof Error ? e.message : 'it is not a board');
    }
    // The sandbox is the editor of T4 (SPEC 4 T16), which has 0 to 4 roads each way (4 T4, 5.6): a
    // board with more is one the tool does not offer (6.6 Validation).
    const A = adjacency(board);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (A[i]![j]! <= CAPS.roadsEachWay) continue;
        const [from, to] = toLabels(board, [i, j]);
        return refuse(`it has ${A[i]![j]!} roads from node ${from} to node ${to}, and the editor allows at most ${CAPS.roadsEachWay} each way`);
      }
    }
    return { ok: true, spec, nodes: n };
  }

  /** Reads a board from pasted or loaded text (the rules above). Never throws. */
  export function parseBoardImport(text: string): ImportResult {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return refuse('the text is not JSON');
    }
    return specOf(value);
  }

  /**
   * The object form of the current board for export: its Cartan matrix and one whole grid point per
   * node (the reader's points for a custom board with valid coordinates; otherwise the layout of 6.1
   * turned into grid points, as the editor does on a first edit). A named board is written as its
   * matrix too, so the file reads back as a custom board with labels 1..n (E-7).
   */
  export function boardObject(spec: BoardSpec): { cartan: number[][]; xy: [number, number][] } {
    return toSpec(fromSpec(spec, resolveBoard(spec)));
  }

  /** The text of the export: one line per row of the matrix, readable and valid JSON. */
  export function boardJsonText(spec: BoardSpec): string {
    const b = boardObject(spec);
    const rows = b.cartan.map((r) => `    [${r.join(', ')}]`).join(',\n');
    const points = b.xy.map((p) => `[${p[0]}, ${p[1]}]`).join(', ');
    return `{\n  "cartan": [\n${rows}\n  ],\n  "xy": [${points}]\n}\n`;
  }
</script>

<script lang="ts">
  interface Props {
    /** The board in force. */
    spec: BoardSpec;
    /** True until the island has hydrated (7.4): every control is rendered disabled. */
    disabled: boolean;
    /** Called with a board that passed every check; the host replaces the board and resets the play. */
    onImport: (spec: BoardSpec) => void;
    /**
     * Speaks the status line through the tool's one polite live region (A-4: one region per tool,
     * ToolFrame's); the line itself is ordinary text in data-out="importStatus".
     */
    announce?: (text: string) => void;
  }

  let { spec, disabled, onImport, announce }: Props = $props();

  const uid = $props.id();
  let text = $state('');
  let status = $state('');
  const exportText = $derived(boardJsonText(spec));

  function setStatus(line: string): void {
    status = line;
    announce?.(line);
  }

  function importText(source: string): void {
    const r = parseBoardImport(source);
    if (!r.ok) {
      setStatus(refusedText(r.reason));
      return;
    }
    onImport(r.spec);
    setStatus(importedText(r.nodes));
  }

  async function onFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      importText(await file.text());
    } catch {
      setStatus(refusedText('the file could not be opened'));
    }
    input.value = '';
  }

  function onExport(): void {
    const url = URL.createObjectURL(new Blob([exportText], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'board.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
</script>

<section class="io" aria-labelledby="{uid}-heading" data-board-io="">
  <p class="heading" id="{uid}-heading">Import and export the board as JSON</p>
  <label class="field" for="{uid}-text">Board as JSON, or the name of a board</label>
  <textarea
    id="{uid}-text"
    class="text"
    rows="4"
    spellcheck="false"
    data-control="importText"
    {disabled}
    placeholder={'{"cartan": [[2, -3], [-3, 2]]}'}
    bind:value={text}
  ></textarea>
  <div class="row">
    <button type="button" class="control" data-control="importBoard" {disabled} onclick={() => importText(text)}>Import board</button>
    <label class="file">
      <span>Import a .json file</span>
      <input type="file" accept=".json,application/json" data-control="importFile" {disabled} onchange={onFile} />
    </label>
  </div>
  <p class="status" data-out="importStatus">{status}</p>
  <div class="row">
    <button type="button" class="control" data-control="exportBoard" {disabled} onclick={onExport}>Export board</button>
    <span>as board.json; the same text:</span>
  </div>
  <pre class="json" data-out="boardJson" aria-label="The current board as JSON">{exportText}</pre>
</section>

<style>
  .io {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    min-width: 0;
  }
  .heading {
    margin: 0;
    font-weight: bold;
  }
  .text {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    font-family: var(--font-numerals);
    font-size: 14px;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
    padding: 6px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
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
  .file {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    max-width: 100%;
  }
  .file input {
    max-width: 100%;
    min-height: 24px;
    font: inherit;
    color: var(--text);
  }
  .status {
    margin: 0;
    min-height: 1.5em;
  }
  .json {
    margin: 0;
    padding: 6px 8px;
    font-family: var(--font-numerals);
    font-size: 14px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
  .control:focus-visible,
  .text:focus-visible,
  .file input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
