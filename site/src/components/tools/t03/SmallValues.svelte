<script lang="ts">
  // Small values of T3 (SPEC.md 4 T3 "Small values"; 5.5; 5.6; P2-A2 instruction 5.5). Controlled: the
  // parent holds the rows (texts in label order) and their judgements, computed by t03/model.ts through
  // formValue and isRootPopulation. One row per population, one field per city; each field takes at
  // most CAPS.formFinderDigits digits and an optional leading minus sign, whether typed or pasted
  // (t03/digits.ts); a refused input leaves the field at its last accepted text and is said in words
  // in data-out="digitNotice". A value of more than 12 digits is shortened, exact in the tooltip and in
  // the table view and the export (4.0 Long numbers).
  import { isLong, shortValue } from '../t01/longNumber';
  import { FORM_TEXT, type RowJudgement } from './model';
  import { digitNotice, offerEntry } from './digits';

  interface Props {
    /** City labels in increasing order (the order of the fields). */
    labels: readonly number[];
    rows: readonly (readonly string[])[];
    judged: readonly RowJudgement[];
    hydrated: boolean;
    labelId: string;
    onEntry: (row: number, column: number, text: string) => void;
    onAddRow: () => void;
  }

  let { labels, rows, judged, hydrated, labelId, onEntry, onAddRow }: Props = $props();

  let notice = $state('');

  function onInput(row: number, column: number, el: HTMLInputElement): void {
    const previous = rows[row]![column]!;
    const r = offerEntry(previous, el.value);
    if (r.refused) {
      el.value = previous;
      notice = digitNotice(labels[column]!, row + 1, previous);
      return;
    }
    notice = '';
    if (r.text !== el.value) el.value = r.text;
    if (r.text !== previous) onEntry(row, column, r.text);
  }

  const valueText = (j: RowJudgement): string => (!j.complete ? '' : j.value === null ? FORM_TEXT.noForm : shortValue(j.value));
</script>

<div class="small">
  <p class="part-title" id={labelId}>Small values</p>
  <p class="hint">Type a population, one whole number per city. The tool gives its form value and says whether it is a root population.</p>
  <div class="scroll">
    <table aria-labelledby={labelId}>
      <thead>
        <tr>
          <th scope="col">Row</th>
          {#each labels as l (l)}<th scope="col">City {l}</th>{/each}
          <th scope="col">Form value</th>
          <th scope="col">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row, r (r)}
          <tr data-row={r}>
            <th scope="row">{r + 1}</th>
            {#each labels as l, c (l)}
              <td>
                <input
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  spellcheck="false"
                  value={row[c]}
                  aria-label="City {l} in row {r + 1}"
                  data-row={r}
                  data-city={l}
                  data-control="entry"
                  disabled={!hydrated}
                  oninput={(e) => onInput(r, c, e.currentTarget)}
                />
              </td>
            {/each}
            <td class="numeral" data-out="smallValue" data-row={r} data-value={judged[r]?.value ?? ''} title={judged[r]?.value && isLong(judged[r]!.value!) ? judged[r]!.value : undefined}
              >{judged[r] ? valueText(judged[r]!) : ''}</td
            >
            <td data-out="smallVerdict" data-row={r}>{judged[r]?.verdict ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="notice" data-out="digitNotice" aria-live="off">{notice}</p>
  <div>
    <button type="button" class="control" data-control="addRow" disabled={!hydrated} onclick={onAddRow}>Add a row</button>
  </div>
</div>

<style>
  .small {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .part-title {
    margin: 0;
    font-weight: bold;
  }
  .hint,
  .notice {
    margin: 0;
    font-size: 0.95em;
  }
  .notice {
    min-height: 1.5em;
  }
  .scroll {
    overflow-x: auto;
    max-width: 100%;
  }
  table {
    border-collapse: collapse;
  }
  th,
  td {
    padding: 2px 4px;
    text-align: center;
  }
  input {
    width: 4.6em;
    min-height: 44px;
    box-sizing: border-box;
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
    padding: 0 4px;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
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
