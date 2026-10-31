// Usage: node extract-agent-json.mjs <agent transcript .output (JSONL)> <out.json>
// Finds the last assistant text in a subagent transcript, takes the JSON object in it (inside a ```json
// fence or bare) and writes it to <out.json>. Prints only a one-line summary.
import fs from 'node:fs';

const [src, out] = process.argv.slice(2);
const lines = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean);
let last = null;
for (const l of lines) {
  let d;
  try { d = JSON.parse(l); } catch { continue; }
  const m = d.message;
  if (!m || m.role !== 'assistant' || !Array.isArray(m.content)) continue;
  const text = m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  if (text.includes('{')) last = text;
}
if (last === null) { console.log('no assistant text found'); process.exit(1); }
const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(last);
let body = fence ? fence[1] : last.slice(last.indexOf('{'), last.lastIndexOf('}') + 1);
const obj = JSON.parse(body);
fs.writeFileSync(out, JSON.stringify(obj, null, 1));
const f = obj.findings ?? obj.results ?? [];
console.log(`${out}: ${Array.isArray(f) ? f.length : 0} items; keys ${Object.keys(obj).join(',')}`);
