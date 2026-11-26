# FSDriving (fsdriving.com): daily refresh, start here

Source directory: the repo root (box working copy and private ids are in `OPS.local.md`, gitignored).
Public repo: https://github.com/phelo1/fsdriving (every update is committed and pushed, see "Git: commit and push").
Live: https://fsdriving.com/ (custom domain, canonical). www.fsdriving.com 301-redirects to it.
Pages origin / preview: https://fsdriving.com/ (Cloudflare Pages project robotaxi-hiring; still serves the same build).
Cloudflare Pages project: `robotaxi-hiring`, production branch `main`, in the owner's Cloudflare account (see `OPS.local.md`).
Only change THIS project. No Vercel, no custom domain, no DNS or other Cloudflare projects/zones. Never print credentials.

## Daily routine, end to end

1. Read this file. Read `data/jobs.json` and `data/launches.json` for the latest checks and source history.
2. **Check for launches in today's news before publishing.** Use WebSearch with current year and exact city:
   - `Tesla Robotaxi new city launch <current month/year>`
   - `Tesla Robotaxi <city> available launch <current year>` for announced cities and any newly hiring city.
   - Open Tesla's https://www.tesla.com/robotaxi and https://www.tesla.com/support/robotaxi if available.
   - Credible reporting (Reuters, TechCrunch, local news) can confirm dates Tesla doesn't put on its website.
     Do not assume a launch from hiring, testing, permits, a geofence leak, an announced date or a viral post.
   - Distinguish an invite-only pilot, public service, a passenger-seat safety monitor, a human at the wheel,
     and rides with no one in the front seats. Do not call a whole fleet driverless just from one video.
   - Update `data/launches.json` ONLY with sourced facts. Keep `launch.date` as the first ride-service launch,
     not a later expansion or change of vehicle. Put later events in `milestones[]`. Unconfirmed claims belong
     in `uncertain`, not a confirmed launch. Add dated source URLs and a readable title/publisher.
   - If nothing changed, leave the launch facts alone. Set `updated` to today's Riyadh date ONLY after checking.
     This news check requires the routine agent's research tools: refresh.sh does not do web research.
3. Run the safe local pipeline:
   ```sh
   cd <repo root>   # path in OPS.local.md
   ./tools/refresh.sh
   ```
   It holds a lock, opens Tesla careers in headed Chrome, fetches the careers JSON, merges firstSeen/lastSeen
   history, geocodes new cities/metro anchors, rebuilds and packs the single Pages worker. It does NOT deploy.
   Usually ~30 seconds with cached job details, ~4 minutes with all details fresh. A failure must stop the routine.
4. Check stdout counts. A zero match or a drop below 40% of the previous active count aborts the merge and leaves
   jobs.json untouched. Investigate, don't use `--force` blindly. Real big closures can be allowed with
   `python3 tools/merge.py <snapshot-file> <ISO timestamp with +03:00> --force`, after verifying Tesla's data.
5. **Deploy only to this project's Pages production:** discover `user-Cloudflare` tool `execute` schema, then call
   it with `{"code":"$file:<repo root>/deploy/deploy-mcp.js"}` (absolute path in OPS.local.md).
   The connector uses its own auth. No token or wrangler needed. The file contains an async arrow function that
   POSTs a FormData (`manifest={}`, `branch=main`, `_worker.js`) to
   `/accounts/${accountId}/pages/projects/robotaxi-hiring/deployments`.
   `accountId` is the connector's default account (see OPS.local.md); if multiple accounts become connected, use
   GET /accounts and pass the correct account_id explicitly. Do not guess. Never print auth.
6. Wait for deployment to reach success via a read of that deployment, or the live URL. Verify:
   ```sh
   curl -fIs https://fsdriving.com/
   curl -fIs https://fsdriving.com/data.json
   curl -fIs https://fsdriving.com/launches.json
   python3 tools/shots.py https://fsdriving.com/ shots
   python3 tools/map_check.py https://fsdriving.com/ shots   (interact_check.py now just runs this)
   ```
   Both scripts exit non-zero on a bad status, no city cards, console/page errors, a cluster that won't zoom,
   a tooltip that won't open, or fewer than 9 live markers (raise that number when launches are added).
   Expect 200, current lastChecked, city cards match supervisor-city count, and `errors: []` desktop/mobile.
   Pins are CLUSTERS now so pin count is lower than city count at zoomed-out scales. Check zoom buttons, cluster
   click expands, reset, All roles switch, filter and tap tooltips. Live metro diamonds remain visible on both filters.
   Shots land in `shots/`: `{desktop,mobile}-{top,map,full,lead,waiting,zoomed,tooltip}.png`.
