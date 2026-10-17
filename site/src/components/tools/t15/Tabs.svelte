<script lang="ts">
  // The four configurations of T15 as toggle buttons (CONTRACTS.md 6; SPEC.md 4.0 Configuration). The
  // open tab is not part of a link (6.6). Ordinary focusable buttons with visible labels (A-1, A-8),
  // disabled until hydration (7.4). Hooks: data-tab="<preset id>", aria-pressed.
  import { TAB_IDS, TAB_TEXT, type PresetId } from './presets';

  interface Props {
    current: PresetId;
    disabled: boolean;
    onSelect: (id: PresetId) => void;
  }

  let { current, disabled, onSelect }: Props = $props();
</script>

<div class="tabs" role="group" aria-label="Configurations of the Affine Playground">
  {#each TAB_IDS as id (id)}
    <button type="button" class="tab" data-tab={id} aria-pressed={id === current ? 'true' : 'false'} {disabled} onclick={() => onSelect(id)}>{TAB_TEXT[id]}</button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tab {
    min-height: 44px;
    padding: 0 12px;
    font: inherit;
    color: var(--text);
    background: var(--page);
    border: 1px solid var(--text);
    border-radius: 6px;
    cursor: pointer;
  }
  .tab[aria-pressed='true'] {
    border-width: 3px;
    font-weight: bold;
  }
  .tab:disabled {
    cursor: default;
  }
  .tab:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
