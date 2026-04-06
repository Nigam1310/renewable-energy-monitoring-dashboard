require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.DATAGOV_API_KEY;
const CAPACITY_RESOURCE_ID = process.env.CAPACITY_RESOURCE_ID;
const YEARWISE_RESOURCE_ID = process.env.YEARWISE_RESOURCE_ID;

// ── Field index maps (for array-format records) ───────────────────────────────
// Capacity API fields (from data.gov.in screenshot):
//   0=Sl.No, 1=State/UT, 2=Small Hydro Power, 3=Wind Power,
//   4=Bio Power, 5=Solar Power, 6=Large Hydro, 7=Total Capacity
const CAP = { state: 1, smallHydro: 2, wind: 3, bio: 4, solar: 5, largeHydro: 6, total: 7 };

// Yearwise API fields (from data.gov.in screenshot):
//   0=Source(date string), 1=Solar, 2=Wind, 3=Small Hydro, 4=Large Hydro
const YR = { source: 0, solar: 1, wind: 2, smallHydro: 3, largeHydro: 4 };

// ── Generic fetch + debug logging ─────────────────────────────────────────────
async function fetchAPI(resourceId, limit = 100) {
  if (!resourceId || !API_KEY) throw new Error("Missing resource ID or API_KEY");

  const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${API_KEY}&format=json&limit=${limit}`;
  console.log(`[API] GET ${url.replace(API_KEY, "***")}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`data.gov.in responded with status ${res.status}`);

  const json = await res.json();
  console.log(`[API] Top-level keys: ${Object.keys(json).join(", ")}`);

  // data.gov.in uses different keys across datasets
  const records = json.records ?? json.data ?? [];
  console.log(`[API] Records: ${records.length}, format: ${Array.isArray(records[0]) ? "array" : "object"}`);
  if (records[0]) console.log(`[API] Sample[0]:`, JSON.stringify(records[0]).slice(0, 200));

  return records;
}

// ── Pick a value from either an array record (by index) or object record ──────
function pick(r, idx, ...keys) {
  if (Array.isArray(r)) return r[idx] ?? "";
  for (const k of keys) if (r[k] !== undefined) return r[k];
  return "";
}

// ── Transformers ──────────────────────────────────────────────────────────────
function transformStates(records) {
  return records
    .map((r) => {
      const state      = String(pick(r, CAP.state,      "b", "state_ut", "State/UT", "state", "State") ?? "").trim();
      const solar      = pick(r, CAP.solar,      "f", "solar_power",       "Solar Power");
      const wind       = pick(r, CAP.wind,       "d", "wind_power",        "Wind Power");
      const smallHydro = pick(r, CAP.smallHydro, "c", "small_hydro_power", "Small Hydro Power");
      const largeHydro = pick(r, CAP.largeHydro, "g", "large_hydro",       "Large Hydro");
      const bio        = pick(r, CAP.bio,        "e", "bio_power",         "Bio Power");
      const total      = pick(r, CAP.total,      "h", "total_capacity",    "Total Capacity");

      // Skip blank rows, the header row, numeric-only rows, and summary totals
      if (!state || /^(total|sl\.?\s*no\.?)$/i.test(state) || /^\d+$/.test(state)) return null;

      return {
        state,
        solar:      parseFloat(solar)      || 0,
        wind:       parseFloat(wind)       || 0,
        smallHydro: parseFloat(smallHydro) || 0,
        largeHydro: parseFloat(largeHydro) || 0,
        hydro:      (parseFloat(smallHydro) || 0) + (parseFloat(largeHydro) || 0),
        bio:        parseFloat(bio)        || 0,
        total:      parseFloat(total)      || 0,
      };
    })
    .filter(Boolean);
}

