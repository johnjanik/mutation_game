<script module lang="ts">
  // T16's verdict line (P2-A5; SPEC 4 T16 "No verdicts beyond those of T4", 4 T4 Verdict, 2.8, 2.12,
  // 5.6 last sentence, D19, E-7, E-11). The verdict is T4's model (t04/verdict.ts verdictCore, one
  // classify call per board object, cached), shown as T4's "Verdict" bullet gives it and nothing more:
  // for each component, finite with its name and the matching of the reader's nodes to the Bourbaki
  // labels; affine with its name, marks and comarks; indefinite; or "has a one-way road: the theory
  // does not apply". T4's "Also shown" items (balance and weights, spectral radius, a smallest
  // non-finite sub-board) are not shown here (plan), and verdictCore does not compute the last two.
  // Nodes are labels (verdictCore converts with toLabels).
  //
  // D19: a component that classify names B2 reads "B2 = C2" (MathML, A-12) when the board was
  // recognised from its shape (a custom matrix, drawn or imported); when the reader chose the board by
  // name (a preset or a link with g=B2 or g=C2) it reads the name chosen. `data-tex` on the verdict
  // element holds the TeX source of the names shown (plan hook).
  import type { BoardSpec } from '../../lib/state';
  import type { ComponentView } from './t04/verdict';

  /** The parts of a name: letter, rank, and the affine tilde or the twisted superscript. */
  export function nameParts(name: string): { letter: string; sub: string; tilde: boolean; sup: string | null } | null {
    const m = /^([A-G])([1-9][0-9]*)(~|\^\(([23])\))?$/.exec(name);
    if (m === null) return null;
    return { letter: m[1]!, sub: m[2]!, tilde: m[3] === '~', sup: m[4] ? `(${m[4]})` : null };
  }

  /** TeX source of a name: "A_{3}", "\tilde{A}_{2}", "D_{4}^{(3)}"; other names as they are. */
  export function texOf(name: string): string {
    const p = nameParts(name);
    if (p === null) return name;
    return `${p.tilde ? `\\tilde{${p.letter}}` : p.letter}_{${p.sub}}${p.sup ? `^{${p.sup}}` : ''}`;
  }

  /** The TeX of D19's form for the rank-2 board recognised from its shape. */
  export const B2_EQUALS_C2 = 'B_2=C_2';

  /**
   * What a component's name is shown as (D19): `null` for no name; `{ b2c2: true }` for a B2 that was
   * recognised from its shape; otherwise the name to print (the name chosen, for B2 by name).
   */
  export function shownName(spec: BoardSpec, name: string | null): { b2c2: true } | { b2c2: false; name: string } | null {
    if (name === null) return null;
    if (name === 'B2') {
      if (typeof spec === 'string' && (spec === 'B2' || spec === 'C2')) return { b2c2: false, name: spec };
      return { b2c2: true };
    }
    return { b2c2: false, name };
  }

  /** The plain verdict text of one component: `finite A3`, `affine A2~`, `indefinite`, or the sentence. */
  export function componentText(spec: BoardSpec, c: ComponentView): string {
    const shown = shownName(spec, c.record.name);
    const name = shown === null ? '' : shown.b2c2 ? ' B2=C2' : ` ${shown.name}`;
    return `${c.classText}${name}`;
  }

  /** The TeX of the names shown for every component, joined by ", " (empty when none has a name). */
  export function verdictTex(spec: BoardSpec, components: readonly ComponentView[]): string {
    return components
      .map((c) => shownName(spec, c.record.name))
      .filter((s) => s !== null)
      .map((s) => (s!.b2c2 ? B2_EQUALS_C2 : texOf((s as { name: string }).name)))
      .join(', ');
  }
</script>

<script lang="ts">
  let { spec, components }: { spec: BoardSpec; components: readonly ComponentView[] } = $props();

  const list = (xs: readonly (number | string)[]): string => xs.join(', ');
  const several = $derived(components.length > 1);
  const tex = $derived(verdictTex(spec, components));
</script>

{#snippet typeset(name: string)}
  {#each [nameParts(name)] as p (name)}{#if p === null}{name}{:else}<span class="name">{p.letter}<sub>{p.sub}</sub>{#if p.tilde}~{/if}{#if p.sup}<sup>{p.sup}</sup>{/if}</span>{/if}{/each}
{/snippet}

{#snippet b2c2()}
  <math display="inline" aria-label="B 2 equals C 2"><msub><mi>B</mi><mn>2</mn></msub><mo>=</mo><msub><mi>C</mi><mn>2</mn></msub></math>
{/snippet}

<section class="verdict" aria-label="Verdict" data-verdict="">
  <p class="line">
    Verdict: <span data-out="verdict" data-tex={tex === '' ? undefined : tex}
      >{#each components as c, i (i)}{@const shown = shownName(spec, c.record.name)}{#if i > 0}; {/if}{#if several}nodes {list(c.record.nodes)}: {/if}<strong>{c.classText}</strong
        >{#if shown !== null}{' '}<span data-out="verdictName" data-name={c.record.name}
            >{#if shown.b2c2}{@render b2c2()}{:else}{@render typeset(shown.name)}{/if}</span
          >{/if}{/each}</span
    >.
  </p>
  {#each components as c, i (i)}
    {#if c.matching !== null}
      <p class="line" data-out="verdictBourbaki" data-order={(c.record.bourbaki_order ?? []).join(',')}>
        Your nodes and the Bourbaki labels{#if several}{' '}of nodes {list(c.record.nodes)}{/if}: {#each c.matching as m, k (m.bourbaki)}{k > 0 ? ', ' : ''}node {m.reader} is Bourbaki {m.bourbaki}{/each}.
      </p>
    {/if}
    {#if c.record.marks !== undefined && c.record.comarks !== undefined}
      <p class="line" data-out="verdictMarks" data-nodes={c.record.nodes.join(',')} data-values={c.record.marks.join(',')}>
        Marks (the frozen population): {#each c.record.nodes as node, k (node)}{k > 0 ? ', ' : ''}node {node}: <span class="numeral">{c.record.marks[k]}</span>{/each}.
      </p>
      <p class="line" data-out="verdictComarks" data-nodes={c.record.nodes.join(',')} data-values={c.record.comarks.join(',')}>
        Comarks (the weights of the level): {#each c.record.nodes as node, k (node)}{k > 0 ? ', ' : ''}node {node}: <span class="numeral">{c.record.comarks[k]}</span>{/each}.
      </p>
    {/if}
  {/each}
</section>

<style>
  .verdict {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
    min-width: 0;
  }
  .line {
    margin: 0;
  }
  .numeral {
    font-variant-numeric: tabular-nums;
  }
</style>
