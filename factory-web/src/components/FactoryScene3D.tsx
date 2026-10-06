import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useRef } from 'react';
import type { Group } from 'three';
import * as THREE from 'three';
import type { Device, AgvControl, RobotArmControl, CameraControl } from '../api';

export type DeviceNodeInfo = {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
};

export const DEVICE_LAYOUT: Record<string, { position: [number, number, number]; scale: [number, number, number]; color: string }> = {
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

// Global shared object to keep real-time dynamic transforms for FPV camera tracking
export const LIVE_DYNAMIC_TRANSFORMS: Record<string, { pos: THREE.Vector3; heading: number }> = {
  avg_robot_1: { pos: new THREE.Vector3(0, 0.25, 0), heading: 0 },
  avg_robot_2: { pos: new THREE.Vector3(0, 0.25, 0), heading: 0 },
  arm_robot_1: { pos: new THREE.Vector3(-3.5, 1.2, -1.5), heading: 0 },
  arm_robot_2: { pos: new THREE.Vector3(3.5, 1.2, -1.5), heading: 0 },
  security_camera_1: { pos: new THREE.Vector3(-5.5, 2.6, -3.6), heading: 0 },
  security_camera_2: { pos: new THREE.Vector3(5.5, 2.6, -3.6), heading: 0 },
};

export function DeviceNode({
  name,
  device,
  isSelected,
  onClick,
  detailView = false,
}: {
  name: string;
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

  const rootRef = useRef<Group | null>(null);
  const baseRotRef = useRef<Group | null>(null);
  const upperArmRef = useRef<Group | null>(null);
  const forearmRef = useRef<Group | null>(null);
  const fanRotorRef = useRef<Group | null>(null);
  const rollerRef = useRef<Group | null>(null);
  const workpieceRef = useRef<Group | null>(null);
  const agvWheelRef = useRef<Group | null>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const cycle = t * 0.58 + (name.endsWith('_2') ? Math.PI : 0);

    // AGV motion
    if (agv && rootRef.current && !detailView) {
      const manual = device.manual_control as AgvControl | undefined;
      if (manual && manual.mode === 'manual' && typeof manual.x === 'number' && typeof manual.z === 'number') {
        rootRef.current.position.set(manual.x, node.position[1], manual.z);
        rootRef.current.rotation.y = manual.heading ?? 0;
        LIVE_DYNAMIC_TRANSFORMS[name] = {
          pos: rootRef.current.position.clone(),
          heading: manual.heading ?? 0,
        };
      } else if (isOn) {
        const phase = (t * 0.052 + (name.endsWith('_2') ? 0.5 : 0)) * Math.PI * 2;
        const x = Math.cos(phase) * 4.95;
        const z = Math.sin(phase) * 2.2;
        const dx = -Math.sin(phase) * 4.95;
        const dz = Math.cos(phase) * 2.2;
        const heading = Math.atan2(dx, dz);
        rootRef.current.position.set(x, node.position[1], z);
        rootRef.current.rotation.y = heading;
        LIVE_DYNAMIC_TRANSFORMS[name] = {
          pos: rootRef.current.position.clone(),
          heading,
        };
      }
    }

    // Robot Arm articulation
    if (robotArm) {
      const manual = device.manual_control as RobotArmControl | undefined;
      if (manual && manual.mode === 'manual') {
        if (baseRotRef.current) baseRotRef.current.rotation.y = ((manual.baseAngle ?? 0) * Math.PI) / 180;
        if (upperArmRef.current) upperArmRef.current.rotation.z = ((manual.shoulderAngle ?? -30) * Math.PI) / 180;
        if (forearmRef.current) forearmRef.current.rotation.z = ((manual.elbowAngle ?? 45) * Math.PI) / 180;
      } else {
        if (baseRotRef.current) baseRotRef.current.rotation.y = isOn ? Math.sin(cycle * 0.8) * 0.4 : 0;
        if (upperArmRef.current) upperArmRef.current.rotation.z = isOn ? -0.52 + Math.sin(cycle) * 0.38 : -0.52;
        if (forearmRef.current) forearmRef.current.rotation.z = isOn ? 0.78 + Math.sin(cycle - 1.15) * 0.48 : 0.78;
      }
      if (rootRef.current) {
        LIVE_DYNAMIC_TRANSFORMS[name] = {
          pos: rootRef.current.position.clone().add(new THREE.Vector3(0, 1.1, 0)),
          heading: baseRotRef.current ? baseRotRef.current.rotation.y : 0,
        };
      }
    }

    // Camera Pan/Tilt rotation
    if (camera && rootRef.current) {
      const manual = device.manual_control as CameraControl | undefined;
      const basePan = name.endsWith('_2') ? Math.PI : 0;
      if (manual && typeof manual.pan === 'number') {
        rootRef.current.rotation.y = basePan + (manual.pan * Math.PI) / 180;
      } else if (isOn) {
        rootRef.current.rotation.y = basePan + Math.sin(t * 0.6) * 0.35;
      }
      LIVE_DYNAMIC_TRANSFORMS[name] = {
        pos: rootRef.current.position.clone(),
        heading: rootRef.current.rotation.y,
      };
    }

    // Fan rotation
    if (fanRotorRef.current) fanRotorRef.current.rotation.z = isOn ? t * 18 : 0;

    // Conveyor Rollers & Workpieces
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

    if (workpieceRef.current && isOn) {
      const direction = name.endsWith('_2') ? -1 : 1;
      workpieceRef.current.children.forEach((item, index) => {
        const travel = (t * 0.32 + index * 0.48) % 1;
        item.position.x = direction > 0 ? -1.08 + travel * 2.16 : 1.08 - travel * 2.16;
      });
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
        <group ref={baseRotRef}>
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
              {/* Onboard Camera on Gripper */}
              <mesh position={[1.02, 0.1, 0]}>
                <boxGeometry args={[0.12, 0.1, 0.12]} />
                <meshStandardMaterial color="#c084fc" />
              </mesh>
              <mesh position={[1.02, -0.11, 0]} castShadow>
                <boxGeometry args={[0.28, 0.06, 0.08]} />
                <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isOn ? 0.7 : 0.12} />
              </mesh>
            </group>
          </group>
        </group>
      ) : agv ? (
        <>
          <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.46, 0.82]} />
            <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.32} />
          </mesh>
          {/* Onboard Camera mount on AGV top */}
          <mesh position={[0.3, 0.75, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.18, 16]} />
            <meshStandardMaterial color="#c084fc" metalness={0.8} />
          </mesh>
          <mesh position={[0.35, 0.82, 0]}>
            <sphereGeometry args={[0.08, 14, 14]} />
            <meshStandardMaterial color={isOn ? '#00ffc2' : '#f87171'} emissive={isOn ? '#00ffc2' : '#f87171'} emissiveIntensity={0.8} />
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
          <group ref={workpieceRef}>
            {[0, 1].map((index) => (
              <mesh key={`part-${index}`} position={[index * 1.04, 0.76, 0]} castShadow>
                <boxGeometry args={[0.38, 0.26, 0.38]} />
                <meshStandardMaterial color={index === 0 ? '#f59e0b' : '#38bdf8'} metalness={0.25} roughness={0.42} />
              </mesh>
            ))}
          </group>
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
          <mesh position={[0, 1.02, 0.58]}>
            <boxGeometry args={[0.42, 0.24, 0.035]} />
            <meshStandardMaterial color={isOn ? '#155e75' : '#1e293b'} emissive={isOn ? '#06b6d4' : '#0f172a'} emissiveIntensity={isOn ? 0.8 : 0.05} />
          </mesh>
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
      ) : (
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={bodyColor} emissive={accent} emissiveIntensity={isOn ? 0.5 : 0.08} />
        </mesh>
      )}

      {isSelected && (
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.78, 40]} />
          <meshBasicMaterial color={accent} transparent opacity={0.9} />
        </mesh>
      )}

      {isSelected && (
        <Html position={[0, led ? 0.42 : 2.1, 0]} center>
          <div className="device-label"><span style={{ color: accent }}>●</span> {device.name}</div>
        </Html>
      )}
    </group>
  );
}

