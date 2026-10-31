// Typesets the names with a fixed spelling (SPEC.md 7.3) and writes two files to site/src/generated/:
// names.json (phase 0, P0-A3): `names`, the 32 finite type names of reference/golden_data.json, in file order;
// satake-names.json (phase 6, P6-A2; its own file since the repair after review, so that T10, which imports the
// whole of names.json, does not load the catalogue): `realForms` (every real form of the Satake catalogue in the
// plain-text spelling of SPEC.md 6.5, su*(2m) with its other name sl(m,H) under `alt`), `cartanLabels` (Cartan's
// labels) and `restrictedTypes` (every restricted type, display and board of the catalogue, BC_r included), read
// from the key `satake` of reference/golden_data.json in first-appearance order. It also writes the real forms
// again, one file per board, to satake-names/<board>.json (RT-FIX P6-MERGE-T13-01: the Satake Studio fetches only
// the names of the board it shows). Each file carries `katex`, the version that typeset it. The KaTeX call has
// the four options of renderTex in site/src/lib/katex.ts, with the same KaTeX resolved from site/.
// Run from any directory: node scripts/names.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const siteDir = fileURLToPath(new URL('../site/', import.meta.url));
const goldenFile = fileURLToPath(new URL('../reference/golden_data.json', import.meta.url));

/** The installed KaTeX and its version, resolved exactly as the site resolves them. */
function installedKatex() {
  const requireFromSite = createRequire(join(siteDir, 'package.json'));
  const packageJson = join(dirname(dirname(requireFromSite.resolve('katex/dist/katex.min.css'))), 'package.json');
  return { version: JSON.parse(readFileSync(packageJson, 'utf8')).version, katex: requireFromSite('katex') };
}

/**
 * The TeX source of a name. Finite names (one letter, then the rank) give `<letter>_{<rank>}`; the
 * non-reduced restricted types BC followed by a rank (P6-A2) give `BC_{<rank>}`.
 * Any other spelling throws, so that an unported name fails the build loudly.
 * @param {string} name
 * @returns {string}
 */
export function texOfName(name) {
  const finite = /^(BC|[A-G])([1-9][0-9]*)$/.exec(name);
  if (finite) return `${finite[1]}_{${finite[2]}}`;
  throw new Error(`names.mjs: no typeset form for the name "${name}"`);
}

/**
 * The TeX source of a real form from its plain-text data spelling (SPEC.md 6.5; the TeX spellings are the
 * plan's and render as the display names of 6.5): sl(N,R), su*(N), su(p,q), su(N), so(p,q), so(N), so*(N),
 * sp(N,R), sp(p,q), sp(N), and the exceptional forms e6(c), e7(c), e8(c), f4(c), g2(c) with the character c.
 * Any other spelling throws, naming it.
 * @param {string} text
 * @returns {string}
 */
export function texOfRealForm(text) {
  const N = '([1-9][0-9]*)';
  /** @type {[RegExp, (m: RegExpExecArray) => string][]} */
  const rules = [
    [new RegExp(`^(sl|sp)\\(${N},R\\)$`), (m) => `\\mathfrak{${m[1]}}(${m[2]},\\mathbb{R})`],
    [new RegExp(`^(su|so)\\*\\(${N}\\)$`), (m) => `\\mathfrak{${m[1]}}^*(${m[2]})`],
    [new RegExp(`^(su|so|sp)\\(${N},${N}\\)$`), (m) => `\\mathfrak{${m[1]}}(${m[2]},${m[3]})`],
    [new RegExp(`^(su|so|sp)\\(${N}\\)$`), (m) => `\\mathfrak{${m[1]}}(${m[2]})`],
    [/^(e6|e7|e8|f4|g2)\((-?[1-9][0-9]*)\)$/, (m) => `\\mathfrak{${m[1][0]}}_{${m[1][1]}(${m[2]})}`],
  ];
  for (const [pattern, tex] of rules) {
    const m = pattern.exec(text);
    if (m) return tex(m);
  }
  throw new Error(`names.mjs: no typeset form for the real form "${text}"`);
}

