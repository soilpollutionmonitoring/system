import { CloudSun, Droplets, Umbrella, Clock, Database } from 'lucide-react';
import type { TranslationKey, Lang } from '../i18n';
import type { WeatherData } from '../types/telemetry';
import type { LinkStatus } from '../services/telemetryService';
import type { Tone } from './StatusBadge';

interface HeaderProps {
  title: string;
  subtitle: string;
  lang: Lang;
  theme: 'light' | 'dark';
  onLang: () => void;
  onTheme: () => void;
  t: (k: TranslationKey) => string;
}

/** Stacked (non-overlapping) top header: title row, then chips row. */
export function Header({ title, subtitle, lang, theme, onLang, onTheme, t }: HeaderProps) {
  return (
    <header className="border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold leading-snug [overflow-wrap:anywhere]">{title}</h1>
            <p className="text-xs md:text-sm text-[var(--txt-2)] mt-0.5">{subtitle}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onLang} aria-label="Toggle language"
              className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:opacity-80"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--txt-1)' }}>
              {lang === 'en' ? 'मराठी' : 'English'}
            </button>
            <button onClick={onTheme} aria-label="Toggle dark mode"
              className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:opacity-80 flex items-center gap-1.5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--txt-1)' }}>
              {theme === 'light' ? '🌙' : '☀️'} {theme === 'light' ? t('darkMode') : t('lightMode')}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

interface ChipsProps {
  link: LinkStatus;
  reason: string | null;
  lastUpdated: number | null;
  t: (k: TranslationKey) => string;
}

export function statusInfo(link: LinkStatus, t: (k: TranslationKey) => string): { tone: Tone; label: string; pulse: boolean } {
  switch (link) {
    case 'receiving': return { tone: 'good', label: t('statusReceiving'), pulse: false };
    case 'connected-empty': return { tone: 'warn', label: t('statusConnectedEmpty'), pulse: true };
    case 'connecting': return { tone: 'neutral', label: t('statusConnecting'), pulse: true };
    case 'stale': return { tone: 'warn', label: t('staleWarning').split('—')[0].trim(), pulse: false };
    case 'error': return { tone: 'crit', label: t('statusError'), pulse: false };
  }
}

/** High-contrast status bar: Firebase chip with real reason, device state, last-updated. */
export function StatusBar({ link, reason, lastUpdated, t }: ChipsProps) {
  const info = statusInfo(link, t);
  return (
    <div className="rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <span className="flex items-center gap-2 font-semibold" style={{ color: info.tone === 'good' ? 'var(--good-text)' : info.tone === 'crit' ? 'var(--crit-text)' : info.tone === 'warn' ? 'var(--warn-text)' : 'var(--txt-2)' }}>
        <span className={`sdot ${info.pulse ? 'pulse' : ''}`} style={{ background: info.tone === 'good' ? 'var(--good)' : info.tone === 'crit' ? 'var(--crit)' : info.tone === 'warn' ? 'var(--warn)' : 'var(--txt-3)' }} />
        <Database size={14} aria-hidden /> Firebase: {info.label}
      </span>
      {reason && (
        <span className="text-[var(--txt-2)] min-w-0 [overflow-wrap:anywhere]">
          {t('reasonLabel')}: {reason}
        </span>
      )}
      <span className="flex items-center gap-1.5 text-[var(--txt-2)]">
        <Clock size={14} aria-hidden /> {t('lastUpdated')}: {lastUpdated ? new Date(lastUpdated).toLocaleString() : '—'}
      </span>
    </div>
  );
}

/** Compact weather card (replaces the animated hero). */
export function WeatherCard({ weather, insight, t }: { weather: WeatherData; insight: string | null; t: (k: TranslationKey) => string }) {
  const ok = weather.temp !== null && weather.humid !== null && weather.rain !== null;
  return (
    <div className="card p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--txt-3)]">
        <CloudSun size={18} aria-hidden /> {t('weatherCard')}
      </div>
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <CloudSun size={18} className="text-[var(--txt-3)]" aria-hidden />
          <span className="tnum text-xl font-bold">{ok ? weather.temp!.toFixed(1) : '—'}°</span>
        </div>
        <div className="flex items-center gap-2">
          <Droplets size={18} className="text-[var(--txt-3)]" aria-hidden />
          <span className="tnum text-xl font-bold">{ok ? weather.humid!.toFixed(0) : '—'}%</span>
          <span className="text-xs text-[var(--txt-3)]">{t('humidity')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Umbrella size={18} className="text-[var(--txt-3)]" aria-hidden />
          <span className="tnum text-xl font-bold">{ok ? weather.rain!.toFixed(0) : '—'}%</span>
          <span className="text-xs text-[var(--txt-3)]">{t('rainChance')}</span>
        </div>
      </div>
      {insight && <p className="text-xs text-[var(--txt-2)] md:ml-auto max-w-sm">{insight}</p>}
    </div>
  );
}
