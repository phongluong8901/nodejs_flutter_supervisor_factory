import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:glassmorphism/glassmorphism.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../providers/iot_provider.dart'; // Đảm bảo đúng đường dẫn

class AnalyticsTab extends StatelessWidget {
  const AnalyticsTab({super.key});

  // Line-by-line: Format giờ từ chuỗi ISO 8601 của NestJS
  String _formatTime(String? dateStr) {
    if (dateStr == null) return "--:--";
    try {
      DateTime date = DateTime.parse(dateStr).toLocal();
      return DateFormat('HH:mm').format(date);
    } catch (e) {
      return "--:--";
    }
  }

  // Line-by-line: Lấy khung giờ để nhóm các sự kiện
  String _getHourKey(String? dateStr) {
    if (dateStr == null) return "N/A";
    try {
      DateTime date = DateTime.parse(dateStr).toLocal();
      return DateFormat('HH:00').format(date);
    } catch (e) {
      return "N/A";
    }
  }

  @override
  Widget build(BuildContext context) {
    final iot = context.watch<IotProvider>();
    final List<dynamic> allLogs = iot.logs;

    // Line-by-line: Tính toán các chỉ số hệ thống từ Logs
    int totalLogs = allLogs.length;
    int warnings = allLogs.where((l) => l['type'] == 'warning').length;
    double efficiency = (1.0 - (warnings * 0.05)).clamp(0.0, 1.0);
    double stability =
        totalLogs == 0 ? 1.0 : ((totalLogs - warnings) / totalLogs);

    // Line-by-line: Nhóm log theo khung giờ
    Map<String, List<dynamic>> groupedLogs = {};
    for (var log in allLogs) {
      String hour = _getHourKey(log['timestamp']);
      groupedLogs.putIfAbsent(hour, () => []).add(log);
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: () => iot.fetchLogs(),
        color: const Color(0xFF00D2FF),
        child: ListView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(25, 60, 25, 150),
          children: [
            // --- CHỈ SỐ SỨC KHỎE ---
            _buildMetricsOverview(efficiency, stability, warnings),
            const SizedBox(height: 20),

            // --- BIỂU ĐỒ NHIỆT ĐỘ THỜI GIAN THỰC ---
            _buildTrendChart(iot),
            const SizedBox(height: 35),

            // --- TIMELINE VẬN HÀNH ---
            const Text("TIMELINE VẬN HÀNH",
                style: TextStyle(
                    color: Colors.white24,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2)),
            const SizedBox(height: 25),

            if (allLogs.isEmpty)
              _buildEmptyState(iot)
            else
              // Line-by-line: Duyệt qua các nhóm giờ để vẽ Timeline
              ...groupedLogs.entries.map(
                  (entry) => _buildModernTimelineItem(entry.key, entry.value)),
          ],
        ),
      ),
    );
  }

  // --- WIDGET: BIỂU ĐỒ ĐƯỜNG (Dùng dữ liệu tempHistory từ Provider) ---
  Widget _buildTrendChart(IotProvider iot) {
    List<FlSpot> spots = [];
    for (int i = 0; i < iot.tempHistory.length; i++) {
      spots.add(FlSpot(i.toDouble(), iot.tempHistory[i]));
    }

    return GlassmorphicContainer(
      width: double.infinity,
      height: 200,
      borderRadius: 30,
      blur: 20,
      alignment: Alignment.center,
      border: 0.5,
      linearGradient: LinearGradient(colors: [
        Colors.white.withValues(alpha: 0.05),
        Colors.white.withValues(alpha: 0.02)
      ]),
      borderGradient:
          const LinearGradient(colors: [Color(0xFF00D2FF), Colors.transparent]),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(5, 25, 20, 10),
        child: LineChart(
          LineChartData(
            gridData: const FlGridData(show: false),
            titlesData: const FlTitlesData(show: false),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              LineChartBarData(
                spots: spots.isEmpty ? [const FlSpot(0, 0)] : spots,
                isCurved: true,
                color: const Color(0xFF00D2FF),
                barWidth: 4,
                isStrokeCapRound: true,
                dotData: const FlDotData(show: false),
                belowBarData: BarAreaData(
                  show: true,
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      const Color(0xFF00D2FF).withValues(alpha: 0.2),
                      Colors.transparent
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- WIDGET: THẺ CHỈ SỐ TỔNG QUAN ---
  Widget _buildMetricsOverview(double eff, double stab, int warns) {
    return Row(
      children: [
        Expanded(
          flex: 3,
          child: _glassMetricCard("HIỆU SUẤT", "${(eff * 100).toInt()}%",
              const Color(0xFF00D2FF), eff),
        ),
        const SizedBox(width: 15),
        Expanded(
          flex: 2,
          child: _glassMetricCard("CẢNH BÁO", warns.toString(),
              Colors.orangeAccent, (warns / 10).clamp(0, 1)),
        ),
      ],
    );
  }

  Widget _glassMetricCard(
      String label, String value, Color color, double progress) {
    return GlassmorphicContainer(
      width: double.infinity,
      height: 130,
      borderRadius: 25,
      blur: 20,
      alignment: Alignment.center,
      border: 0.5,
      linearGradient: LinearGradient(colors: [
        Colors.white.withValues(alpha: 0.05),
        Colors.white.withValues(alpha: 0.02)
      ]),
      borderGradient: LinearGradient(
          colors: [color.withValues(alpha: 0.5), Colors.transparent]),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                  width: 50,
                  height: 50,
                  child: CircularProgressIndicator(
                      value: progress,
                      strokeWidth: 4,
                      backgroundColor: Colors.white10,
                      color: color)),
              Text(value,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 10),
          Text(label,
              style: const TextStyle(
                  color: Colors.white38,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1)),
        ],
      ),
    );
  }

  // --- WIDGET: TIMELINE FIX LỖI OVERFLOW ---
  Widget _buildModernTimelineItem(String hour, List<dynamic> logs) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Cột hiển thị đường kẻ và chấm tròn
        Column(
          children: [
            const SizedBox(height: 6),
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                  color: const Color(0xFF00D2FF),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.black, width: 2.5)),
            ),
            // Line-by-line: Đường kẻ nối dọc xuống các log
            Container(width: 2, height: 150, color: Colors.white10),
          ],
        ),
        const SizedBox(width: 20),
        // Danh sách các Log trong khung giờ
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(hour,
                  style: const TextStyle(
                      color: Color(0xFF00D2FF),
                      fontWeight: FontWeight.w900,
                      fontSize: 18)),
              const SizedBox(height: 15),
              ...logs.map((log) {
                bool isWarning = log['type'] == 'warning';
                return Container(
                  margin: const EdgeInsets.only(bottom: 15),
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    color: isWarning
                        ? Colors.orangeAccent.withValues(alpha: 0.07)
                        : Colors.white.withValues(alpha: 0.03),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Row(
                    children: [
                      Icon(
                          isWarning
                              ? Icons.warning_rounded
                              : Icons.info_outline_rounded,
                          color: isWarning
                              ? Colors.orangeAccent
                              : Colors.blueAccent,
                          size: 18),
                      const SizedBox(width: 15),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(log['title'] ?? "HỆ THỐNG",
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold)),
                            Text(log['message'] ?? "",
                                style: const TextStyle(
                                    color: Colors.white38, fontSize: 12)),
                          ],
                        ),
                      ),
                      Text(_formatTime(log['timestamp']),
                          style: const TextStyle(
                              color: Colors.white24, fontSize: 10)),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(IotProvider iot) {
    return Center(
      child: Column(
        children: [
          const SizedBox(height: 50),
          const Icon(Icons.auto_graph_rounded, color: Colors.white10, size: 80),
          const SizedBox(height: 20),
          const Text("KHÔNG CÓ NHẬT KÝ",
              style: TextStyle(
                  color: Colors.white24, fontWeight: FontWeight.bold)),
          TextButton(
              onPressed: () => iot.fetchLogs(),
              child: const Text("Tải lại dữ liệu")),
        ],
      ),
    );
  }
}
