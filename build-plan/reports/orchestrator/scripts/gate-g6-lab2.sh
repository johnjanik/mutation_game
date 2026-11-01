#!/usr/bin/env bash
# Gate G6, the lab on every route, second run: the root release build of the integration head, then
# npm run lab -- --all. Logs in reports/gate-G6-lab2/ (not committed). Run alone on the machine.
set -uo pipefail
R=/home/user/mutation_game
L=$R/reports/gate-G6-lab2
mkdir -p "$L"
export NODE_DISABLE_COMPILE_CACHE=1
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/pw-browsers
step() {
  local name=$1; shift
  echo "[$(date -u +%H:%M:%S)] start $name: $*" | tee -a "$L/00-timeline.log"
  "$@" > "$L/$name.log" 2>&1
  local code=$?
  echo "[$(date -u +%H:%M:%S)] end $name exit=$code" | tee -a "$L/00-timeline.log"
}
git -C "$R" rev-parse HEAD | tee -a "$L/00-timeline.log"
uptime | tee -a "$L/00-timeline.log"
step 01-release-build-root env RELEASE=1 BASE_PATH=/ npm --prefix "$R" run build
uptime | tee -a "$L/00-timeline.log"
step 02-lab env BASE_PATH=/ npm --prefix "$R" run lab -- --all --json "$L/lab.json"
uptime | tee -a "$L/00-timeline.log"
