import { readFileSync } from 'node:fs';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8')).result;
for (const c of j.clusters) {
  const f = c.fix, v = c.confirm;
  console.log(`=== ${c.cluster}: fix ${f ? f.status : 'none'} on ${f ? f.branch : '-'}; commits ${f ? f.commits.length : 0}`);
  if (f) for (const a of f.acceptance) console.log(`  fix ${a.status}: ${a.item.slice(0, 150)}`);
  if (v) { for (const r of v.results) console.log(`  confirm ${r.findingId}: fixed=${r.fixed} regression=${r.regressionTestPresent} :: ${r.evidence.slice(0, 220)}`); for (const s of v.sideEffects) console.log(`  SIDE: ${s.slice(0, 400)}`); }
  if (f && f.deviations.length) console.log(`  deviations: ${JSON.stringify(f.deviations).slice(0, 600)}`);
  if (f) console.log(`  handoff: ${f.handoff.slice(0, 700)}`);
}
