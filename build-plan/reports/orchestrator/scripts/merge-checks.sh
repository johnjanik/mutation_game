#!/bin/bash
# Usage: merge-checks.sh <label>   (runs in /home/user/mutation_game, logs to reports/merge-<label>/)
cd /home/user/mutation_game || exit 1
L=reports/merge-$1
mkdir -p $L
unset TMPDIR
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/pw-browsers
npm ci > $L/ci.log 2>&1; echo "exit=$?" >> $L/ci.log
npm test > $L/test.log 2>&1; echo "exit=$?" >> $L/test.log
npm run typecheck > $L/typecheck.log 2>&1; echo "exit=$?" >> $L/typecheck.log
npm run build > $L/build.log 2>&1; echo "exit=$?" >> $L/build.log
git status --porcelain > $L/status-after-build.log
npm run e2e > $L/e2e.log 2>&1; echo "exit=$?" >> $L/e2e.log
npm run size > $L/size.log 2>&1; echo "exit=$?" >> $L/size.log
for f in $L/*.log; do echo "== $f: $(tail -1 $f)"; done
grep -E "Test Files|Tests " $L/test.log
grep -E "FAIL" $L/test.log | head -10
grep -E "error TS|Error:" $L/typecheck.log | head -10
grep -E "passed|failed|flaky|skipped" $L/e2e.log | tail -4
grep -E "^\s+(✘|×)" $L/e2e.log | head -20
grep -E "over|FAIL" $L/size.log | head -5
tail -1 $L/size.log
cat $L/status-after-build.log
