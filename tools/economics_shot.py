# python3 tools/economics_shot.py <base url> <outdir> : /economics checks + screenshots (desktop 1440, mobile 390) + nav/overflow on all pages
import sys, json, os
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/'), sys.argv[2]; os.makedirs(out, exist_ok=True)
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for name, vp, mob in [("desktop", (1440, 900), False), ("mobile", (390, 844), True)]:
        ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
        r = {}
        for path in ["/economics", "/economics/", "/", "/fsd", "/competitors", "/news"]:
            pg = ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            resp = pg.goto(base + path, wait_until="networkidle"); pg.wait_for_timeout(700)
            r[path] = {"status": resp.status, "errors": errs, "overflow": pg.evaluate("document.documentElement.scrollWidth - innerWidth"),
                    "nav": pg.evaluate("[...document.querySelectorAll('.tnav a')].map(a=>a.innerText.trim().replace(/\\n/g,'/')+(a.getAttribute('aria-current')?'*':''))"),
                    "navOverflow": pg.evaluate("(()=>{const n=document.querySelector('.tnav');return n.scrollWidth-n.clientWidth})()"),
                    "headerH": pg.evaluate("document.querySelector('header.top').offsetHeight"),
                    "emdash": pg.evaluate("document.documentElement.outerHTML.includes('\\u2014')")}
            if path == "/economics":
                k = r[path]; q = lambda: pg.evaluate("window.__econ.kpi")
                k["title"] = pg.title(); k["canonical"] = pg.evaluate("document.querySelector('link[rel=canonical]').href")
                k["og"] = pg.evaluate("document.querySelector('meta[property=\"og:url\"]').content")
                k["twitter"] = pg.evaluate("!!document.querySelector('meta[name=\"twitter:card\"]')")
                k["icons"] = pg.evaluate("document.querySelectorAll('link[rel~=icon]').length")
                k["optimist"] = pg.evaluate("document.querySelectorAll('a[href=\"https://optimistbot.com\"]').length")
                k["base"] = q()
                for ps in ["conservative", "bull", "base"]:
                    pg.click(f'.eps button[data-p="{ps}"]'); pg.wait_for_timeout(100); k["preset_" + ps] = q()
                d0 = pg.evaluate("document.querySelector('#ec .lr').getAttribute('d')")
                pg.evaluate("(()=>{const i=document.querySelector('#s-u');i.value=90;i.dispatchEvent(new Event('input'))})()"); pg.wait_for_timeout(100)
                k["slider_u90"] = q(); k["chart_changed"] = d0 != pg.evaluate("document.querySelector('#ec .lr').getAttribute('d')")
                k["custom_shown"] = pg.evaluate("!document.querySelector('.ecustom').hidden")
                pg.click('.euse[data-fare="8.17"]'); pg.wait_for_timeout(700); k["use_817"] = pg.evaluate("document.querySelector('#o-f').textContent")
                pg.click('.ehz button[data-h="36"]'); pg.wait_for_timeout(100); k["end36"] = pg.evaluate("document.querySelector('#eend').innerText")
                pg.click('.eps button[data-p="base"]'); pg.click('.ehz button[data-h="24"]'); pg.wait_for_timeout(100)
                pg.evaluate("document.querySelector('#ec').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
                bb = pg.query_selector('#ec .hov').bounding_box(); pg.mouse.move(bb["x"] + bb["width"] * .6, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(150)
                k["tooltip"] = pg.evaluate("document.querySelector('#etip').hidden?null:document.querySelector('#etip').innerText.replace(/\\n/g,' | ')")
                k["benchmarks"] = pg.evaluate("[...document.querySelectorAll('.eb h3')].map(e=>e.textContent)")
                k["overflow_after"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
                pg.mouse.move(5, 5); pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(400)
                pg.screenshot(path=f"{out}/{name}-economics-top.png"); pg.screenshot(path=f"{out}/{name}-economics.png", full_page=True)
            pg.close()
        res[name] = r; ctx.close()
    sm = b.new_page(); rs = sm.goto(base + "/sitemap.xml"); t = rs.text(); res["sitemap"] = {"status": rs.status, "economics": "/economics</loc>" in t, "locs": t.count("<loc>")}
    b.close()
print(json.dumps(res, indent=1))
