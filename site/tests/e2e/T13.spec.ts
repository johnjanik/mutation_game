// P6-A3: tool T13, the Satake Studio, against the built site (SPEC.md 4 T13, 2.15, 4.0, 6.4, 6.6, 6.7, 7.4,
// 7.5, A.5). Cases are opened by bare query parameters on /tools/satake/ (6.6: every state is a link) or through
// the tool's controls. Tests read only the hooks of 4.0, the live region and, where a criterion is about the
// address bar, the clipboard or a download, those. Expected values are computed here in Node from the engine or
// read from reference/golden_data.json; the only values typed are the worked values of Appendix A.5, of SPEC
// 6.7 (the three LaTeX strings) and of the instruction (sections 5.7 to 5.9).
//
// Properties of T13 (CONTRACTS 5.2; 4.0 Configuration): id, board, black (labels of the black nodes), tau
// (images of all nodes in label order), root (a population in label order), caption, preset ('default',
// 'play-theta', 'shadows', 'lights', 'data', 'restricted', 'catalogue', 'tau-on-black'), prediction. coords,
// start, moves, linkTo and layers are accepted and ignored. A board given without black and tau is the split
// form on that board; properties override the preset's fields.
//
// Hooks read:
//   root:        data-tool="satake", data-moves, data-hydrated="true"
//   decoration:  button[data-node] with data-colour ("black" | "white"), data-board="numbers", data-value ("1" on a
//                black node, "0" on a white one), data-can-act (inside data-out="decoration"); the drawing's
//                data-arrow and data-black-arrow
//   game board:  button[data-node] with data-board="populations", data-value, data-can-act (inside data-out="game-board");
//                the drawn numerals data-numeral (Node.svelte)
//   restricted:  button[data-node] with data-board="populations", data-value (the shadow coordinate), data-can-act
//                (inside data-out="restricted-board")
//   picture:     data-point (coordinates joined by commas), data-mult, data-double, data-chosen (inside data-out="shadow-picture")
//   panels:      data-panel-tab ("lights" | "data" | "theta" | "shadows" | "restricted" | "catalogue"), aria-selected
//   real forms:  data-name on data-out="real-form", "restricted-type", "restricted-name" and "catalogue-row"
//   controls:    data-control="picker", "tau" (data-tau: the images joined by dots), "toggle", "root", "theta-next",
//                "theta-play", "example" (data-example), "catalogue-load" (data-name); undo, redo, reset
//                (History.svelte); copyLink, downloadData, latex, cite (ToolFrame); data-export="svg" | "png"
//   table view:  data-table-node (the paint buttons), data-table-population (the Population cells), data-table-restricted
//   live:        [data-live] (ToolFrame's polite live region)
// data-out names (every one T13 renders; the registry's `outs`):
//   caption, notice, noscript, exportNotice, citeText (ToolFrame); moveCounter, historyStrip, historyCounter
//   (History.svelte); predictResult, predictReveal (Predict.svelte);
//   decoration, black-nodes, tau, arrows, game-board (the decoration and the game board);
//   symmetry-reason, light-1, light-2, light-3, reason-1, reason-2, reason-3, verdict, failure-note, examples;
//   data-pending, data-error, real-form, cartan-label, restricted-type, real-rank, multiplicities, multiplicity-classes,
//   dim-k, dim-p, character, shape (the data);
//   theta-word, theta-stage, theta-stages, theta-note (theta);
//   shadow, shadow-coordinates, shadow-picture, shadow-table, no-restricted-roots (the shadows);
//   restricted-board, restricted-name, restricted-name-note, composite-word, composite-length (the restricted board);
//   catalogue, catalogue-row, same-form (the catalogue)
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { outDirFrom, siteAndBase } from '../../astro.config.mjs';
import { admissibility, boardFromName, positiveRoots, satake, theta, toPositions } from '../../../packages/engine/src/index';
import type { Board, SatakeDiagram } from '../../../packages/engine/src/index';
// the tool's own server-side functions, for the E7 island test (as registry-outs.spec.ts loads the registry)
import { computeNow, islandScript, pairJson } from '../../src/components/tools/t13/load';
import { diagramOf, pairKey } from '../../src/components/tools/t13/model';

interface GoldenRecord {
  dynkin_type: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  real_rank: number;
  restricted_type_display: string | null;
  restricted_board: string | null;
  restricted_simple_orbits: number[][];
  restricted_simple_multiplicities: [number, number][];
  restricted_orbits_in_bourbaki_order: number[][] | null;
  restricted_reflection_word_lengths: number[];
  w_X_word: number[];
  dim_k: number;
  dim_p: number;
  character: number;
  cartan_label: string;
}
interface GoldenExample {
  type: string;
  black_nodes: number[];
  tau: number[];
  condition_1: boolean;
  condition_2: boolean;
  condition_3: boolean;
  admissible: boolean;
  real_forms: string[];
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  satake: GoldenRecord[];
  satake_examples: GoldenExample[];
  types: Record<string, unknown>;
};
const record = (type: string, form: string): GoldenRecord => {
  const hits = golden.satake.filter((r) => r.dynkin_type === type && r.real_form === form);
  if (hits.length !== 1) throw new Error(`${hits.length} records for ${type} ${form}`);
  return hits[0]!;
};
const example = (type: string, black: number[], tau: number[]): GoldenExample => {
  const hits = golden.satake_examples.filter((e) => e.type === type && e.black_nodes.join() === black.join() && e.tau.join() === tau.join());
  if (hits.length !== 1) throw new Error(`${hits.length} examples for ${type} ${black.join()}`);
  return hits[0]!;
};
const TYPES = Object.keys(golden.types);

const ROUTE = 'tools/satake/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const MINUS = '−';
const word = (b: boolean): string => (b ? 'holds' : 'fails');
const minus = (x: number): string => (x < 0 ? `${MINUS}${-x}` : String(x));
/** The multiplicities text of the tool: each Bourbaki node with its pair, the pair found by orbit. */
const multText = (r: GoldenRecord): string =>
  r.restricted_orbits_in_bourbaki_order!.map((o, k) => {
    const s = r.restricted_simple_orbits.findIndex((x) => x.join() === o.join());
    const [a, b] = r.restricted_simple_multiplicities[s]!;
    return `${k + 1}: (${a}, ${b})`;
  }).join('; ');

/** A value as A-4 reads it: "minus 1". */
const spoken = (v: string): string => (v.startsWith('-') ? `minus ${v.slice(1)}` : v);
/**
 * The end of a step's announcement as A-4 reads it, from the game board's values in label order before and
 * after the step: every population up to four nodes, only the changed cities above four, then the step number.
 */
function populationsTail(before: string[], after: string[], move: number): string {
  if (after.length <= 4) return `Populations now ${after.map(spoken).join(', ')}. Move ${move}.`;
  const parts = after.flatMap((v, k) => (v !== before[k] ? [`city ${k + 1} now ${spoken(v)}`] : []));
  const body = parts.join(', ');
  return `${body.length > 0 ? `${body.charAt(0).toUpperCase()}${body.slice(1)}. ` : ''}Move ${move}.`;
}

