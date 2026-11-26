# fsdriving.com: Tesla Robotaxi and Waymo tracker

Live site: **https://fsdriving.com**

An unofficial, independent tracker of where Tesla's Robotaxi service is live, where it is coming next, and where Tesla is hiring the people who run it. Waymo is tracked alongside for comparison. Not affiliated with Tesla or Waymo.

## What it shows

- **Live map hero:** every US city where Tesla Robotaxi service is live (green) and every city that is hiring or announced but not live yet (red).
- **Tesla + Waymo world map:** filter by company, status (live, coming soon, hiring) and role type, then open any city for its jobs, launch dates and sources.
- **Tesla vs Waymo:** side by side status for each metro.
- **Hiring S-curve and timeline:** open Robotaxi supervisor roles over time, with launch dates and early hiring signals.
- **City cards:** every open role, first and last seen dates, linked to the original posting.

## Where the data comes from

- **Tesla jobs:** Tesla's public careers listings, read once a day. Roles are classified by title into fleet support supervisors, specialists, operations, other Robotaxi-titled roles, and self-driving test roles (shown separately and never counted as Robotaxi roles). Closed ads are kept in history but never counted as open.
- **Waymo jobs:** Waymo's public Greenhouse job board.
- **Launches and announcements:** hand-checked news reports in `data/launches.json` and `data/compare.json`, each with a source link.
- **History:** `data/backfill.json` and `data/wayback-signals.json` reconstruct earlier postings from Internet Archive captures of Tesla's careers data.
- **Geocoding:** OpenStreetMap Nominatim, cached in `data/geo.json`.

Every launch, status and job on the site links back to its source. Nothing is estimated or invented.

## Repo layout

| Path | What it is |
| --- | --- |
| `build.mjs` | Builds the static site into `dist/` (HTML, data, OG card, icons) |
| `src/` | Front end: map, hero, timeline, comparison, styles, icons, artwork |
| `tools/` | Scraper, merge and history scripts, geocoder, OG card renderer, packer, visual checks |
| `data/` | Tracked data: jobs, history, launches, comparison, geocodes, backfill |
| `REFRESH.md` | The daily refresh runbook |

## Run it locally

```sh
npm ci
python3 -m pip install playwright
node build.mjs            # builds dist/ from the tracked data
python3 -m http.server 8765 --directory dist
```

A full refresh (`tools/refresh.sh`) scrapes the live careers data in a headed Chrome, merges it into `data/`, rebuilds and packs the site. Each daily update is committed here by `tools/git_sync.sh`, so the commit history doubles as a public log of Tesla's Robotaxi hiring.

## Hosting

Static site on Cloudflare Pages, served at fsdriving.com.
