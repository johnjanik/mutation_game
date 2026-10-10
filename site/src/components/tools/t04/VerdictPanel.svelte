<script lang="ts">
  // T4's verdict panel (P2-A3; SPEC 4 T4 Verdict and Also shown, 2.5, 2.8, 2.12, D19). Renders a Verdict
  // of t04/verdict.ts and nothing else: every word comes from the classify record (4.0 Stated limits).
  // Names are set with <sub> and <sup> (and a combining tilde for X~), never with KaTeX in the client
  // (7.6); `data-name` holds the plain name as classify returned it.
  import { displayNames, displayText, type NameParts, type Verdict } from './verdict';

  let { verdict }: { verdict: Verdict } = $props();

  const list = (xs: readonly (number | string)[]): string => xs.join(', ');
</script>

{#snippet typeset(parts: NameParts)}
  <span class="name">{parts.letter}{#if parts.tilde}&#771;{/if}<sub>{parts.sub}</sub>{#if parts.sup}<sup>{parts.sup}</sup>{/if}</span>
{/snippet}

<section class="verdict" data-verdict="" aria-label="Verdict">
  <p class="line">
    <span data-out="nodeCount">{verdict.n}</span>
    {verdict.n === 1 ? 'node' : 'nodes'}, <span data-out="kind" data-kind={verdict.kind}
      >{verdict.kind === 'one-way' ? 'with a one-way road' : 'every road with a road back'}</span
    >; the board is <span data-out="balanced">{verdict.balanced ? 'balanced' : 'not balanced'}</span>.
  </p>
  {#each verdict.components as c, i (i)}
    <div class="component" data-component={i + 1}>
      <p class="line">
        {#if verdict.components.length > 1}Component {i + 1}, nodes <span data-out="componentNodes">{list(c.record.nodes)}</span>:{/if}
        <strong data-out="verdictClass">{c.classText}</strong>{#if c.record.name !== null}{' '}<span data-out="verdictName" data-name={c.record.name}
            >{#each displayNames(c.record.name) as parts, k (k)}{#if k > 0}{' = '}{/if}{@render typeset(parts)}{/each}</span
          >{/if}{#if c.record.name === 'C2~'}<span class="gloss">, the affine board of B<sub>2</sub> = C<sub>2</sub></span>{/if}
      </p>
      {#if c.matching !== null}
        <table class="matching" aria-label="Matching of the nodes of {displayText(c.record.name ?? '')} to the Bourbaki labels">
          <tbody>
            <tr>
              <th scope="row">Your node</th>
              {#each c.matching as m (m.bourbaki)}<td>{m.reader}</td>{/each}
            </tr>
            <tr>
              <th scope="row">Bourbaki label</th>
              {#each c.matching as m (m.bourbaki)}<td>{m.bourbaki}</td>{/each}
            </tr>
          </tbody>
        </table>
        <p class="line">
          Your nodes in Bourbaki order: <span data-out="bourbakiOrder">{list(c.record.bourbaki_order ?? [])}</span>.
        </p>
      {/if}
      {#if c.record.marks !== undefined && c.record.comarks !== undefined}
        <p class="line">
          At nodes {list(c.record.nodes)}: marks (the frozen population) <span class="numeral" data-out="marks">{list(c.record.marks)}</span>; comarks
          (the weights of the level) <span class="numeral" data-out="comarks">{list(c.record.comarks)}</span>.
        </p>
      {/if}
      {#if c.weights !== null}
        <p class="line">
          Weights d<sub>i</sub> at nodes {list(c.record.nodes)}: <span class="numeral" data-out="weights">{list(c.weights)}</span>.
        </p>
      {/if}
    </div>
  {/each}
  {#if verdict.spectralRadius !== null}
    <p class="line">Spectral radius of the road counts: <span class="numeral" data-out="spectralRadius">{verdict.spectralRadius}</span>.</p>
  {/if}
  {#if verdict.nonfinite !== null}
    <p class="line">
      A smallest set of nodes whose board is already not finite: <span
        data-out="nonfiniteSubboard"
        data-nodes={verdict.nonfinite.nodes.join(',')}
        data-class={verdict.nonfinite.class}>nodes {list(verdict.nonfinite.nodes)}, {verdict.nonfinite.class}</span
      >.
    </p>
  {/if}
</section>

<style>
  .verdict {
    display: grid;
    gap: 6px;
  }
  .line {
    margin: 0;
  }
  .component {
    display: grid;
    gap: 4px;
    padding: 6px 8px;
    border: 1px solid var(--sign-zero-outline);
    border-radius: 6px;
  }
  .matching {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .matching th,
  .matching td {
    padding: 2px 6px;
    text-align: center;
  }
  .matching th {
    text-align: start;
    font-weight: normal;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
</style>
