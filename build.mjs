// node build.mjs -> dist/ (index.html, data.json, 404.html, robots.txt, favicon.svg)
import fs from 'node:fs'; import path from 'node:path'; import {execFileSync} from 'node:child_process'; import { ogHtml } from './tools/og_template.mjs'; import { competitorsHtml } from './tools/competitors_page.mjs'; import { fsdHtml } from './tools/fsd_page.mjs'; import { newsHtml } from './tools/news_page.mjs';
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
// Time-lapse dates (all from real data): live dots appear red at their first sourced hiring signal and turn green on
// launch day; hiring/pending dots appear on the earliest of their dated supervisor/fleet ad (backfill or tracker) or announcement.
const curveDate = new Map(); for (const c of [...curve.all, ...curve.sup]) { const k = `${c.city}, ${c.st}`; if (!curveDate.has(k) || c.d < curveDate.get(k)) curveDate.set(k, c.d); }
const placeById = new Map(places.map(p => [p.id, p]));
const annByPid = new Map(); for (const m of launches.metros) if (m.status === 'announced' && m.geo) { const p = placeOf(m.geo.lat, m.geo.lon); if (p) annByPid.set(p.id, m); }
for (const l of heroLive) { const m = launches.metros.find(x => x.id === l.id); l.hire = m.leadSignal && m.leadSignal.date < l.date ? m.leadSignal.date : null; }
for (const h of heroPend) { const p = placeById.get(h.pid), c = [];
  for (const ci of p.cities) if (curveDate.has(ci.k)) c.push(curveDate.get(ci.k));
  for (const j of rtOpen(p)) c.push(j.fs.slice(0, 10));
  const a = annByPid.get(h.pid); if (a && a.announced) c.push(a.announced.date);
  if (a && a.leadSignal) c.push(a.leadSignal.date);
  h.d = c.sort()[0] || trackingStart.slice(0, 10); h.mid = a ? a.id : null; }
const hero = { live: heroLive, pend: heroPend, end: last.slice(0, 10) };
hero.start = [...heroLive.map(l => l.hire || l.date), ...heroPend.map(h => h.d)].sort()[0];
const actAll = Object.values(histAll.jobs).filter(j => j.active);
const ckey = j => `${j.city}, ${j.country && j.country !== 'US' ? j.country : j.state}`;
const rtAct = actAll.filter(j => j.category !== 'selfdriving'), sdAct = actAll.filter(j => j.category === 'selfdriving');
const mapMeta = { presets, last, waymoChecked: wj.checkedAt || null, waymoSource: wj.source || null, radius: 45,
  head: { sup: sup.length, supCities: supCities.size, fleet: active.length, rt: rtAct.length, rtCities: new Set(rtAct.map(ckey)).size,
    sd: sdAct.length, sdCities: new Set(sdAct.map(ckey)).size, sdCountries: new Set(sdAct.map(j => j.country || 'US')).size,
    wLive: compare.counts.waymo.live, wAnn: compare.counts.waymo.announced, wIntl: compare.counts.waymo.intl } };
const liveM = launches.metros.filter(m => m.status === 'live'), soonM = launches.metros.filter(m => m.status === 'announced');
const liveByPid = {}; for (const l of heroLive) if (l.pid) liveByPid[l.pid] = (liveByPid[l.pid] || 0) + 1;
mapMeta.liveByPid = liveByPid;
// ONE set of headline numbers, used everywhere on the home page (hero, map readout, scoreboard, lead section)
const S = { live: liveM.length, driverless: liveM.filter(m => m.currentMode === 'driverless').length, driverNames: liveM.filter(m => m.currentMode === 'safety-driver').map(m => m.name),
  soon: soonM.length, soonNames: soonM.map(m => m.name), sup: sup.length, supCities: supCities.size, rt: mapMeta.head.rt, rtCities: mapMeta.head.rtCities,
  pins: heroLive.length + heroPend.length, pend: heroPend.length };
const payload = { S, hero, places, mapMeta, compare, curve, history, launches, avgLead, leadN: leadVals.length, trackingStart, last, prev, firstRun: runs.length <= 1, runs: runs.length, jobs, roles: content.roles };

