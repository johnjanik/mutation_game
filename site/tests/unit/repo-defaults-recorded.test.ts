// Every default of SPEC.md section 10 that the build relies on by phase 6 has a dated record (SPEC 9.3: "When an open
// decision of section 10 blocks work, take the default, and add a line to DECISIONS.md with the date and the
// reason"). Adopted from the RT-10 script of the phase 6 round (attack 18), which found no dated entry for D10 and
// D12. The script read DECISIONS.md alone; a missing entry is supplied in a decisions fragment, which MERGE folds
// into DECISIONS.md and which stays in decisions/ afterwards (RT-FIX 5.5), so the entries counted here are those of
// DECISIONS.md and of every fragment in decisions/. The rule that a dated entry names a default, and the lens's
// reading of which defaults are due by phase 6, are the script's, unchanged. Beside it, what the two new records
// say is checked against the repository: D12, every page of the site is English; D10, the site stays separate from
// MutationGraph and states where the agreement of the rule with C = 2I - A on simple graphs is written.
// Run: npx vitest run --project site-unit site/tests/unit/repo-defaults-recorded.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

/** The dated entries (## <date> ...) of one Markdown file of decisions. */
const entriesOf = (text: string): string[] => text.split(/\n(?=## \d{4}-\d{2}-\d{2} )/).filter((e) => /^## \d{4}-\d{2}-\d{2} /.test(e));

const FILES = ['DECISIONS.md', ...readdirSync(join(ROOT, 'decisions')).filter((f) => f.endsWith('.md')).sort().map((f) => `decisions/${f}`)];
const ENTRIES = FILES.flatMap((f) => entriesOf(read(f)).map((e) => ({ file: f, entry: e })));

// The lens's reading of when each default is first relied on: phase 0 D1, D3, D4, D12, D13, D17, D18; phase 1 D2,
// D5, D7, D14, D19; phase 2 D8, D11, D15; phase 3 D6 (an owner's act at G3); phase 6 D10, D16 (D9 is phase 7).
const DUE = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19'];
// D6 is the owner's act (G3 owner's part, "decision D6 carried out"); it is listed but not required here.
const OWNER = ['D6'];

/**
 * Whether a dated entry names the default d as a decision: "D<n>" followed by " (", ":", ",", ")", " default",
 * " stand" or " and D", and not standing in a list of boards ("A11, A13 and D12:", "D9 to D16", "D6 swap",
 * "(D6 at 23040)", "D6 node 1", "D6 75 ms"), which are the board D<n>, not the default.
 */
function namesDefault(entry: string, d: string): boolean {
  const rx = new RegExp(`(?<![A-Za-z0-9~^])${d}(?![0-9~^])`, 'g');
  for (const m of entry.matchAll(rx)) {
    const at = m.index!;
    const before = entry.slice(Math.max(0, at - 14), at);
    const after = entry.slice(at + d.length, at + d.length + 12);
    if (/[A-G]\d{1,2}(?:~)?(?:, | and | to )$/.test(before)) continue; // a list of boards
    if (/^ (?:to|swap|node|at|rotation) |^ \d/.test(after)) continue; // the board D<n>
    if (/^(?: \(|:|,|\)| default| stand| and D\d)/.test(after)) return true;
  }
  return false;
}

/** The files under a directory of the repository, node_modules and build output left out. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name === 'dist' || name === '.astro') continue;
    const p = `${dir}/${name}`;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('DECISIONS.md records neither default D12 (English) nor D10 (keep separate from MutationGraph)', () => {
  // regression: P6-RT-10-04
  it('every default due by phase 6 has a dated entry in DECISIONS.md or a decisions fragment', () => {
    const missing = DUE.filter((d) => !OWNER.includes(d) && !ENTRIES.some((e) => namesDefault(e.entry, d)));
    // Observed at f07eec6 (DECISIONS.md and decisions/ alike): D10 and D12 have no dated entry.
    expect(missing, 'defaults of SPEC section 10 with no dated entry').toEqual([]);
  });

  // regression: P6-RT-10-04
  it('the D12 record: every page of the site is English', () => {
    const records = ENTRIES.filter((e) => namesDefault(e.entry, 'D12'));
    expect(records.some((e) => /English/.test(e.entry) && /lang="en"/.test(e.entry)), 'the D12 entry names English and lang="en"').toBe(true);
    // Every html element the site writes (the layout of every page and the embed route) declares lang="en". The root
    // element of an Astro document opens a line; "<html>" inside a comment does not.
    const htmlTags = walk('site/src')
      .filter((f) => f.endsWith('.astro'))
      .flatMap((f) => [...read(f).matchAll(/^[ \t]*<html\b[^>]*>/gm)].map((m) => ({ file: f, tag: m[0] })));
    expect(htmlTags.length, 'the site writes an html element').toBeGreaterThan(0);
    for (const h of htmlTags) expect(h.tag, h.file).toMatch(/\blang="en"/);
  });

  // regression: P6-RT-10-04
  it('the D10 record: the site stays separate from MutationGraph, and the agreement on simple graphs is written where the record says', () => {
    const records = ENTRIES.filter((e) => namesDefault(e.entry, 'D10'));
    const record = records.find((e) => /MutationGraph/.test(e.entry) && /2I-A/.test(e.entry));
    expect(record, 'the D10 entry names MutationGraph and C = 2I - A').toBeDefined();
    // Kept separate: no source of the site or the engine names the other project or loads its files.
    const named = [...walk('site/src'), ...walk('packages/engine/src')].filter((f) => /MutationGraph/.test(read(f)));
    expect(named, 'site and engine sources that name MutationGraph').toEqual([]);
    // The record names M2 beat 3 as the place on the site where the agreement is stated: on a board with single
    // roads the matrix of the form is 2I - A, which is C = 2I - A^T because A is symmetric, and the mutation
    // subtracts (p, e_i), "the rule of module one".
    expect(record!.entry).toMatch(/M2 beat 3/);
    const m2 = read('site/src/content/modules/m2-form.mdx');
    const beat3 = m2.slice(m2.indexOf('<Beat n={3}>'), m2.indexOf('<Beat n={4}>'));
    expect(beat3).toMatch(/single roads the matrix is <Tex src="B=2I-A"\/>/);
    expect(beat3).toMatch(/<Tex src="C=2I-A\^\{\\mathsf T\}"\/> of module zero, because on such a board \$A\$ is symmetric/);
    expect(beat3).toMatch(/which is the rule of module one/);
  });
});