7. **Commit and push to GitHub** (after the live site is verified, also after any manual change):
   ```sh
   ./tools/git_sync.sh                       # default message: "Daily data refresh YYYY-MM-DD"
   ./tools/git_sync.sh "Add Phoenix launch"  # manual updates: describe the change
   ```
   It stages everything not gitignored, refuses to commit if the diff looks like a secret, private email or local
   path, commits only when something changed, pushes to `origin main` of https://github.com/phelo1/fsdriving and
   always exits 0 (a GitHub outage never blocks the site). Check `logs/git_sync.log`; an unpushed commit is pushed
   by the next run. Include the commit SHA in the report.
8. Report changed counts, new/removed cities, launch changes and link, the GitHub commit, or a clear blocker. Do not say the data is
   refreshed if scrape/rebuild/deploy/verification failed. Never fabricate rows or silently reuse stale data as current.

## Launch dataset and lead-time rules

`data/launches.json` contains 12 researched metro entries initially: 9 launched, 3 announced.
Each entry has `id`, `name`, `state`, `anchor` (City, ST), `radiusMi`, `status` (`live`/`announced`), launch
`date/mode/access/summary/sources`, milestones and hiringSignals (date/dateKind/kind/role/note/sources).
The current mode is separate from mode at first launch. SF Bay Area is HUMAN-DRIVEN, never label it driverless.

A metro anchor/radius is a hiring-city association, NOT a ride-service boundary. Nearby suburbs may supply staff
without being served. The nearest anchor within its radius wins (Dallas and Fort Worth remain separate).
Do not infer availability at an address from the map. Use Tesla's app for actual coverage.

Lead time = launch calendar date minus earliest supported hiring signal date (fleet-support or robotaxi-ops),
or this tracker's own firstSeen date if earlier. The original daily tracking started 20 Nov 2026.
Historical news/archive dates are *seen by* bounds, not exact original posting dates, so the page calls these
minimum observed intervals. Average uses only metros with a nonnegative pre-launch interval. Never average
unknown dates, post-launch hiring or broad Autopilot test-driver hints. Austin's archived Diagnostics Engineer,
Robotaxi Operations role is explicitly a DIFFERENT role, and is labelled that way. The average mixes that and
fleet-support signals, which is disclosed, so it isn't a forecast.

When a waiting metro launches, add launch.date + sources, change status to live and currentMode. Build derives
its lead time from the stored firstSeen/signals automatically. No historical hiring date? Show 'Before tracking
began', no invented zero/negative lead. For non-launched cities, counters use days since earliest tracked hiring,
with historical fleet-support signals used for announced metros where sourced. Client updates every minute.
For a missing historical source, keep the gap explicit. Earliest found is NOT proof of the true first posting.

Backfill research sources already saved:
- `data/wayback-signals.json` and `data/raw/wayback/`: 43 archived Tesla careers state snapshots, 2024 to May 2025.
  `python3 tools/wayback_scan.py` rescans them. It found Austin's Robotaxi Operations job by 13 Mar 2025.
- Teslarati 3 Nov 2025 report quoted a 1 Nov observation of fleet-support jobs in Austin, Palo Alto, Orlando,
  Tampa, Doral, Houston, Dallas, Tempe and Las Vegas.
- 16 Oct 2025 Tesla Mag article quotes @TeslaNewswire's 15 Oct fleet-support sightings in Dallas, Houston,
  Tempe, Palo Alto, Las Vegas. LinkedIn's 16 Oct post corroborates Dallas/Houston/Tempe/Las Vegas.
- Autopilot Vehicle Operator article 5 Aug 2025 is retained as context only, NOT fleet-support evidence.
Aggregators frequently repost with a fresh date: don't use their current datePosted as an original historical date.

## Files / implementation

```
config.json                 site URL, project name
src/content.json            role notes from posting text, no invented facts
src/app.js, styles.css        map, clustered pins, D3 zoom/pan, source cards, lead-time bars, counters
src/d3.min.js                vendored D3 v7, MIT/ISC licensing headers retained, no CDN dependency
build.mjs                   JSON -> dist; validates launch dates; skips missing coordinates without crashing
node_modules/us-atlas       Albers US state outlines; map has no external tile calls
 tools/scrape_rules.py       title classifier (supervisor / specialist / operations / other Robotaxi / selfdriving)
tools/scrape.py              headed Chrome, 3 retries, 90s navigation timeout; caches detail text 7 days
tools/merge.py               history merge + sanity checks; never removes history
 tools/geocode.py           Nominatim, 1 req/sec, 3 tries, cached data/geo.json
 tools/refresh.sh           locked scrape/geocode/build/pack pipeline; no deploy
 tools/pack.mjs             dist -> deploy/_worker.js + deploy/deploy-mcp.js, max 2.8MB gzip guard
 tools/shots.py             HTTP + console/page errors + screenshots on desktop and mobile
 data/jobs.json             firstSeen/lastSeen/removedAt/active per id, runs[]
 data/launches.json          sourced launches, announcements and dated hiring evidence
 data/raw/state-*.json.gz    up to 30 recent full careers snapshots
 data/raw/jobs/<id>.json     per-job detail text, URL slug, responsibilities
```