const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/map.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/app.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/cities.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/hero.js'), 'utf8');
const desc = `Live Tesla Robotaxi tracker: ${S.live} live markets, ${S.soon} coming soon, ${S.sup} open Robotaxi supervisor roles in ${S.supCities} cities, plus FSD versions, competitors and fact-checked news. Every number sourced.`;
const title = `${cfg.name} | Tesla Robotaxi, FSD & Autonomous Driving Tracker`;
const ogImg = cfg.url.replace(/\/$/, '') + '/og.png?v=' + (last || '').slice(0, 10);
const ogAlt = `FSDriving: glowing US map of ${heroLive.length} live Tesla Robotaxi markets and ${heroPend.length} metros hiring or coming soon, with a Cybercab`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#07080c"/><circle cx="32" cy="32" r="18" fill="none" stroke="#ff3b3b" stroke-width="3" opacity=".45"/><circle cx="32" cy="32" r="8" fill="#ff3b3b"/></svg>`;

const roleCards = Object.entries(content.roles).map(([k, r]) => `
  <article class="role rv" data-role="${k}"><div class="role-tag ${k}">${esc(r.short)}</div><h3>${esc(r.label)}</h3><p class="role-blurb">${esc(r.blurb)}</p>
  <ul>${r.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></article>`).join('');

const headTags = ({ title, desc, path: pth }) => { const url = cfg.url + (pth || ''); return `<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}"><meta name="theme-color" content="#07080c">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:site_name" content="${esc(cfg.name)}"><meta property="og:image" content="${ogImg}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${ogImg}"><meta name="twitter:image:alt" content="${esc(ogAlt)}">
<link rel="alternate" type="application/rss+xml" title="FSDriving updates" href="/rss.xml"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png">`; };
const utcLabel = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
const relScript = `<script>(()=>{const f=()=>document.querySelectorAll('time[data-rel]').forEach(t=>{const d=new Date(t.dateTime),s=(Date.now()-d)/1e3,v=t.querySelector('.rv-t')||t;
v.textContent=s<90?'just now':s<3600?Math.round(s/60)+' min ago':s<86400?Math.round(s/3600)+'h ago':Math.round(s/86400)+'d ago';t.title=d.toLocaleString([],{dateStyle:'medium',timeStyle:'short'})+' your time'});f();document.addEventListener('DOMContentLoaded',f);setInterval(f,6e4)})()</script>`;
const updTag = (cls = 'upd') => `<time class="${cls}" data-rel datetime="${esc(last)}" title="${esc(utcLabel(last))}">Updated <span class="rv-t">${esc(utcLabel(last))}</span></time>`;
const topHeader = page => `<header class="top"><a class="brand" href="/" aria-label="FSDriving home"><span class="dot"></span><span class="wm">FSD<b>riving</b></span></a>
<nav class="tnav" aria-label="Site"><a href="/"${page === 'home' ? ' aria-current="page"' : ''}>Tracker</a><a href="/fsd"${page === 'fsd' ? ' aria-current="page"' : ''}>FSD</a><a href="/competitors"${page === 'competitors' ? ' aria-current="page"' : ''}>Competitors</a><a href="/news"${page === 'news' ? ' aria-current="page"' : ''}>News</a></nav>
<div class="checked"><span class="live"></span>${updTag()}</div></header>${relScript}`;
const sisterLink = `<p class="sister">Also tracking Tesla Optimus &amp; humanoid robots: <a href="https://optimistbot.com" target="_blank" rel="noopener">optimistbot.com</a></p>`;
const MAPHTML = mapHtml();
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${headTags({ title, desc, path: "" })}
<style>${css}</style></head><body>
<div class="grain" aria-hidden="true"></div>
${topHeader('home')}
<main>
${heroHtml()}
${nextHtml()}
${MAPHTML}

<section class="changes rv" id="changes"></section>

${scoreHtml()}

