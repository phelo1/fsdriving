// Builds the "places" behind the main interactive map: one pin per metro or city, carrying Tesla service status,
// every tracked Tesla posting (all categories, open and closed), Waymo status and Waymo job-ad counts.
// Grouping rule (same as the comparison section): a Tesla job city joins the nearest named metro within 45 mi,
// otherwise it clusters with another unassigned city within 35 mi, otherwise it gets its own pin.
const R_METRO = 45, R_CITY = 35;
const hav = (a, b) => { const R = 3958.8, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SUBGROUP = t => { t = t.toLowerCase();
  if (/service technician|charging|attendant|technician/.test(t)) return 'svc';
  if (/market|operations|program manager|hr |partner|public safety|content|video|visual designer|intern/.test(t)) return 'biz';
  return 'eng'; };

export function buildPlaces({ hist, geo, compare, wj, launches, projUS, projW, countryNames }) {
  const r1 = v => v ? [+v[0].toFixed(1), +v[1].toFixed(1)] : null;
  // Albers USA only for US locations (its clip box would otherwise accept e.g. Toronto).
  const pt = (lat, lon, isUS = true) => ({ us: isUS ? r1(projUS([lon, lat])) : null, w: r1(projW([lon, lat])) });
  const places = [];
  for (const m of compare.metros) places.push({ id: m.id, name: m.name, sub: m.state, cc: 'US', lat: m.lat, lon: m.lon, ...pt(m.lat, m.lon),
    tesla: m.tesla, waymo: m.waymo, wh: wj.metros[m.id] || null, metro: true, cities: [], jobs: [] });
  for (const c of compare.waymoInternational || []) { const g = geo['waymo:' + c.name]; if (!g) continue;
    places.push({ id: c.id, name: c.name, sub: c.country, cc: 'INTL', lat: g.lat, lon: g.lon, ...pt(g.lat, g.lon, false), tesla: null,
      waymo: { status: c.status, note: c.note, sources: c.sources, year: c.year || null }, wh: wj.metros[c.id] || null, metro: true, cities: [], jobs: [] }); }
  // launch records (Tesla) inside each metro, for the drawer
  for (const l of launches.metros) { const g = geo[l.anchor]; if (!g) continue;
    let best = null; for (const p of places) { if (!p.metro) continue; const d = hav(g, p); if (d <= R_METRO && (!best || d < best.d)) best = { d, p }; }
    if (best) (best.p.launches = best.p.launches || []).push({ name: l.name, status: l.status, date: l.launch && l.launch.date, mode: l.currentMode || null, note: l.currentModeNote || null, href: '#launch-' + l.id }); }
  // Tesla job cities
  const byCity = new Map();
  for (const j of Object.values(hist.jobs)) {
    const intl = (j.country || 'US') !== 'US', k = intl ? `${j.city}, ${j.country}` : `${j.city}, ${j.state}`;
    const g = geo[k]; if (!g) { console.warn('places: no coords for', k); continue; }
    const c = byCity.get(k) || { k, city: j.city, sub: intl ? (countryNames[j.country] || j.country) : j.state, cc: intl ? j.country : 'US', g, jobs: [] };
    c.jobs.push({ id: j.id, t: j.title, c: j.category, sg: j.category === 'other' ? SUBGROUP(j.title) : undefined, u: (j.url || '').replace('https://www.tesla.com/careers/search/job/', ''), fs: j.firstSeen.slice(0, 10), ls: j.lastSeen.slice(0, 10), a: !!j.active, rm: j.removedAt ? j.removedAt.slice(0, 10) : undefined });
    byCity.set(k, c);
  }
  const extra = [];
  const order = [...byCity.values()].sort((a, b) => b.jobs.filter(j => j.a).length - a.jobs.filter(j => j.a).length || a.k.localeCompare(b.k));
  for (const c of order) {
    let best = null;
    for (const p of places) { const d = hav(c.g, p); if (d <= R_METRO && (!best || d < best.d)) best = { d, p }; }
    if (!best) for (const p of extra) { const d = hav(c.g, p); if (d <= R_CITY && (!best || d < best.d)) best = { d, p }; }
    if (!best) { const p = { id: 't-' + slug(c.k), name: c.city, sub: c.sub, cc: c.cc, lat: c.g.lat, lon: c.g.lon, ...pt(c.g.lat, c.g.lon, c.cc === 'US'), tesla: null, waymo: null, wh: null, metro: false, cities: [], jobs: [] };
      extra.push(p); places.push(p); best = { d: 0, p }; }
    best.p.cities.push({ k: c.k, name: c.city, d: Math.round(best.d), ...pt(c.g.lat, c.g.lon, c.cc === 'US') });
    for (const j of c.jobs) best.p.jobs.push({ ...j, city: c.k });
  }
  for (const p of places) { p.jobs.sort((a, b) => (b.a - a.a) || a.c.localeCompare(b.c) || a.t.localeCompare(b.t)); p.cities.sort((a, b) => a.d - b.d); }
  return places.filter(p => p.jobs.length || p.tesla || p.waymo || p.wh);
}
