import { useState, useEffect, useRef } from 'react';
import {
  Maximize2, ZoomIn, ZoomOut, RotateCcw, Eye, Play, Square,
  Sliders, Navigation, ArrowUpRight, Zap, Info, ShieldCheck, Video
} from 'lucide-react';
import type { Device, FactoryStatus } from '../api';

type FactoryMap2DProps = {
  status: FactoryStatus;
  selectedDevice: string | null;
  onSelectDevice: (deviceId: string) => void;
  onOpenManualControl: (deviceId: string) => void;
  onOpenFPV: (cameraKey: string) => void;
  onToggleDevice: (deviceId: string) => void;
};

export function FactoryMap2D({
  status,
  selectedDevice,
  onSelectDevice,
  onOpenManualControl,
  onOpenFPV,
  onToggleDevice,
}: FactoryMap2DProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeFilter, setActiveFilter] = useState<'all' | 'robots' | 'conveyors' | 'cameras' | 'heatmap'>('all');
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null);
  const [clock, setClock] = useState(0);

  const devices = status.devices_control ?? {};

  // Animation frame loop for continuous smooth motion of AGV and conveyors
  useEffect(() => {
    let animId: number;
    let startTime = performance.now();
    const tick = (now: number) => {
      setClock((now - startTime) / 1000);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Map 3D coordinates [-6..6, -4..4] to SVG [0..1000, 0..650]
  const toSvgX = (x3d: number) => 500 + x3d * 70;
  const toSvgY = (z3d: number) => 325 + z3d * 70;

  // Calculate AGV real-time positions
  const getAgvState = (key: 'avg_robot_1' | 'avg_robot_2') => {
    const dev = devices[key];
    const isOn = Boolean(dev?.is_on);
    const manual = dev?.manual_control as any;

    if (manual && manual.mode === 'manual' && typeof manual.x === 'number' && typeof manual.z === 'number') {
      return {
        x: toSvgX(manual.x),
        y: toSvgY(manual.z),
        heading: (manual.heading ?? 0) * (180 / Math.PI),
        isManual: true,
        isOn,
      };
    }

    // Auto patrol racetrack path
    const isSecond = key === 'avg_robot_2';
    const speed = isOn ? 0.052 : 0;
    const phase = ((clock * speed + (isSecond ? 0.5 : 0)) * Math.PI * 2) % (Math.PI * 2);

    const x3d = Math.cos(phase) * 4.95;
    const z3d = Math.sin(phase) * 2.2;
    const dx = -Math.sin(phase) * 4.95;
    const dz = Math.cos(phase) * 2.2;
    const headingRad = Math.atan2(dx, dz);

    return {
      x: toSvgX(x3d),
      y: toSvgY(z3d),
      heading: headingRad * (180 / Math.PI),
      isManual: false,
      isOn,
    };
  };

  const agv1 = getAgvState('avg_robot_1');
  const agv2 = getAgvState('avg_robot_2');

  const selectedData = selectedDevice ? devices[selectedDevice] : null;

  return (
    <div className="map2d-wrapper card">
      {/* Map Control Toolbar */}
      <div className="map2d-toolbar">
        <div className="map2d-title-group">
          <div className="eyebrow">SƠ ĐỒ NHÀ MÁY THỜI GIAN THỰC</div>
          <h3>Interactive 2D Factory Floor Plan</h3>
        </div>

        {/* Filter Pills */}
        <div className="map2d-filters">
          <button
            type="button"
            className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Tất cả (16)
          </button>
          <button
            type="button"
            className={`filter-btn ${activeFilter === 'robots' ? 'active' : ''}`}
            onClick={() => setActiveFilter('robots')}
          >
            Robots & AGV
          </button>
          <button
            type="button"
            className={`filter-btn ${activeFilter === 'conveyors' ? 'active' : ''}`}
            onClick={() => setActiveFilter('conveyors')}
          >
            Băng tải & Máy
          </button>
          <button
            type="button"
            className={`filter-btn ${activeFilter === 'cameras' ? 'active' : ''}`}
            onClick={() => setActiveFilter('cameras')}
          >
            Camera Cones
          </button>
          <button
            type="button"
            className={`filter-btn ${activeFilter === 'heatmap' ? 'active' : ''}`}
            onClick={() => setActiveFilter('heatmap')}
          >
            Nhiệt độ (Heatmap)
          </button>
        </div>

        {/* Zoom & View Controls */}
        <div className="map2d-zoom-tools">
          <button
            type="button"
            className="tool-btn"
            title="Phóng to"
            onClick={() => setZoom((z) => Math.min(z + 0.2, 2.2))}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            className="tool-btn"
            title="Thu nhỏ"
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.7))}
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            className="tool-btn"
            title="Đặt lại góc nhìn"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Main Floor Plan Area */}
      <div className="map2d-svg-container">
        <svg
          viewBox="0 0 1000 650"
          className="map2d-svg"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="factoryGrid" width="35" height="35" patternUnits="userSpaceOnUse">
              <path d="M 35 0 L 0 0 0 35" fill="none" stroke="#162032" strokeWidth="0.8" />
            </pattern>

            {/* Glowing filter */}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Camera FOV Gradients */}
            <radialGradient id="camFovGrad1" cx="0" cy="0" r="1">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#c084fc" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="camFovGrad2" cx="0" cy="0" r="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>

            {/* Heatmap Layer Gradients */}
            <radialGradient id="heatWarm" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatCool" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>

            {/* LED Light Cone Gradients */}
            <radialGradient id="ledGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#facc15" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Factory Floor */}
          <rect x="0" y="0" width="1000" height="650" fill="#070e1b" />
          <rect x="40" y="30" width="920" height="590" fill="url(#factoryGrid)" rx="16" stroke="#1e293b" strokeWidth="2" />

          {/* Outer Safety Boundary Line */}
          <rect x="55" y="45" width="890" height="560" fill="none" stroke="#253549" strokeWidth="1.5" strokeDasharray="6,6" rx="10" />

          {/* Heatmap Overlay (if active) */}
          {activeFilter === 'heatmap' && (
            <g className="heatmap-layer">
              <circle cx="260" cy="220" r="160" fill="url(#heatWarm)" />
              <circle cx="740" cy="220" r="140" fill="url(#heatWarm)" />
              <circle cx="120" cy="280" r="120" fill="url(#heatCool)" />
              <circle cx="880" cy="280" r="120" fill="url(#heatCool)" />
              <circle cx="500" cy="325" r="220" fill="url(#heatCool)" opacity="0.7" />
            </g>
          )}

          {/* LED Lighting Cones */}
          {['left_led_1', 'left_led_2', 'right_led_1', 'right_led_2'].map((key) => {
            const dev = devices[key];
            if (!dev?.is_on) return null;
            const xCoords: Record<string, [number, number]> = {
              left_led_1: [185, 507],
              left_led_2: [311, 507],
              right_led_1: [689, 507],
              right_led_2: [815, 507],
            };
            const [cx, cy] = xCoords[key] ?? [500, 325];
            return <ellipse key={key} cx={cx} cy={cy} rx="80" ry="55" fill="url(#ledGlow)" />;
          })}

          {/* AGV Yellow Raceway Guidance Track */}
          <g className="agv-track-group">
            <ellipse
              cx="500"
              cy="325"
              rx="346"
              ry="154"
              fill="none"
              stroke="#eab308"
              strokeWidth="3.5"
              strokeDasharray="14,10"
              opacity="0.85"
              filter="url(#neonGlow)"
            />
            {/* Inner guideline */}
            <ellipse
              cx="500"
              cy="325"
              rx="337"
              ry="145"
              fill="none"
              stroke="#ca8a04"
              strokeWidth="1"
              strokeDasharray="4,6"
              opacity="0.4"
            />
            <text x="500" y="330" fill="#94a3b8" fontSize="12" textAnchor="middle" letterSpacing="4" opacity="0.6">
              AGV AUTONOMOUS LOGISTICS RACEWAY
            </text>
          </g>

          {/* Work Zones Markings */}
          <g className="zone-outlines" opacity="0.3">
            <rect x="150" y="110" width="220" height="180" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4,4" rx="8" />
            <text x="160" y="130" fill="#38bdf8" fontSize="10" fontWeight="bold">ZONE A: ROBOT ARM 1</text>

            <rect x="630" y="110" width="220" height="180" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4,4" rx="8" />
            <text x="640" y="130" fill="#38bdf8" fontSize="10" fontWeight="bold">ZONE B: ROBOT ARM 2</text>

            <rect x="330" y="470" width="340" height="110" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4,4" rx="8" />
            <text x="340" y="490" fill="#34d399" fontSize="10" fontWeight="bold">ZONE D: CNC AUTOMATION</text>
          </g>

          {/* Conveyor Belt 1 & 2 */}
          {['conveyor_belt_1', 'conveyor_belt_2'].map((key) => {
            const dev = devices[key];
            const isOn = Boolean(dev?.is_on);
            const isSecond = key === 'conveyor_belt_2';
            const cx = isSecond ? 710 : 290;
            const cy = 367;
            const w = 170;
            const h = 42;

            return (
              <g
                key={key}
                className="conveyor-node"
                transform={`translate(${cx - w / 2}, ${cy - h / 2})`}
                onClick={() => onSelectDevice(key)}
                style={{ cursor: 'pointer' }}
              >
                {/* Belt Frame */}
                <rect width={w} height={h} rx="8" fill="#1e293b" stroke={isOn ? '#38bdf8' : '#475569'} strokeWidth="2" />
                {/* Rollers */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <line
                    key={i}
                    x1={20 + i * 26}
                    y1="6"
                    x2={20 + i * 26}
                    y2="36"
                    stroke="#475569"
                    strokeWidth="3"
                  />
                ))}
                {/* Moving Workpiece Pallets */}
                {isOn && (
                  <rect
                    x={((clock * 45 * (isSecond ? -1 : 1)) % (w - 30) + (w - 30)) % (w - 30) + 5}
                    y="10"
                    width="22"
                    height="22"
                    rx="4"
                    fill={isSecond ? '#38bdf8' : '#f59e0b'}
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                )}
                <text x={w / 2} y={h + 16} fill="#cbd5e1" fontSize="11" textAnchor="middle" fontWeight="bold">
                  {dev?.name ?? (isSecond ? 'Băng tải 2' : 'Băng tải 1')}
                </text>
              </g>
            );
          })}

          {/* Robot Arm 1 & 2 */}
          {['arm_robot_1', 'arm_robot_2'].map((key) => {
            const dev = devices[key];
            const isOn = Boolean(dev?.is_on);
            const isSecond = key === 'arm_robot_2';
            const cx = isSecond ? 745 : 255;
            const cy = 220;
            const manual = dev?.manual_control as any;
            const angle = manual?.baseAngle ?? (isOn ? Math.sin(clock * 1.5 + (isSecond ? Math.PI : 0)) * 45 : 0);

            return (
              <g
                key={key}
                className="robot-arm-node"
                transform={`translate(${cx}, ${cy})`}
                onClick={() => onSelectDevice(key)}
                style={{ cursor: 'pointer' }}
              >
                {/* Safety Ring */}
                <circle r="46" fill="none" stroke={isOn ? '#38bdf8' : '#334155'} strokeWidth="1.5" strokeDasharray="4,4" />
                {/* Base Plate */}
                <circle r="26" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                <circle r="14" fill="#0f172a" stroke={isOn ? '#00ffc2' : '#f87171'} strokeWidth="2.5" />
                {/* Rotating Arm Axis */}
                <g transform={`rotate(${angle})`}>
                  <rect x="-6" y="-38" width="12" height="38" rx="4" fill="#38bdf8" />
                  <circle cx="0" cy="-38" r="7" fill="#f59e0b" />
                  <rect x="-4" y="-62" width="8" height="26" rx="3" fill="#64748b" />
                  {/* End Effector Gripper */}
                  <circle cx="0" cy="-62" r="5" fill={isOn ? '#00ffc2' : '#f87171'} />
                </g>
                <text x="0" y="42" fill="#cbd5e1" fontSize="11" textAnchor="middle" fontWeight="bold">
                  {dev?.name ?? key}
                </text>
                <text x="0" y="55" fill={isOn ? '#34d399' : '#f87171'} fontSize="9" textAnchor="middle">
                  {isOn ? 'ĐANG CHẠY' : 'TẮT'}
                </text>
              </g>
            );
          })}

          {/* Auto Machines */}
          {['auto_machine_1', 'auto_machine_2'].map((key) => {
            const dev = devices[key];
            const isOn = Boolean(dev?.is_on);
            const isSecond = key === 'auto_machine_2';
            const cx = isSecond ? 591 : 409;
            const cy = 542;

            return (
              <g
                key={key}
                className="machine-node"
                transform={`translate(${cx - 35}, ${cy - 25})`}
                onClick={() => onSelectDevice(key)}
                style={{ cursor: 'pointer' }}
              >
                <rect width="70" height="50" rx="8" fill="#1e293b" stroke={isOn ? '#34d399' : '#475569'} strokeWidth="2" />
                <rect x="12" y="10" width="46" height="20" rx="4" fill="#0f172a" />
                <circle cx="20" cy="40" r="4" fill={isOn ? '#00ffc2' : '#64748b'} />
                <circle cx="35" cy="40" r="4" fill={isOn ? '#f59e0b' : '#64748b'} />
                <circle cx="50" cy="40" r="4" fill="#64748b" />
                <text x="35" y="65" fill="#cbd5e1" fontSize="10" textAnchor="middle" fontWeight="bold">
                  {dev?.name ?? key}
                </text>
              </g>
            );
          })}

          {/* Fans */}
          {['corner_fan_1', 'corner_fan_2'].map((key) => {
            const dev = devices[key];
            const isOn = Boolean(dev?.is_on);
            const isSecond = key === 'corner_fan_2';
            const cx = isSecond ? 878 : 122;
            const cy = 283;
            const rot = isOn ? (clock * 360) % 360 : 0;

            return (
              <g
                key={key}
                className="fan-node"
                transform={`translate(${cx}, ${cy})`}
                onClick={() => onSelectDevice(key)}
                style={{ cursor: 'pointer' }}
              >
                <circle r="24" fill="#1e293b" stroke={isOn ? '#2dd4bf' : '#475569'} strokeWidth="2" />
                <g transform={`rotate(${rot})`}>
                  <line x1="-18" y1="0" x2="18" y2="0" stroke={isOn ? '#2dd4bf' : '#64748b'} strokeWidth="4" />
                  <line x1="0" y1="-18" x2="0" y2="18" stroke={isOn ? '#2dd4bf' : '#64748b'} strokeWidth="4" />
                </g>
                <circle r="5" fill="#0f172a" />
                <text x="0" y="38" fill="#cbd5e1" fontSize="10" textAnchor="middle">
                  {dev?.name ?? key}
                </text>
              </g>
            );
          })}

          {/* Camera Cones & Icons */}
          {['security_camera_1', 'security_camera_2'].map((key) => {
            const dev = devices[key];
            const isOn = Boolean(dev?.is_on);
            const isSecond = key === 'security_camera_2';
            const cx = isSecond ? 885 : 115;
            const cy = 73;
            const baseRot = isSecond ? 140 : 40;
            const sweep = isOn ? Math.sin(clock * 0.8) * 25 : 0;
            const camRot = baseRot + sweep;

            return (
              <g
                key={key}
                className="camera-node"
                transform={`translate(${cx}, ${cy})`}
                onClick={() => onOpenFPV(key)}
                style={{ cursor: 'pointer' }}
              >
                {/* FOV Cone */}
                {isOn && (
                  <path
                    d="M 0 0 L 130 -60 A 140 140 0 0 1 130 60 Z"
                    fill={isSecond ? 'url(#camFovGrad2)' : 'url(#camFovGrad1)'}
                    transform={`rotate(${camRot})`}
                    className="camera-fov-cone"
                  />
                )}
                {/* Camera Housing */}
                <circle r="16" fill="#1e293b" stroke={isOn ? '#c084fc' : '#475569'} strokeWidth="2" />
                <g transform={`rotate(${camRot})`}>
                  <rect x="0" y="-5" width="18" height="10" rx="3" fill="#c084fc" />
                  <circle cx="18" cy="0" r="3" fill="#00ffc2" />
                </g>
                <text x="0" y="30" fill="#c084fc" fontSize="10" textAnchor="middle" fontWeight="bold">
                  {dev?.name ?? key} (FPV)
                </text>
              </g>
            );
          })}

          {/* AGV 1 Real-time Moving Robot Node */}
          <g
            className="agv-node"
            transform={`translate(${agv1.x}, ${agv1.y}) rotate(${agv1.heading})`}
            onClick={() => onSelectDevice('avg_robot_1')}
            style={{ cursor: 'pointer' }}
          >
            {/* AGV Radar Ping Wave */}
            {agv1.isOn && (
              <circle r="34" fill="none" stroke="#eab308" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
            )}
            {/* AGV Chassis */}
            <rect x="-24" y="-16" width="48" height="32" rx="6" fill="#1e293b" stroke={agv1.isOn ? '#eab308' : '#ef4444'} strokeWidth="2" />
            {/* 4 Wheels */}
            <rect x="-20" y="-19" width="10" height="4" rx="1" fill="#0f172a" />
            <rect x="10" y="-19" width="10" height="4" rx="1" fill="#0f172a" />
            <rect x="-20" y="15" width="10" height="4" rx="1" fill="#0f172a" />
            <rect x="10" y="15" width="10" height="4" rx="1" fill="#0f172a" />
            {/* Cargo Deck & Headlights */}
            <rect x="-14" y="-10" width="28" height="20" rx="3" fill="#334155" />
            <circle cx="21" cy="-7" r="2.5" fill={agv1.isOn ? '#fef08a' : '#64748b'} />
            <circle cx="21" cy="7" r="2.5" fill={agv1.isOn ? '#fef08a' : '#64748b'} />
            {/* Direction Arrow */}
            <polygon points="12,0 3,-5 3,5" fill="#eab308" />
          </g>
          {/* Label for AGV 1 */}
          <text x={agv1.x} y={agv1.y + 32} fill="#fde047" fontSize="11" textAnchor="middle" fontWeight="bold">
            AGV 1 {agv1.isManual ? '(Manual)' : ''}
          </text>

          {/* AGV 2 Real-time Moving Robot Node */}
          <g
            className="agv-node"
            transform={`translate(${agv2.x}, ${agv2.y}) rotate(${agv2.heading})`}
            onClick={() => onSelectDevice('avg_robot_2')}
            style={{ cursor: 'pointer' }}
          >
            {agv2.isOn && (
              <circle r="34" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
            )}
            <rect x="-24" y="-16" width="48" height="32" rx="6" fill="#1e293b" stroke={agv2.isOn ? '#38bdf8' : '#ef4444'} strokeWidth="2" />
            <rect x="-20" y="-19" width="10" height="4" rx="1" fill="#0f172a" />
            <rect x="10" y="-19" width="10" height="4" rx="1" fill="#0f172a" />
            <rect x="-20" y="15" width="10" height="4" rx="1" fill="#0f172a" />
            <rect x="10" y="15" width="10" height="4" rx="1" fill="#0f172a" />
            <rect x="-14" y="-10" width="28" height="20" rx="3" fill="#334155" />
            <circle cx="21" cy="-7" r="2.5" fill={agv2.isOn ? '#fef08a' : '#64748b'} />
            <circle cx="21" cy="7" r="2.5" fill={agv2.isOn ? '#fef08a' : '#64748b'} />
            <polygon points="12,0 3,-5 3,5" fill="#38bdf8" />
          </g>
          {/* Label for AGV 2 */}
          <text x={agv2.x} y={agv2.y + 32} fill="#7dd3fc" fontSize="11" textAnchor="middle" fontWeight="bold">
            AGV 2 {agv2.isManual ? '(Manual)' : ''}
          </text>

          {/* Environmental Sensors Overlay Badges */}
          <g className="sensor-badges-group" transform="translate(60, 60)">
            <rect width="180" height="70" rx="8" fill="rgba(15, 23, 42, 0.85)" stroke="#334155" />
            <text x="12" y="22" fill="#94a3b8" fontSize="10" fontWeight="bold">MÔI TRƯỜNG NHÀ MÁY</text>
            <text x="12" y="42" fill="#38bdf8" fontSize="13" fontWeight="bold">
              🌡️ {status.iot_sensors?.temperature?.value ?? 28}°C • 💧 {status.iot_sensors?.humidity?.value ?? 55}%
            </text>
            <text x="12" y="58" fill="#e2e8f0" fontSize="10">
              💡 {status.iot_sensors?.light_intensity?.value ?? 1200} lux • 🌪️ {status.iot_sensors?.pressure?.value ?? 1012} hPa
            </text>
          </g>
        </svg>
      </div>

      {/* Selected Device Floating Card / Quick Inspector */}
      {selectedData && selectedDevice && (
        <div className="map2d-inspector-card">
          <div className="inspector-header">
            <div>
              <span className="inspector-eyebrow">{selectedData.category.toUpperCase()}</span>
              <h4>{selectedData.name}</h4>
            </div>
            <span className={`status-pill ${selectedData.is_on ? 'status-online' : 'status-offline'}`}>
              {selectedData.is_on ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="inspector-metrics">
            <div>
              <span>Công suất</span>
              <strong>{selectedData.is_on ? `${selectedData.power} W` : '0 W'}</strong>
            </div>
            <div>
              <span>Sức khỏe</span>
              <strong>{selectedData.health}%</strong>
            </div>
            <div>
              <span>Thời gian chạy</span>
              <strong>{Math.round(selectedData.runtime)}h</strong>
            </div>
          </div>

          <div className="inspector-actions">
            <button
              type="button"
              className={`btn-toggle-quick ${selectedData.is_on ? 'btn-stop' : 'btn-start'}`}
              onClick={() => onToggleDevice(selectedDevice)}
            >
              {selectedData.is_on ? <Square size={14} /> : <Play size={14} />}
              {selectedData.is_on ? 'Dừng thiết bị' : 'Bật thiết bị'}
            </button>

            {/* If AGV or Robot Arm or Camera, offer manual control button */}
            {(selectedDevice.includes('robot') || selectedDevice.includes('avg') || selectedDevice.includes('camera')) && (
              <button
                type="button"
                className="btn-manual-quick"
                onClick={() => onOpenManualControl(selectedDevice)}
              >
                <Sliders size={14} /> Điều khiển thủ công
              </button>
            )}

            {/* If Camera or AGV, offer FPV button */}
            {(selectedDevice.includes('camera') || selectedDevice.includes('avg') || selectedDevice.includes('arm_robot')) && (
              <button
                type="button"
                className="btn-fpv-quick"
                onClick={() => onOpenFPV(selectedDevice)}
              >
                <Video size={14} /> Xem Camera FPV
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
