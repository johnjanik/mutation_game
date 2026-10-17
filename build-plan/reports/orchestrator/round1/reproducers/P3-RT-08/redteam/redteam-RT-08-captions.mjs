// RT-08 attack 21 (second part): every tool instance of a lesson has a caption that states the result it
// demonstrates (SPEC.md 8.1 P1 "Each tool has a meaningful starting state and a caption that states its
// point"; CONTRACTS 7 "Every tool has a `caption` prop stating the result it demonstrates (P1)"; 8.2
// item 2 for the first figure). This script prints, from the MDX source, the captions of the instances
// listed below (M5 b1, b12, b13, b15), which give an instruction or a description and no result, beside
// the passages they break. No assertion can decide "states a result", so it prints for a reader.
// Usage: node redteam/redteam-RT-08-captions.mjs <worktree>
import fs from 'node:fs';
import path from 'node:path';

const wt = process.argv[2];
const src = fs.readFileSync(path.join(wt, 'site/src/content/modules/m5-weyl.mdx'), 'utf8');
for (const id of ['b1', 'b12', 'b13', 'b15']) {
  const tag = src.match(new RegExp(`<T\\d\\d[A-Za-z]+ [^\\n]*id="${id}"[^\\n]*`));
  const cap = tag ? (tag[0].match(/caption=(\{`[^`]*`\}|"[^"]*")\s*\/>/) ?? [])[1] : null;
  console.log(`m5-weyl.mdx ${id}: caption=${cap}`);
}
console.log('SPEC.md 8.1 P1: "Each tool has a meaningful starting state and a caption that states its point."');
console.log('SPEC.md 8.2 item 2: "A first figure, already showing something, with a one-sentence caption."');
console.log('CONTRACTS.md 7: "Every tool has a `caption` prop stating the result it demonstrates (P1)."');
