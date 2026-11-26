#!/usr/bin/env python3
"""Screenshot + interaction check of the Tesla vs Waymo section. Usage: vs_shot.py [url]"""
import sys, os
from playwright.sync_api import sync_playwright
url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots')
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    for name, vp, mob in [('desktop', {'width': 1440, 'height': 900}, False), ('mobile', {'width': 390, 'height': 844}, True)]:
        pg = b.new_page(viewport=vp, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text)); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url, wait_until='networkidle'); pg.add_style_tag(content='.rv{opacity:1!important;transform:none!important}')
        sec = pg.locator('#vs'); sec.scroll_into_view_if_needed(); pg.wait_for_timeout(500)
        sec.screenshot(path=f'{out}/{name}-vs.png')
        n = pg.locator('.vpin').count(); rows = pg.locator('#vstable tbody tr').count()
        pg.locator('.vpin[data-id=dfw] .vhit').click(force=True); pg.wait_for_timeout(300)
        ok = pg.locator('#vstip').is_visible() and 'Dallas' in pg.locator('#vstip').inner_text()
        pg.locator('.vsmap').screenshot(path=f'{out}/{name}-vs-tip.png')
        pg.locator('.vs-f button[data-c=waymo]').click(); pg.wait_for_timeout(500)
        vis = pg.locator('#vstable tbody tr:visible').count()
        pg.locator('.vsmap').screenshot(path=f'{out}/{name}-vs-waymo.png')
        pg.locator('.vs-f button[data-c=tesla]').click(); pg.wait_for_timeout(500)
        vt = pg.locator('#vstable tbody tr:visible').count()
        pg.locator('.vsmap').screenshot(path=f'{out}/{name}-vs-tesla.png')
        sw = pg.evaluate('document.documentElement.scrollWidth'); print(name, 'pins', n, 'rows', rows, 'tip', ok, 'waymo rows', vis, 'tesla rows', vt, 'scrollWidth', sw)
        assert n > 30 and ok and 0 < vis < rows and 0 < vt < rows and sw <= vp['width'] + 1
    b.close()
print('console errors:', errs); sys.exit(1 if errs else 0)
