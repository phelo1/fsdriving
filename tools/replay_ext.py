"""One-off (safe to re-run): backfill first/last seen for the categories added on 27 Nov 2026 ('other' Robotaxi roles and
'selfdriving' test roles) by replaying every saved daily snapshot in data/raw/ in date order.
Each snapshot is stamped with the LAST check of that Asia/Riyadh day in jobs.json runs[] (the snapshot file is overwritten
by later checks that day), so firstSeen means "seen by that check". Fleet categories and runs[] are not touched."""
import json, gzip, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/'tools'))
from merge import merge
jp = ROOT/'data'/'jobs.json'; hist = json.loads(jp.read_text())
ONLY = {'other', 'selfdriving'}
last_of_day = {}
for r in sorted(hist['runs'], key=lambda r: r['at']): last_of_day[r['at'][:10]] = r['at']
snaps = sorted(ROOT.glob('data/raw/state-*.json*'))
seen_any = False
for sp in snaps:
    day = sp.name[6:16]
    stamp = last_of_day.get(day)
    if not stamp: print('skip (no run that day)', sp.name); continue
    state = json.loads(gzip.decompress(sp.read_bytes()) if sp.suffix == '.gz' else sp.read_text())
    live = merge(state, stamp, hist, ONLY)
    for jid, j in hist['jobs'].items():
        if j['category'] in ONLY and jid not in live and j.get('active') and j['lastSeen'] < stamp:
            j['active'] = False; j['removedAt'] = stamp
    print(sp.name, stamp, len(live))
jp.write_text(json.dumps(hist, indent=1, ensure_ascii=False))
