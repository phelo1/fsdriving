# python3 tools/fsd_shot.py <base url> <outdir> : /fsd checks + screenshots (desktop 1440, mobile 390)
import sys, json, os
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/'), sys.argv[2]; os.makedirs(out, exist_ok=True)
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for name, vp, mob in [("desktop", (1440, 900), False), ("mobile", (390, 844), True)]:
        ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
        r = {}
        for path in ["/fsd", "/fsd/"]:
            pg = ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            resp = pg.goto(base + path, wait_until="networkidle"); pg.wait_for_timeout(600)
            k = "fsd" if path == "/fsd" else "fsd_slash"
            r[k + "_status"] = resp.status; r[k + "_errors"] = errs
            r[k + "_overflow"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            if k == "fsd":
                r["title"] = pg.title(); r["canonical"] = pg.evaluate("document.querySelector('link[rel=canonical]').href")
                r["ogurl"] = pg.evaluate("document.querySelector('meta[property=\"og:url\"]').content")
                r["twitter"] = pg.evaluate("!!document.querySelector('meta[name=\"twitter:card\"]')")
                r["icon"] = pg.evaluate("[...document.querySelectorAll('link[rel~=icon],link[rel=apple-touch-icon]')].map(l=>l.getAttribute('href'))")
                r["nav"] = pg.evaluate("[...document.querySelectorAll('.tnav a')].map(a=>a.textContent+(a.getAttribute('aria-current')?'*':''))")
                r["optimist"] = pg.evaluate("[...document.querySelectorAll('a[href=\"https://optimistbot.com\"]')].map(a=>[a.textContent,a.rel,a.target])")
                r["pill"] = pg.evaluate("document.querySelector('.fpill').textContent.trim()")
                r["stats"] = pg.evaluate("[...document.querySelectorAll('.fs b')].map(e=>e.textContent)")
                r["cards"] = pg.evaluate("[...document.querySelectorAll('.fcard')].map(e=>e.id+': '+e.querySelector('.fver').textContent)")
                vis = lambda: pg.evaluate("[...document.querySelectorAll('.ftl .frel')].filter(e=>!e.hidden && e.offsetParent).length")
                r["tl_all"] = vis()
                for t in ["hw4", "hw3", "ct", "semi", "all"]:
                    pg.click(f'.ftabs button[data-f="{t}"]'); pg.wait_for_timeout(150); r["tab_" + t] = vis()
                r["overflow_after_tabs"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
                r["sources"] = pg.evaluate("document.querySelectorAll('.cs,.csrc').length")
                r["emdash"] = pg.evaluate("document.body.innerText.includes('\\u2014')")
                pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(300); pg.screenshot(path=f"{out}/{name}-fsd.png", full_page=True)
                pg.screenshot(path=f"{out}/{name}-fsd-top.png")
            pg.close()
        res[name] = r; ctx.close()
    b.close()
print(json.dumps(res, indent=1))
