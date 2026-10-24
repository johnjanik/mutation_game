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
</script>

<script lang="ts">
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
    /** Headers start with the 1-based index; wide grids show only the index above each column (the text stays for assistive technology and in the tooltip). */
    indexHeaders?: boolean;
    /** At most this many rows of a list are drawn; a sentence says how many are not (plan). */
    listMax?: number;
    /** The data-out name of the root. */
    out?: string;
  }

  let { caption, rowHeaders, colHeaders, sparse, dense, format = 'auto', sparseDisplay = false, indexHeaders = false, listMax = Infinity, out }: Props = $props();

  const uid = $props.id();
  const rows = $derived(rowHeaders.length);
  const cols = $derived(colHeaders.length);
  const shape = $derived(format === 'auto' ? autoFormat(rows, cols) : format);
  const entries = $derived(sparse !== undefined ? entriesInOrder(sparse) : denseEntries(dense ?? []));
  const grid = $derived.by(() => {
    if (shape !== 'grid') return null;
    const g: (Entry | string)[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as Entry));
    for (const e of entries) {
      if (e.row >= rows || e.col >= cols) throw new RangeError(`the entry ${e.row},${e.col} is outside a ${rows} by ${cols} matrix`);
      g[e.row]![e.col] = e.value;
    }
    return g;
  });
  const listed = $derived(shape === 'list' ? entries.slice(0, Math.max(0, listMax)) : []);
  const notListed = $derived(shape === 'list' ? entries.length - listed.length : 0);
  /** Columns are shown by index alone when the grid is wider than six columns (plan). */
  const compact = $derived(indexHeaders && cols > 6);
  const rowText = (r: number): string => (indexHeaders ? `${r + 1}: ${rowHeaders[r]}` : rowHeaders[r]!);
  const colText = (c: number): string => (indexHeaders ? `${c + 1}: ${colHeaders[c]}` : colHeaders[c]!);
  const shownCaption = $derived(shape === 'grid' ? `${caption}, ${rows} by ${cols}` : listCaption(caption, entries.length, rows, cols));
</script>

<div class="matrix-view" data-out={out} data-format={shape} data-rows={rows} data-cols={cols}>
  <!-- A scroll box is a tab stop so that a wide matrix can be scrolled from the keyboard (A-11; axe scrollable-region-focusable). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="box" tabindex="0" role="group" aria-labelledby="{uid}-caption">
    <table class="matrix" class:grid={shape === 'grid'}>
      <caption id="{uid}-caption">{shownCaption}</caption>
      {#if grid !== null}
        <thead>
          <tr>
            <th scope="col" class="corner"><span class="visually-hidden">Row</span></th>
            {#each colHeaders as _h, c (c)}
              {#if compact}
                <th scope="col" class="col" title={colHeaders[c]}>{c + 1}<span class="visually-hidden">: {colHeaders[c]}</span></th>
              {:else}
                <th scope="col" class="col">{colText(c)}</th>
              {/if}
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each grid as row, r (r)}
            <tr>
              <th scope="row">{rowText(r)}</th>
              {#each row as v, c (c)}
                {#if sparseDisplay && isZero(v)}
                  <td class="zero" data-row={r + 1} data-col={c + 1} data-value="0" aria-label="0">·</td>
                {:else}
                  <td class:zero={isZero(v)} data-row={r + 1} data-col={c + 1} data-value={valueText(v)}>{formatEntry(v)}</td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      {:else}
        <thead>
          <tr><th scope="col">Row</th><th scope="col">Column</th><th scope="col">Value</th></tr>
        </thead>
        <tbody>
          {#each listed as e (`${e.row},${e.col}`)}
            <tr>
              <th scope="row">{rowText(e.row)}</th>
              <td>{colText(e.col)}</td>
              <td class="value" data-row={e.row + 1} data-col={e.col + 1} data-value={valueText(e.value)}>{formatEntry(e.value)}</td>
            </tr>
          {:else}
            <tr><td colspan="3">no nonzero entries</td></tr>
          {/each}
        </tbody>
      {/if}
    </table>
  </div>
  {#if notListed > 0}
    <p class="more">The first {listed.length} of {entries.length} nonzero entries are listed; Download data holds them all.</p>
  {/if}
</div>

<style>
  .matrix-view {
    min-width: 0;
    max-width: 100%;
  }
  /* A wide matrix scrolls inside its own box, which is a tab stop with a name (A-11, A-2). */
  .box {
    overflow-x: auto;
    max-width: 100%;
    border-radius: 4px;
  }
  .box:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .matrix {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .matrix caption {
    text-align: start;
    padding-bottom: 4px;
  }
  .matrix th,
  .matrix td {
    padding: 2px 6px;
    text-align: center;
    white-space: nowrap;
  }
  .matrix th[scope='row'] {
    text-align: start;
    font-weight: normal;
    font-family: var(--font-numerals, monospace);
  }
  .matrix th.col {
    font-weight: normal;
    font-family: var(--font-numerals, monospace);
  }
  .matrix td {
    font-family: var(--font-numerals, monospace);
    border: 1px solid var(--sign-zero-outline);
    min-width: 1.5em;
  }
  .matrix td.zero {
    color: color-mix(in srgb, var(--text) 70%, var(--page));
  }
  .more {
    margin: 4px 0 0;
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
