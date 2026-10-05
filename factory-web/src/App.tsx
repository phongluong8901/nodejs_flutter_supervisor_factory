import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { Activity, ArrowLeftRight, Bell, Camera, ChartNoAxesCombined, ChevronRight, Clock3, Cpu, Fan, Gauge, LayoutDashboard, Lightbulb, List, Radio, RefreshCw, Search, Settings, UserRound, Workflow, Wrench, X, Zap } from 'lucide-react';
import { api, type AlertLog, type Device, type FactoryStatus, type Sensor, type TelemetryPoint, type User } from './api';

type DeviceKey = string;
type SimulationMode = 'balanced' | 'boost' | 'efficiency' | 'emergency';
type AppTab = 'dashboard' | 'devices' | 'analytics' | 'profile';

type DeviceNodeInfo = {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
};

const SENSOR_META: Array<{ key: keyof FactoryStatus['iot_sensors']; label: string; unit: string }> = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C' },
  { key: 'pressure', label: 'Áp suất', unit: 'hPa' },
  { key: 'light_intensity', label: 'Ánh sáng', unit: 'lux' },
  { key: 'humidity', label: 'Độ ẩm', unit: '%' },
];

const SIMULATION_MODES: Record<SimulationMode, { label: string; description: string; accent: string; multiplier: number }> = {
  balanced: { label: 'Balanced', description: 'Mức vận hành ổn định', accent: '#60a5fa', multiplier: 1 },
  boost: { label: 'Boost', description: 'Tăng năng suất', accent: '#f59e0b', multiplier: 1.14 },
  efficiency: { label: 'Efficiency', description: 'Tiết kiệm điện', accent: '#34d399', multiplier: 0.88 },
  emergency: { label: 'Emergency', description: 'Bảo vệ an toàn', accent: '#f87171', multiplier: 0.7 },
};

const DEVICE_LAYOUT: Record<string, DeviceNodeInfo> = {
  arm_robot_1: { position: [-3.5, 0.25, -1.5], scale: [1, 1, 1], color: '#7dd3fc' },
  arm_robot_2: { position: [3.5, 0.25, -1.5], scale: [1, 1, 1], color: '#7dd3fc' },
  avg_robot_1: { position: [0, 0.25, 0], scale: [1, 1, 1], color: '#a5b4fc' },
  avg_robot_2: { position: [0, 0.25, 0], scale: [1, 1, 1], color: '#a5b4fc' },
  conveyor_belt_1: { position: [-3, 0.25, 0.6], scale: [1, 1, 1], color: '#fca5a5' },
  conveyor_belt_2: { position: [3, 0.25, 0.6], scale: [1, 1, 1], color: '#fca5a5' },
  left_led_1: { position: [-4.5, 3.4, 2.6], scale: [1, 1, 1], color: '#facc15' },
  left_led_2: { position: [-2.7, 3.4, 2.6], scale: [1, 1, 1], color: '#facc15' },
  right_led_1: { position: [2.7, 3.4, 2.6], scale: [1, 1, 1], color: '#facc15' },
  right_led_2: { position: [4.5, 3.4, 2.6], scale: [1, 1, 1], color: '#facc15' },
  corner_fan_1: { position: [-5.4, 2.5, -0.6], scale: [1, 1, 1], color: '#2dd4bf' },
  corner_fan_2: { position: [5.4, 2.5, -0.6], scale: [1, 1, 1], color: '#2dd4bf' },
  security_camera_1: { position: [-5.5, 2.5, -3.6], scale: [1, 1, 1], color: '#c084fc' },
  security_camera_2: { position: [5.5, 2.5, -3.6], scale: [1, 1, 1], color: '#c084fc' },
  auto_machine_1: { position: [-1.3, 0.25, 3.1], scale: [1, 1, 1], color: '#34d399' },
  auto_machine_2: { position: [1.3, 0.25, 3.1], scale: [1, 1, 1], color: '#34d399' },
};

