// Hero: live Tesla Robotaxi US map. Green = service live, red = hiring or coming soon. Click opens the city in the main map.
(()=>{
const D=JSON.parse(document.getElementById('data').textContent),H=D.hero,svg=document.getElementById('hxsvg'),tip=document.getElementById('hxtip');if(!H||!svg||!tip)return;
const wrap=svg.parentNode,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>{const d=new Date(s+'T12:00:00Z');return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})};
let pt='mouse';const touchy=()=>pt==='touch'||pt==='pen';
const pl=(n,w)=>n+' '+w+(n===1?'':'s');
const get=k=>k[0]==='l'?{t:'l',d:H.live[+k.slice(1)]}:{t:'p',d:H.pend[+k.slice(1)]};
function html(o){const d=o.d;if(o.t==='l')return `<b>${esc(d.name)}, ${esc(d.st)}</b><span class="tg g">Live service</span><em>Since ${fmt(d.date)}${d.driver?', with a safety driver':''}</em><em>${d.roles?pl(d.roles,'open Robotaxi role')+(d.pname&&d.pname!==d.name?' in '+esc(d.pname):''):'No open Robotaxi roles right now'}</em><i>${touchy()?'Tap':'Click'} to open in the map</i>`;
 return `<b>${esc(d.name)}${d.st?', '+esc(d.st):''}</b><span class="tg r">${d.soon?'Coming soon':'Hiring / pending'}</span><em>${d.roles?pl(d.roles,'open Robotaxi role')+(d.sup?', '+d.sup+' supervisor':''):'Announced, no open roles yet'}</em><i>${touchy()?'Tap':'Click'} to open in the map</i>`}
svg.addEventListener('pointerdown',e=>{pt=e.pointerType||'mouse'},true);
let cur=null;
function show(g){const o=get(g.dataset.k);if(!o.d)return;cur=g;tip.innerHTML=html(o);tip.hidden=false;tip.className='hxtip '+(o.t==='l'?'g':'r');
 const r=g.getBoundingClientRect(),w=wrap.getBoundingClientRect(),cx=r.left+r.width/2-w.left,cy=r.top+r.height/2-w.top,tw=tip.offsetWidth,th=tip.offsetHeight;
 let x=Math.max(6,Math.min(w.width-tw-6,cx-tw/2)),y=cy-th-14;if(y<4)y=cy+16;tip.style.left=x+'px';tip.style.top=y+'px';
 svg.querySelectorAll('.hd.on').forEach(n=>n.classList.remove('on'));g.classList.add('on')}
function hide(){tip.hidden=true;cur=null;svg.querySelectorAll('.hd.on').forEach(n=>n.classList.remove('on'))}
function open(g){const o=get(g.dataset.k),id=o.d&&o.d.pid;const m=document.getElementById('map');if(!m)return;m.scrollIntoView({behavior:'smooth',block:'start'});
 if(id&&window.__map){if(window.__map.mode==='world'&&window.__map.goView)window.__map.goView('us',false);setTimeout(()=>window.__map.openDrawer(id,true),350)}}
svg.querySelectorAll('.hd').forEach(g=>{
 g.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(g)});g.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hide()});
 g.addEventListener('focus',()=>{if(cur!==g&&g.matches(':focus-visible'))show(g)});g.addEventListener('blur',hide);
 g.addEventListener('click',e=>{e.stopPropagation();if(touchy()&&cur!==g){show(g);return}open(g)});
 g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(g)}});
});
tip.addEventListener('click',()=>{if(cur)open(cur)});
document.addEventListener('click',e=>{if(!tip.hidden&&!wrap.contains(e.target))hide()});
window.__hero={show:k=>{const g=svg.querySelector(`.hd[data-k="${k}"]`);if(g)show(g)},open:k=>{const g=svg.querySelector(`.hd[data-k="${k}"]`);if(g)open(g)}};

// Time-lapse: replays sourced hiring signals and launch dates up to today. The final frame is the live state above.
(()=>{const tl=document.getElementById('tlx'),btn=document.getElementById('tlplay'),rg=document.getElementById('tlrange'),dl=document.getElementById('tldate'),cn=document.getElementById('tlcnt');if(!tl||!btn||!rg)return;
 const DAY=864e5,t0=Date.parse(H.start+'T12:00:00Z'),N=+rg.max,iso=i=>new Date(t0+i*DAY).toISOString().slice(0,10);
 const lab=s=>new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const dots=[...svg.querySelectorAll('.hd')].map(g=>{const k=g.dataset.k,o=get(k);return{g,t:o.t,d:o.d}});
 let raf=0,playing=false,last=-1;
 function frame(i){i=Math.max(0,Math.min(N,Math.round(i)));if(i===last)return;last=i;const D=iso(i);let L=0,R=0;
  for(const x of dots){let st;if(x.t==='l'){st=D>=x.d.date?'live':(x.d.hire&&D>=x.d.hire?'red':'off')}else st=D>=x.d.d?'red':'off';
   const was=x.g.dataset.tl||'live';if(st!==was){x.g.dataset.tl=st;if(st!=='off'&&i<N){x.g.classList.remove('tlnew');void x.g.getBBox();x.g.classList.add('tlnew')}}
   x.g.classList.toggle('tloff',st==='off');x.g.classList.toggle('tlred',st==='red');if(st==='live')L++;else if(st==='red')R++}
  rg.value=i;rg.style.setProperty('--p',(i/N*100).toFixed(2)+'%');dl.textContent=lab(D);
  cn.innerHTML=`<i class="g"></i>${L} live <i class="r"></i>${R} ${i===N?'hiring or next':'hiring or named'}`;tl.classList.toggle('past',i<N)}
 function stop(){playing=false;cancelAnimationFrame(raf);btn.classList.remove('on');btn.setAttribute('aria-label','Play the time-lapse')}
 function play(){if(last>=N||last<0)frame(0);playing=true;btn.classList.add('on');btn.setAttribute('aria-label','Pause the time-lapse');hide();
  const dur=Math.min(14000,Math.max(7000,N*18)),s0=last,start=performance.now()-s0/N*dur;
  const step=t=>{if(!playing)return;const i=(t-start)/dur*N;frame(i);if(i>=N){stop();return}raf=requestAnimationFrame(step)};raf=requestAnimationFrame(step)}
 btn.addEventListener('click',()=>playing?stop():play());
 rg.addEventListener('input',()=>{stop();frame(+rg.value)});
 frame(N);window.__hero.tl={play,stop,frame,get playing(){return playing},get i(){return last},N};
})();
// Next up cards and the Tesla vs Waymo button both drive the main map.
function toMap(cb){const m=document.getElementById('map');if(!m)return;m.scrollIntoView({behavior:'smooth',block:'start'});if(window.__map&&window.__map.mode!=='us'&&window.__map.goView)window.__map.goView('us',false);if(cb)setTimeout(cb,420)}
document.querySelectorAll('.nxgo[data-pid]').forEach(b=>b.addEventListener('click',()=>toMap(()=>window.__map&&window.__map.openDrawer(b.dataset.pid,true))));
const wb=document.getElementById('showWaymo');
if(wb){const sync=on=>{wb.setAttribute('aria-pressed',on);wb.classList.toggle('on',on);wb.querySelector('span').textContent=on?'Hide Waymo on map':'Show Waymo on map'};
 wb.addEventListener('click',()=>{if(!window.__map)return;const on=!window.__map.F.op.waymo;window.__map.setOp('waymo',on);if(on)toMap()});
 document.addEventListener('mapop',e=>{if(e.detail.op==='waymo')sync(e.detail.on)});}
})();
