import asyncio, json, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=False, args=["--disable-blink-features=AutomationControlled"])
        ctx = await b.new_context(viewport={"width":1400,"height":900}, locale="en-US")
        pg = await ctx.new_page()
        caught={}
        async def onresp(r):
            if 'cua-api' in r.url:
                try: caught[r.url]=(r.status, await r.text())
                except Exception as e: caught[r.url]=(r.status,str(e))
        pg.on("response", onresp)
        r = await pg.goto("https://www.tesla.com/careers/search/?query=robotaxi&site=US", wait_until="domcontentloaded", timeout=60000)
        print("page", r.status)
        await pg.wait_for_timeout(15000)
        print((await pg.title()))
        for u,(s,t) in caught.items(): print(u, s, len(t))
        st = await pg.evaluate("""async()=>{const r=await fetch('/cua-api/apps/careers/state');return [r.status,(await r.text())]}""")
        print('state fetch', st[0], len(st[1]))
        open('/tmp/state.json','w').write(st[1])
        await pg.screenshot(path="/tmp/tesla.png")
        await b.close()
asyncio.run(main())
