<script lang="ts">
  // The builder of T3 (SPEC.md 4 T3 "Builder"; P2-A2 instruction 5.4). Controlled: the parent holds the
  // weights and the last verdict. One slider with a paired number field per city (label order) and per
  // joined pair; a city weight cannot go below 1, a road weight below 0 (t03/weights.ts refuses it and
  // the field returns to its last accepted weight). "Test" is the only thing that asks the engine;
  // nothing is tested on load or on a change of weight (4.0, P9). The verdict and the witness come from
  // formIsInvariant through the parent; this component shows them and evaluates no form (7.3).
  import { CITY_MIN, ROAD_MIN, WEIGHT_MAX, BUILDER_TEXT, readWeight, witnessSentence, type JoinedPair, type WeightKind, type WitnessView } from './weights';

  interface Props {
    /** City labels by position. */
    labels: readonly number[];
    pairs: readonly JoinedPair[];
    /** City weights by position, road weights in the order of `pairs`. */
    city: readonly number[];
    road: readonly number[];
    verdict: { invariant: boolean; witness: WitnessView | null } | null;
    hydrated: boolean;
    labelId: string;
    onWeight: (kind: WeightKind, index: number, weight: number) => void;
    onTest: () => void;
  }

  let { labels, pairs, city, road, verdict, hydrated, labelId, onWeight, onTest }: Props = $props();

  /** City positions in label order (controls follow the labels, E-7). */
  const cityOrder = $derived(labels.map((l, k) => [l, k] as [number, number]).sort((a, b) => a[0] - b[0]));

  function take(kind: WeightKind, index: number, el: HTMLInputElement, current: number): void {
    const w = readWeight(kind, el.value);
    if (w === null) return; // refused: the model keeps its weight; `change` puts it back in the field
    if (w !== current) onWeight(kind, index, w);
  }
  function settle(el: HTMLInputElement, current: number): void {
    if (el.value !== String(current)) el.value = String(current);
  }

  const verdictText = $derived(verdict === null ? BUILDER_TEXT.untested : verdict.invariant ? BUILDER_TEXT.pass : BUILDER_TEXT.fail);
</script>

{#snippet weightControl(kind: WeightKind, index: number, name: string, value: number)}
  <div class="weight">
    <label class="weight-name" for="{labelId}-{kind}-{index}">{name}</label>
    <input
      type="range"
      min={kind === 'city' ? CITY_MIN : ROAD_MIN}
      max={WEIGHT_MAX}
      step="1"
      {value}
      aria-label={name}
      data-weight={kind}
      data-weight-index={index}
      data-control="weightSlider"
      disabled={!hydrated}
      oninput={(e) => take(kind, index, e.currentTarget, value)}
    />
    <input
      id="{labelId}-{kind}-{index}"
      type="number"
      inputmode="numeric"
      min={kind === 'city' ? CITY_MIN : ROAD_MIN}
      max={WEIGHT_MAX}
      step="1"
      {value}
      data-weight={kind}
      data-weight-index={index}
      data-control="weightField"
      disabled={!hydrated}
      oninput={(e) => take(kind, index, e.currentTarget, value)}
      onchange={(e) => settle(e.currentTarget, value)}
      onblur={(e) => settle(e.currentTarget, value)}
    />
  </div>
{/snippet}

<div class="builder">
  <p class="part-title" id={labelId}>Builder</p>
  <p class="hint">
    A weight on each city and on each joined pair define the form: each city weight times the square of its population, minus each road weight times the
    product of the two populations it joins. City weights are 1 or more; road weights are 0 or more.
  </p>
  <fieldset class="weights">
    <legend>City weights</legend>
    {#each cityOrder as [label, k] (label)}
      {@render weightControl('city', k, `City ${label} weight`, city[k]!)}
    {/each}
  </fieldset>
  {#if pairs.length > 0}
    <fieldset class="weights">
      <legend>Road weights</legend>
      {#each pairs as p, k (p.labels.join('-'))}
        {@render weightControl('road', k, `Road weight between cities ${p.labels[0]} and ${p.labels[1]}`, road[k]!)}
      {/each}
    </fieldset>
  {/if}
  <div class="test-row">
    <button type="button" class="control" data-control="test" disabled={!hydrated} onclick={onTest}>Test</button>
    <p class="verdict" data-out="testVerdict" data-invariant={verdict === null ? '' : String(verdict.invariant)}>{verdictText}</p>
  </div>
  <p
    class="witness"
    data-out="witness"
    data-city={verdict?.witness?.city ?? ''}
    data-population={verdict?.witness?.before.join(',') ?? ''}
    data-after={verdict?.witness?.after.join(',') ?? ''}
  >{verdict?.witness ? witnessSentence(verdict.witness) : ''}</p>
</div>

<style>
  .builder {
    display: grid;
    gap: 8px;
  }
  .part-title {
    margin: 0;
    font-weight: bold;
  }
  .hint {
    margin: 0;
    font-size: 0.95em;
  }
  .weights {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 4px 8px 8px;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    min-width: 0;
  }
  .weight {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-height: 44px;
  }
  .weight-name {
    flex: 1 1 12em;
  }
  input[type='range'] {
    flex: 1 1 8em;
    min-width: 0;
    height: 44px;
    margin: 0;
    accent-color: var(--accent-populations);
  }
  input[type='number'] {
    width: 4.5em;
    min-height: 44px;
    box-sizing: border-box;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
    padding: 0 6px;
  }
  .test-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .verdict,
  .witness {
    margin: 0;
    min-height: 1.5em;
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
  input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
