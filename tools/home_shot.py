# Home page check: errors, sideways scroll, unified counters, time-lapse, Waymo button, heights, screenshots.
import sys, json, re
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765'
shots = sys.argv[2] if len(sys.argv) > 2 else 'shots'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    for name, vw, vh, mob in [('desktop', 1440, 900, False), ('mobile', 390, 844, True)]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1 if not mob else 2, is_mobile=mob, has_touch=mob)
        pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(base + '/', wait_until='networkidle'); pg.wait_for_timeout(1800)
        r = {}
        r['scrollW'] = pg.evaluate('document.documentElement.scrollWidth'); r['vw'] = vw
        r['height'] = pg.evaluate('document.documentElement.scrollHeight')
        r['header'] = pg.evaluate('document.querySelector(".top").getBoundingClientRect().height')
        r['hero'] = pg.evaluate('[...document.querySelectorAll(".hxs")].map(e=>e.querySelector("b").textContent+" "+e.querySelector("span").innerText.replace(/\\n/g," / "))')
        r['mcount'] = pg.evaluate('document.getElementById("mcount").innerText')
        r['score'] = pg.evaluate('[...document.querySelectorAll(".scr")].map(e=>e.innerText.replace(/\\s+/g," "))')
        r['lead'] = pg.evaluate('document.querySelector(".leadstats").innerText.replace(/\\s+/g," ")')
        r['upd'] = pg.evaluate('[...document.querySelectorAll("time[data-rel]")].map(t=>t.innerText+" | "+t.title)')
        r['next'] = pg.evaluate('[...document.querySelectorAll(".nxgo b")].map(e=>e.textContent)')
        r['sections'] = pg.evaluate('[...document.querySelectorAll("main>section")].map(s=>(s.id||s.className)+":"+Math.round(s.getBoundingClientRect().height))')
        r['gone'] = pg.evaluate('["#cities","#timeline","#grid",".mhead","#vsmap"].filter(s=>document.querySelector(s))')
        pg.evaluate('(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=500){scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}})()'); pg.wait_for_timeout(5000)
        pg.evaluate('scrollTo(0,0)'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{shots}/{name}-home-top.png')
        if not mob:
            pg.screenshot(path=f'{shots}/desktop-home-clean.png', full_page=True)
        # time-lapse
        d0 = pg.inner_text('#tldate')
        pg.click('#tlplay'); pg.wait_for_timeout(1500)
        mid = {'date': pg.inner_text('#tldate'), 'cnt': pg.inner_text('#tlcnt'), 'off': pg.evaluate('document.querySelectorAll(".hd.tloff").length'), 'playing': pg.evaluate('window.__hero.tl.playing')}
        pg.click('#tlplay'); pg.wait_for_timeout(400)
        paused = {'playing': pg.evaluate('window.__hero.tl.playing'), 'date': pg.inner_text('#tldate')}
        pg.wait_for_timeout(600); paused['stillSame'] = pg.inner_text('#tldate') == paused['date']
        if mob: pg.screenshot(path=f'{shots}/mobile-timelapse-mid.png')
        pg.click('#tlplay'); pg.wait_for_timeout(16000)
        end = {'date': pg.inner_text('#tldate'), 'cnt': pg.inner_text('#tlcnt'), 'off': pg.evaluate('document.querySelectorAll(".hd.tloff").length'), 'playing': pg.evaluate('window.__hero.tl.playing')}
        r['timelapse'] = {'start': d0, 'mid': mid, 'paused': paused, 'end': end}
        # Waymo button
        before = pg.evaluate('window.__map.F.op.waymo')
        pg.click('#showWaymo'); pg.wait_for_timeout(1500)
        r['waymo'] = {'before': before, 'after': pg.evaluate('window.__map.F.op.waymo'), 'chip': pg.evaluate('document.querySelector(".mchip[data-g=op][data-v=waymo]").classList.contains("on")'),
                      'mapTop': pg.evaluate('Math.round(document.getElementById("map").getBoundingClientRect().top)'), 'btn': pg.inner_text('#showWaymo'),
                      'mcount': pg.evaluate('document.getElementById("mcount").innerText'), 'wpins': pg.evaluate('document.querySelectorAll("#mmarks .w, #mmarks [class*=wy], #mmarks [data-op=waymo]").length')}
        # next-up drawer
        pg.evaluate('scrollTo(0,0)'); pg.wait_for_timeout(300)
        pg.click('.nxgo >> nth=0'); pg.wait_for_timeout(1500)
        r['nextDrawer'] = pg.evaluate('(()=>{const d=document.getElementById("mdrawer");return d&&!d.hidden?document.getElementById("mdbody").innerText.slice(0,80):null})()')
        r['scrollW2'] = pg.evaluate('document.documentElement.scrollWidth')
        r['errors'] = errs
        out[name] = r; ctx.close()
    b.close()
print(json.dumps(out, indent=1))
