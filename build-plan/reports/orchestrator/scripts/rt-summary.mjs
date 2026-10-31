import { readFileSync, writeFileSync } from 'node:fs';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8')).result;
console.log('lenses:', j.lenses.map(l => `${l.lens} found ${l.found} on ${l.branch}`).join('; '));
console.log(`confirmed ${j.confirmed.length}, dropped ${j.dropped.length}`);
for (const f of j.confirmed) console.log(`C [${f.severity}${f.verification?.reproduce?.severityAdjustment && f.verification.reproduce.severityAdjustment !== 'none' ? ' -> ' + f.verification.reproduce.severityAdjustment : ''}] ${f.id} | ${f.location} | ${f.title}`);
for (const d of j.dropped) console.log(`D [${d.severity}] ${d.id} | ${d.title} | ${d.reason.slice(0, 220)}`);
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(j.confirmed, null, 2));