<section class="roles" id="curve"><div class="sec-h rv"><h2>Cities with Robotaxi supervisor ads, over time</h2><div class="filters cv-f" role="tablist" aria-label="Range"><button class="on" data-r="all">Full history</button><button data-r="recent">Last 100 days</button></div></div>
<div class="filters cv-s" role="tablist" aria-label="Which roles"><button class="on" data-s="sup">Supervisor cities</button><button data-s="all">All Robotaxi role cities</button></div>
<div class="tlwrap cvwrap"><svg id="cv" role="img" aria-label="Cumulative number of US cities where Tesla has posted Robotaxi Fleet Support Supervisor jobs, with Robotaxi launch dates"></svg><div class="tip" id="cvtip" hidden></div></div>
<div class="legend"><span><i class="lg s"></i>New city, dated from a source</span><span><i class="lg" style="background:none;border:2px solid #ff4a3d"></i>Estimated date</span><span><i class="lg" style="background:none;border:1px dashed #ff8a7a"></i>No date found, open at our first check</span><span><i class="lg" style="background:#65efad;border-radius:2px;transform:rotate(45deg)"></i>Robotaxi launch</span><span><i class="lg" style="background:#ffd78c;border-radius:2px;transform:rotate(45deg)"></i>Launch, human driver</span></div>
<p class="muted tlnote">One dot per city, dated from the earliest source we found. <a href="#method">How the dates work</a>.</p></section>

<section class="roles" id="lead"><div class="sec-h"><h2>From hiring to hailing</h2></div><p class="muted">First sourced hiring signal to first ride, for every live market. Minimum observed intervals, not predictions.</p><div id="leadstats"></div><p class="swipe">Swipe for every market &#8594;</p><div id="launchlist" class="launchgrid"></div><h3 class="waith">Announced, not live yet</h3><div id="waiting" class="waitgrid"></div></section>
<section class="roles" id="role">
  <div class="sec-h rv"><h2>So what's the job?</h2><p class="muted">Straight from the posting text, boiled down.</p></div>
  <div class="rolegrid">${roleCards}</div>
</section>
<section class="roles methwrap"><details class="method" id="method"><summary><span>How we count</span><small>Sources, definitions and caveats for every number on this page</small></summary>
<div class="methb">
<h4>The headline numbers</h4><ul>
<li><b>${S.live} live markets</b>: cities where Tesla says public Robotaxi rides run (data/launches.json, each with a launch source). ${S.driverless} are driverless${S.driverNames.length ? `; ${esc(S.driverNames.join(', '))} has a human safety driver` : ''}. Dallas and Fort Worth launched separately, so they count as two markets but share one metro pin on the maps.</li>
<li><b>${S.soon} coming soon</b>: ${esc(S.soonNames.join(', '))}, named by Tesla with no launch date.</li>
<li><b>${S.sup} supervisor roles in ${S.supCities} cities</b>: open "Robotaxi Fleet Support Supervisor" postings on tesla.com/careers at the last check.</li>
<li><b>${S.rt} Robotaxi roles in ${S.rtCities} cities</b>: every open US posting with "Robotaxi" in the title (supervisors included). Self-driving test roles (vehicle operators, data collection) are not Robotaxi jobs and are never counted. Closed ads never count.</li>
<li><b>${S.pins} hero pins</b>: ${heroLive.length} live markets in green plus ${S.pend} metros in red that are coming soon or have open Robotaxi roles. Postings within ${mapMeta.radius} miles of a metro are grouped onto its pin.</li></ul>
<h4>Time-lapse dates</h4><p>A live market appears in red on its first sourced hiring signal (when that predates launch) and turns green on launch day. A red pin appears on the earliest dated supervisor or fleet ad for any city in it (sourced X posts, news, archives or our own first sighting), or on the announcement date. Undated cities use the day this tracker started, ${esc(new Date(trackingStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }))}.</p>
<h4>Supervisor cities over time</h4><p id="cvnote"></p>
<h4>Lead times</h4><p>Hiring-to-launch gaps use the earliest fleet support or Robotaxi ops hiring signal we can date. Archives are incomplete, so these are minimum observed intervals, not original posting dates, and not forecasts. Autopilot test-driver hints are excluded.</p>
<h4>Tesla vs Waymo</h4><p>Waymo statuses come from waymo.com (checked ${esc(fmtDay(compare.checkedAt))}); Waymo hiring is metros named in its open job ads${compare.waymoJobs.total ? ` (${compare.waymoJobs.total} jobs)` : ''}. The two companies hire very differently, so hiring is a signal, not a like-for-like count.</p>
<p class="muted">Not affiliated with Tesla or Waymo. Raw data: <a href="/data.json">data.json</a> (every job with first and last seen), <a href="/launches.json">launches.json</a> (launch sources), <a href="/history.json">history.json</a>. ${runs.length} daily checks so far.</p>
</div></details></section>
</main>
<footer>
  <p><b>Not affiliated with Tesla.</b> Unofficial tracker. Job data comes from Tesla's public careers listings (<a href="${cfg.sourceUrl}" rel="noopener" target="_blank">tesla.com/careers</a>). Openings can close any time, so always check the posting itself. <a href="#method">How we count</a> &middot; <a href="/rss.xml">RSS</a></p>
  ${sisterLink}
