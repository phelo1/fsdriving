// node build.mjs -> dist/ (index.html, data.json, 404.html, robots.txt, favicon.svg)
import fs from 'node:fs'; import path from 'node:path'; import {execFileSync} from 'node:child_process'; import { ogHtml } from './tools/og_template.mjs';
import { geoAlbersUsa, geoEqualEarth, geoGraticule, geoPath } from 'd3-geo';
import { buildPlaces } from './tools/places.mjs';
import { feature, mesh } from 'topojson-client';
const root = path.dirname(new URL(import.meta.url).pathname);
execFileSync('python3',[path.join(root,'tools/history.py')],{stdio:'inherit'});
const rd = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const cfg = rd('config.json'), content = rd('src/content.json'), histAll = rd('data/jobs.json'), geo = rd('data/geo.json');
// Everything that predates the 27 Nov 2026 map upgrade (history, S-curve, cards, lead times, OG card) uses the original
// fleet categories only. The main map uses every category (histAll), with clear labels.
const FLEET = new Set(['supervisor', 'specialist', 'operations']);
const hist = { ...histAll, jobs: Object.fromEntries(Object.entries(histAll.jobs).filter(([, j]) => FLEET.has(j.category))) };
const us = rd('node_modules/us-atlas/states-albers-10m.json');
const world = rd('node_modules/world-atlas/countries-110m.json');
const dist = path.join(root, 'dist'); fs.rmSync(dist, { recursive: true, force: true }); fs.mkdirSync(dist);

const proj = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const pathGen = geoPath().digits(1);
const statesPath = pathGen(mesh(us, us.objects.states, (a, b) => a !== b));
const nationPath = pathGen(feature(us, us.objects.nation));
const projW = geoEqualEarth().fitExtent([[8, 8], [967, 602]], { type: 'Sphere' });
const wGen = geoPath(projW).digits(1);
const worldLand = wGen(feature(world, world.objects.land)), worldBorders = wGen(mesh(world, world.objects.countries, (a, b) => a !== b));
const worldSphere = wGen({ type: 'Sphere' }), worldGrat = wGen(geoGraticule().step([30, 20]).precision(5)());
const usInWorld = wGen(mesh(rd('node_modules/us-atlas/states-10m.json'), rd('node_modules/us-atlas/states-10m.json').objects.states, (a, b) => a !== b));
const bbox = (lo0, la0, lo1, la1) => { const pts = []; for (let lo = lo0; lo <= lo1; lo += (lo1 - lo0) / 8) for (let la = la0; la <= la1; la += (la1 - la0) / 8) pts.push(projW([lo, la]));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => +v.toFixed(1)); };
const presets = { world: bbox(-168, -48, 180, 72), europe: bbox(-11, 35, 32, 60), asia: bbox(70, -46, 178, 47), namerica: bbox(-128, 18, -62, 53) };

