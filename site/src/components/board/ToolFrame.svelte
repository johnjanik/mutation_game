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
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import { createAnnouncer } from '../../lib/a11y';
  import { copyLink, registerInstance, stateChanged, unregisterInstance } from '../../lib/history';
  import type { ToolId, ToolState } from '../../lib/state';

  interface Props {
    toolId: ToolId;
    /** The instance id on a lesson page ('b2'); empty on a tool's own route, where keys are bare. */
    instanceId?: string;
    title: string;
    /** States the result the figure demonstrates (4.0 "Starts meaningful"). */
    caption: string;
    state: ToolState;
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
    derivedForExport = {},
    onUndo,
    onRedo,
    onReset,
    notice = null,
    figureLabel,
    defaults,
    onPopState,
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

  const moves = $derived(toolState.moves?.length ?? 0);
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
  <figure class="tool-figure" aria-label={figureLabel} aria-labelledby={figureLabel ? undefined : captionId}>
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
    <!-- Later buttons go here: "Export SVG" and "Export PNG" (phase 2, P2-A6); "Export LaTeX" and "Cite" (phase 6, P6-A5). -->
  </div>
  {#if table}
    <details class="table-view">
      <summary>Show as table</summary>
      <fieldset class="bare" disabled={!hydrated}>
        <legend class="visually-hidden">Table of {title}</legend>
        {@render table(api)}
      </fieldset>
    </details>
  {/if}
  <p class="nojs"><noscript><span data-out="noscript">Interactive when scripts are allowed.</span></noscript></p>
  <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-live="" bind:this={region}></div>
</section>

<style>
  .tool-frame {
    position: relative;
    display: grid;
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
  .table-view summary:focus-visible {
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
  @media (max-width: 399.98px) {
    .tool-figure {
      margin-inline: -16px;
    }
    .tool-figure figcaption {
      padding-inline: 16px;
    }
  }
</style>
