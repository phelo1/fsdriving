"""Render og-build/og.html to dist/og.png (1200x630) with headless Chromium. Called by build.mjs.
If rendering fails, reuse the last good image (og-build/last-og.png) so the build never ships without a card."""
import pathlib, shutil, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
src, out, keep = ROOT/'og-build'/'og.html', ROOT/'dist'/'og.png', ROOT/'og-build'/'last-og.png'
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        pg = b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        pg.goto(src.as_uri()); pg.wait_for_load_state('networkidle')
        pg.evaluate('document.fonts.ready'); pg.wait_for_function('document.images[0].complete && document.images[0].naturalWidth>0')
        pg.screenshot(path=str(out), clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630})
        b.close()
    from PIL import Image
    im = Image.open(out).convert('RGB'); im.save(out, optimize=True)
    if out.stat().st_size > 900_000:  # keep the worker small: drop to a 256-colour palette only if needed
        im.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(out, optimize=True)
    shutil.copyfile(out, keep); print('og.png', out.stat().st_size, 'bytes')
except Exception as e:
    print('WARNING og render failed:', e, file=sys.stderr)
    if keep.exists(): shutil.copyfile(keep, out); print('reused last good og.png', file=sys.stderr)
    else: sys.exit(1)
