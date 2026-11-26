#!/usr/bin/env bash
# Commit and push tracked changes to https://github.com/phelo1/fsdriving.
# Usage: tools/git_sync.sh ["commit message"]   (default: "Daily data refresh YYYY-MM-DD", Asia/Riyadh date)
# Never fails the caller: always exits 0 and logs to logs/git_sync.log. Never prints credentials.
cd "$(dirname "$0")/.." || exit 0
mkdir -p logs
LOG=logs/git_sync.log
log(){ echo "[$(TZ=Asia/Riyadh date '+%F %T %Z')] $*" | tee -a "$LOG"; }
[ -d .git ] || { log "not a git repo, skipping"; exit 0; }
MSG="${1:-Daily data refresh $(TZ=Asia/Riyadh date +%F)}"

# Safety net: refuse to commit anything that looks like a secret or a private email/path.
git add -A >/dev/null 2>&1
if git diff --cached -U0 -- . ':(exclude)tools/git_sync.sh' | grep -E '^\+' | grep -qiE '(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[bp]-|BEGIN [A-Z ]*PRIVATE KEY|[A-Za-z0-9._%+-]+@gmail\.com|/home/box/|/cursor/stores)'; then
  git reset -q
  log "ABORTED: staged diff looks like it contains a secret, private email or private path. Nothing committed."
  exit 0
fi

if git diff --cached --quiet; then
  log "no changes to commit"
else
  git commit -q -m "$MSG" && log "committed $(git rev-parse --short HEAD): $MSG" || { log "commit failed"; exit 0; }
fi

# Push (also retries earlier commits that failed to push). Try gh's default auth first, then the stored gh login.
if [ -n "$(git log --oneline origin/main..HEAD 2>/dev/null)" ] || ! git rev-parse -q --verify origin/main >/dev/null; then
  if timeout 90 git push -q origin main >>"$LOG" 2>&1 || env -u GH_TOKEN -u GITHUB_TOKEN timeout 90 git push -q origin main >>"$LOG" 2>&1; then
    log "pushed to origin main ($(git rev-parse --short HEAD))"
  else
    log "push failed (GitHub unreachable or auth). Commit kept locally; the next run will push it."
  fi
else
  log "origin main already up to date"
fi
exit 0
