// P6-A4: T14, the Atlas, in the built site (SPEC.md 4 T14 and its acceptance; 2.9, 2.10, 2.8 "Names in rank
// 2", 6.5, 4.0, 7.4, 7.5, 7.6; instruction section 6). The values on the pages are read through their hooks
// (data-out with data-exact) and compared with the golden file through the harness of P0-A2 (intEq,
// ringsEq), never re-implemented; site/tests/unit/atlas.test.ts makes the same comparison on the data of all
// 32 types, and this file shows that the built pages carry it.
//
// data-out names used (the registry's outs, site/src/tools/registry/T14.ts):
//   Atlas pages: caption, noscript, cartan, cartan-transposed, adjacency, symmetrizer, n-roots,
//     n-positive-roots, positive-roots, highest-root, numbers-of-highest-root, highest-short-root,
//     numbers-of-highest-short-root, exponents, coxeter-number, weyl-order, det-cartan, minuscule-nodes,
//     minus-w0, fundamental-orbit-sizes, complete-games, coxeter-plane-rings, affine-name, marks, comarks,
//     real-forms
//   the picker of /tools/atlas and /embed/atlas: caption, notice, chosen, citeText, noscript
// Other hooks read: data-tool, data-instance, data-moves, data-hydrated (the roots), data-exact (the value as
// JSON in label order), data-item (each section), data-board-name (h1), data-atlas, data-convention and
// data-convention-choice (the switch), data-kac-note, data-unverified (Unverified.astro), data-wildberger,
// data-letters-exchanged, data-rank2-note, data-other-page, data-sp-note, data-long, data-exact-value,
// data-download, data-tool-link, data-board-link, data-group, data-control="cite", data-live, data-real-form,
// data-cartan-label, data-real-form-count, data-coincidence, data-provenance (the place in SPEC that gives a
// statement); T10's data-control="shortRoots" and data-out="ringSizes", "pointCount"; the site navigation
// (nav[aria-label="Site"]); KaTeX's <annotation> for typeset names.
//
// Repair after review: every displayed value is compared with golden as shown on the page (the visible text)
// as well as through data-exact; the satake records are matched with the harness's matchRecord.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { siteAndBase } from '../../src/lib/siteAndBase.mjs';
import { TYPE_NAMES, golden, intEq, matchRecord, ringsEq } from '../../../packages/engine/test/golden/_harness';

interface GoldenSatake {
  dynkin_type: string;
  cartan_label: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  restricted_type_display: string | null;
}
interface GoldenAffine {
  name: string;
  constructor_name: string;
  marks: number[];
  comarks: number[];
}
const SATAKE = golden.satake as GoldenSatake[];
const AFFINE = golden.affine as Record<string, GoldenAffine>;
const COUNTS = golden.admissible_counts as Record<string, { real_forms_including_compact: number; catalogue_records: number }>;
/** Wildberger's name for each board he names (golden wildberger_lists.names: his name to this site's board). */
const HIS_NAMES = (golden.wildberger_lists as { names: Record<string, string> }).names;
/** A release build (RELEASE set), as the build and its preview are run (openItemsReport.mjs isReleaseBuild). */
const RELEASE = process.env.RELEASE !== undefined && process.env.RELEASE !== '';

const ITEMS = [
  'cartan', 'roads', 'weights', 'roots', 'highest-roots', 'exponents', 'coxeter-number', 'weyl-order', 'det-cartan',
  'minuscule-nodes', 'minus-w0', 'orbit-sizes', 'complete-games', 'coxeter-plane', 'affine', 'real-forms', 'downloads',
];
const WEYL_BOARDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'D4', 'F4', 'G2'];

/** The parsed data-exact of the one element with this data-out. */
async function exactOf(page: Page, out: string): Promise<unknown> {
  const el = page.locator(`[data-out="${out}"]`);
  await expect(el, out).toHaveCount(1);
  return JSON.parse((await el.getAttribute('data-exact'))!) as unknown;
}

/** The TeX sources of the KaTeX formulas inside a locator (the typeset names). */
async function texIn(page: Page, selector: string): Promise<string[]> {
  return page.locator(`${selector} annotation`).evaluateAll((as) => as.map((a) => a.textContent ?? ''));
}