/**
 * The other name of a real form, where SPEC.md 6.5 gives one: su*(2m), also shown as sl(m,H). Null otherwise.
 * @param {string} text
 * @returns {{ text: string; tex: string } | null}
 */
export function altOfRealForm(text) {
  const m = /^su\*\(([1-9][0-9]*)\)$/.exec(text);
  if (!m || Number(m[1]) % 2 !== 0) return null;
  const half = Number(m[1]) / 2;
  return { text: `sl(${half},H)`, tex: `\\mathfrak{sl}(${half},\\mathbb{H})` };
}

/**
 * The TeX source of one of Cartan's labels (A I, ..., E IX, F II, G, and compact): the label as text.
 * Any other spelling throws, naming it.
 * @param {string} label
 * @returns {string}
 */
export function texOfCartanLabel(label) {
  if (/^([A-F] (I|II|III|IV|V|VI|VII|VIII|IX)|G|compact)$/.test(label)) return `\\text{${label}}`;
  throw new Error(`names.mjs: no typeset form for the Cartan label "${label}"`);
}

/** The same call as renderTex(tex, false). */
function typeset(katex, tex) {
  return katex.renderToString(tex, { displayMode: false, output: 'htmlAndMathml', throwOnError: true, trust: false });
}

/**
 * The entry of one real form: { text, tex, html }, and for su*(2m) also alt: { text, tex, html }.
 * @param {{ renderToString: Function }} katex
 * @param {string} text
 * @returns {{ text: string; tex: string; html: string; alt?: { text: string; tex: string; html: string } }}
 */
function realFormEntry(katex, text) {
  const tex = texOfRealForm(text);
  const form = { text, tex, html: typeset(katex, tex) };
  const alt = altOfRealForm(text);
  return alt === null ? form : { ...form, alt: { text: alt.text, tex: alt.tex, html: typeset(katex, alt.tex) } };
}

/** The names of the catalogue, in order. Phase 0: the keys of golden.types. */
export function catalogueNames() {
  const golden = JSON.parse(readFileSync(goldenFile, 'utf8'));
  return Object.keys(golden.types);
}

/**
 * The spellings of the Satake catalogue (P6-A2), each list in first-appearance order of the golden key
 * `satake` (read only): the real forms, Cartan's labels, and the non-null values of
 * restricted_type_display, restricted_type and restricted_board, in the order of the fields of a record.
 * @returns {{ realForms: string[]; cartanLabels: string[]; restrictedTypes: string[] }}
 */
function satakeSpellings() {
  const golden = JSON.parse(readFileSync(goldenFile, 'utf8'));
  /** @type {{ real_form: string; cartan_label: string; restricted_type_display: string | null; restricted_type: string | null; restricted_board: string | null }[]} */
  const records = golden.satake;
  const realForms = new Set();
  const cartanLabels = new Set();
  const restrictedTypes = new Set();
  for (const r of records) {
    realForms.add(r.real_form);
    cartanLabels.add(r.cartan_label);
    for (const t of [r.restricted_type_display, r.restricted_type, r.restricted_board]) if (t !== null) restrictedTypes.add(t);
  }
  return { realForms: [...realForms], cartanLabels: [...cartanLabels], restrictedTypes: [...restrictedTypes] };
}

/**
 * Write { katex, names } to outFile (P0-A3's file, unchanged since phase 0): the 32 type names, each
 * { text, tex, html }. T10 imports this whole file (typesetNames.ts), so nothing else goes in it.
 * @param {string} outFile
 * @returns {{ count: number; version: string }}
 */
export function writeNames(outFile) {
  const { version, katex } = installedKatex();
  const names = {};
  for (const name of catalogueNames()) {
    const tex = texOfName(name);
    names[name] = { text: name, tex, html: typeset(katex, tex) };
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ katex: version, names }, null, 2) + '\n');
  return { count: Object.keys(names).length, version };
}

/**
 * Write { katex, realForms, cartanLabels, restrictedTypes } to outFile (P6-A2; satake-names.json, a file of its
 * own since the repair after review, so that a tool importing names.json does not load the catalogue): each
 * section maps a spelling to { text, tex, html }, and a real form su*(2m) also carries alt: { text, tex, html }.
 * @param {string} outFile
 * @returns {{ version: string; realForms: number; cartanLabels: number; restrictedTypes: number }}
 */
