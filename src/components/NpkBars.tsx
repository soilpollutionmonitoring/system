import type { TranslationKey } from '../i18n';
import type { Thresholds } from '../config/thresholds';

export type NpkStatus = 'low' | 'optimal' | 'high';

export interface NpkRow {
  letter: 'N' | 'P' | 'K';
  nameKey: TranslationKey;
  value: number | null;
  min: number;
  max: number;
  barMax: number;
}

interface Props {
  rows: NpkRow[];
  npkValid: boolean;
  thresholds: Thresholds;
  t: (k: TranslationKey) => string;
}

function status(v: number, min: number, max: number): NpkStatus {
  if (v < min) return 'low';
  if (v > max) return 'high';
  return 'optimal';
}

/** Horizontal range bars with Low / Optimal / High zones and a current-value marker. */
export default function NpkBars({ rows, npkValid, thresholds, t }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-5">
      {rows.map((r) => {
        const valid = npkValid && r.value !== null;
        const st: NpkStatus | null = valid ? status(r.value!, r.min, r.max) : null;
        const markerLeft = valid ? Math.min(100, Math.max(0, (r.value! / r.barMax) * 100)) : null;
        const okStart = (r.min / r.barMax) * 100;
        const okWidth = ((r.max - r.min) / r.barMax) * 100;
        return (
          <div key={r.letter}>
            <div className="flex justify-between items-baseline mb-1.5 gap-2 flex-wrap">
              <div className="text-xs font-semibold text-[var(--txt-2)]">{t(r.nameKey)}</div>
              <div className="tnum text-sm">
                <strong className="text-lg font-bold">{valid ? r.value!.toFixed(0) : '—'}</strong>
                <span className="text-[11px] text-[var(--txt-3)] ml-1">{thresholds.npk.nitrogen.unit}</span>
                {st && (
                  <span className={`badge ${st === 'optimal' ? 'good' : st === 'low' ? 'warn' : 'crit'} ml-2`}>
                    {t(st)}
                  </span>
                )}
              </div>
            </div>
            <div className="npk-track" role="img" aria-label={`${r.letter}: ${valid ? r.value : t('insufficient')}`}>
              <div className="npk-zone low" style={{ width: `${okStart}%` }} />
              <div className="npk-zone ok" style={{ left: `${okStart}%`, width: `${okWidth}%` }} />
              <div className="npk-zone high" style={{ left: `${okStart + okWidth}%` }} />
              {markerLeft !== null && <div className="npk-marker" style={{ left: `${markerLeft}%` }} />}
            </div>
            <div className="flex justify-between text-[10px] text-[var(--txt-3)] mt-1">
              <span>0</span>
              <span>{t('low')} &lt;{r.min} · {t('optimal')} {r.min}–{r.max} · {t('high')} &gt;{r.max}</span>
              <span>{r.barMax}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
