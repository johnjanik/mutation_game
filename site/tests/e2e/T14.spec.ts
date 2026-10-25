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
// data-download, data-tool-link, data-board-link, data-group, data-control="cite", data-live; KaTeX's
// <annotation> for typeset names.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { siteAndBase } from '../../src/lib/siteAndBase.mjs';
import { TYPE_NAMES, golden, intEq, ringsEq } from '../../../packages/engine/test/golden/_harness';

interface GoldenSatake {
  dynkin_type: string;
  cartan_label: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
}
interface GoldenAffine {
  name: string;
  constructor_name: string;
  marks: number[];
  comarks: number[];
}
const SATAKE = golden.satake as GoldenSatake[];
const AFFINE = golden.affine as Record<string, GoldenAffine>;

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
    expect(await drawing.getAttribute('aria-label')).toContain('Two roads from node 2 to node 3 and one back');
    await expect(root.locator('[data-out="caption"]')).toContainText('The data sheet of the board B3');
    await expect(root.locator('[data-out="noscript"]')).toBeVisible();
    // Every section, an h2 each, in the order of the T14 entry.
    expect(await page.locator('main section[data-item]').evaluateAll((ss) => ss.map((s) => s.getAttribute('data-item')))).toEqual(ITEMS);
    for (const id of ITEMS) await expect(page.locator(`#${id} > h2`), id).toBeVisible();
    // The values are there as text, with a true minus sign (6.3).
    await expect(page.locator('[data-out="coxeter-number"]')).toHaveText('6');
    await expect(page.locator('[data-out="weyl-order"]')).toHaveText('48');
    await expect(page.locator('[data-out="exponents"]')).toHaveText('1, 3, 5');
    await expect(page.locator('[data-out="minus-w0"]')).toHaveText('(1, 2, 3)');
    await expect(page.locator('#minus-w0')).toContainText('(1, 2, 3), the identity');
    await expect(page.locator('[data-out="minuscule-nodes"]')).toHaveText('3');
    await expect(page.locator('[data-out="positive-roots"] li')).toHaveCount(9);
    await expect(page.locator('[data-out="positive-roots"] li').last()).toHaveText('(1, 2, 2)');
    await expect(page.locator('[data-out="cartan"] td[data-row="3"][data-col="2"]')).toHaveText('−2');
    await expect(page.locator('[data-out="complete-games"]')).toHaveText('42');
    await expect(page.locator('[data-out="real-forms"] li')).toHaveCount(4);
    // A static sheet: no node buttons (4.0's node hooks; the only data-value hooks are MatrixView's on its
    // matrix cells), no button at all in the sheet, no island, no script file.
    await expect(page.locator('[data-node], [data-board], [data-can-act]')).toHaveCount(0);
    expect(await page.locator('[data-value]').evaluateAll((es) => es.filter((e) => e.closest('.matrix-view') === null).length)).toBe(0);
    await expect(page.locator('main button')).toHaveCount(0);
    await expect(page.locator('astro-island')).toHaveCount(0);
    await expect(page.locator('script[src]')).toHaveCount(0);
    // No em-dash on the page (8.4).
    expect(((await page.locator('main').textContent()) ?? '').includes('—')).toBe(false);
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
        await expect(page.locator('fieldset:has([data-convention-choice]) > legend')).toHaveText('Show the Cartan matrix as it is printed by');
        await page.locator('[data-convention-choice="site"]').focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('[data-convention-choice="bourbaki"]')).toBeChecked();
        await expect(bourbaki).toBeVisible();
        await expect(site).toBeHidden();
        // The matrix shown is the transpose: row 2, column 3 of C^T is C_32 = -2.
        await expect(bourbaki.locator('td[data-row="2"][data-col="3"]')).toHaveText('−2');
        await expect(bourbaki.locator('td[data-row="3"][data-col="2"]')).toHaveText('−1');
        await page.keyboard.press('ArrowUp');
        await expect(page.locator('[data-convention-choice="site"]')).toBeChecked();
        await expect(site).toBeVisible();
        await expect(bourbaki).toBeHidden();
      });
    });
  }
});

test.describe('displayed values', () => {
  test.use({ javaScriptEnabled: false });
  test('displayed values equal golden on every page', async ({ page }) => {
    test.setTimeout(240_000);
    for (const T of TYPE_NAMES) {
      const rec = golden.types[T]!;
      await page.goto(`atlas/${T}/`);
      await expect(page.locator('h1')).toHaveAttribute('data-board-name', T);
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
        const g = records.find((r) => r.real_form === f.real_form)!;
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
    expect(rows).toContain('positive_root,9,"1,2,2"');
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
    await expect(page.locator(`${note} p:first-of-type`)).toContainText('with the order of the nodes reversed: his vertex k is node 4 − k');
    await expect(page.locator('[data-letters-exchanged]')).toHaveCount(1);
    await expect(page.locator(note)).toContainText('checked by computation against the printed lists of positive roots');
    await page.goto('atlas/C3/');
    expect(await texIn(page, `${note} p:first-of-type`)).toEqual(['B_{3}', 'C_{3}']);
    await expect(page.locator('[data-letters-exchanged]')).toHaveCount(1);
    await page.goto('atlas/F4/');
    await expect(page.locator(note)).toContainText('his vertices 3 and 4 are the long nodes');
    await expect(page.locator('[data-letters-exchanged]')).toHaveCount(0);
    await page.goto('atlas/D5/');
    await expect(page.locator(note)).toHaveAttribute('data-wildberger', 'D');
    await expect(page.locator(note)).toContainText('his vertex k is node 5 − k, and his vertex 0 is node 5');
    await page.goto('atlas/E6/');
    await expect(page.locator(note)).toHaveAttribute('data-wildberger', 'E');
    await expect(page.locator(note)).toContainText('his vertex 0 is node 2');
    for (const T of ['E8', 'A4']) {
      await page.goto(`atlas/${T}/`);
      await expect(page.locator(note), T).toHaveAttribute('data-wildberger', 'none');
      await expect(page.locator(note), T).toContainText("This site uses Bourbaki's names and numbering of the nodes");
      expect(((await page.locator(note).textContent()) ?? '').includes('His'), T).toBe(false);
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
      await expect(page.locator('[data-out="affine-name"]')).toHaveText('C2~');
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
