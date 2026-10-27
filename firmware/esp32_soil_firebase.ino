/*
 * IoT Soil Fertility Monitoring — ESP32 → Firebase (HTTPS endpoint)
 *
 * Derived from the user's working reference firmware (reference-firmware.ino).
 * The hardware logic is UNCHANGED:
 *   - RS485/Modbus NPK: MAX485 DE/RE on GPIO 5, UART2 on pins 16/17, 9600 baud,
 *     slave ID 72, readHoldingRegisters(0x0000, 10), N/P/K from buffer 3/4/5 (mg/kg)
 *   - Soil moisture: analog GPIO 34, map(adc, 2900, 1000, 0, 100), constrained 0..100
 *   - DS18B20 soil temperature on GPIO 14, DEVICE_DISCONNECTED_C => invalid
 *   - Validity flags npkValid / temperatureValid preserved
 *
 * Added for the cloud pipeline:
 *   - HTTPS POST of the JSON payload to the Cloud Function endpoint every
 *     TELEMETRY_INTERVAL seconds (default 15 s, configurable below)
 *   - Device key sent in the X-Device-Key header (stored in secrets.h, git-ignored)
 *   - Wi-Fi reconnect with retries, HTTP timeouts, clear serial errors,
 *     NON-BLOCKING loop (server + Blynk keep running even when submissions fail)
 *   - Static IP is optional (USE_STATIC_IP)
 *   - Embedded HTML dashboard REMOVED (dashboard is hosted separately); /api/data kept
 *   - Blynk optional behind USE_BLYNK
 *
 * Library deps (Arduino Library Manager): ModbusMaster, OneWire, DallasTemperature, ArduinoJson
 * Board: ESP32
 */

#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include <ModbusMaster.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ---- Optional Blynk ----
// #define USE_BLYNK          // uncomment to enable Blynk
#ifdef USE_BLYNK
  #define BLYNK_TEMPLATE_ID   BLYNK_TEMPLATE_ID_PLACEHOLDER
  #define BLYNK_TEMPLATE_NAME BLYNK_TEMPLATE_NAME_PLACEHOLDER
  #define BLYNK_AUTH_TOKEN    BLYNK_AUTH_TOKEN_PLACEHOLDER
  #include <BlynkSimpleEsp32.h>
#endif

#include "secrets.h"   // copy secrets.h.example -> secrets.h and fill in (git-ignored)

// ================= PINS / SENSORS (unchanged from reference) =================
#define MAX485_RE_DE 5
HardwareSerial RS485Serial(2);
ModbusMaster node;

#define SOIL_PIN 34
#define ONE_WIRE_BUS 14
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// ================= SENSOR DATA (unchanged) =================
int nitrogen = 0;
int phosphorus = 0;
int potassium = 0;
int moisture = 0;
float soilTemperature = -127.0;
bool npkValid = false;
bool temperatureValid = false;

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 2000;   // unchanged: read sensors every 2 s

// ================= TELEMETRY (new) =================
#define USE_STATIC_IP 0                       // set 1 to use the static IP in secrets.h
const unsigned long TELEMETRY_INTERVAL = 15000UL; // POST every 15 s (10–30 s recommended)
unsigned long lastTelemetry = 0;
const int WIFI_MAX_RETRIES = 5;
const int WIFI_RETRY_DELAY_MS = 3000;
const unsigned long HTTP_TIMEOUT_MS = 15000;
const char* FIRMWARE_VERSION = "1.0.0";

WebServer server(80);

// ================= RS485 TRANSMISSION (unchanged) =================
void preTransmission()  { digitalWrite(MAX485_RE_DE, HIGH); }
void postTransmission() { digitalWrite(MAX485_RE_DE, LOW);  }

// ================= READ ALL SENSORS (unchanged logic) =================
void readAllSensors() {
  // ---------------- NPK ----------------
  uint8_t result = node.readHoldingRegisters(0x0000, 10);
  if (result == node.ku8MBSuccess) {
    nitrogen   = node.getResponseBuffer(3);
    phosphorus = node.getResponseBuffer(4);
    potassium  = node.getResponseBuffer(5);
    npkValid = true;
  } else {
    npkValid = false;
    Serial.print("NPK read failed. Error: ");
    Serial.println(result);
  }

  // ---------------- SOIL MOISTURE ----------------
  int adc = analogRead(SOIL_PIN);
  moisture = map(adc, 2900, 1000, 0, 100);   // current calibration, unchanged
  moisture = constrain(moisture, 0, 100);

  // ---------------- SOIL TEMPERATURE ----------------
  sensors.requestTemperatures();
  soilTemperature = sensors.getTempCByIndex(0);
  temperatureValid = (soilTemperature != DEVICE_DISCONNECTED_C);

  // ---------------- SERIAL MONITOR ----------------
  Serial.println();
  Serial.println("==============================");
  if (npkValid) {
    Serial.print("Nitrogen    : "); Serial.println(nitrogen);
    Serial.print("Phosphorus  : "); Serial.println(phosphorus);
    Serial.print("Potassium   : "); Serial.println(potassium);
  } else {
    Serial.println("NPK         : NOT AVAILABLE");
  }
  Serial.print("Soil Moisture : "); Serial.print(moisture); Serial.println("%");
  if (temperatureValid) {
    Serial.print("Soil Temperature : "); Serial.print(soilTemperature); Serial.println(" C");
  } else {
    Serial.println("Soil Temperature : NOT AVAILABLE");
  }
  Serial.println("==============================");
}

