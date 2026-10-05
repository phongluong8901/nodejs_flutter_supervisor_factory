import 'package:flutter/material.dart';
import 'package:my_production_app/home/screens/widgets/confirm_device.dart';
import 'package:provider/provider.dart';
import 'package:glassmorphism/glassmorphism.dart';
import '../../providers/iot_provider.dart';
import '../widgets/chart_dashboard_2.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab>
    with TickerProviderStateMixin {
  // Line-by-line: Controller cho hiệu ứng đốm màu chạy nền
  late AnimationController _bgController;

  @override
  void initState() {
    super.initState();
    _bgController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 15),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final iot = context.watch<IotProvider>();

    return Stack(
      children: [
        // 1. TRANG TRÍ NỀN
        _buildAnimatedBackground(),

        // 2. NỘI DUNG CHÍNH
        Column(
          children: [
            Expanded(
              child: ListView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(25, 10, 25, 120),
                children: [
                  _buildTopGreeting(iot.isOnline),
                  const SizedBox(height: 30),
                  const ChartDashboard(),
                  const SizedBox(height: 35),
                  _buildSectionHeader("GIÁM SÁT MÔI TRƯỜNG"),
                  const SizedBox(height: 5),
                  _buildSensorGrid(context, iot),
                  const SizedBox(height: 25), // Tăng khoảng cách nhẹ
                  _buildSectionHeader("ĐIỀU KHIỂN HỆ THỐNG"),
                  const SizedBox(height: 15),
                  _buildDeviceGrid(
                      context, iot), // Hàm đã được sửa thành dạng dòng
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  // --- HÀM TRANG TRÍ CARD THIẾT BỊ (ĐÃ SỬA THÀNH DẠNG TỪNG DÒNG) ---
  Widget _buildDeviceGrid(BuildContext context, IotProvider iot) {
    // Line-by-line: Sử dụng ListView.builder thay vì GridView để hiển thị theo hàng dọc
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: iot.devicesControl.length,
      itemBuilder: (context, index) {
        String key = iot.devicesControl.keys.elementAt(index);
        var data = iot.devicesControl[key];
        bool isOn = data['is_on'] ?? false;
        Color accent = const Color(0xFF00D2FF);

        return Padding(
          // Line-by-line: Khoảng cách giữa các dòng thiết bị là 12 đơn vị
          padding: const EdgeInsets.only(bottom: 12),
          child: GlassmorphicContainer(
            width: double.infinity,
            height: 75, // Line-by-line: Chiều cao vừa đủ để không bị vỡ layout
            borderRadius: 20,
            blur: 15,
            alignment: Alignment.center,
            border: isOn ? 1.5 : 0.5,
            linearGradient: LinearGradient(
              colors: [
                isOn
                    ? accent.withValues(alpha: 0.15)
                    : Colors.white.withValues(alpha: 0.05),
                Colors.white.withValues(alpha: 0.01),
              ],
            ),
            borderGradient: LinearGradient(
              colors: [isOn ? accent : Colors.white10, Colors.transparent],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  // Line-by-line: Biểu tượng thiết bị
                  Icon(
                    key.contains('fan')
                        ? Icons.cyclone
                        : Icons.lightbulb_rounded,
                    color: isOn ? accent : Colors.white24,
                    size: 28,
                  ),
                  const SizedBox(width: 15),
                  // Line-by-line: Tên thiết bị (Chiếm hết khoảng trống ở giữa)
                  Expanded(
                    child: Text(
                      (data['name'] ?? key).toString().toUpperCase(),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5),
                    ),
                  ),
                  // Line-by-line: Nút gạt Switch điều khiển
                  Transform.scale(
                    scale: 0.85,
                    child: Switch(
                      value: isOn,
                      activeThumbColor: accent,
                      onChanged: (v) async {
                        bool confirmed = await ConfirmDevices.show(
                          context,
                          title: v ? "Bật thiết bị" : "Tắt thiết bị",
                          message: "Xác nhận thực hiện?",
                          isTurningOn: v,
                        );
                        if (confirmed) iot.toggleDevicePower(key, v);
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  // --- HÀM TRANG TRÍ CARD CẢM BIẾN (GIỮ NGUYÊN) ---
  Widget _sensorCard(String title, String val, IconData icon, Color color,
      double percent, String status) {
    bool isAlert = color.toARGB32() == Colors.redAccent.toARGB32();

    return GlassmorphicContainer(
      width: double.infinity,
      height: double.infinity,
      borderRadius: 24,
      blur: 15,
      alignment: Alignment.center,
      border: isAlert ? 2 : 1,
      linearGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          color.withValues(alpha: isAlert ? 0.2 : 0.1),
          Colors.white.withValues(alpha: 0.05),
        ],
      ),
      borderGradient: LinearGradient(
        colors: [color.withValues(alpha: 0.5), Colors.transparent],
      ),
      child: Stack(
        children: [
          Positioned(
            bottom: -10,
            right: -10,
            child: Icon(icon, color: color.withValues(alpha: 0.05), size: 80),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(icon, color: color, size: 18),
                    ),
                    if (isAlert)
                      const Icon(Icons.warning_amber_rounded,
                          color: Colors.redAccent, size: 16),
                  ],
                ),
                const Spacer(),
                Text(title,
                    style: const TextStyle(
                        color: Colors.white38,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1)),
                const SizedBox(height: 4),
                Text(val,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: LinearProgressIndicator(
                    value: percent.clamp(0, 1),
                    backgroundColor: Colors.white10,
                    color: color,
                    minHeight: 4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- CÁC THÀNH PHẦN PHỤ TRỢ (GIỮ NGUYÊN) ---
  Widget _buildAnimatedBackground() {
    return AnimatedBuilder(
      animation: _bgController,
      builder: (context, child) {
        return Stack(
          children: [
            Positioned(
              top: 150 + (50 * _bgController.value),
              right: -50,
              child: _buildSpotColor(
                  300, const Color(0xFF00D2FF).withValues(alpha: 0.15)),
            ),
            Positioned(
              bottom: 100 - (30 * _bgController.value),
              left: -50,
              child: _buildSpotColor(350, Colors.purple.withValues(alpha: 0.1)),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSpotColor(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [color, Colors.transparent]),
      ),
    );
  }

  Widget _buildSensorGrid(BuildContext context, IotProvider iot) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 18,
      mainAxisSpacing: 18,
      children: [
        _sensorCard("NHIỆT ĐỘ", "${iot.temp.toStringAsFixed(1)}°C",
            Icons.thermostat_rounded, iot.getTempColor(), iot.temp / 50, ""),
        _sensorCard(
            "ÁP SUẤT",
            "${iot.pressure.toStringAsFixed(1)} hPa",
            Icons.speed_rounded,
            iot.getPressureColor(),
            iot.pressure / 1100,
            ""),
        _sensorCard(
            "ÁNH SÁNG",
            "${iot.light.toInt()} lx",
            Icons.light_mode_rounded,
            iot.getLightColor(),
            iot.light / 3000,
            ""),
        _sensorCard(
            "ĐỘ ẨM",
            "${iot.humidity.toStringAsFixed(1)}%",
            Icons.water_drop_rounded,
            iot.getHumidityColor(),
            iot.humidity / 100,
            ""),
      ],
    );
  }

  Widget _buildTopGreeting(bool isOnline) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text("Hệ thống",
          style: TextStyle(color: Colors.white38, fontSize: 12)),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text("DASHBOARD",
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isOnline
                  ? Colors.green.withValues(alpha: 0.1)
                  : Colors.red.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(isOnline ? "● ONLINE" : "● OFFLINE",
                style: TextStyle(
                    color: isOnline ? Colors.greenAccent : Colors.redAccent,
                    fontSize: 10,
                    fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    ]);
  }

  Widget _buildSectionHeader(String title) {
    return Row(children: [
      Text(title,
          style: const TextStyle(
              color: Colors.white24,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5)),
      const SizedBox(width: 15),
      const Expanded(child: Divider(color: Colors.white10, thickness: 1)),
    ]);
  }
}
