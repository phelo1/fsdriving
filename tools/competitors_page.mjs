// Builds dist/competitors/index.html from data/competitors.json (hand-checked, every fact sourced).
// Tesla's live numbers come from this tracker's own data (launches.json + jobs.json) at build time.
export function competitorsHtml({ C, esc, headTags, topHeader, footerHtml, css, tesla }) {
  const S = C.sources;
  for (const c of C.companies) c.milestones.sort((a, b) => b.date.localeCompare(a.date));
  const cardOrder = [...C.companies].sort((a, b) => (b.benchmark ? 2 : b.featured ? 1 : 0) - (a.benchmark ? 2 : a.featured ? 1 : 0));
  const fill = s => String(s).replace('__TESLA_STATUS__', tesla.status).replace('__TESLA_MARKETS__', tesla.markets)
    .replace('__TESLA_LIVE__', tesla.live).replace('__TESLA_SOON__', tesla.soon).replace('__TESLA_ROLES__', tesla.roles);
  const src = keys => (keys || []).map(k => { const s = S[k]; if (!s) throw new Error('competitors: unknown source ' + k);
    return `<a class="csrc" href="${esc(s.u)}" ${s.u.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} title="${esc(s.p)}" aria-label="Source: ${esc(s.p)}">${esc(s.p)}</a>`; }).join('');
  const srcMini = keys => (keys || []).map(k => { const s = S[k];
    return `<a class="cs" href="${esc(s.u)}" target="_blank" rel="noopener" title="${esc(s.p)}" aria-label="Source: ${esc(s.p)}">&#8599;</a>`; }).join('');
  const fmtD = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const cats = c => c.benchmark ? 'all' : c.cat.join(' ');
  const cell = r => { const t = fill(r.t); return t === '-' ? '<span class="cdash" title="Not published">-</span>' : `${esc(t)}${srcMini(r.s)}`; };
  const cols = [['approach', 'Approach / sensors'], ['status', 'Live service status'], ['markets', 'Markets'], ['scale', 'Fleet / scale'], ['hardware', 'Key hardware / vehicle']];
  const rows = C.companies.map(c => { const m = c.milestones[0];
    return `<tr data-cat="${cats(c)}"${c.benchmark ? ' class="bench"' : ''}${c.featured ? ' data-feat="1"' : ''}>
<th scope="row"><a href="#c-${c.id}" class="cname">${esc(c.name)}</a><span class="cpar">${esc(c.parent)}</span><span class="cbadge ${c.badge}">${esc(c.badgeLabel)}</span></th>
${cols.map(([k]) => `<td>${cell(c.rows[k])}</td>`).join('')}
<td><b class="cmd">${fmtD(m.date)}</b> ${esc(m.title)}${srcMini(m.s)}</td></tr>`; }).join('\n');
  const cards = cardOrder.map(c => `<article class="ccard${c.benchmark ? ' bench' : ''}${c.featured ? ' feat' : ''}" id="c-${c.id}" data-cat="${cats(c)}">
<header class="cch"><div><h3>${esc(c.name)}</h3><span class="cpar">${esc(c.parent)}</span></div><span class="cbadge ${c.badge}">${esc(c.badgeLabel)}</span></header>
${c.featured ? '<div class="cfeat">Car-agnostic pick: upgrades cars people already own</div>' : ''}${c.benchmark ? '<div class="cfeat bm">The benchmark everyone gets compared to</div>' : ''}
<p class="cblurb">${esc(c.blurb)}</p>
<dl class="cspecs">${c.specs.map(s => `<div><dt>${esc(s.k)}</dt><dd>${esc(fill(s.v))}${srcMini(s.s)}</dd></div>`).join('')}</dl>
<h4>Latest milestones</h4>
<ol class="cmil">${c.milestones.map(m => `<li><time datetime="${m.date}">${fmtD(m.date)}</time><b>${esc(m.title)}</b><p>${esc(m.text)}</p><div class="csrcs">${src(m.s)}</div></li>`).join('')}</ol>
<a class="cout" href="${esc(c.link.u)}"${c.link.u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(c.link.label)} &#8594;</a>
</article>`).join('\n');
  const tabs = [['all', 'All'], ...C.categories.map(c => [c.id, c.label])];
  const title = 'Tesla Robotaxi vs Waymo, Zoox, comma.ai, Baidu, WeRide, Pony.ai and more | FSDriving';
  const desc = `Who else is driving itself? ${C.companies.length} self-driving programs side by side: live status, markets, fleet size and the latest milestones, every fact linked to its source. Checked ${fmtD(C.checkedAt)}.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${headTags({ title, desc, path: 'competitors' })}
<style>${css}</style></head><body class="cpage">
<div class="grain" aria-hidden="true"></div>
${topHeader('competitors')}
<main>
<section class="chero">
  <div class="hxkick"><span class="hxlive"></span>Competitors</div>
  <h1 class="hxh">Tesla vs <em>the field</em></h1>
  <p class="clede">${C.companies.length} self-driving programs with something real on the road, from fully driverless fleets to a box you stick on your own windshield. Numbers come from filings, company pages and named reports. Company-reported figures say so. A dash means they haven't published it. Checked ${fmtD(C.checkedAt)}.</p>
  <p class="csister">Into robots that walk instead of drive? Our sister tracker follows Tesla Optimus and every humanoid in public: <a href="https://optimistbot.com" target="_blank" rel="noopener">optimistbot.com</a></p>
</section>
<div class="ctabs" role="tablist" aria-label="Filter by category">${tabs.map(([id, l], i) => `<button role="tab" data-f="${id}" aria-selected="${i === 0}">${esc(l)}</button>`).join('')}</div>
<section class="csec" aria-labelledby="ctab-h"><h2 id="ctab-h" class="ch2">Side by side</h2>
<p class="cnote">Tesla stays pinned as the benchmark. Tap &#8599; for the source behind any cell.</p>
<div class="ctwrap" tabindex="0" aria-label="Comparison table, scrolls sideways"><table class="ctable"><thead><tr><th scope="col">Company</th>${cols.map(([, l]) => `<th scope="col">${l}</th>`).join('')}<th scope="col">Latest verified milestone</th></tr></thead>
<tbody>${rows}</tbody></table></div></section>
<section class="csec" aria-labelledby="ccards-h"><h2 id="ccards-h" class="ch2">Up close</h2>
<div class="cgrid">${cards}</div>
<p class="cempty" hidden>Nothing in this category yet.</p></section>
</main>
${footerHtml}
<script>(()=>{const tabs=[...document.querySelectorAll('.ctabs button')],items=[...document.querySelectorAll('[data-cat]')];
function go(f){tabs.forEach(b=>b.setAttribute('aria-selected',b.dataset.f===f));items.forEach(el=>{const c=el.dataset.cat.split(' ');el.hidden=!(f==='all'||c.includes('all')||c.includes(f))});
history.replaceState(null,'',f==='all'?location.pathname:'#'+f)}
tabs.forEach(b=>b.onclick=()=>go(b.dataset.f));const h=location.hash.slice(1);if(tabs.some(b=>b.dataset.f===h))go(h);})();</script>
</body></html>`;
}