Every visible job includes Tesla source and date seen. Build emits `/data.json` and `/launches.json` for download.
Changes panel uses firstSeen/removedAt equals last run. Removed jobs stay in history as active=false.

## Setup on a fresh box (dependencies only; source is in the directory above)

If the working copy is missing, clone it: `git clone https://github.com/phelo1/fsdriving` (gh must be logged in as
phelo1 to push; run `gh auth setup-git`). Raw snapshots in `data/raw/` are not in git; the tracked `data/*.json`
files are enough to rebuild the site.

```
cd <repo root>   # path in OPS.local.md
npm ci
python3 -m pip install playwright
# Needs system Google Chrome (channel="chrome"), and Xvfb for unattended/headed runs.
python3 -m playwright install chrome
# Debian/Ubuntu if missing: apt-get install -y xvfb
```
refresh.sh uses $DISPLAY if available, else xvfb-run -a. No user computer/session needed. Python 3.9+ (zoneinfo),
Node 18+, curl, coreutils timeout and util-linux flock. No login or credentials needed for the public Tesla reads.
Tesla uses Akamai: curl can get 403 while a normal careers-page session works. The scraper uses that page's own
`/cua-api/apps/careers/state` and `/cua-api/careers/job/<id>`. If blocked after retries, STOP and report it; don't
read session cookies or credentials, solve a captcha, or bypass a challenge. A routine can research fallback
search-engine/aggregator sightings and clearly label sources, but must not pretend those confirm a job is active
on Tesla. Never zero out the map because a bot was blocked.

## Failures / rollback

If Cloudflare fails, keep the prior live deployment. Inspect only this deployment via GET
`/accounts/${accountId}/pages/projects/robotaxi-hiring/deployments/<deployment-id>`. If a verified bad deployment
went live, report it; do not silently change other projects. Rebuild last known good local data and redeploy this
same project if needed. JSON backups can be copied locally before a refresh. Do not overwrite firstSeen history.

## Postings timeline (added 21 Nov 2026, REMOVED from the page 27 Nov 2026; data still built, see FSDriving section)

`data/history.json` is the daily open-postings series. `tools/refresh.sh` runs `python3 tools/history.py` right after
merging the scrape. It seeds 20 Nov (42 supervisors, 92 all roles) and 21 Nov (43, 93) from the actual recorded
runs in jobs.json, not estimates. `build.mjs` includes this series and emits `/history.json`.
One point per Riyadh calendar day: the latest check that day wins. No checks means no point (never invent zero).
The chart has two range buttons (all history / since tracking began), time zoom/pan, two posting lines or a stacked
supervisor-by-state mode, plus sourced hiring/launch spans. All launch and hiring sources come from launches.json.
Our own series starts 20 Nov 2026. Earlier time axis contains only researched events, never historical posting counts.
Run `python3 tools/timeline_shot.py https://fsdriving.com/ shots` after deploy; expects 200, 9+ launch
markers, posting dots and working tooltips, no console errors. Saves desktop-timeline.png/mobile-timeline.png and
tracked/stacked views too. Current history reconstruction uses firstSeen/lastSeen intervals; if a job disappears and
later reappears under the same ID, preserve existing daily points rather than retroactively filling that gap.

## Social card / og.png (added 24 Nov 2026)

`node build.mjs` now also renders the link-preview image automatically, so the daily refresh keeps it current:
- `tools/og_template.mjs` builds `og-build/og.html` (1200x630) from the real active supervisor jobs: one glowing dot per
  city (size by openings), plus the live city, openings and state counts and the last-checked date.
- `tools/og.py` screenshots it with headless Chrome (Playwright, channel "chrome") into `dist/og.png` and keeps a copy
  at `og-build/last-og.png`. If rendering fails it reuses the last good image and prints a WARNING; fix it, don't ignore it.
  If the PNG is over 900 KB it is palette-reduced so the worker stays small.
- The Cybercab art is `src/og-cybercab.jpg` (AI-generated render, not a Tesla press photo). Don't swap in press photos.
- Every page head has og:title/description/url/type/image (+width/height/alt) and twitter:card=summary_large_image,
  twitter:title/description/image. og:image is `https://fsdriving.com/og.png?v=<last check date>`; the
  `?v=` changes each day so unfurlers fetch a fresh copy. `/og.png` works without the query too.