async function downloadOf(page: Page, kind: string): Promise<{ file: string; text: string }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-download="${kind}"]`).click()]);
  return { file: dl.suggestedFilename(), text: readFileSync((await dl.path())!, 'utf8') };
}

const transpose = (m: number[][]): number[][] => m.map((row, i) => row.map((_, j) => m[j]![i]!));
/** An integer as the pages show it: a true minus sign (SPEC 6.3). */
const signed = (x: number): string => (x < 0 ? `\u2212${-x}` : String(x));
/** A vector as the pages show it. */
const tuple = (v: readonly number[]): string => `(${v.map(signed).join(', ')})`;
/** A list in a sentence as the pages show it. */
const list = (v: readonly number[]): string => v.map(signed).join(', ');

/** The visible text of the one element with this data-out. */
async function shown(page: Page, out: string): Promise<string> {
  const el = page.locator(`[data-out="${out}"]`);
  await expect(el, out).toHaveCount(1);
  return ((await el.textContent()) ?? '').replace(/\s+/g, ' ').trim();
}

/** The entries of the matrix inside [data-out=out] as shown, row by row (MatrixView's data-row and data-col). */
async function cellsOf(page: Page, out: string): Promise<string[][]> {
  return page.locator(`[data-out="${out}"] td[data-row][data-col]`).evaluateAll((tds) => {
    const rows: string[][] = [];
    for (const td of tds) {
      const r = Number(td.getAttribute('data-row')) - 1;
      const c = Number(td.getAttribute('data-col')) - 1;
      (rows[r] ??= [])[c] = (td.textContent ?? '').trim();
    }
    return rows;
  });
}

/** The prose of the elements matching a selector, each formula replaced by its TeX source (KaTeX's annotation). */
async function proseOf(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(k.querySelector('annotation')?.textContent ?? ''));
      return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
    }),
  );
}

/** The text a reader sees in main: KaTeX's MathML (and its TeX annotation), scripts and styles left out. */
async function visibleText(page: Page): Promise<string> {
  return page.locator('main').evaluate((m) => {
    const copy = m.cloneNode(true) as HTMLElement;
    for (const e of copy.querySelectorAll('.katex-mathml, script, style')) e.remove();
    return (copy.textContent ?? '').replace(/\s+/g, ' ');
  });
}

/** A count as the pages show it (4.0 "Long numbers": above 12 digits, shortened with the number of digits). */
function countShown(digits: string): string {
  return digits.length > 12 ? `${digits[0]}.${digits.slice(1, 5)}... x 10^${digits.length - 1} (${digits.length} digits)` : digits;
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('B3 without JavaScript', async ({ page }) => {
    const res = await page.goto('atlas/B3/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveAttribute('data-board-name', 'B3');
    expect(await texIn(page, 'h1')).toEqual(['B_{3}']);
    // The tool root: the opening figure, its drawing with a text alternative, the caption, the noscript line.
    const root = page.locator('[data-tool="atlas"]');
    await expect(root).toHaveCount(1);
    await expect(root).toHaveAttribute('data-moves', '');
    await expect(root).toHaveAttribute('data-instance', '');
    const drawing = root.locator('svg[role="img"]');
    await expect(drawing).toBeVisible();
    const rec = golden.types['B3']!;
    // The text alternative names every pair of joined nodes with its roads each way (2.1); on B3 more roads run
    // from node 2 to node 3 than back (the golden adjacency), and the label says so.
    expect(rec.adjacency[1]![2]!).toBeGreaterThan(rec.adjacency[2]![1]!);
    expect(await drawing.getAttribute('aria-label')).toContain('roads from node 2 to node 3 and one back');
    await expect(root.locator('[data-out="caption"]')).toContainText('The data sheet of the board B3');
    await expect(root.locator('[data-out="noscript"]')).toBeVisible();
    // Every section, an h2 each, in the order of the T14 entry.
    expect(await page.locator('main section[data-item]').evaluateAll((ss) => ss.map((s) => s.getAttribute('data-item')))).toEqual(ITEMS);
    for (const id of ITEMS) await expect(page.locator(`#${id} > h2`), id).toBeVisible();
    // The values are there as text, with a true minus sign (6.3).
    const tuple = (v: readonly number[]): string => `(${v.map(signed).join(', ')})`;
    await expect(page.locator('[data-out="coxeter-number"]')).toHaveText(String(rec.coxeter_number));
    await expect(page.locator('[data-out="weyl-order"]')).toHaveText(String(rec.weyl_order));
    await expect(page.locator('[data-out="exponents"]')).toHaveText(rec.exponents.join(', '));
    await expect(page.locator('[data-out="minus-w0"]')).toHaveText(tuple(rec.minus_w0));
    expect(rec.minus_w0).toEqual(rec.minus_w0.map((_, k) => k + 1)); // -w0 is the identity on B3
    await expect(page.locator('#minus-w0')).toContainText(`${tuple(rec.minus_w0)}, the identity`);
    await expect(page.locator('[data-out="minuscule-nodes"]')).toHaveText(rec.minuscule_nodes.join(', '));
    await expect(page.locator('[data-out="positive-roots"] li')).toHaveCount(rec.n_positive_roots);
    await expect(page.locator('[data-out="positive-roots"] li').last()).toHaveText(tuple(rec.positive_roots!.at(-1)!));
    await expect(page.locator('[data-out="cartan"] td[data-row="3"][data-col="2"]')).toHaveText(signed(rec.cartan[2]![1]!));
    await expect(page.locator('[data-out="complete-games"]')).toHaveText(String(rec.n_reduced_words_w0));
    await expect(page.locator('[data-out="real-forms"] li')).toHaveCount(SATAKE.filter((r) => r.dynkin_type === 'B3').length);
    // A static sheet: no node buttons (4.0's node hooks; the only data-value hooks are MatrixView's on its
    // matrix cells), no button at all in the sheet, no island, no script file.
    await expect(page.locator('[data-node], [data-board], [data-can-act]')).toHaveCount(0);
    expect(await page.locator('[data-value]').evaluateAll((es) => es.filter((e) => e.closest('.matrix-view') === null).length)).toBe(0);
    await expect(page.locator('main button')).toHaveCount(0);
    await expect(page.locator('astro-island')).toHaveCount(0);
    await expect(page.locator('script[src]')).toHaveCount(0);
    // No em-dash on the page (8.4).
    expect(((await page.locator('main').textContent()) ?? '').includes('\u2014')).toBe(false);
  });
});

test.describe('convention switch', () => {
  for (const js of [false, true]) {
    test.describe(js ? 'with JavaScript' : 'without JavaScript', () => {
      test.use({ javaScriptEnabled: js });
      test(`convention switch (${js ? 'with' : 'without'} JavaScript), by keyboard`, async ({ page }) => {
        await page.goto('atlas/B3/');
        const C = golden.types['B3']!.cartan;
        const site = page.locator('[data-convention="site"]');
        const bourbaki = page.locator('[data-convention="bourbaki"]');
        // Default: this site's convention, C itself.
        await expect(page.locator('[data-convention-choice="site"]')).toBeChecked();
        await expect(site).toBeVisible();
        await expect(bourbaki).toBeHidden();
        intEq(await exactOf(page, 'cartan'), C);
        intEq(await exactOf(page, 'cartan-transposed'), transpose(C));
        // A native radio group with a legend: the arrow key moves the choice.
        await expect(page.locator('fieldset:has([data-convention-choice]) > legend')).toHaveText('Show the Cartan matrix in the convention of');
        await page.locator('[data-convention-choice="site"]').focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('[data-convention-choice="bourbaki"]')).toBeChecked();
        await expect(bourbaki).toBeVisible();
        await expect(site).toBeHidden();
        // The matrix shown is the transpose: row 2, column 3 of C^T is C_32, and row 3, column 2 is C_23.
        await expect(bourbaki.locator('td[data-row="2"][data-col="3"]')).toHaveText(signed(C[2]![1]!));
        await expect(bourbaki.locator('td[data-row="3"][data-col="2"]')).toHaveText(signed(C[1]![2]!));
        expect(C[2]![1]).not.toBe(C[1]![2]);
        await page.keyboard.press('ArrowUp');
        await expect(page.locator('[data-convention-choice="site"]')).toBeChecked();
        await expect(site).toBeVisible();
        await expect(bourbaki).toBeHidden();
      });
    });
  }

  // Repair after review (major b): the switch names a convention; nothing about Kac's numbering of the nodes is
  // said outside <Unverified item="E4"> (SPEC 2.9, last two rows; Appendix E item 4). Run on the preview build
  // and on the release build (RELEASE=1), where the wrapped sentence is replaced by its fallback.
  test(`E6: the switch names a convention, and Kac's numbering is said only inside Unverified E4 (${RELEASE ? 'release' : 'preview'} build)`, async ({ page }) => {
    await page.goto('atlas/E6/');
    await expect(page.locator('fieldset:has([data-convention-choice]) > legend')).toHaveText('Show the Cartan matrix in the convention of');
    // The text of the item outside the wrapper.
    const outside = await page.locator('#cartan').evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      for (const e of copy.querySelectorAll('[data-unverified], .katex-mathml')) e.remove();
      return (copy.textContent ?? '').replace(/\s+/g, ' ');
    });
    expect(outside).toContain('Bourbaki and Humphreys number the nodes as this site does, so the switch changes the matrix and nothing else.');
    expect(outside).not.toMatch(/as it is printed by|numbered the same way/);
    for (const sentence of outside.split(/(?<=\.)\s/)) expect(/Kac/.test(sentence) && /number/i.test(sentence), sentence).toBe(false);
    const wrapped = page.locator('[data-kac-note] [data-unverified="E4"]');
    await expect(wrapped).toHaveCount(1);
    if (RELEASE) {
      await expect(wrapped).toHaveClass(/unverified-fallback/);
      expect(await visibleText(page)).not.toContain('Kac numbers');
    } else {
      await expect(wrapped).toContainText('Kac numbers the nodes of E6 differently from Bourbaki');
      await expect(wrapped.locator('a.unverified-mark')).toHaveCount(1);
    }
  });
});

