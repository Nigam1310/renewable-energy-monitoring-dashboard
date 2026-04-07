import { useState, useEffect } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  Link, useParams, useNavigate,
} from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  Legend, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  ComposableMap, Geographies, Geography, ZoomableGroup,
} from "react-simple-maps";

// ── API ───────────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:4000/api";

// India states topojson served locally from public/ so the map does not depend
// on a remote URL at runtime.
const INDIA_TOPO_URL = "/india-states.json";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = (n, d = 1) => Number(n).toFixed(d);
const fmtPct = (n)        => Number(n).toFixed(1) + "%";

const SOURCE_COLORS = {
  solar:      "#EF9F27",
  wind:       "#378ADD",
  smallHydro: "#1D9E75",
  largeHydro: "#7F77DD",
  hydro:      "#1D9E75",
  bio:        "#D85A30",
};

const CUSTOM_TOOLTIP_STYLE = {
  background: "white", border: "1px solid #e5e7eb",
  borderRadius: 8, padding: "10px 14px",
  fontSize: 13, color: "#111827",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
};

// ── Map: normalize topojson state names → API state names ─────────────────────
const TOPO_TO_API = {
  "Andaman and Nicobar":         "Andaman & Nicobar Island",
  "Jammu and Kashmir":           "Jammu & Kashmir",
  "Dadra and Nagar Haveli":      "Dadra & Nagar Haveli",
  "Daman and Diu":               "Daman & Diu",
  "Dadra and Nagar Haveli and Daman and Diu": "Dadra & Nagar Haveli and Daman & Diu",
  "Andaman and Nicobar Islands": "Andaman & Nicobar Island",
  "NCT of Delhi":                "Delhi",
  "Delhi":                       "Delhi",
  "Pondicherry":                 "Puducherry",
  "Orissa":                      "Odisha",
  "Uttaranchal":                 "Uttarakhand",
  "Chhattisgarh":                "Chhattisgarh",
};

function toApiName(topoName) {
  return TOPO_TO_API[topoName] || topoName;
}

// ── Map colour scale (total capacity → green shade) ───────────────────────────
function capacityColor(totalMW, maxMW) {
  if (!totalMW || !maxMW) return "#e5f0e8";
  const t = Math.min(totalMW / maxMW, 1);
  // interpolate from #c8e6c9 (low) → #1B5E20 (high)
  const r = Math.round(200 - t * 173);
  const g = Math.round(230 - t * 136);
  const b = Math.round(201 - t * 169);
  return `rgb(${r},${g},${b})`;
}

// ── Shared components ─────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-semibold text-gray-900">{title}</div>
      {sub && <div className="text-sm text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function LoadingScreen({ message = "Loading data..." }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-600 text-xl mb-4">⚠️ Error loading data</div>
        <p className="text-gray-600 mb-4">{message}</p>
        <button onClick={onRetry} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Retry
        </button>
      </div>
    </div>
  );
}

// ── India Map (used inside StateSelection) ────────────────────────────────────
function DarkModeToggle({ darkMode, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed top-4 right-4 z-[100] rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-md transition-colors hover:bg-gray-50"
      aria-pressed={darkMode}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? "Light mode" : "Dark mode"}
    </button>
  );
}

