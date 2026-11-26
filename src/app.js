(()=>{
const D=JSON.parse(document.getElementById('data').textContent);
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=j=>j.city+', '+j.st;
const order={supervisor:0,specialist:1,operations:2};
// group by city
const cities={};
for(const j of D.jobs){const k=key(j);(cities[k]=cities[k]||{k,city:j.city,st:j.st,sn:j.sn,x:j.x,y:j.y,jobs:[]}).jobs.push(j)}
const list=Object.values(cities);
const isNew=j=>!D.firstRun&&j.fs===D.last;
const cityNew=c=>!D.firstRun&&c.jobs.some(j=>j.a)&&c.jobs.every(j=>!j.a||j.fs===D.last)&&!c.jobs.some(j=>j.fs!==D.last);
// The interactive map lives in src/map.js.
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-')}
const date=s=>new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Riyadh'});
const dayDiff=(a,b=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'}))=>Math.max(0,Math.floor((new Date(b.slice(0,10)+'T12:00:00Z')-new Date(a.slice(0,10)+'T12:00:00Z'))/864e5));

// changes
function drawChanges(){const el=$('#changes');
  if(D.firstRun){el.innerHTML=`<div class="chg"><h3>What changed</h3><div class="muted">This is the very first check, so there's nothing to compare yet. From the next refresh on, new cities and closed postings show up right here.</div></div>`;return}
  const act=list.filter(c=>c.jobs.some(j=>j.a&&j.c==='supervisor'));
  const newC=act.filter(c=>c.jobs.filter(j=>j.c==='supervisor').every(j=>j.fs===D.last));
  const goneC=list.filter(c=>c.jobs.some(j=>j.c==='supervisor')&&!c.jobs.some(j=>j.a&&j.c==='supervisor')&&c.jobs.some(j=>j.c==='supervisor'&&j.rm===D.last));
  const newJ=D.jobs.filter(j=>j.a&&j.fs===D.last).length,goneJ=D.jobs.filter(j=>!j.a&&j.rm===D.last).length;
  el.innerHTML=`<div class="chg"><h3>Since the last check</h3><div class="muted">${newJ} new posting${newJ===1?'':'s'}, ${goneJ} taken down (all robotaxi fleet roles).</div>
  ${newC.length?`<div><div class="muted" style="font-size:13px;margin-bottom:6px">New supervisor cities</div><div class="chips">${newC.map(c=>`<span class="chip new">${esc(c.city)}, ${esc(c.st)}</span>`).join('')}</div></div>`:''}
  ${goneC.length?`<div><div class="muted" style="font-size:13px;margin-bottom:6px">Supervisor cities that dropped off</div><div class="chips">${goneC.map(c=>`<span class="chip gone">${esc(c.city)}, ${esc(c.st)}</span>`).join('')}</div></div>`:''}
  ${!newC.length&&!goneC.length?'<div class="muted">No supervisor cities added or dropped.</div>':''}</div>`}
drawChanges();drawLead();
function sources(ss){return (ss||[]).map(s=>`<a target="_blank" rel="noopener" href="${esc(s.url)}">${esc(s.publisher)} ↗</a>`).join(' · ')}
function drawLead(){
 const ms=D.launches.metros,live=ms.filter(m=>m.status==='live');
 $('#leadstats').innerHTML=`<div class="leadstats"><div><b>${live.length}</b><span>live markets${D.S&&D.S.driverNames.length?', '+esc(D.S.driverNames.join(', '))+' with a safety driver':''}</span></div><div><b>${D.avgLead==null?'N/A':D.avgLead+'d'}</b><span>average observed hiring-to-launch lead, ${D.leadN} markets with dated evidence</span></div></div>`;
 $('#launchlist').innerHTML=live.sort((a,b)=>a.launch.date.localeCompare(b.launch.date)).map(m=>`<article class="launchcard" id="launch-${m.id}"><div class="launchhead"><h3>${esc(m.name)} <small>${esc(m.state)}</small></h3><span class="livebadge">${esc(m.currentMode)}</span></div><div class="leadbar"><i style="width:${m.leadDays==null?0:Math.min(100,m.leadDays/300*100)}%"></i></div><strong>${m.leadDays==null?'Before tracking began':m.leadDays+' days, at least'}</strong><p>${m.leadDays==null?esc(m.hiringGap||'No sourced pre-launch fleet support or Robotaxi ops hiring date.'):esc(m.leadSignal.role)+' seen by '+date(m.leadSignal.date)+' → launch '+date(m.launch.date)}</p><p>Launch: <b>${date(m.launch.date)}</b> · ${esc(m.launch.access)}</p><p class="lsum">${esc(m.launch.summary)}</p><small>${sources(m.launch.sources)}</small>${m.uncertain?`<p class="uncertain">${esc(m.uncertain)}</p>`:''}<details><summary>Hiring evidence & service milestones</summary>${m.hiringGap?`<p>${esc(m.hiringGap)}</p>`:''}${(m.hiringSignals||[]).map(s=>`<p><b>${date(s.date)}</b> · ${esc(s.kind)}<br>${esc(s.role)}<br><small>${esc(s.note)}<br>${sources(s.sources)}</small></p>`).join('')}${(m.milestones||[]).map(e=>`<p><b>${date(e.date)}</b> ${esc(e.text)}<br><small>${sources(e.sources)}</small></p>`).join('')}</details></article>`).join('');
 const ann=ms.filter(m=>m.status!=='live');
 const annRows=ann.map(m=>{const sig=m.leadSignal,cities=list.filter(c=>c.jobs.some(j=>j.a&&j.m===m.id));
  return `<div class="waitrow ann"><b>${esc(m.name)}, ${esc(m.state)} <span class="annbadge">announced, not live</span></b>${sig?`<span class="counter">${dayDiff(sig.date)} days since first seen hiring</span><small>${esc(sig.role)} · ${sig.kind==='tracker'?'first seen by this tracker':'seen by'} ${date(sig.date)}${sig.kind==='tracker'?'':' · '+sources((m.hiringSignals||[]).find(x=>x.date===sig.date&&x.role===sig.role)?.sources)}</small>`:`<span>No dated fleet support hiring signal yet</span>`}<small>${cities.length?cities.length+' tracked cit'+(cities.length===1?'y':'ies')+' hiring now: '+cities.map(c=>esc(c.city)).join(', '):(m.hiringGap?esc(m.hiringGap):'No openings on Tesla\'s site right now')}</small><small>Announced ${date(m.announced.date)}: ${esc(m.announced.text)} ${sources(m.announced.sources)}</small></div>`}).join('');
 $('#waiting').innerHTML=annRows;
}
setInterval(drawLead,60000);
// counters + reveal
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.rv').forEach(e=>io.observe(e));
if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.querySelectorAll('[data-count]').forEach(el=>{const n=+el.dataset.count,t0=performance.now();el.textContent='0';
  const step=t=>{const p=Math.min(1,(t-t0)/1400),e=1-Math.pow(1-p,3);el.textContent=Math.round(n*e);if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)});
})();
