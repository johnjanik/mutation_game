// P6-size: the main-thread table of engineCall (site/src/lib/worker.ts) and its fallback, and the two
// source rules that keep a route's scripts to the engine modules its own code uses (SPEC.md 7.6: a tool
// route carries "the tool's own code with the engine functions only it uses"; 5.1 E-9). worker.ts used to
// spread the whole engine namespace into its table, and Challenge.svelte imported the whole engine
// dynamically; either one put every engine module into one chunk that every route fetched, and
// /tools/rep/ went over its 90 kB when phase 6 added satake.ts and satakeCatalogue.ts. The built
// result is checked by site/tests/e2e/engine-weight.spec.ts and engine-fallback.spec.ts.
//
// The scan of engineCall (repair after review, P6-size-review.json finding 1) reads the client code of
// site/src with the TypeScript compiler: every .ts, .js and .mjs module, the <script> blocks and the markup
// of every .svelte file, and the <script> blocks of every .astro file (their frontmatter and template run
// at build time, in Node). A reference to engineCall is found by its symbol, so an import under another
// name or through a namespace counts. The names of a call are the string literal types of its first
// argument, in whatever quotes, and a computed name gives every literal it can take (T01's fn: playFate,
// play or raisingPlay). A reference that is not a direct call counts as a call by every name the type
// it is given admits (T13's `engineCall as Caller`), and is refused when that type does not limit the
// names. Every name needs a provide in the same file, except the three of NEED_NO_PROVIDE.
import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { NotABoard, boardFromName, toLabels } from '@two-games/engine';
import { __testing, engineCall, provide } from '../../src/lib/worker';
import { positionsOf, type ToolState } from '../../src/lib/state';
import astroConfig, { moduleSideEffects } from '../../astro.config.mjs';

const SITE = resolve(import.meta.dirname, '../..');
const SRC = join(SITE, 'src');
const A3 = boardFromName('A3');
const SCAN_TIMEOUT = 120_000;

/** A path with forward slashes, as the TypeScript compiler names files. */
const posix = (p: string): string => p.split(sep).join('/');

/** A file of site/src as the client build sees it. */
interface Source {
  /** Relative to site/, with forward slashes. */
  file: string;
  /** Code that a client bundle can hold: a module's text, or the <script> blocks of a .svelte or .astro file. */
  script: string;
  /** The markup of a .svelte file, whose expressions run in the browser too; '' for every other file. */
  markup: string;
}

const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;

/** A gap between script blocks: a semicolon, so that two blocks never run together, and its line breaks. */
const gap = (s: string): string => `;${s.replace(/[^\n]/g, '')}`;

/**
 * A file as a Source. Of an .astro file only its <script> blocks reach the client (a JSON block holds no
 * code). The script keeps every block at its own lines, so that a problem names the line of the file.
 */
function toSource(file: string, text: string): Source {
  if (!file.endsWith('.svelte') && !file.endsWith('.astro')) return { file, script: text, markup: '' };
  let script = '';
  let last = 0;
  for (const m of text.matchAll(SCRIPT_BLOCK)) {
    const start = m.index + m[0].indexOf('>') + 1;
    const body = /\btype\s*=\s*["']application\/(ld\+)?json["']/.test(m[1]!) ? gap(m[2]!) : m[2]!;
    script += gap(text.slice(last, start)) + body;
    last = start + m[2]!.length;
  }
  script += gap(text.slice(last));
  const markup = file.endsWith('.svelte')
    ? text.replace(SCRIPT_BLOCK, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '')
    : '';
  return { file, script, markup };
}

/** Every source file under site/src that the client build can bundle. */
function sources(): Source[] {
  const out: Source[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|svelte|js|mjs|astro)$/.test(name)) out.push(toSource(posix(relative(SITE, p)), readFileSync(p, 'utf8')));
    }
  };
  walk(SRC);
  return out;
}

/** The text without its comment lines (//, /*, * and <!-- lines), so that a sentence about the engine is not an import. */
function code(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*|<!--)/.test(line))
    .join('\n');
}

