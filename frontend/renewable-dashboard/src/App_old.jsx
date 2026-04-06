import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from "recharts";

// ─── API LAYER ──────────────────────────────────────────────────────────────
// Replace BASE_URL with your Node backend URL
const BASE_URL = "http://localhost:4000/api";

const API = {
  getSummary:      () => fetch(`${BASE_URL}/summary`).then(r => r.json()),
  getProduction:   () => fetch(`${BASE_URL}/production`).then(r => r.json()),
  getCapacity:     () => fetch(`${BASE_URL}/capacity`).then(r => r.json()),
  getGridDemand:   () => fetch(`${BASE_URL}/grid-demand`).then(r => r.json()),
  getSourceMix:    () => fetch(`${BASE_URL}/source-mix`).then(r => r.json()),
  getCO2Savings:   () => fetch(`${BASE_URL}/co2-savings`).then(r => r.json()),
  getAlerts:       () => fetch(`${BASE_URL}/alerts`).then(r => r.json()),
  getWeather:      () => fetch(`${BASE_URL}/weather`).then(r => r.json()),
};

// ─── MOCK DATA (used when backend is unavailable) ─────────────────────────
const MOCK = {
  summary: {
    solar: { output: 4.82, capacity: 8.0, efficiency: 60.3, trend: +5.2, unit: "GW" },
    wind:  { output: 6.14, capacity: 9.5, efficiency: 64.6, trend: +2.8, unit: "GW" },
    hydro: { output: 3.21, capacity: 4.2, efficiency: 76.4, trend: -1.1, unit: "GW" },
    geo:   { output: 0.87, capacity: 1.0, efficiency: 87.0, trend: +0.3, unit: "GW" },
    tidal: { output: 0.34, capacity: 0.5, efficiency: 68.0, trend: +1.9, unit: "GW" },
    total: { output: 15.38, co2Saved: 12840, costSaved: 9420000, unit: "GW" },
  },
  production: [
    { time: "00:00", solar: 0, wind: 5.1, hydro: 3.2, geo: 0.9, tidal: 0.3 },
    { time: "02:00", solar: 0, wind: 5.6, hydro: 3.1, geo: 0.9, tidal: 0.3 },
    { time: "04:00", solar: 0.2, wind: 6.2, hydro: 3.0, geo: 0.8, tidal: 0.4 },
    { time: "06:00", solar: 1.4, wind: 6.8, hydro: 3.3, geo: 0.9, tidal: 0.3 },
    { time: "08:00", solar: 3.1, wind: 5.9, hydro: 3.5, geo: 0.9, tidal: 0.4 },
    { time: "10:00", solar: 4.5, wind: 5.4, hydro: 3.6, geo: 0.8, tidal: 0.3 },
    { time: "12:00", solar: 4.9, wind: 6.1, hydro: 3.4, geo: 0.9, tidal: 0.3 },
    { time: "14:00", solar: 4.8, wind: 6.4, hydro: 3.3, geo: 0.9, tidal: 0.4 },
    { time: "16:00", solar: 3.6, wind: 6.9, hydro: 3.1, geo: 0.8, tidal: 0.3 },
    { time: "18:00", solar: 1.8, wind: 7.1, hydro: 3.2, geo: 0.9, tidal: 0.3 },
    { time: "20:00", solar: 0.3, wind: 6.8, hydro: 3.4, geo: 0.9, tidal: 0.4 },
    { time: "22:00", solar: 0, wind: 6.2, hydro: 3.3, geo: 0.9, tidal: 0.3 },
  ],
  capacity: [
    { month: "Jan", solar: 7.1, wind: 8.8, hydro: 4.2, geo: 1.0, tidal: 0.4 },
    { month: "Feb", solar: 7.3, wind: 8.9, hydro: 4.1, geo: 1.0, tidal: 0.4 },
    { month: "Mar", solar: 7.6, wind: 9.0, hydro: 4.2, geo: 1.0, tidal: 0.5 },
    { month: "Apr", solar: 7.8, wind: 9.1, hydro: 4.1, geo: 1.0, tidal: 0.5 },
    { month: "May", solar: 7.9, wind: 9.2, hydro: 4.0, geo: 1.0, tidal: 0.5 },
    { month: "Jun", solar: 8.0, wind: 9.4, hydro: 3.9, geo: 1.0, tidal: 0.5 },
  ],
  gridDemand: [
    { time: "00:00", demand: 9.2, renewable: 9.5, deficit: 0 },
    { time: "02:00", demand: 8.4, renewable: 9.9, deficit: 0 },
    { time: "04:00", demand: 8.1, renewable: 10.4, deficit: 0 },
    { time: "06:00", demand: 9.8, renewable: 11.7, deficit: 0 },
    { time: "08:00", demand: 13.2, renewable: 13.0, deficit: 0.2 },
    { time: "10:00", demand: 15.4, renewable: 14.8, deficit: 0.6 },
    { time: "12:00", demand: 16.1, renewable: 15.6, deficit: 0.5 },
    { time: "14:00", demand: 15.8, renewable: 15.9, deficit: 0 },
    { time: "16:00", demand: 14.9, renewable: 13.7, deficit: 1.2 },
    { time: "18:00", demand: 15.6, renewable: 11.3, deficit: 4.3 },
    { time: "20:00", demand: 14.1, renewable: 11.4, deficit: 2.7 },
    { time: "22:00", demand: 11.2, renewable: 10.7, deficit: 0.5 },
  ],
  sourceMix: [
    { name: "Solar",   value: 31.3, color: "#EF9F27" },
    { name: "Wind",    value: 39.9, color: "#378ADD" },
    { name: "Hydro",   value: 20.9, color: "#1D9E75" },
    { name: "Geo",     value: 5.7,  color: "#D85A30" },
    { name: "Tidal",   value: 2.2,  color: "#7F77DD" },
  ],
  co2: [
    { month: "Jan", saved: 9800, baseline: 15200 },
    { month: "Feb", saved: 10200, baseline: 15200 },
    { month: "Mar", saved: 11100, baseline: 15200 },
    { month: "Apr", saved: 11600, baseline: 15200 },
    { month: "May", saved: 12300, baseline: 15200 },
    { month: "Jun", saved: 12840, baseline: 15200 },
  ],
  alerts: [
    { id: 1, type: "warning", msg: "Wind turbine W-07 output 18% below expected", time: "2m ago" },
    { id: 2, type: "info",    msg: "Solar array S-03 reached peak efficiency at 14:22", time: "8m ago" },
    { id: 3, type: "success", msg: "Grid demand fully covered by renewables 10:00–14:00", time: "1h ago" },
    { id: 4, type: "warning", msg: "Tidal generator maintenance scheduled for tomorrow", time: "2h ago" },
  ],
  weather: { temp: 22, condition: "Partly Cloudy", windSpeed: 14, irradiance: 680, humidity: 58 },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n, d = 1) => Number(n).toFixed(d);
