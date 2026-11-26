# python3 tools/hero_shot.py <url> <outdir> : hero screenshots + checks (dots, tooltip, click-to-drawer, overflow, console)
import sys, json, os
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
args = sys.argv[3:]
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", args=args)
    for name, vp, mob in [("desktop", (1440, 900), False), ("d1280", (1280, 800), False), ("mobile", (390, 844), True)]:
        ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
        pg = ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(url, wait_until="networkidle"); pg.wait_for_timeout(1800)
        r = {}
        r["live"] = pg.locator("#hxsvg .hd.l").count(); r["pend"] = pg.locator("#hxsvg .hd.p").count()
        r["overflow"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        r["heroH"] = pg.evaluate("document.querySelector('.hx').getBoundingClientRect().height")
        r["favicons"] = pg.evaluate("[...document.querySelectorAll('link[rel*=icon]')].map(l=>l.getAttribute('href'))")
        shot = f"{out}/{'desktop' if name=='desktop' else name}-hero-new.png"
        pg.screenshot(path=shot, clip={"x": 0, "y": 0, "width": vp[0], "height": min(r["heroH"] + 80, 2400)}, full_page=True)
        g = pg.locator('#hxsvg .hd.l[data-k="l4"]')
        if mob:
            g.tap(); pg.wait_for_timeout(300)
        else:
            g.hover(); pg.wait_for_timeout(300)
        r["tip"] = pg.evaluate("(t=>t.hidden?null:t.innerText)(document.getElementById('hxtip'))")
        if name == "desktop":
            pg.screenshot(path=f"{out}/desktop-hero-tooltip.png", clip={"x": 0, "y": 0, "width": vp[0], "height": r["heroH"]})
            pg.locator('#hxsvg .hd.p[data-k="p1"]').hover(); pg.wait_for_timeout(300)
            r["tipRed"] = pg.evaluate("document.getElementById('hxtip').innerText")
        # click (mobile: second tap opens)
        g.tap() if mob else g.click()
        pg.wait_for_timeout(1800)
        r["drawer"] = pg.evaluate("(d=>!d.hidden && document.getElementById('mdbody').innerText.split('\\n')[0])(document.getElementById('mdrawer'))")
        r["sel"] = pg.evaluate("window.__map && window.__map.sel")
        r["scrollY"] = pg.evaluate("scrollY")
        if name != "d1280": pg.screenshot(path=f"{out}/{name}-hero-click.png")
        r["errors"] = errs
        res[name] = r; ctx.close()
    b.close()
print(json.dumps(res, indent=1))
