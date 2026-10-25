#!/bin/bash
# Gate G6 command chain (GATE.md section 8, with 5.5, 5.6, 5.7; the G6 row of 5.6). Run alone, from anywhere;
# logs in reports/gate-G6. As G3 for the release builds, the archives and the lab (here `npm run lab -- --all`
# against the root release build); as the G5 rerun for the root benchmark and the e2e suite at the CI base
# (P4-RT-12-02). Supporting: the three LaTeX samples for the owner's compile (P6-tikz), written by
# latex-export.spec.ts into reports/gate-G6/latex/ against the preview build.
R=/home/user/mutation_game
L=$R/reports/gate-G6
S=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad
mkdir -p $L/previous $L/latex
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
pkill -f "astro [p]review"
sleep 5
run 06c-latex-samples env LATEX_SAMPLES_DIR=$L/latex/ npm --prefix $R run e2e -- site/tests/e2e/latex-export.spec.ts
pkill -f "astro [p]review"
sleep 5
uptime >> $L/00-timeline.log
run 07-e2e-basepath npm --prefix $R run e2e:basepath
echo "[$(date -u +%FT%TZ)] release build 1 (pages) start" >> $L/00-timeline.log
run 08-release-build-pages env RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/ npm --prefix $R run build
run 09-report npm --prefix $R run report
cp $R/reports/open-items-report.json $L/open-items-report-pages.json 2>/dev/null
cp $R/reports/open-items-report.md $L/open-items-report-pages.md 2>/dev/null
tar -czf $R/reports/release-1.0-pages.tar.gz -C $R/site/dist . && echo "pages archive: $(ls -l $R/reports/release-1.0-pages.tar.gz | awk '{print $5}') bytes, $(tar -tzf $R/reports/release-1.0-pages.tar.gz | wc -l) entries, sha256 $(sha256sum $R/reports/release-1.0-pages.tar.gz | cut -d' ' -f1); RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/" >> $L/00-timeline.log
echo "[$(date -u +%FT%TZ)] release build 2 (root) start" >> $L/00-timeline.log
run 10-release-build-root env RELEASE=1 BASE_PATH=/ npm --prefix $R run build
tar -czf $R/reports/release-1.0-root.tar.gz -C $R/site/dist . && echo "root archive: $(ls -l $R/reports/release-1.0-root.tar.gz | awk '{print $5}') bytes, $(tar -tzf $R/reports/release-1.0-root.tar.gz | wc -l) entries, sha256 $(sha256sum $R/reports/release-1.0-root.tar.gz | cut -d' ' -f1); RELEASE=1 BASE_PATH=/" >> $L/00-timeline.log
run 11-size-release npm --prefix $R run size
pkill -f "astro [p]review"
sleep 5
uptime >> $L/00-timeline.log
run 12-lab npm --prefix $R run lab -- --all --json $L/lab.json
pkill -f "astro [p]review"
sleep 5
uptime >> $L/00-timeline.log
run 13-bench npm --prefix $R run bench -w packages/engine
run 13b-bench-root npm --prefix $R run bench
run 14-typecheck npm --prefix $R run typecheck
pkill -f "astro [p]review"
sleep 5
uptime >> $L/00-timeline.log
run 15a-build-ci-base env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix $R run build
run 15b-e2e-ci-base env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix $R run e2e
( cd $R && git ls-files -s reference ) > $L/16-reference-index.log
sha256sum $R/reference/* > $L/16-reference-sha256.log 2>&1
for f in $L/0*.log $L/1*.log; do echo "== $f: $(tail -1 $f)"; done
grep -E "Test Files|Tests " $L/02-npm-test.log
grep -E "checks passed|failed" $L/03-npm-verify.log | tail -2
grep -E "passed|failed|flaky|skipped" $L/05-e2e.log | tail -4
grep -E "^\s+(✘|×)" $L/05-e2e.log | head -12
tail -1 $L/06-size.log; tail -1 $L/11-size-release.log
grep -E "passed|failed" $L/06c-latex-samples.log | tail -1; ls -l $L/latex/
grep -E "passed|failed" $L/07-e2e-basepath.log | tail -1
grep -E "open item" $L/08-release-build-pages.log | head -30
tail -3 $L/09-report.log
grep -vE "^\s*$|^>" $L/12-lab.log | tail -20
grep -E "orbit benchmark|✓|×|FAIL" $L/13-bench.log | head -8
grep -E "Test Files|Tests " $L/13b-bench-root.log
grep -E "errors$" $L/14-typecheck.log
grep -E "passed|failed|flaky|skipped" $L/15b-e2e-ci-base.log | tail -4
grep -E "^\s+(✘|×)" $L/15b-e2e-ci-base.log | head -12
git -C $R status --porcelain
