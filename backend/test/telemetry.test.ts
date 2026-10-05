import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialMockState, buildMockReading, DEVICE_INVENTORY } from '../src/mock-data.js';
import { buildSensorRecord, findAlerts } from '../src/telemetry.js';

test('creates the requested four sensor keys and classifies their levels', () => {
  const sensors = buildSensorRecord({
    temperature: 42,
    pressure: 1060,
    light_intensity: 20,
    humidity: 25,
  });

  assert.deepEqual(Object.keys(sensors), ['temperature', 'pressure', 'light_intensity', 'humidity']);
  assert.equal(sensors.temperature.level, 'RED');
  assert.equal(sensors.pressure.level, 'RED');
  assert.equal(sensors.light_intensity.level, 'RED');
  assert.equal(sensors.humidity.level, 'RED');
});

test('initializes the same 16 actuator records as the Flutter device list', () => {
  const state = buildInitialMockState();
  assert.equal(Object.keys(state.iot_sensors).length, 4);
  assert.equal(Object.keys(state.devices_control).length, 16);
  assert.ok(!('drone_guard_1' in state.devices_control));
  assert.ok(!('sensor_pod_1' in state.devices_control));
  assert.deepEqual(Object.keys(state.devices_control), Object.keys(DEVICE_INVENTORY));
});

test('simulated readings change over time while preserving manual device switches', () => {
  const initial = buildInitialMockState();
  initial.devices_control.corner_fan_1.is_on = true;
  initial.devices_control.corner_fan_1.power = 0;
  const next = buildMockReading(2, initial);
  assert.equal(next.devices_control.corner_fan_1.is_on, true);
  assert.equal(next.devices_control.corner_fan_1.rated_power, DEVICE_INVENTORY.corner_fan_1.power);
  assert.equal(next.devices_control.corner_fan_1.power, DEVICE_INVENTORY.corner_fan_1.power);
  assert.notEqual(next.iot_sensors.temperature.value, initial.iot_sensors.temperature.value);
});

test('creates alerts only when a sensor enters a non-green level', () => {
  const current = { iot_sensors: buildSensorRecord({ temperature: 42, pressure: 1014, light_intensity: 1200, humidity: 55 }) };
  const first = findAlerts(current);
  const repeated = findAlerts(current, { iot_sensors: current.iot_sensors });
  assert.equal(first.length, 1);
  assert.equal(first[0].sensor, 'temperature');
  assert.equal(repeated.length, 0);
});

test('rejects missing or non-numeric sensor values', () => {
  assert.throws(() => buildSensorRecord({ temperature: 20, pressure: Number.NaN, light_intensity: 500, humidity: 50 }), /Expected numeric value for pressure/);
});