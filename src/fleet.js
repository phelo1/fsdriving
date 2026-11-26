// Fleet growth chart: Texas DMV registrations, step lines between real dated readings, linear/log scale, exponential fit.
(()=>{
const D=JSON.parse(document.getElementById('data').textContent),F=D.fleet,svgEl=document.getElementById('flsvg'),tip=document.getElementById('fltip');if(!F||!svgEl||!window.d3)return;
const svg=d3.select(svgEl),wrap=svgEl.parentNode,DAY=864e5;let log=false,showW=true,W=0,H=0;
const fmtD=t=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}),fmtN=v=>v.toLocaleString('en-US');
const T=F.tesla.map(([t,n])=>({t,n})),Wy=F.waymo.map(([t,n])=>({t,n}));
const at=(S,t)=>{let r=null;for(const p of S){if(p.t<=t)r=p;else break}return r};
const fit=t=>Math.exp(F.fit.a+F.fit.b*(t-F.fit.t0)/DAY);
let x,y,M;
function draw(){const r=wrap.getBoundingClientRect();W=Math.max(300,Math.round(r.width));H=W<560?250:320;M={l:W<560?40:52,r:W<560?12:18,t:14,b:28};
 svg.attr('viewBox',`0 0 ${W} ${H}`).attr('width',W).attr('height',H);svg.selectAll('*').remove();
 const t0=Math.min(T[0].t,Wy.length?Wy[0].t:Infinity),t1=F.end;
 const vis=[...T,...(showW?Wy:[])],maxN=Math.max(...vis.map(p=>p.n),fit(t1)),minN=Math.max(1,Math.min(...vis.map(p=>p.n)));
 x=d3.scaleUtc().domain([t0,t1]).range([M.l,W-M.r]);
 y=log?d3.scaleLog().domain([Math.max(1,minN*0.8),maxN*1.08]).range([H-M.b,M.t]):d3.scaleLinear().domain([0,maxN*1.06]).nice().range([H-M.b,M.t]);
 const defs=svg.append('defs'),g=defs.append('linearGradient').attr('id','flg').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',1);
 g.append('stop').attr('offset',0).attr('stop-color','#ff3b3b').attr('stop-opacity',.28);g.append('stop').attr('offset',1).attr('stop-color','#ff3b3b').attr('stop-opacity',0);
 const yt=log?y.ticks(5).filter(v=>[1,2,5].includes(+String(v)[0])&&/^[125]0*$/.test(String(v))):y.ticks(5);
 const ax=svg.append('g').attr('class','flax');
 ax.selectAll('line').data(yt).join('line').attr('x1',M.l).attr('x2',W-M.r).attr('y1',d=>y(d)).attr('y2',d=>y(d));
 ax.selectAll('text.yl').data(yt).join('text').attr('class','yl').attr('x',M.l-8).attr('y',d=>y(d)+4).attr('text-anchor','end').text(d=>d>=1000?(d/1000)+'k':d);
 const xt=x.ticks(W<560?4:7);ax.selectAll('text.xl').data(xt).join('text').attr('class','xl').attr('x',d=>x(d)).attr('y',H-8).attr('text-anchor','middle').text(d=>d3.utcFormat(d.getUTCMonth()===0?'%b %Y':'%b')(d));
 const step=S=>{const pts=[...S,{t:t1,n:S[S.length-1].n}];return d3.line().x(p=>x(p.t)).y(p=>y(p.n)).curve(d3.curveStepAfter)(pts)};
 const area=d3.area().x(p=>x(p.t)).y0(H-M.b).y1(p=>y(p.n)).curve(d3.curveStepAfter);
 svg.append('path').attr('class','flarea').attr('d',area([...T,{t:t1,n:T[T.length-1].n}])).attr('fill','url(#flg)');
 if(showW)svg.append('path').attr('class','flline w').attr('d',step(Wy));
 const fx=d3.range(F.fit.t0,t1+1,(t1-F.fit.t0)/80).map(t=>({t,n:fit(t)}));
 svg.append('path').attr('class','flfit').attr('d',d3.line().x(p=>x(p.t)).y(p=>y(p.n))(fx));
 svg.append('path').attr('class','flline t').attr('d',step(T));
 svg.append('g').selectAll('circle').data(T).join('circle').attr('class','fldot').attr('r',2.4).attr('cx',p=>x(p.t)).attr('cy',p=>y(p.n));
 const last=T[T.length-1];svg.append('circle').attr('class','flend').attr('r',4.5).attr('cx',x(F.end)).attr('cy',y(last.n));
 svg.append('line').attr('class','flguide').attr('y1',M.t).attr('y2',H-M.b).style('display','none');
 svg.append('circle').attr('class','flhov t').attr('r',5).style('display','none');svg.append('circle').attr('class','flhov w').attr('r',4).style('display','none');
 svg.append('rect').attr('class','flhit').attr('x',M.l).attr('y',M.t).attr('width',W-M.l-M.r).attr('height',H-M.t-M.b);
}
function hover(px){const t=x.invert(px).getTime();if(t<T[0].t){hide();return}
 // snap to the nearest real Tesla reading
 let best=T[0];for(const p of T)if(Math.abs(p.t-t)<Math.abs(best.t-t))best=p;const i=T.indexOf(best),prev=T[i-1],w=showW?at(Wy,best.t):null;
 svg.select('.flguide').style('display',null).attr('x1',x(best.t)).attr('x2',x(best.t));
 svg.select('.flhov.t').style('display',null).attr('cx',x(best.t)).attr('cy',y(best.n));
 if(w)svg.select('.flhov.w').style('display',null).attr('cx',x(best.t)).attr('cy',y(w.n));else svg.select('.flhov.w').style('display','none');
 tip.innerHTML=`<b>${fmtD(best.t)}</b><span class="t"><i></i>Tesla <em>${fmtN(best.n)}</em>${prev?` <small>${best.n-prev.n>=0?'+':''}${fmtN(best.n-prev.n)} vs ${fmtD(prev.t)}</small>`:''}</span>${w?`<span class="w"><i></i>Waymo <em>${fmtN(w.n)}</em> <small>as of ${fmtD(w.t)}</small></span>`:''}<span class="f">Fit ${fmtN(Math.round(fit(best.t)))}</span>`;
 tip.hidden=false;const tw=tip.offsetWidth,cx=x(best.t)*wrap.clientWidth/W;tip.style.left=Math.max(4,Math.min(wrap.clientWidth-tw-4,cx-tw/2))+'px';tip.style.top='6px';svgEl.dataset.hover=best.t}
function hide(){tip.hidden=true;svg.selectAll('.flguide,.flhov').style('display','none')}
svgEl.addEventListener('pointermove',e=>{const r=svgEl.getBoundingClientRect();hover((e.clientX-r.left)*W/r.width)});
svgEl.addEventListener('pointerdown',e=>{const r=svgEl.getBoundingClientRect();hover((e.clientX-r.left)*W/r.width)});
svgEl.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hide()});
document.querySelectorAll('.fl-sc button').forEach(b=>b.addEventListener('click',()=>{log=b.dataset.sc==='log';document.querySelectorAll('.fl-sc button').forEach(o=>{o.classList.toggle('on',o===b);o.setAttribute('aria-pressed',o===b)});hide();draw()}));
const wb=document.getElementById('flw');if(wb)wb.addEventListener('click',()=>{showW=!showW;wb.classList.toggle('on',showW);wb.setAttribute('aria-pressed',showW);document.querySelector('.fllegend .w')?.parentNode.classList.toggle('off',!showW);hide();draw()});
let rt;new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(draw,80)}).observe(wrap);draw();
window.__fleet={get log(){return log},hover:px=>hover(px),draw};
})();
