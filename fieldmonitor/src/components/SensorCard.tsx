import type { TelemetryReading, Threshold, TelemetryKey } from '../types/telemetry';
import { isValidNumber } from '../services/telemetryService';

interface Props {
  name: string;
  paramKey: TelemetryKey;
  reading: TelemetryReading | null;
  threshold?: Threshold;
  kind: 'measured' | 'calculated' | 'interpretation';
}

export default function SensorCard({ name, paramKey, reading, threshold, kind }: Props) {
  const raw = reading ? reading[paramKey] : undefined;
  const value = isValidNumber(raw) ? raw : null;
  const outOfRange =
    value !== null && threshold &&
    ((threshold.min !== null && value < threshold.min) ||
     (threshold.max !== null && value > threshold.max));
  const status = value === null ? null : outOfRange ? 'Out of range' : 'Normal';

  const statusColor = status === null ? '' :
    outOfRange ? 'bg-red-900/40 text-red-300 border-red-700' :
    'bg-emerald-900/40 text-emerald-300 border-emerald-700';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4" aria-label={name}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-400">{name}</h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{kind}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {value === null
          ? <span className="text-slate-500">Insufficient data</span>
          : <>{value} <span className="text-sm font-normal text-slate-400">{threshold?.unit}</span></>}
      </p>
      {status && (
        <span className={`mt-2 inline-block rounded border px-2 py-0.5 text-xs ${statusColor}`}>
          {status}
        </span>
      )}
      {threshold && (
        <p className="mt-2 text-xs text-slate-500">
          Range: {threshold.min ?? '—'}–{threshold.max ?? '—'} {threshold.unit}
        </p>
      )}
    </div>
  );
}
