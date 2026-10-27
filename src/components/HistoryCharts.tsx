import { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { TelemetryReading } from '../types/telemetry';
import type { TimeRange } from '../services/telemetryService';
import { downloadCsv } from '../services/telemetryService';
import type { TranslationKey } from '../i18n';
import { Download } from 'lucide-react';

type Tab = 'moisture' | 'temp' | 'npk';

interface Props {
  history: TelemetryReading[];
  range: TimeRange;
  onRange: (r: TimeRange) => void;
  loading: boolean;
  t: (k: TranslationKey) => string;
}

const RANGES: { id: TimeRange; key: TranslationKey }[] = [
  { id: '1h', key: 'range1h' },
  { id: '24h', key: 'range24h' },
  { id: '7d', key: 'range7d' },
  { id: '30d', key: 'range30d' },
];

const SERIES: Record<Tab, { key: string; label: TranslationKey; color: string; unit: string }[]> = {
  moisture: [{ key: 'soilMoisture', label: 'moistureL', color: '#3a9142', unit: '%' }],
  temp: [{ key: 'soilTemperature', label: 'tempL', color: '#b3352b', unit: '°C' }],
  npk: [
    { key: 'nitrogen', label: 'nitrogenN', color: '#2f6f3a', unit: 'mg/kg' },
    { key: 'phosphorus', label: 'phosphorusP', color: '#a03418', unit: 'mg/kg' },
    { key: 'potassium', label: 'potassiumK', color: '#5a2c94', unit: 'mg/kg' },
  ],
};

export default function HistoryCharts({ history, range, onRange, loading, t }: Props) {
  const [tab, setTab] = useState<Tab>('moisture');

  const data = useMemo(() =>
    history.slice(-300).map((h) => ({
      time: new Date(h.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      ...Object.fromEntries(SERIES[tab].map((s) => {
        const v = (h as unknown as Record<string, unknown>)[s.key];
        return [s.key, typeof v === 'number' && Number.isFinite(v) ? v : null]; // gaps stay null, never 0
      })),
    })),
    [history, tab]);

  const active = SERIES[tab];

  return (
    <div className="card overflow-hidden">
      <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {([
          { id: 'moisture' as Tab, key: 'moisture' as TranslationKey },
          { id: 'temp' as Tab, key: 'temp' as TranslationKey },
          { id: 'npk' as Tab, key: 'nutrientLabel' as TranslationKey },
        ]).map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`flex-1 min-w-[100px] py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === tb.id ? 'text-[var(--primary)] border-[var(--primary)]' : 'text-[var(--txt-3)] border-transparent hover:bg-[var(--surface-2)]'}`}>
            {t(tb.key)}
          </button>
        ))}
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => onRange(r.id)}
              className={`rounded-lg border px-3 py-1 text-[11px] font-semibold ${range === r.id ? 'border-[var(--primary)] text-[var(--good-text)] bg-[var(--good-soft)]' : 'border-[var(--border)] text-[var(--txt-3)] hover:bg-[var(--surface-2)]'}`}>
              {t(r.key)}
            </button>
          ))}
          <button onClick={() => downloadCsv(history, `soil-history-${range}.csv`)}
            disabled={history.length === 0}
            className="ml-auto rounded-lg border px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-40 hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border)', color: 'var(--txt-1)' }}>
            <Download size={13} aria-hidden /> {t('exportCsv')}
          </button>
        </div>

        {loading ? (
          <div className="h-[220px] skeleton" />
        ) : data.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-[var(--txt-3)] text-center px-4">{t('historyEmpty')}</div>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--txt-3)" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis stroke="var(--txt-3)" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--txt-1)', fontSize: 12 }}
                  labelStyle={{ color: 'var(--txt-2)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {active.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={`${t(s.label)} (${s.unit})`}
                    stroke={s.color} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
