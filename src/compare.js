// Tesla vs Waymo: head-to-head counters, two-layer metro map, status table.
(()=>{
const D=JSON.parse(document.getElementById('data').textContent),X=D.compare;if(!X||!document.getElementById('vsmap'))return;
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const C=X.counts,NS='http://www.w3.org/2000/svg';let mode='both',locked=false;
const fd=s=>s?new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'';
const tStat=m=>m.tesla?m.tesla.status:(m.th.n?'hiring':null), wStat=m=>m.waymo?(m.waymo.status==='live'?(m.waymo.gradual?'live-gradual':m.waymo.via?'live-uber':'live'):m.waymo.status):(m.wh?'hiring':null);
const LBL={live:'Live, driverless','live-driver':'Live, safety driver',announced:'Coming soon',hiring:'Hiring only'};
const WLBL={live:'Live','live-uber':'Live via Uber','live-gradual':'Live, waitlist rollout',announced:'Up next',hiring:'Job ads only'};
const chip=(co,s)=>s?`<span class="vchip ${co} s-${s}">${(co==='t'?LBL:WLBL)[s]}</span>`:'<span class="vnone">Not named</span>';
const srcs=a=>(a||[]).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a>`).join(' · ');
// counters
const card=(h,t,w,tn,wn,foot)=>{const mx=Math.max(t,w,1);return `<div class="vscard rv"><h3>${h}</h3><div class="vsrow t"><span>Tesla</span><b>${t}</b><i style="width:${(t/mx*100).toFixed(0)}%"></i></div><div class="vsrow w"><span>Waymo</span><b>${w}</b><i style="width:${(w/mx*100).toFixed(0)}%"></i></div><p>${foot}</p></div>`};
$('#vscount').innerHTML=
 card('Live service',C.tesla.live,C.waymo.live,'','',`Tesla: ${C.tesla.driverless} driverless + Bay Area with a safety driver. Waymo: all driverless, ${C.waymo.open} open to everyone, Las Vegas via waitlist.`)+
 card('Announced, not live yet',C.tesla.announced,C.waymo.announced,'','',`Tesla's coming soon list vs Waymo's Up Next list. Waymo also names ${C.waymo.intl} cities abroad.`)+
 card('Metros with hiring signals',C.tesla.hiring,C.waymo.hiring,'','',`Tesla: Robotaxi supervisor ads in ${C.tesla.hiringCities} cities, grouped into metros. Waymo: metros named in any of its ${X.waymoJobs.total||'?'} open job ads. Different signals, see notes.`)+
 card('Where they meet',C.both.live,C.both.planned,'','',`<b class="tc">${C.both.live}</b> metros have both companies live. <b class="wc">${C.both.planned}</b> metros are live or announced by both.`).replace('<span>Tesla</span>','<span>Both live</span>').replace('<span>Waymo</span>','<span>Both, any plan</span>');
// map
const g=$('#vspins');
const mk=(tag,at)=>{const e=document.createElementNS(NS,tag);for(const k in at)e.setAttribute(k,at[k]);return e};
const R={live:7,'live-driver':7,'live-uber':7,'live-gradual':7,announced:6,hiring:3.2};
const pins=[];
for(const m of X.metros){if(m.x==null)continue;const a=mk('g',{class:'vpin',tabindex:'0','data-id':m.id});
 const t=tStat(m),w=wStat(m);
 if(t)a.appendChild(mk('circle',{class:'vt s-'+t,cx:m.x-4.5,cy:m.y,r:R[t]}));
 if(w)a.appendChild(mk('circle',{class:'vw s-'+w,cx:m.x+4.5,cy:m.y,r:R[w]}));
 a.appendChild(mk('circle',{class:'vhit',cx:m.x,cy:m.y,r:14}));
 if((t&&t!=='hiring')||(w&&w!=='hiring')){const tx=mk('text',{x:m.x,y:m.y-12,class:'vlab'});tx.textContent=m.name;a.appendChild(tx)}
 a._m=m;g.appendChild(a);pins.push(a)}
const wrap=$('.vsmap'),tip=$('#vstip');
function body(m){const t=tStat(m),w=wStat(m);let h=`<b>${esc(m.name)}${m.state?', '+esc(m.state):''}</b>`;
 h+=`<div class="vtsec t"><div>${chip('t',t)}</div>`;if(m.tesla)h+=`<p>${esc(m.tesla.note)}</p><p class="vsrc">${srcs(m.tesla.sources)}</p>`;
 if(m.th.n)h+=`<p>${m.th.n} open Robotaxi supervisor ad${m.th.n>1?'s':''}: ${m.th.cities.map(c=>esc(c.k)+' ('+c.n+')').join(', ')}</p>`;h+='</div>';
 h+=`<div class="vtsec w"><div>${chip('w',w)}</div>`;if(m.waymo)h+=`<p>${esc(m.waymo.note)}</p><p class="vsrc">${srcs(m.waymo.sources)}</p>`;
 if(m.wh)h+=`<p>${m.wh.count} open Waymo job ad${m.wh.count>1?'s':''} name this metro, e.g. ${m.wh.examples.slice(0,2).map(e=>`<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>${e.firstPublished?' (since '+fd(e.firstPublished)+')':''}`).join(', ')}</p>`;
 return h+'</div>'}
function show(m,lock){locked=lock;tip.innerHTML='<button class="closetip" aria-label="Close">×</button>'+body(m);tip.hidden=false;
 const W=wrap.clientWidth,s=W/975;if(W<640){tip.classList.add('dock');tip.style.left=tip.style.top=''}else{tip.classList.remove('dock');const px=m.x*s,py=m.y*s;tip.style.left=(px+18+300>W?Math.max(8,px-318):px+18)+'px';tip.style.top=Math.max(8,Math.min(py-40,wrap.clientHeight-tip.offsetHeight-8))+'px'}
 tip.querySelector('.closetip').onclick=e=>{e.stopPropagation();locked=false;tip.hidden=true};
 pins.forEach(p=>p.classList.toggle('hot',p._m===m))}
const touch=matchMedia('(hover:none)').matches;
for(const p of pins){if(!touch){p.onmouseenter=()=>{if(!locked)show(p._m,false)};p.onmouseleave=()=>{if(!locked){tip.hidden=true;p.classList.remove('hot')}}}
 p.onclick=e=>{e.stopPropagation();show(p._m,true)};p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(p._m,true)}}}
document.addEventListener('click',e=>{if(!e.target.closest('#vsmap,#vstip,#vstable')){locked=false;tip.hidden=true;pins.forEach(p=>p.classList.remove('hot'))}});
$('#vslegend').innerHTML='<span><i class="lg" style="background:#ff3b3b"></i>Tesla live</span><span><i class="lg" style="background:#ffd78c"></i>Tesla live, safety driver</span><span><i class="lg" style="background:none;border:2px solid #ff3b3b"></i>Tesla coming soon</span><span><i class="lg" style="background:#ff3b3b;transform:scale(.55)"></i>Tesla hiring only</span><span><i class="lg" style="background:#5b8cff"></i>Waymo live</span><span><i class="lg" style="background:none;border:2px solid #5b8cff"></i>Waymo up next</span><span><i class="lg" style="background:#5b8cff;transform:scale(.55)"></i>Waymo job ads only</span><span class="muted">Tesla dot left, Waymo dot right. Tap a metro for sources.</span>';
// table
const rank=s=>s&&/^live/.test(s)?3:s==='announced'?2:s==='hiring'?1:0;
const rows=X.metros.slice().sort((a,b)=>(rank(tStat(b))+rank(wStat(b)))-(rank(tStat(a))+rank(wStat(a)))||rank(tStat(b))-rank(tStat(a))||a.name.localeCompare(b.name));
const tb=$('#vstable tbody');
tb.innerHTML=rows.map(m=>{const t=tStat(m),w=wStat(m);const th=m.tesla&&m.th.n?`<small>${m.th.n} supervisor ad${m.th.n>1?'s':''}</small>`:(!m.tesla&&m.th.n?`<small>${m.th.n} supervisor ad${m.th.n>1?'s':''}</small>`:'');const wh=m.wh?`<small>${m.wh.count} job ad${m.wh.count>1?'s':''}</small>`:'';
 return `<tr data-id="${esc(m.id)}" data-t="${t?1:0}" data-w="${w?1:0}" tabindex="0"><td>${esc(m.name)}<span class="st">${esc(m.state||'')}</span></td><td class="t">${chip('t',t)}${th}</td><td class="w">${chip('w',w)}${wh}</td></tr>`}).join('');
tb.querySelectorAll('tr').forEach(r=>{const m=X.metros.find(x=>x.id===r.dataset.id);const go=e=>{e.stopPropagation();if(m.x!=null){show(m,true);if(innerWidth<640)wrap.scrollIntoView({behavior:'smooth',block:'center'})}};r.onclick=go;r.onkeydown=e=>{if(e.key==='Enter')go(e)}});
// international
$('#vsintl').innerHTML=`<h3 class="waith">Waymo outside the US</h3><div class="vsintl">${X.intl.map(c=>`<div class="vsic"><b>${esc(c.name)}</b><span>${esc(c.country)}${c.year?', aiming for '+c.year:''}</span><small>${esc(c.note)} ${srcs(c.sources)}</small></div>`).join('')}</div><p class="muted">Tesla has not named a Robotaxi service city outside the US on its Robotaxi pages.</p>`;
const d=X.definitions;
$('#vsnote').innerHTML=`<p><b>How we count.</b> Statuses checked ${fd(X.checkedAt)} from each company's own pages. Metros, not municipalities: Tesla runs Dallas and Fort Worth as separate zones, counted here as one Dallas-Fort Worth metro to match Waymo's Dallas market; Waymo's SF Bay Area and Phoenix markets span many cities.</p><p><b>Tesla.</b> Live: ${esc(d.tesla.live)} Announced: ${esc(d.tesla.announced)} Hiring: ${esc(d.tesla.hiring)} Supervisor cities within 45 miles of a metro join it, others form their own area.</p><p><b>Waymo.</b> Live: ${esc(d.waymo.live)} Announced: ${esc(d.waymo.announced)} Hiring: ${esc(d.waymo.hiring)} Job board last read ${X.waymoJobs.checkedAt?fd(X.waymoJobs.checkedAt):'never'}.</p>${X.notes.map(n=>`<p>${esc(n.text)} ${srcs(n.sources)}</p>`).join('')}`;
// toggle
document.querySelectorAll('.vs-f button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.vs-f button').forEach(o=>o.classList.toggle('on',o===b));mode=b.dataset.c;
 $('#vsmap').dataset.mode=mode;$('#vstable').dataset.mode=mode;locked=false;tip.hidden=true;
 pins.forEach(p=>{const m=p._m;p.classList.toggle('off',mode==='tesla'?!tStat(m):mode==='waymo'?!wStat(m):false)});
 tb.querySelectorAll('tr').forEach(r=>r.hidden=mode==='tesla'?r.dataset.t==='0':mode==='waymo'?r.dataset.w==='0':false)});
})();