test.describe('displayed values', () => {
  test.use({ javaScriptEnabled: false });
  test('displayed values equal golden on every page', async ({ page }) => {
    test.setTimeout(360_000);
    for (const T of TYPE_NAMES) {
      const rec = golden.types[T]!;
      const n = rec.cartan.length;
      await page.goto(`atlas/${T}/`);
      await expect(page.locator('h1')).toHaveAttribute('data-board-name', T);
      // As shown: the matrices cell by cell with a true minus sign, the vectors, lists and counts as text.
      expect(await cellsOf(page, 'cartan'), `${T} cartan shown`).toEqual(rec.cartan.map((r) => r.map(signed)));
      expect(await cellsOf(page, 'cartan-transposed'), `${T} transpose shown`).toEqual(transpose(rec.cartan).map((r) => r.map(signed)));
      expect(await cellsOf(page, 'adjacency'), `${T} adjacency shown`).toEqual(rec.adjacency.map((r) => r.map(signed)));
      expect(await shown(page, 'symmetrizer'), `${T} symmetrizer shown`).toBe(tuple(rec.symmetrizer));
      expect(await shown(page, 'n-roots'), `${T} n_roots shown`).toBe(String(rec.n_roots));
      expect(await shown(page, 'n-positive-roots'), `${T} n_positive_roots shown`).toBe(String(rec.n_positive_roots));
      const rootsShown = await page.locator('[data-out="positive-roots"] li').allTextContents();
      if (rec.positive_roots !== undefined) expect(rootsShown, `${T} positive_roots shown`).toEqual(rec.positive_roots.map(tuple));
      else expect(rootsShown, `${T} positive roots shown`).toHaveLength(rec.n_positive_roots);
      expect(await shown(page, 'highest-root'), `${T} highest_root shown`).toBe(tuple(rec.highest_root));
      expect(await shown(page, 'numbers-of-highest-root'), `${T} numbers_of_highest_root shown`).toBe(tuple(rec.numbers_of_highest_root));
      if (rec.highest_short_root != null && rec.numbers_of_highest_short_root != null) {
        expect(await shown(page, 'highest-short-root'), `${T} highest_short_root shown`).toBe(tuple(rec.highest_short_root));
        expect(await shown(page, 'numbers-of-highest-short-root'), `${T} numbers_of_highest_short_root shown`).toBe(tuple(rec.numbers_of_highest_short_root));
      }
      expect(await shown(page, 'exponents'), `${T} exponents shown`).toBe(list(rec.exponents));
      expect(await shown(page, 'coxeter-number'), `${T} coxeter_number shown`).toBe(String(rec.coxeter_number));
      expect(await shown(page, 'weyl-order'), `${T} weyl_order shown`).toBe(String(rec.weyl_order));
      expect(await shown(page, 'det-cartan'), `${T} det_cartan shown`).toBe(signed(Number(rec.det_cartan)));
      expect(await shown(page, 'minuscule-nodes'), `${T} minuscule_nodes shown`).toBe(rec.minuscule_nodes.length === 0 ? 'none' : list(rec.minuscule_nodes));
      expect(await shown(page, 'minus-w0'), `${T} minus_w0 shown`).toBe(tuple(rec.minus_w0));
      expect(await shown(page, 'fundamental-orbit-sizes'), `${T} fundamental_orbit_sizes shown`).toBe(tuple(rec.fundamental_orbit_sizes));
      if (rec.n_reduced_words_w0 !== undefined) expect(await shown(page, 'complete-games'), `${T} n_reduced_words_w0 shown`).toBe(countShown(String(rec.n_reduced_words_w0)));
      if (rec.coxeter_plane !== undefined) {
        expect(await shown(page, 'coxeter-plane-rings'), `${T} ring sizes shown`).toBe(list(rec.coxeter_plane.rings.map((r) => r[1])));
        const table = await page.locator('#coxeter-plane table.rings tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => Number(td.textContent))));
        ringsEq(table.map(([r, k]) => [r!, k!] as [number, number]), rec.coxeter_plane.rings);
      }
      const affine = AFFINE[T]!;
      expect(await shown(page, 'affine-name'), `${T} affine name shown`).toBe(affine.name);
      const affineRows = await page.locator('#affine table.affine-table tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('th, td')].map((c) => (c.textContent ?? '').trim())));
      expect(affineRows, `${T} marks and comarks shown`).toEqual([
        ['Node', ...Array.from({ length: n + 1 }, (_, k) => String(k))],
        ['Marks', ...affine.marks.map(signed)],
        ['Comarks', ...affine.comarks.map(signed)],
      ]);
      // Each real form as shown: its black nodes and tau, matched to its record by the harness (rule 5).
      const recordsHere = SATAKE.filter((r) => r.dynkin_type === T);
      const lines = await page.locator('[data-out="real-forms"] > li').evaluateAll((lis) =>
        lis.map((li) => {
          const copy = li.cloneNode(true) as HTMLElement;
          for (const k of copy.querySelectorAll('.katex')) k.remove();
          return { form: li.getAttribute('data-real-form')!, label: li.getAttribute('data-cartan-label')!, text: (copy.textContent ?? '').replace(/\s+/g, ' ') };
        }),
      );
      expect(lines, T).toHaveLength(recordsHere.length);
      for (const line of lines) {
        const g = matchRecord(recordsHere, { real_form: line.form });
        expect(line.label, `${T} ${line.form}`).toBe(g.cartan_label);
        const black = g.black_nodes.length === 0 ? 'No black node' : `Black ${g.black_nodes.length === 1 ? 'node' : 'nodes'} ${list(g.black_nodes)}`;
        expect(line.text, `${T} ${line.form} black nodes shown`).toContain(`${black};`);
        const identity = g.tau.every((t, k) => t === k + 1);
        expect(line.text, `${T} ${line.form} tau shown`).toContain(identity ? ' the identity;' : ` sends the nodes to ${tuple(g.tau)};`);
        if (g.restricted_type_display === null) expect(line.text, `${T} ${line.form}`).toContain('the compact form, with no restricted roots.');
        else expect(line.text, `${T} ${line.form}`).toContain('restricted roots of type');
      }
      // And the hooks (data-exact).
      intEq(await exactOf(page, 'cartan'), rec.cartan, `${T} cartan`);
      intEq(await exactOf(page, 'cartan-transposed'), transpose(rec.cartan), `${T} transpose`);
      intEq(await exactOf(page, 'adjacency'), rec.adjacency, `${T} adjacency`);
      intEq(await exactOf(page, 'symmetrizer'), rec.symmetrizer, `${T} symmetrizer`);
      intEq(await exactOf(page, 'n-roots'), rec.n_roots, `${T} n_roots`);
      intEq(await exactOf(page, 'n-positive-roots'), rec.n_positive_roots, `${T} n_positive_roots`);
      const listed = (await exactOf(page, 'positive-roots')) as number[][];
      if (rec.positive_roots !== undefined) intEq(listed, rec.positive_roots, `${T} positive_roots`);
      else intEq(listed.length, rec.n_positive_roots, `${T} number of positive roots listed`);
      await expect(page.locator('[data-out="positive-roots"] li')).toHaveCount(rec.n_positive_roots);
      intEq(await exactOf(page, 'highest-root'), rec.highest_root, `${T} highest_root`);
      intEq(await exactOf(page, 'numbers-of-highest-root'), rec.numbers_of_highest_root, `${T} numbers_of_highest_root`);
      if (rec.highest_short_root !== undefined && rec.highest_short_root !== null) {
        intEq(await exactOf(page, 'highest-short-root'), rec.highest_short_root, `${T} highest_short_root`);
        intEq(await exactOf(page, 'numbers-of-highest-short-root'), rec.numbers_of_highest_short_root, `${T} numbers_of_highest_short_root`);
      } else {
        // Rule 7: absent, so not shown as a value (and never as "null").
        await expect(page.locator('[data-out="highest-short-root"], [data-out="numbers-of-highest-short-root"]')).toHaveCount(0);
      }
      intEq(await exactOf(page, 'exponents'), rec.exponents, `${T} exponents`);
      intEq(await exactOf(page, 'coxeter-number'), rec.coxeter_number, `${T} coxeter_number`);
      intEq(await exactOf(page, 'weyl-order'), rec.weyl_order, `${T} weyl_order`);
      intEq(await exactOf(page, 'det-cartan'), rec.det_cartan, `${T} det_cartan`);
      intEq(await exactOf(page, 'minuscule-nodes'), rec.minuscule_nodes, `${T} minuscule_nodes`);
      if (rec.minuscule_nodes.length === 0) await expect(page.locator('[data-out="minuscule-nodes"]')).toHaveText('none');
      intEq(await exactOf(page, 'minus-w0'), rec.minus_w0, `${T} minus_w0`);
      intEq(await exactOf(page, 'fundamental-orbit-sizes'), rec.fundamental_orbit_sizes, `${T} fundamental_orbit_sizes`);
      const games = await exactOf(page, 'complete-games');
      if (rec.n_reduced_words_w0 !== undefined) {
        intEq(games, rec.n_reduced_words_w0, `${T} n_reduced_words_w0`);
      } else {
        expect(games, T).toBeNull();
        await expect(page.locator('[data-out="complete-games"]')).toContainText('not offered for a group of more than 60000 elements');
      }
      if (rec.coxeter_plane !== undefined) {
        const rings = (await exactOf(page, 'coxeter-plane-rings')) as [number, number][];
        ringsEq(rings, rec.coxeter_plane.rings);
        await expect(page.locator('#coxeter-plane table.rings tbody tr')).toHaveCount(rec.coxeter_plane.rings.length);
      } else {
        await expect(page.locator('[data-out="coxeter-plane-rings"]')).toHaveCount(0);
        await expect(page.locator('#coxeter-plane')).toContainText('has rank 1, so it has no Coxeter plane');
      }
      const aff = AFFINE[T]!;
      expect(await exactOf(page, 'affine-name'), T).toBe(aff.name);
      intEq(await exactOf(page, 'marks'), aff.marks, `${T} marks`);
      intEq(await exactOf(page, 'comarks'), aff.comarks, `${T} comarks`);
      const forms = (await exactOf(page, 'real-forms')) as { cartan_label: string; real_form: string; black_nodes: number[]; tau: number[] }[];
      const records = SATAKE.filter((r) => r.dynkin_type === T);
      expect(forms.map((f) => `${f.cartan_label} | ${f.real_form}`).sort(), T).toEqual(records.map((r) => `${r.cartan_label} | ${r.real_form}`).sort());
      for (const f of forms) {
        const g = matchRecord(records, { real_form: f.real_form });
        expect(f.cartan_label, `${T} ${f.real_form}`).toBe(g.cartan_label);
        intEq(f.black_nodes, g.black_nodes, `${T} ${f.real_form} black`);
        intEq(f.tau, g.tau, `${T} ${f.real_form} tau`);
      }
      // Each real form is shown with its display name and Cartan's label beside it (6.5).
      await expect(page.locator('[data-out="real-forms"] li .cartan-label')).toHaveCount(records.length);
    }
  });
});

test.describe('downloads', () => {
  test('downloads: JSON, CSV and LaTeX for B3', async ({ page }) => {
    await page.goto('atlas/B3/');
    const rec = golden.types['B3']!;
    const json = await downloadOf(page, 'json');
    expect(json.file).toBe('atlas-B3.json');
    const doc = JSON.parse(json.text) as { tool: string; state: unknown; engineVersion: string; commit: string; derived: Record<string, unknown> };
    expect(doc.tool).toBe('atlas');
    expect(doc.state).toEqual({ schema: 1, tool: 'atlas', board: 'B3' });
    expect(doc.engineVersion.length).toBeGreaterThan(0);
    intEq(doc.derived.cartan, rec.cartan);
    intEq(doc.derived.positive_roots, rec.positive_roots);
    intEq(doc.derived.exponents, rec.exponents);
    intEq(doc.derived.n_reduced_words_w0, rec.n_reduced_words_w0);

    const csv = await downloadOf(page, 'csv');
    expect(csv.file).toBe('atlas-B3.csv');
    const rows = csv.text.split('\n');
    expect(rows[0]).toBe('item,label,value');
    expect(rows.filter((r) => r.startsWith('positive_root,'))).toHaveLength(rec.n_positive_roots);
    expect(rows).toContain(`positive_root,${rec.n_positive_roots},"${rec.positive_roots!.at(-1)!.join(',')}"`);
    expect(rows).toContain(`complete_games,,${rec.n_reduced_words_w0}`);

    const tex = await downloadOf(page, 'latex');
    expect(tex.file).toBe('atlas-B3.tex');
    const lines = tex.text.split('\n');
    // The page's address under the site and base of the build (SPEC 7.2 item 10).
    const { site, base } = siteAndBase(process.env);
    expect(lines[0]).toBe(`% ${new URL(`${base}atlas/B3/`, site).href}`);
    expect(lines[1]).toBe('% needs \\usepackage{dynkin-diagrams}');
    // The board's diagram: the line exportLaTeX returns for B3 with no black node and the identity tau
    // (atlas.test.ts > downloads compares it with exportLaTeX's own string); SPEC 6.7 gives its form.
    expect(lines[2]).toBe('\\dynkin B{ooo}');
    // One line per real form, its comment naming Cartan's label and the plain-text name (6.7).
    const records = SATAKE.filter((r) => r.dynkin_type === 'B3');
    const comments = lines.slice(3).filter((l) => l !== '').map((l) => l.slice(l.indexOf('%')));
    expect(comments.sort()).toEqual(records.map((r) => `% ${r.cartan_label}, ${r.real_form}`).sort());
    for (const l of lines.slice(3).filter((x) => x !== '')) expect(l).toMatch(/^\\dynkin(\[involutions=\{[0-9;]+\}\])? B\{[o*]{3}\} {3}% /);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false, acceptDownloads: true });
    test('downloads work without JavaScript (E8)', async ({ page }) => {
      await page.goto('atlas/E8/');
      for (const kind of ['json', 'csv', 'latex']) {
        const { file, text } = await downloadOf(page, kind);
        expect(file).toBe(`atlas-E8.${kind === 'latex' ? 'tex' : kind}`);
        expect(text.length).toBeGreaterThan(100);
      }
    });
  });
});

