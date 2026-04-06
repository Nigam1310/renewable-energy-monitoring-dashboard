require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.DATAGOV_API_KEY;
const CAPACITY_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const YEARWISE_RESOURCE_ID = process.env.YEARWISE_RESOURCE_ID;

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchCapacity() {
  if (!CAPACITY_RESOURCE_ID || !API_KEY) {
    throw new Error("Missing CAPACITY_RESOURCE_ID or API_KEY");
  }

  const url = `https://api.data.gov.in/resource/${CAPACITY_RESOURCE_ID}?api-key=${API_KEY}&format=json&limit=50`;
  console.log(`[API] Fetching capacity data from data.gov.in`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`data.gov.in responded with status ${res.status}`);
  }

  const json = await res.json();

  const records = json.records || json.data || [];

  if (!records.length) {
    throw new Error("No records returned from capacity API");
  }

  return records;
}

async function fetchYearwise() {
  if (!YEARWISE_RESOURCE_ID || !API_KEY) {
    throw new Error("Missing YEARWISE_RESOURCE_ID or API_KEY");
  }

  const url = `https://api.data.gov.in/resource/${YEARWISE_RESOURCE_ID}?api-key=${API_KEY}&format=json&limit=20`;
  console.log(`[API] Fetching yearwise data from data.gov.in`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`data.gov.in responded with status ${res.status}`);
  }

  const json = await res.json();

  // The API returns records array with field keys a, b, c, d, e
  // a = Source (e.g. "As on 31.03.2014"), b = Solar, c = Wind, d = Small Hydro, e = Large Hydro
  const records = json.records || json.data || [];

  if (!records.length) {
    throw new Error("No records returned from yearwise API");
  }

  return records
    .map((r) => {
      // Parse year from label like "As on 31.03.2014" or "As on 30.06.2022"
      const rawLabel = r.a || r.source || r.Source || "";
      const yearMatch = rawLabel.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : rawLabel;

      return {
        year,
        label: rawLabel,
        solar:     parseFloat(r.b || r.Solar || 0),
        wind:      parseFloat(r.c || r.Wind  || 0),
        smallHydro: parseFloat(r.d || r["Small Hydro"] || 0),
        largeHydro: parseFloat(r.e || r["Large Hydro"] || 0),
      };
    })
    .filter((r) => r.solar > 0 || r.wind > 0) // drop empty/header rows
    .sort((a, b) => parseInt(a.year) - parseInt(b.year));
}

function transformStates(records) {
  return records.map((r) => ({
    state: r["State_UT"] || r["State/UT"] || r.state,
    solar: parseFloat(r["Solar Power"]) || parseFloat(r.solar) || 0,
    wind:  parseFloat(r["Wind Power"])  || parseFloat(r.wind)  || 0,
    hydro: parseFloat(r["Large Hydro"]) || parseFloat(r.hydro) || 0,
    bio:   parseFloat(r["Bio Power"])   || parseFloat(r.bio)   || 0,
  }));
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/api/capacity", async (req, res) => {
  try {
    const records = await fetchCapacity();
    res.json(transformStates(records));
  } catch (err) {
    console.error("[/api/capacity]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/yearwise", async (req, res) => {
  try {
    const data = await fetchYearwise();
    res.json(data);
  } catch (err) {
    console.error("[/api/yearwise] API failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/summary", async (req, res) => {
  try {
    const records = await fetchCapacity();
    const states = transformStates(records);
    let solar = 0, wind = 0, hydro = 0, bio = 0;
    states.forEach((s) => { solar += s.solar; wind += s.wind; hydro += s.hydro; bio += s.bio; });
    const total = solar + wind + hydro + bio;
    res.json({
      solar:  { output: solar/1000,  capacity: solar/1000,  efficiency: 65, trend: 3.2, unit: "GW" },
      wind:   { output: wind/1000,   capacity: wind/1000,   efficiency: 60, trend: 2.1, unit: "GW" },
      hydro:  { output: hydro/1000,  capacity: hydro/1000,  efficiency: 72, trend: 1.5, unit: "GW" },
      geo:    { output: 0.3, capacity: 0.5, efficiency: 80, trend: 0.5, unit: "GW" },
      tidal:  { output: 0.1, capacity: 0.2, efficiency: 50, trend: 0.2, unit: "GW" },
      total:  { output: total/1000, co2Saved: total * 5, costSaved: total * 2000 },
    });
  } catch (err) {
    console.error("[/api/summary]", err.message);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

app.get("/api/source-mix", async (req, res) => {
  try {
    const records = await fetchCapacity();
    const states = transformStates(records);
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

app.listen(PORT, () => {
  console.log(`Renewable API running on http://localhost:${PORT}`);
});
