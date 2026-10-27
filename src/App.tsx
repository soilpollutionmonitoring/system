import { useEffect, useMemo, useState } from 'react';
import { Header, StatusBar, WeatherCard } from './components/Header';
import KpiRow, { type Kpi } from './components/KpiRow';
import SoilHealth from './components/SoilHealth';
import ActionList from './components/ActionList';
import NpkBars from './components/NpkBars';
import HistoryCharts from './components/HistoryCharts';
import RecentReadings from './components/RecentReadings';
import AboutPanel from './components/AboutPanel';
import { Leaf, Flower2, Sprout } from 'lucide-react';
import { thresholds as th } from './config/thresholds';
import { T, APP_TITLE, APP_SUBTITLE, type Lang } from './i18n';
import type { TelemetryReading, WeatherData } from './types/telemetry';
import {
  subscribeLatest, subscribeConnection, fetchHistory,
  toLinkStatus, type TimeRange, type LinkStatus,
} from './services/telemetryService';
import {
  derive, buildFieldParams, computeHealth, buildActions, weatherInsight, npkStatus, npkTone,
} from './components/interpret';

const DEVICE_ID = (import.meta.env.VITE_DEVICE_ID as string) || 'esp32-soil-001';

function fetchWeather(): Promise<WeatherData> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ temp: null, humid: null, rain: null }); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const url =
            'https://api.open-meteo.com/v1/forecast' +
            `?latitude=${encodeURIComponent(pos.coords.latitude)}` +
            `?longitude=${encodeURIComponent(pos.coords.longitude)}` +
            '&current=temperature_2m,relative_humidity_2m' +
            '&hourly=precipitation_probability&forecast_days=1&timezone=auto';
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) throw new Error(`Weather HTTP ${r.status}`);
          const d = await r.json();
          const rainArr = d.hourly?.precipitation_probability;
          resolve({
            temp: typeof d.current?.temperature_2m === 'number' ? d.current.temperature_2m : null,
            humid: typeof d.current?.relative_humidity_2m === 'number' ? d.current.relative_humidity_2m : null,
            rain: Array.isArray(rainArr) && typeof rainArr[0] === 'number' ? rainArr[0] : null,
          });
        } catch { resolve({ temp: null, humid: null, rain: null }); }
      },
      () => resolve({ temp: null, humid: null, rain: null }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [link, setLink] = useState<LinkStatus>('connecting');
  const [linkUp, setLinkUp] = useState(false);
  const [hadError, setHadError] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [latest, setLatest] = useState<TelemetryReading | null>(null);
  const [weather, setWeather] = useState<WeatherData>({ temp: null, humid: null, rain: null });
  const [history, setHistory] = useState<TelemetryReading[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('24h');
  const [now, setNow] = useState(Date.now());

  const t = (k: keyof typeof T.en) => (T[lang][k] ?? T.en[k]) as string;

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Firebase live listener with detailed status + safe error reason
  useEffect(() => {
    setHadError(false);
    setReason(null);
    const unsub = subscribeLatest(
      DEVICE_ID,
      (r) => setLatest(r),
      (e) => { setHadError(true); setReason(e.message); }
    );
    const unsubC = subscribeConnection(setLinkUp);
    return () => { unsub(); unsubC(); };
  }, []);

  // Re-evaluate staleness every 30 s
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    setLink(toLinkStatus(linkUp, latest !== null, latest?.timestamp ?? null, hadError, now));
  }, [linkUp, latest, hadError, now]);

  // Weather every 10 min
  useEffect(() => {
    fetchWeather().then(setWeather);
    const iv = setInterval(() => fetchWeather().then(setWeather), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  // Bounded history per range
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    fetchHistory(DEVICE_ID, range)
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [range, latest?.timestamp]);

  const d = useMemo(() => (latest ? derive(latest) : null), [latest]);
  const insight = d ? weatherInsight(d, weather, th, lang) : null;

  const params = d ? buildFieldParams(d, th, t) : [];
  const spark = (key: 'soilMoisture' | 'soilTemperature' | 'nitrogen' | 'phosphorus' | 'potassium') =>
    history.slice(-30).map((h) => {
      const v = (h as unknown as Record<string, unknown>)[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    });

  type Param = ReturnType<typeof buildFieldParams>[number];
  const rawKpis: Kpi[] = [
    ...params.map((p: Param, i: number): Kpi => ({
      id: String(p.labelKey),
      icon: p.icon,
      labelKey: p.labelKey,
      value: p.value,
      unit: p.unit,
      tone: p.tone,
      statusLabel: p.tone === 'good' ? t('good') : p.tone === 'warn' ? t('moderate') : p.tone === 'crit' ? t('critical') : t('insufficient'),
      meaning: p.meaning,
      spark: spark(i === 0 ? 'soilMoisture' : 'soilTemperature'),
    })),
    {
      id: 'N', icon: Leaf, labelKey: 'nitrogenN', value: d?.npkValid ? d.nitrogen : null, unit: th.npk.nitrogen.unit,
      tone: d?.npkValid && d.nitrogen !== null ? npkTone(npkStatus(d.nitrogen, th.npk.nitrogen.min, th.npk.nitrogen.max)) : 'neutral',
      statusLabel: '', meaning: t('nFull'), spark: spark('nitrogen')
    },
    {
      id: 'P', icon: Flower2, labelKey: 'phosphorusP', value: d?.npkValid ? d.phosphorus : null, unit: th.npk.phosphorus.unit,
      tone: d?.npkValid && d.phosphorus !== null ? npkTone(npkStatus(d.phosphorus, th.npk.phosphorus.min, th.npk.phosphorus.max)) : 'neutral',
      statusLabel: '', meaning: t('pFull'), spark: spark('phosphorus')
    },
    {
      id: 'K', icon: Sprout, labelKey: 'potassiumK', value: d?.npkValid ? d.potassium : null, unit: th.npk.potassium.unit,
      tone: d?.npkValid && d.potassium !== null ? npkTone(npkStatus(d.potassium, th.npk.potassium.min, th.npk.potassium.max)) : 'neutral',
      statusLabel: '', meaning: t('kFull'), spark: spark('potassium')
    },
  ];
  const kpis: Kpi[] = rawKpis.map((k) => ({
    ...k,
    statusLabel: k.statusLabel || (k.value === null
      ? t('insufficient')
      : k.tone === 'good' ? t('optimal') : k.tone === 'warn' ? t('low') : t('high')),
  }));

  const loadingKpis = link === 'connecting' && !latest;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--page-bg)', color: 'var(--txt-1)' }}>
      <Header
        title={APP_TITLE[lang]}
        subtitle={APP_SUBTITLE[lang]}
        lang={lang}
        theme={theme}
        onLang={() => setLang(lang === 'en' ? 'mr' : 'en')}
        onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        t={t}
      />

      <main className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-6 flex flex-col gap-6">
        <StatusBar link={link} reason={reason} lastUpdated={latest?.timestamp ?? null} t={t} />
        <WeatherCard weather={weather} insight={insight} t={t} />

        {/* 1. Overview KPI row */}
        <section aria-label={t('overviewLabel')}>
          {loadingKpis ? (
            <KpiRow kpis={[]} t={t} loading />
          ) : (
            <KpiRow kpis={kpis} t={t} loading={false} />
          )}
        </section>

        {/* 2. Soil condition summary */}
        <section aria-label={t('conditionLabel')}>
          {d ? (() => {
            const { health, descKey } = computeHealth(d, th);
            return <SoilHealth health={health} desc={t(descKey)} t={t} />;
          })() : (
            <SoilHealth health="moderate" desc={link === 'error' && reason ? `${t('waitingTitle')} — ${reason}` : t('waitingDesc')} t={t} />
          )}
        </section>

        {/* 3. Recommended actions */}
        <section aria-label={t('whatToDo')}>
          <ActionList actions={d ? buildActions(d, weather, th) : []} t={t} />
        </section>

        {/* 4. Nutrients NPK */}
        <section aria-label={t('nutrientLabel')}>
          <NpkBars
            rows={[
              { letter: 'N', nameKey: 'nitrogenN', value: d?.nitrogen ?? null, min: th.npk.nitrogen.min, max: th.npk.nitrogen.max, barMax: th.npk.nitrogen.barMax },
              { letter: 'P', nameKey: 'phosphorusP', value: d?.phosphorus ?? null, min: th.npk.phosphorus.min, max: th.npk.phosphorus.max, barMax: th.npk.phosphorus.barMax },
              { letter: 'K', nameKey: 'potassiumK', value: d?.potassium ?? null, min: th.npk.potassium.min, max: th.npk.potassium.max, barMax: th.npk.potassium.barMax },
            ]}
            npkValid={d?.npkValid ?? false}
            thresholds={th}
            t={t}
          />
        </section>

        {/* 5. History charts */}
        <section aria-label={t('historyLabel')}>
          <HistoryCharts history={history} range={range} onRange={setRange} loading={historyLoading} t={t} />
        </section>

        {/* 6. Recent readings */}
        <section aria-label={t('historyLabel')}>
          <RecentReadings history={history} t={t} />
        </section>

        {/* 7. About and thresholds */}
        <section aria-label={t('thresholdsLabel')}>
          <AboutPanel th={th} t={t} />
        </section>
      </main>

      <footer className="mt-auto border-t py-5 text-center text-xs text-[var(--txt-3)]" style={{ borderColor: 'var(--border)' }}>
        <div className="font-semibold" style={{ color: 'var(--txt-2)' }}>{APP_TITLE[lang]}</div>
        <div className="mt-1">{t('footerNote')}</div>
      </footer>
    </div>
  );
}