const fmtK = n => n >= 1000 ? `${(n/1000).toFixed(1)}k` : n;

const SOURCE_COLORS = {
  solar: "#EF9F27", wind: "#378ADD", hydro: "#1D9E75", geo: "#D85A30", tidal: "#7F77DD",
};

const SOURCE_ICONS = { solar: "☀", wind: "💨", hydro: "💧", geo: "🌋", tidal: "🌊" };

function TrendBadge({ value }) {
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
      up ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      <span>{up ? '↗' : '↘'}</span>
      {Math.abs(value)}%
    </span>
  );
}

function GaugeBar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 13,
  color: "#111827",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
};

// ─── ALERT ICON ──────────────────────────────────────────────────────────────
function AlertDot({ type }) {
  const colors = {
    warning: "bg-yellow-400",
    info: "bg-blue-400",
    success: "bg-green-400",
    error: "bg-red-400"
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[type] || 'bg-gray-400'} flex-shrink-0 mt-1`} />;
}

// ─── ENERGY SOURCE CARD ──────────────────────────────────────────────────────
function SourceCard({ key: _k, type, data }) {
  const color = SOURCE_COLORS[type];
  const eff = data.efficiency;
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="text-lg">{SOURCE_ICONS[type]}</span>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {fmt(data.output)} <span className="text-sm text-gray-500 font-normal">{data.unit}</span>
          </div>
        </div>
        <TrendBadge value={data.trend} />
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Efficiency</span>
          <span className="font-semibold text-gray-900">{fmt(eff, 1)}%</span>
        </div>
        <GaugeBar value={eff} max={100} color={color} />
      </div>
      <div className="text-sm text-gray-600">
        Capacity: <span className="text-gray-900 font-semibold">{fmt(data.capacity)} {data.unit}</span>
      </div>
    </div>
  );
}

// ─── STAT STRIP ──────────────────────────────────────────────────────────────
function StatStrip({ total }) {
  const stats = [
    { label: "Total Output", value: `${fmt(total.output)} GW`, sub: "live", icon: "⚡" },
    { label: "CO₂ Saved", value: `${fmtK(total.co2Saved)} t`, sub: "today", icon: "🌱" },
    { label: "Cost Offset", value: `$${(total.costSaved / 1e6).toFixed(2)}M`, sub: "today", icon: "💰" },
    { label: "Grid Coverage", value: "95.7%", sub: "current", icon: "🔋" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {stats.map(s => (
        <div key={s.label} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{s.icon}</span>
            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">{s.sub}</span>
          </div>
          <div className="text-sm font-medium text-gray-600 mb-1">{s.label}</div>
          <div className="text-2xl font-bold text-gray-900">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CHARTS ──────────────────────────────────────────────────────────────────
function ProductionChart({ data }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <SectionHeader title="Energy Production — 24h" sub="GW by source" />
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            {Object.entries(SOURCE_COLORS).map(([k, c]) => (
              <linearGradient key={k} id={`g_${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c} stopOpacity={0.4} />
                <stop offset="95%" stopColor={c} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
          {Object.entries(SOURCE_COLORS).map(([k, c]) => (
            <Area key={k} type="monotone" dataKey={k} stroke={c} fill={`url(#g_${k})`} strokeWidth={2} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 flex-wrap mt-4">
        {Object.entries(SOURCE_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
            {k.charAt(0).toUpperCase() + k.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

function CapacityChart({ data }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <SectionHeader title="Installed Capacity" sub="GW — monthly view" />
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barSize={12}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
          {Object.entries(SOURCE_COLORS).map(([k, c]) => (
            <Bar key={k} dataKey={k} fill={c} radius={[3, 3, 0, 0]} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GridDemandChart({ data }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <SectionHeader title="Grid Demand vs Renewable Supply" sub="GW — today" />
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="demand" stroke="#ef4444" strokeWidth={3} dot={false} name="Demand" />
          <Line type="monotone" dataKey="renewable" stroke="#10b981" strokeWidth={3} dot={false} name="Renewable" strokeDasharray="8 4" />
          <Line type="monotone" dataKey="deficit" stroke="#f59e0b" strokeWidth={2} dot={false} name="Deficit" />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-4">
        {[["Demand", "#ef4444"], ["Renewable", "#10b981"], ["Deficit", "#f59e0b"]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-4 h-1 rounded" style={{ backgroundColor: c }} /> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function SourceMixChart({ data }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <SectionHeader title="Source Mix" sub="% of total output" />
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="value">
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v.toFixed(1)}%`} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-3 mt-4">
        {data.map(d => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600">{d.name}</span>
            </span>
            <span className="font-semibold text-gray-900">{d.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CO2Chart({ data }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <SectionHeader title="CO₂ Emissions Avoided" sub="Tonnes — vs baseline" />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barSize={18}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
          <Bar dataKey="baseline" fill="#d1d5db" radius={[3, 3, 0, 0]} name="Baseline" />
          <Bar dataKey="saved" fill="#10b981" radius={[3, 3, 0, 0]} name="Saved" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── WEATHER PANEL ───────────────────────────────────────────────────────────
function WeatherPanel({ w }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <SectionHeader title="Site Conditions" sub="live" />
      <div className="space-y-4">
        {[
          ["Temperature", `${w.temp}°C`, "🌡️"],
          ["Wind Speed", `${w.windSpeed} m/s`, "💨"],
          ["Solar Irradiance", `${w.irradiance} W/m²`, "☀"],
          ["Humidity", `${w.humidity}%`, "💧"],
          ["Condition", w.condition, "🌤️"],
        ].map(([l, v, icon]) => (
          <div key={l} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-gray-600">
              <span>{icon}</span>
              {l}
            </span>
            <span className="font-semibold text-gray-900">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ALERTS PANEL ────────────────────────────────────────────────────────────
function AlertsPanel({ alerts }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <SectionHeader title="System Alerts" sub={`${alerts.length} active`} />
      <div className="space-y-4">
        {alerts.map(a => (
          <div key={a.id} className="flex items-start gap-3">
            <AlertDot type={a.type} />
            <div className="flex-1">
              <div className="text-sm text-gray-900 leading-relaxed">{a.msg}</div>
              <div className="text-xs text-gray-500 mt-1">{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SHARED STYLES & COMPONENTS ──────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-semibold text-gray-900">{title}</div>
      {sub && <div className="text-sm text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">⚡</div>
        <div className="text-lg text-gray-600">Loading dashboard…</div>
      </div>
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function Navbar({ lastUpdated, useMock, onRefresh }) {
  return (
    <div className="bg-white rounded-xl p-6 mb-8 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌿</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Renewable Energy Control Center</h1>
            <p className="text-sm text-gray-600">Real-time monitoring & analytics</p>
          </div>
          {useMock && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
              Demo Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Updated {lastUpdated}</span>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <span>↻</span>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [useMock, setUseMock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("—");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, production, capacity, gridDemand, sourceMix, co2, alerts, weather] = await Promise.all([
        API.getSummary(), API.getProduction(), API.getCapacity(),
        API.getGridDemand(), API.getSourceMix(), API.getCO2Savings(),
        API.getAlerts(), API.getWeather(),
      ]);
      setData({ summary, production, capacity, gridDemand, sourceMix, co2, alerts, weather });
      setUseMock(false);
    } catch {
      // Backend unavailable — use mock data
      setData({
        summary: MOCK.summary, production: MOCK.production, capacity: MOCK.capacity,
        gridDemand: MOCK.gridDemand, sourceMix: MOCK.sourceMix, co2: MOCK.co2,
        alerts: MOCK.alerts, weather: MOCK.weather,
      });
      setUseMock(true);
    }
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(loadData, 60000);
    return () => clearInterval(t);
  }, [loadData]);

  if (loading || !data) return <Loader />;

  const { summary, production, capacity, gridDemand, sourceMix, co2, alerts, weather } = data;
  const sources = ["solar", "wind", "hydro", "geo", "tidal"];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Navbar lastUpdated={lastUpdated} useMock={useMock} onRefresh={loadData} />

        {/* Summary KPI Strip */}
        <StatStrip total={summary.total} />

        {/* Energy Source Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {sources.map(s => <SourceCard key={s} type={s} data={summary[s]} />)}
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ProductionChart data={production} />
          <CapacityChart data={capacity} />
        </div>

        {/* Grid Demand — full width */}
        <div className="mb-8">
          <GridDemandChart data={gridDemand} />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <SourceMixChart data={sourceMix} />
          <CO2Chart data={co2} />
          <div className="space-y-8">
            <WeatherPanel w={weather} />
            <AlertsPanel alerts={alerts} />
          </div>
        </div>
      </div>
    </div>
  );
}

const SOURCE_ICONS = { solar: "☀", wind: "💨", hydro: "💧", geo: "🌋", tidal: "🌊" };

function TrendBadge({ value }) {
  const up = value >= 0;
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
      background: up ? "#EAF3DE" : "#FCEBEB",
      color: up ? "#3B6D11" : "#A32D2D",
    }}>
      {up ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  );
}

function GaugeBar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ background: "#e5e7eb", borderRadius: 99, height: 6, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.8s ease" }} />
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  background: "var(--color-background-primary)",
  border: "0.5px solid var(--color-border-secondary)",
  borderRadius: 8, padding: "10px 14px", fontSize: 13,
  color: "var(--color-text-primary)",
};

// ─── ALERT ICON ──────────────────────────────────────────────────────────────
function AlertDot({ type }) {
  const colors = { warning: "#EF9F27", info: "#378ADD", success: "#1D9E75", error: "#E24B4A" };
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colors[type] || "#888", marginRight: 8, flexShrink: 0, marginTop: 5 }} />;
}

// ─── ENERGY SOURCE CARD ──────────────────────────────────────────────────────
function SourceCard({ key: _k, type, data }) {
  const color = SOURCE_COLORS[type];
  const eff = data.efficiency;
  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 12, padding: "16px 20px",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
            {SOURCE_ICONS[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
          </div>
          <div style={{ fontSize: 26, fontWeight: 500, color: "var(--color-text-primary)" }}>
            {fmt(data.output)} <span style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>{data.unit}</span>
          </div>
        </div>
        <TrendBadge value={data.trend} />
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>
          <span>Efficiency</span><span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{fmt(eff, 1)}%</span>
        </div>
        <GaugeBar value={eff} max={100} color={color} />
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
        Capacity: <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{fmt(data.capacity)} {data.unit}</span>
      </div>
    </div>
  );
}

// ─── STAT STRIP ──────────────────────────────────────────────────────────────
function StatStrip({ total }) {
  const stats = [
    { label: "Total Output", value: `${fmt(total.output)} GW`, sub: "live" },
    { label: "CO₂ Saved", value: `${fmtK(total.co2Saved)} t`, sub: "today" },
    { label: "Cost Offset", value: `$${(total.costSaved / 1e6).toFixed(2)}M`, sub: "today" },
    { label: "Grid Coverage", value: "95.7%", sub: "current" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 24 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: "var(--color-background-secondary)",
          borderRadius: 8, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" }}>{s.value}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CHARTS ──────────────────────────────────────────────────────────────────
function ProductionChart({ data }) {
  return (
    <div style={cardStyle}>
      <SectionHeader title="Energy Production — 24h" sub="GW by source" />
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            {Object.entries(SOURCE_COLORS).map(([k, c]) => (
              <linearGradient key={k} id={`g_${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c} stopOpacity={0.35} />
                <stop offset="95%" stopColor={c} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
          {Object.entries(SOURCE_COLORS).map(([k, c]) => (
            <Area key={k} type="monotone" dataKey={k} stroke={c} fill={`url(#g_${k})`} strokeWidth={2} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {Object.entries(SOURCE_COLORS).map(([k, c]) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-text-secondary)" }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: c }} />
            {k.charAt(0).toUpperCase() + k.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

function CapacityChart({ data }) {
  return (
    <div style={cardStyle}>
      <SectionHeader title="Installed Capacity" sub="GW — monthly view" />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barSize={10}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
          {Object.entries(SOURCE_COLORS).map(([k, c]) => (
            <Bar key={k} dataKey={k} fill={c} radius={[2, 2, 0, 0]} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GridDemandChart({ data }) {
  return (
    <div style={cardStyle}>
      <SectionHeader title="Grid Demand vs Renewable Supply" sub="GW — today" />
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="demand" stroke="#E24B4A" strokeWidth={2} dot={false} name="Demand" />
          <Line type="monotone" dataKey="renewable" stroke="#1D9E75" strokeWidth={2} dot={false} name="Renewable" strokeDasharray="5 3" />
          <Line type="monotone" dataKey="deficit" stroke="#EF9F27" strokeWidth={1.5} dot={false} name="Deficit" />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        {[["Demand", "#E24B4A"], ["Renewable", "#1D9E75"], ["Deficit", "#EF9F27"]].map(([l, c]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-text-secondary)" }}>
            <span style={{ display: "inline-block", width: 14, height: 2, background: c, borderRadius: 1 }} /> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function SourceMixChart({ data }) {
  return (
    <div style={cardStyle}>
      <SectionHeader title="Source Mix" sub="% of total output" />
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => `${v.toFixed(1)}%`} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, display: "inline-block" }} />
              <span style={{ color: "var(--color-text-secondary)" }}>{d.name}</span>
            </span>
            <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{d.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CO2Chart({ data }) {
  return (
    <div style={cardStyle}>
      <SectionHeader title="CO₂ Emissions Avoided" sub="Tonnes — vs baseline" />
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
          <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
          <Bar dataKey="baseline" fill="#D3D1C7" radius={[2, 2, 0, 0]} name="Baseline" />
          <Bar dataKey="saved" fill="#1D9E75" radius={[2, 2, 0, 0]} name="Saved" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── WEATHER PANEL ───────────────────────────────────────────────────────────
function WeatherPanel({ w }) {
  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHeader title="Site Conditions" sub="live" />
      {[
        ["Temperature", `${w.temp}°C`],
        ["Wind Speed", `${w.windSpeed} m/s`],
        ["Solar Irradiance", `${w.irradiance} W/m²`],
        ["Humidity", `${w.humidity}%`],
        ["Condition", w.condition],
      ].map(([l, v]) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--color-text-secondary)" }}>{l}</span>
          <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ─── ALERTS PANEL ────────────────────────────────────────────────────────────
function AlertsPanel({ alerts }) {
  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHeader title="System Alerts" sub={`${alerts.length} active`} />
      {alerts.map(a => (
        <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertDot type={a.type} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{a.msg}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SHARED STYLES & COMPONENTS ──────────────────────────────────────────────
const cardStyle = {
  background: "var(--color-background-primary)",
  border: "0.5px solid var(--color-border-tertiary)",
  borderRadius: 12, padding: "16px 20px",
};

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Loading dashboard…</div>
      </div>
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function Navbar({ lastUpdated, useMock, onRefresh }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)",
      background: "var(--color-background-primary)", marginBottom: 24,
      borderRadius: 12, flexWrap: "wrap", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>🌿</span>
        <span style={{ fontWeight: 500, fontSize: 16, color: "var(--color-text-primary)" }}>Renewable Energy Control Center</span>
        {useMock && (
          <span style={{ fontSize: 11, background: "#FAEEDA", color: "#854F0B", padding: "2px 8px", borderRadius: 99 }}>
            Demo data — connect backend
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Updated {lastUpdated}</span>
        <button onClick={onRefresh} style={{
          fontSize: 12, padding: "6px 14px", borderRadius: 8,
          border: "0.5px solid var(--color-border-secondary)",
          background: "transparent", color: "var(--color-text-primary)", cursor: "pointer",
        }}>↻ Refresh</button>
      </div>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [useMock, setUseMock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("—");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, production, capacity, gridDemand, sourceMix, co2, alerts, weather] = await Promise.all([
        API.getSummary(), API.getProduction(), API.getCapacity(),
        API.getGridDemand(), API.getSourceMix(), API.getCO2Savings(),
        API.getAlerts(), API.getWeather(),
      ]);
      setData({ summary, production, capacity, gridDemand, sourceMix, co2, alerts, weather });
      setUseMock(false);
    } catch {
      // Backend unavailable — use mock data
      setData({
        summary: MOCK.summary, production: MOCK.production, capacity: MOCK.capacity,
        gridDemand: MOCK.gridDemand, sourceMix: MOCK.sourceMix, co2: MOCK.co2,
        alerts: MOCK.alerts, weather: MOCK.weather,
      });
      setUseMock(true);
    }
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(loadData, 60000);
    return () => clearInterval(t);
  }, [loadData]);

  if (loading || !data) return <Loader />;

  const { summary, production, capacity, gridDemand, sourceMix, co2, alerts, weather } = data;
  const sources = ["solar", "wind", "hydro", "geo", "tidal"];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 0 40px", fontFamily: "var(--font-sans)" }}>
      <Navbar lastUpdated={lastUpdated} useMock={useMock} onRefresh={loadData} />

      {/* Summary KPI Strip */}
      <StatStrip total={summary.total} />

      {/* Energy Source Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12, marginBottom: 24 }}>
        {sources.map(s => <SourceCard key={s} type={s} data={summary[s]} />)}
      </div>

      {/* Main Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <ProductionChart data={production} />
        <CapacityChart data={capacity} />
      </div>

      {/* Grid Demand — full width */}
      <div style={{ marginBottom: 16 }}>
        <GridDemandChart data={gridDemand} />
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <SourceMixChart data={sourceMix} />
        <CO2Chart data={co2} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <WeatherPanel w={weather} />
          <AlertsPanel alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
