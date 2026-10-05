import 'package:flutter/material.dart';

class RotatingRobotArmIcon extends StatefulWidget {
  final double size;
  final Color color;

  const RotatingRobotArmIcon({
    super.key,
    this.size = 80,
    this.color = const Color(0xFF00D2FF),
  });

  @override
  State<RotatingRobotArmIcon> createState() => _RotatingRobotArmIconState();
}

class _RotatingRobotArmIconState extends State<RotatingRobotArmIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();

    // 1. Khởi tạo Controller
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2), // Tốc độ lật qua lại
    )..repeat(reverse: true); // Lặp lại và ĐẢO CHIỀU (tạo hiệu ứng qua lại)

    // 2. Tạo Animation lật từ góc -45 độ đến 45 độ (quét hình quạt)
    // Hoặc nếu bạn muốn lật hẳn mặt trái/phải thì dùng góc lớn hơn
    _animation = Tween<double>(begin: -0.8, end: 0.8).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Transform(
          alignment: Alignment.center,
          // 3. Sử dụng Ma trận xoay quanh trục Y để tạo hiệu ứng lật trái/phải
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.001) // Thêm một chút chiều sâu 3D
            ..rotateY(_animation.value),
          child: Icon(
            Icons.precision_manufacturing,
            size: widget.size,
            color: widget.color,
          ),
        );
      },
    );
  }
}
