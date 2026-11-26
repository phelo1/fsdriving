#!/usr/bin/env python3
"""Fetch Waymo's public Greenhouse job board and summarise the metros named in postings (US metros plus the international cities Waymo has announced).

Writes data/waymo-jobs.json. On any failure (network, HTTP error, implausibly small
result) the previous file is kept untouched, so the site always shows the last good data.
Only the public board API is used: https://boards-api.greenhouse.io/v1/boards/waymo/jobs
"""
import json, os, re, sys, urllib.request, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'waymo-jobs.json')
API = 'https://boards-api.greenhouse.io/v1/boards/waymo/jobs'
# location text pattern -> metro id (ids match data/compare.json). Order matters: first hit wins per segment.
METROS = [
 (r'mountain view|san francisco|palo alto|sunnyvale|san jose|oakland|bay area|south san francisco|redwood city|menlo park', 'bay-area'),
 (r'phoenix|tempe|chandler|scottsdale|mesa\b', 'phoenix'), (r'los angeles|santa monica', 'los-angeles'),
 (r'austin', 'austin'), (r'dallas|fort worth|irving|plano', 'dfw'), (r'houston', 'houston'), (r'san antonio', 'san-antonio'),
 (r'atlanta', 'atlanta'), (r'miami', 'miami'), (r'orlando', 'orlando'), (r'tampa', 'tampa'), (r'nashville', 'nashville'),
 (r'denver', 'denver'), (r'las vegas', 'las-vegas'), (r'san diego', 'san-diego'),
 (r'seattle|kirkland|bellevue', 'seattle'), (r'new york', 'new-york'), (r'chicago', 'chicago'), (r'washington,? ?d\.?c', 'washington-dc'),
 (r'boston', 'boston'), (r'detroit|novi', 'detroit'), (r'philadelphia', 'philadelphia'), (r'pittsburgh', 'pittsburgh'),
 (r'baltimore', 'baltimore'), (r'charlotte', 'charlotte'), (r'minneapolis', 'minneapolis'), (r'new orleans', 'new-orleans'),
 (r'portland', 'portland'),
 # international cities Waymo has named (ids match compare.json waymoInternational)
 (r'london', 'london'), (r'munich|münchen', 'munich'), (r'madrid', 'madrid'), (r'tokyo', 'tokyo'), (r'singapore', 'singapore'), (r'toronto', 'toronto'), (r'sacramento', 'sacramento'), (r'st\.? louis', 'st-louis'), (r'jacksonville', 'jacksonville'),
]
SPLIT = re.compile(r';|\|')
def metros_for(loc):
    segs = [s.strip() for s in SPLIT.split(loc or '') if s.strip()]
    found = []
    text = (loc or '').lower()
    for pat, mid in METROS:
        if re.search(pat, text) and mid not in found: found.append(mid)
    return found, len(segs)

def main():
    try:
        req = urllib.request.Request(API, headers={'User-Agent': 'robotaxi-hiring-tracker/1.0'})
        data = json.load(urllib.request.urlopen(req, timeout=60))
        jobs = data['jobs']
        if len(jobs) < 50: raise RuntimeError(f'only {len(jobs)} jobs, refusing to overwrite')
    except Exception as e:
        print('waymo_jobs: fetch failed, keeping last good data:', type(e).__name__, e, file=sys.stderr); return 0
    per = {}
    skipped = 0
    for j in jobs:
        loc = (j.get('location') or {}).get('name', '')
        ms, nseg = metros_for(loc)
        if re.search(r'\bremote\b', loc, re.I) or len(ms) >= 6: skipped += 1; continue
        for mid in ms:
            p = per.setdefault(mid, {'count': 0, 'firstPublished': None, 'examples': []})
            p['count'] += 1
            fp = (j.get('first_published') or '')[:10] or None
            if fp and (not p['firstPublished'] or fp < p['firstPublished']): p['firstPublished'] = fp
            p['examples'].append({'id': j['id'], 'title': j['title'].strip(), 'location': loc.strip(), 'url': j.get('absolute_url'), 'firstPublished': fp})
    for p in per.values():
        p['examples'].sort(key=lambda e: e['firstPublished'] or '', reverse=True); p['examples'] = p['examples'][:4]
    out = {'source': API, 'checkedAt': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).isoformat(timespec='seconds'),
           'totalJobs': len(jobs), 'skippedRemoteOrCatchAll': skipped, 'metros': per}
    tmp = OUT + '.tmp'; json.dump(out, open(tmp, 'w'), indent=1, ensure_ascii=False); os.replace(tmp, OUT)
    print(f'waymo_jobs: {len(jobs)} jobs, {len(per)} metros named, {skipped} remote/catch-all skipped')
    return 0
if __name__ == '__main__': sys.exit(main())
