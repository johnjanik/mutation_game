<script lang="ts">
  // The switch between the Olympiad's form and the site's convention on the pentagon (SPEC.md 2.3, 2.9,
  // 4 T15, D8: the only reader-facing switch of conventions on the site). It negates every shown value
  // and leaves the state alone; it is not part of a link (6.6). Hooks: data-out="convention" (the form
  // in force, data-convention), data-control="convention" (aria-pressed: the Olympiad's form is on).
  import { CONVENTION_TEXT, type Convention } from './convention';

  interface Props {
    convention: Convention;
    disabled: boolean;
    onToggle: () => void;
  }

  let { convention, disabled, onToggle }: Props = $props();
</script>

<div class="switch">
  <p class="line" data-out="convention" data-convention={convention}>{CONVENTION_TEXT[convention]}</p>
  <button type="button" class="control" data-control="convention" aria-pressed={convention === 'olympiad' ? 'true' : 'false'} {disabled} onclick={onToggle}
    >Olympiad's form</button
  >
</div>

<style>
  .switch {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .line {
    margin: 0;
    flex: 1 1 16em;
  }
  .control {
    min-width: 44px;
    min-height: 44px;
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
</style>