Checks after deploy:
  curl -sI https://fsdriving.com/og.png    -> 200, content-type image/png
  curl -s https://fsdriving.com/ | grep -o '<meta[^>]*\(og\|twitter\):[^>]*>'
  python3 -c "from PIL import Image;import io,urllib.request;print(Image.open(io.BytesIO(urllib.request.urlopen('https://fsdriving.com/og.png').read())).size)"  -> (1200, 630)
Read dist/og.png before deploying and look at it: count matches the hero, dots not hidden behind text.
X caches cards per URL for a while, so old tweets may keep the old card.

## Cities-over-time S-curve (added 24 Nov 2026)

Section `#curve` (src/cities.js) is now the main time chart: cumulative distinct cities where we have ever seen a
Robotaxi Fleet Support Supervisor ad (toggle: any Robotaxi fleet role), step line, by the day this tracker first saw
each city, plus Robotaxi launch diamonds from launches.json on the time axis. The old metro lanes chart stays below as
"Hiring to launch, metro by metro".
- Data comes from `payload.curve`, built in build.mjs from data/jobs.json every build (per city: earliest firstSeen,
  `base: true` if first seen on our very first check). Nothing to do by hand; the daily refresh updates it.
- Cities already open at the first check (20 Nov 2026) are drawn as one dashed step on that day. Never backdate them
  unless you have a real sourced posting date for that exact city and role; if you add one, add it as data, not in JS.
- A city counts once even after its ads close (closed ones say "closed since" in the tooltip).
Check after deploy: `python3 tools/curve_shot.py https://fsdriving.com/ shots` (expects steps, 9 launch
markers in the "Since 2025" view, working tooltip, no console errors).

## Researched backfill for the S-curve (added 24 Nov 2026)

`data/backfill.json` holds researched first-posting dates for cities that were already open at our first check.
It is hand-curated: no script writes it, and the daily refresh only reads it (build.mjs). Don't regenerate or "clean"
it. For each city it has `sup` (supervisor) and optionally `all` (any Robotaxi fleet role) entries with `date`,
`kind`, `confidence`, `evidence` (quote or reasoning), and `sources` (URLs).
- Kinds that count as confirmed: `x-post`, `news`, `aggregator`, `archive`. Kinds that count as estimates (hollow dots,
  dotted riser): `id-batch` (a job id inside a consecutive id run where a sibling has a dated source),
  `id-interpolation` (between dated id anchors listed in `idCalibration`), `ambiguous-post` (a multi-city post
  that doesn't say which city had which role).
- build.mjs uses the backfill date when it's earlier than our own first sighting (or the same day for a city
  open at our first check). New cities found by the daily checks use our own first-seen date as usual.
- To add research later: append or edit an entry with a real source URL. Never add a date without a source.
  Convert X post times to Asia/Riyadh dates.
- Wayback (web.archive.org) refused connections from the box on 24 Nov 2026; if it works again, per-job captures
  (`https://web.archive.org/cdx/search/cdx?url=tesla.com/careers/search/job/*<id>`) can firm up the estimates.

## Tesla vs Waymo comparison (added 25 Nov 2026; static map REMOVED 27 Nov 2026, now a scoreboard, see FSDriving section)

Section `#vs` (between "What changed" and "City by city"): head-to-head counters, a two-layer metro map
(Tesla dot left/red, Waymo dot right/blue, Both/Tesla/Waymo toggle), a sortable-by-status table, Waymo's
international list and a "How we count" note. Code: `src/compare.js`, styles at the end of `src/styles.css`,
data assembly in `build.mjs` (search `compare`).

Data:
- `data/compare.json` is HAND-CURATED. One entry per US metro with `tesla` and `waymo` status objects
  (`status`, `note`, `sources[]`, Waymo also `via: "Uber"` or `gradual: true`). Statuses:
  Tesla `live` (driverless), `live-driver` (Bay Area, safety driver), `announced` (coming soon);
  Waymo `live`, `announced` (Up Next). `null` = company has not named the metro.
  Also `waymoInternational[]` and `definitions` (shown on the page verbatim). No em dashes.
