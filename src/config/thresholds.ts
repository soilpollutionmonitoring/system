import raw from './thresholds.json';

export interface MoistureThresholds {
  veryDry: number; belowIdeal: number; irrigateNow: number; planIrrigation: number;
  waterlogRisk: number; hotDayMoisture: number; unit: string; source: string;
}
export interface TemperatureThresholds {
  min: number; max: number; hotDay: number; veryHot: number; coolDay: number;
  unit: string; source: string;
}
export interface NpkThreshold { min: number; max: number; barMax: number; unit: string; source: string }
export interface Thresholds {
  moisture: MoistureThresholds;
  temperature: TemperatureThresholds;
  npk: { nitrogen: NpkThreshold; phosphorus: NpkThreshold; potassium: NpkThreshold };
}

export const thresholds = raw as unknown as Thresholds;
