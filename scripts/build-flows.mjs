// Comtrade cache + curated ports + sea graph -> public/data/flows.json
//   node scripts/build-flows.mjs [--period 2023] [--pairs 400]
// Reads every cached Comtrade response, so it also works on a partial download.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_PORTS, LAND_BLOCS, PORT_COORD_OVERRIDES } from './ports-config.mjs';
import { CONTAINER_CHAPTERS, REPORTERS } from './comtrade-config.mjs';
import { distanceNm } from '../src/router.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const period = arg('--period', '2023');
const MAX_PAIRS = Number(arg('--pairs', 400));

// ---- Comtrade rows, deduplicated across single- and two-chapter cache files ----
const cacheDir = path.join(ROOT, 'data-raw', 'comtrade-cache');
const values = new Map(); // "imp|exp|hs" -> usd
const reportersSeen = new Set();
for (const f of await readdir(cacheDir)) {
  if (!f.startsWith(`${period}-`)) continue;
  const json = JSON.parse(await readFile(path.join(cacheDir, f), 'utf8'));
  for (const d of json.data ?? []) {
    if (d.partnerCode === 0 || !CONTAINER_CHAPTERS.includes(d.cmdCode)) continue;
    reportersSeen.add(d.reporterCode);
    values.set(`${d.reporterCode}|${d.partnerCode}|${d.cmdCode}`, d.primaryValue);
  }
}

// ---- country pairs (exporter -> importer) ----
const bloc = new Map();
LAND_BLOCS.forEach((b, i) => b.forEach((iso) => bloc.set(iso, i)));
const pairs = new Map();
let droppedNoPort = 0, droppedLand = 0, totalUsd = 0;
for (const [key, usd] of values) {
  const [imp, exp, hs] = key.split('|').map(Number);
  totalUsd += usd;
  const ci = COUNTRY_PORTS[imp], ce = COUNTRY_PORTS[exp];
  if (!ci || !ce) { droppedNoPort += usd; continue; }
  if (bloc.has(ci.iso3) && bloc.get(ci.iso3) === bloc.get(ce.iso3)) { droppedLand += usd; continue; }
  const k = `${exp}|${imp}`;
  const p = pairs.get(k) ?? { exp, imp, usd: 0, hs: {} };
  p.usd += usd;
  p.hs[hs] = (p.hs[hs] ?? 0) + usd;
  pairs.set(k, p);
}
const seaUsd = [...pairs.values()].reduce((s, p) => s + p.usd, 0);
const kept = [...pairs.values()].sort((a, b) => b.usd - a.usd).slice(0, MAX_PAIRS);
const keptUsd = kept.reduce((s, p) => s + p.usd, 0);

// ---- ports, snapped to the nearest sea-graph node ----
const graph = JSON.parse(await readFile(path.join(ROOT, 'public', 'data', 'graph.json'), 'utf8'));
const locodes = JSON.parse(await readFile(path.join(ROOT, 'data-raw', 'unlocode-ports.json'), 'utf8'));
const nNodes = graph.coords.length / 2;
function nearestNode(lng, lat) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < nNodes; i++) {
    const d = distanceNm(lat, lng, graph.coords[2 * i + 1], graph.coords[2 * i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return [best, bestD];
}
const ports = [];
const portIdx = new Map();
function portIndex(code, m49) {
  if (!portIdx.has(code)) {
    const [lng, lat] = PORT_COORD_OVERRIDES[code] ?? locodes[code].coordinates;
    const [node, snapNm] = nearestNode(lng, lat);
    if (snapNm > 150) console.warn(`  ! ${code} snaps ${Math.round(snapNm)} nm to the sea graph`);
    portIdx.set(code, ports.length);
    ports.push({ code, name: locodes[code].name.replace(/\s*\(.*\)/, ''), country: m49, lat, lng, node });
  }
  return portIdx.get(code);
}

// ---- split each pair across its port combinations by share ----
const flows = [];
kept.forEach((p, pi) => {
  for (const [oc, os] of Object.entries(COUNTRY_PORTS[p.exp].ports)) {
    for (const [dc, ds] of Object.entries(COUNTRY_PORTS[p.imp].ports)) {
      const o = portIndex(oc, p.exp), d = portIndex(dc, p.imp);
      if (ports[o].node === ports[d].node) continue;
      flows.push({ o, d, usd: Math.round(p.usd * os * ds), pair: pi });
    }
  }
});
flows.sort((a, b) => b.usd - a.usd);

const countries = {};
for (const p of kept) for (const c of [p.exp, p.imp]) countries[c] = { iso3: COUNTRY_PORTS[c].iso3, name: COUNTRY_PORTS[c].name };

const out = {
  meta: {
    source: 'UN Comtrade (public preview API), imports reported by importer, CIF',
    period, chapters: CONTAINER_CHAPTERS,
    reporters: { queried: REPORTERS.length, withData: reportersSeen.size },
    usd: { allChapters: totalUsd, seaPairs: seaUsd, kept: keptUsd, droppedNoPort, droppedLandBloc: droppedLand },
    pairs: kept.length, flows: flows.length, ports: ports.length,
    built: new Date().toISOString().slice(0, 10),
  },
  countries,
  ports,
  pairs: kept.map((p) => ({
    exp: p.exp, imp: p.imp, usd: Math.round(p.usd),
    topHs: Object.entries(p.hs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h),
  })),
  flows,
};
await writeFile(path.join(ROOT, 'public', 'data', 'flows.json'), JSON.stringify(out));
const B = (v) => `$${(v / 1e9).toFixed(0)}B`;
console.log(`reporters with data: ${reportersSeen.size}/${REPORTERS.length}`);
console.log(`container-proxy trade ${B(totalUsd)} · deep-sea pairs ${B(seaUsd)} · kept top ${kept.length} pairs ${B(keptUsd)} (${(100 * keptUsd / seaUsd).toFixed(0)}%)`);
console.log(`dropped: no port mapping ${B(droppedNoPort)}, same land bloc ${B(droppedLand)}`);
console.log(`${ports.length} ports, ${flows.length} port-to-port flows`);
console.log('top pairs:', kept.slice(0, 8).map((p) => `${COUNTRY_PORTS[p.exp].iso3}->${COUNTRY_PORTS[p.imp].iso3} ${B(p.usd)}`).join(', '));
