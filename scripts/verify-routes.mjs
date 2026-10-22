// Sanity-checks routing on the built graph: known lanes, known diversions, known blockages.
//   node scripts/verify-routes.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraph, dijkstra, extractRoute, blockedMask, distanceNm } from '../src/router.js';
import { CHOKEPOINTS } from '../src/chokepoints.js';
import { chokepointPenaltiesNm } from '../src/deltas.js';
import { PORT_COORD_OVERRIDES } from './ports-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const g = loadGraph(JSON.parse(await readFile(path.join(ROOT, 'public', 'data', 'graph.json'), 'utf8')), chokepointPenaltiesNm());
const LOCODES = JSON.parse(await readFile(path.join(ROOT, 'data-raw', 'unlocode-ports.json'), 'utf8'));
for (const [k, c] of Object.entries(PORT_COORD_OVERRIDES)) LOCODES[k].coordinates = c;

function nearestNode([lng, lat]) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < g.n; i++) {
    const d = distanceNm(lat, lng, g.lat[i], g.lng[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
const cpIdx = (name) => CHOKEPOINTS.findIndex((c) => c.name.startsWith(name));

const CASES = [
  // [from, to, closed, expect: { via?: [...], notVia?: [...], nm?: [min, max], blocked?: true }]
  ['CNSHA', 'NLRTM', [], { via: ['Malacca', 'Bab', 'Suez', 'Gibraltar'], nm: [10000, 11000] }],
  ['CNSHA', 'NLRTM', ['Suez'], { via: ['Cape'], notVia: ['Suez'], nm: [13500, 14800] }],
  ['CNSHA', 'NLRTM', ['Bab'], { via: ['Cape'], notVia: ['Suez'] }],
  ['CNSHA', 'NLRTM', ['Malacca'], { notVia: ['Malacca'], via: ['Suez'] }],
  ['CNSHA', 'NLRTM', ['Malacca', 'Sunda'], { via: ['Lombok', 'Suez'] }],
  ['CNSHA', 'USNYC', [], { via: ['Panama'], nm: [10000, 11200] }],
  ['CNSHA', 'USNYC', ['Panama'], { notVia: ['Panama'] }],
  ['CNSHA', 'USNYC', ['Panama', 'Suez'], { notVia: ['Panama', 'Suez'] }],
  ['AEJEA', 'NLRTM', [], { via: ['Strait of Hormuz', 'Suez'] }],
  ['AEJEA', 'NLRTM', ['Strait of Hormuz'], { blocked: true }],
  ['KRPUS', 'USLAX', [], { via: [] }],
  ['CNYTN', 'CNTAO', [], { via: ['Taiwan'] }],
  ['CNYTN', 'CNTAO', ['Taiwan'], { notVia: ['Taiwan'] }],
  ['TRAMB', 'CNSHA', [], { via: ['Suez'], notVia: ['Bosporus'] }],
  ['DEHAM', 'CNSHA', ['Dover'], { notVia: ['Dover'] }],
  ['DEHAM', 'USNYC', [], { notVia: ['Gibraltar', 'Panama'] }],
];

let fail = 0;
for (const [from, to, closed, expect] of CASES) {
  const mask = blockedMask(g, closed.map(cpIdx));
  const r = extractRoute(g, dijkstra(g, nearestNode(LOCODES[from].coordinates), mask), nearestNode(LOCODES[to].coordinates));
  const names = r ? r.chokepoints.map((c) => CHOKEPOINTS[c].name) : [];
  const has = (s) => names.some((n) => n.startsWith(s));
  const problems = [];
  if (expect.blocked && r) problems.push('expected blocked');
  if (!expect.blocked && !r) problems.push('unexpectedly blocked');
  if (r) {
    for (const v of expect.via ?? []) if (!has(v)) problems.push(`missing ${v}`);
    for (const v of expect.notVia ?? []) if (has(v)) problems.push(`should avoid ${v}`);
    if (expect.via?.length === 0 && names.length) problems.push('expected no chokepoints');
    if (expect.nm && (r.distanceNm < expect.nm[0] || r.distanceNm > expect.nm[1])) problems.push(`distance ${Math.round(r.distanceNm)} outside ${expect.nm}`);
  }
  if (problems.length) fail++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${from}->${to} closed[${closed.join(',')}] `
    + (r ? `${Math.round(r.distanceNm)} nm via ${names.join(' > ') || '-'}` : 'NO ROUTE')
    + (problems.length ? `  <-- ${problems.join('; ')}` : ''));
}
process.exitCode = fail ? 1 : 0;
