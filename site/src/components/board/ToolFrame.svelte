<script module lang="ts">
  /** What ToolFrame passes to its snippets: whether the island has hydrated, and the announcer. */
  export interface FrameApi {
    readonly hydrated: boolean;
    announce: (text: string) => void;
  }
</script>

<script lang="ts">
  // (The prop `state` is read as `toolState` inside: a local named `state` would turn `$state` into a store read.)
  // The chrome every tool is drawn inside (CONTRACTS.md 5.1; SPEC.md 4.0, 7.4, 7.5 A-4 and A-10).
  // Owner P1-A2. Rendered in full at build time: title, the figure inside a <figure> with its caption
  // as text alternative, every control (disabled until hydration), "Copy link" and "Download data",
  // the "Show as table" view inside a <details>, the <noscript> line, and one polite live region per
  // instance, empty before the first move. Hydration only removes `disabled`, so the box does not
  // change size (7.6). The frame never starts a play.
  // Hooks: data-frame, data-tool, data-moves, data-hydrated on the root; data-out="caption",
  // "notice", "noscript"; data-control="undo", "redo", "reset", "copyLink", "downloadData"; data-live.
  // P2-A6 (additive): data-export="svg", "png"; data-export-option="footer", "labels"; data-out="exportNotice".
  // P6-A5 (additive): data-control="latex", "cite"; data-out="citeText", rendered after a click on Cite.
  // P6-A3 (additive, MERGE ruling (3) on P6-A3): the prop `moves` overrides state.moves?.length for data-moves,
  // for a tool whose moves are not part of its state (T13 keeps its steps out of the link).
  // RT-FIX P6-RT-05-02 (additive): data-scroll="table-view" on the table view's scroll box.
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import { createAnnouncer } from '../../lib/a11y';
  import type { LatexChoice } from '../../lib/export';
  import { copyLink, linkFor, registerInstance, stateChanged, unregisterInstance } from '../../lib/history';
  import type { ToolId, ToolState } from '../../lib/state';

  interface Props {
    toolId: ToolId;
    /** The instance id on a lesson page ('b2'); empty on a tool's own route, where keys are bare. */
    instanceId?: string;
    title: string;
    /** States the result the figure demonstrates (4.0 "Starts meaningful"). */
    caption: string;
    state: ToolState;
    /** P6-A3: the number of moves for data-moves when the moves are not in the state; default state.moves?.length. */
    moves?: number;
    derivedForExport?: Record<string, unknown> | (() => Record<string, unknown>);
    onUndo?: () => void;
    onRedo?: () => void;
    onReset?: () => void;
    /** The notice of a link that could not be read (LINK_NOTICE), shown in data-out="notice". */
    notice?: string | null;
    /** The text alternative of the figure (A-10); without it the figure is labelled by its caption. */
    figureLabel?: string;
    /** The state the page author configured; links write only what differs from it (default: state). */
    defaults?: ToolState;
    /** Called with the state re-read from the URL after the back button (history.ts). */
    onPopState?: (state: ToolState, notice: string | null) => void;
    /** P2-A6: the board name of the export footer (SPEC 8.3, D19); default: state.board when it is a name, else `custom board`. */
    boardName?: string;
    /** P6-A5: what "Export LaTeX" writes; default: the diagram of a named finite board (defaultLatexExport). */
    latexForExport?: LatexChoice | (() => LatexChoice | null);
    figure: Snippet<[FrameApi]>;
    controls?: Snippet<[FrameApi]>;
    table?: Snippet<[FrameApi]>;
  }

  let {
    toolId,
    instanceId = '',
    title,
    caption,
    state: toolState,
    moves: movesOverride,
    derivedForExport = {},
    onUndo,
    onRedo,
    onReset,
    notice = null,
    figureLabel,
    defaults,
    onPopState,
    boardName,
    latexForExport,
    figure,
    controls,
    table,
  }: Props = $props();

  const uid = $props.id();
  const titleId = `${uid}-title`;
  const captionId = `${uid}-caption`;

  let hydrated = $state(false);
  let region: HTMLDivElement | undefined = $state();
  let announcer: ((text: string) => void) | null = null;
  const announce = (text: string): void => {
    announcer?.(text);
  };
  const api: FrameApi = {
    get hydrated() {
      return hydrated;
    },
    announce,
  };

  const moves = $derived(movesOverride ?? toolState.moves?.length ?? 0);
  const hasHistoryRow = $derived(onUndo !== undefined || onRedo !== undefined || onReset !== undefined);

  // $effect runs only in the browser: this is hydration.
  $effect(() => {
    if (region && announcer === null) announcer = createAnnouncer(region);
    hydrated = true;
  });

  // Register the instance once; registering writes nothing to the address bar.
  $effect(() => {
    const id = instanceId;
    untrack(() => registerInstance(id, defaults ?? toolState, (s, n) => onPopState?.(s, n), toolState));
    return () => unregisterInstance(id);
  });

  // Every change of the state goes through stateChanged (one replaceState after a burst, 7.4);
  // a state equal to the one recorded is ignored there, so hydration writes nothing.
  $effect(() => {
    stateChanged(untrack(() => instanceId), toolState);
  });

  async function onCopyLink(): Promise<void> {
    const ok = await copyLink(instanceId, typeof navigator !== 'undefined' ? navigator.clipboard : undefined);
    announce(ok ? 'Link copied.' : 'The link could not be copied.');
  }

  async function onDownloadData(): Promise<void> {
    const { downloadData } = await import('../../lib/export');
    const derived = typeof derivedForExport === 'function' ? derivedForExport() : derivedForExport;
    const { filename, text } = downloadData(toolId, instanceId, toolState, derived);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    announce(`Downloaded ${filename}.`);
  }

  // P2-A6: figure export (SPEC 4.0 "Share and export", 6.1, 8.3). The options act on the exported
  // copy only: the page keeps its labels. Nothing starts on load; only a click or a key exports.
  let figureEl: HTMLElement | undefined = $state();
  let exportFooter = $state(true);
  let exportLabels = $state(true);
  let exportNotice = $state('');

  /** The figure's drawings in document order: not inside a button, link, label or summary, at least 32 by 32. */
  function figureSvgs(): SVGSVGElement[] {
    if (!figureEl) return [];
    return [...figureEl.querySelectorAll('svg')].filter((s) => {
      if (s.parentElement?.closest('svg, button, a, label, summary')) return false;
      const r = s.getBoundingClientRect();
      return r.width >= 32 && r.height >= 32;
    });
  }

  function save(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function onExport(kind: 'svg' | 'png'): Promise<void> {
    try {
      const ex = await import('../../lib/export');
      const svgs = figureSvgs();
      if (svgs.length === 0) throw new Error('nothing to export');
      const name = boardName ?? (typeof toolState.board === 'string' ? toolState.board : 'custom board');
      const footer = exportFooter ? { boardName: name, link: linkFor(instanceId) } : null;
      const fig = !exportLabels ? ex.withoutLabels(ex.composeFigure(svgs)) : svgs.length === 1 ? svgs[0]! : ex.composeFigure(svgs);
      const blob = kind === 'svg' ? new Blob([ex.exportSVG(fig, footer)], { type: 'image/svg+xml;charset=utf-8' }) : await ex.exportPNG(fig, footer);
      save(blob, ex.exportFileName(toolId, name, kind));
      exportNotice = '';
    } catch (e) {
      exportNotice = e instanceof Error ? e.message : String(e);
    }
  }

  // P6-A5: LaTeX export and the citation (SPEC 6.7, 7.4 "Citing"). export.ts is fetched on the first
  // click, as for the other exports; nothing starts on load. The result is announced in the live
  // region, as for Download data and Cite (SPEC 7.5, WCAG 4.1.3): the file, or the notice.
  let citation = $state('');

  async function onExportLatex(): Promise<void> {
    try {
      const { latexDownload } = await import('../../lib/export');
      const { filename, text } = latexDownload(latexForExport, toolState, toolId, boardName, linkFor(instanceId));
      save(new Blob([text], { type: 'application/x-tex' }), filename);
      exportNotice = '';
      announce(`Downloaded ${filename}.`);
    } catch (e) {
      exportNotice = e instanceof Error ? e.message : String(e);
      announce(exportNotice);
    }
  }

  async function onCite(): Promise<void> {
    let copied = false;
    try {
      citation = (await import('../../lib/export')).citation(document.title, linkFor(instanceId));
      await navigator.clipboard.writeText(citation);
      copied = true;
    } catch {
      // No clipboard (permission, an insecure origin): the text stays shown below the tool.
    }
    announce(copied ? 'Citation copied.' : citation ? 'Citation shown below the tool.' : 'The citation could not be made.');
  }
</script>

<section
  class="tool-frame"
  data-frame=""
  data-tool={toolId}
  data-instance={instanceId}
  data-moves={moves}
  data-hydrated={hydrated ? 'true' : undefined}
  aria-labelledby={titleId}
>
  <p class="tool-title" id={titleId}>{title}</p>
  {#if notice}
    <p class="notice" data-out="notice" role="note">{notice}</p>
  {/if}
  <figure class="tool-figure" bind:this={figureEl} aria-label={figureLabel} aria-labelledby={figureLabel ? undefined : captionId}>
    {@render figure(api)}
    <figcaption id={captionId} data-out="caption">{caption}</figcaption>
  </figure>
  {#if hasHistoryRow}
    <div class="row">
      {#if onUndo}<button type="button" class="control" data-control="undo" disabled={!hydrated} onclick={() => onUndo?.()}>Undo</button>{/if}
      {#if onRedo}<button type="button" class="control" data-control="redo" disabled={!hydrated} onclick={() => onRedo?.()}>Redo</button>{/if}
      {#if onReset}<button type="button" class="control" data-control="reset" disabled={!hydrated} onclick={() => onReset?.()}>Reset</button>{/if}
    </div>
  {/if}
  {#if controls}
    <fieldset class="row controls" data-controls="" disabled={!hydrated}>
      <legend class="visually-hidden">Controls</legend>
      {@render controls(api)}
    </fieldset>
  {/if}
  <div class="row share">
    <button type="button" class="control" data-control="copyLink" disabled={!hydrated} onclick={onCopyLink}>Copy link</button>
    <button type="button" class="control" data-control="downloadData" disabled={!hydrated} onclick={onDownloadData}>Download data</button>
    <button type="button" class="control" data-export="svg" disabled={!hydrated} onclick={() => onExport('svg')}>Export SVG</button>
    <button type="button" class="control" data-export="png" disabled={!hydrated} onclick={() => onExport('png')}>Export PNG</button>
    <button type="button" class="control" data-control="latex" disabled={!hydrated} onclick={onExportLatex}>Export LaTeX</button>
    <button type="button" class="control" data-control="cite" disabled={!hydrated} onclick={onCite}>Cite</button>
    <fieldset class="export-options">
      <legend class="visually-hidden">Export options</legend>
      <label class="export-option"><input type="checkbox" data-export-option="footer" disabled={!hydrated} bind:checked={exportFooter} /> Footer line</label>
      <label class="export-option"><input type="checkbox" data-export-option="labels" disabled={!hydrated} bind:checked={exportLabels} /> Node labels</label>
    </fieldset>
    <span class="export-notice" data-out="exportNotice">{exportNotice}</span>
  </div>
  {#if citation}<p class="cite-text" data-out="citeText">{citation}</p>{/if}
  {#if table}
    <details class="table-view">
      <summary>Show as table</summary>
      <!-- RT-FIX P6-RT-05-02 (A-11, A-1): the box the table scrolls in is a tab stop with a name of its own, so it
           scrolls from the keyboard while every button inside is disabled (before hydration, or while a
           prediction freezes the tool); the fieldset inside it disables the buttons until hydration. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="bare" tabindex="0" role="group" aria-label="Table of {title}" data-scroll="table-view">
        <fieldset class="table-fields" disabled={!hydrated}>
          {@render table(api)}
        </fieldset>
      </div>
    </details>
  {/if}
  <p class="nojs"><noscript><span data-out="noscript">Interactive when scripts are allowed.</span></noscript></p>
  <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-live="" bind:this={region}></div>
</section>

<style>
  /* RT-FIX P4-RT-05-02: one column no wider than the frame. With the implicit auto column a child's
     min-content width (an open "Show as table" view) set the width of the whole frame at 320 pixels;
     now the table scrolls inside its own box (.bare), and prose and controls reflow (A-11). */
  .tool-frame {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 24px 0;
    container-type: inline-size;
  }
  .tool-title {
    margin: 0;
    font-weight: bold;
  }
  .notice {
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--sign-neg-outline);
    border-radius: 6px;
  }
  .tool-figure {
    margin: 0;
    container-type: inline-size;
  }
  .tool-figure figcaption {
    margin-top: 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin: 0;
    padding: 0;
    border: 0;
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
  .control:focus-visible,
  .table-view summary:focus-visible,
  .bare:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .table-view summary {
    min-height: 44px;
    line-height: 44px;
    cursor: pointer;
  }
  .bare {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
    overflow-x: auto;
  }
  .table-fields {
    margin: 0;
    padding: 0;
    border: 0;
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
  /* P2-A6: the export options; targets 44 pixels high, checkboxes 24 (A-7), wrapping at 320 (A-11). */
  .export-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .export-option {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    cursor: pointer;
  }
  .export-option input {
    width: 24px;
    height: 24px;
    margin: 0;
  }
  .export-option input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .export-notice:empty {
    display: none;
  }
  /* P6-A5: the citation, selectable and wrapping at 320 pixels (A-11). */
  .cite-text {
    margin: 0;
    overflow-wrap: anywhere;
    user-select: text;
  }
  @media (max-width: 399.98px) {
    .tool-figure {
      margin-inline: -16px;
    }
    .tool-figure figcaption {
      padding-inline: 16px;
    }
  }
</style>
