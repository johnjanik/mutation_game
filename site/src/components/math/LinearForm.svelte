<script module lang="ts">
  // A linear form sum c_k x_k (SPEC.md 7.3 "Mathematics produced while a tool runs", 7.5 A-12), the
  // fired entries of T7 and, from phase 5, the relations of T12. Written as MathML (<math> with <mi>,
  // <mn>, <mo>, <msub>), which the browser lays out natively; no typesetting library reaches the
  // client (7.6). One switch, RENDER, selects the HTML-span fallback of 7.3 ("if one engine fails, use
  // HTML spans with an aria-label"); both paths carry the same aria-label. The outcome of the check in
  // site/tests/e2e/mathml.spec.ts sets the switch (decisions/P3-A5.md). Pure helpers below; the
  // component computes nothing beyond the layout of the terms it is given.
  import { speak } from '../../lib/a11y';

  /** Which markup the forms use: MathML (the default of 7.3) or the span fallback. */
  export const RENDER = 'mathml' as 'mathml' | 'spans';

  /** The true minus sign of SPEC 6.3. */
  export const MINUS = '−';

  /** One written term: its operator ('' for a leading positive term), its coefficient text (null for 1), its subscript. */
  export interface FormTerm {
    op: '' | '+' | '−';
    coeff: string | null;
    label: number;
  }

  /**
   * The written terms of sum coeffs[k] x_{labels[k]}: in increasing label order, zero terms omitted, a
   * coefficient of 1 or -1 not written, the sign carried by the operator (a leading negative term gets
   * the minus sign). `coeffs` and `labels` are both indexed by position (E-7: subscripts are labels).
   * The zero form has no terms.
   */
  export function formTerms(coeffs: readonly (number | bigint)[], labels: readonly number[]): FormTerm[] {
    if (coeffs.length !== labels.length) throw new RangeError(`${coeffs.length} coefficients for ${labels.length} labels`);
    const order = labels.map((label, k) => ({ label, c: BigInt(coeffs[k]!) })).sort((a, b) => a.label - b.label);
    const out: FormTerm[] = [];
    for (const { label, c } of order) {
      if (c === 0n) continue;
      const negative = c < 0n;
      const size = negative ? -c : c;
      const op: FormTerm['op'] = negative ? MINUS : out.length === 0 ? '' : '+';
      out.push({ op, coeff: size === 1n ? null : size.toString(), label });
    }
    return out;
  }

  /** The spoken text of a form (A-12 label): "2 x 1 plus x 2", "minus x 1 minus 2 x 3", "0". */
  export function formSpoken(coeffs: readonly (number | bigint)[], labels: readonly number[], letter = 'x'): string {
    const terms = formTerms(coeffs, labels);
    if (terms.length === 0) return speak(0);
    return terms
      .map((t, k) => {
        const body = `${t.coeff === null ? '' : `${speak(t.coeff)} `}${letter} ${t.label}`;
        if (t.op === MINUS) return `minus ${body}`;
        return k === 0 ? body : `plus ${body}`;
      })
      .join(' ');
  }

  /** The form as plain text with a true minus sign, for tooltips and exports: "2x1 + x2". */
  export function formText(coeffs: readonly (number | bigint)[], labels: readonly number[], letter = 'x'): string {
    const terms = formTerms(coeffs, labels);
    if (terms.length === 0) return '0';
    return terms.map((t, k) => `${k === 0 ? (t.op === MINUS ? MINUS : '') : ` ${t.op} `}${t.coeff ?? ''}${letter}${t.label}`).join('');
  }
</script>

<script lang="ts">
  interface Props {
    /** The coefficients, indexed by position. */
    coeffs: readonly (number | bigint)[];
    /** The subscript of each position: the board's labels (E-7). */
    labels: readonly number[];
    /** The letter of the variables (default x). */
    letter?: string;
    /** The markup (default RENDER); the unit tests render both paths. */
    render?: 'mathml' | 'spans';
  }

  let { coeffs, labels, letter = 'x', render = RENDER }: Props = $props();

  const terms = $derived(formTerms(coeffs, labels));
  const spoken = $derived(formSpoken(coeffs, labels, letter));
</script>

{#if render === 'mathml'}
  <math class="linear-form" aria-label={spoken} data-form-render="mathml"
    >{#if terms.length === 0}<mn>0</mn>{:else}{#each terms as t (t.label)}{#if t.op !== ''}<mo>{t.op}</mo>{/if}{#if t.coeff !== null}<mn>{t.coeff}</mn>{/if}<msub><mi>{letter}</mi><mn>{t.label}</mn></msub>{/each}{/if}</math
  >
{:else}
  <span class="linear-form spans" role="math" aria-label={spoken} data-form-render="spans"
    ><span aria-hidden="true"
      >{#if terms.length === 0}0{:else}{#each terms as t, k (t.label)}{#if t.op !== ''}<span class="op">{k === 0 ? t.op : ` ${t.op} `}</span>{/if}{#if t.coeff !== null}{t.coeff}{/if}<i>{letter}</i><sub>{t.label}</sub>{/each}{/if}</span
    ></span
  >
{/if}

<style>
  .linear-form {
    font-size: 1em;
    white-space: nowrap;
  }
  .spans i {
    font-family: var(--font-prose, serif);
  }
  .spans sub {
    font-size: 0.75em;
  }
</style>
