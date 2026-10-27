# IoT-Based Soil Pollution and Fertility Monitoring System — ESP32 + Firebase

Real soil data from your ESP32 (NPK via RS485/Modbus, capacitive moisture, DS18B20 temperature) → Cloud Function → Firebase Realtime Database → public React dashboard rebuilt from your reference design.

- **No login pages.** Opens directly to the dashboard.
- **Real data only.** No pH/EC/pollution sensor exists, so those are shown as "Not measured (no sensor installed)" — never inferred or faked.
- ⚠️ **Public read access means anyone with the link can read the monitoring paths** (`devices/**` read-only). Nothing else is public; no client can write.

## Sensors (unchanged from your firmware)
| Sensor | Connection | Logic |
|---|---|---|
| NPK (RS485/Modbus) | MAX485 DE/RE GPIO 5, UART2 16/17, 9600 baud, slave 72 | `readHoldingRegisters(0x0000,10)`, N/P/K from buffer 3/4/5 mg/kg |
| Soil moisture | GPIO 34 | `map (adc, 2900, 1000, 0, 100)` |
| DS18B20 temperature | GPIO 14 | `DEVICE_DISCONNECTED_C` -> invalid |

## 1. Verify tools (PowerShell, project root)
```powershell
node --version; npm --version; firebase --version# firebase: npm i-g firebase-tools if missing
```
If scripts are blocked: `Set-ExecutionPolicy-Scope CurrentUser RemoteSigned`.

## 2. Install dependencies
```powershell
npm install
Set-Location functions; npm install; Set-Location..
```

## 3. Configure `.env`(project root)
Firebase console  Project settings  your web app  copy config values:
```powershell
Copy-Item.env.example.env
notepad.env
```

## 4. Deploy database rules (project root)
```powershell
firebase login
firebase deploy--only database
```

## 5. Backend— ⚠️  Cloud Functions need the**Blaze** plan
On**Spark you cannot deploy Cloud Functions.** Options:
1. Upgrade to Blaze (pay-as-you-go; the modest traffic of this app usually stays in the free tier).
2. Fallback on Spark: run the same receiving logic on any free host— or (less secure) let the ESP32 write directly with a database rule that checks a secret. Trade-off: the key lives in firmware, and the write path must be publicly writable, which weakens the read-only guarantee. Prefer Blaze.

On Blaze:
```powershell
firebase functions:config:set telemetry.device_keys='{\"esp32-soil-001\":\"CHOOSE_A_LONG_RANDOM_KEY\"}'
firebase functions:config:set telemetry.allowed_origins='http://localhost:5173'
Set-Location functions; npm run build; Set-Location..
firebase deploy--only functions
```
Note the printed function URL (ends in `/apiTelemetry`).

## 6. Run the dashboard (project root)
```powershell
npm run dev
```
http://localhost:5173— empty database shows the waiting state.

## 7. Test the API (DEV TEST ONLY— clearly labeled, not a production path)
```powershell
Invoke-RestMethod-Method Post-Uri"<FUNCTION_URL>" `
•Headers@{"X-Device-Key" ="CHOOSE_A_LONG_RANDOM_KEY"} `
•ContentType"application/json" `
•Body'{"deviceId":"esp32-soil-001","soilMoisture":42,"soilTemperature":27.5,"nitrogen":80,"phosphorus":35,"potassium":110,"npkValid":true,"temperatureValid":true,"firmwareVersion":"1.0.0"}'
```
Expected `201`. Wrong key  403; out-of-range  400; fast repeat  429; browser write  denied by rules.

## 8. Flash the ESP32 (Arduino IDE)
1. Install ESP32 boards + libraries:**ModbusMaster, OneWire, DallasTemperature, ArduinoJson**.
2. Copy `firmware/secrets.h.example`  `firmware/secrets.h` and fill in Wi-Fi, device key, endpoint URL.
3. Open `firmware/esp32_soil_firebase.ino`. Static IP off by default(`USE_STATIC_IP 0`); Blynk off(`USE_BLYNK` commented).
4. Sensor code is unchanged from your working firmware. Serial monitor: 115200.

## 9. Verify real readings
Serial monitor shows each POST and the HTTP status. Check Firebase console  Realtime Database  `devices/esp32-soil-001/latest` and `/history`. Dashboard updates live.

## 10. Deploy the frontend
```powershell
firebase init hosting# public folder: dist, SPA: yes
npm run build
firebase deploy--only hosting
```
Then add the hosting URL to `telemetry.allowed_origins` and redeploy functions.

## Troubleshooting
| Problem | Fix |
|---|---|
|"Firebase: not configured" | `.env` empty/missing— restart `npm run dev` |
| 403 from API | Device key mismatch (functions config vs secrets.h) |
| 429 | One POST per device per 5 s |
| npm scripts blocked | `Set-ExecutionPolicy-Scope CurrentUser RemoteSigned` |
| Functions deploy fails | Requires Blaze (see step 5) |
| Weather shows unavailable | Location permission denied— panel stays empty, no fake values |
| Charts empty | No history in the selected range yet |

## Testing checklist
1. Frontend starts(`npm run dev`). 2. Firebase connects (status bar). 3. Empty DB shows waiting state. 4. Dev test POST accepted (step 7). 5. Invalid POST rejected(400/403/413). 6. Browser writes denied by rules. 7. Dashboard updates live without refresh. 8. Charts + CSV export work. 9. `null` sensor fields show" — "/"Insufficient data", no crash. 10. ESP32 offline shows disconnected state. 11. No secrets in bundle/repo(`.env`, `secrets.h`, keys all git-ignored).

## What was verified
Frontend `tsc` + `vite build` pass; functions `tsc` passes; thresholds JSON parses.**Not verified:** firebase deployment, live API round-trip, and the real ESP32— no deployment or hardware was touched.
