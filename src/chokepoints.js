// Closable chokepoints. `id` matches IMF PortWatch (Daily_Chokepoints_Data.portid).
// A chokepoint cuts every MARNET edge tagged with its Eurostat `pass` label, or every edge that
// crosses one of its gate boxes [minLng, minLat, maxLng, maxLat]. Gates are thin lines drawn across
// the passage, so they cut through-traffic without touching neighbouring straits.
// `toll` is a rough per-transit canal fee for a large container ship (saved when the canal is skipped).
// `delayDays` is typical queueing/convoy time. Routing charges toll + delay as extra distance, which is
// why Asia-Europe traffic diverts round the Cape rather than via Panama when Suez shuts (as in 2024).
export const CHOKEPOINTS = [
  { id: 'chokepoint1', name: 'Suez Canal', lat: 30.6, lng: 32.34, pass: 'suez', toll: 500_000, delayDays: 0.5 },
  { id: 'chokepoint2', name: 'Panama Canal', lat: 9.1, lng: -79.7, pass: 'panama', toll: 450_000, delayDays: 1 },
  { id: 'chokepoint6', name: 'Strait of Hormuz', lat: 26.55, lng: 56.45, gates: [[55.9, 26.0, 57.0, 27.2]] },
  { id: 'chokepoint4', name: 'Bab el-Mandeb', lat: 12.6, lng: 43.35, pass: 'babelmandeb' },
  { id: 'chokepoint5', name: 'Malacca Strait', lat: 2.6, lng: 101.3, pass: 'malacca' },
  { id: 'chokepoint19', name: 'Sunda Strait', lat: -6.1, lng: 105.8, gates: [[105.4, -6.7, 106.3, -5.7]] },
  { id: 'chokepoint15', name: 'Lombok Strait', lat: -8.75, lng: 115.85, gates: [[115.6, -9.2, 116.1, -8.3]] },
  { id: 'chokepoint11', name: 'Taiwan Strait', lat: 24.0, lng: 119.4, gates: [[117.6, 23.9, 120.6, 24.1]] },
  { id: 'chokepoint8', name: 'Gibraltar Strait', lat: 35.95, lng: -5.6, pass: 'gibraltar' },
  { id: 'chokepoint9', name: 'Dover Strait', lat: 51.0, lng: 1.45, pass: 'dover' },
  { id: 'chokepoint3', name: 'Bosporus Strait', lat: 41.1, lng: 29.05, gates: [[28.9, 40.95, 29.25, 41.35]] },
  // A meridian line from Cape Agulhas toward Antarctica: anything rounding southern Africa crosses it.
  { id: 'chokepoint7', name: 'Cape of Good Hope', lat: -34.6, lng: 18.5, gates: [[19.95, -75, 20.05, -34.7]] },
].map((c) => ({ toll: 0, delayDays: 0, ...c }));
