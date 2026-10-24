<script lang="ts">
  // Renders one snippet of T12 on its own, so that t12/static.ts can write a panel's server markup as a string
  // (server rendering only; decisions/P5-A2.md). Owner P5-A2.
  import type { Snippet } from 'svelte';

  interface Props {
    content: Snippet<[unknown]>;
    arg: unknown;
  }

  let { content, arg }: Props = $props();
</script>

{@render content(arg)}
