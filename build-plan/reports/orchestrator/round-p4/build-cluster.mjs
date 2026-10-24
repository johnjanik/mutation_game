// Usage: node build-cluster.mjs <out.json> <finding id> [<finding id> ...]
// Collects each phase 4 finding from p4-out/RT-NN.json with its lens branch and the two
// verifiers' verdicts (RT-NN-reproduce.json, RT-NN-refute.json, RT-NN-verify.json), and writes
// them as one array for an RT-FIX agent.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'p4-out');
const [out, ...ids] = process.argv.slice(2);
const read = (f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);

const result = [];
for (const id of ids) {
  const lens = /^P4-(RT-\d\d)-/.exec(id)[1];
  const lensOut = read(`${lens}.json`);
  const finding = lensOut.findings.find((f) => f.id === id);
  if (!finding) throw new Error(`no finding ${id}`);
  const verification = {};
  for (const f of [`${lens}-reproduce.json`, `${lens}-refute.json`, `${lens}-verify.json`]) {
    const v = read(f);
    for (const x of v?.verdicts ?? []) if (x.findingId === id) verification[x.mode] = x;
  }
  result.push({ ...finding, lens, branch: String(lensOut.branch).split(/[ (]/)[0], verification });
}
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`${out}: ${result.length} findings; ${result.map((f) => `${f.id}[${Object.keys(f.verification).join('+')}]`).join(' ')}`);
