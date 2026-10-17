<script lang="ts">
  // A prediction (SPEC.md 4.0 Predict, 8.1 P5, 8.5; CONTRACTS.md 5.2 `Prediction`), reusable by any
  // tool. "The board is frozen until the reader has answered or pressed "show me". Without JavaScript
  // the question is followed by a <details> element holding the answer and the reveal." The tool
  // freezes its own board while `onResolved` has not been called. Controls are disabled until
  // hydration (7.4). Hooks: data-prediction on the root; data-control="predictAnswer" (each input),
  // "predictCheck", "predictShow"; data-out="predictResult", "predictReveal".
  import type { Prediction } from '../../tools/types';
  import { predictionAnswerText, predictionCorrect, type PredictionAnswer } from '../tools/t01/interop';

  interface Props {
    prediction: Prediction;
    hydrated: boolean;
    /** Called once, when the reader has answered (right or wrong) or pressed "show me". */
    onResolved?: (outcome: 'correct' | 'wrong' | 'shown') => void;
    /** Labels of the nodes, for a position answer (one field per node). */
    labels?: readonly number[];
    /** Announces the result through the tool's live region. */
    announce?: (text: string) => void;
  }

  let { prediction, hydrated, onResolved, labels = [], announce }: Props = $props();

  const uid = $props.id();
  let numberAnswer = $state('');
  let positionAnswer = $state<string[]>([]);
  let choiceAnswer = $state<number | null>(null);
  let resolved = $state<'correct' | 'wrong' | 'shown' | null>(null);

  const answerText = $derived(predictionAnswerText(prediction));
  const fields = $derived(prediction.answer.type === 'position' ? prediction.answer.value.length : 0);

  /** The answer closing a sentence: a full stop is added unless the answer already ends one (a choice is often a sentence). */
  const closed = $derived(/[.!?]$/.test(answerText) ? answerText : `${answerText}.`);
  const resultText = $derived(
    resolved === 'correct' ? `Right: ${closed}` : resolved === 'wrong' ? `Not quite: the answer is ${closed}` : resolved === 'shown' ? `The answer is ${closed}` : '',
  );

  function read(): PredictionAnswer | null {
    switch (prediction.answer.type) {
      case 'number': {
        const t = numberAnswer.trim().replace(/^−/, '-');
        return /^-?\d+$/.test(t) ? Number(t) : null;
      }
      case 'position': {
        const vs = Array.from({ length: fields }, (_, k) => (positionAnswer[k] ?? '').trim().replace(/^−/, '-'));
        return vs.every((t) => /^-?\d+$/.test(t)) ? vs.map(Number) : null;
      }
      case 'choice':
        return choiceAnswer;
    }
  }

  function finish(outcome: 'correct' | 'wrong' | 'shown'): void {
    if (resolved !== null) return;
    resolved = outcome;
    announce?.(`${outcome === 'correct' ? 'Right' : outcome === 'wrong' ? 'Not quite' : 'Shown'}. The answer is ${closed} ${prediction.reveal}`);
    onResolved?.(outcome);
  }

  function check(): void {
    const a = read();
    if (a === null) return;
    finish(predictionCorrect(prediction, a) ? 'correct' : 'wrong');
  }
</script>

<div class="predict" data-prediction="">
  <p class="question" id="{uid}-q">{prediction.question}</p>
  <div class="answer" role="group" aria-labelledby="{uid}-q">
    {#if prediction.answer.type === 'number'}
      <label class="field">
        <span>Your answer</span>
        <input type="text" inputmode="numeric" class="number" data-control="predictAnswer" bind:value={numberAnswer} disabled={!hydrated || resolved !== null} />
      </label>
    {:else if prediction.answer.type === 'position'}
      {#each Array.from({ length: fields }, (_, k) => k) as k (k)}
        <label class="field">
          <span>{labels[k] !== undefined ? `Node ${labels[k]}` : `Entry ${k + 1}`}</span>
          <input type="text" inputmode="numeric" size="4" data-control="predictAnswer" bind:value={positionAnswer[k]} disabled={!hydrated || resolved !== null} />
        </label>
      {/each}
    {:else}
      {#each prediction.answer.options as option, k (k)}
        <label class="choice">
          <input type="radio" name="{uid}-choice" value={k} data-control="predictAnswer" bind:group={choiceAnswer} disabled={!hydrated || resolved !== null} />
          <span>{option}</span>
        </label>
      {/each}
    {/if}
    <!-- Once answered, the two buttons are done but keep the focus the reader left on one of them (A-1,
         WCAG 2.4.3): aria-disabled, not the disabled attribute, which is for the time before hydration
         (7.4) and would drop the focus to the page; finish() ignores a second answer. -->
    <button type="button" class="control" data-control="predictCheck" disabled={!hydrated} aria-disabled={resolved !== null ? 'true' : undefined} onclick={check}>Check</button>
    <button type="button" class="control" data-control="predictShow" disabled={!hydrated} aria-disabled={resolved !== null ? 'true' : undefined} onclick={() => finish('shown')}
      >Show me</button
    >
  </div>
  <p class="line" data-out="predictResult">{resultText}</p>
  {#if resolved !== null}
    <p class="reveal" data-out="predictReveal">{prediction.reveal}</p>
  {:else}
    <details class="nojs-answer">
      <summary>Answer</summary>
      <p><span class="answer-text">{answerText}</span></p>
      <p>{prediction.reveal}</p>
    </details>
  {/if}
</div>

<style>
  .predict {
    display: grid;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
  .question,
  .line,
  .reveal {
    margin: 0;
  }
  .line {
    min-height: 1.5em;
  }
  .answer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .field,
  .choice {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-height: 44px;
  }
  input[type='text'] {
    min-height: 36px;
    min-width: 44px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 4px;
    padding: 0 6px;
  }
  /* RT-FIX P3-RT-05-01: the answer to a number question gets a width of its own. With the browser's
     default (about 20 characters) the label and the field could not be narrower than about 323
     pixels, more than a tool's figure has at 320 (A-11); T05 set the same width locally. */
  .number {
    width: 8em;
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
  .control:disabled,
  .control[aria-disabled='true'] {
    cursor: default;
  }
  .control:focus-visible,
  input:focus-visible,
  summary:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  summary {
    min-height: 44px;
    line-height: 44px;
    cursor: pointer;
  }
</style>
