<script lang="ts">
  // A challenge of a lesson (P1-A4; SPEC.md 8.2 item 6, 8.5, 9.2): a goal and a check that reports
  // success. The lesson hydrates it with client:visible. Without JavaScript the goal is shown with a
  // <details> explanation and the polite status region is present and empty (A-4 pattern).
  // With JavaScript the component finds the tool root [data-tool][data-instance="<for>"] and watches
  // only the hooks of SPEC.md 4.0 with a MutationObserver. When the check is met it sets
  // data-met="true", shows <p data-challenge-result> and announces the result once. Before that the
  // result element is absent.
  // Never import @lib/golden, @lib/sources or @lib/unverifiedRegistry here (they would enter the
  // client bundle). Numbers with a golden value come from the lesson, resolved at build time.
  import {
    SUCCESS_TEXT,
    acceptsInput,
    evaluate,
    validateCheck,
    valuesOf,
    vectorKey,
    type BoardView,
    type ChallengeCheck,
    type NodeReading,
    type Observation,
  } from '@lib/pages/challengeCheck';
  import { untrack } from 'svelte';

  interface Props {
    /** The goal, one sentence. */
    goal: string;
    /** The site's explanation, shown in a <details> element. */
    explanation: string;
    /** The instance id of the tool the check reads (for example "b9"). */
    for?: string;
    /** The declarative check (lib/pages/challengeCheck.ts). */
    check: ChallengeCheck;
  }

  let { goal, explanation, for: forId, check: rawCheck }: Props = $props();
  // The check is a serialised island prop that never changes after the page is built.
  const check = $derived(validateCheck(rawCheck));
  const uid = $props.id();

  let hydrated = $state(false);
  let met = $state(false);
  let status = $state('');
  let typed = $state('');
  let inputAccepted = $state(false);
  let inputTried = $state(false);
  const seen: Record<BoardView, Set<string>> = { populations: new Set(), numbers: new Set() };

  function readTool(root: Element | null): Omit<Observation, 'seen' | 'inputAccepted'> {
    if (!root) return { outs: {}, nodes: [], moves: null };
    const outs: Record<string, string> = {};
    for (const el of root.querySelectorAll('[data-out]')) outs[el.getAttribute('data-out') ?? ''] = el.textContent ?? '';
    const nodes: NodeReading[] = [];
    for (const el of root.querySelectorAll('[data-node]')) {
      nodes.push({ label: Number(el.getAttribute('data-node')), board: el.getAttribute('data-board') ?? '', value: el.getAttribute('data-value') ?? '' });
    }
    const m = root.getAttribute('data-moves');
    return { outs, nodes, moves: m === null || m === '' ? null : Number(m) };
  }

  function update(root: Element | null): void {
    if (met) return;
    const reading = readTool(root);
    for (const board of ['populations', 'numbers'] as const) {
      const values = valuesOf(reading.nodes, board);
      if (values.length > 0) seen[board].add(vectorKey(values));
    }
    const observation: Observation = { ...reading, seen: { populations: seen.populations.size, numbers: seen.numbers.size }, inputAccepted };
    if (evaluate(check, observation)) {
      met = true;
      status = SUCCESS_TEXT;
    }
  }

  let toolRoot: Element | null = null;

  $effect(() => {
    hydrated = true;
    if (!forId) {
      untrack(() => update(null));
      return;
    }
    toolRoot = document.querySelector(`[data-tool][data-instance="${CSS.escape(forId)}"]`);
    untrack(() => update(toolRoot));
    if (!toolRoot) return;
    const observer = new MutationObserver(() => update(toolRoot));
    observer.observe(toolRoot, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-value', 'data-moves', 'data-node', 'data-board'] });
    return () => observer.disconnect();
  });

  async function tryInput(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (check.kind !== 'input' || met) return;
    // The engine is loaded only for this kind, so other challenges never fetch it.
    const engine = await import('@engine');
    inputTried = true;
    inputAccepted = acceptsInput(check.predicate, check.board, typed, engine);
    update(toolRoot);
  }
</script>

<div class="challenge" data-challenge data-kind={check.kind} data-met={met ? 'true' : undefined}>
  <p class="goal"><span class="label">Challenge.</span> {goal}</p>
  {#if check.kind === 'input'}
    <form class="answer" onsubmit={tryInput}>
      <label for={`${uid}-input`}>Your population, entries in label order</label>
      <input id={`${uid}-input`} type="text" inputmode="text" autocomplete="off" spellcheck="false" bind:value={typed} disabled={!hydrated || met} />
      <button type="submit" disabled={!hydrated || met}>Check</button>
      {#if inputTried && !met}<p class="retry">Not this one. Try another population.</p>{/if}
    </form>
  {:else if check.kind === 'explain'}
    <label class="free" for={`${uid}-text`}>Your explanation (not graded)</label>
    <textarea id={`${uid}-text`} rows="3" disabled={!hydrated}></textarea>
  {/if}
  {#if met}<p class="result" data-challenge-result>{SUCCESS_TEXT}</p>{/if}
  <details>
    <summary>{check.kind === 'explain' ? "The site's explanation" : 'Explanation'}</summary>
    <p>{explanation}</p>
  </details>
  <div class="status" role="status" aria-live="polite">{status}</div>
</div>

<style>
  .challenge {
    border: 1px solid var(--sign-zero-outline);
    border-radius: 4px;
    padding: 12px 16px;
    margin-block: 16px;
  }
  .goal {
    margin-top: 0;
  }
  .label {
    font-weight: 700;
  }
  .result {
    font-weight: 700;
  }
  .result::before {
    content: '\2713\00a0';
  }
  .answer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .answer label {
    flex-basis: 100%;
  }
  input,
  textarea,
  button {
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--sign-zero-outline);
    min-height: 44px;
    max-width: 100%;
    box-sizing: border-box;
  }
  textarea {
    width: 100%;
  }
  input:focus-visible,
  textarea:focus-visible,
  button:focus-visible,
  summary:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .free {
    display: block;
  }
  summary {
    cursor: pointer;
    min-height: 24px;
  }
  .status {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