const levelColors: Record<'GREEN' | 'YELLOW' | 'RED', string> = {
  GREEN: '#34d399',
  YELLOW: '#fbbf24',
  RED: '#f87171',
};

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function formatRuntime(runtime: number) {
  const totalMinutes = Math.max(0, Math.round(runtime));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function getSensorValue(sensors: Record<string, Sensor> | undefined, key: string) {
  const reading = sensors?.[key];
  return reading?.value ?? 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function DeviceIcon({ device, size = 18 }: { device: Device; size?: number }) {
  const category = device.category.toLowerCase();
  if (category.includes('fan')) return <Fan size={size} />;
  if (category.includes('led') || category.includes('light')) return <Lightbulb size={size} />;
  if (category.includes('camera')) return <Camera size={size} />;
  if (category.includes('conveyor')) return <ArrowLeftRight size={size} />;
  if (category.includes('robot')) return <Workflow size={size} />;
  if (category.includes('machine')) return <Settings size={size} />;
  return <Radio size={size} />;
}

function DeviceNode({
  name,
  device,
  isSelected,
  onClick,
  detailView = false,
}: {
  name: DeviceKey;
  device: Device;
  isSelected: boolean;
  onClick: () => void;
  detailView?: boolean;
}) {
  const node = DEVICE_LAYOUT[name] ?? { position: [0, 0, 0], scale: [1, 1, 1], color: '#94a3b8' };
  const category = device.category.toLowerCase();
  const isOn = device.is_on;
  const accent = isOn ? '#00ffc2' : '#f87171';
  const bodyColor = isOn ? node.color : '#525b68';
  const robotArm = category.includes('robot arm');
  const agv = category.includes('avg');
  const conveyor = category.includes('conveyor');
  const led = category.includes('led');
  const fan = category.includes('fan');
  const camera = category.includes('camera');
  const machine = category.includes('machine');
  const upperArmRef = useRef<Group | null>(null);
  const forearmRef = useRef<Group | null>(null);
  const fanRotorRef = useRef<Group | null>(null);
  const rollerRef = useRef<Group | null>(null);
  const workpieceRef = useRef<Group | null>(null);
  const rootRef = useRef<Group | null>(null);
  const agvWheelRef = useRef<Group | null>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const cycle = t * 0.58 + (name.endsWith('_2') ? Math.PI : 0);
    if (upperArmRef.current) upperArmRef.current.rotation.z = isOn ? -0.52 + Math.sin(cycle) * 0.38 : -0.52;
    if (forearmRef.current) forearmRef.current.rotation.z = isOn ? 0.78 + Math.sin(cycle - 1.15) * 0.48 : 0.78;
    if (fanRotorRef.current) fanRotorRef.current.rotation.z = isOn ? t * 18 : 0;
    if (rollerRef.current) {
      rollerRef.current.children.forEach((roller) => {
        if (roller.children[0]) {
          roller.children[0].rotation.y = isOn ? t * 5.5 * (name.endsWith('_2') ? -1 : 1) : 0;
        }
      });
    }
    if (agvWheelRef.current) {
      agvWheelRef.current.children.forEach((wheel) => {
        if (wheel.children[0]) wheel.children[0].rotation.y = isOn ? t * 7 : 0;
      });
    }
    if (workpieceRef.current) {
      const direction = name.endsWith('_2') ? -1 : 1;
      if (isOn) {
        workpieceRef.current.children.forEach((item, index) => {
          const travel = (t * 0.32 + index * 0.48) % 1;
          item.position.x = direction > 0 ? -1.08 + travel * 2.16 : 1.08 - travel * 2.16;
        });
      }
    }
    if (agv && rootRef.current && isOn && !detailView) {
      const phase = (t * 0.052 + (name.endsWith('_2') ? 0.5 : 0)) * Math.PI * 2;
      const x = Math.cos(phase) * 4.95;
      const z = Math.sin(phase) * 2.2;
      const dx = -Math.sin(phase) * 4.95;
      const dz = Math.cos(phase) * 2.2;
      rootRef.current.position.set(x, node.position[1], z);
      rootRef.current.rotation.y = Math.atan2(dx, dz);
    }
  });

  return (
    <group
      ref={rootRef}
      position={detailView ? [0, led ? 0.95 : fan || camera ? 0.72 : 0.25, 0] : node.position}
      scale={detailView ? led ? [2.2, 2.2, 2.2] : [1.45, 1.45, 1.45] : node.scale}
      rotation={[0, camera && name.endsWith('_2') ? Math.PI : robotArm && name.endsWith('_2') ? Math.PI : 0, 0]}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {robotArm ? (
        <>
          <mesh position={[0, 0.175, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.62, 0.35, 24]} />
            <meshStandardMaterial color="#263344" metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.49, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.3, 0.18, 20]} />
            <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.28} />
          </mesh>
          <group ref={upperArmRef} position={[0, 0.59, 0]}>
            <mesh position={[0.53, 0, 0]} castShadow>
              <boxGeometry args={[1.06, 0.2, 0.24]} />
              <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.3} />
            </mesh>
            <mesh position={[1.06, 0, 0]} castShadow>
              <sphereGeometry args={[0.24, 18, 18]} />
              <meshStandardMaterial color="#d5a12e" metalness={0.7} roughness={0.25} />
            </mesh>
            <group ref={forearmRef} position={[1.06, 0, 0]}>
              <mesh position={[0.43, 0, 0]} castShadow>
                <boxGeometry args={[0.86, 0.16, 0.19]} />
                <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.3} />
              </mesh>
              <mesh position={[0.88, 0, 0]} castShadow>
                <sphereGeometry args={[0.16, 16, 16]} />
                <meshStandardMaterial color="#263344" metalness={0.75} roughness={0.25} />
              </mesh>
              <mesh position={[1.02, -0.11, 0]} castShadow>
                <boxGeometry args={[0.28, 0.06, 0.08]} />
                <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isOn ? 0.7 : 0.12} />
              </mesh>
            </group>
          </group>
          <mesh position={[0, 0.26, 0.32]} castShadow>
            <boxGeometry args={[0.36, 0.12, 0.05]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isOn ? 1.1 : 0.15} />
          </mesh>
        </>
      ) : agv ? (
        <>
          <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.46, 0.82]} />
            <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.32} />
          </mesh>
          <mesh position={[0, 0.68, -0.04]} castShadow>
            <boxGeometry args={[0.72, 0.18, 0.58]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.28} />
          </mesh>
          <group ref={agvWheelRef}>
            {[-1, 1].map((side) => [-1, 1].map((front) => (
              <group key={`wheel-${side}-${front}`} position={[side * 0.48, 0.17, front * 0.31]} rotation={[0, 0, Math.PI / 2]}>
                <group>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.16, 0.16, 0.13, 18]} />
                    <meshStandardMaterial color="#111827" roughness={0.8} />
                  </mesh>
                </group>
              </group>
            )))}
          </group>
          <mesh position={[0.4, 0.43, 0.42]} castShadow>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isOn ? 1 : 0.15} />
          </mesh>
          <mesh position={[0, 0.6, -0.38]}>
            <boxGeometry args={[0.25, 0.08, 0.04]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isOn ? 0.8 : 0.1} />
          </mesh>
        </>
      ) : conveyor ? (
        <>
          <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
            <boxGeometry args={[3.1, 0.16, 0.9]} />
            <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.35} />
          </mesh>
          <group ref={rollerRef}>
            {Array.from({ length: 8 }, (_, index) => (
              <group key={`roller-${index}`} position={[-1.3 + index * 0.37, 0.49, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <group>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.09, 0.09, 0.78, 16]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>
          {[-1, 1].map((side) => <mesh key={`side-rail-${side}`} position={[0, 0.58, side * 0.43]} castShadow>
            <boxGeometry args={[3.1, 0.12, 0.1]} />
            <meshStandardMaterial color="#475569" metalness={0.7} />
          </mesh>)}
          {[-1, 1].map((side) => <mesh key={`support-${side}`} position={[side * 1.25, 0.18, 0]} castShadow>
            <boxGeometry args={[0.14, 0.36, 0.72]} />
            <meshStandardMaterial color="#475569" metalness={0.7} />
          </mesh>)}
          <group ref={workpieceRef}>
            {[0, 1].map((index) => <mesh key={`part-${index}`} position={[index * 1.04, 0.76, 0]} castShadow>
              <boxGeometry args={[0.38, 0.26, 0.38]} />
              <meshStandardMaterial color={index === 0 ? '#f59e0b' : '#38bdf8'} metalness={0.25} roughness={0.42} />
            </mesh>)}
          </group>
        </>
      ) : led ? (
        <>
            <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.05, 0.14, 0.32]} />
            <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[0.86, 0.1, 0.18]} />
            <meshStandardMaterial color={isOn ? '#fff7cc' : '#7f1d1d'} emissive={isOn ? '#fde68a' : '#7f1d1d'} emissiveIntensity={isOn ? 2 : 0.15} />
          </mesh>
        </>
      ) : fan ? (
        <>
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.62, 0.08, 12, 32]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.25} />
          </mesh>
          <group ref={fanRotorRef}>
            {[0, 1, 2].map((index) => (
              <mesh key={`blade-${index}`} rotation={[0, 0, index * Math.PI * 2 / 3]} position={[0, 0, 0.03]}>
                <boxGeometry args={[0.16, 0.52, 0.08]} />
                <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.3} />
              </mesh>
            ))}
            <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.17, 0.17, 0.2, 20]} />
              <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isOn ? 0.7 : 0.1} />
            </mesh>
          </group>
          <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
            <meshStandardMaterial color="#475569" metalness={0.75} />
          </mesh>
        </>
      ) : camera ? (
        <>
          <mesh position={[0, 0, -0.26]}>
            <boxGeometry args={[0.16, 0.16, 0.55]} />
            <meshStandardMaterial color="#64748b" metalness={0.75} />
          </mesh>
          <mesh position={[0.2, -0.1, 0]} rotation={[0, 0, -0.25]} castShadow>
            <boxGeometry args={[0.72, 0.38, 0.42]} />
            <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.32} />
          </mesh>
          <mesh position={[0.54, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.18, 0.12, 24]} />
            <meshStandardMaterial color="#0f172a" metalness={0.5} />
          </mesh>
          <mesh position={[0.61, -0.1, 0]}>
            <sphereGeometry args={[0.09, 18, 18]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isOn ? 1.2 : 0.12} />
          </mesh>
        </>
      ) : machine ? (
        <>
          <mesh position={[0, 0.83, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.55, 1.65, 1.05]} />
            <meshStandardMaterial color="#334155" metalness={0.58} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.86, 0.54]}>
            <boxGeometry args={[0.62, 0.7, 0.05]} />
            <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.02, 0.58]}>
            <boxGeometry args={[0.42, 0.24, 0.035]} />
            <meshStandardMaterial color={isOn ? '#155e75' : '#1e293b'} emissive={isOn ? '#06b6d4' : '#0f172a'} emissiveIntensity={isOn ? 0.8 : 0.05} />
          </mesh>
          {[0, 1, 2].map((index) => (
            <mesh key={`lamp-${index}`} position={[-0.14 + index * 0.14, 0.67, 0.59]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial color={index === 0 ? accent : '#64748b'} emissive={index === 0 ? accent : '#0f172a'} emissiveIntensity={index === 0 && isOn ? 1 : 0.1} />
            </mesh>
          ))}
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[1.4, 0.12, 0.9]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={bodyColor} emissive={accent} emissiveIntensity={isOn ? 0.5 : 0.08} />
        </mesh>
      )}
      {isSelected && <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.78, 40]} />
        <meshBasicMaterial color={accent} transparent opacity={0.9} />
      </mesh>}
      {isSelected && (
        <Html position={[0, led ? 0.42 : 2.1, 0]} center>
          <div className="device-label"><span style={{ color: accent }}>●</span> {device.name}</div>
        </Html>
      )}
    </group>
  );
}