const root = (page: Page): Locator => page.locator('[data-tool="satake"]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');
const deco = (page: Page, label: number): Locator => out(page, 'decoration').locator(`button[data-node="${label}"]`);
const gameNodes = (page: Page): Locator => out(page, 'game-board').locator('button[data-node]');
const restrictedNode = (page: Page, label: number): Locator => out(page, 'restricted-board').locator(`button[data-node="${label}"]`);
const tab = (page: Page, id: string): Locator => root(page).locator(`[data-panel-tab="${id}"]`);

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

async function openPanel(page: Page, id: string): Promise<void> {
  await tab(page, id).click();
  await expect(tab(page, id)).toHaveAttribute('aria-selected', 'true');
}

/** The values of a board's buttons in label order. */
async function valuesOf(nodes: Locator): Promise<string[]> {
  const pairs: [number, string][] = [];
  for (const b of await nodes.all()) pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  return pairs.sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
/** The engine's diagram of a pair given in labels (toPositions only, E-7). */
function diagram(type: string, black: number[], tau: number[]): SatakeDiagram {
  const board = B(type);
  const t: number[] = new Array(board.n);
  [...board.labels].sort((a, b) => a - b).forEach((l, k) => {
    t[toPositions(board, [l])[0]!] = toPositions(board, [tau[k]!])[0]!;
  });
  return { board, black: toPositions(board, black), tau: t };
}

test.use({ reducedMotion: 'reduce' });

test('data on su(1,3): real rank, restricted type, multiplicities, dim k, dim p and character as recorded', async ({ page }) => {
  await open(page);
  const r = record('A3', 'su(1,3)');
  await expect(out(page, 'caption')).not.toHaveText('');
  await expect(out(page, 'black-nodes')).toHaveText(r.black_nodes.join('.'));
  await expect(out(page, 'tau')).toHaveText(r.tau.join('.'));
  await expect(tab(page, 'data')).toHaveAttribute('aria-selected', 'true');
  await expect(out(page, 'real-form')).toHaveCount(1);
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', 'su(1,3)');
  await expect(out(page, 'cartan-label')).toHaveText(r.cartan_label);
  await expect(out(page, 'restricted-type')).toHaveText(r.restricted_type_display!);
  await expect(out(page, 'real-rank')).toHaveText(String(r.real_rank));
  await expect(out(page, 'multiplicities')).toHaveText(multText(r));
  // SPEC A.5 worked value: su(1,3) has type BC1 with multiplicities 4 and 1
  await expect(out(page, 'multiplicities')).toHaveText('1: (4, 1)');
  await expect(out(page, 'dim-k')).toHaveText(String(r.dim_k));
  await expect(out(page, 'dim-p')).toHaveText(String(r.dim_p));
  await expect(out(page, 'character')).toHaveText(minus(r.character));
  for (const k of [1, 2, 3]) await expect(out(page, `light-${k}`)).toHaveText('holds');
  await expect(out(page, 'verdict')).toHaveText('admissible');
  await expect(out(page, 'failure-note')).toHaveCount(0);
  // the default root (0, 0, 1) on the game board, its shadow and its coordinate
  expect(await valuesOf(gameNodes(page))).toEqual(['0', '0', '1']);
  await expect(out(page, 'shadow')).toHaveText('(1/2, 1/2, 1/2)');
  await expect(out(page, 'shadow-coordinates')).toHaveText('(1)');
});

test('the lights preset opens on A2 with free decoration and its buttons load the five A3 examples of 2.15 with their verdicts', async ({ page }) => {
  // the state of the lights preset (g=A2&x=&t=1.2, the split form) with its panel; the server render of the
  // preset itself is checked in site/tests/unit/tools/T13.test.ts
  await open(page, 'g=A2&x=&t=1.2');
  await openPanel(page, 'lights');
  await expect(out(page, 'black-nodes')).toHaveText('');
  await expect(out(page, 'tau')).toHaveText('1.2');
  for (const k of [1, 2, 3]) await expect(out(page, `light-${k}`)).toHaveText('holds');
  const buttons = out(page, 'examples').locator('[data-control="example"]');
  await expect(buttons).toHaveCount(6);
  // the rows of the table of SPEC 2.15 on A3 and A2, in its order; verdicts read from satake_examples
  const rows: [string, number[], number[]][] = [
    ['A3', [1, 3], [1, 2, 3]],
    ['A3', [1], [1, 2, 3]],
    ['A3', [1, 2], [1, 2, 3]],
    ['A3', [2], [3, 2, 1]],
    ['A3', [1], [3, 2, 1]],
    ['A2', [1], [1, 2]],
  ];
  for (const [k, [type, black, tau]] of rows.entries()) {
    const e = example(type, black, tau);
    await buttons.nth(k).click();
    await expect(out(page, 'black-nodes')).toHaveText(black.join('.'));
    await expect(out(page, 'tau')).toHaveText(tau.join('.'));
    await expect(out(page, 'light-1')).toHaveText(word(e.condition_1));
    await expect(out(page, 'light-2')).toHaveText(word(e.condition_2));
    await expect(out(page, 'light-3')).toHaveText(word(e.condition_3));
    await expect(out(page, 'verdict')).toHaveText(e.admissible ? 'admissible' : 'not admissible');
    // pushState on an example (7.4): the address bar holds the example's link, bare for the route's default state
    const isDefault = type === 'A3' && black.join() === '2' && tau.join() === '3,2,1';
    expect(new URL(page.url()).searchParams.get('x')).toBe(isDefault ? null : black.join('.'));
    expect(new URL(page.url()).searchParams.get('g')).toBe(isDefault ? null : type);
  }
  await expect(out(page, 'light-3')).toHaveText('fails');
  await page.goBack();
  await expect(out(page, 'black-nodes')).toHaveText('1');
  await expect(out(page, 'tau')).toHaveText('3.2.1');
});

test('D4 with black nodes 3 and 4 shows both names, each with its restricted type', async ({ page }) => {
  await open(page, 'g=D4&x=3.4&t=1.2.3.4');
  const e = example('D4', [3, 4], [1, 2, 3, 4]);
  const names = out(page, 'real-form');
  await expect(names).toHaveCount(e.real_forms.length);
  for (const [k, form] of e.real_forms.entries()) {
    await expect(names.nth(k)).toHaveAttribute('data-name', form);
    await expect(names.nth(k).locator('[data-out="restricted-type"]')).toHaveText(record('D4', form).restricted_type_display!);
  }
  await expect(names.nth(0).locator('[data-out="restricted-type"]')).toHaveText('B2');
  await expect(names.nth(1).locator('[data-out="restricted-type"]')).toHaveText('C2');
});

test('A2 with node 1 black: light 3 fails with minus 1/2 at node 2 and the careful sentence, and no data', async ({ page }) => {
  await open(page, 'g=A2&x=1&t=1.2');
  await expect(out(page, 'light-1')).toHaveText('holds');
  await expect(out(page, 'light-2')).toHaveText('holds');
  await expect(out(page, 'light-3')).toHaveText('fails');
  await expect(out(page, 'reason-3')).toContainText(`${MINUS}1/2`);
  await expect(out(page, 'reason-3')).toContainText('node 2');
  await expect(out(page, 'reason-1')).toHaveCount(0);
  await expect(out(page, 'verdict')).toHaveText('not admissible');
  await expect(out(page, 'failure-note')).toContainText('not the Satake diagram of any real form');
  await expect(out(page, 'failure-note')).toContainText('no involution of the Lie algebra acts as this θ');
  for (const panel of ['data', 'shadows', 'restricted']) {
    await openPanel(page, panel);
    for (const name of ['real-form', 'real-rank', 'dim-k', 'dim-p', 'character', 'multiplicities', 'shadow', 'shadow-coordinates', 'shadow-table', 'shadow-picture', 'restricted-board', 'composite-word']) {
      await expect(out(page, name), `${panel}: ${name}`).toHaveCount(0);
    }
  }
  // theta is defined for the pair and can still be played (2.15): on A2 with node 1 black it is -s_1
  await openPanel(page, 'theta');
  await expect(out(page, 'theta-word')).toHaveText('1');
  // the built page never says that theta is not an involution (M9 beat 4)
  const text = (await root(page).innerText()).toLowerCase();
  expect(text).not.toMatch(/(theta|θ) is not an involution/);
  expect(text).not.toContain('not an involution');
});

test('play-theta on A3 with black nodes 1 and 3 takes (0,1,0) to (−1,−1,−1) in three stages', async ({ page }) => {
  await open(page, 'g=A3&x=1.3&t=1.2.3');
  await openPanel(page, 'theta');
  expect(await valuesOf(gameNodes(page))).toEqual(['0', '1', '0']);
  await expect(out(page, 'theta-word')).toHaveText('1 3');
  await expect(out(page, 'theta-stage')).toHaveText('0');
  const d = diagram('A3', [1, 3], [1, 2, 3]);
  const end = theta(d, [0, 1, 0]).map(String);
  // A.5: after stage 1 (0, 1, 0); during stage 2 (1, 1, 0) then (1, 1, 1); after stage 3 (-1, -1, -1)
  await expect(out(page, 'theta-stages')).toContainText('(1, 1, 0), (1, 1, 1)');
  await control(page, 'theta-next').click();
  await expect(out(page, 'theta-stage')).toHaveText('1');
  expect(await valuesOf(gameNodes(page))).toEqual(['0', '1', '0']);
  await expect(live(page)).toHaveText('Stage 1 of θ. Populations now 0, 1, 0. Move 1.');
  // data-moves on the tool root is the number of steps played (4.0 Test hooks), as History counts them
  await expect(out(page, 'moveCounter')).toHaveText('1');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await control(page, 'theta-next').click();
  await expect(out(page, 'theta-stage')).toHaveText('2');
  expect(await valuesOf(gameNodes(page))).toEqual(['1', '1', '1']);
  await control(page, 'theta-next').click();
  await expect(out(page, 'theta-stage')).toHaveText('3');
  expect(await valuesOf(gameNodes(page))).toEqual(end);
  // SPEC A.5 worked value: theta of su*(4) takes (0, 1, 0) to (-1, -1, -1)
  expect(end).toEqual(['-1', '-1', '-1']);
  await expect(live(page)).toHaveText('Stage 3 of θ. Populations now minus 1, minus 1, minus 1. Move 3.');
  await expect(out(page, 'moveCounter')).toHaveText('3');
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  // "Play θ" runs all three stages again: theta is an involution of the roots
  await control(page, 'theta-play').click();
  expect(await valuesOf(gameNodes(page))).toEqual(['0', '1', '0']);
  await expect(out(page, 'moveCounter')).toHaveText('6');
  await expect(root(page)).toHaveAttribute('data-moves', '6');
  // undo: one step back, and data-moves follows
  await control(page, 'undo').click();
  await expect(out(page, 'moveCounter')).toHaveText('5');
  await expect(root(page)).toHaveAttribute('data-moves', '5');
  // the session history stays out of the link (6.6)
  await page.waitForTimeout(700);
  expect(new URL(page.url()).search).toBe('?g=A3&x=1.3&t=1.2.3');
});

test('E6 with black nodes 2, 3, 4, 5 shows restricted board A2 with multiplicity 8 and a composite move reflects the shadow', async ({ page }) => {
  await open(page, 'g=E6&x=2.3.4.5&t=1.2.3.4.5.6');
  const r = record('E6', 'e6(-26)');
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', 'e6(-26)');
  await expect(out(page, 'multiplicities')).toHaveText(multText(r));
  // SPEC 2.15 worked example: every restricted root of e6(-26) has multiplicity 8 (A2, no doubled root)
  await expect(out(page, 'multiplicities')).toHaveText('1: (8, 0); 2: (8, 0)');
  await expect(out(page, 'dim-k')).toHaveText(String(r.dim_k));
  await expect(out(page, 'character')).toHaveText(minus(r.character));
  await openPanel(page, 'restricted');
  await expect(out(page, 'restricted-name')).toHaveText(r.restricted_board!);
  // SPEC 2.15 worked example: the restricted board of e6(-26) is A2
  await expect(out(page, 'restricted-name')).toHaveText('A2');
  await expect(restrictedNode(page, 1)).toHaveAttribute('aria-label', /^Restricted node 1, orbit 1, multiplicity 8 and 0/);
  await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
  expect(await valuesOf(out(page, 'restricted-board').locator('button[data-node]'))).toEqual(['0', '1']);
  const before = await valuesOf(gameNodes(page));
  await restrictedNode(page, 2).click();
  const k = r.restricted_orbits_in_bourbaki_order![1]!;
  const s = r.restricted_simple_orbits.findIndex((o) => o.join() === k.join());
  await expect(out(page, 'composite-length')).toHaveText(String(r.restricted_reflection_word_lengths[s]));
  // SPEC 2.15 worked example: each composite move of e6(-26) has reduced length 8
  await expect(out(page, 'composite-length')).toHaveText('8');
  const letters = (await out(page, 'composite-word').innerText()).trim().split(/\s+/);
  expect(letters.length).toBe(r.w_X_word.length + r.w_X_word.length + r.restricted_reflection_word_lengths[s]!);
  expect(letters.slice(0, r.w_X_word.length).map(Number)).toEqual(r.w_X_word);
  await expect(out(page, 'shadow-coordinates')).toHaveText(`(0, ${MINUS}1)`);
  expect(await valuesOf(out(page, 'restricted-board').locator('button[data-node]'))).toEqual(['0', '-1']);
  const after = await valuesOf(gameNodes(page));
  expect(after).not.toEqual(before);
  // A-4 above four nodes: only the changed cities, and the step number
  await expect(live(page)).toHaveText(
    `Played the composite move of restricted node 2, ${letters.length} mutations. Shadow coordinates now 0, minus 1. ${populationsTail(before, after, 1)}`,
  );
  expect(populationsTail(before, after, 1)).toMatch(/^City \d+ now .*\. Move 1\.$/);
  await expect(root(page)).toHaveAttribute('data-moves', await out(page, 'moveCounter').innerText());
  // the population reached is a root of E6
  const roots = new Set([...positiveRoots(B('E6')), ...positiveRoots(B('E6')).map((v) => v.map((x) => (x === 0 ? 0 : -x)))].map((v) => v.join(',')));
  expect(roots.has((await valuesOf(gameNodes(page))).join(','))).toBe(true);
});

test('A5 su(1,5): only the arrow 1 to 5 is drawn until the toggle shows tau on black nodes 2 and 4', async ({ page }) => {
  await open(page, 'g=A5&x=2.3.4&t=5.4.3.2.1');
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', 'su(1,5)');
  const drawing = out(page, 'decoration');
  await expect(drawing.locator('[data-arrow]')).toHaveCount(1);
  await expect(drawing.locator('[data-arrow="1-5"]')).toHaveCount(1);
  await expect(drawing.locator('[data-black-arrow]')).toHaveCount(0);
  await expect(out(page, 'arrows')).toHaveText('arrows 1 ↔ 5');
  await control(page, 'toggle').check();
  await expect(drawing.locator('[data-black-arrow="2-4"]')).toHaveCount(1);
  await expect(drawing.locator('[data-black-arrow]')).toHaveCount(1);
  await expect(out(page, 'arrows')).toHaveText('arrows 1 ↔ 5; τ on black nodes 2 ↔ 4');
  // the toggle is not part of the link (6.6)
  await page.waitForTimeout(700);
  expect(new URL(page.url()).search).toBe('?g=A5&x=2.3.4&t=5.4.3.2.1');
});

test('the D4 catalogue lists six records and marks so(2,6) and so*(8) as one real form', async ({ page }) => {
  await open(page, 'g=D4');
  await openPanel(page, 'catalogue');
  const expected = golden.satake.filter((r) => r.dynkin_type === 'D4').map((r) => r.real_form);
  const rows = out(page, 'catalogue-row');
  await expect(rows).toHaveCount(expected.length);
  for (const [k, form] of expected.entries()) await expect(rows.nth(k)).toHaveAttribute('data-name', form);
  await expect(out(page, 'same-form')).toHaveCount(2);
  await expect(root(page).locator('[data-out="catalogue-row"][data-name="so(2,6)"] [data-out="same-form"]')).toHaveText('same real form as so*(8)');
  await expect(root(page).locator('[data-out="catalogue-row"][data-name="so*(8)"] [data-out="same-form"]')).toHaveText('same real form as so(2,6)');
  await root(page).locator('[data-control="catalogue-load"][data-name="so*(8)"]').click();
  await expect(out(page, 'black-nodes')).toHaveText(record('D4', 'so*(8)').black_nodes.join('.'));
  expect(new URL(page.url()).searchParams.get('x')).toBe(record('D4', 'so*(8)').black_nodes.join('.'));
  await openPanel(page, 'data');
  await expect(root(page).locator('[data-out="real-form"][data-name="so*(8)"] [data-out="restricted-type"]')).toHaveText('C2');
  await openPanel(page, 'restricted');
  await expect(out(page, 'restricted-name')).toHaveText('C2');
  await expect(out(page, 'restricted-name-note')).toHaveText('B2 = C2');
  // drawn by the record whose pair is the reader's: Bourbaki node 1 is the orbit listed first in the record
  const order = record('D4', 'so*(8)').restricted_orbits_in_bourbaki_order!;
  await expect(restrictedNode(page, 1)).toHaveAttribute('aria-label', new RegExp(`^Restricted node 1, orbit ${order[0]!.join(' and ')},`));
});

test('shadows on su(1,2): the picture shows lambda with multiplicity 2 and 2 lambda with multiplicity 1, and the table matches A.5', async ({ page }) => {
  await open(page, 'g=A2&x=&t=2.1');
  await openPanel(page, 'shadows');
  const pic = out(page, 'shadow-picture');
  await expect(pic.locator('[data-point]')).toHaveCount(4);
  for (const [c, m, dbl] of [['1', '2', 'false'], ['2', '1', 'true'], ['-1', '2', 'false'], ['-2', '1', 'true']] as const) {
    await expect(pic.locator(`[data-point="${c}"]`)).toHaveAttribute('data-mult', m);
    await expect(pic.locator(`[data-point="${c}"]`)).toHaveAttribute('data-double', dbl);
  }
  // the chosen root (0, 1) has the shadow (1/2, 1/2), coordinate 1: that point is framed
  await expect(pic.locator('[data-chosen="true"]')).toHaveAttribute('data-point', '1');
  await expect(out(page, 'shadow')).toHaveText('(1/2, 1/2)');
  // A.5
  const rows = out(page, 'shadow-table').locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('th')).toHaveText('(1/2, 1/2)');
  await expect(rows.nth(0).locator('td').nth(0)).toHaveText('2');
  await expect(rows.nth(0).locator('td').nth(1)).toHaveText(`(0, 1) ↦ (${MINUS}1, 0); (1, 0) ↦ (0, ${MINUS}1)`);
  await expect(rows.nth(1).locator('th')).toHaveText('(1, 1)');
  await expect(rows.nth(1).locator('td').nth(0)).toHaveText('1');
  await expect(rows.nth(1).locator('td').nth(1)).toHaveText(`(1, 1) ↦ (${MINUS}1, ${MINUS}1)`);
  await expect(out(page, 'real-rank')).toHaveCount(0);
});

