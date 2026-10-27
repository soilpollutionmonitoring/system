import type { TranslationKey } from '../i18n';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export type Tone = 'good' | 'warn' | 'crit' | 'neutral';

/** Status shown as icon + text + colour (never colour alone). */
export function StatusBadge({ tone, label, icon }: { tone: Tone; label: string; icon?: ReactNode }) {
  const icons: Record<Tone, ReactNode> = {
    good: <CheckCircle2 size={13} aria-hidden />,
    warn: <AlertTriangle size={13} aria-hidden />,
    crit: <XCircle size={13} aria-hidden />,
    neutral: <MinusCircle size={13} aria-hidden />,
  };
  return (
    <span className={`badge ${tone}`}>
      {icon ?? icons[tone]}
      {label}
    </span>
  );
}

export type { TranslationKey };
