import { Sprout, AlertTriangle, CloudSun, Droplets, FlaskConical, Waves } from 'lucide-react';
import type { TranslationKey } from '../i18n';

export type Health = 'good' | 'moderate' | 'poor';

interface Props {
  health: Health;
  desc: string;
  t: (k: TranslationKey) => string;
}

const ICONS = { good: Sprout, moderate: CloudSun, poor: AlertTriangle } as const;

export default function SoilHealth({ health, desc, t }: Props) {
  const Icon = ICONS[health];
  const tone = health === 'good' ? 'good' : health === 'moderate' ? 'warn' : 'crit';
  return (
    <div className="card p-6 flex items-start gap-4">
      <span className={`badge ${tone} shrink-0 !px-3 !py-2`}>
        <Icon size={18} aria-hidden />
      </span>
      <div>
        <h3 className="font-bold text-lg leading-tight">{t('conditionLabel')}</h3>
        <p className="text-sm text-[var(--txt-2)] mt-1 leading-relaxed">{desc}</p>
        <p className="text-xs text-[var(--txt-3)] mt-2 flex items-center gap-1.5 flex-wrap">
          <FlaskConical size={13} aria-hidden /> {t('disclaimer')}
        </p>
      </div>
    </div>
  );
}

export { Droplets, Waves };
