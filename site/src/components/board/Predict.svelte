<script lang="ts">
  // A prediction (SPEC.md 4.0 Predict, 8.1 P5, 8.5; CONTRACTS.md 5.2 `Prediction`), reusable by any
  // tool. "The board is frozen until the reader has answered or pressed "show me". Without JavaScript
  // the question is followed by a <details> element holding the answer and the reveal." The tool
  // freezes its own board while `onResolved` has not been called. Controls are disabled until
  // hydration (7.4). Hooks: data-prediction on the root; data-control="predictAnswer" (each input),
  // "predictCheck", "predictShow"; data-out="predictResult", "predictReveal".
  import type { Prediction } from '../../tools/types';
  import { predictionAnswerShown, predictionAnswerSpoken, predictionAnswerText, predictionCorrect, type PredictionAnswer } from '../tools/t01/interop';

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
  /**
   * RT-FIX P4-RT-05-05 (WCAG 3.3.1, 4.1.3): an answer Check cannot read is named in words, in the result
   * line and the tool's live region, and each field that holds it is described by that line, and marked
   * aria-invalid (a text field; a radio button takes no aria-invalid), until it is edited.
   */
  let problem = $state('');
  let invalidFields = $state<boolean[]>([]);

  const answerText = $derived(predictionAnswerText(prediction));
  const fields = $derived(prediction.answer.type === 'position' ? prediction.answer.value.length : 0);

  /** The answer closing a sentence: a full stop is added unless the answer already ends one (a choice is often a sentence). */
  const close = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);
  /** RT-FIX P6-RT-05-04: the result line writes a negative answer with U+2212 (6.3), the announcement speaks it "minus" (A-4). */
  const closed = $derived(close(predictionAnswerShown(prediction)));
  const closedSpoken = $derived(close(predictionAnswerSpoken(prediction)));
  const resultText = $derived(
    resolved === 'correct' ? `Right: ${closed}` : resolved === 'wrong' ? `Not quite: the answer is ${closed}` : resolved === 'shown' ? `The answer is ${closed}` : problem,
  );

  /** What an answer that cannot be read lacks, by answer type. */
  const PROBLEM = { number: 'Type a whole number.', position: 'Type a whole number in each field.', choice: 'Choose one of the answers.' } as const;
  const WHOLE = /^-?\d+$/;
  const plain = (t: string | undefined): string => (t ?? '').trim().replace(/^−/, '-');

  function read(): PredictionAnswer | null {
    switch (prediction.answer.type) {
      case 'number': {
        const t = plain(numberAnswer);
        return WHOLE.test(t) ? Number(t) : null;
      }
      case 'position': {
        const vs = Array.from({ length: fields }, (_, k) => plain(positionAnswer[k]));
        return vs.every((t) => WHOLE.test(t)) ? vs.map(Number) : null;
      }
      case 'choice':
        return choiceAnswer;
    }
  }

  /** The fields that hold an answer Check cannot read (every radio button when none is chosen). */
  function badFields(): boolean[] {
    switch (prediction.answer.type) {
      case 'number':
        return [!WHOLE.test(plain(numberAnswer))];
      case 'position':
        return Array.from({ length: fields }, (_, k) => !WHOLE.test(plain(positionAnswer[k])));
      case 'choice':
        return prediction.answer.options.map(() => choiceAnswer === null);
    }
  }

  /** An edited field is no longer marked; the sentence goes once no field is. */
  function edited(k: number): void {
    if (!invalidFields[k]) return;
    invalidFields = prediction.answer.type === 'choice' ? [] : invalidFields.map((b, j) => b && j !== k);
    if (!invalidFields.some(Boolean)) problem = '';
  }

  function finish(outcome: 'correct' | 'wrong' | 'shown'): void {
    if (resolved !== null) return;
    resolved = outcome;
    problem = '';
    invalidFields = [];
    announce?.(`${outcome === 'correct' ? 'Right' : outcome === 'wrong' ? 'Not quite' : 'Shown'}. The answer is ${closedSpoken} ${prediction.reveal}`);
    onResolved?.(outcome);
  }

  function check(): void {
    if (resolved !== null) return;
    const a = read();
    if (a === null) {
      problem = PROBLEM[prediction.answer.type];
      invalidFields = badFields();
      announce?.(problem);
      return;
    }
    finish(predictionCorrect(prediction, a) ? 'correct' : 'wrong');
  }
</script>

<div class="predict" data-prediction="">
  <p class="question" id="{uid}-q">{prediction.question}</p>
  <div class="answer" role="group" aria-labelledby="{uid}-q">
    {#if prediction.answer.type === 'number'}
      <label class="field">
        <span>Your answer</span>
        <input
          type="text"
          inputmode="numeric"
          class="number"
          data-control="predictAnswer"
          bind:value={numberAnswer}
          disabled={!hydrated || resolved !== null}
          aria-invalid={invalidFields[0] ? 'true' : undefined}
          aria-describedby={invalidFields[0] ? `${uid}-result` : undefined}
          oninput={() => edited(0)}
        />
      </label>
    {:else if prediction.answer.type === 'position'}
      {#each Array.from({ length: fields }, (_, k) => k) as k (k)}
        <label class="field">
          <span>{labels[k] !== undefined ? `Node ${labels[k]}` : `Entry ${k + 1}`}</span>
          <input
            type="text"
            inputmode="numeric"
            size="4"
            data-control="predictAnswer"
            bind:value={positionAnswer[k]}
            disabled={!hydrated || resolved !== null}
            aria-invalid={invalidFields[k] ? 'true' : undefined}
            aria-describedby={invalidFields[k] ? `${uid}-result` : undefined}
            oninput={() => edited(k)}
          />
        </label>
      {/each}
    {:else}
      {#each prediction.answer.options as option, k (k)}
        <label class="choice">
          <input
            type="radio"
            name="{uid}-choice"
            value={k}
            data-control="predictAnswer"
            bind:group={choiceAnswer}
            disabled={!hydrated || resolved !== null}
            aria-describedby={invalidFields[k] ? `${uid}-result` : undefined}
            onchange={() => edited(k)}
          />
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
  <p class="line" id="{uid}-result" data-out="predictResult">{resultText}</p>
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
