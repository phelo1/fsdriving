// Main interactive map: Tesla + Waymo, US (Albers) and World (Equal Earth) views, filters, search, city drawer.
(()=>{
const D=JSON.parse(document.getElementById('data').textContent),P=D.places,M=D.mapMeta;if(!P||!document.getElementById('msvg'))return;
const $=s=>document.querySelector(s),esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fd=s=>s?new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'';
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const F={op:{tesla:1,waymo:0},st:{live:1,ann:1,hire:1,closed:0},role:{supervisor:1,fleet:1,other:1,selfdriving:0}};
const RK=c=>c==='supervisor'?'supervisor':c==='other'?'other':c==='selfdriving'?'selfdriving':'fleet';
const svg=d3.select('#msvg'),vp=d3.select('#mvp'),fitG=d3.select('#mfit'),LK=d3.select('#mlinks'),MK=d3.select('#mmarks'),LB=d3.select('#mlabels');
const stage=$('#mstage'),tip=$('#mtip'),drawer=$('#mdrawer'),hover=matchMedia('(hover:hover)').matches;
let mode='us',view='us',W=0,H=0,fit={s:1,ox:0,oy:0},T=d3.zoomIdentity,sel=null;
const byId=new Map(P.map(p=>[p.id,p]));
// ---- per-place state under the current filters
function tState(p,f=F){if(!f.op.tesla)return null;const s=p.tesla&&p.tesla.status;
 if(f.st.live&&(s==='live'||s==='live-driver'))return s;if(f.st.ann&&s==='announced')return 'ann';
 const open=p.jobs.filter(j=>j.a&&f.role[RK(j.c)]);if(f.st.hire&&open.length)return open.every(j=>j.c==='selfdriving')?'sd':'hire';
 if(f.st.closed&&!p.jobs.some(j=>j.a&&f.role[RK(j.c)])&&p.jobs.some(j=>!j.a&&f.role[RK(j.c)]))return 'closed';return null}
function wState(p,f=F){if(!f.op.waymo)return null;const s=p.waymo&&p.waymo.status;
 if(f.st.live&&s==='live')return 'live';if(f.st.ann&&s==='announced')return 'ann';if(f.st.hire&&p.wh)return 'hire';return null}
const openJobs=(p,f=F)=>f.op.tesla&&f.st.hire?p.jobs.filter(j=>j.a&&f.role[RK(j.c)]):[];
const ALL={op:{tesla:1,waymo:1},st:{live:1,ann:1,hire:1,closed:1},role:{supervisor:1,fleet:1,other:1,selfdriving:1}};
const xy=p=>p[mode==='us'?'us':'w'];
const scr=v=>T.apply([fit.ox+fit.s*v[0],fit.oy+fit.s*v[1]]);
const rank=(t,w)=>({live:5,'live-driver':4.5,ann:3,hire:2,sd:1,closed:.5}[t]||0)+({live:5,ann:3,hire:2}[w]||0)+(t&&w?3:0);
// ---- size + fit
function resize(){W=stage.clientWidth;H=stage.clientHeight;const s=Math.min(W/975,H/610);fit={s,ox:(W-975*s)/2,oy:(H-610*s)/2};
 fitG.attr('transform',`translate(${fit.ox},${fit.oy}) scale(${s})`);zoom.extent([[0,0],[W,H]]).translateExtent([[-W*.35,-H*.35],[W*1.35,H*1.35]]);draw()}
const zoom=d3.zoom().scaleExtent([.9,70]).on('zoom',e=>{T=e.transform;vp.attr('transform',T);hideTip();draw();$('#mhint').classList.add('gone')});
svg.call(zoom).on('dblclick.zoom',null);
svg.on('click',e=>{if(!e.target.closest('.mk,.mcl,.mlab'))closeDrawer()});
// ---- markers
const ctx=document.createElement('canvas').getContext('2d');ctx.font='600 11.5px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
const tw=new Map(),textW=s=>tw.get(s)||(tw.set(s,ctx.measureText(s).width),tw.get(s));
const dia=s=>`M0,${-s}L${s},0L0,${s}L${-s},0Z`;
function teslaSvg(t,n,dx){const r=t==='hire'?Math.min(9.5,3.4+Math.sqrt(n)*1.25):t==='sd'||t==='closed'?3.6:6.2;let h='';
 if(t==='live'||t==='live-driver')h+=`<circle class="halo t" cx="${dx}" r="17"/><circle class="pulse ${t==='live'?'t':'d'}" cx="${dx}" r="7"/>`;
 h+=`<circle class="tc ${t}" cx="${dx}" r="${r}"/>`;return {h,r}}
function waymoSvg(w,dx){const s=w==='hire'?4.2:6.8;let h='';
 if(w==='live')h+=`<circle class="halo w" cx="${dx}" r="17"/><circle class="pulse w" cx="${dx}" r="7"/>`;
 h+=`<path class="wd ${w}" transform="translate(${dx},0)" d="${dia(s)}"/>`;return {h,r:s}}
function markSvg(t,w,n){if(t&&w){const a=teslaSvg(t,Math.min(n,9),-8),b=waymoSvg(w,8);return {h:`<rect class="dual" x="-19" y="-11" width="38" height="22" rx="11"/>`+a.h+b.h+`<rect class="hit" x="-21" y="-14" width="42" height="28" rx="14"/>`,rx:19,ry:11}}
 if(t){const a=teslaSvg(t,n,0);return {h:a.h+`<circle class="hit" r="${Math.max(13,a.r+5)}"/>`,rx:a.r,ry:a.r}}
 const b=waymoSvg(w,0);return {h:b.h+'<circle class="hit" r="13"/>',rx:b.r,ry:b.r}}
function draw(){if(!W)return;
 const items=[];
 for(const p of P){let t=tState(p),w=wState(p);if(p.id===sel&&!t&&!w){t=tState(p,ALL);w=wState(p,ALL)}if(!t&&!w)continue;const v=xy(p);if(!v)continue;
  const [x,y]=scr(v);if(x<-40||y<-40||x>W+40||y>H+40)continue;const n=openJobs(p).length;items.push({p,t,w,n,x,y,r:rank(t,w)+Math.min(2,n/20)})}
 items.sort((a,b)=>b.r-a.r);
 // screen-space clustering
 const cl=[];for(const it of items){const th=(it.t&&it.w?24:18)*(mode==='world'&&T.k<2.5?.8:1);const c=it.p.id===sel?null:cl.find(c=>!c.lock&&Math.hypot(c.x-it.x,c.y-it.y)<th);if(c)c.m.push(it);else cl.push({x:it.x,y:it.y,m:[it],lock:it.p.id===sel})}
 // merge clusters whose bubbles would touch, until stable
 const rad=c=>c.m.length>1?12+Math.min(7,c.m.length):(c.m[0].t&&c.m[0].w?19:10);
 for(let again=true;again;){again=false;for(const c of cl){c.x=d3.mean(c.m,d=>d.x);c.y=d3.mean(c.m,d=>d.y)}
  outer:for(let i=0;i<cl.length;i++)for(let j=i+1;j<cl.length;j++){const a=cl[i],b=cl[j];if(a.lock||b.lock)continue;if(a.m.length<2&&b.m.length<2)continue;
   if(Math.hypot(a.x-b.x,a.y-b.y)<rad(a)+rad(b)+2){a.m.push(...b.m);cl.splice(j,1);again=true;break outer}}}
 const singles=cl.filter(c=>c.m.length===1).map(c=>c.m[0]),groups=cl.filter(c=>c.m.length>1);
 for(const g of groups){g.x=d3.mean(g.m,d=>d.x);g.y=d3.mean(g.m,d=>d.y);g.key='cl:'+g.m.map(d=>d.p.id).sort().join(',');g.T=g.m.some(d=>d.t);g.Wy=g.m.some(d=>d.w)}
 // satellites (cities grouped into a metro pin), only when zoomed in enough to separate them
 const links=[];for(const it of singles){if(!it.t||it.p.cities.length<2&&!(it.p.cities.length===1&&it.p.cities[0].d>3))continue;
  for(const c of it.p.cities){const v=c[mode==='us'?'us':'w'];if(!v)continue;const [x,y]=scr(v);const d=Math.hypot(x-it.x,y-it.y);if(d<16)continue;
   const open=it.p.jobs.filter(j=>j.city===c.k&&j.a&&F.role[RK(j.c)]).length;if(!open&&!F.st.closed)continue;links.push({key:it.p.id+'|'+c.k,x1:it.x,y1:it.y,x2:x,y2:y,name:c.name,n:open,pid:it.p.id})}}
 LK.selectAll('g.sat').data(links,d=>d.key).join(en=>{const g=en.append('g').attr('class','sat');g.append('line');g.append('circle').attr('r',3);g.append('title');return g})
  .each(function(d){const g=d3.select(this);g.select('line').attr('x1',d.x1).attr('y1',d.y1).attr('x2',d.x2).attr('y2',d.y2);g.select('circle').attr('cx',d.x2).attr('cy',d.y2).classed('none',!d.n);g.select('title').text(`${d.name}: ${d.n} open role${d.n===1?'':'s'}`)})
  .on('click',(e,d)=>{e.stopPropagation();openDrawer(d.pid)});
 const data=[...singles.map(it=>({...it,key:it.p.id,kind:'p'})),...groups.map(g=>({...g,kind:'c'}))];
 MK.selectAll('g.node').data(data,d=>d.key).join(en=>en.append('g').attr('class','node').attr('tabindex',0).attr('role','button').style('opacity',0).call(g=>g.transition().duration(350).style('opacity',1)),
  up=>up,ex=>ex.transition().duration(200).style('opacity',0).remove())
  .attr('transform',d=>`translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`)
  .each(function(d){const sig=d.kind==='p'?`${d.t}|${d.w}|${d.t==='hire'?Math.round(Math.min(9.5,3.4+Math.sqrt(d.n)*1.25)*2):''}|${d.p.id===sel}`:`c${d.m.length}${d.T}${d.Wy}`;
   if(this.__sig===sig)return;this.__sig=sig;const g=d3.select(this);
   if(d.kind==='p'){const m=markSvg(d.t,d.w,d.n);g.attr('class','node mk'+(d.p.id===sel?' sel':'')).html((d.p.id===sel?`<circle class="selring" r="${Math.max(m.rx,m.ry)+9}"/>`:'')+m.h)
     .attr('aria-label',`${d.p.name}, ${d.p.sub}. ${summary(d.p)}`)}
   else{const r=12+Math.min(7,d.m.length);g.attr('class','node mcl').attr('aria-label',`${d.m.length} places, zoom in`)
     .html(`<circle class="clbg" r="${r}"/>${d.T?`<path class="clT" d="${arc(r,180,360)}"/>`:''}${d.Wy?`<path class="clW" d="${arc(r,0,180)}"/>`:''}<text dy=".35em">${d.m.length}</text><circle class="hit" r="${r+4}"/>`)}})
  .on('mouseenter',(e,d)=>{if(hover&&d.kind==='p')showTip(d)}).on('mouseleave',hideTip)
  .on('click keydown',(e,d)=>{if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();
   if(d.kind==='c'){const xs=d.m.map(m=>m.x),ys=d.m.map(m=>m.y);zoomToBox(d3.min(xs),d3.min(ys),d3.max(xs),d3.max(ys))}else openDrawer(d.p.id)});
 // labels, greedy and collision-free (never over another pin)
 const boxes=data.map(d=>d.kind==='c'?{x:d.x-20,y:d.y-20,w:40,h:40}:(d.t&&d.w?{x:d.x-20,y:d.y-12,w:40,h:24}:{x:d.x-9,y:d.y-9,w:18,h:18}));
 const over=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;const placed=[],labs=[];
 const cand=singles.slice().sort((a,b)=>(b.p.id===sel)-(a.p.id===sel)||b.r-a.r);const maxL=W<600?14:60;
 for(const it of cand){if(labs.length>=maxL&&it.p.id!==sel)break;const txt=it.p.name,w=textW(txt)+10,h=17,ox=(it.t&&it.w?22:12);
  const tries=[[it.x+ox,it.y-h/2],[it.x-ox-w,it.y-h/2],[it.x-w/2,it.y-h-12],[it.x-w/2,it.y+12]];
  for(const [x,y] of tries){const b={x,y,w,h};if(x<2||y<2||x+w>W-2||y+h>H-2)continue;if(placed.some(o=>over(b,o))||boxes.some(o=>over(b,o)&&!(Math.abs(o.x+o.w/2-it.x)<1&&Math.abs(o.y+o.h/2-it.y)<1)))continue;
   placed.push(b);labs.push({key:it.p.id,x,y,w,h,txt,cls:(it.t&&it.w?'both':it.w&&!it.t?'wl':'tl')+(it.p.id===sel?' sel':''),pid:it.p.id});break}}
 LB.selectAll('g.mlab').data(labs,d=>d.key).join(en=>{const g=en.append('g').attr('class','mlab');g.append('rect');g.append('text');return g})
  .attr('class',d=>'mlab '+d.cls).attr('transform',d=>`translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`)
  .each(function(d){const g=d3.select(this);g.select('rect').attr('width',d.w).attr('height',d.h).attr('rx',8.5);g.select('text').attr('x',5).attr('y',12.2).text(d.txt)})
  .on('click',(e,d)=>{e.stopPropagation();openDrawer(d.pid)});
}
const arc=(r,a0,a1)=>{const p=a=>[r*Math.cos((a-90)*Math.PI/180),r*Math.sin((a-90)*Math.PI/180)];const [x0,y0]=p(a0),[x1,y1]=p(a1);return `M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`};
// ---- copy
const TL={live:'Live, driverless','live-driver':'Live, safety driver',announced:'Coming soon'};
const WL=w=>w.status==='live'?(w.gradual?'Live, waitlist rollout':w.via?'Live via '+w.via:'Live'):'Up next'+(w.year?', aiming for '+w.year:'');
function summary(p){const o=p.jobs.filter(j=>j.a&&j.c!=='selfdriving').length,sd=p.jobs.filter(j=>j.a&&j.c==='selfdriving').length;const b=[];
 if(p.tesla)b.push('Tesla '+TL[p.tesla.status].toLowerCase());if(o)b.push(`${o} Tesla Robotaxi role${o===1?'':'s'}`);if(sd)b.push(`${sd} self-driving test role${sd===1?'':'s'}`);
 if(p.waymo)b.push('Waymo '+WL(p.waymo).toLowerCase());if(p.wh)b.push(`${p.wh.count} Waymo job ad${p.wh.count===1?'':'s'}`);return b.join(', ')||'No open roles'}
function showTip(d){const p=d.p;tip.innerHTML=`<b>${esc(p.name)}</b><span class="msub">${esc(p.sub)}</span><div>${esc(summary(p))}</div><small>${hover?'Click':'Tap'} for details</small>`;
 tip.hidden=false;const x=d.x+16+240>W?d.x-16-240:d.x+16;tip.style.left=Math.max(6,x)+'px';tip.style.top=Math.max(6,Math.min(H-tip.offsetHeight-6,d.y-24))+'px'}
function hideTip(){tip.hidden=true}
// ---- drawer
const CATS=[['supervisor','Fleet Support Supervisors'],['fleet','Fleet Support Specialists & Ops'],['other','Other Robotaxi roles'],['selfdriving','Self-driving test roles','Not Robotaxi jobs. Tesla vehicle operators and data collection crews that test its self-driving software.']];
const SG={svc:'Service & charging',biz:'Market, ops & business',eng:'Engineering & product'};
const srcs=a=>(a||[]).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)} &#8599;</a>`).join('');
function jobLi(j,multi){return `<li class="${j.a?'':'closed'}"><a href="${esc(/^https?:/.test(j.u)?j.u:'https://www.tesla.com/careers/search/job/'+j.u)}" target="_blank" rel="noopener">${esc(j.t)} &#8599;</a><small>${j.sg?`<em>${SG[j.sg]}</em> `:''}${multi?esc(j.city.split(',')[0])+' · ':''}#${esc(j.id)} · ${j.a?'first seen '+fd(j.fs):'closed '+fd(j.rm||j.ls)}</small></li>`}
function body(p){const multi=new Set(p.jobs.map(j=>j.city)).size>1;let h=`<header><div class="mdk">${p.cc==='US'?'United States':esc(p.sub)}</div><h3>${esc(p.name)}${p.cc==='US'?`<span>${esc(p.sub)}</span>`:''}</h3><p>${esc(summary(p))}</p></header>`;
 // Tesla
 h+=`<section class="mdsec t"><h4><i class="dotT"></i>Tesla</h4>`;
 if(p.tesla)h+=`<div class="mdstat"><span class="vchip t s-${p.tesla.status==='announced'?'announced':p.tesla.status}">${TL[p.tesla.status]}</span></div><p>${esc(p.tesla.note)}</p><p class="mdsrc">${srcs(p.tesla.sources)}</p>`;
 else h+=`<p class="mdmut">No Tesla Robotaxi service live or announced here.</p>`;
 for(const l of (p.launches||[]).filter(l=>l.status==='live'&&l.date))h+=`<p class="mdl">${esc(l.name)}: service since ${fd(l.date)}${l.mode?' · '+esc(l.mode):''}. <a href="${esc(l.href)}">Launch evidence and hiring lead time &#8595;</a></p>`;
 const act=p.jobs.filter(j=>j.a),cl=p.jobs.filter(j=>!j.a);
 if(!p.jobs.length)h+=`<p class="mdmut">No tracked Tesla postings within ${M.radius} mi.</p>`;
 for(const [k,label,note] of CATS){const js=act.filter(j=>RK(j.c)===k);if(!js.length)continue;
  h+=`<div class="mdcat ${F.role[k]?'':'off'}"><h5>${label} <b>${js.length}</b>${F.role[k]?'':' <em>hidden on map</em>'}</h5>${note?`<p class="mdmut">${note}</p>`:''}<ul>${js.map(j=>jobLi(j,multi)).join('')}</ul></div>`}
 if(cl.length)h+=`<details class="mdclosed"><summary>${cl.length} closed ad${cl.length===1?'':'s'} (not counted)</summary><ul>${cl.map(j=>jobLi(j,multi)).join('')}</ul></details>`;
 if(p.jobs.length)h+=`<p class="mdsrc">Source: <a href="https://www.tesla.com/careers/search/" target="_blank" rel="noopener">Tesla careers &#8599;</a>, checked ${fd(M.last)}. First seen means first seen by this tracker (checks began 20 Nov 2026).</p>`;
 const fleetCities=[...new Set(act.filter(j=>['supervisor','specialist','operations'].includes(j.c)).map(j=>j.city))];
 if(fleetCities.length)h+=`<p class="mdl">${fleetCities.map(c=>`<a href="#c-${slug(c)}">${esc(c.split(',')[0])} city card &#8595;</a>`).join(' ')}</p>`;
 h+='</section>';
 // Waymo
 h+=`<section class="mdsec w"><h4><i class="dotW"></i>Waymo</h4>`;
 if(p.waymo)h+=`<div class="mdstat"><span class="vchip w s-${p.waymo.status==='live'?'live':'announced'}">${esc(WL(p.waymo))}</span></div><p>${esc(p.waymo.note)}</p><p class="mdsrc">${srcs(p.waymo.sources)}</p>`;
 else h+=`<p class="mdmut">Waymo hasn't named this ${p.metro?'metro':'city'} for service.</p>`;
 if(p.wh)h+=`<div class="mdcat"><h5>Waymo job ads naming this ${p.cc==='US'?'metro':'city'} <b>${p.wh.count}</b></h5><p class="mdmut">Any role, from Waymo's own board. Mostly engineering and corporate, so a weaker signal than Tesla's fleet ads.</p><ul>${p.wh.examples.map(e=>`<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)} &#8599;</a><small>${esc(e.location)}${e.firstPublished?' · posted '+fd(e.firstPublished):''}</small></li>`).join('')}</ul><p class="mdsrc">Source: <a href="https://careers.withwaymo.com/jobs/search" target="_blank" rel="noopener">Waymo careers &#8599;</a> via the public Greenhouse API, checked ${fd(M.waymoChecked)}.</p></div>`;
 h+='</section>';
 // grouping
 if(p.cities.length&&(p.metro||p.cities.length>1))h+=`<p class="mdgroup">${p.metro?`Pin sits on the ${esc(p.name)} metro. Tesla postings within ${M.radius} mi are grouped here:`:'Nearby cities within 35 mi grouped here:'} ${p.cities.map(c=>`${esc(c.name)}${c.d?` (${c.d} mi)`:''}`).join(', ')}.</p>`;
 return h}
