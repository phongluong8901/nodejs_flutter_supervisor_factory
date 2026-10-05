import 'package:flutter/material.dart';
import 'package:glassmorphism/glassmorphism.dart';
import 'package:provider/provider.dart';
import '../../providers/iot_provider.dart';

class ChartDashboard extends StatelessWidget {
  const ChartDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final iot = context.watch<IotProvider>();

    return SizedBox(
      height: 260,
      child: PageView(
        controller: PageController(viewportFraction: 0.92),
        physics: const BouncingScrollPhysics(),
        children: [
          _buildAnalyticChart(
              iot.tempHistory, const Color(0xFF00D2FF), "TEMPERATURE", "°C"),
          _buildAnalyticChart(
              iot.pressureHistory, const Color(0xFFFA709A), "PRESSURE", "hPa"),
          _buildAnalyticChart(
              iot.humiHistory, const Color(0xFF43E97B), "HUMIDITY", "%"),
          _buildAnalyticChart(
              iot.lightHistory, const Color(0xFFFFE259), "LUMINOSITY", "lux"),
        ],
      ),
    );
  }

  Widget _buildAnalyticChart(
      List<double> data, Color color, String title, String unit) {
    if (data.isEmpty) data = [0.0, 0.0];

    // Line-by-line: Tính toán thông số thống kê
    double maxVal = data.reduce((a, b) => a > b ? a : b);
    double minVal = data.reduce((a, b) => a < b ? a : b);
    double avgVal = data.reduce((a, b) => a + b) / data.length;

    final ValueNotifier<int?> hoverIndex = ValueNotifier<int?>(null);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      child: GlassmorphicContainer(
        width: double.infinity,
        height: 240,
        borderRadius: 24,
        blur: 15,
        alignment: Alignment.center,
        border: 1,
        linearGradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.1),
            Colors.white.withValues(alpha: 0.02)
          ],
        ),
        borderGradient: LinearGradient(
            colors: [color.withValues(alpha: 0.5), Colors.transparent]),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              // 1. Header
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
                      const SizedBox(height: 4),
                      ValueListenableBuilder(
                        valueListenable: hoverIndex,
                        builder: (context, index, _) {
                          double val = index != null ? data[index] : data.last;
                          return Text("${val.toStringAsFixed(1)} $unit",
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'monospace'));
                        },
                      ),
                    ],
                  ),
                  const Icon(Icons.bolt, color: Colors.white10, size: 24),
                ],
              ),
              const SizedBox(height: 20),

              // 2. Main Content: Chart (Trái) & Stats (Phải)
              Expanded(
                child: Row(
                  children: [
                    // Biểu đồ
                    Expanded(
                      flex: 4,
                      child: LayoutBuilder(builder: (context, constraints) {
                        return MouseRegion(
                          cursor: SystemMouseCursors.click,
                          onHover: (event) {
                            double step =
                                constraints.maxWidth / (data.length - 1);
                            int index = (event.localPosition.dx / step)
                                .round()
                                .clamp(0, data.length - 1);
                            hoverIndex.value = index;
                          },
                          onExit: (_) => hoverIndex.value = null,
                          child: ValueListenableBuilder(
                            valueListenable: hoverIndex,
                            builder: (context, index, _) {
                              return CustomPaint(
                                size: Size(constraints.maxWidth,
                                    constraints.maxHeight),
                                painter: AnalyticPainter(
                                    data: data,
                                    color: color,
                                    unit: unit,
                                    hoverIndex: index),
                              );
                            },
                          ),
                        );
                      }),
                    ),

                    // Cột thống kê bên phải
                    Container(
                        width: 1,
                        color: Colors.white10,
                        margin: const EdgeInsets.symmetric(horizontal: 12)),
                    Column(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _buildStatSide("MAX", maxVal, unit, color),
                        _buildStatSide("AVG", avgVal, unit, Colors.white70),
                        _buildStatSide("MIN", minVal, unit, Colors.white38),
                      ],
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

  Widget _buildStatSide(
      String label, double val, String unit, Color textColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.white24,
                fontSize: 8,
                fontWeight: FontWeight.bold)),
        Text("${val.toStringAsFixed(1)}$unit",
            style: TextStyle(
                color: textColor,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                fontFamily: 'monospace')),
      ],
    );
  }
}

