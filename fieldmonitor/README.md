# IoT Soil Pollution & Fertility Monitoring System

ESP32 → HTTPS endpoint (Cloud Function) → Firebase Realtime Database → React dashboard.
No login pages — the dashboard opens directly and is publicly readable (read-only).

**Note:** your sensor list was "not decided yet", so all sensor-reading functions in the ESP32 sketch are clearly marked placeholders. Replace them once you pick hardware. Also: the TDS card only shows a value when EC exists (TDS = EC × 500); NPK cards only appear with a real NPK sensor. **Public read access means anyone with the link can read the monitoring paths** — telemetry only, nothing else.

---

## 1. Verify tools (PowerShell)

```powershell
node --version      # expect v18+
npm --version
firebase --version  # if missing: npm install -g firebase-tools
```
Arduino IDE: install from arduino.cc (needed only for flashing the ESP32).

> If `npm`/`firebase` give a "running scripts is disabled" error, run:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## 2. Install dependencies

From the project folder:
```powershell
npm install
Set-Location functions; npm install; Set-Location ..
```

## 3. Configure Firebase + `.env`

1. Firebase console → Project settings → **Your apps** → Web app → copy the config values.
2. In the project root:
   ```powershell
   Copy-Item .env.example .env
   notepad .env    # paste apiKey, appId, messagingSenderId, etc.
   ```

## 4. Deploy database rules

```powershell
firebase login
firebase deploy --only database
```

## 5. Set secrets and deploy the backend

⚠️ **Cloud Functions require the Blaze plan.** On **Spark (free) you cannot deploy Cloud Functions**. Fallback if you are on Spark: deploy a simple HTTPS receiver elsewhere (e.g. a free tier host) using the same validation logic, **or** (less secure) allow ESP32 direct writes by adding a rule that checks an auth string — trade-off: the secret lives in the firmware and the path must allow writes, weakening "read-only public" guarantees. Prefer Blaze.

On Blaze, from the project root:
```powershell
firebase functions:config:set telemetry.device_keys='{\"esp32-soil-001\":\"CHOOSE_A_LONG_RANDOM_KEY\"}'
firebase functions:config:set telemetry.allowed_origins='http://localhost:5173'   # add your hosting URL later
Set-Location functions; npm run build; Set-Location ..
firebase deploy --only functions
```
Note the deployed URL printed at the end (e.g. `https://asia-southeast1-...cloudfunctions.net/apiTelemetry`).

## 6. Run the dashboard locally

```powershell
npm run dev
```
Open http://localhost:5173. Empty database → "Waiting for sensor data" state.

## 7. Test the API (dev test method — development only)

Clearly labeled DEV test — do not use in production data flow:
```powershell
Invoke-RestMethod -Method Post -Uri "<YOUR_FUNCTION_URL>" `
  -Headers @{ "X-Device-Key" = "CHOOSE_A_LONG_RANDOM_KEY" } `
  -ContentType "application/json" `
  -Body '{"deviceId":"esp32-soil-001","soilPH":6.5,"soilMoisture":42.0,"electricalConductivity":0.8}'
```
Expected: `201`. Wrong key → `403`; bad ranges → `400`; fast repeat → `429`; browser write → denied by rules.

## 8. Connect ESP32 and sensors

1. Arduino IDE → install **ESP32 board support** (Boards Manager) and library **ArduinoJson** (v7).
2. Open `esp32/esp32_soil_monitor.ino`. Fill `WIFI_SSID`, `WIFI_PASS`, `DEVICE_KEY`, `ENDPOINT_URL`.
3. Replace the PLACEHOLDER sensor readers for your actual sensors.
4. Never put an Admin service account key or the backend service account in firmware — only the device key.

## 9. Verify real readings

Watch the Arduino Serial Monitor (115200 baud); check Firebase console → Realtime Database → `devices/esp32-soil-001/latest` and `/history`; the dashboard updates live.

## 10. Deploy the frontend

```powershell
firebase init hosting   # choose "dist" as the public folder, configure as SPA
npm run build
firebase deploy --only hosting
```
Then add the hosting URL to `telemetry.allowed_origins` and redeploy functions.

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| "Firebase: not configured" | `.env` missing/empty; restart `npm run dev` after editing |
| 403 Unauthorized device | Device key mismatch — recheck functions config and sketch |
| 429 Rate limit | One submission per device per 5 s |
| npm.ps1 scripts disabled | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Functions deploy fails on Spark | Blaze required (see step 5) |
| Charts empty | No history in selected range; check device is reporting |

## Testing checklist

1. Frontend starts (`npm run dev`). 2. Firebase connects (status pill shows connected). 3. Empty DB shows "Waiting for sensor data". 4. Valid dev test telemetry submits (step 7). 5. Dashboard updates live without refresh. 6. Invalid payloads rejected (400/403/413). 7. Browser writes to telemetry denied by rules. 8. Visitors read only `devices/**` paths. 9. Charts + CSV export work with data present. 10. Missing fields show "—" / "Insufficient data", no crash. 11. ESP32 prints clear serial errors on Wi-Fi/HTTP failure. 12. No secrets in frontend bundle (only public web config in `.env`, which is git-ignored).
