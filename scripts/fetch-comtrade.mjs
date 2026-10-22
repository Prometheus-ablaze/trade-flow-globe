// Pulls annual imports by HS chapter from UN Comtrade for the major importers and caches every
// response under data-raw/comtrade-cache/ (build-flows.mjs reads the cache directly).
//
//   node scripts/fetch-comtrade.mjs [--period 2023]
//
// Only partners we can map to a port are requested. Keyless mode uses the public preview endpoint,
// which caps a call at 500 rows, so each call covers one HS chapter for a group of 6 reporters
// (~6 × 62 partners). With COMTRADE_KEY set (free "comtrade - v1" subscription) each call covers
// one reporter and every chapter. Re-runs skip reporter/chapter combinations already cached.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPORTERS, CONTAINER_CHAPTERS } from './comtrade-config.mjs';
import { COUNTRY_PORTS } from './ports-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'data-raw', 'comtrade-cache');
const period = process.argv.includes('--period') ? process.argv[process.argv.indexOf('--period') + 1] : '2023';
const KEY = process.env.COMTRADE_KEY;
const GROUP = 6;
const DELAY_MS = 1500;
const PARTNERS = Object.keys(COUNTRY_PORTS).join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url, { headers: KEY ? { 'Ocp-Apim-Subscription-Key': KEY } : {} });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 8) throw new Error(`${res.status} after retries: ${url}`);
    const wait = (Number(res.headers.get('retry-after')) || 2 * attempt) * 1000 + 500;
    await sleep(wait);
    return fetchJson(url, attempt + 1);
  }
  if (res.status === 403) {
    // keyless call quota: "Quota will be replenished in 00:07:24."
    const body = await res.text();
    const m = body.match(/replenished in (\d+):(\d+):(\d+)/);
    if (!m || attempt > 8) throw new Error(`403 ${body}`);
    const wait = ((+m[1] * 60 + +m[2]) * 60 + +m[3] + 5) * 1000;
    console.warn(`  call quota used up; waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

await mkdir(CACHE, { recursive: true });

// Which reporter/chapter combinations do earlier runs already cover?
const covered = new Set();
for (const f of await readdir(CACHE)) {
  if (!f.startsWith(`${period}-`)) continue;
  for (const d of JSON.parse(await readFile(path.join(CACHE, f), 'utf8')).data ?? []) covered.add(`${d.reporterCode}|${d.cmdCode}`);
}

const base = KEY ? 'https://comtradeapi.un.org/data/v1/get/C/A/HS' : 'https://comtradeapi.un.org/public/v1/preview/C/A/HS';
const jobs = [];
if (KEY) {
  for (const r of REPORTERS) {
    const todo = CONTAINER_CHAPTERS.filter((c) => !covered.has(`${r.m49}|${c}`));
    if (todo.length) jobs.push({ reporters: [r], chapters: todo });
  }
} else {
  for (const c of CONTAINER_CHAPTERS) {
    const todo = REPORTERS.filter((r) => !covered.has(`${r.m49}|${c}`));
    for (let i = 0; i < todo.length; i += GROUP) jobs.push({ reporters: todo.slice(i, i + GROUP), chapters: [c] });
  }
}
console.log(`${covered.size} reporter/chapter combinations cached · ${jobs.length} calls to make`);

let rows = 0;
for (const [i, job] of jobs.entries()) {
  const name = `${period}-g-${job.chapters.join('_')}-${job.reporters.map((r) => r.iso3).join('_')}`;
  const file = path.join(CACHE, `${name}.json`);
  if (existsSync(file)) continue;
  const q = new URLSearchParams({
    reporterCode: job.reporters.map((r) => r.m49).join(','), period, flowCode: 'M',
    cmdCode: job.chapters.join(','), partnerCode: PARTNERS,
    partner2Code: '0', customsCode: 'C00', motCode: '0', includeDesc: 'false',
  });
  const json = await fetchJson(`${base}?${q}`);
  const n = json.data?.length ?? 0;
  if (!KEY && n >= 500) console.warn(`  ! ${name} hit the 500-row preview cap; use a smaller GROUP`);
  await writeFile(file, JSON.stringify(json));
  rows += n;
  if ((i + 1) % 10 === 0 || i === jobs.length - 1) console.log(`${i + 1}/${jobs.length} calls · ${rows} new rows`);
  await sleep(DELAY_MS);
}
console.log('done; run node scripts/build-flows.mjs next');
