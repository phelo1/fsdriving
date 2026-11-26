"""Scan archived copies of Tesla's careers state JSON (Wayback Machine) for early Robotaxi-related postings.
Downloads every 200 capture of https://www.tesla.com/cua-api/apps/careers/state since 2024 into data/raw/wayback/
(skips ones already there), then writes data/wayback-signals.json: for each US location, the first capture where a
Robotaxi-titled ops role or an "Vehicle Operator, Autopilot" role appears. Run: python3 tools/wayback_scan.py
(The archive stopped capturing this endpoint after May 2025, so this mainly matters for Austin and the Bay Area.)"""
import json, gzip, pathlib, urllib.request, re, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
WB = ROOT/'data'/'raw'/'wayback'; WB.mkdir(parents=True, exist_ok=True)
EP = 'https://www.tesla.com/cua-api/apps/careers/state'
def get(url, tries=3):
    for i in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'robotaxi-hiring-tracker/1.0'}), timeout=90).read()
        except Exception as e:
            if i == tries-1: raise
            time.sleep(5)
cdx = get(f'https://web.archive.org/cdx/search/cdx?url={EP}&from=2024&fl=timestamp&filter=statuscode:200').decode().split()
for ts in cdx:
    f = WB/f'state-{ts}.json'
    if f.exists() and f.stat().st_size > 1000: continue
    b = get(f'https://web.archive.org/web/{ts}id_/{EP}')
    if b[:2] == b'\x1f\x8b': b = gzip.decompress(b)
    f.write_bytes(b); time.sleep(1)
ENG = re.compile(r'engineer|software|developer|designer|scientist|program|architect', re.I)
def kind(t):
    tl = t.lower()
    if 'robotaxi' in tl and not ENG.search(t): return 'robotaxi-ops'
    if 'robotaxi' in tl and 'operations' in tl: return 'robotaxi-ops'
    if tl.startswith('vehicle operator, autopilot'): return 'vehicle-operator'
    return None
first = {}
for f in sorted(WB.glob('state-*.json')):
    ts = f.stem[6:]
    try: d = json.loads(f.read_bytes())
    except Exception: continue
    loc = d.get('lookup', {}).get('locations', {})
    for x in d.get('listings', []):
        k = kind(x.get('t', ''))
        if not k: continue
        where = loc.get(x.get('l'), '?')
        key = f'{where}|{k}'
        if key not in first:
            first[key] = {'location': where, 'kind': k, 'title': x['t'].strip(), 'jobId': x['id'], 'firstCapture': ts,
                          'captureUrl': f'https://web.archive.org/web/{ts}/{EP}'}
caps = sorted(f.stem[6:] for f in WB.glob('state-*.json'))
out = {'captures': caps, 'signals': sorted(first.values(), key=lambda s: s['firstCapture'])}
(ROOT/'data'/'wayback-signals.json').write_text(json.dumps(out, indent=1))
for s in out['signals']: print(s['firstCapture'][:8], s['kind'], s['location'], '|', s['title'], s['jobId'])