test.describe('long numbers', () => {
  test.use({ javaScriptEnabled: false });
  test('long numbers: complete games on E6 shortened with the digit count, exact digits in title, disclosure and downloads', async ({ page }) => {
    for (const T of ['E6', 'A7', 'D6', 'B6', 'C6']) {
      await page.goto(`atlas/${T}/`);
      const digits = String(golden.types[T]!.n_reduced_words_w0);
      expect(digits.length).toBeGreaterThan(12);
      const out = page.locator('[data-out="complete-games"]');
      await expect(out).toHaveAttribute('data-long', 'true');
      // 4.0: "1.2345... x 10^83", with the number of digits.
      await expect(out).toHaveText(`${digits[0]}.${digits.slice(1, 5)}... x 10^${digits.length - 1} (${digits.length} digits)`);
      expect(await out.getAttribute('title')).toContain(digits);
      intEq(JSON.parse((await out.getAttribute('data-exact'))!), golden.types[T]!.n_reduced_words_w0);
      const details = page.locator('#complete-games details[data-exact-value]');
      await details.locator('summary').click();
      await expect(details).toContainText(`${digits} (${digits.length} digits)`);
      if (T === 'E6') {
        const csv = Buffer.from((await page.locator('[data-download="csv"]').getAttribute('href'))!.split('base64,')[1]!, 'base64').toString('utf8');
        expect(csv).toContain(`complete_games,,${digits}`);
        const json = Buffer.from((await page.locator('[data-download="json"]').getAttribute('href'))!.split('base64,')[1]!, 'base64').toString('utf8');
        expect(json).toContain(digits);
      }
    }
    // A count of at most 12 digits is not shortened.
    await page.goto('atlas/F4/');
    await expect(page.locator('[data-out="complete-games"]')).toHaveText(String(golden.types['F4']!.n_reduced_words_w0));
  });
});