// ---------------------------------------------------------------------------------------------
// The whole-engine pattern: a namespace import, a dynamic import, `export *` and `export * as`.
// `import type * as` is erased by the compiler and allowed (worker.ts uses it for EngineApi).
// ---------------------------------------------------------------------------------------------

const ENGINE = String.raw`["'\x60](?:@two-games/engine|@engine)["'\x60]`;
const WHOLE_ENGINE = new RegExp(
  [
    String.raw`\bimport\s+(?:[\w$]+\s*,\s*)?\*\s*as\s+[\w$]+\s+from\s*${ENGINE}`,
    String.raw`\bimport\s*\(\s*${ENGINE}\s*[,)]`,
    String.raw`\bexport\s*\*\s*(?:as\s+\S+\s+)?from\s*${ENGINE}`,
  ].join('|'),
);

/** Whether the client code of a source imports the whole engine at run time. */
const importsWholeEngine = (s: Source): boolean => WHOLE_ENGINE.test(code(`${s.script}\n${s.markup}`));

// ---------------------------------------------------------------------------------------------
// The scan of engineCall and provide, with the TypeScript checker.
// ---------------------------------------------------------------------------------------------

/** Names an engineCall needs no provide for: worker.ts holds positionsOf and firstForbiddenMove, and E-9 runs playFate only in the worker (ALWAYS_IN_WORKER). */
const NEED_NO_PROVIDE = new Set(['positionsOf', 'firstForbiddenMove', 'playFate']);

/**
 * Names read by hand, for an engineCall whose names the checker cannot read: file, then the text of the
 * argument, then the names. None today; an entry belongs here only where the type of the name is not a
 * union of string literals, with the reason in a comment.
 */
const READ_BY_HAND: Record<string, Record<string, readonly string[]>> = {};

const SVELTE_TYPES = join(dirname(createRequire(join(SITE, 'package.json')).resolve('svelte/package.json')), 'types/index.d.ts');
const WORKER_TS = posix(join(SRC, 'lib/worker.ts'));

interface Scan {
  /** The files with at least one engineCall (a call, or a reference that counts as one). */
  callers: Set<string>;
  /** Each problem begins with the file, relative to site/. */
  problems: string[];
  /** The READ_BY_HAND entries that were needed ("file argument"). */
  byHand: Set<string>;
}

