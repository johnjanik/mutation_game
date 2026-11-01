// FIX-ci-e2e: prints the browser console of every failed browser test into the CI log.
// Under CI, playwright.config.ts keeps a slim trace (actions and console, no snapshots) of each failed
// test in test-results/<test>/trace.zip. The html report that ci.yml uploads holds the same traces, but
// reading them needs the artifact; this step writes what matters (console messages, page errors and the
// "Failed to load resource" lines) where the job log shows it.
// Usage: node scripts/trace-console.mjs [folder]   (default test-results; exit 0 whatever it finds)
// Node built-ins only: the zip is read through its central directory and inflated with zlib.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const root = process.argv[2] ?? 'test-results';

/** Every trace.zip under dir. */
function traces(dir) {
  let out = [];
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(traces(path));
    else if (name === 'trace.zip') out.push(path);
  }
  return out;
}

/** The entries of a zip whose names pass keep, as [name, text], read through the central directory. */
function zipEntries(buf, keep) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('no end of central directory');
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;
    if (!keep(name)) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    out.push([name, (method === 8 ? inflateRawSync(raw) : raw).toString('utf8')]);
  }
  return out;
}

const found = traces(root);
console.log(`trace-console: ${found.length} trace(s) under ${root}`);
for (const zip of found) {
  console.log(`\n=== ${relative(root, zip)}`);
  let entries;
  try {
    entries = zipEntries(readFileSync(zip), (n) => /(^|-)trace\.trace$/.test(n) && n !== 'test.trace');
  } catch (e) {
    console.log(`  unreadable: ${e.message}`);
    continue;
  }
  let lines = 0;
  for (const [name, text] of entries) {
    let t0;
    for (const line of text.split('\n')) {
      if (!line) continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      if (t0 === undefined && typeof e.startTime === 'number') t0 = e.startTime;
      const time = typeof e.time === 'number' ? e.time : e.startTime;
      const at = typeof time === 'number' && t0 !== undefined ? `${(time - t0).toFixed(0).padStart(6)} ms` : '         ';
      if (e.type === 'before' && e.method === 'goto') console.log(`  [${name}] ${at} goto ${e.params?.url ?? ''}`), lines++;
      else if (e.type === 'console') {
        const where = e.location?.url ? ` (${e.location.url}${e.location.lineNumber ? `:${e.location.lineNumber}` : ''})` : '';
        console.log(`  [${name}] ${at} console.${e.messageType}: ${String(e.text).slice(0, 600)}${where}`);
        lines++;
      } else if (e.type === 'event' && e.method === 'pageError') {
        console.log(`  [${name}] ${at} pageerror: ${JSON.stringify(e.params).slice(0, 600)}`);
        lines++;
      }
    }
  }
  if (lines === 0) console.log('  no navigation, console message or page error recorded');
}