const runs = hist.runs || [];
const last = hist.lastChecked;
const prev = runs.length > 1 ? runs[runs.length - 2].at : null;
const launches = rd('data/launches.json');
const DAY = 864e5, dd = s => new Date(s.length === 10 ? s + 'T12:00:00Z' : s);
const days = (a, b) => Math.round((dd(b) - dd(a)) / DAY);
const hav = (a, b) => { const R = 3958.8, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const trackingStart = (runs[0] && runs[0].at) || last;
const problems = [];
for (const m of launches.metros) {
  for (const k of ['id', 'name', 'anchor', 'status']) if (!m[k]) problems.push(`metro missing ${k}: ${JSON.stringify(m).slice(0, 80)}`);
  if (m.status === 'live' && !(m.launch && /^\d{4}-\d{2}-\d{2}$/.test(m.launch.date))) problems.push(`live metro ${m.id} needs launch.date YYYY-MM-DD`);
  const g = geo[m.anchor]; const xy = g ? proj([g.lon, g.lat]) : null;
  if (!xy) console.warn('no coords for metro anchor', m.anchor, '(run tools/geocode.py)');
  m.x = xy ? +xy[0].toFixed(1) : null; m.y = xy ? +xy[1].toFixed(1) : null; m.geo = g || null;
}
if (problems.length) { console.error('launches.json problems:\n' + problems.join('\n')); process.exit(1); }
const jobs = Object.values(hist.jobs).map(j => {
  const key = `${j.city}, ${j.state}`, g = geo[key];
  const xy = g ? proj([g.lon, g.lat]) : null;
  return { id: j.id, t: j.title, c: j.category, city: j.city, st: j.state, sn: j.stateName, url: j.url,
    fs: j.firstSeen, ls: j.lastSeen, a: j.active, rm: j.removedAt || null, src: j.source,
    x: xy ? +xy[0].toFixed(1) : null, y: xy ? +xy[1].toFixed(1) : null };
});
// which live/announced metro (if any) each city falls in: nearest anchor within its radius
for (const j of jobs) {
  const g = geo[`${j.city}, ${j.st}`]; j.m = null; if (!g) continue;
  let best = null;
  for (const m of launches.metros) { if (!m.geo) continue; const d = hav(g, m.geo); if (d <= (m.radiusMi || 25) && (!best || d < best.d)) best = { d, id: m.id }; }
  if (best) j.m = best.id;
}
// lead time per metro: earliest fleet-support / robotaxi-ops signal, or our own first sighting
const LEAD_KINDS = new Set(['fleet-support', 'robotaxi-ops']);
for (const m of launches.metros) {
  const mine = jobs.filter(j => j.m === m.id);
  const firstTracked = mine.map(j => j.fs).sort()[0] || null;
  const sigs = (m.hiringSignals || []).filter(s => LEAD_KINDS.has(s.kind)).map(s => ({ date: s.date, kind: s.kind, role: s.role, dateKind: s.dateKind }));
  if (firstTracked) sigs.push({ date: firstTracked.slice(0, 10), kind: 'tracker', role: 'First seen by this tracker', dateKind: 'seen' });
  sigs.sort((a, b) => a.date.localeCompare(b.date));
  const lead = sigs[0] || null;
  m.activeJobs = mine.filter(j => j.a).length; m.activeSup = mine.filter(j => j.a && j.c === 'supervisor').length;
  m.firstTracked = firstTracked; m.leadSignal = lead; m.leadDays = null; m.leadNote = null;
  if (m.status === 'live') {
    if (lead && lead.date < m.launch.date) m.leadDays = days(lead.date, m.launch.date);
    else if (lead) m.leadNote = 'after';
    else m.leadNote = 'before-tracking';
  }
}
const leadVals = launches.metros.filter(m => m.leadDays != null).map(m => m.leadDays);
const avgLead = leadVals.length ? Math.round(leadVals.reduce((a, b) => a + b, 0) / leadVals.length) : null;
const active = jobs.filter(j => j.a);
const sup = active.filter(j => j.c === 'supervisor');
const cityKey = j => `${j.city}, ${j.st}`;
const supCities = new Set(sup.map(cityKey)), allCities = new Set(active.map(cityKey));
const supStates = new Set(sup.map(j => j.st));
for (const j of jobs) if (j.x === null) console.warn('no coords for', cityKey(j));

const fmt = iso => {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(' am', ' AM').replace(' pm', ' PM');
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const history = fs.existsSync(path.join(root,'data/history.json')) ? rd('data/history.json') : { series: [] };
// cumulative distinct cities ever seen with a posting (S-curve). Date = earliest of: our own first sighting,
// or a researched, sourced date from data/backfill.json (hand-curated, never written by the refresh).
const backfill = fs.existsSync(path.join(root, 'data/backfill.json')) ? rd('data/backfill.json') : { cities: {} };
const CONFIRMED = new Set(['x-post', 'news', 'aggregator', 'archive']);
const curveFor = (pred, view) => { const by = new Map();
  for (const j of jobs) { if (!pred(j)) continue; const k = cityKey(j); const c = by.get(k);
    if (!c || j.fs < c.fs) by.set(k, { city: j.city, st: j.st, fs: j.fs, open: (c && c.open) || j.a }); else if (j.a) c.open = true; }
  return [...by.entries()].map(([k, c]) => {
    const b = backfill.cities[k] || {}, cand = [b.sup, view === 'all' ? b.all : null].filter(Boolean).sort((x, y) => x.date.localeCompare(y.date))[0];
    const tracked = c.fs.slice(0, 10);
    if (cand && (cand.date < tracked || (c.fs <= trackingStart && cand.date <= tracked))) return { ...c, d: cand.date, src: CONFIRMED.has(cand.kind) ? 'confirmed' : 'estimate', ev: { kind: cand.kind, confidence: cand.confidence, role: cand.role, evidence: cand.evidence, sources: cand.sources }, tracked };
    return { ...c, d: tracked, src: c.fs <= trackingStart ? 'base' : 'tracker', base: c.fs <= trackingStart, tracked };
  }).sort((a, b) => a.d.localeCompare(b.d) || a.city.localeCompare(b.city)); };
const curve = { trackingStart, sup: curveFor(j => j.c === 'supervisor', 'sup'), all: curveFor(() => true, 'all'), notTried: backfill.notTried || null };
// Tesla vs Waymo comparison: hand-curated statuses (data/compare.json) + computed hiring signals
const cmpSrc = rd('data/compare.json');
const wj = fs.existsSync(path.join(root, 'data/waymo-jobs.json')) ? rd('data/waymo-jobs.json') : { metros: {} };
const cmpMetros = cmpSrc.metros.map(m => ({ ...m, th: { n: 0, cities: [] }, wh: wj.metros[m.id] || null }));
const supByCity = new Map();
for (const j of sup) { const k = cityKey(j); const g = geo[k]; if (!g) continue; const c = supByCity.get(k) || { k, n: 0, g }; c.n++; supByCity.set(k, c); }
const extra = [];
for (const c of [...supByCity.values()].sort((a, b) => b.n - a.n)) {
  let best = null;
  for (const m of cmpMetros) { const d = hav(c.g, m); if (d <= 45 && (!best || d < best.d)) best = { d, m }; }
  if (!best) for (const m of extra) { const d = hav(c.g, m); if (d <= 35 && (!best || d < best.d)) best = { d, m }; }
  if (!best) { const [city, st] = c.k.split(', '); const m = { id: 'th-' + c.k.toLowerCase().replace(/[^a-z]+/g, '-'), name: city + ' area', state: st, lat: c.g.lat, lon: c.g.lon, tesla: null, waymo: null, th: { n: 0, cities: [] }, wh: null, extra: true }; extra.push(m); best = { m }; }
  best.m.th.n += c.n; best.m.th.cities.push({ k: c.k, n: c.n });
}
const allCmp = [...cmpMetros, ...extra].map(m => { const xy = proj([m.lon, m.lat]); return { ...m, x: xy ? +xy[0].toFixed(1) : null, y: xy ? +xy[1].toFixed(1) : null }; });
const cnt = f => allCmp.filter(f).length;
const compare = { checkedAt: cmpSrc.checkedAt, definitions: cmpSrc.definitions, notes: cmpSrc.notes, intl: cmpSrc.waymoInternational, waymoJobs: { checkedAt: wj.checkedAt || null, total: wj.totalJobs || null, source: wj.source || null }, metros: allCmp,
  counts: { tesla: { live: cnt(m => m.tesla && /^live/.test(m.tesla.status)), driverless: cnt(m => m.tesla && m.tesla.status === 'live'), announced: cnt(m => m.tesla && m.tesla.status === 'announced'), hiring: cnt(m => m.th.n > 0), hiringCities: supByCity.size },
    waymo: { live: cnt(m => m.waymo && m.waymo.status === 'live'), open: cnt(m => m.waymo && m.waymo.status === 'live' && !m.waymo.gradual), announced: cnt(m => m.waymo && m.waymo.status === 'announced'), intl: cmpSrc.waymoInternational.length, hiring: cnt(m => m.wh) },
    both: { live: cnt(m => m.tesla && /^live/.test(m.tesla.status) && m.waymo && m.waymo.status === 'live'), planned: cnt(m => m.tesla && m.waymo), any: cnt(m => (m.tesla || m.th.n) && m.waymo) } } };
for (const m of allCmp) if (m.x === null) console.warn('compare: no projection for', m.id);
const sdCC = {}; for (const j of Object.values(histAll.jobs)) if (j.country && j.country !== 'US') sdCC[j.country] = 1;
const COUNTRY_NAMES = { AU: 'Australia', CZ: 'Czechia', ES: 'Spain', FR: 'France', GB: 'United Kingdom', HK: 'Hong Kong', IL: 'Israel', IN: 'India', KR: 'South Korea', NZ: 'New Zealand', PL: 'Poland', SG: 'Singapore', DE: 'Germany', JP: 'Japan', CA: 'Canada', CN: 'China', NL: 'Netherlands', NO: 'Norway', IT: 'Italy', AE: 'United Arab Emirates', TW: 'Taiwan', TH: 'Thailand', MX: 'Mexico', SE: 'Sweden', CH: 'Switzerland' };
for (const cc of Object.keys(sdCC)) if (!COUNTRY_NAMES[cc]) console.warn('add a country name for', cc);
const places = buildPlaces({ hist: histAll, geo, compare: cmpSrc, wj, launches, projUS: proj, projW, countryNames: COUNTRY_NAMES });
// Hero map + OG card dots, rebuilt from live data every build:
// green = Tesla Robotaxi service live (launches.json live markets), red = not live yet but coming soon or hiring
// (active Robotaxi-titled US roles, self-driving test roles excluded). Each dot links to a main-map place.
const placeOf = (lat, lon) => { let best = null; for (const p of places) { if (p.cc !== 'US' || !p.us) continue; const d = hav({ lat, lon }, p); if (d <= 45 && (!best || d < best.d)) best = { d, p }; } return best && best.p; };
const rtOpen = p => p.jobs.filter(j => j.a && j.c !== 'selfdriving');
const heroLive = launches.metros.filter(m => m.status === 'live' && m.x != null).map(m => { const p = placeOf(m.geo.lat, m.geo.lon);
  return { id: m.id, name: m.name, st: m.state, x: m.x, y: m.y, date: m.launch.date, driver: m.currentMode === 'safety-driver' || /safety driver/i.test(m.currentMode || ''), pid: p ? p.id : null, pname: p ? p.name : null, roles: p ? rtOpen(p).length : 0 }; });
const livePids = new Set(heroLive.map(l => l.pid).filter(Boolean));
const heroPend = places.filter(p => p.cc === 'US' && p.us && !livePids.has(p.id) && !(p.tesla && /^live/.test(p.tesla.status)) && ((p.tesla && p.tesla.status === 'announced') || rtOpen(p).length))
  .map(p => ({ pid: p.id, name: p.name, st: p.sub, x: p.us[0], y: p.us[1], soon: !!(p.tesla && p.tesla.status === 'announced'), roles: rtOpen(p).length, sup: rtOpen(p).filter(j => j.c === 'supervisor').length }));
const hero = { live: heroLive, pend: heroPend };
const actAll = Object.values(histAll.jobs).filter(j => j.active);
const ckey = j => `${j.city}, ${j.country && j.country !== 'US' ? j.country : j.state}`;
const rtAct = actAll.filter(j => j.category !== 'selfdriving'), sdAct = actAll.filter(j => j.category === 'selfdriving');
const mapMeta = { presets, last, waymoChecked: wj.checkedAt || null, waymoSource: wj.source || null, radius: 45,
  head: { sup: sup.length, supCities: supCities.size, fleet: active.length, rt: rtAct.length, rtCities: new Set(rtAct.map(ckey)).size,
    sd: sdAct.length, sdCities: new Set(sdAct.map(ckey)).size, sdCountries: new Set(sdAct.map(j => j.country || 'US')).size,
    wLive: compare.counts.waymo.live, wAnn: compare.counts.waymo.announced, wIntl: compare.counts.waymo.intl } };
const payload = { hero, places, mapMeta, compare, curve, history, launches, avgLead, leadN: leadVals.length, trackingStart, last, prev, firstRun: runs.length <= 1, runs: runs.length, jobs, roles: content.roles };

const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/map.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/app.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/timeline.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/cities.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/compare.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/hero.js'), 'utf8');
const desc = `Live map of every US city where Tesla is hiring Robotaxi Fleet Support Supervisors, pulled straight from Tesla's careers site. ${sup.length} openings in ${supCities.size} cities right now.`;
const title = `Where Tesla is hiring Robotaxi Fleet Support Supervisors | ${cfg.name}`;
const ogImg = cfg.url.replace(/\/$/, '') + '/og.png?v=' + (last || '').slice(0, 10);
const ogAlt = `Glowing map of ${supCities.size} US cities where Tesla is hiring Robotaxi supervisors, with a Cybercab`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#07080c"/><circle cx="32" cy="32" r="18" fill="none" stroke="#ff3b3b" stroke-width="3" opacity=".45"/><circle cx="32" cy="32" r="8" fill="#ff3b3b"/></svg>`;

const roleCards = Object.entries(content.roles).map(([k, r]) => `
  <article class="role rv" data-role="${k}"><div class="role-tag ${k}">${esc(r.short)}</div><h3>${esc(r.label)}</h3><p class="role-blurb">${esc(r.blurb)}</p>
  <ul>${r.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></article>`).join('');

const MAPHTML = mapHtml();
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${cfg.url}"><meta name="theme-color" content="#07080c">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${cfg.url}">
<meta property="og:site_name" content="${esc(cfg.name)}"><meta property="og:image" content="${ogImg}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${ogImg}"><meta name="twitter:image:alt" content="${esc(ogAlt)}">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${css}</style></head><body>
<div class="grain" aria-hidden="true"></div>
<header class="top"><a class="brand" href="/"><span class="dot"></span>Robotaxi Hiring Map</a>
<div class="checked"><span class="live"></span>Last checked <b>${esc(fmt(last))}</b> <span class="tz">Riyadh time</span></div></header>
<main>
${heroHtml()}

${MAPHTML}

<section class="changes rv" id="changes"></section>

<section class="roles vs" id="vs"><div class="sec-h rv"><h2>Tesla vs Waymo, city by city</h2><div class="filters vs-f" role="tablist" aria-label="Which company"><button class="on" data-c="both">Both</button><button data-c="tesla">Tesla</button><button data-c="waymo">Waymo</button></div></div>
<p class="muted vslede">US metros only. Live means anyone (or a waitlist) can hail a ride today. Announced means the company itself named the city, but there are no public rides yet. Hiring is shown separately because the two companies hire very differently.</p>
<div class="vsgrid" id="vscount"></div>
<div class="map vsmap"><svg id="vsmap" viewBox="0 0 975 610" role="img" aria-label="Map of US metros where Tesla and Waymo run or plan robotaxi service"><path class="nation" d="${nationPath}"/><path class="states" d="${statesPath}"/><g id="vspins"></g></svg><div class="tip vstip" id="vstip" hidden></div></div>
<div class="legend" id="vslegend"></div>
<div class="vstablewrap"><table class="vstable" id="vstable"><thead><tr><th>Metro</th><th class="t">Tesla</th><th class="w">Waymo</th></tr></thead><tbody></tbody></table></div>
<div id="vsintl"></div>
<div class="muted tlnote" id="vsnote"></div></section>

<section class="list" id="cities">
  <div class="sec-h rv"><h2>City by city</h2><div class="filters grid-f" role="tablist" aria-label="Which roles"><button class="on" data-f="supervisor">Supervisors</button><button data-f="all">All fleet roles</button></div><div class="search"><input id="q" type="search" placeholder="Filter cities or states" aria-label="Filter cities"></div></div>
  <div class="grid" id="grid"></div>
</section>

<section class="roles" id="curve"><div class="sec-h rv"><h2>Cities with Robotaxi supervisor ads, over time</h2><div class="filters cv-f" role="tablist" aria-label="Range"><button class="on" data-r="all">Full history</button><button data-r="recent">Last 100 days</button></div></div>
<div class="filters cv-s" role="tablist" aria-label="Which roles"><button class="on" data-s="sup">Supervisor cities</button><button data-s="all">All Robotaxi role cities</button></div>
<div class="tlwrap cvwrap"><svg id="cv" role="img" aria-label="Cumulative number of US cities where Tesla has posted Robotaxi Fleet Support Supervisor jobs, with Robotaxi launch dates"></svg><div class="tip" id="cvtip" hidden></div></div>
<div class="legend"><span><i class="lg s"></i>New city, dated from a source</span><span><i class="lg" style="background:none;border:2px solid #ff4a3d"></i>Estimated date</span><span><i class="lg" style="background:none;border:1px dashed #ff8a7a"></i>No date found, open at our first check</span><span><i class="lg" style="background:#65efad;border-radius:2px;transform:rotate(45deg)"></i>Robotaxi launch</span><span><i class="lg" style="background:#ffd78c;border-radius:2px;transform:rotate(45deg)"></i>Launch, human driver</span></div>
<p class="muted tlnote" id="cvnote"></p></section>
<section class="roles" id="timeline"><div class="sec-h rv"><h2>Hiring to launch, metro by metro</h2><div class="filters tl-f" role="tablist" aria-label="Timeline range"><button class="on" data-r="all">Since 2025</button><button data-r="tracked">Since tracking began</button></div></div>
<div class="filters tl-s" role="tablist" aria-label="Postings series"><button class="on" data-s="lines">Supervisors + all roles</button><button data-s="states">Supervisors by state</button></div>
<div class="tlwrap"><svg id="tl" role="img" aria-label="Timeline of open postings, hiring signals and Robotaxi launches"></svg><div class="tip" id="tltip" hidden></div></div>
<div class="legend"><span><i class="lg s"></i>Supervisor openings</span><span><i class="lg r"></i>All robotaxi fleet roles</span><span><i class="lg" style="background:#ff8a7a"></i>First sourced hiring signal</span><span><i class="lg" style="background:#65efad;border-radius:2px;transform:rotate(45deg)"></i>Launch</span><span><i class="lg" style="background:#ffd78c;border-radius:2px;transform:rotate(45deg)"></i>Launch, human driver</span><span><i class="lg" style="background:none;border:1px solid #8a91a3"></i>Autopilot test-driver hint</span></div>
<p class="muted tlnote">Heads up: our own postings count starts on 20 Nov 2026, the day this tracker went live, so the line only covers the right edge for now and grows one point a day. Everything earlier on the chart is sourced hiring sightings and launch dates from news and archives, not posting counts. Drag or pinch to zoom.</p></section>
<section class="roles" id="lead"><div class="sec-h"><h2>From hiring to hailing</h2></div><p class="muted">First sourced hiring signal to first service launch. Observations, not predictions. Older dates mean the job was seen by that day, not the day it went up.</p><div id="leadstats"></div><div id="launchlist"></div><h3 class="waith">Still waiting: hiring, no launch yet</h3><div id="waiting"></div></section><section class="roles" id="role">
  <div class="sec-h rv"><h2>So what's the job?</h2><p class="muted">Straight from the posting text, boiled down.</p></div>
  <div class="rolegrid">${roleCards}</div>
</section>
</main>
<footer>
  <p><b>Not affiliated with Tesla.</b> Unofficial tracker. Job data comes from Tesla's public careers listings (<a href="${cfg.sourceUrl}" rel="noopener" target="_blank">tesla.com/careers</a>). Openings can close any time, so always check the posting itself.</p>
  <p class="muted">Data for nerds: <a href="/data.json">data.json</a> keeps first-seen and last-seen for every job. ${runs.length} check${runs.length === 1 ? '' : 's'} so far.</p>
</footer>
<script id="data" type="application/json">${JSON.stringify(payload).replace(/\u2014/g, '-').replace(/</g, '\\u003c')}</script>
<script>/*D3*/</script><script>${js}</script>
</body></html>`;
if (/\u2014/.test(html)) { console.error('em dash found in page copy (src/ or build.mjs). Fix the text.'); process.exit(1); }
const d3src = fs.readFileSync(path.join(root, 'src/d3.min.js'), 'utf8');
fs.writeFileSync(path.join(dist, 'index.html'), html.replace('<script>/*D3*/</script>', () => `<script>${d3src}</script>`));
fs.copyFileSync(path.join(root,'data/launches.json'),path.join(dist,'launches.json'));
fs.writeFileSync(path.join(dist,'history.json'),JSON.stringify(history,null,1));
fs.writeFileSync(path.join(dist, 'data.json'), JSON.stringify(histAll, null, 1));
for (const f of ['favicon.svg', 'favicon.ico', 'favicon.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(root, 'src/icons', f), path.join(dist, f));
fs.copyFileSync(path.join(root, 'src/hero-cybercab.jpg'), path.join(dist, 'cybercab.jpg'));
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n`);
fs.writeFileSync(path.join(dist, '404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found | ${cfg.name}</title><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${cfg.url}"><meta property="og:image" content="${ogImg}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${ogImg}"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07080c;color:#e9ecf2;font:16px/1.5 system-ui,sans-serif;text-align:center}a{color:#ff5a4f}</style></head><body><div><h1>Nothing parked here</h1><p><a href="/">Back to the map</a></p></div></body></html>`);
console.log(`built: ${sup.length} supervisor openings in ${supCities.size} cities, ${active.length} total in ${allCities.size} cities; html ${(html.length/1024).toFixed(0)} KB`);

// social card: real active supervisor cities, rendered to dist/og.png
{
  const byCity = new Map();
  for (const j of sup) { if (j.x === null) continue; const k = cityKey(j); const c = byCity.get(k) || { x: j.x, y: j.y, n: 0, k }; c.n++; byCity.set(k, c); }
  const ogDir = path.join(root, 'og-build'); fs.mkdirSync(ogDir, { recursive: true });
  const checked = new Date(last).toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric' });
  const og = ogHtml({ nationPath, statesPath, live: heroLive, pend: heroPend, cities: [...byCity.values()], nSup: sup.length, nCities: supCities.size, nStates: supStates.size, checked, carUrl: new URL('src/og-cybercab.jpg', 'file://' + root + '/').href });
  if (/\u2014/.test(og)) { console.error('em dash in og card'); process.exit(1); }
  fs.writeFileSync(path.join(ogDir, 'og.html'), og);
  execFileSync('python3', [path.join(root, 'tools/og.py')], { stdio: 'inherit' });
}

function mapHtml() {
  const H = mapMeta.head;
  const chip = (g, v, label, on, extra = '') => `<button class="mchip ${g}${on ? ' on' : ''}" data-g="${g}" data-v="${v}" aria-pressed="${on}"${extra}><i></i>${label}</button>`;
  return `<section class="mapwrap mx" id="map">
  <div class="mhead">
    <div class="mstat t"><b>${H.sup}</b><span>supervisor roles<br>${H.supCities} cities</span></div>
    <div class="mstat t2"><b>${H.rt}</b><span>Robotaxi-titled roles<br>${H.rtCities} US cities</span></div>
    <div class="mstat w"><b>${H.wLive}</b><span>Waymo live<br>${H.wAnn} US + ${H.wIntl} abroad up next</span></div>
    <div class="mstat g"><b>${H.sd}</b><span>self-driving test roles<br>${H.sdCities} cities, ${H.sdCountries} countries</span></div>
  </div>
  <div class="mbar">
    <div class="mrow">
      <div class="mseg" role="group" aria-label="Map view">${[['us', 'US'], ['world', 'World'], ['europe', 'Europe'], ['asia', 'Asia-Pacific']].map(([k, l], i) => `<button data-view="${k}" class="${i ? '' : 'on'}" aria-pressed="${!i}">${l}</button>`).join('')}</div>
      <div class="msearch"><input id="msq" type="search" placeholder="Jump to a city" autocomplete="off" aria-label="Search cities" role="combobox" aria-expanded="false" aria-controls="msres"><ul id="msres" role="listbox" hidden></ul></div>
    </div>
    <div class="mrow chips">
      <div class="mgrp"><span class="mglab">Who</span>${chip('op', 'tesla', 'Tesla', true)}${chip('op', 'waymo', 'Waymo', true)}</div>
      <div class="mgrp"><span class="mglab">Status</span>${chip('st', 'live', 'Live service', true)}${chip('st', 'ann', 'Upcoming', true)}${chip('st', 'hire', 'Hiring', true)}${chip('st', 'closed', 'Closed ads', false)}</div>
      <div class="mgrp"><span class="mglab">Tesla roles</span>${chip('role', 'supervisor', 'Supervisors', true)}${chip('role', 'fleet', 'Specialists & ops', true)}${chip('role', 'other', 'Other Robotaxi', true)}${chip('role', 'selfdriving', 'Self-driving tests', false)}</div>
    </div>
  </div>
  <div class="mcount" id="mcount" aria-live="polite"></div>
  <div class="mstage" id="mstage">
    <svg id="msvg" role="img" aria-label="Interactive map of Tesla and Waymo robotaxi cities">
      <defs>
        <radialGradient id="mgT"><stop offset="0" stop-color="#ff4a3d" stop-opacity=".55"/><stop offset="1" stop-color="#ff3b3b" stop-opacity="0"/></radialGradient>
        <radialGradient id="mgW"><stop offset="0" stop-color="#5b8cff" stop-opacity=".55"/><stop offset="1" stop-color="#5b8cff" stop-opacity="0"/></radialGradient>
        <linearGradient id="mland" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#161b26"/><stop offset="1" stop-color="#0c0f16"/></linearGradient>
        <radialGradient id="mradar" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#ff3b3b" stop-opacity=".07"/><stop offset=".6" stop-color="#5b8cff" stop-opacity=".03"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <rect class="mbg" width="100%" height="100%" fill="url(#mradar)"/>
      <g id="mvp"><g id="mfit">
        <g class="base us on"><path class="nation" d="${nationPath}"/><path class="states" d="${statesPath}"/></g>
        <g class="base world"><path class="sphere" d="${worldSphere}"/><path class="grat" d="${worldGrat}"/><path class="land" d="${worldLand}"/><path class="borders" d="${worldBorders}"/><path class="usst" d="${usInWorld}"/></g>
      </g></g>
      <g id="mlinks"></g><g id="mmarks"></g><g id="mlabels"></g>
    </svg>
    <div class="mzoom"><button id="mzin" aria-label="Zoom in">+</button><button id="mzout" aria-label="Zoom out">&#8722;</button><button id="mzreset" aria-label="Reset view">&#10227;</button></div>
    <div class="mhint" id="mhint">Scroll or pinch to zoom, drag to pan. Tap any pin.</div>
    <div class="mtip" id="mtip" hidden></div>
    <aside class="mdrawer" id="mdrawer" aria-label="City details" hidden><div class="mgrab" aria-hidden="true"></div><button class="mclose" id="mclose" aria-label="Close">&#215;</button><div id="mdbody"></div></aside>
  </div>
  <div class="mlegend">
    <span><i class="lgT live"></i>Tesla live</span><span><i class="lgT drv"></i>Tesla live, safety driver</span><span><i class="lgT ann"></i>Tesla coming soon</span><span><i class="lgT hire"></i>Tesla hiring (size = open roles)</span><span><i class="lgT sd"></i>Self-driving tests only</span>
    <span><i class="lgW live"></i>Waymo live</span><span><i class="lgW ann"></i>Waymo up next</span><span><i class="lgW hire"></i>Waymo job ads</span><span><i class="lgD"></i>Both in one metro</span><span><i class="lgC"></i>Closed ads only</span>
  </div>
  <p class="muted mnote">Pins are metros: Tesla postings within ${mapMeta.radius} miles of a named metro are grouped onto it, the drawer lists each city. Robotaxi-titled roles are US jobs with "Robotaxi" in the title. Self-driving test roles (vehicle operators, data collection) are not Robotaxi jobs and are off by default. Closed ads never count toward totals. Waymo statuses come from waymo.com, Waymo job ads from its public Greenhouse board.</p>
</section>`;
}

function heroHtml() {
  const H = mapMeta.head, nLive = heroLive.length, nPend = heroPend.length, nSoon = heroPend.filter(p => p.soon).length;
  const maxR = Math.max(1, ...heroPend.map(p => p.roles));
  const pend = heroPend.slice().sort((a, b) => a.roles - b.roles).map((p, i) => { const r = (4.5 + 6.5 * Math.sqrt(p.roles / maxR)).toFixed(1);
    return `<g class="hd p${p.soon ? ' soon' : ''}" data-k="p${i}" tabindex="0" role="button" transform="translate(${p.x},${p.y})" aria-label="${esc(p.name)}: ${p.soon ? 'coming soon' : 'hiring'}, ${p.roles} open Robotaxi roles"><circle class="hh" r="${(r * 3.6).toFixed(1)}"/>${p.soon ? `<circle class="hs" r="${(+r + 4).toFixed(1)}"/>` : ''}<circle class="hc" r="${r}"/><circle class="hi" r="${(r * .4).toFixed(1)}"/><circle class="hit" r="${Math.max(12, +r + 6)}"/></g>`; }).join('');
  const live = heroLive.map((l, i) => `<g class="hd l" data-k="l${i}" tabindex="0" role="button" transform="translate(${l.x},${l.y})" aria-label="${esc(l.name)}: Robotaxi service live since ${l.date}"><circle class="hh" r="30"/><circle class="hp" r="9"/><circle class="hp d2" r="9"/><circle class="hc" r="9"/><circle class="hi" r="3.6"/><circle class="hit" r="14"/></g>`).join('');
  return `<section class="hx" id="top">
  <div class="hxbg" aria-hidden="true"></div><div class="hxgrid" aria-hidden="true"></div>
  <div class="hxin">
    <div class="hxtxt">
      <div class="hxkick rv"><span class="hxlive"></span>Live tracker</div>
      <h1 class="hxh rv d1">Where Tesla is hiring <em>Robotaxi supervisors</em></h1>
      <p class="hxlede rv d2">Pulled straight from Tesla's careers site and launch news, rebuilt every day. Green is Robotaxi service you can ride today. Red is where Tesla is hiring or has said it's coming next.</p>
      <div class="hxstats rv d3">
        <div class="hxs g"><b data-count="${nLive}">${nLive}</b><span>live service cities${livePids.size < nLive ? ` in ${livePids.size} metros` : ''}</span></div>
        <div class="hxs r"><b data-count="${nPend}">${nPend}</b><span>hiring or pending${nSoon ? `, ${nSoon} coming soon` : ''}</span></div>
        <div class="hxs w"><b data-count="${H.sup}">${H.sup}</b><span>open supervisor roles in ${H.supCities} cities</span></div>
        <div class="hxs c"><b data-count="${H.rt}">${H.rt}</b><span>Robotaxi-titled roles in ${H.rtCities} cities</span></div>
      </div>
    </div>
    <div class="hxmap rv d2">
      <svg id="hxsvg" viewBox="-10 -5 995 620" role="img" aria-label="US map: ${nLive} live Tesla Robotaxi cities in green, ${nPend} hiring or pending cities in red">
        <defs>
          <radialGradient id="hxG"><stop offset="0" stop-color="#3ddc97" stop-opacity=".6"/><stop offset=".45" stop-color="#3ddc97" stop-opacity=".14"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></radialGradient>
          <radialGradient id="hxR"><stop offset="0" stop-color="#ff3b3b" stop-opacity=".55"/><stop offset=".45" stop-color="#ff3b3b" stop-opacity=".12"/><stop offset="1" stop-color="#ff3b3b" stop-opacity="0"/></radialGradient>
          <linearGradient id="hxL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121a33"/><stop offset="1" stop-color="#0a0d1c"/></linearGradient>
          <filter id="hxglow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path class="hxn" d="${nationPath}"/><path class="hxst" d="${statesPath}"/>
        <g class="hxdots">${pend}${live}</g>
      </svg>
      <div class="hxtip" id="hxtip" hidden></div>
      <div class="hxleg"><span><i class="g"></i>Live service</span><span><i class="r"></i>Hiring / pending</span><a href="#map" class="hxgo">Full Tesla + Waymo map &#8595;</a></div>
    </div>
  </div>
  <img class="hxcar" src="/cybercab.jpg" alt="" aria-hidden="true" width="1280" height="720" decoding="async">
</section>`;
}
