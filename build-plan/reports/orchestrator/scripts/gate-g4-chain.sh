#!/bin/bash
# Gate G4 command chain (GATE.md section 5.5 steps for G4, 5.6, section 8 G4 row). Logs in reports/gate-G4.
R=/home/user/mutation_game
L=$R/reports/gate-G4
S=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad
mkdir -p $L/previous
for f in reports/open-items-report.json reports/open-items-report.md reports/numbers-in-prose.md; do [ -f $R/$f ] && mv -v $R/$f $L/previous/ >> $L/00-moves.log; done
pkill -f "astro [p]review"
rm -rf /tmp/two-games-ssr-test-cache-*
unset TMPDIR
export PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers
run() { n=$1; shift; echo "[$(date +%T)] start $n: $*" >> $L/00-timeline.log; "$@" > $L/$n.log 2>&1; e=$?; echo "exit=$e" >> $L/$n.log; echo "[$(date +%T)] end $n exit=$e" >> $L/00-timeline.log; }
: > $L/00-timeline.log
git -C $R rev-parse HEAD >> $L/00-timeline.log
uptime >> $L/00-timeline.log
run 01-npm-ci npm --prefix $R ci
run 02-npm-test npm --prefix $R test
cp $R/packages/engine/test/golden/coverage.json $L/coverage-after-npm-test.json
for f in reports/open-items-report.json reports/open-items-report.md; do [ -f $R/$f ] && mv -v $R/$f $L/previous/after-npm-test-$(basename $f) >> $L/00-moves.log; done
run 03-npm-verify npm --prefix $R run verify
run 04-build npm --prefix $R run build
git -C $R status --porcelain > $L/status-after-build.log
run 05-e2e npm --prefix $R run e2e
run 06-size npm --prefix $R run size
node -e "const fs=require('fs'),z=require('zlib'),d='$R/site/public/presets/T10/';for(const f of fs.readdirSync(d).filter(n=>n.endsWith('.json')))console.log(z.gzipSync(fs.readFileSync(d+f),{level:9}).length,f)" > $L/06b-presets-gzip.log 2>&1
M6=$(ls $R/site/dist/modules | grep '^m6-'); M7=$(ls $R/site/dist/modules | grep '^m7-')
pkill -f "astro [p]review"
sleep 5
uptime >> $L/00-timeline.log
run 07-lab npm --prefix $R run lab -- /modules/$M6/ /modules/$M7/
run 08-e2e-basepath npm --prefix $R run e2e:basepath
run 09-report npm --prefix $R run report
pkill -f "astro [p]review"
sleep 5
uptime >> $L/00-timeline.log
run 10-bench npm --prefix $R run bench -w packages/engine
run 11-bench-root npm --prefix $R run bench
run 12-typecheck npm --prefix $R run typecheck
( cd $R && git ls-files -s reference ) > $L/13-reference-index.log
sha256sum $R/reference/* > $L/13-reference-sha256.log 2>&1
for f in $L/0*.log $L/1*.log; do echo "== $f: $(tail -1 $f)"; done
grep -E "Test Files|Tests " $L/02-npm-test.log
grep -E "checks passed|failed" $L/03-npm-verify.log | tail -2
grep -E "passed|failed|flaky|skipped" $L/05-e2e.log | tail -4
grep -E "^\s+(✘|×)" $L/05-e2e.log | head -12
grep -E "E8 drawing time" $L/05-e2e.log
tail -1 $L/06-size.log
cat $L/06b-presets-gzip.log
grep -E "passed|failed" $L/08-e2e-basepath.log | tail -1
grep -vE "^\s*$|^>" $L/07-lab.log | tail -8
tail -3 $L/09-report.log
grep -E "orbit benchmark|✓|×|FAIL" $L/10-bench.log | head -8
grep -E "Test Files|Tests " $L/11-bench-root.log
grep -E "errors$" $L/12-typecheck.log
git -C $R status --porcelain
