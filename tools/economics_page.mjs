// Builds dist/economics/index.html. Tracked facts come from data/fleet.json and data/economics.json (every figure linked).
// Everything the visitor can move (utilization, trips, fare, margin, growth, cap, P/E) is a modelled assumption and is labelled as one.
export function economicsHtml({ E, FL, fl, esc, headTags, topHeader, footerHtml, css }) {
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtD = d => { const [y, m, dd] = d.slice(0, 10).split('-'); return `${+dd} ${MO[m - 1]} ${y}`; };
  const T = FL.operators.tesla, N0 = T.txdmvTotal, X = E.tsla, W = FL.benchmark.waymoUS, TP = E.throughput;
  const r1 = v => Math.round(v * 1000) / 10;
  const fitW = r1(fl.wow), m30W = r1(fl.m30.wow);
  const waymoRPV = TP.waymoWeeklyRides / 7 / W.n; // derived: rides per vehicle per day
  const rt = E.benchmarks.find(b => b.id === 'rt-90d'), aus = E.benchmarks.find(b => b.id === 'rt-cities').rows.find(r => r.city === 'Austin');
  const card = E.benchmarks.find(b => b.id === 'austin-card');
  const fare5 = card.card.base + card.card.perMile * 5;
  const presets = {
    conservative: { name: 'Conservative', u: 40, t: 8, f: fare5, m: 10, g: 3, k: 2, pe: 20,
      why: [`40% of registered cars run on a given day`, `8 paid trips per running car per day`, `$${fare5.toFixed(2)} fare: a 5 mile ride on the reported Austin card`, `10% net margin`, `3% weekly growth, fleet capped at 5,000`, `20x P/E`] },
    base: { name: 'Base', u: 60, t: 12, f: rt.tesla.fare, m: 20, g: m30W, k: 5, pe: 30,
      why: [`60% of registered cars run on a given day`, `12 paid trips per running car per day`, `$${rt.tesla.fare.toFixed(2)} fare: Tesla's 90 day median receipt`, `20% net margin`, `${m30W}% weekly growth (tracked last 30 days), capped at 20,000`, `30x P/E`] },
    bull: { name: 'Bull', u: 80, t: Math.round(waymoRPV), f: aus.tesla, m: 30, g: fitW, k: 8, pe: 50,
      why: [`80% of registered cars run on a given day`, `${Math.round(waymoRPV)} paid trips per car per day, near Waymo's derived rate`, `$${aus.tesla.toFixed(2)} fare: Tesla's Austin median receipt`, `30% net margin`, `${fitW}% weekly growth (tracked fit), capped at 100,000`, `50x P/E`] }
  };
  const CAPS = [2500, 3500, 5000, 7500, 10000, 20000, 35000, 50000, 100000, 150000, 250000];
  const cfg = { N0, fleetDate: T.txdmvAt, fitW, m30W, mcap: X.marketCap, shares: X.sharesOutstanding, presets, CAPS };
  const li = s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a>`;
  const usd = v => '$' + v.toFixed(2);
  const bars = (rows) => { const mx = Math.max(...rows.map(r => r[1])); return `<div class="ebars">${rows.map(([k, v, cls]) => `<div class="ebar ${cls}"><span>${esc(k)}</span><i style="--w:${(v / mx * 100).toFixed(1)}%"></i><b>${usd(v)}</b></div>`).join('')}</div>`; };
  const useBtn = b => b.useFare ? `<button type="button" class="euse" data-fare="${b.useFare}">Use ${usd(b.useFare)} in model <small>${esc(b.useLabel)}</small></button>` : '';
  const bench = E.benchmarks.map(b => {
    let viz = '';
    if (b.id === 'rt-90d') viz = bars([['Tesla', b.tesla.fare, 't'], ['Waymo', b.waymo.fare, 'w']]) + `<p class="emeta">Per mile: Tesla ${usd(b.tesla.perMile)}, Waymo ${usd(b.waymo.perMile)}. Avg trip ${b.tesla.trip} vs ${b.waymo.trip} mi. ${b.tesla.rides.toLocaleString('en-US')} Tesla and ${b.waymo.rides.toLocaleString('en-US')} Waymo receipts.</p>`;
    if (b.id === 'rt-cities') viz = `<table class="etab"><thead><tr><th>City</th><th>Tesla</th><th>Waymo</th></tr></thead><tbody>${b.rows.map(r => `<tr><th>${esc(r.city)}</th><td>${usd(r.tesla)} <small>${usd(r.teslaPM)}/mi, ${r.teslaN.toLocaleString('en-US')} rides</small></td><td>${usd(r.waymo)} <small>${usd(r.waymoPM)}/mi, ${r.waymoN} rides</small></td></tr>`).join('')}</tbody></table>`;
    if (b.id === 'obi-sf') viz = bars([['Tesla', b.avg.tesla, 't'], ['Lyft', b.avg.lyft, 'l'], ['UberX', b.avg.uber, 'u'], ['Waymo', b.avg.waymo, 'w']]) + `<p class="emeta">Per km: Tesla ${usd(b.perKm.tesla)}, Waymo ${usd(b.perKm.waymo)}.</p>`;
    if (b.id === 'obi-q1') viz = `<div class="echg">${[['Tesla', b.changes.tesla, 't'], ['Waymo', b.changes.waymo, 'w'], ['Lyft', b.changes.lyft, 'l'], ['Uber', b.changes.uber, 'u']].map(([k, v, c]) => `<div class="${c}"><b>+${v}%</b><span>${k}</span></div>`).join('')}</div><p class="emeta">Average fare change vs Nov 2025 to Jan 2026. Tesla daily average ranged ${usd(b.teslaDailyRange[0])} to ${usd(b.teslaDailyRange[1])}.</p>`;
    if (b.id === 'austin-card') viz = `<div class="ecard"><b>${usd(b.card.base)}</b><span>base</span><em>+</em><b>${usd(b.card.perMile)}</b><span>per mile</span></div>`;
    return `<article class="eb" id="b-${b.id}"><div class="ebh"><span class="ebk ${b.kind}">${b.kind === 'receipts' ? 'Rider receipts' : b.kind === 'study' ? 'Price study' : 'Rate card'}</span><span class="ebd">${esc(b.city)} · ${esc(b.period)}</span></div>
<h3>${esc(b.title)}</h3>${viz}<p class="etk">${esc(b.takeaway)}</p><div class="ebf"><span class="esrc">Source: ${li(b.source)}</span>${useBtn(b)}</div></article>`;
  }).join('\n');
  const slider = (id, label, min, max, step, hint) => `<div class="esl"><div class="esl-h"><label for="s-${id}">${label}</label><output id="o-${id}" for="s-${id}"></output></div><input type="range" id="s-${id}" min="${min}" max="${max}" step="${step}" data-k="${id}"><small>${hint}</small></div>`;
  const title = 'Economics & Fare Benchmarks | FSDriving';
  const desc = `Estimate Tesla Robotaxi fleet revenue, profit and TSLA market cap impact from the live ${N0.toLocaleString('en-US')} car Texas fleet, with your own assumptions. Plus dated fare benchmarks: Tesla vs Waymo vs Uber and Lyft, every figure sourced.`;
  const presetBtns = Object.entries(presets).map(([k, p]) => `<button type="button" data-p="${k}" aria-pressed="false">${p.name}</button>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${headTags({ title, desc, path: 'economics' })}
<style>${css}</style></head><body class="cpage epage">
<div class="grain" aria-hidden="true"></div>
${topHeader('economics')}
<main>
<section class="chero ehero">
  <p class="ekick"><span class="hxlive"></span>Estimator · not financial advice</p>
  <h1 class="hxh">Robotaxi economics, <em>run the numbers</em></h1>
  <p class="clede">What could Tesla's Robotaxi fleet be earning today, and what might it add to Tesla's market cap? Start from the fleet we track every day, pick a scenario or move the sliders, and see the math. Then compare real fares against Waymo, Uber and Lyft.</p>
  <div class="ejump"><a href="#model">Estimator</a><a href="#pricing">Fare benchmarks</a><a href="#formula">How it works</a></div>
  <p class="elbl fact">Tracked facts</p>
  <div class="efacts">
    <div class="ef"><b>${N0.toLocaleString('en-US')}</b><span>Tesla Robotaxi vehicles registered in Texas (${T.models.Cybercab.toLocaleString('en-US')} Cybercab, ${T.models['Model Y'].toLocaleString('en-US')} Model Y), <a href="${esc(T.dmvUrl)}" target="_blank" rel="noopener">TxDMV</a>, ${fmtD(T.txdmvAt)}</span></div>
    <div class="ef"><b>${fitW}%<small>/wk</small></b><span>registration growth, log-linear fit (last 30 days: ${m30W}%/wk), <a href="/#fleet">fleet tracker</a></span></div>
    <div class="ef"><b>${esc(X.marketCapLabel)}</b><span>TSLA market cap, $${X.price.toFixed(2)} close on ${fmtD(X.priceDate)}, <a href="${esc(X.sources[0].url)}" target="_blank" rel="noopener">StockAnalysis</a></span></div>
    <div class="ef"><b>${usd(rt.tesla.fare)}</b><span>Tesla median paid ride, last 90 days (Waymo ${usd(rt.waymo.fare)}), <a href="#pricing">benchmarks</a></span></div>
  </div>
</section>
<section class="csec emodel" id="model" aria-labelledby="m-h">
  <div class="emh"><div><p class="elbl est">Modelled estimates</p><h2 id="m-h" class="ch2">Fleet revenue and market cap estimator</h2></div>
  <div class="eps" role="group" aria-label="Scenario">${presetBtns}<span class="ecustom" hidden>Custom</span></div></div>
  <p class="epwhy" id="pwhy"></p>
  <div class="ekpis" aria-live="polite">
    <div class="ek"><span>Est. daily fleet revenue</span><b id="k-day"></b><small id="k-day-s"></small></div>
    <div class="ek"><span>Current annualized run-rate</span><b id="k-ann"></b><small id="k-ann-s"></small></div>
    <div class="ek"><span>Forward 12-month projection</span><b id="k-fwd"></b><small id="k-fwd-s"></small></div>
    <div class="ek hi"><span>Implied TSLA market cap impact</span><b id="k-cap"></b><small id="k-cap-s"></small></div>
  </div>
  <div class="egrid">
    <div class="ectl">
      ${slider('u', 'Utilization', 10, 100, 1, 'Share of registered cars giving paid rides on a given day')}
      ${slider('t', 'Paid trips per active car per day', 1, 30, 1, `Waymo derived: about ${waymoRPV.toFixed(1)}/day (see How it works)`)}
      ${slider('f', 'Average fare', 4, 30, 0.01, `Tracked: Tesla median ${usd(rt.tesla.fare)}, Austin ${usd(aus.tesla)}`)}
      ${slider('m', 'Net margin', 0, 60, 1, 'Profit kept after vehicles, energy, support, insurance')}
      ${slider('g', 'Fleet growth per week', 0, 20, 0.1, `<span class="egb">Tracked: <button type="button" data-g="${fitW}">fit ${fitW}%</button><button type="button" data-g="${m30W}">30 day ${m30W}%</button></span>`)}
      ${slider('k', 'Fleet cap', 0, CAPS.length - 1, 1, 'Growth slows as the fleet nears this ceiling, so it never runs away')}
      ${slider('pe', 'P/E multiple', 15, 50, 1, 'Multiple applied to forward 12-month net profit')}
    </div>
    <div class="echart">
      <div class="ech"><div><b>Annualized run-rate</b><span class="elg"><i class="r"></i>Revenue<i class="p"></i>Net profit</span></div>
      <div class="ehz" role="group" aria-label="Horizon"><button type="button" data-h="12" aria-pressed="false">12m</button><button type="button" data-h="24" aria-pressed="true">24m</button><button type="button" data-h="36" aria-pressed="false">36m</button></div></div>
      <div class="esvg"><svg id="ec" role="img" aria-label="Projected annualized revenue and profit"></svg><div class="etip" id="etip" hidden></div></div>
      <p class="eend" id="eend"></p>
    </div>
  </div>
  <details class="eform" id="formula"><summary>How it works, formulas and caveats</summary>
    <div class="efb">
      <p><b>Not financial advice and not Tesla guidance.</b> Tesla does not publish Robotaxi revenue, rides, active fleet or margins. Every slider is an assumption you control; only the tracked facts above are measured.</p>
      <ul>
        <li><b>Daily revenue</b> = registered fleet × utilization × paid trips per active car × average fare.</li>
        <li><b>Annualized run-rate</b> = daily revenue × 365. <b>Net profit</b> = revenue × net margin.</li>
        <li><b>Fleet path</b>: each week the fleet grows by the weekly rate, slowed in proportion to how close it is to the cap (logistic growth): next = fleet + rate × fleet × (1 − fleet ÷ cap).</li>
        <li><b>Forward 12 months</b> = the sum of 52 weekly revenues along that path, starting from today's registered fleet.</li>
        <li><b>Market cap impact</b> = forward 12-month net profit × P/E. Per share = impact ÷ ${X.sharesOutstanding.toLocaleString('en-US')} shares outstanding (<a href="${esc(X.sources[2].url)}" target="_blank" rel="noopener">Tesla 10-Q</a>, ${fmtD(X.sharesDate)}). Percent = impact ÷ ${esc(X.marketCapLabel)} (<a href="${esc(X.sources[0].url)}" target="_blank" rel="noopener">StockAnalysis</a>, <a href="${esc(X.sources[1].url)}" target="_blank" rel="noopener">CompaniesMarketCap</a>, ${fmtD(X.priceDate)}).</li>
        <li><b>Fleet baseline</b>: ${N0.toLocaleString('en-US')} vehicles on the Texas DMV automated vehicle list (<a href="https://github.com/phelo1/fsdriving/blob/main/data/fleet.json" target="_blank" rel="noopener">data/fleet.json</a>, refreshed daily). Registered is not the same as on the road, which is what utilization is for. Tesla cars outside Texas are not on this list.</li>
        <li><b>Waymo trips reference</b>: ${TP.waymoWeeklyRides.toLocaleString('en-US')} paid rides a week (<a href="${esc(TP.waymoWeeklyRidesSource.url)}" target="_blank" rel="noopener">Alphabet, ${fmtD(TP.waymoWeeklyRidesDate)}</a>) ÷ 7 ÷ ${W.n.toLocaleString('en-US')} driverless-capable vehicles (<a href="${esc(W.url)}" target="_blank" rel="noopener">NHTSA 26E086</a>, ${fmtD(W.date)}) ≈ ${waymoRPV.toFixed(1)} rides per vehicle per day. Our own division; it mixes an April ride count with a November fleet count, so treat it as a rough reference only.</li>
        <li>Fares are gross rider payments (receipts include tax). Presets are illustrations, not forecasts.</li>
      </ul>
    </div>
  </details>
</section>
<section class="csec eprice" id="pricing" aria-labelledby="p-h">
  <p class="elbl fact">Tracked facts</p>
  <h2 id="p-h" class="ch2">Fare benchmarks: Tesla vs Waymo vs Uber and Lyft</h2>
  <p class="cnote">These are dated studies and receipt medians, not a live ticker: no operator publishes a fare feed, and prices move by trip length, time and demand. Each card shows its city, window and source. Tap a button to drop that fare into the estimator.</p>
  <div class="ebs">${bench}</div>
</section>
</main>
${footerHtml}
<script id="econ" type="application/json">${JSON.stringify(cfg).replace(/</g, '\\u003c')}</script>
<script>${CLIENT}</script>
</body></html>`;
}
const CLIENT = `(()=>{const C=JSON.parse(document.getElementById('econ').textContent),$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const S={},H={h:24},keys=['u','t','f','m','g','k','pe'],inp={};keys.forEach(k=>inp[k]=$('#s-'+k));
const money=v=>{const a=Math.abs(v);return a>=1e12?'$'+(v/1e12).toFixed(2)+'T':a>=1e9?'$'+(v/1e9).toFixed(a>=1e11?0:a>=1e10?1:2)+'B':a>=1e6?'$'+(v/1e6).toFixed(a>=1e8?0:1)+'M':a>=1e3?'$'+(v/1e3).toFixed(a>=1e5?0:1)+'K':'$'+v.toFixed(0)};
const int=v=>Math.round(v).toLocaleString('en-US');
const fmtO={u:v=>v+'%',t:v=>v+'/day',f:v=>'$'+(+v).toFixed(2),m:v=>v+'%',g:v=>(+v).toFixed(1)+'%',k:v=>int(C.CAPS[v]),pe:v=>v+'x'};
const path=(g,cap,weeks)=>{const o=[C.N0];let n=C.N0;for(let w=0;w<weeks;w++){n=n+g*n*Math.max(0,1-n/cap);o.push(n)}return o};
let preset='base';
function setP(k){const p=C.presets[k];preset=k;keys.forEach(x=>{inp[x].value=p[x];S[x]=+p[x]});mark();run()}
function mark(){$$('.eps button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===preset));$('.ecustom').hidden=!!preset;
$('#pwhy').innerHTML=preset?'<b>'+C.presets[preset].name+' assumes:</b> '+C.presets[preset].why.join(' · '):'<b>Custom:</b> your own assumptions. Pick a scenario to reset.'}
function run(){keys.forEach(k=>{S[k]=+inp[k].value;$('#o-'+k).textContent=fmtO[k](S[k]);const r=(S[k]-inp[k].min)/(inp[k].max-inp[k].min)*100;inp[k].style.setProperty('--p',r+'%')});
const u=S.u/100,m=S.m/100,g=S.g/100,cap=Math.max(C.CAPS[S.k],C.N0),perCar=u*S.t*S.f;
const day=C.N0*perCar,ann=day*365,P=path(g,cap,Math.max(52,H.h*52/12));
let fwd=0;for(let w=0;w<52;w++)fwd+=P[w]*perCar*7;const fwdP=fwd*m,imp=fwdP*S.pe;
$('#k-day').textContent=money(day);$('#k-day-s').textContent=int(C.N0*u)+' active cars × '+S.t+' trips × $'+S.f.toFixed(2);
$('#k-ann').textContent=money(ann);$('#k-ann-s').textContent='Net profit '+money(ann*m)+' a year at '+S.m+'%';
$('#k-fwd').textContent=money(fwd);$('#k-fwd-s').textContent='Net profit '+money(fwdP)+'. Fleet '+int(P[52])+' in 52 weeks';
$('#k-cap').textContent=money(imp);$('#k-cap-s').textContent='$'+(imp/C.shares).toFixed(2)+' per share · '+(imp/C.mcap*100).toFixed(imp/C.mcap<.01?2:1)+'% of current mcap at '+S.pe+'x';
draw(P,perCar,m)}
const svg=$('#ec'),tip=$('#etip');let pts=[],last=null;
function draw(P,perCar,m){last=[P,perCar,m];const W=Math.max(280,svg.clientWidth||640),Hh=Math.max(200,svg.clientHeight||300),L=58,R=12,T=14,B=30,mo=H.h,D=[];const t0=Date.parse(C.fleetDate);
for(let i=0;i<=mo;i++){const w=Math.round(i*52/12),n=P[Math.min(w,P.length-1)],rev=n*perCar*365;D.push({i,n,rev,pr:rev*m,d:new Date(t0+w*7*864e5)})}
const mx=Math.max(...D.map(d=>d.rev))||1,nice=(()=>{const p=Math.pow(10,Math.floor(Math.log10(mx))),f=mx/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p})();
const x=i=>L+(W-L-R)*i/mo,y=v=>T+(Hh-T-B)*(1-v/nice);let s='';
for(let j=0;j<=4;j++){const v=nice*j/4;s+='<line class="gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="ax" x="'+(L-8)+'" y="'+(y(v)+4)+'" text-anchor="end">'+money(v)+'</text>'}
const st=mo<=12?2:mo<=24?4:6;for(let i=0;i<=mo;i+=st){s+='<text class="ax" x="'+x(i)+'" y="'+(Hh-8)+'" text-anchor="middle">'+(i?'+'+i+'m':'Now')+'</text>'}
const ln=k=>D.map((d,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(d[k]).toFixed(1)).join(' ');
s+='<path class="ar" d="'+ln('rev')+' L'+x(mo)+' '+y(0)+' L'+x(0)+' '+y(0)+'Z"/><path class="lr" d="'+ln('rev')+'"/><path class="lp" d="'+ln('pr')+'"/>';
s+='<g id="ecm" style="display:none"><line id="ecx" class="cx" y1="'+T+'" y2="'+y(0)+'"/><circle id="ecr" class="dr" r="4.5"/><circle id="ecp" class="dp" r="4.5"/></g><rect class="hov" x="'+L+'" y="0" width="'+(W-L-R)+'" height="'+Hh+'"/>';
svg.setAttribute('viewBox','0 0 '+W+' '+Hh);svg.innerHTML=s;pts=D.map(d=>({...d,x:x(d.i),yr:y(d.rev),yp:y(d.pr)}));const e=D[mo];
$('#eend').innerHTML='At +'+mo+' months: fleet <b>'+int(e.n)+'</b>, revenue run-rate <b>'+money(e.rev)+'</b>, net profit run-rate <b>'+money(e.pr)+'</b> a year.';
const hv=svg.querySelector('.hov'),g=q=>svg.querySelector(q);const mv=ev=>{const r=svg.getBoundingClientRect(),px=(ev.clientX-r.left)/r.width*W;let b=pts[0];pts.forEach(p=>{if(Math.abs(p.x-px)<Math.abs(b.x-px))b=p});
g('#ecx').setAttribute('x1',b.x);g('#ecx').setAttribute('x2',b.x);g('#ecr').setAttribute('cx',b.x);g('#ecr').setAttribute('cy',b.yr);g('#ecp').setAttribute('cx',b.x);g('#ecp').setAttribute('cy',b.yp);
g('#ecm').style.display='';tip.hidden=false;tip.innerHTML='<b>'+(b.i?'+'+b.i+' months':'Today')+'</b><span>'+b.d.toLocaleDateString('en-US',{month:'short',year:'numeric'})+'</span><span>Fleet '+int(b.n)+'</span><span class="r">Revenue '+money(b.rev)+'/yr</span><span class="p">Profit '+money(b.pr)+'/yr</span>';
const lx=b.x/W*r.width;tip.style.left=Math.min(Math.max(lx,70),r.width-70)+'px';tip.style.top=(Math.min(b.yr,b.yp)/Hh*r.height)+'px'};
hv.addEventListener('pointermove',mv);hv.addEventListener('pointerdown',mv);hv.addEventListener('pointerleave',()=>{tip.hidden=true;g('#ecm').style.display='none'})}
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>last&&draw(...last),120)});
keys.forEach(k=>inp[k].addEventListener('input',()=>{preset=null;mark();run()}));
$$('.eps button').forEach(b=>b.addEventListener('click',()=>setP(b.dataset.p)));
$$('.egb button').forEach(b=>b.addEventListener('click',()=>{inp.g.value=b.dataset.g;preset=null;mark();run()}));
$$('.ehz button').forEach(b=>b.addEventListener('click',()=>{H.h=+b.dataset.h;$$('.ehz button').forEach(x=>x.setAttribute('aria-pressed',x===b));run()}));
$$('.euse').forEach(b=>b.addEventListener('click',()=>{inp.f.value=b.dataset.fare;preset=null;mark();run();const k=$('.ekpis');k.scrollIntoView({behavior:'smooth',block:'center'});k.classList.remove('flash');void k.offsetWidth;k.classList.add('flash')}));
setP('base');window.__econ={S,H,setP,get kpi(){return['#k-day','#k-ann','#k-fwd','#k-cap'].map(q=>$(q).textContent)}};})();`;
