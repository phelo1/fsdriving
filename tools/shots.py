import sys, asyncio
from playwright.async_api import async_playwright
base, out = sys.argv[1], sys.argv[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        for name, vp, mob in [("desktop",{"width":1440,"height":900},False),("mobile",{"width":390,"height":844},True)]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
            pg = await ctx.new_page(); errs=[]
            pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            r = await pg.goto(base, wait_until="networkidle", timeout=60000)
            await pg.wait_for_timeout(1800)
            await pg.evaluate("document.querySelectorAll('.rv').forEach(e=>e.classList.add('in'))")
            await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f"{out}/{name}-top.png")
            await pg.evaluate("document.documentElement.style.scrollBehavior='auto';document.getElementById('map').scrollIntoView()"); await pg.wait_for_timeout(800)
            await pg.screenshot(path=f"{out}/{name}-map.png")
            await pg.screenshot(path=f"{out}/{name}-full.png", full_page=True)
            pins = await pg.evaluate("document.querySelectorAll('.pin:not(.off)').length")
            cards = await pg.evaluate("document.querySelectorAll('.city').length")
            print(name, "status", r.status, "pins", pins, "city cards", cards, "errors:", errs)
            assert r.status == 200 and cards > 0 and not errs, 'Live smoke check failed'
            await pg.evaluate("document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.getElementById('lead').offsetTop-90)")
            await pg.wait_for_timeout(400); await pg.screenshot(path=f"{out}/{name}-lead.png")
            await pg.evaluate("window.scrollTo(0,document.querySelector('.waith').offsetTop-90)")
            await pg.wait_for_timeout(400); await pg.screenshot(path=f"{out}/{name}-waiting.png")
            await ctx.close()
        await b.close()
asyncio.run(main())
