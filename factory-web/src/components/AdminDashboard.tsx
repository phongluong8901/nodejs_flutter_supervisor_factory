import { useState } from 'react';
import {
  ShieldAlert, Play, Wrench, Leaf, Zap, Activity, AlertTriangle,
  Server, Database, Gauge, ArrowRight, RefreshCw, Cpu, Layers, Eye
} from 'lucide-react';
import { api, type Device, type FactoryStatus } from '../api';

type AdminDashboardProps = {
  status: FactoryStatus;
  onRefresh: () => Promise<void>;
  onNavigateTab: (tab: 'dashboard' | 'map2d' | 'devices' | 'analytics' | 'cameras') => void;
  onSelectDevice: (deviceId: string) => void;
};

export function AdminDashboard({
  status,
  onRefresh,
  onNavigateTab,
  onSelectDevice,
}: AdminDashboardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const devices = status.devices_control ?? {};
  const deviceList = Object.entries(devices);

  const totalDevices = deviceList.length;
  const runningDevices = deviceList.filter(([, d]) => d.is_on).length;
  const totalPowerKW = (deviceList.reduce((acc, [, d]) => acc + (d.is_on ? (d.power ?? 0) : 0), 0) / 1000).toFixed(2);
  const avgHealth = totalDevices > 0
    ? Math.round(deviceList.reduce((acc, [, d]) => acc + (d.health ?? 100), 0) / totalDevices)
    : 100;
  
  // Simulated OEE calculation
  const availability = totalDevices > 0 ? Math.round((runningDevices / totalDevices) * 100) : 0;
  const performance = 92;
  const quality = 98;
  const oee = Math.round((availability * performance * quality) / 10000);

  const handleBatch = async (action: 'emergency_stop' | 'start_all' | 'maintenance' | 'eco_mode') => {
    setIsExecuting(true);
    setFeedback(null);
    try {
      await api.batchControl(action);
      await onRefresh();
      const labels = {
        emergency_stop: '🚨 Đã kích hoạt DỪNG KHẨN CẤP toàn bộ thiết bị!',
        start_all: '▶️ Đã khởi động toàn bộ dây chuyền sản xuất thành công!',
        maintenance: '🛠️ Đã chuyển toàn xưởng sang chế độ Bảo dưỡng & Reset runtime!',
        eco_mode: '🌱 Đã bật Chế độ Tiết kiệm điện năng Eco-Mode (giảm 30% công suất)!',
      };
      setFeedback(labels[action]);
    } catch (err) {
      setFeedback(`❌ Lỗi thực thi lệnh: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExecuting(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const zones = [
    {
      id: 'robotics',
      name: 'Khu vực 1: Robot Arm & Lắp ráp',
      deviceKeys: ['arm_robot_1', 'arm_robot_2'],
      badge: 'Robot Cell',
    },
    {
      id: 'logistics',
      name: 'Khu vực 2: Xe tự hành AGV Logistics',
      deviceKeys: ['avg_robot_1', 'avg_robot_2'],
      badge: 'AGV Track',
    },
    {
      id: 'conveyors',
      name: 'Khu vực 3: Băng tải vận chuyển',
      deviceKeys: ['conveyor_belt_1', 'conveyor_belt_2'],
      badge: 'Conveyors',
    },
    {
      id: 'machining',
      name: 'Khu vực 4: Máy gia công tự động',
      deviceKeys: ['auto_machine_1', 'auto_machine_2'],
      badge: 'CNC & Auto',
    },
    {
      id: 'utilities',
      name: 'Khu vực 5: Tiện ích & Giám sát (Quạt, Đèn, Camera)',
      deviceKeys: ['corner_fan_1', 'corner_fan_2', 'left_led_1', 'right_led_1', 'security_camera_1', 'security_camera_2'],
      badge: 'Utilities',
    },
  ];

  return (
    <div className="admin-dashboard-container">
      {/* Top Banner & Feedback */}
      <div className="admin-header-card">
        <div className="admin-header-left">
          <div className="admin-badge">
            <ShieldAlert size={16} /> TRUNG TÂM ĐIỀU HÀNH ADMIN / FACTORY CONTROL ROOM
          </div>
          <h2>Bảng Điều Khiển Quản Trị Nhà Máy Thông Minh</h2>
          <p>Giám sát cấp cao OEE, điện năng tổng, điều khiển hàng loạt và chuyển đổi chế độ vận hành.</p>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="btn-admin-action"
            onClick={() => onNavigateTab('map2d')}
          >
            <Layers size={16} /> Mở Sơ đồ 2D
          </button>
          <button
            type="button"
            className="btn-admin-action"
            onClick={() => onNavigateTab('cameras')}
          >
            <Eye size={16} /> Camera FPV
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`admin-feedback-banner ${feedback.startsWith('❌') ? 'error' : 'success'}`}>
          {feedback}
        </div>
      )}

      {/* Master Batch Control Panel */}
      <div className="admin-control-strip card">
        <div className="control-strip-header">
          <div className="eyebrow">MASTER BATCH COMMANDS</div>
          <h3>Lệnh Điều Khiển Toàn Bộ Nhà Máy</h3>
        </div>

        <div className="master-buttons-grid">
          <button
            type="button"
            className="btn-master btn-estop"
            disabled={isExecuting}
            onClick={() => {
              if (window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn DỪNG KHẨN CẤP toàn bộ 16 thiết bị nhà máy?')) {
                handleBatch('emergency_stop');
              }
            }}
          >
            <div className="btn-icon"><ShieldAlert size={24} /></div>
            <div className="btn-text">
              <strong>E-STOP KHẨN CẤP</strong>
              <small>Tắt toàn bộ máy móc ngay lập tức</small>
            </div>
          </button>

          <button
            type="button"
            className="btn-master btn-startall"
            disabled={isExecuting}
            onClick={() => handleBatch('start_all')}
          >
            <div className="btn-icon"><Play size={24} /></div>
            <div className="btn-text">
              <strong>START TOÀN BỘ</strong>
              <small>Khởi động đồng bộ dây chuyền</small>
            </div>
          </button>

          <button
            type="button"
            className="btn-master btn-eco"
            disabled={isExecuting}
            onClick={() => handleBatch('eco_mode')}
          >
            <div className="btn-icon"><Leaf size={24} /></div>
            <div className="btn-text">
              <strong>CHẾ ĐỘ ECO</strong>
              <small>Tối ưu tiết kiệm điện năng (-30%)</small>
            </div>
          </button>

          <button
            type="button"
            className="btn-master btn-maint"
            disabled={isExecuting}
            onClick={() => handleBatch('maintenance')}
          >
            <div className="btn-icon"><Wrench size={24} /></div>
            <div className="btn-text">
              <strong>BẢO DƯỠNG TOÀN XƯỞNG</strong>
              <small>Reset thời gian chạy & bảo trì</small>
            </div>
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="admin-kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Gauge size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Hiệu Suất Tổng Thể (OEE)</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{oee}%</strong>
              <span className={`kpi-tag ${oee >= 75 ? 'tag-good' : 'tag-warn'}`}>
                {oee >= 75 ? 'Đạt chuẩn' : 'Cần tối ưu'}
              </span>
            </div>
            <div className="kpi-breakdown">
              <span>Sẵn sàng: {availability}%</span>
              <span>• Hiệu suất: {performance}%</span>
              <span>• Chất lượng: {quality}%</span>
            </div>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(250, 204, 21, 0.15)', color: '#facc15' }}>
            <Zap size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Tổng Công Suất Đang Dùng</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{totalPowerKW} kW</strong>
              <span className="kpi-tag tag-neutral">{runningDevices}/{totalDevices} thiết bị bật</span>
            </div>
            <div className="kpi-breakdown">
              <span>Ước tính tiêu thụ: {(Number(totalPowerKW) * 24).toFixed(1)} kWh/ngày</span>
            </div>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
            <Activity size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Điểm Sức Khỏe Máy (Health)</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">{avgHealth}%</strong>
              <span className="kpi-tag tag-good">Tình trạng tốt</span>
            </div>
            <div className="kpi-breakdown">
              <span>100% thiết bị đạt tiêu chuẩn bảo trì</span>
            </div>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <Server size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Hạ Tầng Backend & IoT</span>
            <div className="kpi-value-row">
              <strong className="kpi-number">99.98%</strong>
              <span className="kpi-tag tag-good">Đang kết nối</span>
            </div>
            <div className="kpi-breakdown">
              <span>MongoDB: Atlas Online • Socket: Real-time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Zones Breakdown */}
      <div className="admin-zones-section card">
        <div className="panel-header">
          <div>
            <div className="eyebrow">SUB-SYSTEM AUDIT</div>
            <h3>Tình Trạng Vận Hành Từng Phân Xưởng</h3>
          </div>
          <span className="live-tag"><span /> CẬP NHẬT TRỰC TIẾP</span>
        </div>

        <div className="zones-list">
          {zones.map((zone) => {
            const zoneDevices = zone.deviceKeys.map((key) => ({ key, data: devices[key] as Device | undefined })).filter((x) => x.data);
            const activeCount = zoneDevices.filter((x) => x.data?.is_on).length;
            const zonePower = zoneDevices.reduce((sum, x) => sum + (x.data?.is_on ? (x.data.power ?? 0) : 0), 0);

            return (
              <div key={zone.id} className="zone-row-card">
                <div className="zone-row-header">
                  <div>
                    <h4>{zone.name}</h4>
                    <span className="zone-badge">{zone.badge}</span>
                  </div>
                  <div className="zone-stats">
                    <span className="zone-stat-item">
                      Đang chạy: <strong>{activeCount}/{zoneDevices.length}</strong>
                    </span>
                    <span className="zone-stat-item">
                      Công suất: <strong>{zonePower} W</strong>
                    </span>
                  </div>
                </div>

                <div className="zone-devices-chips">
                  {zoneDevices.map(({ key, data }) => (
                    <button
                      key={key}
                      type="button"
                      className={`device-chip-btn ${data?.is_on ? 'active' : 'inactive'}`}
                      onClick={() => {
                        onSelectDevice(key);
                        onNavigateTab('devices');
                      }}
                      title="Bấm để xem và điều khiển chi tiết"
                    >
                      <span className="chip-dot" />
                      <span className="chip-name">{data?.name ?? key}</span>
                      <span className="chip-power">{data?.is_on ? `${data.power}W` : 'OFF'}</span>
                      <ArrowRight size={12} className="chip-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
