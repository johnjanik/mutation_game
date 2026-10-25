<script lang="ts">
  // A sentence of t13/model.ts with its subscripts and superscripts (plain markup, no typesetting at run time,
  // SPEC 7.3). Owner P6-A3.
  import type { Rich } from './model';

  let { text }: { text: Rich } = $props();
</script>

{#each text as part, k (k)}{#if typeof part === 'string'}{part}{:else if 'sub' in part}<sub>{part.sub}</sub>{:else}<sup>{part.sup}</sup>{/if}{/each}