function transformYearwise(records) {
  return records
    .map((r) => {
      const rawSource  = String(pick(r, YR.source,     "a", "Source", "source") ?? "").trim();
      const solar      = pick(r, YR.solar,      "b", "solar",       "Solar",       "solar_power");
      const wind       = pick(r, YR.wind,       "c", "wind",        "Wind",        "wind_power");
      const smallHydro = pick(r, YR.smallHydro, "d", "small_hydro", "Small Hydro", "small_hydro_power");
      const largeHydro = pick(r, YR.largeHydro, "e", "large_hydro", "Large Hydro");

      const yearMatch = rawSource.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : rawSource;

      return {
        year,
        label:      rawSource,           // e.g. "As on 31.03.2014"
        solar:      parseFloat(solar)      || 0,
        wind:       parseFloat(wind)       || 0,
        smallHydro: parseFloat(smallHydro) || 0,
        largeHydro: parseFloat(largeHydro) || 0,
      };
    })
    .filter((r) => r.solar > 0 || r.wind > 0 || r.smallHydro > 0 || r.largeHydro > 0)
    .sort((a, b) => parseInt(a.year) - parseInt(b.year));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/capacity", async (req, res) => {
  try {
    const records = await fetchAPI(CAPACITY_RESOURCE_ID, 50);
    if (!records.length) return res.status(500).json({ error: "No records returned from capacity API" });
    res.json(transformStates(records));
  } catch (err) {
    console.error("[/api/capacity]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/yearwise", async (req, res) => {
  try {
    const records = await fetchAPI(YEARWISE_RESOURCE_ID, 100);
    if (!records.length) return res.status(500).json({ error: "No records returned from yearwise API" });
    res.json(transformYearwise(records));
  } catch (err) {
    console.error("[/api/yearwise]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/source-mix", async (req, res) => {
  try {
    const records = await fetchAPI(CAPACITY_RESOURCE_ID, 50);
    const states  = transformStates(records);
    let solar = 0, wind = 0, hydro = 0, bio = 0;
    states.forEach((s) => { solar += s.solar; wind += s.wind; hydro += s.hydro; bio += s.bio; });
    const total = solar + wind + hydro + bio;
    res.json([
      { name: "Solar", value: (solar / total) * 100, color: "#EF9F27" },
      { name: "Wind",  value: (wind  / total) * 100, color: "#378ADD" },
      { name: "Hydro", value: (hydro / total) * 100, color: "#1D9E75" },
      { name: "Bio",   value: (bio   / total) * 100, color: "#D85A30" },
    ]);
  } catch (err) {
    console.error("[/api/source-mix]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/summary", async (req, res) => {
  try {
    const records = await fetchAPI(CAPACITY_RESOURCE_ID, 50);
    const states  = transformStates(records);
    let solar = 0, wind = 0, hydro = 0, bio = 0;
    states.forEach((s) => { solar += s.solar; wind += s.wind; hydro += s.hydro; bio += s.bio; });
    const total = solar + wind + hydro + bio;
    res.json({
      solar: { output: solar / 1000, capacity: solar / 1000, efficiency: 65, trend: 3.2, unit: "GW" },
      wind:  { output: wind  / 1000, capacity: wind  / 1000, efficiency: 60, trend: 2.1, unit: "GW" },
      hydro: { output: hydro / 1000, capacity: hydro / 1000, efficiency: 72, trend: 1.5, unit: "GW" },
      bio:   { output: bio   / 1000, capacity: bio   / 1000, efficiency: 45, trend: 0.8, unit: "GW" },
      total: { output: total / 1000, co2Saved: total * 5, costSaved: total * 2000 },
    });
  } catch (err) {
    console.error("[/api/summary]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Debug endpoints — visit these to inspect the raw API response ─────────────
app.get("/api/debug/capacity", async (req, res) => {
  try {
    const url = `https://api.data.gov.in/resource/${CAPACITY_RESOURCE_ID}?api-key=${API_KEY}&format=json&limit=3`;
    res.json(await (await fetch(url)).json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/debug/yearwise", async (req, res) => {
  try {
    const url = `https://api.data.gov.in/resource/${YEARWISE_RESOURCE_ID}?api-key=${API_KEY}&format=json&limit=3`;
    res.json(await (await fetch(url)).json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`\n✅  Renewable API → http://localhost:${PORT}`);
  console.log(`🔍  Debug → http://localhost:${PORT}/api/debug/capacity`);
  console.log(`🔍  Debug → http://localhost:${PORT}/api/debug/yearwise\n`);
});
