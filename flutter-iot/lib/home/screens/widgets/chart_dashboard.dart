import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:glassmorphism/glassmorphism.dart';
import 'package:provider/provider.dart';
import '../../providers/iot_provider.dart';

class ChartDashboard extends StatelessWidget {
  const ChartDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final iot = context.watch<IotProvider>();

    return SizedBox(
      height: 220, // Line-by-line: Tăng nhẹ chiều cao để chứa bảng thông số
      child: PageView(
        controller: PageController(
            viewportFraction: 0.9), // Line-by-line: Mở rộng diện tích hiển thị
        physics: const BouncingScrollPhysics(),
        children: [
          _buildProChart(
              iot.tempHistory, const Color(0xFF00D2FF), "TEMPERATURE", "°C"),
          _buildProChart(
              iot.pressureHistory, const Color(0xFFFA709A), "PRESSURE", "hPa"),
          _buildProChart(
              iot.humiHistory, const Color(0xFF43E97B), "HUMIDITY", "%"),
          _buildProChart(
              iot.lightHistory, const Color(0xFFFFE259), "LUMINOSITY", "lux"),
        ],
      ),
    );
  }

  Widget _buildProChart(
      List<double> data, Color color, String title, String unit) {
    // Line-by-line: Xử lý dữ liệu trống để tránh lỗi crash biểu đồ
    if (data.isEmpty) data = [0.0];

    // Line-by-line: Tính toán các thông số thống kê chuyên nghiệp
    double current = data.last;
    double maxVal = data.reduce((a, b) => a > b ? a : b);
    double minVal = data.reduce((a, b) => a < b ? a : b);
    double avgVal = data.reduce((a, b) => a + b) / data.length;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      child: GlassmorphicContainer(
        width: double.infinity,
        height: 210,
        borderRadius: 25,
        blur: 20,
        alignment: Alignment.center,
        border: 1,
        linearGradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withValues(alpha: 0.05),
            Colors.white.withValues(alpha: 0.02)
          ],
        ),
        borderGradient: LinearGradient(
            colors: [color.withValues(alpha: 0.3), Colors.transparent]),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              // 1. HEADER: Tiêu đề và Trạng thái thời gian thực
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: TextStyle(
                              color: color,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.5)),
                      const SizedBox(height: 2),
                      const Text("LIVE TELEMETRY",
                          style: TextStyle(color: Colors.white24, fontSize: 8)),
                    ],
                  ),
                  Text("${current.toStringAsFixed(1)} $unit",
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace')),
                ],
              ),
              const SizedBox(height: 12),

              // 2. MAIN CONTENT: Biểu đồ kết hợp thông số bên cạnh
              Expanded(
                child: Row(
                  children: [
                    // Line-by-line: Biểu đồ đường rút gọn (Sparkline style)
                    Expanded(
                      flex: 3,
                      child: LineChart(
                        LineChartData(
                          gridData: const FlGridData(show: false),
                          titlesData: const FlTitlesData(show: false),
                          borderData: FlBorderData(show: false),
                          minX: 0,
                          maxX: 14,
                          lineBarsData: [
                            LineChartBarData(
                              spots: data
                                  .asMap()
                                  .entries
                                  .map((e) => FlSpot(e.key.toDouble(), e.value))
                                  .toList(),
                              isCurved: true,
                              color: color,
                              barWidth: 2,
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(
                                show: true,
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    color.withValues(alpha: 0.2),
                                    color.withValues(alpha: 0)
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Line-by-line: Cột thông số chi tiết (Analytics column)
                    Expanded(
                      flex: 1,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          _buildStatItem("MAX", maxVal, unit, Colors.white70),
                          const SizedBox(height: 8),
                          _buildStatItem("AVG", avgVal, unit, Colors.white70),
                          const SizedBox(height: 8),
                          _buildStatItem("MIN", minVal, unit, Colors.white70),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, double value, String unit, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.white24,
                fontSize: 7,
                fontWeight: FontWeight.bold)),
        Text("${value.toStringAsFixed(1)}$unit",
            style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.w600,
                fontFamily: 'monospace')),
      ],
    );
  }
}
