# Low-cost Soil Moisture & Irrigation Advisor for Campus Gardens

A web-based system that helps campus grounds staff and gardening clubs keep plants healthy without guesswork. Low-cost soil moisture sensors placed in garden beds feed the system, which displays live moisture levels, tracks trends over time, and gives clear watering recommendations per garden zone — including a 3D visualization of the garden that color-codes each plot by moisture level.

The project includes a **self-contained irrigation simulation** that runs entirely in the browser with no backend or database required, modeling the full sensor-to-watering loop: raw ADC readings, calibration, drying physics, and rule-based auto-watering with per-zone thresholds and cooldown. It also includes a **3D hardware demo page** that renders a realistic model of the complete physical setup — ESP32 board, capacitive sensor, relay, pump, reservoir, plant pot, and wiring — with animated water flow and soil that changes color as moisture rises.

The Dashboard, Irrigation Log, and zone management pages all work **without a backend** too: they try the real API first, then silently fall back to the built-in simulation, so you never see a "could not reach the backend" error during a demo.

## Group Members

Section 1 · Computer Science and Engineering (CSE), except Dereje Bogale (Software Engineering) · 5th Year, except Biruk Tesfaye, Elsabet Negash, and Epherem Tesfaye (6th Year)

| ID | Name |
|---|---|
| UGE/24145/13 | Biruk Tesfaye |
| UGE/27686/14 | Dereje Bogale |
| UGE/27834/14 | Efa Mirkana Abdisa |
| UGE/24133/13 | Elsabet Negash |
| UGE/24149/13 | Epherem Tesfaye |
| UGE/27638/14 | Machir Tadesse Woldemariam |
| UGE/27831/14 | Musbha Rida |

## Tech Stack

**Frontend**
- React (Vite)
- Tailwind CSS
- Recharts (moisture history charts)
- Three.js (3D garden scene + 3D hardware rig)
- Offline data layer that falls back to the browser simulation when the backend is not running

**Backend**
- Node.js + Express.js
- MySQL (via `mysql2`)
- Rule-based irrigation advisor logic (no ML needed for a system this scale)

**Simulated sensor pipeline**
- A browser-based simulation engine (`frontend/src/simulation/irrigationEngine.js`) models a real sensor's measurement chain — per-zone-calibrated raw ADC drift, sensor noise, and a raw-to-percentage mapping matching real hardware — and runs the rule-based advisor to decide watering, all in the browser with no server.
- A Node-based simulator (`backend/src/simulator/sensorSimulator.js`) is also available for the full-stack deployment. It posts readings to the same `/api/readings` endpoint real sensors would use, and only applies a simulated "watering" effect when the backend's advisor actually returns `watered: true`, so the simulated physical world and the real decision logic never disagree.

## Project Structure

```
soil-moisture-irrigation-advisor/
├── backend/
│   ├── src/
│   │   ├── config/       # DB connection
│   │   ├── controllers/  # Route handler logic
│   │   ├── models/       # DB queries (zones, readings, irrigation events)
│   │   ├── routes/       # Express routers
│   │   ├── simulator/    # Node-based simulated sensor data generator
│   │   ├── utils/        # Irrigation advisor (threshold logic)
│   │   └── server.js
│   ├── migrations/       # SQL schema + seed zones
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/           # Axios client
    │   ├── components/    # StatusCards, MoistureChart, ModeBanner
    │   ├── data/          # Offline data layer (simStore + dataSource)
    │   ├── pages/         # Simulation, HardwareDemo, Dashboard, CreateZone, IrrigationLog, About
    │   ├── simulation/    # Browser-based irrigation engine (no backend needed)
    │   ├── three/         # GardenScene3D + HardwareRig3D (Three.js)
    │   └── main.jsx
    └── index.html
```

## Getting Started

### Step-by-step: Clone and run on your computer

1. **Install Node.js** — Download the LTS version from https://nodejs.org and install it. To verify, open a terminal and run `node --version` — you should see a version number like `v20.x.x` or higher.

2. **Download the project** — Go to https://github.com/IamMachir/soil-moisture-irrigation-advisor and click the green **Code** button, then **Download ZIP**. Extract the ZIP file. Or with Git installed, run:
   ```bash
   git clone https://github.com/IamMachir/soil-moisture-irrigation-advisor.git
   ```

