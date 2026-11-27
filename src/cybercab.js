// Cybercab VIN batch density chart: registered Cybercabs per 500-serial production batch, from the live TxDMV VIN list.
(()=>{
const D=JSON.parse(document.getElementById('data').textContent),C=D.cvin,svg=document.getElementById('cbvsvg'),tip=document.getElementById('cbvtip');if(!C||!svg)return;
const wrap=svg.parentNode,NS='http://www.w3.org/2000/svg',n=v=>v.toLocaleString('en-US');let sel=-1,geo=[];
const el=(t,a,p)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);(p||svg).appendChild(e);return e};
function draw(){const W=Math.max(300,Math.round(wrap.getBoundingClientRect().width)),mob=W<560,H=mob?220:270,M={l:mob?34:44,r:mob?8:14,t:mob?26:30,b:mob?34:38};
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('width',W);svg.setAttribute('height',H);svg.innerHTML='';
 const B=C.buckets,size=C.bucketSize,cw=(W-M.l-M.r)/B.length,gap=Math.max(3,cw*.18),y=v=>H-M.b-(H-M.t-M.b)*v/size;
 const d=el('defs',{}),g=el('linearGradient',{id:'cbvg',x1:0,y1:0,x2:0,y2:1},d);el('stop',{offset:'0','stop-color':'#ffe08a'},g);el('stop',{offset:'.55','stop-color':'#f5c542'},g);el('stop',{offset:'1','stop-color':'#b8862a'},g);
 const f=el('filter',{id:'cbvglow',x:'-50%',y:'-50%',width:'200%',height:'200%'},d);el('feGaussianBlur',{stdDeviation:mob?3:5,result:'b'},f);const mg=el('feMerge',{},f);el('feMergeNode',{in:'b'},mg);el('feMergeNode',{in:'SourceGraphic'},mg);
 [0,.25,.5,.75,1].forEach(k=>{const v=size*k;el('line',{class:'cbvgl',x1:M.l,x2:W-M.r,y1:y(v),y2:y(v)});const t=el('text',{class:'cbvax',x:M.l-7,y:y(v)+4,'text-anchor':'end'});t.textContent=n(v)});
 geo=B.map((b,i)=>{const x=M.l+i*cw+gap/2,w=cw-gap;return{b,x,w}});
 const last=geo[geo.length-1],hx=last.x+last.w;
 geo.forEach(({b,x,w},i)=>{
  el('rect',{class:'cbvghost',x,y:y(b.batchSize),width:w,height:y(0)-y(b.batchSize),rx:Math.min(6,w/4)});
  if(b.registered>0){el('rect',{class:'cbvbar','data-i':i,x,y:y(b.registered),width:w,height:Math.max(1.5,y(0)-y(b.registered)),rx:Math.min(6,w/4),fill:'url(#cbvg)',filter:'url(#cbvglow)'})}
  if(!mob||w>26){const t=el('text',{class:'cbvpct'+(b.registered?'':' z'),x:x+w/2,y:Math.min(y(b.registered),y(b.batchSize))-7,'text-anchor':'middle'});t.textContent=b.pct?(b.pct>=10?Math.round(b.pct):b.pct)+'%':'0'}
  if((b.start-1)%(mob?2000:1000)===0&&hx-x>(mob?80:120)){const t=el('text',{class:'cbvax',x:x,y:H-M.b+16,'text-anchor':'start'});t.textContent='#'+n(b.start)}
 });
 el('line',{class:'cbvhi',x1:hx,x2:hx,y1:M.t-4,y2:H-M.b+4});
 const ht=el('text',{class:'cbvhit',x:hx,y:H-M.b+16,'text-anchor':'end'});ht.textContent=(mob?'#':'Highest #')+n(C.highestSerial);
 const cap=el('text',{class:'cbvax',x:M.l,y:H-6});cap.textContent=mob?'Cybercab VIN serial, 500 per batch':'Cybercab VIN serial (positions 12 to 17), batches of 500';
 geo.forEach((q,i)=>{const r=el('rect',{class:'cbvhitbox',x:q.x-gap/2,y:M.t-10,width:cw,height:H-M.b-M.t+10,tabindex:0,role:'button','aria-label':`Serials ${q.b.label}: ${q.b.registered} of ${q.b.batchSize} registered in Texas`});
  const on=()=>show(i);r.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')on()});r.addEventListener('pointerdown',e=>{e.stopPropagation();on()});r.addEventListener('focus',on);r.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')hide()})});
 if(sel>=0)show(sel);
}
function show(i){sel=i;const q=geo[i],b=q.b,W=wrap.clientWidth;svg.querySelectorAll('.cbvbar').forEach(e=>e.classList.toggle('on',+e.dataset.i===i));
 tip.hidden=false;tip.innerHTML=`<b>Serials ${b.label}</b><span><em>${n(b.registered)}</em> of ${n(b.batchSize)} registered in Texas</span><span class="g">${b.pct}% of this batch</span>${b.end===C.highestSerial?'<small>Latest batch, still filling</small>':''}`;
 const vb=svg.viewBox.baseVal,sx=W/vb.width,cx=(q.x+q.w/2)*sx,tw=tip.offsetWidth;tip.style.left=Math.max(4,Math.min(W-tw-4,cx-tw/2))+'px';tip.style.top='6px'}
function hide(){sel=-1;tip.hidden=true;svg.querySelectorAll('.cbvbar.on').forEach(e=>e.classList.remove('on'))}
document.addEventListener('pointerdown',e=>{if(!svg.contains(e.target))hide()});
draw();let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(draw,150)});
window.__cvin={show,hide,get bars(){return svg.querySelectorAll('.cbvbar').length},get batches(){return geo.length}};
})();
