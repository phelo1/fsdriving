// Timeline: daily postings (our own checks) on top, hiring-signal to launch spans per metro below.
(()=>{
const D=JSON.parse(document.getElementById('data').textContent),$=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P=s=>new Date(s.slice(0,10)+'T12:00:00Z'),fmt=d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const today=P(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'}));
const series=(D.history&&D.history.series||[]).map(p=>({...p,d:P(p.date)}));
const ms=D.launches.metros.map(m=>{const sig=m.leadSignal,ld=m.launch&&P(m.launch.date);
  const hints=(m.hiringSignals||[]).filter(s=>s.kind==='vehicle-operator');
  return {m,sig,sd:sig&&P(sig.date),ld,hints}}).sort((a,b)=>((a.ld||today)-(b.ld||today))||a.m.name.localeCompare(b.m.name));
const srcOf=(m,sig)=>sig.kind==='tracker'?[{publisher:'This tracker',url:'/data.json'}]:((m.hiringSignals||[]).find(x=>x.date===sig.date&&x.role===sig.role)||{}).sources||[];
const links=ss=>(ss||[]).map(s=>`<a target="_blank" rel="noopener" href="${esc(s.url)}">${esc(s.publisher)} ↗</a>`).join('<br>');
const allDates=[...ms.flatMap(r=>[r.sd,r.ld]).filter(Boolean),...series.map(p=>p.d)];
const start=new Date(Math.min(...allDates)-25*864e5),end=new Date(+today+20*864e5);
const svg=d3.select('#tl'),tip=$('#tltip'),wrap=$('.tlwrap');let mode='lines',x0,x,locked=false;
const COLORS=['#ff4a3d','#ff8a5c','#ffb45c','#ffd78c','#c9e86b','#65efad','#4cc3ff','#7f9bff','#b48cff','#ff7ac8','#ff5c8a','#8ad8c8','#d0d4dd'];
function showTip(html,px,py,lock){locked=lock;tip.innerHTML='<button class="closetip" aria-label="Close">×</button>'+html;tip.hidden=false;
  const w=wrap.clientWidth;if(w<640){tip.classList.add('dock');tip.style.left=tip.style.top=''}else{tip.classList.remove('dock');tip.style.left=Math.max(8,Math.min(w-262,px+12))+'px';tip.style.top=Math.max(8,py-20)+'px'}
  tip.querySelector('.closetip').onclick=()=>{locked=false;tip.hidden=true}}
const hide=()=>{if(!locked)tip.hidden=true};
function draw(){
  const W=wrap.clientWidth,mob=W<640,L=mob?92:150,R=mob?30:40,top=40,chartH=mob?120:160,rowH=mob?26:30,gap=46;
  const H=top+chartH+gap+ms.length*rowH+30;svg.attr('viewBox',`0 0 ${W} ${H}`).attr('height',H);svg.selectAll('*').remove();
  x0=d3.scaleUtc().domain([start,end]).range([L,W-R]);x=x||x0.copy();x.range([L,W-R]);
  const defs=svg.append('defs');defs.append('clipPath').attr('id','tlclip').append('rect').attr('x',L).attr('y',0).attr('width',W-R-L).attr('height',H);
  const lg=defs.append('linearGradient').attr('id','tlspan');lg.append('stop').attr('offset',0).attr('stop-color','#ff6a4f');lg.append('stop').attr('offset',1).attr('stop-color','#65efad');
  const ag=defs.append('linearGradient').attr('id','tlarea').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',1);ag.append('stop').attr('offset',0).attr('stop-color','#ff3b3b').attr('stop-opacity',.35);ag.append('stop').attr('offset',1).attr('stop-color','#ff3b3b').attr('stop-opacity',0);
  // axis + grid
  const ticks=x.ticks(mob?4:8);
  svg.append('g').selectAll('line').data(ticks).join('line').attr('class','tlgrid').attr('x1',d=>x(d)).attr('x2',d=>x(d)).attr('y1',top).attr('y2',H-24);
  svg.append('g').attr('transform',`translate(0,${H-22})`).attr('class','tlaxis').call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.utcFormat(x.domain()[1]-x.domain()[0]>200*864e5?'%b %Y':'%d %b')).tickSize(0)).call(g=>g.select('.domain').remove());
  // today line + tracking start
  const g=svg.append('g').attr('clip-path','url(#tlclip)');
  g.append('line').attr('class','tltoday').attr('x1',x(today)).attr('x2',x(today)).attr('y1',top-6).attr('y2',H-24);
  svg.append('text').attr('class','tllabel').attr('x',Math.min(W-R-2,x(today))).attr('y',top-6).attr('text-anchor','end').text('today');
  if(series.length){const ts=series[0].d;g.append('rect').attr('class','tltrack').attr('x',x(ts)).attr('y',top).attr('width',Math.max(2,x(today)-x(ts))).attr('height',chartH)}
  // postings panel
  svg.append('text').attr('class','tlhead').attr('x',8).attr('y',14).text('Open postings');
  svg.append('text').attr('class','tlsub').attr('x',mob?8:8).attr('y',28).text('our daily checks, from 20 Nov 2026');
  const maxY=d3.max(series,p=>mode==='lines'?p.all:p.supervisor)||1;
  const y=d3.scaleLinear().domain([0,maxY*1.15]).nice().range([top+chartH,top+8]);
  svg.append('g').attr('class','tlaxis').attr('transform',`translate(${L},0)`).call(d3.axisLeft(y).ticks(3).tickSize(-(W-R-L))).call(g=>g.select('.domain').remove()).call(g=>g.selectAll('line').attr('class','tlgrid'));
  if(mode==='lines'){
    for(const [k,cls] of [['all','r'],['supervisor','s']]){
      const line=d3.line().x(p=>x(p.d)).y(p=>y(p[k])).curve(d3.curveMonotoneX);
      if(k==='supervisor')g.append('path').attr('d',d3.area().x(p=>x(p.d)).y0(y(0)).y1(p=>y(p[k])).curve(d3.curveMonotoneX)(series)).attr('fill','url(#tlarea)');
      g.append('path').attr('class','tlline '+cls).attr('d',line(series));
      const lastP=series[series.length-1];if(lastP)svg.append('text').attr('class','tlval '+cls).attr('x',x(lastP.d)+7).attr('y',y(lastP[k])+4).text(lastP[k]);
      g.selectAll(null).data(series).join('circle').attr('class','tldot '+cls).attr('cx',p=>x(p.d)).attr('cy',p=>y(p[k])).attr('r',mob?3.5:4);
    }
  } else {
    const states=[...new Set(series.flatMap(p=>Object.keys(p.byState)))].sort((a,b)=>d3.sum(series,p=>p.byState[b]||0)-d3.sum(series,p=>p.byState[a]||0));
    const stack=d3.stack().keys(states).value((p,k)=>p.byState[k]||0)(series);
    stack.forEach((layer,i)=>{g.append('path').attr('d',d3.area().x(p=>x(p.data.d)).y0(p=>y(p[0])).y1(p=>y(p[1])).curve(d3.curveMonotoneX)(layer)).attr('fill',COLORS[i%COLORS.length]).attr('opacity',.85).attr('stroke','#07080c').attr('stroke-width',.5)});
    if(series.length===1)stack.forEach((layer,i)=>g.append('rect').attr('x',x(series[0].d)-4).attr('width',8).attr('y',y(layer[0][1])).attr('height',y(layer[0][0])-y(layer[0][1])).attr('fill',COLORS[i%COLORS.length]));
  }
  // hover rule for postings
  const hov=svg.append('rect').attr('x',L).attr('y',top).attr('width',W-R-L).attr('height',chartH).attr('fill','transparent');
  const rule=svg.append('line').attr('class','tlrule').attr('y1',top).attr('y2',top+chartH).style('opacity',0);
  const near=ev=>{const [px]=d3.pointer(ev);if(!series.length)return null;const p=series.reduce((a,b)=>Math.abs(x(b.d)-px)<Math.abs(x(a.d)-px)?b:a);return Math.abs(x(p.d)-px)<60?p:null};
  const pt=(ev,lock)=>{const p=near(ev);if(!p){rule.style('opacity',0);hide();return}rule.attr('x1',x(p.d)).attr('x2',x(p.d)).style('opacity',1);
    const st=Object.entries(mode==='lines'?{}:p.byState).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(' · ');
    showTip(`<b>${fmt(p.d)}</b><div><span class="n">${p.supervisor}</span> supervisor openings in ${p.supervisorCities} cities</div><div><span class="r">${p.all}</span> incl. related roles, ${p.allCities} cities</div>${st?`<div class="tipcities">${st}</div>`:''}<small>Checked ${esc(new Date(p.checkedAt).toLocaleString('en-GB',{timeZone:'Asia/Riyadh',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}))} Riyadh time · tesla.com careers</small>`,x(p.d)/W*wrap.clientWidth,top+20,lock)};
  hov.on('mousemove',ev=>{if(!locked)pt(ev,false)}).on('mouseleave',()=>{rule.style('opacity',0);hide()}).on('click',ev=>pt(ev,true));
  // metro lanes
  const y0=top+chartH+gap;
  svg.append('text').attr('class','tlhead').attr('x',8).attr('y',y0-16).text('Hiring signal to launch');
  ms.forEach((r,i)=>{const cy=y0+i*rowH+rowH/2,m=r.m,row=svg.append('g');
    row.append('text').attr('class','tlname').attr('x',8).attr('y',cy+4).text(m.name+(m.status==='live'?'':' (soon)'));
    row.append('line').attr('class','tllane').attr('x1',L).attr('x2',W-R).attr('y1',cy).attr('y2',cy);
    const gg=g.append('g');
    const tipFor=(html,px,lock)=>showTip(html,px,cy+10,lock);
    const leadTxt=m.leadDays!=null?`<div><span class="n">${m.leadDays} days</span> from hiring signal to launch, at least</div>`:(m.status==='live'?'<div>No pre-launch hiring date: before tracking began</div>':'');
    if(r.sd&&r.ld&&r.sd<r.ld){gg.append('rect').attr('class','tlspan').attr('x',x(r.sd)).attr('y',cy-4).attr('width',Math.max(2,x(r.ld)-x(r.sd))).attr('height',8).attr('rx',4)}
    if(r.sd&&!r.ld){gg.append('line').attr('class','tlwait').attr('x1',x(r.sd)).attr('x2',x(today)).attr('y1',cy).attr('y2',cy)}
    r.hints.forEach(h=>{const hd=P(h.date);gg.append('circle').attr('class','tlhint').attr('cx',x(hd)).attr('cy',cy).attr('r',4)
      .on('mouseenter',ev=>{if(!locked)tipFor(`<b>${esc(m.name)}: hint only</b><div>${fmt(hd)} · ${esc(h.role)}</div><p>${esc(h.note)}</p><small>Not used for lead time.</small><br>${links(h.sources)}`,x(hd),false)}).on('mouseleave',hide)
      .on('click',ev=>{ev.stopPropagation();tipFor(`<b>${esc(m.name)}: hint only</b><div>${fmt(hd)} · ${esc(h.role)}</div><p>${esc(h.note)}</p>${links(h.sources)}`,x(hd),true)})});
    if(r.sd){const html=`<b>${esc(m.name)}: first hiring signal</b><div>${fmt(r.sd)} · ${esc(r.sig.role)}</div>${leadTxt}<small>${r.sig.kind==='tracker'?'First seen by this tracker':'Seen by this date, may have gone up earlier'}</small><br>${links(srcOf(m,r.sig))}`;
      gg.append('circle').attr('class','tlsig').attr('cx',x(r.sd)).attr('cy',cy).attr('r',mob?5:6).attr('tabindex',0)
        .on('mouseenter',()=>{if(!locked)tipFor(html,x(r.sd),false)}).on('mouseleave',hide).on('click',ev=>{ev.stopPropagation();tipFor(html,x(r.sd),true)})}
    if(r.ld){const hd=m.currentMode==='safety-driver',html=`<b>${esc(m.name)}: launched</b><div>${fmt(r.ld)} · ${esc(m.launch.access)} · ${esc(m.launch.mode)}</div><p>${esc(m.launch.summary)}</p>${leadTxt}${m.uncertain?`<p class="uncertain">${esc(m.uncertain)}</p>`:''}${links(m.launch.sources)}`;
      const s=mob?6:7;gg.append('path').attr('class','tllaunch'+(hd?' hd':'')).attr('tabindex',0).attr('d',`M${x(r.ld)},${cy-s}l${s},${s}l${-s},${s}l${-s},${-s}Z`)
        .on('mouseenter',()=>{if(!locked)tipFor(html,x(r.ld),false)}).on('mouseleave',hide).on('click',ev=>{ev.stopPropagation();tipFor(html,x(r.ld),true)})}
    if(!r.ld&&m.announced){const ad=P(m.announced.date);gg.append('rect').attr('class','tlann').attr('x',x(ad)-3).attr('y',cy-7).attr('width',6).attr('height',14).attr('rx',2)
        .on('mouseenter',()=>{if(!locked)tipFor(`<b>${esc(m.name)}: announced</b><div>${fmt(ad)}</div><p>${esc(m.announced.text)}</p>${links(m.announced.sources)}`,x(ad),false)}).on('mouseleave',hide)
        .on('click',ev=>{ev.stopPropagation();tipFor(`<b>${esc(m.name)}: announced</b><div>${fmt(ad)}</div><p>${esc(m.announced.text)}</p>${links(m.announced.sources)}`,x(ad),true)})}
  });
}
// zoom on the time axis only
const zoom=d3.zoom().scaleExtent([1,60]).on('zoom',e=>{x=e.transform.rescaleX(x0);locked=false;tip.hidden=true;draw()});
svg.call(zoom).on('dblclick.zoom',null);
function setRange(r){const W=wrap.clientWidth;draw();
  if(r==='all'){svg.transition().duration(700).call(zoom.transform,d3.zoomIdentity)}
  else{const a=new Date((series[0]?+series[0].d:+today)-10*864e5),b=new Date(+today+6*864e5),k=(x0(end)-x0(start))/(x0(b)-x0(a));
    svg.transition().duration(900).call(zoom.transform,d3.zoomIdentity.scale(k).translate(-x0(a)+x0.range()[0]/k,0))}}
document.querySelectorAll('.tl-f button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tl-f button').forEach(o=>o.classList.toggle('on',o===b));setRange(b.dataset.r)});
document.querySelectorAll('.tl-s button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tl-s button').forEach(o=>o.classList.toggle('on',o===b));mode=b.dataset.s;draw()});
document.addEventListener('click',e=>{if(!e.target.closest('#tl,#tltip')){locked=false;tip.hidden=true}});
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(draw,150)});
draw();
})();