// First-person view (FPV) camera controller component
function FpvCameraController({
  fpvCameraId,
  isFpvActive,
}: {
  fpvCameraId: string | null;
  isFpvActive: boolean;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (!isFpvActive || !fpvCameraId) return;

    const dynamic = LIVE_DYNAMIC_TRANSFORMS[fpvCameraId];

    if (fpvCameraId.includes('avg')) {
      // Camera is mounted on top of AGV, travels with the AGV!
      if (dynamic) {
        camera.position.set(dynamic.pos.x, 0.85, dynamic.pos.z);
        const lookTarget = new THREE.Vector3(
          dynamic.pos.x + Math.sin(dynamic.heading) * 6,
          0.65,
          dynamic.pos.z + Math.cos(dynamic.heading) * 6,
        );
        camera.lookAt(lookTarget);
      }
    } else if (fpvCameraId.includes('arm_robot')) {
      // Camera mounted on robot arm wrist
      if (dynamic) {
        camera.position.set(dynamic.pos.x + 0.3, dynamic.pos.y + 0.2, dynamic.pos.z + 0.3);
        const lookTarget = new THREE.Vector3(0, 0.4, 0);
        camera.lookAt(lookTarget);
      }
    } else if (fpvCameraId === 'security_camera_1') {
      // Fixed Corner 1 Camera
      camera.position.set(-5.3, 2.7, -3.4);
      camera.lookAt(new THREE.Vector3(0, 0.5, 0));
    } else if (fpvCameraId === 'security_camera_2') {
      // Fixed Corner 2 Camera
      camera.position.set(5.3, 2.7, -3.4);
      camera.lookAt(new THREE.Vector3(0, 0.5, 0));
    }
  });

  return null;
}

