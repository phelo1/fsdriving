#!/usr/bin/env python3
"""Smoke test + screenshots for the main interactive map (src/map.js).
Usage: python3 tools/map_check.py <url> [outdir]   (default outdir: shots/)
Checks desktop and mobile: pins render, US/World/Europe views, Tesla/Waymo toggles, role + status filters, search,
city drawer, no horizontal scroll, zero console errors. Exits 1 on any failure."""
import sys, os
from playwright.sync_api import sync_playwright
url = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shots')
errs, fails = [], []
def ok(cond, msg):
    if not cond: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    for name, vp, mob in [('desktop', {'width': 1440, 'height': 960}, False), ('mobile', {'width': 390, 'height': 844}, True)]:
        pg = b.new_page(viewport=vp, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        pg.on('console', lambda m: m.type == 'error' and errs.append(f'{name}: {m.text}')); pg.on('pageerror', lambda e: errs.append(f'{name}: {e}'))
        pg.goto(url, wait_until='networkidle')
        pg.locator('#map').scroll_into_view_if_needed(); pg.wait_for_timeout(700)
        n = lambda: pg.locator('#mmarks .node').count()
        cnt = lambda: pg.locator('#mcount').inner_text()
        us = n(); ok(us > 15, f'{name} US pins {us}')
        pg.locator('#map').screenshot(path=f'{out}/{name}-map-us.png')
        c0 = cnt()
        pg.locator('.mchip[data-v=waymo]').click(); pg.wait_for_timeout(450); tes = n(); c1 = cnt()
        ok('Waymo' not in c1, f'{name} waymo off still counted')
        pg.locator('.mchip[data-v=waymo]').click(); pg.locator('.mchip[data-v=tesla]').click(); pg.wait_for_timeout(450); way = n()
        pg.locator('#map').screenshot(path=f'{out}/{name}-map-waymo-only.png')
        pg.locator('.mchip[data-v=tesla]').click(); pg.wait_for_timeout(300)
        pg.locator('.mchip[data-v=hire]').click(); pg.wait_for_timeout(450); nohire = n(); pg.locator('.mchip[data-v=hire]').click()
        pg.locator('.mchip[data-v=selfdriving]').click(); pg.wait_for_timeout(450); sd = n(); c2 = cnt()
        ok('self-driving' in c2, f'{name} self-driving count missing')
        pg.locator('.mseg button[data-view=world]').click(); pg.wait_for_timeout(1100); world = n()
        ok(world > 5, f'{name} world pins {world}')
        pg.locator('#map').screenshot(path=f'{out}/{name}-map-world.png')
        pg.locator('.mseg button[data-view=europe]').click(); pg.wait_for_timeout(1200); eu = n()
        pg.locator('#map').screenshot(path=f'{out}/{name}-map-europe.png')
        pg.locator('.mchip[data-v=selfdriving]').click(); pg.locator('.mseg button[data-view=us]').click(); pg.wait_for_timeout(1100)
        pg.locator('#msq').fill('plano'); pg.wait_for_timeout(250)
        hits = pg.locator('#msres li[data-i]').count(); ok(hits >= 1, f'{name} search hits {hits}')
        pg.keyboard.press('Enter'); pg.wait_for_timeout(1300)
        dr = pg.locator('#mdrawer.open'); ok(dr.count() == 1, f'{name} drawer did not open from search')
        txt = pg.locator('#mdbody').inner_text() if dr.count() else ''
        ok('Dallas' in txt and 'Plano' in txt and 'Waymo' in txt, f'{name} drawer content: {txt[:80]!r}')
        links = pg.locator('#mdbody a[href*="tesla.com/careers/search/job/"]').count(); ok(links > 3, f'{name} drawer job links {links}')
        pg.screenshot(path=f'{out}/{name}-map-drawer.png') if mob else pg.locator('#map').screenshot(path=f'{out}/{name}-map-drawer.png')
        pg.locator('#mclose').click(); pg.wait_for_timeout(400)
        pg.locator('.mseg button[data-view=us]').click(); pg.wait_for_timeout(900)
        # click a pin directly
        pg.locator('#mmarks .node.mk').first.click(force=True); pg.wait_for_timeout(700); ok(pg.locator('#mdrawer.open').count() == 1, f'{name} pin click no drawer')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        sw = pg.evaluate('document.documentElement.scrollWidth'); ok(sw <= vp['width'] + 1, f'{name} horizontal scroll {sw}')
        print(name, dict(us=us, teslaOnly=tes, waymoOnly=way, noHiring=nohire, withSelfDriving=sd, world=world, europe=eu, searchHits=hits, drawerLinks=links))
        print('  counts default:', c0.replace('\n', ' '))
        print('  counts +selfdriving:', c2.replace('\n', ' '))
    b.close()
print('console errors:', errs); print('failures:', fails)
sys.exit(1 if errs or fails else 0)
