# Smart Factory IoT API

The backend stores accounts, sensor readings, actuator state, and alerts in MongoDB. Login uses email/password accounts stored in MongoDB with bcrypt password hashes and JWT sessions. A built-in mock simulator writes readings for the configured demo user every five seconds; no Firebase, ESP32, or Wokwi project is required.

## Inventory stored in MongoDB

- Sensors: temperature, pressure, light intensity, humidity.
- Devices (16 total): 2 arm robots, 2 AVG robots, 2 conveyor belts, 4 LEDs, 2 corner fans, 2 surveillance cameras, and 2 auto machines.
- `DeviceState` stores the latest sensor and device snapshot. `Telemetry` stores readings over time. `AlertLog` stores alerts.

## Run locally

1. Set `MONGODB_URI`, `JWT_SECRET` (at least 32 random characters), `DEMO_USER_EMAIL`, and `DEMO_USER_PASSWORD` in `.env`. Do not commit `.env`.
2. Run `npm install`.
3. Run `npm run seed` once to create the demo login and assign it the initial 4 sensors, 16 devices, and sample log. Seeding an existing demo account does not reset its password.
4. Run `npm run dev`. The server refreshes sensor values and appends telemetry to MongoDB every five seconds.
5. Check `http://localhost:3000/health`; `database` should be `connected`.

The current sensor values are available at `GET /iot/status`; actuator switches update MongoDB directly at `POST /iot/control`. All IoT endpoints require a JWT from Mongo login. The demo dataset is scoped to `DEMO_USER_EMAIL`; other registered users do not see it.

## API

- `GET /health`
- `POST /auth/register`, `POST /auth/login`
- `GET /auth/me`, `PATCH /auth/me`, `POST /auth/upload-avatar`
- `GET /iot/status`
- `GET /iot/logs`, `DELETE /iot/logs`
- `PATCH /iot/logs/:id`, `DELETE /iot/logs/:id`
- `POST /iot/control` — body: `{ "name": "corner_fan_1", "is_on": true }`
- `PATCH /iot/devices/:deviceId`
- `POST /iot/devices/:deviceId/reset-health`

The Flutter web app defaults to `http://localhost:3000`. Android devices should use the PC's LAN address (or `10.0.2.2` for an Android emulator).