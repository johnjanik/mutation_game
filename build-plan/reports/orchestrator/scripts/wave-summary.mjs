import { readFileSync } from 'node:fs';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8')).result;
for (const r of j.results) {
  console.log('=== ' + r.id, 'build:', r.build && r.build.status, r.build && r.build.branch, '| merge:', r.mergeBranch);
  if (r.review) { console.log('review:', r.review.verdict); for (const g of r.review.gaps) console.log('  [' + g.severity + '] ' + g.item + ' :: ' + (g.evidence || '').slice(0, 400) + (g.fix ? ' FIX: ' + g.fix.slice(0, 200) : '')); }
  if (r.repair) { console.log('repair:', r.repair.status, r.repair.branch, JSON.stringify(r.repair.commits)); for (const a of r.repair.acceptance) console.log('  ' + a.status + ': ' + a.item.slice(0, 200)); console.log('  handoff:', r.repair.handoff.slice(0, 900)); }
  if (r.build) {
    console.log('deviations:', JSON.stringify(r.build.deviations).slice(0, 2000));
    console.log('requests:', JSON.stringify(r.build.requests || []).slice(0, 3000));
    console.log('openQ:', JSON.stringify(r.build.openQuestions || []).slice(0, 2000));
    console.log('handoff:', r.build.handoff.slice(0, 1500));
    console.log('acceptance not pass:', JSON.stringify(r.build.acceptance.filter(a => a.status !== 'pass')).slice(0, 2500));
  }
}