test('a t that is not an involutive symmetry loads the default state with the notice', async ({ page }) => {
  for (const query of ['g=A3&t=2.1.3', 'g=D4&t=3.2.4.1', 'g=pentagon', 'g=A3&x=7']) {
    await open(page, query);
    await expect(out(page, 'notice')).toHaveText(NOTICE);
    await expect(out(page, 'black-nodes')).toHaveText('2');
    await expect(out(page, 'tau')).toHaveText('3.2.1');
    await expect(out(page, 'real-form')).toHaveAttribute('data-name', 'su(1,3)');
  }
});

test('B3 so(2,5) and C3 sp(1,2) show their data', async ({ page }) => {
  for (const [type, form, query] of [['B3', 'so(2,5)', 'g=B3&x=3&t=1.2.3'], ['C3', 'sp(1,2)', 'g=C3&x=1.3&t=1.2.3']] as const) {
    const r = record(type, form);
    await open(page, query);
    await expect(out(page, 'real-form')).toHaveAttribute('data-name', form);
    await expect(out(page, 'restricted-type')).toHaveText(r.restricted_type_display!);
    await expect(out(page, 'multiplicities')).toHaveText(multText(r));
    await expect(out(page, 'dim-k')).toHaveText(String(r.dim_k));
  }
});

