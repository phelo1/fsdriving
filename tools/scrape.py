"""Re-scrape Tesla careers for Robotaxi fleet support roles.

Opens tesla.com/careers in real (headed) Chrome so Akamai lets it through, then calls the same JSON endpoints the
careers page uses, from inside the page:
  /cua-api/apps/careers/state      (every listing + lookup tables + geo tree)
  /cua-api/careers/job/<id>        (one posting's full text, only fetched for new jobs or ones older than 7 days)
Saves data/raw/state-<date>.json.gz and data/raw/jobs/<id>.json, then runs tools/merge.py to update data/jobs.json.
Retries the whole browser session up to 3 times. Exit codes: 0 ok, 2 blocked by Akamai, 3 merge sanity check failed.
Needs a display: run under `xvfb-run -a` when $DISPLAY is empty (tools/refresh.sh does this for you)."""
import asyncio, json, sys, datetime, pathlib, gzip, subprocess, time
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT/'data'/'raw'; (RAW/'jobs').mkdir(parents=True, exist_ok=True)
TZ = ZoneInfo('Asia/Riyadh')
sys.path.insert(0, str(ROOT/'tools'))
from scrape_rules import classify, locations, us_only, ROBOTAXI

async def session(now):
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=False, args=["--disable-blink-features=AutomationControlled", "--no-first-run"])
        try:
            ctx = await b.new_context(viewport={"width": 1400, "height": 900}, locale="en-US", timezone_id="America/Chicago")
            pg = await ctx.new_page()
            r = await pg.goto("https://www.tesla.com/careers/search/?query=robotaxi&site=US", wait_until="domcontentloaded", timeout=90000)
            print("careers page", r.status if r else None, flush=True)
            await pg.wait_for_timeout(12000)
            st = await pg.evaluate("""async()=>{const r=await fetch('/cua-api/apps/careers/state');return [r.status,await r.text()]}""")
            if st[0] != 200: raise RuntimeError(f"state endpoint returned {st[0]}")
            state = json.loads(st[1])
            if len(state.get('listings', [])) < 500: raise RuntimeError(f"state looks truncated ({len(state.get('listings', []))} listings)")
            with gzip.open(RAW/f"state-{now:%Y-%m-%d}.json.gz", 'wt') as f: f.write(st[1])
            loc = locations(state)
            def keep(x):
                c = classify(x['t']); g = loc.get(x['l'])
                return c and g and (g[0] == 'US' or not us_only(c))
            matched = [x for x in state['listings'] if keep(x)]
            # Full posting text only for Robotaxi roles (self-driving test roles link straight to the job id).
            picked = [x for x in matched if classify(x['t']) in ROBOTAXI]
            print("matched listings:", len(matched), flush=True)
            fresh = time.time() - 7*86400
            for x in picked:
                f = RAW/'jobs'/f"{x['id']}.json"
                if f.exists() and f.stat().st_mtime > fresh: continue
                try:
                    res = await pg.evaluate("""async(id)=>{const r=await fetch('/cua-api/careers/job/'+id);return [r.status,await r.text()]}""", x['id'])
                    if res[0] == 200: f.write_text(res[1])
                    else: print("detail failed", x['id'], res[0], flush=True)
                except Exception as e: print("detail error", x['id'], e, flush=True)
                await pg.wait_for_timeout(400)
            return f"state-{now:%Y-%m-%d}.json.gz"
        finally:
            await b.close()

def main():
    now = datetime.datetime.now(TZ)
    name = None
    for attempt in range(1, 4):
        try:
            name = asyncio.run(session(now)); break
        except Exception as e:
            print(f"attempt {attempt} failed: {e}", flush=True)
            if attempt < 3: time.sleep(60 * attempt)
    if not name: print("BLOCKED: could not read Tesla careers data after 3 tries"); sys.exit(2)
    # keep 30 days of raw snapshots
    snaps = sorted(RAW.glob('state-*.json*'))
    for old in snaps[:-30]: old.unlink()
    r = subprocess.run([sys.executable, str(ROOT/'tools'/'merge.py'), name, now.isoformat(timespec='seconds')] + sys.argv[1:])
    sys.exit(r.returncode)

if __name__ == '__main__': main()
