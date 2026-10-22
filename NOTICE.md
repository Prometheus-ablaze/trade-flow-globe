# Third-party data and assets

This project bundles or derives files from the following sources. Their terms apply to those files.

| Files | Source | Terms |
|---|---|---|
| `data-raw/marnet_plus_100km.geojson`, `public/data/graph.json` (derived) | Eurostat SeaRoute maritime network `marnet_plus_100km`, https://github.com/eurostat/searoute, as packaged in `searoute-ts` 2.3.1 (https://github.com/mayurrawte/searoute-ts, MIT) | EUPL-1.2 |
| `data-raw/unlocode-ports.json`, port coordinates in `public/data/flows.json` | UN/LOCODE (UNECE) port list, as packaged in `searoute-ts` 2.3.1 | UNECE terms; packaging MIT |
| `public/data/flows.json` (trade values) | UN Comtrade, UN Statistics Division, https://comtradeplus.un.org/, 2023 annual imports by HS chapter | UN Comtrade terms of use; attribution required |
| `public/img/earth-night.jpg`, `earth-topology.png`, `night-sky.png` | Example textures from `three-globe` (https://github.com/vasturiano/three-globe, MIT). The Earth images derive from NASA imagery (Black Marble / Visible Earth) | NASA imagery: public domain; packaging MIT |
| Chokepoint identifiers in `src/chokepoints.js` | IMF PortWatch (https://portwatch.imf.org/) | IMF terms |
| Runtime libraries | globe.gl, three-globe, three.js | MIT |

Trade-derived figures, routes, transit times and costs shown by the app are model estimates. They aren't observed
shipping data or freight rates.
