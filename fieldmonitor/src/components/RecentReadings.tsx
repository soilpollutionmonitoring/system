import type { TelemetryReading } from '../types/telemetry';

interface Props {
  rows: TelemetryReading[];
}

const COLS: { key: keyof TelemetryReading; label: string }[] = [
  { key: 'timestamp', label: 'Time' },
  { key: 'deviceId', label: 'Device' },
  { key: 'soilPH', label: 'pH' },
  { key: 'soilMoisture', label: 'Moisture %' },
  { key: 'soilTemperature', label: 'Temp °C' },
  { key: 'electricalConductivity', label: 'EC mS/cm' },
  { key: 'tds', label: 'TDS ppm' },
  { key: 'nitrogen', label: 'N mg/kg' },
  { key: 'phosphorus', label: 'P mg/kg' },
  { key: 'potassium', label: 'K mg/kg' },
];

export default function RecentReadings({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-500">
        No history available yet. Once your ESP32 submits readings they will be listed here.
      </div>
    );
  }
  const recent = rows.slice(-20).reverse();
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
          <tr>{COLS.map((c) => <th key={c.key} className="px-3 py-2">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {recent.map((r, i) => (
            <tr key={`${r.timestamp}-${i}`} className="border-b border-slate-800/60 last:border-0">
              {COLS.map((c) => (
                <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                  {c.key === 'timestamp'
                    ? new Date(r.timestamp).toLocaleString()
                    : r[c.key] === undefined
                      ? <span className="text-slate-600">—</span>
                      : String(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
