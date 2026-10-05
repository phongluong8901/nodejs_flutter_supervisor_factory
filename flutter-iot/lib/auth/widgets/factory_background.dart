import 'dart:math';
import 'package:flutter/material.dart';

class FactoryBackground extends StatefulWidget {
  const FactoryBackground({super.key});

  @override
  State<FactoryBackground> createState() => _FactoryBackgroundState();
}

class _FactoryBackgroundState extends State<FactoryBackground>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // Tạo chuyển động lặp đi lặp lại vô tận
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          painter: BackgroundPainter(_controller.value),
          child: Container(),
        );
      },
    );
  }
}

class BackgroundPainter extends CustomPainter {
  final double animationValue;
  BackgroundPainter(this.animationValue);

  @override
  void paint(Canvas canvas, Size size) {
    final paintGrid = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..strokeWidth = 1.0;

    // 1. Vẽ các đường lưới ngang (Grid)
    double gridSize = 40.0;
    for (double i = 0; i < size.height; i += gridSize) {
      canvas.drawLine(Offset(0, i), Offset(size.width, i), paintGrid);
    }
    // 2. Vẽ các đường lưới dọc
    for (double i = 0; i < size.width; i += gridSize) {
      canvas.drawLine(Offset(i, 0), Offset(i, size.height), paintGrid);
    }

    // 3. Vẽ các hạt chuyển động (Particles)
    final random = Random(42); // Seed cố định để hạt không bị nhảy lung tung
    final paintParticle = Paint()
      ..color = const Color(0xFF00D2FF).withValues(alpha: 0.2);

    for (int i = 0; i < 20; i++) {
      double x = random.nextDouble() * size.width;
      double y = (random.nextDouble() * size.height + (animationValue * 100)) %
          size.height;
      canvas.drawCircle(Offset(x, y), 2, paintParticle);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