test.describe('links', () => {
  test('links: every tool link of B3 opens its tool with the board loaded and no notice', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    await page.goto('atlas/B3/');
    const base = new URL(baseURL!).pathname;
    const links = await page.locator('a[data-tool-link]').evaluateAll((as) => as.map((a) => ({ tool: a.getAttribute('data-tool-link')!, href: a.getAttribute('href')!, text: (a.textContent ?? '').trim() })));
    // One per item that links (the real forms link one by one, to T13, once it is on the branch).
    expect(links.length).toBeGreaterThanOrEqual(15);
    for (const l of links) {
      expect(l.href.startsWith(`${base}tools/${l.tool}/?z=1&g=`), l.href).toBe(true);
      expect(l.text.length).toBeGreaterThan(10);
      expect(/click here/i.test(l.text)).toBe(false);
    }
    expect(links.filter((l) => l.tool === 'weyl')).toHaveLength(2);
    for (const l of links) {
      await page.goto(l.href);
      const root = page.locator(`[data-tool="${l.tool}"]`).first();
      await expect(root, l.href).toHaveAttribute('data-hydrated', 'true', { timeout: 20_000 });
      await expect(page.locator('[data-out="notice"]'), `${l.href}: the link was read`).toHaveCount(0);
    }
  });

  test('links: T8 only on its boards, T5 and T1 elsewhere; no Coxeter-plane link on A1', async ({ page }) => {
    for (const T of ['E8', 'A1', 'D5', 'G2']) {
      await page.goto(`atlas/${T}/`);
      expect(await page.locator('a[data-tool-link="weyl"]').count(), T).toBe(WEYL_BOARDS.includes(T) ? 2 : 0);
      expect(await page.locator('a[data-tool-link="mirror"]').count(), T).toBe(0);
      expect(await page.locator('#coxeter-plane a[data-tool-link]').count(), T).toBe(T === 'A1' ? 0 : 1);
      const affine = page.locator('#affine a[data-tool-link="affine"]');
      expect(await affine.getAttribute('href'), T).toMatch(new RegExp(`tools/affine/\\?z=1&g=${AFFINE[T]!.constructor_name}$`));
    }
    await page.goto('atlas/B2/');
    expect(await page.locator('#affine a[data-tool-link="affine"]').getAttribute('href')).toMatch(/g=B2~$/);
  });

  // Repair after review (major a): T10 opens with the short roots hidden (6.6 keeps the option out of a link), so on
  // a board with two root lengths the link says to tick Short roots; ticked, the tool shows the rings the page lists.
  test('links: with Short roots ticked, the Coxeter-plane link shows all the roots on the rings listed (B3, C3, G2)', async ({ page }) => {
    test.setTimeout(180_000);
    for (const T of ['B3', 'C3', 'G2']) {
      const rec = golden.types[T]!;
      expect(rec.highest_short_root, `${T} has two root lengths`).not.toBeNull();
      await page.goto(`atlas/${T}/`);
      const a = page.locator('#coxeter-plane a[data-tool-link="geometry"]');
      await expect(a).toHaveText(`See the roots of ${T} in the Coxeter plane in the Geometry Studio; tick Short roots to see all ${rec.n_roots} roots on the rings listed here`);
      const listed = await shown(page, 'coxeter-plane-rings');
      await page.goto((await a.getAttribute('href'))!);
      const root = page.locator('[data-tool="geometry"]').first();
      await expect(root, T).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
      await root.locator('[data-control="shortRoots"]').check();
      await expect(root.locator('[data-out="ringSizes"]'), `${T}: the rings with the short roots`).toHaveText(listed);
      await expect(root.locator('[data-out="pointCount"]'), `${T}: every root`).toHaveText(String(rec.n_roots));
    }
    // A simply laced board has one root length, and its link says nothing of short roots.
    await page.goto('atlas/D4/');
    await expect(page.locator('#coxeter-plane a[data-tool-link="geometry"]')).toHaveText('See the roots of D4 in the Coxeter plane in the Geometry Studio');
  });

  test('links: the texts of h and |W| promise what the Numbers Game Lab shows', async ({ page }) => {
    // A1: the wave is a single move (F8), so its h link promises no rounds.
    await page.goto('atlas/A1/');
    const a1 = (await page.locator('#coxeter-number a[data-tool-link]').textContent())!;
    expect(a1).not.toMatch(/round|wave/i);
    await expect(page.locator('#coxeter-number')).not.toContainText('round');
    // D5 (not offered by T8): the order is the product of the exponents each increased by one (F7).
    await page.goto('atlas/D5/');
    await expect(page.locator('#weyl-order a[data-tool-link="numbers"]')).toContainText('the group order is the product of the exponents each increased by one');
    await expect(page.locator('#coxeter-number a[data-tool-link="numbers"]')).toContainText('choose its Wave tab to count the rounds');
    // A round is the firing of one colour class (F8), so h rounds and not h/2.
    await expect(page.locator('#coxeter-number')).toContainText('and repeat, one round being the firing of one colour class. The game ends after exactly');
  });
});

