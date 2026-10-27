import type { TelemetryReading } from '../types/telemetry';
import type { TranslationKey } from '../i18n';
import { Download } from 'lucide-react';
import { downloadCsv } from '../services/telemetryService';

interface Props {
  history: TelemetryReading[];
  t: (k: TranslationKey) => string;
}

export default function RecentReadings({ history, t }: Props) {
  if (history.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--txt-3)]">{t('historyEmpty')}</div>
    );
  }
  const rows = history.slice(-20).reverse();
  const cols: { key: keyof TelemetryReading; label: string }[] = [
    { key: 'timestamp', label: t('time') },
    { key: 'deviceId', label: t('device') },
    { key: 'soilMoisture', label: '%' },
    { key: 'soilTemperature', label: '°C' },
    { key: 'nitrogen', label: 'N' },
    { key: 'phosphorus', label: 'P' },
    { key: 'potassium', label: 'K' },
  ];
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase text-[var(--txt-3)] border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <tr>{cols.map((c) => <th key={String(c.key)} className="px-3 py-2.5 whitespace-nowrap">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.timestamp}-${i}`} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                {cols.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2 whitespace-nowrap tnum">
                    {c.key === 'timestamp'
                      ? new Date(r.timestamp).toLocaleString()
                      : r[c.key] === undefined || r[c.key] === null
                        ? <span className="text-[var(--txt-3)]">—</span>
                        : String(r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
        <button onClick={() => downloadCsv(history, 'soil-recent.csv')}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-[var(--surface-2)]"
          style={{ borderColor: 'var(--border)' }}>
          <Download size={13} aria-hidden /> {t('exportCsv')}
        </button>
      </div>
    </div>
  );
}
