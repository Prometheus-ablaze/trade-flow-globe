# Trade-Flow Globe

A rotating 3D globe (globe.gl / three.js) that shows container trade as animated routes along real sea
lanes. Click a chokepoint such as Suez, Panama or Hormuz to close it. Affected routes swing onto their
next-best path, and the panel tallies trade rerouted, added transit days, added annual cost and
stranded trade. See [PLAN.md](PLAN.md) for the full roadmap.

```bash
npm install
npm run dev
```

The generated data in `public/data/` is committed, so the app runs without any API keys.

## Data pipeline (Phase 1)

| Step | Script | Output |
|---|---|---|
| Fetch Comtrade imports by HS chapter (cached, resumable) | `npm run data:comtrade` | `data-raw/comtrade-cache/*.json` |
| Sea graph with chokepoint tags | `npm run data:graph` | `public/data/graph.json` |
| Country pairs → port-to-port flows | `npm run data:flows` | `public/data/flows.json` |
| Routing sanity checks | `npm run data:verify` | console |

`npm run data` runs the last three. The raw Comtrade cache (~40 MB) isn't committed, so run
`npm run data:comtrade` first if you need to rebuild `flows.json`. Third-party data terms are listed
in [NOTICE.md](NOTICE.md). The Comtrade fetch is keyless by default, using the public
preview API. Set `COMTRADE_KEY` (a free "comtrade – v1" subscription) to use the full API instead.

### Sources and choices

- **Trade:** UN Comtrade 2023 annual imports reported by the importer (CIF). HS chapters 39, 40,
  61, 62, 64, 73, 84, 85, 87, 90, 94 and 95 stand in for containerised trade. The top 400 country pairs are
  kept. Trade inside land blocs (EU, USMCA, GCC, China–HK, ASEAN core, Mercosur) is excluded because it
  moves mostly by road, rail or short-sea ferry. 70% of value is assumed seaborne, since air carries
  much of the electronics and instruments by value.
- **Ports:** a hand-curated table of the main container gateways per country with coast or gateway
  shares (`scripts/ports-config.mjs`), using UN/LOCODE coordinates. NGA's World Port Index has no
  throughput data, so it couldn't pick gateways reliably.
- **Sea network:** Eurostat SeaRoute `marnet_plus_100km` (EUPL-1.2), extracted from `searoute-ts`
  (MIT). Arctic passages are removed. Suez, Panama, Bab el-Mandeb, Malacca, Gibraltar and Dover use
  Eurostat's own passage tags. Hormuz, Sunda, Lombok, Taiwan, Bosporus and the Cape are thin "gate"
  boxes (`src/chokepoints.js`).
- **Routing:** Dijkstra on generalised cost. Canal tolls and queueing time are charged as extra
  distance, so when Suez closes Asia–Europe trade goes round the Cape, as it did in 2024, rather
  than through Panama. Routing runs in a Web Worker, taking about 150 ms for all flows.
- **Costs:** see `src/deltas.js`. These are model estimates from ship, fuel and inventory costs,
  not freight rates.
