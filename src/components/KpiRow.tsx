import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

type LucideIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & RefAttributes<SVGSVGElement> & { size?: string | number }>;
import type { TranslationKey } from '../i18n';
import { StatusBadge, type Tone } from './StatusBadge';


export interface Kpi {
  id: string;
  icon: LucideIcon;
  labelKey: TranslationKey;
  value: number | null;
  unit: string;
  tone: Tone;
  statusLabel: string;
  meaning: string;
  spark: (number | null)[];
}

interface Props {
  kpis: Kpi[];
  t: (k: TranslationKey) => string;
  loading: boolean;
}

const GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4';

export default function KpiRow({ kpis, t, loading }: Props) {
  if (loading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton h-4 w-24 mb-3" />
            <div className="skeleton h-8 w-20 mb-2" />
            <div className="skeleton h-3 w-32 mb-3" />
            <div className="skeleton h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={GRID}>
      {kpis.map((k) => (
        <div key={k.id} className="card p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[var(--txt-2)]">
            <k.icon size={16} aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">{t(k.labelKey)}</span>
          </div>
          <div className="tnum text-3xl font-bold leading-none">
            {k.value === null
              ? <span className="text-[var(--txt-3)] text-base font-medium">Insufficient data</span>
              : <>{k.value.toFixed(1)} <span className="text-sm font-medium text-[var(--txt-3)]">{k.unit}</span></>}
          </div>
          <StatusBadge tone={k.value === null ? 'neutral' : k.tone} label={k.value === null ? t('insufficient') : k.statusLabel} />
          <p className="text-[11px] text-[var(--txt-3)] leading-snug">{k.meaning}</p>
          <Sparkline data={k.spark} alt={t('sparkAlt')} />
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data, alt }: { data: (number | null)[]; alt: string }) {
  const pts = data.filter((v): v is number => typeof v === 'number');
  if (pts.length < 2) {
    return <div className="h-8 mt-1 flex items-end" aria-label={alt} />;
  }
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const w = 100, h = 30;
  const path = pts
    .map((v, i) => `${(i / (pts.length - 1)) * w},${h - 3 - ((v - min) / range) * (h - 6)}`)
    .join(' L ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 mt-1 w-full" aria-label={alt} role="img" preserveAspectRatio="none">
      <path d={`M ${path}`} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
