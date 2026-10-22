# Trade-Flow Globe: Build Plan

A 3D globe that rotates on its own and shows container trade as animated arcs that follow real sea lanes. Click a chokepoint (Suez, Panama, Hormuz and others) to close it. The affected arcs then move to the next-best route, and counters for added transit time and added cost tick up.

*Plan written 2026-10-22. The data-source checks below were run live on that date.*

---

## 1. Fork God's Eye View or start fresh?

**Recommendation: start a fresh repo and copy GEV's patterns, not its code.** Fork it later only if you want this to ship as a GEV layer.

| | Fork GEV | Fresh three.js app (recommended) |
|---|---|---|
| Renderer | CesiumJS (photoreal 3D tiles, terrain) | three.js via **globe.gl / three-globe**, which has arcs, paths, points and rings built in |
| Fit for "arcs that reroute" | Cesium polylines work, but you'd be working against an OSINT cockpit app | Arcs and paths are first-class, and the custom shader for flowing arcs is simple |
| Size | Large: voice agent, about 20 layers, key-setup UI, scene director | Small, so you understand all of it |
| License | MIT, so you can copy freely with attribution | n/a |
| What we reuse | The patterns listed below | The same patterns, rewritten in about 200 lines |

The GEV ideas worth copying (from its README, "Under the Hood"):