test('the compact form of G2 shows real rank 0 and no restricted board', async ({ page }) => {
  await open(page, 'g=G2&x=1.2&t=1.2');
  const r = record('G2', 'g2(-14)');
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', r.real_form);
  await expect(out(page, 'real-rank')).toHaveText('0');
  await expect(out(page, 'multiplicities')).toHaveText('none');
  await expect(out(page, 'shape')).toContainText('compact form');
  await expect(out(page, 'shadow-coordinates')).toHaveCount(0);
  await openPanel(page, 'restricted');
  await expect(out(page, 'restricted-board')).toHaveCount(0);
  await expect(out(page, 'no-restricted-roots')).toHaveCount(1);
  await openPanel(page, 'shadows');
  await expect(out(page, 'shadow-table')).toHaveCount(0);
  await expect(out(page, 'no-restricted-roots')).toHaveCount(1);
});

test('every node button carries data-node, data-board, data-value and data-can-act, and the root carries data-tool and data-moves', async ({ page }) => {
  await open(page, 'g=E6&x=2.3.4.5&t=1.2.3.4.5.6');
  await expect(root(page)).toHaveAttribute('data-tool', 'satake');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await openPanel(page, 'restricted');
  const buttons = root(page).locator('button[data-node]');
  expect(await buttons.count()).toBe(6 + 6 + 2);
  for (const b of await buttons.all()) {
    for (const a of ['data-node', 'data-board', 'data-value']) expect((await b.getAttribute(a)) ?? '', a).not.toBe('');
    expect(['true', 'false']).toContain(await b.getAttribute('data-can-act'));
  }
  for (const b of await gameNodes(page).all()) {
    await expect(b).toHaveAttribute('data-board', 'populations');
    await expect(b).toHaveAttribute('data-can-act', 'false');
  }
  for (const b of await out(page, 'decoration').locator('button[data-node]').all()) {
    await expect(b).toHaveAttribute('data-colour', /^(black|white)$/);
    await expect(b).toHaveAttribute('data-board', 'numbers');
    await expect(b).toHaveAttribute('data-value', (await b.getAttribute('data-colour')) === 'black' ? '1' : '0');
  }
  await expect(deco(page, 2)).toHaveAttribute('data-colour', 'black');
  await expect(deco(page, 1)).toHaveAttribute('data-colour', 'white');
  for (const b of await out(page, 'restricted-board').locator('button[data-node]').all()) {
    await expect(b).toHaveAttribute('data-board', 'populations');
    await expect(b).toHaveAttribute('data-can-act', 'true');
  }
  // painting a node: its colour, the lights and the announcement
  await deco(page, 1).click();
  await expect(deco(page, 1)).toHaveAttribute('data-colour', 'black');
  await expect(out(page, 'black-nodes')).toHaveText('1.2.3.4.5');
  await expect(live(page)).toHaveText(/^Node 1 painted black\. Condition 1 (holds|fails), condition 2 (holds|fails), condition 3 (holds|fails)\. (Admissible|Not admissible)\.$/);
});

