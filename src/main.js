import Globe from 'globe.gl';
import { CHOKEPOINTS } from './chokepoints.js';
import { ASSUMPTIONS, flowDelta, chokepointPenaltiesNm } from './deltas.js';
import { toVec, slerpLatLng, resample } from './geo.js';

const RENDER_N = 260;         // flows drawn on the globe (KPIs always use every flow)
const SAMPLES = 140;          // points per drawn route, so old and new routes can morph point-for-point
const TWEEN_MS = 1600;
const LANE_ALT = 0.004;
const IDLE_ROTATE_MS = 8000;

const REGIONS = [
  ['East Asia', '#38bdf8', 'CHN HKG TWN JPN KOR'],
  ['Southeast Asia', '#2dd4bf', 'VNM THA MYS SGP IDN PHL KHM MMR'],
  ['South Asia', '#a3e635', 'IND BGD PAK LKA'],
  ['Middle East', '#fb923c', 'ARE SAU QAT KWT OMN IRN ISR JOR TUR EGY'],
  ['Europe', '#a78bfa', 'DEU NLD GBR FRA ITA BEL ESP POL SWE GRC PRT DNK NOR IRL FIN RUS'],
  ['North America', '#facc15', 'USA CAN MEX'],
  ['Latin America', '#4ade80', 'BRA ARG CHL PER COL ECU URY'],
  ['Africa', '#f472b6', 'ZAF NGA KEN MAR GHA CIV TUN'],
  ['Oceania', '#e2e8f0', 'AUS NZL'],
];
const regionColor = Object.fromEntries(REGIONS.flatMap(([, c, isos]) => isos.split(' ').map((i) => [i, c])));

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const rgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
const fmtUsd = (v) => {
  const s = v < 0 ? '−' : '';
  const x = Math.abs(v);
  if (x >= 1e12) return `${s}$${(x / 1e12).toFixed(2)}T`;
  if (x >= 1e9) return `${s}$${(x / 1e9).toFixed(x >= 1e11 ? 0 : 1)}B`;
  if (x >= 1e6) return `${s}$${(x / 1e6).toFixed(0)}M`;
  return `${s}$${(x / 1e3).toFixed(0)}k`;
};
const fmtDays = (d) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} d`;

// ---------- data ----------
const [graph, data] = await Promise.all(['/data/graph.json', '/data/flows.json'].map((u) => fetch(u).then((r) => r.json())));
const { ports, flows, pairs, countries, meta } = data;
const iso = (m49) => countries[m49].iso3;
flows.forEach((f) => { f.usd *= ASSUMPTIONS.seaShare.value; });
const maxUsd = flows[0].usd;
flows.forEach((f, i) => {
  f.idx = i;
  f.color = regionColor[iso(pairs[f.pair].exp)] ?? '#e2e8f0';
  f.drawn = i < RENDER_N;
});
const drawn = flows.filter((f) => f.drawn);

// ---------- globe ----------
const globe = new Globe(document.getElementById('globe'))
  .globeImageUrl('/img/earth-night.jpg')
  .bumpImageUrl('/img/earth-topology.png')
  .backgroundImageUrl('/img/night-sky.png')
  .atmosphereColor('#3b82f6')
  .atmosphereAltitude(0.18)
  .pointOfView({ lat: 22, lng: 70, altitude: 2.5 })
  .pathPoints('pts')
  .pathPointLat((p) => p[0])
  .pathPointLng((p) => p[1])
  .pathPointAlt((p) => p[2])
  .pathTransitionDuration(0)
  .pathColor((d) => rgba(...pathStyle(d)))
  // Both kinds are fat lines (non-null stroke) so writeLine() can update their geometry in place.
  .pathStroke((d) => (d.kind === 'flow' ? 0.12 + 0.9 * Math.sqrt(d.flow.usd / maxUsd) : 0.15))
  .pathDashLength((d) => (d.kind === 'flow' ? 0.02 : 1))
  .pathDashGap((d) => (d.kind === 'flow' ? 0.03 : 0))
  .pathDashInitialGap((d) => (d.kind === 'flow' ? (d.flow.idx * 0.137) % 1 : 0))
  .pathDashAnimateTime(dashTime)
  .labelText('name')
  .labelSize(0.55)
  .labelDotRadius(0.22)
  .labelColor(() => 'rgba(226, 232, 240, 0.75)')
  .labelResolution(2)
  .ringColor(() => (t) => `rgba(244, 63, 94, ${1 - t})`)
  .ringMaxRadius(4)
  .ringPropagationSpeed(2.5)
  .ringRepeatPeriod(900)
  .htmlElementsData(CHOKEPOINTS)
  .htmlElement(makeMarker)
  .htmlElementVisibilityModifier((el, visible) => {
    el.style.opacity = visible ? 1 : 0;
    el.style.pointerEvents = visible ? 'auto' : 'none';
  });

if (import.meta.env.DEV) window.__globe = globe; // console access for render profiling

// Label the busiest ports only.
const portUsd = new Map();
for (const f of flows) for (const p of [f.o, f.d]) portUsd.set(p, (portUsd.get(p) ?? 0) + f.usd);
globe.labelsData([...portUsd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([p]) => ports[p]));

const controls = globe.controls();
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
let idleTimer;
function pauseRotation() {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { controls.autoRotate = true; }, IDLE_ROTATE_MS);
}
controls.addEventListener('start', pauseRotation);

// Keep the globe centred in the space the side panel (or bottom sheet on phones) leaves free.
function fitViewport() {
  globe.width(window.innerWidth).height(window.innerHeight);
  const panel = document.getElementById('panel').getBoundingClientRect();
  globe.globeOffset(window.innerWidth >= 640 ? [-(panel.width + 16) / 2, 0] : [0, -(panel.height + 16) / 2]);
}
fitViewport();
window.addEventListener('resize', fitViewport);

// ---------- path drawing ----------
// globe.gl rebuilds every path whenever pathsData changes (~0.4 ms each), which would stall reroute
// animations. So pathsData is set once; afterwards the Line2 objects behind each moving path are
// updated directly.
function pathStyle(d) {
  if (d.flow.blocked) return d.kind === 'base' ? ['#f43f5e', 0.7] : ['#000000', 0];
  return d.kind === 'base' ? [d.flow.color, 0.18] : [d.flow.color, 0.9];
}
function dashTime(d) {
  return d.kind === 'flow' && !d.flow.blocked ? Math.round((d.flow.route?.nm ?? 8000) * 2.4) : 0;
}

const pathEntries = drawn.flatMap((flow) => (flow.entries = [{ flow, kind: 'base' }, { flow, kind: 'flow' }]));
function initPaths() {
  for (const e of pathEntries) e.pts = e.flow.display;
  globe.pathsData(pathEntries.filter((e) => e.pts));
}

const RAD = Math.PI / 180;
function writeLine(e) {
  const obj = e.__threeObjPath?.children[0];
  if (!obj?.isLine2) return;
  const pts = e.flow.display;
  const pos = new Float32Array(pts.length * 3);
  let len = 0;
  pts.forEach(([lat, lng, alt], i) => {
    // same projection as three-globe's polar2Cartesian (globe radius 100)
    const phi = (90 - lat) * RAD, theta = (90 - lng) * RAD, r = 100 * (1 + alt);
    pos[3 * i] = r * Math.sin(phi) * Math.cos(theta);
    pos[3 * i + 1] = r * Math.cos(phi);
    pos[3 * i + 2] = r * Math.sin(phi) * Math.sin(theta);
    if (i) len += Math.hypot(pos[3 * i] - pos[3 * i - 3], pos[3 * i + 1] - pos[3 * i - 2], pos[3 * i + 2] - pos[3 * i - 1]);
  });
  obj.geometry.setPositions(pos);
  if (obj.material.dashed) {
    obj.computeLineDistances();
    obj.material.dashScale = 1 / len;
  }
}
function restyle(e) {
  const obj = e.__threeObjPath?.children[0];
  if (!obj) return;
  const [hex, alpha] = pathStyle(e);
  obj.material.color.set(hex);
  obj.material.opacity = alpha;
  obj.material.transparent = alpha < 1;
  const t = dashTime(e);
  obj.__dashAnimateStep = t > 0 ? 1000 / t : 0;
}

// ---------- chokepoints ----------
function makeMarker(cp) {
  const el = document.createElement('div');
  el.className = 'cp-marker';
  el.innerHTML = `<span class="dot"></span><span class="name">${cp.name}</span>`;
  el.addEventListener('click', (ev) => { ev.stopPropagation(); toggle(cp, true); });
  cp.el = el;
  return el;
}

const chipList = document.getElementById('chokepoint-list');
function buildChips() {
  chipList.innerHTML = '';
  for (const cp of [...CHOKEPOINTS].sort((a, b) => b.baseUsd - a.baseUsd)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cp.baseUsd ? 'chip' : 'chip idle';
    b.innerHTML = `${cp.name} <span class="chip-usd">${cp.baseUsd ? fmtUsd(cp.baseUsd) : '–'}</span>`;
    b.title = `${fmtUsd(cp.baseUsd)} a year of modelled container trade crosses ${cp.name} on its shortest route`;
    b.setAttribute('aria-pressed', String(!!cp.closed));
    b.addEventListener('click', () => toggle(cp, true));
    cp.chip = b;
    chipList.append(b);
  }
}
document.getElementById('reset').addEventListener('click', () => {
  CHOKEPOINTS.forEach((c) => { c.closed = false; });
  requestRoutes();
});

function toggle(cp, focus) {
  cp.closed = !cp.closed;
  if (focus) {
    pauseRotation();
    globe.pointOfView({ lat: cp.lat, lng: cp.lng, altitude: 2.3 }, 1200);
  }
  requestRoutes();
}

// ---------- routing (Web Worker) ----------
const worker = new Worker(new URL('./router.worker.js', import.meta.url), { type: 'module' });
let pending = 0;
function requestRoutes() {
  pending++;
  const closed = CHOKEPOINTS.flatMap((c, i) => (c.closed ? [i] : []));
  worker.postMessage({ type: 'route', closed });
  for (const cp of CHOKEPOINTS) {
    cp.el?.classList.toggle('closed', !!cp.closed);
    cp.chip?.setAttribute('aria-pressed', String(!!cp.closed));
    if (cp.el) cp.el.title = `${cp.closed ? 'Reopen' : 'Close'} ${cp.name}`;
  }
  globe.ringsData(CHOKEPOINTS.filter((c) => c.closed));
}

worker.onmessage = ({ data: msg }) => {
  if (msg.type !== 'routes') return;
  const isBaseline = msg.closed.length === 0 && !flows[0].base;
  if (isBaseline) {
    msg.routes.forEach((r, i) => applyRoute(flows[i], r, true));
    for (const cp of CHOKEPOINTS) cp.baseUsd = 0;
    for (const f of flows) for (const c of f.base?.cps ?? []) CHOKEPOINTS[c].baseUsd += f.usd;
    buildChips();
  } else {
    pending--;
    if (pending > 0) return; // a newer request is in flight; skip this stale answer
    msg.routes.forEach((r, i) => applyRoute(flows[i], r, false));
  }
  document.getElementById('route-ms').textContent = `${Math.round(msg.ms)} ms`;
  if (isBaseline) initPaths(); else pathEntries.forEach(restyle);
  renderStats();
};
worker.postMessage({ type: 'init', graph, flows: { ports, flows: flows.map(({ o, d }) => ({ o, d })) }, renderN: RENDER_N });

function applyRoute(f, r, isBaseline) {
  if (isBaseline) {
    f.base = r;
    f.route = r;
    f.blocked = !r;
    if (r && f.drawn) f.display = resample(r.coords, SAMPLES).map(([lat, lng]) => [lat, lng, LANE_ALT]);
    return;
  }
  f.blocked = !r;
  if (!r) { f.tween = null; return; } // keep the last drawn route, shown red as stranded
  if (f.drawn && r.key !== f.route?.key) {
    const to = resample(r.coords, SAMPLES);
    f.tween = { from: f.display.map(toVec), to: to.map(toVec), t0: performance.now() };
  }
  f.route = r;
}

function animate(now) {
  for (const f of drawn) {
    const tw = f.tween;
    if (!tw) continue;
    const t = Math.min(1, (now - tw.t0) / TWEEN_MS);
    const e = easeInOut(t);
    const lift = LANE_ALT + 0.07 * Math.sin(Math.PI * t); // routes lift off the surface mid-reroute
    f.display = tw.from.map((v, i) => [...slerpLatLng(v, tw.to[i], e), lift]);
    if (t === 1) f.tween = null;
    f.entries.forEach(writeLine);
  }
  tickCounters(now);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ---------- panel ----------
const counters = Object.fromEntries([
  ['days', fmtDays], ['cost', fmtUsd], ['rerouted', fmtUsd], ['stranded', fmtUsd],
].map(([k, fmt]) => [k, { el: document.getElementById(`kpi-${k}`), fmt, shown: 0, from: 0, to: 0, t0: 0 }]));
function setCounter(c, value) {
  if (value === c.to) return;
  c.from = c.shown;
  c.to = value;
  c.t0 = performance.now();
  c.el.classList.toggle('up', value > 0.0001);
}
function tickCounters(now) {
  for (const c of Object.values(counters)) {
    const t = Math.min(1, (now - c.t0) / 1400);
    c.shown = c.from + (c.to - c.from) * easeOut(t);
    c.el.textContent = c.fmt(c.shown);
  }
}

const affectedList = document.getElementById('affected-list');
function renderStats() {
  let rerouted = 0, stranded = 0, wDays = 0, cost = 0;
  const byPair = new Map();
  for (const f of flows) {
    if (!f.base) continue; // unreachable even with everything open (shouldn't happen)
    const p = byPair.get(f.pair) ?? { pair: pairs[f.pair], usd: 0, dCost: 0, wDays: 0, rerouted: 0, stranded: 0 };
    p.usd += f.usd;
    if (f.blocked) {
      stranded += f.usd;
      p.stranded += f.usd;
    } else if (f.route.key !== f.base.key) {
      const d = flowDelta(f.usd, { distanceNm: f.base.nm, chokepoints: f.base.cps }, { distanceNm: f.route.nm, chokepoints: f.route.cps });
      rerouted += f.usd;
      wDays += d.dDays * f.usd;
      cost += d.dCost;
      p.rerouted += f.usd;
      p.wDays += d.dDays * f.usd;
      p.dCost += d.dCost;
    }
    byPair.set(f.pair, p);
  }
  setCounter(counters.days, rerouted ? wDays / rerouted : 0);
  setCounter(counters.cost, cost);
  setCounter(counters.rerouted, rerouted);
  setCounter(counters.stranded, stranded);

  const hit = [...byPair.values()].filter((p) => p.rerouted || p.stranded)
    .sort((a, b) => (b.stranded - a.stranded) || (b.dCost - a.dCost)).slice(0, 8);
  affectedList.innerHTML = hit.length ? '' : '<p class="empty">Close a chokepoint to see which trade lanes it hits.</p>';
  for (const p of hit) {
    const row = document.createElement('div');
    row.className = `lane${p.stranded ? ' blocked' : ' rerouted'}`;
    row.style.setProperty('--lane', regionColor[iso(p.pair.exp)] ?? '#e2e8f0');
    const name = `${countries[p.pair.exp].name} → ${countries[p.pair.imp].name}`;
    row.innerHTML = p.stranded
      ? `<div class="title">${name}<span class="status">STRANDED</span></div>
         <div class="stats"><div><span>Trade/yr</span>${fmtUsd(p.usd)}</div><div><span>Stranded</span><b class="delta-up">${fmtUsd(p.stranded)}</b></div><div></div></div>`
      : `<div class="title">${name}<span class="status">REROUTED</span></div>
         <div class="stats"><div><span>Trade/yr</span>${fmtUsd(p.usd)}</div><div><span>Δ transit</span><b class="delta-up">${fmtDays(p.wDays / p.rerouted)}</b></div><div><span>Δ cost/yr</span><b class="delta-up">${fmtUsd(p.dCost)}</b></div></div>`;
    affectedList.append(row);
  }
}

// ---------- static panel content ----------
document.getElementById('legend').innerHTML = REGIONS
  .map(([name, color]) => `<span class="legend-item"><i style="background:${color}"></i>${name}</span>`).join('');

const penalties = chokepointPenaltiesNm();
document.getElementById('assumptions').innerHTML = Object.values(ASSUMPTIONS)
  .map((x) => `<li>${x.label}: ${x.fmt(x.value)}</li>`).join('')
  + CHOKEPOINTS.filter((c) => c.toll).map((c) => `<li>${c.name}: toll ${fmtUsd(c.toll)} + ${c.delayDays} d wait (routed as +${Math.round(penalties[CHOKEPOINTS.indexOf(c)])} nm)</li>`).join('')
  + '<li>Annual Δ cost = voyages (trade ÷ cargo value per voyage) × (Δ days × daily cost + Δ tolls)</li>';

document.getElementById('data-note').innerHTML = `
  UN Comtrade ${meta.period} imports, HS chapters ${meta.chapters.join(', ')} as a container proxy
  (${meta.reporters.withData}/${meta.reporters.queried} reporters loaded). Top ${meta.pairs} country pairs
  (${fmtUsd(meta.usd.kept)}/yr, of which ${ASSUMPTIONS.seaShare.value * 100}% is assumed seaborne) split across
  main gateway ports and routed over the Eurostat MARNET sea network.
  Trade inside land blocs (EU, USMCA, GCC…) is left out. Showing the ${RENDER_N} largest of ${meta.flows} port-to-port flows.`;