function DeviceSimulation({ name, device }: { name: string; device: Device }) {
  return (
    <Canvas camera={{ position: [4, 3.1, 4.8], fov: 34 }} shadows dpr={[1, 1.5]}>
      <color attach="background" args={['#07111c']} />
      <ambientLight intensity={1.05} />
      <directionalLight position={[4, 8, 5]} intensity={2} castShadow />
      <pointLight position={[-3, 3, 1]} intensity={12} color={device.is_on ? '#00d2ff' : '#ef4444'} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#101b28" metalness={0.35} roughness={0.8} />
      </mesh>
      <gridHelper args={[8, 16, '#1b4050', '#162b39']} position={[0, -0.085, 0]} />
      <DeviceNode name={name} device={device} isSelected={false} onClick={() => undefined} detailView />
      <OrbitControls enablePan={false} minDistance={2.5} maxDistance={7} maxPolarAngle={Math.PI / 2.05} target={[0, 1.05, 0]} />
    </Canvas>
  );
}

function TrendChart({ values, color, label, unit }: { values: number[]; color: string; label: string; unit: string }) {
  const safeValues = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues.map((value, index) => {
    const x = (index / (safeValues.length - 1)) * 1000;
    const y = 210 - ((value - min) / range) * 180 - 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="trend-chart-wrap">
      <div className="trend-chart-meta"><span>{label}</span><strong>{formatNumber(safeValues[safeValues.length - 1] ?? 0)} {unit}</strong></div>
      <svg className="trend-chart" viewBox="0 0 1000 230" preserveAspectRatio="none" role="img" aria-label={`${label} telemetry history`}>
        <defs><linearGradient id={`fill-${label.replace(/\W/g, '')}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[50, 100, 150, 200].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="rgba(148,163,184,.12)" strokeDasharray="5 9" />)}
        <polygon points={`0,230 ${points} 1000,230`} fill={`url(#fill-${label.replace(/\W/g, '')})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="trend-chart-range"><span>Min {formatNumber(min)} {unit}</span><span>Max {formatNumber(max)} {unit}</span></div>
    </div>
  );
}

function FactoryScene({
  devices,
  selectedDevice,
  onSelect,
}: {
  devices: Record<string, Device>;
  selectedDevice: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <Canvas camera={{ position: [8, 8, 10], fov: 42 }} shadows>
      <color attach="background" args={['#020817']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 12, 5]} intensity={1.3} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[-4, 4, 0]} intensity={18} color="#38bdf8" />
      <pointLight position={[5, 4, 0]} intensity={12} color="#a78bfa" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]} receiveShadow>
        <planeGeometry args={[20, 14]} />
        <meshStandardMaterial color="#0b1220" metalness={0.7} roughness={0.4} />
      </mesh>

      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[12.5, 0.2, 8.5]} />
        <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.35} />
      </mesh>

      <mesh position={[0, 0.4, -4.2]}>
        <boxGeometry args={[12.8, 0.8, 0.15]} />
        <meshStandardMaterial color="#1e293b" emissive="#0f172a" emissiveIntensity={0.3} />
      </mesh>

      <mesh position={[0, 0.4, 4.2]}>
        <boxGeometry args={[12.8, 0.8, 0.15]} />
        <meshStandardMaterial color="#1e293b" emissive="#0f172a" emissiveIntensity={0.3} />
      </mesh>

      <mesh position={[-6.2, 0.4, 0]}>
        <boxGeometry args={[0.15, 0.8, 8.2]} />
        <meshStandardMaterial color="#1e293b" emissive="#0f172a" emissiveIntensity={0.3} />
      </mesh>

      <mesh position={[6.2, 0.4, 0]}>
        <boxGeometry args={[0.15, 0.8, 8.2]} />
        <meshStandardMaterial color="#1e293b" emissive="#0f172a" emissiveIntensity={0.3} />
      </mesh>

      <mesh position={[0, 0.258, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[4.95, 2.2, 1]}>
        <ringGeometry args={[0.995, 1.008, 128]} />
        <meshBasicMaterial color="#eab308" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.258, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[4.82, 2.07, 1]}>
        <ringGeometry args={[0.995, 1.008, 128]} />
        <meshBasicMaterial color="#eab308" transparent opacity={0.8} />
      </mesh>

      {Object.entries(devices).map(([name, device]) => (
        <DeviceNode key={name} name={name} device={device} isSelected={selectedDevice === name} onClick={() => onSelect(name)} />
      ))}

      <OrbitControls enablePan={false} minDistance={8} maxDistance={18} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
}

