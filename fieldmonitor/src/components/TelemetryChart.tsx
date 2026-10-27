import { useId } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import type { TelemetryReading } from '../types/telemetry';

export interface ChartSeries {
  key: string; // field on reading
  label: string;
  unit: string;
  color: string;
}

interface Props {
  data: TelemetryReading[];
  series: ChartSeries[];
}

export default function TelemetryChart({ data, series }: Props) {
  const id = useId();
  const rows = data
    .filter((d) => series.some((s) => typeof (d as unknown as Record<string, unknown>)[s.key] === 'number'))
    .map((d) => ({
      time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      full: new Date(d.timestamp).toLocaleString(),
      ...Object.fromEntries(series.map((s) => [s.key, (d as unknown as Record<string, unknown>)[s.key]])),
    }));

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-500">
        No readings in the selected time range yet. Data will appear here once the device reports.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} aria-label="telemetry chart">
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey="time" stroke="#64748b" minTickGap={40} />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }}
            labelFormatter={() => String(rows.length > 0 ? rows[0].full : '')}
          />
          <Legend />
          {series.map((s) => (
            <Line key={`${id}-${s.key}`} type="monotone" dataKey={s.key} name={`${s.label} (${s.unit})`}
              stroke={s.color} dot={false} strokeWidth={2} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
