# python3 tools/news_shot.py <base url> <outdir> : /news checks + screenshots (desktop 1440, mobile 390)
import sys, json, os
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/'), sys.argv[2]; os.makedirs(out, exist_ok=True)
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for name, vp, mob in [("desktop", (1440, 900), False), ("mobile", (390, 844), True)]:
        ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
        r = {}
        for path in ["/news", "/news/"]:
            pg = ctx.new_page(); errs = []; third = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("request", lambda q: third.append(q.url) if ("youtube" in q.url and "i.ytimg" not in q.url) else None)
            resp = pg.goto(base + path, wait_until="networkidle"); pg.wait_for_timeout(600)
            k = "news" if path == "/news" else "news_slash"
            r[k + "_status"] = resp.status; r[k + "_overflow"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            if k == "news":
                r["yt_requests_before_click"] = len(third)
                r["title"] = pg.title(); r["canonical"] = pg.evaluate("document.querySelector('link[rel=canonical]').href")
                r["ogurl"] = pg.evaluate("document.querySelector('meta[property=\"og:url\"]').content")
                r["twitter"] = pg.evaluate("!!document.querySelector('meta[name=\"twitter:card\"]')")
                r["icons"] = pg.evaluate("document.querySelectorAll('link[rel~=icon],link[rel=apple-touch-icon]').length")
                r["nav"] = pg.evaluate("[...document.querySelectorAll('.tnav a')].map(a=>a.textContent+(a.getAttribute('aria-current')?'*':''))")
                r["optimist"] = pg.evaluate("document.querySelectorAll('footer a[href=\"https://optimistbot.com\"]').length")
                r["counts"] = pg.evaluate("[...document.querySelectorAll('.nc')].map(e=>e.innerText.replace(/\\s+/g,' '))")
                vis = lambda: pg.evaluate("({sec:[...document.querySelectorAll('.nsec')].filter(s=>!s.hidden).map(s=>s.dataset.sec),inc:[...document.querySelectorAll('.ninc')].filter(e=>e.offsetParent).length,sub:!document.querySelector('.nsub').hidden})")
                pg.screenshot(path=f"{out}/{name}-news-top.png")
                r["all"] = vis()
                for t in ["rumours", "confirmed", "videos", "incidents"]:
                    pg.click(f'.nbar button[data-f="{t}"]'); pg.wait_for_timeout(200); r["tab_" + t] = vis()
                for v in ["confirmed", "debunked", "review", "all"]:
                    pg.click(f'.nsub button[data-v="{v}"]'); pg.wait_for_timeout(150); r["inc_" + v] = vis()["inc"]
                r["overflow_after_tabs"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
                pg.click('.nbar button[data-f="all"]'); pg.wait_for_timeout(200); r["back_all"] = vis()["sec"]
                r["links"] = pg.evaluate("document.querySelectorAll('.nsrc').length")
                r["emdash"] = pg.evaluate("document.documentElement.outerHTML.includes('\\u2014')")
                r["errors_before_play"] = list(errs)
                pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(300)
                pg.screenshot(path=f"{out}/{name}-news.png", full_page=True)
                pg.click('.nthumb'); pg.wait_for_timeout(2500)
                r["iframe"] = pg.evaluate("(f=>f&&f.src)(document.querySelector('.nframe'))")
            r[k + "_errors"] = errs; pg.close()
        res[name] = r; ctx.close()
    b.close()
print(json.dumps(res, indent=1))
