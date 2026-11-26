// Builds the HTML for the 1200x630 social card. Rendered to dist/og.png by tools/og.py.
// Inputs are real data only: live launch markets and hiring/pending places (x/y already projected to the 975x610 map).
export function ogHtml({ nationPath, statesPath, live = [], pend = [], cities, nSup, nCities, nStates, checked, carUrl }) {
  // Same encoding as the site hero: green = Robotaxi service live, red = hiring or coming soon (sized by open Robotaxi roles).
  const max = Math.max(...pend.map(c => c.roles), 1);
  const red = pend.slice().sort((a, b) => a.roles - b.roles).map(c => {
    const r = 3.4 + 5.6 * Math.sqrt(c.roles / max);
    return `<g transform="translate(${c.x},${c.y})">
      <circle r="${(r * 3.8).toFixed(1)}" fill="url(#halo)"/>
      <circle r="${(r * 2.2).toFixed(1)}" fill="none" stroke="#ff4d4d" stroke-opacity=".3" stroke-width="1"/>
      <circle r="${r.toFixed(1)}" fill="#ff3b3b" filter="url(#glow)"/>
      <circle r="${(r * .42).toFixed(1)}" fill="#fff1ee"/></g>`;
  }).join('');
  const green = live.map(c => `<g transform="translate(${c.x},${c.y})">
      <circle r="40" fill="url(#haloG)"/>
      <circle r="17" fill="none" stroke="#3ddc97" stroke-opacity=".55" stroke-width="1.4"/>
      <circle r="26" fill="none" stroke="#3ddc97" stroke-opacity=".2" stroke-width="1"/>
      <circle r="9" fill="#3ddc97" filter="url(#glow)"/>
      <circle r="3.6" fill="#eafff4"/></g>`).join('');
  const dots = red + green;
  const top = cities.slice().sort((a, b) => b.n - a.n).slice(0, 3);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden;background:#04050a}
body{position:relative;font-family:'Space Grotesk','Inter',sans-serif;color:#f3f5fa}
.bg{position:absolute;inset:0;background:
 radial-gradient(700px 420px at 78% 38%,rgba(255,59,59,.20),transparent 65%),
 radial-gradient(520px 360px at 18% 100%,rgba(70,140,255,.16),transparent 70%),
 radial-gradient(900px 500px at 50% 120%,rgba(255,80,60,.10),transparent 70%),
 linear-gradient(180deg,#06070d,#030308)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(120,150,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(120,150,255,.06) 1px,transparent 1px);background-size:40px 40px;
 -webkit-mask-image:radial-gradient(ellipse at 70% 40%,#000 20%,transparent 75%)}
.map{position:absolute;left:452px;top:26px;width:740px;height:463px}
.car{position:absolute;left:-30px;top:300px;width:700px;height:auto;
 -webkit-mask-image:radial-gradient(ellipse 52% 56% at 50% 46%,#000 62%,transparent 100%)}
.txt{position:absolute;left:56px;top:44px;width:620px}
.kick{display:flex;align-items:center;gap:10px;font:600 15px/1 'Inter',sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#ff8a80}
.live{width:10px;height:10px;border-radius:50%;background:#3ddc97;box-shadow:0 0 0 5px rgba(61,220,151,.2),0 0 18px #3ddc97}
h1{margin-top:20px;font-weight:700;font-size:60px;line-height:1.0;letter-spacing:-.025em;text-shadow:0 4px 40px rgba(0,0,0,.6)}
h1 em{font-style:normal;background:linear-gradient(90deg,#ff5a4f,#ff9a6b);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(255,70,60,.45))}
.stat{margin-top:22px;display:flex;align-items:flex-end;gap:22px}
.big{font-weight:700;font-size:96px;line-height:.82;letter-spacing:-.04em;background:linear-gradient(180deg,#fff,#ffb3a8 70%,#ff5a4f);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 30px rgba(255,60,60,.45))}
.big small{font-size:38px;letter-spacing:-.01em;margin-left:10px}
.sub{padding-bottom:6px;font:500 19px/1.35 'Inter',sans-serif;color:#c9cfdb}
.sub b{color:#fff}
.foot{position:absolute;right:40px;bottom:34px;display:flex;flex-direction:column;align-items:flex-end;gap:12px;font:500 14px/1 'Inter',sans-serif;color:#8d95a8}
.url{display:flex;align-items:center;gap:10px;padding:11px 18px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#fff;font-weight:600;font-size:19px;letter-spacing:.01em;box-shadow:0 0 30px rgba(255,60,60,.15)}
.url i{width:8px;height:8px;border-radius:50%;background:#3ddc97;box-shadow:0 0 10px #3ddc97}
.leg{position:absolute;right:40px;top:30px;display:flex;gap:18px;padding:10px 16px;border-radius:999px;background:rgba(6,8,14,.7);border:1px solid rgba(255,255,255,.12);font:600 16px/1 Inter,sans-serif;color:#dfe3ec}
.leg span{display:flex;align-items:center;gap:8px}.leg i{width:11px;height:11px;border-radius:50%}
.leg .g{background:#3ddc97;box-shadow:0 0 12px #3ddc97}.leg .r{background:#ff3b3b;box-shadow:0 0 12px #ff3b3b}
.vig{position:absolute;inset:0;box-shadow:inset 0 0 160px rgba(0,0,0,.85);pointer-events:none}
</style></head><body>
<div class="bg"></div><div class="grid"></div>
<svg class="map" viewBox="0 0 975 610">
 <defs>
  <filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="lineglow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="haloG"><stop offset="0" stop-color="#3ddc97" stop-opacity=".6"/><stop offset=".45" stop-color="#3ddc97" stop-opacity=".15"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></radialGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="#ff3b3b" stop-opacity=".55"/><stop offset=".45" stop-color="#ff3b3b" stop-opacity=".14"/><stop offset="1" stop-color="#ff3b3b" stop-opacity="0"/></radialGradient>
  <linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121a33"/><stop offset="1" stop-color="#0a0d1c"/></linearGradient>
 </defs>
 <path d="${nationPath}" fill="url(#land)" stroke="#5f8cff" stroke-opacity=".75" stroke-width="1.6" filter="url(#lineglow)"/>
 <path d="${statesPath}" fill="none" stroke="#7da2ff" stroke-opacity=".28" stroke-width=".8"/>
 ${dots}
</svg>
<img class="car" src="${carUrl}">
<div class="txt">
 <div class="kick"><span class="live"></span>Live tracker</div>
 <h1>Where Tesla is hiring <em>Robotaxi supervisors</em></h1>
 <div class="stat"><div class="big">${nCities}<small>cities</small></div>
  <div class="sub"><b>${nSup}</b> open supervisor roles<br>across <b>${nStates}</b> states</div></div>
</div>
<div class="vig"></div>
<div class="leg"><span><i class="g"></i>${live.length} live service</span><span><i class="r"></i>${pend.length} hiring / pending</span></div>
<div class="foot"><span class="url"><i></i>fsdriving.com</span><span>Live from Tesla careers · Updated ${checked} · Not affiliated with Tesla</span></div>
</body></html>`;
}