test('picking E8 fetches the worker and shows the data, and the default route never fetches it', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (/engine\.worker/.test(r.url())) requests.push(r.url());
  });
  await open(page);
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual([]);
  await openPanel(page, 'restricted');
  await expect(out(page, 'restricted-board')).toHaveCount(1);
  expect(requests).toEqual([]);
  await control(page, 'picker').selectOption('E8');
  // the lights at once, the data from the worker
  await expect(out(page, 'verdict')).toHaveText('admissible');
  await openPanel(page, 'data');
  const r = record('E8', 'e8(8)');
  await expect(out(page, 'real-rank')).toHaveText(String(r.real_rank));
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', 'e8(8)');
  expect(requests.length).toBeGreaterThan(0);
  // E7 too, through a link
  await open(page, 'g=E7&x=2.5.7&t=1.2.3.4.5.6.7');
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', 'e7(-5)');
  await expect(out(page, 'dim-k')).toHaveText(String(record('E7', 'e7(-5)').dim_k));
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('without JavaScript the default figure, lights, data, caption and table are present and the controls are disabled', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(root(page)).not.toHaveAttribute('data-hydrated', 'true');
    await expect(out(page, 'caption')).not.toHaveText('');
    await expect(out(page, 'noscript')).toHaveCount(1);
    await expect(out(page, 'decoration').locator('button[data-node]')).toHaveCount(3);
    await expect(gameNodes(page)).toHaveCount(3);
    for (const k of [1, 2, 3]) await expect(out(page, `light-${k}`)).toHaveText('holds');
    await expect(out(page, 'real-form')).toHaveAttribute('data-name', 'su(1,3)');
    await expect(out(page, 'real-rank')).toHaveText(String(record('A3', 'su(1,3)').real_rank));
    await expect(out(page, 'dim-k')).toHaveText(String(record('A3', 'su(1,3)').dim_k));
    await expect(root(page).locator('details table').first()).toHaveCount(1);
    expect(await root(page).locator('details table button').count()).toBeGreaterThanOrEqual(3);
    const controls = root(page).locator('button, input, select');
    for (const c of await controls.all()) await expect(c).toBeDisabled();
    await expect(live(page)).toHaveText('');
  });
});

test('no serious or critical axe violations on /tools/satake in both themes', async ({ page }) => {
  const serious = async (): Promise<string[]> => {
    const axe = await new AxeBuilder({ page }).include('[data-tool="satake"]').analyze();
    return axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  };
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await open(page);
    expect(await serious(), scheme).toEqual([]);
    for (const p of ['lights', 'theta', 'shadows', 'restricted', 'catalogue']) {
      await openPanel(page, p);
      expect(await serious(), `${scheme} ${p}`).toEqual([]);
    }
    await open(page, 'g=A2&x=1&t=1.2');
    expect(await serious(), `${scheme} A2 not admissible`).toEqual([]);
    await open(page, 'g=A2&x=&t=2.1');
    await openPanel(page, 'shadows');
    expect(await serious(), `${scheme} shadow picture`).toEqual([]);
  }
});

test('at 320 pixels the panels stack and the page has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const query of ['', 'g=E8', 'g=D8&x=1.3.5.7&t=1.2.3.4.5.6.7.8', 'g=A8&x=&t=8.7.6.5.4.3.2.1']) {
    await open(page, query);
    for (const p of ['lights', 'data', 'theta', 'shadows', 'restricted', 'catalogue']) {
      await openPanel(page, p);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${query} ${p}`).toBeLessThanOrEqual(0);
    }
    for (const b of await root(page).locator('button[data-node]').all()) {
      const r = (await b.boundingBox())!;
      expect(r.width).toBeGreaterThanOrEqual(24);
      expect(r.height).toBeGreaterThanOrEqual(24);
    }
    // the decoration copy sits directly above the game board, node over node (6.3)
    const top = (await deco(page, 1).boundingBox())!;
    const below = (await gameNodes(page).first().boundingBox())!;
    expect(Math.abs(top.x - below.x)).toBeLessThan(1.5);
    expect(below.y).toBeGreaterThan(top.y);
  }
});

test('the embed route accepts the same keys', async ({ page }) => {
  await page.goto('embed/satake/?g=E6&x=2.3.4.5&t=1.2.3.4.5.6');
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', 'e6(-26)');
  await expect(out(page, 'notice')).toHaveCount(0);
  await expect(out(page, 'black-nodes')).toHaveText('2.3.4.5');
});

test('on each of the 32 boards the split form shows complete data and no text says not of finite type or stopped after', async ({ page }) => {
  for (const type of TYPES) {
    // a link with x empty and t the identity: the split form, on the default board A3 too (6.6: a key that is
    // absent keeps the configured value)
    const n = B(type).n;
    await open(page, `g=${type}&x=&t=${Array.from({ length: n }, (_, k) => k + 1).join('.')}`);
    await expect(out(page, 'real-rank'), type).toHaveText(String(n));
    await expect(out(page, 'data-pending'), type).toHaveCount(0);
    const text = await root(page).innerText();
    expect(text, type).not.toMatch(/not of finite type|stopped after|still running after/i);
  }
});

test('Copy link, Download data, Export SVG and Export PNG export the current diagram', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await open(page, 'g=D4&x=3.4&t=1.2.3.4');
    await control(page, 'copyLink').click();
    await expect(live(page)).toHaveText('Link copied.');
    const link = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect([...link.searchParams.keys()].sort()).toEqual(['g', 't', 'x', 'z']);
    expect(link.searchParams.get('g')).toBe('D4');
    expect(link.searchParams.get('x')).toBe('3.4');
    expect(link.searchParams.get('t')).toBe('1.2.3.4');
    const [dl] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
    const doc = JSON.parse(readFileSync((await dl.path())!, 'utf8'));
    expect(doc.state).toEqual({ schema: 1, tool: 'satake', board: 'D4', black: [3, 4], tau: [1, 2, 3, 4] });
    expect(doc.derived.admissibility.admissible).toBe(true);
    expect(doc.derived.records.map((x: { real_form: string }) => x.real_form)).toEqual(example('D4', [3, 4], [1, 2, 3, 4]).real_forms);
    expect(doc.derived.records[0].black_nodes).toEqual([3, 4]);
    expect(doc.derived.records[0].dim_k).toBe(record('D4', 'so(2,6)').dim_k);
    expect(doc.derived.shadows.length).toBeGreaterThan(0);
    for (const kind of ['svg', 'png'] as const) {
      const [d] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-tool="satake"] [data-export="${kind}"]`).click()]);
      expect(readFileSync((await d.path())!).length, kind).toBeGreaterThan(200);
    }
  } finally {
    await context.close();
  }
});

