import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const [outDir, ...files] = process.argv.slice(2);
const seen = new Set(); let ok = 0; const missing = [];
for (const f of files) {
  for (const x of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const branch = String(x.branch || '').split(' ')[0];
    if (!branch || branch.startsWith('claude/')) continue;
    const paths = String(x.reproducer || '').match(/[A-Za-z0-9_./-]+\.(?:test\.ts|spec\.ts|mjs|ts|js|py|json|md)/g) || [];
    for (const p of paths) {
      const key = `${branch}:${p}`; if (seen.has(key)) continue; seen.add(key);
      try {
        const buf = execFileSync('git', ['show', key], { maxBuffer: 1 << 26 });
        const lens = String(x.lens || x.id.slice(3, 8));
        const dest = path.join(outDir, x.id.replace(/-\d+$/, ''), p);
        fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf); ok++;
      } catch { missing.push(`${x.id} ${key}`); }
    }
  }
}
console.log(`copied ${ok}; not found ${missing.length}`); for (const m of missing) console.log('  missing', m);
