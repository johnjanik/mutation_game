<script lang="ts">
  // The manual theme switch (SPEC.md 8.3; CONTRACTS.md 8). With nothing stored the page follows
  // prefers-color-scheme through CSS alone (tokens.css). Pressing the switch sets data-theme on
  // <html> and stores the choice under the key `theme`; on hydration the stored choice is applied
  // again. Every storage access is guarded (private modes throw). The button is disabled in the
  // server HTML and enabled on hydration, like every control (4.0, 7.4). Part of the 15 kB shell
  // (7.6): it imports only the small helpers of draw/palette.ts, never the engine.
  import { applyTheme, nextTheme, readStoredTheme, resolveTheme, type Theme } from './draw/palette';

  let hydrated = $state(false);
  let theme = $state<Theme>('light');

  function storage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  $effect(() => {
    const stored = readStoredTheme(storage());
    const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = resolveTheme(stored, prefersDark);
    if (stored === 'light' || stored === 'dark') applyTheme(stored, document.documentElement, null);
    hydrated = true;
  });

  function toggle(): void {
    theme = nextTheme(theme);
    applyTheme(theme, document.documentElement, storage());
  }
</script>

<button type="button" class="theme-switch" aria-pressed={theme === 'dark'} disabled={!hydrated} onclick={toggle} data-theme-switch>
  Dark theme
</button>

<style>
  .theme-switch {
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border: 2px solid var(--text);
    border-radius: 6px;
    background: var(--page);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .theme-switch[aria-pressed='true'] {
    background: var(--text);
    color: var(--page);
  }
  .theme-switch:disabled {
    cursor: default;
  }
  .theme-switch:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
