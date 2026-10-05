import { buildSensorRecord, type SensorKey } from './telemetry.js';

type DeviceDefinition = {
  name: string;
  category: string;
  icon: string;
  power: number;
};

export const DEVICE_INVENTORY: Record<string, DeviceDefinition> = {
  arm_robot_1: { name: 'Arm Robot 1', category: 'Robot Arm', icon: 'robot', power: 320, },
  arm_robot_2: { name: 'Arm Robot 2', category: 'Robot Arm', icon: 'robot', power: 320, },
  avg_robot_1: { name: 'AVG Robot 1', category: 'AVG Robot', icon: 'robot', power: 180, },
  avg_robot_2: { name: 'AVG Robot 2', category: 'AVG Robot', icon: 'robot', power: 180, },
  conveyor_belt_1: { name: 'Băng tải 1', category: 'Conveyor', icon: 'conveyor', power: 750, },
  conveyor_belt_2: { name: 'Băng tải 2', category: 'Conveyor', icon: 'conveyor', power: 750, },
  left_led_1: { name: 'LED trái 1', category: 'LED', icon: 'light', power: 18, },
  left_led_2: { name: 'LED trái 2', category: 'LED', icon: 'light', power: 18, },
  right_led_1: { name: 'LED phải 1', category: 'LED', icon: 'light', power: 18, },
  right_led_2: { name: 'LED phải 2', category: 'LED', icon: 'light', power: 18, },
  corner_fan_1: { name: 'Quạt góc 1', category: 'Fan', icon: 'fan', power: 90, },
  corner_fan_2: { name: 'Quạt góc 2', category: 'Fan', icon: 'fan', power: 90, },
  security_camera_1: { name: 'Camera giám sát góc 1', category: 'Camera', icon: 'camera', power: 12, },
  security_camera_2: { name: 'Camera giám sát góc 2', category: 'Camera', icon: 'camera', power: 12, },
  auto_machine_1: { name: 'Máy Auto 1', category: 'Machine', icon: 'machine', power: 500, },
  auto_machine_2: { name: 'Máy Auto 2', category: 'Machine', icon: 'machine', power: 500, },
};

const initiallyOn = new Set([
  'arm_robot_1', 'avg_robot_1', 'conveyor_belt_1', 'left_led_1', 'right_led_2',
  'corner_fan_2', 'security_camera_1', 'security_camera_2', 'auto_machine_1',
]);

export function buildInitialMockState(now = new Date()) {
  const readings: Record<SensorKey, number> = {
    temperature: 27.4,
    pressure: 1014.2,
    light_intensity: 1320,
    humidity: 56.8,
  };
  const devices_control = Object.fromEntries(
    Object.entries(DEVICE_INVENTORY).map(([id, definition]) => {
      const is_on = initiallyOn.has(id);
      return [id, {
        ...definition,
        rated_power: definition.power,
        is_on,
        status: is_on ? 'Running' : 'Off',
        power: is_on ? definition.power : 0,
        runtime: is_on ? 42 : 0,
        health: 100,
        updated_at: now,
      }];
    }),
  );
  return {
    iot_sensors: buildSensorRecord(readings, now),
    devices_control,
    last_seen: now,
  };
}

export function buildMockReading(tick: number, previous: Record<string, any> | null, now = new Date()) {
  const phase = tick / 5;
  const readings: Record<SensorKey, number> = {
    temperature: Number((27 + Math.sin(phase) * 5).toFixed(1)),
    pressure: Number((1014 + Math.sin(phase / 1.4) * 12).toFixed(1)),
    light_intensity: Math.round(1350 + Math.sin(phase / 1.8) * 950),
    humidity: Number((56 + Math.sin(phase / 1.2) * 17).toFixed(1)),
  };
  const previousDevices = previous?.devices_control ?? {};
  const devices_control = Object.fromEntries(
    Object.entries(DEVICE_INVENTORY).map(([id, definition]) => {
      const existing = previousDevices[id] ?? {};
      const is_on = Boolean(existing.is_on ?? initiallyOn.has(id));
      return [id, {
        ...definition,
        ...existing,
        rated_power: Number(existing.rated_power ?? definition.power),
        is_on,
        status: is_on ? 'Running' : 'Off',
        power: is_on ? Number(existing.rated_power ?? definition.power) : 0,
        runtime: Number(existing.runtime ?? 0) + (is_on ? 5 / 60 : 0),
        health: Number(existing.health ?? 100),
        updated_at: now,
      }];
    }),
  );
  return {
    iot_sensors: buildSensorRecord(readings, now),
    devices_control,
    last_seen: now,
  };
}