</footer>
<script id="data" type="application/json">${JSON.stringify(payload).replace(/\u2014/g, '-').replace(/</g, '\\u003c')}</script>
<script>/*D3*/</script><script>${js}</script>
</body></html>`;
if (/\u2014/.test(html)) { console.error('em dash found in page copy (src/ or build.mjs). Fix the text.'); process.exit(1); }
const d3src = fs.readFileSync(path.join(root, 'src/d3.min.js'), 'utf8');
fs.writeFileSync(path.join(dist, 'index.html'), html.replace('<script>/*D3*/</script>', () => `<script>${d3src}</script>`));
fs.copyFileSync(path.join(root,'data/launches.json'),path.join(dist,'launches.json'));
{ // /competitors
  const C = rd('data/competitors.json'); const liveM = launches.metros.filter(m => m.status === 'live'); const drv = liveM.filter(m => m.currentMode === 'safety-driver');
  const soonM = launches.metros.filter(m => m.status === 'announced');
  const tesla = { live: `${liveM.length} (${drv.length ? drv.map(m => m.name).join(', ') + ' with a safety driver' : 'all driverless'})`,
    status: `Public rides in ${liveM.length} markets, driverless in ${liveM.length - drv.length}${drv.length ? `; ${drv.map(m => m.name).join(', ')} still has a safety driver` : ''}`,
    markets: liveM.map(m => m.name).join(', ') + (soonM.length ? `. Coming soon: ${soonM.map(m => m.name).join(', ')}` : ''),
    soon: soonM.map(m => m.name).join(', ') || 'None listed', roles: `${mapMeta.head.rt} (${mapMeta.head.sup} supervisor)` };
  const footerHtml = `<footer>
  <p><b>Not affiliated with Tesla or any company listed.</b> Unofficial tracker. Facts are hand-checked against the linked sources; company figures are marked as such. Spot something stale? The data lives in <a href="https://github.com/phelo1/fsdriving/blob/main/data/competitors.json" target="_blank" rel="noopener">data/competitors.json</a>.</p>
  ${sisterLink}
</footer>`;
  const ch = competitorsHtml({ C, esc, headTags, topHeader, footerHtml, css, tesla });
  if (/\u2014/.test(ch)) { console.error('em dash in competitors page'); process.exit(1); }
  fs.mkdirSync(path.join(dist, 'competitors'), { recursive: true }); fs.writeFileSync(path.join(dist, 'competitors/index.html'), ch);
  console.log('competitors page:', C.companies.length, 'companies');
}
{ // /fsd
  const F = rd('data/fsd.json');
  const footerHtml = `<footer>
  <p><b>Not affiliated with Tesla.</b> Unofficial tracker. Versions, builds and dates are hand-checked against the linked release notes, install trackers and Tesla posts; Tesla's own claims are marked as such and plans are marked Planned. Spot something stale? The data lives in <a href="https://github.com/phelo1/fsdriving/blob/main/data/fsd.json" target="_blank" rel="noopener">data/fsd.json</a>.</p>
  ${sisterLink}
