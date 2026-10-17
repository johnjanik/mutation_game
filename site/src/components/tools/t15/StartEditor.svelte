<script lang="ts">
  // The start editor of the `three-fates` tab (SPEC.md 4 T15 "the reader sets a start"; plan): one
  // integer field per node, labelled by its node label, in label order. A field accepts an optional
  // minus sign and up to 40 digits (the link cap of 6.6, so that every state stays a link) and refuses
  // anything else by restoring what it held. A complete integer is handed to the parent at once (the
  // level updates on every change); an empty field or a lone minus sign waits. Hooks:
  // data-control="startField", data-label on each field.
  interface Props {
    labels: readonly number[];
    /** The start in label order, exact decimal text. */
    values: readonly string[];
    disabled: boolean;
    onChange: (index: number, text: string) => void;
  }

  let { labels, values, disabled, onChange }: Props = $props();

  const uid = $props.id();
  /** The longest entry a link accepts (SPEC 6.6 Validation). */
  const MAX_DIGITS = 40;
  const COMPLETE = new RegExp(`^-?\\d{1,${MAX_DIGITS}}$`);
  const PARTIAL = /^-?$/;
  /** What each field held last, so that a refused keystroke can be undone. */
  const held: string[] = [];

  function onInput(event: Event, k: number): void {
    const input = event.currentTarget as HTMLInputElement;
    const text = input.value.trim().replace(/^−/, '-');
    if (COMPLETE.test(text)) {
      held[k] = text;
      onChange(k, text);
    } else if (PARTIAL.test(text)) {
      held[k] = text;
    } else {
      input.value = held[k] ?? values[k] ?? '';
    }
  }
</script>

<fieldset class="editor">
  <legend>Start (one integer per node, in the site's convention)</legend>
  {#each labels as l, k (l)}
    <label class="field" for="{uid}-{l}">
      <span>Node {l}</span>
      <input
        id="{uid}-{l}"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        size="6"
        data-control="startField"
        data-label={l}
        value={values[k]}
        {disabled}
        oninput={(e) => onInput(e, k)}
      />
    </label>
  {/each}
</fieldset>

<style>
  .editor {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 8px;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
    min-width: 0;
  }
  .field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  input {
    min-height: 36px;
    min-width: 44px;
    max-width: 100%;
    font-family: var(--font-numerals);
    font-variant-numeric: tabular-nums;
    font-size: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 4px;
    padding: 0 6px;
  }
  input:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