1. **A server-side proxy for keyed APIs.** AISStream and Comtrade keys never reach the browser. GEV's server brokers every private key and adds response caps and SSRF protection.
2. **Render one interval behind real time and interpolate.** AIS fixes arrive every 15–30 s, so GEV interpolates between known fixes and uses dead reckoning to fill gaps. Ships glide instead of jumping.
3. **World-stable heading icons.** Ship glyphs point along their real course over ground at every camera angle (GEV's `src/data/iconOrientation.js`).
4. **One module per data layer** plus an orchestrator (`src/data/`). Use the same layout here: `comtrade`, `portwatch`, `ais`, `routing`.
5. **Request budgets and disk caching.** GEV uses an OpenSky credit governor and disk-cached TLEs. Here, Comtrade's free tier allows 500 calls/day, so cache everything.
6. **Honest provenance.** GEV labels stale feeds and estimates. Do the same, because reroute costs here are modelled, not observed.

**When forking is the better choice:** if what you want most is photoreal Earth plus GEV's existing live ships layer, build this as a new GEV layer under `src/layers/tradeFlows/` and open a PR upstream. Phase 6 covers that port.

---

## 2. Data sources (all free)

| Need | Source | Access | Notes |
|---|---|---|---|
| Who trades what with whom ($) | **UN Comtrade API** (`comtradeapi.un.org`) | Free key, "comtrade – v1" product. Reported limits are 500 calls/day and up to 100k rows/call. Without a key, 500 rows/call | Annual or monthly values for reporter→partner by HS code. Pull once and cache it; this data isn't live |
| Chokepoint traffic, live-ish | **IMF PortWatch**, ArcGIS FeatureServer `Daily_Chokepoints_Data` | **No key.** Verified 2026-10-22 | Daily `n_container`, `capacity_container` (DWT), `n_tanker`, `n_total` for 28 chokepoints. Latest row was 2026-10-18, a lag of about 4 days |
| Live ships | **AISStream.io** WebSocket `wss://stream.aisstream.io/v0/stream` | Free key. One socket per key | Subscribe with bounding boxes around each chokepoint. It is mostly terrestrial AIS, so coverage drops mid-ocean |
| Ports | NGA **World Port Index** (public domain) or UN/LOCODE | Static download | Map each country to its top 1–3 container ports |
| Sea-lane network | **Eurostat SeaRoute / MARNET** graph (`searoute` npm or Python ports) | Static | A maritime graph with chokepoint passages as edges. This is the key piece for rerouting |
| Basemap | NASA Blue Marble or Black Marble textures, Natural Earth borders | Static | No keys needed |

PortWatch chokepoint IDs (confirmed from the live service):

```
chokepoint1  Suez Canal          chokepoint5  Malacca Strait
chokepoint2  Panama Canal        chokepoint6  Strait of Hormuz
chokepoint3  Bosporus Strait     chokepoint7  Cape of Good Hope
chokepoint4  Bab el-Mandeb       chokepoint8  Gibraltar Strait
chokepoint9  Dover   10 Oresund   11 Taiwan   12 Korea   ... through 28 Kerch
```

Sample query (no key):

```
https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query
  ?where=portid='chokepoint1'&outFields=date,n_container,capacity_container,n_total
  &orderByFields=date DESC&resultRecordCount=30&f=json
```

### What each source can and can't tell us

- **Comtrade has no shipping lanes and no reliable container flag.** It gives country-pair values by HS code, so we infer the route (§3) and use HS chapters as a container proxy. Manufactured goods such as HS 39, 61–64, 84, 85, 87, 94 and 95 go by container; bulk such as HS 26, 27 and 10 does not. Drop land-border pairs (US–MX, US–CA, intra-EU overland) or flag them.
- **AIS can't reliably tell a container ship from other cargo ships.** Type codes 70–79 all mean "cargo". PortWatch's own vessel classification is the best container signal. Use AIS for the visual "live ships here now" layer and PortWatch for counts.
- **Reroute costs are model estimates.** Show the formula in the UI (§4).

---

## 3. Core idea: a flow graph with removable chokepoints

```
Comtrade (pair, HS, $) ──► container-proxy filter ──► top-N country pairs by $
                                                   │
World Port Index ──► country → main port(s) ───────┤
                                                   ▼
MARNET sea graph ──► shortest sea path per pair ──► polyline + list of chokepoints crossed
                                                   │
          user closes chokepoint X ──► remove X's edges ──► recompute only pairs that used X
                                                   │
                         Δdistance → Δdays → Δcost ──► animate arc morph + tick counters
```

- **Precompute at build time** (Node script): for the top ~300–500 country pairs, compute the baseline route and the alternative route **for each single-chokepoint closure**. That is about 500 × 10 closures, which is small, and it lets clicks respond instantly with no server work.
- **Multi-closure** (Suez *and* Panama): compute at runtime in a Web Worker running Dijkstra on the MARNET graph, which has about 10k nodes and finishes in milliseconds.
- **Arc rendering:** draw sea-lane polylines as flowing particle "comets" along the path (globe.gl `pathsData` with dash animation), not great-circle arcs. Great circles cross continents. Use great-circle `arcsData` only for a high-level "who trades with whom" overview mode.
- **Rerouting animation:** for affected flows, resample old and new paths to the same point count and tween between them over 1.5 s. Turn the closed chokepoint red with a pulsing ring, and briefly thicken the alternative lane (for example, the Cape of Good Hope lights up).

---

## 4. Delta model (shown in the UI)

Per affected flow `f` with annual value `V_f`, number of voyages `n_f ≈ V_f / (avg TEU value × TEU per ship)` and extra distance `Δd_f` in nautical miles:

```
Δdays_f   = Δd_f / (speed_kn × 24)                          speed ≈ 14 kn (slow steaming)
Δfuel_$   = Δdays_f × burn_t_per_day × bunker_$_per_t        ~100–150 t/day, VLSFO ~$600/t (configurable)
Δcharter_$= Δdays_f × charter_$_per_day                       ~$40–60k/day for an 8–14k TEU ship (configurable)
Δtoll_$   = −canal_toll   (a skipped canal saves its toll; Suez ~$400–700k per large boxship)
Δinventory= V_f × annual_carry_rate (~12%) × Δdays_f / 365
Δcost     = n_f × (Δfuel + Δcharter + Δtoll) + Δinventory
```

The headline counters:
- **Weighted Δ transit days** across affected trade value
- **Annualized Δ cost ($)**, ticking up from 0 with an easing count
- **Trade at risk ($)**: the share of total value that passed through the closed chokepoint
- **Live strip from PortWatch**: container transits at that chokepoint, last 30 days vs the 2023 baseline. This links the model to reality; the Red Sea crisis drop in Suez traffic should be visible.

All constants go in a "Model assumptions" drawer with sliders. Ship the defaults with source notes.

Sanity check: Shanghai→Rotterdam via Suez is about 10,500 nm, and via the Cape about 14,000 nm. That's +3,500 nm ≈ **+10.4 days at 14 kn**. Real-world reports from the 2024 Red Sea diversions said +10–14 days, so the model is in range.

---

## 5. Architecture

```
trade-flow-globe/
├── server/                     # Node (Fastify or Express): the GEV-style key broker
│   ├── ais.js                  # one upstream AISStream socket → fan-out to browsers via SSE/WS,
│   │                           #   bbox = chokepoint boxes, keeps last fix per MMSI, drops stale
│   ├── portwatch.js            # proxies and caches PortWatch for 6 h (keyless, but be polite)
│   └── comtrade.js             # build-time only, key in .env
├── scripts/
│   ├── fetch-comtrade.mjs      # pull top partners × container-HS chapters → data/flows.json
│   ├── build-ports.mjs         # WPI → data/ports.json (country → main ports)
│   └── build-routes.mjs        # MARNET routing → data/routes.json (baseline + per-closure alts)
├── src/
│   ├── main.js                 # globe.gl setup, auto-rotate, stars, atmosphere
│   ├── layers/
│   │   ├── flows.js            # animated sea-lane paths (width ∝ value, color by region)
│   │   ├── chokepoints.js      # clickable markers + rings, open/closed state
│   │   ├── ships.js            # AIS points, interpolated, heading-oriented
│   │   └── overview-arcs.js    # optional great-circle "who trades with whom" mode
│   ├── sim/
│   │   ├── router.worker.js    # Dijkstra on MARNET for multi-closure
│   │   └── deltas.js           # §4 cost model
│   └── ui/                     # counters, assumptions drawer, PortWatch sparkline, legend
└── data/                       # generated JSON, committed so the app runs keyless
```

Stack: **Vite + vanilla JS (or TS) + globe.gl** (three.js). This matches GEV's "no framework" approach. Use **d3-scale** and **d3-ease** for counters and color, and **graphology** (or a hand-rolled binary heap) for Dijkstra.

Keyless-first, as in GEV: the committed `data/*.json` plus PortWatch means the app works with **no keys at all**. AISStream is an optional add-on for live ships.

---

## 6. Phases

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Spike** (½ day) | globe.gl globe, auto-rotate, 8 hard-coded chokepoints, one hand-drawn Shanghai→Rotterdam lane | You can click Suez and the lane snaps to the Cape |
| **1. Data pipeline** (1–2 days) | `fetch-comtrade`, `build-ports`, `build-routes` → `flows.json`, `routes.json` | Top ~300 container-proxy pairs each have a baseline route and per-chokepoint alternatives. Spot-check 10 routes on the globe |
| **2. Flow rendering** (1 day) | Animated sea-lane particles, width ∝ $, hover tooltip (pair, $, HS mix, chokepoints crossed) | Steady 60 fps with about 500 paths on a laptop GPU |
| **3. Closure + deltas** (1–2 days) | Click to close/open, path tweening, §4 model, ticking counters, assumptions drawer, multi-closure via worker | Closing Suez gives roughly +10 days on Asia–Europe, and closing Panama moves US East Coast–Asia traffic toward Suez or the Cape |
| **4. PortWatch live strip** (½ day) | Server proxy and cache, 30-day sparkline in the chokepoint panel, "data as of" stamp | Shows real container transits with the lag labelled |
| **5. AIS live ships** (1–2 days) | Server-side AISStream fan-out, interpolation and dead reckoning, heading glyphs near chokepoints | Ships glide through Suez and Malacca without jitter. Disconnects auto-reconnect |
| **6. Polish / optional GEV port** | Shareable URL state (closed chokepoints, camera), scenario presets ("Red Sea 2024", "Panama drought 2023"), and optionally a port to a GEV layer | Presets reproduce known historical diversions |

About 7–10 working days for one developer to finish phases 0–5.

### Status (2026-10-22)

- **Phase 0: done.** globe.gl globe, clickable chokepoints, path morphing, ticking counters.
- **Phase 1: done**, with these departures from the plan:
  - **Ports:** a curated gateway table with coast shares instead of the NGA World Port Index (WPI has no throughput data).
  - **Routing cost:** routing minimises generalised cost (distance + canal toll + queueing). Without this, Suez closures sent Asia–Europe trade via Panama.
  - **Runtime routing:** all routing runs in a Web Worker (~150 ms for ~1,150 flows), so no per-closure precompute is needed.
  - **Comtrade fetch:** the keyless Comtrade preview needs grouped calls (6 reporters × 1 chapter, partners filtered to mapped countries) to stay under 500 rows per call.
  - **Seaborne share:** a seaborne share (70%) is applied, because Comtrade values include air freight.
  - **Rendering:** globe.gl rebuilds every path on `pathsData` changes (~0.4 ms each), so reroute animations write Line2 geometry directly.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| The Comtrade free tier (500 calls/day) is too small for HS × pair × month | Pull annual data at HS-2 chapter level for the top ~60 reporters: ~60 calls. Cache to disk and commit the result |
| Reported limits drift (they came from third-party docs, not the official page) | Check `uncomtrade.org/docs/subscriptions/` when creating the key |
| MARNET routes don't match real liner services | Accept this for v1 and label the routes "indicative". Later, weight edges using PortWatch transit capacity |
| AISStream gaps mid-ocean or rate limits | Only subscribe near chokepoints. Show "live ships: N in view" and never pretend to show global coverage |
| PortWatch schema or URL changes | Isolate it in `server/portwatch.js` and fall back to the last cached JSON |
| Too many paths hurt fps | Merge flows that share a lane into a single "corridor" with summed width, and cap particles |

---

## 8. First commands (phase 0)

```bash
npm create vite@latest trade-flow-globe -- --template vanilla
```

```bash
npm i globe.gl d3-scale d3-ease
```

Then in `src/main.js`: create `Globe()` with Blue Marble textures, `controls().autoRotate = true`, `pointsData(chokepoints)` with `onPointClick` toggling a `closed` flag, and `pathsData([lane])` with `pathDashAnimateTime`. Phase 1 replaces the hard-coded lane with `routes.json`.

---

**Sources**
- God's Eye View: https://github.com/bilawalsidhu/gods-eye-view (MIT, CesiumJS + Vite, AISStream via server proxy)
- IMF PortWatch Daily Chokepoints: https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer (queried live) · FAQ https://portwatch.imf.org/pages/faqs
- Comtrade limits as reported by comtradr: https://docs.ropensci.org/comtradr/articles/large_data.html · official page https://uncomtrade.org/docs/subscriptions/
- AISStream API summary: https://apis.apievangelist.com/store/aisstream-ais-stream-api/
