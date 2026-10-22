// Shortest sea routes over the compact MARNET graph written by scripts/build-graph.mjs.
// Shared by the browser worker and the Node verification script, so it has no DOM or Node imports.

const R_NM = 3440.065;
const RAD = Math.PI / 180;

export function distanceNm(lat1, lng1, lat2, lng2) {
  const a = Math.sin((lat2 - lat1) * RAD / 2) ** 2
    + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lng2 - lng1) * RAD / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.sqrt(a));
}

// graph.json: { coords: [lng, lat, ...], edges: [a, b, ...], edgeCp: { edgeIndex: [chokepointIndex] } }
// penaltyNm[c] is added once per transit of chokepoint c (spread over the edges it tags), so routes
// minimise generalised cost while `distanceNm` stays physical distance.
export function loadGraph(json, penaltyNm = []) {
  const n = json.coords.length / 2;
  const m = json.edges.length / 2;
  const lng = new Float64Array(n), lat = new Float64Array(n);
  for (let i = 0; i < n; i++) { lng[i] = json.coords[2 * i]; lat[i] = json.coords[2 * i + 1]; }

  const cpEdgeCount = {};
  for (const cps of Object.values(json.edgeCp)) for (const c of cps) cpEdgeCount[c] = (cpEdgeCount[c] ?? 0) + 1;
  const edgePenalty = (e) => (json.edgeCp[e] ?? []).reduce((s, c) => s + (penaltyNm[c] ?? 0) / cpEdgeCount[c], 0);

  // CSR adjacency, each undirected edge stored in both directions
  const deg = new Int32Array(n + 1);
  for (let e = 0; e < m; e++) { deg[json.edges[2 * e]]++; deg[json.edges[2 * e + 1]]++; }
  const offset = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) offset[i + 1] = offset[i] + deg[i];
  const fill = offset.slice(0, n);
  const target = new Int32Array(2 * m), weight = new Float64Array(2 * m), edgeOf = new Int32Array(2 * m);
  const length = new Float64Array(m);
  for (let e = 0; e < m; e++) {
    const a = json.edges[2 * e], b = json.edges[2 * e + 1];
    length[e] = distanceNm(lat[a], lng[a], lat[b], lng[b]);
    const w = length[e] + edgePenalty(e);
    target[fill[a]] = b; weight[fill[a]] = w; edgeOf[fill[a]++] = e;
    target[fill[b]] = a; weight[fill[b]] = w; edgeOf[fill[b]++] = e;
  }

  const cpEdges = {}; // chokepoint index -> edge indices it cuts
  const edgeCp = new Map();
  for (const [e, cps] of Object.entries(json.edgeCp)) {
    edgeCp.set(Number(e), cps);
    for (const c of cps) (cpEdges[c] ??= []).push(Number(e));
  }
  return { n, m, lng, lat, offset, target, weight, edgeOf, length, edgeCp, cpEdges };
}

export function blockedMask(g, closedCpIdx) {
  const mask = new Uint8Array(g.m);
  for (const c of closedCpIdx) for (const e of g.cpEdges[c] ?? []) mask[e] = 1;
  return mask;
}

// Single-source Dijkstra with a binary heap. Returns distances and the predecessor slot per node.
export function dijkstra(g, src, mask) {
  const dist = new Float64Array(g.n).fill(Infinity);
  const prevSlot = new Int32Array(g.n).fill(-1);
  const heapN = [], heapD = [];
  const push = (node, d) => {
    let i = heapN.length;
    heapN.push(node); heapD.push(d);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapD[p] <= d) break;
      heapN[i] = heapN[p]; heapD[i] = heapD[p]; i = p;
    }
    heapN[i] = node; heapD[i] = d;
  };
  const pop = () => {
    const top = heapN[0], topD = heapD[0];
    const lastN = heapN.pop(), lastD = heapD.pop();
    if (heapN.length) {
      let i = 0;
      const len = heapN.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= len) break;
        if (c + 1 < len && heapD[c + 1] < heapD[c]) c++;
        if (heapD[c] >= lastD) break;
        heapN[i] = heapN[c]; heapD[i] = heapD[c]; i = c;
      }
      heapN[i] = lastN; heapD[i] = lastD;
    }
    return [top, topD];
  };

  dist[src] = 0;
  push(src, 0);
  while (heapN.length) {
    const [u, d] = pop();
    if (d > dist[u]) continue;
    for (let s = g.offset[u]; s < g.offset[u + 1]; s++) {
      if (mask && mask[g.edgeOf[s]]) continue;
      const v = g.target[s], nd = d + g.weight[s];
      if (nd < dist[v]) { dist[v] = nd; prevSlot[v] = s; push(v, nd); }
    }
  }
  return { dist, prevSlot, src };
}

// Walk predecessors back from `to`. Returns null when unreachable.
export function extractRoute(g, tree, to) {
  if (!Number.isFinite(tree.dist[to])) return null;
  const nodes = [to];
  const cps = [];
  let v = to, nm = 0;
  while (v !== tree.src) {
    const s = tree.prevSlot[v];
    const e = g.edgeOf[s];
    nm += g.length[e];
    for (const c of g.edgeCp.get(e) ?? []) if (!cps.includes(c)) cps.unshift(c);
    // the slot belongs to the predecessor's adjacency list; find which node owns it
    v = ownerOfSlot(g, s);
    nodes.push(v);
  }
  nodes.reverse();
  return { nodes, distanceNm: nm, cost: tree.dist[to], chokepoints: cps }; // chokepoints in travel order
}

function ownerOfSlot(g, s) {
  let lo = 0, hi = g.n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (g.offset[mid] <= s) lo = mid; else hi = mid - 1;
  }
  return lo;
}
