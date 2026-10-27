import { Droplets, FlaskConical, Waves, Leaf, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import type { TranslationKey } from '../i18n';
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

type LucideIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & RefAttributes<SVGSVGElement> & { size?: string | number }>;


export interface Action {
  kind: 'urgent' | 'warn' | 'ok';
  titleKey: TranslationKey;
  detailKey: TranslationKey;
}

interface Props {
  actions: Action[];
  t: (k: TranslationKey) => string;
}

const STYLES: Record<Action['kind'], { icon: LucideIcon; tone: string }> = {
  urgent: { icon: AlertTriangle, tone: 'crit' },
  warn: { icon: Droplets, tone: 'warn' },
  ok: { icon: CheckCircle2, tone: 'good' },
};

export default function ActionList({ actions, t }: Props) {
  return (
    <div className="card">
      <div className="px-5 pt-4 pb-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
        <Info size={16} className="text-[var(--txt-3)]" aria-hidden />
        <span className="font-semibold text-sm">{t('actionsTitle')}</span>
        <span className="text-xs text-[var(--txt-3)]">ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â {t('actionsSub')}</span>
      </div>
      <div className="p-4 flex flex-col gap-2.5">
        {actions.slice(0, 4).map((a, i) => {
          const { icon: Icon, tone } = STYLES[a.kind];
          return (
            <div key={i} className={`badge ${tone} !rounded-xl !py-2.5 !px-3.5 items-start`}>
              <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span className="flex flex-col items-start text-left">
                <span className="font-bold text-sm">{t(a.titleKey)}</span>
                <span className="font-normal text-xs opacity-90">{t(a.detailKey)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { FlaskConical, Waves, Leaf };
