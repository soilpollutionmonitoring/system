import { Beaker, AlertTriangle, Info } from 'lucide-react';
import type { TelemetryReading, Threshold, TelemetryKey } from '../types/telemetry';
import { isValidNumber } from '../services/telemetryService';

interface Props {
  latest: TelemetryReading | null;
  thresholds: Record<string, Threshold>;
}

interface Factor {
  key: TelemetryKey;
  label: string;
  verdict: 'ok' | 'out-of-range' | 'insufficient';
  detail: string;
}

export default function InterpretationPanel({ latest, thresholds }: Props) {
  const factors: Factor[] = (['soilPH', 'soilMoisture', 'electricalConductivity', 'tds'] as TelemetryKey[]).map((key) => {
    const v = latest ? latest[key] : undefined;
    const t = thresholds[key];
    if (!isValidNumber(v) || !t) {
      return { key, label: key, verdict: 'insufficient' as const, detail: 'Insufficient data — no valid measurement available.' };
    }
    const inRange =
      (t.min === null || v >= t.min) && (t.max === null || v <= t.max);
    return {
      key,
      label: key,
      verdict: inRange ? ('ok' as const) : ('out-of-range' as const),
      detail: inRange
        ? `Within the configured range ${t.min ?? '—'}–${t.max ?? '—'} ${t.unit} (${t.source}).`
        : `Outside the configured range ${t.min ?? '—'}–${t.max ?? '—'} ${t.unit} (${t.source}). This is an observation against a general guideline, not a diagnosis.`,
    };
  });

  const anyMeasured = factors.some((f) => f.verdict !== 'insufficient');

  return (
    <section aria-labelledby="interp-heading" className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 id="interp-heading" className="flex items-center gap-2 text-lg font-semibold">
        <Beaker size={18} /> Interpretation
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Interpretations are generated only from your configured thresholds in
        <code className="mx-1">src/config/thresholds.json</code>.
        Measured values are sensor data; calculated values (e.g. TDS from EC) are derived;
        conclusions below are guideline comparisons only.
      </p>

      {!anyMeasured && (
        <div className="mt-3 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300">
          <strong>Insufficient data.</strong> No valid measurements are available yet, so no soil
          quality conclusion can be drawn. NPK, heavy metals and toxic chemicals are never estimated
          from pH or moisture alone.
        </div>
      )}

      <ul className="mt-3 space-y-3 text-sm">
        {factors.map((f) => (
          <li key={f.key} className="flex items-start gap-2">
            {f.verdict === 'ok' && <Info size={16} className="mt-0.5 text-emerald-400 shrink-0" />}
            {f.verdict === 'out-of-range' && <AlertTriangle size={16} className="mt-0.5 text-red-400 shrink-0" />}
            {f.verdict === 'insufficient' && <Info size={16} className="mt-0.5 text-slate-500 shrink-0" />}
            <div>
              <span className="font-medium">{f.label}: </span>
              {f.detail}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-400">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        These readings are not certified laboratory results. For regulatory pollution assessment or
        fertilization decisions, send a sample to an accredited soil laboratory.
      </p>
    </section>
  );
}
