// Telemetry schema. Fields are optional because sensors differ per installation;
// the backend and dashboard only ever show values that actually exist in the data.
export interface TelemetryReading {
  deviceId: string;
  timestamp: number; // server-side epoch ms
  soilPH?: number;
  soilMoisture?: number; // percent
  soilTemperature?: number; // celsius
  electricalConductivity?: number; // mS/cm
  tds?: number; // ppm
  nitrogen?: number; // mg/kg
  phosphorus?: number; // mg/kg
  potassium?: number; // mg/kg
  sensorStatus?: string;
  firmwareVersion?: string;
}

export type TelemetryKey = Exclude<keyof TelemetryReading, 'deviceId' | 'timestamp'>;

export type ConnectionState = 'connecting' | 'connected' | 'error' | 'missing-config';

export interface Threshold {
  min: number | null;
  max: number | null;
  unit: string;
  source: string;
}