/** A program over the given files (path to text) and worker.ts, with the options of site/tsconfig.json. */
function programOf(files: Map<string, string>): ts.Program {
  const parsed = ts.getParsedCommandLineOfConfigFile(join(SITE, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  if (parsed === undefined) throw new Error('site/tsconfig.json could not be read');
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true, allowJs: true, types: [] };
  const host = ts.createCompilerHost(options, true);
  const disk = { getSourceFile: host.getSourceFile, fileExists: host.fileExists, readFile: host.readFile };
  host.getSourceFile = (name, version, onError, fresh) => {
    const text = files.get(name);
    return text === undefined ? disk.getSourceFile.call(host, name, version, onError, fresh) : ts.createSourceFile(name, text, version, true);
  };
  host.fileExists = (name) => files.has(name) || disk.fileExists.call(host, name);
  host.readFile = (name) => files.get(name) ?? disk.readFile.call(host, name);
  return ts.createProgram([...files.keys(), WORKER_TS, SVELTE_TYPES], options, host);
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

/** Scans every source that mentions engineCall (worker.ts itself aside). */
function scanEngineCalls(list: readonly Source[]): Scan {
  const files = new Map<string, Source>();
  for (const s of list) {
    if (s.file === 'src/lib/worker.ts' || !/engineCall/.test(s.script + s.markup)) continue;
    // a .svelte or .astro file's scripts as a TypeScript file beside it, so that its relative imports resolve
    const path = posix(join(SITE, s.file)) + (/\.(svelte|astro)$/.test(s.file) ? '.scan.ts' : '');
    files.set(path, s);
  }
  const program = programOf(new Map([...files].map(([p, s]) => [p, s.script])));
  const checker = program.getTypeChecker();
  const workerFile = program.getSourceFile(WORKER_TS)!;
  const workerExports = checker.getExportsOfModule(checker.getSymbolAtLocation(workerFile)!);
  const ENGINE_CALL = workerExports.find((s) => s.name === 'engineCall');
  const PROVIDE = workerExports.find((s) => s.name === 'provide');
  if (!ENGINE_CALL || !PROVIDE) throw new Error('worker.ts exports no engineCall or no provide');
  const resolved = (s: ts.Symbol | undefined): ts.Symbol | undefined => (s && s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s);

  /** The string literals a type can be: a union of them, or a type parameter constrained to one; null otherwise. */
  const literals = (t: ts.Type): string[] | null => {
    const c = t.isTypeParameter() ? checker.getBaseConstraintOfType(t) : t;
    if (!c) return null;
    const parts = c.isUnion() ? c.types : [c];
    return parts.every((p) => p.isStringLiteral()) ? parts.map((p) => (p as ts.StringLiteralType).value) : null;
  };
  /** The names the first parameter of a function type admits, over all its call signatures; null when they cannot be read. */
  const firstParameterNames = (t: ts.Type, at: ts.Node): string[] | null => {
    const signatures = t.getCallSignatures();
    if (signatures.length === 0) return null;
    const out = new Set<string>();
    for (const sig of signatures) {
      const first = sig.getParameters()[0];
      const names = first ? literals(checker.getTypeOfSymbolAtLocation(first, at)) : null;
      if (names === null) return null;
      for (const n of names) out.add(n);
    }
    return [...out];
  };
  const ANY_NAME = firstParameterNames(checker.getTypeOfSymbolAtLocation(ENGINE_CALL, workerFile), workerFile);
  if (ANY_NAME === null || ANY_NAME.length < 100) throw new Error(`the names engineCall takes could not be read (${ANY_NAME?.length ?? 'none'})`);
  /** Names that limit nothing (every engine name) count as unreadable. */
  const limited = (names: string[] | null): names is string[] => names !== null && names.length > 0 && names.length < ANY_NAME.length;

  const scan: Scan = { callers: new Set(), problems: [], byHand: new Set() };
  for (const [path, src] of files) {
    const sf = program.getSourceFile(path)!;
    const at = (n: ts.Node): string => `${src.file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
    const problem = (n: ts.Node, what: string): void => {
      scan.problems.push(`${at(n)}: ${what}`);
    };
    const called = new Map<string, string>(); // name to the place of its first call
    const provided = new Set<string>();
    const call = (n: ts.Node, names: readonly string[]): void => {
      scan.callers.add(src.file);
      for (const name of names) if (!called.has(name)) called.set(name, at(n));
    };

    // The local names of engineCall and provide: their own, and any alias an import gives them.
    const callNames = new Set(['engineCall']);
    const provideNames = new Set(['provide']);
    walk(sf, (n) => {
      if (!ts.isImportSpecifier(n)) return;
      const imported = (n.propertyName ?? n.name).text;
      if (imported === 'engineCall') callNames.add(n.name.text);
      if (imported === 'provide') provideNames.add(n.name.text);
    });
    // The markup of a .svelte file is not in the program: an engineCall there cannot be read.
    for (const name of callNames) {
      if (new RegExp(String.raw`(?<![\w$.])${name.replace(/\$/g, '\\$')}(?![\w$])`).test(src.markup)) {
        scan.problems.push(`${src.file}: ${name} (engineCall) in the markup; call it from the <script>, where this scan reads its name`);
      }
    }

    /** The names a direct call can take, from the type of its first argument. */
    const argumentNames = (arg: ts.Expression | undefined, callNode: ts.Node): string[] => {
      if (arg === undefined || ts.isSpreadElement(arg)) {
        problem(callNode, 'engineCall without a name to read');
        return [];
      }
      const t = checker.getTypeAtLocation(arg);
      const names = literals(t);
      if (limited(names)) return names;
      const text = arg.getText(sf);
      const byHand = READ_BY_HAND[src.file]?.[text];
      if (byHand !== undefined) {
        scan.byHand.add(`${src.file} ${text}`);
        return [...byHand];
      }
      problem(arg, `engineCall(${text}, ...): the names it can take cannot be read (type ${checker.typeToString(t)}); name it in quotes, give it a type that is a union of names, or add its names to READ_BY_HAND in this test`);
      return [];
    };

    /** The names a reference that is not a direct call can take: the first parameter of the type it is given. */
    const referenceNames = (e: ts.Expression): string[] => {
      let outer: ts.Expression = e;
      let given: ts.Type | undefined;
      let loose = false;
      for (;;) {
        const p = outer.parent;
        if (ts.isParenthesizedExpression(p) || ts.isSatisfiesExpression(p)) outer = p;
        else if (ts.isAsExpression(p) || ts.isTypeAssertionExpression(p)) {
          given = checker.getTypeFromTypeNode(p.type);
          if (given.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) loose = true;
          outer = p;
        } else break;
      }
      given ??= checker.getContextualType(outer);
      const names = !loose && given !== undefined ? firstParameterNames(given, outer) : null;
      if (limited(names)) return names;
      problem(e, `a reference to engineCall that is not a direct call (${outer.getText(sf).slice(0, 80)}): the names it can take cannot be read from its type; call engineCall('<name>', ...) directly, or give the reference a type whose first parameter is a union of names (as t13/load.ts does with Caller)`);
      return [];
    };

    walk(sf, (n) => {
      if (ts.isExportSpecifier(n) && (n.propertyName ?? n.name).text === 'engineCall') {
        problem(n, 're-exports engineCall; import it from site/src/lib/worker.ts in the module that calls it');
        return;
      }
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === 'engineCall' && !ts.isImportSpecifier(n.parent) && !ts.isExportSpecifier(n.parent)) {
        problem(n, "engineCall named in a string ('engineCall'); call it directly");
        return;
      }
      if (!ts.isIdentifier(n)) return;
      const isCall = callNames.has(n.text);
      const isProvide = provideNames.has(n.text);
      if (!isCall && !isProvide) return;
      const sym = checker.getSymbolAtLocation(n);
      if (ts.isImportSpecifier(n.parent)) {
        if (n.parent.name === n && isCall && (n.parent.propertyName ?? n.parent.name).text === 'engineCall' && resolved(sym) !== ENGINE_CALL) problem(n, 'this import of engineCall does not resolve to site/src/lib/worker.ts');
        return;
      }
      if (ts.isExportSpecifier(n.parent)) return;
      if (sym === undefined && n.text === 'engineCall') {
        problem(n, 'engineCall here does not resolve to site/src/lib/worker.ts');
        return;
      }
      const target = resolved(sym);
      if (target !== ENGINE_CALL && target !== PROVIDE) return; // another binding of the same name
      let p: ts.Node = n.parent;
      while (ts.isQualifiedName(p)) p = p.parent;
      if (ts.isTypeQueryNode(p)) return; // typeof engineCall in a type: erased
      // the expression that holds the function: the name, or a namespace's member (w.engineCall)
      const e: ts.Expression = ts.isPropertyAccessExpression(n.parent) && n.parent.name === n ? n.parent : n;
      const direct = ts.isCallExpression(e.parent) && e.parent.expression === e ? e.parent : null;
      if (target === ENGINE_CALL) {
        call(e, direct ? argumentNames(direct.arguments[0], direct) : referenceNames(e));
        return;
      }
      if (direct === null) return; // a provide that is not called provides nothing; a missing name is then reported
      const arg = direct.arguments[0];
      if (arg === undefined || !ts.isObjectLiteralExpression(arg)) {
        problem(direct, 'provide takes an object literal of the functions by their engine names, so that this scan can read them');
        return;
      }
      for (const prop of arg.properties) {
        if (ts.isShorthandPropertyAssignment(prop)) provided.add(prop.name.text);
        else if ((ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop)) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) provided.add(prop.name.text);
        else problem(prop, `provide({ ${prop.getText(sf)} }) cannot be read; name each function`);
      }
    });

    for (const [name, where] of called) {
      if (!NEED_NO_PROVIDE.has(name) && !provided.has(name)) scan.problems.push(`${where}: engineCall('${name}') without provide({ ${name} }) in the same file`);
    }
  }
  return scan;
}

// ---------------------------------------------------------------------------------------------
// The holes the review found in the first scan (each passed it) and its two controls, as files the
// scan reads beside the real ones. They live under a folder that does not exist on disk.
// ---------------------------------------------------------------------------------------------

const FIXTURE_DIR = 'src/lib/__scan__/';

interface Fixture {
  name: string;
  source: Source;
  /** One pattern per problem the scan must report, in order. */
  problems: RegExp[];
  /** Whether the whole-engine pattern matches it. */
  wholeEngine: boolean;
}

const fixture = (name: string, file: string, text: string, problems: RegExp[], wholeEngine = false): Fixture => ({
  name,
  source: toSource(FIXTURE_DIR + file, text),
  problems,
  wholeEngine,
});

const FIXTURES: Fixture[] = [
  fixture(
    'a name in double quotes (T10 with only orbitGraph provided)',
    'DoubleQuotes.svelte',
    `<script lang="ts">
  import { boardFromName, orbitGraph } from '@two-games/engine';
  import { engineCall, provide } from '../worker';
  provide({ orbitGraph });
  const b = boardFromName('A3');
  void engineCall("wythoffEdges", [b, [1, 0, 0]] as never, { board: b, kind: 'other' });
</script>
<p>A3</p>`,
    [/^src\/lib\/__scan__\/DoubleQuotes\.svelte:6: engineCall\('wythoffEdges'\) without provide/],
  ),
  fixture(
    'a computed name with one of its names provided (T01 with only raisingPlay provided)',
    'ComputedName.svelte',
    `<script lang="ts">
  import { boardFromName, raisingPlay } from '@two-games/engine';
  import { engineCall, provide } from '../worker';
  provide({ raisingPlay });
  declare const call: { fn: 'play' | 'raisingPlay'; vector: readonly number[] };
  declare const legal: boolean;
  const b = boardFromName('A3');
  const fn = legal ? 'playFate' : call.fn;
  void engineCall(fn, [b, call.vector] as never, { board: b, kind: 'play' });
</script>`,
    [/ComputedName\.svelte:9: engineCall\('play'\) without provide/],
  ),
  fixture(
    'engineCall imported under another name, with no provide',
    'aliased.ts',
    `import { boardFromName } from '@two-games/engine';
import { engineCall as run } from '../worker';
const b = boardFromName('A3');
export const order = (): Promise<number> => run('weylOrder', [b], { board: b, kind: 'count', expectedItems: 24 });
`,
    [/aliased\.ts:4: engineCall\('weylOrder'\) without provide/],
  ),
  fixture(
    'an .astro script that imports the engine namespace and calls engineCall',
    'Island.astro',
    `---
const title = 'A3';
---
<p>{title}</p>
<script>
  import * as engine from '@two-games/engine';
  import { engineCall } from '../worker';
  const b = engine.boardFromName('A3');
  void engineCall('weylOrder', [b], { board: b, kind: 'count', expectedItems: 24 });
</script>`,
    [/Island\.astro:9: engineCall\('weylOrder'\) without provide/],
    true,
  ),
  fixture('export * as of the engine', 'reexport.ts', `export * as wholeEngine from '@two-games/engine';\n`, [], true),
  fixture('a dynamic import in backticks', 'dynamic.ts', 'export const load = () => import(`@engine`);\n', [], true),
  fixture(
    "control: a name in single quotes that is not provided (T10 without wythoffEdges)",
    'Dropped.svelte',
    `<script lang="ts">
  import { boardFromName, orbitGraph } from '@two-games/engine';
  import { engineCall, provide } from '../worker';
  provide({ orbitGraph });
  const b = boardFromName('A3');
  void engineCall('orbitGraph', [b] as never, { board: b, kind: 'other' });
  void engineCall('wythoffEdges', [b] as never, { board: b, kind: 'other' });
</script>`,
    [/Dropped\.svelte:7: engineCall\('wythoffEdges'\) without provide/],
  ),
  fixture(
    'control: the same call over two lines',
    'TwoLines.svelte',
    `<script lang="ts">
  import { boardFromName, orbitGraph } from '@two-games/engine';
  import { engineCall, provide } from '../worker';
  provide({ orbitGraph });
  const b = boardFromName('A3');
  void engineCall(
    'wythoffEdges',
    [b] as never,
    { board: b, kind: 'other' },
  );
</script>`,
    [/TwoLines\.svelte:6: engineCall\('wythoffEdges'\) without provide/],
  ),
  fixture(
    'references that are not calls and give no names: passed on, cast to any, a namespace member, a string',
    'references.ts',
    `import * as w from '../worker';
import { engineCall } from '../worker';
export const same = engineCall;
export const loose = engineCall as unknown as (fn: 'weylOrder') => unknown;
export const member = [w.engineCall].length;
export const byString = (w as Record<string, unknown>)['engineCall'];
`,
    [/references\.ts:3: a reference to engineCall that is not a direct call/, /references\.ts:4: a reference/, /references\.ts:5: a reference/, /references\.ts:6: engineCall named in a string/],
  ),
  fixture(
    'a typed reference counts as a call by the names of its type (t13/load.ts), here with one not provided',
    'typedReference.ts',
    `import { restrictedBoard, satake, type SatakeDiagram } from '@two-games/engine';
import { engineCall, provide, type CallHint, type EngineApi } from '../worker';
provide({ satake, restrictedBoard });
type DataFn = 'satake' | 'restrictedBoard' | 'matchCatalogue';
type Caller = <F extends DataFn>(fn: F, args: Parameters<EngineApi[F]>, hint: CallHint) => Promise<Awaited<ReturnType<EngineApi[F]>>>;
export async function data(d: SatakeDiagram, caller: Caller = engineCall as Caller): Promise<unknown> {
  return caller('matchCatalogue', [d], { board: d.board, kind: 'satake' });
}
`,
    [/typedReference\.ts:6: engineCall\('matchCatalogue'\) without provide/],
  ),
  fixture(
    'engineCall in the markup of a .svelte file',
    'Markup.svelte',
    `<script lang="ts">
  import { boardFromName } from '@two-games/engine';
  import { engineCall as run } from '../worker';
  const b = boardFromName('A3');
</script>
<button onclick={() => run('weylOrder', [b], { board: b, kind: 'other' })}>order</button>`,
    [/^src\/lib\/__scan__\/Markup\.svelte: run \(engineCall\) in the markup/],
  ),
  fixture(
    'clean: names in any quotes, an alias, a computed name and a typed reference, all provided',
    'Clean.svelte',
    `<script lang="ts">
  import { boardFromName, orbitGraph, play, raisingPlay, weylOrder, wythoffEdges } from '@two-games/engine';
  import * as w from '../worker';
  import { engineCall, engineCall as run, provide as give, type CallHint, type EngineApi } from '../worker';
  give({ orbitGraph, 'wythoffEdges': wythoffEdges, play, raisingPlay, weylOrder });
  declare const legal: boolean;
  const b = boardFromName('A3');
  const fn = legal ? 'play' : 'raisingPlay';
  type Order = <F extends 'weylOrder'>(fn: F, args: Parameters<EngineApi[F]>, hint: CallHint) => Promise<number>;
  const order: Order = engineCall as Order;
  void engineCall("orbitGraph", [b] as never, { board: b, kind: 'other' });
  void w.engineCall(\`wythoffEdges\`, [b] as never, { board: b, kind: 'other' });
  void run(fn, [b, [1, 0, 0]] as never, { board: b, kind: 'play' });
  void order('weylOrder', [b], { board: b, kind: 'count' });
  void engineCall('playFate', [b] as never, { board: b, kind: 'play' });
  type Typed = typeof engineCall;
</script>
<!-- engineCall in a comment is not a call -->
<p>A3</p>`,
    [],
  ),
];

let scanned: Scan | undefined;
/** One program for the real sources and the fixtures (about 3 s). */
const scanOnce = (): Scan => (scanned ??= scanEngineCalls([...sources(), ...FIXTURES.map((f) => f.source)]));
const real = (problems: string[]): string[] => problems.filter((p) => !p.startsWith(FIXTURE_DIR));

afterEach(() => {
  __testing.reset();
});

describe('the main-thread table of engineCall', () => {
  it('holds positionsOf and firstForbiddenMove without a provide, and what callers provide', () => {
    expect(__testing.provided()).toEqual(expect.arrayContaining(['positionsOf', 'firstForbiddenMove']));
    expect(__testing.provided()).not.toContain('chevalleySerre');
    provide({ chevalleySerre: (() => ({ ok: true })) as never });
    expect(__testing.provided()).toContain('chevalleySerre');
  });

  it('__testing.reset() puts the table back as it was at import, so that no test depends on the order of the tests', async () => {
    expect(__testing.provided()).toEqual(['positionsOf', 'firstForbiddenMove']);
    const a2 = boardFromName('A2');
    const state: ToolState = { schema: 1, tool: 'board', board: 'A2', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1], moves: [1, 2, 1] };
    const hint = { board: a2, kind: 'other' as const };
    let stubbed = 0;
    provide({ chevalleySerre: (() => ({ ok: true })) as never, positionsOf: (() => (stubbed++, [])) as never });
    expect(await engineCall('positionsOf', [state], hint)).toEqual([]);
    expect(stubbed).toBe(1);
    __testing.reset();
    expect(__testing.provided()).toEqual(['positionsOf', 'firstForbiddenMove']);
    expect(await engineCall('positionsOf', [state], hint)).toEqual(positionsOf(state));
    expect(stubbed).toBe(1);
  });

  it('runs a provided function on the main thread without loading the whole engine', async () => {
    let loads = 0;
    __testing.setRuntime({ inNode: () => false, loadEngine: async () => (loads++, {}) });
    const calls: unknown[][] = [];
    provide({ toLabels: ((board: never, ps: never) => (calls.push([board, ps]), toLabels(board, ps))) as never });
    expect(await engineCall('toLabels', [A3, [0, 2]], { board: A3, kind: 'other' })).toEqual([1, 3]);
    expect(calls).toEqual([[A3, [0, 2]]]);
    expect(loads).toBe(0);
    expect(__testing.fallbacks()).toEqual([]);
    expect(__testing.workerCreated()).toBe(false);
  });

  it('a name nobody provided runs from the whole engine and is reported when E-9 keeps it on the main thread', async () => {
    let loads = 0;
    __testing.setRuntime({ inNode: () => false, loadEngine: async () => (loads++, await import('@two-games/engine')) });
    // weylOrder: no module of this test provides it; 'count' with 24 elements runs on the main thread.
    expect(await engineCall('weylOrder', [A3], { board: A3, kind: 'count', expectedItems: 24 })).toBe(24);
    expect(loads).toBe(1);
    expect(__testing.fallbacks()).toEqual(['weylOrder']);
    expect(__testing.workerCreated()).toBe(false);
    // Errors keep their class on this path too.
    await expect(engineCall('boardFromName', ['Q7'], { board: A3, kind: 'other' })).rejects.toBeInstanceOf(NotABoard);
    expect(__testing.fallbacks()).toEqual(['weylOrder', 'boardFromName']);
  });

  it('in Node a call that E-9 sends to the worker runs from the whole engine and is not reported', async () => {
    let loads = 0;
    __testing.setRuntime({ loadEngine: async () => (loads++, await import('@two-games/engine')) });
    // An enumeration without expectedItems goes to the worker in a browser; in Node it runs in-process.
    expect(await engineCall('weylOrder', [A3], { board: A3, kind: 'enumeration' })).toBe(24);
    expect(loads).toBe(1);
    expect(__testing.fallbacks()).toEqual([]);
    expect(__testing.workerCreated()).toBe(false);
  });

  it('a name the engine lacks rejects with a TypeError, as before', async () => {
    __testing.setRuntime({ inNode: () => false });
    await expect(engineCall('noSuchFunction' as never, [] as never, { board: A3, kind: 'other' })).rejects.toBeInstanceOf(TypeError);
  });
});

describe('the sources keep the engine out of shared chunks', () => {
  it('every module that calls engineCall provides the engine functions it calls by name', () => {
    const scan = scanOnce();
    const callers = [...scan.callers].filter((f) => !f.startsWith(FIXTURE_DIR));
    // T01, T04, t09/playOn, T10, T11, T12, T15 and t13/load at least
    expect(callers.length, callers.join(' ')).toBeGreaterThanOrEqual(8);
    expect(callers).toEqual(expect.arrayContaining(['src/components/tools/T01GameBoard.svelte', 'src/components/tools/t13/load.ts']));
    expect(real(scan.problems)).toEqual([]);
  }, SCAN_TIMEOUT);

  it('every READ_BY_HAND entry is still needed', () => {
    const scan = scanOnce();
    const entries = Object.entries(READ_BY_HAND).flatMap(([file, args]) => Object.keys(args).map((a) => `${file} ${a}`));
    expect(entries.filter((e) => !scan.byHand.has(e))).toEqual([]);
  }, SCAN_TIMEOUT);

  for (const f of FIXTURES) {
    it(`the scan reports ${f.name}`, () => {
      const found = scanOnce().problems.filter((p) => p.startsWith(f.source.file));
      expect(found.length, found.join('\n')).toBe(f.problems.length);
      f.problems.forEach((re, k) => expect(found[k]).toMatch(re));
      expect(importsWholeEngine(f.source)).toBe(f.wholeEngine);
    }, SCAN_TIMEOUT);
  }

  it('the whole-engine pattern leaves named imports and type-only imports alone', () => {
    for (const text of [
      "import { satake } from '@two-games/engine';",
      "import type * as Engine from '@two-games/engine';",
      "export type * from '@engine';",
      "export { satake } from '@engine';",
    ]) {
      expect(importsWholeEngine(toSource('x.ts', text)), text).toBe(false);
    }
  });

  it('no client module imports the whole engine at run time, except the worker and the fallback', () => {
    const allowed = new Set(['src/lib/engine.worker.ts', 'src/lib/engineAll.ts']);
    const all = sources();
    const found = all.filter((s) => !allowed.has(s.file) && importsWholeEngine(s)).map(({ file }) => file);
    expect(found).toEqual([]);
    // The two allowed files do, so the pattern is live.
    expect(all.filter((s) => allowed.has(s.file) && importsWholeEngine(s)).map(({ file }) => file).sort()).toEqual([...allowed].sort());
    // The fallback chunk is reached only from worker.ts.
    const importers = all.filter((s) => s.file !== 'src/lib/worker.ts' && /['"`][./@\w]*engineAll['"`]/.test(code(`${s.script}\n${s.markup}`))).map(({ file }) => file);
    expect(importers).toEqual([]);
  });

  it('the build treats the engine modules as free of side effects, and nothing else', () => {
    expect(moduleSideEffects('/home/u/repo/packages/engine/src/satake.ts')).toBe(false);
    expect(moduleSideEffects('C:\\repo\\packages\\engine\\src\\rep.ts')).toBe(false);
    expect(moduleSideEffects('/home/u/repo/site/src/lib/state.ts')).toBe(true);
    expect(moduleSideEffects('/home/u/repo/node_modules/svelte/src/index-client.js')).toBe(true);
    expect(moduleSideEffects('/home/u/repo/site/src/components/board/Board.svelte?svelte&type=style&lang.css')).toBe(true);
    const treeshake = (astroConfig as { vite?: { build?: { rolldownOptions?: { treeshake?: { moduleSideEffects?: unknown } } } } }).vite?.build?.rolldownOptions?.treeshake;
    expect(treeshake?.moduleSideEffects).toBe(moduleSideEffects);
  });
});
