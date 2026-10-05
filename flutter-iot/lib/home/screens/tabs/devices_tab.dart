import 'package:flutter/material.dart';
import 'package:glassmorphism/glassmorphism.dart';
import 'package:provider/provider.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../../providers/iot_provider.dart';
import '../widgets/device_detail_sheet.dart';

class DevicesTab extends StatelessWidget {
  const DevicesTab({super.key});

  @override
  Widget build(BuildContext context) {
    // Line-by-line: Lấy dữ liệu từ Provider
    final iot = context.watch<IotProvider>();
    final robotList = iot.devicesControl.entries.toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: AnimationLimiter(
        // Line-by-line: Sử dụng ListView duy nhất cho toàn bộ trang để cuộn tất cả nội dung
        child: ListView(
          physics: const BouncingScrollPhysics(),
          // Line-by-line: Padding rộng rãi, đặc biệt là bottom (150) để cuộn sướng tay
          padding: const EdgeInsets.fromLTRB(25, 60, 25, 150),
          children: [
            // --- PHẦN 2: STATS ---
            _buildExpandedStats(iot),

            const SizedBox(
                height: 35), // Khoảng cách lớn giữa Stats và Danh sách
            const Text("DANH SÁCH NODES",
                style: TextStyle(
                    color: Colors.white24,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                    letterSpacing: 2)),
            const SizedBox(height: 15),

            // --- PHẦN 3: DANH SÁCH THIẾT BỊ ---
            if (robotList.isEmpty)
              _buildEmptyUI()
            else
              // Line-by-line: Dùng ListView.builder lồng vào (phải set shrinkWrap và physics)
              ListView.builder(
                shrinkWrap:
                    true, // Quan trọng: Để ListView con lấy chiều cao theo nội dung
                physics:
                    const NeverScrollableScrollPhysics(), // Để ListView cha xử lý cuộn
                itemCount: robotList.length,
                itemBuilder: (context, index) {
                  String id = robotList[index].key;
                  var data = Map<String, dynamic>.from(robotList[index].value);

                  return AnimationConfiguration.staggeredList(
                    position: index,
                    duration: const Duration(milliseconds: 600),
                    child: SlideAnimation(
                      verticalOffset: 50.0,
                      child: FadeInAnimation(
                        child: _buildWideDeviceCard(context, iot, id, data),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  // --- CARD THIẾT BỊ (Giữ phong cách "đồ sộ" 160px) ---
  Widget _buildWideDeviceCard(BuildContext context, IotProvider iot, String id,
      Map<String, dynamic> data) {
    String name = data['name'] ?? id;
    bool isOn = data['is_on'] ?? false;
    Color color = isOn ? const Color(0xFF00FFC2) : Colors.redAccent;

    return GestureDetector(
      onTap: () => _showMoreInfo(context, id, data),
      child: Container(
        margin: const EdgeInsets.only(bottom: 20),
        child: GlassmorphicContainer(
          width: double.infinity,
          height: 160,
          borderRadius: 30,
          blur: 20,
          alignment: Alignment.center,
          border: 0.5,
          linearGradient: LinearGradient(
            colors: [
              Colors.white.withValues(alpha: 0.08),
              Colors.white.withValues(alpha: 0.02)
            ],
          ),
          borderGradient: LinearGradient(
              colors: [isOn ? color : Colors.white10, Colors.transparent]),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          shape: BoxShape.circle),
                      child: Icon(_getIcon(name), color: color, size: 28),
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name.toUpperCase(),
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900)),
                          Text(isOn ? "ONLINE" : "OFFLINE",
                              style: TextStyle(
                                  color: color,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                    Switch.adaptive(
                      value: isOn,
                      activeThumbColor: color,
                      onChanged: (val) => iot.toggleDevicePower(id, val),
                    ),
                  ],
                ),
                const Spacer(),
                const Divider(color: Colors.white10, thickness: 0.5),
                const Spacer(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildMiniDetail("VOLTAGE", "220V"),
                    _buildMiniDetail("CURRENT", isOn ? "1.2A" : "0A"),
                    _buildMiniDetail("UPTIME", isOn ? "02:15:00" : "00:00:00"),
                    _buildMiniDetail("STATUS", "STABLE"),
                  ],
                )
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMiniDetail(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.white24,
                fontSize: 8,
                fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(value,
            style: const TextStyle(
                color: Colors.white70,
                fontSize: 10,
                fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildExpandedStats(IotProvider iot) {
    int total = iot.devicesControl.length;
    int active =
        iot.devicesControl.values.where((e) => e['is_on'] == true).length;

    return Row(
      children: [
        _expandedStatItem("DEVICES", total.toString(), Colors.blueAccent),
        const SizedBox(width: 15),
        _expandedStatItem("ACTIVE", active.toString(), const Color(0xFF00FFC2)),
      ],
    );
  }

  Widget _expandedStatItem(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(25),
          border: Border.all(color: Colors.white10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    color: Colors.white38,
                    fontSize: 10,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 5),
            Text(value,
                style: TextStyle(
                    color: color, fontSize: 26, fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyUI() => const Padding(
        padding: EdgeInsets.symmetric(vertical: 50),
        child: Center(
            child: Text("HỆ THỐNG TRỐNG",
                style: TextStyle(color: Colors.white24))),
      );

  void _showMoreInfo(
      BuildContext context, String id, Map<String, dynamic> data) {
    showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
        builder: (context) =>
            DeviceDetailSheet(deviceKey: id, data: data, deviceId: ''));
  }

  IconData _getIcon(String name) {
    String n = name.toLowerCase();
    if (n.contains("fan") || n.contains("quạt")) {
      return Icons.cyclone;
    }
    if (n.contains("lamp") || n.contains("led")) {
      return Icons.light_mode;
    }
    if (n.contains("camera")) {
      return Icons.videocam_rounded;
    }
    if (n.contains("conveyor") || n.contains("băng tải")) {
      return Icons.swap_horiz_rounded;
    }
    if (n.contains("robot")) {
      return Icons.precision_manufacturing_rounded;
    }
    if (n.contains("machine") || n.contains("máy")) {
      return Icons.settings_rounded;
    }
    return Icons.settings_input_antenna;
  }
}
