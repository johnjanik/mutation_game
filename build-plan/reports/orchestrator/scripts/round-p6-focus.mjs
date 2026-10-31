// Writes build-plan/reports/orchestrator/round-p6/focus/RT-NN.md: for each lens, its phase 5 round findings
// that were confirmed and fixed (to retest first), with the regression tests of the fix and the lens branch.
import fs from 'node:fs';
const root = new URL('../../../../', import.meta.url).pathname;
const out = `${root}build-plan/reports/orchestrator/round-p5/out`;
const fixdir = `${root}build-plan/reports/orchestrator/round-p5/fixout`;
const tests = {};
for (const f of fs.readdirSync(fixdir).filter((n) => n.startsWith('fix-'))) {
  const r = JSON.parse(fs.readFileSync(`${fixdir}/${f}`, 'utf8'));
  for (const a of r.acceptance ?? r.findings ?? []) {
    const id = /P5-RT-\d\d-\d\d/.exec(`${a.item ?? ''} ${a.finding ?? ''} ${a.id ?? ''}`)?.[0];
    if (id) (tests[id] ??= []).push(`${a.status}: ${String(a.test ?? '').slice(0, 300)} (${f.replace('.json', '')})`);
  }
}
for (let i = 1; i <= 13; i++) {
  const L = `RT-${String(i).padStart(2, '0')}`;
  const o = JSON.parse(fs.readFileSync(`${out}/${L}.json`, 'utf8'));
  const v = {};
  for (const f of [`${L}-reproduce.json`, `${L}-refute.json`]) {
    if (!fs.existsSync(`${out}/${f}`)) continue;
    for (const x of JSON.parse(fs.readFileSync(`${out}/${f}`, 'utf8')).verdicts) (v[x.findingId] ??= {})[x.mode] = x;
  }
  const lines = [`# Phase 5 round findings of ${L} (retest these first)`, '',
    `Each was confirmed in the phase 5 round at 006f50d (gate-G5's first candidate) and fixed before the G5 rerun; the fixes are in the gate commit of this round. The fix reports and confirmations are in build-plan/reports/orchestrator/round-p5/fixout/, the decisions in decisions/RT-FIX-P5-*.md and DECISIONS.md (search the id). The lens branch with the original reproducers is ${String(o.branch).split(/[ (]/)[0]}.`, ''];
  let n = 0;
  for (const f of o.findings ?? []) {
    const r = v[f.id] ?? {};
    const confirmed = r.reproduce?.reproduced === true && r.refute?.refuted === false;
    if (!confirmed) continue;
    n++;
    lines.push(`- ${f.id} (${f.severity}): ${f.title}`, `  location: ${String(f.location).slice(0, 300)}`, `  reproducer: ${f.reproducer}`);
    for (const t of tests[f.id] ?? []) lines.push(`  fix: ${t}`);
  }
  if (n === 0) lines.push('None: this lens had no confirmed finding in the phase 5 round. Attack its list for phases 0 to 6.');
  fs.writeFileSync(`${root}build-plan/reports/orchestrator/round-p6/focus/${L}.md`, lines.join('\n') + '\n');
  console.log(L, n, (o.findings ?? []).length);
}
