"""Rebuild data/history.json (daily open-postings series) from data/jobs.json. Idempotent, safe to run every refresh.
A job counts as open at a check if firstSeen <= check time <= lastSeen. That's exact for every check we ran,
because lastSeen is bumped on every check the job is still there. One point per Asia/Riyadh calendar day
(the last check of that day). Nothing is backfilled before our first check."""
import json, pathlib, datetime, collections
ROOT = pathlib.Path(__file__).resolve().parent.parent
hist = json.loads((ROOT/'data'/'jobs.json').read_text())
# Fleet categories only (supervisor/specialist/operations), so the series keeps one meaning since day one.
FLEET = ('supervisor', 'specialist', 'operations')
jobs = [j for j in hist['jobs'].values() if j['category'] in FLEET]
hp = ROOT/'data'/'history.json'
existing = json.loads(hp.read_text()) if hp.exists() else {'series': []}
byday = {p['date']: p for p in existing['series']}
last_run = max((r['at'] for r in hist.get('runs', [])), default='')
for run in hist.get('runs', []):
    at = run['at']; t = datetime.datetime.fromisoformat(at)
    # Historical points are immutable once a later day exists. Only today's latest check can replace its point.
    if at[:10] in byday and at[:10] != last_run[:10]: continue
    open_ = [j for j in jobs if datetime.datetime.fromisoformat(j['firstSeen']) <= t <= datetime.datetime.fromisoformat(j['lastSeen'])]
    sup = [j for j in open_ if j['category'] == 'supervisor']
    byday[at[:10]] = {"date": at[:10], "checkedAt": at, "supervisor": len(sup), "all": len(open_),
        "supervisorCities": len({(j['city'], j['state']) for j in sup}), "allCities": len({(j['city'], j['state']) for j in open_}),
        "byState": dict(sorted(collections.Counter(j['state'] for j in sup).items())),
        "byStateAll": dict(sorted(collections.Counter(j['state'] for j in open_).items()))}
out = {"about": "Daily open Robotaxi fleet postings on Tesla's US careers site, from this tracker's own checks. Series starts at our first check; nothing before it is estimated.",
       "series": [byday[d] for d in sorted(byday)]}
(ROOT/'data'/'history.json').write_text(json.dumps(out, indent=1))
for p in out['series']: print(p['date'], 'supervisor', p['supervisor'], 'all', p['all'])