// ================= WIFI =================
bool connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  for (int attempt = 1; attempt <= WIFI_MAX_RETRIES; attempt++) {
    Serial.printf("WiFi: connect attempt %d/%d to %s ...\n", attempt, WIFI_MAX_RETRIES, WIFI_SSID);
    WiFi.mode(WIFI_STA);
#if USE_STATIC_IP
    IPAddress local_IP(STATIC_IP), gateway(STATIC_GW), subnet(STATIC_SN), primaryDNS(STATIC_GW), secondaryDNS(8,8,8,8);
    if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
      Serial.println("Static IP configuration failed! Falling back to DHCP.");
    }
#endif
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    if (WiFi.waitForConnectResult(10000) == WL_CONNECTED) {
      Serial.print("WiFi connected! IP: ");
      Serial.println(WiFi.localIP());
      return true;
    }
    Serial.println("WiFi: connect failed, retrying...");
    delay(WIFI_RETRY_DELAY_MS);
  }
  Serial.println("WiFi: ERROR - gave up after max retries. Will retry later.");
  return false;
}

// ================= HTTPS TELEMETRY =================
// POSTs the reading to the Cloud Function. Invalid sensor fields are sent as null.
bool submitTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Telemetry: skipped, no WiFi.");
    return false;
  }

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  if (temperatureValid) doc["soilTemperature"] = soilTemperature; else doc["soilTemperature"] = nullptr;
  doc["soilMoisture"] = moisture;
  if (npkValid) {
    doc["nitrogen"]   = nitrogen;
    doc["phosphorus"] = phosphorus;
    doc["potassium"]  = potassium;
  } else {
    doc["nitrogen"]   = nullptr;
    doc["phosphorus"] = nullptr;
    doc["potassium"]  = nullptr;
  }
  doc["npkValid"] = npkValid;
  doc["temperatureValid"] = temperatureValid;
  doc["firmwareVersion"] = FIRMWARE_VERSION;

  String body;
  serializeJson(doc, body);
  // NOTE: the key is sent in a header and never printed to serial.

  WiFiClientSecure client;
  client.setInsecure(); // dev convenience: skips TLS CA verification. For production,
                        // replace with client.setCACert(rootCACert) for your endpoint.
  client.setTimeout(HTTP_TIMEOUT_MS / 1000);

  HTTPClient http;
  if (!http.begin(client, ENDPOINT_URL)) {
    Serial.println("Telemetry: ERROR - could not init HTTP (check ENDPOINT_URL).");
    return false;
  }
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);

  Serial.print("Telemetry: POST ");
  Serial.println(body);
  int code = http.POST(body);
  if (code > 0) {
    Serial.printf("Telemetry: HTTP %d\n", code);
    if (code != 201) {
      Serial.print("Telemetry: endpoint said: ");
      Serial.println(http.getString().substring(0, 200));
    }
  } else {
    Serial.printf("Telemetry: ERROR - connection failed (%s)\n", http.errorToString(code).c_str());
  }
  http.end();
  return code == 201;
}

// ================= LOCAL API (kept from reference) =================
void handleSensorData() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  String json = "{";
  json += "\"nitrogen\":";        json += npkValid ? String(nitrogen) : "null";           json += ",";
  json += "\"phosphorus\":";      json += npkValid ? String(phosphorus) : "null";         json += ",";
  json += "\"potassium\":";       json += npkValid ? String(potassium) : "null";          json += ",";
  json += "\"soilMoisture\":";    json += String(moisture);                               json += ",";
  json += "\"soilTemperature\":"; json += temperatureValid ? String(soilTemperature, 1) : "null"; json += ",";
  json += "\"npkValid\":";        json += npkValid ? "true" : "false";                    json += ",";
  json += "\"temperatureValid\":";json += temperatureValid ? "true" : "false";
  json += "}";
  server.send(200, "application/json", json);
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println("Starting IoT Soil Fertility Monitor (Firebase edition)...");
  Serial.println();

  pinMode(MAX485_RE_DE, OUTPUT);
  digitalWrite(MAX485_RE_DE, LOW);

  RS485Serial.begin(9600, SERIAL_8N1, 16, 17);
  node.begin(72, RS485Serial);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  sensors.begin();

  if (!connectWifi()) {
    Serial.println("Continuing without WiFi; will retry in loop().");
  }

#ifdef USE_BLYNK
  Blynk.config(BLYNK_AUTH_TOKEN);
  if (Blynk.connect(5000)) Serial.println("Blynk connected!");
  else Serial.println("Blynk connection failed (continuing without it).");
#endif

  server.on("/api/data", handleSensorData);  // local API kept
  server.begin();
  Serial.print("Local API: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/api/data");

  readAllSensors();
  lastSensorRead = millis();
  Serial.println("System Started!");
}

// ================= LOOP (non-blocking) =================
void loop() {
#ifdef USE_BLYNK
  Blynk.run();
#endif
  server.handleClient();   // local web requests keep working during failures

  // Reconnect WiFi if dropped (bounded retries, non-blocking for the rest)
  if (WiFi.status() != WL_CONNECTED && millis() - lastTelemetry > 30000) {
    connectWifi();
  }

  // Read sensors every 2 s (unchanged)
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = millis();
    readAllSensors();

#ifdef USE_BLYNK
    if (Blynk.connected()) {
      if (npkValid) {
        Blynk.virtualWrite(V0, nitrogen);
        Blynk.virtualWrite(V1, phosphorus);
        Blynk.virtualWrite(V2, potassium);
      }
      Blynk.virtualWrite(V3, moisture);
      if (temperatureValid) Blynk.virtualWrite(V4, soilTemperature);
    }
#endif
  }

  // Submit to Firebase every TELEMETRY_INTERVAL
  if (millis() - lastTelemetry >= TELEMETRY_INTERVAL) {
    lastTelemetry = millis();
    if (submitTelemetry()) {
      Serial.println("Telemetry submitted successfully.");
    } else {
      Serial.println("Telemetry submission FAILED. Will retry next interval.");
    }
  }
}
