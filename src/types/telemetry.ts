// Matches the ESP32 firmware's JSON payload exactly. Invalid sensor readings
// are sent as null and must never be displayed as values.
export interface TelemetryReading {
  deviceId: string;
  timestamp: number; // server-side epoch ms
  soilMoisture?: number | null;
  soilTemperature?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  npkValid?: boolean;
  temperatureValid?: boolean;
  firmwareVersion?: string;
}

export type ConnectionState = 'connecting' | 'connected' | 'error' | 'missing-config';

export interface WeatherData {
  temp: number | null;
  humid: number | null;
  rain: number | null;
}
