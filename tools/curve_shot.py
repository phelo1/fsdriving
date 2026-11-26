"""Screenshot + smoke check of the cities-over-time S-curve. Usage: python3 tools/curve_shot.py <url> <outdir>"""
import sys, asyncio
from playwright.async_api import async_playwright
url, out = sys.argv[1], sys.argv[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        for name, vp, mob in [("desktop", {"width": 1440, "height": 900}, False), ("mobile", {"width": 390, "height": 844}, True)]:
            ctx = await b.new_context(viewport=vp, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
            pg = await ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            r = await pg.goto(url, wait_until="networkidle")
            await pg.evaluate("document.querySelectorAll('.rv').forEach(e=>e.classList.add('in'));document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.getElementById('curve').offsetTop-70)")
            await pg.wait_for_timeout(600)
            info = await pg.evaluate("({steps:document.querySelectorAll('#cv .cvdot').length,launches:document.querySelectorAll('#cv .tllaunch').length,line:document.querySelectorAll('#cv .cvseg').length>0})")
            await pg.screenshot(path=f"{out}/{name}-curve.png")
            dots = await pg.query_selector_all('#cv .cvdot'); box = await dots[-1].bounding_box()
            if mob: await pg.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
            else: await pg.mouse.click(box['x']+box['width']/2, box['y']+box['height']/2)
            await pg.wait_for_timeout(600); tip = await pg.evaluate("!document.getElementById('cvtip').hidden && document.getElementById('cvtip').innerText.slice(0,80)")
            await pg.screenshot(path=f"{out}/{name}-curve-tooltip.png")
            await pg.click(".cv-f button[data-r=all]"); await pg.wait_for_timeout(300)
            all_l = await pg.evaluate("document.querySelectorAll('#cv .tllaunch').length")
            await pg.click(".cv-s button[data-s=all]"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{out}/{name}-curve-all.png")
            print(name, r.status, info, 'launchesAllRange', all_l, 'tip', repr(tip), 'errors', errs)
            assert r.status == 200 and info['line'] and info['steps'] >= 1 and all_l >= 9 and tip and not errs, 'curve check failed'
            await ctx.close()
        await b.close()
asyncio.run(main())
