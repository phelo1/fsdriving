#!/usr/bin/env python3
"""Texas registered Robotaxi fleet (Tesla, with Waymo as a benchmark) -> data/fleet.json.

Primary source: Texas DMV (TxDMV) public "Motor Carrier and Automated Motor Vehicle Operator Lookup" (TxMCCS).
  The same JSON its public lookup page uses: /api/TruckStop/companies?... and
  /api/TruckStop/companies/<businessEntityId>/automated-motor-vehicles  -> {"vehicles":[{vin}], "total": N}
  TxDMV only shows the CURRENT list, so history needs snapshots.
History: texasavtracker.com public JSON (/api/data?brand=tesla|waymo), which snapshots the same TxDMV list and
  records a point every time the count changes. We keep its points verbatim (timestamp + count) and add our own
  TxDMV reading on every run. Points are never interpolated or edited.
Safe: on any fetch/validation failure the previous data/fleet.json is kept untouched (exit 1).
"""
import json, os, sys, time, urllib.request, urllib.parse, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'fleet.json')
UA = {'User-Agent': 'Mozilla/5.0 (fsdriving.com fleet tracker; daily)', 'Accept': 'application/json'}
DMV = 'https://txmccs.txdmv.gov'
TRACKER = 'https://texasavtracker.com'
OPS = {  # operator -> TxDMV company search name, AV authorization number (public), tracker brand
    'tesla': {'search': 'Tesla Robotaxi', 'av': 'AV8313426653583', 'brand': 'tesla', 'name': 'Tesla Robotaxi, LLC'},
    'waymo': {'search': 'Waymo', 'av': 'AV8712526941758', 'brand': 'waymo', 'name': 'Waymo LLC'},
}

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return json.load(r)
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(3 * (i + 1))

def dmv_total(op):
    q = urllib.parse.urlencode({'searchType': 'CompanyName', 'searchValue': op['search']})
    res = [r for r in get(f'{DMV}/api/TruckStop/companies?{q}')['results'] if r.get('autonomousVehicleAuthorizationNumber') == op['av']]
    if len(res) != 1: raise SystemExit(f"TxDMV: expected exactly one company with {op['av']}, got {len(res)}")
    c = res[0]
    if c.get('autonomousVehicleStatus') != 'authorized': print('warning: status', c.get('autonomousVehicleStatus'))
    v = get(f"{DMV}/api/TruckStop/companies/{c['businessEntityId']}/automated-motor-vehicles?limit=1")
    return int(v['total']), c

def main():
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    old = json.load(open(OUT)) if os.path.exists(OUT) else {}
    out = {'checkedAt': now, 'about': 'Automated vehicles registered to each operator on the Texas DMV automated motor vehicle list. Registered, not necessarily on the road at the same time.',
           'sources': {'txdmv': {'label': 'Texas DMV, Automated Motor Vehicle Operator Lookup', 'url': f'{DMV}/automated-vehicles/operators/'},
                       'tracker': {'label': 'Texas AV Tracker (daily TxDMV snapshots)', 'url': TRACKER + '/'}},
           'benchmark': old.get('benchmark'), 'operators': {}}
    for k, op in OPS.items():
        total, comp = dmv_total(op)
        tr = get(f"{TRACKER}/api/data?brand={op['brand']}")
        info = tr.get('operatorInfo') or {}
        if info.get('authNumber') != op['av']: raise SystemExit(f'tracker {k}: authNumber mismatch')
        pts = [{'t': h['timestamp'], 'n': int(h['count']), 'src': 'tracker'} for h in tr['history'] if isinstance(h.get('count'), int) and h['count'] > 0]
        if len(pts) < 5: raise SystemExit(f'tracker {k}: too few history points ({len(pts)})')
        # keep our own earlier TxDMV readings, add today's
        mine = [p for p in (old.get('operators', {}).get(k, {}).get('series') or []) if p.get('src') == 'txdmv']
        mine.append({'t': now, 'n': total, 'src': 'txdmv'})
        series = sorted(pts + mine, key=lambda p: p['t'])
        # drop txdmv readings that repeat the previous value (they add no information) except the newest one
        clean = []
        for i, p in enumerate(series):
            if p['src'] == 'txdmv' and clean and clean[-1]['n'] == p['n'] and i != len(series) - 1: continue
            clean.append(p)
        models = {}
        for v in tr.get('vehicles') or []: models[v.get('model') or 'Unknown'] = models.get(v.get('model') or 'Unknown', 0) + 1
        out['operators'][k] = {'name': op['name'], 'av': op['av'], 'grantedAt': info.get('grantedAt'), 'txdmvTotal': total, 'txdmvAt': now,
                               'trackerTotal': len(tr.get('vehicles') or []), 'trackerCheckedAt': tr.get('lastChecked'),
                               'models': models if sum(models.values()) == len(tr.get('vehicles') or []) else {}, 'series': clean,
                               'dmvUrl': f"{DMV}/automated-vehicles/operators/{op['av']}"}
        print(f"{k}: TxDMV {total} | tracker {len(tr.get('vehicles') or [])} ({len(pts)} history points) | models {models}")
    tmp = OUT + '.tmp'; json.dump(out, open(tmp, 'w'), indent=1); os.replace(tmp, OUT)

if __name__ == '__main__':
    try: main()
    except SystemExit: raise
    except Exception as e: print('fleet_data failed:', e, file=sys.stderr); sys.exit(1)
