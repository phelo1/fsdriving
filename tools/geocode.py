"""Adds lat/lon for every city in data/jobs.json (US and, for self-driving test roles, other countries), every metro
anchor in data/launches.json, and Waymo's international cities in data/compare.json to data/geo.json (cache).
Keys: "City, ST" for US cities, "City, CC" (ISO country code) elsewhere. Uses OpenStreetMap Nominatim, 1 req/sec.
Network errors are retried; a city that still fails is left out (the build skips its pin)."""
import json, pathlib, time, urllib.request, urllib.parse, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/'tools'))
from scrape_rules import COUNTRY
gp = ROOT/'data'/'geo.json'
geo = json.loads(gp.read_text()) if gp.exists() else {}
jobs = json.loads((ROOT/'data'/'jobs.json').read_text())['jobs']
STATES = {}
for j in jobs.values():
    if j.get('state'): STATES[j['state']] = j['stateName']
NAMES = {'TX':'Texas','CA':'California','FL':'Florida','NV':'Nevada','AZ':'Arizona','GA':'Georgia','TN':'Tennessee','NC':'North Carolina','VA':'Virginia','MA':'Massachusetts','MI':'Michigan','IL':'Illinois','WA':'Washington','PA':'Pennsylvania','NY':'New York','CO':'Colorado','OH':'Ohio'}
todo = []  # (key, params, fallback query)
for j in jobs.values():
    c = j.get('cityRaw') or j['city']
    if j.get('country', 'US') == 'US':
        todo.append((f"{j['city']}, {j['state']}", {"city": c, "state": j['stateName'], "country": "USA"}, f"{c}, {j['stateName']}, USA"))
    else:
        cn = COUNTRY.get(j['country'], j['country'])
        todo.append((f"{j['city']}, {j['country']}", {"city": c, "country": cn}, f"{c}, {cn}"))
lp = ROOT/'data'/'launches.json'
if lp.exists():
    for m in json.loads(lp.read_text())['metros']:
        c, st = [x.strip() for x in m['anchor'].rsplit(',', 1)]
        sn = STATES.get(st) or NAMES.get(st, st)
        todo.append((m['anchor'], {"city": c, "state": sn, "country": "USA"}, f"{c}, {sn}, USA"))
cp = ROOT/'data'/'compare.json'
if cp.exists():
    for c in json.loads(cp.read_text()).get('waymoInternational', []):
        q = c.get('geocode') or f"{c['name']}, {c['country']}"
        todo.append((f"waymo:{c['name']}", {"q": q}, q))
# Ambiguous names: the posting title says which one (e.g. "Self-Driving - Edinburgh").
OVERRIDE_Q = {'Newbridge, GB': 'Newbridge, City of Edinburgh, Scotland'}
todo = [(k, {"q": OVERRIDE_Q[k]}, OVERRIDE_Q[k]) if k in OVERRIDE_Q else (k, p, q) for k, p, q in todo]
def fetch(params):
    req = urllib.request.Request("https://nominatim.openstreetmap.org/search?"+urllib.parse.urlencode({**params, "format": "json", "limit": 1}), headers={"User-Agent": "robotaxi-hiring-tracker/1.0"})
    for i in range(3):
        try: return json.load(urllib.request.urlopen(req, timeout=30))
        except Exception as e:
            print('retry', params, e); time.sleep(3)
    return None
for key, params, q in todo:
    if geo.get(key): continue
    r = fetch(params)
    if not r:
        time.sleep(1.1); r = fetch({"q": q})
    geo[key] = {"lat": float(r[0]['lat']), "lon": float(r[0]['lon']), "name": r[0].get('display_name')} if r else None
    print(key, geo[key] and (geo[key]['lat'], geo[key]['lon']))
    time.sleep(1.1)
gp.write_text(json.dumps(geo, indent=1, ensure_ascii=False))
missing = [k for k, v in geo.items() if not v]
print("missing:", missing)
