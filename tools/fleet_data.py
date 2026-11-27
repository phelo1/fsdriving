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

def dmv_vins(bid, total):
    """Full VIN list. TxDMV caps limit at 100, so page with offset. Returns (vins, ok) where ok means count == total."""
    vins, off = [], 0
    while off < total + 100:
        page = get(f"{DMV}/api/TruckStop/companies/{bid}/automated-motor-vehicles?limit=100&offset={off}")
        vs = [x.get('vin') for x in page.get('vehicles') or [] if x.get('vin')]
        if not vs: break
        vins += vs; off += 100
        if off >= int(page.get('total') or total): break
        time.sleep(0.3)
    vins = sorted(set(vins))
    return vins, len(vins) == total

def classify(vin):
    """Tesla VIN: WMI (1-3), model letter (4), model year (10), plant (11), serial (12-17).
    5YJ + model A + plant A (Austin) = Cybercab; 7SA + model Y = Model Y. Anything else is kept as 'Other'."""
    if len(vin) != 17: return 'Other'
    if vin[:3] == '5YJ' and vin[3] == 'A' and vin[10] == 'A': return 'Cybercab'
    if vin[:3] == '7SA' and vin[3] == 'Y': return 'Model Y'
    return 'Other'

MILESTONES = [2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]
def cc_stats(vins):
    ser = sorted(int(v[11:]) for v in vins if classify(v) == 'Cybercab' and v[11:].isdigit())
    if not ser: return None
    return {'n': len(ser), 'hi': ser[-1], 'lo': ser[0], 'rate': round(len(ser) / ser[-1] * 100, 1), 'ser': ser}

def cybercab_block(vins, old_cv, now, tracker_hist):
    st = cc_stats(vins)
    if not st: return None
    hi, ser, size = st['hi'], st['ser'], 500
    buckets = []
    for start in range(1, hi + 1, size):
        end = min(start + size - 1, hi); reg = sum(1 for x in ser if start <= x <= end); bs = end - start + 1
        buckets.append({'label': f"#{start:,} to #{end:,}", 'start': start, 'end': end, 'registered': reg, 'batchSize': bs, 'pct': round(reg / bs * 100, 1)})
    years = {}
    for v in vins:
        if classify(v) == 'Cybercab': years[v[9]] = years.get(v[9], 0) + 1
    # history: Texas AV Tracker snapshots (each one carries the full VIN list it saw) + our own daily TxDMV readings
    hist = []
    for h in tracker_hist:
        s2 = cc_stats(h.get('vins') or [])
        if s2 and len(h.get('vins') or []) == h.get('count'): hist.append({'t': h['timestamp'], 'highestSerial': s2['hi'], 'registeredCount': s2['n'], 'registrationRatePct': s2['rate'], 'src': 'tracker'})
    mine = [p for p in (old_cv or {}).get('history', []) if p.get('src') == 'txdmv']
    mine.append({'t': now, 'highestSerial': hi, 'registeredCount': st['n'], 'registrationRatePct': st['rate'], 'src': 'txdmv'})
    allh = sorted(hist + mine, key=lambda p: p['t']); clean = []
    for i, p in enumerate(allh):
        if clean and p['src'] == 'txdmv' and (clean[-1]['highestSerial'], clean[-1]['registeredCount']) == (p['highestSerial'], p['registeredCount']) and i != len(allh) - 1: continue
        clean.append(p)
    ms = []
    for m in MILESTONES:
        f = next((p for p in clean if p['highestSerial'] >= m), None)
        if f: ms.append({'serial': m, 't': f['t'], 'highestSerial': f['highestSerial'], 'registeredCount': f['registeredCount'], 'registrationRatePct': f['registrationRatePct'], 'src': f['src']})
    return {'highestSerial': hi, 'lowestSerial': st['lo'], 'registeredCount': st['n'], 'registrationRatePct': st['rate'],
            'modelYears': {('2026' if k == 'T' else '2027' if k == 'V' else k): n for k, n in sorted(years.items())},
            'bucketSize': size, 'buckets': buckets, 'history': clean, 'milestones': ms,
            'method': 'Serial = VIN positions 12 to 17 of every Cybercab VIN (5YJ, model A, plant A) on the TxDMV list. History points come from Texas AV Tracker snapshots, each of which carries the full VIN list it saw, plus our own daily TxDMV reading.'}

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
        prev = old.get('operators', {}).get(k, {})
        extra = {}
        if k == 'tesla':
            vins, ok = dmv_vins(comp['businessEntityId'], total)
            if not ok:
                print(f'warning: TxDMV VIN list returned {len(vins)} VINs but total is {total}; keeping previous VIN stats', file=sys.stderr)
                extra = {x: prev[x] for x in ('txdmvModels', 'cybercabVin', 'txdmvModelsAt') if x in prev}
            else:
                tm = {}
                for v in vins: tm[classify(v)] = tm.get(classify(v), 0) + 1
                tvm = {v['vin']: v.get('model') for v in tr.get('vehicles') or []}
                diff = sum(1 for v in vins if v in tvm and tvm[v] and classify(v) != 'Other' and tvm[v] != classify(v))
                if diff: print(f'warning: {diff} VINs classified differently from Texas AV Tracker labels', file=sys.stderr)
                extra = {'txdmvModels': tm, 'txdmvModelsAt': now, 'cybercabVin': cybercab_block(vins, prev.get('cybercabVin'), now, tr.get('history') or [])}
                cv = extra['cybercabVin']
                print(f"tesla VINs: {len(vins)}/{total} {tm} | Cybercab highest serial {cv['highestSerial']}, {cv['registeredCount']} registered ({cv['registrationRatePct']}%)")
        out['operators'][k] = {**extra, 'name': op['name'], 'av': op['av'], 'grantedAt': info.get('grantedAt'), 'txdmvTotal': total, 'txdmvAt': now,
                               'trackerTotal': len(tr.get('vehicles') or []), 'trackerCheckedAt': tr.get('lastChecked'),
                               'models': models if sum(models.values()) == len(tr.get('vehicles') or []) else {}, 'series': clean,
                               'dmvUrl': f"{DMV}/automated-vehicles/operators/{op['av']}"}
        print(f"{k}: TxDMV {total} | tracker {len(tr.get('vehicles') or [])} ({len(pts)} history points) | models {models}")
    tmp = OUT + '.tmp'; json.dump(out, open(tmp, 'w'), indent=1); os.replace(tmp, OUT)

if __name__ == '__main__':
    try: main()
    except SystemExit: raise
    except Exception as e: print('fleet_data failed:', e, file=sys.stderr); sys.exit(1)
