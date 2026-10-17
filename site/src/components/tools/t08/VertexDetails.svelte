<script lang="ts">
  // The details of one vertex (SPEC.md 4 T8 bullet 1): "the position, a shortest word (wordTo), and the
  // positive roots whose mirrors separate it from the start (separatingRoots)". Shown for the vertex
  // hovered or focused, else for the vertex the game stands on, so the panel is never empty and holds
  // the information itself (P2: tooltips repeat, never hold alone). Roots are populations in label
  // order, never coroots. Hooks: data-out="vertexPosition" (data-position, ASCII hyphen),
  // "vertexWord" (data-word), "separatingRoots" with one child per root carrying data-root.
  import { minus, type VertexDetails } from './graph';

  interface Props {
    details: VertexDetails;
    /** Whether these are the details of the vertex pointed at (else of the current position). */
    pointed: boolean;
    onRootPoint: (root: string[] | null) => void;
  }

  let { details, pointed, onRootPoint }: Props = $props();
  const show = (v: readonly string[]): string => v.map(minus).join(', ');
</script>

<div class="details" data-out="vertexDetails" data-layer={details.layer} data-pointed={pointed ? 'true' : 'false'}>
  <p class="line">
    {pointed ? 'Vertex' : 'Current position'} in layer <span class="numeral">{details.layer}</span>:
    <span class="numeral" data-out="vertexPosition" data-position={details.position.join(',')}>({show(details.position)})</span>
  </p>
  <p class="line">
    A shortest play reaching it:
    <span class="numeral" data-out="vertexWord" data-word={details.word.join(',')}>{details.word.length === 0 ? 'no moves' : details.word.join(', ')}</span>
  </p>
  <div class="line">
    Mirrors between it and the start ({details.roots.length}, the positive roots it has crossed):
    <ul class="roots numeral" data-out="separatingRoots" data-count={details.roots.length}>
      {#each details.roots as r (r.join(','))}
        <li data-root={r.join(',')} onpointerenter={() => onRootPoint(r)} onpointerleave={() => onRootPoint(null)}>({show(r)})</li>
      {:else}
        <li class="none">none</li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .details {
    display: grid;
    gap: 4px;
  }
  .line {
    margin: 0;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
  .roots {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }
</style>
