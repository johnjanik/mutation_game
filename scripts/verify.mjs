#!/usr/bin/env node
// npm run verify (SPEC.md 5.7 "Regenerating the golden data"; 7.7 Oracle row).
// Reruns the Python oracle into a temporary file and fails unless the result is byte for byte
// reference/golden_data.json. Never writes into reference/ (COMMON.md 2): the output path is a
// fresh temporary directory, and the script refuses any output path under reference/.
// Interpreter: process.env.PYTHON when set, else python3. Imports only Node built-ins.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root: the parent of scripts/ (never process.cwd()). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REFERENCE_DIR = join(ROOT, 'reference');
export const ORACLE = join(REFERENCE_DIR, 'verify.py');
export const GOLDEN = join(REFERENCE_DIR, 'golden_data.json');

const SUMMARY = /^(\d+) checks passed, (\d+) failed, ([\d.]+)s; wrote .*$/;

/**
 * The last line of the oracle's output that matches its summary (verify.py, last lines).
 * @param {string} text
 * @returns {{ line: string; passed: number; failed: number; seconds: number } | null}
 */
export function parseSummary(text) {
  let found = null;
  for (const raw of text.split(/\r?\n/)) {
    const m = SUMMARY.exec(raw);
    if (m) found = { line: raw, passed: Number(m[1]), failed: Number(m[2]), seconds: Number(m[3]) };
  }
  return found;
}

/**
 * The FAIL lines and the FAILED: list the oracle printed.
 * @param {string} text
 * @returns {string[]}
 */
export function failureLines(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const line of lines) {
    if (line.startsWith('  FAIL:')) out.push(line);
    else if (line === 'FAILED:') { inList = true; out.push(line); }
    else if (inList && line.startsWith('  - ')) out.push(line);
    else inList = false;
  }
  return out;
}

/**
 * True when `path` lies inside `dir` (or is `dir` itself).
 * @param {string} path
 * @param {string} dir
 */
export function isInside(path, dir) {
  const rel = relative(resolve(dir), resolve(path));
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

/**
 * Throws when the output path is under reference/ (roster trap 4).
 * @param {string} outPath
 * @param {string} [referenceDir]
 */
export function assertOutsideReference(outPath, referenceDir = REFERENCE_DIR) {
  if (isInside(outPath, referenceDir)) {
    throw new Error(`verify: refusing to write ${outPath}: it is under ${referenceDir}, which is read-only`);
  }
}

/**
 * Byte comparison of two files.
 * @param {string} a
 * @param {string} b
 * @returns {{ equal: boolean; sizeA: number; sizeB: number }}
 */
export function compareBytes(a, b) {
  const ba = readFileSync(a);
  const bb = readFileSync(b);
  return { equal: Buffer.compare(ba, bb) === 0, sizeA: ba.length, sizeB: bb.length };
}

// Python keeps integers exact where JSON.parse would round above 2^53, so the parsed comparison
// and the walk for differing paths run in Python.
const PARSED_COMPARE = `
import json, sys
with open(sys.argv[1]) as f: a = json.load(f)
with open(sys.argv[2]) as f: b = json.load(f)
diffs = []
def walk(x, y, path):
    if len(diffs) >= 20: return
    if type(x) != type(y):
        diffs.append(path or '$'); return
    if isinstance(x, dict):
        for k in list(x.keys()) + [k for k in y.keys() if k not in x]:
            if k not in x or k not in y: diffs.append(path + '.' + str(k))
            else: walk(x[k], y[k], path + '.' + str(k))
            if len(diffs) >= 20: return
    elif isinstance(x, list):
        if len(x) != len(y): diffs.append(path + ' (length ' + str(len(x)) + ' against ' + str(len(y)) + ')'); return
        for i, (u, v) in enumerate(zip(x, y)):
            walk(u, v, path + '[' + str(i) + ']')
            if len(diffs) >= 20: return
    elif x != y:
        diffs.append(path or '$')
walk(a, b, '')
print(json.dumps({'equal': a == b, 'paths': diffs}))
`;

/**
 * Parsed comparison of two JSON files, done in Python for exact integers.
 * @param {string} a
 * @param {string} b
 * @param {string} [python]
 * @returns {{ equal: boolean; paths: string[] }}
 */
export function compareParsed(a, b, python = pythonCommand()) {
  const r = spawnSync(python, ['-c', PARSED_COMPARE, a, b], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`verify: parsed comparison failed: ${r.stderr || r.error}`);
  return JSON.parse(r.stdout.trim());
}

/** The interpreter: PYTHON when set and non-empty, else python3. */
export function pythonCommand(env = process.env) {
  return env.PYTHON && env.PYTHON !== '' ? env.PYTHON : 'python3';
}

/**
 * Runs the oracle, streaming its output, and resolves with its exit status and collected stdout.
 * @param {string} python
 * @param {string} outPath
 * @returns {Promise<{ status: number | null; output: string }>}
 */
function runOracle(python, outPath) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(python, ['-u', ORACLE, outPath], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('close', (status) => resolvePromise({ status, output }));
  });
}

async function main() {
  const python = pythonCommand();
  const tmp = mkdtempSync(join(tmpdir(), 'golden-verify-'));
  const out = join(tmp, 'golden_regen.json');
  assertOutsideReference(out);
  console.log(`verify: running ${python} -u reference/verify.py ${out}`);
  const { status, output } = await runOracle(python, out);
  const summary = parseSummary(output);
  if (status !== 0 || !summary || summary.failed !== 0) {
    for (const line of failureLines(output)) console.log(line);
    console.log(`verify: oracle failed (exit status ${status}${summary ? '' : ', no summary line'})`);
    console.log(`verify: output kept at ${out}`);
    process.exit(1);
  }
  console.log(summary.line);
  const bytes = compareBytes(out, GOLDEN);
  if (bytes.equal) {
    console.log(`verify: regenerated file is byte for byte reference/golden_data.json (${bytes.sizeB} bytes)`);
    rmSync(tmp, { recursive: true, force: true });
    process.exit(0);
  }
  const parsed = compareParsed(out, GOLDEN, python);
  console.log(`verify: regenerated file differs from reference/golden_data.json (${bytes.sizeA} bytes against ${bytes.sizeB} bytes); equal as parsed JSON: ${parsed.equal ? 'yes' : 'no'}`);
  if (!parsed.equal) {
    console.log('verify: first differing paths (at most 20):');
    for (const p of parsed.paths) console.log(`  ${p}`);
  }
  console.log(`verify: output kept at ${out}; do not commit it (SPEC.md 5.7)`);
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  statSync(GOLDEN); // fail early, with the path, when the committed file is missing
  main().catch((err) => { console.error(String(err && err.stack ? err.stack : err)); process.exit(1); });
}
