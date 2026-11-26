# python3 tools/competitors_shot.py <base url> <outdir> : /competitors checks + screenshots (desktop 1440, mobile 390)
import sys, json, os
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/'), sys.argv[2]; os.makedirs(out, exist_ok=True)
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for name, vp, mob in [("desktop", (1440, 900), False), ("mobile", (390, 844), True)]:
        ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
        r = {}
        for path in ["/competitors", "/"]:
            pg = ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            resp = pg.goto(base + path, wait_until="networkidle"); pg.wait_for_timeout(800)
            k = "comp" if path != "/" else "home"
            r[k + "_status"] = resp.status
            r[k + "_overflow"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            r[k + "_nav"] = pg.evaluate("[...document.querySelectorAll('.tnav a')].map(a=>a.textContent+(a.getAttribute('aria-current')?'*':''))")
            r[k + "_optimist"] = pg.evaluate("[...document.querySelectorAll('a[href=\"https://optimistbot.com\"]')].map(a=>[a.textContent,a.rel,a.target])")
            if k == "comp":
                r["title"] = pg.title(); r["canonical"] = pg.evaluate("document.querySelector('link[rel=canonical]').href")
                r["ogurl"] = pg.evaluate("document.querySelector('meta[property=\"og:url\"]').content")
                r["icon"] = pg.evaluate("!!document.querySelector('link[rel=apple-touch-icon]')")
                vis = lambda: pg.evaluate("[...document.querySelectorAll('.ccard')].filter(e=>!e.hidden).map(e=>e.id.slice(2))")
                r["cards_all"] = vis()
                tabs = pg.evaluate("[...document.querySelectorAll('.ctabs button')].map(b=>b.dataset.f)")
                for t in tabs[1:]:
                    pg.click(f'.ctabs button[data-f="{t}"]'); pg.wait_for_timeout(150); r["tab_" + t] = vis()
                    r["rows_" + t] = pg.evaluate("[...document.querySelectorAll('.ctable tbody tr')].filter(e=>!e.hidden).length")
                r["overflow_after_tabs"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
                pg.click('.ctabs button[data-f="all"]'); pg.wait_for_timeout(150)
                r["sources"] = pg.evaluate("document.querySelectorAll('.cs,.csrc').length")
                r["comma_feat"] = pg.evaluate("(e=>e&&e.classList.contains('feat')&&e.getBoundingClientRect().width)(document.getElementById('c-comma'))")
                pg.screenshot(path=f"{out}/{name}-competitors.png", full_page=True)
                pg.screenshot(path=f"{out}/{name}-competitors-top.png")
            r[k + "_errors"] = errs; pg.close()
        res[name] = r; ctx.close()
    b.close()
print(json.dumps(res, indent=1))
