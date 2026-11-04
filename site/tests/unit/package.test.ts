// scripts/package.mjs: the zip of a release build for a plain file upload (SPEC.md 7.8, serving the
// site from a subdirectory of another domain). The archive is read back through its central
// directory and every entry is inflated and compared with the file it came from.
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inflateRawSync, crc32 } from 'node:zlib';
import { entriesFor, folderFor, problemWith, zip } from '../../../scripts/package.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const temps: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'package-test-'));
  temps.push(d);
  return d;
}
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

interface Entry {
  name: string;
  data: Buffer;
  mode: number;
}

/** The entries of a zip, read through its central directory. */
function readZip(buf: Buffer): Entry[] {
  let eocd = buf.length - 22;
  while (buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out: Entry[] = [];
  for (let k = 0; k < count; k++) {
    expect(buf.readUInt32LE(at)).toBe(0x02014b50);
    const method = buf.readUInt16LE(at + 10);
    const crc = buf.readUInt32LE(at + 16);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const mode = buf.readUInt32LE(at + 38) >>> 16;
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    at += 46 + nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
    expect(buf.readUInt32LE(local)).toBe(0x04034b50);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    if (!name.endsWith('/')) expect(crc32(data), `crc of ${name}`).toBe(crc);
    out.push({ name, data, mode });
  }
  return out;
}

/** A small stand-in for a release build made for the given base. */
function fakeBuild(base: string): string {
  const dist = tempDir();
  writeFileSync(join(dist, 'index.html'), `<!doctype html><link rel="stylesheet" href="${base}_astro/a.css"><p>home</p>`);
  mkdirSync(join(dist, '_astro'));
  writeFileSync(join(dist, '_astro', 'a.css'), 'p { color: black }\n'.repeat(50));
  mkdirSync(join(dist, 'tools', 'board'), { recursive: true });
  writeFileSync(join(dist, 'tools', 'board', 'index.html'), '<p>board</p>');
  return dist;
}

describe('package.mjs', () => {
  it('names the top folder after the base', () => {
    expect(folderFor('/mutation-game/')).toBe('mutation-game');
    expect(folderFor('/a/b/')).toBe('a/b');
    expect(folderFor('/')).toBe('site');
  });

  it('refuses a missing build, a build for another base and a preview build', () => {
    const empty = tempDir();
    expect(problemWith(empty, '/mutation-game/')).toMatch(/does not exist/);
    const other = fakeBuild('/sub/path/');
    expect(problemWith(other, '/mutation-game/')).toMatch(/another BASE_PATH/);
    const preview = fakeBuild('/mutation-game/');
    mkdirSync(join(preview, 'open-items'));
    expect(problemWith(preview, '/mutation-game/')).toMatch(/preview build/);
    expect(problemWith(fakeBuild('/mutation-game/'), '/mutation-game/')).toBeNull();
  });

  it('zips every file under the top folder with the two .htaccess files, byte for byte', () => {
    const dist = fakeBuild('/mutation-game/');
    const entries = readZip(zip(entriesFor(dist, '/mutation-game/'), new Date(2026, 10, 4, 8, 10, 0)));
    const files = entries.filter((e) => !e.name.endsWith('/'));
    expect(files.map((e) => e.name)).toEqual([
      'mutation-game/.htaccess',
      'mutation-game/_astro/.htaccess',
      'mutation-game/_astro/a.css',
      'mutation-game/index.html',
      'mutation-game/tools/board/index.html',
    ]);
    const byName = new Map(entries.map((e) => [e.name, e]));
    expect(byName.get('mutation-game/index.html')!.data.equals(readFileSync(join(dist, 'index.html')))).toBe(true);
    expect(byName.get('mutation-game/_astro/a.css')!.data.equals(readFileSync(join(dist, '_astro', 'a.css')))).toBe(true);
    expect(byName.get('mutation-game/.htaccess')!.data.equals(readFileSync(join(ROOT, 'deploy', 'apache', 'htaccess')))).toBe(true);
    expect(byName.get('mutation-game/_astro/.htaccess')!.data.equals(readFileSync(join(ROOT, 'deploy', 'apache', 'astro.htaccess')))).toBe(true);
    // Folders come first, so that an unpacker creates them before their files.
    const firstFile = entries.findIndex((e) => !e.name.endsWith('/'));
    expect(entries.slice(firstFile).every((e) => !e.name.endsWith('/'))).toBe(true);
    expect(entries.slice(0, firstFile).map((e) => e.name)).toEqual(['mutation-game/', 'mutation-game/_astro/', 'mutation-game/tools/', 'mutation-game/tools/board/']);
    // Readable by the web server once unpacked: 0644 files, 0755 folders.
    for (const e of entries) expect(e.mode, e.name).toBe(e.name.endsWith('/') ? 0o40755 : 0o100644);
  });
});
