# python3 tools/vs_bars_shot.py <base url> [shots dir] : Tesla vs Waymo metro footprint bars: counts, tooltips (hover/tap), overflow, screenshots
import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/'); shots = sys.argv[2] if len(sys.argv) > 2 else 'shots'; out = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    for name, vw, mob in [('desktop', 1440, False), ('mobile', 390, True)]:
        ctx = b.new_context(viewport={'width': vw, 'height': 900}, is_mobile=mob, has_touch=mob, device_scale_factor=2)
        pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        st = pg.goto(base + '/', wait_until='networkidle').status
        pg.evaluate('document.querySelectorAll(".rv").forEach(e=>e.classList.add("in"))')
        c = pg.locator('#vs-bars'); c.scroll_into_view_if_needed(); pg.evaluate('scrollBy(0,-120)'); pg.wait_for_timeout(500)
        r = {'status': st, 'bars': pg.evaluate('[...document.querySelectorAll("#vs-bars .fpr")].map(r=>r.querySelector(".fpn").textContent+": "+[...r.querySelectorAll(".fps")].map(s=>s.dataset.k+"="+s.textContent).join(" ")+" total="+r.querySelector(".fptot").textContent)')}
        r['clipped'] = pg.evaluate('[...document.querySelectorAll("#vs-bars .fps,#vs-bars .fptot")].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)')
        r['totInside'] = pg.evaluate('(()=>{const c=document.getElementById("vs-bars").getBoundingClientRect();return [...document.querySelectorAll("#vs-bars .fptot")].every(t=>t.getBoundingClientRect().right<=c.right-4)})()')
        tips = []
        for sel in ['.tesla .fps.lv', '.tesla .fps.hi', '.waymo .fps.an']:
            if mob: pg.locator('#vs-bars ' + sel).tap()
            else: pg.locator('#vs-bars ' + sel).hover()
            pg.wait_for_timeout(200); tips.append(pg.evaluate('(()=>{const t=document.getElementById("fptip");return t.hidden?null:t.innerText.replace(/\\s+/g," ")})()'))
        r['tips'] = tips
        if mob: pg.locator('#vs-bars .fph').tap()
        else: pg.mouse.move(2, 2)
        pg.wait_for_timeout(200); r['tipHiddenAfter'] = pg.evaluate('document.getElementById("fptip").hidden')
        c.screenshot(path=f'{shots}/{name}-vs-bars.png')
        r['overflow'] = pg.evaluate('document.documentElement.scrollWidth') - vw; r['errors'] = errs
        out[name] = r; ctx.close()
    b.close()
print(json.dumps(out, indent=1))
