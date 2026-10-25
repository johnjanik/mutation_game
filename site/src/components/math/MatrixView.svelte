<script module lang="ts">
  // MatrixView: a matrix as an HTML table with a caption and row and column headers (SPEC.md 7.3
  // "Mathematics produced while a tool runs"; A-10, A-11, A-12). Owner P5-A2; general, so that later tools
  // can reuse it (no T12 name in its props). No KaTeX, no canvas, no typesetting code (7.6). Two formats:
  // a grid (every entry; zeros as 0 or, with sparseDisplay, as a quiet dot read as 0), and a list of the
  // nonzero entries with the columns row, column, value, row-major (plan). `auto` takes the grid when both
  // dimensions are at most CAPS.matrixGridDim (27, SPEC 5.6) and the list above.
  //
  // Hooks (plan): the root carries data-out=<out>, data-format ("grid" | "list"), data-rows, data-cols; each
  // body cell that holds an entry carries data-row and data-col (1-based) and data-value (decimal text with
  // an ASCII minus, as SPEC 4.0 prescribes for data-value). The pure helpers below need no DOM.
  //
  // The table itself is written by matrixTable, a pure function of the props, and inserted as markup: a grid
  // of 27 by 27 has 729 cells, and one string parsed by the browser costs a small part of what a component
  // per cell costs, which keeps a tool's update under the long-task budget of SPEC 7.6 (measured by T12's
  // browser test). Every text is escaped.
  import { CAPS } from '@two-games/engine';

  /** The true minus sign of SPEC 6.3. */
  export const MINUS = '−';

  export type Entry = number | bigint;

  export interface MatrixEntry {
    /** 0-based row and column. */
    row: number;
    col: number;
    value: Entry;
  }

  const KEY = /^(\d+),(\d+)$/;

  /** Row and column (0-based) of a key "row,column" (RangeError on any other text). */
  export function parseKey(key: string): [number, number] {
    const m = KEY.exec(key);
    if (m === null) throw new RangeError(`${JSON.stringify(key)} is not a matrix key "row,column"`);
    return [Number(m[1]), Number(m[2])];
  }

  const isZero = (v: Entry | string): boolean => (typeof v === 'bigint' ? v === 0n : Number(v) === 0);

  /** The nonzero entries of a sparse matrix in row-major order (row, then column). */
  export function entriesInOrder(sparse: ReadonlyMap<string, Entry>): MatrixEntry[] {
    const out: MatrixEntry[] = [];
    for (const [key, value] of sparse) {
      if (isZero(value)) continue;
      const [row, col] = parseKey(key);
      out.push({ row, col, value });
    }
    return out.sort((a, b) => a.row - b.row || a.col - b.col);
  }

  /** The nonzero entries of a dense matrix in row-major order. */
  export function denseEntries(dense: readonly (readonly (Entry | string)[])[]): MatrixEntry[] {
    const out: MatrixEntry[] = [];
    dense.forEach((row, r) =>
      row.forEach((v, c) => {
        if (!isZero(v)) out.push({ row: r, col: c, value: typeof v === 'string' ? BigInt(v) : v });
      }),
    );
    return out;
  }

  /** A sparse matrix as a dense one of the given size (zeros as 0); RangeError on a key outside it. */
  export function toDense(sparse: ReadonlyMap<string, Entry>, rows: number, cols: number): Entry[][] {
    const out: Entry[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as Entry));
    for (const e of entriesInOrder(sparse)) {
      if (e.row >= rows || e.col >= cols) throw new RangeError(`the entry ${e.row},${e.col} is outside a ${rows} by ${cols} matrix`);
      out[e.row]![e.col] = e.value;
    }
    return out;
  }

  /** An entry as shown: a signed integer with a true minus sign (6.3). */
  export function formatEntry(v: Entry | string): string {
    const t = String(v);
    return t.startsWith('-') ? `${MINUS}${t.slice(1)}` : t;
  }

  /** An entry as data-value holds it: decimal text with an ASCII minus (4.0 Test hooks). */
  export function valueText(v: Entry | string): string {
    return String(v).replace(/^−/, '-');
  }

  /** The format of `auto`: a grid when both dimensions are at most CAPS.matrixGridDim, a list above. */
  export function autoFormat(rows: number, cols: number): 'grid' | 'list' {
    return rows <= CAPS.matrixGridDim && cols <= CAPS.matrixGridDim ? 'grid' : 'list';
  }

  /** The caption of the list format (plan): "F7: 12 nonzero entries of a 56 by 56 matrix". */
  export function listCaption(caption: string, count: number, rows: number, cols: number): string {
    const what = count === 0 ? 'no nonzero entries' : `${count} nonzero ${count === 1 ? 'entry' : 'entries'}`;
    return `${caption}: ${what} of a ${rows} by ${cols} matrix`;
  }

  /** Text escaped for HTML content and attribute values. */
  export function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  }

  export interface MatrixTableInput {
    caption: string;
    captionId: string;
    rowHeaders: readonly string[];
    colHeaders: readonly string[];
    entries: readonly MatrixEntry[];
    shape: 'grid' | 'list';
    sparseDisplay: boolean;
    indexHeaders: boolean;
    listMax: number;
  }

  /**
   * The table as markup: a <caption>, a header row of <th scope="col"> and a <th scope="row"> per row. A
   * grid holds every entry; with index headers each column shows its index alone, the column's text kept in
   * a visually hidden span and the tooltip (the row of the same index names it). A list holds the first
   * `listMax` nonzero entries, row-major, with the columns row, column, value, or one row "no nonzero entries".
   */
  /** The horizontal padding and border of a cell, in pixels (the styles below). */
  const CELL_PAD = 14;
  /**
   * The estimate of matrixBoxSize, in pixels, measured in Chromium at the site's sizes: a unit of a <col>
   * width (the ch of the table's face), a row, and the caption.
   */
  const CHAR_PX = 10.5;
  const ROW_PX = 29;
  const CAPTION_PX = 28;

  const longest = (texts: Iterable<string>, least: number): number => {
    let m = least;
    for (const s of texts) m = Math.max(m, [...s].length);
    return m;
  };

  /**
   * The widths of the columns in characters (the <colgroup> of matrixTable, whose fixed widths let a large
   * table lay out in one pass), and the number of body rows.
   */
  export function tableColumns(t: MatrixTableInput): { widths: number[]; rows: number } {
    const cols = t.colHeaders.length;
    if (t.shape === 'grid') {
      const cell = longest(
        t.entries.map((x) => formatEntry(x.value)),
        Math.max(2, String(cols).length),
      );
      const head = longest(
        t.rowHeaders.map((h, r) => (t.indexHeaders ? `${r + 1}: ${h}` : h)),
        3,
      );
      const colWidths = t.indexHeaders ? Array.from({ length: cols }, () => cell) : t.colHeaders.map((h) => longest([h], cell));
      return { widths: [head, ...colWidths], rows: t.rowHeaders.length };
    }
    const listed = t.entries.slice(0, Math.max(0, t.listMax));
    if (listed.length === 0) return { widths: [6, 6, 8], rows: 1 };
    const rowsText = listed.map((x) => (t.indexHeaders ? `${x.row + 1}: ${t.rowHeaders[x.row]}` : t.rowHeaders[x.row]!));
    const colsText = listed.map((x) => (t.indexHeaders ? `${x.col + 1}: ${t.colHeaders[x.col]}` : t.colHeaders[x.col]!));
    return { widths: [longest(rowsText, 3), longest(colsText, 6), longest(listed.map((x) => formatEntry(x.value)), 5)], rows: listed.length };
  }

  /**
   * The markup of matrixTable in three parts: the table up to and including its <tbody>, one string per body
   * row, and the closing tags, so that a caller can build a large table over several tasks (adoptableTable;
   * SPEC 7.6). matrixTable(t) is head + rows.join('') + tail.
   */
  export function matrixTableParts(t: MatrixTableInput): { head: string; rows: string[]; tail: string } {
    const rows = t.rowHeaders.length;
    const cols = t.colHeaders.length;
    const e = escapeHtml;
    const rowText = (r: number): string => e(t.indexHeaders ? `${r + 1}: ${t.rowHeaders[r]}` : t.rowHeaders[r]!);
    const colText = (c: number): string => e(t.indexHeaders ? `${c + 1}: ${t.colHeaders[c]}` : t.colHeaders[c]!);
    const head: string[] = [];
    const body: string[] = [];
    const tail = '</tbody></table>';
    const colgroup = `<colgroup>${tableColumns(t)
      .widths.map((w) => `<col style="width: calc(${w}ch + ${CELL_PAD}px)">`)
      .join('')}</colgroup>`;
    if (t.shape === 'grid') {
      const grid: (Entry | string)[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as Entry));
      for (const x of t.entries) {
        if (x.row >= rows || x.col >= cols) throw new RangeError(`the entry ${x.row},${x.col} is outside a ${rows} by ${cols} matrix`);
        grid[x.row]![x.col] = x.value;
      }
      head.push(`<table class="matrix grid"><caption id="${e(t.captionId)}">${e(`${t.caption}, ${rows} by ${cols}`)}</caption>${colgroup}`);
      head.push('<thead><tr><th scope="col" class="corner"><span class="visually-hidden">Row</span></th>');
      for (let c = 0; c < cols; c++) {
        if (t.indexHeaders) head.push(`<th scope="col" class="col" title="${e(t.colHeaders[c]!)}">${c + 1}<span class="visually-hidden">: ${e(t.colHeaders[c]!)}</span></th>`);
        else head.push(`<th scope="col" class="col">${colText(c)}</th>`);
      }
      head.push('</tr></thead><tbody>');
      grid.forEach((row, r) => {
        const out: string[] = [`<tr><th scope="row">${rowText(r)}</th>`];
        row.forEach((v, c) => {
          const zero = isZero(v);
          if (zero && t.sparseDisplay) out.push(`<td class="zero" data-row="${r + 1}" data-col="${c + 1}" data-value="0" aria-label="0">·</td>`);
          else out.push(`<td${zero ? ' class="zero"' : ''} data-row="${r + 1}" data-col="${c + 1}" data-value="${e(valueText(v))}">${e(formatEntry(v))}</td>`);
        });
        out.push('</tr>');
        body.push(out.join(''));
      });
      return { head: head.join(''), rows: body, tail };
    }
    const listed = t.entries.slice(0, Math.max(0, t.listMax));
    head.push(`<table class="matrix list"><caption id="${e(t.captionId)}">${e(listCaption(t.caption, t.entries.length, rows, cols))}</caption>${colgroup}`);
    head.push('<thead><tr><th scope="col">Row</th><th scope="col">Column</th><th scope="col">Value</th></tr></thead><tbody>');
    for (const x of listed) {
      body.push(
        `<tr><th scope="row">${rowText(x.row)}</th><td>${colText(x.col)}</td><td class="value" data-row="${x.row + 1}" data-col="${x.col + 1}" data-value="${e(valueText(x.value))}">${e(formatEntry(x.value))}</td></tr>`,
      );
    }
    if (listed.length === 0) body.push('<tr><td colspan="3">no nonzero entries</td></tr>');
    return { head: head.join(''), rows: body, tail };
  }

  export function matrixTable(t: MatrixTableInput): string {
    const p = matrixTableParts(t);
    return p.head + p.rows.join('') + p.tail;
  }

  /** The props of a MatrixView that decide its table (the component's Props, without `out` and `adopt`). */
  export interface MatrixTableProps {
    caption: string;
    rowHeaders: readonly string[];
    colHeaders: readonly string[];
    sparse?: ReadonlyMap<string, Entry>;
    dense?: readonly (readonly (Entry | string)[])[];
    format?: 'grid' | 'list' | 'auto';
    sparseDisplay?: boolean;
    indexHeaders?: boolean;
    listMax?: number;
  }

  /**
   * The input of matrixTable for a MatrixView's props, with the defaults of its Props: the one function the
   * component and adoptableTable both use, so that a table built ahead for a view is the view's own table.
   */
  export function matrixInput(p: MatrixTableProps, captionId: string): MatrixTableInput {
    const format = p.format ?? 'auto';
    return {
      caption: p.caption,
      captionId,
      rowHeaders: p.rowHeaders,
      colHeaders: p.colHeaders,
      entries: p.sparse !== undefined ? entriesInOrder(p.sparse) : denseEntries(p.dense ?? []),
      shape: format === 'auto' ? autoFormat(p.rowHeaders.length, p.colHeaders.length) : format,
      sparseDisplay: p.sparseDisplay ?? false,
      indexHeaders: p.indexHeaders ?? false,
      listMax: p.listMax ?? Infinity,
    };
  }

  /**
   * At most about this many cells are parsed in one step of adoptableTable: a grid of 27 by 27 (the largest,
   * SPEC 5.6) then takes four steps, where parsing the whole table took 10 to 22 ms of a task of 20 to 61 ms
   * with the processor slowed four times (decisions/P5-A2.md).
   */
  export const ADOPT_CELLS = 250;

  /**
   * The table of a MatrixView with these props, built outside the page in steps for the view to take over
   * (its `adopt` prop): an element holding `.box > table`, whose body rows are parsed a few at a time, about
   * `cells` cells a step, so that a large table is not parsed in one task (SPEC 7.6). The markup is
   * matrixTable's; the view that takes the table over gives its caption the view's own id. Browser only.
   */
  export function adoptableTable(p: MatrixTableProps, cells: number = ADOPT_CELLS): { element: HTMLElement; steps: (() => void)[] } {
    const t = matrixInput(p, 'adopted-caption');
    const { head, rows, tail } = matrixTableParts(t);
    const take = Math.max(1, Math.floor(cells / (t.shape === 'grid' ? t.colHeaders.length + 1 : 3)));
    const element = document.createElement('div');
    const box = element.appendChild(document.createElement('div'));
    box.className = 'box';
    const steps: (() => void)[] = [
      () => {
        box.innerHTML = head + rows.slice(0, take).join('') + tail;
      },
    ];
    for (let at = take; at < rows.length; at += take) {
      steps.push(() => box.querySelector('tbody')!.insertAdjacentHTML('beforeend', rows.slice(at, at + take).join('')));
    }
    return { element, steps };
  }

  /**
   * An estimate of the box of the table in CSS pixels, its size while it is outside the viewport and not
   * laid out (content-visibility: auto; plan): the columns of the <colgroup> at CHAR_PX a unit plus their
   * padding and border, the body rows and the header row at ROW_PX, and the caption. Once drawn, the box
   * keeps the size it last had.
   */
  export function matrixBoxSize(t: MatrixTableInput): { width: number; height: number } {
    const { widths, rows } = tableColumns(t);
    return { width: Math.ceil(widths.reduce((s, w) => s + w * CHAR_PX + CELL_PAD + 1, 0)), height: ROW_PX * (rows + 1) + CAPTION_PX };
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  interface Props {
    /** The caption of the table (the matrix's name and what it shows). */
    caption: string;
    /** One text per row and per column (for T12, the basis positions). */
    rowHeaders: readonly string[];
    colHeaders: readonly string[];
    /** The entries: a sparse map with keys "row,column" (0-based), or a dense array of rows. */
    sparse?: ReadonlyMap<string, Entry>;
    dense?: readonly (readonly (Entry | string)[])[];
    format?: 'grid' | 'list' | 'auto';
    /** In a grid, zeros as a quiet dot (read as 0) instead of the numeral 0. */
    sparseDisplay?: boolean;
    /** Row headers start with the 1-based index, and a grid shows only the index above each column (the column's text stays for assistive technology and in the tooltip). */
    indexHeaders?: boolean;
    /** At most this many rows of a list are drawn; a sentence says how many are not (plan). */
    listMax?: number;
    /** The data-out name of the root. */
    out?: string;
    /**
     * The root of a MatrixView already on the page with these same props (for example the server's markup of
     * a panel that was not hydrated): its table is moved into this view instead of being written again, until
     * a prop changes (plan; SPEC 7.6, decisions/P5-A2.md).
     */
    adopt?: Element | null;
  }

  let { caption, rowHeaders, colHeaders, sparse, dense, format = 'auto', sparseDisplay = false, indexHeaders = false, listMax = Infinity, out, adopt = null }: Props = $props();

  const uid = $props.id();
  const rows = $derived(rowHeaders.length);
  const cols = $derived(colHeaders.length);
  const input = $derived(matrixInput({ caption, rowHeaders, colHeaders, sparse, dense, format, sparseDisplay, indexHeaders, listMax }, `${uid}-caption`));
  const shape = $derived(input.shape);
  const entries = $derived(input.entries);
  const notListed = $derived(shape === 'list' ? Math.max(0, entries.length - Math.max(0, listMax)) : 0);
  const html = $derived(matrixTable(input));
  const box = $derived(matrixBoxSize(input));

  // The table of `adopt` stands for this view's table while the props are the ones it was given first.
  const first = untrack(() => ({ caption, rowHeaders, colHeaders, sparse, dense, format, sparseDisplay, indexHeaders, listMax }));
  let released = false;
  const adopted = $derived.by((): HTMLTableElement | null => {
    if (released || adopt === null) return null;
    const same =
      caption === first.caption &&
      rowHeaders === first.rowHeaders &&
      colHeaders === first.colHeaders &&
      sparse === first.sparse &&
      dense === first.dense &&
      format === first.format &&
      sparseDisplay === first.sparseDisplay &&
      indexHeaders === first.indexHeaders &&
      listMax === first.listMax;
    if (!same) {
      released = true;
      return null;
    }
    return adopt.querySelector<HTMLTableElement>('.box > table');
  });

  /** Moves the adopted table into this view's box, with its caption's id made this view's own. */
  function moveIn(node: HTMLElement, table: HTMLTableElement): void {
    const c = table.querySelector('caption');
    if (c !== null) c.id = `${uid}-caption`;
    node.append(table);
  }
</script>

<div class="matrix-view" data-out={out} data-format={shape} data-rows={rows} data-cols={cols}>
  <!-- A scroll box is a tab stop so that a wide matrix can be scrolled from the keyboard (A-11; axe scrollable-region-focusable). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="box" tabindex="0" role="group" aria-labelledby="{uid}-caption" style="contain-intrinsic-size: auto {box.width}px auto {box.height}px;">{#if adopted !== null}<div class="adopted" use:moveIn={adopted}></div>{:else}{@html html}{/if}</div>
  {#if notListed > 0}
    <p class="more">The first {entries.length - notListed} of {entries.length} nonzero entries are listed; Download data holds them all.</p>
  {/if}
</div>

<style>
  .matrix-view {
    min-width: 0;
    max-width: 100%;
  }
  /* A wide matrix scrolls inside its own box, which is a tab stop with a name (A-11, A-2). A box outside the
     viewport is not laid out until the reader comes near it (content-visibility: auto, with the estimated
     size of matrixBoxSize and then the size it last had): the tables of a large orbit are drawn without a
     long task (SPEC 7.6; measured on E7). The content stays in the accessibility tree and in find in page. */
  .box {
    overflow-x: auto;
    max-width: 100%;
    border-radius: 4px;
    content-visibility: auto;
  }
  .box:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .adopted {
    display: contents;
  }
  /* Fixed layout from the <colgroup> widths (in ch of the monospaced face of every cell): a table of 729
     cells lays out in one pass, where the automatic table layout measured every cell (SPEC 7.6). */
  .box :global(.matrix) {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    table-layout: fixed;
    width: max-content;
  }
  .box :global(.matrix th),
  .box :global(.matrix td) {
    font-family: var(--font-numerals, monospace);
  }
  .box :global(.matrix caption) {
    text-align: start;
    padding-bottom: 4px;
  }
  .box :global(.matrix th),
  .box :global(.matrix td) {
    padding: 2px 6px;
    text-align: center;
    white-space: nowrap;
  }
  .box :global(.matrix th[scope='row']) {
    text-align: start;
    font-weight: normal;
    font-family: var(--font-numerals, monospace);
  }
  .box :global(.matrix th.col) {
    font-weight: normal;
    font-family: var(--font-numerals, monospace);
  }
  .box :global(.matrix td) {
    font-family: var(--font-numerals, monospace);
    border: 1px solid var(--sign-zero-outline);
    min-width: 1.5em;
  }
  .box :global(.matrix td.zero) {
    color: color-mix(in srgb, var(--text) 70%, var(--page));
  }
  .box :global(.visually-hidden) {
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
  .more {
    margin: 4px 0 0;
  }
</style>
