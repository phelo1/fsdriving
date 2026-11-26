#!/usr/bin/env bash
# Safe local pipeline. This does NOT deploy; the routine uses Cloudflare MCP after reviewing build/verification output.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs shots
exec 9>logs/refresh.lock
flock -n 9 || { echo 'Another refresh is running, stopping.'; exit 4; }
command -v node >/dev/null
command -v python3 >/dev/null
[ -d node_modules ] || npm ci
python3 -c 'import playwright' || { echo 'Install: python3 -m pip install playwright'; exit 5; }
if [ -n "${DISPLAY:-}" ]; then timeout 900 python3 tools/scrape.py
else timeout 900 xvfb-run -a python3 tools/scrape.py; fi
timeout 120 python3 tools/waymo_jobs.py || echo "waymo_jobs failed, keeping last good data/waymo-jobs.json"
python3 tools/history.py
python3 tools/geocode.py
node build.mjs
node tools/pack.mjs
python3 -m compileall -q tools
echo 'READY. Review launches.json/news, then deploy deploy/deploy-mcp.js with Cloudflare MCP, verify live, then run tools/git_sync.sh to commit and push to GitHub.'
