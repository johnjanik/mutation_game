import subprocess, sys
base = sys.argv[1]
files = sys.argv[2:]
out = []
for f in files:
    old = subprocess.run(['git','show',f'{base}:{f}'],capture_output=True,text=True).stdout
    new = open(f).read()
    oldheads = {l for l in old.splitlines() if l.startswith('## ')}
    secs, cur = [], None
    for line in new.splitlines():
        if line.startswith('## '):
            cur = [line]; secs.append(cur)
        elif cur is not None:
            cur.append(line)
    for s in secs:
        if s[0] not in oldheads:
            while s and s[-1].strip()=='': s.pop()
            out.append('\n'.join(s))
with open('DECISIONS.md','a') as fh:
    for s in out: fh.write('\n' + s + '\n')
print(len(out), 'sections appended')
