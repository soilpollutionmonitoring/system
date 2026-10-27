import { useEffect, useState, useMemo } from 'react';
import { Leaf } from 'lucide-react';
import Sidebar, { type Tab } from './components/Sidebar';
import ConnectionStatus from './components/ConnectionStatus';
import SensorCard from './components/SensorCard';
import TelemetryChart, { type ChartSeries } from './components/TelemetryChart';
import RecentReadings from './components/RecentReadings';
import InterpretationPanel from './components/InterpretationPanel';
import thresholdsFile from './config/thresholds.json';
import type { TelemetryReading, Threshold, ConnectionState, TelemetryKey } from './types/telemetry';
import {
  subscribeLatest, subscribeConnection, fetchHistory, downloadCsv, type TimeRange,
} from './services/telemetryService';

const thresholds = thresholdsFile.thresholds as Record<string, Threshold>;

const CARDS: { key: TelemetryKey; name: string; kind: 'measured' | 'calculated' | 'interpretation' }[] = [
  { key: 'soilPH', name: 'Soil pH', kind: 'measured' },
  { key: 'soilMoisture', name: 'Soil Moisture', kind: 'measured' },
  { key: 'soilTemperature', name: 'Soil Temperature', kind: 'measured' },
  { key: 'electricalConductivity', name: 'Electrical Conductivity', kind: 'measured' },
  { key: 'tds', name: 'TDS', kind: 'calculated' },
  { key: 'nitrogen', name: 'Nitrogen (N)', kind: 'measured' },
  { key: 'phosphorus', name: 'Phosphorus (P)', kind: 'measured' },
  { key: 'potassium', name: 'Potassium (K)', kind: 'measured' },
];

const SERIES: ChartSeries[] = [
  { key: 'soilPH', label: 'pH', unit: 'pH', color: '#34d399' },
  { key: 'soilMoisture', label: 'Moisture', unit: '%', color: '#38bdf8' },
  { key: 'electricalConductivity', label: 'EC', unit: 'mS/cm', color: '#fbbf24' },
  { key: 'soilTemperature', label: 'Temp', unit: '°C', color: '#f87171' },
  { key: 'tds', label: 'TDS', unit: 'ppm', color: '#a78bfa' },
];

