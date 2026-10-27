import { FlaskConical, Ban, Info } from 'lucide-react';
import type { Thresholds } from '../config/thresholds';
import type { TranslationKey } from '../i18n';

interface Props {
  th: Thresholds;
  t: (k: TranslationKey) => string;
}

export default function AboutPanel({ th, t }: Props) {
  const rows: [string, string, string, string][] = [
    ['N', `${th.npk.nitrogen.min}–${th.npk.nitrogen.max}`, th.npk.nitrogen.unit, th.npk.nitrogen.source],
    ['P', `${th.npk.phosphorus.min}–${th.npk.phosphorus.max}`, th.npk.phosphorus.unit, th.npk.phosphorus.source],
    ['K', `${th.npk.potassium.min}–${th.npk.potassium.max}`, th.npk.potassium.unit, th.npk.potassium.source],
    [t('moistureL'), `< ${th.moisture.veryDry} / > ${th.moisture.waterlogRisk}`, th.moisture.unit, th.moisture.source],
    [t('tempL'), `${th.temperature.min}–${th.temperature.max}`, th.temperature.unit, th.temperature.source],
  ];
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Info size={16} className="text-[var(--txt-3)]" aria-hidden />
        <h3 className="font-semibold text-sm">{t('thresholdsLabel')}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase text-[var(--txt-3)] border-b" style={{ borderColor: 'var(--border)' }}>
            <tr><th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Optimal</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Source</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <td className="px-3 py-2 font-semibold whitespace-nowrap">{r[0]}</td>
                <td className="px-3 py-2 tnum">{r[1]}</td>
                <td className="px-3 py-2">{r[2]}</td>
                <td className="px-3 py-2 text-xs text-[var(--txt-3)]">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="badge neutral !rounded-xl !py-2.5 !px-3.5 items-start">
        <Ban size={15} className="mt-0.5 shrink-0" aria-hidden />
        <span className="flex flex-col items-start text-left">
          <span className="font-bold text-xs">{t('notMeasuredTitle')}</span>
          <span className="font-normal text-[11px] opacity-90">{t('notMeasuredDesc')}</span>
        </span>
      </div>

      <p className="text-[11px] text-[var(--txt-3)] leading-relaxed flex gap-1.5">
        <FlaskConical size={13} className="shrink-0 mt-0.5" aria-hidden />
        {t('disclaimer')} {t('footerNote')}
      </p>
    </div>
  );
}
