// Reroute cost model (PLAN.md §4). Every constant is an editable estimate, not observed data.
import { CHOKEPOINTS } from './chokepoints.js';

export const ASSUMPTIONS = {
  // Comtrade values don't say how goods moved; air carries a big share of electronics/instruments by value.
  seaShare: { value: 0.7, label: 'Share of goods value moving by sea', fmt: (v) => `${v * 100}%` },
  speedKn: { value: 14, label: 'Service speed', fmt: (v) => `${v} kn (slow steaming)` },
  burnTPerDay: { value: 120, label: 'Fuel burn', fmt: (v) => `${v} t/day` },
  bunkerUsdPerT: { value: 620, label: 'VLSFO price', fmt: (v) => `$${v}/t` },
  charterUsdPerDay: { value: 55_000, label: 'Charter rate', fmt: (v) => `$${(v / 1000).toFixed(0)}k/day` },
  cargoValueUsd: { value: 400_000_000, label: 'Cargo value per voyage', fmt: (v) => `$${v / 1e6}M` },
  carryRate: { value: 0.12, label: 'Inventory carrying cost', fmt: (v) => `${v * 100}%/yr` },
};

const a = (k) => ASSUMPTIONS[k].value;
const nmPerDay = () => a('speedKn') * 24;

// Cost of one extra day at sea for one voyage: ship + fuel + the cargo's tied-up capital.
export function costPerVoyageDay() {
  return a('burnTPerDay') * a('bunkerUsdPerT') + a('charterUsdPerDay') + (a('cargoValueUsd') * a('carryRate')) / 365;
}

// Toll + queueing expressed as equivalent sailing distance, so the router trades them off against detours.
export function chokepointPenaltiesNm() {
  return CHOKEPOINTS.map((c) => (c.toll / costPerVoyageDay() + c.delayDays) * nmPerDay());
}

// route: { distanceNm, chokepoints: [index] }
export function routeDays(route) {
  return route.distanceNm / nmPerDay() + route.chokepoints.reduce((s, c) => s + CHOKEPOINTS[c].delayDays, 0);
}
const routeTolls = (route) => route.chokepoints.reduce((s, c) => s + CHOKEPOINTS[c].toll, 0);

// Annual extra cost for a flow worth `usd` a year moving from route `base` to route `now`.
export function flowDelta(usd, base, now) {
  const dDays = routeDays(now) - routeDays(base);
  const voyages = usd / a('cargoValueUsd');
  return { dDays, dCost: voyages * (dDays * costPerVoyageDay() + routeTolls(now) - routeTolls(base)) };
}
