import { Activity, Wifi, WifiOff, Clock, AlertTriangle } from 'lucide-react';
import type { TelemetryReading, ConnectionState } from '../types/telemetry';

interface Props {
  firebaseState: ConnectionState;
  hasLatest: boolean;
  latest: TelemetryReading | null;
}

export default function ConnectionStatus({ firebaseState, hasLatest, latest }: Props) {
  const fbLabel =
    firebaseState === 'connected' ? 'Firebase: connected'
    : firebaseState === 'connecting' ? 'Firebase: connecting…'
    : firebaseState === 'missing-config' ? 'Firebase: not configured (.env)'
    : 'Firebase: error';
  const fbColor =
    firebaseState === 'connected' ? 'text-emerald-400' :
    firebaseState === 'connecting' ? 'text-amber-400' : 'text-red-400';

  const now = Date.now();
  const stale = latest ? now - latest.timestamp > 10 * 60 * 1000 : true;
  const deviceLabel = hasLatest
    ? stale ? 'Device: no recent reading' : 'Device: reporting'
    : 'Device: waiting for first reading';
  const deviceColor = hasLatest && !stale ? 'text-emerald-400' : 'text-amber-400';

  const lastUpdated = latest?.timestamp
    ? new Date(latest.timestamp).toLocaleString()
    : '—';

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span className={`inline-flex items-center gap-1.5 ${fbColor}`}>
        {firebaseState === 'connected' ? <Wifi size={16} /> : <WifiOff size={16} />}
        {fbLabel}
      </span>
      <span className={`inline-flex items-center gap-1.5 ${deviceColor}`}>
        {hasLatest && !stale ? <Activity size={16} /> : <AlertTriangle size={16} />}
        {deviceLabel}
      </span>
      <span className="inline-flex items-center gap-1.5 text-slate-400">
        <Clock size={16} /> Last updated: {lastUpdated}
      </span>
    </div>
  );
}
