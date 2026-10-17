// Gate G2 support: golden coverage for phases 0 to 2 with the one-file rule, property files, tool test
// files, routes of site/dist against the e2e logs, size rows, installed versions, hashes, provenance.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const R = process.argv[2];
const LOG = join(R, 'reports/gate-G3');
const TABLE = {
  0: ['types[*].cartan', 'types[*].adjacency'],
  1: ['types[*].n_roots', 'types[*].n_positive_roots', 'types[*].positive_roots', 'types[*].highest_root', 'types[*].highest_short_root', 'types[*].numbers_of_highest_root', 'types[*].numbers_of_highest_short_root', 'types[*].highest_root_of_reversed_board', 'types[*].coxeter_number', 'types[*].longest_word', 'types[*].fired_values', 'types[*].fired_tally', 'types[*].minus_w0', 'types[*].minuscule_nodes', 'kostant[*].end_from_node', 'kostant[*].moves_from_node', 'kostant[*].final_numbers_from_node', 'one_way_counterexample', 'layer_growth_examples', 'bigint_test'],
  3: ['types[*].exponents', 'types[*].weyl_order', 'types[*].bipartite_colouring', 'types[*].fundamental_orbit_sizes', 'types[*].n_reduced_words_w0', 'types[*].length_distribution', 'weyl_dimension', 'heaps', 'pentagon_example.complete_games', 'e8'],
  2: ['types[*].symmetrizer', 'types[*].simply_laced', 'types[*].n_short_positive', 'types[*].n_long_positive', 'types[*].long_to_short_ratio', 'types[*].det_cartan', 'affine', 'twisted_affine', 'affine_names', 'classification_tests', 'pentagon_example', 'kostant[*].affine_board_from_node'],
};
const cov = JSON.parse(readFileSync(join(LOG, 'coverage-after-npm-test.json'), 'utf8'));
const dir = join(R, 'packages/engine/test/golden');
const files = readdirSync(dir).filter((f) => f.endsWith('.test.ts'));
let bad = 0;
for (const p of [0, 1, 2, 3]) {
  const missing = TABLE[p].filter((k) => !cov.keys.includes(k));
  console.log(`phase ${p}: ${TABLE[p].length} keys; missing (recomputed) ${JSON.stringify(missing)}; missingByPhase ${JSON.stringify(cov.missingByPhase[String(p)])}`);
  for (const k of TABLE[p]) {
    const where = files.filter((f) => readFileSync(join(dir, f), 'utf8').includes(`'${k}'`));
    if (where.length !== 1) { bad++; console.log(`  key '${k}' covered in ${JSON.stringify(where)} FAIL`); }
  }
}
console.log('one-file rule violations:', bad);
const props = readdirSync(join(R, 'packages/engine/test/properties'));
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13]) console.log(`  p${n}: ${props.some((f) => f.startsWith(`p${n}-`)) ? 'present' : 'MISSING'}`);
console.log('p7 second half (isRootPopulation):', /isRootPopulation/.test(readFileSync(join(R, 'packages/engine/test/properties', props.find((f) => f.startsWith('p7-'))), 'utf8')));
for (const t of ["T05", "T06", "T07", "T08"]) console.log(`${t}: unit ${existsSync(join(R, `site/tests/unit/tools/${t}.test.ts`))}, e2e ${existsSync(join(R, `site/tests/e2e/${t}.spec.ts`))}`);
console.log('phase-2 parts of T2 and T9:', existsSync(join(R, 'site/tests/unit/tools/T09-phase2.test.ts')), existsSync(join(R, 'site/tests/e2e/phase2-additions.spec.ts')));
function walk(d, out = []) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n === '_astro' || n === 'katex') continue; walk(p, out); } else if (n === 'index.html') out.push(p.slice(join(R, 'site/dist').length + 1).replace(/index\.html$/, '') || './'); } return out; }
const routes = walk(join(R, 'site/dist'));
console.log('routes in site/dist:', routes.length, JSON.stringify(routes));
const e2e = readFileSync(join(LOG, '05-e2e.log'), 'utf8');
console.log('nojs not visited:', JSON.stringify(routes.filter((r) => !e2e.includes(`every route renders without JavaScript: ${r}`))));
console.log('axe not scanned:', JSON.stringify(routes.filter((r) => !e2e.includes(`${r === './' ? 'index page' : r} has no serious or critical axe violations`))));
const size = readFileSync(join(LOG, '06-size.log'), 'utf8');
console.log('size rows missing:', JSON.stringify(routes.filter((r) => !size.includes(r === './' ? '\n/  ' : `/${r}`))));
const pins = { '@lhci/cli': 'root', astro: 'site', '@astrojs/mdx': 'site', svelte: 'site', '@astrojs/svelte': 'site', typescript: 'root', nanostores: 'site', vitest: 'root', 'fast-check': 'packages/engine', '@playwright/test': 'root', '@axe-core/playwright': 'root', '@astrojs/check': 'site', 'svelte-check': 'site', katex: 'site', '@astrojs/markdown-remark': 'site', 'remark-math': 'site', 'rehype-katex': 'site', '@types/node': 'root' };
const pkgOf = { root: 'package.json', site: 'site/package.json', 'packages/engine': 'packages/engine/package.json' };
let mismatch = 0;
for (const [name, where] of Object.entries(pins)) {
  const pkg = JSON.parse(readFileSync(join(R, pkgOf[where]), 'utf8'));
  const pinned = (pkg.dependencies ?? {})[name] ?? (pkg.devDependencies ?? {})[name];
  const installed = JSON.parse(readFileSync(join(R, 'node_modules', name, 'package.json'), 'utf8')).version;
  if (pinned !== installed) { mismatch++; console.log(`VERSION MISMATCH ${name}: ${pinned} vs ${installed}`); }
}
console.log('version mismatches:', mismatch);
for (const f of ['reference/golden_data.json', 'reference/lie_games.py', 'reference/verify.py']) console.log(createHash('sha256').update(readFileSync(join(R, f))).digest('hex') + '  ' + f);
const rp = join(R, 'reports/open-items-report.json');
if (existsSync(rp)) {
  const rep = JSON.parse(readFileSync(rp, 'utf8'));
  const start = readFileSync(join(LOG, '00-timeline.log'), 'utf8').match(/\[(\S+)\] release build start/)?.[1];
  console.log(`open-items report: mode=${rep.mode} generatedAt=${rep.generatedAt} items=${rep.items.length} unknown=${rep.unknownItems.length}; after release build start ${start}: ${new Date(rep.generatedAt) > new Date(start)}`);
  for (const i of rep.items.filter((i) => i.pages.length)) console.log(`  ${i.id}: ${JSON.stringify(i.pages)} routes ok: ${i.pages.every((p) => existsSync(join(R, 'site/dist', p.replace(/^\//, ''), 'index.html')))}`);
} else console.log('open-items report ABSENT');
