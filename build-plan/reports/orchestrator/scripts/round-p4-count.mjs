import fs from 'node:fs';
const dir = process.argv[2];
const dup = new Set(['P4-RT-08-01', 'P4-RT-08-03', 'P4-RT-03-01']);
const rank = { minor: 0, major: 1, blocker: 2 };
const names = ['minor', 'major', 'blocker'];
let total = 0; const conf = []; const dropped = [];
for (let i = 1; i <= 13; i++) {
  const L = `RT-${String(i).padStart(2, '0')}`;
  const o = JSON.parse(fs.readFileSync(`${dir}/${L}.json`, 'utf8'));
  const v = {};
  for (const f of [`${L}-reproduce.json`, `${L}-refute.json`, `${L}-verify.json`]) {
    if (!fs.existsSync(`${dir}/${f}`)) continue;
    for (const x of JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')).verdicts) (v[x.findingId] ??= {})[x.mode] = x;
  }
  for (const f of o.findings) {
    total++;
    if (dup.has(f.id)) continue;
    const r = v[f.id] ?? {};
    // RT-10 and RT-13 verdicts were recorded in the tally only for some; treat a missing verdict as reported in TALLY.
    const rep = r.reproduce?.reproduced, ref = r.refute?.refuted;
    let sev = rank[f.severity.replace(/ .*/, '')] ?? 0;
    for (const m of ['reproduce', 'refute']) {
      const a = r[m]?.severityAdjustment ?? 'none';
      if (a.startsWith('raise to ')) sev = Math.max(sev, rank[a.slice(9)]);
      if (a.startsWith('lower to ') && r.reproduce?.severityAdjustment?.startsWith('lower') && r.refute?.severityAdjustment?.startsWith('lower')) sev = Math.min(sev, rank[a.slice(9)]);
    }
    if (rep === true && ref === false) conf.push([f.id, names[sev]]);
    else dropped.push([f.id, `rep=${rep} ref=${ref}`]);
  }
}
const by = (s) => conf.filter((c) => c[1] === s).length;
console.log('total', total, 'confirmed', conf.length, 'blocker', by('blocker'), 'major', by('major'), 'minor', by('minor'));
console.log('not confirmed:', dropped.map((d) => d.join(' ')).join('; '));