3. **Go to the frontend folder** — Open a terminal and navigate into the `frontend` folder inside the project:
   ```bash
   cd soil-moisture-irrigation-advisor/frontend
   ```

4. **Install dependencies** — This downloads the libraries the app needs. Wait for it to finish:
   ```bash
   npm install
   ```

5. **Start the app** — This launches a local development server:
   ```bash
   npm run dev
   ```

6. **Open the app** — The terminal will show a local URL like `http://localhost:5174`. Open that URL in your browser. The **Simulation** tab loads automatically as the first page.

No backend, database, or hardware is needed — everything runs in the browser. The Dashboard, Irrigation Log, and Add Zone pages also work without a backend by falling back to the built-in simulation.

### Option 1: Run the browser simulation (no backend needed)

The simulation page runs entirely in the browser — no database, no server.

```bash
cd frontend
npm install
npm run dev
```

Open the app and click the **Simulation** tab. You'll see four garden zones with live moisture readings that dry out over time and auto-water when they cross their threshold. You can pause/resume, add zones, manually water, and watch the event log fill up. Click the **Hardware Demo** tab to see the 3D hardware rig with all components labeled.

### Option 2: Run the full-stack system

#### Backend

```bash
cd backend
cp .env.example .env   # fill in your MySQL credentials
npm install
mysql -u root -p < migrations/001_init_schema.sql
npm run dev
```

#### Run the Node-based sensor simulator (separate terminal)

```bash
cd backend
npm run simulate
```

#### Seed historical data (optional but recommended for demos)

```bash
cd backend
npm run seed
```

This backfills 48 hours of realistic moisture history (with a day/night cycle and matching irrigation events for low-moisture points) per zone, so the dashboard's chart and irrigation log aren't empty the moment you open it.

#### Run tests

```bash
cd backend
npm test
```

