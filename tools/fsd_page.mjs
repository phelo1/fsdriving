// Builds dist/fsd/index.html from data/fsd.json (verified research, every claim linked). No facts are added here.
const LBL = [[/notateslaapp\.com\/software-updates/, 'Not a Tesla App release notes'], [/notateslaapp\.com/, 'Not a Tesla App'], [/teslascope\.com/, 'Teslascope'],
  [/fsdupdate\.com/, 'FSD Update'], [/x\.com\/Tesla\//, 'Tesla on X'], [/x\.com\/elonmusk/, 'Elon Musk on X'], [/x\.com\/aelluswamy/, 'Ashok Elluswamy on X'],
  [/x\.com\/tesla_semi/, 'Tesla Semi on X'], [/tesla\.com\/fsd\/safety/, 'Tesla FSD safety report'], [/tesla\.com\/fsd/, 'tesla.com/fsd'], [/tesla\.com/, 'tesla.com'],
  [/teslarati\.com/, 'Teslarati'], [/electrek\.co/, 'Electrek'], [/cnbc\.com/, 'CNBC'], [/freightwaves\.com/, 'FreightWaves'], [/frandroid\.com/, 'Frandroid'],
  [/theverge\.com/, 'The Verge'], [/teslaoracle\.com/, 'Tesla Oracle'], [/autopilotreview\.com/, 'Autopilot Review']];
const label = u => { let m = u.match(/version\/([\d.]+)\/release-notes/); if (m) return `${m[1]} notes (Not a Tesla App)`; m = u.match(/teslascope\.com\/software\/([\d.]+)$/); if (m) return `Teslascope ${m[1]}`; m = u.match(/notateslaapp\.com\/news\/(\d+)/); if (m) return `Not a Tesla App #${m[1]}`; if (/teslascope\.com\/software\/history/.test(u)) return 'Teslascope install history'; if (/teslascope\.com\/software\/full-self-driving/.test(u)) return 'Teslascope FSD table'; for (const [re, l] of LBL) if (re.test(u)) return l; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
export function fsdHtml({ F, esc, headTags, topHeader, footerHtml, css }) {
  const R = F.research, O = R.official_tesla_fsd_site, T = R.tracks, H4 = T.hw4_ai4, H3 = T.hw3_ai3, CT = T.cybertruck, SE = T.tesla_semi;
  const st0 = O.live_stats_observed[0], st1 = O.live_stats_observed[1], sm = st1.safety_multiples_vs_estimated_us_average;
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtD = d => { const [y, m, dd] = d.slice(0, 10).split('-'); return dd ? `${+dd} ${MO[m - 1]} ${y}` : `${MO[m - 1]} ${y} (target)`; };
  const B = n => (Math.floor(n / 1e7) / 100).toFixed(2) + 'B+';
  const srcs = us => `<div class="csrcs">${[...new Set(us)].map(u => `<a class="csrc" href="${esc(u)}" target="_blank" rel="noopener">${esc(label(u))}</a>`).join('')}</div>`;
  const mini = us => [...new Set(us)].map(u => `<a class="cs" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(label(u))}" aria-label="Source: ${esc(label(u))}">&#8599;</a>`).join('');
  const L4 = H4.latest, L3 = H3.latest, LC = CT.latest, FP = CT.feature_parity_and_gaps, nata = v => `https://www.notateslaapp.com/software-updates/version/${v}/release-notes`;
  const broad = H4.current_broad_fleet_build.firmwares.find(f => f.firmware === '2026.44.1');
  const row = (k, v, s) => `<div class="fkv"><dt>${esc(k)}</dt><dd>${v}${s ? mini(s) : ''}</dd></div>`;
  const yes = t => `<span class="fy">&#10003;</span> ${esc(t)}`, no = t => `<span class="fn">&#10007;</span> ${esc(t)}`;
  const cards = [
    { id: 'hw4', name: 'HW4 (AI4)', sub: 'Model S / 3 / X / Y', badge: ['fb-live', 'v15 rolling out'], ver: L4.label, body: [
      row('Firmware', esc(L4.firmware), [nata(L4.firmware)]),
      row('First rollout', fmtD(L4.first_rollout_date), [L4.sources[0].url]),
      row('Who has it', 'US HW4 Model Y only so far, incl. some pre-Juniper Model Ys without a front bumper camera. No Model 3, S, X or Cybertruck installs confirmed.', [L4.sources[4].url, L4.sources[5].url]),
      row('TeslaFi sample', `${L4.teslafi_on_nata_page.cars} cars (${esc(L4.teslafi_on_nata_page.percent_of_fleet_sample)} of the sample), tracker data`, [L4.teslafi_on_nata_page.source]),
      row('Rest of the fleet', `FSD (Supervised) v${esc(H4.current_broad_fleet_build.fsd_version)} on ${esc(broad.firmware)}`, [broad.source_teslascope, broad.source_nata]),
      row('Wide release', `<span class="fplan">Planned</span> Musk: "FSD V15 goes to wide release next month." Holiday Update target (Dec 2026)`, L4.wide_release_plan.sources)] },
    { id: 'hw3', name: 'HW3 (AI3)', sub: 'Model S / 3 / X / Y', badge: ['fb-lite', 'Lite branch'], ver: L3.label, body: [
      row('First listed', `${fmtD(L3.first_listed_date)} on ${esc(L3.first_listed_firmware)}`, ['https://teslascope.com/software/full-self-driving']),
      row('Broad firmware', esc(L3.latest_broad_firmware), [nata(L3.latest_broad_firmware), 'https://teslascope.com/software/2026.44.1']),
      row('v15 for HW3', 'None announced. HW3 stays on the v14.3 Lite branch.', ['https://www.fsdupdate.com/latest-fsd-version']),
      row('Unsupervised', `Not possible on HW3, per Musk (${fmtD(H3.hardware_upgrade_or_retrofit.unsupervised_on_hw3.date)}): one-eighth the memory bandwidth of HW4.`, H3.hardware_upgrade_or_retrofit.unsupervised_on_hw3.sources),
      row('Upgrade path', 'Offered in principle: discounted AI4 trade-in, or a computer + cameras retrofit via metro "microfactories". <b>No price, date or sign-up yet.</b>', H3.hardware_upgrade_or_retrofit.unsupervised_on_hw3.sources),
      row('AI5?', 'Musk (22 Nov 2026): "Cars will remain at AI4." AI5 goes to Optimus.', [H3.hardware_upgrade_or_retrofit.ai5_context.url])] },
    { id: 'ct', name: 'Cybertruck', sub: 'HW4 (AI4)', badge: ['fb-live', 'v14.3 branch'], ver: LC.label, body: [
      row('Firmware', `${esc(LC.latest_broad_firmware)}, Cybertruck installs logged 21 Nov 2026`, [LC.source_history, nata(LC.latest_broad_firmware)]),
      row('v15', no('No confirmed Cybertruck install yet'), [L4.sources[3].url]),
      row('Actually Smart + Dumb Summon', yes(`Live since v${FP.actually_smart_summon.first_confirmed.fsd_version} (${fmtD(FP.actually_smart_summon.first_confirmed.date)})`), [FP.actually_smart_summon.first_confirmed.source, FP.actually_smart_summon.first_confirmed.source_article]),
      row('ASS 8 mph top speed', no('Not on Cybertruck (official notes)'), FP.ass_8mph_speed_increase.sources),
      row('Collision Evasion', yes('Listed for CT in 2026.44.1 notes'), [FP.automatic_collision_evasion.source]),
      row('Banish', no('Not released on any Tesla'), FP.banish.sources)] },
    { id: 'semi', name: 'Tesla Semi', sub: 'Class 8 truck', badge: ['fb-none', 'No FSD yet'], ver: 'No customer FSD version', body: [
      row('Production', `Volume production started at Sparks, NV (${fmtD(SE.confirmed.production.event_date)})`, SE.confirmed.production.sources),
      row('Driving today', 'Every deployed Semi is human-driven. No FSD or Autopilot package shipping.', SE.confirmed.operation_today.sources),
      row('Groundwork', 'Electric steering "lays the groundwork for future autonomy" (Tesla Semi on X)', [SE.confirmed.electric_steering_and_future_autonomy.url]),
      row('Tesla Semi chief', 'Driver assistance first, human-driven trucks train autonomy, no date for full autonomy', SE.confirmed.priestley_iaa_2026.sources),
      row('Roadmap', `<span class="fplan">Unconfirmed</span> Musk (Q2 2026 call): self-driving "working" around end of 2026 or early 2027`, SE.planned_or_unconfirmed.musk_q2_2026_earnings.sources)] }
  ].map(c => `<article class="fcard" id="t-${c.id}" data-track="${c.id}"><header class="cch"><div><h3>${esc(c.name)}</h3><span class="cpar">${esc(c.sub)}</span></div><span class="fbadge ${c.badge[0]}">${esc(c.badge[1])}</span></header>
<div class="fver">${esc(c.ver)}</div><dl class="fdl">${c.body.join('')}</dl></article>`).join('');
  const tl = [...F.releases].sort((a, b) => b.date.localeCompare(a.date)).map(r => `<li class="frel ${r.kind}" data-track="${r.tracks.join(' ')}">
<div class="frh"><time datetime="${r.date}">${fmtD(r.date)}</time>${r.tracks.map(t => `<span class="ftag ${t}">${{ hw4: 'HW4', hw3: 'HW3', ct: 'Cybertruck', semi: 'Semi' }[t]}</span>`).join('')}${r.kind === 'planned' ? '<span class="fplan">Planned</span>' : ''}</div>
<b class="fv">${/^\d/.test(r.v) ? 'FSD (Supervised) v' + esc(r.v) : esc(r.v)}</b>${r.fw ? `<code class="ffw">${esc(r.fw)}</code>` : ''}
<div class="ffl">${esc(r.fleet)}</div><p>${esc(r.text)}</p>${srcs(r.src)}</li>`).join('\n');
  const tabs = [['all', 'All'], ['hw4', 'HW4'], ['hw3', 'HW3'], ['ct', 'Cybertruck'], ['semi', 'Semi']];
  const v15 = O.new_features_v15_as_marketed.map(f => `<div class="fft"><b>${esc(f.name)}</b><p>${esc(f.blurb)}</p></div>`).join('');
  const Q = R.consumer_unsupervised_status.q3_2026_earnings_plan, EU = R.regional_notes.europe;
  const title = `Tesla FSD versions tracker: v${L4.fsd_version} on HW4, v14.3 Lite on HW3, Cybertruck and Semi | fsdriving.com`;
  const desc = `Which FSD (Supervised) build is on which Tesla right now. v${L4.fsd_version} (${L4.firmware}) is rolling out to US HW4 Model Y; HW3 runs v14.3 Lite; Cybertruck v${LC.fsd_version}; Semi has no FSD yet. Every version linked to its source.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${headTags({ title, desc, path: 'fsd' })}
<style>${css}</style></head><body class="cpage fpage">
<div class="grain" aria-hidden="true"></div>
${topHeader('fsd')}
<main>
<section class="chero fhero">
  <a class="fpill" href="#t-hw4"><span class="hxlive"></span>v${esc(L4.fsd_version)} rolling out now <span>(US HW4 Model Y)</span></a>
  <h1 class="hxh">Full Self-Driving <em>(Supervised)</em>, every build</h1>
  <p class="clede">Which FSD version is on which Tesla, right now: HW4, HW3, Cybertruck and Semi side by side, with firmware builds, dates and the source for each. Tesla's own page doesn't split by hardware. This one does. Checked ${fmtD(F.checkedAt)}.</p>
  <div class="fstats">
    <div class="fs"><b>${B(st1.miles_driven)}</b><span>FSD (Supervised) miles</span></div>
    <div class="fs"><b>${B(st1.city_miles_driven)}</b><span>of them on city streets</span></div>
    <div class="fs"><b>${O.approved_markets_count}</b><span>approved markets</span></div>
    <div class="fs g"><b>${esc(st0.safety_headline.match(/^\d+x/)[0])}</b><span>"safer than a human driver" when engaged, per Tesla. ${esc(sm.fewer_major_collisions)} fewer major, ${esc(sm.fewer_minor_collisions)} minor, ${esc(sm.fewer_off_highway_collisions)} off-highway collisions vs the estimated US average.</span></div>
  </div>
  <p class="fattr">Tesla's own figures from <a href="${esc(O.url)}" target="_blank" rel="noopener">tesla.com/fsd</a> and the <a href="${esc(O.safety_report_url)}" target="_blank" rel="noopener">FSD safety report</a>, read ${fmtD(st1.observed_at)}. Not independently verified: a collision counts as FSD-engaged if FSD was on within 5 seconds before it, Tesla doesn't assign fault, China is excluded, and the mile counters tick at an average rate. FSD (Supervised) needs an attentive driver at all times and does not make the car autonomous.</p>
</section>
<section class="csec" aria-labelledby="fm-h"><h2 id="fm-h" class="ch2">Four tracks, one glance</h2>
<p class="cnote">Latest confirmed build per vehicle line. &#8599; links go to the source.</p>
<div class="fgrid">${cards}</div></section>
<section class="csec" aria-labelledby="fv-h"><h2 id="fv-h" class="ch2">What v15 brings, as Tesla pitches it</h2>
<div class="ffeat">${v15}</div><p class="cnote">Feature names from <a href="${esc(O.url)}" target="_blank" rel="noopener">tesla.com/fsd</a>. Full list in the <a href="${esc(nata(L4.firmware))}" target="_blank" rel="noopener">${esc(L4.firmware)} release notes</a>.</p></section>
<section class="csec" aria-labelledby="ft-h"><h2 id="ft-h" class="ch2">Release timeline</h2>
<div class="ctabs ftabs" role="tablist" aria-label="Filter by vehicle">${tabs.map(([id, l], i) => `<button role="tab" data-f="${id}" aria-selected="${i === 0}">${esc(l)}</button>`).join('')}</div>
<ol class="ftl">${tl}</ol>
<p class="cnote">Point releases between these (v14.3.5 to v14.3.12 and others) are on <a href="${esc(H4.additional_teslascope_ai4_table.url)}" target="_blank" rel="noopener">Teslascope's full table</a>. We only list builds we could date and source.</p></section>
<section class="csec" aria-labelledby="fu-h"><h2 id="fu-h" class="ch2">Supervised today, Unsupervised later</h2>
<div class="ffut">
 <div><b>Consumer FSD is still Supervised.</b> That's the product name on tesla.com/fsd and in every release note. Tesla's Robotaxi service is a separate, Tesla-run network. <a href="/">Track it here</a>.</div>
 <div><span class="fplan">Planned</span> <b>Customer cars in the Robotaxi fleet around Q2 2027.</b> Ashok Elluswamy on the Q3 2026 call (${fmtD(Q.date)}): "${esc(Q.quote_as_reported)}"${mini(Q.sources)}</div>
 <div><b>Europe runs its own branch.</b> FSD 14.2.2.6 on 2026.39.6, listed 29 Oct 2026. Not the latest US build.${mini(EU.sources)}</div>
</div></section>
</main>
${footerHtml}
<script>(()=>{const tabs=[...document.querySelectorAll('.ftabs button')],items=[...document.querySelectorAll('.ftl [data-track]')];
function go(f){tabs.forEach(b=>b.setAttribute('aria-selected',b.dataset.f===f));items.forEach(el=>{el.hidden=!(f==='all'||el.dataset.track.split(' ').includes(f))})}
tabs.forEach(b=>b.onclick=()=>go(b.dataset.f));
const h=location.hash.slice(1);if(tabs.some(b=>b.dataset.f===h))go(h);})();</script>
</body></html>`;
}