test.describe('pages', () => {
  test('no island on atlas pages: no island, no script file, nothing fetched as script', async ({ page }) => {
    for (const path of ['atlas/', ...TYPE_NAMES.map((T) => `atlas/${T}/`)]) {
      const scripts: string[] = [];
      const listener = (r: { resourceType(): string; url(): string }): void => {
        if (r.resourceType() === 'script') scripts.push(r.url());
      };
      page.on('request', listener);
      await page.goto(path, { waitUntil: 'networkidle' });
      page.off('request', listener);
      expect(scripts, path).toEqual([]);
      await expect(page.locator('astro-island'), path).toHaveCount(0);
      await expect(page.locator('script[src]'), path).toHaveCount(0);
    }
  });

  test('index: 32 links grouped by letter, each to its page', async ({ page, baseURL }) => {
    await page.goto('atlas/');
    const base = new URL(baseURL!).pathname;
    await expect(page.locator('main h1')).toHaveText('Atlas');
    const groups = await page.locator('[data-atlas-index] [data-group]').evaluateAll((gs) =>
      gs.map((g) => [g.getAttribute('data-group'), [...g.querySelectorAll('[data-board-link]')].map((a) => a.getAttribute('data-board-link'))]),
    );
    expect(groups.map((g) => g[0])).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(groups.flatMap((g) => g[1] as string[])).toEqual([...TYPE_NAMES]);
    for (const T of TYPE_NAMES) {
      const a = page.locator(`[data-board-link="${T}"]`);
      await expect(a).toHaveAttribute('href', `${base}atlas/${T}/`);
      expect(await texIn(page, `[data-board-link="${T}"]`)).toEqual([`${T[0]}_{${T.slice(1)}}`]);
    }
    await page.locator('[data-board-link="E8"]').click();
    await expect(page).toHaveURL(new RegExp(`${base}atlas/E8/$`));
    await expect(page.locator('h1')).toHaveAttribute('data-board-name', 'E8');
  });

  test('Kac note wrapped: E6, E7, E8 and G2, inside Unverified E4, with the mark to open-items', async ({ page }) => {
    for (const T of ['E6', 'E7', 'E8', 'G2']) {
      await page.goto(`atlas/${T}/`);
      const wrapped = page.locator('[data-kac-note] [data-unverified="E4"]');
      await expect(wrapped, T).toHaveCount(1);
      if (RELEASE) {
        // A release build shows the fallback in its place (7.3).
        await expect(wrapped).toHaveText('Other books may number the nodes of this board differently; compare the Cartan matrices before reading off a node.');
        continue;
      }
      // The preview build shows the sentence with its mark (7.3).
      await expect(wrapped).toContainText(`Kac numbers the nodes of ${T} differently`);
      expect(await wrapped.locator('a.unverified-mark').getAttribute('href')).toMatch(/open-items#E4$/);
    }
    for (const T of ['A3', 'B3', 'D4', 'F4']) {
      await page.goto(`atlas/${T}/`);
      await expect(page.locator('[data-kac-note]'), T).toHaveCount(0);
      expect(((await page.locator('main').textContent()) ?? '').includes('Kac numbers'), T).toBe(false);
    }
  });

  test('Wildberger note: the row of 2.10 that applies, B and C the right way round', async ({ page }) => {
    const note = '[data-wildberger]';
    await page.goto('atlas/B3/');
    await expect(page.locator(note)).toHaveAttribute('data-wildberger', 'reversed');
    // His name first, then this board's: his "C3" is this board, B3, reversed.
    expect(await texIn(page, `${note} p:first-of-type`)).toEqual(['C_{3}', 'B_{3}']);
    await expect(page.locator('[data-letters-exchanged]')).toHaveCount(1);
    await expect(page.locator(note)).toContainText('checked by computation against the printed lists of positive roots');
    await page.goto('atlas/C3/');
    expect(await texIn(page, `${note} p:first-of-type`)).toEqual(['B_{3}', 'C_{3}']);
    await expect(page.locator('[data-letters-exchanged]')).toHaveCount(1);
    await page.goto('atlas/F4/');
    await expect(page.locator('[data-letters-exchanged]')).toHaveCount(0);
    for (const T of ['E8', 'A4']) {
      await page.goto(`atlas/${T}/`);
      await expect(page.locator(note), T).toHaveAttribute('data-wildberger', 'none');
      expect(await proseOf(page, `${note} p`), T).toEqual(["This site uses Bourbaki's names and numbering of the nodes [Bou68]."]);
    }
  });

  // Repair after review: the full sentence of each of the seven rows of SPEC 2.10, on one page each. His name is
  // read from golden wildberger_lists.names (his name to this site's board); the rest of each sentence is the row
  // of 2.10 in the site's words, and the facts it states are checked against the golden board as well.
  test('Wildberger note: the full sentence of each row of 2.10', async ({ page }) => {
    const hisName = (T: string): string => {
      const his = Object.keys(HIS_NAMES).filter((k) => HIS_NAMES[k] === T || HIS_NAMES[k] === `${T} with the node order reversed`);
      expect(his, T).toHaveLength(1);
      return his[0]!;
    };
    const tex = (name: string): string => `${name[0]}_{${name.slice(1)}}`;
    const opening = "This site uses Bourbaki's names and numbering of the nodes. Wildberger's paper [W20] (section 9) and manuscript [W-MS] (pages 23 to 29) name and number some boards differently.";
    const rank = (T: string): number => golden.types[T]!.cartan.length;
    const d = (T: string): number[] => golden.types[T]!.symmetrizer;
    const joined = (T: string, a: number, b: number): boolean => golden.types[T]!.adjacency[a - 1]![b - 1]! > 0;
    const rows: [string, string, string][] = [
      ['B2 and C2', 'B2', `His “${tex(hisName('B2'))}” is this board, with the same numbering of the nodes.`],
      ['B_n', 'B3', `His “${tex(hisName('B3'))}” is this board, ${tex('B3')}, with the order of the nodes reversed: his vertex k is node ${rank('B3') + 1} \u2212 k.`],
      ['C_n', 'C4', `His “${tex(hisName('C4'))}” is this board, ${tex('C4')}, with the order of the nodes reversed: his vertex k is node ${rank('C4') + 1} \u2212 k.`],
      ['F4', 'F4', `His “${tex(hisName('F4'))}” is this board with the order of the nodes reversed, so his vertices 3 and 4 are the long nodes.`],
      ['G2', 'G2', `His “${tex(hisName('G2'))}” is this board, with the same numbering of the nodes: his vertex 1 is the short node.`],
      ['D_n', 'D5', `His “${tex(hisName('D5'))}” is a path 1, …, ${rank('D5') - 1} with a vertex 0 joined to vertex 2: his vertex k is node ${rank('D5')} \u2212 k, and his vertex 0 is node ${rank('D5')}.`],
      ['E6 and E7', 'E7', `His “${tex(hisName('E7'))}” is a path 1, 2, 3, … with a vertex 0 joined to vertex 3: his path 1, 2, 3, … is the nodes 1, 3, 4, … of this site, and his vertex 0 is node 2.`],
    ];
    for (const [row, T, sentence] of rows) {
      await page.goto(`atlas/${T}/`);
      const [first] = await proseOf(page, '[data-wildberger] p:first-of-type');
      expect(first, `${row} (${T})`).toBe(`${opening} ${sentence}`);
    }
    // What the sentences say, on the golden boards: on F4 his vertices 3 and 4 (nodes 2 and 1) are the long
    // nodes; on G2 his vertex 1 (node 1) is short; on D5 his vertex 0 (node 5) is joined to his vertex 2 (node 3);
    // on E7 his vertex 0 (node 2) is joined to his vertex 3 (node 4), and his path is the nodes 1, 3, 4, 5, 6, 7.
    expect(Math.min(d('F4')[0]!, d('F4')[1]!)).toBeGreaterThan(Math.max(d('F4')[2]!, d('F4')[3]!));
    expect(d('G2')[0]!).toBeLessThan(d('G2')[1]!);
    expect(joined('D5', 5, 3)).toBe(true);
    expect(joined('E7', 2, 4)).toBe(true);
    for (const [a, b] of [[1, 3], [3, 4], [4, 5], [5, 6], [6, 7]]) expect(joined('E7', a!, b!), `E7 nodes ${a} and ${b}`).toBe(true);
    // The sentence of 2.10 on the B and C pages, and the provenance in words.
    await page.goto('atlas/B3/');
    expect(await proseOf(page, '[data-letters-exchanged]')).toEqual([
      "For rank at least 3 the letters B and C are exchanged relative to Bourbaki: Wildberger's “B_n” is this site's C_n with the order of the nodes reversed, and his “C_n” is this site's B_n reversed.",
    ]);
    expect(await proseOf(page, '[data-wildberger] p.provenance')).toEqual(['These translations were checked by computation against the printed lists of positive roots: the lists were compared for ranks 3 and 4.']);
  });

  // Repair after review: the records and the real forms they make are counted truly on every board (6.4
  // "Coincidences"), from golden admissible_counts; on D4 the two records that are one real form are named.
  test('real forms: records and real forms counted on every page; the coincidence of D4 named', async ({ page }) => {
    test.setTimeout(180_000);
    for (const T of TYPE_NAMES) {
      await page.goto(`atlas/${T}/`);
      const { catalogue_records: records, real_forms_including_compact: forms } = COUNTS[T]!;
      const [sentence] = await proseOf(page, '[data-real-form-count]');
      if (records === forms) {
        expect(sentence, T).toMatch(new RegExp(`^The Satake catalogue lists ${records} real forms of ${T}, each with Cartan's label beside its name\\.`));
        await expect(page.locator('[data-coincidence]'), T).toHaveCount(0);
      } else {
        expect(sentence, T).toMatch(new RegExp(`^The Satake catalogue lists ${records} records for ${T}, which make ${forms} real forms; each record has Cartan's label beside its name\\.`));
        await expect(page.locator('[data-coincidence]'), T).toHaveCount(records - forms);
      }
    }
    await page.goto('atlas/D4/');
    const group = (await page.locator('[data-coincidence]').getAttribute('data-coincidence'))!.split(' ');
    expect(group).toHaveLength(2);
    for (const f of group) matchRecord(SATAKE.filter((r) => r.dynkin_type === 'D4'), { real_form: f });
    expect(await texIn(page, '[data-coincidence]')).toHaveLength(3);
    await expect(page.locator('[data-coincidence]')).toContainText('are one real form, as verified by computation; both are listed.');
  });

  // Repair after review: SPEC 8.4 "Every theorem-like statement carries its provenance", as SPEC gives it (2.4,
  // 2.7, 2.12, 6.4): the place in SPEC, the range verified by computation, and the citations SPEC names.
  test('provenance: each statement beside a value carries the provenance SPEC gives it, on every page', async ({ page }) => {
    test.setTimeout(240_000);
    const computed = 'verified by computation for every board of finite type of rank at most 8';
    const expected = (T: string): Record<string, { marker: string; words: string; cites: string[] }> => ({
      roots: { marker: 'F1', words: computed, cites: ['W03a'] },
      'highest-roots': { marker: 'F13', words: computed, cites: ['Che17'] },
      exponents: { marker: 'F7', words: computed, cites: ['Ste59', 'Kos59'] },
      'coxeter-number': golden.types[T]!.cartan.length >= 2 ? { marker: 'F7 F8', words: computed, cites: ['FZ03b', 'Ste59'] } : { marker: 'F7', words: computed, cites: [] },
      'weyl-order': { marker: 'F7', words: computed, cites: [] },
      'det-cartan': { marker: '2.4', words: 'a fact of linear algebra', cites: [] },
      'minuscule-nodes': { marker: 'F11', words: 'verified by computation for every node of every board of finite type of rank at most 8', cites: [] },
      'minus-w0': { marker: 'F4', words: 'This is verified by computation from all ones and from six random starts with every number positive, on every board of finite type of rank at most 8', cites: [] },
      ...(golden.types[T]!.n_reduced_words_w0 !== undefined ? { 'complete-games': { marker: 'F5', words: 'the reduced words of the longest element', cites: ['Don08'] } } : {}),
      affine: { marker: '2.12', words: 'verified by computation for the affine board of every board of finite type of rank at most 8', cites: [] },
      'real-forms': { marker: '6.4', words: 'verified by computation', cites: [] },
    });
    for (const T of TYPE_NAMES) {
      await page.goto(`atlas/${T}/`);
      const found = await page.locator('[data-provenance]').evaluateAll((ps) =>
        ps.map((p) => ({
          item: p.closest('section[data-item]')?.getAttribute('data-item') ?? '',
          marker: p.getAttribute('data-provenance') ?? '',
          text: (p.textContent ?? '').replace(/\s+/g, ' '),
          cites: [...p.querySelectorAll('a.cite')].map((a) => a.getAttribute('data-cite') ?? ''),
        })),
      );
      const want = expected(T);
      expect(found.map((f) => f.item), T).toEqual(Object.keys(want));
      for (const f of found) {
        const w = want[f.item]!;
        expect(f.marker, `${T} ${f.item}`).toBe(w.marker);
        expect(f.text, `${T} ${f.item}`).toContain(w.words);
        expect(f.cites, `${T} ${f.item}`).toEqual(w.cites);
      }
    }
  });

  // Repair after review: names are typeset (6.5) and numbers carry a true minus sign (6.3); no data spelling
  // such as "e6(-14)" reaches the visible text of any Atlas page.
  test('no visible text on an Atlas page writes a number with a hyphen-minus', async ({ page }) => {
    test.setTimeout(180_000);
    for (const path of ['atlas/', ...TYPE_NAMES.map((T) => `atlas/${T}/`), 'tools/atlas/']) {
      await page.goto(path);
      const text = await visibleText(page);
      expect(text.match(/.{0,40}\(-\d.{0,20}/g), path).toBeNull();
      expect(text.match(/.{0,40}(?<![\w.])-\d.{0,20}/g), path).toBeNull();
    }
  });

  // The site navigation links to the Atlas index (MERGE's request to P6-A4), after Modules, on every kind of page,
  // marked as the current page on the index, and the navigation still fits at 320 px.
  test('navigation: the Atlas index is in the site navigation and fits at 320 px', async ({ page, baseURL }) => {
    const base = new URL(baseURL!).pathname;
    for (const path of ['', 'about/', 'atlas/', 'atlas/E8/', 'tools/atlas/', 'modules/']) {
      await page.goto(path);
      const nav = page.locator('nav[aria-label="Site"]');
      expect(await nav.locator('a').allTextContents(), path).toEqual(['Home', 'Modules', 'Atlas', 'Glossary', 'Sources', 'About', 'Credits']);
      await expect(nav.locator('a', { hasText: 'Atlas' }), path).toHaveAttribute('href', `${base}atlas/`);
      if (path === 'atlas/') await expect(nav.locator('a[aria-current="page"]')).toHaveText('Atlas');
      else await expect(nav.locator('a', { hasText: 'Atlas' }), path).not.toHaveAttribute('aria-current', 'page');
    }
    await page.goto('about/');
    await page.locator('nav[aria-label="Site"] a', { hasText: 'Atlas' }).click();
    await expect(page).toHaveURL(new RegExp(`${base}atlas/$`));
    await expect(page.locator('main h1')).toHaveText('Atlas');
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ['about/', 'atlas/', 'atlas/B8/']) {
      await page.goto(path);
      const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(scrollWidth, path).toBeLessThanOrEqual(innerWidth!);
      const boxes = await page.locator('nav[aria-label="Site"] a, [data-theme-switch]').evaluateAll((es) => es.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right, r.height]));
      expect(boxes, path).toHaveLength(8);
      for (const [left, right, height] of boxes) {
        expect(left!, path).toBeGreaterThanOrEqual(0);
        expect(right!, path).toBeLessThanOrEqual(320);
        expect(height!, path).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('rank 2 naming: B2 and C2 keep their own names and say B2 = C2', async ({ page, baseURL }) => {
    const base = new URL(baseURL!).pathname;
    for (const [T, other] of [['B2', 'C2'], ['C2', 'B2']] as const) {
      await page.goto(`atlas/${T}/`);
      await expect(page.locator('h1')).toHaveAttribute('data-board-name', T);
      expect(await texIn(page, 'h1')).toEqual([`${T[0]}_{2}`]);
      await expect(page).toHaveTitle(new RegExp(`^${T} in the Atlas`));
      const note = page.locator('[data-rank2-note]');
      expect(await texIn(page, '[data-rank2-note]')).toEqual(['B_{2}', 'C_{2}', 'B_{2}', 'C_{2}']);
      await expect(note.locator(`a[data-other-page="${other}"]`)).toHaveAttribute('href', `${base}atlas/${other}/`);
      // The affine board is recognised from its shape: C2~ on both pages, marked B2=C2.
      await expect(page.locator('[data-out="affine-name"]')).toHaveText(AFFINE[T]!.name);
      expect(AFFINE[T]!.name).toBe(AFFINE[other]!.name);
      expect(await texIn(page, '#affine p')).toEqual(expect.arrayContaining(['B_{2}', 'C_{2}']));
    }
    await page.goto('atlas/B3/');
    await expect(page.locator('[data-rank2-note]')).toHaveCount(0);
  });

  test('sp note on the C pages only', async ({ page }) => {
    for (const T of ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']) {
      await page.goto(`atlas/${T}/`);
      await expect(page.locator('[data-sp-note]'), T).toHaveCount(1);
      expect(await texIn(page, '[data-sp-note]')).toEqual(['\\mathfrak{sp}(2p,2q)', '\\mathfrak{sp}(8)', '\\mathfrak{sp}(p,q)', '\\mathfrak{sp}(4)']);
    }
    for (const T of ['B3', 'A3', 'D4', 'E6']) {
      await page.goto(`atlas/${T}/`);
      await expect(page.locator('[data-sp-note]'), T).toHaveCount(0);
    }
  });

  test('320 px: E8 and B8 reflow with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const T of ['E8', 'B8']) {
      await page.goto(`atlas/${T}/`);
      const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(scrollWidth, T).toBeLessThanOrEqual(innerWidth);
      // Every matrix box stays inside the column; a wide one scrolls in its own box (A-11).
      const boxes = await page.locator('.matrix-view .box').evaluateAll((bs) => bs.filter((b) => (b as HTMLElement).offsetParent !== null).map((b) => b.getBoundingClientRect().right));
      for (const right of boxes) expect(right).toBeLessThanOrEqual(320);
      await page.locator('[data-convention-choice="bourbaki"]').check();
      const [sw2] = await page.evaluate(() => [document.documentElement.scrollWidth]);
      expect(sw2, `${T} with the transpose shown`).toBeLessThanOrEqual(320);
    }
  });

  test('axe: /atlas/B3/, /atlas/E8/, /atlas/ and /tools/atlas/ have no serious or critical violation', async ({ page }) => {
    test.setTimeout(180_000);
    for (const path of ['atlas/B3/', 'atlas/E8/', 'atlas/', 'tools/atlas/']) {
      await page.goto(path);
      if (path.startsWith('tools/')) await expect(page.locator('[data-tool="atlas"]')).toHaveAttribute('data-hydrated', 'true');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
      expect(serious, path).toEqual([]);
    }
  });
});

test.describe('tool route', () => {
  test('tool route: /tools/atlas and /embed/atlas render the picker, which hydrates', async ({ page, baseURL }) => {
    const base = new URL(baseURL!).pathname;
    for (const path of ['tools/atlas/', 'embed/atlas/']) {
      await page.goto(path);
      const root = page.locator('[data-tool="atlas"]');
      await expect(root).toHaveAttribute('data-hydrated', 'true');
      await expect(root).toHaveAttribute('data-moves', '');
      await expect(root.locator('[data-out="caption"]')).toContainText('32 boards of finite type');
      const links = await root.locator('[data-board-link]').evaluateAll((as) => as.map((a) => [a.getAttribute('data-board-link'), a.getAttribute('href')]));
      expect(links.map((l) => l[0])).toEqual([...TYPE_NAMES]);
      for (const [T, href] of links) expect(href).toBe(`${base}atlas/${T}/`);
      expect(await root.locator('[data-group]').evaluateAll((gs) => gs.map((g) => g.getAttribute('data-group')))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
      await expect(root.locator('svg[role="img"]')).toHaveCount(32);
      await expect(root.locator('[data-out="chosen"], [data-out="notice"]')).toHaveCount(0);
    }
  });

  test('tool route: keyboard, Tab reaches every board link in order with a visible focus ring, Enter on B3 opens its page', async ({ page, baseURL }) => {
    const base = new URL(baseURL!).pathname;
    await page.goto('tools/atlas/');
    await expect(page.locator('[data-tool="atlas"]')).toHaveAttribute('data-hydrated', 'true');
    await page.locator('[data-tool="atlas"] [data-out="caption"]').click();
    const reached: string[] = [];
    for (let k = 0; k < 60 && reached.length < TYPE_NAMES.length; k++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        const card = a?.closest('.card') as HTMLElement | null;
        return { board: a?.getAttribute('data-board-link') ?? null, ring: card ? getComputedStyle(card).outlineStyle : 'none' };
      });
      if (info.board !== null) {
        reached.push(info.board);
        expect(info.ring, `focus ring on ${info.board}`).not.toBe('none');
      }
    }
    expect(reached).toEqual([...TYPE_NAMES]);
    await page.locator('[data-board-link="B3"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${base}atlas/B3/$`));
    await expect(page.locator('h1')).toHaveAttribute('data-board-name', 'B3');
  });

  test('tool route: g puts the chosen board first; an unreadable g shows the notice', async ({ page, baseURL }) => {
    const base = new URL(baseURL!).pathname;
    await page.goto('tools/atlas/?z=1&g=E8');
    const root = page.locator('[data-tool="atlas"]');
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    const chosen = root.locator('[data-out="chosen"] a');
    await expect(chosen).toHaveAttribute('href', `${base}atlas/E8/`);
    expect(await root.locator('[data-board-link]').first().getAttribute('data-board-link')).toBe('E8');
    await expect(root.locator('[data-out="notice"]')).toHaveCount(0);
    for (const q of ['?z=1&g=A4~', '?z=1&g=Q9', '?z=2&g=B3']) {
      await page.goto(`tools/atlas/${q}`);
      await expect(root).toHaveAttribute('data-hydrated', 'true');
      await expect(root.locator('[data-out="notice"]'), q).toHaveText('The link could not be read, so the tool shows its default state.');
      await expect(root.locator('[data-out="chosen"]'), q).toHaveCount(0);
    }
  });

  test('tool route: Cite gives the citation of the page', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
    });
    await page.goto('tools/atlas/?z=1&g=B3');
    await expect(page.locator('[data-tool="atlas"]')).toHaveAttribute('data-hydrated', 'true');
    await page.locator('[data-control="cite"]').click();
    const cite = page.locator('[data-out="citeText"]');
    await expect(cite).toContainText('Atlas. Two Games on a Dynkin Diagram, site version ');
    expect(((await cite.textContent()) ?? '').endsWith(page.url())).toBe(true);
    await expect(page.locator('[data-live]')).toHaveText('Citation copied.');
  });
});