function IndiaMap({ capacityData, onStateClick }) {
  const [tooltip, setTooltip] = useState(null);
  const [position, setPosition] = useState({ coordinates: [82, 22], zoom: 1 });

  const maxMW = Math.max(...capacityData.map((s) => {
    const h = (s.smallHydro || 0) + (s.largeHydro || 0) || (s.hydro || 0);
    return (s.solar || 0) + (s.wind || 0) + h + (s.bio || 0);
  }));

  const lookupState = (topoName) => {
    const apiName = toApiName(topoName);
    return capacityData.find(
      (s) => s.state.toLowerCase() === apiName.toLowerCase()
    );
  };

  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur rounded-lg p-3 shadow-sm text-xs">
        <div className="font-semibold text-gray-700 mb-2">Total Capacity</div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-3 rounded-sm" style={{
            background: "linear-gradient(to right, #c8e6c9, #1B5E20)"
          }} />
        </div>
        <div className="flex justify-between text-gray-500 mt-1">
          <span>Low</span><span>High</span>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => setPosition((p) => ({ ...p, zoom: Math.min(p.zoom * 1.5, 8) }))}
          className="bg-white/90 hover:bg-white text-gray-700 w-8 h-8 rounded-lg shadow-sm font-bold text-lg flex items-center justify-center"
        >+</button>
        <button
          onClick={() => setPosition((p) => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }))}
          className="bg-white/90 hover:bg-white text-gray-700 w-8 h-8 rounded-lg shadow-sm font-bold text-lg flex items-center justify-center"
        >−</button>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [82, 22], scale: 1000 }}
        width={600}
        height={650}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={({ coordinates, zoom }) => setPosition({ coordinates, zoom })}
        >
          <Geographies geography={INDIA_TOPO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const topoName  = geo.properties.st_nm || geo.properties.NAME_1 || geo.properties.name || "";
                const stateData = lookupState(topoName);
                const h = stateData
                  ? ((stateData.smallHydro || 0) + (stateData.largeHydro || 0) || (stateData.hydro || 0))
                  : 0;
                const totalMW = stateData
                  ? (stateData.solar || 0) + (stateData.wind || 0) + h + (stateData.bio || 0)
                  : 0;
                const fill    = capacityColor(totalMW, maxMW);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={0.6}
                    style={{
                      default:  { outline: "none", cursor: stateData ? "pointer" : "default" },
                      hover:    { outline: "none", fill: "#4CAF50", opacity: 0.85 },
                      pressed:  { outline: "none", fill: "#2E7D32" },
                    }}
                    onMouseEnter={(e) => {
                      setTooltip({
                        name:  toApiName(topoName) || topoName,
                        total: totalMW,
                        solar: stateData?.solar || 0,
                        wind:  stateData?.wind  || 0,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => {
                      if (stateData) onStateClick(stateData.state);
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 pointer-events-none text-sm"
          style={{ left: tooltip.x + 12, top: tooltip.y - 60, minWidth: 180 }}
        >
          <div className="font-bold text-gray-900 mb-1">{tooltip.name}</div>
          {tooltip.total > 0 ? (
            <>
              <div className="text-gray-600">Total: <span className="font-semibold text-green-700">{fmt(tooltip.total / 1000)} GW</span></div>
              <div className="text-gray-500 text-xs mt-1">
                ☀️ {fmt(tooltip.solar / 1000)} GW &nbsp; 💨 {fmt(tooltip.wind / 1000)} GW
              </div>
            </>
          ) : (
            <div className="text-gray-400 text-xs">No data available</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Yearwise Dashboard ────────────────────────────────────────────────────────
function YearwiseDashboard() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [activePieYear, setActivePieYear] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res  = await fetch(`${BASE_URL}/yearwise`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        setData(json);
        setActivePieYear(json[json.length - 1]?.year ?? null);
        setError(null);
      } catch (err) { setError(err.message); }
      finally        { setLoading(false); }
    })();
  }, []);

  if (loading) return <LoadingScreen message="Loading year-wise capacity data..." />;
  if (error && !data.length)
    return <ErrorScreen message={error} onRetry={() => window.location.reload()} />;

  const last  = data[data.length - 1];
  const first = data[0];
  const totalOf = (d) => d ? d.solar + d.wind + d.smallHydro + d.largeHydro : 0;
  const totalLast  = totalOf(last);
  const totalFirst = totalOf(first);
  const solarGrowthX = first?.solar > 0 ? (last.solar / first.solar).toFixed(1) : "—";

  const chartData = data.map((d) => ({
    year:          d.year,
    label:         d.label || d.year,
    Solar:         +(d.solar      / 1000).toFixed(2),
    Wind:          +(d.wind       / 1000).toFixed(2),
    "Small Hydro": +(d.smallHydro / 1000).toFixed(2),
    "Large Hydro": +(d.largeHydro / 1000).toFixed(2),
    Total:         +((d.solar + d.wind + d.smallHydro + d.largeHydro) / 1000).toFixed(2),
  }));

  const pieRow  = data.find((d) => d.year === activePieYear) || last;
  const pieData = pieRow ? [
    { name: "Solar",       value: +(pieRow.solar      / 1000).toFixed(2), color: SOURCE_COLORS.solar },
    { name: "Wind",        value: +(pieRow.wind       / 1000).toFixed(2), color: SOURCE_COLORS.wind  },
    { name: "Small Hydro", value: +(pieRow.smallHydro / 1000).toFixed(2), color: SOURCE_COLORS.smallHydro },
    { name: "Large Hydro", value: +(pieRow.largeHydro / 1000).toFixed(2), color: SOURCE_COLORS.largeHydro },
  ] : [];
  const pieTotal = pieData.reduce((s, i) => s + i.value, 0) || 1;

  const growthRows = data.slice(1).map((d, i) => {
    const prev = data[i];
    const grow = (key) =>
      prev[key] > 0 ? (((d[key] - prev[key]) / prev[key]) * 100).toFixed(1) : "—";
    return { label: d.label || d.year, year: d.year, solar: grow("solar"), wind: grow("wind"), smallHydro: grow("smallHydro"), largeHydro: grow("largeHydro") };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mb-4 block">← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-900">Year-wise RE Installed Capacity</h1>
          <p className="text-gray-600 mt-2">Cumulative renewable energy capacity in India — Solar, Wind, Small Hydro, Large Hydro (source: data.gov.in)</p>
          {error && (
            <div className="mt-3 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-3 py-2 rounded-lg">
              ⚠️ API unavailable — showing fallback data
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon="⚡" label="Total Capacity (latest)" value={`${fmt(totalLast / 1000)} GW`} sub={`${fmt(totalFirst / 1000)} GW in ${first?.year}`} />
          <StatCard icon="☀️" label={`Solar (${last?.year})`} value={`${fmt((last?.solar ?? 0) / 1000)} GW`} sub={`${solarGrowthX}× growth since ${first?.year}`} color={SOURCE_COLORS.solar} />
          <StatCard icon="💨" label={`Wind (${last?.year})`} value={`${fmt((last?.wind ?? 0) / 1000)} GW`} sub={`${fmt(((last?.wind ?? 0) - (first?.wind ?? 0)) / 1000)} GW added`} color={SOURCE_COLORS.wind} />
          <StatCard icon="💧" label={`Hydro (${last?.year})`} value={`${fmt(((last?.smallHydro ?? 0) + (last?.largeHydro ?? 0)) / 1000)} GW`} sub={`Small: ${fmt((last?.smallHydro ?? 0) / 1000)} | Large: ${fmt((last?.largeHydro ?? 0) / 1000)}`} color={SOURCE_COLORS.smallHydro} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Cumulative Capacity by Source" sub="GW installed" />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" GW" />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v} GW`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Solar"       stackId="a" fill={SOURCE_COLORS.solar}      />
                <Bar dataKey="Wind"        stackId="a" fill={SOURCE_COLORS.wind}       />
                <Bar dataKey="Small Hydro" stackId="a" fill={SOURCE_COLORS.smallHydro} />
                <Bar dataKey="Large Hydro" stackId="a" fill={SOURCE_COLORS.largeHydro} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Growth Trajectories" sub="GW over time per source" />
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" GW" />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v} GW`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Solar"       stroke={SOURCE_COLORS.solar}      strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Wind"        stroke={SOURCE_COLORS.wind}       strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Small Hydro" stroke={SOURCE_COLORS.smallHydro} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Large Hydro" stroke={SOURCE_COLORS.largeHydro} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Solar vs Wind — The Race" sub="GW comparison, year by year" />
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" GW" />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v} GW`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Solar" fill={SOURCE_COLORS.solar} radius={[3,3,0,0]} />
                <Bar dataKey="Wind"  fill={SOURCE_COLORS.wind}  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Source Mix by Year" sub="Select a year to see the breakdown" />
            <div className="flex flex-wrap gap-2 mb-4">
              {data.map((d) => (
                <button key={d.year} onClick={() => setActivePieYear(d.year)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activePieYear === d.year ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                  {d.year}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} GW`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm flex-1">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-700">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">{item.value} GW</span>
                      <span className="text-gray-400 ml-2 text-xs">{((item.value / pieTotal) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <SectionHeader title="Total Installed Capacity (All Sources)" sub="Combined GW — stacked area" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <defs>
                {[["Solar", SOURCE_COLORS.solar], ["Wind", SOURCE_COLORS.wind], ["Small Hydro", SOURCE_COLORS.smallHydro], ["Large Hydro", SOURCE_COLORS.largeHydro]].map(([key, color], i) => (
                  <linearGradient key={key} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" GW" />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v} GW`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Solar"       stackId="1" stroke={SOURCE_COLORS.solar}      fill="url(#grad0)" />
              <Area type="monotone" dataKey="Wind"        stackId="1" stroke={SOURCE_COLORS.wind}       fill="url(#grad1)" />
              <Area type="monotone" dataKey="Small Hydro" stackId="1" stroke={SOURCE_COLORS.smallHydro} fill="url(#grad2)" />
              <Area type="monotone" dataKey="Large Hydro" stackId="1" stroke={SOURCE_COLORS.largeHydro} fill="url(#grad3)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <SectionHeader title="Raw Capacity Data (MW)" sub="All values as reported by data.gov.in" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Date / Source","Solar (MW)","Wind (MW)","Small Hydro (MW)","Large Hydro (MW)","Total (MW)"].map((h, i) => (
                    <th key={h} className={`py-3 px-4 font-semibold text-gray-700 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.year} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{row.label || row.year}</td>
                    <td className="py-3 px-4 text-right text-yellow-700">{row.solar.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-blue-700">{row.wind.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-green-700">{row.smallHydro.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-indigo-700">{row.largeHydro.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      {(row.solar + row.wind + row.smallHydro + row.largeHydro).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Year-on-Year Growth Rates" sub="Percentage increase per source" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Period","Solar","Wind","Small Hydro","Large Hydro"].map((h, i) => (
                    <th key={h} className={`py-3 px-4 font-semibold text-gray-700 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {growthRows.map((row) => {
                  const colorFor = (v) => { const n = parseFloat(v); if (isNaN(n)) return "text-gray-400"; if (n >= 20) return "text-green-700 font-semibold"; if (n >= 5) return "text-yellow-700"; return "text-gray-500"; };
                  const bgFor    = (v) => { const n = parseFloat(v); if (isNaN(n)) return ""; if (n >= 20) return "bg-green-50"; if (n >= 5) return "bg-yellow-50"; return ""; };
                  return (
                    <tr key={row.year} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-gray-900">{row.label}</td>
                      {["solar","wind","smallHydro","largeHydro"].map((key) => (
                        <td key={key} className={`py-3 px-4 text-right ${bgFor(row[key])}`}>
                          <span className={colorFor(row[key])}>{row[key] !== "—" ? `+${row[key]}%` : "—"}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── State Selection (with India Map) ──────────────────────────────────────────
function StateSelection({ capacityData }) {
  const navigate  = useNavigate();
  const [view, setView]       = useState("map"); // "map" | "grid"
  const [sortKey, setSortKey] = useState("total");

  const sorted = [...capacityData].sort((a, b) => {
    const val = (d) => {
      if (sortKey === "total") {
        const h = (d.smallHydro ?? 0) + (d.largeHydro ?? 0) || (d.hydro ?? 0);
        return (d.solar ?? 0) + (d.wind ?? 0) + h + (d.bio ?? 0);
      }
      return d[sortKey] ?? 0;
    };
    return val(b) - val(a);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 text-sm block">← Back to Dashboard</Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">State/UT-wise Renewable Energy</h1>
              <p className="text-gray-600 mt-2">Click any state on the map or card to explore its data</p>
            </div>
            {/* View toggle */}
            <div className="flex gap-2">
              <button onClick={() => setView("map")}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${view === "map" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                🗺️ Map View
              </button>
              <button onClick={() => setView("grid")}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${view === "grid" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                📋 Grid View
              </button>
            </div>
          </div>
        </div>

        {view === "map" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map */}
            <div className="lg:col-span-2">
              <IndiaMap
                capacityData={capacityData}
                onStateClick={(stateName) => navigate(`/state/${encodeURIComponent(stateName)}`)}
              />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Hover to preview · Click to open state detail · Scroll or use +/− to zoom
              </p>
            </div>

            {/* Side panel — top 10 states */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-y-auto max-h-[680px]">
              <SectionHeader title="Top States" sub="Click to open detail page" />
              <div className="space-y-3">
                {sorted.slice(0, 15).map((state, i) => {
                  const h = (state.smallHydro ?? 0) + (state.largeHydro ?? 0) || (state.hydro ?? 0);
                  const total = ((state.solar ?? 0) + (state.wind ?? 0) + h + (state.bio ?? 0)) / 1000;
                  return (
                    <button
                      key={state.state}
                      onClick={() => navigate(`/state/${encodeURIComponent(state.state)}`)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-green-50 hover:border-green-200 border border-transparent transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{state.state}</div>
                          <div className="text-xs text-gray-500">
                            ☀️{fmt(state.solar/1000)} 💨{fmt(state.wind/1000)} 💧{fmt(h/1000)} GW
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-green-700">{fmt(total)} GW</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Sort controls */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="text-sm text-gray-600 self-center">Sort by:</span>
              {[{ key:"total",label:"Total"},{ key:"solar",label:"☀️ Solar"},{ key:"wind",label:"💨 Wind"},{ key:"smallHydro",label:"💧 Small Hydro"},{ key:"largeHydro",label:"🌊 Large Hydro"},{ key:"bio",label:"🌿 Bio"}].map(({ key, label }) => (
                <button key={key} onClick={() => setSortKey(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${sortKey === key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map((state) => {
                const hydroTotal = (state.smallHydro ?? 0) + (state.largeHydro ?? 0) || (state.hydro ?? 0);
                const total = ((state.solar ?? 0) + (state.wind ?? 0) + hydroTotal + (state.bio ?? 0)) / 1000;
                const sources = [
                  { key:"solar",      label:"Solar",       color:SOURCE_COLORS.solar,      icon:"☀️" },
                  { key:"wind",       label:"Wind",        color:SOURCE_COLORS.wind,       icon:"💨" },
                  { key:"smallHydro", label:"Small Hydro", color:SOURCE_COLORS.smallHydro, icon:"💧" },
                  { key:"largeHydro", label:"Large Hydro", color:SOURCE_COLORS.largeHydro, icon:"🌊" },
                  { key:"bio",        label:"Bio",         color:SOURCE_COLORS.bio,        icon:"🌿" },
                ];
                return (
                  <div key={state.state}
                    onClick={() => navigate(`/state/${encodeURIComponent(state.state)}`)}
                    className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{state.state}</h3>
                        <p className="text-sm text-gray-500">Total: {fmt(total)} GW</p>
                      </div>
                      <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded-lg">{fmt(total)} GW</span>
                    </div>
                    <div className="space-y-1.5">
                      {sources.map(({ key, label, color, icon }) => {
                        const val = state[key] ?? 0;
                        const gw  = val / 1000;
                        const pct = total > 0 ? (gw / total) * 100 : 0;
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                              <span>{icon} {label}</span>
                              <span className="font-semibold">{fmt(gw)} GW</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full" style={{ width:`${pct}%`, backgroundColor:color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs text-blue-600 font-medium">View detailed analysis →</span>
                      <Link
                        to={`/state/${encodeURIComponent(state.state)}/predict`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-purple-600 font-medium hover:underline"
                      >
                        🔮 Predict
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── State Detail ──────────────────────────────────────────────────────────────
function StateDetail({ capacityData }) {
  const { stateName } = useParams();
  const stateData = capacityData.find((s) => s.state === decodeURIComponent(stateName));

  if (!stateData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">State Not Found</h2>
          <Link to="/states" className="text-blue-600 hover:text-blue-800">← Back to States</Link>
        </div>
      </div>
    );
  }

  const allSources = [
    { key:"solar",      name:"Solar Power",      value:stateData.solar,      color:SOURCE_COLORS.solar,      eff:"65%" },
    { key:"wind",       name:"Wind Power",        value:stateData.wind,       color:SOURCE_COLORS.wind,       eff:"60%" },
    { key:"smallHydro", name:"Small Hydro Power", value:stateData.smallHydro, color:SOURCE_COLORS.smallHydro, eff:"72%" },
    { key:"largeHydro", name:"Large Hydro",       value:stateData.largeHydro, color:SOURCE_COLORS.largeHydro, eff:"75%" },
    { key:"bio",        name:"Bio Power",         value:stateData.bio,        color:SOURCE_COLORS.bio,        eff:"45%" },
  ].filter((s) => s.value > 0);

  const totalCapacity = allSources.reduce((s, i) => s + i.value, 0);
  const pieData = allSources.map((s) => ({ ...s, value: +(s.value / 1000).toFixed(2) }));
  const bgMap = { solar:"bg-yellow-100 text-yellow-800", wind:"bg-blue-100 text-blue-800", smallHydro:"bg-green-100 text-green-800", largeHydro:"bg-indigo-100 text-indigo-800", bio:"bg-orange-100 text-orange-800" };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/states" className="text-blue-600 hover:text-blue-800 text-sm">← Back to States</Link>
            <Link to="/"       className="text-blue-600 hover:text-blue-800 text-sm">← Dashboard</Link>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{stateData.state} — Renewable Energy</h1>
              <p className="text-gray-600 mt-2">Full installed capacity breakdown across all sources</p>
            </div>
            <Link
              to={`/state/${encodeURIComponent(stateData.state)}/predict`}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm flex items-center gap-2"
            >
              🔮 View Next-Year Prediction
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {allSources.map((s) => (
            <div key={s.key} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-1">{s.name}</div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{fmt(s.value / 1000)} GW</div>
              <div className="text-xs text-gray-400 mt-1">{s.value.toLocaleString()} MW</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Capacity Breakdown" sub="By energy source (GW)" />
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v} GW`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Capacity by Source" sub="MW installed" />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={allSources.map((s) => ({ name: s.name.replace(" Power",""), value: s.value, color: s.color }))}
                margin={{ top:10, right:20, left:0, bottom:40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize:10, fill:"#6b7280" }} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize:11, fill:"#6b7280" }} unit=" MW" />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v.toLocaleString()} MW`} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {allSources.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Detailed Capacity Table" sub="All energy sources with share and efficiency" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {["Source","Capacity (MW)","Capacity (GW)","Share (%)","Efficiency"].map((h, i) => (
                  <th key={h} className={`py-3 px-4 font-semibold text-gray-700 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSources.map((src) => (
                <tr key={src.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 flex items-center gap-2 font-medium text-gray-900">
                    <span style={{ color: src.color }}>●</span>{src.name}
                  </td>
                  <td className="py-3 px-4 text-right">{src.value.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-semibold">{fmt(src.value / 1000)}</td>
                  <td className="py-3 px-4 text-right">{fmtPct((src.value / totalCapacity) * 100)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgMap[src.key]}`}>{src.eff}</span>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="py-3 px-4 font-bold text-gray-900">Total</td>
                <td className="py-3 px-4 text-right font-bold">{totalCapacity.toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold">{fmt(totalCapacity / 1000)}</td>
                <td className="py-3 px-4 text-right font-bold">100%</td>
                <td className="py-3 px-4" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── NEW: State Prediction Page ────────────────────────────────────────────────
function StatePrediction() {
  const { stateName }              = useParams();
  const [predData, setPredData]    = useState(null);
  const [loading,  setLoading]     = useState(true);
  const [error,    setError]       = useState(null);

  const decoded = decodeURIComponent(stateName);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res  = await fetch(`${BASE_URL}/predict/${encodeURIComponent(decoded)}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        setPredData(json);
      } catch (err) { setError(err.message); }
      finally        { setLoading(false); }
    })();
  }, [decoded]);

  if (loading) return <LoadingScreen message="Running prediction model..." />;
  if (error)   return <ErrorScreen message={error} onRetry={() => window.location.reload()} />;

  const sources = [
    { key:"solar",      name:"Solar Power",      icon:"☀️", color:SOURCE_COLORS.solar      },
    { key:"wind",       name:"Wind Power",        icon:"💨", color:SOURCE_COLORS.wind       },
    { key:"smallHydro", name:"Small Hydro",       icon:"💧", color:SOURCE_COLORS.smallHydro },
    { key:"largeHydro", name:"Large Hydro",       icon:"🌊", color:SOURCE_COLORS.largeHydro },
    { key:"bio",        name:"Bio Power",         icon:"🌿", color:SOURCE_COLORS.bio        },
  ].filter((s) => (predData?.predictions?.[s.key]?.current || 0) > 0);

  const preds = predData?.predictions || {};
  const nextYear = preds.solar?.nextYear || new Date().getFullYear() + 1;

  // Comparison bar chart data
  const compareData = sources.map((s) => ({
    name:      s.name,
    Current:   +(( preds[s.key]?.current   || 0) / 1000).toFixed(2),
    Predicted: +((preds[s.key]?.predicted  || 0) / 1000).toFixed(2),
    color:     s.color,
  }));

  // Total current vs predicted
  const totalCurrent   = sources.reduce((sum, s) => sum + (preds[s.key]?.current   || 0), 0);
  const totalPredicted = sources.reduce((sum, s) => sum + (preds[s.key]?.predicted || 0), 0);
  const overallGrowth  = totalCurrent > 0 ? ((totalPredicted - totalCurrent) / totalCurrent * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to={`/state/${encodeURIComponent(decoded)}`} className="text-blue-600 hover:text-blue-800 text-sm">← Back to State Detail</Link>
            <Link to="/states" className="text-blue-600 hover:text-blue-800 text-sm">← All States</Link>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔮</span>
            <h1 className="text-3xl font-bold text-gray-900">{decoded} — {nextYear} Forecast</h1>
          </div>
          <p className="text-gray-600">
            Predicted renewable capacity using <strong>linear regression</strong> on India's national year-wise growth trends, applied to current state figures.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-800 text-sm px-3 py-2 rounded-lg">
            ℹ️ Predictions are indicative estimates based on historical national growth rates — not official projections.
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs font-medium text-gray-500 mb-1">Current Total</div>
            <div className="text-2xl font-bold text-gray-900">{fmt(totalCurrent / 1000)} GW</div>
            <div className="text-xs text-gray-400">{totalCurrent.toLocaleString()} MW</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs font-medium text-gray-500 mb-1">Predicted ({nextYear})</div>
            <div className="text-2xl font-bold text-purple-700">{fmt(totalPredicted / 1000)} GW</div>
            <div className="text-xs text-gray-400">{Math.round(totalPredicted).toLocaleString()} MW</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs font-medium text-gray-500 mb-1">Expected Addition</div>
            <div className="text-2xl font-bold text-green-700">+{fmt((totalPredicted - totalCurrent) / 1000)} GW</div>
            <div className="text-xs text-gray-400">incremental capacity</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs font-medium text-gray-500 mb-1">Overall Growth Rate</div>
            <div className={`text-2xl font-bold ${overallGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
              {overallGrowth >= 0 ? "+" : ""}{fmt(overallGrowth)}%
            </div>
            <div className="text-xs text-gray-400">year-on-year</div>
          </div>
        </div>

        {/* Comparison bar chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <SectionHeader title="Current vs Predicted Capacity" sub={`GW — by source, forecast for ${nextYear}`} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={compareData} margin={{ top:10, right:20, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:"#6b7280" }} />
              <YAxis tick={{ fontSize:11, fill:"#6b7280" }} unit=" GW" />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v} GW`} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <Bar dataKey="Current"   fill="#94a3b8" radius={[3,3,0,0]} />
              <Bar dataKey="Predicted" fill="#7c3aed" radius={[3,3,0,0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-source prediction cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          {sources.map((s) => {
            const p = preds[s.key];
            if (!p) return null;
            const added = p.predicted - p.current;
            const grow  = p.growthRate;
            return (
              <div key={s.key} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">{p.method}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Current</span>
                    <span className="font-bold text-gray-900">{fmt(p.current / 1000)} GW</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Predicted ({nextYear})</span>
                    <span className="font-bold text-purple-700">{fmt(p.predicted / 1000)} GW</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Addition</span>
                    <span className="font-bold text-green-600">+{fmt(added / 1000)} GW</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Current</span>
                    <span>+{fmt(grow, 1)}% growth</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{
                      width: `${Math.min((p.current / p.predicted) * 100, 100)}%`,
                      backgroundColor: s.color,
                    }} />
                  </div>
                  <div className="w-full bg-purple-100 rounded-full h-2 mt-1">
                    <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: "100%" }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{fmt(p.current / 1000)} GW</span>
                    <span>{fmt(p.predicted / 1000)} GW</span>
                  </div>
                </div>

                {/* National history sparkline */}
                {p.history && p.history.length > 1 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-1">National trend (MW)</div>
                    <ResponsiveContainer width="100%" height={60}>
                      <LineChart data={p.history}>
                        <Line type="monotone" dataKey="value" stroke={s.color} strokeWidth={2} dot={false} />
                        <Tooltip
                          contentStyle={{ fontSize: 11 }}
                          formatter={(v) => [`${v.toLocaleString()} MW`, "National"]}
                          labelFormatter={(l) => `Year: ${l}`}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Radar chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Source Profile — Current vs Predicted" sub="Radar view in GW" />
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={sources.map((s) => ({
              source:    s.name.replace(" Power",""),
              Current:   +((preds[s.key]?.current   || 0) / 1000).toFixed(2),
              Predicted: +((preds[s.key]?.predicted || 0) / 1000).toFixed(2),
            }))}>
              <PolarGrid />
              <PolarAngleAxis dataKey="source" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              <Radar name="Current"   dataKey="Current"   stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} />
              <Radar name="Predicted" dataKey="Predicted" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
              <Legend />
              <Tooltip formatter={(v) => `${v} GW`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── NEW: Top Sources in India ─────────────────────────────────────────────────
const RENEWABLE_INSTALLATIONS = [
  {
    name: "Bhadla Solar Power Plant",
    type: "Solar park",
    location: "Rajasthan",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/AMP_Energy_Bhadla_Solar_Power_Plant.jpg?width=900",
    credit: "Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:AMP_Energy_Bhadla_Solar_Power_Plant.jpg",
    about: "A large solar installation in the high-irradiance Thar Desert region, showing how utility-scale solar farms use rows of PV modules to convert sunlight directly into electricity.",
  },
  {
    name: "Pavagada Solar Park",
    type: "Solar park",
    location: "Karnataka",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Pavagada_Solar_Park_2020.jpg?width=900",
    credit: "Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Pavagada_Solar_Park_2020.jpg",
    about: "A major solar park model where many solar blocks are spread across a dry, open landscape and connected to the grid through shared evacuation infrastructure.",
  },
  {
    name: "Muppandal Wind Farm",
    type: "Wind farm",
    location: "Tamil Nadu",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Wind_Farm_Muppandal.jpg?width=900",
    credit: "Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Wind_Farm_Muppandal.jpg",
    about: "A wind-rich corridor near the Western Ghats where turbines capture strong seasonal winds and convert blade rotation into electrical power.",
  },
  {
    name: "Tehri Dam",
    type: "Hydropower dam",
    location: "Uttarakhand",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Tehri_dam.jpg?width=900",
    credit: "Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Tehri_dam.jpg",
    about: "A high-head hydro project on the Bhagirathi River where stored water drives turbines for electricity, while also supporting water management uses.",
  },
  {
    name: "Sardar Sarovar Dam",
    type: "Hydropower dam",
    location: "Gujarat",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Sardar_Sarovar_Dam.jpg?width=900",
    credit: "Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Sardar_Sarovar_Dam.jpg",
    about: "A major Narmada River project that demonstrates large-scale hydro generation, using water flow through turbines to supply grid electricity.",
  },
  {
    name: "Biomass Power Plant",
    type: "Bioenergy",
    location: "Agricultural residue based systems",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Biomass_power_plant.jpg?width=900",
    credit: "Wikimedia Commons",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Biomass_power_plant.jpg",
    about: "Bioenergy plants use organic material such as crop residue, wood waste, or biogas feedstock to produce heat and electricity when managed sustainably.",
  },
];

function TopSources() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res  = await fetch(`${BASE_URL}/top-sources`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) { setError(err.message); }
      finally        { setLoading(false); }
    })();
  }, []);

  if (loading) return <LoadingScreen message="Loading national source rankings..." />;
  if (error)   return <ErrorScreen message={error} onRetry={() => window.location.reload()} />;

  const { sources = [], total = 1 } = data || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mb-4 block">← Back to Dashboard</Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🏆</span>
            <h1 className="text-3xl font-bold text-gray-900">Top Renewable Energy Sources — India</h1>
          </div>
          <p className="text-gray-600">National ranking of renewable energy sources by installed capacity (source: data.gov.in)</p>
        </div>

        {/* Ranked source cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {sources.map((s, i) => (
            <div
              key={s.key}
              className="bg-white rounded-xl p-5 shadow-sm border-2 border-gray-100 transition-all hover:border-gray-200"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl font-black text-gray-200">#{i + 1}</span>
                <span className="text-xl">{s.icon}</span>
              </div>
              <div className="font-semibold text-gray-900 text-sm mb-1">{s.name}</div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{fmt(s.value / 1000)} GW</div>
              <div className="text-xs text-gray-400 mt-1">{fmtPct(s.share)} of total</div>
              {/* Mini share bar */}
              <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width:`${s.share}%`, backgroundColor: s.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <SectionHeader
            title="Featured Renewable Installations"
            sub="Real examples of solar parks, wind farms, hydro dams, and bioenergy systems"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {RENEWABLE_INSTALLATIONS.map((item) => (
              <article key={item.name} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <img
                  src={item.image}
                  alt={`${item.name} in ${item.location}`}
                  className="h-48 w-full object-cover bg-gray-100"
                  loading="lazy"
                />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{item.type}</span>
                    <span className="text-xs text-gray-400">{item.location}</span>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">{item.name}</h2>
                  <p className="text-sm leading-6 text-gray-600 mb-4">{item.about}</p>
                  <a
                    href={item.creditUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Photo: {item.credit}
                  </a>
                </div>
              </article>
            ))}
          </div>

        </div>

        {/* Full source stats table */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Full Source Statistics" sub="National installed capacity breakdown" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {["Rank","Source","Capacity (MW)","Capacity (GW)","Share (%)"].map((h, i) => (
                  <th key={h} className={`py-3 px-4 font-semibold text-gray-700 ${i <= 1 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.map((s, i) => (
                <tr key={s.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-bold text-gray-400">#{i+1}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span style={{ color: s.color }}>●</span>
                      <span className="font-medium text-gray-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">{s.value.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-semibold">{fmt(s.value / 1000)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: s.color }}>
                      {fmtPct(s.share)}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td className="py-3 px-4" />
                <td className="py-3 px-4 text-gray-900">Total</td>
                <td className="py-3 px-4 text-right">{total.toLocaleString()}</td>
                <td className="py-3 px-4 text-right">{fmt(total / 1000)}</td>
                <td className="py-3 px-4 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ capacityData, sourceMixData, error }) {
  const totals = capacityData.reduce(
    (acc, d) => ({
      solar:      acc.solar      + (d.solar ?? 0),
      wind:       acc.wind       + (d.wind ?? 0),
      smallHydro: acc.smallHydro + (d.smallHydro ?? 0),
      largeHydro: acc.largeHydro + (d.largeHydro ?? 0),
      bio:        acc.bio        + (d.bio ?? 0),
      hydro:      acc.hydro      + (d.hydro ?? 0),
    }),
    { solar:0, wind:0, smallHydro:0, largeHydro:0, bio:0, hydro:0 }
  );
  const grandTotal = totals.solar + totals.wind + (totals.smallHydro + totals.largeHydro > 0 ? totals.smallHydro + totals.largeHydro : totals.hydro) + totals.bio;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Renewable Energy Monitoring Dashboard</h1>
              <p className="text-gray-600 mt-2">India's installed renewable energy capacity by state — data.gov.in</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link to="/top-sources" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm flex items-center gap-2">
                🏆 Top Sources
              </Link>
              <Link to="/yearwise" className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm flex items-center gap-2">
                📈 Year-wise Trends
              </Link>
              <Link to="/states" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm flex items-center gap-2">
                🗺️ India Map
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-yellow-600 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">Data Loading Issue</p>
              <p className="text-sm text-yellow-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[
            { icon:"⚡", label:"Grand Total",  value:grandTotal,         color:"#374151" },
            { icon:"☀️", label:"Solar",         value:totals.solar,       color:SOURCE_COLORS.solar },
            { icon:"💨", label:"Wind",          value:totals.wind,        color:SOURCE_COLORS.wind  },
            { icon:"💧", label:"Small Hydro",   value:totals.smallHydro,  color:SOURCE_COLORS.smallHydro },
            { icon:"🌊", label:"Large Hydro",   value:totals.largeHydro,  color:SOURCE_COLORS.largeHydro },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="text-xs font-medium text-gray-500">{m.label}</div>
              <div className="text-xl font-bold mt-1" style={{ color: m.color }}>{fmt(m.value / 1000)} GW</div>
              <div className="text-xs text-gray-400">{m.value.toLocaleString()} MW</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <SectionHeader title="Capacity by State / UT" sub="Solar, Wind, Small Hydro, Large Hydro, Bio — MW" />
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={capacityData.map((d) => ({ state:d.state, Solar:d.solar??0, Wind:d.wind??0, "Sm. Hydro":d.smallHydro??0, "Lg. Hydro":d.largeHydro??0, Bio:d.bio??0 }))}
              margin={{ top:10, right:20, left:0, bottom:70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="state" tick={{ fontSize:9, fill:"#6b7280" }} angle={-40} textAnchor="end" height={90} />
              <YAxis tick={{ fontSize:11, fill:"#6b7280" }} unit=" MW" />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v.toLocaleString()} MW`} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <Bar dataKey="Solar"      stackId="a" fill={SOURCE_COLORS.solar}      />
              <Bar dataKey="Wind"       stackId="a" fill={SOURCE_COLORS.wind}       />
              <Bar dataKey="Sm. Hydro"  stackId="a" fill={SOURCE_COLORS.smallHydro} />
              <Bar dataKey="Lg. Hydro"  stackId="a" fill={SOURCE_COLORS.largeHydro} />
              <Bar dataKey="Bio"        stackId="a" fill={SOURCE_COLORS.bio}        />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="National Energy Mix" sub="By source type" />
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sourceMixData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={3} dataKey="value">
                  {sourceMixData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Top States by Total Capacity" sub="GW installed" />
            <div className="space-y-3">
              {[...capacityData]
                .sort((a,b) => (b.solar+b.wind+b.hydro+b.bio)-(a.solar+a.wind+a.hydro+a.bio))
                .slice(0,7)
                .map((state, i) => {
                  const total = (state.solar+state.wind+state.hydro+state.bio)/1000;
                  return (
                    <div key={state.state} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5">{i+1}.</span>
                        <Link to={`/state/${encodeURIComponent(state.state)}`} className="font-medium text-gray-900 text-sm hover:text-blue-600">{state.state}</Link>
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">{fmt(total)} GW</span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Bio Power Leaders" sub="Top states by Bio Power (MW)" />
            <div className="space-y-3">
              {[...capacityData]
                .filter((s) => s.bio > 0)
                .sort((a,b) => b.bio - a.bio)
                .slice(0,7)
                .map((state, i) => (
                  <div key={state.state} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5">{i+1}.</span>
                      <Link to={`/state/${encodeURIComponent(state.state)}`} className="font-medium text-gray-900 text-sm hover:text-orange-600">{state.state}</Link>
                    </div>
                    <span className="font-semibold text-orange-700 text-sm">{state.bio.toLocaleString()} MW</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  const [capacityData,  setCapacityData]  = useState([]);
  const [sourceMixData, setSourceMixData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [capRes, mixRes] = await Promise.all([
          fetch(`${BASE_URL}/capacity`),
          fetch(`${BASE_URL}/source-mix`),
        ]);
        if (!capRes.ok) throw new Error("Failed to fetch capacity data");
        if (!mixRes.ok) throw new Error("Failed to fetch source mix data");
        setCapacityData(await capRes.json());
        setSourceMixData(await mixRes.json());
        setError(null);
      } catch (err) { setError(err.message); }
      finally        { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const content = loading ? (
    <LoadingScreen />
  ) : error && !capacityData.length ? (
    <ErrorScreen message={error} onRetry={() => window.location.reload()} />
  ) : (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Dashboard capacityData={capacityData} sourceMixData={sourceMixData} error={error} />} />
        <Route path="/yearwise"  element={<YearwiseDashboard />} />
        <Route path="/states"    element={<StateSelection capacityData={capacityData} />} />
        <Route path="/state/:stateName"         element={<StateDetail    capacityData={capacityData} />} />
        <Route path="/state/:stateName/predict" element={<StatePrediction />} />
        <Route path="/top-sources" element={<TopSources />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );

  return (
    <div className={darkMode ? "dark" : ""}>
      <DarkModeToggle darkMode={darkMode} onToggle={() => setDarkMode((value) => !value)} />
      {content}
    </div>
  );
}

export default App;
