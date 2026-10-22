// MARNET GeoJSON -> public/data/graph.json: a compact node/edge list tagged with the chokepoints
// each edge passes through.
//   node scripts/build-graph.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHOKEPOINTS } from '../src/chokepoints.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const geo = JSON.parse(await readFile(path.join(ROOT, 'data-raw', 'marnet_plus_100km.geojson'), 'utf8'));

// Arctic routes aren't viable for container liners.
const SKIP_PASSES = new Set(['northwest', 'northeast']);

const ids = new Map();
const coords = [];
const nodeId = ([lng, lat]) => {
  if (lng === 180) lng = -180; // the network is split at the antimeridian; join both sides
  const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  if (!ids.has(key)) { ids.set(key, coords.length / 2); coords.push(+lng.toFixed(5), +lat.toFixed(5)); }
  return ids.get(key);
};

// Liang-Barsky segment vs box test; a thin gate can fall between two vertices of a long edge.
function crossesBox([x0, y0], [x1, y1], [minX, minY, maxX, maxY]) {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy], q = [x0 - minX, maxX - x0, y0 - minY, maxY - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

const edges = [];
const edgeCp = {};
const seen = new Set();
let skipped = 0;
for (const f of geo.features) {
  const pass = f.properties?.pass;
  if (SKIP_PASSES.has(pass)) { skipped++; continue; }
  const line = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const pts of line) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = nodeId(pts[i]), b = nodeId(pts[i + 1]);
      if (a === b) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // segments spanning the antimeridian would make the box test sweep the whole globe
      const wraps = Math.abs(pts[i][0] - pts[i + 1][0]) > 180;
      const cps = CHOKEPOINTS.flatMap((c, ci) => (
        (c.pass && c.pass === pass) || (!wraps && c.gates?.some((bx) => crossesBox(pts[i], pts[i + 1], bx))) ? [ci] : []
      ));
      if (cps.length) edgeCp[edges.length / 2] = cps;
      edges.push(a, b);
    }
  }
}

// Keep only the largest connected component (drops lakes and stray fragments).
const n = coords.length / 2;
const parent = Int32Array.from({ length: n }, (_, i) => i);
const find = (x) => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
for (let e = 0; e < edges.length; e += 2) parent[find(edges[e])] = find(edges[e + 1]);
const size = new Map();
for (let i = 0; i < n; i++) size.set(find(i), (size.get(find(i)) ?? 0) + 1);
const main = [...size.entries()].sort((x, y) => y[1] - x[1])[0][0];

const remap = new Int32Array(n).fill(-1);
const outCoords = [];
for (let i = 0; i < n; i++) if (find(i) === main) { remap[i] = outCoords.length / 2; outCoords.push(coords[2 * i], coords[2 * i + 1]); }
const outEdges = [], outEdgeCp = {};
for (let e = 0; e < edges.length / 2; e++) {
  const a = remap[edges[2 * e]], b = remap[edges[2 * e + 1]];
  if (a < 0 || b < 0) continue;
  if (edgeCp[e]) outEdgeCp[outEdges.length / 2] = edgeCp[e];
  outEdges.push(a, b);
}

const perCp = CHOKEPOINTS.map((c, ci) => `${c.name}: ${Object.values(outEdgeCp).filter((l) => l.includes(ci)).length}`);
await mkdir(path.join(ROOT, 'public', 'data'), { recursive: true });
await writeFile(path.join(ROOT, 'public', 'data', 'graph.json'), JSON.stringify({
  source: geo.properties?.source,
  coords: outCoords, edges: outEdges, edgeCp: outEdgeCp,
}));
console.log(`graph: ${outCoords.length / 2} nodes, ${outEdges.length / 2} edges (dropped ${n - outCoords.length / 2} off-component nodes, ${skipped} arctic features)`);
console.log(`edges cut per chokepoint -> ${perCp.join(' · ')}`);
