"""Screenshot + smoke check of the timeline section. Usage: python3 tools/timeline_shot.py <url> <outdir>"""
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
            await pg.evaluate("document.querySelectorAll('.rv').forEach(e=>e.classList.add('in'));document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.getElementById('timeline').offsetTop-80)")
            await pg.wait_for_timeout(700)
            info = await pg.evaluate("({dots:document.querySelectorAll('#tl .tldot').length,launch:document.querySelectorAll('#tl .tllaunch').length,sig:document.querySelectorAll('#tl .tlsig').length,spans:document.querySelectorAll('#tl .tlspan').length})")
            sig = await pg.query_selector('#tl .tllaunch')
            box = await sig.bounding_box()
            if mob: await pg.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
            else: await pg.mouse.click(box['x']+box['width']/2, box['y']+box['height']/2)
            await pg.wait_for_timeout(400)
            tip = await pg.evaluate("!document.getElementById('tltip').hidden")
            await pg.screenshot(path=f"{out}/{name}-timeline.png")
            await pg.click(".tl-f button[data-r=tracked]"); await pg.wait_for_timeout(1200)
            await pg.click(".tl-s button[data-s=states]"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{out}/{name}-timeline-tracked.png")
            print(name, r.status, info, "tooltip", tip, "errors", errs)
            assert r.status == 200 and info['launch'] >= 9 and info['dots'] >= 2 and tip and not errs, 'timeline check failed'
            await ctx.close()
        await b.close()
asyncio.run(main())
