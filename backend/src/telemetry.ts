export const SENSOR_DEFINITIONS = {
  temperature: { label: 'Nhiệt độ', unit: '°C' },
  pressure: { label: 'Áp suất', unit: 'hPa' },
  light_intensity: { label: 'Ánh sáng', unit: 'lux' },
  humidity: { label: 'Độ ẩm', unit: '%' },
} as const;

export type SensorKey = keyof typeof SENSOR_DEFINITIONS;
export type SensorLevel = 'GREEN' | 'YELLOW' | 'RED';
export type SensorRecord = Record<SensorKey, {
  value: number;
  unit: string;
  level: SensorLevel;
  is_online: boolean;
  updated_at: Date;
}>;

export type SensorState = { iot_sensors?: Partial<Record<SensorKey, { level?: string }>> };

export function sensorLevel(key: SensorKey, value: number): SensorLevel {
  switch (key) {
    case 'temperature':
      return value >= 40 ? 'RED' : value >= 32 ? 'YELLOW' : 'GREEN';
    case 'pressure':
      return value < 970 || value > 1050 ? 'RED' : value < 990 || value > 1030 ? 'YELLOW' : 'GREEN';
    case 'light_intensity':
      return value < 50 || value > 3000 ? 'RED' : value < 250 || value > 2400 ? 'YELLOW' : 'GREEN';
    case 'humidity':
      return value < 30 || value > 80 ? 'RED' : value < 40 || value > 70 ? 'YELLOW' : 'GREEN';
  }
}

export function buildSensorRecord(readings: Record<SensorKey, number>, now = new Date()): SensorRecord {
  return Object.fromEntries(
    Object.entries(SENSOR_DEFINITIONS).map(([key, definition]) => {
      const sensorKey = key as SensorKey;
      const value = Number(readings[sensorKey]);
      if (!Number.isFinite(value)) throw new Error(`Expected numeric value for ${sensorKey}`);
      return [sensorKey, {
        value,
        unit: definition.unit,
        level: sensorLevel(sensorKey, value),
        is_online: true,
        updated_at: now,
      }];
    }),
  ) as SensorRecord;
}

export function findAlerts(
  current: { iot_sensors: SensorRecord },
  previous: SensorState | null = null,
) {
  return (Object.keys(SENSOR_DEFINITIONS) as SensorKey[]).flatMap((key) => {
    const level = current.iot_sensors[key].level;
    if (level === 'GREEN' || level === previous?.iot_sensors?.[key]?.level) return [];
    const label = SENSOR_DEFINITIONS[key].label;
    return [{
      title: level === 'RED' ? `CẢNH BÁO: ${label}` : `${label} bất thường`,
      message: `${label} = ${current.iot_sensors[key].value} ${current.iot_sensors[key].unit} (${level})`,
      type: 'warning' as const,
      sensor: key,
    }];
  });
}