Covers input validation rules and the rule-based irrigation advisor — including per-zone threshold behavior — using Jest with mocked models, no database connection required.

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:5001/api` (configurable via `VITE_API_URL`).

## How It Works

### Browser Simulation

1. Each zone has a simulated raw ADC value (0–4095, matching a 12-bit ESP32 ADC) that drifts upward as soil dries, modulated by a day/night evaporation cycle.
2. Noise is added to each reading, then the raw value is mapped to a 0–100% moisture percentage using per-zone calibration (wet/dry raw points) — the same formula real firmware uses.
3. The advisor checks if moisture is below the zone's own threshold. If so, it verifies the cooldown window has passed since the last watering event before triggering.
4. When watering fires (auto or manual), the raw value recovers 60–85% toward the wet calibration point — simulating a pump pulse that doesn't instantly saturate the root zone.
5. All events are logged and displayed in the event log panel.

### Full-Stack System

1. The Node simulator (or real sensor firmware) posts a calibrated moisture reading per zone to `POST /api/readings`.
2. The backend stores it and runs it through the irrigation advisor, which flags a zone for watering if moisture drops below that zone's own configurable threshold — and enforces a cooldown (`IRRIGATION_COOLDOWN_MINUTES`) so a zone sitting below threshold doesn't re-trigger on every reading.
3. The API response includes `advisorResult.watered` — real firmware acts on this directly (pulsing a relay) rather than duplicating the threshold/cooldown logic locally, so changing a zone's threshold in the dashboard takes effect immediately without reflashing hardware.
4. The dashboard polls `/api/readings/latest` for live status cards and a Three.js 3D scene, and `/api/readings/history/:zoneId` for the moisture trend chart.
5. In the 3D scene, each garden plot is color-coded (red = dry, amber = moderate, green = well-watered), and an animated sprinkler cue appears on zones currently below threshold.

## Hardware Components

| Component | Spec |
|---|---|
| Microcontroller | ESP32 DevKit v1 (12-bit ADC, built-in WiFi) |
| Soil sensor | Capacitive soil moisture sensor v1.2/v2.0 (not resistive — avoids probe corrosion) |
| Actuator | 1-channel 5V relay module + small DC water pump (or solenoid valve) |
| Power | 5V/2A USB supply (ESP32) + separate supply matched to the pump's voltage |

### Bill of Materials

| Component | Spec | Qty (per zone) | Notes |
|---|---|---|---|
| Microcontroller | ESP32 DevKit v1 (or similar, e.g. ESP32-WROOM-32) | 1 per zone, or 1 shared unit multiplexing several probes | Chosen over Arduino Uno because it has built-in WiFi — required to POST to this project's REST API without extra bridge hardware. 12-bit ADC (0–4095). |
| Soil moisture sensor | Capacitive soil moisture sensor v1.2/v2.0 | 1 per zone | Capacitive, not resistive — the exposed-probe resistive style (LM393 two-probe module) corrodes in soil within weeks; capacitive sensors don't have exposed conductors and last far longer. |
| Relay module | 1-channel 5V relay module (opto-isolated) | 1 per zone | Drives the pump. Most cheap modules are active-LOW (a LOW signal energizes the relay) — verify yours before wiring. |
| Water pump | Small submersible 5V/12V DC pump, or a 12V solenoid valve if on mains water pressure | 1 per zone | Match pump voltage to your available power supply. |
| Power supply | 5V/2A USB supply per ESP32; separate supply for the pump matching its voltage | 1 each | Do not power the pump from the ESP32's 5V pin — pumps draw far more current than the board can safely supply. |
| Misc | Jumper wires, breadboard or perfboard, waterproof enclosure, silicone/epoxy to weatherproof exposed sensor wiring joints | — | The enclosure matters — this is going in a garden bed, and a single rain event on an unprotected ESP32 ends the deployment. |

### Wiring

```
[Capacitive Moisture Sensor] --Analog signal--> [ESP32]
[ESP32] --GPIO control signal--> [Relay Module]
[Relay Module] --Switches power--> [Water Pump]
[Pump Power Supply] --> [Relay Module]
[ESP32] --WiFi, HTTP POST--> [Backend API  POST /api/readings]
[Backend API] --advisorResult.watered--> [ESP32]
```

**Sensor to ESP32:**
- Sensor VCC to ESP32 3.3V (check your specific module's datasheet)
- Sensor GND to ESP32 GND
- Sensor analog output (AOUT) to an ADC1 pin (GPIO32–39). Avoid ADC2 pins — they conflict with WiFi and give unreliable readings.

**ESP32 to Relay to Pump:**
- Relay VCC to ESP32 5V
- Relay GND to ESP32 GND
- Relay IN to any free GPIO (e.g. GPIO26)
- Relay COM/NO in series with the pump's power line from its own supply (not the ESP32's supply)

**Power-gating the sensor (recommended):** wire the sensor's VCC through a spare GPIO instead of a permanent power rail, so firmware only energizes the sensor for the ~50ms it takes to read it, then powers it off. This extends sensor lifetime and reduces power draw.

### Calibration

Every sensor unit reads differently even for identical soil — this is why calibration is per-zone data, not a shared constant. Calibrate each physical sensor you deploy:

1. Flash the firmware with `DEBUG_MODE` enabled (prints raw ADC values to Serial).
2. Submerge the probe fully in a glass of water. Wait 10 seconds for the reading to settle. Record this as **wetRaw**.
3. Dry the probe completely. Record this as **dryRaw**.
4. Enter both values into the firmware's calibration for that specific device.
5. Re-check every few months — capacitive sensors drift slowly with age.

Expect wetRaw roughly in the 1100–1400 range and dryRaw roughly in the 2800–3200 range on a 12-bit ESP32 ADC, but use your own measured values.

### Firmware Reference (ESP32, Arduino framework)

This mirrors the project's simulation logic exactly (raw ADC to calibrated percentage to POST to act on the response), so switching from the software simulation to this firmware requires no backend changes.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_URL = "http://YOUR_BACKEND_HOST:5001/api/readings";
const int ZONE_ID = 1;

const int WET_RAW = 1200;  // replace with YOUR measured value
const int DRY_RAW = 3000;  // replace with YOUR measured value

const int SENSOR_POWER_PIN = 27;
const int SENSOR_ADC_PIN = 34;
const int RELAY_PIN = 26;

const unsigned long READ_INTERVAL_MS = 10UL * 60UL * 1000UL;
const unsigned long PUMP_PULSE_MS = 5000UL;
const bool RELAY_ACTIVE_LOW = true;

void relayWrite(bool energize) {
  digitalWrite(RELAY_PIN, (energize == RELAY_ACTIVE_LOW) ? LOW : HIGH);
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_POWER_PIN, OUTPUT);
  digitalWrite(SENSOR_POWER_PIN, LOW);
  pinMode(RELAY_PIN, OUTPUT);
  relayWrite(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

float rawToPercent(int raw) {
  int clamped = constrain(raw, WET_RAW, DRY_RAW);
  float percent = ((float)(DRY_RAW - clamped) / (float)(DRY_RAW - WET_RAW)) * 100.0;
  return constrain(percent, 0.0, 100.0);
}

int readCalibratedRaw() {
  digitalWrite(SENSOR_POWER_PIN, HIGH);
  delay(50);
  int raw = analogRead(SENSOR_ADC_PIN);
  digitalWrite(SENSOR_POWER_PIN, LOW);
  return raw;
}

void loop() {
  int raw = readCalibratedRaw();
  float moisturePercent = rawToPercent(raw);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<128> requestDoc;
    requestDoc["zoneId"] = ZONE_ID;
    requestDoc["moisturePercent"] = moisturePercent;
    String requestBody;
    serializeJson(requestDoc, requestBody);

    int httpCode = http.POST(requestBody);
    if (httpCode == 201) {
      String responseBody = http.getString();
      StaticJsonDocument<256> responseDoc;
      deserializeJson(responseDoc, responseBody);
      bool watered = responseDoc["advisorResult"]["watered"] | false;
      if (watered) {
        relayWrite(true);
        delay(PUMP_PULSE_MS);
        relayWrite(false);
      }
    }
    http.end();
  }
  delay(READ_INTERVAL_MS);
}
```

