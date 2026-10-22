// Routes every port-to-port flow over the sea graph for a given set of closed chokepoints.
// One Dijkstra per origin port covers all of that port's flows.
import { loadGraph, dijkstra, extractRoute, blockedMask } from './router.js';
import { chokepointPenaltiesNm } from './deltas.js';

let g, ports, flows, renderN;
const cache = new Map();

function solve(closed) {
  const key = [...closed].sort((a, b) => a - b).join(',');
  if (cache.has(key)) return cache.get(key);
  const mask = blockedMask(g, closed);
  const trees = new Map();
  const routes = flows.map((f, i) => {
    const o = ports[f.o], d = ports[f.d];
    if (!trees.has(o.node)) trees.set(o.node, dijkstra(g, o.node, mask));
    const r = extractRoute(g, trees.get(o.node), d.node);
    if (!r) return null;
    const out = { nm: r.distanceNm, cps: r.chokepoints, key: r.nodes.join() };
    if (i < renderN) {
      out.coords = [[o.lat, o.lng], ...r.nodes.map((n) => [g.lat[n], g.lng[n]]), [d.lat, d.lng]];
    }
    return out;
  });
  cache.set(key, routes);
  return routes;
}

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    g = loadGraph(data.graph, chokepointPenaltiesNm());
    ({ ports, flows } = data.flows);
    renderN = data.renderN;
    const t0 = performance.now();
    const routes = solve([]);
    self.postMessage({ type: 'routes', closed: [], routes, ms: performance.now() - t0 });
  } else if (data.type === 'route') {
    const t0 = performance.now();
    const routes = solve(data.closed);
    self.postMessage({ type: 'routes', closed: data.closed, routes, ms: performance.now() - t0 });
  }
};
