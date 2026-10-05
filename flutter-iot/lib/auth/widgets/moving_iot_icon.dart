import 'dart:math';
import 'package:flutter/material.dart';

class MovingIotIcon extends StatefulWidget {
  const MovingIotIcon({super.key});

  @override
  State<MovingIotIcon> createState() => _MovingIotIconState();
}

class _MovingIotIconState extends State<MovingIotIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // 1. Line-by-line: Khởi tạo controller cho robot bay vòng quanh
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 7), // Bay chậm rãi trong 7 giây
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
        // 2. Line-by-line: Tính toán quỹ đạo bay hình Elip
        double dx = sin(_controller.value * 2 * pi) * 120;
        double dy = cos(_controller.value * 2 * pi) * 45;

        return Positioned(
          left: MediaQuery.of(context).size.width / 2 + dx - 40,
          top: 150 + dy,
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00D2FF).withValues(alpha: 0.2),
                  blurRadius: 20,
                ),
              ],
            ),
            // 3. Line-by-line: HIỂN THỊ GIF THAY CHO ICON CŨ
            child: Image.asset(
              'assets/images/arm_robot.gif',
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => const Icon(
                  Icons.error,
                  color: Colors.red), // Hiện lỗi nếu thiếu file
            ),
          ),
        );
      },
    );
  }
}
