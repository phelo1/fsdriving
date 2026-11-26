// Builds dist/news/index.html from data/news.json. Every item carries its own source links; nothing is added here.
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtD = d => { const [y, m, dd] = d.slice(0, 10).split('-'); return dd ? `${+dd} ${MO[m - 1]} ${y}` : `${MO[m - 1]} ${y}`; };
const dur = s => s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const VERD = { confirmed: ['Confirmed', 'vc'], debunked: ['Debunked', 'vd'], review: ['Under review', 'vr'] };
const STAT = { Confirmed: 'sc', Pending: 'sp', Rumour: 'sr' };
export function newsHtml({ N, esc, headTags, topHeader, footerHtml, css }) {
  const srcs = ss => `<div class="nsrcs">${ss.map(s => `<a class="nsrc${s.primary ? ' pri' : ''}" href="${esc(s.url)}" target="_blank" rel="noopener">${s.primary ? '<span>Primary</span>' : ''}${esc(s.label)} &#8599;</a>`).join('')}</div>`;
  const pill = st => `<span class="npill ${STAT[st]}">${esc(st)}</span>`;
  const R = N.items.filter(i => i.kind === 'rumour').sort((a, b) => b.date.localeCompare(a.date));
  const C = N.items.filter(i => i.kind === 'confirmed').sort((a, b) => b.date.localeCompare(a.date));
  const I = [...N.incidents].sort((a, b) => b.date.localeCompare(a.date)), V = N.videos;
  const cnt = k => I.filter(i => i.verdict === k).length;
  const L = N.lead;
  const story = i => `<article class="nstory" id="n-${esc(i.id)}"><div class="nmeta">${pill(i.status)}<time datetime="${esc(i.date)}">${fmtD(i.date)}</time></div>
<h3>${esc(i.title)}</h3><p>${esc(i.summary)}</p>${srcs(i.sources)}${i.link ? `<a class="nmore" href="${esc(i.link)}">${i.link === '/fsd' ? 'FSD versions tracker' : 'Robotaxi tracker'} &#8594;</a>` : ''}</article>`;
  const inc = i => `<article class="ninc ${VERD[i.verdict][1]}" data-v="${i.verdict}" id="i-${esc(i.id)}">
<div class="nmeta"><span class="nverd ${VERD[i.verdict][1]}">${VERD[i.verdict][0]}</span><time datetime="${esc(i.date)}">${esc(i.dateLabel || fmtD(i.date))}</time><span class="nloc">${esc(i.location)}</span></div>
<h3>${esc(i.title)}</h3>
<div class="ncf"><div><b>Claim</b><p>${esc(i.claim)}</p></div><div><b>What sources show</b><p>${esc(i.finding)}</p></div></div>
${i.video ? `<a class="nxv" href="${esc(i.video.url)}" target="_blank" rel="noopener"><span class="nplay" aria-hidden="true"></span>${esc(i.video.label)} &#8599;</a>` : ''}${srcs(i.sources)}</article>`;
  const vid = v => `<article class="nvid" id="v-${esc(v.id)}"><button class="nthumb" type="button" data-yt="${esc(v.id)}" aria-label="Play: ${esc(v.title)}">
<img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360"><span class="nplay big" aria-hidden="true"></span><span class="ndur">${dur(v.seconds)}</span></button>
<div class="nvb"><div class="ntags">${v.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div><h3><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a></h3>
<p>${esc(v.blurb)}</p><div class="nby"><a href="${esc(v.authorUrl)}" target="_blank" rel="noopener">${esc(v.author)}</a> &middot; <time datetime="${esc(v.published)}">${fmtD(v.published)}</time> &middot; <a href="${esc(v.url)}" target="_blank" rel="noopener">YouTube &#8599;</a></div></div></article>`;
  const title = 'Tesla Robotaxi & FSD news, rumours and fact-checks | FSDriving';
  const desc = `Sourced Tesla FSD, Robotaxi and Cybercab news: ${C.length} confirmed stories, ${R.length + 1} rumours and pending items incl. the 15 Dec EU TCMV vote, ${I.length} incidents fact-checked (${cnt('confirmed')} confirmed, ${cnt('debunked')} debunked) and ${V.length} verified videos.`;
  const tabs = [['all', 'All'], ['rumours', 'Rumours'], ['confirmed', 'Confirmed'], ['incidents', 'Incidents'], ['videos', 'Videos']];
  const sub = [['all', 'All incidents'], ['confirmed', 'Confirmed'], ['debunked', 'Debunked'], ['review', 'Under review']];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${headTags({ title, desc, path: 'news' })}
<link rel="preconnect" href="https://i.ytimg.com">
<style>${css}</style></head><body class="cpage npage">
<div class="grain" aria-hidden="true"></div>
${topHeader('news')}
<main>
<section class="chero nhero">
  <div class="nkick"><span class="hxlive"></span>News, rumours &amp; fact-checks</div>
  <h1 class="hxh">What's real in Tesla autonomy, <em>with receipts</em></h1>
  <p class="clede">FSD, Robotaxi and Cybercab news sorted by how sure we can be: confirmed, pending, rumour, debunked or under review. Every card links to where it came from. Updated ${fmtD(N.checkedAt)}.</p>
  <div class="ncounts">
    <a class="nc" href="#confirmed"><b>${C.length}</b><span>Confirmed</span></a>
    <a class="nc" href="#rumours"><b>${R.length + 1}</b><span>Rumours &amp; pending</span></a>
    <a class="nc" href="#incidents"><b>${I.length}</b><span>Incidents: <i class="g">${cnt('confirmed')} confirmed</i> / <i class="r">${cnt('debunked')} debunked</i> / <i class="a">${cnt('review')} under review</i></span></a>
    <a class="nc" href="#videos"><b>${V.length}</b><span>Verified videos</span></a>
  </div>
</section>
<div class="nbar" role="tablist" aria-label="Filter news">${tabs.map(([id, l], i) => `<button role="tab" data-f="${id}" aria-selected="${i === 0}">${esc(l)}</button>`).join('')}</div>
<div class="nsub" hidden aria-label="Filter incidents">${sub.map(([id, l], i) => `<button data-v="${id}" aria-pressed="${i === 0}">${esc(l)}</button>`).join('')}</div>

<section class="csec nsec" data-sec="rumours" id="rumours" aria-labelledby="nr-h">
<h2 id="nr-h" class="ch2">Watch list: rumours &amp; pending</h2>
<p class="cnote">Pending = scheduled or officially planned, not done. Rumour = reported or hoped for, not confirmed.</p>
<article class="nlead" id="n-${esc(L.id)}">
  <div class="nlm">
    <div class="nmeta">${pill(L.status)}<span class="nwatch">Top watch</span><time datetime="${esc(L.date)}">${fmtD(L.date)}</time></div>
    <h3>${esc(L.title)}</h3><p class="nls">${esc(L.summary)}</p>
    <ul>${L.detail.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
    <a class="ndoc" href="${esc(L.sources[0].url)}" target="_blank" rel="noopener">Read the Commission's draft agenda (PDF) &#8599;</a>
    ${srcs(L.sources.slice(1))}
  </div>
  <blockquote class="npost"><div class="npa"><span class="nx" aria-hidden="true">&#120143;</span>${esc(L.post.author)}</div><p>${esc(L.post.text)}</p>
  <footer><time datetime="${esc(L.post.createdUtc)}">${esc(L.post.createdRiyadh)} Riyadh time</time> &middot; <a href="${esc(L.post.url)}" target="_blank" rel="noopener">View on X &#8599;</a></footer>
  <small>His summary. The agenda itself says the Netherlands would be authorised to grant an EU type-approval; whether the committee votes is still open.</small></blockquote>
</article>
<div class="ngrid">${R.map(story).join('')}</div></section>

<section class="csec nsec" data-sec="confirmed" id="confirmed" aria-labelledby="nc-h">
<h2 id="nc-h" class="ch2">Confirmed news &amp; milestones</h2>
<div class="ngrid">${C.map(story).join('')}</div></section>

<section class="csec nsec" data-sec="incidents" id="incidents" aria-labelledby="ni-h">
<h2 id="ni-h" class="ch2">Incidents, fact-checked</h2>
<p class="cnote"><span class="nverd vc">Confirmed</span> happened, on the record. <span class="nverd vd">Debunked</span> the claim is shown false. <span class="nverd vr">Under review</span> disputed or under investigation. Crash reports are not proof of fault.</p>
<div class="nincs">${I.map(inc).join('')}</div></section>

<section class="csec nsec" data-sec="videos" id="videos" aria-labelledby="nv-h">
<h2 id="nv-h" class="ch2">In action: FSD &amp; Cybercab videos</h2>
<p class="cnote">Every video checked as live on YouTube on ${fmtD(N.checkedAt)}. Tap to play here (privacy-enhanced embed); nothing from YouTube loads until you do.</p>
<div class="nvids">${V.map(vid).join('')}</div></section>
</main>
${footerHtml}
<script>(()=>{const tabs=[...document.querySelectorAll('.nbar button')],subs=[...document.querySelectorAll('.nsub button')],sub=document.querySelector('.nsub'),secs=[...document.querySelectorAll('.nsec')],incs=[...document.querySelectorAll('.ninc')];
let f='all',v='all';
function apply(){tabs.forEach(b=>b.setAttribute('aria-selected',b.dataset.f===f));secs.forEach(s=>s.hidden=!(f==='all'||s.dataset.sec===f));
sub.hidden=f!=='incidents';subs.forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));incs.forEach(c=>c.hidden=!(v==='all'||c.dataset.v===v))}
tabs.forEach(b=>b.onclick=()=>{f=b.dataset.f;if(f!=='incidents')v='all';apply();history.replaceState(null,'',f==='all'?location.pathname:'#'+f);const t=document.querySelector('.nbar');if(scrollY>t.offsetTop)scrollTo({top:document.querySelector('.nhero').offsetHeight,behavior:'smooth'})});
subs.forEach(b=>b.onclick=()=>{v=b.dataset.v;apply()});
document.querySelectorAll('.nc').forEach(a=>a.onclick=e=>{e.preventDefault();f=a.getAttribute('href').slice(1);v='all';apply();history.replaceState(null,'','#'+f);document.querySelector('.nbar').scrollIntoView({behavior:'smooth'})});
document.querySelectorAll('.nthumb').forEach(b=>b.onclick=()=>{const i=document.createElement('iframe');i.src='https://www.youtube-nocookie.com/embed/'+b.dataset.yt+'?autoplay=1&rel=0';i.title=b.getAttribute('aria-label');i.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';i.allowFullscreen=true;i.referrerPolicy='strict-origin-when-cross-origin';i.className='nframe';b.replaceWith(i)});
const h=location.hash.slice(1);if(tabs.some(b=>b.dataset.f===h))f=h;apply();})();</script>
</body></html>`;
}