export function writeSatakeNames(outFile) {
  const { version, katex } = installedKatex();
  /** @type {(text: string, tex: string) => { text: string; tex: string; html: string }} */
  const entry = (text, tex) => ({ text, tex, html: typeset(katex, tex) });
  const spellings = satakeSpellings();
  /** @type {Record<string, { text: string; tex: string; html: string; alt?: { text: string; tex: string; html: string } }>} */
  const realForms = {};
  for (const text of spellings.realForms) realForms[text] = realFormEntry(katex, text);
  /** @type {Record<string, { text: string; tex: string; html: string }>} */
  const cartanLabels = {};
  for (const text of spellings.cartanLabels) cartanLabels[text] = entry(text, texOfCartanLabel(text));
  /** @type {Record<string, { text: string; tex: string; html: string }>} */
  const restrictedTypes = {};
  for (const text of spellings.restrictedTypes) restrictedTypes[text] = entry(text, texOfName(text));
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ katex: version, realForms, cartanLabels, restrictedTypes }, null, 2) + '\n');
  return {
    version,
    realForms: Object.keys(realForms).length,
    cartanLabels: Object.keys(cartanLabels).length,
    restrictedTypes: Object.keys(restrictedTypes).length,
  };
}

/**
 * The real forms of satake-names.json again, one file per board (RT-FIX P6-MERGE-T13-01): dir/<board>.json holds
 * { katex, realForms } with the entries of the real forms whose records have that dynkin_type in the golden key
 * `satake` (read only), in first-appearance order. The Satake Studio fetches in the browser only the file of the
 * board it shows (site/src/components/tools/t13/names.ts), so that a link state stays within SPEC 7.6's 90 kB.
 * @param {string} dir
 * @returns {{ boards: number; realForms: number }}
 */
export function writeSatakeNamesByBoard(dir) {
  const { version, katex } = installedKatex();
  const golden = JSON.parse(readFileSync(goldenFile, 'utf8'));
  /** @type {Map<string, Set<string>>} */
  const boards = new Map();
  for (const r of /** @type {{ dynkin_type: string; real_form: string }[]} */ (golden.satake)) {
    if (!boards.has(r.dynkin_type)) boards.set(r.dynkin_type, new Set());
    boards.get(r.dynkin_type)?.add(r.real_form);
  }
  mkdirSync(dir, { recursive: true });
  let count = 0;
  for (const [board, forms] of boards) {
    /** @type {Record<string, { text: string; tex: string; html: string; alt?: { text: string; tex: string; html: string } }>} */
    const realForms = {};
    for (const text of forms) realForms[text] = realFormEntry(katex, text);
    count += forms.size;
    writeFileSync(join(dir, `${board}.json`), JSON.stringify({ katex: version, realForms }, null, 2) + '\n');
  }
  return { boards: boards.size, realForms: count };
}

/**
 * The two generated files of this script in one directory: names.json (writeNames) and satake-names.json
 * (writeSatakeNames). The build calls it with site/src/generated, and writeSatakeNamesByBoard with
 * site/src/generated/satake-names.
 * @param {string} dir
 * @returns {{ names: { count: number; version: string }; satake: { version: string; realForms: number; cartanLabels: number; restrictedTypes: number } }}
 */
export function writeGenerated(dir) {
  return { names: writeNames(join(dir, 'names.json')), satake: writeSatakeNames(join(dir, 'satake-names.json')) };
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const { names, satake } = writeGenerated(join(siteDir, 'src', 'generated'));
    const byBoard = writeSatakeNamesByBoard(join(siteDir, 'src', 'generated', 'satake-names'));
    process.stdout.write(
      `names: ${names.count} types (names.json); ${satake.realForms} real forms, ${satake.cartanLabels} Cartan labels, ${satake.restrictedTypes} restricted types (satake-names.json); typeset with katex ${names.version}\n`,
    );
    process.stdout.write(`names: ${byBoard.realForms} real forms in ${byBoard.boards} files, one per board (satake-names/)\n`);
  } catch (error) {
    process.stderr.write(`names: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}\n`);
    process.exit(1);
  }
}