function openDrawer(id,fly){const p=byId.get(id);if(!p)return;sel=id;$('#mdbody').innerHTML=body(p);drawer.hidden=false;requestAnimationFrame(()=>drawer.classList.add('open'));stage.classList.add('dopen');
 $('#mdbody').scrollTop=0;history.replaceState(null,'','#place='+id);hideTip();if(fly)flyTo(p);else draw()}
function closeDrawer(){if(!sel)return;sel=null;drawer.classList.remove('open');stage.classList.remove('dopen');setTimeout(()=>{if(!sel)drawer.hidden=true},260);
 if(/^#place=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);draw()}
$('#mclose').onclick=e=>{e.stopPropagation();closeDrawer()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#msres').hidden)closeRes();else closeDrawer()}});
// ---- views
function tFor(b,pad=.9){const x0=fit.ox+fit.s*b[0],y0=fit.oy+fit.s*b[1],x1=fit.ox+fit.s*b[2],y1=fit.oy+fit.s*b[3];
 const dw=stage.classList.contains('dopen')&&W>760?370:0,aw=W-dw;const k=Math.min(aw/(x1-x0),H/(y1-y0))*pad;return d3.zoomIdentity.translate(aw/2-k*(x0+x1)/2,H/2-k*(y0+y1)/2).scale(k)}
function zoomToBox(x0,y0,x1,y1){const bx=T.invert([x0,y0]),by=T.invert([x1,y1]);const w=Math.max(40,bx[0]-by[0]?Math.abs(by[0]-bx[0]):40),h=Math.max(30,Math.abs(by[1]-bx[1]));
 const k=Math.min(70,Math.max(T.k*2.2,Math.min(W/(w*1.8),H/(h*1.8))));const cx=(bx[0]+by[0])/2,cy=(bx[1]+by[1])/2;svg.transition().duration(650).call(zoom.transform,d3.zoomIdentity.translate(W/2-k*cx,H/2-k*cy).scale(k))}
function setMode(m){if(m===mode)return;mode=m;svg.classed('switching',true);d3.selectAll('#mfit .base').classed('on',function(){return this.classList.contains(m)});
 MK.selectAll('*').remove();LB.selectAll('*').remove();LK.selectAll('*').remove();setTimeout(()=>svg.classed('switching',false),380)}
function goView(v,anim=true){view=v;document.querySelectorAll('.mseg button').forEach(b=>{b.classList.toggle('on',b.dataset.view===v);b.setAttribute('aria-pressed',b.dataset.view===v)});
 const m=v==='us'?'us':'world',sw=m!==mode;setMode(m);const t=v==='us'?d3.zoomIdentity:tFor(M.presets[v],v==='world'?1:.9);
 if(sw||!anim)svg.call(zoom.transform,t);else svg.transition().duration(800).call(zoom.transform,t);counts()}
document.querySelectorAll('.mseg button').forEach(b=>b.onclick=()=>goView(b.dataset.view));
function flyTo(p){if(!p.us&&mode==='us')goView('world');const v=xy(p);if(!v){draw();return}
 const k=Math.max(T.k,mode==='us'?3.2:9),x=fit.ox+fit.s*v[0],y=fit.oy+fit.s*v[1],dw=stage.classList.contains('dopen')&&W>760?370:0,cy=W<=760&&stage.classList.contains('dopen')?H*.3:H/2;
 svg.transition().duration(800).call(zoom.transform,d3.zoomIdentity.translate((W-dw)/2-k*x,cy-k*y).scale(k))}
$('#mzin').onclick=()=>svg.transition().duration(400).call(zoom.scaleBy,1.7);
$('#mzout').onclick=()=>svg.transition().duration(400).call(zoom.scaleBy,1/1.7);
$('#mzreset').onclick=()=>goView(view==='us'?'us':view);
// ---- filters
document.querySelectorAll('.mchip').forEach(b=>b.onclick=()=>{const g=b.dataset.g,v=b.dataset.v;F[g][v]=F[g][v]?0:1;b.classList.toggle('on',!!F[g][v]);b.setAttribute('aria-pressed',!!F[g][v]);
 document.querySelectorAll('.mchip[data-g=role]').forEach(x=>x.disabled=!F.op.tesla);draw();counts();if(sel)$('#mdbody').innerHTML=body(byId.get(sel))});
function counts(){const inView=P.filter(p=>xy(p));let pins=0,tl=0,tlD=0,ta=0,wl=0,wa=0,wh=0;const jobs=[],cities=new Set();
 for(const p of inView){const t=tState(p),w=wState(p);if(t||w)pins++;const nm=(M.liveByPid&&M.liveByPid[p.id])||1;if(t==='live'||t==='live-driver')tl+=nm;if(t==='live-driver')tlD++;if(t==='ann')ta++;if(w==='live')wl++;if(w==='ann')wa++;if(wState(p,{...F,st:{hire:F.st.hire}})==='hire')wh++;
  for(const j of openJobs(p)){jobs.push(j);cities.add(j.city)}}
 const sd=jobs.filter(j=>j.c==='selfdriving').length,rt=jobs.length-sd;
 const part=[];
 if(F.op.tesla){const b=[];if(F.st.hire){const rc=new Set(jobs.filter(j=>j.c!=='selfdriving').map(j=>j.city)),sc=new Set(jobs.filter(j=>j.c==='selfdriving').map(j=>j.city));
  if(F.role.supervisor||F.role.fleet||F.role.other)b.push(`<b>${rt}</b> Robotaxi role${rt===1?'':'s'} in <b>${rc.size}</b> cit${rc.size===1?'y':'ies'}`);
  if(F.role.selfdriving)b.push(`<b>${sd}</b> self-driving test role${sd===1?'':'s'} in <b>${sc.size}</b> cit${sc.size===1?'y':'ies'}`)}
  if(F.st.live)b.push(`<b>${tl}</b> live market${tl===1?'':'s'}${tlD?` (${tlD} with safety driver)`:''}`);if(F.st.ann)b.push(`<b>${ta}</b> coming soon`);part.push(`<span class="mcT"><i></i>Tesla ${b.join(' · ')}</span>`)}
 if(F.op.waymo){const b=[];if(F.st.live)b.push(`<b>${wl}</b> live`);if(F.st.ann)b.push(`<b>${wa}</b> up next`);if(F.st.hire)b.push(`<b>${wh}</b> with job ads`);part.push(`<span class="mcW"><i></i>Waymo ${b.join(' · ')}</span>`)}
 $('#mcount').innerHTML=`<span class="mcN"><b>${pins}</b> pins ${mode==='us'?'in the US':'worldwide'}</span>${part.join('')}${!pins?'<span class="mcE">Nothing matches. Turn a filter back on.</span>':''}`}
// ---- search
const IDX=[];for(const p of P){IDX.push({s:(p.name+' '+p.sub).toLowerCase(),label:p.name,sub:p.sub,p});for(const c of p.cities)if(c.name!==p.name)IDX.push({s:c.k.toLowerCase(),label:c.name,sub:c.k.split(', ')[1]+' · in '+p.name+' pin',p})}
const q=$('#msq'),res=$('#msres');let hits=[],hi=0;
function closeRes(){res.hidden=true;q.setAttribute('aria-expanded','false')}
function renderRes(){res.innerHTML=hits.length?hits.map((h,i)=>`<li role="option" id="msr${i}" class="${i===hi?'on':''}" data-i="${i}"><b>${esc(h.label)}</b><span>${esc(h.sub)}</span><small>${esc(summary(h.p))}</small></li>`).join(''):'<li class="none">No match</li>';res.hidden=false;q.setAttribute('aria-expanded','true');q.setAttribute('aria-activedescendant',hits.length?'msr'+hi:'')}
q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();if(!v){closeRes();return}
 hits=IDX.filter(e=>e.s.includes(v)).sort((a,b)=>(b.s.startsWith(v)-a.s.startsWith(v))||(rank(tState(b.p,ALL),wState(b.p,ALL))-rank(tState(a.p,ALL),wState(a.p,ALL)))).slice(0,8);hi=0;renderRes()});
q.addEventListener('keydown',e=>{if(res.hidden)return;if(e.key==='ArrowDown'){hi=Math.min(hits.length-1,hi+1);renderRes();e.preventDefault()}else if(e.key==='ArrowUp'){hi=Math.max(0,hi-1);renderRes();e.preventDefault()}else if(e.key==='Enter'&&hits[hi]){pick(hits[hi]);e.preventDefault()}});
res.addEventListener('mousedown',e=>{const li=e.target.closest('li[data-i]');if(li){e.preventDefault();pick(hits[+li.dataset.i])}});
q.addEventListener('blur',()=>setTimeout(closeRes,120));
function pick(h){closeRes();q.value=h.label;q.blur();if(!h.p.us&&mode==='us')goView('world');openDrawer(h.p.id,true)}
// ---- boot
new ResizeObserver(()=>resize()).observe(stage);
resize();counts();
const m0=(location.hash.match(/^#place=([\w-]+)/)||[])[1];if(m0&&byId.has(m0))setTimeout(()=>openDrawer(m0,true),50);
function setOp(v,on){F.op[v]=on?1:0;const b=document.querySelector(`.mchip[data-g=op][data-v=${v}]`);if(b){b.classList.toggle('on',!!on);b.setAttribute('aria-pressed',!!on)}
 document.querySelectorAll('.mchip[data-g=role]').forEach(x=>x.disabled=!F.op.tesla);draw();counts();if(sel)$('#mdbody').innerHTML=body(byId.get(sel));document.dispatchEvent(new CustomEvent('mapop',{detail:{op:v,on:!!on}}))}
// chip clicks also announce operator changes (keeps the scoreboard button in sync)
document.querySelectorAll('.mchip[data-g=op]').forEach(b=>b.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('mapop',{detail:{op:b.dataset.v,on:!!F.op[b.dataset.v]}}))));
window.__map={goView,openDrawer,closeDrawer,setOp,F,get mode(){return mode},get sel(){return sel}};
})();
