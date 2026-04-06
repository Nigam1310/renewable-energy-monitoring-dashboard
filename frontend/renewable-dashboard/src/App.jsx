import { useState, useEffect } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  Link, useParams, useNavigate,
} from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  Legend, LineChart, Line, ComposedChart,
} from "recharts";

// ── API ───────────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:4000/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt   = (n, d = 1) => Number(n).toFixed(d);
const fmtPct = (n) => Number(n).toFixed(1) + "%";

const SOURCE_COLORS = {
  solar: "#EF9F27", wind: "#378ADD", hydro: "#1D9E75",
  smallHydro: "#1D9E75", largeHydro: "#7F77DD", geo: "#D85A30", tidal: "#7F77DD", bio: "#D85A30",
};
const SOURCE_ICONS = { solar: "☀", wind: "💨", hydro: "💧", geo: "🌋", tidal: "🌊" };

const CUSTOM_TOOLTIP_STYLE = {
  background: "white", border: "1px solid #e5e7eb",
  borderRadius: 8, padding: "10px 14px",
  fontSize: 13, color: "#111827",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
};

// ── Shared components ─────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-semibold text-gray-900">{title}</div>
      {sub && <div className="text-sm text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function GaugeBar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
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
        <button
          onClick={onRetry}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ── Yearwise Dashboard ────────────────────────────────────────────────────────
function YearwiseDashboard() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activePieYear, setActivePieYear] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/yearwise`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        setData(json);
        setActivePieYear(json[json.length - 1]?.year ?? null);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingScreen message="Loading year-wise capacity data..." />;
  if (error && !data.length)
    return <ErrorScreen message={error} onRetry={() => window.location.reload()} />;

  const last  = data[data.length - 1];
  const first = data[0];

  const totalLast  = last  ? last.solar  + last.wind  + last.smallHydro  + last.largeHydro  : 0;
  const totalFirst = first ? first.solar + first.wind + first.smallHydro + first.largeHydro : 0;

  const solarGrowthX = first && first.solar > 0
    ? ((last.solar / first.solar)).toFixed(1)
    : "—";

  // Data for stacked bar & line charts (convert MW → GW)
  const chartData = data.map((d) => ({
    year:       d.year,
    label:      d.label || d.year,
    Solar:      parseFloat((d.solar      / 1000).toFixed(2)),
    Wind:       parseFloat((d.wind       / 1000).toFixed(2)),
    "Small Hydro": parseFloat((d.smallHydro / 1000).toFixed(2)),
    "Large Hydro": parseFloat((d.largeHydro / 1000).toFixed(2)),
    Total:      parseFloat(((d.solar + d.wind + d.smallHydro + d.largeHydro) / 1000).toFixed(2)),
  }));

  // Pie data for selected year
  const pieRow = data.find((d) => d.year === activePieYear) || last;
  const pieTotal = pieRow
    ? pieRow.solar + pieRow.wind + pieRow.smallHydro + pieRow.largeHydro
    : 1;
  const pieData = pieRow
    ? [
        { name: "Solar",       value: parseFloat((pieRow.solar      / 1000).toFixed(2)), color: SOURCE_COLORS.solar },
        { name: "Wind",        value: parseFloat((pieRow.wind       / 1000).toFixed(2)), color: SOURCE_COLORS.wind  },
        { name: "Small Hydro", value: parseFloat((pieRow.smallHydro / 1000).toFixed(2)), color: SOURCE_COLORS.smallHydro },
        { name: "Large Hydro", value: parseFloat((pieRow.largeHydro / 1000).toFixed(2)), color: SOURCE_COLORS.largeHydro },
      ]
    : [];

  // Growth rate rows
  const growthRows = data.slice(1).map((d, i) => {
    const prev = data[i];
    const grow = (key) =>
      prev[key] > 0 ? (((d[key] - prev[key]) / prev[key]) * 100).toFixed(1) : "—";
    return {
      year:       d.year,
      solar:      grow("solar"),
      wind:       grow("wind"),
      smallHydro: grow("smallHydro"),
      largeHydro: grow("largeHydro"),
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm">
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Year-wise RE Installed Capacity</h1>
          <p className="text-gray-600 mt-2">
            Cumulative renewable energy capacity in India — 2014 to 2022 (source: data.gov.in)
          </p>
          {error && (
            <div className="mt-3 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-3 py-2 rounded-lg">
              ⚠️ API unavailable — showing fallback data
            </div>
          )}
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: "⚡",
              label: "Total capacity (latest)",
              value: `${fmt(totalLast / 1000)} GW`,
              sub: `${fmt(totalFirst / 1000)} GW in ${first?.year}`,
            },
            {
              icon: "☀",
              label: `Solar (${last?.year})`,
              value: `${fmt(last?.solar / 1000)} GW`,
              sub: `${solarGrowthX}× growth since ${first?.year}`,
            },
            {
              icon: "💨",
              label: `Wind (${last?.year})`,
              value: `${fmt(last?.wind / 1000)} GW`,
              sub: `${fmt((last?.wind / 1000) - (first?.wind / 1000))} GW added`,
            },
            {
              icon: "📈",
              label: "Solar share (latest)",
              value: fmtPct((last?.solar / totalLast) * 100),
              sub: `was ${fmtPct((first?.solar / totalFirst) * 100)} in ${first?.year}`,
            },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="text-xs font-medium text-gray-500 mb-1">{m.label}</div>
              <div className="text-2xl font-bold text-gray-900">{m.value}</div>
              <div className="text-xs text-gray-400 mt-1">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Row 1: Stacked bar + Line chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Stacked bar — capacity by source */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Cumulative capacity by source" sub="GW installed per year" />
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

          {/* Line chart — growth trajectories */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Growth trajectories" sub="GW over time per source" />
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" GW" />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v} GW`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Solar"       stroke={SOURCE_COLORS.solar}      strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Wind"        stroke={SOURCE_COLORS.wind}       strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Small Hydro" stroke={SOURCE_COLORS.smallHydro} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Large Hydro" stroke={SOURCE_COLORS.largeHydro} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2: Solar vs Wind race + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Solar vs Wind race */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Solar vs wind — the race" sub="GW comparison, year by year" />
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" GW" />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v} GW`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Solar" fill={SOURCE_COLORS.solar} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Wind"  fill={SOURCE_COLORS.wind}  radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie — source mix by year */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Source mix by year" sub="Select a year to see the breakdown" />

            {/* Year selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {data.map((d) => (
                <button
                  key={d.year}
                  onClick={() => setActivePieYear(d.year)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    activePieYear === d.year
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {d.year}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} GW`} />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2 text-sm flex-1">
                {pieData.map((item) => {
                  const sharePct = pieTotal > 0
                    ? ((item.value / (pieTotal / 1000)) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-gray-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-900">{item.value} GW</span>
                        <span className="text-gray-400 ml-2 text-xs">{sharePct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Total GW area chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <SectionHeader title="Total installed capacity (all sources)" sub="Combined GW — stacked area view" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <defs>
                {["Solar","Wind","Small Hydro","Large Hydro"].map((key, i) => {
                  const colors = [SOURCE_COLORS.solar, SOURCE_COLORS.wind, SOURCE_COLORS.smallHydro, SOURCE_COLORS.largeHydro];
                  return (
                    <linearGradient key={key} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={colors[i]} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={colors[i]} stopOpacity={0.1} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" GW" />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v} GW`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Solar"       stackId="1" stroke={SOURCE_COLORS.solar}      fill={`url(#grad0)`} />
              <Area type="monotone" dataKey="Wind"        stackId="1" stroke={SOURCE_COLORS.wind}       fill={`url(#grad1)`} />
              <Area type="monotone" dataKey="Small Hydro" stackId="1" stroke={SOURCE_COLORS.smallHydro} fill={`url(#grad2)`} />
              <Area type="monotone" dataKey="Large Hydro" stackId="1" stroke={SOURCE_COLORS.largeHydro} fill={`url(#grad3)`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Row 4: Growth rate table */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Year-on-year growth rates" sub="Percentage increase per source" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Year", "Solar", "Wind", "Small Hydro", "Large Hydro"].map((h) => (
                    <th
                      key={h}
                      className={`py-3 px-4 font-semibold text-gray-700 text-sm ${h === "Year" ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {growthRows.map((row) => {
                  const colorFor = (v) => {
                    const n = parseFloat(v);
                    if (isNaN(n)) return "text-gray-400";
                    if (n >= 20) return "text-green-700 font-semibold";
                    if (n >= 5)  return "text-yellow-700";
                    return "text-gray-500";
                  };
                  const bgFor = (v) => {
                    const n = parseFloat(v);
                    if (isNaN(n)) return "";
                    if (n >= 20) return "bg-green-50";
                    if (n >= 5)  return "bg-yellow-50";
                    return "";
                  };
                  return (
                    <tr key={row.year} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-gray-900">{row.year}</td>
                      {["solar", "wind", "smallHydro", "largeHydro"].map((key) => (
                        <td key={key} className={`py-3 px-4 text-right ${bgFor(row[key])}`}>
                          <span className={colorFor(row[key])}>
                            {row[key] !== "—" ? `+${row[key]}%` : "—"}
                          </span>
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

// ── State Selection ───────────────────────────────────────────────────────────
function StateSelection({ capacityData }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 text-sm">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">State-wise Renewable Energy Analysis</h1>
          <p className="text-gray-600 mt-2">Select a state to view detailed renewable energy capacity and performance data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capacityData.map((state) => {
            const totalCapacity = (state.solar + state.wind + state.hydro + state.bio) / 1000;
            const topSource = ["solar","wind","hydro","bio"].reduce((a, b) =>
              state[a] > state[b] ? a : b
            );
            return (
              <div
                key={state.state}
                onClick={() => navigate(`/state/${encodeURIComponent(state.state)}`)}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{state.state}</h3>
                    <p className="text-sm text-gray-500">Total: {fmt(totalCapacity)} GW</p>
                  </div>
                  <span className="text-2xl">{SOURCE_ICONS[topSource]}</span>
                </div>
                <div className="space-y-2">
                  {["solar","wind","hydro","bio"].map((src) => (
                    <div key={src} className="flex justify-between text-sm">
                      <span className="capitalize text-gray-600">{src}</span>
                      <span className="font-semibold">{fmt(state[src] / 1000)} GW</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-blue-600 font-medium">Click to view detailed analysis →</span>
                </div>
              </div>
            );
          })}
        </div>
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

  const capacityBreakdown = [
    { name: "Solar", value: stateData.solar / 1000, color: SOURCE_COLORS.solar },
    { name: "Wind",  value: stateData.wind  / 1000, color: SOURCE_COLORS.wind  },
    { name: "Hydro", value: stateData.hydro / 1000, color: SOURCE_COLORS.hydro },
    { name: "Bio",   value: stateData.bio   / 1000, color: SOURCE_COLORS.bio   },
  ].filter((i) => i.value > 0);

  const totalCapacity = capacityBreakdown.reduce((s, i) => s + i.value, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/states" className="text-blue-600 hover:text-blue-800 text-sm">← Back to States</Link>
            <Link to="/"       className="text-blue-600 hover:text-blue-800 text-sm">← Dashboard</Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{stateData.state} — Renewable Energy</h1>
          <p className="text-gray-600 mt-2">Detailed capacity breakdown and performance metrics</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: "⚡", label: "Total Capacity", value: `${fmt(totalCapacity)} GW` },
            { icon: "☀",  label: "Solar",          value: `${fmt(stateData.solar / 1000)} GW` },
            { icon: "💨", label: "Wind",            value: `${fmt(stateData.wind  / 1000)} GW` },
            { icon: "💧", label: "Hydro",           value: `${fmt(stateData.hydro / 1000)} GW` },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="text-xs font-medium text-gray-500">{m.label}</div>
              <div className="text-2xl font-bold text-gray-900">{m.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Capacity Breakdown" sub="By energy source" />
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={capacityBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  paddingAngle={3} dataKey="value">
                  {capacityBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v.toFixed(2)} GW`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Capacity Breakdown Table" sub="All energy sources" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {["Source","Capacity (GW)","Share","Efficiency"].map((h, i) => (
                  <th key={h} className={`py-3 px-4 font-semibold text-gray-700 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capacityBreakdown.map((src) => {
                const effMap = { solar: "65%", wind: "60%", hydro: "72%", bio: "45%" };
                const bgMap  = { solar: "bg-yellow-100 text-yellow-800", wind: "bg-blue-100 text-blue-800",
                                 hydro: "bg-green-100 text-green-800",   bio:  "bg-orange-100 text-orange-800" };
                const key = src.name.toLowerCase();
                return (
                  <tr key={src.name} className="border-b border-gray-100">
                    <td className="py-3 px-4 flex items-center gap-2 font-medium text-gray-900">
                      <span style={{ color: src.color }}>●</span>{src.name}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">{fmt(src.value)}</td>
                    <td className="py-3 px-4 text-right">{fmtPct((src.value / totalCapacity) * 100)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgMap[key]}`}>
                        {effMap[key]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ capacityData, sourceMixData, error }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Renewable Energy Monitoring Dashboard</h1>
              <p className="text-gray-600 mt-2">Real-time monitoring of India's renewable energy capacity and performance</p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/yearwise"
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                📈 Year-wise Trends
              </Link>
              <Link
                to="/states"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                📊 View States
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-yellow-600 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">Data Loading Issue</p>
              <p className="text-sm text-yellow-700 mt-0.5">{error} — using fallback data</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: "⚡", label: "Total Capacity",
              value: `${fmt(capacityData.reduce((s, d) => s + d.solar + d.wind + d.hydro + d.bio, 0) / 1000)} GW`,
            },
            {
              icon: "☀", label: "Solar Capacity",
              value: `${fmt(capacityData.reduce((s, d) => s + d.solar, 0) / 1000)} GW`,
            },
            {
              icon: "💨", label: "Wind Capacity",
              value: `${fmt(capacityData.reduce((s, d) => s + d.wind, 0) / 1000)} GW`,
            },
            {
              icon: "💧", label: "Hydro Capacity",
              value: `${fmt(capacityData.reduce((s, d) => s + d.hydro, 0) / 1000)} GW`,
            },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="text-xs font-medium text-gray-500">{m.label}</div>
              <div className="text-2xl font-bold text-gray-900">{m.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Capacity by State" sub="Installed renewable energy capacity" />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={capacityData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="state" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-40} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                <Bar dataKey="solar" stackId="a" fill={SOURCE_COLORS.solar} name="Solar" />
                <Bar dataKey="wind"  stackId="a" fill={SOURCE_COLORS.wind}  name="Wind"  />
                <Bar dataKey="hydro" stackId="a" fill={SOURCE_COLORS.hydro} name="Hydro" />
                <Bar dataKey="bio"   stackId="a" fill={SOURCE_COLORS.bio}   name="Bio"   />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Energy Mix" sub="By source type" />
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sourceMixData} cx="50%" cy="50%" innerRadius={40} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {sourceMixData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Top States" sub="By total capacity" />
            <div className="space-y-3">
              {[...capacityData]
                .sort((a, b) => (b.solar + b.wind + b.hydro + b.bio) - (a.solar + a.wind + a.hydro + a.bio))
                .slice(0, 5)
                .map((state, i) => {
                  const total = (state.solar + state.wind + state.hydro + state.bio) / 1000;
                  return (
                    <div key={state.state} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                        <span className="font-medium text-gray-900 text-sm">{state.state}</span>
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">{fmt(total)} GW</span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <SectionHeader title="Explore More" sub="Detailed analysis" />
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Dive deeper into state-level data or explore India's renewable capacity growth from 2014 to 2022.
              </p>
              <Link to="/states" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                📍 View all states →
              </Link>
              <Link to="/yearwise" className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-medium">
                📈 Year-wise trends →
              </Link>
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
  const [productionData, setProductionData] = useState([]);
  const [sourceMixData,  setSourceMixData]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [capRes, mixRes] = await Promise.all([
          fetch(`${BASE_URL}/capacity`),
          fetch(`${BASE_URL}/source-mix`),
        ]);
        if (!capRes.ok)  throw new Error("Failed to fetch capacity data");
        if (!mixRes.ok)  throw new Error("Failed to fetch source mix data");

        setCapacityData(await capRes.json());
        setSourceMixData(await mixRes.json());
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingScreen />;
  if (error && !capacityData.length)
    return <ErrorScreen message={error} onRetry={() => window.location.reload()} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              capacityData={capacityData}
              sourceMixData={sourceMixData}
              error={error}
            />
          }
        />
        <Route path="/yearwise" element={<YearwiseDashboard />} />
        <Route path="/states"   element={<StateSelection capacityData={capacityData} />} />
        <Route path="/state/:stateName" element={<StateDetail capacityData={capacityData} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