class AnalyticPainter extends CustomPainter {
  final List<double> data;
  final Color color;
  final String unit;
  final int? hoverIndex;

  AnalyticPainter(
      {required this.data,
      required this.color,
      required this.unit,
      this.hoverIndex});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;

    double maxVal = data.reduce((a, b) => a > b ? a : b);
    double minVal = data.reduce((a, b) => a < b ? a : b);
    int maxIdx = data.indexOf(maxVal);
    int minIdx = data.lastIndexOf(
        minVal); // Dùng last để tránh đè nếu có nhiều điểm bằng nhau

    double range = (maxVal - minVal) == 0 ? 1 : (maxVal - minVal);
    double stepX = size.width / (data.length - 1);
    List<Offset> points = data.asMap().entries.map((e) {
      double x = e.key * stepX;
      double y =
          size.height - ((e.value - minVal) / range * (size.height - 40)) - 20;
      return Offset(x, y);
    }).toList();

    // 1. Vẽ Path & Gradient
    final path = Path()..moveTo(points[0].dx, points[0].dy);
    for (int i = 0; i < points.length - 1; i++) {
      path.cubicTo(
          (points[i].dx + points[i + 1].dx) / 2,
          points[i].dy,
          (points[i].dx + points[i + 1].dx) / 2,
          points[i + 1].dy,
          points[i + 1].dx,
          points[i + 1].dy);
    }

    canvas.drawPath(
        Path.from(path)
          ..lineTo(size.width, size.height)
          ..lineTo(0, size.height)
          ..close(),
        Paint()
          ..shader = LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [color.withValues(alpha: 0.2), Colors.transparent])
              .createShader(Rect.fromLTWH(0, 0, size.width, size.height)));

    canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..strokeWidth = 3
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round);

    // 2. Logic hiện Max/Min: Nếu Max == Min thì chỉ hiện 1 nhãn "Steady"
    if (maxVal == minVal) {
      _drawLabel(canvas, points[points.length ~/ 2],
          "VALUE: ${maxVal.toStringAsFixed(1)}$unit", color);
    } else {
      _drawLabel(canvas, points[maxIdx],
          "MAX: ${maxVal.toStringAsFixed(1)}$unit", color);
      _drawLabel(canvas, points[minIdx],
          "MIN: ${minVal.toStringAsFixed(1)}$unit", Colors.white60);
    }

    // 3. Hover Tooltip
    if (hoverIndex != null) {
      final p = points[hoverIndex!];
      canvas.drawLine(Offset(p.dx, 0), Offset(p.dx, size.height),
          Paint()..color = Colors.white10);
      canvas.drawCircle(p, 5, Paint()..color = Colors.white);

      final tp = TextPainter(
          text: TextSpan(
              text: "${data[hoverIndex!].toStringAsFixed(1)}$unit",
              style: const TextStyle(
                  color: Colors.black,
                  fontSize: 10,
                  fontWeight: FontWeight.bold)),
          textDirection: TextDirection.ltr)
        ..layout();
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              Rect.fromLTWH(p.dx - tp.width / 2 - 4, p.dy - 28, tp.width + 8,
                  tp.height + 4),
              const Radius.circular(4)),
          Paint()..color = Colors.white);
      tp.paint(canvas, Offset(p.dx - tp.width / 2, p.dy - 26));
    }
  }

  void _drawLabel(Canvas canvas, Offset pos, String txt, Color c) {
    final tp = TextPainter(
        text: TextSpan(
            text: txt,
            style:
                TextStyle(color: c, fontSize: 9, fontWeight: FontWeight.bold)),
        textDirection: TextDirection.ltr)
      ..layout();
    tp.paint(canvas, pos + const Offset(-10, -18));
    canvas.drawCircle(pos, 3, Paint()..color = c);
  }

  @override
  bool shouldRepaint(AnalyticPainter old) => true;
}