- `data/waymo-jobs.json` is written by `tools/waymo_jobs.py` (public Greenhouse API
  https://boards-api.greenhouse.io/v1/boards/waymo/jobs ; board `waymollc` is 404, do not use).
  It maps location strings to metro ids by regex (METROS list in the script), skips remote postings and
  catch-all postings naming 6+ metros. On any failure or <50 jobs it exits 0 and keeps the last good file.
  Run in `tools/refresh.sh` before history.py.
- Tesla hiring per metro is computed at build time: active supervisor cities within 45 mi of a compare metro
  join it; others cluster (35 mi) into "<city> area" entries that are Tesla hiring-only.

Daily check (manual, a few minutes):
1. Tesla: https://www.tesla.com/robotaxi/safety "Where We're Operating" and "Coming Soon". A city moving
   from Coming Soon to operating: set `tesla.status` to `live`, add a launch source, and also update
   `data/launches.json` (map/lead-time logic) as described above.
2. Waymo: https://waymo.com/rides/ "Serving Riders In" and "Up Next" lists, plus https://waymo.com/faq/
   (count of app markets) and https://waymo.com/updates/ for new cities (blog posts give target years).
   Update `waymo.status` / add metros / add international entries with the official URL.
3. Counters update automatically from the JSON. Do not count road-trip or testing cities as announced
   unless the company lists them; Waymo's Up Next list already covers cities where it is mapping/testing.
4. Verify: `python3 tools/vs_shot.py <url>` (desktop + mobile, toggle, tooltip, no console errors,
   writes shots/*-vs*.png).

Status as of 25 Nov 2026: Tesla live 8 metros (7 driverless + Bay Area safety driver; Dallas and Fort Worth
merged into one DFW metro), announced 3 (Las Vegas, Phoenix, Jacksonville). Waymo live 15 (Austin and Atlanta via
Uber, Las Vegas waitlist rollout), Up Next 15 US + 6 international (London, Tokyo, Munich 2027, Madrid 2027,
Toronto 2028, Singapore 2028).

## Main map v2: Tesla + Waymo, US + World (added 27 Nov 2026)

Replaced the old supervisor-only map (`#map`). Code: `src/map.js` (map), `tools/places.mjs` (data), markup in
`mapHtml()` at the bottom of `build.mjs`, styles under "Main map (map.js)" in `src/styles.css`.
`src/app.js` keeps the city cards (own filter, `.grid-f`), "What changed" and the lead-time cards.

Categories (tools/scrape_rules.py):
- FLEET = supervisor, specialist, operations (US). These alone feed history.json, the S-curve, city cards,
  lead times, hero headline counts and the OG card, exactly as before. history.py filters to FLEET.
- `other`: any other US title containing "Robotaxi" (service techs, market leads, charging, engineering...).
  Headline "Robotaxi-titled roles" = FLEET + other (167 in 52 US cities on 27 Nov 2026).
- `selfdriving`: vehicle operators, self-driving data collection supervisors/operators, "Test Specialist,
  Self-Driving", any country, Optimus excluded. NOT Robotaxi jobs; opt-in map layer, off by default.
  Detail pages are only fetched for Robotaxi categories; self-driving links use /careers/search/job/<id>.
- merge.py stores `country` (ISO code) on every job; non-US jobs use key "City, CC" in data/geo.json.
  Sanity guard now checks fleet AND total matches against the previous active counts.
- tools/replay_ext.py backfilled first/last seen for `other` + `selfdriving` from the saved daily snapshots
  (stamped with the last check of each day). One-off, safe to re-run; it never touches runs[] or fleet jobs.
- tools/geocode.py handles international cities and Waymo's international list (keys "waymo:<name>");
  OVERRIDE_Q fixes ambiguous names (Newbridge, GB = Edinburgh, per the posting title). Check new
  international pins look right after a new country appears; add the country name to COUNTRY_NAMES in
  build.mjs if the build warns.

Places (one pin per metro/city): compare.json metros + Waymo international cities are anchors; each Tesla job
city joins the nearest anchor within 45 mi, else clusters with another city within 35 mi, else gets its own
pin. Waymo hiring = data/waymo-jobs.json (now also London, Munich, Madrid, Tokyo, Singapore, Toronto).
US view uses Albers USA (US locations only); World/Europe/Asia-Pacific use Equal Earth (world-atlas 110m,
npm dependency). Closed ads only show with the "Closed ads" toggle and never count.

Verify: `python3 tools/map_check.py <url> shots` (US/World/Europe views, Tesla/Waymo toggles, status and role
filters, search to Plano, drawer content and job links, pin click, Escape, no horizontal scroll, no console
errors; writes shots/{desktop,mobile}-map-*.png). Deep links: `/#place=<id>` (e.g. dfw, london).

## Custom domain fsdriving.com (added 27 Nov 2026)

- Cloudflare zone fsdriving.com (zone id in OPS.local.md), nameservers desiree/jaziel.ns.cloudflare.com
  (registrar Dynadot). Proxied CNAMEs fsdriving.com and www -> robotaxi-hiring.pages.dev; both attached as custom
  domains on Pages project robotaxi-hiring. Deploy flow is unchanged (deploy/deploy-mcp.js to robotaxi-hiring).
- Redirect: zone ruleset phase http_request_dynamic_redirect, rule "www.fsdriving.com to fsdriving.com (301, keep
  path and query)": host eq www.fsdriving.com -> concat("https://fsdriving.com", path), query preserved.
- config.json `url` is https://fsdriving.com/ (canonical, og:url, og:image, twitter:image); the OG card pill says
  fsdriving.com. robotaxi-hiring.pages.dev stays as the origin/preview and keeps working.
- Checks: curl -sI https://www.fsdriving.com/x?y=1 -> 301 to https://fsdriving.com/x?y=1 ; curl -sI https://fsdriving.com/ -> 200.
- Only touch this zone and the robotaxi-hiring project. Never other zones/projects, never Vercel.
- Analytics: Cloudflare Web Analytics (RUM) site on the fsdriving.com zone, auto_install on (site_tag
  in OPS.local.md). Cloudflare injects the beacon at the edge; nothing in the build. Only
  fsdriving.com traffic is measured (robotaxi-hiring.pages.dev hits are not). Check: page HTML contains
  static.cloudflareinsights.com/beacon.min.js and the browser POSTs /cdn-cgi/rum (204).
- Box DNS note: the box resolver may cache stale answers; verify with DoH plus curl --resolve fsdriving.com:443:<IP>.

## Hero (live Tesla map) and favicon
- The hero is built in `build.mjs` (`heroHtml()`, data `hero` in the payload) with `src/hero.js` + the "Hero" CSS block in `src/styles.css`.
- Green dots = `data/launches.json` metros with status `live` (anchor projected with Albers). Red dots = US map places that are not live and either `announced` in compare.json or have active Robotaxi-titled roles (supervisor, specialist, operations, other; self-driving test roles excluded). Red dot size scales with open roles. Each dot links to a main map place id; click scrolls to `#map` and calls `window.__map.openDrawer(id, true)`.
- Everything updates on the daily rebuild, no manual edits needed. The OG card (`tools/og_template.mjs`) uses the same green/red dots plus a legend.
- Hero artwork: `src/hero-cybercab.jpg` (1024px copy of `src/og-cybercab.jpg`) served as `/cybercab.jpg`.
- Favicons live in `src/icons/` (source `favicon.svg`; PNG/ICO renders made from it) and are copied to `/favicon.svg`, `/favicon.ico`, `/favicon.png` (192), `/apple-touch-icon.png` (180).
- Checks: `python3 tools/hero_shot.py <url> shots` (dots, tooltip, click-to-drawer, overflow, console errors at 1440/1280/390).

## GitHub repo (added 27 Nov 2026)

- Public repo https://github.com/phelo1/fsdriving, branch `main`. Commit identity is phelo1's GitHub noreply address.
- Tracked: source (`build.mjs`, `src/`, `tools/`, configs, docs) and clean data (`data/*.json`).
- Gitignored: `.env*`, `*.local.md` (private ops notes), `node_modules/`, `dist/`, `og-build/`, `deploy/`
  (generated worker bundles), `shots/`, `data/raw/`, `logs/`, locks, caches.
- Push auth goes through gh (`gh auth setup-git`); no token is ever written to the repo or the remote URL.
- PUBLIC repo: never add credentials, account ids, emails or absolute box paths to tracked files; put them in
  `OPS.local.md` (gitignored). `tools/git_sync.sh` blocks obvious leaks but is a safety net, not a review.

## /competitors page (added 27 Nov 2026)

- Data: `data/competitors.json` (hand-checked facts, every row/spec/milestone has source keys into `sources`). Tesla's
  live markets, coming-soon list and open-role counts are filled in at build time from launches.json + jobs.json
  (`__TESLA_*__` placeholders). Page builder: `tools/competitors_page.mjs`, styles in the "/competitors" CSS block.
- Covered: Tesla (benchmark), Waymo, Zoox, May Mobility, Baidu Apollo Go, WeRide, Pony.ai, comma.ai (featured,
  aftermarket), Wayve, Mobileye. Tabs: All / US robotaxis / China & global / Car-agnostic, software & platforms.
- Rules: never invent numbers; label company-reported figures; use "-" when unpublished; update `checkedAt` and the
  milestone lists when re-checking (newest first is automatic). No em dashes.
- Routing: tools/pack.mjs serves `/x` and `/x/` from `dist/x/index.html` with 200 (no redirect).
- Shared header nav (Tracker / FSD / Competitors / News) and the footer sister link to https://optimistbot.com live in build.mjs
  (`topHeader`, `sisterLink`).
- Check: `python3 tools/competitors_shot.py https://fsdriving.com shots` (status, overflow at 1440/390, tabs,
  sources, comma card, optimistbot link, console errors; writes shots/{desktop,mobile}-competitors.png).

## /fsd page (added 27 Nov 2026)
Tesla FSD versions per hardware track (HW4, HW3, Cybertruck, Semi). Built by `tools/fsd_page.mjs` from `data/fsd.json`; check with `python3 tools/fsd_shot.py <base> shots`.
`data/fsd.json` has `research` (verified facts by track, each with sources) and `releases` (the timeline). `tools/fsd_data.py <research.json>` regenerates both from a full fresh research file and overwrites hand edits, so for small updates edit `data/fsd.json` directly.

Update checklist (weekly, or when a new FSD build ships):
1. Check Teslascope's FSD table (teslascope.com/software/full-self-driving), Not a Tesla App release notes, fsdupdate.com/latest-fsd-version, and @Tesla / @aelluswamy / @elonmusk on X.
2. New build: add a `releases` entry (`v`, `fw`, `date` YYYY-MM-DD, `tracks` from hw4/hw3/ct/semi, `kind` release/event/planned, `fleet`, `text`, `src` URLs). Only builds with a date and a source.
3. Update the track's `latest` block under `research.tracks` (version, firmware, date, rollout status, sources). The hero pill and matrix cards read from there.
4. Wide rollout reached (e.g. v15 to the whole HW4 fleet)? Remove or reword the `planned` entry and update `current_broad_fleet_build`.
5. Cybertruck parity: re-check `feature_parity_and_gaps` (8 mph ASS, Banish, v15) against the newest release notes.
6. Tesla counters (miles, city miles, markets, safety multiples): copy from tesla.com/fsd and tesla.com/fsd/safety into `official_tesla_fsd_site.live_stats_observed` with the observed time. Always shown as Tesla's figures.
7. Plans and claims (Musk/Tesla dates) stay `planned` until shipped. Never invent a version, build, date or stat.
8. Bump `checkedAt`, rebuild, deploy, run fsd_shot.py on the live site, then git_sync.

## /news page (added 27 Nov 2026)
News, rumours, incident fact-checks and videos. Built by `tools/news_page.mjs` from `data/news.json`; check with `python3 tools/news_shot.py <base> shots` (status, overflow at 1440/390, every filter tab and incident sub-filter, no YouTube requests before a click, click-to-play iframe, console errors).

`data/news.json` sections:
- `lead`: the top watch item (currently the 15 Dec 2026 TCMV agenda, item 4). Link the primary document first (`primary: true`), then the post that flagged it.
- `items`: stories. `kind` is `rumour` or `confirmed`; `status` is `Rumour`, `Pending` or `Confirmed`. Each needs `date`, `title`, `summary`, `sources`.
- `incidents`: `verdict` is `confirmed`, `debunked` or `review` (Under review); `claim` and `finding` are shown side by side. Optional `video` (`type: x`, verified post URL).
- `videos`: YouTube only, verified through `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json` (200 with title and author) before adding. Copy `title`, `author`, `authorUrl`, `published` (from the watch page `publishDate`) and `seconds`.

Update checklist (weekly, and right after big events):
1. After 15 Dec 2026: replace the TCMV lead with the outcome (vote result, minutes or Commission statement) and move it to `confirmed` or keep it `Pending` if postponed.
2. Promote Pending items when they happen (v15 wide release, new Robotaxi cities, HW3 retrofit pricing) and add the new confirmed source; drop rumours that went nowhere after about 3 months.
3. Incidents: re-check the NHTSA Standing General Order file around the 15th of each month and update the `sgo-tally` counts; update `pe25012` if NHTSA upgrades or closes it; update `cybertruck-overpass` when the lawsuit moves.
4. Only add a debunk when a named source shows the claim false (driver, Tesla account, fact-checker, telemetry). Disputed cases go to Under review.
5. Every URL must open (Reuters, Bloomberg, nhtsa.gov and tesla.com block scripts, so check those in a browser). No em dashes; the build fails on one.
6. Bump `checkedAt`, rebuild, deploy, run news_shot.py on the live site, then git_sync.

## FSDriving rebrand and homepage declutter (added 27 Nov 2026)
- Brand: `config.json` name is `FSDriving`; header wordmark `FSDriving`; home title `FSDriving | Tesla Robotaxi, FSD & Autonomous Driving Tracker`;
  sub-page titles end `| FSDriving`. Mobile header is ONE row (wordmark + 4 tabs, time hidden); `--hh` in styles.css is the header height
  (71px desktop, 52px at <=640px) and every sticky sub-nav (.ctabs, .ftabs, .nbar) uses `top:var(--hh)`. Change both together.
- Timestamps: `updTag()` in build.mjs prints `<time data-rel datetime=ISO>` with UTC text as the no-JS fallback; the inline `relScript`
  turns it into "Updated 2h ago" in the visitor's own zone (exact local time on hover). No Riyadh-time labels on the site any more.
- ONE headline number set `S` (build.mjs, also in the page payload as `D.S`), used by the hero counters, map readout, scoreboard, lead
  stats and the How we count card: live markets (launches.json, Dallas and Fort Worth counted separately), coming soon, supervisor roles
  in N cities, Robotaxi-titled roles in N cities. The map counts live MARKETS via `mapMeta.liveByPid` (dfw = 2) so it agrees with the hero.
  The scoreboard's "Both live" row comes from compare.json, where DFW is one metro; the row says so.
- Removed from `/`: map stat strip (.mhead), static Tesla vs Waymo map (src/compare.js deleted from the bundle), 43-card city grid,
  Gantt postings timeline (src/timeline.js no longer bundled), "Other cities hiring" filler list, scattered caveat paragraphs.
  The caveats now live in ONE `<details id="method">` "How we count" card at the bottom. compare.js / timeline.js stay in src/ unused.
- Waymo is OFF by default on the main map; the scoreboard button `#showWaymo` calls `__map.setOp('waymo', true)` and smooth-scrolls to #map.
- Hero time-lapse (`#tlx`, end of src/hero.js): live dots appear red on `l.hire` (launches.json leadSignal date, when it predates launch)
  and turn green on `l.date`; red dots appear on `h.d` = earliest of the curve date for any city in the pin (backfill.json / tracker),
  the pin's open-role first-seen dates, the announcement date and the metro leadSignal. Start = earliest of these, end = last check.
  The last frame must equal the live state (check: 0 `.hd.tloff` at the end).
- "Next up" board (`nextHtml()`): announced metros (date + first source link) then the top 3 non-announced pins by open supervisor roles.
- sitemap.xml (4 pages) and rss.xml (30 newest dated items: news.json items/lead/incidents, fsd.json releases, launches.json launches and
  announcements) are built into dist/; robots.txt has the Sitemap line; every page head links the feed.
- Build guard: the build fails if ANY html/xml/json/txt/js file in dist contains an em dash.
- Checks: `python3 tools/home_shot.py <url> shots` (counters, time-lapse play/pause/end state, Waymo button, Next-up drawer, heights,
  sideways scroll, console errors; writes shots/desktop-home-top.png, shots/desktop-home-clean.png, shots/mobile-home-top.png).
  `tools/map_check.py` now expects Waymo off at load. `tools/vs_shot.py` and `tools/timeline_shot.py` are obsolete.
- Heights 27 Nov 2026: before 16,813px desktop / 27,631px mobile; after about 6,480px desktop / 7,560px mobile.

## Fleet growth (Texas registrations) (added 27 Nov 2026)
- Section `#fleet` on `/` (between the Tesla vs Waymo scoreboard and the S-curve). Data: `data/fleet.json`, written by
  `tools/fleet_data.py`, which `tools/refresh.sh` runs every day before the build (a failure keeps the last good file).
- Primary source: Texas DMV public TxMCCS lookup (the JSON its own page uses):
  `https://txmccs.txdmv.gov/api/TruckStop/companies?searchType=CompanyName&searchValue=<name>` to find the operator
  (matched on the public AV authorization number: Tesla Robotaxi LLC `AV8313426653583`, Waymo LLC `AV8712526941758`), then
  `/api/TruckStop/companies/<businessEntityId>/automated-motor-vehicles?limit=1` -> `total`. TxDMV only shows the current
  list, so history comes from `https://texasavtracker.com/api/data?brand=tesla|waymo` (`history[]` = timestamp + count every
  time the list changed). Points are copied verbatim; we add our own TxDMV reading each run. Never edit or interpolate points.
- Build guard: the newest Tesla point must equal the TxDMV total or the build fails.
- Stats (build.mjs `fl`): least-squares fit of ln(count) vs days over all Tesla points -> growth per week = e^(7b)-1,
  doubling = ln2/b. "Last 30 days" = newest point vs the last point at least 30 days earlier. 27 Nov 2026: 1,841 Tesla,
  ~15% a week, ~34-day doubling; last 30 days 15% (970 on 25 Oct 2026 -> 1,841). Matches @nymbusjp's 26 Nov 2026 post.
- Waymo benchmark (hand-curated, `benchmark.waymoUS` in data/fleet.json, preserved by the updater): 4,488 driverless-capable
  vehicles in NHTSA recall 26E086 (Waymo Part 573, submitted 19 Nov 2026,
  https://static.nhtsa.gov/odi/rcl/2026/RCLRPT-26E086-1357.pdf). Replace it only with a newer primary figure (a newer recall
  population or a Waymo-stated fleet size) and its URL. Waymo's Texas count comes from TxDMV automatically.
- Model split (Cybercab / Model Y) is Texas AV Tracker's VIN-prefix classification (TxDMV lists VINs only); label it so.
- Check: `python3 tools/fleet_shot.py <url> shots` (hover tooltip, Linear/Log, Waymo toggle, overflow, console errors;
  writes shots/desktop-fleet.png, desktop-fleet-log.png, mobile-fleet.png).
