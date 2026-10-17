import fs from 'node:fs';
const [file, out] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const results = lines.filter((l) => l.type === 'result');
const keep = [];
for (const r of results) {
  const v = r.result ?? r.value ?? r.output;
  const label = r.label ?? r.agentLabel ?? '';
  keep.push({ label, value: v });
  if (v && v.acceptance) {
    console.log(`FIX ${label} ${v.status} ${v.branch} commits=${(v.commits || []).length}`);
    for (const a of v.acceptance) console.log(`   ${a.status}: ${String(a.item).slice(0, 110)}`);
  } else if (v && v.results) {
    console.log(`CONFIRM ${label} ${v.branch}`);
    for (const x of v.results) console.log(`   ${x.findingId} fixed=${x.fixed} test=${x.regressionTestPresent}`);
  } else console.log(`OTHER ${label} keys=${Object.keys(r).join(',')}`);
}
fs.writeFileSync(out, JSON.stringify(keep, null, 1));