Libraries needed: `WiFi.h` and `HTTPClient.h` ship with the ESP32 Arduino core; install `ArduinoJson` via the Arduino IDE Library Manager.

### Arduino Uno Alternative

If the team already has Arduino Uno hardware rather than an ESP32, the Uno has no WiFi, so it cannot POST directly. Two options:

1. **Serial bridge**: keep the Uno reading the sensor and printing over Serial, and run a small script on a nearby PC/Raspberry Pi that reads the Serial output and forwards it via HTTP POST to the backend.
2. **Add an ESP8266 as a WiFi co-processor** to the Uno — more wiring complexity, not recommended over just using an ESP32 directly.

The Arduino Uno's ADC is 10-bit (0–1023), not the ESP32's 12-bit (0–4095). Calibration values must match whichever board actually takes the reading.

### Safety Notes

- Never let the pump's electrical supply and the sensor probes share exposed wiring near standing water or wet soil.
- The relay module isolates the ESP32's low-voltage logic from the pump's power circuit — do not bypass this isolation.
- If using mains-adjacent power, that wiring should be handled by someone qualified to do so.

## Deployment

- **Backend + simulator**: `render.yaml` defines two services for Render — the API server and the sensor simulator as a background worker. Railway works similarly.
- **Database**: A managed MySQL instance on Railway, PlanetScale, or Render's MySQL add-on. Run the migration once, then optionally seed historical data.
- **Frontend**: Deploy `frontend/` to Vercel or Netlify. Set `VITE_API_URL` to your deployed backend's `/api` URL, and confirm CORS allows your frontend's domain.
- **Real hardware (future)**: if ESP32 + soil sensors are wired up later, they can POST directly to the same deployed `/api/readings` endpoint the simulator uses today — no backend changes needed.

## Features

- [x] Garden zone schema + seed data
- [x] Sensor reading ingestion + rule-based watering advisor
- [x] Browser-based irrigation simulation (no backend or database required)
- [x] Offline data layer — Dashboard and Irrigation Log fall back to simulation when backend is down
- [x] 3D hardware demo rig with all physical components (ESP32, sensor, relay, pump, reservoir, plant pot)
- [x] Node-based simulated sensor data generator with per-zone variance + day/night cycle
- [x] Dashboard: live status cards + moisture history chart
- [x] 3D garden scene with moisture color-coding, orbit controls, and hover tooltips
- [x] Manual "water this zone" trigger from the dashboard, simulation, and hardware demo
- [x] Historical irrigation event log view
- [x] Server-side input validation on all write endpoints
- [x] Seed script for historical demo data
- [x] Per-zone configurable moisture thresholds
- [ ] Real sensor hardware integration (ESP32 + soil sensor)
