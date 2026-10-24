# Usage: python3 refold-changed.py decisions/<fragment>.md
# Replaces, in DECISIONS.md, every section whose "## " heading is in the fragment and whose body differs,
# with the fragment's version (for fragments whose earlier entries were edited after their first fold).
import sys
frag = open(sys.argv[1]).read()
def sections(text):
    out, cur = {}, None
    for line in text.split('\n'):
        if line.startswith('## '):
            cur = line; out[cur] = []
        elif cur is not None:
            out[cur].append(line)
    return {h: '\n'.join(b).strip('\n') for h, b in out.items()}
fs = sections(frag)
lines = open('DECISIONS.md').read().split('\n')
res, i, changed = [], 0, 0
while i < len(lines):
    line = lines[i]
    if line in fs:
        j = i + 1
        while j < len(lines) and not lines[j].startswith('## '):
            j += 1
        old = '\n'.join(lines[i + 1:j]).strip('\n')
        if old != fs[line]:
            changed += 1
            res.append(line); res.extend(fs[line].split('\n')); res.append('')
        else:
            res.extend(lines[i:j])
        i = j
        continue
    res.append(line); i += 1
open('DECISIONS.md', 'w').write('\n'.join(res))
print(changed, 'sections replaced')
