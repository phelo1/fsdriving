// Cumulative distinct cities with Robotaxi supervisor (or any Robotaxi fleet role) postings vs time, plus launch markers.
(()=>{
const D=JSON.parse(document.getElementById('data').textContent),$=s=>document.querySelector(s);
const C=D.curve;if(!C||!document.getElementById('cv'))return;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P=s=>new Date(s.slice(0,10)+'T12:00:00Z'),DAY=864e5,fmt=d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const today=P(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'})),t0=P(C.trackingStart);
const links=ss=>(ss||[]).map(s=>`<a target="_blank" rel="noopener" href="${esc(s.url)}">${esc(s.publisher)} ↗</a>`).join('');
const launches=D.launches.metros.filter(m=>m.launch&&m.launch.date).map(m=>({m,d:P(m.launch.date),hd:/driver/i.test(m.launch.mode||'')&&!/driverless/i.test(m.launch.mode||'')})).sort((a,b)=>a.d-b.d);
const svg=d3.select('#cv'),tip=$('#cvtip'),wrap=$('.cvwrap');let set='sup',range='all',locked=false;
function steps(){const L=C[set];let n=0;const out=[];
  for(const [k,cs] of d3.groups(L,c=>c.d).sort((a,b)=>a[0].localeCompare(b[0]))){n+=cs.length;
    const kinds=new Set(cs.map(c=>c.src));const kind=kinds.has('confirmed')||kinds.has('tracker')?'conf':kinds.has('estimate')?'est':'base';
    out.push({d:P(k),n,add:cs,kind,base:kind==='base'})}return out}
function showTip(html,px,py,lock){locked=lock;tip.innerHTML='<button class="closetip" aria-label="Close">×</button>'+html;tip.hidden=false;
  const w=wrap.clientWidth;if(w<640){tip.classList.add('dock');tip.style.left=tip.style.top=''}else{tip.classList.remove('dock');tip.style.left=(px+14+258>w?Math.max(8,px-272):px+14)+'px';tip.style.top=Math.max(8,py-30)+'px'}
  tip.querySelector('.closetip').onclick=()=>{locked=false;tip.hidden=true}}
const hide=()=>{if(!locked)tip.hidden=true};
const word=()=>set==='sup'?'supervisor':'Robotaxi fleet';
const KIND={'x-post':'X post','news':'News report','aggregator':'Job site date','archive':'Web archive','id-batch':'Estimate: same job-id batch','id-interpolation':'Estimate: job-id timeline','ambiguous-post':'Estimate: vague post'};
function cityLine(c){const closed=c.open?'':' <span class="muted">(closed since)</span>';
  if(c.src==='confirmed'||c.src==='estimate'){const e=c.ev,src=(e.sources||[])[0];
    return `<li><b class="cvc">${esc(c.city)}, ${esc(c.st)}</b>${closed}<span class="cvk ${c.src}">${esc(KIND[e.kind]||e.kind)} · ${esc(e.confidence)} confidence</span><span class="cve">${esc(e.evidence)}</span>${src?`<a target="_blank" rel="noopener" href="${esc(src.url)}">${esc(src.publisher)} ↗</a>`:''}</li>`}
  return `<li><b class="cvc">${esc(c.city)}, ${esc(c.st)}</b>${closed}<span class="cvk ${c.src}">${c.src==='base'?'Already open at our first check, real date unknown':'First seen by this tracker'}</span></li>`}
function stepTip(s){const head=s.base?`<b>${s.add.length} ${s.add.length>1?'cities':'city'} with no researched date</b><div>already open at our first check, ${fmt(s.d)} · ${s.n} total</div>`
   :`<b>+${s.add.length} ${s.add.length>1?'cities':'city'}</b><div>${s.kind==='est'?'estimated ':''}${fmt(s.d)} · ${s.n} total</div>`;
  return head+`<ul class="cvlist">${s.add.map(cityLine).join('')}</ul>`}
function launchTip(l){const m=l.m;return `<b>${esc(m.name)}: launched</b><div>${fmt(l.d)}${m.launch.mode?' · '+esc(m.launch.mode):''}</div><p>${esc(m.launch.summary||'')}</p>${links(m.launch.sources)}`}
function draw(){
  const S=steps(),W=wrap.clientWidth,mob=W<640,L=mob?34:52,R=mob?40:64,top=48,H=mob?340:410,lane=mob?76:58,plotB=H-lane-26;
  svg.attr('viewBox',`0 0 ${W} ${H}`).attr('height',H);svg.selectAll('*').remove();
  const first=S.length?S[0].d:t0,a=range==='all'?new Date(Math.min(+P('2025-06-01'),+first-20*DAY)):new Date(+today-100*DAY),b=new Date(+today+(range==='all'?25:5)*DAY);
  const x=d3.scaleUtc().domain([a,b]).range([L,W-R]),maxN=S.length?S[S.length-1].n:1;
  const y=d3.scaleLinear().domain([0,Math.max(10,Math.ceil(maxN*1.25/10)*10)]).range([plotB,top]);
  const defs=svg.append('defs');
  const ag=defs.append('linearGradient').attr('id','cvarea').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',1);ag.append('stop').attr('offset',0).attr('stop-color','#ff3b3b').attr('stop-opacity',.38);ag.append('stop').attr('offset',1).attr('stop-color','#ff3b3b').attr('stop-opacity',0);
  const pat=defs.append('pattern').attr('id','cvhatch').attr('width',8).attr('height',8).attr('patternUnits','userSpaceOnUse').attr('patternTransform','rotate(45)');pat.append('line').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',8).attr('stroke','rgba(255,255,255,.06)').attr('stroke-width',3);
  // grid + axes
  svg.append('g').selectAll('line').data(y.ticks(5)).join('line').attr('class','tlgrid').attr('x1',L).attr('x2',W-R).attr('y1',d=>y(d)).attr('y2',d=>y(d));
  svg.append('g').selectAll('text').data(y.ticks(5)).join('text').attr('class','tlaxisn').attr('x',L-8).attr('y',d=>y(d)+4).attr('text-anchor','end').text(d=>d);
  const xt=mob&&range==='all'?x.ticks(d3.utcMonth.every(6)):x.ticks(mob?4:range==='all'?8:7);
  svg.append('g').attr('transform',`translate(0,${H-18})`).attr('class','tlaxis').call(d3.axisBottom(x).tickValues(xt).tickFormat(d3.utcFormat(range==='all'?(mob?"%b '%y":'%b %Y'):'%d %b')).tickSize(0)).call(g=>g.select('.domain').remove());
  svg.append('text').attr('class','tlhead').attr('x',8).attr('y',14).text(set==='sup'?'Cities with supervisor ads':'Cities with any Robotaxi fleet ad');
  svg.append('text').attr('class','tlsub').attr('x',8).attr('y',28).text('cumulative, by earliest evidence of each city');
  // where our own daily checks begin
  if(x(t0)>L+30&&x(t0)<W-R-40){svg.append('line').attr('class','cvt0').attr('x1',x(t0)).attr('x2',x(t0)).attr('y1',top).attr('y2',plotB)}
  svg.append('line').attr('class','tltoday').attr('x1',x(today)).attr('x2',x(today)).attr('y1',top-4).attr('y2',plotB);
  svg.append('text').attr('class','tllabel').attr('x',x(today)+4).attr('y',top-6).text('today');
  // launch lane
  const ly=plotB+22;svg.append('line').attr('class','tllane').attr('x1',L).attr('x2',W-R).attr('y1',ly).attr('y2',ly);
  svg.append('text').attr('class','tllabel').attr('x',8).attr('y',plotB+12).text('launches');
  const vis=launches.filter(l=>l.d>=a&&l.d<=b),rows=[[],[],[]],cw=mob?5.9:6.1;
  vis.forEach(l=>{const lx=x(l.d);let row=0;
    svg.append('line').attr('class','cvlv').attr('x1',lx).attr('x2',lx).attr('y1',top).attr('y2',ly);
    const g=svg.append('g').attr('class','cvl').attr('transform',`translate(${lx},${ly})`);
    g.append('rect').attr('class','tllaunch'+(l.hd?' hd':'')).attr('x',-6).attr('y',-6).attr('width',12).attr('height',12).attr('transform','rotate(45)');
    const sameDay=vis.filter(o=>+o.d===+l.d);if(sameDay[0]!==l)return;
    const label=sameDay.map(o=>o.m.name.replace('SF Bay Area','Bay Area')).join(' + '),hw=label.length*cw/2+4;
    let lo=Math.max(L-20,lx-hw),hi=lo+2*hw;if(hi>W-4){hi=W-4;lo=hi-2*hw}
    row=rows.findIndex(r=>r.every(([p,q])=>hi<p||lo>q));if(row<0)row=rows.length-1;rows[row].push([lo,hi]);
    g.append('text').attr('class','cvlname').attr('x',(lo+hi)/2-lx).attr('y',18+row*13).attr('text-anchor','middle').text(label);
    const html=sameDay.map(launchTip).join('<hr>');
    g.on('mouseenter',()=>{if(!locked)showTip(html,lx,ly-80,false)}).on('mouseleave',hide).on('click',ev=>{ev.stopPropagation();showTip(html,lx,ly-80,true)})});
  if(!S.length)return;
  // the curve: solid horizontal runs, risers styled by evidence (solid = sourced, dotted = estimate, dashed = unknown)
  const last=S[S.length-1],pts=[...S.map(s=>[s.d,s.n]),[today,last.n]];
  const line=d3.line().x(d=>x(d[0])).y(d=>y(d[1])).curve(d3.curveStepAfter);
  svg.append('path').attr('class','cvarea').attr('d',d3.area().x(d=>x(d[0])).y0(y(0)).y1(d=>y(d[1])).curve(d3.curveStepAfter)(pts));
  svg.append('path').attr('class','cvglow').attr('d',line(pts));
  S.forEach((s,i)=>{const nx=i+1<S.length?S[i+1].d:today,prev=i?S[i-1].n:0;
    svg.append('line').attr('class','cvseg').attr('x1',x(s.d)).attr('x2',x(nx)).attr('y1',y(s.n)).attr('y2',y(s.n));
    svg.append('line').attr('class','cvrise '+s.kind).attr('x1',x(s.d)).attr('x2',x(s.d)).attr('y1',y(prev)).attr('y2',y(s.n))});
  const dots=svg.append('g').selectAll('g').data(S).join('g').attr('class','cvdot').attr('transform',s=>`translate(${x(s.d)},${y(s.n)})`);
  dots.append('circle').attr('r',mob?13:11).attr('class','cvhit');
  dots.append('circle').attr('r',s=>s.kind==='conf'?4.5:5).attr('class',s=>s.kind==='conf'?'cvn':s.kind==='est'?'cve2':'cvb');
  dots.on('mouseenter',(ev,s)=>{if(!locked)showTip(stepTip(s),x(s.d),y(s.n),false)}).on('mouseleave',hide).on('click',(ev,s)=>{ev.stopPropagation();showTip(stepTip(s),x(s.d),y(s.n),true)});
  const base=S.find(s=>s.base);
  if(base&&x(base.d)-L>40){svg.append('text').attr('class','cvbl').attr('x',x(base.d)-10).attr('y',y(base.n)-12).attr('text-anchor','end').text(`${base.add.length} with no researched date`)}
  svg.append('text').attr('class','tlval s cvend').attr('x',x(today)+8).attr('y',y(last.n)+4).text(last.n);
}
function note(){const L=C[set],cnt=k=>L.filter(c=>c.src===k).length,conf=cnt('confirmed'),est=cnt('estimate'),base=cnt('base'),tr=cnt('tracker');
  $('#cvnote').textContent=`How these dates work: this tracker started checking Tesla's careers site on ${fmt(t0)}. For the ${L.length} ${set==='sup'?'supervisor':'Robotaxi role'} cities, ${conf} are dated from a source that names the role in that city (X posts, news, a job site's posted date), ${est} are estimates (hollow dots: same batch of Tesla job ids as a dated post, the job-id timeline, or a post that doesn't say which city had which role), ${tr} ${tr===1?'was':'were'} first spotted by our own checks, and ${base} ${base===1?'is':'are'} still unknown, left on our first check day. Sourced dates are the earliest evidence we found, so the real posting can be a bit earlier. A city counts once, even if its ads later close. Tap a dot for the source.`}
document.querySelectorAll('.cv-f button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.cv-f button').forEach(o=>o.classList.toggle('on',o===b));range=b.dataset.r;locked=false;tip.hidden=true;draw()});
document.querySelectorAll('.cv-s button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.cv-s button').forEach(o=>o.classList.toggle('on',o===b));set=b.dataset.s;locked=false;tip.hidden=true;draw();note()});
document.addEventListener('click',e=>{if(!e.target.closest('#cv,#cvtip')){locked=false;tip.hidden=true}});
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(draw,150)});
draw();note();
})();
