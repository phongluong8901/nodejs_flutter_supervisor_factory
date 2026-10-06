import { useState, useEffect } from 'react';
import {
  Video, Eye, Maximize2, Minimize2, Crosshair, Sun, Moon,
  Flame, Monitor, Camera, ArrowLeft, RotateCw, ZoomIn, ZoomOut,
  Sliders
} from 'lucide-react';
import type { Device, FactoryStatus } from '../api';

export type CameraViewOption = {
  id: string;
  name: string;
  category: 'fixed' | 'mobile_agv' | 'robot_arm';
  locationDesc: string;
  icon: string;
};

export const AVAILABLE_CAMERAS: CameraViewOption[] = [
  { id: 'security_camera_1', name: 'Camera Góc 1 (Tây Bắc)', category: 'fixed', locationDesc: 'Trụ cao góc Tây Bắc • Nhìn bao quát Dây chuyền 1', icon: 'camera' },
  { id: 'security_camera_2', name: 'Camera Góc 2 (Đông Bắc)', category: 'fixed', locationDesc: 'Trụ cao góc Đông Bắc • Nhìn bao quát Dây chuyền 2', icon: 'camera' },
  { id: 'avg_robot_1', name: 'Camera AGV 1 (Dashcam)', category: 'mobile_agv', locationDesc: 'Gắn trên nóc xe AGV 1 • Di chuyển theo thời gian thực', icon: 'rover' },
  { id: 'avg_robot_2', name: 'Camera AGV 2 (Dashcam)', category: 'mobile_agv', locationDesc: 'Gắn trên nóc xe AGV 2 • Di chuyển theo thời gian thực', icon: 'rover' },
  { id: 'arm_robot_1', name: 'Camera Arm Robot 1 (Wrist)', category: 'robot_arm', locationDesc: 'Gắn trên cổ tay kẹp Robot 1 • Góc nhìn theo khớp', icon: 'arm' },
  { id: 'arm_robot_2', name: 'Camera Arm Robot 2 (Wrist)', category: 'robot_arm', locationDesc: 'Gắn trên cổ tay kẹp Robot 2 • Góc nhìn theo khớp', icon: 'arm' },
];

export type CctvFilter = 'normal' | 'night' | 'thermal' | 'bw';

type FpvCameraOverlayProps = {
  activeCameraId: string;
  status: FactoryStatus;
  isFullscreen: boolean;
  onSelectCamera: (cameraId: string) => void;
  onExitFpv: () => void;
  onToggleFullscreen: () => void;
  onOpenManualControl: (deviceId: string) => void;
};

export function FpvCameraOverlay({
  activeCameraId,
  status,
  isFullscreen,
  onSelectCamera,
  onExitFpv,
  onToggleFullscreen,
  onOpenManualControl,
}: FpvCameraOverlayProps) {
  const [filter, setFilter] = useState<CctvFilter>('normal');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeCam = AVAILABLE_CAMERAS.find((c) => c.id === activeCameraId) ?? AVAILABLE_CAMERAS[0];
  const deviceData = status.devices_control?.[activeCameraId] as Device | undefined;

  const filterClass = `cctv-filter-${filter}`;

  return (
    <div className={`fpv-cctv-container ${filterClass} ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* CCTV HUD Top Bar */}
      <div className="cctv-hud-top">
        <div className="cctv-hud-left">
          <div className="rec-indicator">
            <span className="rec-dot" /> REC [LIVE]
          </div>
          <div className="cam-meta">
            <span className="cam-code">{activeCam.id.toUpperCase()}</span>
            <span className="cam-title">{activeCam.name}</span>
          </div>
        </div>

        <div className="cctv-hud-center">
          <div className="cctv-timestamp">
            {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()} UTC+7
          </div>
          <div className="cctv-resolution">1920x1080 @ 60FPS • H.265 INDUSTRIAL STREAM</div>
        </div>

        <div className="cctv-hud-right">
          <button
            type="button"
            className="hud-btn"
            onClick={() => onOpenManualControl(activeCameraId)}
            title="Mở bộ điều khiển thủ công cho thiết bị này"
          >
            <Sliders size={16} /> Điều khiển
          </button>
          <button
            type="button"
            className="hud-btn"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            type="button"
            className="hud-btn btn-exit"
            onClick={onExitFpv}
            title="Thoát FPV về góc nhìn 3D toàn cảnh"
          >
            <ArrowLeft size={16} /> Thoát FPV
          </button>
        </div>
      </div>

      {/* Crosshair & Framing Overlay */}
      <div className="cctv-crosshair-wrap">
        <div className="cctv-bracket bracket-tl" />
        <div className="cctv-bracket bracket-tr" />
        <div className="cctv-bracket bracket-bl" />
        <div className="cctv-bracket bracket-br" />
        <div className="cctv-center-crosshair">
          <Crosshair size={36} opacity={0.65} />
        </div>
      </div>

      {/* CCTV HUD Bottom Bar */}
      <div className="cctv-hud-bottom">
        <div className="hud-telemetry-left">
          <span className="telemetry-tag">VỊ TRÍ: {activeCam.locationDesc}</span>
          <span className="telemetry-tag">TRẠNG THÁI: {deviceData?.is_on ? 'ONLINE • ĐANG HOẠT ĐỘNG' : 'OFFLINE'}</span>
          <span className="telemetry-tag">NHIỆT ĐỘ: {status.iot_sensors?.temperature?.value ?? 28}°C</span>
        </div>

        {/* Video Filter Switcher */}
        <div className="cctv-filter-switch">
          <button
            type="button"
            className={`filter-tag ${filter === 'normal' ? 'active' : ''}`}
            onClick={() => setFilter('normal')}
          >
            <Sun size={13} /> Thường
          </button>
          <button
            type="button"
            className={`filter-tag ${filter === 'night' ? 'active' : ''}`}
            onClick={() => setFilter('night')}
          >
            <Moon size={13} /> Hồng ngoại (IR)
          </button>
          <button
            type="button"
            className={`filter-tag ${filter === 'thermal' ? 'active' : ''}`}
            onClick={() => setFilter('thermal')}
          >
            <Flame size={13} /> Ảnh nhiệt
          </button>
          <button
            type="button"
            className={`filter-tag ${filter === 'bw' ? 'active' : ''}`}
            onClick={() => setFilter('bw')}
          >
            <Monitor size={13} /> Trắng đen
          </button>
        </div>
      </div>

      {/* Camera Selection Switcher Bar at the bottom */}
      <div className="cctv-cam-selector-dock">
        {AVAILABLE_CAMERAS.map((cam) => (
          <button
            key={cam.id}
            type="button"
            className={`cam-dock-btn ${cam.id === activeCameraId ? 'active' : ''}`}
            onClick={() => onSelectCamera(cam.id)}
          >
            <Camera size={14} />
            <span>{cam.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
