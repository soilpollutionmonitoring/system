/*
 * IoT Soil Pollution & Fertility Monitoring - ESP32 sketch
 *
 * Pipeline: Soil sensors -> ESP32 -> HTTPS POST /api/telemetry -> Firebase RTDB -> React dashboard
 *
 * IMPORTANT - PLACEHOLDERS (fill before use):
 *  - WIFI_SSID / WIFI_PASS      : your Wi-Fi credentials (do not commit real ones)
 *  - DEVICE_ID                  : e.g. "esp32-soil-001" (must match a key in functions.config telemetry.device_keys)
 *  - ENDPOINT_URL               : your deployed Cloud Function URL (see README step 5)
 *  - DEVICE_KEY                 : the device key you set in Firebase functions config (do not commit)
 *
 * IMPORTANT - HARDWARE PLACEHOLDERS:
 *  The sensor reading functions below are clearly marked placeholders because the
 *  exact sensor models are NOT DECIDED YET. Replace them with drivers for your
 *  chosen hardware (e.g. capacitive soil moisture v1.2, analog pH probe, RS485 NPK).
 *  The sketch compiles and submits only real, measured values - never fake data.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ---------------- Configuration (placeholders - fill in) ----------------
const char* WIFI_SSID   = "YOUR_WIFI_SSID";
const char* WIFI_PASS   = "YOUR_WIFI_PASSWORD";
const char* DEVICE_ID   = "esp32-soil-001";
const char* ENDPOINT_URL = "https:// asia-southeast1-soilpollution1-3c0d4.cloudfunctions.net/apiTelemetry"; // placeholder
const char* DEVICE_KEY  = "YOUR_DEVICE_KEY"; // set in Firebase functions config - do not commit

// ---------------- Retry / timeout settings ----------------
const int    WIFI_MAX_RETRIES = 5;
const int    WIFI_RETRY_DELAY_MS = 3000;
const int    HTTP_TIMEOUT_MS = 15000;
const unsigned long SUBMIT_INTERVAL_MS = 60000; // one reading per minute
unsigned long lastSubmit = 0;

// ---------------- Sensor data (only real readings go here) ----------------
struct Reading {
  bool valid = false;
  float soilPH = NAN;
  float soilMoisture = NAN;
  float soilTemperature = NAN;
  float electricalConductivity = NAN;
  float tds = NAN;
  float nitrogen = NAN;
  float phosphorus = NAN;
  float potassium = NAN;
};

// ================= PLACEHOLDER SENSOR READERS =================
// These functions are hardware-specific placeholders.
// Replace with real drivers for your chosen sensors. Never return fabricated
// values - if a sensor is not connected or fails, leave the field NAN.

float readSoilPH() {
  // PLACEHOLDER: analog pH probe (e.g. PH-4502C) - calibrate and convert ADC to pH
  return NAN; // not implemented until hardware chosen
}

float readSoilMoisture() {
  // PLACEHOLDER: capacitive soil moisture v1.2 - convert ADC to percent
  return NAN; // not implemented until hardware chosen
}

float readSoilTemperature() {
  // PLACEHOLDER: only fill if a real soil temperature sensor is installed
  return NAN; // no sensor installed
}

float readElectricalConductivity() {
  // PLACEHOLDER: EC sensor (e.g. DFRobot EC probe) - convert ADC to mS/cm
  return NAN; // not implemented until hardware chosen
}

float readNPK(uint8_t which) {
  // PLACEHOLDER: RS485 NPK sensor - Modbus read, returns mg/kg
  (void)which;
  return NAN; // not implemented until hardware chosen
}

// ================= Wi-Fi helpers =================

bool connectWifi() {
  for (int attempt = 1; attempt <= WIFI_MAX_RETRIES; attempt++) {
    Serial.printf("Wi-Fi: connecting attempt %d/%d to %s ...\n", attempt, WIFI_MAX_RETRIES, WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    if (WiFi.waitForConnectResult(10000) == WL_CONNECTED) {
      Serial.print("Wi-Fi: connected, IP: ");
      Serial.println(WiFi.localIP());
      return true;
    }
    Serial.println("Wi-Fi: connect failed, retrying...");
    delay(WIFI_RETRY_DELAY_MS);
  }
  Serial.println("Wi-Fi: ERROR - gave up after max retries. Check SSID/password/signal.");
  return false;
}

// ================= HTTPS submission =================

bool submitTelemetry(const Reading& r) {
  WiFiClientSecure client;
  client.setInsecure(); // development only: skips TLS cert verification. For production
                        // consider client.setCACert() with your endpoint's root CA.
  client.setTimeout(HTTP_TIMEOUT_MS / 1000);

  // Build JSON from valid fields only
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  if (!isnan(r.soilPH))                 doc["soilPH"] = r.soilPH;
  if (!isnan(r.soilMoisture))           doc["soilMoisture"] = r.soilMoisture;
  if (!isnan(r.soilTemperature))         doc["soilTemperature"] = r.soilTemperature;
  if (!isnan(r.electricalConductivity)) doc["electricalConductivity"] = r.electricalConductivity;
  if (!isnan(r.tds))                    doc["tds"] = r.tds;
  if (!isnan(r.nitrogen))               doc["nitrogen"] = r.nitrogen;
  if (!isnan(r.phosphorus))             doc["phosphorus"] = r.phosphorus;
  if (!isnan(r.potassium))              doc["potassium"] = r.potassium;

  String body;
  serializeJson(doc, body);

  // Simple host/path split (the endpoint URL is a fixed cloud function host)
  // NOTE: this is a minimal URL parser for the placeholder URL above.
  String url = ENDPOINT_URL;
  String host, path;
  if (url.startsWith("https://")) {
    String rest = url.substring(8);
    int slash = rest.indexOf('/');
    if (slash < 0) { host = rest; path = "/"; }
    else { host = rest.substring(0, slash); path = rest.substring(slash); }
  } else {
    Serial.println("HTTP: ERROR - ENDPOINT_URL must start with https://");
    return false;
  }

  Serial.printf("HTTP: POST %s%s\n", host.c_str(), path.c_str());
  if (!client.connect(host.c_str(), 443)) {
    Serial.println("HTTP: ERROR - could not connect (check URL, DNS, firewall).");
    return false;
  }

  // Request with device key header - NEVER print the key to serial
  client.printf("POST %s HTTP/1.1\r\n", path.c_str());
  client.printf("Host: %s\r\n", host.c_str());
  client.print("Content-Type: application/json\r\n");
  client.printf("X-Device-Key: %s\r\n", DEVICE_KEY);
  client.printf("Content-Length: %d\r\n", body.length());
  client.print("Connection: close\r\n\r\n");
  client.print(body);

  // Wait for response with timeout
  unsigned long start = millis();
  while (!client.available()) {
    if (millis() - start > HTTP_TIMEOUT_MS) {
      Serial.println("HTTP: ERROR - timed out waiting for response.");
      return false;
    }
    delay(10);
  }

  // Read status line only
  String statusLine = client.readStringUntil('\n');
  Serial.printf("HTTP: response: %s\n", statusLine.c_str());
  bool ok = statusLine.indexOf("201") >= 0;
  if (!ok) Serial.println("HTTP: WARNING - endpoint did not return 201. See its error message above.");
  // Drain remaining response
  while (client.connected() || client.available()) {
    if (client.available()) client.readStringUntil('\n');
    else break;
  }
  return ok;
}

// ================= Setup / loop =================

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 Soil Monitor ===");
  if (connectWifi()) {
    Serial.println("Ready. Submitting every 60s (only when real sensors report values).");
  } else {
    Serial.println("Continuing without Wi-Fi; will retry in loop().");
  }
}

void loop() {
  // Wi-Fi reconnect if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi: disconnected.");
    connectWifi();
  }

  if (millis() - lastSubmit < SUBMIT_INTERVAL_MS) {
    delay(1000);
    return;
  }
  lastSubmit = millis();

  Reading r;
  r.soilPH = readSoilPH();
  r.soilMoisture = readSoilMoisture();
  r.soilTemperature = readSoilTemperature();
  r.electricalConductivity = readElectricalConductivity();
  r.nitrogen = readNPK(0);
  r.phosphorus = readNPK(1);
  r.potassium = readNPK(2);

  bool anyField =
    !isnan(r.soilPH) || !isnan(r.soilMoisture) || !isnan(r.soilTemperature) ||
    !isnan(r.electricalConductivity) || !isnan(r.nitrogen) || !isnan(r.phosphorus) || !isnan(r.potassium);

  if (!anyField) {
    Serial.println("SENSORS: no valid readings this cycle (placeholders active or sensors missing). Nothing submitted.");
    // The backend requires at least one valid field; don't waste a request.
    return;
  }
  r.valid = true;
  r.tds = r.electricalConductivity * 500.0f; // derived TDS from EC (backend also validates this)
  if (isnan(r.electricalConductivity)) r.tds = NAN;

  if (submitTelemetry(r)) {
    Serial.println("Telemetry submitted successfully.");
  } else {
    Serial.println("Telemetry submission FAILED. Will retry next interval.");
  }
}