</footer>`;
  const fh = fsdHtml({ F, esc, headTags, topHeader, footerHtml, css });
  if (/\u2014/.test(fh)) { console.error('em dash in fsd page'); process.exit(1); }
  fs.mkdirSync(path.join(dist, 'fsd'), { recursive: true }); fs.writeFileSync(path.join(dist, 'fsd/index.html'), fh);
  console.log('fsd page:', F.releases.length, 'timeline entries');
}
{ // /news
  const N = rd('data/news.json');
  if (/\u2014/.test(JSON.stringify(N))) { console.error('em dash in data/news.json'); process.exit(1); }
  const footerHtml = `<footer>
  <p><b>Not affiliated with Tesla.</b> Unofficial tracker. Every story, rumour, incident and video links to its source; rumours and pending items are labelled as such, and NHTSA crash reports are not findings of fault. Spot something stale? The data lives in <a href="https://github.com/phelo1/fsdriving/blob/main/data/news.json" target="_blank" rel="noopener">data/news.json</a>.</p>
  ${sisterLink}
</footer>`;
  const nh = newsHtml({ N, esc, headTags, topHeader, footerHtml, css });
  if (/\u2014/.test(nh)) { console.error('em dash in news page'); process.exit(1); }
  fs.mkdirSync(path.join(dist, 'news'), { recursive: true }); fs.writeFileSync(path.join(dist, 'news/index.html'), nh);
  console.log('news page:', N.items.length + 1, 'stories,', N.incidents.length, 'incidents,', N.videos.length, 'videos');
}
fs.writeFileSync(path.join(dist,'history.json'),JSON.stringify(history,null,1));
fs.writeFileSync(path.join(dist, 'data.json'), JSON.stringify(histAll, null, 1));
for (const f of ['favicon.svg', 'favicon.ico', 'favicon.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(root, 'src/icons', f), path.join(dist, f));
fs.copyFileSync(path.join(root, 'src/hero-cybercab.jpg'), path.join(dist, 'cybercab.jpg'));
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${cfg.url.replace(/\/$/, '')}/sitemap.xml\n`);
{ // sitemap.xml + rss.xml (only verified, sourced items from launches.json, fsd.json and news.json)
  const base = cfg.url.replace(/\/$/, ''), today = last.slice(0, 10);
  const xe = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[['/', 'daily', '1.0'], ['/fsd', 'weekly', '0.8'], ['/competitors', 'weekly', '0.7'], ['/news', 'daily', '0.8']].map(([u, f, pr]) => `  <url><loc>${base}${u}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
  const N = rd('data/news.json'), F = rd('data/fsd.json'), items = [];
  items.push({ d: N.lead.date, t: `${N.lead.status}: ${N.lead.title}`, desc: N.lead.summary, link: `${base}/news#n-${N.lead.id}`, cat: 'News' });
  for (const i of N.items) items.push({ d: i.date, t: `${i.status}: ${i.title}`, desc: i.summary, link: `${base}/news#n-${i.id}`, cat: 'News' });
  const VL = { confirmed: 'Confirmed', debunked: 'Debunked', review: 'Under review' };
  for (const i of N.incidents) if (/^\d{4}-\d{2}-\d{2}$/.test(i.date)) items.push({ d: i.date, t: `Fact-check (${VL[i.verdict] || i.verdict}): ${i.title}`, desc: i.finding, link: `${base}/news#i-${i.id}`, cat: 'Fact-check' });
  for (const r of F.releases) if (r.kind === 'release' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) items.push({ d: r.date, t: `FSD ${/^\d/.test(r.v) ? 'v' + r.v : r.v}${r.fw ? ' (' + r.fw + ')' : ''}`, desc: `${r.fleet ? r.fleet + '. ' : ''}${r.text}`, link: `${base}/fsd`, cat: 'FSD' });
  for (const m of launches.metros) if (m.status === 'live' && m.launch && /^\d{4}-\d{2}-\d{2}$/.test(m.launch.date)) items.push({ d: m.launch.date, t: `Robotaxi launch: ${m.name}, ${m.state}`, desc: m.launch.summary, link: `${base}/#lead`, cat: 'Robotaxi' });
  for (const m of launches.metros) if (m.status === 'announced' && m.announced) items.push({ d: m.announced.date, t: `Robotaxi coming soon: ${m.name}, ${m.state}`, desc: m.announced.text, link: `${base}/#next`, cat: 'Robotaxi' });
  const seen = new Set(), feed = items.filter(i => /^\d{4}-\d{2}-\d{2}$/.test(i.d) && !seen.has(i.t) && seen.add(i.t)).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 30);
  const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n<title>FSDriving: Tesla Robotaxi, FSD &amp; autonomy updates</title><link>${base}/</link><atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>\n<description>Sourced Tesla Robotaxi launches, FSD releases and fact-checked autonomy news from fsdriving.com.</description><language>en</language><lastBuildDate>${new Date(last).toUTCString()}</lastBuildDate>\n${feed.map(i => `<item><title>${xe(i.t)}</title><link>${xe(i.link)}</link><guid isPermaLink="false">${xe(i.cat + ':' + i.d + ':' + i.t)}</guid><pubDate>${new Date(i.d + 'T12:00:00Z').toUTCString()}</pubDate><category>${xe(i.cat)}</category><description>${xe(i.desc)}</description></item>`).join('\n')}\n</channel></rss>\n`;
  fs.writeFileSync(path.join(dist, 'rss.xml'), rss);
  console.log('sitemap.xml + rss.xml:', feed.length, 'feed items');
}
fs.writeFileSync(path.join(dist, '404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found | ${cfg.name}</title><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${cfg.url}"><meta property="og:image" content="${ogImg}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${ogImg}"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07080c;color:#e9ecf2;font:16px/1.5 system-ui,sans-serif;text-align:center}a{color:#ff5a4f}</style></head><body><div><h1>Nothing parked here</h1><p><a href="/">Back to the map</a></p></div></body></html>`);
{ // site-wide em dash guard: every text file in dist
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const bad = walk(dist).filter(f => /\.(html|xml|json|txt|js)$/.test(f) && /\u2014/.test(fs.readFileSync(f, 'utf8')));
  if (bad.length) { console.error('em dash found in:', bad.map(f => path.relative(dist, f)).join(', ')); process.exit(1); }
}
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
  <div class="mbar">
    <div class="mrow">
      <div class="mseg" role="group" aria-label="Map view">${[['us', 'US'], ['world', 'World'], ['europe', 'Europe'], ['asia', 'Asia-Pacific']].map(([k, l], i) => `<button data-view="${k}" class="${i ? '' : 'on'}" aria-pressed="${!i}">${l}</button>`).join('')}</div>
      <div class="msearch"><input id="msq" type="search" placeholder="Jump to a city" autocomplete="off" aria-label="Search cities" role="combobox" aria-expanded="false" aria-controls="msres"><ul id="msres" role="listbox" hidden></ul></div>
    </div>
    <div class="mrow chips">
      <div class="mgrp"><span class="mglab">Who</span>${chip('op', 'tesla', 'Tesla', true)}${chip('op', 'waymo', 'Waymo', false)}</div>
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
  <p class="muted mnote">Pins group Tesla postings within ${mapMeta.radius} miles of a metro; the drawer lists each city. <a href="#method">How we count</a>.</p>
