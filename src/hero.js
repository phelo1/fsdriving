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
})();
