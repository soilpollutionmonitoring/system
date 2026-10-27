import {
  ref,
  onValue,
  query,
  orderByChild,
  limitToLast,
  startAt,
  get,
  type DataSnapshot,
} from 'firebase/database';
import { db } from '../lib/db';
import type { TelemetryReading } from '../types/telemetry';

export const HISTORY_LIMIT = 5000; // hard cap: history is never loaded without bounds

const RANGE_MS: Record<string, number> = {
  '1h': 1 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export type TimeRange = keyof typeof RANGE_MS;

/** Live subscription to devices/{deviceId}/latest. Returns an unsubscribe. */
export function subscribeLatest(
  deviceId: string,
  cb: (reading: TelemetryReading | null) => void,
  onError: (e: Error) => void
): () => void {
  if (!db) {
    onError(new Error('Firebase is not configured'));
    return () => {};
  }
  const r = ref(db, `devices/${deviceId}/latest`);
  return onValue(
    r,
    (snap: DataSnapshot) => cb(snap.exists() ? (snap.val() as TelemetryReading) : null),
    onError
  );
}

/**
 * Bounded history fetch for a time range: queries only readings whose
 * timestamp >= range start AND applies limitToLast so we never load
 * unbounded data even for very long ranges or very fast devices.
 */
export async function fetchHistory(
  deviceId: string,
  range: TimeRange
): Promise<TelemetryReading[]> {
  if (!db) throw new Error('Firebase is not configured');
  const since = Date.now() - RANGE_MS[range];
  const q = query(
    ref(db, `devices/${deviceId}/history`),
    orderByChild('timestamp'),
    startAt(since),
    limitToLast(HISTORY_LIMIT)
  );
  const snap = await get(q);
  if (!snap.exists()) return [];
  const out: TelemetryReading[] = [];
  snap.forEach((child) => {
    const v = child.val();
    if (v && typeof v === 'object') out.push(v as TelemetryReading);
  });
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

export function subscribeConnection(
  cb: (connected: boolean) => void
): () => void {
  if (!db) return () => {};
  const r = ref(db, '.info/connected');
  return onValue(r, (snap) => cb(snap.val() === true));
}

export function toCsv(rows: TelemetryReading[]): string {
  const headers = [
    'timestamp',
    'deviceId',
    'soilPH',
    'soilMoisture',
    'soilTemperature',
    'electricalConductivity',
    'tds',
    'nitrogen',
    'phosphorus',
    'potassium',
  ];
  const esc = (v: unknown) =>
    v === undefined || v === null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.timestamp, r.deviceId, r.soilPH, r.soilMoisture, r.soilTemperature,
      r.electricalConductivity, r.tds, r.nitrogen, r.phosphorus, r.potassium]
      .map(esc).join(',')
  );
  return [headers.join(','), ...lines].join('\n');
}

export function downloadCsv(rows: TelemetryReading[], filename: string) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