const RANGES: TimeRange[] = ['1h', '24h', '7d', '30d'];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [firebaseState, setFirebaseState] = useState<ConnectionState>('connecting');
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState<TelemetryReading | null>(null);
  const [range, setRange] = useState<TimeRange>('24h');
  const [history, setHistory] = useState<TelemetryReading[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [fbError, setFbError] = useState<string | null>(null);

  const deviceId = (import.meta.env.VITE_DEVICE_ID as string) || 'esp32-soil-001';

  useEffect(() => {
    const unsubLatest = subscribeLatest(
      deviceId,
      (r) => { setLatest(r); setFirebaseState((s) => (s === 'connecting' ? 'connected' : s)); },
      (e) => { setFirebaseState('error'); setFbError(e.message); }
    );
    const unsubConn = subscribeConnection((c) => {
      setConnected(c);
      setFirebaseState((s) => (s === 'missing-config' ? s : 'connected'));
    });
    return () => { unsubLatest(); unsubConn(); };
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    fetchHistory(deviceId, range)
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch((e: Error) => { if (!cancelled) setHistoryError(e.message); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [deviceId, range, latest?.timestamp]);

  const hasLatest = latest !== null;
  const loading = firebaseState === 'connecting' && !hasLatest;

  const chartSeries = useMemo(
    () => SERIES.filter((s) => history.some((h) => typeof (h as unknown as Record<string, unknown>)[s.key] === 'number')),
    [history]
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar active={tab} onChange={setTab} />

      <main className="flex-1 p-4 md:p-6">
        {/* Mobile header */}
        <header className="mb-3 md:hidden">
          <div className="flex items-center gap-2">
            <Leaf className="text-emerald-400" />
            <h1 className="text-lg font-bold leading-tight">Soil Pollution &amp; Fertility Monitoring System</h1>
          </div>
          <p className="text-xs text-slate-500">IoT-based real-time soil analysis</p>
        </header>

        <ConnectionStatus firebaseState={firebaseState} hasLatest={hasLatest} latest={latest} />
        {!connected && firebaseState === 'connected' && (
          <p className="mt-2 text-xs text-amber-400">Live listener offline — retrying connection…</p>
        )}
        {fbError && <p className="mt-2 text-xs text-red-400">Firebase error: {fbError}</p>}

        <Sidebar active={tab} onChange={setTab} mobile />

        {loading ? (
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-lg font-medium">Connecting to Firebase…</p>
            <p className="mt-1 text-sm text-slate-500">Loading live sensor data.</p>
          </div>
        ) : firebaseState === 'missing-config' ? (
          <div className="mt-8 rounded-xl border border-amber-800 bg-amber-950/40 p-8 text-center text-amber-300">
            <p className="text-lg font-medium">Firebase is not configured</p>
            <p className="mt-1 text-sm">Copy <code>.env.example</code> to <code>.env</code>, fill in your public Firebase web config, then restart the dev server.</p>
          </div>
        ) : tab === 'dashboard' && (
          <div className="mt-6 space-y-6">
            {!hasLatest ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
                <p className="text-lg font-medium">Waiting for sensor data</p>
                <p className="mt-1 text-sm text-slate-500">
                  No readings have arrived from device <code>{deviceId}</code> yet.
                  Once the ESP32 submits telemetry this dashboard will update live.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {CARDS.map((c) => (
                    <SensorCard key={c.key} name={c.name} paramKey={c.key} kind={c.kind}
                      reading={latest} threshold={thresholds[c.key]} />
                  ))}
                </div>
                <InterpretationPanel latest={latest} thresholds={thresholds} />
              </>
            )}
          </div>
        )}

        {tab === 'charts' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${range === r ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                  {r === '1h' ? '1 hour' : r === '24h' ? '24 hours' : r === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
              <button onClick={() => downloadCsv(history, `soil-history-${range}.csv`)}
                disabled={history.length === 0}
                className="ml-auto rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40">
                Export CSV
              </button>
            </div>
            {historyError && <p className="text-sm text-red-400">Failed to load history: {historyError}</p>}
            {historyLoading ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">Loading history…</div>
            ) : (
              chartSeries.map((s) => (
                <div key={s.key}>
                  <h3 className="mb-1 text-sm font-medium text-slate-300">{s.label}</h3>
                  <TelemetryChart data={history} series={[s]} />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${range === r ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                  {r === '1h' ? '1 hour' : r === '24h' ? '24 hours' : r === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
              <button onClick={() => downloadCsv(history, `soil-history-${range}.csv`)}
                disabled={history.length === 0}
                className="ml-auto rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40">
                Export CSV
              </button>
            </div>
            {historyLoading
              ? <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">Loading history…</div>
              : <RecentReadings rows={history} />}
          </div>
        )}

        {tab === 'thresholds' && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-400">
              Active thresholds — editable defaults in <code>src/config/thresholds.json</code>.
              All are general agronomy guidelines; adjust for your crop and soil type.
              Readings are <strong>not certified laboratory results</strong>.
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
                  <tr><th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Min</th><th className="px-3 py-2">Max</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Source</th></tr>
                </thead>
                <tbody>
                  {Object.entries(thresholds).map(([k, t]) => (
                    <tr key={k} className="border-b border-slate-800/60 last:border-0">
                      <td className="px-3 py-2">{k}</td>
                      <td className="px-3 py-2">{t.min ?? '—'}</td>
                      <td className="px-3 py-2">{t.max ?? '—'}</td>
                      <td className="px-3 py-2">{t.unit}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{t.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'about' && (
          <div className="mt-6 max-w-2xl space-y-3 text-sm text-slate-400">
            <p><strong className="text-slate-200">Pipeline:</strong> Soil sensors → ESP32 → HTTPS endpoint (Cloud Function <code>/api/telemetry</code>) → Firebase Realtime Database → this dashboard.</p>
            <p><strong className="text-slate-200">Data policy:</strong> Only real sensor readings are displayed. When no sensor data exists, the dashboard shows a waiting state — no values are simulated or estimated. NPK, heavy metals and toxic chemicals are never inferred from pH or moisture.</p>
            <p><strong className="text-slate-200">Disclaimer:</strong> Readings shown here are not certified laboratory results. Interpretations are guideline comparisons only.</p>
            <p><strong className="text-slate-200">Privacy:</strong> This dashboard is publicly viewable read-only. Anyone with the link can read the monitoring data. Visitors cannot write any data — all writes go through the authenticated backend only.</p>
          </div>
        )}
      </main>
    </div>
  );
}
