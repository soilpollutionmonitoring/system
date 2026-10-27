import type { ReactNode } from 'react';
import { Activity, LineChart, List, Droplets, Info } from 'lucide-react';

export type Tab = 'dashboard' | 'charts' | 'history' | 'thresholds' | 'about';

export const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Activity size={18} /> },
  { id: 'charts', label: 'Live Charts', icon: <LineChart size={18} /> },
  { id: 'history', label: 'History', icon: <List size={18} /> },
  { id: 'thresholds', label: 'Thresholds', icon: <Droplets size={18} /> },
  { id: 'about', label: 'About', icon: <Info size={18} /> },
];

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
  mobile?: boolean;
}

export default function Sidebar({ active, onChange, mobile }: Props) {
  const cls = (t: Tab) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active === t ? 'bg-emerald-900/50 text-emerald-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;

  if (mobile) {
    return (
      <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto p-2">
        {TABS.map((t) => (
          <button key={t.id} className={cls(t.id)} onClick={() => onChange(t.id)}>
            {t.icon}<span className="whitespace-nowrap">{t.label}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-900/50 p-4 md:flex">
      <div className="mb-4 px-2">
        <h1 className="text-base font-bold leading-tight">Soil Pollution &amp; Fertility Monitoring</h1>
        <p className="text-xs text-slate-500">IoT-based real-time soil analysis</p>
      </div>
      <nav aria-label="Main navigation" className="flex flex-col gap-1">
        {TABS.map((t) => (
          <button key={t.id} className={cls(t.id)} onClick={() => onChange(t.id)}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