</section>`;
}

function fmtDay(d) { return new Date(d.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
function nextHtml() {
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ann = heroPend.filter(h => h.soon).map(h => { const m = launches.metros.find(x => x.id === h.mid);
    const src = m && m.announced && m.announced.sources && m.announced.sources[0];
    return `<div class="nxc soon"><button class="nxgo" type="button" data-pid="${esc(h.pid)}"><span class="nxb">Coming soon</span><b>${esc(h.name)}${h.st ? ', ' + esc(h.st) : ''}</b>
<span>${m && m.announced ? 'Named ' + esc(fmtDay(m.announced.date)) : 'Named by Tesla'} &middot; ${h.roles ? pl(h.roles, 'open Robotaxi role') : 'no open roles yet'}</span>${m && m.leadSignal ? `<small>First hiring signal ${esc(fmtDay(m.leadSignal.date))}</small>` : ''}</button>
${src ? `<a class="nxs" href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.publisher)} &#8599;</a>` : ''}</div>`; });
  const hot = heroPend.filter(h => !h.soon && h.sup).sort((a, b) => b.sup - a.sup || b.roles - a.roles || a.d.localeCompare(b.d)).slice(0, 3).map(h =>
    `<div class="nxc hot"><button class="nxgo" type="button" data-pid="${esc(h.pid)}"><span class="nxb">Hiring signal</span><b>${esc(h.name)}${h.st ? ', ' + esc(h.st) : ''}</b>
