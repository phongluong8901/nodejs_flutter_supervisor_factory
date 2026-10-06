import { useState, useEffect } from 'react';
import {
  Compass, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square,
  RotateCcw, Sliders, BatteryCharging, Zap, Shield, Target,
  Crosshair, Video, Check
} from 'lucide-react';
import {
  api,
  type AgvControl,
  type RobotArmControl,
  type CameraControl,
  type Device
} from '../api';

type ManualControllersProps = {
  deviceId: string;
  device: Device;
  onClose?: () => void;
  onUpdateState: (deviceId: string, manualControl: any) => void;
};

// ==========================================
// 1. AGV ROBOT MANUAL CONTROLLER
// ==========================================
export function AgvController({
  deviceId,
  device,
  onUpdateState,
}: ManualControllersProps) {
  const currentControl = (device.manual_control as AgvControl | undefined) ?? {
    mode: 'auto',
    x: 0,
    z: 0,
    heading: 0,
    speed: 1.0,
  };

  const [mode, setMode] = useState<'auto' | 'manual'>(currentControl.mode ?? 'auto');
  const [x, setX] = useState<number>(currentControl.x ?? 0);
  const [z, setZ] = useState<number>(currentControl.z ?? 0);
  const [heading, setHeading] = useState<number>(currentControl.heading ?? 0);
  const [speed, setSpeed] = useState<number>(currentControl.speed ?? 1.0);
  const [isSending, setIsSending] = useState(false);

  // Sync state if device prop updates from outside
  useEffect(() => {
    if (device.manual_control) {
      const c = device.manual_control as AgvControl;
      if (c.mode) setMode(c.mode);
      if (typeof c.x === 'number') setX(c.x);
      if (typeof c.z === 'number') setZ(c.z);
      if (typeof c.heading === 'number') setHeading(c.heading);
      if (typeof c.speed === 'number') setSpeed(c.speed);
    }
  }, [device.manual_control]);

  const dispatchUpdate = async (updated: Partial<AgvControl>) => {
    const next: AgvControl = {
      mode: updated.mode ?? mode,
      x: updated.x ?? x,
      z: updated.z ?? z,
      heading: updated.heading ?? heading,
      speed: updated.speed ?? speed,
    };
    onUpdateState(deviceId, next);
    try {
      setIsSending(true);
      await api.updateManualControl(deviceId, next);
    } catch (e) {
      console.error('Failed to update AGV manual control:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleDrive = (dir: 'forward' | 'backward' | 'left' | 'right' | 'stop') => {
    let nextX = x;
    let nextZ = z;
    let nextHeading = heading;
    const step = 0.45 * (speed / 1.0);
    const rotStep = 0.26; // ~15 degrees

    if (dir === 'forward') {
      nextX += Math.sin(heading) * step;
      nextZ += Math.cos(heading) * step;
    } else if (dir === 'backward') {
      nextX -= Math.sin(heading) * step;
      nextZ -= Math.cos(heading) * step;
    } else if (dir === 'left') {
      nextHeading += rotStep;
    } else if (dir === 'right') {
      nextHeading -= rotStep;
    }

    // Clamp coordinates to factory walls [-5.5 .. 5.5, -3.5 .. 3.5]
    nextX = Math.min(Math.max(nextX, -5.5), 5.5);
    nextZ = Math.min(Math.max(nextZ, -3.5), 3.5);

    setX(nextX);
    setZ(nextZ);
    setHeading(nextHeading);

    dispatchUpdate({
      mode: 'manual',
      x: Number(nextX.toFixed(2)),
      z: Number(nextZ.toFixed(2)),
      heading: Number(nextHeading.toFixed(3)),
    });
  };

  const handleGoToWaypoint = (targetX: number, targetZ: number) => {
    setX(targetX);
    setZ(targetZ);
    dispatchUpdate({
      mode: 'manual',
      x: targetX,
      z: targetZ,
    });
  };

  const toggleMode = (newMode: 'auto' | 'manual') => {
    setMode(newMode);
    dispatchUpdate({ mode: newMode });
  };

  return (
    <div className="controller-box agv-controller">
      <div className="controller-header">
        <div>
          <h4>ĐIỀU KHIỂN XE TỰ HÀNH (AGV)</h4>
          <span className="controller-subtitle">{device.name} • {deviceId}</span>
        </div>
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`btn-mode-pill ${mode === 'auto' ? 'active' : ''}`}
            onClick={() => toggleMode('auto')}
          >
            Tự động tuần tra
          </button>
          <button
            type="button"
            className={`btn-mode-pill ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => toggleMode('manual')}
          >
            Lái thủ công
          </button>
        </div>
      </div>

      {/* Real-time Telemetry Dashboard for AGV */}
      <div className="telemetry-bar">
        <div className="telem-item">
          <span>TỌA ĐỘ (X, Z)</span>
          <strong>{x.toFixed(2)}m, {z.toFixed(2)}m</strong>
        </div>
        <div className="telem-item">
          <span>HƯỚNG XOAY</span>
          <strong>{Math.round((heading * 180) / Math.PI)}°</strong>
        </div>
        <div className="telem-item">
          <span>TỐC ĐỘ</span>
          <strong>{(speed * 0.8).toFixed(1)} m/s</strong>
        </div>
        <div className="telem-item">
          <span>PIN AGV</span>
          <strong style={{ color: '#34d399' }}>96% <BatteryCharging size={13} style={{ display: 'inline' }} /></strong>
        </div>
      </div>

      {/* D-Pad Controller */}
      <div className="dpad-wrapper">
        <div className="dpad-grid">
          <div />
          <button
            type="button"
            className="dpad-btn btn-up"
            title="Tiến lên (W / ▲)"
            onClick={() => handleDrive('forward')}
          >
            <ArrowUp size={20} />
          </button>
          <div />

          <button
            type="button"
            className="dpad-btn btn-left"
            title="Rẽ trái (A / ◄)"
            onClick={() => handleDrive('left')}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className="dpad-btn btn-stop"
            title="Dừng khẩn cấp (Phím cách / ■)"
            onClick={() => handleDrive('stop')}
          >
            <Square size={16} fill="currentColor" />
          </button>
          <button
            type="button"
            className="dpad-btn btn-right"
            title="Rẽ phải (D / ►)"
            onClick={() => handleDrive('right')}
          >
            <ArrowRight size={20} />
          </button>

          <div />
          <button
            type="button"
            className="dpad-btn btn-down"
            title="Lùi lại (S / ▼)"
            onClick={() => handleDrive('backward')}
          >
            <ArrowDown size={20} />
          </button>
          <div />
        </div>
      </div>

      {/* Speed Slider */}
      <div className="slider-group">
        <div className="slider-label">
          <span>Tốc độ vận hành: <strong>{(speed * 100).toFixed(0)}%</strong></span>
          <small>{(speed * 0.8).toFixed(1)} m/s</small>
        </div>
        <input
          type="range"
          min="0.2"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setSpeed(val);
            dispatchUpdate({ speed: val });
          }}
        />
      </div>

      {/* Quick Go-To Waypoints */}
      <div className="waypoints-group">
        <span className="waypoints-title">ĐIỀU HƯỚNG NHANH ĐẾN TRẠM:</span>
        <div className="waypoints-grid">
          <button type="button" onClick={() => handleGoToWaypoint(0, -2.2)}>
            <Target size={13} /> Trạm sạc pin
          </button>
          <button type="button" onClick={() => handleGoToWaypoint(-3.0, 1.2)}>
            <Target size={13} /> Băng tải 1
          </button>
          <button type="button" onClick={() => handleGoToWaypoint(3.0, 1.2)}>
            <Target size={13} /> Băng tải 2
          </button>
          <button type="button" onClick={() => handleGoToWaypoint(0, 2.5)}>
            <Target size={13} /> Cửa xuất hàng
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. ROBOT ARM MULTI-AXIS MANUAL CONTROLLER
// ==========================================
export function RobotArmController({
  deviceId,
  device,
  onUpdateState,
}: ManualControllersProps) {
  const currentControl = (device.manual_control as RobotArmControl | undefined) ?? {
    mode: 'auto',
    baseAngle: 0,
    shoulderAngle: -30,
    elbowAngle: 45,
    gripper: 50,
  };

  const [mode, setMode] = useState<'auto' | 'manual'>(currentControl.mode ?? 'auto');
  const [baseAngle, setBaseAngle] = useState(currentControl.baseAngle ?? 0);
  const [shoulderAngle, setShoulderAngle] = useState(currentControl.shoulderAngle ?? -30);
  const [elbowAngle, setElbowAngle] = useState(currentControl.elbowAngle ?? 45);
  const [gripper, setGripper] = useState(currentControl.gripper ?? 50);

  useEffect(() => {
    if (device.manual_control) {
      const c = device.manual_control as RobotArmControl;
      if (c.mode) setMode(c.mode);
      if (typeof c.baseAngle === 'number') setBaseAngle(c.baseAngle);
      if (typeof c.shoulderAngle === 'number') setShoulderAngle(c.shoulderAngle);
      if (typeof c.elbowAngle === 'number') setElbowAngle(c.elbowAngle);
      if (typeof c.gripper === 'number') setGripper(c.gripper);
    }
  }, [device.manual_control]);

  const dispatchUpdate = async (updated: Partial<RobotArmControl>) => {
    const next: RobotArmControl = {
      mode: updated.mode ?? mode,
      baseAngle: updated.baseAngle ?? baseAngle,
      shoulderAngle: updated.shoulderAngle ?? shoulderAngle,
      elbowAngle: updated.elbowAngle ?? elbowAngle,
      gripper: updated.gripper ?? gripper,
    };
    onUpdateState(deviceId, next);
    try {
      await api.updateManualControl(deviceId, next);
    } catch (e) {
      console.error('Failed to update Robot Arm manual control:', e);
    }
  };

  const applyPose = (b: number, s: number, e: number, g: number) => {
    setBaseAngle(b);
    setShoulderAngle(s);
    setElbowAngle(e);
    setGripper(g);
    dispatchUpdate({
      mode: 'manual',
      baseAngle: b,
      shoulderAngle: s,
      elbowAngle: e,
      gripper: g,
    });
  };

  return (
    <div className="controller-box robot-arm-controller">
      <div className="controller-header">
        <div>
          <h4>ĐIỀU KHIỂN CÁNH TAY ROBOT (ARM)</h4>
          <span className="controller-subtitle">{device.name} • 4 Khớp chuyển động</span>
        </div>
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`btn-mode-pill ${mode === 'auto' ? 'active' : ''}`}
            onClick={() => { setMode('auto'); dispatchUpdate({ mode: 'auto' }); }}
          >
            Tự động chu kỳ
          </button>
          <button
            type="button"
            className={`btn-mode-pill ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => { setMode('manual'); dispatchUpdate({ mode: 'manual' }); }}
          >
            Thủ công từng trục
          </button>
        </div>
      </div>

      {/* Axis Sliders */}
      <div className="axis-sliders-list">
        {/* Joint 1: Base Yaw */}
        <div className="slider-group">
          <div className="slider-label">
            <span>Trục 1: Xoay đế (Base Yaw)</span>
            <strong>{baseAngle}°</strong>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            value={baseAngle}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setBaseAngle(val);
              dispatchUpdate({ mode: 'manual', baseAngle: val });
            }}
          />
        </div>

        {/* Joint 2: Shoulder Pitch */}
        <div className="slider-group">
          <div className="slider-label">
            <span>Trục 2: Khớp vai (Shoulder Pitch)</span>
            <strong>{shoulderAngle}°</strong>
          </div>
          <input
            type="range"
            min="-60"
            max="60"
            value={shoulderAngle}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setShoulderAngle(val);
              dispatchUpdate({ mode: 'manual', shoulderAngle: val });
            }}
          />
        </div>

        {/* Joint 3: Elbow Pitch */}
        <div className="slider-group">
          <div className="slider-label">
            <span>Trục 3: Khớp khuỷu (Elbow Pitch)</span>
            <strong>{elbowAngle}°</strong>
          </div>
          <input
            type="range"
            min="-90"
            max="90"
            value={elbowAngle}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setElbowAngle(val);
              dispatchUpdate({ mode: 'manual', elbowAngle: val });
            }}
          />
        </div>

        {/* Joint 4: Gripper */}
        <div className="slider-group">
          <div className="slider-label">
            <span>Mỏ kẹp (End-Effector Gripper)</span>
            <strong>{gripper}% ({gripper > 50 ? 'Đang kẹp' : 'Mở rộng'})</strong>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={gripper}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setGripper(val);
              dispatchUpdate({ mode: 'manual', gripper: val });
            }}
          />
        </div>
      </div>

      {/* Preset Poses */}
      <div className="waypoints-group">
        <span className="waypoints-title">TƯ THẾ ĐỊNH SẴN (PRESETS):</span>
        <div className="waypoints-grid">
          <button type="button" onClick={() => applyPose(0, 0, 0, 0)}>
            <Target size={13} /> Vị trí Home (0, 0, 0)
          </button>
          <button type="button" onClick={() => applyPose(35, 30, -45, 95)}>
            <Target size={13} /> Gắp phôi (Pick)
          </button>
          <button type="button" onClick={() => applyPose(-45, 20, -30, 10)}>
            <Target size={13} /> Đặt phôi (Place)
          </button>
          <button type="button" onClick={() => applyPose(0, -40, 60, 0)}>
            <Target size={13} /> Chế độ Nghỉ (Rest)
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. CAMERA PTZ MANUAL CONTROLLER
// ==========================================
export function CameraPtzController({
  deviceId,
  device,
  onUpdateState,
}: ManualControllersProps) {
  const currentControl = (device.manual_control as CameraControl | undefined) ?? {
    mode: 'auto',
    pan: 0,
    tilt: -15,
    zoom: 1.0,
  };

  const [pan, setPan] = useState(currentControl.pan ?? 0);
  const [tilt, setTilt] = useState(currentControl.tilt ?? -15);
  const [zoom, setZoom] = useState(currentControl.zoom ?? 1.0);

  useEffect(() => {
    if (device.manual_control) {
      const c = device.manual_control as CameraControl;
      if (typeof c.pan === 'number') setPan(c.pan);
      if (typeof c.tilt === 'number') setTilt(c.tilt);
      if (typeof c.zoom === 'number') setZoom(c.zoom);
    }
  }, [device.manual_control]);

  const dispatchUpdate = async (updated: Partial<CameraControl>) => {
    const next: CameraControl = {
      mode: 'manual',
      pan: updated.pan ?? pan,
      tilt: updated.tilt ?? tilt,
      zoom: updated.zoom ?? zoom,
    };
    onUpdateState(deviceId, next);
    try {
      await api.updateManualControl(deviceId, next);
    } catch (e) {
      console.error('Failed to update Camera PTZ control:', e);
    }
  };

  const handlePtz = (direction: 'up' | 'down' | 'left' | 'right' | 'home') => {
    let nextPan = pan;
    let nextTilt = tilt;
    const step = 8; // 8 degrees per click

    if (direction === 'left') nextPan = Math.max(pan - step, -180);
    else if (direction === 'right') nextPan = Math.min(pan + step, 180);
    else if (direction === 'up') nextTilt = Math.min(tilt + step, 45);
    else if (direction === 'down') nextTilt = Math.max(tilt - step, -60);
    else if (direction === 'home') { nextPan = 0; nextTilt = -15; }

    setPan(nextPan);
    setTilt(nextTilt);
    dispatchUpdate({ pan: nextPan, tilt: nextTilt });
  };

  return (
    <div className="controller-box camera-controller">
      <div className="controller-header">
        <div>
          <h4>ĐIỀU KHIỂN QUAY QUÉT CAMERA (PTZ)</h4>
          <span className="controller-subtitle">{device.name} • Pan / Tilt / Zoom</span>
        </div>
      </div>

      <div className="telemetry-bar">
        <div className="telem-item">
          <span>PAN (XOAY NGANG)</span>
          <strong>{pan}°</strong>
        </div>
        <div className="telem-item">
          <span>TILT (XOAY DỌC)</span>
          <strong>{tilt}°</strong>
        </div>
        <div className="telem-item">
          <span>ZOOM KỸ THUẬT SỐ</span>
          <strong>{zoom.toFixed(1)}x</strong>
        </div>
      </div>

      {/* PTZ D-Pad */}
      <div className="dpad-wrapper">
        <div className="dpad-grid">
          <div />
          <button type="button" className="dpad-btn btn-up" onClick={() => handlePtz('up')} title="Tilt Up">
            <ArrowUp size={20} />
          </button>
          <div />

          <button type="button" className="dpad-btn btn-left" onClick={() => handlePtz('left')} title="Pan Left">
            <ArrowLeft size={20} />
          </button>
          <button type="button" className="dpad-btn btn-stop" onClick={() => handlePtz('home')} title="Về Home">
            <Crosshair size={18} />
          </button>
          <button type="button" className="dpad-btn btn-right" onClick={() => handlePtz('right')} title="Pan Right">
            <ArrowRight size={20} />
          </button>

          <div />
          <button type="button" className="dpad-btn btn-down" onClick={() => handlePtz('down')} title="Tilt Down">
            <ArrowDown size={20} />
          </button>
          <div />
        </div>
      </div>

      {/* Zoom Slider */}
      <div className="slider-group">
        <div className="slider-label">
          <span>Phóng to (Zoom Level)</span>
          <strong>{zoom.toFixed(1)}x</strong>
        </div>
        <input
          type="range"
          min="1.0"
          max="4.0"
          step="0.2"
          value={zoom}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setZoom(val);
            dispatchUpdate({ zoom: val });
          }}
        />
      </div>

      {/* Camera Presets */}
      <div className="waypoints-group">
        <span className="waypoints-title">GÓC QUAN SÁT MẪU (PRESETS):</span>
        <div className="waypoints-grid">
          <button type="button" onClick={() => { setPan(0); setTilt(-15); dispatchUpdate({ pan: 0, tilt: -15 }); }}>
            <Target size={13} /> Vị trí Trung tâm
          </button>
          <button type="button" onClick={() => { setPan(45); setTilt(-20); dispatchUpdate({ pan: 45, tilt: -20 }); }}>
            <Target size={13} /> Soi Băng tải 1
          </button>
          <button type="button" onClick={() => { setPan(-45); setTilt(-20); dispatchUpdate({ pan: -45, tilt: -20 }); }}>
            <Target size={13} /> Soi Băng tải 2
          </button>
          <button type="button" onClick={() => { setPan(0); setTilt(-35); dispatchUpdate({ pan: 0, tilt: -35 }); }}>
            <Target size={13} /> Soi Tuyến xe AGV
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// UNIFIED WRAPPER SELECTOR
// ==========================================
export function ManualDeviceControllerModal({
  deviceId,
  device,
  onClose,
  onUpdateState,
}: ManualControllersProps) {
  const isAgv = deviceId.includes('avg') || device.category.toLowerCase().includes('avg');
  const isArm = deviceId.includes('arm_robot') || device.category.toLowerCase().includes('robot arm');
  const isCamera = deviceId.includes('camera') || device.category.toLowerCase().includes('camera');

  return (
    <div className="manual-modal-overlay" onClick={onClose}>
      <div className="manual-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top-bar">
          <span className="badge">MANUAL OVERRIDE</span>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </div>

        {isAgv && (
          <AgvController
            deviceId={deviceId}
            device={device}
            onClose={onClose}
            onUpdateState={onUpdateState}
          />
        )}

        {isArm && (
          <RobotArmController
            deviceId={deviceId}
            device={device}
            onClose={onClose}
            onUpdateState={onUpdateState}
          />
        )}

        {isCamera && (
          <CameraPtzController
            deviceId={deviceId}
            device={device}
            onClose={onClose}
            onUpdateState={onUpdateState}
          />
        )}

        {!isAgv && !isArm && !isCamera && (
          <div className="controller-box">
            <h4>Thiết bị: {device.name}</h4>
            <p>Thiết bị này không hỗ trợ điều khiển cơ khí trực tiếp (AGV/Arm/Camera). Vui lòng dùng nút Bật/Tắt trên bảng điều khiển.</p>
          </div>
        )}
      </div>
    </div>
  );
}
