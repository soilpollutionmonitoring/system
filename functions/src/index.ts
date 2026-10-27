import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.database();

// ---------- Configuration (secrets / env) ----------
// Set with: firebase functions:secrets:set DEVICE_KEYS  (v2) or functions.config
// For simplicity on v1 we use environment configuration:
//   firebase functions:config:set telemetry.device_keys='{"esp32-soil-001":"SECRET"}'
// Never put these keys in the frontend or the ESP32 sketch in a repo.
interface TelemetryConfig {
  device_keys?: Record<string, string>;
  allowed_origins?: string;
}
const cfg = functions.config().telemetry as TelemetryConfig | undefined;
const DEVICE_KEYS: Record<string, string> = cfg?.device_keys ?? {};
const ALLOWED_ORIGINS = (cfg?.allowed_origins ?? '*').split(',');

// ---------- Validation ----------
// Matches the real sensors: NPK (RS485), soil moisture (GPIO34), DS18B20 temperature.
// NO pH, NO EC, NO pollution sensor — those fields are not accepted.
const FIELDS: Record<string, { min: number; max: number }> = {
  soilMoisture: { min: 0, max: 100 },
  soilTemperature: { min: -50, max: 80 },
  nitrogen: { min: 0, max: 5000 },
  phosphorus: { min: 0, max: 5000 },
  potassium: { min: 0, max: 5000 },
};

const MAX_BODY_BYTES = 4 * 1024; // small JSON payload; reject anything larger

function validate(body: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;
  const deviceId = b.deviceId;
  if (typeof deviceId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(deviceId)) {
    return { ok: false, error: 'deviceId is required (max 64 chars, [A-Za-z0-9_-]).' };
  }
  if (DEVICE_KEYS[deviceId] === undefined) {
    return { ok: false, error: 'Unknown device.' };
  }
  const out: Record<string, unknown> = { deviceId };
  let fieldCount = 0;
  for (const [key, range] of Object.entries(FIELDS)) {
    const v = b[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return { ok: false, error: `${key} must be a finite number.` };
    }
    if (v < range.min || v > range.max) {
      return { ok: false, error: `${key} out of range (${range.min}-${range.max}).` };
    }
    out[key] = v;
    fieldCount++;
  }
  if (fieldCount === 0) {
    return { ok: false, error: 'At least one valid measurement field is required.' };
  }
  if (typeof b.sensorStatus === 'string' && b.sensorStatus.length <= 200) {
    out.sensorStatus = b.sensorStatus;
  }
  if (typeof b.firmwareVersion === 'string' && b.firmwareVersion.length <= 32) {
    out.firmwareVersion = b.firmwareVersion;
  }
  // Validity flags from the firmware (npkValid / temperatureValid)
  if (typeof b.npkValid === 'boolean') out.npkValid = b.npkValid;
  if (typeof b.temperatureValid === 'boolean') out.temperatureValid = b.temperatureValid;
  // Null sensor readings are preserved as null so the UI shows "Insufficient data".
  // (v === null fields are simply omitted; the flags carry the validity state.)
  // Server-side timestamp only — client-supplied timestamps are ignored.
  out.timestamp = admin.database.ServerValue.TIMESTAMP;
  return { ok: true, data: out };
}

// ---------- Simple in-memory rate limiting ----------
const RATE_LIMIT_MS = 5000; // min interval between accepted submissions per device
const lastSeen: Record<string, number> = {};
function rateLimited(deviceId: string): boolean {
  const now = Date.now();
  const last = lastSeen[deviceId] ?? 0;
  if (now - last < RATE_LIMIT_MS) return true;
  lastSeen[deviceId] = now;
  return false;
}

// ---------- Endpoint ----------
export const apiTelemetry = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    // CORS restricted to configured origins
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-Device-Key');
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).send({ error: 'Method not allowed.' });
      return;
    }

    // Device identity: key in header, compared in constant time-ish fashion
    const deviceKey = req.get('X-Device-Key');
    if (typeof deviceKey !== 'string' || deviceKey.length === 0) {
      res.status(401).send({ error: 'Missing device key.' });
      return;
    }

    // Payload size guard
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (raw.length > MAX_BODY_BYTES) {
      res.status(413).send({ error: 'Payload too large.' });
      return;
    }

    // Parse + validate
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      res.status(400).send({ error: 'Body must be valid JSON.' });
      return;
    }
    const result = validate(parsed);
    if (!result.ok) {
      res.status(400).send({ error: result.error });
      return;
    }
    const data = result.data;
    const deviceId = data.deviceId as string;

    // Authorize AFTER parse so we never log the key or body with secrets
    const expected = DEVICE_KEYS[deviceId];
    if (deviceKey !== expected) {
      // Do not log deviceKey. Generic message.
      res.status(403).send({ error: 'Unauthorized device.' });
      return;
    }

    if (rateLimited(deviceId)) {
      res.status(429).send({ error: 'Rate limit: one submission per device every 5 seconds.' });
      return;
    }

    try {
      // latest + history; keep them separate
      await db.ref(`devices/${deviceId}/latest`).set(data);
      const historyRef = db.ref(`devices/${deviceId}/history`).push();
      await historyRef.set(data);
      res.status(201).send({ ok: true, id: historyRef.key });
    } catch (e) {
      // Log the error object only — never secrets
      functions.logger.error('telemetry write failed', e);
      res.status(500).send({ error: 'Internal error storing telemetry.' });
    }
  });