function App() {
  const [status, setStatus] = useState<FactoryStatus | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
  const [profile, setProfile] = useState<User | null>(null);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [deviceMessage, setDeviceMessage] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [editDevice, setEditDevice] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPower, setEditPower] = useState('');
  const [editRuntime, setEditRuntime] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('Factory Admin');
  const [email, setEmail] = useState('demo@factory.local');
  const [password, setPassword] = useState('demo123456');
  const [confirmPassword, setConfirmPassword] = useState('demo123456');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [token, setToken] = useState<string | null>(() => api.token);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('balanced');

  const devices = useMemo(() => status?.devices_control ?? {}, [status]);
  const deviceEntries = useMemo(() => Object.entries(devices), [devices]);

  const liveStatus = useMemo(() => {
    if (!status) return null;
    const multiplier = SIMULATION_MODES[simulationMode].multiplier;
    const safeSensors = {
      temperature: { value: 28, unit: '°C', level: 'GREEN', is_online: true, updated_at: new Date().toISOString() },
      pressure: { value: 1012, unit: 'hPa', level: 'GREEN', is_online: true, updated_at: new Date().toISOString() },
      light_intensity: { value: 1500, unit: 'lux', level: 'GREEN', is_online: true, updated_at: new Date().toISOString() },
      humidity: { value: 58, unit: '%', level: 'GREEN', is_online: true, updated_at: new Date().toISOString() },
      ...status.iot_sensors,
    };
    const safeDevices = { ...(status.devices_control ?? {}) } as Record<string, Device>;

    const iot_sensors = Object.fromEntries(
      Object.entries(safeSensors).map(([key, sensor]) => {
        const base = Number(sensor?.value ?? 0);
        const adjusted = key === 'temperature'
          ? base * (simulationMode === 'boost' ? 1.18 : simulationMode === 'emergency' ? 1.25 : 1)
          : key === 'humidity'
            ? base * (simulationMode === 'efficiency' ? 0.96 : 1)
            : key === 'pressure'
              ? base * (simulationMode === 'efficiency' ? 0.97 : 1)
              : key === 'light_intensity'
                ? base * (simulationMode === 'efficiency' ? 0.9 : 1.08)
                : base;

        const finalValue = clamp(adjusted * multiplier, key === 'light_intensity' ? 300 : 0, key === 'light_intensity' ? 5000 : 5000);
        const nextLevel: 'GREEN' | 'YELLOW' | 'RED' = finalValue >= (key === 'temperature' ? 40 : key === 'humidity' ? 80 : key === 'pressure' ? 1050 : 3000)
          ? 'RED'
          : finalValue >= (key === 'temperature' ? 32 : key === 'humidity' ? 70 : key === 'pressure' ? 1030 : 2400)
            ? 'YELLOW'
            : 'GREEN';

        return [key, { ...(sensor ?? {}), value: finalValue, level: nextLevel } as Sensor];
      }),
    ) as Record<string, Sensor>;

    const devices_control = Object.fromEntries(
      Object.entries(safeDevices).map(([name, device]) => {
        const nextDevice = device ?? {
          name,
          category: 'system',
          icon: 'factory',
          power: 0,
          is_on: false,
          status: 'Standby',
          runtime: 0,
          health: 100,
        };

        const isEmergency = simulationMode === 'emergency';
        const isBoost = simulationMode === 'boost';
        const isSaving = simulationMode === 'efficiency';
        const powerValue = Number(nextDevice.power ?? 0);
        const runtimeValue = Number(nextDevice.runtime ?? 0);
        const healthValue = Number(nextDevice.health ?? 100);
        const nextPower = clamp(powerValue * ((isEmergency ? 0.52 : isBoost ? 1.22 : isSaving ? 0.8 : 1) * multiplier), 0, powerValue * 1.5 || 1000);
        const nextHealth = clamp(healthValue + (isEmergency ? -5 : isBoost ? -2 : isSaving ? 2 : 1), 35, 100);
        const nextIsOn = isEmergency ? false : Boolean(nextDevice.is_on);

        return [name, {
          ...nextDevice,
          is_on: nextIsOn,
          status: nextIsOn ? (isBoost ? 'Running at peak' : isSaving ? 'Energy optimized' : 'Running') : 'Standby',
          power: nextPower,
          health: nextHealth,
          runtime: runtimeValue + (nextIsOn ? 0.14 : 0),
        } as Device];
      }),
    ) as Record<string, Device>;

    return {
      ...status,
      iot_sensors: iot_sensors,
      devices_control,
    } as FactoryStatus;
  }, [status, simulationMode]);

  const refreshStatus = async () => {
    if (!token) return;
    try {
      const next = await api.status();
      setStatus(next);
      if (!selectedDevice && Object.keys(next.devices_control).length > 0) {
        setSelectedDevice(Object.keys(next.devices_control)[0]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const refreshSupportingData = async () => {
    if (!token) return;
    const [nextProfile, nextLogs, nextTelemetry] = await Promise.allSettled([
      api.profile(),
      api.logs(),
      api.telemetry(120),
    ]);
    if (nextProfile.status === 'fulfilled') setProfile(nextProfile.value);
    if (nextLogs.status === 'fulfilled') setLogs(nextLogs.value);
    if (nextTelemetry.status === 'fulfilled') setTelemetryHistory(nextTelemetry.value);
  };

  useEffect(() => {
    if (!token) return;
    void refreshStatus();
    void refreshSupportingData();
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 5000);
    const dataInterval = window.setInterval(() => {
      void refreshSupportingData();
    }, 15000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(dataInterval);
    };
  }, [token]);

  useEffect(() => {
    if (!selectedDevice || !liveStatus?.devices_control[selectedDevice]) return;
    const current = liveStatus.devices_control[selectedDevice];
    setEditName(current.name);
    setEditPower(String(current.power));
    setEditRuntime(String(current.runtime));
    setEditDevice(false);
    setDeviceMessage('');
    setDeviceError('');
  }, [selectedDevice]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');

    try {
      const result = await api.login(email, password);
      setToken(result.token);
      setSelectedDevice(null);
      await refreshStatus();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Đăng nhập thất bại');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');

    if (!name.trim()) {
      setAuthError('Vui lòng nhập tên của bạn');
      setIsAuthenticating(false);
      return;
    }

    if (password.length < 8) {
      setAuthError('Mật khẩu phải có ít nhất 8 ký tự');
      setIsAuthenticating(false);
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Mật khẩu xác nhận không khớp');
      setIsAuthenticating(false);
      return;
    }

    try {
      const result = await api.register(name.trim(), email, password);
      setToken(result.token);
      setSelectedDevice(null);
      setAuthView('login');
      await refreshStatus();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Đăng ký thất bại');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setToken(null);
    setStatus(null);
    setSelectedDevice(null);
    setLogs([]);
    setTelemetryHistory([]);
    setProfile(null);
    setActiveTab('dashboard');
    setAuthError('');
  };

  const handleToggle = async (name: string) => {
    if (!status) return;
    const device = status.devices_control[name];
    if (!device) return;
    try {
      setIsLoading(true);
      await api.control(name, !device.is_on);
      await refreshStatus();
      setDeviceMessage(`${device.name} đã ${device.is_on ? 'tắt' : 'bật'} thành công.`);
      setDeviceError('');
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : 'Không thể thay đổi trạng thái thiết bị.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDevice = async () => {
    if (!selectedDevice) return;
    const power = Number(editPower);
    const runtime = Number(editRuntime);
    if (!editName.trim() || !Number.isFinite(power) || power < 0 || !Number.isFinite(runtime) || runtime < 0) {
      setDeviceError('Vui lòng kiểm tra tên, công suất và giờ chạy.');
      return;
    }
    try {
      setIsLoading(true);
      await api.updateDevice(selectedDevice, { name: editName.trim(), power, runtime });
      await refreshStatus();
      setEditDevice(false);
      setDeviceMessage('Đã lưu cấu hình thiết bị.');
      setDeviceError('');
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : 'Không thể lưu cấu hình thiết bị.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeviceMaintenance = async () => {
    if (!selectedDevice) return;
    try {
      setIsLoading(true);
      await api.resetDevice(selectedDevice);
      await refreshStatus();
      setDeviceMessage('Đã gửi yêu cầu bảo trì / đặt lại bộ đếm thời gian chạy.');
      setDeviceError('');
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : 'Không thể hoàn tất bảo trì.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setIsSavingProfile(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const updated = await api.updateProfile({
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        ...(profile.age == null ? {} : { age: profile.age }),
      });
      setProfile(updated);
      setProfileMessage('Thông tin hồ sơ đã được cập nhật.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const activeDevices = deviceEntries.filter(([, device]) => device.is_on).length;
  const healthyDevices = deviceEntries.filter(([, device]) => device.health >= 80).length;
  const selected = selectedDevice ? liveStatus?.devices_control[selectedDevice] ?? devices[selectedDevice] : null;

  const alertRows = useMemo(() => {
    if (!liveStatus) return [] as Array<{ level: 'GREEN' | 'YELLOW' | 'RED'; title: string; detail: string }>;
    const sensors = liveStatus.iot_sensors ?? {};
    const temperature = Number(sensors.temperature?.value ?? 0);
    const humidity = Number(sensors.humidity?.value ?? 0);
    const alerts = [] as Array<{ level: 'GREEN' | 'YELLOW' | 'RED'; title: string; detail: string }>;

    if (temperature > 32) alerts.push({ level: 'RED', title: 'Nhiệt độ cao', detail: 'Cần kiểm soát môi trường đang nóng' });
    if (humidity > 72) alerts.push({ level: 'YELLOW', title: 'Độ ẩm cao', detail: 'Mức độ ẩm đang vượt ngưỡng' });
    if (simulationMode === 'emergency') alerts.push({ level: 'RED', title: 'Chế độ khẩn cấp', detail: 'Toàn bộ dây chuyền đang được bảo vệ an toàn' });

    for (const [name, device] of Object.entries(liveStatus.devices_control ?? {})) {
      if ((device?.health ?? 100) < 70) {
        alerts.push({ level: 'YELLOW', title: `${device?.name ?? name} cần bảo trì`, detail: `Health ${device?.health ?? 100}%` });
      }
      if ((device?.is_on ?? false) && (device?.power ?? 0) > 700) {
        alerts.push({ level: 'GREEN', title: `${device?.name ?? name} đang chạy tối ưu`, detail: 'Công suất đủ cho vận hành' });
      }
    }

    return alerts.slice(0, 5);
  }, [liveStatus, simulationMode]);

  const productionEfficiency = useMemo(() => {
    if (!liveStatus) return 0;
    const deviceList = Object.values(liveStatus.devices_control ?? {});
    const avgHealth = deviceList.length
      ? deviceList.reduce((sum, device) => sum + (device?.health ?? 100), 0) / deviceList.length
      : 100;
    const temp = Number(liveStatus.iot_sensors?.temperature?.value ?? 0);
    const humidity = Number(liveStatus.iot_sensors?.humidity?.value ?? 0);
    const energy = deviceList.reduce((sum, device) => sum + (device?.power ?? 0), 0);
    const base = avgHealth - (temp > 30 ? 10 : 0) - (humidity > 70 ? 8 : 0) + (energy > 1500 ? 4 : 0);
    return clamp(Math.round(base), 52, 99);
  }, [liveStatus]);

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-header">
            <div className="badge">FactoryOS</div>
            <button className="ghost-button auth-switch" onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')}>
              {authView === 'login' ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </div>

          <div className="auth-tabs">
            <button className={authView === 'login' ? 'active' : ''} onClick={() => setAuthView('login')} type="button">Đăng nhập</button>
            <button className={authView === 'signup' ? 'active' : ''} onClick={() => setAuthView('signup')} type="button">Đăng ký</button>
          </div>

          <h1>{authView === 'login' ? 'Smart Factory Console' : 'Tạo tài khoản mới'}</h1>
          <p>
            {authView === 'login'
              ? 'Quản lý thiết bị và cảm biến trong nhà máy thông minh.'
              : 'Thiết lập tài khoản để giám sát hệ thống nhà máy 3D.'}
          </p>

          {authView === 'login' ? (
            <form onSubmit={handleLogin} className="login-form">
              <label>
                Email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@factory.local" />
              </label>
              <label>
                Mật khẩu
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
              </label>
              {authError && <div className="error-box">{authError}</div>}
              <button type="submit" disabled={isAuthenticating}>
                {isAuthenticating ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="login-form">
              <label>
                Họ tên
                <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nguyễn Văn A" />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@factory.local" />
              </label>
              <label>
                Mật khẩu
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ít nhất 8 ký tự" />
              </label>
              <label>
                Xác nhận mật khẩu
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" />
              </label>
              {authError && <div className="error-box">{authError}</div>}
              <button type="submit" disabled={isAuthenticating}>
                {isAuthenticating ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!liveStatus) {
    return (
      <div className="loading-shell">
        <div className="spinner" />
        <p>Đang tải trạng thái nhà máy...</p>
      </div>
    );
  }

  const filteredDevices = deviceEntries.filter(([key, device]) =>
    `${key} ${device.name} ${device.category}`.toLowerCase().includes(deviceSearch.toLowerCase()),
  );
  const historical = telemetryHistory.length
    ? telemetryHistory
    : [{ timestamp: new Date().toISOString(), sensors: liveStatus.iot_sensors, devices_control: liveStatus.devices_control }];
  const recentLogs = logs.slice(0, 8);
  const unreadLogs = logs.filter((log) => !log.is_read).length;
  const tabTitles: Record<AppTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Tổng quan nhà máy', subtitle: 'GIÁM SÁT HỆ THỐNG TRỰC TIẾP' },
    devices: { title: 'Thiết bị', subtitle: 'DANH SÁCH NODES & CHI TIẾT MÔ PHỎNG' },
    analytics: { title: 'Phân tích vận hành', subtitle: 'LỊCH SỬ TELEMETRY & SỰ KIỆN' },
    profile: { title: 'Hồ sơ vận hành', subtitle: 'TÀI KHOẢN & TRẠNG THÁI KẾT NỐI' },
  };
  const selectedTitle = tabTitles[activeTab];
  const selectedDeviceKey = selected ? selectedDevice ?? '' : '';
  const selectedDeviceRecord = selectedDeviceKey ? liveStatus.devices_control[selectedDeviceKey] : null;

  return (
    <div className="app-shell">
      <header className="topbar app-topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={21} /></div>
          <div><div className="badge">FactoryOS <span className="live-indicator" /></div><h1>Smart factory console</h1></div>
        </div>
        <div className="topbar-actions">
          <div className="mode-switcher">
            {(Object.entries(SIMULATION_MODES) as Array<[SimulationMode, (typeof SIMULATION_MODES)[SimulationMode]]>).map(([key, mode]) => (
              <button key={key} type="button" className={simulationMode === key ? 'active' : ''} onClick={() => setSimulationMode(key)} style={{ borderColor: simulationMode === key ? mode.accent : 'transparent' }}>{mode.label}</button>
            ))}
          </div>
          <button className="profile-chip" onClick={() => setActiveTab('profile')}><span>{(profile?.name || profile?.email || 'OP').slice(0, 2).toUpperCase()}</span><strong>{profile?.name || 'Operator'}</strong></button>
          <button className="ghost-button" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </header>

      <nav className="main-tabs" aria-label="Factory console sections">
        {([
          ['dashboard', LayoutDashboard, 'Tổng quan'],
          ['devices', Cpu, 'Thiết bị'],
          ['analytics', ChartNoAxesCombined, 'Phân tích'],
          ['profile', UserRound, 'Hồ sơ'],
        ] as const).map(([key, Icon, label]) => (
          <button key={key} type="button" className={`main-tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
            <Icon size={17} /><span>{label}</span>{key === 'analytics' && unreadLogs > 0 && <em>{unreadLogs}</em>}
          </button>
        ))}
        <div className="nav-status"><span /> API & database online</div>
      </nav>

      <div className="page-heading">
        <div><div className="eyebrow">FACTORY OPERATIONS / {activeTab.toUpperCase()}</div><h2>{selectedTitle.title}</h2><p>{selectedTitle.subtitle}</p></div>
        <div className="page-heading-meta"><span className="status-pill status-online">{SIMULATION_MODES[simulationMode].label} MODE</span><span><Clock3 size={14} /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
      </div>

      {activeTab === 'dashboard' && <>
        <section className="status-strip card">
          <div><span>Hiệu suất sản xuất</span><strong>{productionEfficiency}%</strong></div>
          <div><span>Thiết bị đang chạy</span><strong>{activeDevices} / {deviceEntries.length}</strong></div>
          <div><span>Cảnh báo chưa đọc</span><strong>{unreadLogs}</strong></div>
          <div><span>Đồng bộ gần nhất</span><strong>{new Date(liveStatus.last_seen ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></div>
        </section>
        <section className="summary-grid dashboard-summary">
          <div className="summary-card accent-blue"><span>Tổng thiết bị</span><strong>{deviceEntries.length}</strong><small>{healthyDevices} thiết bị khỏe mạnh</small></div>
          <div className="summary-card accent-green"><span>Hiệu suất vận hành</span><strong>{productionEfficiency}%</strong><small>Ước tính theo sensor & health</small></div>
          <div className="summary-card accent-amber"><span>Nhiệt độ</span><strong>{formatNumber(getSensorValue(liveStatus.iot_sensors, 'temperature'))}°C</strong><small>Vùng sản xuất</small></div>
          <div className="summary-card accent-rose"><span>Độ ẩm</span><strong>{formatNumber(getSensorValue(liveStatus.iot_sensors, 'humidity'))}%</strong><small>Không khí nhà xưởng</small></div>
        </section>
        <main className="dashboard-grid">
          <section className="scene-panel card">
            <div className="panel-header"><div><div className="eyebrow">DIGITAL TWIN</div><h2>Mặt bằng nhà máy 3D</h2></div><span className="live-tag"><span /> CẬP NHẬT TRỰC TIẾP</span></div>
            <div className="scene-wrapper"><FactoryScene devices={liveStatus.devices_control} selectedDevice={selectedDevice} onSelect={(key) => { setSelectedDevice(key); setActiveTab('devices'); }} /></div>
          </section>
          <aside className="stack-panel">
            <div className="card detail-panel">
              {selected ? <>
                <div className="panel-header"><div><div className="eyebrow">THIẾT BỊ ĐƯỢC CHỌN</div><h2>{selected.name}</h2></div><span className={`status-pill ${selected.is_on ? 'status-online' : 'status-offline'}`}>{selected.is_on ? 'ONLINE' : 'OFFLINE'}</span></div>
                <div className="selected-device-type"><span className="device-category-icon"><DeviceIcon device={selected} size={21} /></span><span><strong>{selected.category}</strong><small>ID: {selectedDevice}</small></span></div>
                <div className="stat-list"><div><span>Công suất</span><strong>{selected.power.toFixed(0)} W</strong></div><div><span>Thời gian chạy</span><strong>{formatRuntime(selected.runtime)}</strong></div><div><span>Sức khỏe</span><strong>{selected.health.toFixed(0)}%</strong></div></div>
                <button className="toggle-button" onClick={() => void handleToggle(selectedDevice!)} disabled={isLoading}>{isLoading ? 'Đang cập nhật...' : selected.is_on ? 'Tắt thiết bị' : 'Bật thiết bị'}</button>
                <button className="text-action" onClick={() => setActiveTab('devices')}>Mở trang chi tiết <ChevronRight size={15} /></button>
              </> : <div className="empty-state">Chọn một thiết bị trên mô hình 3D.</div>}
            </div>
            <div className="card alert-panel"><div className="panel-header compact"><div><div className="eyebrow">EVENT STREAM</div><h2>Cảnh báo & sự kiện</h2></div><span>{logs.length} tổng</span></div>
              <div className="alert-list">{recentLogs.length ? recentLogs.slice(0, 5).map((log) => <div key={log.id} className="alert-item"><span className="alert-dot" style={{ background: log.type === 'warning' ? '#f87171' : '#38bdf8' }} /><div><strong>{log.title}</strong><small>{log.message}</small></div></div>) : alertRows.map((alert, index) => <div key={`${alert.title}-${index}`} className="alert-item"><span className="alert-dot" style={{ background: levelColors[alert.level] }} /><div><strong>{alert.title}</strong><small>{alert.detail}</small></div></div>)}</div>
              <button className="text-action" onClick={() => setActiveTab('analytics')}>Xem lịch sử sự kiện <ChevronRight size={15} /></button>
            </div>
          </aside>
        </main>
        <section className="lower-grid dashboard-lower">
          <div className="card sensor-panel"><div className="panel-header compact"><div><div className="eyebrow">ENVIRONMENT</div><h2>Giám sát môi trường</h2></div><span className="live-tag"><span /> LIVE</span></div><div className="bars">{SENSOR_META.map(({ key, label, unit }) => {
            const sensor = liveStatus.iot_sensors[key];
            if (!sensor) return null;
            const value = getSensorValue(liveStatus.iot_sensors, key);
            const max = key === 'temperature' ? 50 : key === 'pressure' ? 1100 : key === 'light_intensity' ? 5000 : 100;
            const level = (sensor.level ?? 'GREEN') as keyof typeof levelColors;
            return <div key={key} className="bar-row"><div className="bar-meta"><span>{label}</span><strong>{formatNumber(value, key === 'light_intensity' ? 0 : 1)}{unit}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${clamp((value / max) * 100, 2, 100)}%`, background: levelColors[level] }} /></div></div>;
          })}</div></div>
          <div className="card table-panel"><div className="panel-header compact"><div><div className="eyebrow">NODE STATUS</div><h2>Thiết bị gần đây</h2></div><button className="text-action" onClick={() => setActiveTab('devices')}>Tất cả <ChevronRight size={15} /></button></div><div className="device-table">{deviceEntries.slice(0, 5).map(([key, device]) => <button key={key} type="button" className={`device-row ${selectedDevice === key ? 'selected' : ''}`} onClick={() => { setSelectedDevice(key); setActiveTab('devices'); }}><div className="device-row-identity"><span className="device-category-icon" style={{ color: device.is_on ? '#00ffc2' : '#f87171' }}><DeviceIcon device={device} /></span><span><strong>{device.name}</strong><small>{device.category}</small></span></div><span className={`mini-pill ${device.is_on ? 'mini-online' : 'mini-offline'}`}>{device.is_on ? 'RUN' : 'OFF'}</span></button>)}</div></div>
        </section>
      </>}

      {activeTab === 'devices' && <section className="devices-workspace">
        <div className="card devices-list-panel">
          <div className="panel-header"><div><div className="eyebrow">ACTUATORS / {deviceEntries.length} NODES</div><h2>Danh sách thiết bị</h2></div><button className="icon-button" title="Tải lại dữ liệu" onClick={() => { void refreshStatus(); void refreshSupportingData(); }}><RefreshCw size={17} /></button></div>
          <label className="search-field"><Search size={17} /><input value={deviceSearch} onChange={(event) => setDeviceSearch(event.target.value)} placeholder="Tìm theo tên hoặc loại thiết bị" /></label>
          <div className="devices-full-list">{filteredDevices.map(([key, device]) => <button key={key} type="button" className={`device-full-row ${selectedDevice === key ? 'selected' : ''}`} onClick={() => setSelectedDevice(key)}><span className="device-category-icon" style={{ color: device.is_on ? '#00ffc2' : '#f87171' }}><DeviceIcon device={device} size={20} /></span><span className="device-full-copy"><strong>{device.name}</strong><small>{device.category} · {key}</small></span><span className={`device-state ${device.is_on ? 'on' : 'off'}`}><i />{device.is_on ? 'ĐANG CHẠY' : 'ĐANG TẮT'}</span><ChevronRight size={16} className="row-chevron" /></button>)}</div>
        </div>
        {selected && selectedDeviceRecord ? <div className="device-detail-column">
          <div className="card detail-hero-card">
            <div className="detail-device-heading"><div><div className="eyebrow">DEVICE SIMULATION / {selectedDevice}</div><h2>{selected.name}</h2><p>{selected.category} <span>•</span> Backend node state synchronized</p></div><span className={`status-pill ${selected.is_on ? 'status-online' : 'status-offline'}`}>{selected.is_on ? 'ONLINE' : 'OFFLINE'}</span></div>
            <div className="device-simulation-frame"><div className="simulation-overlay-top"><span><Activity size={14} /> LIVE SIMULATION</span><span>3D · ORBIT / ZOOM</span></div><DeviceSimulation name={selectedDeviceKey} device={selected} /><div className={`simulation-state ${selected.is_on ? 'running' : 'stopped'}`}><span />{selected.is_on ? 'MÔ PHỎNG ĐANG CHẠY' : 'THIẾT BỊ ĐANG DỪNG'}</div></div>
            <div className="detail-metrics-grid"><div><Zap size={16} /><span>Tiêu thụ / định mức</span><strong>{selected.power.toFixed(0)} / {Number(selected.rated_power ?? selected.power).toFixed(0)} W</strong></div><div><Clock3 size={16} /><span>Runtime</span><strong>{formatRuntime(selected.runtime)}</strong></div><div><Gauge size={16} /><span>Sức khỏe</span><strong>{selected.health.toFixed(0)}%</strong></div><div><Activity size={16} /><span>Trạng thái</span><strong>{selected.status}</strong></div></div>
            <div className="device-action-row"><button className={`toggle-button ${selected.is_on ? 'danger-button' : ''}`} onClick={() => void handleToggle(selectedDeviceKey)} disabled={isLoading}>{isLoading ? 'Đang gửi lệnh...' : selected.is_on ? 'Tắt thiết bị' : 'Bật thiết bị'}</button><button className="secondary-action" onClick={() => { setEditDevice((value) => !value); setDeviceError(''); }}><Settings size={16} />{editDevice ? 'Đóng chỉnh sửa' : 'Chỉnh cấu hình'}</button><button className="secondary-action" onClick={() => void handleDeviceMaintenance()} disabled={isLoading}><Wrench size={16} />Bảo trì / reset</button></div>
            {deviceError && <div className="inline-message error-box">{deviceError}</div>}{deviceMessage && <div className="inline-message success-box">{deviceMessage}</div>}
            {editDevice && <form className="device-edit-form" onSubmit={(event) => { event.preventDefault(); void handleSaveDevice(); }}><div className="eyebrow">CẤU HÌNH THIẾT BỊ</div><label>Tên thiết bị<input value={editName} onChange={(event) => setEditName(event.target.value)} /></label><div className="edit-fields"><label>Công suất danh định (W)<input type="number" min="0" step="1" value={editPower} onChange={(event) => setEditPower(event.target.value)} /></label><label>Runtime (giờ)<input type="number" min="0" step="0.1" value={editRuntime} onChange={(event) => setEditRuntime(event.target.value)} /></label></div><button className="toggle-button" type="submit" disabled={isLoading}>{isLoading ? 'Đang lưu...' : 'Lưu cấu hình'}</button></form>}
          </div>
          <div className="card detail-telemetry-card"><div className="panel-header compact"><div><div className="eyebrow">ASSOCIATED TELEMETRY</div><h3>Dữ liệu cảm biến hiện tại</h3></div></div><div className="device-sensor-grid">{SENSOR_META.map(({ key, label, unit }) => { const reading = liveStatus.iot_sensors[key]; return reading ? <div key={key}><span>{label}</span><strong>{formatNumber(reading.value)} {unit}</strong><small className={`sensor-level ${reading.level.toLowerCase()}`}>{reading.level}</small></div> : null; })}</div></div>
        </div> : <div className="card detail-empty"><Cpu size={38} /><h3>Chọn một thiết bị</h3><p>Chọn một node trong danh sách để xem simulation 3D và thông số vận hành.</p></div>}
      </section>}

      {activeTab === 'analytics' && <>
        <section className="analytics-kpis"><div className="card analytics-kpi"><span><Activity size={17} /> Bản ghi telemetry</span><strong>{telemetryHistory.length}</strong><small>Điểm dữ liệu lưu trong database</small></div><div className="card analytics-kpi"><span><Bell size={17} /> Sự kiện cảnh báo</span><strong>{logs.filter((log) => log.type === 'warning').length}</strong><small>{unreadLogs} sự kiện chưa đọc</small></div><div className="card analytics-kpi"><span><Gauge size={17} /> Hiệu suất ước tính</span><strong>{productionEfficiency}%</strong><small>Health, sensor, mức tải</small></div><div className="card analytics-kpi"><span><Zap size={17} /> Tải điện hiện tại</span><strong>{deviceEntries.reduce((sum, [, device]) => sum + device.power, 0).toLocaleString()} W</strong><small>Tổng công suất thiết bị</small></div></section>
        <section className="analytics-grid">{SENSOR_META.map(({ key, label, unit }, index) => {
          const values = historical.map((point) => Number(point.sensors?.[key]?.value)).filter(Number.isFinite);
          const colors = ['#00d2ff', '#fb7185', '#facc15', '#34d399'];
          return <div className="card analytics-chart-card" key={key}><TrendChart values={values} label={label} unit={unit} color={colors[index % colors.length]} /><div className="chart-footnote">{telemetryHistory.length ? `${telemetryHistory.length} bản ghi · Từ lịch sử backend` : 'Chưa có lịch sử lưu · Đang hiển thị mẫu hiện tại'}</div></div>;
        })}</section>
        <section className="card event-history-card"><div className="panel-header"><div><div className="eyebrow">EVENT TIMELINE</div><h2>Nhật ký cảnh báo & sự kiện</h2></div><span>{logs.length} events</span></div>{logs.length ? <div className="event-timeline">{logs.map((log) => <article key={log.id} className="event-entry"><span className={`event-marker ${log.type}`}><Bell size={14} /></span><div className="event-copy"><strong>{log.title}</strong><p>{log.message}</p><small>{log.sensor ? `${log.sensor} · ` : ''}{new Date(log.createdAt).toLocaleString()}</small></div><span className={`event-type ${log.type}`}>{log.type === 'warning' ? 'WARNING' : 'INFO'}</span></article>)}</div> : <div className="empty-state"><Bell size={26} /><span>Chưa có sự kiện trong nhật ký backend.</span></div>}</section>
      </>}

      {activeTab === 'profile' && <section className="profile-layout">
        <div className="card profile-identity-card"><div className="profile-avatar-large">{(profile?.name || profile?.email || 'OP').slice(0, 2).toUpperCase()}</div><div className="eyebrow">FACTORY OPERATOR</div><h2>{profile?.name || 'Operator'}</h2><p>{profile?.email || '—'}</p><span className="status-pill status-online">SESSION ACTIVE</span><div className="profile-identity-stats"><div><span>Thiết bị</span><strong>{deviceEntries.length}</strong></div><div><span>Đang chạy</span><strong>{activeDevices}</strong></div></div></div>
        <div className="card profile-form-card"><div className="panel-header"><div><div className="eyebrow">ACCOUNT SETTINGS</div><h2>Thông tin tài khoản</h2></div><UserRound size={19} /></div>{profile ? <form className="profile-form" onSubmit={(event) => void handleSaveProfile(event)}><label>Họ tên<input value={profile.name ?? ''} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label>Email<input value={profile.email} readOnly /></label><div className="edit-fields"><label>Số điện thoại<input value={profile.phone ?? ''} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="Chưa cập nhật" /></label><label>Tuổi<input type="number" min="0" max="130" value={profile.age ?? ''} onChange={(event) => setProfile({ ...profile, age: event.target.value === '' ? null : Number(event.target.value) })} placeholder="—" /></label></div><label>Địa chỉ<input value={profile.address ?? ''} onChange={(event) => setProfile({ ...profile, address: event.target.value })} placeholder="Chưa cập nhật" /></label>{profileError && <div className="error-box">{profileError}</div>}{profileMessage && <div className="success-box">{profileMessage}</div>}<button className="toggle-button" type="submit" disabled={isSavingProfile}>{isSavingProfile ? 'Đang lưu...' : 'Lưu thông tin'}</button></form> : <div className="empty-state">Đang tải dữ liệu hồ sơ...</div>}</div>
        <div className="card profile-system-card"><div className="eyebrow">SYSTEM CONNECTION</div><h3>Trạng thái hệ thống</h3><div className="system-status-row"><span>Backend API</span><strong><i /> Connected</strong></div><div className="system-status-row"><span>Database telemetry</span><strong><i /> {telemetryHistory.length ? 'Receiving data' : 'No history yet'}</strong></div><div className="system-status-row"><span>Simulation mode</span><strong>{SIMULATION_MODES[simulationMode].label}</strong></div><div className="system-status-row"><span>Phiên đăng nhập</span><strong>{profile?.email}</strong></div></div>
      </section>}
    </div>
  );
}

export default App;