test('catalogue export gives the three LaTeX forms of 6.7', async ({ page }) => {
  for (const [type, form, latex] of [
    ['E6', 'e6(-14)', '\\dynkin[involutions={16}] E{oo***o}'],
    ['E7', 'e7(-5)', '\\dynkin E{o*oo*o*}'],
    ['A5', 'su(2,4)', '\\dynkin[involutions={15;24}] A{oo*oo}'],
  ] as const) {
    await open(page, `g=${type}`);
    await openPanel(page, 'catalogue');
    await root(page).locator(`[data-control="catalogue-load"][data-name="${form}"]`).click();
    await expect(out(page, 'black-nodes')).toHaveText(record(type, form).black_nodes.join('.'));
    const [dl] = await Promise.all([page.waitForEvent('download'), control(page, 'latex').click()]);
    const text = readFileSync((await dl.path())!, 'utf8');
    expect(text.split('\n')[2], form).toBe(latex);
  }
});

test('theta, undo and the root picker: the link holds g, x and t only, never the session history', async ({ page }) => {
  await open(page, 'g=A3&x=2&t=3.2.1');
  await openPanel(page, 'theta');
  await control(page, 'theta-play').click();
  await expect(out(page, 'theta-stage')).toHaveText('3');
  // A.5: su(1,3) takes (0, 0, 1) to (-1, -1, 0)
  const d = diagram('A3', [2], [3, 2, 1]);
  expect(await valuesOf(gameNodes(page))).toEqual(theta(d, [0, 0, 1]).map(String));
  expect(await valuesOf(gameNodes(page))).toEqual(['-1', '-1', '0']);
  await page.waitForTimeout(700);
  expect(new URL(page.url()).search).toBe('?g=A3&x=2&t=3.2.1');
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  await control(page, 'undo').click();
  await expect(out(page, 'theta-stage')).toHaveText('2');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(live(page)).toHaveText('Undid move 3. Populations now 1, 1, 0.');
  await control(page, 'root').selectOption('1,0,0');
  expect(await valuesOf(gameNodes(page))).toEqual(['1', '0', '0']);
  await expect(out(page, 'moveCounter')).toHaveText('0');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(live(page)).toHaveText('Root chosen. Populations now 1, 0, 0. Move 0.');
  // the data come from satake on the reader's own pair, and the pair is admissible
  expect(satake(d).dim_k).toBe(record('A3', 'su(1,3)').dim_k);
  expect(admissibility(d).admissible).toBe(true);
});

// ---------------------------------------------------------------------------------------------
// The repair after review (MERGE rulings on P6-A3, build-plan/reports/orchestrator/phase6/P6-A3-review.json)
// ---------------------------------------------------------------------------------------------

/** WCAG relative luminance of a computed colour "rgb(r, g, b)". */
function luminance(rgb: string): number {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

test('black nodes are filled and white nodes hollow in both themes, a black node against a white node at least 3 to 1 (A-5, A-6)', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    // A3 with black node 2 (the default) and E6 with black nodes 2 to 5
    for (const [query, blackLabels, whiteLabels] of [['', [2], [1, 3]], ['g=E6&x=2.3.4.5&t=1.2.3.4.5.6', [2, 3, 4, 5], [1, 6]]] as const) {
      await open(page, query);
      const fill = (label: number): Promise<string> => out(page, 'decoration').locator(`[data-colour-disc="${label}"]`).evaluate((c) => getComputedStyle(c).fill);
      const pageColour = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      for (const b of blackLabels) {
        await expect(deco(page, b)).toHaveAttribute('data-colour', 'black');
        for (const w of whiteLabels) {
          await expect(deco(page, w)).toHaveAttribute('data-colour', 'white');
          expect(contrast(await fill(b), await fill(w)), `${scheme} ${query} black ${b} against white ${w}`).toBeGreaterThanOrEqual(3);
        }
        // filled: the black node stands out from the page as well
        expect(contrast(await fill(b), pageColour), `${scheme} ${query} black ${b} against the page`).toBeGreaterThanOrEqual(3);
      }
      // hollow: a white node is filled with the page colour
      for (const w of whiteLabels) expect(contrast(await fill(w), pageColour), `${scheme} ${query} white ${w}`).toBeLessThan(1.1);
    }
  }
});

test('on a board above four nodes a stage of θ, a reset and a root read only the changed cities and the step number (A-4)', async ({ page }) => {
  await open(page, 'g=E6&x=2.3.4.5&t=1.2.3.4.5.6');
  await openPanel(page, 'theta');
  const v0 = await valuesOf(gameNodes(page));
  await control(page, 'theta-next').click();
  await expect(out(page, 'theta-stage')).toHaveText('1');
  const v1 = await valuesOf(gameNodes(page));
  await expect(live(page)).toHaveText(`Stage 1 of θ. ${populationsTail(v0, v1, 1)}`);
  await control(page, 'theta-next').click();
  await expect(out(page, 'theta-stage')).toHaveText('2');
  const v2 = await valuesOf(gameNodes(page));
  expect(v2).not.toEqual(v1);
  await expect(live(page)).toHaveText(`Stage 2 of θ. ${populationsTail(v1, v2, 2)}`);
  await expect(live(page)).not.toContainText('Populations now');
  await expect(root(page)).toHaveAttribute('data-moves', await out(page, 'moveCounter').innerText());
  await control(page, 'reset').click();
  await expect(out(page, 'moveCounter')).toHaveText('0');
  await expect(live(page)).toHaveText(`Reset. ${populationsTail(v2, v0, 0)}`);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await control(page, 'root').selectOption({ index: 0 });
  const vr = await valuesOf(gameNodes(page));
  await expect(live(page)).toHaveText(`Root chosen. ${populationsTail(v0, vr, 0)}`);
});