<span>${pl(h.sup, 'supervisor role')} &middot; ${pl(h.roles, 'Robotaxi role')} open</span><small>First seen hiring ${esc(fmtDay(h.d))}</small></button>
<a class="nxs" href="${esc(cfg.sourceUrl)}" target="_blank" rel="noopener">Tesla careers &#8599;</a></div>`);
  return `<section class="nxt" id="next" aria-labelledby="nx-h"><div class="nxh"><h2 id="nx-h">Next up</h2><p class="muted">Cities Tesla has named, then the strongest open supervisor hiring with nothing announced. Hiring is a signal, not a promise. Tap a city to open it on the map.</p></div>
<div class="nxgrid">${ann.join('')}${hot.join('')}</div></section>`;
}
function scoreHtml() {
  const W = compare.counts.waymo, both = compare.metros.filter(m => m.tesla && /^live/.test(m.tesla.status) && m.waymo && m.waymo.status === 'live').map(m => m.name);
  const row = (lab, t, tn, w, wn) => `<div class="scr"><div class="scl">${lab}</div><div class="sct"><b>${t}</b><span>${tn}</span></div><div class="scw"><b>${w}</b><span>${wn}</span></div></div>`;
  return `<section class="roles vs" id="vs"><div class="sec-h rv"><h2>Tesla vs Waymo</h2><button class="wbtn" id="showWaymo" type="button" aria-pressed="false"><i></i><span>Show Waymo on map</span></button></div>
<div class="score"><div class="scr hd"><div class="scl"></div><div class="sct"><b>Tesla</b></div><div class="scw"><b>Waymo</b></div></div>
${row('Live service', S.live, `markets, ${S.driverless} driverless`, W.live, `US metros, all driverless${W.live - W.open ? `, ${W.open} open to all riders` : ''}`)}
${row('Coming next', S.soon, esc(S.soonNames.join(', ')), W.announced + W.intl, `${W.announced} US + ${W.intl} abroad on its Up Next list`)}
${row('Hiring signal', S.rt, `open Robotaxi roles in ${S.rtCities} US cities`, W.hiring, `US metros named in its ${compare.waymoJobs.total ? compare.waymoJobs.total + ' ' : ''}open job ads`)}
<div class="scr both"><div class="scl">Both live</div><div class="scx"><b>${both.length}</b><span>metros: ${esc(both.join(', '))}. Dallas and Fort Worth count as one metro here.</span></div></div></div>
<p class="muted tlnote">Waymo from waymo.com and its job board, checked ${esc(fmtDay(compare.checkedAt))}. <a href="/competitors">Full competitor comparison</a> &middot; <a href="#method">How we count</a></p></section>`;
}
function heroHtml() {
  const tlDays = days(hero.start, hero.end), H = mapMeta.head, nLive = heroLive.length, nPend = heroPend.length, nSoon = heroPend.filter(p => p.soon).length;
  const maxR = Math.max(1, ...heroPend.map(p => p.roles));
  const pend = heroPend.map((p, i) => [p, i]).sort((a, b) => a[0].roles - b[0].roles).map(([p, i]) => { const r = (4.5 + 6.5 * Math.sqrt(p.roles / maxR)).toFixed(1);
    return `<g class="hd p${p.soon ? ' soon' : ''}" data-k="p${i}" tabindex="0" role="button" transform="translate(${p.x},${p.y})" aria-label="${esc(p.name)}: ${p.soon ? 'coming soon' : 'hiring'}, ${p.roles} open Robotaxi roles"><circle class="hh" r="${(r * 3.6).toFixed(1)}"/>${p.soon ? `<circle class="hs" r="${(+r + 4).toFixed(1)}"/>` : ''}<circle class="hc" r="${r}"/><circle class="hi" r="${(r * .4).toFixed(1)}"/><circle class="hit" r="${Math.max(12, +r + 6)}"/></g>`; }).join('');
  const live = heroLive.map((l, i) => `<g class="hd l" data-k="l${i}" tabindex="0" role="button" transform="translate(${l.x},${l.y})" aria-label="${esc(l.name)}: Robotaxi service live since ${l.date}"><circle class="hh" r="30"/><circle class="hp" r="9"/><circle class="hp d2" r="9"/><circle class="hc" r="9"/><circle class="hi" r="3.6"/><circle class="hit" r="14"/></g>`).join('');
  return `<section class="hx" id="top">
  <div class="hxbg" aria-hidden="true"></div><div class="hxgrid" aria-hidden="true"></div>
  <div class="hxin">
    <div class="hxtxt">
      <div class="hxkick rv"><span class="hxlive"></span>Live tracker<span class="hxu"> &middot; ${updTag('hxupd')}</span></div>
      <h1 class="hxh rv d1">Where Tesla Robotaxi is live, <em>and hiring next</em></h1>
      <p class="hxlede rv d2">Every live Robotaxi market and every US city where Tesla is hiring Robotaxi staff, rebuilt daily from Tesla's careers site and sourced launch news. Press play to watch it spread.</p>
      <div class="hxstats rv d3">
        <div class="hxs g" title="Cities with public Tesla Robotaxi rides (sourced launch dates). ${esc(S.driverNames.join(', '))} has a human safety driver."><b data-count="${S.live}">${S.live}</b><span>live markets<small>${S.driverless} driverless${S.driverNames.length ? `, ${esc(S.driverNames.join(', '))} with a safety driver` : ''}</small></span></div>
        <div class="hxs a" title="Cities Tesla has named as coming soon, with no launch date yet."><b data-count="${S.soon}">${S.soon}</b><span>coming soon<small>${esc(S.soonNames.join(', '))}</small></span></div>
        <div class="hxs w" title="Open Robotaxi Fleet Support Supervisor postings on tesla.com/careers at the last check."><b data-count="${S.sup}">${S.sup}</b><span>supervisor roles open<small>in ${S.supCities} US cities</small></span></div>
        <div class="hxs c" title="Every open US posting with Robotaxi in the title, supervisors included. Self-driving test roles excluded."><b data-count="${S.rt}">${S.rt}</b><span>Robotaxi roles open<small>in ${S.rtCities} US cities</small></span></div>
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
      <div class="tlx" id="tlx"><button class="tlplay" id="tlplay" type="button" aria-label="Play the time-lapse"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="ip" d="M8 5v14l11-7z"/><path class="ipa" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button>
        <input type="range" id="tlrange" min="0" max="${tlDays}" value="${tlDays}" step="1" aria-label="Time-lapse date">
        <div class="tlread"><b id="tldate">${esc(fmtDay(hero.end))}</b><span id="tlcnt"><i class="g"></i>${heroLive.length} live <i class="r"></i>${S.pend} hiring or next</span></div></div>
      <div class="hxleg"><span><i class="g"></i>Live service</span><span><i class="r"></i>Hiring or coming soon (size = open roles)</span><a href="#map" class="hxgo">Full map &#8595;</a></div>
    </div>
  </div>
  <img class="hxcar" src="/cybercab.jpg" alt="" aria-hidden="true" width="1280" height="720" decoding="async">
</section>`;
}
