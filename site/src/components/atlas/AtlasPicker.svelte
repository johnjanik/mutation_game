<script lang="ts">
  // The Atlas on its tool routes, /tools/atlas and /embed/atlas (SPEC.md 4 T14; 4.0 Board pickers: "the
  // 32 named types, grouped by letter"; 7.4 Embedding). Owner P6-A4. The Atlas itself is static pages
  // (/atlas/<board>/, CONTRACTS 6: "T14 is static pages"); this component is what the registry renders on
  // the tool routes: the caption, then the 32 boards grouped by letter, each a native link to its Atlas page
  // with the drawing of the board beside it (6.1, 6.2; role img with a name, A-10), and the Cite button.
  // With a `g` in the URL that names one of the 32 boards (read through decodeState, 6.6, with this
  // instance's prefix; a link that cannot be read shows the notice of 6.6), that board's link comes first.
  // Rendered at build time with the default state (no board chosen); hydration reads the URL and enables
  // Cite. No step, no moves, no history: nothing here changes a state (plan readings, decisions/P6-A4.md).
  // Keyboard (A-1, A-2): every board is an ordinary link, reached with Tab and followed with Enter; no key
  // handling of its own and no focus trap; the focus ring is the card's.
  // Engine use: the drawings call the site's drawing code, which reads the boards from the engine
  // (boardFromName and adjacency, imported by name; P6-size); the plan's "calls no engine function" is a
  // deviation recorded in decisions/P6-A4.md, made because every tool route needs a default figure
  // (nojs.spec.ts, embed.spec.ts). Nothing is enumerated and nothing needs the worker (E-9).
  // Hooks: data-tool="atlas", data-instance, data-moves="" (no moves), data-hydrated on the root;
  // data-out="caption", "notice", "chosen", "citeText", "noscript"; data-board-link on each link,
  // data-group on each group, data-control="cite", data-live.
  import { untrack } from 'svelte';
  import { createAnnouncer } from '../../lib/a11y';
  import type { ToolState } from '../../lib/state';
  import { decodeState } from '../../lib/urlCodec';
  import { ATLAS_BOARDS, ATLAS_GROUPS, isAtlasBoard } from './boards';
  import Diagram from './Diagram.svelte';
  import { boardDiagram } from './diagram';

  interface Props {
    /** The instance id ('' on a tool's own route, where the URL keys are bare). */
    id?: string;
    caption?: string;
    /** Accepted for the tool routes; the Atlas has no preset but `default` (CONTRACTS 6). */
    preset?: string;
  }

  let { id = '', caption = `The Atlas has a data sheet for each of the ${ATLAS_BOARDS.length} boards of finite type: choose a board to open its page.` }: Props = $props();

  const base = import.meta.env.BASE_URL;
  const hrefOf = (name: string): string => `${base}atlas/${name}/`;
  /** The default state of the route (plan): no board chosen; decodeState needs one, and only `g` chooses. */
  const DEFAULTS: ToolState = { schema: 1, tool: 'atlas', board: ATLAS_BOARDS[0]! };
  const groups = ATLAS_GROUPS.map((g) => ({ letter: g.letter, boards: g.names.map((name) => ({ name, diagram: boardDiagram(name, 30) })) }));

  let hydrated = $state(false);
  let chosen: string | null = $state(null);
  let notice: string | null = $state(null);
  let citation = $state('');
  let region: HTMLDivElement | undefined = $state();
  let announcer: ((text: string) => void) | null = null;

  // $effect runs only in the browser: this is hydration. The URL is read once.
  $effect(() => {
    untrack(() => {
      const prefix = id ? `${id}.` : '';
      const search = window.location.search;
      const read = decodeState(search, 'atlas', DEFAULTS, { prefix: id });
      notice = read.notice;
      const named = new URLSearchParams(search).has(`${prefix}g`);
      chosen = read.notice === null && named && isAtlasBoard(read.state.board) ? read.state.board : null;
      hydrated = true;
    });
  });

  $effect(() => {
    if (region && announcer === null) announcer = createAnnouncer(region);
  });

  async function onCite(): Promise<void> {
    let copied = false;
    try {
      citation = (await import('../../lib/export')).citation(document.title, window.location.href);
      await navigator.clipboard.writeText(citation);
      copied = true;
    } catch {
      // No clipboard (permission, an insecure origin): the text stays shown below the list.
    }
    announcer?.(copied ? 'Citation copied.' : citation ? 'Citation shown below the tool.' : 'The citation could not be made.');
  }
</script>

<section class="atlas-picker" data-tool="atlas" data-instance={id} data-moves="" data-hydrated={hydrated ? 'true' : undefined} aria-label="The boards of the Atlas">
  <p class="caption" data-out="caption">{caption}</p>
  {#if notice}
    <p class="notice" data-out="notice" role="note">{notice}</p>
  {/if}
  {#if chosen}
    <p class="chosen" data-out="chosen"><a href={hrefOf(chosen)} data-board-link={chosen}>Open the Atlas page of {chosen}</a>, the board this link names.</p>
  {/if}
  {#each groups as group (group.letter)}
    <section class="group" aria-labelledby="atlas-group-{group.letter}" data-group={group.letter}>
      <h2 id="atlas-group-{group.letter}">Type {group.letter}</h2>
      <ul class="cards">
        {#each group.boards as b (b.name)}
          <li class="card">
            <a href={hrefOf(b.name)} data-board-link={b.name}>{b.name}</a>
            <Diagram diagram={b.diagram} label={`Diagram of ${b.name}`} />
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  <div class="row">
    <button type="button" class="control" data-control="cite" disabled={!hydrated} onclick={onCite}>Cite</button>
  </div>
  {#if citation}<p class="cite-text" data-out="citeText">{citation}</p>{/if}
  <p class="nojs"><noscript><span data-out="noscript">Every link here works without scripts; the Cite button needs them.</span></noscript></p>
  <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-live="" bind:this={region}></div>
</section>

<style>
  .atlas-picker {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .caption,
  .notice,
  .chosen {
    margin: 0;
  }
  .chosen a {
    display: inline-block;
    min-height: 24px;
    font-weight: 600;
  }
  .group h2 {
    margin: 16px 0 8px;
    font-size: 1.15rem;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 4px;
    min-width: 0;
  }
  .card a {
    display: inline-block;
    min-height: 24px;
    color: var(--text);
    font-family: var(--font-numerals);
  }
  /* The whole card follows its link; the drawing stays outside the link, an image with its own name. */
  .card a::after {
    content: '';
    position: absolute;
    inset: 0;
  }
  .card:has(a:focus-visible) {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .card a:focus-visible {
    outline: none;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
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
  .control:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .cite-text {
    margin: 0;
    overflow-wrap: anywhere;
    user-select: text;
  }
  .nojs {
    margin: 0;
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
