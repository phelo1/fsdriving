# python3 tools/fleet_shot.py <base url> [shots dir] : Fleet growth section checks (hover, linear/log, Waymo toggle) + Cybercab VIN block (KPIs, batch tooltips) + screenshots
import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/'); shots = sys.argv[2] if len(sys.argv) > 2 else 'shots'; out = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    for name, vw, mob in [('desktop', 1440, False), ('mobile', 390, True)]:
        ctx = b.new_context(viewport={'width': vw, 'height': 900}, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        st = pg.goto(base + '/', wait_until='networkidle').status
        pg.evaluate('document.querySelectorAll(".rv").forEach(e=>e.classList.add("in"))')
        sec = pg.locator('#fleet'); sec.scroll_into_view_if_needed(); pg.wait_for_timeout(600)
        r = {'status': st, 'kpi': pg.evaluate('[...document.querySelectorAll(".fk")].map(e=>e.innerText.replace(/\\s+/g," "))')}
        ticks = lambda: pg.evaluate('[...document.querySelectorAll("#flsvg .yl")].map(e=>e.textContent)')
        r['ticksLin'] = ticks()
        box = pg.locator('#flsvg').bounding_box()
        if mob: pg.locator('#flsvg').tap(position={'x': box['width'] * 0.8, 'y': box['height'] / 2})
        else: pg.mouse.move(box['x'] + box['width'] * 0.8, box['y'] + box['height'] / 2)
        pg.wait_for_timeout(300); r['tip'] = pg.evaluate('(()=>{const t=document.getElementById("fltip");return t.hidden?null:t.innerText.replace(/\\s+/g," ")})()')
        if not mob: sec.screenshot(path=f'{shots}/desktop-fleet.png')
        else: sec.screenshot(path=f'{shots}/mobile-fleet.png')
        pg.click('.fl-sc button[data-sc=log]'); pg.wait_for_timeout(300)
        r['log'] = pg.evaluate('window.__fleet.log'); r['ticksLog'] = ticks()
        if not mob: sec.screenshot(path=f'{shots}/desktop-fleet-log.png')
        pg.click('.fl-sc button[data-sc=lin]'); pg.wait_for_timeout(200); r['backToLin'] = not pg.evaluate('window.__fleet.log')
        pg.click('#flw'); pg.wait_for_timeout(200); r['waymoOff'] = pg.evaluate('document.querySelectorAll("#flsvg .flline.w").length') == 0
        pg.click('#flw'); pg.wait_for_timeout(200); r['waymoOn'] = pg.evaluate('document.querySelectorAll("#flsvg .flline.w").length') == 1
        r['fit'] = pg.evaluate('document.querySelectorAll("#flsvg .flfit").length'); r['dots'] = pg.evaluate('document.querySelectorAll("#flsvg .fldot").length')
        r['height'] = round(sec.bounding_box()['height']); r['pageH'] = pg.evaluate('document.documentElement.scrollHeight')
        cv = pg.locator('#cybercab-vin'); cv.scroll_into_view_if_needed(); pg.wait_for_timeout(400)
        r['cvKpi'] = pg.evaluate('[...document.querySelectorAll("#cybercab-vin .ck")].map(e=>e.innerText.replace(/\\s+/g," "))')
        r['cvBatches'] = pg.evaluate('window.__cvin.batches'); r['cvBars'] = pg.evaluate('window.__cvin.bars')
        r['cvMilestones'] = pg.evaluate('[...document.querySelectorAll("#cybercab-vin .cbvms li")].map(e=>e.innerText.replace(/\\s+/g," "))')
        hb = pg.locator('#cbvsvg .cbvhitbox'); tips = []
        for i in [2, hb.count() - 3, hb.count() - 1]:
            bx = hb.nth(i).bounding_box()
            if mob: pg.touchscreen.tap(bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] * .7)
            else: pg.mouse.move(bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] * .7)
            pg.wait_for_timeout(200); tips.append(pg.evaluate('(()=>{const t=document.getElementById("cbvtip");return t.hidden?null:t.innerText.replace(/\\s+/g," ")})()'))
        r['cvTips'] = tips
        cv.screenshot(path=f'{shots}/{name}-cybercab-vin.png')
        r['overflow'] = pg.evaluate('document.documentElement.scrollWidth') - vw; r['errors'] = errs
        out[name] = r; ctx.close()
    b.close()
print(json.dumps(out, indent=1))
