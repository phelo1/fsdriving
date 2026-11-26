"""Merge a raw careers state snapshot (+ per-job detail files) into data/jobs.json, keeping first/last seen history.
Usage: python3 tools/merge.py state-YYYY-MM-DD.json[.gz] <ISO timestamp of the check, Asia/Riyadh> [--force] [--only=other,selfdriving]
Categories come from tools/scrape_rules.py. Robotaxi categories are US only; 'selfdriving' is any country.
Jobs missing from the snapshot are kept but marked active=false (removedAt set the first time).
Sanity guard: if the snapshot matches 0 fleet jobs, or fewer than 40% of the currently active fleet jobs (or of all
active jobs), nothing is written and it exits 3 (a broken scrape shouldn't wipe the map). --force overrides.
--only limits the merge to some categories (used by tools/replay_ext.py to backfill new categories from old snapshots;
it never touches runs[] or lastChecked)."""
import json, sys, re, html, pathlib, gzip
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT/'data'/'raw'
sys.path.insert(0, str(ROOT/'tools'))
from scrape_rules import classify, locations, us_only, FLEET, CITY_ALIAS

def text(s): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s or '')).replace('\xa0',' ')).strip()

def merge(state, stamp, hist, only=None):
    loc = locations(state); live = set()
    for x in state['listings']:
        cat = classify(x['t']); g = loc.get(x['l'])
        if not cat or not g or (only and cat not in only): continue
        if us_only(cat) and g[0] != 'US': continue
        jid = x['id']; live.add(jid)
        j = hist['jobs'].get(jid, {"firstSeen": stamp})
        if j['firstSeen'] > stamp: j['firstSeen'] = stamp
        j.pop('removedAt', None)
        j.update({"id": jid, "title": x['t'].strip(), "category": cat, "city": CITY_ALIAS.get(g[3], g[3]), "state": g[1],
                  "stateName": g[2], "country": g[0], "locationId": x['l'],
                  "source": "tesla.com careers JSON (cua-api)", "lastSeen": max(stamp, j.get('lastSeen', stamp)), "active": True})
        if g[3] != j['city']: j['cityRaw'] = g[3]
        j.setdefault('url', f"https://www.tesla.com/careers/search/job/{jid}")
        df = RAW/'jobs'/f"{jid}.json"
        if df.exists():
            d = json.loads(df.read_text())
            if d.get('url'): j['url'] = 'https://www.tesla.com' + d['url']
            j['timeType'] = d.get('timeType'); j['department'] = d.get('department')
            m = re.search(r'(Shift[^.]{0,8}?:?\s*[0-9][^.]*?(?:AM|PM|am|pm)[^.;]*)', text(d.get('jobDescription')))
            j['shift'] = m.group(1).strip().rstrip('.') if m else None
        hist['jobs'][jid] = j
    return live

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    FORCE = '--force' in sys.argv
    only = next((set(a.split('=', 1)[1].split(',')) for a in sys.argv if a.startswith('--only=')), None)
    state_file, stamp = args[0], args[1]
    sp = RAW/state_file
    state = json.loads(gzip.decompress(sp.read_bytes()) if sp.suffix == '.gz' else sp.read_text())
    jp = ROOT/'data'/'jobs.json'
    hist = json.loads(jp.read_text()) if jp.exists() else {"jobs": {}, "runs": []}
    act = lambda jobs, pred: sum(1 for j in jobs if j.get('active') and pred(j))
    prev_fleet = act(hist['jobs'].values(), lambda j: j['category'] in FLEET)
    prev_all = act(hist['jobs'].values(), lambda j: True)
    live = merge(state, stamp, hist, only)
    fleet = sum(1 for i in live if hist['jobs'][i]['category'] in FLEET)
    if not FORCE and not only and (fleet == 0 or (prev_fleet >= 10 and fleet < 0.4 * prev_fleet) or (prev_all >= 10 and len(live) < 0.4 * prev_all)):
        print(f"SANITY FAIL: matched {fleet} fleet / {len(live)} total vs {prev_fleet} / {prev_all} active before. Not writing. Re-run, or use --force if it's real.")
        sys.exit(3)
    for jid, j in hist['jobs'].items():
        if jid not in live and j.get('active') and (not only or j['category'] in only):
            j['active'] = False; j['removedAt'] = stamp
    if not only:
        hist['runs'] = [r for r in hist.get('runs', []) if r['at'] != stamp] + [{"at": stamp, "listingsTotal": len(state['listings']), "matched": fleet, "matchedAll": len(live)}]
        hist['lastChecked'] = stamp
    jp.write_text(json.dumps(hist, indent=1, ensure_ascii=False))
    print("active", len(live), f"({fleet} fleet)", "total tracked", len(hist['jobs']))
