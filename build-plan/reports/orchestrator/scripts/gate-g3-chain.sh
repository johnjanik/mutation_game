#!/bin/bash
# Gate G3 command chain (GATE.md section 8, with 5.5, 5.6, 5.7). Run from anywhere; logs in reports/gate-G3.
R=/home/user/mutation_game
L=$R/reports/gate-G3
S=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad
mkdir -p $L/previous
for f in reports/open-items-report.json reports/open-items-report.md reports/numbers-in-prose.md; do [ -f $R/$f ] && mv $R/$f $L/previous/; done
pkill -f "astro [p]review"
unset TMPDIR
export PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers
run() { n=$1; shift; echo "[$(date +%T)] start $n: $*" >> $L/00-timeline.log; "$@" > $L/$n.log 2>&1; e=$?; echo "exit=$e" >> $L/$n.log; echo "[$(date +%T)] end $n exit=$e" >> $L/00-timeline.log; }
: > $L/00-timeline.log
git -C $R rev-parse HEAD >> $L/00-timeline.log
run 01-npm-ci npm --prefix $R ci
run 02-npm-test npm --prefix $R test
cp $R/packages/engine/test/golden/coverage.json $L/coverage-after-npm-test.json
for f in reports/open-items-report.json reports/open-items-report.md; do [ -f $R/$f ] && mv $R/$f $L/previous/fixture-$(basename $f); done
run 03-npm-verify npm --prefix $R run verify
run 04-build npm --prefix $R run build
run 05-e2e npm --prefix $R run e2e
run 06-size npm --prefix $R run size
run 07-e2e-basepath npm --prefix $R run e2e:basepath
echo "[$(date -u +%FT%TZ)] release build 1 (pages) start" >> $L/00-timeline.log
RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/ run 08-release-build-pages npm --prefix $R run build
run 09-report npm --prefix $R run report
cp $R/reports/open-items-report.json $L/open-items-report-pages.json 2>/dev/null
tar -czf $R/reports/release-0.5-pages.tar.gz -C $R/site/dist . && echo "pages archive: $(ls -l $R/reports/release-0.5-pages.tar.gz | awk '{print $5}') bytes, $(tar -tzf $R/reports/release-0.5-pages.tar.gz | wc -l) entries, sha256 $(sha256sum $R/reports/release-0.5-pages.tar.gz | cut -d' ' -f1)" >> $L/00-timeline.log
echo "[$(date -u +%FT%TZ)] release build 2 (root) start" >> $L/00-timeline.log
RELEASE=1 BASE_PATH=/ run 10-release-build-root npm --prefix $R run build
tar -czf $R/reports/release-0.5-root.tar.gz -C $R/site/dist . && echo "root archive: $(ls -l $R/reports/release-0.5-root.tar.gz | awk '{print $5}') bytes, $(tar -tzf $R/reports/release-0.5-root.tar.gz | wc -l) entries, sha256 $(sha256sum $R/reports/release-0.5-root.tar.gz | cut -d' ' -f1)" >> $L/00-timeline.log
run 11-size-release npm --prefix $R run size
run 12-lab npm --prefix $R run lab
pkill -f "astro [p]review"
sleep 5
uptime >> $L/00-timeline.log
run 13-bench npm --prefix $R run bench -w packages/engine
run 14-typecheck npm --prefix $R run typecheck
for f in $L/0*.log $L/1*.log; do echo "== $f: $(tail -1 $f)"; done
grep -E "Test Files|Tests " $L/02-npm-test.log
grep -E "checks passed" $L/03-npm-verify.log | tail -1
grep -E "passed|failed|flaky|skipped" $L/05-e2e.log | tail -4
grep -E "^\s+(✘|×)" $L/05-e2e.log | head -8
tail -1 $L/06-size.log; tail -1 $L/11-size-release.log
grep -E "passed|failed" $L/07-e2e-basepath.log | tail -1
grep -E "^report:|open item" $L/09-report.log | head -6
grep -vE "^\s*$|^>" $L/12-lab.log | tail -14
grep -E "orbit benchmark" $L/13-bench.log
grep -E "errors$" $L/14-typecheck.log
git -C $R status --porcelain