test('a worker that fails ends the wait with a sentence that the data could not be computed, and the next change asks again', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const WORKER = /engine\.worker[^/]*\.js/;
  await page.route(WORKER, (route) => route.fulfill({ status: 404, body: 'not found' }));
  await open(page);
  await control(page, 'picker').selectOption('E8');
  await expect(out(page, 'verdict')).toHaveText('admissible');
  await expect(out(page, 'data-error')).toHaveText(/^The data could not be computed \(.+\)\. The next change of the decoration or the board asks for them again\.$/);
  await expect(out(page, 'data-pending')).toHaveCount(0);
  await expect(out(page, 'real-form')).toHaveCount(0);
  await expect(out(page, 'caption')).toContainText('but the data could not be computed');
  for (const p of ['shadows', 'restricted']) {
    await openPanel(page, p);
    await expect(out(page, 'data-error'), p).toHaveCount(1);
    await expect(out(page, 'data-pending'), p).toHaveCount(0);
  }
  await openPanel(page, 'data');
  // the failure is handled: no unhandled rejection
  expect(errors).toEqual([]);
  // the next change asks again: the sentence belongs to E8, and E7 waits for its own data
  await page.unroute(WORKER);
  await control(page, 'picker').selectOption('E7');
  await expect(out(page, 'verdict')).toHaveText('admissible');
  await expect(out(page, 'data-error')).toHaveCount(0);
  await expect(out(page, 'data-pending').or(out(page, 'real-form'))).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('an instance configured on E7 shows the data written into the island at build time and fetches no worker before the first interaction (E-9)', async ({ page, baseURL }) => {
  // The embed page with only its island's properties changed to { board: 'E7' } (as the review's probe), and the
  // element an E7 instance's server render writes into the island (load.ts islandScript; site/tests/unit/tools/
  // T13.test.ts checks that the server render writes exactly this element).
  const html = await (await page.request.get(`${baseURL}embed/satake/`)).text();
  const props = `props="{&quot;id&quot;:[0,&quot;&quot;],&quot;preset&quot;:[0,&quot;default&quot;],&quot;board&quot;:[0,&quot;E7&quot;]}"`;
  const e7Props = html.replace(/props="\{&quot;id&quot;[^"]*"/, props);
  expect(e7Props).not.toBe(html);
  const split = { board: 'E7', black: [] as number[], tau: [1, 2, 3, 4, 5, 6, 7] };
  const d = diagramOf(split.board, split.black, split.tau);
  const script = islandScript('', pairKey(split), pairJson(computeNow(d, admissibility(d))!));
  const withData = e7Props.replace(/(<astro-island\b[^>]*>)/, `$1${script}`);
  expect(withData).not.toBe(e7Props);
  await page.route('**/embed/satake/e7-island/', (route) => route.fulfill({ contentType: 'text/html', body: withData }));
  await page.route('**/embed/satake/e7-no-data/', (route) => route.fulfill({ contentType: 'text/html', body: e7Props }));
  const workers: string[] = [];
  page.on('request', (r) => {
    if (/engine\.worker/.test(r.url())) workers.push(r.url());
  });
  const splitRecord = golden.satake.find((r) => r.dynkin_type === 'E7' && r.black_nodes.length === 0 && r.tau.every((t, k) => t === k + 1))!;

  await page.goto('embed/satake/e7-island/');
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(out(page, 'tau')).toHaveText(split.tau.join('.'));
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', splitRecord.real_form);
  await expect(out(page, 'real-rank')).toHaveText(String(splitRecord.real_rank));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await expect(out(page, 'data-pending')).toHaveCount(0);
  expect(workers).toEqual([]);
  // the first interaction may ask the worker: picking E8
  await control(page, 'picker').selectOption('E8');
  await expect(out(page, 'real-form')).toHaveAttribute('data-name', record('E8', 'e8(8)').real_form);
  expect(workers.length).toBeGreaterThan(0);

  // control: without the element in the island the same instance needs the worker at once
  workers.length = 0;
  await page.goto('embed/satake/e7-no-data/');
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect.poll(() => workers.length, { timeout: 15000 }).toBeGreaterThan(0);
});

test('the catalogue row headers have text (axe empty-table-header), with the typeset names, in both themes', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const query of ['g=E6', 'g=D4']) {
      await open(page, query);
      await openPanel(page, 'catalogue');
      // the typeset names load on the first change (t13/names.ts): wait for KaTeX's markup in the row headers
      await expect(out(page, 'catalogue-row').first().locator('th .katex')).toHaveCount(1);
      const axe = await new AxeBuilder({ page }).withRules(['empty-table-header', 'th-has-data-cells']).include('[data-tool="satake"]').analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), `${scheme} ${query}`).toEqual([]);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Regressions of the phase 6 red-team round (RT-FIX P6, cluster t13)
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // Adopted from the RT-07 lens (site/tests/e2e/redteam-RT-07-p6-link-size.spec.ts, attacks 1, 30 and 35): the
  // JavaScript /tools/satake/ fetches before the reader's first interaction when it is opened from a link that
  // the site itself writes. SPEC 7.6: the budget of a route is the gzip size of "all JavaScript the route fetches
  // before the reader's first interaction", 90 kB for "each tool alone, on /tools/<id>"; SPEC 6.6: "On a tool's
  // own route (/tools/..., /embed/...) the keys are bare", so a link is the same route. decisions/P6-A3.md: the
  // typeset names (t13/satakeNames.ts, about 5 kB gzipped) load only after the reader's first change. Measured as
  // npm run size measures a route (scripts/size.mjs: 360 by 800, network idle, then quiet; gzip level 9 of the
  // files from the built directory), with 3 s with no request as the settle. npm run size opens bare routes only.
  const SITE_DIR = resolve(import.meta.dirname, '../..');
  const dist = resolve(SITE_DIR, outDirFrom(process.env));
  const { base } = siteAndBase(process.env);
  const LIMIT = 90000; // SPEC 7.6, a tool alone; kB = 1000 bytes (DECISIONS.md, P0-A6)

  async function scriptsBeforeInteraction(browser: Browser, baseURL: string, path: string): Promise<{ sum: number; files: string[] }> {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, baseURL });
    const page = await ctx.newPage();
    const urls = new Set<string>();
    let last = Date.now();
    ctx.on('request', (r) => {
      last = Date.now();
      const u = new URL(r.url());
      if (r.resourceType() === 'script' || /\.m?js$/.test(u.pathname)) urls.add(r.url());
    });
    await page.goto(path, { waitUntil: 'networkidle' });
    const t0 = Date.now();
    while (Date.now() - last < 3000 && Date.now() - t0 < 15000) await page.waitForTimeout(100);
    await ctx.close();
    let sum = 0;
    const files: string[] = [];
    for (const url of urls) {
      const p = decodeURIComponent(new URL(url).pathname);
      const file = join(dist, p.slice(base.length));
      expect(existsSync(file), `${url} has a file in ${dist}`).toBe(true);
      const gz = gzipSync(readFileSync(file), { level: 9 }).length;
      sum += gz;
      files.push(`${p.replace(/^.*\//, '')} ${gz}`);
    }
    return { sum, files: files.sort() };
  }

  // Links of the Atlas pages (atlas/<T>/ "Open this real form in the Satake Studio"), as the built HTML writes them.
  const LINKS = [
    'tools/satake/?z=1&g=A3&x=1.3&t=1.2.3', // atlas/A3/, su*(4)
    'tools/satake/?z=1&g=D8&x=1.3.5.7&t=1.2.3.4.5.6.7.8', // atlas/D8/
    'tools/satake/?z=1&g=E6&x=2.3.4.5&t=1.2.3.4.5.6', // atlas/E6/, e6(-26)
  ];

  // regression: P6-RT-07-01
  test('the default state of /tools/satake/ is within 90 kB (control)', async ({ browser, baseURL }) => {
    test.setTimeout(120000);
    const r = await scriptsBeforeInteraction(browser, baseURL!, 'tools/satake/');
    console.info(`/tools/satake/ default: ${r.sum} B before interaction (${r.files.length} scripts)`);
    expect(r.sum).toBeLessThanOrEqual(LIMIT);
  });

  for (const link of LINKS) {
    // regression: P6-RT-07-01
    test(`/${link} (a link the Atlas writes) fetches at most 90 kB before the first interaction`, async ({ browser, baseURL }) => {
      test.setTimeout(120000);
      const def = await scriptsBeforeInteraction(browser, baseURL!, 'tools/satake/');
      const r = await scriptsBeforeInteraction(browser, baseURL!, link);
      const extra = r.files.filter((f) => !def.files.includes(f));
      console.info(`/${link}: ${r.sum} B before interaction (default ${def.sum} B); scripts beyond the default: ${extra.join(', ') || 'none'}`);
      expect(r.sum, `scripts beyond the default state: ${extra.join(', ')}`).toBeLessThanOrEqual(LIMIT);
    });
  }

  // Adopted from the RT-10 lens (site/tests/e2e/redteam-RT-10-p6-t13-hooks.spec.ts), attack 9 (SPEC 4.0 Test
  // hooks: "Every node button carries data-node (its label), data-board (populations or numbers, which matters in
  // the linked view), data-value (the value shown, as decimal text, or as p/q for a fraction) and data-can-act
  // (true or false)"): every node button of /tools/satake/ with the restricted panel open (E6, black nodes 2 to
  // 5), the paint buttons, the game board and the restricted board, where the shadows play a mutation game
  // (SPEC 2.15). The colour of a paint button stays readable in data-colour.
  // regression: P6-RT-10-05
  test('RT-10 p6: every node button of T13 carries the hooks of 4.0 with legal values', async ({ page }) => {
    await page.goto('tools/satake/?z=1&g=E6&x=2.3.4.5&t=1.2.3.4.5.6');
    const root = page.locator('[data-tool="satake"]');
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    await root.locator('[data-panel-tab="restricted"]').click();
    await expect(root.locator('[data-out="restricted-board"] button[data-node]')).toHaveCount(2);
    const hooks = await root.locator('button[data-node]').evaluateAll((bs) =>
      bs.map((b) => ({ node: b.getAttribute('data-node'), board: b.getAttribute('data-board'), value: b.getAttribute('data-value'), canAct: b.getAttribute('data-can-act') })),
    );
    const bad = hooks.filter((h) => !['populations', 'numbers'].includes(h.board ?? '') || !/^[-−]?\d+(\/\d+)?$/.test(h.value ?? '') || !['true', 'false'].includes(h.canAct ?? ''));
    expect(bad, `${hooks.length} node buttons; outside 4.0: ${[...new Set(bad.map((h) => `data-board="${h.board}" data-value="${h.value}"`))].join(', ')}`).toEqual([]);
  });

  // Adopted from the RT-05 lens (site/tests/e2e/redteam-RT-05-p6-t13-table-minus.spec.ts), attacks 30 and 33
  // (SPEC 6.3 "The value is the signed integer, set in tabular figures, with a true minus sign"; 7.5 A-10 "every
  // tool has a 'show as table' view that presents the same state as an HTML table"): the Population column of the
  // table view writes a negative population as the board draws it, with U+2212. Read through the hooks: the
  // drawn numerals (data-numeral) and the Population cells (data-table-population).
  // regression: P6-RT-05-03
  test('T13 table view after Play θ on su*(4): the Population column uses the true minus sign of 6.3', async ({ page }) => {
    await page.goto('tools/satake/?g=A3&x=1.3&t=1.2.3');
    const root = page.locator('[data-tool="satake"]');
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    await root.locator('[data-panel-tab="theta"]').focus();
    await page.keyboard.press('Enter');
    await root.locator('[data-control="theta-play"]').focus();
    await page.keyboard.press('Enter');
    await expect(root.locator('[data-out="moveCounter"]')).toHaveText('3');
    // the board draws the populations with U+2212
    const drawn = await root.locator('[data-out="game-board"] [data-numeral]').allTextContents();
    expect(drawn).toEqual(['−1', '−1', '−1']);
    await root.locator('details summary').focus();
    await page.keyboard.press('Enter');
    const cells = await root.locator('[data-table-population]').evaluateAll((tds) => tds.map((td) => (td.textContent ?? '').trim()));
    expect(cells, '/tools/satake/?g=A3&x=1.3&t=1.2.3 after Play θ, table view, column Population (the board draws −1, −1, −1)').toEqual(['−1', '−1', '−1']);
  });

  // Adopted from the RT-11 lens (site/tests/e2e/redteam-RT-11-p6-T13-redo-home-end.spec.ts): SPEC 7.5 A-1 "Undo,
  // redo and reset are visible buttons after the board in the tab order; the shortcuts u (undo) and r (redo) work
  // only while focus is inside the board". It fails on the lens's mutant S-T13-redo-noop (redo does nothing).
  // regression: P6-RT-11-01
  test('T13: Redo and the r shortcut replay the undone stages of theta, and say so (A-1, A-4)', async ({ page }) => {
    // su*(4), SPEC A.5: theta takes (0, 1, 0) through (0, 1, 0), (1, 1, 1) to (-1, -1, -1)
    await page.goto('tools/satake/?g=A3&x=1.3&t=1.2.3');
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    await root(page).locator('[data-panel-tab="theta"]').click();
    await expect(root(page).locator('[data-panel-tab="theta"]')).toHaveAttribute('aria-selected', 'true');
    for (let k = 1; k <= 3; k++) {
      await control(page, 'theta-next').click();
      await expect(out(page, 'moveCounter')).toHaveText(String(k));
    }
    await control(page, 'undo').click();
    await control(page, 'undo').click();
    await expect(out(page, 'moveCounter')).toHaveText('1');
    const game = out(page, 'game-board').locator('button[data-node]');
    expect(await valuesOf(game)).toEqual(['0', '1', '0']);
    // the Redo button
    await control(page, 'redo').click();
    await expect(out(page, 'moveCounter')).toHaveText('2');
    expect(await valuesOf(game)).toEqual(['1', '1', '1']);
    await expect(live(page)).toHaveText('Stage 2 of θ. Populations now 1, 1, 1. Move 2.');
    // the r shortcut, with the focus inside the game board
    await game.first().focus();
    await page.keyboard.press('r');
    await expect(out(page, 'moveCounter')).toHaveText('3');
    expect(await valuesOf(game)).toEqual(['-1', '-1', '-1']);
    await expect(live(page)).toHaveText('Stage 3 of θ. Populations now minus 1, minus 1, minus 1. Move 3.');
  });
});