export function FactoryScene({
  devices,
  selectedDevice,
  onSelect,
  fpvCameraId = null,
  isFpvActive = false,
}: {
  devices: Record<string, Device>;
  selectedDevice: string | null;
  onSelect: (name: string) => void;
  fpvCameraId?: string | null;
  isFpvActive?: boolean;
}) {
  return (
    <Canvas camera={{ position: [8, 8, 10], fov: 42 }} shadows>
      <color attach="background" args={['#020817']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 12, 5]} intensity={1.3} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[-4, 4, 0]} intensity={18} color="#38bdf8" />
      <pointLight position={[5, 4, 0]} intensity={12} color="#a78bfa" />

      {/* Ground Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]} receiveShadow>
        <planeGeometry args={[20, 14]} />
        <meshStandardMaterial color="#0b1220" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Raised Factory Floor Slab */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[12.5, 0.2, 8.5]} />
        <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.35} />
      </mesh>

      {/* Surrounding Walls */}
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

      {/* AGV Yellow Track Lines */}
      <mesh position={[0, 0.258, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[4.95, 2.2, 1]}>
        <ringGeometry args={[0.995, 1.008, 128]} />
        <meshBasicMaterial color="#eab308" transparent opacity={0.8} />
      </mesh>

      {/* All Device Nodes */}
      {Object.entries(devices).map(([name, device]) => (
        <DeviceNode
          key={name}
          name={name}
          device={device}
          isSelected={selectedDevice === name}
          onClick={() => onSelect(name)}
        />
      ))}

      {/* FPV Camera Manager */}
      <FpvCameraController fpvCameraId={fpvCameraId} isFpvActive={isFpvActive} />

      {/* OrbitControls are active only when not in FPV */}
      {!isFpvActive && (
        <OrbitControls enablePan={false} minDistance={5} maxDistance={18} maxPolarAngle={Math.PI / 2.1} />
      )}
    </Canvas>
  );
}
