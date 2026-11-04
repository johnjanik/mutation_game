// Packages a release build of the site as one zip for a plain file upload to a web host (Apache),
// for an address other than the GitHub Pages one (SPEC.md 7.8: "serving it from a subdirectory
// needs one rebuild with another BASE_PATH").
//
//   SITE_URL=https://practicallyzen.com BASE_PATH=/mutation-game/ npm run package
//
// runs a release build into site/dist-package and then this script, which writes
// reports/package/<folder>-<commit>.zip. The zip holds one top folder named after the base
// (mutation-game/ for /mutation-game/, site/ for /), with deploy/apache/htaccess as its .htaccess
// and deploy/apache/astro.htaccess as _astro/.htaccess. Unpacked in the web root (public_html, for
// example) it serves the site at SITE_URL + BASE_PATH.
//
// The script refuses a build that does not match: SITE_URL must be set, index.html must exist and
// load its assets under the base, and the build must be a release build (a preview build has the
// open-items page, which a release build leaves out). Node built-ins only: entries are deflated
// with zlib and carry Unix permissions (0644 for files, 0755 for folders) and the commit's date.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';
import { given, outDirFrom, siteAndBase } from '../site/src/lib/siteAndBase.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The MS-DOS date and time fields of a zip entry. */
function dosTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * A zip archive of the given entries, in the given order. A name ending in "/" is a folder.
 * @param {{ name: string, data?: Buffer }[]} entries
 * @param {Date} mtime
 * @returns {Buffer}
 */
export function zip(entries, mtime) {
  const { time, date } = dosTime(mtime);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data = Buffer.alloc(0) } of entries) {
    const folder = name.endsWith('/');
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = folder ? data : deflateRawSync(data, { level: 9 });
    const stored = folder || deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = folder ? 0 : crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by Unix, so the permissions below are read
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(folder ? ((0o40755 << 16) | 0x10) >>> 0 : (0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** Every file under dir, as paths relative to dir with "/" separators, sorted. */
function filesUnder(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(relative(dir, path).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** The top folder of the archive for a base: "/mutation-game/" gives "mutation-game", "/" gives "site". */
export function folderFor(base) {
  const inner = base.replace(/^\/+|\/+$/g, '');
  return inner === '' ? 'site' : inner;
}

/**
 * Why the build in dist cannot be packaged for base, or null when it can.
 * @param {string} dist
 * @param {string} base
 * @returns {string | null}
 */
export function problemWith(dist, base) {
  const index = join(dist, 'index.html');
  if (!existsSync(index)) return `${index} does not exist: run the release build first`;
  const html = readFileSync(index, 'utf8');
  if (!html.includes(`"${base}_astro/`)) return `${index} does not load its assets under ${base}: the build was made for another BASE_PATH`;
  if (existsSync(join(dist, 'open-items'))) return `${dist} holds the open-items page, so it is a preview build: build with RELEASE=1`;
  return null;
}

/**
 * The entries of the archive: the folders and files of dist under the top folder, with the two
 * .htaccess files of deploy/apache added.
 * @param {string} dist
 * @param {string} base
 * @returns {{ name: string, data?: Buffer }[]}
 */
export function entriesFor(dist, base) {
  const top = folderFor(base);
  const files = new Map(filesUnder(dist).map((f) => [f, readFileSync(join(dist, f))]));
  files.set('.htaccess', readFileSync(join(ROOT, 'deploy', 'apache', 'htaccess')));
  if (existsSync(join(dist, '_astro'))) files.set('_astro/.htaccess', readFileSync(join(ROOT, 'deploy', 'apache', 'astro.htaccess')));
  const folders = new Set();
  for (const f of files.keys()) {
    const parts = `${top}/${f}`.split('/');
    for (let k = 1; k < parts.length; k++) folders.add(parts.slice(0, k).join('/') + '/');
  }
  return [
    ...[...folders].sort().map((name) => ({ name })),
    ...[...files.keys()].sort().map((f) => ({ name: `${top}/${f}`, data: files.get(f) })),
  ];
}

function main() {
  if (!given(process.env.SITE_URL)) {
    console.error('package: set SITE_URL (and BASE_PATH), for example SITE_URL=https://practicallyzen.com BASE_PATH=/mutation-game/');
    process.exit(1);
  }
  const { site, base } = siteAndBase(process.env);
  const dist = resolve(ROOT, 'site', outDirFrom(process.env));
  const problem = problemWith(dist, base);
  if (problem) {
    console.error(`package: ${problem}`);
    process.exit(1);
  }
  const git = (args) => {
    try {
      return execSync(`git ${args}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return '';
    }
  };
  const commit = git('rev-parse --short HEAD') || 'unknown';
  const seconds = Number(git('log -1 --format=%ct'));
  const mtime = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
  const entries = entriesFor(dist, base);
  const archive = zip(entries, mtime);
  const outDir = join(ROOT, 'reports', 'package');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${folderFor(base)}-${commit}.zip`);
  writeFileSync(out, archive);
  const files = entries.filter((e) => !e.name.endsWith('/')).length;
  console.log(`package: ${relative(ROOT, out)}`);
  console.log(`package: ${files} files, ${archive.length} bytes, sha256 ${createHash('sha256').update(archive).digest('hex')}`);
  const where = base === '/' ? 'upload the contents of its site/ folder to the web root' : `unpack it in the web root, so that ${folderFor(base)}/ sits there`;
  console.log(`package: built for ${site.replace(/\/$/, '')}${base} from commit ${commit}; ${where}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
